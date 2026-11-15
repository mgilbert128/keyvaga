import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/dal";
import { readPrivateDocument } from "@/lib/storage";
import { canSeeJobPhotos } from "@/lib/jobs";

/** Proof-of-work photo, shown only to the job's owner, the hired provider and admins. */
export async function GET(_req: Request, ctx: RouteContext<"/api/job-photos/[id]">) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return new Response("Not found", { status: 404 });
  const photo = await db.jobPhoto.findUnique({ where: { id } });
  if (!photo || !(await canSeeJobPhotos(user, photo.jobId))) return new Response("Not found", { status: 404 });
  const body = await readPrivateDocument(photo.fileKey).catch(() => null);
  if (!body) return new Response("File unavailable", { status: 404 });
  return new Response(body as BodyInit, {
    headers: { "Content-Type": photo.contentType, "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex, nofollow" },
  });
}
