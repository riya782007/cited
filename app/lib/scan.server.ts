import db from "../db.server";
import { scoreProduct, type ProductInput, type ShopContext } from "./scoring";

export type AdminGraphql = (query: string, opts?: { variables?: Record<string, unknown> }) => Promise<Response>;

const PRODUCT_FIELDS = `
        id
        title
        handle
        vendor
        productType
        descriptionHtml
        category { id fullName }
        options { name }
        variants(first: 100) {
          nodes { barcode sku price compareAtPrice inventoryItem { tracked } }
        }
        media(first: 20) { nodes { alt mediaContentType } }
        metafields(first: 50, namespace: "shopify") { nodes { key value } }`;

const PRODUCTS_QUERY = `#graphql
  query CitedScanProducts($cursor: String) {
    products(first: 50, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      nodes { ${PRODUCT_FIELDS} }
    }
  }`;

const PRODUCT_QUERY = `#graphql
  query CitedProduct($id: ID!) {
    product(id: $id) { ${PRODUCT_FIELDS} }
  }`;

const SHOP_QUERY = `#graphql
  query CitedShopPolicies {
    shop { shopPolicies { type body } }
  }`;

const REQUIRED_POLICIES = ["REFUND_POLICY", "PRIVACY_POLICY", "TERMS_OF_SERVICE", "SHIPPING_POLICY"];

export async function gql(graphql: AdminGraphql, query: string, variables?: Record<string, unknown>) {
  const res = await graphql(query, variables ? { variables } : undefined);
  const json = (await res.json()) as { data?: any; errors?: unknown };
  if (json.errors) throw new Error(`Shopify GraphQL error: ${JSON.stringify(json.errors)}`);
  return json.data;
}

export async function getShopContext(graphql: AdminGraphql): Promise<ShopContext> {
  let data: any;
  try {
    data = await gql(graphql, SHOP_QUERY);
  } catch (e) {
    // Without the read_legal_policies scope we can't check policies; don't penalise the store for that.
    console.warn("shop policies unavailable, skipping policy rule", String(e).slice(0, 200));
    return { policiesComplete: true, missingPolicies: [] };
  }
  const present = new Set(
    (data?.shop?.shopPolicies ?? [])
      .filter((p: { body?: string }) => (p.body ?? "").replace(/<[^>]*>/g, "").trim().length > 0)
      .map((p: { type: string }) => p.type),
  );
  const missing = REQUIRED_POLICIES.filter((t) => !present.has(t));
  return { policiesComplete: missing.length === 0, missingPolicies: missing };
}

function toInput(n: any): ProductInput {
  const images = (n.media?.nodes ?? []).filter((m: any) => m.mediaContentType === "IMAGE");
  const metas = (n.metafields?.nodes ?? []).filter((m: any) => (m.value ?? "").trim().length > 0);
  return {
    id: n.id,
    title: n.title ?? "",
    handle: n.handle,
    vendor: n.vendor,
    productType: n.productType,
    categoryName: n.category?.fullName ?? null,
    descriptionHtml: n.descriptionHtml,
    optionNames: (n.options ?? []).map((o: any) => o.name),
    variants: (n.variants?.nodes ?? []).map((v: any) => ({
      barcode: v.barcode, sku: v.sku, price: v.price, compareAtPrice: v.compareAtPrice,
      tracked: v.inventoryItem?.tracked ?? null,
    })),
    images: images.map((m: any) => ({ alt: m.alt })),
    categoryMetafieldCount: metas.length,
    categoryMetafieldKeys: metas.map((m: any) => m.key),
  };
}

/** Reads the whole catalog, scores every product and stores the results. */
export async function runScan(shop: string, graphql: AdminGraphql) {
  const shopCtx = await getShopContext(graphql);
  let cursor: string | null = null;
  const seen: string[] = [];
  let total = 0;
  let count = 0;

  do {
    const data = await gql(graphql, PRODUCTS_QUERY, { cursor });
    const page = data.products;
    for (const n of page.nodes) {
      const input = toInput(n);
      const { score, failed } = scoreProduct(input, shopCtx);
      seen.push(n.id);
      total += score;
      count++;
      await db.productSnapshot.upsert({
        where: { id: n.id },
        create: { id: n.id, shop, title: input.title, handle: input.handle, data: input as any, score, failedRules: failed },
        update: { title: input.title, handle: input.handle, data: input as any, score, failedRules: failed },
      });
    }
    cursor = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  } while (cursor);

  // Remove snapshots for products that no longer exist.
  await db.productSnapshot.deleteMany({ where: { shop, id: { notIn: seen } } });

  const avgScore = count ? Math.round(total / count) : null;
  await db.shop.update({
    where: { shop },
    data: { lastScanAt: new Date(), productCount: count, avgScore },
  });
  return { count, avgScore, missingPolicies: shopCtx.missingPolicies };
}

/** Fetches one product straight from Shopify (raw node, includes category id). */
export async function fetchProduct(graphql: AdminGraphql, id: string) {
  const data = await gql(graphql, PRODUCT_QUERY, { id });
  return data.product as any | null;
}

/** Re-scores a single product (after a fix or undo) and refreshes the shop average. */
export async function rescanProduct(shop: string, graphql: AdminGraphql, id: string) {
  const shopCtx = await getShopContext(graphql);
  const n = await fetchProduct(graphql, id);
  if (!n) {
    await db.productSnapshot.deleteMany({ where: { shop, id } });
  } else {
    const input = toInput(n);
    const { score, failed } = scoreProduct(input, shopCtx);
    await db.productSnapshot.upsert({
      where: { id },
      create: { id, shop, title: input.title, handle: input.handle, data: input as any, score, failedRules: failed },
      update: { title: input.title, handle: input.handle, data: input as any, score, failedRules: failed },
    });
  }
  const agg = await db.productSnapshot.aggregate({ where: { shop }, _avg: { score: true }, _count: true });
  await db.shop.update({
    where: { shop },
    data: { productCount: agg._count, avgScore: agg._avg.score == null ? null : Math.round(agg._avg.score) },
  });
}
