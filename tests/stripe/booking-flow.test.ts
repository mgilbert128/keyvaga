/**
 * End-to-end booking money flow against Stripe TEST mode and a real Postgres.
 * Runs only when STRIPE_INTEGRATION=1 and TEST_DATABASE_URL are set. Never uses real money.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import Stripe from "stripe";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { addDays, todayIn } from "@/lib/dates";
import { cancelBooking, chargeBalance, expireStaleHolds, payOutBooking, previewCancellation, startBooking, syncPaymentIntent } from "@/lib/bookings";

const run = process.env.STRIPE_INTEGRATION === "1" && process.env.TEST_DATABASE_URL;
const suite = run ? describe : describe.skip;

suite("booking flow with Stripe test mode", () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.TEST_DATABASE_URL! }) });
  const s = new Stripe(process.env.STRIPE_SECRET_KEY ?? "proxy-injected", { httpClient: Stripe.createFetchHttpClient() });
  let listingId = "";
  let guestId = "";
  let guest2Id = "";
  const today = todayIn();

  /** Simulates the guest entering a test card on the checkout page. */
  async function payPending(bookingId: string, card = "pm_card_visa") {
    const p = await db.payment.findFirstOrThrow({ where: { bookingId, status: "PENDING" } });
    await s.paymentIntents.confirm(p.stripeId!, { payment_method: card, return_url: "https://keyvaga.vercel.app/trips" });
    return syncPaymentIntent(p.stripeId!);
  }

  beforeAll(async () => {
    await db.payment.deleteMany();
    await db.booking.deleteMany();
    await db.calendarBlock.deleteMany();
    await db.listingPhoto.deleteMany();
    await db.listing.deleteMany();
    await db.userRole.deleteMany();
    await db.session.deleteMany();
    await db.user.deleteMany();
    const owner = await db.user.create({ data: { email: "owner-flow@test.example", name: "Owner Flow", passwordHash: "x" } });
    guestId = (await db.user.create({ data: { email: "guest-flow@test.example", name: "Guest Flow", passwordHash: "x" } })).id;
    guest2Id = (await db.user.create({ data: { email: "guest2-flow@test.example", name: "Guest Two", passwordHash: "x" } })).id;
    listingId = (
      await db.listing.create({
        data: {
          ownerId: owner.id, slug: "flow", title: "Flow Cabin", summary: "s", propertyType: "CABIN", city: "C", region: "WI",
          bedrooms: 2, bathrooms: "1", maxGuests: 4, nightlyRateCents: 20_000, cleaningFeeCents: 10_000, minNights: 2,
          status: "PUBLISHED", cancellationPolicy: "MODERATE",
        },
      })
    ).id;
  });
  afterAll(() => db.$disconnect());

  it("books 60 days out: 30% deposit now, card saved, balance scheduled", async () => {
    const checkIn = addDays(today, 60);
    const { bookingId } = await startBooking({ guestId, listingId, checkIn, checkOut: addDays(checkIn, 4), guests: 2 });
    let b = await db.booking.findUniqueOrThrow({ where: { id: bookingId } });
    // 4 × $200 + $100 cleaning = $900; +5% = $945; deposit 30% = $283.50
    expect(b).toMatchObject({ status: "PENDING_PAYMENT", totalCents: 94_500, serviceCents: 4_500, hostPayoutCents: 85_500, dueNowCents: 28_350, balanceCents: 66_150 });

    // Another guest can't grab overlapping dates while the hold is active.
    await expect(startBooking({ guestId: guest2Id, listingId, checkIn: addDays(checkIn, 2), checkOut: addDays(checkIn, 5), guests: 2 })).rejects.toThrow(/just booked/);

    expect(await payPending(bookingId)).toBe("confirmed");
    b = await db.booking.findUniqueOrThrow({ where: { id: bookingId } });
    expect(b).toMatchObject({ status: "CONFIRMED", balanceStatus: "SCHEDULED", payoutStatus: "PENDING", payoutDueCents: 85_500 });
    expect(b.stripePaymentMethodId).toMatch(/^pm_/);
    // Sync is safe to repeat (page reload + webhook).
    const p = await db.payment.findFirstOrThrow({ where: { bookingId, kind: "DEPOSIT" } });
    expect(await syncPaymentIntent(p.stripeId!)).toBe("confirmed");

    // Daily job charges the balance off-session with the saved card.
    expect(await chargeBalance(bookingId)).toBe("balance_paid");
    b = await db.booking.findUniqueOrThrow({ where: { id: bookingId } });
    expect(b.balanceStatus).toBe("PAID");

    // Moderate policy, 60 days out: full refund of everything paid.
    const preview = await previewCancellation(bookingId, "guest");
    expect(preview.refundCents).toBe(94_500);
    await cancelBooking(bookingId, "guest");
    b = await db.booking.findUniqueOrThrow({ where: { id: bookingId } });
    expect(b).toMatchObject({ status: "CANCELLED", refundedCents: 94_500, payoutStatus: "NONE" });
    const refunds = await db.payment.findMany({ where: { bookingId, kind: "REFUND" } });
    expect(refunds.reduce((sum, r) => sum + r.amountCents, 0)).toBe(94_500);

    // Dates are free again.
    const again = await startBooking({ guestId: guest2Id, listingId, checkIn, checkOut: addDays(checkIn, 4), guests: 2 });
    expect(again.bookingId).toBeTruthy();
    await db.booking.update({ where: { id: again.bookingId }, data: { holdExpiresAt: new Date(Date.now() - 1000) } });
    expect(await expireStaleHolds(listingId)).toBe(1);
  }, 60_000);

  it("books 10 days out: pays in full; declined card leaves the booking unconfirmed", async () => {
    const checkIn = addDays(today, 10);
    const { bookingId } = await startBooking({ guestId, listingId, checkIn, checkOut: addDays(checkIn, 2), guests: 1 });
    let b = await db.booking.findUniqueOrThrow({ where: { id: bookingId } });
    expect(b).toMatchObject({ dueNowCents: b.totalCents, balanceCents: 0, balanceDueDate: null });

    await expect(payPending(bookingId, "pm_card_chargeDeclined")).rejects.toThrow(/declined/i);
    b = await db.booking.findUniqueOrThrow({ where: { id: bookingId } });
    expect(b.status).toBe("PENDING_PAYMENT");

    expect(await payPending(bookingId)).toBe("confirmed");
    // Owner cancels: guest refunded in full, owner gets nothing.
    await cancelBooking(bookingId, "owner");
    b = await db.booking.findUniqueOrThrow({ where: { id: bookingId } });
    expect(b).toMatchObject({ status: "CANCELLED", refundedCents: b.totalCents, payoutDueCents: 0 });
  }, 60_000);

  it("strict policy, 40 days out, deposit only: keeps the deposit, cancels the balance, owner paid their share later", async () => {
    await db.listing.update({ where: { id: listingId }, data: { cancellationPolicy: "STRICT" } });
    const checkIn = addDays(today, 40);
    const { bookingId } = await startBooking({ guestId, listingId, checkIn, checkOut: addDays(checkIn, 3), guests: 2 });
    await payPending(bookingId);
    const outcome = await cancelBooking(bookingId, "guest");
    const b = await db.booking.findUniqueOrThrow({ where: { id: bookingId } });
    expect(outcome.refundCents).toBe(0);
    expect(b).toMatchObject({ status: "CANCELLED", balanceStatus: "CANCELLED", payoutStatus: "PENDING" });
    expect(b.payoutDueCents).toBe(Math.round((b.dueNowCents * (b.nightlyCents + b.cleaningCents)) / b.totalCents * 0.95));
    expect(await chargeBalance(bookingId)).toBe("skipped");
    // Owner has no payout account yet, and check-in is in the future.
    expect(await payOutBooking(bookingId)).toBe("not_yet");
  }, 60_000);

  it("rejects bad requests", async () => {
    const checkIn = addDays(today, 20);
    await expect(startBooking({ guestId, listingId, checkIn, checkOut: addDays(checkIn, 1), guests: 2 })).rejects.toThrow(/minimum/);
    await expect(startBooking({ guestId, listingId, checkIn, checkOut: addDays(checkIn, 3), guests: 9 })).rejects.toThrow(/sleeps up to/);
    await expect(startBooking({ guestId, listingId, checkIn: addDays(today, -2), checkOut: addDays(today, 2), guests: 2 })).rejects.toThrow(/past/);
    const ownerId = (await db.listing.findUniqueOrThrow({ where: { id: listingId } })).ownerId;
    await expect(startBooking({ guestId: ownerId, listingId, checkIn, checkOut: addDays(checkIn, 3), guests: 2 })).rejects.toThrow(/own listing/);
  });
});
