// "Fix with AI": asks OpenAI for better product copy, using only facts already in the product.
// Nothing here writes to Shopify — the merchant approves each suggestion first.

import { stripHtml } from "./scoring";

export type AiSuggestion = {
  title: string | null;
  descriptionHtml: string | null;
  productType: string | null;
  categoryQuery: string | null;
  missingFacts: string[];
};

const MODEL = process.env.OPENAI_MODEL || "gpt-6-luna";

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "descriptionHtml", "productType", "categoryQuery", "missingFacts"],
  properties: {
    title: { type: ["string", "null"], description: "Improved title, or null if the current one is fine." },
    descriptionHtml: {
      type: ["string", "null"],
      description: "Improved description as simple HTML (<p>, <ul>, <li>, <strong>), or null if fine.",
    },
    productType: { type: ["string", "null"], description: "Short product type (e.g. 'Cotton T-shirt'), or null if fine." },
    categoryQuery: {
      type: ["string", "null"],
      description: "2-4 words to search Shopify's standard product taxonomy (e.g. 'T-shirts'), or null if a category is already set.",
    },
    missingFacts: {
      type: "array",
      items: { type: "string" },
      description: "Facts a shopper or AI agent would want that are NOT in the data (e.g. 'material', 'dimensions'). The merchant must add these.",
    },
  },
} as const;

const SYSTEM = `You improve Shopify product listings so AI shopping assistants (ChatGPT, Gemini, Copilot, Perplexity) understand and recommend them.

Hard rules:
- Use ONLY facts present in the product data you are given. Never invent materials, sizes, dimensions, certifications, origins, ingredients, warranties or claims.
- If a fact is missing, do not guess it — list it in missingFacts instead.
- Title: say clearly what the product is, include brand-neutral key attributes that are in the data (colour, material, size range) when present. 20-150 characters. No ALL CAPS, no emojis, no promotional words like "best" or "amazing".
- Description: clear, factual, scannable. Start with one sentence saying what it is and who it is for (only if the data supports it). Then a short bullet list of the facts in the data. Keep every fact from the original description. Plain HTML only.
- Keep the merchant's language (if the original is in Hindi, write Hindi, etc.).
- Return null for any field that is already good.`;

function buildInput(product: any, failedLabels: string[]) {
  const variants = (product.variants?.nodes ?? []).slice(0, 20).map((v: any) => ({ price: v.price, sku: v.sku }));
  return JSON.stringify(
    {
      title: product.title,
      vendor: product.vendor,
      productType: product.productType,
      category: product.category?.fullName ?? null,
      options: (product.options ?? []).map((o: any) => o.name),
      description: stripHtml(product.descriptionHtml).slice(0, 4000),
      descriptionHtml: (product.descriptionHtml ?? "").slice(0, 6000),
      attributes: (product.metafields?.nodes ?? []).map((m: any) => ({ key: m.key, value: m.value })),
      variants,
      problemsFound: failedLabels,
    },
    null,
    1,
  );
}

export function aiConfigured() {
  return !!process.env.OPENAI_API_KEY;
}

export async function suggestFix(product: any, failedLabels: string[]): Promise<AiSuggestion> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("AI is not configured");

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: MODEL,
      instructions: SYSTEM,
      input: `Improve this product. Product data (JSON):\n${buildInput(product, failedLabels)}`,
      text: { format: { type: "json_schema", name: "product_fix", strict: true, schema: SCHEMA } },
      store: false,
    }),
    signal: AbortSignal.timeout(45_000),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("openai error", res.status, body.slice(0, 500));
    throw new Error(`AI request failed (${res.status})`);
  }
  const json: any = await res.json();
  const text =
    json.output_text ??
    (json.output ?? [])
      .flatMap((o: any) => o.content ?? [])
      .filter((c: any) => c.type === "output_text")
      .map((c: any) => c.text)
      .join("");
  const parsed = JSON.parse(text) as AiSuggestion;

  // Drop "suggestions" identical to what's already there.
  const same = (a?: string | null, b?: string | null) => (a ?? "").trim() === (b ?? "").trim();
  if (same(parsed.title, product.title)) parsed.title = null;
  if (same(parsed.descriptionHtml, product.descriptionHtml)) parsed.descriptionHtml = null;
  if (same(parsed.productType, product.productType)) parsed.productType = null;
  if (product.category?.id) parsed.categoryQuery = null;
  return parsed;
}
