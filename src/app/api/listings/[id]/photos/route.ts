import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/dal";
import { canEditListing } from "@/lib/listing-policy";
import { putImage } from "@/lib/storage";
import { MAX_PHOTOS_PER_LISTING, MAX_UPLOAD_BYTES, sniffImageType } from "@/lib/images";

const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;

export async function POST(request: Request, ctx: RouteContext<"/api/listings/[id]/photos">) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please log in again." }, { status: 401 });

  const listing = await db.listing.findUnique({ where: { id }, select: { id: true, ownerId: true, slug: true, title: true, _count: { select: { photos: true } } } });
  if (!listing || !canEditListing(user, listing)) {
    return NextResponse.json({ error: "Listing not found." }, { status: 404 });
  }
  if (listing._count.photos >= MAX_PHOTOS_PER_LISTING) {
    return NextResponse.json({ error: `You can add up to ${MAX_PHOTOS_PER_LISTING} photos.` }, { status: 400 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No photo received." }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "That photo is too large (max 4 MB)." }, { status: 413 });

  const bytes = Buffer.from(await file.arrayBuffer());
  const type = sniffImageType(bytes);
  if (!type) return NextResponse.json({ error: "Use a JPEG, PNG or WebP photo." }, { status: 415 });

  const width = clampDim(form?.get("width"));
  const height = clampDim(form?.get("height"));

  try {
    const key = `listings/${listing.id}/${crypto.randomUUID()}.${EXT[type]}`;
    const stored = await putImage(key, bytes, type);
    const last = await db.listingPhoto.findFirst({ where: { listingId: id }, orderBy: { position: "desc" }, select: { position: true } });
    const photo = await db.listingPhoto.create({
      data: {
        listingId: id,
        url: stored.url,
        storageKey: stored.storageKey,
        width,
        height,
        alt: `${listing.title} photo`,
        position: (last?.position ?? -1) + 1,
      },
    });
    revalidatePath(`/owner/listings/${id}`);
    revalidatePath(`/stays/${listing.slug}`);
    return NextResponse.json({ photo: { id: photo.id, url: photo.url } }, { status: 201 });
  } catch (e) {
    console.error("photo upload failed", e);
    return NextResponse.json({ error: e instanceof Error && e.message.includes("not configured") ? e.message : "Upload failed. Please try again." }, { status: 500 });
  }
}

function clampDim(v: FormDataEntryValue | null | undefined): number {
  const n = Number.parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) && n > 0 && n <= 20000 ? n : 0;
}
