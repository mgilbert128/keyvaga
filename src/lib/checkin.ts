import { addDays } from "./dates";

/** When a booked guest gets the exact address and check-in instructions. */
export function accessReleaseDate(checkIn: Date, releaseDays: number): Date {
  return addDays(checkIn, -Math.max(0, releaseDays));
}

export function isAccessReleased(args: { status: string; checkIn: Date; checkOut: Date; releaseDays: number; today: Date }): boolean {
  if (args.status !== "CONFIRMED") return false;
  if (args.today >= args.checkOut) return false; // stay is over
  return args.today >= accessReleaseDate(args.checkIn, args.releaseDays);
}

/** Guests can review a stay once it has ended, within 60 days, if it wasn't cancelled. */
export function canReview(args: { status: string; checkOut: Date; today: Date; hasReview: boolean }): boolean {
  return args.status === "CONFIRMED" && !args.hasReview && args.today >= args.checkOut && args.today <= addDays(args.checkOut, 60);
}
