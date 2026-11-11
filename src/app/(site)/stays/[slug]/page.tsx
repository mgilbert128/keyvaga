import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { connection } from "next/server";
import { getPublishedStay, getStayReviews, getUnavailableNights } from "@/lib/stay";
import { getCurrentUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { toggleSaved } from "@/app/actions/guest";
import { playableUrl } from "@/lib/storage";
import { formatCents } from "@/lib/money";
import { amenityLabel } from "@/lib/amenities";
import { propertyTypeLabel } from "@/lib/property-types";
import { parseISODate, rangeHasConflict, todayIn, toISODate, addDays } from "@/lib/dates";
import { quoteStay } from "@/lib/pricing";
import { bookingAmounts, paymentSchedule, POLICY_INFO } from "@/lib/booking-money";
import { reserve } from "@/app/actions/bookings";
import { Card, Chip, Avatar } from "@/components/ui/Card";
import { inputClass } from "@/components/ui/Field";
import { buttonClass } from "@/components/ui/Button";
import { Gallery } from "@/components/listings/Gallery";
import { AvailabilityCalendar } from "@/components/listings/AvailabilityCalendar";

export async function generateMetadata({ params }: PageProps<"/stays/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const stay = await getPublishedStay(slug);
  return stay ? { title: `${stay.title} in ${stay.city}, ${stay.region}`, description: stay.summary } : { title: "Stay not found" };
}

export default function StayPage({ params, searchParams }: PageProps<"/stays/[slug]">) {
  return (
    <Suspense fallback={<div className="mt-10 h-96 animate-pulse rounded-card bg-surface" aria-hidden="true" />}>
      <Stay params={params} searchParams={searchParams} />
    </Suspense>
  );
}

const timeFmt = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(Date.UTC(2000, 0, 1, h, m)).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
};

