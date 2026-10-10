// How the app reads a relayer's refusal: skip that relayer for a while, prove again, or stop.

/** A relayer refusal or failure; `status` is the HTTP status, 0 when the relayer could not be reached. */
export class RelayError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** How long an unreachable or paused relayer is skipped before the app tries it again. */
export const RELAYER_PAUSE_MS = 2 * 60_000;

export type RelayFailureKind = "unavailable" | "requote" | "final";

/** A relayed send that did not go out, with whether to skip the relayer, prove again, or stop. */
export class RelayFailure extends Error {
  readonly failure: RelayFailureKind;
  readonly url: string;
  constructor(message: string, failure: RelayFailureKind, url: string) {
    super(message);
    this.failure = failure;
    this.url = url;
  }
}

export function classifyRelayFailure(e: unknown): RelayFailureKind {
  if (!(e instanceof RelayError)) return "unavailable";
  // Unreachable, rate limited, busy, paused or out of gas money: the relayer, not the proof.
  if (e.status === 0 || e.status === 429 || e.status >= 500) return "unavailable";
  // The quote or the tree moved between proving and sending: a fresh proof fixes it. The message comes from the
  // relayer, so only a plain 400 counts, and the caller still reuses the same notes and caps the new fee.
  if (e.status === 400 && /fee too low|no longer known|prove again/i.test(e.message)) return "requote";
  // Its own limits (gas ceiling, token fees) make it the wrong relayer for this spend.
  if (/gas estimate too high|only takes spends/i.test(e.message)) return "unavailable";
  return "final";
}
