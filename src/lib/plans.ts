export type PlanId = "spark" | "build" | "pro" | "max" | "enterprise";

export const PLANS: Record<
  PlanId,
  {
    name: string;
    monthlyTasks: number | null; // null = unlimited
    usd: number;
    inr: number;
    stripePriceId: string | null; // null = free plan
  }
> = {
  spark: {
    name: "Spark",
    monthlyTasks: 3,
    usd: 0,
    inr: 0,
    stripePriceId: null,
  },
  build: {
    name: "Build",
    monthlyTasks: 50,
    usd: 24,
    inr: 2000,
    stripePriceId: process.env.STRIPE_PRICE_BUILD ?? null,
  },
  pro: {
    name: "Pro",
    monthlyTasks: 150,
    usd: 59,
    inr: 5000,
    stripePriceId: process.env.STRIPE_PRICE_PRO ?? null,
  },
  max: {
    name: "Max",
    monthlyTasks: 500,
    usd: 118,
    inr: 10000,
    stripePriceId: process.env.STRIPE_PRICE_MAX ?? null,
  },
  enterprise: {
    name: "Enterprise",
    monthlyTasks: null,
    usd: 235,
    inr: 20000,
    stripePriceId: process.env.STRIPE_PRICE_ENTERPRISE ?? null,
  },
};
