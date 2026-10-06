/** Display helpers shared by server and client components. */

export function usd(value: number | null | undefined, compact = true) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "–";
  if (compact && Math.abs(value) >= 1000) {
    return `$${new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value)}`;
  }
  if (Math.abs(value) >= 1) return `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  return `$${value.toPrecision(3)}`;
}

/** Tiny prices: "$0.0₅1383" keeps the significant digits readable. */
export function price(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) return "–";
  if (value >= 0.01) return usd(value, false);
  const text = value.toFixed(20);
  const zeros = /^0\.(0*)/.exec(text)?.[1].length ?? 0;
  const digits = text.slice(2 + zeros, 2 + zeros + 4);
  const sub = String(zeros).split("").map((d) => "₀₁₂₃₄₅₆₇₈₉"[Number(d)]).join("");
  return `$0.0${sub}${digits}`;
}

/** micro-pETH → "0.0123" */
export function peth(micro: number | null | undefined, digits = 4) {
  if (micro === null || micro === undefined || !Number.isFinite(micro)) return "–";
  const eth = micro / 1_000_000;
  if (eth === 0) return "0";
  if (Math.abs(eth) < 0.0001) return "<0.0001";
  return eth.toLocaleString("en-US", { maximumFractionDigits: digits });
}

export function tokens(value: number) {
  if (!Number.isFinite(value)) return "–";
  if (value >= 1000) return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(value);
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function ago(ms: number | null | undefined, now = Date.now()) {
  if (!ms) return "–";
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

/** "4:07" or "1:02:09" until `end`; "0:00" once passed. */
export function clock(end: number, now = Date.now()) {
  const s = Math.max(0, Math.ceil((end - now) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

export const short = (address: string, head = 4, tail = 4) =>
  address.length > head + tail + 2 ? `${address.slice(0, head + 2)}…${address.slice(-tail)}` : address;

export const durationLabel = (sec: number) => (sec >= 3600 ? `${sec / 3600}h` : `${sec / 60}m`);
