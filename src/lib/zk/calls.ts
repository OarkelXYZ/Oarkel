/*
 * OarkelPool calldata, return values and logs, without an ABI library.
 * Framework-free like core.ts, so the site, the tests and tools share it.
 */
import { encodeExtData, keccakHex, selector, toHex32, type ExtData } from "./core.ts";
import type { PublicArgs } from "./plan.ts";

const word = (n: bigint | number) => BigInt(n).toString(16).padStart(64, "0");
const addr = (a: string) => a.toLowerCase().replace(/^0x/, "").padStart(64, "0");
const bytesTail = (hex: string) => {
  const h = hex.replace(/^0x/, "");
  return word(h.length / 2) + h.padEnd(Math.ceil(h.length / 64) * 64, "0");
};

const ARGS = "(uint256,uint8,uint256[2],uint256[2],uint256,uint256)";
const EXT = "(address,address,uint256,bytes,bytes)";

export const SIG = {
  shroud: selector("shroud(uint8,uint256,uint256,bytes)"),
  transact: selector(`transact(bytes,${ARGS},${EXT})`),
  unshroud: selector(`unshroud(bytes,${ARGS},${EXT})`),
  donate: selector("donate(uint256)"),
  sweepEthFees: selector("sweepEthFees()"),
  state: selector("state()"),
  valueOfShares: selector("valueOfShares(uint256)"),
  previewShroudShares: selector("previewShroudShares(uint256)"),
  spentMany: selector("spentMany(uint256[])"),
  isKnownRoot: selector("isKnownRoot(uint256)"),
  shroudFeeBps: selector("shroudFeeBps()"),
  transferFeeBps: selector("transferFeeBps()"),
  unshroudFeeEth: selector("unshroudFeeEth()"),
  unshroudFeeToken: selector("unshroudFeeToken()"),
  token: selector("token()"),
  verifier: selector("verifier()"),
  feeSink: selector("feeSink()"),
  allowance: selector("allowance(address,address)"),
  approve: selector("approve(address,uint256)"),
  balanceOf: selector("balanceOf(address)"),
  decimals: selector("decimals()"),
  swap: selector(`swap(bytes,${ARGS},${EXT})`),
  buy: selector("buy(uint256,uint256,bytes)"),
} as const;

/** Event topics (full 32-byte hashes). */
const topic = (sig: string) => keccakHex(new TextEncoder().encode(sig));
export const TOPIC = {
  NewCommitment: topic("NewCommitment(uint256,uint256,bytes)"),
  Shrouded: topic("Shrouded(uint8,address,uint256,uint256,uint256,uint256)"),
  NewNullifier: topic("NewNullifier(uint256)"),
};

export const encodeShroud = (asset: number, amount: bigint, ownerHash: bigint, encryptedNote: string) =>
  SIG.shroud + word(asset) + word(amount) + word(ownerHash) + word(4 * 32) + bytesTail(encryptedNote);

function encodeSpend(sel: string, proof: string, a: PublicArgs, ext: ExtData) {
  const args = [a.root, BigInt(a.asset), a.nullifiers[0], a.nullifiers[1], a.commitments[0], a.commitments[1], a.exitValue, a.transferFee].map(word).join("");
  const proofTail = bytesTail(proof);
  const head = 10 * 32;
  return sel + word(head) + args + word(head + proofTail.length / 2) + proofTail + encodeExtData(ext);
}

export const encodeTransact = (proof: string, a: PublicArgs, ext: ExtData) => encodeSpend(SIG.transact, proof, a, ext);
/** OarkelSwap.swap: the same arguments as an unshroud, sent to the swap contract. */
export const encodeSwap = (proof: string, a: PublicArgs, ext: ExtData) => encodeSpend(SIG.swap, proof, a, ext);
/** OarkelSwap.buy(ownerHash, minTokensOut, encryptedNote), sent with the ETH to spend. */
export const encodeBuyIntoNote = (ownerHash: bigint, minTokensOut: bigint, encryptedNote: string) =>
  SIG.buy + word(ownerHash) + word(minTokensOut) + word(3 * 32) + bytesTail(encryptedNote);

/** "OARKEL-SWAP-v1" padded to 16 bytes: the first bytes of a swap-terms blob (OarkelSwap.SWAP_MAGIC). */
export const SWAP_MAGIC = "4f41524b454c2d535741502d76310000";

export type SwapTerms = {
  ownerHash: bigint;
  /** Lowest amount shrouded into the new note: after the submitter's fee, before the pool's shroud fee. */
  minOut: bigint;
  /** Unix seconds. */
  deadline: bigint;
  /** The only address allowed to land the swap; the zero address lets anyone (the lander is then paid). */
  submitter: string;
  /** Wei paid to the submitter out of the swap. */
  submitterFee: bigint;
  /** The new note's blinding, encrypted to its owner, with a value of zero (the value is read from the Shrouded event). */
  encryptedNote: string;
};

/** Swap terms exactly as OarkelSwap.encodeSwapTerms writes them, for the proof's second encrypted output. */
export const encodeSwapTerms = (t: SwapTerms) =>
  "0x" + SWAP_MAGIC + word(t.ownerHash) + word(t.minOut) + word(t.deadline) + addr(t.submitter) + word(t.submitterFee) + word(6 * 32) + bytesTail(t.encryptedNote);
