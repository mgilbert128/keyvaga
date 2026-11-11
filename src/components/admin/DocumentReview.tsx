import { reviewDocument } from "@/app/actions/documents";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Field";
import { DOC_INFO, currentDoc, isExpired, requiredDocuments, type DocType, type HostingRole } from "@/lib/documents";

const fmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

type DocRow = { id: string; type: DocType; fileName: string; status: "PENDING" | "APPROVED" | "REJECTED"; reviewNote: string | null; documentNumber: string; expiresAt: Date | null; createdAt: Date };

/** Admin view of a listing's verification documents with approve / ask-for-a-new-one buttons. */
export function DocumentReview({
  listing,
  docs,
  today,
  ownerName,
}: {
  listing: { id: string; hostingRole: HostingRole | null; managerCompany: string; permitRequired: boolean; permitNumber: string };
  docs: DocRow[];
  today: Date;
  ownerName: string;
}) {
  const required = requiredDocuments(listing.hostingRole, listing.permitRequired);
  return (
    <div className="flex flex-col gap-3 rounded-control border border-line p-4">
      <h3 className="font-bold">Proof of ownership</h3>
      <p className="text-sm text-ink-muted">
        {listing.hostingRole === "OWNER"
          ? `${ownerName} says they own this property.`
          : listing.hostingRole === "MANAGER"
            ? `${ownerName} manages it for the owner (${listing.managerCompany || "company not given"}).`
            : "The owner hasn't said whether they own or manage the property."}
        {listing.permitRequired ? ` Permit required${listing.permitNumber ? ` · listed permit no. ${listing.permitNumber}` : ""}.` : " No permit required (owner's answer)."}
      </p>
      {required.length === 0 ? <p className="text-sm font-medium text-danger">No documents yet.</p> : null}
      <ul className="flex flex-col gap-3">
        {required.map((type) => {
          const d = currentDoc(docs, type);
          const expired = d ? isExpired(d, today) : false;
          const chip = !d
            ? { t: "Missing", c: "bg-line" }
            : expired
              ? { t: "Expired", c: "bg-danger/10 text-danger" }
              : d.status === "APPROVED"
                ? { t: "Approved", c: "bg-soft text-on-soft" }
                : d.status === "REJECTED"
                  ? { t: "New one requested", c: "bg-danger/10 text-danger" }
                  : { t: "To review", c: "bg-warn-soft text-on-warn-soft" };
          return (
            <li key={type} className="flex flex-col gap-2 border-t border-line pt-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">{DOC_INFO[type].label}</span>
                <span className={`rounded-full px-3 py-1 text-sm font-semibold ${chip.c}`}>{chip.t}</span>
              </div>
              {d ? (
                <>
                  <p className="text-sm">
                    <a href={`/api/documents/${d.id}`} target="_blank" rel="noopener" className="font-semibold text-brand underline underline-offset-4">
                      Open {d.fileName}
                    </a>
                    {d.documentNumber ? ` · No. ${d.documentNumber}` : ""}
                    {d.expiresAt ? ` · expires ${fmt.format(d.expiresAt)}` : ""} · uploaded {fmt.format(d.createdAt)}
                  </p>
                  {d.status === "PENDING" ? (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                      <form action={reviewDocument.bind(null, d.id, "approve")}>
                        <Button type="submit" variant="secondary">Approve document</Button>
                      </form>
                      <form action={reviewDocument.bind(null, d.id, "reject")} className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-end">
                        <label className="sr-only" htmlFor={`docnote-${d.id}`}>Reason</label>
                        <input id={`docnote-${d.id}`} name="note" placeholder="Reason (e.g. name doesn't match, too blurry)" className={inputClass} maxLength={500} />
                        <Button type="submit" variant="ghost" className="text-danger">Ask for a new one</Button>
                      </form>
                    </div>
                  ) : d.status === "REJECTED" && d.reviewNote ? (
                    <p className="text-sm text-ink-muted">Asked for a new one: {d.reviewNote}</p>
                  ) : null}
                </>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
