import { getPrivateBlob } from "@/lib/storage";

/**
 * Serves listing photos from a private Vercel Blob store. Listing photos are public
 * content (shown on stay pages), so no login is needed, but only the public folders (listing and provider photos)
 * are served. Private files (verification documents, job proof photos) live elsewhere and have their own checked routes.
 */
const PUBLIC_FOLDERS = ["listings", "providers"];

export async function GET(_req: Request, ctx: RouteContext<"/api/photos/[...path]">) {
  const { path } = await ctx.params;
  if (!PUBLIC_FOLDERS.includes(path[0] ?? "") || path.some((p) => p === ".." || p === "." || p === "")) return new Response("Not found", { status: 404 });
  const result = await getPrivateBlob(path.join("/")).catch(() => null);
  if (!result) return new Response("Not found", { status: 404 });
  const type = result.blob.contentType ?? "application/octet-stream";
  if (!/^image\/(jpeg|png|webp)$/.test(type)) return new Response("Not found", { status: 404 });
  return new Response(result.stream, {
    headers: {
      "Content-Type": type,
      // File names include a random suffix and never change, so they can be cached for a long time.
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
