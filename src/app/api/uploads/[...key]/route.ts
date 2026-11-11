import { readLocalRange, statLocalFile, storageMode } from "@/lib/storage";
import { sniffImageType } from "@/lib/images";
import { sniffVideoType } from "@/lib/video";

/**
 * Serves locally stored photos and videos in development. In production files come from
 * Vercel Blob. Supports Range requests, which browsers (Safari especially) need to play video.
 */
export async function GET(req: Request, ctx: RouteContext<"/api/uploads/[...key]">) {
  if (storageMode() !== "local") return new Response("Not found", { status: 404 });
  const { key } = await ctx.params;
  const k = key.join("/");
  const size = await statLocalFile(k).catch(() => null);
  if (!size) return new Response("Not found", { status: 404 });

  const head = await readLocalRange(k, 0, Math.min(size, 16) - 1);
  const type = sniffImageType(head) ?? sniffVideoType(head);
  if (!type) return new Response("Not found", { status: 404 });

  const base = { "Content-Type": type, "Accept-Ranges": "bytes", "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" };
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
  if (range && (range[1] || range[2])) {
    let start = range[1] ? Number(range[1]) : size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : size - 1;
    start = Math.max(0, start);
    end = Math.min(end, size - 1);
    if (start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    const chunk = await readLocalRange(k, start, end);
    return new Response(new Uint8Array(chunk), { status: 206, headers: { ...base, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(chunk.length) } });
  }
  const all = await readLocalRange(k, 0, size - 1);
  return new Response(new Uint8Array(all), { headers: { ...base, "Content-Length": String(size) } });
}
