import Stripe from "stripe";

// Lazily create the Stripe client so a missing key never breaks the build —
// it only matters at request time, once env vars are set in production.
let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    client = new Stripe(key);
  }
  return client;
}
