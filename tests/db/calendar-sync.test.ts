/** Calendar sync against a real Postgres (TEST_DATABASE_URL), with a fake HTTP fetch. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { parseISODate, addDays, todayIn } from "@/lib/dates";
import { ensureIcalToken, exportFeed, syncFeed } from "@/lib/calendar-sync";
import { parseIcs } from "@/lib/ical";

const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;
const d = (s: string) => parseISODate(s)!;
const ymd = (x: Date) => x.toISOString().slice(0, 10).replace(/-/g, "");

suite("calendar sync (database)", () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  let ownerId = "", guestId = "", listingId = "";
  let body = "";
  let status = 200;
  const fakeFetch = (async () => new Response(body, { status, headers: { "content-type": "text/calendar" } })) as unknown as typeof fetch;

  beforeAll(async () => {
    await db.calendarFeed.deleteMany(); await db.calendarBlock.deleteMany();
    await db.lockEvent.deleteMany(); await db.accessCode.deleteMany(); await db.lock.deleteMany(); await db.lockAccount.deleteMany();
    await db.jobPhoto.deleteMany(); await db.jobChecklistItem.deleteMany();
    await db.passwordResetToken.deleteMany(); await db.autoMessageLog.deleteMany(); await db.messageTemplate.deleteMany(); await db.message.deleteMany();
    await db.jobPayment.deleteMany(); await db.jobReview.deleteMany(); await db.jobMessage.deleteMany(); await db.job.updateMany({ data: { acceptedQuoteId: null } }); await db.quote.deleteMany(); await db.job.deleteMany(); await db.providerPhoto.deleteMany(); await db.providerProfile.deleteMany();
    await db.payment.deleteMany(); await db.booking.deleteMany(); await db.listingPhoto.deleteMany(); await db.listing.deleteMany(); await db.session.deleteMany(); await db.userRole.deleteMany(); await db.user.deleteMany();
    ownerId = (await db.user.create({ data: { email: "o-cs@test.example", name: "Jordan Owens", passwordHash: "x" } })).id;
    guestId = (await db.user.create({ data: { email: "g-cs@test.example", name: "Alex Garcia", passwordHash: "x" } })).id;
    listingId = (await db.listing.create({ data: { ownerId, slug: "cs", title: "Lakeside Cabin", summary: "s", propertyType: "CABIN", city: "Lake Geneva", region: "WI", postalCode: "53147", addressLine1: "1 Shore Rd", bedrooms: 3, bathrooms: "2", maxGuests: 6, nightlyRateCents: 1, status: "PUBLISHED" } })).id;
  });
  afterAll(() => db.$disconnect());

  it("imports future busy dates as blocks, replaces them on the next sync, and keeps them if the site is down", async () => {
    const t = todayIn();
    body = ["BEGIN:VCALENDAR",
      "BEGIN:VEVENT", "UID:past", `DTSTART;VALUE=DATE:${ymd(addDays(t, -10))}`, `DTEND;VALUE=DATE:${ymd(addDays(t, -7))}`, "END:VEVENT",
      "BEGIN:VEVENT", "UID:a", `DTSTART;VALUE=DATE:${ymd(addDays(t, 10))}`, `DTEND;VALUE=DATE:${ymd(addDays(t, 13))}`, "SUMMARY:Reserved", "END:VEVENT",
      "BEGIN:VEVENT", "UID:b", `DTSTART;VALUE=DATE:${ymd(addDays(t, 20))}`, `DTEND;VALUE=DATE:${ymd(addDays(t, 22))}`, "END:VEVENT",
      "END:VCALENDAR"].join("\r\n");
    const feed = await db.calendarFeed.create({ data: { listingId, name: "Airbnb", provider: "airbnb", url: "https://www.airbnb.com/calendar/ical/1.ics" } });
    expect(await syncFeed(feed.id, fakeFetch)).toEqual({ ok: true, count: 2 });
    let blocks = await db.calendarBlock.findMany({ where: { listingId }, orderBy: { startDate: "asc" } });
    expect(blocks.map((b) => [b.source, b.note, +b.startDate === +addDays(t, 10)])).toEqual([["ICAL", "Airbnb", true], ["ICAL", "Airbnb", false]]);

    // Guest on Airbnb cancelled one stay.
    body = body.replace(/BEGIN:VEVENT\r\nUID:b[\s\S]*?END:VEVENT\r\n/, "");
    expect(await syncFeed(feed.id, fakeFetch)).toEqual({ ok: true, count: 1 });

    // Airbnb down: previous blocks stay, error is shown.
    status = 503;
    const r = await syncFeed(feed.id, fakeFetch);
    expect(r.ok).toBe(false);
    blocks = await db.calendarBlock.findMany({ where: { listingId } });
    expect(blocks).toHaveLength(1);
    expect((await db.calendarFeed.findUniqueOrThrow({ where: { id: feed.id } })).lastStatus).toBe("error");
    status = 200;

    // Not a calendar.
    body = "<html>Log in</html>";
    expect(await syncFeed(feed.id, fakeFetch)).toMatchObject({ ok: false, error: expect.stringContaining("isn't a calendar") });
  });

  it("exports confirmed bookings and owner blocks only (no imported dates, no guest names)", async () => {
    await db.booking.create({ data: { id: "bk_cs1", listingId, guestId, checkIn: d("2099-07-03"), checkOut: d("2099-07-06"), guests: 2, status: "CONFIRMED", confirmedAt: new Date(), nightlyCents: 1, cleaningCents: 0, serviceCents: 0, totalCents: 1, dueNowCents: 1 } });
    await db.booking.create({ data: { id: "bk_cs2", listingId, guestId, checkIn: d("2099-08-03"), checkOut: d("2099-08-06"), guests: 2, status: "CANCELLED", nightlyCents: 1, cleaningCents: 0, serviceCents: 0, totalCents: 1, dueNowCents: 1 } });
    await db.calendarBlock.create({ data: { listingId, startDate: d("2099-09-01"), endDate: d("2099-09-03"), source: "OWNER", note: "Family visit" } });
    const token = await ensureIcalToken(listingId);
    expect(await ensureIcalToken(listingId)).toBe(token);
    const ics = (await exportFeed(token))!;
    const events = parseIcs(ics);
    expect(events.map((e) => [e.start.toISOString().slice(0, 10), e.summary])).toEqual([["2099-07-03", "Keyvaga booking"], ["2099-09-01", "Blocked on Keyvaga"]]);
    expect(ics).not.toContain("Alex");
    expect(ics).not.toContain("Family visit");
    expect(await exportFeed("nope")).toBeNull();
  });
});
