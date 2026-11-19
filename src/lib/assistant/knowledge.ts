/**
 * What the help assistant knows. Built from the same constants the site charges with, so fees and
 * policies here can't drift from the real ones. When a feature or policy changes, update this text
 * (and the Help center page) together.
 */
import { BALANCE_DAYS_BEFORE, CANCELLATION_POLICIES, DEPOSIT_BPS, GUEST_FEE_BPS, HOST_FEE_BPS, POLICY_INFO } from "@/lib/booking-money";
import { AUTO_RELEASE_DAYS, JOB_OWNER_FEE_BPS, JOB_PROVIDER_FEE_BPS } from "@/lib/services";

const pct = (bps: number) => `${bps / 100}%`;

export const SUPPORT_EMAIL = "support@keyvaga.com";

export function knowledgeBase(): string {
  return `# Keyvaga: facts for the help assistant

Keyvaga (keyvaga.com) is a vacation-rental marketplace in the United States, priced in US dollars.
Guests book stays (coast, lake, mountain, city). Owners and property managers list rentals. Owners also hire local service pros (cleaners, handymen) through Keyvaga.
One account does everything: a Traveling | Hosting switch at the top of the page moves between trips and hosting. The first switch to Hosting turns an account into a host.
Support email: ${SUPPORT_EMAIL}. Pages: Help center /help, Terms /terms, Privacy /privacy, Cancellation Policy /cancellation-policy, List your property /list-your-property.

## Accounts
- Sign up at /signup. New accounts get an email with a link to confirm the address (valid 48 hours). Confirming is required before booking, submitting a listing, or offering services. A yellow banner has a "Resend link" button.
- Forgot password: /forgot-password sends a reset link valid for 1 hour.
- After several wrong passwords, logins pause for about 15 minutes.
- To delete an account or get a copy of personal data, email ${SUPPORT_EMAIL} from the account's address.

## Guests: booking and paying
- Instant book: when payment goes through, the booking is confirmed. Dates are held for a few minutes while paying.
- Price = nightly rates + any cleaning fee + Keyvaga's ${pct(GUEST_FEE_BPS)} guest service fee. The total shown before paying is the total paid.
- If check-in is more than ${BALANCE_DAYS_BEFORE} days away: ${pct(DEPOSIT_BPS)} is paid at booking and the rest is charged automatically to the same card ${BALANCE_DAYS_BEFORE} days before check-in. Closer than that, the full amount is paid at booking.
- If the balance charge fails, Keyvaga retries automatically and shows a warning on the trip page; the guest should contact support so the stay isn't at risk.
- Payments are processed by Stripe; Keyvaga never sees full card numbers.
- Trips page (/trips): each booking shows dates, payments, house rules, messages with the host, and check-in details.
- Address, check-in instructions and (if the home has a smart lock) the guest's own door code appear on the trip page a few days before check-in (the owner chooses how many). A door code works only from check-in time to checkout time.
- Message the host from the trip page ("Message host"). Keep messages and payments on Keyvaga.
- Reviews: after checkout, guests can review the stay for 60 days.
- Badges: "Verified host" = the owner sent proof they own or manage the property and Keyvaga reviewed it. "Permit on file" = a rental permit was provided where one is required. Helpful checks, not guarantees.

## Cancellations and refunds
Each listing uses one policy, shown before booking:
${CANCELLATION_POLICIES.map((p) => `- ${POLICY_INFO[p].label}: ${POLICY_INFO[p].summary}`).join("\n")}
- The refund percentage applies to the whole booking total, including the guest service fee.
- If the balance hasn't been charged yet, it's cancelled; Keyvaga never charges more because of a cancellation, and refunds anything paid beyond what the policy lets the owner keep.
- The trip page shows the exact refund before the guest confirms. Cancel from Trips -> the booking -> Cancel booking.
- If the owner cancels, the guest gets a full refund of everything paid, always.
- Refunds go back to the original card immediately; banks usually take 5-10 business days to show them.
- Property seriously not as described, unsafe, or can't get in: message the owner right away and email ${SUPPORT_EMAIL} with photos. Keyvaga reviews and may refund in full or part.

## Owners: listing and hosting
- Listing is free; no monthly fees. Keyvaga keeps ${pct(HOST_FEE_BPS)} of each booking's subtotal (nightly rates + cleaning fee). Owners keep ${100 - HOST_FEE_BPS / 100}%.
- Payouts: set up under Owner -> Payouts through Stripe (about 5 minutes; Stripe may ask for ID). The owner's share is sent after the guest checks in; banks usually show it in 2-3 business days.
- Listings are reviewed by Keyvaga before going live. Owners upload proof of ownership (deed, tax bill) or a management agreement, plus a rental permit where required. Documents are private (only the owner and Keyvaga reviewers can open them).
- Owners choose Flexible, Moderate or Strict cancellation. If an owner cancels a confirmed booking, the guest is fully refunded and the owner gets nothing for it.
- Calendar (Owner -> Calendar): tap the first and last night to set a custom price (e.g. a holiday weekend), block dates, or reset to the normal price. Seasonal rates, weekend rates and weekly/monthly discounts are under Pricing.
- Calendar sync: Owner -> Calendar -> "Sync with Airbnb, Vrbo, Hospitable and OwnerRez". Copy Keyvaga's private calendar link into each other site's "Import calendar" box, and paste each site's export (iCal) link into Keyvaga. Works with Airbnb, Vrbo, Booking.com, Hospitable, OwnerRez and Google Calendar. Keyvaga re-checks the other calendars right before every booking; other sites usually refresh every 1-3 hours.
- Smart locks: Owner -> Smart locks -> Connect a lock (Schlage, Yale, August, Kwikset, Igloohome, Lockly, Nuki and more, through Seam). Choose which property each lock is on. Each confirmed guest gets a unique code valid check-in to checkout; hired cleaners and pros get a code for the job day (7 AM-9 PM). Codes are removed when a booking or job is cancelled. Owners can set a backup code shown only if a guest's code can't be added or the lock is offline.
- Automated messages: Owner -> Messages -> Automated messages. Start from suggested messages (thanks for booking, check-in details, welcome, checkout reminder, thanks for staying) and edit them. Fill-ins like {guest_first_name}, {check_in_date}, {address}, {door_code}.
- Turnover cleaning: on a listing, pick a regular cleaner and turn on automatic requests; every new booking sends them a cleaning request for checkout day, and the owner accepts the quote.

## Service jobs (owners hiring pros, and pros)
- Owners find pros under Owner -> Find services (by town and state) or post a job; pros send quotes.
- When an owner accepts a quote, they pay the quote plus a ${pct(JOB_OWNER_FEE_BPS)} Keyvaga fee. Keyvaga holds it.
- The pro is paid (quote minus ${pct(JOB_PROVIDER_FEE_BPS)}) when the owner confirms the work, or automatically ${AUTO_RELEASE_DAYS} days after the pro marks it done if the owner reports no problem.
- Cleanings use the owner's checklist; the cleaner ticks every item and uploads the required photos before marking done. Photos are private to the owner, the cleaner and Keyvaga.
- If an owner reports a problem, payment is held while Keyvaga reviews. Cancelled jobs are refunded in full.
- Pros join free at /signup?intent=PROVIDER, complete a business profile (services, towns covered, photos) and submit it for review. Payouts under Services -> Payouts.
`;
}
