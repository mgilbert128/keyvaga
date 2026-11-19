import "server-only";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { siteUrl } from "@/lib/site";
import { formatCents } from "@/lib/money";
import { categoryNoun, providerServes } from "@/lib/services";

/**
 * Email notifications. Every function is best-effort: it never throws, so a failed email can't
 * break a booking, payment or message. Callers don't await failures.
 */
const day = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const first = (name: string) => name.split(" ")[0] ?? name;
const snippet = (s: string, n = 600) => (s.length > n ? `${s.slice(0, n)}…` : s);

async function safe(fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (e) {
    console.error("notification failed", e instanceof Error ? e.message : e);
  }
}

export function notifyBookingConfirmed(bookingId: string) {
  return safe(async () => {
    const b = await db.booking.findUniqueOrThrow({ where: { id: bookingId }, include: { guest: true, listing: { include: { owner: true } } } });
    const details = [
      { label: "Check in", value: `${day.format(b.checkIn)} from ${b.listing.checkInTime}` },
      { label: "Check out", value: `${day.format(b.checkOut)} by ${b.listing.checkOutTime}` },
      { label: "Guests", value: String(b.guests) },
      { label: "Total", value: formatCents(b.totalCents) },
      ...(b.balanceCents > 0 && b.balanceDueDate
        ? [{ label: "Paid today", value: formatCents(b.dueNowCents) }, { label: `Charged ${day.format(b.balanceDueDate)}`, value: formatCents(b.balanceCents) }]
        : [{ label: "Paid", value: formatCents(b.dueNowCents) }]),
    ];
    await sendEmail(b.guest.email, {
      subject: `You're booked: ${b.listing.title}, ${day.format(b.checkIn)}`,
      heading: `You're booked, ${first(b.guest.name)}!`,
      paragraphs: [`Your stay at ${b.listing.title} in ${b.listing.city}, ${b.listing.region} is confirmed. Your host ${first(b.listing.owner.name)} has been notified.`, "The exact address and check-in instructions appear on your trip page before you arrive."],
      details,
      button: { label: "View your trip", url: `${siteUrl()}/trips/${b.id}` },
    });
    await sendEmail(b.listing.owner.email, {
      subject: `New booking: ${b.listing.title}, ${day.format(b.checkIn)} – ${day.format(b.checkOut)}`,
      heading: "You have a new booking",
      paragraphs: [`${b.guest.name} booked ${b.listing.title}. The dates are blocked on your calendar.`],
      details: [
        { label: "Check in", value: day.format(b.checkIn) },
        { label: "Check out", value: day.format(b.checkOut) },
        { label: "Guests", value: String(b.guests) },
        { label: "Your payout", value: formatCents(b.hostPayoutCents) },
      ],
      button: { label: "View booking", url: `${siteUrl()}/owner/bookings/${b.id}` },
    });
  });
}

/** Request to book: the guest's card is authorized; the owner has until holdExpiresAt to accept. */
export function notifyBookingRequested(bookingId: string) {
  return safe(async () => {
    const b = await db.booking.findUniqueOrThrow({ where: { id: bookingId }, include: { guest: true, listing: { include: { owner: true } } } });
    const deadline = b.holdExpiresAt ? b.holdExpiresAt.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: b.listing.timeZone, timeZoneName: "short" }) : "within 24 hours";
    const when = `${day.format(b.checkIn)} – ${day.format(b.checkOut)}`;
    await sendEmail(b.listing.owner.email, {
      subject: `Booking request: ${b.listing.title}, ${when}`,
      heading: `${first(b.guest.name)} wants to book ${b.listing.title}`,
      paragraphs: [`Please accept or decline by ${deadline}. If you don't answer by then, the request expires and the guest isn't charged.`, "The dates are held for this guest until you answer."],
      details: [
        { label: "Dates", value: when },
        { label: "Guests", value: String(b.guests) },
        { label: "Your payout", value: formatCents(b.hostPayoutCents) },
      ],
      button: { label: "Review the request", url: `${siteUrl()}/owner/bookings/${b.id}` },
    });
    await sendEmail(b.guest.email, {
      subject: `Request sent: ${b.listing.title}`,
      heading: "Your request is on its way",
      paragraphs: [
        `${first(b.listing.owner.name)} has until ${deadline} to accept your request for ${b.listing.title} (${when}).`,
        `Your card is authorized for ${formatCents(b.dueNowCents)} but won't be charged unless your host accepts. If they decline or don't answer, the hold is released.`,
      ],
      button: { label: "View your request", url: `${siteUrl()}/trips/${b.id}` },
    });
  });
}

