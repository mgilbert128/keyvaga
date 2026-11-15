"use server";

import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { hashSessionToken } from "@/lib/auth/tokens";
import { notifyPasswordReset } from "@/lib/notify";

export type ResetResult = { ok?: boolean; message?: string } | undefined;

const SAME_ANSWER = "If an account exists for that email, we've sent a link to reset your password. Check your inbox (and spam folder).";

/** Emails a one-time reset link. Always gives the same answer so it can't be used to find out who has an account. */
export async function requestPasswordReset(_prev: ResetResult, fd: FormData): Promise<ResetResult> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  if (!/.+@.+\..+/.test(email)) return { message: "Enter a valid email address." };
  const user = await db.user.findUnique({ where: { email } });
  if (user) {
    const recent = await db.passwordResetToken.count({ where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 3_600_000) } } });
    if (recent < 3) {
      const token = randomBytes(32).toString("base64url");
      await db.passwordResetToken.create({ data: { id: hashSessionToken(token), userId: user.id, expiresAt: new Date(Date.now() + 3_600_000) } });
      const h = await headers();
      const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
      await notifyPasswordReset(user.email, user.name, `${origin}/reset-password?token=${token}`);
    }
  }
  return { ok: true, message: SAME_ANSWER };
}

/** Sets a new password from a valid, unused, unexpired link, then signs out every device. */
export async function resetPassword(_prev: ResetResult, fd: FormData): Promise<ResetResult> {
  const token = String(fd.get("token") ?? "");
  const password = String(fd.get("password") ?? "");
  if (password.length < 10 || password.length > 128) return { message: "Use at least 10 characters." };
  const row = token ? await db.passwordResetToken.findUnique({ where: { id: hashSessionToken(token) } }) : null;
  if (!row || row.usedAt || row.expiresAt < new Date()) return { message: "This reset link has expired or was already used. Request a new one." };
  // Mark used first (conditionally) so a link can't be used twice, even at the same moment.
  const { count } = await db.passwordResetToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
  if (!count) return { message: "This reset link was already used. Request a new one." };
  await db.$transaction([
    db.user.update({ where: { id: row.userId }, data: { passwordHash: await hashPassword(password) } }),
    db.session.deleteMany({ where: { userId: row.userId } }),
    db.passwordResetToken.updateMany({ where: { userId: row.userId, usedAt: null }, data: { usedAt: new Date() } }),
  ]);
  redirect("/login?reset=1");
}
