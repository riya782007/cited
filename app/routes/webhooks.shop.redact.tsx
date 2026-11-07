import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

// Sent 48 hours after uninstall: permanently delete everything Cited holds for the shop.
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);
  console.log(`Received ${topic} for ${shop}: deleting all shop data`);

  await db.$transaction([
    db.change.deleteMany({ where: { shop } }),
    db.productSnapshot.deleteMany({ where: { shop } }),
    db.session.deleteMany({ where: { shop } }),
    db.shop.deleteMany({ where: { shop } }),
  ]);

  return new Response();
};