/** A request to book ended without a booking: declined by the owner, withdrawn by the guest, or expired. */
export function notifyRequestEnded(bookingId: string, reason: "declined" | "withdrawn" | "expired") {
  return safe(async () => {
    const b = await db.booking.findUniqueOrThrow({ where: { id: bookingId }, include: { guest: true, listing: { include: { owner: true } } } });
    const when = `${day.format(b.checkIn)} – ${day.format(b.checkOut)}`;
    if (reason !== "withdrawn") {
      await sendEmail(b.guest.email, {
        subject: `Request ${reason === "declined" ? "declined" : "expired"}: ${b.listing.title}`,
        heading: reason === "declined" ? "Your host couldn't accept this request" : "Your request expired",
        paragraphs: [
          reason === "declined" ? `${first(b.listing.owner.name)} wasn't able to accept your request for ${b.listing.title} (${when}).` : `${first(b.listing.owner.name)} didn't answer your request for ${b.listing.title} (${when}) in time.`,
          "You weren't charged. The hold on your card is released, which can take a few days to disappear from your statement.",
        ],
        button: { label: "Find another stay", url: `${siteUrl()}/search` },
      });
    }
    await sendEmail(b.listing.owner.email, {
      subject: `Request ${reason}: ${b.listing.title}, ${when}`,
      heading: reason === "withdrawn" ? `${first(b.guest.name)} withdrew their request` : reason === "declined" ? "You declined a request" : "A booking request expired",
      paragraphs: [`The request for ${b.listing.title} (${when}) ended without a booking, and the dates are open again.`],
      button: { label: "View bookings", url: `${siteUrl()}/owner/bookings` },
    });
  });
}

export function notifyBookingCancelled(bookingId: string, by: "guest" | "owner", refundCents: number) {
  return safe(async () => {
    const b = await db.booking.findUniqueOrThrow({ where: { id: bookingId }, include: { guest: true, listing: { include: { owner: true } } } });
    const when = `${day.format(b.checkIn)} – ${day.format(b.checkOut)}`;
    await sendEmail(b.guest.email, {
      subject: `Booking cancelled: ${b.listing.title}`,
      heading: by === "owner" ? "Your host cancelled your booking" : "Your booking is cancelled",
      paragraphs: [
        `Your stay at ${b.listing.title} (${when}) has been cancelled${by === "owner" ? " by your host. We're sorry for the trouble." : "."}`,
        refundCents > 0 ? `${formatCents(refundCents)} is being refunded to your card. It usually appears within 5–10 business days.` : "No refund was due under the cancellation policy.",
      ],
      button: { label: "Find another stay", url: `${siteUrl()}/search` },
    });
    await sendEmail(b.listing.owner.email, {
      subject: `Booking cancelled: ${b.listing.title}, ${when}`,
      heading: by === "owner" ? "You cancelled a booking" : `${first(b.guest.name)} cancelled their booking`,
      paragraphs: [`The booking for ${b.listing.title} (${when}) is cancelled and the dates are open again.`, b.payoutDueCents > 0 ? `You'll still receive ${formatCents(b.payoutDueCents)} under your cancellation policy.` : "No payout is due for this booking."],
      button: { label: "View booking", url: `${siteUrl()}/owner/bookings/${b.id}` },
    });
  });
}

