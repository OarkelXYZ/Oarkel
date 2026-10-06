/** Small presentational pieces shared by server and client components. */

export function EthGlyph({ size = 14 }: { size?: number }) {
  const inner = Math.round(size * 0.64);
  return (
    <span
      className="inline-grid shrink-0 place-items-center rounded-full bg-fg align-middle"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg width={inner} height={inner} viewBox="0 0 24 24" fill="none">
        <path d="M12 2.5 5.5 12.6 12 16.4l6.5-3.8L12 2.5Z" fill="#eeebe3" />
        <path d="M12 17.7 5.5 13.9 12 21.5l6.5-7.6-6.5 3.8Z" fill="#eeebe3" fillOpacity="0.6" />
      </svg>
    </span>
  );
}

/** A redaction bar standing in for a private value. `w` is in ch. */
export function Redact({ w = 6, sweep = false, className = "" }: { w?: number; sweep?: boolean; className?: string }) {
  return (
    <span
      aria-label="hidden value"
      role="img"
      className={`redact ${sweep ? "redact-sweep" : ""} ${className}`}
      style={{ width: `${w}ch` }}
    />
  );
}

/** "Contract design" tag for claims that describe what the written contracts do (true in the code, live only once deployed). */
export function Planned({ children = "Contract design", tone = "paper" }: { children?: React.ReactNode; tone?: "paper" | "night" }) {
  return (
    <span
      className={`label inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] ${
        tone === "night" ? "bg-night-3 text-mist-2" : "bg-card-2 text-fg-2"
      }`}
    >
      <span className={`size-1.5 rounded-full ${tone === "night" ? "bg-ember" : "bg-surge"}`} />
      {children}
    </span>
  );
}

export function PracticeTag({ className = "" }: { className?: string }) {
  return (
    <span className={`label inline-flex items-center gap-1.5 rounded-full bg-surge-soft px-2 py-0.5 text-[10.5px] text-surge-2 ${className}`}>
      Practice mode
    </span>
  );
}
