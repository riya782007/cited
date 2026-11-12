import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { runScan } from "../lib/scan.server";
import { RULES } from "../lib/scoring";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  let shop = await db.shop.findUnique({ where: { shop: session.shop } });

  // First visit: scan straight away so the merchant sees a score immediately.
  let scanError: string | null = null;
  if (shop && !shop.lastScanAt) {
    try {
      await runScan(session.shop, admin.graphql);
      shop = await db.shop.findUnique({ where: { shop: session.shop } });
    } catch (e) {
      console.error("initial scan failed", e);
      scanError = "We couldn't finish scanning your catalog. Please try again.";
    }
  }

  const snapshots = await db.productSnapshot.findMany({
    where: { shop: session.shop },
    select: { failedRules: true, score: true },
  });
  const ruleCounts = RULES.map((r) => ({
    id: r.id,
    label: r.label,
    count: snapshots.filter((s) => s.failedRules.includes(r.id)).length,
  }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    avgScore: shop?.avgScore ?? null,
    productCount: shop?.productCount ?? 0,
    lastScanAt: shop?.lastScanAt?.toISOString() ?? null,
    below70: snapshots.filter((s) => (s.score ?? 0) < 70).length,
    topGaps: ruleCounts,
    onboardingDismissed: shop?.onboardingDismissed ?? false,
    scanError,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const form = await request.formData();
  const intent = form.get("intent");
  if (intent === "dismiss") {
    await db.shop.update({ where: { shop: session.shop }, data: { onboardingDismissed: true } });
    return { ok: true };
  }
  if (intent === "scan") {
    try {
      const r = await runScan(session.shop, admin.graphql);
      return { ok: true, scanned: r.count };
    } catch (e) {
      console.error("scan failed", e);
      return { ok: false, error: "The scan didn't finish. Please try again in a minute." };
    }
  }
  return { ok: false };
};

export default function Index() {
  const d = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const scanning = fetcher.state !== "idle" && fetcher.formData?.get("intent") === "scan";
  const lastScan = d.lastScanAt ? new Date(d.lastScanAt).toLocaleString() : "never";
  const error = d.scanError ?? (fetcher.data && !fetcher.data.ok ? (fetcher.data as any).error : null);

  return (
    <s-page heading="Cited">
      {!d.onboardingDismissed && (
        <s-banner heading="Get your catalog ready for AI shopping agents" tone="info">
          <s-paragraph>
            1. Check your Agent-Readiness Score below. 2. Open Products and click Fix to get AI suggestions for a
            product. 3. Turn on Agentic Storefronts in Settings → Apps and sales channels so AI agents can find your
            products. Nothing in your store changes unless you apply a suggestion.
          </s-paragraph>
          <s-button slot="secondary-actions" onClick={() => fetcher.submit({ intent: "dismiss" }, { method: "post" })}>
            Dismiss
          </s-button>
        </s-banner>
      )}

      {error && (
        <s-banner tone="critical" heading="Scan didn't finish">
          <s-paragraph>{error}</s-paragraph>
        </s-banner>
      )}

      <s-section heading="Agent-Readiness Score">
        <s-stack direction="block" gap="base">
          <s-heading>
            {d.avgScore === null ? "Not scanned yet" : `${d.avgScore} / 100`}
          </s-heading>
          <s-paragraph>
            {d.productCount} products scanned · {d.below70} score below 70 · last scan {lastScan}
          </s-paragraph>
          <s-stack direction="inline" gap="base">
            <s-button href="/app/products" variant="primary">See products</s-button>
            <s-button onClick={() => fetcher.submit({ intent: "scan" }, { method: "post" })} loading={scanning || undefined}>
              Scan again
            </s-button>
          </s-stack>
        </s-stack>
      </s-section>

      <s-section heading="What's holding your catalog back">
        {d.topGaps.length === 0 ? (
          <s-paragraph>No gaps found. Your products have what AI shopping agents look for.</s-paragraph>
        ) : (
          <s-unordered-list>
            {d.topGaps.map((g) => (
              <s-list-item key={g.id}>
                {g.label}: {g.count} {g.count === 1 ? "product" : "products"}
              </s-list-item>
            ))}
          </s-unordered-list>
        )}
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
