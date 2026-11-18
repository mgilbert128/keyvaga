import "server-only";
import { db } from "@/lib/db";
import { isConfiguredAdmin } from "@/lib/auth/admin";

/**
 * Soft launch: new owners join a waitlist instead of creating listings (the site itself is public). On until Stripe has live keys, unless SOFT_LAUNCH says
 * otherwise ("true" keeps it on after going live, "false" turns it off early).
 */
export function softLaunch(): boolean {
  const v = process.env.SOFT_LAUNCH?.trim().toLowerCase();
  if (v === "true") return true;
  if (v === "false") return false;
  return !process.env.STRIPE_SECRET_KEY?.startsWith("sk_live");
}

/** Emails let in to create listings during the soft launch (OWNER_INVITES, comma-separated). */
function invited(email: string): boolean {
  return (process.env.OWNER_INVITES ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean).includes(email.trim().toLowerCase());
}

/** During the soft launch only admins, invited owners and owners who already have a listing can add listings. */
export async function canCreateListings(user: { id: string; email: string }): Promise<boolean> {
  if (!softLaunch()) return true;
  if (isConfiguredAdmin(user.email) || invited(user.email)) return true;
  return (await db.listing.count({ where: { ownerId: user.id, deletedAt: null } })) > 0;
}
