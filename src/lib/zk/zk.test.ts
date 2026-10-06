import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Noir } from "@noir-lang/noir_js";
import {
  FIELD,
  MerkleTree,
  decodeAddress,
  decryptNote,
  deriveKeys,
  encodeAddress,
  encryptNote,
  h1,
  keyDomain,
  keyMessage,
  checksumAddress,
  h2,
  h3,
  noteCommitment,
  nullifierOf,
  randomField,
  toHex32,
  zeroAt,
} from "./core.ts";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { recoverSigner } from "../auth/verify.ts";
import { buildSpend, pickNotes, transferFeeFor, type OwnedNote } from "./plan.ts";

const circuit = JSON.parse(readFileSync(new URL("../../../public/zk/transact.json", import.meta.url), "utf8"));
const noir = new Noir(circuit);
const A = deriveKeys(`0x${"11".repeat(64)}1b`);
const B = deriveKeys(`0x${"22".repeat(64)}1c`);
const POOL = "0x00000000000000000000000000000000000000bb";

test("poseidon matches the circomlib vectors used by the circuit and the contract", () => {
  assert.equal(h2(1n, 2n), 0x115cc0f5e7d690413df64c6b9662e9cf2a3617f2743245519e19607a4417189an);
  assert.equal(h1(1n), 0x29176100eaa962bdc1fe6c654d6a3c130e96a4d1168b33848b897dc502820133n);
  assert.equal(h3(1n, 2n, 3n), 0x0e7732d89e6939c0ff03d5e58dab6302f3230e269dc5b968f725df34ab36d732n);
  assert.equal(zeroAt(1), 0x2098f5fb9e239eab3ceac3f27b81e481dc3124d55ffed523a839ee8446b64864n);
  assert.equal(zeroAt(24), 0x27171fb4a97b6cc0e9e8f543b5294de866a2af2c9c8d0b1d96e673e4529ed540n);
});

test("keys are deterministic per signature and ignore the v byte", () => {
  const again = deriveKeys(`0x${"11".repeat(64)}00`);
  assert.equal(again.sk, A.sk);
  assert.ok(A.sk > 0n && A.sk < FIELD);
  assert.notEqual(A.pk, B.pk);
  const addr = encodeAddress(A.pk, A.viewPub);
  const back = decodeAddress(addr);
  assert.ok(back);
  assert.equal(back.pk, A.pk);
  assert.equal(decodeAddress("oarkel:zz"), null);
});

