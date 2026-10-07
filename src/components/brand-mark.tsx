/** LotPulse logo: a "P" inside radar rings with a sweep. Mirrors public/favicon.svg. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <circle
        cx="16"
        cy="16"
        r="14"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.35"
        strokeWidth="1.5"
      />
      <circle
        cx="16"
        cy="16"
        r="9"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.6"
        strokeWidth="1.5"
      />
      <path d="M16 16 L16 2 A14 14 0 0 1 29.3 11.7 Z" fill="currentColor" fillOpacity="0.28" />
      <path
        d="M13 21.5v-11h4.2a3.4 3.4 0 0 1 0 6.8H13"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
