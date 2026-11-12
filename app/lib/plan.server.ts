// Plans are sold through Shopify Managed Pricing (set up in the Partner Dashboard listing).
// We only read which plan is active; Shopify handles checkout, trials, upgrades and cancellations.

import db from "../db.server";
import { gql, type AdminGraphql } from "./scan.server";
import { PLANS, type PlanId } from "./plans";

export { PLANS, type PlanId };

export const APP_HANDLE = "cited-by-newvora";


const SUBS_QUERY = `#graphql
  query CitedActiveSubscriptions {
    currentAppInstallation { activeSubscriptions { name status test } }
  }`;

/** Reads the active Managed Pricing subscription and stores the plan on the Shop row. */
export async function syncPlan(shop: string, graphql: AdminGraphql): Promise<PlanId> {
  let plan: PlanId = "free";
  try {
    const data = await gql(graphql, SUBS_QUERY);
    const subs: { name: string; status: string }[] = data?.currentAppInstallation?.activeSubscriptions ?? [];
    if (subs.some((s) => s.status === "ACTIVE" && /growth/i.test(s.name))) plan = "growth";
  } catch (e) {
    console.warn("could not read subscriptions", String(e).slice(0, 200));
    const row = await db.shop.findUnique({ where: { shop }, select: { plan: true } });
    return (row?.plan as PlanId) in PLANS ? (row!.plan as PlanId) : "free";
  }
  await db.shop.update({ where: { shop }, data: { plan } }).catch(() => {});
  return plan;
}

export function pricingUrl(shop: string) {
  const handle = shop.replace(/\.myshopify\.com$/, "");
  return `https://admin.shopify.com/store/${handle}/charges/${APP_HANDLE}/pricing_plans`;
}
