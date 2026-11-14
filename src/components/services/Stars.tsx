export function Stars({ rating, count }: { rating: number | null; count?: number }) {
  if (rating === null) return <span className="text-sm text-ink-muted">New on Keyvaga</span>;
  return (
    <span className="text-sm" aria-label={`Rated ${rating.toFixed(1)} out of 5${count !== undefined ? ` from ${count} review${count === 1 ? "" : "s"}` : ""}`}>
      <span className="text-brand" aria-hidden="true">★</span> {rating.toFixed(1)}{count !== undefined ? <span className="text-ink-muted"> ({count})</span> : null}
    </span>
  );
}
