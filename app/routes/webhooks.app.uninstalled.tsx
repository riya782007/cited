import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

// Runs when a merchant uninstalls Cited. Sessions are removed straight away;
// the rest of the shop's data is deleted when Shopify sends shop/redact (48h later).
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);

  await db.session.deleteMany({ where: { shop } });
  await db.shop.updateMany({
    where: { shop },
    data: { uninstalledAt: new Date() },
  });

  return new Response();
};
