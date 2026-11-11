import type { PropertyType } from "@/generated/prisma/enums";

export const PROPERTY_TYPES: { value: PropertyType; label: string }[] = [
  { value: "HOUSE", label: "House" },
  { value: "CABIN", label: "Cabin" },
  { value: "APARTMENT", label: "Apartment" },
  { value: "CONDO", label: "Condo" },
  { value: "VILLA", label: "Villa" },
  { value: "OTHER", label: "Other" },
];

export function propertyTypeLabel(t: PropertyType): string {
  return PROPERTY_TYPES.find((p) => p.value === t)?.label ?? t;
}
