import "server-only";
import { randomBytes } from "node:crypto";
import { BRAND, CHAIN } from "@/config/brand";
import type { Store } from "@/lib/auth/store";
import { recoverSigner } from "@/lib/auth/verify";
import { RULES, type Asset } from "@/lib/practice/ledger";
import { MICRO } from "@/lib/practice/vault";

/*
 * Signed practice actions. Every action is its own one-time message: the
 * server writes it (domain from signInDomain(), the wallet, the action and
 * its amount, a random nonce and an expiry), the wallet signs it with
 * personal_sign, and the server applies exactly what it wrote. The nonce is
 * burned with SET NX before anything is applied, so a replayed signature
 * gets a 409 and never runs twice.
 */

export const INTENT_TTL = 5 * 60;

export type Action =
  | { kind: "join" }
  | { kind: "topup" }
  | { kind: "shroud"; asset: Asset; amount: number }
  | { kind: "send"; asset: Asset; amount: number; to: string }
  | { kind: "unshroud"; asset: Asset; amount: number; to: string };

type Intent = { address: string; action: Action; message: string; expires: number };

const intentKey = (nonce: string) => `practice:intent:${nonce}`;
const usedKey = (nonce: string) => `practice:used:${nonce}`;
const MAX_AMOUNT = 1_000_000_000 * MICRO;

const isAsset = (v: unknown): v is Asset => v === "eth" || v === "oarkel";
const label = (a: Asset) => (a === "eth" ? "ETH" : BRAND.ticker);
const tok = (micro: number) => (micro / MICRO).toLocaleString("en-US", { maximumFractionDigits: 6 });

function amountOf(asset: Asset, raw: unknown): number | string {
  const n = typeof raw === "number" ? Math.floor(raw) : Number.NaN;
  if (!Number.isSafeInteger(n) || n <= 0 || n > MAX_AMOUNT) return "Enter an amount.";
  if (n < RULES.min[asset]) return `The smallest amount is ${tok(RULES.min[asset])} ${label(asset)}.`;
  return n;
}

/** Validates what the browser asked for. Returns a clean action or an error message. */
export function parseAction(kind: unknown, raw: unknown): Action | string {
  const p = (raw ?? {}) as Record<string, unknown>;
  if (kind === "join") return { kind: "join" };
  if (kind === "topup") return { kind: "topup" };
  if (kind !== "shroud" && kind !== "send" && kind !== "unshroud") return "Unknown action.";
  if (!isAsset(p.asset)) return "Pick ETH or OARKEL.";
  const amount = amountOf(p.asset, p.amount);
  if (typeof amount === "string") return amount;
  if (kind === "shroud") return { kind, asset: p.asset, amount };
  const to = typeof p.to === "string" ? p.to.trim().toLowerCase() : "";
  if (!/^0x[0-9a-f]{40}$/.test(to)) return "Enter a full 0x address (42 characters).";
  if (kind === "send") return { kind, asset: p.asset, amount, to };
  return { kind, asset: p.asset, amount, to };
}

function describe(action: Action, self: string) {
  switch (action.kind) {
    case "join":
      return `Open a practice account (${tok(RULES.startEth)} ETH and ${tok(RULES.startOarkel)} ${BRAND.ticker} to start)`;
    case "topup":
      return "Top up the public practice balance";
    case "shroud":
      return `Shroud ${tok(action.amount)} ${label(action.asset)} into a private note`;
    case "send":
      return `Send ${tok(action.amount)} ${label(action.asset)} privately to ${action.to}`;
    case "unshroud":
      return `Unshroud ${tok(action.amount)} ${label(action.asset)} to ${action.to === self ? "this wallet" : action.to}`;
  }
}

export async function createIntent(store: Store, address: string, action: Action, host: string) {
  const nonce = randomBytes(16).toString("hex");
  const expires = Date.now() + INTENT_TTL * 1000;
  const message = [
    `${host} asks you to confirm a practice action on ${BRAND.name}:`,
    address,
    "",
    `Action: ${describe(action, address)}`,
    "Practice mode: no real funds move and no transaction is sent.",
    "",
    `Chain ID: ${CHAIN.id}`,
    `Nonce: ${nonce}`,
    `Expires At: ${new Date(expires).toISOString()}`,
  ].join("\n");
  const intent: Intent = { address, action, message, expires };
  await store.setEx(intentKey(nonce), JSON.stringify(intent), INTENT_TTL);
  return { nonce, message };
}

/**
 * Burns the nonce, then checks the signature. The burn comes first and is
 * atomic (SET NX): of two identical submissions only one gets past it.
 */
export async function consumeIntent(
  store: Store,
  nonce: string,
  signature: string,
): Promise<{ address: string; action: Action } | { error: string; status: number }> {
  if (!/^[0-9a-f]{32}$/.test(nonce)) return { error: "Unknown request.", status: 400 };
  if (!(await store.setNx(usedKey(nonce), "1", INTENT_TTL * 2))) {
    return { error: "This signature was already used.", status: 409 };
  }
  const raw = await store.get(intentKey(nonce));
  await store.del(intentKey(nonce));
  if (!raw) return { error: "This request expired. Try again.", status: 410 };
  let intent: Intent;
  try {
    intent = JSON.parse(raw) as Intent;
  } catch {
    return { error: "This request expired. Try again.", status: 410 };
  }
  if (Date.now() > intent.expires) return { error: "This request expired. Try again.", status: 410 };
  if (recoverSigner(intent.message, signature) !== intent.address) {
    return { error: "That signature does not match the wallet.", status: 401 };
  }
  return { address: intent.address, action: intent.action };
}
