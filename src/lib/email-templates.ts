/**
 * Plain, branded email layout. Pure functions (no sending) so they're easy to test.
 * Everything user-supplied is HTML-escaped.
 */

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export type EmailContent = {
  subject: string;
  /** Short line shown in inbox previews. */
  preview?: string;
  heading: string;
  /** Paragraphs of plain text (escaped; newlines kept). */
  paragraphs: string[];
  /** Optional label/value rows (escaped). */
  details?: { label: string; value: string }[];
  /** A quoted block, e.g. a message body. */
  quote?: string;
  button?: { label: string; url: string };
  footer?: string;
};

const BRAND = "#0f5e52";
const INK = "#1c2a27";
const MUTED = "#59645f";

function safeUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : "#";
}

export function renderEmail(c: EmailContent): { subject: string; html: string; text: string } {
  const p = (t: string) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:${INK}">${escapeHtml(t).replace(/\n/g, "<br>")}</p>`;
  const details = c.details?.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 20px;border-collapse:collapse">${c.details
        .map((d) => `<tr><td style="padding:6px 0;color:${MUTED};font-size:14px;width:40%">${escapeHtml(d.label)}</td><td style="padding:6px 0;color:${INK};font-size:14px;font-weight:600">${escapeHtml(d.value)}</td></tr>`)
        .join("")}</table>`
    : "";
  const quote = c.quote
    ? `<div style="margin:0 0 20px;padding:14px 16px;border-left:4px solid ${BRAND};background:#e2efeb;border-radius:8px;color:${INK};font-size:15px;line-height:1.5">${escapeHtml(c.quote).replace(/\n/g, "<br>")}</div>`
    : "";
  const button = c.button
    ? `<p style="margin:8px 0 24px"><a href="${escapeHtml(safeUrl(c.button.url))}" style="display:inline-block;background:${BRAND};color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:10px;font-size:16px">${escapeHtml(c.button.label)}</a></p>`
    : "";
  const html = `<!doctype html><html><body style="margin:0;background:#f8f7f4;font-family:Inter,Helvetica,Arial,sans-serif">
<span style="display:none;max-height:0;overflow:hidden">${escapeHtml(c.preview ?? c.heading)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8f7f4;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e4e2dc;border-radius:16px;padding:28px">
<tr><td>
<p style="margin:0 0 20px;font-size:22px;font-weight:700;letter-spacing:-0.02em"><span style="color:${BRAND}">key</span><span style="color:${INK}">vaga</span></p>
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:${INK}">${escapeHtml(c.heading)}</h1>
${c.paragraphs.map(p).join("")}${details}${quote}${button}
<p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:${MUTED}">${escapeHtml(c.footer ?? "You're receiving this because you have a Keyvaga account.")}</p>
</td></tr></table></td></tr></table></body></html>`;
  const text = [
    c.heading,
    "",
    ...c.paragraphs,
    ...(c.details?.length ? ["", ...c.details.map((d) => `${d.label}: ${d.value}`)] : []),
    ...(c.quote ? ["", c.quote.split("\n").map((l) => `> ${l}`).join("\n")] : []),
    ...(c.button ? ["", `${c.button.label}: ${c.button.url}`] : []),
    "",
    c.footer ?? "You're receiving this because you have a Keyvaga account.",
  ].join("\n");
  return { subject: c.subject, html, text };
}
