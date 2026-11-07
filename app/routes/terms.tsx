import type { MetaFunction } from "react-router";
import { PublicLayout } from "../components/PublicLayout";

export const meta: MetaFunction = () => [{ title: "Terms of service · Cited by Newvora" }];

export default function Terms() {
  return (
    <PublicLayout>
      <h1>Terms of service</h1>
      <p>Effective 7 November 2026. These terms apply to your use of the Cited Shopify app ("Cited"), provided by Newvora, New Delhi, India ("we"). By installing Cited you agree to them.</p>

      <h2>The service</h2>
      <p>Cited analyses your Shopify product data, suggests improvements, applies changes you approve, and reports on orders that come from AI assistants. Suggestions are generated automatically; you are responsible for reviewing them before you approve them.</p>

      <h2>No guaranteed results</h2>
      <p>AI assistants and search engines decide independently what they show and recommend. Cited aims to improve how your products are understood, but we do not guarantee any ranking, recommendation, traffic or revenue.</p>

      <h2>Billing</h2>
      <p>Paid plans are billed by Shopify through your regular Shopify invoice, at the price shown in the app when you choose a plan. You can change or cancel your plan at any time from inside the app; cancelling stops future charges. Refunds are handled under Shopify's billing policies.</p>

      <h2>Your data</h2>
      <p>You keep ownership of your store data. We process it only to provide Cited, as described in our <a href="/privacy">privacy policy</a>.</p>

      <h2>Acceptable use</h2>
      <p>Do not use Cited to publish unlawful, misleading or infringing product information, or to attempt to access other merchants' data.</p>

      <h2>Availability and liability</h2>
      <p>We work to keep Cited available and correct, but it is provided "as is". To the extent the law allows, our total liability for any claim is limited to the fees you paid for Cited in the three months before the claim.</p>

      <h2>Changes and termination</h2>
      <p>We may update these terms and will show the new effective date here. You can stop using Cited at any time by uninstalling it.</p>

      <h2>Contact</h2>
      <p><a href="mailto:support@newvora.in">support@newvora.in</a></p>
    </PublicLayout>
  );
}
