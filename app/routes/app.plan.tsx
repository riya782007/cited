import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { pricingUrl } from "../lib/plan.server";
import { PLANS } from "../lib/plans";
import { fixAllowance } from "../lib/fixes.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const allowance = await fixAllowance(session.shop);
  return { allowance, pricingUrl: pricingUrl(session.shop) };
};

export default function Plan() {
  const { allowance, pricingUrl } = useLoaderData<typeof loader>();
  const current = PLANS[allowance.plan];

  return (
    <s-page heading="Plan">
      <s-section heading={`You're on the ${current.name} plan`}>
        <s-stack direction="block" gap="base">
          <s-paragraph>
            {allowance.used} of {allowance.limit} AI fixes used this month. Usage resets on the 1st of each month.
          </s-paragraph>
          <s-stack direction="inline" gap="base">
            <s-button variant="primary" href={pricingUrl} target="_top">
              {allowance.plan === "free" ? "Upgrade plan" : "Change plan"}
            </s-button>
          </s-stack>
        </s-stack>
      </s-section>

      <s-section heading="Compare plans">
        <s-table>
          <s-table-header-row>
            <s-table-header listSlot="primary">Plan</s-table-header>
            <s-table-header>Price</s-table-header>
            <s-table-header>What you get</s-table-header>
          </s-table-header-row>
          <s-table-body>
            <s-table-row>
              <s-table-cell>Free</s-table-cell>
              <s-table-cell>$0</s-table-cell>
              <s-table-cell>
                Agent-Readiness Score for every product, what's missing, AI fixes for {PLANS.free.fixesPerMonth} products
                a month, change history with undo
              </s-table-cell>
            </s-table-row>
            <s-table-row>
              <s-table-cell>Growth</s-table-cell>
              <s-table-cell>${PLANS.growth.price}/month</s-table-cell>
              <s-table-cell>
                Everything in Free, plus AI fixes for up to {PLANS.growth.fixesPerMonth.toLocaleString()} products a month
              </s-table-cell>
            </s-table-row>
          </s-table-body>
        </s-table>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