/** New message in a guest–host booking conversation (including automated ones). */
export function notifyBookingMessage(messageId: string) {
  return safe(async () => {
    const m = await db.message.findUniqueOrThrow({ where: { id: messageId }, include: { sender: true, booking: { include: { guest: true, listing: { include: { owner: true } } } } } });
    const b = m.booking;
    const toGuest = m.senderId !== b.guestId;
    const to = toGuest ? b.guest : b.listing.owner;
    await sendEmail(to.email, {
      subject: m.automated ? `${b.listing.title}: a message from your host` : `New message from ${first(m.sender.name)} about ${b.listing.title}`,
      heading: m.automated ? `A message from ${first(b.listing.owner.name)}` : `${first(m.sender.name)} sent you a message`,
      paragraphs: [`About ${b.listing.title}, ${day.format(b.checkIn)} – ${day.format(b.checkOut)}.`],
      quote: snippet(m.body, 3000),
      button: { label: "Reply on Keyvaga", url: `${siteUrl()}${toGuest ? `/messages/${b.id}` : `/owner/messages/${b.id}`}` },
      footer: "Reply on Keyvaga so your conversation and booking stay in one place.",
    });
  });
}

/** New message in a service job conversation. */
export function notifyJobMessage(messageId: string) {
  return safe(async () => {
    const m = await db.jobMessage.findUniqueOrThrow({ where: { id: messageId }, include: { sender: true, provider: { include: { user: true } }, job: { include: { owner: true } } } });
    const toOwner = m.senderId !== m.job.ownerId;
    const to = toOwner ? m.job.owner : m.provider.user;
    await sendEmail(to.email, {
      subject: `New message about "${m.job.title}"`,
      heading: `${toOwner ? m.provider.businessName : first(m.job.owner.name)} sent you a message`,
      paragraphs: [`About the job "${m.job.title}".`],
      quote: snippet(m.body),
      button: { label: "Reply on Keyvaga", url: `${siteUrl()}${toOwner ? `/owner/jobs/${m.jobId}?with=${m.providerId}` : `/provider/jobs/${m.jobId}`}` },
    });
  });
}

/** A new job: email the provider it was sent to, or providers who serve the area and category. */
export function notifyJobRequest(jobId: string) {
  return safe(async () => {
    const j = await db.job.findUniqueOrThrow({ where: { id: jobId }, include: { listing: true, targetProvider: { include: { user: true } } } });
    let recipients: { email: string; name: string }[] = [];
    if (j.targetProvider) recipients = [{ email: j.targetProvider.user.email, name: j.targetProvider.businessName }];
    else {
      const pros = await db.providerProfile.findMany({ where: { status: "APPROVED", categories: { has: j.category } }, include: { user: true }, take: 200 });
      recipients = pros.filter((p) => providerServes(p, { category: j.category, city: j.listing.city, region: j.listing.region })).slice(0, 25).map((p) => ({ email: p.user.email, name: p.businessName }));
    }
    for (const r of recipients) {
      await sendEmail(r.email, {
        subject: `${j.targetProvider ? "Quote request" : "New job near you"}: ${j.title}`,
        heading: j.targetProvider ? "You have a new quote request" : "A new job in your area",
        paragraphs: [`${categoryNoun(j.category)} in ${j.listing.city}, ${j.listing.region}${j.preferredDate ? `, preferred ${day.format(j.preferredDate)}` : ""}.`],
        quote: snippet(j.description),
        button: { label: "View and quote", url: `${siteUrl()}/provider/jobs/${j.id}` },
      });
    }
  });
}

export function notifyQuoteReceived(quoteId: string) {
  return safe(async () => {
    const q = await db.quote.findUniqueOrThrow({ where: { id: quoteId }, include: { provider: true, job: { include: { owner: true } } } });
    await sendEmail(q.job.owner.email, {
      subject: `New quote for "${q.job.title}": ${formatCents(q.amountCents)}`,
      heading: `${q.provider.businessName} sent a quote`,
      paragraphs: [`${formatCents(q.amountCents)}${q.proposedDate ? ` · can do it ${day.format(q.proposedDate)}` : ""}.`],
      ...(q.message ? { quote: snippet(q.message) } : {}),
      button: { label: "Compare quotes", url: `${siteUrl()}/owner/jobs/${q.jobId}` },
    });
  });
}

