import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/dal";
import { canEditListing } from "@/lib/listing-policy";
import { putPrivateDocument } from "@/lib/storage";
import { logDocumentAccess } from "@/lib/document-access";
import { DOC_INFO, DOC_MAX_BYTES, sniffDocumentType, type DocType } from "@/lib/documents";
import { parseISODate, todayIn } from "@/lib/dates";

const EXT = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;

/** Owner uploads a verification document for one of their listings. Stored privately; status starts PENDING. */
export async function POST(request: Request, ctx: RouteContext<"/api/listings/[id]/documents">) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please log in again." }, { status: 401 });
  const listing = await db.listing.findUnique({ where: { id }, select: { id: true, ownerId: true } });
  if (!listing || !canEditListing(user, listing)) return NextResponse.json({ error: "Listing not found." }, { status: 404 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const type = String(form?.get("type") ?? "") as DocType;
  if (!(type in DOC_INFO)) return NextResponse.json({ error: "Unknown document type." }, { status: 400 });
  if (!(file instanceof File)) return NextResponse.json({ error: "No file received." }, { status: 400 });
  if (file.size > DOC_MAX_BYTES) return NextResponse.json({ error: "That file is too large (max 4 MB). Try a photo or a smaller PDF." }, { status: 413 });

  const info = DOC_INFO[type];
  const documentNumber = String(form?.get("documentNumber") ?? "").trim().slice(0, 60);
  const expiresRaw = String(form?.get("expiresAt") ?? "");
  const expiresAt = expiresRaw ? parseISODate(expiresRaw) : null;
  if (info.needsNumber && !documentNumber) return NextResponse.json({ error: "Enter the license or permit number." }, { status: 400 });
  if (info.needsExpiry && !expiresAt) return NextResponse.json({ error: "Enter the expiration date." }, { status: 400 });
  if (expiresAt && expiresAt < todayIn()) return NextResponse.json({ error: "That document has already expired." }, { status: 400 });

  const bytes = Buffer.from(await file.arrayBuffer());
  const contentType = sniffDocumentType(bytes);
  if (!contentType) return NextResponse.json({ error: "Upload a PDF or a photo (JPEG or PNG)." }, { status: 415 });

  try {
    const fileKey = await putPrivateDocument(`documents/${listing.id}/${crypto.randomUUID()}.${EXT[contentType]}`, bytes, contentType);
    const doc = await db.listingDocument.create({
      data: {
        listingId: listing.id,
        type,
        fileKey,
        fileName: (file.name || `document.${EXT[contentType]}`).replace(/[^\w.\- ]+/g, "_").slice(0, 100),
        contentType,
        sizeBytes: bytes.length,
        documentNumber,
        expiresAt,
        uploadedById: user.id,
      },
    });
    await logDocumentAccess({ documentId: doc.id, listingId: listing.id, userId: user.id, action: "UPLOAD" });
    revalidatePath(`/owner/listings/${listing.id}`);
    revalidatePath("/admin");
    return NextResponse.json({ ok: true, id: doc.id }, { status: 201 });
  } catch (e) {
    console.error("document upload failed", e);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}
