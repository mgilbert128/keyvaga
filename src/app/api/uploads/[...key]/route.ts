import { readLocalImage, storageMode } from "@/lib/storage";
import { sniffImageType } from "@/lib/images";

/** Serves locally stored photos in development. In production photos come straight from Vercel Blob. */
export async function GET(_req: Request, ctx: RouteContext<"/api/uploads/[...key]">) {
  if (storageMode() !== "local") return new Response("Not found", { status: 404 });
  const { key } = await ctx.params;
  const data = await readLocalImage(key.join("/")).catch(() => null);
  if (!data) return new Response("Not found", { status: 404 });
  const type = sniffImageType(data);
  if (!type) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(data), { headers: { "Content-Type": type, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" } });
}
