// Agent-Readiness scoring: 18 rules, weights sum to 100.
// Pure functions (no Shopify or DB access) so they can be unit-tested.

export type ProductInput = {
  id: string;
  title: string;
  handle?: string | null;
  vendor?: string | null;
  productType?: string | null;
  categoryName?: string | null;
  descriptionHtml?: string | null;
  optionNames: string[];
  variants: {
    barcode?: string | null;
    sku?: string | null;
    price?: string | null;
    compareAtPrice?: string | null;
    tracked?: boolean | null;
  }[];
  images: { alt?: string | null }[];
  categoryMetafieldCount: number;
  categoryMetafieldKeys: string[];
};

export type ShopContext = { policiesComplete: boolean; missingPolicies: string[] };

export type Rule = {
  id: string;
  label: string; // what the merchant sees when it fails
  weight: number;
  test: (p: ProductInput, shop: ShopContext) => boolean;
};

const MATERIALS = /\b(cotton|linen|wool|silk|leather|suede|denim|polyester|nylon|viscose|rayon|cashmere|canvas|jute|bamboo|wood(en)?|oak|teak|walnut|metal|steel|stainless|iron|brass|copper|aluminium|aluminum|gold|silver|platinum|sterling|ceramic|porcelain|stoneware|glass|plastic|silicone|rubber|marble|stone|resin|paper|cardboard|velvet|satin|chiffon|georgette|khadi|organza|crepe)\b/i;
const MEASURE = /\b\d+(\.\d+)?\s?(mm|cm|m|in|inch|inches|ft|kg|g|gm|grams|ml|l|litre|liter|oz|lb|lbs|gsm|"|')(\b|$)|\b\d+\s?[x×]\s?\d+/i;
const SIZES = /\b(xxs|xs|s|m|l|xl|xxl|xxxl|free size|one size)\b/i;
const CARE = /\b(wash|dry clean|hand wash|machine wash|wipe|dishwasher|iron|care)\b/i;

export function stripHtml(html?: string | null): string {
  return (html ?? "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function factSignals(text: string): number {
  return [/\d/.test(text), MATERIALS.test(text), MEASURE.test(text), CARE.test(text)].filter(Boolean).length;
}

export const RULES: Rule[] = [
  { id: "title_type", weight: 8, label: "Title doesn't say what the product is",
    test: (p) => {
      const t = p.title.toLowerCase();
      const words = [p.productType, p.categoryName?.split(" > ").pop()]
        .filter(Boolean)
        .flatMap((w) => w!.toLowerCase().split(/[\s/&,-]+/))
        .map((w) => w.replace(/s$/, ""))
        .filter((w) => w.length > 2);
      return words.some((w) => t.includes(w));
    } },
  { id: "title_length", weight: 4, label: "Title is too short or too long (aim for 20–150 characters)",
    test: (p) => p.title.trim().length >= 20 && p.title.trim().length <= 150 },
  { id: "vendor", weight: 3, label: "Brand (vendor) is missing", test: (p) => !!p.vendor?.trim() },
  { id: "category", weight: 10, label: "No Shopify standard product category", test: (p) => !!p.categoryName },
  { id: "product_type", weight: 3, label: "Product type is empty", test: (p) => !!p.productType?.trim() },
  { id: "category_attrs", weight: 8, label: "Category attributes (like colour, material, size) aren't filled",
    test: (p) => p.categoryMetafieldCount >= 2 },
  { id: "material", weight: 5, label: "Material isn't stated",
    test: (p) => p.categoryMetafieldKeys.some((k) => /material|fabric/i.test(k)) || MATERIALS.test(stripHtml(p.descriptionHtml)) || MATERIALS.test(p.title) },
  { id: "size", weight: 4, label: "Size or dimensions aren't stated",
    test: (p) => p.optionNames.some((n) => /size|dimension|length|width|volume|capacity|weight/i.test(n)) ||
      MEASURE.test(stripHtml(p.descriptionHtml)) || SIZES.test(stripHtml(p.descriptionHtml)) },
  { id: "option_names", weight: 3, label: "Variant options have unclear names (like \"Option1\")",
    test: (p) => !p.optionNames.some((n) => /^option\s?\d*$/i.test(n.trim())) },
  { id: "gtin", weight: 8, label: "Some variants have no barcode (GTIN, UPC or EAN)",
    test: (p) => p.variants.length > 0 && p.variants.every((v) => !!v.barcode?.trim()) },
  { id: "sku", weight: 3, label: "Some variants have no SKU",
    test: (p) => p.variants.length > 0 && p.variants.every((v) => !!v.sku?.trim()) },
  { id: "desc_length", weight: 8, label: "Description is under 300 characters",
    test: (p) => stripHtml(p.descriptionHtml).length >= 300 },
  { id: "desc_facts", weight: 7, label: "Description has few concrete facts (numbers, materials, sizes, care)",
    test: (p) => factSignals(stripHtml(p.descriptionHtml)) >= 2 },
  { id: "images", weight: 5, label: "Fewer than 3 images", test: (p) => p.images.length >= 3 },
  { id: "alt_text", weight: 5, label: "Some images have no alt text",
    test: (p) => p.images.length > 0 && p.images.every((i) => !!i.alt?.trim()) },
  { id: "price", weight: 4, label: "Price is missing, or the compare-at price isn't higher than the price",
    test: (p) => p.variants.length > 0 && p.variants.every((v) => {
      const price = Number(v.price ?? 0);
      const cmp = v.compareAtPrice == null ? null : Number(v.compareAtPrice);
      return price > 0 && (cmp === null || cmp === 0 || cmp > price);
    }) },
  { id: "inventory", weight: 4, label: "Inventory isn't tracked for some variants",
    test: (p) => p.variants.length > 0 && p.variants.every((v) => v.tracked === true) },
  { id: "policies", weight: 8, label: "Store policies are incomplete (needed for Agentic Storefronts)",
    test: (_p, shop) => shop.policiesComplete },
];

export const TOTAL_WEIGHT = RULES.reduce((a, r) => a + r.weight, 0);

export function scoreProduct(p: ProductInput, shop: ShopContext) {
  let score = 0;
  const failed: string[] = [];
  for (const r of RULES) {
    if (r.test(p, shop)) score += r.weight;
    else failed.push(r.id);
  }
  return { score: Math.round((score / TOTAL_WEIGHT) * 100), failed };
}

export function ruleLabel(id: string) {
  return RULES.find((r) => r.id === id)?.label ?? id;
}