/** A deterministic (RFC 6979) personal_sign, like a wallet. */
function personalSign(priv: Uint8Array, message: string) {
  const body = new TextEncoder().encode(message);
  const prefix = new TextEncoder().encode(`\x19Ethereum Signed Message:\n${body.length}`);
  const digest = keccak_256(new Uint8Array([...prefix, ...body]));
  const sig = secp256k1.sign(digest, priv, { prehash: false, format: "recovered" });
  // noble's recovered layout is recovery byte first; wallets put v last (27/28).
  const out = new Uint8Array(65);
  out.set(sig.slice(1), 0);
  out[64] = sig[0] + 27;
  return `0x${Array.from(out, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

test("the key message is a SIWE message bound to the domain, chain and pool", () => {
  const priv = new Uint8Array(32).fill(7);
  const address = `0x${Array.from(keccak_256(secp256k1.getPublicKey(priv, false).slice(1)).slice(-20), (b) => b.toString(16).padStart(2, "0")).join("")}`;
  const msg = keyMessage({ domain: "oarkel.xyz", address, chainId: 4663, pool: POOL });
  assert.match(msg, /^oarkel\.xyz wants you to sign in with your Ethereum account:\n0x[0-9a-fA-F]{40}\n\nThis signature controls your private Oarkel funds\. Only sign it on https:\/\/oarkel\.xyz\.\n\nURI: https:\/\/oarkel\.xyz\nVersion: 1\nChain ID: 4663\nNonce: [a-zA-Z0-9]{8,}\nIssued At: /);
  assert.ok(msg.includes(checksumAddress(address)));
  assert.equal(keyDomain("www.oarkel.xyz", "oarkel.xyz"), "oarkel.xyz");
  assert.equal(keyDomain("evil.example", "oarkel.xyz"), "oarkel.xyz");
  assert.equal(keyDomain("localhost:4910", "oarkel.xyz"), "localhost:4910");

  const sig = personalSign(priv, msg);
  assert.equal(recoverSigner(msg, sig), address);
  // Same wallet, domain, chain, pool and passphrase: same keys, every time.
  const k1 = deriveKeys(sig);
  const k2 = deriveKeys(personalSign(priv, keyMessage({ domain: "oarkel.xyz", address, chainId: 4663, pool: POOL })));
  assert.equal(k1.sk, k2.sk);
  // A different domain (a phishing copy) yields a different message, signature and keys.
  const phish = deriveKeys(personalSign(priv, keyMessage({ domain: "oarkel-app.example", address, chainId: 4663, pool: POOL })));
  assert.notEqual(phish.sk, k1.sk);
  // Different chain or pool: different keys as well.
  assert.notEqual(deriveKeys(personalSign(priv, keyMessage({ domain: "oarkel.xyz", address, chainId: 1, pool: POOL }))).sk, k1.sk);
  // A passphrase changes the keys; the same passphrase gives them back.
  const p1 = deriveKeys(sig, "correct horse");
  assert.notEqual(p1.sk, k1.sk);
  assert.equal(deriveKeys(sig, "correct horse").sk, p1.sk);
  assert.notEqual(deriveKeys(sig, "correct horse!").sk, p1.sk);
  assert.equal(deriveKeys(sig, "").sk, k1.sk);
});

test("a note decrypts only for its owner", () => {
  const blinding = randomField();
  const c = encryptNote(A.viewPub, 1, 123n, blinding);
  assert.deepEqual(decryptNote(A, c), { asset: 1, value: 123n, blinding });
  assert.equal(decryptNote(B, c), null);
  assert.equal(decryptNote(A, c.slice(0, -2) + "00"), null);
});

test("tree paths rebuild the root", () => {
  const leaves = [5n, 6n, 7n];
  const tree = new MerkleTree(leaves);
  let node = 7n;
  let at = 2;
  for (const sib of tree.path(2)) {
    node = at & 1 ? h2(sib, node) : h2(node, sib);
    at >>= 1;
  }
  assert.equal(node, tree.root());
  assert.equal(new MerkleTree([]).root(), zeroAt(24));
});

test("note picking prefers one note and never more than two", () => {
  const n = (v: bigint, i: number): OwnedNote => ({ asset: 0, value: v, blinding: 1n, index: i, commitment: 0n, nullifier: BigInt(i) });
  const notes = [n(5n, 0), n(10n, 1), n(3n, 2)];
  assert.deepEqual(pickNotes(notes, 4n)?.map((x) => x.index), [0]);
  assert.deepEqual(pickNotes(notes, 12n)?.map((x) => x.index).sort(), [1, 2]);
  assert.equal(pickNotes(notes, 16n), null);
  assert.equal(transferFeeFor(1000n, 10n), 1n);
  assert.equal(transferFeeFor(0n, 10n), 0n);
});

/* ------------------------------------------------------------ circuit soundness */

function ownedNote(keys = A, value = 10n ** 18n, others: bigint[] = [99n]) {
  const blinding = randomField();
  const commitment = noteCommitment(0, value, keys.pk, blinding);
  const leaves = [...others, commitment];
  const index = leaves.length - 1;
  return { note: { asset: 0, value, blinding, index, commitment, nullifier: nullifierOf(commitment, index, keys.sk) }, tree: new MerkleTree(leaves) };
}

function plan(overrides: Partial<Parameters<typeof buildSpend>[0]> = {}) {
  const { note, tree } = ownedNote();
  return buildSpend({
    keys: A,
    asset: 0,
    inputs: [note],
    tree,
    exitValue: 10n ** 17n,
    feeBps: 10n,
    recipient: "0x00000000000000000000000000000000000000aa",
    relayer: "0x0000000000000000000000000000000000000000",
    relayerFee: 0n,
    chainId: 4663,
    pool: POOL,
    ...overrides,
  });
}

/** Deep copy of a witness (strings only). */
const copyOf = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

const rejects = (witness: Record<string, unknown>) => assert.rejects(noir.execute(witness as never));

test("an honest spend satisfies the circuit", async () => {
  await noir.execute(plan().witness as never);
  await noir.execute(plan({ pay: { pk: B.pk, viewPub: B.viewPub, value: 10n ** 17n } }).witness as never);
});

test("the circuit refuses a transfer fee below the bps rate", async () => {
  const p = plan({ pay: { pk: B.pk, viewPub: B.viewPub, value: 10n ** 17n }, exitValue: 0n });
  const w = copyOf(p.witness);
  const fee = BigInt(w.transfer_fee as string);
  assert.ok(fee > 0n);
  // Move the fee into the change output so value still balances: only the fee rule can catch it.
  const outs = (w.out_values as string[]).map(BigInt);
  const pks = (w.out_pks as string[]).map(BigInt);
  const changeAt = pks.findIndex((pk) => pk === A.pk);
  outs[changeAt] += fee;
  w.out_values = outs.map(toHex32);
  w.transfer_fee = toHex32(0n);
  await rejects(w);
});

test("the circuit refuses creating value", async () => {
  const w = copyOf(plan().witness);
  const outs = (w.out_values as string[]).map(BigInt);
  outs[0] += 1n;
  w.out_values = outs.map(toHex32);
  await rejects(w);
});

test("the circuit refuses a field wrap-around in output values", async () => {
  const w = copyOf(plan({ exitValue: 0n }).witness);
  const ins = (w.in_values as string[]).map(BigInt);
  const total = ins[0] + ins[1];
  // out0 = total + 1, out1 = p - 1: sums to total in the field, but out0 is not < 2^120... and out1 certainly is not.
  w.out_values = [toHex32(total + 1n), toHex32(FIELD - 1n)];
  await rejects(w);
});

test("the circuit refuses a note owned by another key", async () => {
  const { note, tree } = ownedNote(B);
  // B's note, A's spending key: the commitment A would compute is not in the tree.
  const p = buildSpend({ keys: A, asset: 0, inputs: [{ ...note, nullifier: nullifierOf(note.commitment, note.index, A.sk) }], tree, exitValue: 1n, feeBps: 10n, recipient: POOL, relayer: POOL, relayerFee: 0n, chainId: 4663, pool: POOL });
  await rejects(p.witness);
});

test("the circuit refuses a note that is not in the tree", async () => {
  const { note } = ownedNote();
  const p = buildSpend({ keys: A, asset: 0, inputs: [note], tree: new MerkleTree([1n, 2n]), exitValue: 1n, feeBps: 10n, recipient: POOL, relayer: POOL, relayerFee: 0n, chainId: 4663, pool: POOL });
  await rejects(p.witness);
});

test("the circuit refuses spending one note twice in a proof", async () => {
  const { note, tree } = ownedNote();
  const w = copyOf(buildSpend({ keys: A, asset: 0, inputs: [note, note], tree, exitValue: 1n, feeBps: 10n, recipient: POOL, relayer: POOL, relayerFee: 0n, chainId: 4663, pool: POOL }).witness);
  await rejects(w);
});

test("the circuit refuses a nullifier that does not belong to the note", async () => {
  const w = copyOf(plan().witness);
  (w.nullifiers as string[])[0] = toHex32(12345n);
  await rejects(w);
});
