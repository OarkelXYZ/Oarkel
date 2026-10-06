/**
 * The Oarkel mark: an open "O" with a redaction bar sliding out of it, drawn
 * in currentColor. The same geometry feeds the favicon and social card
 * generator (referensi/tools/make-brand.mjs).
 */
export const MARK_RING = "M44.73 23 A19 19 0 1 0 44.73 41";

export function Mark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true" className={className}>
      <path d={MARK_RING} stroke="currentColor" strokeWidth="8" />
      <rect x="26" y="28" width="34" height="8" rx="1" fill="currentColor" />
    </svg>
  );
}

/** Mark plus the wordmark, for the header and footer. */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <Mark size={26} className="text-surge" />
      <span className="display text-[23px] leading-none tracking-[-0.01em]">Oarkel</span>
    </span>
  );
}
