import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { hashSessionToken } from "@/lib/auth/tokens";
import { notifyVerifyEmail } from "@/lib/notify";
import { siteUrl } from "@/lib/site";

const VALID_HOURS = 48;

/** Sends a confirm-your-email link (at most 5 per day per user). */
export async function sendVerificationEmail(userId: string): Promise<"sent" | "already" | "limited"> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { email: true, name: true, emailVerifiedAt: true } });
  if (!user) return "limited";
  if (user.emailVerifiedAt) return "already";
  const recent = await db.emailVerificationToken.count({ where: { userId, createdAt: { gt: new Date(Date.now() - 86_400_000) } } });
  if (recent >= 5) return "limited";
  const token = randomBytes(32).toString("base64url");
  await db.emailVerificationToken.create({ data: { id: hashSessionToken(token), userId, expiresAt: new Date(Date.now() + VALID_HOURS * 3_600_000) } });
  await notifyVerifyEmail(user.email, user.name, `${siteUrl()}/verify-email?token=${token}`);
  return "sent";
}

/** Confirms the email for a valid, unused, unexpired link. Returns the user id, or null. */
export async function confirmEmail(token: string): Promise<string | null> {
  if (!token) return null;
  const row = await db.emailVerificationToken.findUnique({ where: { id: hashSessionToken(token) } });
  if (!row || row.expiresAt < new Date()) return null;
  // Clicking the link twice (or a mail scanner opening it first) is fine: the email stays confirmed.
  await db.$transaction([
    db.emailVerificationToken.update({ where: { id: row.id }, data: { usedAt: row.usedAt ?? new Date() } }),
    db.user.updateMany({ where: { id: row.userId, emailVerifiedAt: null }, data: { emailVerifiedAt: new Date() } }),
  ]);
  return row.userId;
}

export class EmailNotVerifiedError extends Error {
  constructor() {
    super("Please confirm your email address first. We sent you a link when you signed up (you can resend it from the banner at the top of the page).");
  }
}

export async function isEmailVerified(userId: string): Promise<boolean> {
  const u = await db.user.findUnique({ where: { id: userId }, select: { emailVerifiedAt: true } });
  return Boolean(u?.emailVerifiedAt);
}
