/**
 * The Oarkel mark: an open "O" with a redaction bar sliding out of it, drawn
 * in currentColor. The same geometry feeds the favicon and social card
 * generator (referensi/tools/make-brand.mjs).
 */
export const MARK_RING = "M44.73 23 A19 19 0 1 0 44.73 41";

function MarkShape() {
  return (
    <>
      <path d={MARK_RING} stroke="currentColor" strokeWidth="8" fill="none" />
      <rect x="26" y="28" width="34" height="8" rx="1" fill="currentColor" />
    </>
  );
}

export function Mark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true" className={className}>
      <MarkShape />
    </svg>
  );
}

/**
 * The mark cut into horizontal slats, each slat nudged sideways, like a
 * redacted line of print. Used large in the hero and small in the header.
 */
const SLATS = [
  { y: 8, h: 5, dx: 2 },
  { y: 14.5, h: 5, dx: -1.5 },
  { y: 21, h: 5, dx: 0 },
  { y: 27.5, h: 9, dx: 0 },
  { y: 38, h: 5, dx: -2 },
  { y: 44.5, h: 5, dx: 1.5 },
  { y: 51, h: 5, dx: -1 },
];

export function SlatMark({ size = 28, className = "", id = "s", animate = false }: { size?: number | null; className?: string; id?: string; animate?: boolean }) {
  return (
    <svg width={size ?? undefined} height={size ?? undefined} viewBox="0 0 64 64" fill="none" aria-hidden="true" className={className}>
      <defs>
        {SLATS.map((s, i) => (
          <clipPath key={i} id={`${id}-c${i}`}>
            <rect x="-8" y={s.y} width="80" height={s.h} />
          </clipPath>
        ))}
      </defs>
      {SLATS.map((s, i) => (
        <g key={i} clipPath={`url(#${id}-c${i})`}>
          <g
            transform={`translate(${s.dx} 0)`}
            className={animate ? "slat-in" : undefined}
            style={animate ? { animationDelay: `${0.08 * i}s` } : undefined}
          >
            <MarkShape />
          </g>
        </g>
      ))}
    </svg>
  );
}

/** Mark plus the wordmark, for the header and footer. */
export function Wordmark({ className = "", id = "wm" }: { className?: string; id?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <SlatMark size={20} id={id} className="text-fg" />
      <span className="font-mono text-[15px] leading-none font-medium tracking-[-0.01em] text-fg">Oarkel</span>
    </span>
  );
}
