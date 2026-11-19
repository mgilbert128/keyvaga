import { ActionForm } from "@/components/owner/ActionForm";
import { SelectField } from "@/components/ui/Select";
import { Field } from "@/components/ui/Field";
import { submitExternalRating, removeExternalRating } from "@/app/actions/external-ratings";
import { PLATFORMS, PLATFORM_KEYS, RATING_VALID_DAYS, isPlatform } from "@/lib/external-ratings";

type Row = { id: string; platform: string; url: string; rating: number; reviewCount: number; status: string; reviewNote: string | null; verifiedAt: Date | null };
const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/** Listing editor: show your verified rating from Airbnb, Vrbo and others while Keyvaga reviews build up. */
export function ExternalRatingsSection({ listingId, ratings, now }: { listingId: string; ratings: Row[]; now: Date }) {
  return (
    <section id="outside-ratings" aria-labelledby="outside-ratings-title" className="scroll-mt-24 flex flex-col gap-4 rounded-card border border-line bg-surface p-6 sm:p-8">
      <div>
        <h2 id="outside-ratings-title" className="text-xl font-bold">Ratings from other sites</h2>
        <p className="mt-1 text-ink-muted">
          New to Keyvaga? Show guests your overall rating from Airbnb, Vrbo, Booking.com or Google. Keyvaga checks the link before it appears,
          and it shows separately from Keyvaga reviews. Ratings stay up for {Math.round(RATING_VALID_DAYS / 30)} months, then you confirm them again.
        </p>
      </div>
      {ratings.length ? (
        <ul className="flex flex-col divide-y divide-line">
          {ratings.map((r) => {
            const p = isPlatform(r.platform) ? PLATFORMS[r.platform] : null;
            const expired = r.status === "APPROVED" && r.verifiedAt && now.getTime() - r.verifiedAt.getTime() > RATING_VALID_DAYS * 86_400_000;
            return (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="flex flex-col">
                  <span className="font-semibold">{p?.label ?? r.platform}: {r.rating} / {p?.scale ?? 5} · {r.reviewCount.toLocaleString()} reviews</span>
                  <span className="text-sm text-ink-muted">
                    {expired ? "Expired. Update it to show it again." : r.status === "APPROVED" ? `Verified ${r.verifiedAt ? dateFmt.format(r.verifiedAt) : ""}, showing on your listing` : r.status === "PENDING" ? "Waiting for Keyvaga to verify" : `Not verified: ${r.reviewNote ?? ""}`}
                  </span>
                </div>
                <form action={removeExternalRating.bind(null, listingId, r.platform)}>
                  <button type="submit" className="min-h-11 text-sm font-semibold text-danger underline underline-offset-4">Remove</button>
                </form>
              </li>
            );
          })}
        </ul>
      ) : null}
      <ActionForm action={submitExternalRating.bind(null, listingId)} submitLabel="Send for verification" resetOnSuccess>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SelectField label="Site" id="platform" defaultValue="AIRBNB">
            {PLATFORM_KEYS.map((k) => <option key={k} value={k}>{PLATFORMS[k].label}</option>)}
          </SelectField>
          <Field label="Rating shown there" id="rating" inputMode="decimal" placeholder="4.9" required />
          <Field label="Number of reviews" id="reviewCount" type="number" min={1} inputMode="numeric" placeholder="230" required />
        </div>
        <Field label="Link to this property on that site" id="url" type="url" placeholder="https://www.airbnb.com/rooms/…" required hint="We open it to confirm it's this property and the numbers match." />
      </ActionForm>
    </section>
  );
}
