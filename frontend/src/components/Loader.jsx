/**
 * components/Loader.jsx — EFFECT 4: the loading experience.
 *
 * Three sizes for three situations, because a full-screen takeover for a
 * small list refresh is exactly the "annoying loader" to avoid:
 *
 *   FullPageLoader  only during the startup auth check, which blocks
 *                   everything anyway
 *   SectionLoader   for a panel refreshing inside an otherwise live page
 *   CardSkeleton    for lists, so the layout does not jump when data lands
 */

export function FullPageLoader({ label = 'Loading' }) {
  return (
    <div className="loader-screen" role="status" aria-live="polite">
      <div className="loader-mark" />
      <p className="loader-label">{label}</p>
      <span className="sr-only">Loading, please wait.</span>
    </div>
  );
}

export function SectionLoader({ label = 'Loading' }) {
  return (
    <div className="loader-inline" role="status" aria-live="polite">
      <div className="loader-mark" />
      <p className="loader-label">{label}</p>
    </div>
  );
}

export function CardSkeleton({ count = 6 }) {
  return (
    <div className="grid-cards" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="skeleton skeleton-card" />
      ))}
    </div>
  );
}
