import { NextResponse } from "next/server";
import { handleUploadPresigned, type HandleUploadPresignedBody } from "@vercel/blob/client";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/dal";
import { canEditListing } from "@/lib/listing-policy";
import { issueUploadToken, storageMode } from "@/lib/storage";
import { VIDEO_MAX_BYTES, VIDEO_TYPES, isVideoPathForListing } from "@/lib/video";

/**
 * Gives the owner's browser a short-lived permission to upload ONE video straight to
 * Vercel Blob, into this listing's folder only. The video never passes through our server,
 * which avoids the 4.5 MB request limit.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/listings/[id]/video/upload">) {
  const { id } = await ctx.params;
  if (storageMode() !== "blob") return NextResponse.json({ error: "Video storage is not configured." }, { status: 400 });

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please log in again." }, { status: 401 });
  const listing = await db.listing.findUnique({ where: { id }, select: { ownerId: true } });
  if (!listing || !canEditListing(user, listing)) return NextResponse.json({ error: "Listing not found." }, { status: 404 });

  const body = (await request.json().catch(() => null)) as HandleUploadPresignedBody | null;
  if (!body) return NextResponse.json({ error: "Bad request." }, { status: 400 });

  try {
    const result = await handleUploadPresigned({
      body,
      request,
      getSignedToken: async (pathname) => {
        if (!isVideoPathForListing(pathname, id)) throw new Error("Invalid upload path");
        const allowedContentTypes = Object.keys(VIDEO_TYPES);
        const token = await issueUploadToken(pathname, { allowedContentTypes, maximumSizeInBytes: VIDEO_MAX_BYTES });
        return { token, urlOptions: { allowedContentTypes, maximumSizeInBytes: VIDEO_MAX_BYTES, addRandomSuffix: false, allowOverwrite: false } };
      },
    });
    return NextResponse.json(result);
  } catch (e) {
    console.error("video upload token failed", e);
    return NextResponse.json({ error: "Couldn't start the upload. Please try again." }, { status: 400 });
  }
}
