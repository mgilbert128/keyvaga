import "server-only";
import { renderEmail, type EmailContent } from "@/lib/email-templates";

/**
 * Sends email through Resend (https://resend.com) using its REST API.
 * - RESEND_API_KEY: required to send; without it emails are logged and skipped (local development).
 * - EMAIL_FROM: sender, e.g. "Keyvaga <hello@keyvaga.com>" once a domain is verified in Resend.
 *   Until then Resend's test sender only delivers to the Resend account's own email address.
 * Email never blocks or breaks the action that triggered it: failures are logged.
 */
export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendEmail(to: string | string[], content: EmailContent, opts: { replyTo?: string } = {}): Promise<boolean> {
  const { subject, html, text } = renderEmail(content);
  const key = process.env.RESEND_API_KEY;
  const recipients = (Array.isArray(to) ? to : [to]).filter((e) => /.+@.+\..+/.test(e));
  if (!recipients.length) return false;
  if (!key) {
    console.info(`[email skipped: RESEND_API_KEY not set] to=${recipients.join(",")} subject="${subject}"`);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "Keyvaga <onboarding@resend.dev>",
        to: recipients,
        subject,
        html,
        text,
        // Replies to site emails reach the support inbox unless a sender sets their own (e.g. a guest's address).
        reply_to: opts.replyTo ?? process.env.SUPPORT_EMAIL ?? "support@keyvaga.com",
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error("email send failed", res.status, (await res.text()).slice(0, 300));
      return false;
    }
    return true;
  } catch (e) {
    console.error("email send error", e instanceof Error ? e.message : e);
    return false;
  }
}
