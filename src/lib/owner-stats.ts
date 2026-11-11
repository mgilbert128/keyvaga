import "server-only";
import { db } from "@/lib/db";
import { addDays, nightsBetween, todayIn } from "@/lib/dates";
import { DOC_INFO, currentDoc, expiresSoon, isExpired, requiredDocuments } from "@/lib/documents";

/** Nights of [a, b) that fall inside [from, to). */
export function overlapNights(a: Date, b: Date, from: Date, to: Date): number {
  const start = a > from ? a : from;
  const end = b < to ? b : to;
  return Math.max(0, nightsBetween(start, end));
}

export type AttentionItem = { key: string; text: string; action: string; href: string };

export async function ownerOverview(ownerId: string) {
  const today = todayIn();
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1));
  const daysInMonth = nightsBetween(monthStart, monthEnd);

  const [listings, monthBookings, upcoming, pendingPayouts, owner, blocks] = await Promise.all([
    db.listing.findMany({ where: { ownerId }, select: { id: true, title: true, status: true, reviewNote: true, hostingRole: true, permitRequired: true, documents: true } }),
    db.booking.findMany({
      where: { listing: { ownerId }, checkIn: { lt: monthEnd }, checkOut: { gt: monthStart }, OR: [{ status: "CONFIRMED" }, { status: "CANCELLED", payoutDueCents: { gt: 0 } }] },
      select: { checkIn: true, checkOut: true, status: true, hostPayoutCents: true, payoutDueCents: true },
    }),
    db.booking.findMany({
      where: { listing: { ownerId }, status: "CONFIRMED", checkOut: { gt: today } },
      orderBy: { checkIn: "asc" },
      include: { listing: { select: { id: true, title: true } }, guest: { select: { name: true } } },
    }),
    db.booking.findMany({ where: { listing: { ownerId }, payoutStatus: "PENDING" }, orderBy: { checkIn: "asc" }, select: { checkIn: true, payoutDueCents: true } }),
    db.user.findUniqueOrThrow({ where: { id: ownerId }, select: { payoutsEnabled: true } }),
    db.calendarBlock.findMany({ where: { listing: { ownerId, status: "PUBLISHED" }, startDate: { lt: monthEnd }, endDate: { gt: monthStart } }, select: { startDate: true, endDate: true } }),
  ]);

  // Earnings this month: the owner's share of every night that falls in this month.
  let earnings = 0;
  let bookedNights = 0;
  for (const b of monthBookings) {
    const total = nightsBetween(b.checkIn, b.checkOut);
    const inMonth = overlapNights(b.checkIn, b.checkOut, monthStart, monthEnd);
    const payout = b.status === "CONFIRMED" ? b.hostPayoutCents : b.payoutDueCents;
    earnings += Math.round((payout * inMonth) / total);
    if (b.status === "CONFIRMED") bookedNights += inMonth;
  }
  const published = listings.filter((l) => l.status === "PUBLISHED").length;
  const blockedNights = blocks.reduce((s, b) => s + overlapNights(b.startDate, b.endDate, monthStart, monthEnd), 0);
  const availableNights = published * daysInMonth - blockedNights;
  const occupancy = availableNights > 0 ? Math.round((bookedNights / availableNights) * 100) : null;

  const nextPayoutDate = pendingPayouts.find((p) => p.checkIn >= today)?.checkIn ?? pendingPayouts[0]?.checkIn ?? null;
  const nextPayoutCents = nextPayoutDate ? pendingPayouts.filter((p) => +p.checkIn === +nextPayoutDate).reduce((s, p) => s + p.payoutDueCents, 0) : 0;

  // Needs attention
  const attention: AttentionItem[] = [];
  const fmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  for (const b of upcoming.filter((b) => b.checkOut <= addDays(today, 14))) {
    attention.push({
      key: `clean-${b.id}`,
      text: `Turnover cleaning, ${fmt.format(b.checkOut)} · ${b.listing.title}`,
      action: "Book a cleaner",
      href: `/services?need=cleaning&listing=${b.listing.id}&date=${b.checkOut.toISOString().slice(0, 10)}`,
    });
  }
  const threads = await db.booking.findMany({
    where: { listing: { ownerId }, messages: { some: {} } },
    select: { id: true, ownerLastReadAt: true, guestId: true, messages: { orderBy: { createdAt: "desc" }, take: 1, select: { senderId: true, createdAt: true } } },
  });
  const unanswered = threads.filter((t) => t.messages[0] && t.messages[0].senderId === t.guestId && (!t.ownerLastReadAt || t.ownerLastReadAt < t.messages[0].createdAt)).length;
  if (unanswered) attention.push({ key: "messages", text: `${unanswered} unanswered message${unanswered === 1 ? "" : "s"}`, action: "Reply", href: "/owner/messages" });
  for (const l of listings.filter((l) => l.status === "DRAFT" && l.reviewNote)) {
    attention.push({ key: `fix-${l.id}`, text: `Changes requested on ${l.title}`, action: "Fix listing", href: `/owner/listings/${l.id}` });
  }
  for (const l of listings.filter((l) => l.status === "PUBLISHED" || l.status === "PAUSED")) {
    const required = requiredDocuments(l.hostingRole, l.permitRequired);
    if (!l.hostingRole) {
      attention.push({ key: `docs-${l.id}`, text: `Add proof of ownership for ${l.title}`, action: "Add", href: `/owner/listings/${l.id}#ownership-title` });
      continue;
    }
    for (const type of required) {
      const d = currentDoc(l.documents, type);
      const problem = !d ? "is missing" : d.status === "REJECTED" ? "needs a new upload" : isExpired(d, today) ? "has expired" : expiresSoon(d, today) ? "expires soon" : null;
      if (problem) attention.push({ key: `doc-${l.id}-${type}`, text: `${DOC_INFO[type].label} for ${l.title} ${problem}`, action: "Update", href: `/owner/listings/${l.id}#ownership-title` });
    }
  }
  if (!owner.payoutsEnabled && (pendingPayouts.length || upcoming.length)) {
    attention.push({ key: "payouts", text: "Set up payouts to get paid for your bookings", action: "Set up", href: "/owner/payouts" });
  }
  const failed = await db.booking.findMany({ where: { listing: { ownerId }, status: "CONFIRMED", balanceStatus: "FAILED" }, select: { id: true, checkIn: true } });
  for (const f of failed) attention.push({ key: `bal-${f.id}`, text: `A guest's balance payment failed (check-in ${fmt.format(f.checkIn)})`, action: "View", href: `/owner/bookings/${f.id}` });

  return {
    earningsCents: earnings,
    occupancy,
    upcomingCount: upcoming.filter((b) => b.checkIn >= today).length,
    nextPayout: nextPayoutDate ? { cents: nextPayoutCents, date: nextPayoutDate } : null,
    upcoming: upcoming.slice(0, 6),
    attention,
    hasListings: listings.length > 0,
  };
}
