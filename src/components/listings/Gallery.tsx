import { tintFor } from "@/lib/tint";

type Photo = { id: string; url: string; alt: string };

export function Gallery({ photos, title, slug }: { photos: Photo[]; title: string; slug: string }) {
  if (photos.length === 0) {
    return <div className={`aspect-[21/9] w-full rounded-card ${tintFor(slug)}`} role="img" aria-label={`No photos yet for ${title}`} />;
  }
  const [cover, ...rest] = photos;
  // Mosaic adapts to how many photos exist: 1 = full width, 2 = cover + one tall side photo,
  // 3+ = cover + two stacked side photos. No empty cells.
  const thumbs = rest.slice(0, 2);
  return (
    <div className="flex flex-col gap-3">
      <div className={`grid gap-2 ${thumbs.length ? "md:h-[28rem] md:grid-cols-3 md:grid-rows-[repeat(2,minmax(0,1fr))]" : ""}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cover!.url} alt={cover!.alt || title} className={`aspect-[16/10] h-full w-full rounded-card object-cover ${thumbs.length ? "md:col-span-2 md:row-span-2 md:aspect-auto md:min-h-0" : "md:aspect-auto md:h-[28rem]"}`} />
        {thumbs.map((p) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={p.id} src={p.url} alt={p.alt || title} className={`hidden h-full min-h-0 w-full rounded-xl object-cover md:block ${thumbs.length === 1 ? "md:row-span-2" : ""}`} loading="lazy" />
        ))}
      </div>
      {photos.length > 1 ? (
        <details className="group">
          <summary className="inline-flex min-h-11 cursor-pointer list-none items-center rounded-control border-2 border-brand px-5 font-semibold text-brand hover:bg-soft [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">Show all {photos.length} photos</span>
            <span className="hidden group-open:inline">Hide photos</span>
          </summary>
          <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {photos.map((p) => (
              <li key={p.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.alt || title} className="w-full rounded-xl object-cover" loading="lazy" />
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
