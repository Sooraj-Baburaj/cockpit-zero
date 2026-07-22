/**
 * The CockpitZero convergence mark ("inward arrows") — eight rays drawing the
 * eye to the center, hand-traced as a single stroked path. Colors via
 * `currentColor`, so wrap it in a text-color class to tint.
 */
export function LogoMark({
  size = 24,
  strokeWidth = 4.4,
  className = '',
}: {
  size?: number | string;
  strokeWidth?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="M24 17V7 M28.6 19.4l4.95-4.95 M30 24h3.5 M37 24h5 M28.95 28.95l6.36 6.36 M24 31v8 M19.4 28.6l-6.36 6.36 M18 24H6 M19.05 19.05l-6.36-6.36"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </svg>
  );
}
