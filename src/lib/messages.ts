import "server-only";
import { db } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth/dal";

export type Side = "guest" | "owner";

/** Loads a booking's conversation if the user is its guest (side "guest") or the listing's owner (side "owner"). */
export async function getThread(user: CurrentUser, bookingId: string, side: Side) {
  const b = await db.booking.findUnique({
    where: { id: bookingId },
    include: {
      listing: { select: { title: true, ownerId: true, owner: { select: { name: true } } } },
      guest: { select: { name: true } },
      messages: { orderBy: { createdAt: "asc" }, include: { sender: { select: { id: true, name: true } } } },
    },
  });
  if (!b || b.status === "PENDING_PAYMENT") return null;
  if (side === "guest" && b.guestId !== user.id) return null;
  if (side === "owner" && b.listing.ownerId !== user.id) return null;
  return b;
}

export async function markRead(bookingId: string, side: Side) {
  await db.booking.update({ where: { id: bookingId }, data: side === "guest" ? { guestLastReadAt: new Date() } : { ownerLastReadAt: new Date() } });
}

/** Conversations for an inbox, newest activity first, with an unread flag. */
export async function listThreads(userId: string, side: Side) {
  const bookings = await db.booking.findMany({
    where: side === "guest" ? { guestId: userId, status: { in: ["CONFIRMED", "CANCELLED"] } } : { listing: { ownerId: userId }, status: { in: ["CONFIRMED", "CANCELLED"] } },
    include: {
      listing: { select: { title: true, owner: { select: { name: true } } } },
      guest: { select: { name: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  return bookings
    .filter((b) => b.messages.length || (b.status === "CONFIRMED" && b.checkOut > new Date()))
    .map((b) => {
      const last = b.messages[0] ?? null;
      const readAt = side === "guest" ? b.guestLastReadAt : b.ownerLastReadAt;
      const unread = Boolean(last && last.senderId !== userId && (!readAt || readAt < last.createdAt));
      return { booking: b, last, unread, other: side === "guest" ? b.listing.owner.name : b.guest.name };
    })
    .sort((a, b) => +(b.last?.createdAt ?? b.booking.createdAt) - +(a.last?.createdAt ?? a.booking.createdAt));
}

export async function unreadCount(userId: string, side: Side) {
  return (await listThreads(userId, side)).filter((t) => t.unread).length;
}
