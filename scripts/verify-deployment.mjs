// Proves that deployed contracts are exactly this repository's build, with the expected settings.
//
//   npm run verify-deployment -- <address> [--kind OarkelPool|HonkVerifier|PoseidonT3|PoseidonT4|ZKTranscriptLib|RelationsLib]
//        [--tx <creation tx>] [--rpc <url>]
//        [--verifier 0x…] [--token 0x…] [--fee-sink 0x…]
//        [--shroud-bps 25] [--transfer-bps 10] [--flat-eth-wei 500000000000000] [--flat-token <units>]
//
// Expected addresses default to src/config/contracts.ts (VERIFIER, FEE_SINK) and src/config/brand.ts (CA);
// fees default to the deploy defaults, the token fee to 20 tokens at the token's decimals.
//
// How it decides:
//   - Runtime code is compared byte for byte with src/lib/onchain/artifacts.json
//     (`npm run contracts:artifacts -- --check` proves that file is a fresh forge build).
//     Only three kinds of bytes may differ, and each is then checked on its own:
//       * a library's PUSH20 self-address (must equal the address being checked),
//       * linked library addresses (each library is verified the same way, recursively),
//       * immutables, decoded by name and compared to their expected values.
//   - The kind is taken from --kind or found by exact match, never guessed from size.
//   - With --tx, the creation input must equal this build's creation code (with the same
//     library links) followed by constructor arguments equal to the deployed immutables.
// Any FAIL exits non-zero.
import { readFileSync } from "node:fs";
import { keccak_256 } from "@noble/hashes/sha3.js";

const argv = process.argv.slice(2);
const opt = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const isAddr = (v) => typeof v === "string" && /^0x[0-9a-fA-F]{40}$/.test(v);
const target = (argv.find((a, i) => isAddr(a) && !argv[i - 1]?.startsWith("--")) || "").toLowerCase();
const RPC = opt("--rpc") || process.env.ROBINHOOD_RPC_URL || "https://rpc.mainnet.chain.robinhood.com";
if (!target) {
  console.log("usage: npm run verify-deployment -- <address> [--kind <name>] [--tx <hash>] [--rpc <url>] [--verifier|--token|--fee-sink 0x…]");
  process.exit(2);
}

const ART = JSON.parse(readFileSync(new URL("../src/lib/onchain/artifacts.json", import.meta.url), "utf8")).contracts;
const LIBS = ["PoseidonT3", "PoseidonT4", "ZKTranscriptLib", "RelationsLib"];
const KINDS = [...LIBS, "HonkVerifier", "OarkelPool"];

const fromConfig = (file, name) => {
  try {
    const m = new RegExp(`const ${name} = "(0x[0-9a-fA-F]{40})"`).exec(readFileSync(new URL(`../src/config/${file}`, import.meta.url), "utf8"));
    return m ? m[1].toLowerCase() : undefined;
  } catch {
    return undefined;
  }
};
const lower = (v) => (v ? v.toLowerCase() : undefined);
const EXPECT = {
  verifier: lower(opt("--verifier") || fromConfig("contracts.ts", "VERIFIER")),
  token: lower(opt("--token") || fromConfig("brand.ts", "CA")),
  feeSink: lower(opt("--fee-sink") || fromConfig("contracts.ts", "FEE_SINK")),
  shroudFeeBps: BigInt(opt("--shroud-bps") || 25),
  transferFeeBps: BigInt(opt("--transfer-bps") || 10),
  unshroudFeeEth: BigInt(opt("--flat-eth-wei") || "500000000000000"),
  unshroudFeeToken: opt("--flat-token") ? BigInt(opt("--flat-token")) : undefined,
};

const sel = (sig) => "0x" + Buffer.from(keccak_256(new TextEncoder().encode(sig))).toString("hex").slice(0, 8);
async function rpc(method, params) {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
      const body = await res.json();
      if (body.error) throw new Error(body.error.message);
      return body.result;
    } catch (e) {
      if (attempt >= 3) throw e;
      await new Promise((r) => setTimeout(r, 800));
    }
  }
}
const getCode = async (a) => ((await rpc("eth_getCode", [a, "latest"])) || "0x").toLowerCase();
const call = (to, data) => rpc("eth_call", [{ to, data }, "latest"]);
const slice = (hex, start, length) => hex.slice(2 + start * 2, 2 + (start + length) * 2);

