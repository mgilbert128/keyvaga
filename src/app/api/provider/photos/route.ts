import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/dal";
import { getOrCreateProfile } from "@/lib/providers";
import { putImage } from "@/lib/storage";
import { MAX_UPLOAD_BYTES, sniffImageType } from "@/lib/images";

const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;
const MAX_PHOTOS = 12;

/** Provider uploads a photo of their work/logo/team for their business profile. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !user.roles.includes("PROVIDER")) return NextResponse.json({ error: "Please log in again." }, { status: 401 });
  const profile = await getOrCreateProfile(user);
  if (profile.photos.length >= MAX_PHOTOS) return NextResponse.json({ error: `You can add up to ${MAX_PHOTOS} photos.` }, { status: 400 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No photo received." }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "That photo is too large (max 4 MB)." }, { status: 413 });
  const bytes = Buffer.from(await file.arrayBuffer());
  const type = sniffImageType(bytes);
  if (!type) return NextResponse.json({ error: "Use a JPEG, PNG or WebP photo." }, { status: 415 });
  const dim = (k: string) => { const n = Number.parseInt(String(form?.get(k) ?? ""), 10); return Number.isFinite(n) && n > 0 && n <= 20000 ? n : 0; };
  try {
    const stored = await putImage(`providers/${profile.id}/${crypto.randomUUID()}.${EXT[type]}`, bytes, type);
    await db.providerPhoto.create({ data: { providerId: profile.id, url: stored.url, storageKey: stored.storageKey, width: dim("width"), height: dim("height"), position: profile.photos.length } });
    revalidatePath("/provider/profile");
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    console.error("provider photo upload failed", e);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}
