import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(
    `#graphql
      query CitedProductCount {
        productsCount(limit: null) { count }
      }`,
  );
  const json = await response.json();
  const productCount: number = json.data?.productsCount?.count ?? 0;

  return { productCount };
};

export default function Index() {
  const { productCount } = useLoaderData<typeof loader>();

  return (
    <s-page heading="Cited">
      <s-section heading="Get your catalog ready for AI shopping agents">
        <s-paragraph>
          Cited checks every product against what AI shopping assistants like
          ChatGPT, Gemini, Copilot and Perplexity need before they recommend
          it, then helps you fix the gaps. Nothing in your store changes
          unless you approve it.
        </s-paragraph>
        <s-paragraph>
          Your store has <s-text type="strong">{productCount}</s-text>{" "}
          {productCount === 1 ? "product" : "products"}. The first
          Agent-Readiness scan is coming in the next update.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
