/** Automatic turnover cleanings, end to end in Stripe TEST mode (STRIPE_INTEGRATION=1). */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import Stripe from "stripe";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { addDays, todayIn } from "@/lib/dates";
import { cancelBooking, startBooking, syncPaymentIntent } from "@/lib/bookings";
import { startAcceptQuote, submitQuote, syncJobPayment } from "@/lib/jobs";

const run = process.env.STRIPE_INTEGRATION === "1" && process.env.TEST_DATABASE_URL;
const suite = run ? describe : describe.skip;

suite("automatic turnover cleaning", () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.TEST_DATABASE_URL! }) });
  const s = new Stripe(process.env.STRIPE_SECRET_KEY ?? "proxy-injected", { httpClient: Stripe.createFetchHttpClient() });
  let listingId = "", guestId = "", cleanerUserId = "";
  let cleaner: Awaited<ReturnType<typeof db.providerProfile.create>>;

  beforeAll(async () => {
    await db.autoMessageLog.deleteMany(); await db.messageTemplate.deleteMany(); await db.message.deleteMany(); await db.jobPayment.deleteMany(); await db.jobReview.deleteMany(); await db.jobMessage.deleteMany(); await db.quote.deleteMany(); await db.job.deleteMany();
    await db.payment.deleteMany(); await db.booking.deleteMany(); await db.listingPhoto.deleteMany(); await db.listing.deleteMany();
    await db.providerPhoto.deleteMany(); await db.providerProfile.deleteMany(); await db.session.deleteMany(); await db.userRole.deleteMany(); await db.user.deleteMany();
    const owner = await db.user.create({ data: { email: "o-turn@test.example", name: "Owner T", passwordHash: "x" } });
    guestId = (await db.user.create({ data: { email: "g-turn@test.example", name: "Guest T", passwordHash: "x" } })).id;
    cleanerUserId = (await db.user.create({ data: { email: "c-turn@test.example", name: "Sparkle", passwordHash: "x" } })).id;
    cleaner = await db.providerProfile.create({ data: { userId: cleanerUserId, slug: "sparkle", businessName: "Sparkle Turnovers", categories: ["cleaning"], serviceAreas: ["lake geneva"], region: "WI", status: "APPROVED" } });
    listingId = (await db.listing.create({ data: { ownerId: owner.id, slug: "turn", title: "Turnover Cabin", summary: "s", propertyType: "CABIN", city: "Lake Geneva", region: "WI", bedrooms: 3, bathrooms: "2", maxGuests: 6, nightlyRateCents: 20_000, status: "PUBLISHED", cancellationPolicy: "FLEXIBLE", regularCleanerId: cleaner.id, autoRequestCleaning: true } })).id;
  });
  afterAll(() => db.$disconnect());

  async function payBooking(bookingId: string) {
    const p = await db.payment.findFirstOrThrow({ where: { bookingId, status: "PENDING" } });
    await s.paymentIntents.confirm(p.stripeId!, { payment_method: "pm_card_visa", return_url: "https://keyvaga.vercel.app" });
    return syncPaymentIntent(p.stripeId!);
  }

  it("booking confirmed → cleaner gets a request for checkout day; booking cancelled → cleaning cancelled and refunded", async () => {
    const checkIn = addDays(todayIn(), 20);
    const checkOut = addDays(checkIn, 3);
    const { bookingId } = await startBooking({ guestId, listingId, checkIn, checkOut, guests: 2 });
    expect(await db.job.count({ where: { bookingId } })).toBe(0); // nothing until the guest pays
    expect(await payBooking(bookingId)).toBe("confirmed");

    const job = await db.job.findFirstOrThrow({ where: { bookingId } });
    expect(job).toMatchObject({ category: "cleaning", targetProviderId: cleaner.id, flexibleDate: false, status: "OPEN" });
    expect(job.preferredDate?.toISOString().slice(0, 10)).toBe(checkOut.toISOString().slice(0, 10));
    expect(job.description).toContain("3 bedrooms");
    // Paying again / webhook replays never duplicate the request.
    const p = await db.payment.findFirstOrThrow({ where: { bookingId, kind: "FULL" } });
    await syncPaymentIntent(p.stripeId!);
    expect(await db.job.count({ where: { bookingId } })).toBe(1);

    // Cleaner quotes, owner accepts and pays.
    const q = await submitQuote({ ...cleaner, userId: cleanerUserId }, job.id, { amountCents: 14_000, proposedDate: checkOut, message: "Usual turnover" });
    await startAcceptQuote(job.ownerId, job.id, q.id);
    const jp = await db.jobPayment.findFirstOrThrow({ where: { jobId: job.id, status: "PENDING" } });
    await s.paymentIntents.confirm(jp.stripeId!, { payment_method: "pm_card_visa", return_url: "https://keyvaga.vercel.app" });
    expect(await syncJobPayment(jp.stripeId!)).toBe("assigned");

    // Guest cancels the stay → cleaning cancelled with a full refund to the owner.
    await cancelBooking(bookingId, "guest");
    const after = await db.job.findUniqueOrThrow({ where: { id: job.id } });
    expect(after.status).toBe("CANCELLED");
    const refunds = await db.jobPayment.findMany({ where: { jobId: job.id, kind: "REFUND" } });
    expect(refunds.reduce((sum, r) => sum + r.amountCents, 0)).toBe(14_700);
  }, 90_000);

  it("does nothing when automatic requests are off", async () => {
    await db.listing.update({ where: { id: listingId }, data: { autoRequestCleaning: false } });
    const checkIn = addDays(todayIn(), 40);
    const { bookingId } = await startBooking({ guestId, listingId, checkIn, checkOut: addDays(checkIn, 2), guests: 2 });
    await payBooking(bookingId);
    expect(await db.job.count({ where: { bookingId } })).toBe(0);
  }, 60_000);
});