let failed = false;
const ok = (msg) => console.log(`  OK    ${msg}`);
const fail = (msg) => {
  failed = true;
  console.log(`  FAIL  ${msg}`);
};
const expectEq = (label, actual, expected) => {
  if (expected === undefined) return fail(`${label} = ${actual}, but no expected value was given (pass it as a flag or set it in src/config)`);
  if (String(actual).toLowerCase() === String(expected).toLowerCase()) ok(`${label} = ${actual}`);
  else fail(`${label} = ${actual}, expected ${expected}`);
};

/** Writes `bytes(range)` (hex, no 0x) into `hex` at each range. */
const put = (hex, ranges, bytes) => {
  let out = hex.slice(2);
  for (const r of ranges) out = out.slice(0, r.start * 2) + bytes(r) + out.slice((r.start + r.length) * 2);
  return "0x" + out;
};

/**
 * Exact structural match: { links, immutables } when the code is this build's `kind` apart from
 * library addresses and immutables (whose values the caller then checks), else null.
 */
function match(kind, code, at) {
  const a = ART[kind];
  if (!a || code.length !== a.runtime.length) return null;
  if (LIBS.includes(kind)) {
    // A deployed library begins with PUSH20 <its own address>; nothing else may differ.
    return code === "0x73" + at.slice(2) + a.runtime.slice(44) ? { links: {}, immutables: {} } : null;
  }
  const links = {};
  for (const l of a.runtimeLinks) {
    const v = "0x" + slice(code, l.start, l.length);
    if (links[l.lib] && links[l.lib] !== v) return null;
    links[l.lib] = v;
  }
  const immutables = {};
  for (const r of a.immutables) {
    const v = slice(code, r.start, r.length);
    if (immutables[r.name] !== undefined && immutables[r.name] !== v) return null;
    immutables[r.name] = v;
  }
  const rebuilt = put(put(a.runtime, a.runtimeLinks, (r) => links[r.lib].slice(2)), a.immutables, (r) => immutables[r.name]);
  return rebuilt === code ? { links, immutables } : null;
}

const verified = new Map();

async function verify(kind, at) {
  at = at.toLowerCase();
  if (verified.has(at)) return verified.get(at);
  const code = await getCode(at);
  if (code === "0x") {
    fail(`${kind} at ${at}: no code`);
    return null;
  }
  const m = match(kind, code, at);
  verified.set(at, m);
  if (!m) {
    fail(`${kind} at ${at}: runtime code differs from this build`);
    return null;
  }
  ok(`${kind} at ${at}: runtime code is this build${LIBS.includes(kind) ? " (only the self-address differs)" : ""}`);
  for (const [lib, address] of Object.entries(m.links)) await verify(lib, address);
  if (kind === "PoseidonT3" || kind === "PoseidonT4") await poseidonVector(kind, at);
  if (kind === "HonkVerifier") {
    for (const [name, want] of Object.entries(ART.HonkVerifier.expectedImmutables)) expectEq(`HonkVerifier.${name}`, BigInt("0x" + m.immutables[name]).toString(), want);
  }
  if (kind === "OarkelPool") await poolSettings(at, m);
  return m;
}

async function poseidonVector(kind, at) {
  // An extra check; the exact bytecode match above is what proves the library.
  const [data, want] =
    kind === "PoseidonT3"
      ? [sel("hash(uint256[2])") + [1, 2].map((n) => n.toString(16).padStart(64, "0")).join(""), 0x115cc0f5e7d690413df64c6b9662e9cf2a3617f2743245519e19607a4417189an]
      : [sel("hash(uint256[3])") + [1, 2, 3].map((n) => n.toString(16).padStart(64, "0")).join(""), 0x0e7732d89e6939c0ff03d5e58dab6302f3230e269dc5b968f725df34ab36d732n];
  const out = await call(at, data).catch(() => "0x");
  if (out !== "0x" && BigInt(out) === want) ok(`${kind} hashes the circomlib reference vector`);
  else fail(`${kind} does not hash the reference vector`);
}

const asAddr = (hex) => "0x" + hex.slice(24);

