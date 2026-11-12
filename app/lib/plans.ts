// Plan definitions shared by server and UI. Prices must match the Managed Pricing plans in the Partner Dashboard.
export const PLANS = {
  free: { name: "Free", price: 0, fixesPerMonth: 25 },
  growth: { name: "Growth", price: 19, fixesPerMonth: 1000 },
} as const;
export type PlanId = keyof typeof PLANS;
