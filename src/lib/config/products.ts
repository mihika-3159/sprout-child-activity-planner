/**
 * Product Configuration
 *
 * Prices are configured via environment variables.
 * All prices default to null (unconfigured = "Free during beta").
 * NEVER hardcode prices in components.
 */

export type PlannerProduct = "weekly" | "monthly" | "yearly";

export interface ProductConfig {
  id: PlannerProduct;
  name: string;
  description: string;
  enabled: boolean;
  priceInPence: number | null; // null = not yet priced / free during beta
  currency: string;
  stripePriceId?: string; // Set when prices are configured in Stripe
}

/**
 * Read prices from environment variables.
 * Format: integer pence/cents (e.g., 499 = £4.99)
 * Returns null if not set or invalid.
 */
function parsePriceFromEnv(key: string): number | null {
  const value = process.env[key];
  if (!value) return null;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed) || parsed < 0) return null;
  return parsed;
}

export const PLANNER_PRODUCTS: Record<PlannerProduct, ProductConfig> = {
  weekly: {
    id: "weekly",
    name: "Weekly Planner",
    description: "A personalised 7-day activity plan tailored to your child",
    enabled: true,
    priceInPence: parsePriceFromEnv("PRODUCT_PRICE_WEEKLY"),
    currency: process.env.PRODUCT_CURRENCY ?? "GBP",
    stripePriceId: process.env.STRIPE_PRICE_ID_WEEKLY,
  },
  monthly: {
    id: "monthly",
    name: "Monthly Planner",
    description: "A full month of personalised activities with progression and variety",
    enabled: true,
    priceInPence: parsePriceFromEnv("PRODUCT_PRICE_MONTHLY"),
    currency: process.env.PRODUCT_CURRENCY ?? "GBP",
    stripePriceId: process.env.STRIPE_PRICE_ID_MONTHLY,
  },
  yearly: {
    id: "yearly",
    name: "Year Planner",
    description: "A comprehensive 12-month plan with themes, variety, and long-term progression",
    // disabled — not yet built; will be re-enabled in a future release
    enabled: false,
    priceInPence: parsePriceFromEnv("PRODUCT_PRICE_YEARLY"),
    currency: process.env.PRODUCT_CURRENCY ?? "GBP",
    stripePriceId: process.env.STRIPE_PRICE_ID_YEARLY,
  },
};

export function getProduct(id: PlannerProduct): ProductConfig {
  return PLANNER_PRODUCTS[id];
}

export function formatPrice(product: ProductConfig): string {
  if (product.priceInPence === null) return "Free during beta";
  if (product.priceInPence === 0) return "Free";
  const amount = product.priceInPence / 100;
  const symbols: Record<string, string> = {
    GBP: "£",
    USD: "$",
    EUR: "€",
  };
  const symbol = symbols[product.currency] ?? product.currency + " ";
  return `${symbol}${amount.toFixed(2)}`;
}

function parseIntSafe(val: string | undefined, fallback: number): number {
  if (!val || typeof val !== "string" || !val.trim()) return fallback;
  const parsed = parseInt(val.trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Rate limit configuration — all operations are rate limited separately.
 * Values are configurable via environment variables.
 */
export const AI_LIMITS = {
  chatMessages: {
    max: parseIntSafe(process.env.RATE_LIMIT_CHAT_MAX, 12),
    windowMinutes: parseIntSafe(process.env.RATE_LIMIT_CHAT_WINDOW_MINUTES, 10),
  },
  plannerPreviews: {
    max: parseIntSafe(process.env.RATE_LIMIT_PREVIEW_MAX, 3),
    windowMinutes: parseIntSafe(process.env.RATE_LIMIT_PREVIEW_WINDOW_MINUTES, 30),
  },
  fullPlannerGenerations: {
    max: parseIntSafe(process.env.RATE_LIMIT_GENERATION_MAX, 3),
    windowMinutes: parseIntSafe(process.env.RATE_LIMIT_GENERATION_WINDOW_MINUTES, 60),
  },
  activityRegenerations: {
    max: parseIntSafe(process.env.RATE_LIMIT_REGENERATION_MAX, 15),
    windowMinutes: parseIntSafe(process.env.RATE_LIMIT_REGENERATION_WINDOW_MINUTES, 60),
  },
} as const;

/**
 * Token budget configuration — controls maximum tokens per operation.
 * Prevents unexpectedly large AI requests and controls free-tier consumption.
 */
export const TOKEN_BUDGETS = {
  preferenceExtraction: parseInt(process.env.TOKEN_BUDGET_PREFERENCE ?? "1500", 10),
  activityBatch: parseInt(process.env.TOKEN_BUDGET_ACTIVITY_BATCH ?? "6000", 10),
  evidenceValidation: parseInt(process.env.TOKEN_BUDGET_EVIDENCE ?? "3000", 10),
  weeklyPlanner: parseInt(process.env.TOKEN_BUDGET_WEEKLY ?? "10000", 10),
  monthlyPlannerBatch: parseInt(process.env.TOKEN_BUDGET_MONTHLY ?? "12000", 10),
  yearlyPlannerBatch: parseInt(process.env.TOKEN_BUDGET_YEARLY ?? "12000", 10),
} as const;
