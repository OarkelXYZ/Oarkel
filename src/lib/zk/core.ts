/*
 * Note cryptography shared by the browser, the prover worker and the contract
 * tests. No framework imports: this file runs as-is in Node
 * (type stripping) and in a bundled worker.
 *
 * Hashes are circomlib-compatible Poseidon over BN254 (poseidon-lite). The
 * circuit (circuits/transact) and the contract (PoseidonT3/T4) use the same
 * instance; poseidon.test.ts and contracts/test/Poseidon.t.sol pin shared
 * vectors.
 *
 *   owner pk     = Poseidon1(sk)
 *   owner hash   = Poseidon2(pk, blinding)
 *   commitment   = Poseidon3(asset, value, owner hash)
 *   nullifier    = Poseidon3(commitment, leaf index, sk)
 */
import { poseidon1, poseidon2, poseidon3 } from "poseidon-lite";
import { hkdf } from "@noble/hashes/hkdf.js";
import { pbkdf2 } from "@noble/hashes/pbkdf2.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { x25519 } from "@noble/curves/ed25519.js";
import { chacha20poly1305 } from "@noble/ciphers/chacha.js";

export const FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
export const TREE_DEPTH = 24;
export const ASSET_ETH = 0;
export const ASSET_TOKEN = 1;
export type AssetId = typeof ASSET_ETH | typeof ASSET_TOKEN;
export const MAX_VALUE = (1n << 120n) - 1n;

/* ------------------------------------------------------------------ bytes */

export const hexToBytes = (hex: string) => {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (h.length % 2 || /[^0-9a-f]/i.test(h)) throw new Error("Not hex");
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(2 * i, 2 * i + 2), 16);
  return out;
};
export const bytesToHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
export const toHex32 = (n: bigint) => `0x${n.toString(16).padStart(64, "0")}`;
const bytesToBig = (b: Uint8Array) => (b.length ? BigInt(`0x${bytesToHex(b)}`) : 0n);
const bigToBytes = (n: bigint, len: number) => hexToBytes(n.toString(16).padStart(len * 2, "0"));
const utf8 = (s: string) => new TextEncoder().encode(s);

export function randomBytes(n: number) {
  const out = new Uint8Array(n);
  globalThis.crypto.getRandomValues(out);
  return out;
}

/** A uniformly random field element (31 random bytes are always below the field order). */
export const randomField = () => bytesToBig(randomBytes(31));

/* ------------------------------------------------------------------ hashes */

export const h1 = (a: bigint) => poseidon1([a]);
export const h2 = (a: bigint, b: bigint) => poseidon2([a, b]);
export const h3 = (a: bigint, b: bigint, c: bigint) => poseidon3([a, b, c]);

export const ownerHash = (pk: bigint, blinding: bigint) => h2(pk, blinding);
export const noteCommitment = (asset: number, value: bigint, pk: bigint, blinding: bigint) => h3(BigInt(asset), value, ownerHash(pk, blinding));
export const nullifierOf = (commitment: bigint, index: number, sk: bigint) => h3(commitment, BigInt(index), sk);

/* ------------------------------------------------------------------ keys */

/** Fixed SIWE nonce and time: the key message must be identical every time it is signed. */
export const KEY_NONCE = "oarkelnotekeys1";
export const KEY_ISSUED_AT = "2026-10-07T00:00:00.000Z";

/** EIP-55 checksum, as SIWE requires for the account line. */
export function checksumAddress(address: string) {
  const lower = address.toLowerCase().replace(/^0x/, "");
  if (!/^[0-9a-f]{40}$/.test(lower)) throw new Error("Not an address");
  const hash = bytesToHex(keccak_256(utf8(lower)));
  let out = "0x";
  for (let i = 0; i < 40; i++) out += parseInt(hash[i], 16) >= 8 ? lower[i].toUpperCase() : lower[i];
  return out;
}

/**
 * Domain the key message is bound to. Production always uses the canonical
 * domain (www should redirect to it); localhost is allowed for development
 * and gets its own, different keys.
 */
