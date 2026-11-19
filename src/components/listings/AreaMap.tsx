/**
 * Approximate area map (OpenStreetMap embed, no API key). Shows a roughly 5 km box around a rounded point with no pin,
 * so guests see the neighborhood but not the home; the exact address is shared after booking.
 */
export function AreaMap({ latitude, longitude, label }: { latitude: number; longitude: number; label: string }) {
  const lat = Math.round(latitude * 100) / 100;
  const lon = Math.round(longitude * 100) / 100;
  const dLat = 0.025;
  const dLon = 0.025 / Math.max(0.2, Math.cos((lat * Math.PI) / 180));
  const bbox = [lon - dLon, lat - dLat, lon + dLon, lat + dLat].map((n) => n.toFixed(4)).join(",");
  return (
    <div className="flex flex-col gap-2">
      <div className="relative overflow-hidden rounded-card border border-line">
        <iframe
          title={`Map of the area around ${label}`}
          src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik`}
          className="block h-72 w-full sm:h-96"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
        {/* Soft circle marks the general area without pointing at the home. */}
        <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-brand/70 bg-brand/15 sm:h-52 sm:w-52" />
      </div>
      <p className="text-sm text-ink-muted">
        Approximate location. The exact address is shared after booking.{" "}
        <a href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=13/${lat}/${lon}`} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">© OpenStreetMap contributors</a>
      </p>
    </div>
  );
}
