import type Stripe from "stripe";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { syncPaymentIntent } from "@/lib/bookings";

/**
 * Stripe calls this when payments succeed or fail and when an owner's payout account changes.
 * The signature check proves the request really came from Stripe.
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature) return new Response("Webhook not configured", { status: 400 });

  let event: Stripe.Event;
  try {
    event = await stripe().webhooks.constructEventAsync(await request.text(), signature, secret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded":
      case "payment_intent.payment_failed":
      case "payment_intent.canceled":
        await syncPaymentIntent(event.data.object as Stripe.PaymentIntent);
        break;
      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        const payoutsEnabled = Boolean(account.payouts_enabled && account.capabilities?.transfers === "active");
        await db.user.updateMany({ where: { stripeAccountId: account.id }, data: { payoutsEnabled } });
        break;
      }
    }
  } catch (e) {
    console.error("webhook handling failed", event.type, e);
    return new Response("Handler error", { status: 500 }); // Stripe retries
  }
  return Response.json({ received: true });
}
