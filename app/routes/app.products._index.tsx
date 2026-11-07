import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { ruleLabel } from "../lib/scoring";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const products = await db.productSnapshot.findMany({
    where: { shop: session.shop },
    orderBy: [{ score: "asc" }, { title: "asc" }],
    select: { id: true, title: true, score: true, failedRules: true },
  });
  return {
    products: products.map((p) => ({
      id: p.id,
      numericId: p.id.split("/").pop(),
      title: p.title,
      score: p.score ?? 0,
      gaps: p.failedRules.slice(0, 3).map(ruleLabel),
      more: Math.max(0, p.failedRules.length - 3),
    })),
  };
};

function tone(score: number) {
  return score >= 80 ? "success" : score >= 60 ? "warning" : "critical";
}

export default function Products() {
  const { products } = useLoaderData<typeof loader>();
  return (
    <s-page heading="Products">
      <s-section padding="none">
        {products.length === 0 ? (
          <s-box padding="base">
            <s-paragraph>No products scanned yet. Go to Home and run a scan.</s-paragraph>
          </s-box>
        ) : (
          <s-table>
            <s-table-header-row>
              <s-table-header listSlot="primary">Product</s-table-header>
              <s-table-header>Score</s-table-header>
              <s-table-header>What's missing</s-table-header>
              <s-table-header></s-table-header>
            </s-table-header-row>
            <s-table-body>
              {products.map((p) => (
                <s-table-row key={p.id}>
                  <s-table-cell>
                    <s-link href={`/app/products/${p.numericId}`}>{p.title}</s-link>
                  </s-table-cell>
                  <s-table-cell>
                    <s-badge tone={tone(p.score)}>{p.score}</s-badge>
                  </s-table-cell>
                  <s-table-cell>
                    {p.gaps.length === 0 ? "Nothing — ready for AI agents" : p.gaps.join(" · ") + (p.more ? ` · +${p.more} more` : "")}
                  </s-table-cell>
                  <s-table-cell>
                    {p.gaps.length > 0 && <s-button href={`/app/products/${p.numericId}`}>Fix</s-button>}
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        )}
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
