import "server-only";
import { db } from "@/lib/db";

export async function logDocumentAccess(entry: { documentId: string | null; listingId: string; userId: string; action: "UPLOAD" | "VIEW" | "APPROVE" | "REJECT" | "DELETE" }) {
  await db.documentAccessLog.create({ data: entry }).catch((e) => console.error("audit log failed", e));
}
