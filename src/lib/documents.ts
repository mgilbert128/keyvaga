/**
 * Proof-of-right-to-rent rules. Pure functions (no DB) so they can be tested and reused in the UI.
 */
import { addDays } from "./dates";

export type HostingRole = "OWNER" | "MANAGER";
export type DocType = "OWNERSHIP_PROOF" | "RENTAL_PERMIT" | "MANAGEMENT_LICENSE" | "MANAGEMENT_AGREEMENT";
export type DocStatus = "PENDING" | "APPROVED" | "REJECTED";

export const DOC_INFO: Record<DocType, { label: string; help: string; needsNumber: boolean; needsExpiry: boolean }> = {
  OWNERSHIP_PROOF: {
    label: "Proof of ownership",
    help: "A deed, recent property tax bill or utility bill showing your name and the property address.",
    needsNumber: false,
    needsExpiry: false,
  },
  RENTAL_PERMIT: {
    label: "Short-term rental license or permit",
    help: "The license or permit your city or county issued for this property.",
    needsNumber: true,
    needsExpiry: true,
  },
  MANAGEMENT_LICENSE: {
    label: "Property management license",
    help: "Your company's property management or real estate license.",
    needsNumber: true,
    needsExpiry: true,
  },
  MANAGEMENT_AGREEMENT: {
    label: "Management agreement",
    help: "Your agreement with the owner, or the owner's written authorization for you to rent out this property.",
    needsNumber: false,
    needsExpiry: false,
  },
};

/** Which documents a listing needs before it can be submitted. */
export function requiredDocuments(role: HostingRole | null | undefined, permitRequired: boolean): DocType[] {
  if (!role) return [];
  const docs: DocType[] = role === "OWNER" ? ["OWNERSHIP_PROOF"] : ["MANAGEMENT_LICENSE", "MANAGEMENT_AGREEMENT"];
  if (permitRequired) docs.push("RENTAL_PERMIT");
  return docs;
}

export type DocLike = { type: DocType; status: DocStatus; expiresAt: Date | null; createdAt: Date };

/** The document that currently counts for a type: the newest one that wasn't rejected (else the newest). */
export function currentDoc<T extends DocLike>(docs: T[], type: DocType): T | null {
  const ofType = docs.filter((d) => d.type === type).sort((a, b) => +b.createdAt - +a.createdAt);
  return ofType.find((d) => d.status !== "REJECTED") ?? ofType[0] ?? null;
}

export function isExpired(d: { expiresAt: Date | null }, today: Date): boolean {
  return Boolean(d.expiresAt && d.expiresAt < today);
}

export function expiresSoon(d: { expiresAt: Date | null }, today: Date, days = 30): boolean {
  return Boolean(d.expiresAt && d.expiresAt >= today && d.expiresAt <= addDays(today, days));
}

/** Missing items before the owner can submit: role chosen and every required document uploaded (not rejected, not expired). */
export function missingDocuments(role: HostingRole | null | undefined, permitRequired: boolean, docs: DocLike[], today: Date): string[] {
  if (!role) return ["whether you own or manage the property"];
  const missing: string[] = [];
  for (const type of requiredDocuments(role, permitRequired)) {
    const d = currentDoc(docs, type);
    if (!d || d.status === "REJECTED" || isExpired(d, today)) missing.push(DOC_INFO[type].label.toLowerCase());
  }
  return missing;
}

/** Everything required is approved and in date: the admin may publish. */
export function documentsApproved(role: HostingRole | null | undefined, permitRequired: boolean, docs: DocLike[], today: Date): boolean {
  const required = requiredDocuments(role, permitRequired);
  if (!role || required.length === 0) return false;
  return required.every((type) => {
    const d = currentDoc(docs, type);
    return d?.status === "APPROVED" && !isExpired(d, today);
  });
}

export const DOC_MAX_BYTES = 4 * 1024 * 1024; // under Vercel's 4.5 MB request limit

/** PDFs and photos only, detected from the file's bytes. */
export function sniffDocumentType(bytes: Uint8Array): "application/pdf" | "image/jpeg" | "image/png" | "image/webp" | null {
  if (bytes.length >= 5 && String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-") return "application/pdf";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b)) return "image/png";
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}
