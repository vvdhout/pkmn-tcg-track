// One white star per point — shown for cards with a point value when a list
// uses the Base–Neo point format.
export function PointStars({ points }: { points: number }) {
  if (points <= 0) return null;
  return (
    <span
      className="inline-flex items-center gap-[3px] flex-shrink-0 text-white"
      aria-label={`${points} point${points === 1 ? '' : 's'}`}
    >
      {Array.from({ length: points }).map((_, i) => (
        <svg key={i} width="8" height="8" viewBox="0 0 9 9" fill="currentColor" aria-hidden="true">
          <path d="M4.5 0l1.09 2.21 2.44.36-1.77 1.72.42 2.43L4.5 5.59 2.32 6.72l.42-2.43L1 2.57l2.44-.36z" />
        </svg>
      ))}
    </span>
  );
}
