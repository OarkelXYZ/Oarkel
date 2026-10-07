/*
 * Builds the inputs of one transact proof: up to two of the wallet's notes in,
 * a payment and/or change out, public exit and fee values, and the external
 * data the proof binds. Pure: no network, no randomness except blindings.
 */
import {
  MerkleTree,
  TREE_DEPTH,
  encryptNote,
  extDataHash,
  noteCommitment,
  nullifierOf,
  randomField,
  toHex32,
  zeroAt,
  type ExtData,
  type NoteKeys,
} from "./core.ts";

export type OwnedNote = {
  asset: number;
  /** Note units: wei for ETH, vault shares for the token. */
  value: bigint;
  blinding: bigint;
  index: number;
  commitment: bigint;
  nullifier: bigint;
};

export type PublicArgs = {
  root: bigint;
  asset: number;
  nullifiers: [bigint, bigint];
  commitments: [bigint, bigint];
  exitValue: bigint;
  transferFee: bigint;
};

export type SpendPlan = {
  /** Circuit witness, ready for noir_js `execute`. */
  witness: Record<string, string | string[] | string[][]>;
  args: PublicArgs;
  ext: ExtData;
  /** Output notes (for the local cache before the chain confirms them). */
  outputs: { pk: bigint; value: bigint; blinding: bigint; commitment: bigint; mine: boolean }[];
};

export type SpendRequest = {
  keys: NoteKeys;
  asset: number;
  /** One or two notes of `asset`, owned by `keys`. */
  inputs: OwnedNote[];
  tree: MerkleTree;
  /** Optional private payment to another key (value in note units). */
  pay?: { pk: bigint; viewPub: Uint8Array; value: bigint };
  /** Note units leaving the pool (the unshroud amount; zero for a private send from this site). */
  exitValue: bigint;
  feeBps: bigint;
  recipient: string;
  relayer: string;
  /** Wei or token units, paid out of the exit. */
  relayerFee: bigint;
  chainId: number;
  pool: string;
};

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/** Transfer fee in note units for `value` sent to another key: rounded up, like the contract's bps fees. */
export const transferFeeFor = (value: bigint, bps: bigint) => (value * bps + 9_999n) / 10_000n;

/** Picks the fewest notes (at most two) covering `need`, largest first. Null when two are not enough. */
export function pickNotes(notes: OwnedNote[], need: bigint): OwnedNote[] | null {
  const sorted = [...notes].sort((a, b) => (b.value > a.value ? 1 : b.value < a.value ? -1 : 0));
  if (need <= 0n) return sorted.length ? [sorted[0]] : [];
  const one = [...sorted].reverse().find((n) => n.value >= need);
  if (one) return [one];
  if (sorted.length >= 2 && sorted[0].value + sorted[1].value >= need) {
    // Smallest partner that still covers the need, to keep large notes whole.
    const big = sorted[0];
    const partner = [...sorted.slice(1)].reverse().find((n) => big.value + n.value >= need) ?? sorted[1];
    return [big, partner];
  }
  return null;
}

export function buildSpend(req: SpendRequest): SpendPlan {
  const { keys, asset, tree } = req;
  if (req.inputs.length > 2) throw new Error("At most two notes per proof");
  for (const n of req.inputs) if (n.asset !== asset) throw new Error("Mixed assets");

  const pay = req.pay && req.pay.value > 0n ? req.pay : undefined;
  const sentToOther = pay && pay.pk !== keys.pk ? pay.value : 0n;
  const transferFee = transferFeeFor(sentToOther, req.feeBps);
  const totalIn = req.inputs.reduce((s, n) => s + n.value, 0n);
  const change = totalIn - (pay?.value ?? 0n) - req.exitValue - transferFee;
  if (change < 0n) throw new Error("Not enough in these notes for the amount plus fees");

  // Inputs, padded with a zero-value filler that needs no membership proof.
  const filler = (): OwnedNote => {
    const blinding = randomField();
    const commitment = noteCommitment(asset, 0n, keys.pk, blinding);
    return { asset, value: 0n, blinding, index: 0, commitment, nullifier: nullifierOf(commitment, 0, keys.sk) };
  };
  const ins = [...req.inputs];
  while (ins.length < 2) ins.push(filler());
  const emptyPath = Array.from({ length: TREE_DEPTH }, (_, l) => zeroAt(l));
  const paths = ins.map((n) => (n.value > 0n ? tree.path(n.index) : emptyPath));

  // Outputs: the payment (if any) and the change, in random order.
  const outs: SpendPlan["outputs"] = [];
  const cipher: string[] = [];
  const addOut = (pk: bigint, viewPub: Uint8Array, value: bigint, mine: boolean) => {
    const blinding = randomField();
    outs.push({ pk, value, blinding, commitment: noteCommitment(asset, value, pk, blinding), mine });
    cipher.push(encryptNote(viewPub, asset, value, blinding));
  };
  if (pay) addOut(pay.pk, pay.viewPub, pay.value, pay.pk === keys.pk);
  addOut(keys.pk, keys.viewPub, change, true);
  if (outs.length < 2) addOut(keys.pk, keys.viewPub, 0n, true);
  if (randomField() & 1n) {
    outs.reverse();
    cipher.reverse();
  }

  const ext: ExtData = {
    recipient: req.recipient,
    relayer: req.relayer,
    relayerFee: req.relayerFee,
    encryptedOutput0: cipher[0],
    encryptedOutput1: cipher[1],
  };
  const root = tree.root();
  const args: PublicArgs = {
    root,
    asset,
    nullifiers: [ins[0].nullifier, ins[1].nullifier],
    commitments: [outs[0].commitment, outs[1].commitment],
    exitValue: req.exitValue,
    transferFee,
  };
  const hx = toHex32;
  const witness = {
    root: hx(root),
    asset: hx(BigInt(asset)),
    nullifiers: args.nullifiers.map(hx),
    commitments: args.commitments.map(hx),
    exit_value: hx(req.exitValue),
    transfer_fee: hx(transferFee),
    fee_bps: hx(req.feeBps),
    ext_data_hash: hx(extDataHash(req.chainId, req.pool, ext)),
    sk: hx(keys.sk),
    in_values: ins.map((n) => hx(n.value)),
    in_blindings: ins.map((n) => hx(n.blinding)),
    in_indices: ins.map((n) => hx(BigInt(n.index))),
    in_paths: paths.map((p) => p.map(hx)),
    out_values: outs.map((o) => hx(o.value)),
    out_pks: outs.map((o) => hx(o.pk)),
    out_blindings: outs.map((o) => hx(o.blinding)),
  };
  return { witness, args, ext, outputs: outs };
}
