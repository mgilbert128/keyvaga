/**
 * Automated guest messages: when each template is due, and how placeholders are filled in.
 * Pure functions (no database) so they're easy to test.
 */
import { addDays, nightsBetween } from "./dates";

export type Trigger = "BOOKING_CONFIRMED" | "BEFORE_CHECKIN" | "CHECKIN_DAY" | "BEFORE_CHECKOUT" | "AFTER_CHECKOUT";

export const TRIGGERS: { value: Trigger; label: string; usesDays: boolean; daysLabel?: string }[] = [
  { value: "BOOKING_CONFIRMED", label: "When a booking is confirmed", usesDays: false },
  { value: "BEFORE_CHECKIN", label: "Before check-in", usesDays: true, daysLabel: "days before check-in" },
  { value: "CHECKIN_DAY", label: "On check-in day", usesDays: false },
  { value: "BEFORE_CHECKOUT", label: "Before checkout", usesDays: true, daysLabel: "days before checkout" },
  { value: "AFTER_CHECKOUT", label: "After checkout", usesDays: true, daysLabel: "days after checkout" },
];

export function triggerSummary(trigger: Trigger, offsetDays: number): string {
  switch (trigger) {
    case "BOOKING_CONFIRMED": return "Sent right after a booking is confirmed";
    case "BEFORE_CHECKIN": return offsetDays === 0 ? "Sent on check-in day" : `Sent ${offsetDays} day${offsetDays === 1 ? "" : "s"} before check-in`;
    case "CHECKIN_DAY": return "Sent on check-in day";
    case "BEFORE_CHECKOUT": return offsetDays === 0 ? "Sent on checkout day" : `Sent ${offsetDays} day${offsetDays === 1 ? "" : "s"} before checkout`;
    case "AFTER_CHECKOUT": return `Sent ${offsetDays} day${offsetDays === 1 ? "" : "s"} after checkout`;
  }
}

export type BookingTimes = { status: string; checkIn: Date; checkOut: Date; confirmedAt: Date | null };

/** The calendar day a template should go out for a booking. */
export function sendDate(trigger: Trigger, offsetDays: number, b: BookingTimes): Date | null {
  switch (trigger) {
    case "BOOKING_CONFIRMED": return b.confirmedAt ? new Date(Date.UTC(b.confirmedAt.getUTCFullYear(), b.confirmedAt.getUTCMonth(), b.confirmedAt.getUTCDate())) : null;
    case "BEFORE_CHECKIN": return addDays(b.checkIn, -offsetDays);
    case "CHECKIN_DAY": return b.checkIn;
    case "BEFORE_CHECKOUT": return addDays(b.checkOut, -offsetDays);
    case "AFTER_CHECKOUT": return addDays(b.checkOut, offsetDays);
  }
}

/**
 * Is it time to send? Only for confirmed bookings, on or after the send day, and while the message
 * still makes sense: pre-arrival and stay messages until checkout (so late bookings catch up instead
 * of missing them); after-checkout messages within a week of their day.
 */
export function isDue(trigger: Trigger, offsetDays: number, b: BookingTimes, today: Date): boolean {
  if (b.status !== "CONFIRMED") return false;
  const day = sendDate(trigger, offsetDays, b);
  if (!day || today < day) return false;
  if (trigger === "AFTER_CHECKOUT") return nightsBetween(day, today) <= 7;
  return today < b.checkOut || (trigger === "BEFORE_CHECKOUT" && +today === +b.checkOut);
}

export const PLACEHOLDERS = [
  { key: "guest_first_name", help: "Guest's first name" },
  { key: "listing_title", help: "Your listing's name" },
  { key: "check_in_date", help: "e.g. Friday, July 3" },
  { key: "check_in_time", help: "e.g. 4:00 PM" },
  { key: "check_out_date", help: "e.g. Sunday, July 5" },
  { key: "check_out_time", help: "e.g. 10:00 AM" },
  { key: "nights", help: "Number of nights" },
  { key: "guests", help: "Number of guests" },
  { key: "address", help: "Full address (only booked guests receive messages)" },
  { key: "checkin_instructions", help: "From your listing's check-in instructions" },
  { key: "host_first_name", help: "Your first name" },
  { key: "trip_link", help: "Link to the guest's trip page" },
] as const;

export type PlaceholderKey = (typeof PLACEHOLDERS)[number]["key"];

/** Replaces {placeholders}. Unknown ones are left as typed so the owner notices in the preview. */
export function renderMessage(body: string, vars: Record<PlaceholderKey, string>): string {
  return body.replace(/\{([a-z_]+)\}/g, (m, k: string) => (k in vars ? vars[k as PlaceholderKey] : m));
}

export function unknownPlaceholders(body: string): string[] {
  const known = new Set<string>(PLACEHOLDERS.map((p) => p.key));
  return [...new Set([...body.matchAll(/\{([a-z_]+)\}/g)].map((m) => m[1]!).filter((k) => !known.has(k)))];
}

export const SUGGESTED_TEMPLATES: { name: string; trigger: Trigger; offsetDays: number; body: string }[] = [
  {
    name: "Thanks for booking",
    trigger: "BOOKING_CONFIRMED",
    offsetDays: 0,
    body: "Hi {guest_first_name}! Thank you for booking {listing_title} for {check_in_date} to {check_out_date}. We're excited to host you. I'll send check-in details closer to your arrival. Any questions, just reply here.\n\n{host_first_name}",
  },
  {
    name: "Check-in details",
    trigger: "BEFORE_CHECKIN",
    offsetDays: 7,
    body: "Hi {guest_first_name}, your stay at {listing_title} is coming up!\n\nCheck-in: {check_in_date} from {check_in_time}\nCheckout: {check_out_date} by {check_out_time}\nAddress: {address}\n\n{checkin_instructions}\n\nYour trip page has everything in one place: {trip_link}",
  },
  {
    name: "Welcome",
    trigger: "CHECKIN_DAY",
    offsetDays: 0,
    body: "Welcome, {guest_first_name}! We hope you settle in easily at {listing_title}. If anything isn't right, message me here and I'll sort it out. Enjoy your stay!",
  },
  {
    name: "Checkout reminder",
    trigger: "BEFORE_CHECKOUT",
    offsetDays: 1,
    body: "Hi {guest_first_name}, just a reminder that checkout is tomorrow ({check_out_date}) by {check_out_time}. Please start the dishwasher, take out the trash and leave the keys as you found them. Safe travels!",
  },
  {
    name: "Thanks for staying",
    trigger: "AFTER_CHECKOUT",
    offsetDays: 1,
    body: "Thanks for staying at {listing_title}, {guest_first_name}! We'd love to hear how it went. A quick review really helps: {trip_link}\n\nHope to host you again!",
  },
];
