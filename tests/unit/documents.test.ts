import { describe, expect, it } from "vitest";
import { currentDoc, documentsApproved, expiresSoon, isExpired, missingDocuments, requiredDocuments, sniffDocumentType, type DocLike } from "@/lib/documents";
import { parseISODate } from "@/lib/dates";

const d = (s: string) => parseISODate(s)!;
const today = d("2026-11-11");
const doc = (type: DocLike["type"], status: DocLike["status"], extra: Partial<DocLike> = {}): DocLike => ({ type, status, expiresAt: null, createdAt: d("2026-11-01"), ...extra });

describe("required documents", () => {
  it("depends on owner vs manager and the permit setting", () => {
    expect(requiredDocuments("OWNER", false)).toEqual(["OWNERSHIP_PROOF"]);
    expect(requiredDocuments("OWNER", true)).toEqual(["OWNERSHIP_PROOF", "RENTAL_PERMIT"]);
    expect(requiredDocuments("MANAGER", false)).toEqual(["MANAGEMENT_LICENSE", "MANAGEMENT_AGREEMENT"]);
    expect(requiredDocuments("MANAGER", true)).toEqual(["MANAGEMENT_LICENSE", "MANAGEMENT_AGREEMENT", "RENTAL_PERMIT"]);
    expect(requiredDocuments(null, true)).toEqual([]);
  });
});

describe("missing and approved", () => {
  it("asks for the role first, then each document", () => {
    expect(missingDocuments(null, false, [], today)).toEqual(["whether you own or manage the property"]);
    expect(missingDocuments("OWNER", true, [], today)).toEqual(["proof of ownership", "short-term rental license or permit"]);
    expect(missingDocuments("OWNER", false, [doc("OWNERSHIP_PROOF", "PENDING")], today)).toEqual([]);
  });
  it("treats rejected and expired documents as missing", () => {
    expect(missingDocuments("OWNER", false, [doc("OWNERSHIP_PROOF", "REJECTED")], today)).toEqual(["proof of ownership"]);
    expect(missingDocuments("OWNER", true, [doc("OWNERSHIP_PROOF", "APPROVED"), doc("RENTAL_PERMIT", "APPROVED", { expiresAt: d("2026-11-10") })], today)).toEqual(["short-term rental license or permit"]);
  });
  it("uses the newest non-rejected upload", () => {
    const docs = [doc("OWNERSHIP_PROOF", "REJECTED", { createdAt: d("2026-11-05") }), doc("OWNERSHIP_PROOF", "PENDING", { createdAt: d("2026-11-02") })];
    expect(currentDoc(docs, "OWNERSHIP_PROOF")?.status).toBe("PENDING");
  });
  it("is approved only when every required document is approved and in date", () => {
    expect(documentsApproved("MANAGER", false, [doc("MANAGEMENT_LICENSE", "APPROVED"), doc("MANAGEMENT_AGREEMENT", "PENDING")], today)).toBe(false);
    expect(documentsApproved("MANAGER", false, [doc("MANAGEMENT_LICENSE", "APPROVED"), doc("MANAGEMENT_AGREEMENT", "APPROVED")], today)).toBe(true);
    expect(documentsApproved("OWNER", false, [], today)).toBe(false);
    expect(documentsApproved(null, false, [], today)).toBe(false);
  });
  it("flags expiry", () => {
    expect(isExpired({ expiresAt: d("2026-11-10") }, today)).toBe(true);
    expect(isExpired({ expiresAt: d("2026-11-11") }, today)).toBe(false);
    expect(expiresSoon({ expiresAt: d("2026-12-01") }, today)).toBe(true);
    expect(expiresSoon({ expiresAt: d("2027-03-01") }, today)).toBe(false);
  });
});

describe("document file types", () => {
  it("accepts PDFs and photos only", () => {
    expect(sniffDocumentType(new TextEncoder().encode("%PDF-1.7\n"))).toBe("application/pdf");
    expect(sniffDocumentType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffDocumentType(new TextEncoder().encode("<html><script>"))).toBeNull();
    expect(sniffDocumentType(new TextEncoder().encode("PK\u0003\u0004"))).toBeNull(); // zip/docx
  });
});