async function Stay({ params, searchParams }: Pick<PageProps<"/stays/[slug]">, "params" | "searchParams">) {
  const { slug } = await params;
  const sp = await searchParams;
  await connection(); // availability and prices depend on today's date
  const stay = await getPublishedStay(slug);
  if (!stay) notFound();

  const today = todayIn();
  const [unavailable, reviewData, viewer] = await Promise.all([getUnavailableNights(stay.id, today), getStayReviews(stay.id), getCurrentUser()]);
  const saved = viewer ? Boolean(await db.savedListing.findUnique({ where: { userId_listingId: { userId: viewer.id, listingId: stay.id } } })) : false;

  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  const checkIn = parseISODate(str(sp.checkIn));
  const checkOut = parseISODate(str(sp.checkOut));
  const guestsNum = Number.parseInt(str(sp.guests) ?? "", 10);
  const guests = Number.isFinite(guestsNum) && guestsNum > 0 ? guestsNum : undefined;

  let quoteError: string | null = null;
  let quote: ReturnType<typeof quoteStay> | null = null;
  if (checkIn && checkOut) {
    if (checkIn < today) quoteError = "Check-in can't be in the past.";
    else {
      quote = quoteStay({ ...stay, seasons: stay.seasonalRates }, checkIn, checkOut);
      if (!quote.ok) quoteError = quote.reason === "below_min_nights" ? `This stay has a ${quote.minNights}-night minimum.` : "Check-out must be after check-in.";
      else if (rangeHasConflict(checkIn, checkOut, unavailable)) quoteError = "Some of those nights are already booked. Try other dates.";
    }
  }
  if (!quoteError && guests && guests > stay.maxGuests) quoteError = `This place sleeps up to ${stay.maxGuests}.`;
  const reserveError = str(sp.error)?.slice(0, 200);
  const amounts = quote?.ok && !quoteError ? bookingAmounts(quote.totalCents) : null;
  const schedule = amounts && checkIn ? paymentSchedule(amounts.guestTotalCents, checkIn, today) : null;
  const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

  const firstMonth = { year: today.getUTCFullYear(), monthIndex: today.getUTCMonth() };
  const second = new Date(Date.UTC(firstMonth.year, firstMonth.monthIndex + 1, 1));
  const rules = stay.houseRules.split("\n").map((r) => r.trim()).filter(Boolean);

  return (
    <article className="flex flex-col gap-8 pt-6 sm:pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{stay.title}</h1>
          <p className="text-lg text-ink-muted">
            {reviewData.count ? <><span className="text-brand" aria-hidden="true">★</span> {reviewData.average!.toFixed(1)} ({reviewData.count} review{reviewData.count === 1 ? "" : "s"}) · </> : null}
            {stay.city}, {stay.region} · {propertyTypeLabel(stay.propertyType)}
          </p>
        </div>
        <form action={toggleSaved.bind(null, stay.id, stay.slug)}>
          <button type="submit" aria-pressed={saved} className={buttonClass("secondary")}>
            <span aria-hidden="true">{saved ? "♥" : "♡"}</span> {saved ? "Saved" : "Save"}
          </button>
        </form>
      </div>

      <Gallery
        photos={stay.photos}
        title={stay.title}
        slug={stay.slug}
        videoSrc={stay.videoKey ? await playableUrl({ key: stay.videoKey, url: stay.videoUrl, access: stay.videoAccess }) : null}
      />

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_24rem]">
        <div className="flex flex-col gap-10">
          <section aria-labelledby="overview" className="flex flex-col gap-3">
            <h2 id="overview" className="sr-only">Overview</h2>
            <p className="text-lg font-semibold">
              Sleeps {stay.maxGuests} · {stay.bedrooms} bedroom{stay.bedrooms === 1 ? "" : "s"} · {stay.bathrooms.toString()} bath{stay.bathrooms.toString() === "1" ? "" : "s"}
            </p>
            {stay.summary ? <p className="text-lg">{stay.summary}</p> : null}
            {stay.description ? <p className="whitespace-pre-line text-ink-muted">{stay.description}</p> : null}
          </section>

          {stay.amenities.length ? (
            <section aria-labelledby="amenities" className="flex flex-col gap-4 border-t border-line pt-8">
              <h2 id="amenities" className="text-2xl font-bold">What this place offers</h2>
              <ul className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
                {stay.amenities.map((a) => (
                  <li key={a} className="flex items-center gap-2"><span aria-hidden="true" className="text-brand">✓</span>{amenityLabel(a)}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <section aria-labelledby="availability" className="flex flex-col gap-4 border-t border-line pt-8">
            <h2 id="availability" className="text-2xl font-bold">Availability</h2>
            {stay.minNights > 1 ? <p className="text-ink-muted">{stay.minNights}-night minimum stay.</p> : null}
            {stay.weeklyDiscountBps || stay.monthlyDiscountBps ? (
              <p className="text-ink-muted">
                {[stay.weeklyDiscountBps ? `${stay.weeklyDiscountBps / 100}% off stays of 7+ nights` : null, stay.monthlyDiscountBps ? `${stay.monthlyDiscountBps / 100}% off stays of 28+ nights` : null].filter(Boolean).join(" · ")}
              </p>
            ) : null}
            <AvailabilityCalendar
              months={[firstMonth, { year: second.getUTCFullYear(), monthIndex: second.getUTCMonth() }]}
              unavailable={unavailable}
              today={today}
              selected={quote?.ok && !quoteError && checkIn && checkOut ? { checkIn, checkOut } : undefined}
            />
          </section>

          <section aria-labelledby="rules" className="flex flex-col gap-4 border-t border-line pt-8">
            <h2 id="rules" className="text-2xl font-bold">House rules</h2>
            <ul className="flex flex-col gap-2">
              <li>Check-in after {timeFmt(stay.checkInTime)}</li>
              <li>Checkout before {timeFmt(stay.checkOutTime)}</li>
              <li>Up to {stay.maxGuests} guests</li>
              {rules.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="reviews" className="flex flex-col gap-2 border-t border-line pt-8">
            <h2 id="reviews" className="text-2xl font-bold">
              Reviews{reviewData.count ? <span className="font-medium"> · <span className="text-brand" aria-hidden="true">★</span> {reviewData.average!.toFixed(1)} ({reviewData.count})</span> : null}
            </h2>
            {reviewData.count === 0 ? (
              <p className="text-ink-muted">No reviews yet. Reviews appear here after guests stay.</p>
            ) : (
              <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                {reviewData.reviews.map((r) => (
                  <li key={r.id} className="flex flex-col gap-1">
                    <p className="font-semibold">{r.guest.name.split(" ")[0]} <span className="font-normal text-ink-muted">· {r.createdAt.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span></p>
                    <p aria-label={`${r.rating} out of 5 stars`} className="text-brand">{"★".repeat(r.rating)}<span className="text-line-strong">{"★".repeat(5 - r.rating)}</span></p>
                    <p className="whitespace-pre-line text-ink-muted">{r.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="host" className="flex items-center gap-4 border-t border-line pt-8">
            <Avatar name={stay.owner.name} />
            <div>
              <h2 id="host" className="text-xl font-bold">Hosted by {stay.owner.name}</h2>
              <p className="text-ink-muted">On Keyvaga since {stay.owner.createdAt.getFullYear()}</p>
            </div>
          </section>
        </div>

        <aside aria-labelledby="book" className="lg:sticky lg:top-6 lg:self-start">
          <Card className="flex flex-col gap-5">
            <h2 id="book" className="text-2xl font-semibold">
              {formatCents(stay.nightlyRateCents)} <span className="text-lg font-medium">/ night</span>
            </h2>
            {stay.instantBook ? <Chip className="self-start">Instant book</Chip> : null}
            <form method="get" className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <label htmlFor="checkIn" className="text-sm font-semibold">Check in</label>
                  <input id="checkIn" name="checkIn" type="date" min={toISODate(today)} defaultValue={checkIn ? toISODate(checkIn) : undefined} className={inputClass} required />
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="checkOut" className="text-sm font-semibold">Check out</label>
                  <input id="checkOut" name="checkOut" type="date" min={toISODate(addDays(today, 1))} defaultValue={checkOut ? toISODate(checkOut) : undefined} className={inputClass} required />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="guests" className="text-sm font-semibold">Guests</label>
                <input id="guests" name="guests" type="number" min={1} max={stay.maxGuests} inputMode="numeric" defaultValue={guests ?? 1} className={inputClass} />
              </div>
              <button type="submit" className={buttonClass("secondary", "w-full")}>Check price</button>
            </form>

            <div aria-live="polite" className="flex flex-col gap-3">
              {quoteError ? <p role="alert" className="font-medium text-danger">{quoteError}</p> : null}
              {quote?.ok && !quoteError && amounts && schedule ? (
                <>
                  <dl className="flex flex-col gap-2 border-t border-line pt-4">
                    <div className="flex justify-between gap-4">
                      <dt>{formatCents(quote.nightlyRateCents)} × {quote.nights} night{quote.nights === 1 ? "" : "s"}</dt>
                      <dd>{formatCents(quote.nightsCents)}</dd>
                    </div>
                    {quote.discountCents ? (
                      <div className="flex justify-between gap-4 text-on-soft"><dt>{quote.discountLabel}</dt><dd>−{formatCents(quote.discountCents)}</dd></div>
                    ) : null}
                    {quote.cleaningCents ? (
                      <div className="flex justify-between gap-4"><dt>Cleaning fee</dt><dd>{formatCents(quote.cleaningCents)}</dd></div>
                    ) : null}
                    <div className="flex justify-between gap-4"><dt>Keyvaga service fee</dt><dd>{formatCents(amounts.guestFeeCents)}</dd></div>
                    <div className="flex justify-between gap-4 border-t border-line pt-2 text-lg font-bold">
                      <dt>Total (USD)</dt><dd>{formatCents(amounts.guestTotalCents)}</dd>
                    </div>
                  </dl>
                  <div className="rounded-control bg-soft px-4 py-3 text-sm text-on-soft">
                    {schedule.kind === "split" ? (
                      <p>
                        <strong>Pay {formatCents(schedule.dueNowCents)} today</strong> (30%), and the remaining {formatCents(schedule.balanceCents)} is
                        charged automatically on {dateFmt.format(schedule.balanceDueDate)}.
                      </p>
                    ) : (
                      <p><strong>Pay {formatCents(schedule.dueNowCents)} today.</strong> Check-in is within 30 days, so the full amount is due now.</p>
                    )}
                  </div>
                </>
              ) : null}
              {reserveError ? <p role="alert" className="font-medium text-danger">{reserveError}</p> : null}
            </div>
            {quote?.ok && !quoteError && checkIn && checkOut ? (
              <form action={reserve}>
                <input type="hidden" name="listingId" value={stay.id} />
                <input type="hidden" name="slug" value={stay.slug} />
                <input type="hidden" name="checkIn" value={toISODate(checkIn)} />
                <input type="hidden" name="checkOut" value={toISODate(checkOut)} />
                <input type="hidden" name="guests" value={guests ?? 1} />
                <button type="submit" className={buttonClass("primary", "w-full")}>Reserve</button>
              </form>
            ) : (
              <button type="button" disabled className={buttonClass("primary", "w-full")} aria-describedby="book-hint">Reserve</button>
            )}
            <p id="book-hint" className="text-center text-sm text-ink-muted">
              {quote?.ok && !quoteError ? "You won't be charged until you confirm payment." : "Choose dates and click Check price to book."}
            </p>
            <div className="border-t border-line pt-4 text-sm">
              <p className="font-semibold">Cancellation: {POLICY_INFO[stay.cancellationPolicy].label}</p>
              <p className="text-ink-muted">{POLICY_INFO[stay.cancellationPolicy].summary}</p>
            </div>
          </Card>
        </aside>
      </div>
    </article>
  );
}
