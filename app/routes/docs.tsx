import type { MetaFunction } from "react-router";
import { PublicLayout } from "../components/PublicLayout";

export const meta: MetaFunction = () => [{ title: "Docs · Cited by Newvora" }];

export default function Docs() {
  return (
    <PublicLayout>
      <h1>How Cited works</h1>

      <h2>1. Install and scan</h2>
      <p>After you install Cited from the Shopify App Store, it reads your product catalog and gives each product an Agent-Readiness Score from 0 to 100. Nothing in your store changes during the scan.</p>

      <h2>2. Read the score</h2>
      <p>The score reflects whether a product has what AI shopping assistants need to understand and recommend it, for example:</p>
      <ul>
        <li>A title that says what the product is</li>
        <li>A Shopify standard product category</li>
        <li>Key attributes such as material, size and colour</li>
        <li>A description with concrete facts, not only marketing words</li>
        <li>Barcodes or GTINs on variants</li>
        <li>Images with alt text</li>
        <li>Complete store policies (refund, privacy, terms and shipping)</li>
      </ul>

      <h2>3. Review and approve fixes</h2>
      <p>For each product, Cited can suggest a clearer title, description and attributes, using only facts already in your product data. You see a before-and-after comparison and decide. Every approved change is logged and can be undone in one click.</p>

      <h2>4. Turn on Agentic Storefronts</h2>
      <p>Shopify's Agentic Storefronts sales channel makes eligible products available inside AI assistants. In Shopify admin, go to <b>Settings → Apps and sales channels</b> and look for <b>Agentic storefronts</b>. Cited's score helps your products qualify and perform there.</p>

      <h2>Frequently asked questions</h2>
      <h3>Will Cited change my products without asking?</h3>
      <p>No. Cited only writes to your store after you approve a change, and you can undo it.</p>
      <h3>Does Cited guarantee my products will be recommended?</h3>
      <p>No. AI assistants decide independently. Cited improves the product information they rely on.</p>
      <h3>What happens to my data if I uninstall?</h3>
      <p>Your access token is deleted immediately and all remaining store data is permanently deleted 48 hours later. See the <a href="/privacy">privacy policy</a>.</p>
      <h3>How do I get help?</h3>
      <p>Write to <a href="mailto:support@newvora.in">support@newvora.in</a> or see <a href="/support">Support</a>.</p>
    </PublicLayout>
  );
}
