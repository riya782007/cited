import db from "../db.server";
import { scoreProduct, type ProductInput, type ShopContext } from "./scoring";

type AdminGraphql = (query: string, opts?: { variables?: Record<string, unknown> }) => Promise<Response>;

const PRODUCTS_QUERY = `#graphql
  query CitedScanProducts($cursor: String) {
    products(first: 50, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        title
        handle
        vendor
        productType
        descriptionHtml
        category { fullName }
        options { name }
        variants(first: 100) {
          nodes { barcode sku price compareAtPrice inventoryItem { tracked } }
        }
        media(first: 20) { nodes { alt mediaContentType } }
        metafields(first: 50, namespace: "shopify") { nodes { key value } }
      }
    }
  }`;

const SHOP_QUERY = `#graphql
  query CitedShopPolicies {
    shop { shopPolicies { type body } }
  }`;

const REQUIRED_POLICIES = ["REFUND_POLICY", "PRIVACY_POLICY", "TERMS_OF_SERVICE", "SHIPPING_POLICY"];

async function gql(graphql: AdminGraphql, query: string, variables?: Record<string, unknown>) {
  const res = await graphql(query, variables ? { variables } : undefined);
  const json = (await res.json()) as { data?: any; errors?: unknown };
  if (json.errors) throw new Error(`Shopify GraphQL error: ${JSON.stringify(json.errors)}`);
  return json.data;
}

export async function getShopContext(graphql: AdminGraphql): Promise<ShopContext> {
  const data = await gql(graphql, SHOP_QUERY);
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
