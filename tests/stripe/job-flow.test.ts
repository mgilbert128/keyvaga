/** Service job money flow against Stripe TEST mode and a real Postgres (STRIPE_INTEGRATION=1). */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import Stripe from "stripe";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { addDays, todayIn } from "@/lib/dates";
import { cancelJob, createJob, markComplete, providerInbox, releaseJob, reportProblem, resolveDispute, runDailyJobTasks, startAcceptQuote, submitQuote, syncJobPayment } from "@/lib/jobs";

const run = process.env.STRIPE_INTEGRATION === "1" && process.env.TEST_DATABASE_URL;
const suite = run ? describe : describe.skip;

suite("service job flow with Stripe test mode", () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.TEST_DATABASE_URL! }) });
  const s = new Stripe(process.env.STRIPE_SECRET_KEY ?? "proxy-injected", { httpClient: Stripe.createFetchHttpClient() });
  let ownerId = "", listingId = "", providerUserId = "";
  let profile: Awaited<ReturnType<typeof db.providerProfile.create>>;
  let farProfile: Awaited<ReturnType<typeof db.providerProfile.create>>;

  async function pay(jobId: string) {
    const p = await db.jobPayment.findFirstOrThrow({ where: { jobId, kind: "CHARGE", status: "PENDING" } });
    await s.paymentIntents.confirm(p.stripeId!, { payment_method: "pm_card_visa", return_url: "https://keyvaga.vercel.app" });
    return syncJobPayment(p.stripeId!);
  }
  async function quotedJob(title: string, amountCents = 20_000) {
    const job = await createJob(ownerId, { listingId, category: "cleaning", title, description: "Turnover clean after checkout", preferredDate: addDays(todayIn(), 5), flexibleDate: false });
    const q = await submitQuote({ ...profile, userId: providerUserId }, job.id, { amountCents, proposedDate: addDays(todayIn(), 5), message: "Happy to help" });
    return { job, q };
  }

  beforeAll(async () => {
    await db.autoMessageLog.deleteMany(); await db.messageTemplate.deleteMany(); await db.message.deleteMany(); await db.jobPayment.deleteMany(); await db.jobReview.deleteMany(); await db.jobMessage.deleteMany(); await db.quote.deleteMany(); await db.job.deleteMany();
    await db.providerPhoto.deleteMany(); await db.providerProfile.deleteMany();
    await db.payment.deleteMany(); await db.booking.deleteMany(); await db.listingPhoto.deleteMany(); await db.listing.deleteMany(); await db.session.deleteMany(); await db.userRole.deleteMany(); await db.user.deleteMany();
    ownerId = (await db.user.create({ data: { email: "o-job@test.example", name: "Owner Job", passwordHash: "x" } })).id;
    providerUserId = (await db.user.create({ data: { email: "p-job@test.example", name: "Pro Clean", passwordHash: "x" } })).id;
    const far = await db.user.create({ data: { email: "far@test.example", name: "Far Away", passwordHash: "x" } });
    listingId = (await db.listing.create({ data: { ownerId, slug: "job-l", title: "Lake House", summary: "s", propertyType: "HOUSE", city: "Lake Geneva", region: "WI", bedrooms: 2, bathrooms: "1", maxGuests: 4, nightlyRateCents: 10000, status: "PUBLISHED" } })).id;
    profile = await db.providerProfile.create({ data: { userId: providerUserId, slug: "pro", businessName: "Pro Clean", categories: ["cleaning"], serviceAreas: ["lake geneva"], region: "WI", status: "APPROVED", approvedAt: new Date() } });
    farProfile = await db.providerProfile.create({ data: { userId: far.id, slug: "far", businessName: "Far Away", categories: ["cleaning"], serviceAreas: ["madison"], region: "WI", status: "APPROVED" } });
  });
  afterAll(() => db.$disconnect());

  it("open jobs reach only providers who serve the area and category", async () => {
    const job = await createJob(ownerId, { listingId, category: "cleaning", title: "Clean", description: "Turnover clean after checkout", preferredDate: null, flexibleDate: true });
    expect((await providerInbox(profile)).map((j) => j.id)).toContain(job.id);
    expect((await providerInbox(farProfile)).map((j) => j.id)).not.toContain(job.id);
    await expect(submitQuote({ ...farProfile, userId: "x" }, job.id, { amountCents: 10_000, proposedDate: null, message: "" })).rejects.toThrow(/not found/);
  });

  it("accept → pay → scheduled → complete → owner releases (payout waits for provider payout setup)", async () => {
    const { job, q } = await quotedJob("Turnover clean");
    await startAcceptQuote(ownerId, job.id, q.id);
    let j = await db.job.findUniqueOrThrow({ where: { id: job.id } });
    expect(j).toMatchObject({ status: "OPEN", quoteCents: 20_000, ownerTotalCents: 21_000, providerPayoutCents: 19_000 });
    expect(await pay(job.id)).toBe("assigned");
    j = await db.job.findUniqueOrThrow({ where: { id: job.id } });
    expect(j.status).toBe("ASSIGNED");
    expect((await db.quote.findUniqueOrThrow({ where: { id: q.id } })).status).toBe("ACCEPTED");
    await expect(markComplete(ownerId, job.id, "")).rejects.toThrow(/not found/); // only the provider
    await markComplete(providerUserId, job.id, "All done, linens restocked");
    j = await db.job.findUniqueOrThrow({ where: { id: job.id } });
    expect(j.status).toBe("COMPLETED");
    expect(j.releaseAfter!.getTime()).toBeGreaterThan(Date.now() + 2 * 86_400_000);
    expect(await releaseJob(ownerId, job.id)).toBe("provider_not_connected");
    expect((await db.job.findUniqueOrThrow({ where: { id: job.id } })).status).toBe("PAID");
    await expect(releaseJob(ownerId, job.id)).rejects.toThrow(); // can't release twice
  }, 60_000);

  it("auto-releases after the waiting period", async () => {
    const { job, q } = await quotedJob("Auto release clean");
    await startAcceptQuote(ownerId, job.id, q.id); await pay(job.id);
    await markComplete(providerUserId, job.id, "");
    await db.job.update({ where: { id: job.id }, data: { releaseAfter: new Date(Date.now() - 1000) } });
    const r = await runDailyJobTasks();
    expect(Object.keys(r.released)).toContain(job.id);
    expect((await db.job.findUniqueOrThrow({ where: { id: job.id } })).status).toBe("PAID");
  }, 60_000);

  it("owner cancels a scheduled job: full refund", async () => {
    const { job, q } = await quotedJob("Cancel me", 15_000);
    await startAcceptQuote(ownerId, job.id, q.id); await pay(job.id);
    await cancelJob(ownerId, job.id);
    const refunds = await db.jobPayment.findMany({ where: { jobId: job.id, kind: "REFUND" } });
    expect(refunds.reduce((sum, r) => sum + r.amountCents, 0)).toBe(15_750);
    expect((await db.job.findUniqueOrThrow({ where: { id: job.id } })).status).toBe("CANCELLED");
  }, 60_000);

  it("problem reported → admin refunds", async () => {
    const { job, q } = await quotedJob("Problem job");
    await startAcceptQuote(ownerId, job.id, q.id); await pay(job.id);
    await markComplete(providerUserId, job.id, "");
    await expect(reportProblem(ownerId, job.id, "short")).rejects.toThrow(/sentence/);
    await reportProblem(ownerId, job.id, "Bathrooms were not cleaned at all");
    expect((await db.job.findUniqueOrThrow({ where: { id: job.id } })).status).toBe("DISPUTED");
    expect(await resolveDispute(job.id, "refund")).toBe("refunded");
    expect((await db.job.findUniqueOrThrow({ where: { id: job.id } })).status).toBe("CANCELLED");
  }, 60_000);
});