export function notifyHired(jobId: string) {
  return safe(async () => {
    const j = await db.job.findUniqueOrThrow({ where: { id: jobId }, include: { listing: true, acceptedQuote: { include: { provider: { include: { user: true } } } } } });
    const p = j.acceptedQuote?.provider;
    if (!p) return;
    await sendEmail(p.user.email, {
      subject: `You're hired: ${j.title}`,
      heading: "You're hired!",
      paragraphs: [`The owner accepted your quote for "${j.title}" at ${j.listing.city}, ${j.listing.region}. The address is on the job page.`],
      details: [
        ...(j.scheduledDate ? [{ label: "Date", value: day.format(j.scheduledDate) }] : []),
        { label: "You'll receive", value: formatCents(j.providerPayoutCents) },
      ],
      button: { label: "View job", url: `${siteUrl()}/provider/jobs/${j.id}` },
    });
  });
}

export function notifyJobDone(jobId: string) {
  return safe(async () => {
    const j = await db.job.findUniqueOrThrow({ where: { id: jobId }, include: { owner: true, acceptedQuote: { include: { provider: true } } } });
    await sendEmail(j.owner.email, {
      subject: `Job done: ${j.title}`,
      heading: `${j.acceptedQuote?.provider.businessName ?? "Your pro"} finished the job`,
      paragraphs: ["If everything looks good, release the payment. If not, report a problem. Payment is released automatically in 3 days."],
      ...(j.completionNote ? { quote: snippet(j.completionNote) } : {}),
      button: { label: "Review the job", url: `${siteUrl()}/owner/jobs/${j.id}` },
    });
  });
}

export function notifyPasswordReset(email: string, name: string, url: string) {
  return safe(() =>
    sendEmail(email, {
      subject: "Reset your Keyvaga password",
      heading: `Reset your password, ${first(name)}`,
      paragraphs: ["Someone (hopefully you) asked to reset your Keyvaga password. This link works for 1 hour and can be used once."],
      button: { label: "Choose a new password", url },
      footer: "If you didn't ask for this, you can ignore this email. Your password won't change.",
    }),
  );
}

export function notifyVerifyEmail(email: string, name: string, url: string) {
  return safe(() =>
    sendEmail(email, {
      subject: "Confirm your email for Keyvaga",
      heading: `Welcome to Keyvaga, ${first(name)}!`,
      paragraphs: ["Please confirm this is your email address. You'll need to confirm it before booking a stay, listing a property or offering services. The link works for 48 hours."],
      button: { label: "Confirm my email", url },
      footer: "If you didn't create a Keyvaga account, you can ignore this email.",
    }),
  );
}

export function notifyPaymentRequested(requestId: string) {
  return safe(async () => {
    const r = await db.paymentRequest.findUniqueOrThrow({ where: { id: requestId }, include: { booking: { include: { guest: true, listing: { include: { owner: true } } } } } });
    const b = r.booking;
    await sendEmail(b.guest.email, {
      subject: `Payment request from ${first(b.listing.owner.name)}: ${r.description}`,
      heading: `${first(b.listing.owner.name)} sent you a payment request`,
      paragraphs: [`For your stay at ${b.listing.title} (${day.format(b.checkIn)} – ${day.format(b.checkOut)}). You can pay or decline it from your trip page. Nothing is charged unless you approve it.`],
      details: [
        { label: "For", value: r.description },
        { label: "Amount", value: formatCents(r.totalCents) },
      ],
      button: { label: "Review request", url: `${siteUrl()}/trips/${b.id}#payment-requests` },
    });
  });
}

export function notifyPaymentRequestPaid(requestId: string) {
  return safe(async () => {
    const r = await db.paymentRequest.findUniqueOrThrow({ where: { id: requestId }, include: { booking: { include: { guest: true, listing: { include: { owner: true } } } } } });
    const b = r.booking;
    await sendEmail(b.listing.owner.email, {
      subject: `${first(b.guest.name)} paid your request: ${r.description}`,
      heading: "Payment request paid",
      paragraphs: [`${b.guest.name} paid your request for ${b.listing.title}. Your share is paid out once the stay has started.`],
      details: [
        { label: "For", value: r.description },
        { label: "Guest paid", value: formatCents(r.totalCents) },
        { label: "Your payout", value: formatCents(r.ownerPayoutCents) },
      ],
      button: { label: "View booking", url: `${siteUrl()}/owner/bookings/${b.id}` },
    });
  });
}
