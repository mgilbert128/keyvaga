/**
 * Minimal iCalendar (RFC 5545) reading and writing for calendar sync with Airbnb, Vrbo, Booking.com,
 * Hospitable, OwnerRez and others. Only what availability needs: busy date ranges.
 * Dates follow the app's convention: UTC-midnight calendar dates, [start, end) with end = checkout day.
 */

export type IcsEvent = { uid: string; start: Date; end: Date; summary: string };

export const PROVIDERS = [
  { id: "airbnb", name: "Airbnb", match: /(^|\.)airbnb\./i },
  { id: "vrbo", name: "Vrbo", match: /(^|\.)(vrbo|homeaway|abritel|fewo-direkt|stayz|bookabach)\./i },
  { id: "booking", name: "Booking.com", match: /(^|\.)booking\.com$/i },
  { id: "hospitable", name: "Hospitable", match: /(^|\.)hospitable\.com$/i },
  { id: "ownerrez", name: "OwnerRez", match: /(^|\.)ownerrez\.com$/i },
  { id: "google", name: "Google Calendar", match: /(^|\.)google\.com$/i },
] as const;

export function detectProvider(url: string): { id: string; name: string } {
  try {
    const host = new URL(url).hostname;
    const p = PROVIDERS.find((x) => x.match.test(host));
    return p ? { id: p.id, name: p.name } : { id: "other", name: "Other calendar" };
  } catch {
    return { id: "other", name: "Other calendar" };
  }
}

const PRIVATE_HOST = /^(localhost|.*\.local|.*\.internal|metadata\.google\.internal)$/i;
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/** Owner-entered feed URL → normalized https URL, or an error message. webcal:// is accepted. */
export function normalizeFeedUrl(raw: string): { url: string } | { error: string } {
  let s = raw.trim();
  if (/^webcals?:\/\//i.test(s)) s = s.replace(/^webcals?:\/\//i, "https://");
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return { error: "That doesn't look like a calendar link. Copy the full link that starts with https://" };
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return { error: "Calendar links start with https://" };
  if (u.username || u.password) return { error: "Use the plain calendar link (no username or password in it)." };
  if (PRIVATE_HOST.test(u.hostname) || IPV4.test(u.hostname) || u.hostname.includes(":")) return { error: "That calendar address isn't allowed." };
  if (s.length > 2000) return { error: "That link is too long." };
  return { url: u.toString() };
}

/** Undo RFC 5545 line folding (continuation lines start with a space or tab). */
function unfold(text: string): string[] {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n[ \t]/g, "").split("\n");
}

function unescape(v: string) {
  return v.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1");
}

/** Calendar date (UTC midnight) a DTSTART/DTEND value falls on, in the listing's time zone. */
function toDay(params: string, value: string, timeZone: string): Date | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, se, z] = m;
  if (!h || /VALUE=DATE(?!-)/i.test(params) || !z) return new Date(Date.UTC(+y!, +mo! - 1, +d!)); // all-day, floating or TZID: date as written
  const instant = new Date(Date.UTC(+y!, +mo! - 1, +d!, +h, +mi!, +se!));
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);
  const [py, pm, pd] = parts.split("-").map(Number);
  return new Date(Date.UTC(py!, pm! - 1, pd!));
}

const DAY = 86_400_000;

/** Busy ranges in a feed. Cancelled events are skipped; a missing DTEND means one night. */
export function parseIcs(text: string, timeZone = "America/Chicago"): IcsEvent[] {
  const events: IcsEvent[] = [];
  let cur: Record<string, { params: string; value: string }> | null = null;
  for (const line of unfold(text)) {
    if (/^BEGIN:VEVENT$/i.test(line.trim())) { cur = {}; continue; }
    if (/^END:VEVENT$/i.test(line.trim())) {
      if (cur?.DTSTART) {
        const start = toDay(cur.DTSTART.params, cur.DTSTART.value, timeZone);
        let end = cur.DTEND ? toDay(cur.DTEND.params, cur.DTEND.value, timeZone) : null;
        const status = cur.STATUS?.value.trim().toUpperCase();
        if (start && status !== "CANCELLED") {
          if (!end || end <= start) end = new Date(start.getTime() + DAY);
          events.push({ uid: cur.UID ? unescape(cur.UID.value).trim() : `${start.toISOString()}-${end.toISOString()}`, start, end, summary: cur.SUMMARY ? unescape(cur.SUMMARY.value).trim().slice(0, 120) : "" });
        }
      }
      cur = null;
      continue;
    }
    if (!cur) continue;
    const m = /^([A-Za-z-]+)((?:;[^:]*)?):(.*)$/.exec(line);
    if (m) cur[m[1]!.toUpperCase()] = { params: m[2] ?? "", value: m[3] ?? "" };
  }
  return events;
}

/** Merge overlapping or touching ranges so the calendar shows one block per stay. */
export function mergeRanges(events: { start: Date; end: Date }[]): { start: Date; end: Date }[] {
  const sorted = [...events].sort((a, b) => +a.start - +b.start);
  const out: { start: Date; end: Date }[] = [];
  for (const e of sorted) {
    const last = out[out.length - 1];
    if (last && +e.start <= +last.end) {
      if (+e.end > +last.end) last.end = e.end;
    } else out.push({ start: e.start, end: e.end });
  }
  return out;
}

const icsDate = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
const icsStamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");

/** Fold to 75 octets per RFC 5545 (ASCII content here, so characters = octets). */
function fold(line: string) {
  const out: string[] = [];
  for (let i = 0; i < line.length; i += i === 0 ? 75 : 74) out.push((i === 0 ? "" : " ") + line.slice(i, i === 0 ? 75 : i + 74));
  return out.join("\r\n");
}

/** Builds an export feed. Events carry no guest details: other platforms only need "busy". */
export function buildIcs(calName: string, events: { uid: string; start: Date; end: Date; summary: string }[], now = new Date()): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Keyvaga//Calendar sync//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${esc(calName)}`];
  for (const e of events) {
    lines.push("BEGIN:VEVENT", `UID:${e.uid}`, `DTSTAMP:${icsStamp(now)}`, `DTSTART;VALUE=DATE:${icsDate(e.start)}`, `DTEND;VALUE=DATE:${icsDate(e.end)}`, `SUMMARY:${esc(e.summary)}`, "TRANSP:OPAQUE", "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
