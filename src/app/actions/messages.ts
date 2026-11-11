"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/dal";

export type SendResult = { ok?: boolean; message?: string } | undefined;

/** Sends a message in a booking's conversation. Only that booking's guest and the listing owner can post. */
export async function sendMessage(bookingId: string, _prev: SendResult, fd: FormData): Promise<SendResult> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const body = String(fd.get("body") ?? "").trim();
  if (!body) return { message: "Write a message first." };
  if (body.length > 4000) return { message: "Keep messages under 4,000 characters." };

  const b = await db.booking.findUnique({ where: { id: bookingId }, select: { guestId: true, status: true, listing: { select: { ownerId: true } } } });
  if (!b || b.status === "PENDING_PAYMENT") return { message: "Conversation not found." };
  const side = b.guestId === user.id ? "guest" : b.listing.ownerId === user.id ? "owner" : null;
  if (!side) return { message: "Conversation not found." };

  const now = new Date();
  await db.$transaction([
    db.message.create({ data: { bookingId, senderId: user.id, body } }),
    db.booking.update({ where: { id: bookingId }, data: side === "guest" ? { guestLastReadAt: now } : { ownerLastReadAt: now } }),
  ]);
  revalidatePath(side === "guest" ? `/messages/${bookingId}` : `/owner/messages/${bookingId}`);
  revalidatePath(side === "guest" ? `/owner/messages/${bookingId}` : `/messages/${bookingId}`);
  return { ok: true };
}
