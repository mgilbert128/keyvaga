import "server-only";
import Stripe from "stripe";

let client: Stripe | undefined;

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/** Server-side Stripe client. Uses the fetch-based HTTP client (works on Vercel and behind proxies). */
export function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Payments are not configured (STRIPE_SECRET_KEY is missing).");
  client ??= new Stripe(key, { httpClient: Stripe.createFetchHttpClient(), appInfo: { name: "Keyvaga" } });
  return client;
}

export function idOf(v: string | { id: string } | null | undefined): string | null {
  if (!v) return null;
  return typeof v === "string" ? v : v.id;
}
