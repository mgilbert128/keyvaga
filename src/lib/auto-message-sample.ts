import "server-only";
import { db } from "@/lib/db";
import { placeholderValues } from "@/lib/auto-messages-server";
import { addDays, todayIn } from "@/lib/dates";
import type { PlaceholderKey } from "@/lib/auto-messages";

/** Preview data: the owner's next real booking if there is one, otherwise a made-up guest at their first listing. */
export async function previewSample(ownerId: string): Promise<{ vars: Record<PlaceholderKey, string>; label: string }> {
  const booking = await db.booking.findFirst({
    where: { listing: { ownerId }, status: "CONFIRMED", checkOut: { gte: todayIn() } },
    orderBy: { checkIn: "asc" },
    include: { guest: { select: { name: true } }, listing: { include: { owner: { select: { name: true } } } } },
  });
  if (booking) return { vars: placeholderValues(booking), label: `using your next booking, ${booking.guest.name.split(" ")[0]}` };
  const listing = await db.listing.findFirst({ where: { ownerId }, orderBy: { createdAt: "asc" }, include: { owner: { select: { name: true } } } });
  const checkIn = addDays(todayIn(), 14);
  return {
    vars: placeholderValues({
      id: "example",
      checkIn,
      checkOut: addDays(checkIn, 3),
      guests: 4,
      guest: { name: "Alex Guest" },
      listing: listing ?? { title: "Your listing", checkInTime: "16:00", checkOutTime: "10:00", addressLine1: "123 Main St", addressLine2: "", city: "Your town", region: "ST", postalCode: "00000", checkInInstructions: "Lockbox code is sent before arrival.", owner: { name: "You" } },
    }),
    label: "with an example guest",
  };
}
