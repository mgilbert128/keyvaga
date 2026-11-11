import type { ListingStatus } from "@/generated/prisma/enums";
import { STATUS_LABEL } from "@/lib/listing-policy";

const tone: Record<ListingStatus, string> = {
  DRAFT: "bg-line text-ink",
  PENDING_REVIEW: "bg-warn-soft text-on-warn-soft",
  PUBLISHED: "bg-soft text-on-soft",
  PAUSED: "bg-line text-ink",
};

export function StatusChip({ status }: { status: ListingStatus }) {
  return <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${tone[status]}`}>{STATUS_LABEL[status]}</span>;
}
