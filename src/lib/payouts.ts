import "server-only";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";

/** Creates (once) the owner's Stripe Express account and returns a Stripe-hosted onboarding link. */
export async function payoutOnboardingLink(userId: string, origin: string): Promise<string> {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  let accountId = user.stripeAccountId;
  if (!accountId) {
    const account = await stripe().accounts.create(
      {
        type: "express",
        country: "US",
        email: user.email,
        capabilities: { transfers: { requested: true } },
        business_profile: { product_description: "Vacation rental host on Keyvaga", mcc: "7011" },
        metadata: { keyvagaUserId: user.id },
      },
      { idempotencyKey: `connect-account-${user.id}` },
    );
    accountId = account.id;
    await db.user.update({ where: { id: user.id }, data: { stripeAccountId: accountId } });
  }
  const link = await stripe().accountLinks.create({
    account: accountId,
    refresh_url: `${origin}/owner/payouts?refresh=1`,
    return_url: `${origin}/owner/payouts?return=1`,
    type: "account_onboarding",
  });
  return link.url;
}

/** Re-reads the owner's account from Stripe and stores whether payouts can be sent. */
export async function refreshPayoutStatus(userId: string) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.stripeAccountId) return { connected: false, payoutsEnabled: false, detailsSubmitted: false };
  const account = await stripe().accounts.retrieve(user.stripeAccountId);
  const payoutsEnabled = Boolean(account.payouts_enabled && account.capabilities?.transfers === "active");
  if (payoutsEnabled !== user.payoutsEnabled) await db.user.update({ where: { id: user.id }, data: { payoutsEnabled } });
  return { connected: true, payoutsEnabled, detailsSubmitted: Boolean(account.details_submitted) };
}

export async function payoutDashboardLink(userId: string): Promise<string | null> {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.stripeAccountId) return null;
  const link = await stripe().accounts.createLoginLink(user.stripeAccountId);
  return link.url;
}
