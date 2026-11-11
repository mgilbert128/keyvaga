import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/dal";
import { canEditListing } from "@/lib/listing-policy";
import { putLocalFile, storageMode } from "@/lib/storage";
import { VIDEO_MAX_BYTES, VIDEO_TYPES, sniffVideoType, videoPathPrefix } from "@/lib/video";

/** Development only: receives the video file directly when no cloud storage is connected. */
export async function POST(request: Request, ctx: RouteContext<"/api/listings/[id]/video/local">) {
  const { id } = await ctx.params;
  if (storageMode() !== "local") return NextResponse.json({ error: "Not available." }, { status: 404 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please log in again." }, { status: 401 });
  const listing = await db.listing.findUnique({ where: { id }, select: { ownerId: true } });
  if (!listing || !canEditListing(user, listing)) return NextResponse.json({ error: "Listing not found." }, { status: 404 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No video received." }, { status: 400 });
  if (file.size > VIDEO_MAX_BYTES) return NextResponse.json({ error: "That video is too large (max 100 MB)." }, { status: 413 });
  const bytes = Buffer.from(await file.arrayBuffer());
  const type = sniffVideoType(bytes);
  if (!type) return NextResponse.json({ error: "Use an MP4, MOV or WebM video." }, { status: 415 });

  const pathname = `${videoPathPrefix(id)}${crypto.randomUUID()}.${VIDEO_TYPES[type]}`;
  const url = await putLocalFile(pathname, bytes);
  return NextResponse.json({ pathname, url, contentType: type, access: "local" });
}
