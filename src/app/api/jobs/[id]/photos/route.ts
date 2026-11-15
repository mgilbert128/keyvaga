import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/dal";
import { putPrivateDocument } from "@/lib/storage";
import { MAX_UPLOAD_BYTES, sniffImageType } from "@/lib/images";
import { MAX_JOB_PHOTOS } from "@/lib/checklist";

const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;

/** The hired provider uploads a proof-of-work photo while the job is in progress. Stored privately. */
export async function POST(request: Request, ctx: RouteContext<"/api/jobs/[id]/photos">) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user || !user.roles.includes("PROVIDER")) return NextResponse.json({ error: "Please log in again." }, { status: 401 });
  const job = await db.job.findUnique({ where: { id }, select: { id: true, status: true, acceptedQuote: { select: { provider: { select: { userId: true } } } }, _count: { select: { photos: true } } } });
  if (!job || job.acceptedQuote?.provider.userId !== user.id) return NextResponse.json({ error: "Job not found." }, { status: 404 });
  if (job.status !== "ASSIGNED") return NextResponse.json({ error: "Photos can be added while the job is in progress." }, { status: 400 });
  if (job._count.photos >= MAX_JOB_PHOTOS) return NextResponse.json({ error: `You can add up to ${MAX_JOB_PHOTOS} photos.` }, { status: 400 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No photo received." }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "That photo is too large (max 4 MB)." }, { status: 413 });
  const bytes = Buffer.from(await file.arrayBuffer());
  const type = sniffImageType(bytes);
  if (!type) return NextResponse.json({ error: "Use a JPEG, PNG or WebP photo." }, { status: 415 });
  const caption = String(form?.get("caption") ?? "").trim().slice(0, 120);
  try {
    const fileKey = await putPrivateDocument(`job-photos/${job.id}/${crypto.randomUUID()}.${EXT[type]}`, bytes, type);
    await db.jobPhoto.create({ data: { jobId: job.id, uploaderId: user.id, fileKey, contentType: type, caption } });
    revalidatePath(`/provider/jobs/${job.id}`);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    console.error("job photo upload failed", e);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}
