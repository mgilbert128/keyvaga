"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/dal";
import { canEditListing, canReviewListings } from "@/lib/listing-policy";
import { deletePrivateDocument } from "@/lib/storage";
import { logDocumentAccess } from "@/lib/document-access";

export type DocResult = { ok?: boolean; message?: string } | undefined;

async function ownerListing(listingId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const listing = await db.listing.findUnique({ where: { id: listingId }, select: { id: true, ownerId: true, slug: true } });
  if (!listing || !canEditListing(user, listing)) throw new Error("Listing not found");
  return { user, listing };
}

/** "I own this property" vs "I manage it", plus the local permit details. */
export async function saveHostingDetails(listingId: string, _prev: DocResult, fd: FormData): Promise<DocResult> {
  const { listing } = await ownerListing(listingId);
  const role = String(fd.get("hostingRole") ?? "");
  if (role !== "OWNER" && role !== "MANAGER") return { message: "Choose whether you own or manage this property." };
  const managerCompany = String(fd.get("managerCompany") ?? "").trim().slice(0, 120);
  if (role === "MANAGER" && !managerCompany) return { message: "Enter your management company's name." };
  const permitRequired = fd.get("permitRequired") === "on";
  const permitNumber = String(fd.get("permitNumber") ?? "").trim().slice(0, 60);
  await db.listing.update({ where: { id: listing.id }, data: { hostingRole: role, managerCompany: role === "MANAGER" ? managerCompany : "", permitRequired, permitNumber: permitRequired ? permitNumber : "" } });
  revalidatePath(`/owner/listings/${listing.id}`);
  revalidatePath(`/stays/${listing.slug}`);
  return { ok: true, message: "Saved." };
}

/** Owners can remove documents that haven't been approved (e.g. to replace a wrong upload). */
export async function deleteDocument(listingId: string, documentId: string) {
  const { user, listing } = await ownerListing(listingId);
  const doc = await db.listingDocument.findFirst({ where: { id: documentId, listingId: listing.id } });
  if (!doc || doc.status === "APPROVED") return;
  await db.listingDocument.delete({ where: { id: doc.id } });
  await deletePrivateDocument(doc.fileKey);
  await logDocumentAccess({ documentId: null, listingId: listing.id, userId: user.id, action: "DELETE" });
  revalidatePath(`/owner/listings/${listing.id}`);
  revalidatePath("/admin");
}

/** Admin approves or rejects one document (with a note the owner sees). */
export async function reviewDocument(documentId: string, action: "approve" | "reject", fd: FormData) {
  const user = await getCurrentUser();
  if (!user || !canReviewListings(user)) redirect("/no-access?portal=admin");
  const doc = await db.listingDocument.findUnique({ where: { id: documentId }, include: { listing: { select: { slug: true } } } });
  if (!doc) return;
  const note = String(fd.get("note") ?? "").trim().slice(0, 500);
  await db.listingDocument.update({
    where: { id: doc.id },
    data: {
      status: action === "approve" ? "APPROVED" : "REJECTED",
      reviewNote: action === "reject" ? note || "Please upload a clearer or more recent document." : null,
      reviewedById: user.id,
      reviewedAt: new Date(),
    },
  });
  await logDocumentAccess({ documentId: doc.id, listingId: doc.listingId, userId: user.id, action: action === "approve" ? "APPROVE" : "REJECT" });
  revalidatePath("/admin");
  revalidatePath(`/owner/listings/${doc.listingId}`);
  revalidatePath(`/stays/${doc.listing.slug}`);
}
