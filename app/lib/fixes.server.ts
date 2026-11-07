// Suggest / apply / undo product fixes. Every change is logged in the Change table so it can be undone.
// Change.status: suggested -> applied | skipped ; applied -> undone

import db from "../db.server";
import { fetchProduct, gql, rescanProduct, type AdminGraphql } from "./scan.server";
import { chooseCategory, suggestFix } from "./ai.server";
import { ruleLabel, stripHtml } from "./scoring";

export const FREE_FIXES_PER_MONTH = 25;
export const FIELDS = ["title", "descriptionHtml", "productType", "category"] as const;
export type Field = (typeof FIELDS)[number];

export const FIELD_LABEL: Record<Field, string> = {
  title: "Title",
  descriptionHtml: "Description",
  productType: "Product type",
  category: "Standard category",
};

const TAXONOMY_QUERY = `#graphql
  query CitedTaxonomy($q: String!) {
    taxonomy { categories(search: $q, first: 10) { nodes { id fullName isLeaf } } }
  }`;

const UPDATE_MUTATION = `#graphql
  mutation CitedProductUpdate($product: ProductUpdateInput!) {
    productUpdate(product: $product) {
      product { id }
      userErrors { field message }
    }
  }`;

function monthStart() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

/** Number of distinct products that got AI suggestions this month. */
export async function fixesUsedThisMonth(shop: string) {
  const rows = await db.change.groupBy({
    by: ["productId"],
    where: { shop, createdAt: { gte: monthStart() } },
  });
  return rows.length;
}

export async function fixAllowance(shop: string) {
  const s = await db.shop.findUnique({ where: { shop }, select: { plan: true } });
  const plan = s?.plan ?? "free";
  const used = await fixesUsedThisMonth(shop);
  const limit = plan === "free" ? FREE_FIXES_PER_MONTH : null;
  return { plan, used, limit, remaining: limit == null ? null : Math.max(0, limit - used) };
}

export async function generateSuggestions(shop: string, graphql: AdminGraphql, productId: string) {
  // Quota: a product already worked on this month doesn't count twice.
  const already = await db.change.count({ where: { shop, productId, createdAt: { gte: monthStart() } } });
  const allowance = await fixAllowance(shop);
  if (!already && allowance.remaining === 0) {
    throw new Error(`You've used all ${FREE_FIXES_PER_MONTH} free AI fixes this month.`);
  }

  const product = await fetchProduct(graphql, productId);
  if (!product) throw new Error("Product not found");
  const snap = await db.productSnapshot.findUnique({ where: { id: productId } });
  const s = await suggestFix(product, (snap?.failedRules ?? []).map(ruleLabel));

  // Look up the standard category the AI suggested.
  let category: { id: string; fullName: string } | null = null;
  if (s.categoryQuery) {
    try {
      const data = await gql(graphql, TAXONOMY_QUERY, { q: s.categoryQuery });
      const nodes: { id: string; fullName: string }[] = (data?.taxonomy?.categories?.nodes ?? []).map((n: any) => ({
        id: n.id,
        fullName: n.fullName,
      }));
      const pickedId = await chooseCategory(
        { title: product.title, productType: s.productType ?? product.productType, description: stripHtml(product.descriptionHtml).slice(0, 1000) },
        nodes,
      );
      category = nodes.find((n) => n.id === pickedId) ?? null;
    } catch (e) {
      console.warn("taxonomy search failed", String(e).slice(0, 200));
    }
  }

  // Replace any earlier pending suggestions for this product.
  await db.change.deleteMany({ where: { shop, productId, status: "suggested" } });

  const rows: { field: Field; before: any; after: any }[] = [];
  if (s.title) rows.push({ field: "title", before: product.title ?? "", after: s.title });
  if (s.descriptionHtml) rows.push({ field: "descriptionHtml", before: product.descriptionHtml ?? "", after: s.descriptionHtml });
  if (s.productType) rows.push({ field: "productType", before: product.productType ?? "", after: s.productType });
  if (category) rows.push({ field: "category", before: product.category ?? null, after: category });

  for (const r of rows) {
    await db.change.create({
      data: { shop, productId, field: r.field, before: r.before ?? null, after: r.after, status: "suggested" },
    });
  }
  return { count: rows.length, missingFacts: s.missingFacts };
}

function inputFor(field: Field, value: any) {
  if (field === "category") return { category: value?.id ?? null };
  return { [field]: value ?? "" };
}

async function writeProduct(graphql: AdminGraphql, productId: string, input: Record<string, unknown>) {
  const data = await gql(graphql, UPDATE_MUTATION, { product: { id: productId, ...input } });
  const errs = data?.productUpdate?.userErrors ?? [];
  if (errs.length) throw new Error(errs.map((e: any) => e.message).join("; "));
}

/** Applies the chosen suggestions (by Change id) in one productUpdate, then re-scores the product. */
export async function applySuggestions(shop: string, graphql: AdminGraphql, productId: string, ids: string[]) {
  const changes = await db.change.findMany({ where: { shop, productId, status: "suggested", id: { in: ids } } });
  if (!changes.length) return 0;

  // Refresh "before" from the live product so undo restores what was really there.
  const live = await fetchProduct(graphql, productId);
  const input: Record<string, unknown> = {};
  for (const c of changes) Object.assign(input, inputFor(c.field as Field, c.after));
  await writeProduct(graphql, productId, input);

  for (const c of changes) {
    const before = c.field === "category" ? live?.category ?? null : live?.[c.field] ?? "";
    await db.change.update({ where: { id: c.id }, data: { status: "applied", before } });
  }
  await rescanProduct(shop, graphql, productId);
  return changes.length;
}

export async function skipSuggestions(shop: string, productId: string) {
  await db.change.updateMany({ where: { shop, productId, status: "suggested" }, data: { status: "skipped" } });
}

export async function undoChange(shop: string, graphql: AdminGraphql, changeId: string) {
  const c = await db.change.findFirst({ where: { id: changeId, shop, status: "applied" } });
  if (!c) throw new Error("Change not found or already undone");
  await writeProduct(graphql, c.productId, inputFor(c.field as Field, c.before));
  await db.change.update({ where: { id: c.id }, data: { status: "undone", undoneAt: new Date() } });
  await rescanProduct(shop, graphql, c.productId);
}
