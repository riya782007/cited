import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { ruleLabel, stripHtml } from "../lib/scoring";
import { aiConfigured } from "../lib/ai.server";
import {
  FIELD_LABEL,
  applySuggestions,
  fixAllowance,
  generateSuggestions,
  skipSuggestions,
  type Field,
} from "../lib/fixes.server";

const gid = (id: string) => `gid://shopify/Product/${id.replace(/\D/g, "")}`;

function show(field: string, v: any): string {
  if (v == null || v === "") return "(empty)";
  if (field === "category") return v.fullName ?? "(none)";
  if (field === "descriptionHtml") return stripHtml(v);
  return String(v);
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const productId = gid(params.id!);
  const snap = await db.productSnapshot.findFirst({ where: { id: productId, shop: session.shop } });
  if (!snap) throw new Response("Product not found", { status: 404 });

  const suggestions = await db.change.findMany({
    where: { shop: session.shop, productId, status: "suggested" },
    orderBy: { createdAt: "asc" },
  });
  const history = await db.change.findMany({
    where: { shop: session.shop, productId, status: { in: ["applied", "undone"] } },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return {
    product: { id: productId, numericId: params.id, title: snap.title, score: snap.score ?? 0 },
    gaps: snap.failedRules.map((r) => ({ id: r, label: ruleLabel(r) })),
    suggestions: suggestions.map((c) => ({
      id: c.id,
      label: FIELD_LABEL[c.field as Field] ?? c.field,
      before: show(c.field, c.before),
      after: show(c.field, c.after),
    })),
    history: history.map((c) => ({
      id: c.id,
      label: FIELD_LABEL[c.field as Field] ?? c.field,
      status: c.status,
      at: c.createdAt.toISOString(),
    })),
    allowance: await fixAllowance(session.shop),
    aiReady: aiConfigured(),
  };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const productId = gid(params.id!);
  const form = await request.formData();
  const intent = String(form.get("intent"));
  try {
    if (intent === "suggest") {
      const r = await generateSuggestions(session.shop, admin.graphql, productId);
      return { ok: true, intent, count: r.count, missingFacts: r.missingFacts };
    }
    if (intent === "apply") {
      const ids = String(form.get("ids") ?? "").split(",").filter(Boolean);
      const n = await applySuggestions(session.shop, admin.graphql, productId, ids);
      return { ok: true, intent, applied: n };
    }
    if (intent === "skip") {
      await skipSuggestions(session.shop, productId);
      return { ok: true, intent };
    }
  } catch (e) {
    console.error(`fix ${intent} failed`, e);
    return { ok: false, intent, error: e instanceof Error ? e.message : "Something went wrong. Please try again." };
  }
  return { ok: false, intent, error: "Unknown action" };
};

function tone(score: number) {
  return score >= 80 ? "success" : score >= 60 ? "warning" : "critical";
}

export default function ProductFix() {
  const d = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const busy = fetcher.state !== "idle" ? String(fetcher.formData?.get("intent")) : null;
  const res = fetcher.data as any;
  const allIds = d.suggestions.map((s) => s.id).join(",");
  const outOfFixes = d.allowance.remaining === 0;

  return (
    <s-page heading={d.product.title}>
      <s-link slot="breadcrumb-actions" href="/app/products">Products</s-link>
      <s-button slot="secondary-actions" href={`shopify://admin/products/${d.product.numericId}`} target="_blank">
        Open in Shopify
      </s-button>

      {res && !res.ok && (
        <s-banner tone="critical" heading="That didn't work">
          <s-paragraph>{res.error}</s-paragraph>
        </s-banner>
      )}
      {res?.ok && res.intent === "apply" && (
        <s-banner tone="success" heading="Changes saved to your product">
          <s-paragraph>You can undo any change from Change history.</s-paragraph>
        </s-banner>
      )}
      {res?.ok && res.intent === "suggest" && res.count === 0 && (
        <s-banner tone="info" heading="No text changes to suggest">
          <s-paragraph>The AI didn't find anything to improve using the facts already in this product.</s-paragraph>
        </s-banner>
      )}

      <s-section heading="Agent-Readiness Score">
        <s-stack direction="block" gap="base">
          <s-stack direction="inline" gap="base">
            <s-badge tone={tone(d.product.score)}>{d.product.score} / 100</s-badge>
          </s-stack>
          {d.gaps.length === 0 ? (
            <s-paragraph>Nothing missing. This product has what AI shopping agents look for.</s-paragraph>
          ) : (
            <s-unordered-list>
              {d.gaps.map((g) => <s-list-item key={g.id}>{g.label}</s-list-item>)}
            </s-unordered-list>
          )}
        </s-stack>
      </s-section>

      <s-section heading="Fix with AI">
        <s-stack direction="block" gap="base">
          <s-paragraph>
            Cited suggests a clearer title, description, product type and standard category using only the facts
            already in this product. Nothing changes until you apply it.
          </s-paragraph>
          {d.allowance.limit != null && (
            <s-text tone="neutral">
              {d.allowance.used} of {d.allowance.limit} free AI fixes used this month.
            </s-text>
          )}
          {!d.aiReady ? (
            <s-text>AI suggestions aren't available right now.</s-text>
          ) : (
            <s-stack direction="inline" gap="base">
              <s-button
                variant={d.suggestions.length ? "secondary" : "primary"}
                disabled={outOfFixes || undefined}
                loading={busy === "suggest" || undefined}
                onClick={() => fetcher.submit({ intent: "suggest" }, { method: "post" })}
              >
                {d.suggestions.length ? "Suggest again" : "Suggest fixes"}
              </s-button>
            </s-stack>
          )}
          {res?.ok && res.intent === "suggest" && res.missingFacts?.length > 0 && (
            <s-banner tone="warning" heading="Add these facts yourself">
              <s-paragraph>
                AI agents look for these, but they aren't in your product data, so Cited won't make them up:{" "}
                {res.missingFacts.join(", ")}.
              </s-paragraph>
            </s-banner>
          )}
        </s-stack>
      </s-section>

      {d.suggestions.length > 0 && (
        <s-section heading="Review suggestions">
          <s-stack direction="block" gap="large">
            {d.suggestions.map((s) => (
              <s-box key={s.id} padding="base" border="base" borderRadius="base">
                <s-stack direction="block" gap="small-200">
                  <s-heading>{s.label}</s-heading>
                  <s-text tone="neutral">Now</s-text>
                  <s-paragraph>{s.before}</s-paragraph>
                  <s-text tone="success">Suggested</s-text>
                  <s-paragraph>{s.after}</s-paragraph>
                  <s-stack direction="inline" gap="base">
                    <s-button
                      loading={(busy === "apply" && fetcher.formData?.get("ids") === s.id) || undefined}
                      onClick={() => fetcher.submit({ intent: "apply", ids: s.id }, { method: "post" })}
                    >
                      Apply this
                    </s-button>
                  </s-stack>
                </s-stack>
              </s-box>
            ))}
            <s-stack direction="inline" gap="base">
              <s-button
                variant="primary"
                loading={(busy === "apply" && fetcher.formData?.get("ids") === allIds) || undefined}
                onClick={() => fetcher.submit({ intent: "apply", ids: allIds }, { method: "post" })}
              >
                Apply all
              </s-button>
              <s-button
                loading={busy === "skip" || undefined}
                onClick={() => fetcher.submit({ intent: "skip" }, { method: "post" })}
              >
                Skip
              </s-button>
            </s-stack>
          </s-stack>
        </s-section>
      )}

      {d.history.length > 0 && (
        <s-section heading="Recent changes">
          <s-unordered-list>
            {d.history.map((h) => (
              <s-list-item key={h.id}>
                {h.label} {h.status === "undone" ? "(undone)" : "updated"} · {new Date(h.at).toLocaleString()}
              </s-list-item>
            ))}
          </s-unordered-list>
          <s-link href="/app/history">See all changes and undo</s-link>
        </s-section>
      )}
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
