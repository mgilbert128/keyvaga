/**
 * Shown on every page until Stripe is switched to live keys, so visitors know nothing is real yet.
 * Set KEYVAGA_PREVIEW_BANNER=off to hide it.
 */
export function PreviewBanner() {
  const live = process.env.STRIPE_SECRET_KEY?.startsWith("sk_live");
  if (live || process.env.KEYVAGA_PREVIEW_BANNER === "off") return null;
  return (
    <div role="note" className="bg-ink px-4 py-2.5 text-center text-sm text-surface">
      <strong className="font-semibold">Preview:</strong> this is an early test version of Keyvaga. No real bookings or payments happen. To try checkout, use test card 4242 4242 4242 4242. We&apos;d love your feedback!
    </div>
  );
}
