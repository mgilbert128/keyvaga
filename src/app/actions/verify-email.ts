"use server";

import { getCurrentUser } from "@/lib/auth/dal";
import { sendVerificationEmail } from "@/lib/email-verification";

export type ResendResult = { ok?: boolean; message?: string } | undefined;

export async function resendVerification(_prev: ResendResult): Promise<ResendResult> {
  const user = await getCurrentUser();
  if (!user) return { message: "Please log in again." };
  const r = await sendVerificationEmail(user.id);
  if (r === "already") return { ok: true, message: "Your email is already confirmed. Refresh the page." };
  if (r === "limited") return { message: "We've sent several links today. Check your spam folder, or try again tomorrow." };
  return { ok: true, message: `Sent! Check ${user.email} (and your spam folder).` };
}
