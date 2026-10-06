import { MARK_PATH, MARK_VIEWBOX } from "@/components/markPath";

/**
 * The Oarkel mark (the owner's logo): a ring whose lower half breaks into
 * wave lines. Traced to one path and drawn in currentColor.
 */
function MarkShape() {
  return <path d={MARK_PATH} fill="currentColor" fillRule="evenodd" />;
}

const VB = `0 0 ${MARK_VIEWBOX} ${MARK_VIEWBOX}`;

export function Mark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox={VB} fill="none" aria-hidden="true" className={className}>
      <MarkShape />
    </svg>
  );
}

/**
 * The mark cut into horizontal bands. With `animate`, the bands slide in one
 * after another (the hero); without it, it is the plain mark.
 */
const BANDS = 7;

export function SlatMark({ size = 28, className = "", id = "s", animate = false }: { size?: number | null; className?: string; id?: string; animate?: boolean }) {
  if (!animate) {
    return (
      <svg width={size ?? undefined} height={size ?? undefined} viewBox={VB} fill="none" aria-hidden="true" className={className}>
        <MarkShape />
      </svg>
    );
  }
  const h = MARK_VIEWBOX / BANDS;
  return (
    <svg width={size ?? undefined} height={size ?? undefined} viewBox={VB} fill="none" aria-hidden="true" className={className}>
      <defs>
        {Array.from({ length: BANDS }, (_, i) => (
          <clipPath key={i} id={`${id}-c${i}`}>
            <rect x={-80} y={i * h} width={MARK_VIEWBOX + 160} height={h + 0.5} />
          </clipPath>
        ))}
      </defs>
      {Array.from({ length: BANDS }, (_, i) => (
        <g key={i} clipPath={`url(#${id}-c${i})`}>
          <g className="slat-in" style={{ animationDelay: `${0.08 * i}s` }}>
            <MarkShape />
          </g>
        </g>
      ))}
    </svg>
  );
}

/** Mark plus the wordmark, for the header and footer. */
export function Wordmark({ className = "" }: { className?: string; id?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Mark size={20} className="text-fg" />
      <span className="font-mono text-[15px] leading-none font-medium tracking-[-0.01em] text-fg">Oarkel</span>
    </span>
  );
}