export function keyDomain(host: string, canonical: string) {
  const h = host.toLowerCase();
  if (/^(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(h)) return h;
  return canonical;
}

export type KeyMessageInput = { domain: string; address: string; chainId: number; pool?: string };

/**
 * The message a wallet signs to derive its note keys: an EIP-4361 (Sign-In
 * with Ethereum) message bound to the site's domain, so wallets that check
 * SIWE (MetaMask, Coinbase Wallet, Rabby) warn loudly when another site asks
 * for it. Nonce and Issued At are fixed so the same wallet always signs the
 * same text and recovers the same keys on any device.
 */
export function keyMessage({ domain, address, chainId, pool }: KeyMessageInput) {
  const scheme = /^(localhost|127\.0\.0\.1)/.test(domain) ? "http" : "https";
  const uri = `${scheme}://${domain}`;
  const lines = [
    `${domain} wants you to sign in with your Ethereum account:`,
    checksumAddress(address),
    "",
    `This signature controls your private Oarkel funds. Only sign it on ${uri}.`,
    "",
    `URI: ${uri}`,
    "Version: 1",
    `Chain ID: ${chainId}`,
    `Nonce: ${KEY_NONCE}`,
    `Issued At: ${KEY_ISSUED_AT}`,
  ];
  if (pool) lines.push("Resources:", `- urn:oarkel:pool:${pool.toLowerCase()}`);
  return lines.join("\n");
}

export type NoteKeys = {
  /** Spending key (field element). Proves ownership; never leaves the device. */
  sk: bigint;
  /** Public key in notes: Poseidon1(sk). */
  pk: bigint;
  /** x25519 key pair for reading notes sent to this wallet. */
  viewPriv: Uint8Array;
  viewPub: Uint8Array;
};

/** PBKDF2 rounds for the optional passphrase: slows guessing if a signature leaks. */
export const PASSPHRASE_ROUNDS = 200_000;

/**
 * Derives note keys from a personal_sign signature over keyMessage(), plus an
 * optional passphrase. Only the r and s bytes are used (wallets disagree on
 * the v byte). With a passphrase, PBKDF2-SHA256(passphrase, salt = r||s) is
 * appended to the key material, so a signature obtained by a phishing page is
 * not enough to spend; forgetting the passphrase makes the notes
 * unrecoverable. HKDF-SHA256 with separate labels then gives the spending key
 * (reduced into the field) and the x25519 viewing key. Keys stay in memory.
 */
export function deriveKeys(signature: string, passphrase = ""): NoteKeys {
  const sig = hexToBytes(signature);
  if (sig.length < 64) throw new Error("Signature too short");
  const rs = sig.slice(0, 64);
  let ikm = rs;
  const pass = passphrase.normalize("NFKC");
  if (pass) {
    const stretched = pbkdf2(sha256, utf8(pass), rs, { c: PASSPHRASE_ROUNDS, dkLen: 32 });
    ikm = new Uint8Array(96);
    ikm.set(rs, 0);
    ikm.set(stretched, 64);
  }
  const salt = utf8("oarkel-note-keys-v1");
  let sk = bytesToBig(hkdf(sha256, ikm, salt, utf8("spend"), 48)) % FIELD;
  if (sk === 0n) sk = 1n;
  const viewPriv = hkdf(sha256, ikm, salt, utf8("view"), 32);
  return { sk, pk: h1(sk), viewPriv, viewPub: x25519.getPublicKey(viewPriv) };
}

/** A shareable private address: the note public key plus the viewing key. */
export function encodeAddress(pk: bigint, viewPub: Uint8Array) {
  return `oarkel:${pk.toString(16).padStart(64, "0")}${bytesToHex(viewPub)}`;
}

export function decodeAddress(text: string): { pk: bigint; viewPub: Uint8Array } | null {
  const m = /^oarkel:([0-9a-f]{64})([0-9a-f]{64})$/i.exec(text.trim());
  if (!m) return null;
  const pk = BigInt(`0x${m[1]}`);
  if (pk === 0n || pk >= FIELD) return null;
  return { pk, viewPub: hexToBytes(m[2]) };
}

/* ------------------------------------------------------------------ encryption */

/** Plaintext: asset (1) | value (32) | blinding (32). A shroud note carries value 0: the pool computes it. */
const PLAIN = 65;
export const NOTE_CIPHER_BYTES = 1 + 32 + PLAIN + 16;

function noteKey(shared: Uint8Array, ephPub: Uint8Array, viewPub: Uint8Array) {
  const salt = new Uint8Array(64);
  salt.set(ephPub, 0);
  salt.set(viewPub, 32);
  return hkdf(sha256, shared, salt, utf8("oarkel-note"), 32);
}

/** Encrypts a note to a viewing key: x25519 with a fresh ephemeral key, then ChaCha20-Poly1305. */
export function encryptNote(viewPub: Uint8Array, asset: number, value: bigint, blinding: bigint) {
  const plain = new Uint8Array(PLAIN);
  plain[0] = asset;
  plain.set(bigToBytes(value, 32), 1);
  plain.set(bigToBytes(blinding, 32), 33);
  const ephPriv = x25519.utils.randomSecretKey();
  const ephPub = x25519.getPublicKey(ephPriv);
  const key = noteKey(x25519.getSharedSecret(ephPriv, viewPub), ephPub, viewPub);
  // Each message has its own key (fresh ephemeral), so a fixed nonce is safe.
  const sealed = chacha20poly1305(key, new Uint8Array(12)).encrypt(plain);
  const out = new Uint8Array(1 + 32 + sealed.length);
  out[0] = 1;
  out.set(ephPub, 1);
  out.set(sealed, 33);
  return `0x${bytesToHex(out)}`;
}

/** Returns the note fields if this payload was encrypted to `keys`, otherwise null. */
export function decryptNote(keys: Pick<NoteKeys, "viewPriv" | "viewPub">, payload: string) {
  let data: Uint8Array;
  try {
    data = hexToBytes(payload);
  } catch {
    return null;
  }
  if (data.length !== NOTE_CIPHER_BYTES || data[0] !== 1) return null;
  const ephPub = data.slice(1, 33);
  try {
    const key = noteKey(x25519.getSharedSecret(keys.viewPriv, ephPub), ephPub, keys.viewPub);
    const plain = chacha20poly1305(key, new Uint8Array(12)).decrypt(data.slice(33));
    return { asset: plain[0], value: bytesToBig(plain.slice(1, 33)), blinding: bytesToBig(plain.slice(33, 65)) };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ tree */

const ZEROS: bigint[] = (() => {
  const z = [0n];
  for (let i = 0; i < TREE_DEPTH; i++) z.push(h2(z[i], z[i]));
  return z;
})();
export const zeroAt = (level: number) => ZEROS[level];

/**
 * The pool's Merkle tree rebuilt from its leaves (in leaf order). Only the
 * filled part is stored; empty subtrees use the zero hashes.
 */
export class MerkleTree {
  private levels: bigint[][];
  constructor(leaves: bigint[]) {
    this.levels = [leaves.slice()];
    for (let l = 0; l < TREE_DEPTH; l++) {
      const below = this.levels[l];
      const up: bigint[] = [];
      for (let i = 0; i < below.length; i += 2) up.push(h2(below[i], i + 1 < below.length ? below[i + 1] : ZEROS[l]));
      this.levels.push(up);
    }
  }
  get size() {
    return this.levels[0].length;
  }
  root() {
    return this.levels[TREE_DEPTH][0] ?? ZEROS[TREE_DEPTH];
  }
  path(index: number) {
    if (index < 0 || index >= this.size) throw new Error("Leaf out of range");
    const out: bigint[] = [];
    let at = index;
    for (let l = 0; l < TREE_DEPTH; l++) {
      const sibling = at ^ 1;
      out.push(this.levels[l][sibling] ?? ZEROS[l]);
      at >>= 1;
    }
    return out;
  }
}

/* ------------------------------------------------------------------ external data */

export type ExtData = {
  recipient: string;
  relayer: string;
  relayerFee: bigint;
  encryptedOutput0: string;
  encryptedOutput1: string;
};

const word = (n: bigint | number) => BigInt(n).toString(16).padStart(64, "0");
const addr = (a: string) => a.toLowerCase().replace(/^0x/, "").padStart(64, "0");
const dynBytes = (hex: string) => {
  const h = hex.replace(/^0x/, "");
  return word(h.length / 2) + h.padEnd(Math.ceil(h.length / 64) * 64, "0");
};

/** ABI encoding of the ExtData tuple (it is dynamic: two `bytes` fields). */
export function encodeExtData(ext: ExtData) {
  const b0 = dynBytes(ext.encryptedOutput0);
  const b1 = dynBytes(ext.encryptedOutput1);
  const head = addr(ext.recipient) + addr(ext.relayer) + word(ext.relayerFee) + word(5 * 32) + word(5 * 32 + b0.length / 2);
  return head + b0 + b1;
}

/** keccak256(abi.encode(chainId, pool, ext)) mod p, exactly as OarkelPool.extDataHash. */
export function extDataHash(chainId: number, pool: string, ext: ExtData) {
  const encoded = word(chainId) + addr(pool) + word(3 * 32) + encodeExtData(ext);
  return bytesToBig(keccak_256(hexToBytes(encoded))) % FIELD;
}

export const keccakHex = (data: Uint8Array) => `0x${bytesToHex(keccak_256(data))}`;
export const selector = (signature: string) => keccakHex(utf8(signature)).slice(0, 10);
