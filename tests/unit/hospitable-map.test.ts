import { describe, expect, it } from "vitest";
import { calendarToKeyvaga, listingFromProperty, mapPropertyType, medianRate, stayNights } from "@/lib/hospitable-map";

describe("listingFromProperty", () => {
  it("maps a Hospitable property to listing fields", () => {
    const l = listingFromProperty({
      id: "p1", name: "CS 505", public_name: "Crystal Shores 505, Private Balcony", property_type: "condominium",
      description: "Gulf views.\nSleeps 6.",
      address: { number: "24132", street: "Perdido Beach Blvd", city: "gulf shores", state: "Alabama", postcode: "36542", coordinates: { latitude: 30.2, longitude: -87.6 } },
      capacity: { max: 6, bedrooms: 2, bathrooms: 2 }, amenities: ["wifi", "pool", "free_parking", "air_conditioning", "beach_essentials"],
      check_in: "16:00:00", check_out: "10:00", timezone: "America/Chicago", house_rules: { pets_allowed: false },
    });
    expect(l).toMatchObject({ title: "Crystal Shores 505, Private Balcony", city: "Gulf Shores", region: "AL", propertyType: "CONDO", addressLine1: "24132 Perdido Beach Blvd", summary: "Gulf views.", bathrooms: "2", maxGuests: 6, checkInTime: "16:00" });
    expect([...l.amenities].sort()).toEqual(["air_conditioning", "beach_access", "free_parking", "pool", "wifi"]);
  });
  it("falls back safely", () => {
    expect(mapPropertyType(undefined)).toBe("OTHER");
    expect(listingFromProperty({ id: "x" })).toMatchObject({ title: "Hospitable property", maxGuests: 2, checkInTime: "16:00", region: "" });
  });
});

describe("calendarToKeyvaga", () => {
  it("collects prices and merges unavailable days into ranges", () => {
    const c = calendarToKeyvaga([
      { date: "2026-12-03", status: { available: false }, price: { amount: 14000 } },
      { date: "2026-12-01", status: { available: true }, price: { amount: 14000 } },
      { date: "2026-12-02", status: { available: false }, price: { amount: 15000 } },
      { date: "2026-12-05", status: { available: false }, price: { amount: 0 } },
    ]);
    expect(c.rates).toHaveLength(3);
    expect(c.blocked.map((b) => [b.start.toISOString().slice(0, 10), b.end.toISOString().slice(0, 10)])).toEqual([["2026-12-02", "2026-12-04"], ["2026-12-05", "2026-12-06"]]);
    expect(medianRate(c.rates)).toBe(14000);
  });
  it("lists the nights of a stay", () => {
    expect(stayNights(new Date("2026-12-01T00:00:00Z"), new Date("2026-12-04T00:00:00Z"))).toEqual(["2026-12-01", "2026-12-02", "2026-12-03"]);
  });
});
