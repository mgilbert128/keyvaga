import { ActionForm } from "@/components/owner/ActionForm";
import { DocumentSlot } from "@/components/owner/DocumentSlot";
import { Field } from "@/components/ui/Field";
import { saveHostingDetails } from "@/app/actions/documents";
import { DOC_INFO, currentDoc, expiresSoon, isExpired, requiredDocuments, type DocType, type HostingRole } from "@/lib/documents";

const fmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

type DocRow = { id: string; type: DocType; fileName: string; status: "PENDING" | "APPROVED" | "REJECTED"; reviewNote: string | null; documentNumber: string; expiresAt: Date | null; createdAt: Date };

/** Owner-facing "Proof of ownership" section on the listing editor. */
export function OwnershipSection({
  listing, docs, today,
}: {
  listing: { id: string; hostingRole: HostingRole | null; managerCompany: string; permitRequired: boolean; permitNumber: string };
  docs: DocRow[];
  today: Date;
}) {
  const required = requiredDocuments(listing.hostingRole, listing.permitRequired);
  return (
    <section aria-labelledby="ownership-title" className="flex flex-col gap-5 rounded-card border border-line bg-surface p-6 sm:p-8">
      <div>
        <h2 id="ownership-title" className="text-xl font-bold">Proof of ownership</h2>
        <p className="mt-1 text-ink-muted">
          To keep guests safe, Keyvaga checks that every host has the right to rent their property. Documents are private: only you and Keyvaga&apos;s review team can see them.
        </p>
      </div>

      <ActionForm action={saveHostingDetails.bind(null, listing.id)} submitLabel="Save">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-semibold">Who are you to this property?</legend>
          {[
            { v: "OWNER", t: "I own this property", d: "You'll upload proof of ownership." },
            { v: "MANAGER", t: "I manage it for the owner", d: "You'll upload your management license and your agreement with the owner." },
          ].map((o) => (
            <label key={o.v} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-control border border-line px-4 py-3 has-[:checked]:border-brand has-[:checked]:bg-soft">
              <input type="radio" name="hostingRole" value={o.v} defaultChecked={listing.hostingRole === o.v} className="mt-1 h-5 w-5 accent-[var(--kv-brand)]" required />
              <span className="flex flex-col"><span className="font-semibold">{o.t}</span><span className="text-sm text-ink-muted">{o.d}</span></span>
            </label>
          ))}
        </fieldset>
        <Field label="Management company name (managers only)" id="managerCompany" maxLength={120} defaultValue={listing.managerCompany} />
        <label className="flex min-h-11 cursor-pointer items-center gap-3">
          <input type="checkbox" name="permitRequired" defaultChecked={listing.permitRequired} className="h-5 w-5 accent-[var(--kv-brand)]" />
          <span>My city or county requires a short-term rental license or permit</span>
        </label>
        <Field label="Permit number (shown on your listing once approved)" id="permitNumber" maxLength={60} defaultValue={listing.permitNumber} />
      </ActionForm>

      {required.length ? (
        <div className="flex flex-col gap-3 border-t border-line pt-5">
          <h3 className="font-semibold">Documents</h3>
          {required.map((type) => {
            const d = currentDoc(docs, type);
            return (
              <DocumentSlot
                key={type}
                listingId={listing.id}
                type={type}
                label={DOC_INFO[type].label}
                help={DOC_INFO[type].help}
                needsNumber={DOC_INFO[type].needsNumber}
                needsExpiry={DOC_INFO[type].needsExpiry}
                defaultNumber={type === "RENTAL_PERMIT" ? listing.permitNumber : undefined}
                doc={
                  d
                    ? {
                        id: d.id, fileName: d.fileName, status: d.status, reviewNote: d.reviewNote, documentNumber: d.documentNumber,
                        expiresAt: d.expiresAt ? fmt.format(d.expiresAt) : null, expired: isExpired(d, today), expiringSoon: expiresSoon(d, today), uploadedAt: fmt.format(d.createdAt),
                      }
                    : null
                }
              />
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