async function poolSettings(at, m) {
  const im = m.immutables;
  const verifier = asAddr(im.verifier);
  const token = asAddr(im.token);
  expectEq("OarkelPool.verifier", verifier, EXPECT.verifier);
  await verify("HonkVerifier", verifier);
  expectEq("OarkelPool.token ($OARKEL)", token, EXPECT.token);
  expectEq("OarkelPool.feeSink", asAddr(im.feeSink), EXPECT.feeSink);
  expectEq("OarkelPool.shroudFeeBps", BigInt("0x" + im.shroudFeeBps), EXPECT.shroudFeeBps);
  expectEq("OarkelPool.transferFeeBps", BigInt("0x" + im.transferFeeBps), EXPECT.transferFeeBps);
  expectEq("OarkelPool.unshroudFeeEth (wei)", BigInt("0x" + im.unshroudFeeEth), EXPECT.unshroudFeeEth);
  let flatToken = EXPECT.unshroudFeeToken;
  if (flatToken === undefined) {
    const dec = await call(token, sel("decimals()")).catch(() => "0x");
    if (dec && dec !== "0x") flatToken = 20n * 10n ** BigInt(dec);
  }
  expectEq("OarkelPool.unshroudFeeToken (token units)", BigInt("0x" + im.unshroudFeeToken), flatToken);
  // Constants live in the compared bytecode; shown for the record.
  const depth = BigInt(await call(at, sel("TREE_DEPTH()")));
  const window = BigInt(await call(at, sel("ROOT_HISTORY()")));
  if (depth === 24n && window === 100n) ok(`tree depth ${depth}, root window ${window} (constants in the bytecode)`);
  else fail(`tree depth ${depth}, root window ${window}`);
}

async function checkCreation(kind, at, txHash) {
  const tx = await rpc("eth_getTransactionByHash", [txHash]);
  const receipt = await rpc("eth_getTransactionReceipt", [txHash]);
  if (!tx || !receipt) return fail("creation transaction not found");
  if (tx.to !== null) fail("the transaction is not a contract creation");
  if (receipt.status !== "0x1") fail("the creation transaction failed");
  if ((receipt.contractAddress || "").toLowerCase() !== at) return fail(`the transaction created ${receipt.contractAddress}, not ${at}`);
  const a = ART[kind];
  const links = verified.get(at)?.links ?? {};
  const creation = put(a.creation, a.creationLinks, (r) => (links[r.lib] ?? "0x" + "00".repeat(20)).slice(2));
  const input = tx.input.toLowerCase();
  if (!input.startsWith(creation)) return fail("creation input differs from this build's creation code");
  ok("creation input starts with this build's creation code (same library links)");
  const args = input.slice(creation.length);
  if (kind !== "OarkelPool") return args.length === 0 ? ok("no constructor arguments") : fail("unexpected constructor arguments");
  if (args.length !== 7 * 64) return fail(`constructor arguments have ${args.length / 2} bytes, expected ${7 * 32}`);
  const w = (i) => args.slice(i * 64, (i + 1) * 64);
  const im = verified.get(at)?.immutables ?? {};
  ["verifier", "token", "feeSink", "shroudFeeBps", "transferFeeBps", "unshroudFeeEth", "unshroudFeeToken"].forEach((name, i) =>
    im[name] === w(i) ? ok(`constructor ${name} = deployed ${name}`) : fail(`constructor ${name} (${w(i)}) differs from the deployed value`),
  );
}

console.log(`Checking ${target} on ${RPC.replace(/\/\/([^/]+).*/, "//$1")}`);
const code = await getCode(target);
let kind = opt("--kind");
if (kind && !KINDS.includes(kind)) {
  console.log(`unknown --kind ${kind}; one of ${KINDS.join(", ")}`);
  process.exit(2);
}
if (!kind) kind = KINDS.find((k) => match(k, code, target));
if (!kind) {
  fail("the code at that address matches none of this repository's contracts (pass --kind to check against one)");
} else {
  await verify(kind, target);
  const tx = opt("--tx");
  if (tx) await checkCreation(kind, target, tx);
  else console.log("  note  creation transaction not checked (pass --tx <hash> to compare creation code and constructor arguments)");
}
console.log(failed ? "\nMISMATCH" : `\nMATCH: ${target} is ${kind} from this repository's build, with the expected settings.`);
process.exit(failed ? 1 : 0);
