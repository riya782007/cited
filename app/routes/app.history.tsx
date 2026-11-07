import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { FIELD_LABEL, undoChange, type Field } from "../lib/fixes.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const changes = await db.change.findMany({
    where: { shop: session.shop, status: { in: ["applied", "undone"] } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const titles = new Map(
    (
      await db.productSnapshot.findMany({
        where: { id: { in: [...new Set(changes.map((c) => c.productId))] } },
        select: { id: true, title: true },
      })
    ).map((p) => [p.id, p.title]),
  );
  return {
    changes: changes.map((c) => ({
      id: c.id,
      productTitle: titles.get(c.productId) ?? "Deleted product",
      numericId: c.productId.split("/").pop(),
      field: FIELD_LABEL[c.field as Field] ?? c.field,
      status: c.status,
      at: c.createdAt.toISOString(),
    })),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const form = await request.formData();
  try {
    await undoChange(session.shop, admin.graphql, String(form.get("id")));
    return { ok: true };
  } catch (e) {
    console.error("undo failed", e);
    return { ok: false, error: e instanceof Error ? e.message : "Undo failed. Please try again." };
  }
};

export default function History() {
  const { changes } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const res = fetcher.data as any;
  const undoing = fetcher.state !== "idle" ? fetcher.formData?.get("id") : null;

  return (
    <s-page heading="Change history">
      {res && !res.ok && (
        <s-banner tone="critical" heading="Undo didn't work">
          <s-paragraph>{res.error}</s-paragraph>
        </s-banner>
      )}
      {res?.ok && (
        <s-banner tone="success" heading="Change undone">
          <s-paragraph>The product is back to how it was.</s-paragraph>
        </s-banner>
      )}
      <s-section padding="none">
        {changes.length === 0 ? (
          <s-box padding="base">
            <s-paragraph>No changes yet. Cited only changes a product when you apply a suggestion.</s-paragraph>
          </s-box>
        ) : (
          <s-table>
            <s-table-header-row>
              <s-table-header listSlot="primary">Product</s-table-header>
              <s-table-header>Field</s-table-header>
              <s-table-header>When</s-table-header>
              <s-table-header></s-table-header>
            </s-table-header-row>
            <s-table-body>
              {changes.map((c) => (
                <s-table-row key={c.id}>
                  <s-table-cell>
                    <s-link href={`/app/products/${c.numericId}`}>{c.productTitle}</s-link>
                  </s-table-cell>
                  <s-table-cell>{c.field}</s-table-cell>
                  <s-table-cell>{new Date(c.at).toLocaleString()}</s-table-cell>
                  <s-table-cell>
                    {c.status === "undone" ? (
                      <s-badge>Undone</s-badge>
                    ) : (
                      <s-button
                        loading={undoing === c.id || undefined}
                        onClick={() => fetcher.submit({ id: c.id }, { method: "post" })}
                      >
                        Undo
                      </s-button>
                    )}
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