export const encodeUnshroud = (proof: string, a: PublicArgs, ext: ExtData) => encodeSpend(SIG.unshroud, proof, a, ext);
export const encodeDonate = (amount: bigint) => SIG.donate + word(amount);
export const encodeValueOfShares = (shares: bigint) => SIG.valueOfShares + word(shares);
export const encodePreviewShroudShares = (amount: bigint) => SIG.previewShroudShares + word(amount);
export const encodeIsKnownRoot = (root: bigint) => SIG.isKnownRoot + word(root);
export const encodeSpentMany = (nullifiers: bigint[]) => SIG.spentMany + word(32) + word(nullifiers.length) + nullifiers.map(word).join("");
export const encodeAllowance = (owner: string, spender: string) => SIG.allowance + addr(owner) + addr(spender);
export const encodeApprove = (spender: string, amount: bigint) => SIG.approve + addr(spender) + word(amount);
export const encodeBalanceOf = (owner: string) => SIG.balanceOf + addr(owner);

export const words = (hex: string) => {
  const h = hex.replace(/^0x/, "");
  const out: bigint[] = [];
  for (let i = 0; i + 64 <= h.length; i += 64) out.push(BigInt(`0x${h.slice(i, i + 64)}`));
  return out;
};

export type PoolState = { leaves: number; lastRoot: bigint; totalShares: bigint; backing: bigint; pendingYield: bigint; ethFees: bigint };
export function decodeState(hex: string): PoolState {
  const w = words(hex);
  return { leaves: Number(w[0]), lastRoot: w[1], totalShares: w[2], backing: w[3], pendingYield: w[4], ethFees: w[5] };
}

export function decodeBoolArray(hex: string): boolean[] {
  const w = words(hex);
  const n = Number(w[1]);
  return w.slice(2, 2 + n).map((x) => x !== 0n);
}

/* ------------------------------------------------------------ logs */

export type RawLog = { topics: string[]; data: string; blockNumber: string; transactionHash: string; logIndex?: string };
export type LeafRecord = {
  /** Leaf index. */
  i: number;
  /** Commitment (hex). */
  c: string;
  /** Encrypted note (hex). */
  e: string;
  /** Note value from the Shrouded event, for leaves created by shroud (decimal string). */
  v?: string;
  /** Asset of a shroud leaf. */
  a?: number;
  /** Block and transaction. */
  b: number;
  tx: string;
};

/** Turns NewCommitment and Shrouded logs into leaf records, in leaf order. */
export function leavesFromLogs(logs: RawLog[]): LeafRecord[] {
  const byIndex = new Map<number, LeafRecord>();
  const shroudValue = new Map<number, { v: string; a: number }>();
  for (const log of logs) {
    const t0 = log.topics[0]?.toLowerCase();
    if (t0 === TOPIC.NewCommitment) {
      const i = Number(BigInt(log.topics[2]));
      const d = log.data.replace(/^0x/, "");
      const len = Number(BigInt(`0x${d.slice(64, 128)}`));
      byIndex.set(i, { i, c: toHex32(BigInt(log.topics[1])), e: `0x${d.slice(128, 128 + len * 2)}`, b: Number(BigInt(log.blockNumber)), tx: log.transactionHash });
    } else if (t0 === TOPIC.Shrouded) {
      const w = words(log.data);
      shroudValue.set(Number(w[3]), { v: w[2].toString(), a: Number(BigInt(log.topics[1])) });
    }
  }
  const out = [...byIndex.values()].sort((x, y) => x.i - y.i);
  for (const leaf of out) {
    const s = shroudValue.get(leaf.i);
    if (s) {
      leaf.v = s.v;
      leaf.a = s.a;
    }
  }
  return out;
}

/** Custom error selectors of OarkelPool, with readable explanations. */
export const POOL_ERRORS: Record<string, string> = Object.fromEntries(
  (
    [
      ["BadParameter()", "A constructor parameter is not valid."],
      ["BadAsset()", "Unknown asset."],
      ["BadAmount()", "That amount is not accepted (zero, too small after the fee, or a value mismatch)."],
      ["NoteTooLarge()", "The encrypted note is too large."],
      ["NotInField()", "A value is outside the proof field."],
      ["ValueTooLarge()", "The amount is too large for a note."],
      ["FeeOnTransferToken()", "The token moved a different amount than requested."],
      ["ZeroShares()", "The amount is too small to mint a vault share."],
      ["TreeFull()", "The pool tree is full."],
      ["UnknownRoot()", "The pool moved on since this proof was made. Prove again."],
      ["NullifierSpent()", "One of these notes is already spent."],
      ["SameNullifier()", "The same note appears twice."],
      ["InvalidProof()", "The proof did not verify."],
      ["BadRecipient()", "The recipient is not valid for this action."],
      ["BadRelayer()", "A relayer fee needs a relayer address."],
      ["ExitTooSmall()", "The amount does not cover the fees."],
      ["EthTransferFailed()", "The recipient refused the ETH transfer."],
      ["NothingToSweep()", "No ETH fees are waiting."],
    ] as const
  ).map(([sig, text]) => [selector(sig), text]),
);
