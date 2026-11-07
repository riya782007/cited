import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

// Cited stores no customer personal data (only products, scores and
// product change history), so there is nothing to export for a customer.
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);
  console.log(`Received ${topic} for ${shop}: no customer data stored`);
  return new Response();
};
