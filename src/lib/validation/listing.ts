import { z } from "zod";
import { isAmenityKey } from "@/lib/amenities";
import { dollarsToCents } from "@/lib/pricing";

const PROPERTY_TYPES = ["HOUSE", "APARTMENT", "CABIN", "CONDO", "VILLA", "OTHER"] as const;
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 16:00.");
const text = (max: number) => z.string().trim().max(max, `Keep this under ${max} characters.`);
const int = (label: string, min: number, max: number) =>
  z.coerce
    .number({ message: `Enter a number for ${label}.` })
    .int(`${label} must be a whole number.`)
    .min(min, `${label} must be at least ${min}.`)
    .max(max, `${label} must be ${max} or less.`);
const money = (label: string, { required }: { required: boolean }) =>
  z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (v === "") {
        if (required) ctx.addIssue({ code: "custom", message: `Enter ${label}.` });
        return 0;
      }
      const cents = dollarsToCents(v);
      if (cents === null) {
        ctx.addIssue({ code: "custom", message: `Enter ${label} in dollars, like 185 or 185.50.` });
        return 0;
      }
      if (cents > 10_000_000) ctx.addIssue({ code: "custom", message: `${label} looks too high.` });
      return cents;
    });

/**
 * Listing details from the owner's form. Drafts may be incomplete;
 * missingForSubmit() decides whether a listing is ready for review.
 */
export const listingSchema = z.object({
  title: text(80).min(1, "Give your place a name."),
  summary: text(200),
  description: text(5000),
  propertyType: z.enum(PROPERTY_TYPES, { message: "Choose a property type." }),
  addressLine1: text(120),
  addressLine2: text(120),
  city: text(80),
  region: text(80),
  postalCode: text(12),
  bedrooms: int("Bedrooms", 0, 50),
  bathrooms: z.coerce
    .number({ message: "Enter a number for bathrooms." })
    .min(0, "Bathrooms can't be negative.")
    .max(50, "Bathrooms must be 50 or less.")
    .refine((n) => Number.isInteger(n * 2), "Use whole or half numbers, like 2 or 2.5."),
  maxGuests: int("Guests", 1, 50),
  nightlyRate: money("a nightly rate", { required: false }),
  cleaningFee: money("a cleaning fee", { required: false }),
  minNights: int("Minimum stay", 1, 365),
  checkInTime: time,
  checkOutTime: time,
  houseRules: text(3000),
  amenities: z.array(z.string()).transform((keys) => [...new Set(keys.filter(isAmenityKey))]),
});

export type ListingInput = z.infer<typeof listingSchema>;

export function listingFormToObject(fd: FormData) {
  const get = (k: string) => (fd.get(k) ?? "").toString();
  return {
    title: get("title"),
    summary: get("summary"),
    description: get("description"),
    propertyType: get("propertyType"),
    addressLine1: get("addressLine1"),
    addressLine2: get("addressLine2"),
    city: get("city"),
    region: get("region"),
    postalCode: get("postalCode"),
    bedrooms: get("bedrooms") || "0",
    bathrooms: get("bathrooms") || "1",
    maxGuests: get("maxGuests") || "1",
    nightlyRate: get("nightlyRate"),
    cleaningFee: get("cleaningFee"),
    minNights: get("minNights") || "1",
    checkInTime: get("checkInTime") || "16:00",
    checkOutTime: get("checkOutTime") || "10:00",
    houseRules: get("houseRules"),
    amenities: fd.getAll("amenities").map(String),
  };
}

export type ListingFormState =
  | { ok?: boolean; message?: string; errors?: Partial<Record<keyof ListingInput | "form", string[]>> }
  | undefined;
