import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/dal";
import { readPrivateDocument } from "@/lib/storage";
import { logDocumentAccess } from "@/lib/document-access";

/**
 * Shows a verification document to the listing's owner or an admin only. Every view is logged.
 * Never cached, never indexed.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/documents/[id]">) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return new Response("Not found", { status: 404 });
  const doc = await db.listingDocument.findUnique({ where: { id }, include: { listing: { select: { ownerId: true } } } });
  const allowed = doc && (user.roles.includes("ADMIN") || (doc.listing.ownerId === user.id && user.roles.includes("OWNER")));
  if (!doc || !allowed) return new Response("Not found", { status: 404 });

  const body = await readPrivateDocument(doc.fileKey).catch(() => null);
  if (!body) return new Response("File unavailable", { status: 404 });
  await logDocumentAccess({ documentId: doc.id, listingId: doc.listingId, userId: user.id, action: "VIEW" });
  return new Response(body as BodyInit, {
    headers: {
      "Content-Type": doc.contentType,
      "Content-Disposition": `inline; filename="${doc.fileName.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow",
      "Referrer-Policy": "no-referrer",
    },
  });
}
