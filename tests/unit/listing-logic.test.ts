import { describe, expect, it } from "vitest";
import { centsToDollarsInput, dollarsToCents, quoteStay } from "@/lib/pricing";
import { addDays, monthGrid, nightsBetween, parseISODate, rangeHasConflict, todayIn, unavailableNights } from "@/lib/dates";
import { canEditListing, canReviewListings, missingForSubmit, nextStatus } from "@/lib/listing-policy";
import { isConfiguredAdmin } from "@/lib/auth/admin";
import { sniffImageType } from "@/lib/images";
import { listingFormToObject, listingSchema } from "@/lib/validation/listing";
import { parseSearchParams } from "@/lib/search-params";
import { slugify } from "@/lib/slug";

const d = (s: string) => parseISODate(s)!;

describe("dollarsToCents", () => {
  it.each([
    ["185", 18500], ["185.5", 18550], ["185.50", 18550], ["$1,234.56", 123456], [" 0 ", 0], ["0.01", 1],
  ])("%s -> %i", (input, cents) => expect(dollarsToCents(input)).toBe(cents));
  it.each(["", "abc", "-5", "1.234", "1e3", "12.3.4"])("rejects %j", (input) => expect(dollarsToCents(input)).toBeNull());
  it("round-trips to the form value", () => {
    expect(centsToDollarsInput(18500)).toBe("185");
    expect(centsToDollarsInput(18550)).toBe("185.50");
  });
});

describe("quoteStay", () => {
  const listing = { nightlyRateCents: 18500, cleaningFeeCents: 9500, minNights: 2 };
  it("prices nights plus cleaning", () => {
    expect(quoteStay(listing, d("2026-11-14"), d("2026-11-18"))).toMatchObject({
      ok: true, nights: 4, nightlyRateCents: 18500, nightsCents: 74000, discountCents: 0, cleaningCents: 9500, totalCents: 83500,
    });
  });
  it("enforces the minimum stay", () => {
    expect(quoteStay(listing, d("2026-11-14"), d("2026-11-15"))).toMatchObject({ ok: false, reason: "below_min_nights", minNights: 2 });
  });
  it("rejects zero or negative nights", () => {
    expect(quoteStay(listing, d("2026-11-14"), d("2026-11-14"))).toMatchObject({ ok: false, reason: "invalid_dates" });
    expect(quoteStay(listing, d("2026-11-18"), d("2026-11-14"))).toMatchObject({ ok: false, reason: "invalid_dates" });
  });
  it("counts nights correctly across the daylight-saving change", () => {
    expect(nightsBetween(d("2026-11-01"), d("2026-11-03"))).toBe(2);
    expect(nightsBetween(d("2026-03-07"), d("2026-03-09"))).toBe(2);
  });
});

describe("dates", () => {
  it("rejects impossible dates", () => {
    expect(parseISODate("2026-02-30")).toBeNull();
    expect(parseISODate("2026-13-01")).toBeNull();
    expect(parseISODate("nope")).toBeNull();
  });
  it("marks booked nights but leaves checkout day free", () => {
    const nights = unavailableNights([{ start: d("2026-11-14"), end: d("2026-11-17") }]);
    expect([...nights]).toEqual(["2026-11-14", "2026-11-15", "2026-11-16"]);
    expect(rangeHasConflict(d("2026-11-17"), d("2026-11-20"), nights)).toBe(false);
    expect(rangeHasConflict(d("2026-11-10"), d("2026-11-14"), nights)).toBe(false);
    expect(rangeHasConflict(d("2026-11-16"), d("2026-11-18"), nights)).toBe(true);
  });
  it("builds month grids starting on Sunday", () => {
    const nov = monthGrid(2026, 10); // November 2026 starts on a Sunday
    expect(nov[0]![0]!.getUTCDate()).toBe(1);
    expect(nov.flat().filter(Boolean)).toHaveLength(30);
    const feb = monthGrid(2027, 1); // Feb 2027 starts on a Monday
    expect(feb[0]![0]).toBeNull();
    expect(feb.every((w) => w.length === 7)).toBe(true);
  });
  it("finds today in the given time zone", () => {
    // 03:00 UTC on Nov 12 is still Nov 11 in Chicago
    expect(todayIn("America/Chicago", new Date("2026-11-12T03:00:00Z")).toISOString().slice(0, 10)).toBe("2026-11-11");
    expect(addDays(d("2026-12-31"), 1).toISOString().slice(0, 10)).toBe("2027-01-01");
  });
});

