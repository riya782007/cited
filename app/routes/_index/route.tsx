import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { redirect } from "react-router";
import { PublicLayout, publicStyles as s } from "../../components/PublicLayout";

export const meta: MetaFunction = () => [
  { title: "Cited by Newvora: get your Shopify products recommended by AI shopping agents" },
  { name: "description", content: "Cited scores every Shopify product for what ChatGPT, Gemini, Copilot and Perplexity need before they recommend it, fixes the gaps with your approval, and shows the revenue AI agents bring in." },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  // Shopify opens the app URL with ?shop=...; send merchants into the embedded app.
  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }
  return null;
};

export default function Landing() {
  return (
    <PublicLayout>
      <p className={s.muted}>A Shopify app by Newvora</p>
      <h1>Get your products recommended by AI shopping agents</h1>
      <p className={s.lead}>
        Shoppers now ask ChatGPT, Gemini, Copilot and Perplexity what to buy. Cited checks every product in your
        Shopify store against what those assistants need before they recommend it, then helps you fix the gaps.
        Nothing in your store changes unless you approve it.
      </p>
      <a className={s.cta} href="/docs">How Cited works</a>
      <div className={s.cards}>
        <div className={s.card}>
          <h3>Agent-Readiness Score</h3>
          <p>A 0–100 score for every product and your whole catalog, with the exact gaps in plain English.</p>
        </div>
        <div className={s.card}>
          <h3>Fixes you approve</h3>
          <p>Clearer titles, descriptions and product attributes, written only from facts already in your product data. Every change can be undone.</p>
        </div>
        <div className={s.card}>
          <h3>AI revenue, measured</h3>
          <p>See the orders and revenue that come to your store from AI assistants.</p>
        </div>
      </div>
      <p className={s.muted} style={{ marginTop: 28 }}>
        Install Cited from the Shopify App Store. Questions? Write to <a href="mailto:support@newvora.in">support@newvora.in</a>.
      </p>
    </PublicLayout>
  );
}
