import type { PropertyType } from "@/generated/prisma/enums";

export const SORTS = {
  recommended: "Recommended",
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
  newest: "Newest",
} as const;
export type SortKey = keyof typeof SORTS;

export type SearchFilters = {
  where?: string;
  checkIn?: Date;
  checkOut?: Date;
  guests?: number;
  minPriceCents?: number;
  maxPriceCents?: number;
  bedrooms?: number;
  types?: PropertyType[];
  amenities?: string[];
  /** Complex slug (from a complex page's "search these dates" link). */
  complex?: string;
  /** Exact town + state (destination pages). */
  city?: string;
  region?: string;
  sort?: SortKey;
  /** For tests: the moment used to decide whether checkout holds have expired. */
  now?: Date;
};