describe("listing permissions", () => {
  const owner = { id: "u1", roles: ["GUEST", "OWNER"] };
  it("lets only the owning owner edit", () => {
    expect(canEditListing(owner, { ownerId: "u1" })).toBe(true);
    expect(canEditListing(owner, { ownerId: "u2" })).toBe(false);
    expect(canEditListing({ id: "u1", roles: ["GUEST"] }, { ownerId: "u1" })).toBe(false);
    expect(canEditListing({ id: "a", roles: ["ADMIN"] }, { ownerId: "u1" })).toBe(false);
  });
  it("lets only admins review", () => {
    expect(canReviewListings({ id: "a", roles: ["ADMIN"] })).toBe(true);
    expect(canReviewListings(owner)).toBe(false);
  });
  it("follows the status lifecycle", () => {
    expect(nextStatus("submit", "DRAFT")).toBe("PENDING_REVIEW");
    expect(nextStatus("submit", "PUBLISHED")).toBeNull();
    expect(nextStatus("approve", "PENDING_REVIEW")).toBe("PUBLISHED");
    expect(nextStatus("approve", "DRAFT")).toBeNull();
    expect(nextStatus("reject", "PENDING_REVIEW")).toBe("DRAFT");
    expect(nextStatus("pause", "PUBLISHED")).toBe("PAUSED");
    expect(nextStatus("unpause", "PAUSED")).toBe("PUBLISHED");
    expect(nextStatus("unpause", "DRAFT")).toBeNull();
    expect(nextStatus("withdraw", "PENDING_REVIEW")).toBe("DRAFT");
  });
  it("lists what is missing before submit", () => {
    expect(missingForSubmit({ title: "A", summary: "", city: "", region: "", addressLine1: "", nightlyRateCents: 0, photoCount: 0 })).toEqual([
      "a short summary", "the address", "a nightly rate", "at least one photo",
    ]);
    expect(missingForSubmit({ title: "A", summary: "S", city: "C", region: "R", addressLine1: "1 St", nightlyRateCents: 100, photoCount: 1 })).toEqual([]);
  });
});

describe("admin emails", () => {
  it("matches case-insensitively from a comma list", () => {
    expect(isConfiguredAdmin("Founder@Example.com", "a@b.co, founder@example.com")).toBe(true);
    expect(isConfiguredAdmin("other@example.com", "founder@example.com")).toBe(false);
    expect(isConfiguredAdmin("", "")).toBe(false);
    expect(isConfiguredAdmin("x@y.z", "")).toBe(false);
  });
});

describe("image sniffing", () => {
  it("recognizes real image headers and rejects others", () => {
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(sniffImageType(new TextEncoder().encode("RIFF1234WEBPVP8 "))).toBe("image/webp");
    expect(sniffImageType(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
    expect(sniffImageType(new TextEncoder().encode("GIF89a"))).toBeNull();
  });
});

describe("listing form validation", () => {
  const fd = (o: Record<string, string | string[]>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(o)) for (const x of [v].flat()) f.append(k, x);
    return f;
  };
  it("parses a complete form, converting dollars to cents and filtering unknown amenities", () => {
    const r = listingSchema.parse(
      listingFormToObject(fd({ title: "Cabin", propertyType: "CABIN", bedrooms: "3", bathrooms: "2.5", maxGuests: "6", nightlyRate: "185.50", cleaningFee: "$95", minNights: "2", amenities: ["wifi", "hacker", "wifi", "pool"] })),
    );
    expect(r).toMatchObject({ nightlyRate: 18550, cleaningFee: 9500, bathrooms: 2.5, amenities: ["wifi", "pool"] });
  });
  it("reports friendly errors", () => {
    const r = listingSchema.safeParse(listingFormToObject(fd({ title: "", propertyType: "CASTLE", nightlyRate: "abc", bathrooms: "2.3", maxGuests: "0" })));
    expect(r.success).toBe(false);
    const errs = r.error!.flatten().fieldErrors;
    expect(Object.keys(errs).sort()).toEqual(["bathrooms", "maxGuests", "nightlyRate", "propertyType", "title"]);
  });
});

describe("search params", () => {
  it("parses valid filters and drops junk", () => {
    const f = parseSearchParams({
      where: "lake", checkIn: "2026-11-14", checkOut: "2026-02-30", guests: "4", minPrice: "100", maxPrice: "abc",
      bedrooms: "99", type: ["CABIN", "CASTLE"], amenity: "wifi,pool,lasers", sort: "evil",
    });
    expect(f.where).toBe("lake");
    expect(f.checkIn?.toISOString().slice(0, 10)).toBe("2026-11-14");
    expect(f.checkOut).toBeUndefined();
    expect(f.guests).toBe(4);
    expect(f.minPriceCents).toBe(10000);
    expect(f.maxPriceCents).toBeUndefined();
    expect(f.bedrooms).toBeUndefined();
    expect(f.types).toEqual(["CABIN"]);
    expect(f.amenities).toEqual(["wifi", "pool"]);
    expect(f.sort).toBeUndefined();
  });
});

describe("slugify", () => {
  it("makes URL-safe slugs", () => {
    expect(slugify("Café Lakeside — Cabin #2!")).toBe("cafe-lakeside-cabin-2");
    expect(slugify("!!!")).toBe("stay");
  });
});
