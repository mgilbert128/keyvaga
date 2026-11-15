/** Cleaning checklist with photo proof against a real Postgres (TEST_DATABASE_URL). */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { createJob, markComplete, setChecklistItem } from "@/lib/jobs";
import { DEFAULT_CHECKLIST } from "@/lib/checklist";

const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

suite("cleaning checklist (database)", () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  let ownerId = "", cleanerUserId = "", listingId = "", providerId = "";

  beforeAll(async () => {
    await db.lockEvent.deleteMany(); await db.accessCode.deleteMany(); await db.lock.deleteMany(); await db.lockAccount.deleteMany();
    await db.jobPhoto.deleteMany(); await db.jobChecklistItem.deleteMany();
    await db.passwordResetToken.deleteMany(); await db.autoMessageLog.deleteMany(); await db.messageTemplate.deleteMany(); await db.message.deleteMany();
    await db.jobPayment.deleteMany(); await db.jobReview.deleteMany(); await db.jobMessage.deleteMany(); await db.job.updateMany({ data: { acceptedQuoteId: null } }); await db.quote.deleteMany(); await db.job.deleteMany(); await db.providerPhoto.deleteMany(); await db.providerProfile.deleteMany();
    await db.payment.deleteMany(); await db.booking.deleteMany(); await db.listingPhoto.deleteMany(); await db.listing.deleteMany(); await db.session.deleteMany(); await db.userRole.deleteMany(); await db.user.deleteMany();
    ownerId = (await db.user.create({ data: { email: "o-cl@test.example", name: "Jordan Owens", passwordHash: "x" } })).id;
    cleanerUserId = (await db.user.create({ data: { email: "c-cl@test.example", name: "Casey Clean", passwordHash: "x" } })).id;
    providerId = (await db.providerProfile.create({ data: { userId: cleanerUserId, businessName: "Sparkle", slug: "sparkle-cl", status: "APPROVED", categories: ["cleaning"] } })).id;
    listingId = (await db.listing.create({ data: { ownerId, slug: "cl", title: "Lakeside Cabin", summary: "s", propertyType: "CABIN", city: "Lake Geneva", region: "WI", postalCode: "53147", addressLine1: "1 Shore Rd", bedrooms: 3, bathrooms: "2", maxGuests: 6, nightlyRateCents: 1, status: "PUBLISHED", cleaningMinPhotos: 2 } })).id;
  });
  afterAll(() => db.$disconnect());

  async function hire(jobId: string) {
    const q = await db.quote.create({ data: { jobId, providerId, amountCents: 10000, status: "ACCEPTED" } });
    await db.job.update({ where: { id: jobId }, data: { status: "ASSIGNED", acceptedQuoteId: q.id } });
  }

  it("cleaning jobs carry the listing's checklist; other jobs don't", async () => {
    const job = await createJob(ownerId, { listingId, category: "cleaning", title: "Turnover", description: "Turnover clean after checkout", preferredDate: null, flexibleDate: true });
    const items = await db.jobChecklistItem.findMany({ where: { jobId: job.id }, orderBy: { position: "asc" } });
    expect(items.map((i) => i.label)).toEqual([...DEFAULT_CHECKLIST]);
    expect(job.minPhotos).toBe(2);
    const fix = await createJob(ownerId, { listingId, category: "handyman", title: "Fix tap", description: "Dripping tap in bath 2", preferredDate: null, flexibleDate: true });
    expect(await db.jobChecklistItem.count({ where: { jobId: fix.id } })).toBe(0);
  });

  it("can't be marked done until every item is ticked and the photos are in", async () => {
    await db.listing.update({ where: { id: listingId }, data: { cleaningChecklist: ["Make beds", "Clean bathrooms"] } });
    const job = await createJob(ownerId, { listingId, category: "cleaning", title: "Turnover 2", description: "Turnover clean after checkout", preferredDate: null, flexibleDate: true });
    await hire(job.id);
    const items = await db.jobChecklistItem.findMany({ where: { jobId: job.id }, orderBy: { position: "asc" } });
    expect(items.map((i) => i.label)).toEqual(["Make beds", "Clean bathrooms"]);

    await expect(markComplete(cleanerUserId, job.id, "")).rejects.toThrow("2 checklist items not ticked and 2 more photos needed");
    await expect(setChecklistItem(ownerId, job.id, items[0]!.id, true)).rejects.toThrow("Job not found");
    for (const i of items) await setChecklistItem(cleanerUserId, job.id, i.id, true);
    await db.jobPhoto.create({ data: { jobId: job.id, uploaderId: cleanerUserId, fileKey: "k1", contentType: "image/jpeg" } });
    await expect(markComplete(cleanerUserId, job.id, "")).rejects.toThrow("1 more photo needed");
    await db.jobPhoto.create({ data: { jobId: job.id, uploaderId: cleanerUserId, fileKey: "k2", contentType: "image/jpeg" } });
    await markComplete(cleanerUserId, job.id, "All done");
    expect((await db.job.findUniqueOrThrow({ where: { id: job.id } })).status).toBe("COMPLETED");
    // Ticks are locked once the job is done.
    await expect(setChecklistItem(cleanerUserId, job.id, items[0]!.id, false)).rejects.toThrow("isn't in progress");
  });
});
