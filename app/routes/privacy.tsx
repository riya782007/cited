import type { MetaFunction } from "react-router";
import { PublicLayout } from "../components/PublicLayout";

export const meta: MetaFunction = () => [{ title: "Privacy policy · Cited by Newvora" }];

export default function Privacy() {
  return (
    <PublicLayout>
      <h1>Privacy policy</h1>
      <p>Effective 12 November 2026. This policy explains what data the Cited Shopify app ("Cited"), made by Newvora, New Delhi, India ("we"), collects from merchants who install it, how we use it, and how it is deleted.</p>

      <h2>What we collect</h2>
      <ul>
        <li><b>Store details:</b> your shop's myshopify domain, the date you installed Cited and your plan.</li>
        <li><b>Access credentials:</b> the access token Shopify issues so Cited can work with your store. It is stored encrypted at rest and never shared.</li>
        <li><b>Product data:</b> titles, descriptions, categories, variants, images and their alt text, product metafields and related fields, so we can score products and suggest fixes.</li>
        <li><b>Change history:</b> the before and after values of every change you approve, so you can undo it.</li>
        <li><b>No customer data:</b> Cited does not access or store your customers' names, emails, phone numbers, addresses or orders.</li>
      </ul>

      <h2>How we use it</h2>
      <p>Only to provide Cited's features to you: scoring your catalog, generating suggested product text, applying changes you approve, and supporting you. We do not sell your data or use it for advertising.</p>

      <h2>Service providers</h2>
      <p>Your data is stored in a database hosted by Supabase in Mumbai, India, and the app runs on Vercel. When you ask Cited to suggest product text, the relevant product fields are sent to an AI model provider to generate the suggestion; we only use AI providers whose API terms do not allow them to train their models on the data we send. These providers process data only on our behalf.</p>

      <h2>Retention and deletion</h2>
      <p>When you uninstall Cited, we delete your access tokens immediately. Shopify then sends us a data-deletion request 48 hours later, and we permanently delete all remaining data for your store: product snapshots, scores and change history. Customer data requests and deletion requests sent through Shopify are honoured; because Cited stores no customer personal data, there is nothing to export or erase for an individual customer.</p>

      <h2>Your rights</h2>
      <p>You can ask us to access, correct or delete your store's data at any time by writing to <a href="mailto:support@newvora.in">support@newvora.in</a>. We reply within 30 days.</p>

      <h2>Changes</h2>
      <p>We will update this page and the effective date if this policy changes. Material changes will also be shown inside the app.</p>

      <h2>Contact</h2>
      <p>Newvora, New Delhi, India · <a href="mailto:support@newvora.in">support@newvora.in</a></p>
    </PublicLayout>
  );
}
