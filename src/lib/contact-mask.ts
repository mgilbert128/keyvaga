/**
 * Keeps deals on Keyvaga: hides phone numbers, email addresses and outside links in messages sent before a job or
 * stay is booked (and always in public profile text). Once booked, people can share details to coordinate.
 */
export const HIDDEN = "[contact info hidden until booked]";

const EMAIL = /[A-Z0-9._%+-]+\s*(?:@|\(at\)|\[at\]|\sat\s)\s*[A-Z0-9-]+(?:\s*(?:\.|\(dot\)|\[dot\]|\sdot\s)\s*[A-Z0-9-]+)*\s*(?:\.|\(dot\)|\[dot\]|\sdot\s)\s*[A-Z]{2,}/gi;
// 10+ digits with common separators: 251-555-0123, (251) 555 0123, +1 251.555.0123, 2515550123.
const PHONE = /(?:\+?1[\s.\-]*)?\(?\d{3}\)?[\s.\-]*\d{3}[\s.\-]*\d{4}\b/g;
const URL = /\b(?:https?:\/\/|www\.)\S+/gi;
const DOMAIN = /\b[a-z0-9][a-z0-9-]{1,62}\.(?:com|net|org|biz|info|co|us|io|me|site|online|services)\b(?:\/\S*)?/gi;
// Payment apps with a handle ("Venmo @joe-c", "cash app $joe"): paying outside Keyvaga skips its protection.
const SOCIAL = /\b(?:venmo|cash ?app|zelle|paypal)\b(?:\s+me)?(?:\s*(?:at|:))?\s*[@$][\w.\-]+/gi;

/** Returns the text with contact details replaced, and whether anything was hidden. */
export function maskContactInfo(text: string, replacement = HIDDEN): { text: string; masked: boolean } {
  let masked = false;
  const sub = (re: RegExp, keep?: (m: string) => boolean) => (s: string) =>
    s.replace(re, (m) => {
      if (keep?.(m)) return m;
      masked = true;
      return replacement;
    });
  const out = [
    sub(EMAIL),
    sub(URL, (m) => /keyvaga\.com/i.test(m)),
    sub(DOMAIN, (m) => /keyvaga\.com/i.test(m)),
    sub(PHONE),
    sub(SOCIAL),
  ].reduce((s, f) => f(s), text);
  return { text: out, masked };
}
