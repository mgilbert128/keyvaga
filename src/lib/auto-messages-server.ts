import "server-only";
import { db } from "@/lib/db";
import { isDue, renderMessage, type PlaceholderKey, type Trigger } from "@/lib/auto-messages";
import { nightsBetween, todayIn } from "@/lib/dates";

const dayFmt = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
const timeFmt = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(Date.UTC(2000, 0, 1, h, m)).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
};

export function siteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "https://keyvaga.vercel.app";
}

type BookingForVars = {
  id: string; checkIn: Date; checkOut: Date; guests: number;
  guest: { name: string };
  listing: { title: string; checkInTime: string; checkOutTime: string; addressLine1: string; addressLine2: string; city: string; region: string; postalCode: string; checkInInstructions: string; owner: { name: string } };
};

export function placeholderValues(b: BookingForVars): Record<PlaceholderKey, string> {
  const l = b.listing;
  return {
    guest_first_name: b.guest.name.split(" ")[0] ?? b.guest.name,
    listing_title: l.title,
    check_in_date: dayFmt.format(b.checkIn),
    check_in_time: timeFmt(l.checkInTime),
    check_out_date: dayFmt.format(b.checkOut),
    check_out_time: timeFmt(l.checkOutTime),
    nights: String(nightsBetween(b.checkIn, b.checkOut)),
    guests: String(b.guests),
    address: [l.addressLine1, l.addressLine2, `${l.city}, ${l.region} ${l.postalCode}`.trim()].filter(Boolean).join(", "),
    checkin_instructions: l.checkInInstructions || "",
    host_first_name: l.owner.name.split(" ")[0] ?? l.owner.name,
    trip_link: `${siteUrl()}/trips/${b.id}`,
  };
}

const bookingInclude = {
  guest: { select: { name: true } },
  listing: { select: { id: true, ownerId: true, title: true, checkInTime: true, checkOutTime: true, addressLine1: true, addressLine2: true, city: true, region: true, postalCode: true, checkInInstructions: true, owner: { select: { name: true } } } },
  autoMessages: { select: { templateId: true } },
} as const;

/** Sends every automated message that's due for one booking and hasn't been sent yet. */
export async function sendDueAutoMessages(bookingId: string, today = todayIn()) {
  const b = await db.booking.findUnique({ where: { id: bookingId }, include: bookingInclude });
  if (!b || b.status !== "CONFIRMED") return 0;
  const templates = await db.messageTemplate.findMany({
    where: { ownerId: b.listing.ownerId, enabled: true, OR: [{ listingId: null }, { listingId: b.listing.id }] },
    orderBy: { createdAt: "asc" },
  });
  const sent = new Set(b.autoMessages.map((m) => m.templateId));
  const vars = placeholderValues(b);
  let count = 0;
  for (const t of templates) {
    if (sent.has(t.id) || !isDue(t.trigger as Trigger, t.offsetDays, b, today)) continue;
    const body = renderMessage(t.body, vars).replace(/\n{3,}/g, "\n\n").trim();
    if (!body) continue;
    try {
      await db.$transaction(async (tx) => {
        // The unique (booking, template) log row makes this safe against double sends.
        const log = await tx.autoMessageLog.create({ data: { bookingId: b.id, templateId: t.id } });
        const msg = await tx.message.create({ data: { bookingId: b.id, senderId: b.listing.ownerId, body: body.slice(0, 4000), automated: true } });
        await tx.autoMessageLog.update({ where: { id: log.id }, data: { messageId: msg.id } });
      });
      count++;
    } catch {
      // Already sent by a concurrent run.
    }
  }
  return count;
}

/** Daily: send due messages for current and recently finished confirmed bookings. */
export async function runAutoMessages(today = todayIn()) {
  const owners = (await db.messageTemplate.findMany({ where: { enabled: true }, select: { ownerId: true }, distinct: ["ownerId"] })).map((o) => o.ownerId);
  if (!owners.length) return { bookings: 0, sent: 0 };
  const bookings = await db.booking.findMany({
    where: { status: "CONFIRMED", listing: { ownerId: { in: owners } }, checkOut: { gte: new Date(today.getTime() - 8 * 86_400_000) } },
    select: { id: true },
  });
  let sent = 0;
  for (const { id } of bookings) sent += await sendDueAutoMessages(id, today).catch(() => 0);
  return { bookings: bookings.length, sent };
}
