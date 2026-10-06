// Relayer abuse tests against a local devnet with OarkelPool deployed (anvil).
//   TEST_RPC=http://127.0.0.1:8591 TEST_POOL=0x… TEST_POOL_BLOCK=<deploy block> node --test keeper/test/relayer.test.mjs
// Skips when TEST_RPC / TEST_POOL are not set. Uses anvil's unlocked dev account #5 to shroud.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import net from "node:net";
import { fileURLToPath } from "node:url";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { deriveKeys, encryptNote, ownerHash, randomField, noteCommitment, nullifierOf } from "../../src/lib/zk/core.ts";
import { buildSpend } from "../../src/lib/zk/plan.ts";
import { TOPIC, encodeShroud, encodeUnshroud, leavesFromLogs } from "../../src/lib/zk/calls.ts";
import { MerkleTree } from "../../src/lib/zk/core.ts";
import { proveNode, closeProver } from "../../src/lib/zk/prover-node.ts";

const RPC = process.env.TEST_RPC;
const POOL = process.env.TEST_POOL;
const FROM_BLOCK = Number(process.env.TEST_POOL_BLOCK || 0);
const skip = !RPC || !POOL;
const DEV = "0x9965507d1a55bcc2695c58ba16fb37d819b0a4dc";

const rpc = async (method, params) => {
  const j = await (await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) })).json();
  if (j.error) throw new Error(j.error.message);
  return j.result;
};
const procs = [];
async function startRelayer(port, extra = {}) {
  const dir = mkdtempSync(tmpdir() + "/relayer-test-");
  const key = generatePrivateKey();
  writeFileSync(dir + "/relayer.key", key + "\n", { mode: 0o400 });
  const address = privateKeyToAccount(key).address;
  await rpc("anvil_setBalance", [address, "0x8ac7230489e80000"]);
  const p = spawn(process.execPath, [fileURLToPath(new URL("../relayer.mjs", import.meta.url))], {
    env: { ...process.env, POOL_ADDRESS: POOL, RELAYER_RPC_URL: RPC, RELAYER_KEY_FILE: dir + "/relayer.key", RELAYER_PORT: String(port), ...extra },
    stdio: ["ignore", "pipe", "pipe"],
  });
  p.log = "";
  p.stdout.on("data", (d) => (p.log += d));
  p.stderr.on("data", (d) => (p.log += d));
  procs.push(p);
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  return { url: `http://127.0.0.1:${port}`, address, proc: p };
}
const post = (url, body, headers = {}) => fetch(url + "/relay", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });

let limited, main;
before(async () => {
  if (skip) return;
  limited = await startRelayer(8611, { RELAYER_PER_IP_PER_MIN: "3", RELAYER_TRUST_PROXY: "0" });
  main = await startRelayer(8612, { RELAYER_PER_IP_PER_MIN: "100" });
});
after(async () => {
  for (const p of procs) p.kill();
  await closeProver();
});

test("spoofed x-forwarded-for does not reset the per-client limit", { skip }, async () => {
  const codes = [];
  for (let i = 0; i < 6; i++) codes.push((await post(limited.url, "{}", { "x-forwarded-for": `10.0.0.${i}, 203.0.113.${i}` })).status);
  assert.deepEqual(codes.slice(0, 3), [400, 400, 400]);
  assert.ok(codes.slice(3).every((c) => c === 429), codes.join(","));
});

test("malformed, oversized and slow bodies get answers and the process stays up", { skip }, async () => {
  assert.equal((await post(main.url, "{not json")).status, 400);
  assert.equal((await post(main.url, { kind: "x" })).status, 400);
  assert.equal((await post(main.url, "x".repeat(100_000))).status, 413);
  // A slow client: headers and half a body, then silence.
  const sock = net.connect(8612, "127.0.0.1");
  sock.on("error", () => {});
  sock.write("POST /relay HTTP/1.1\r\nHost: x\r\nContent-Type: application/json\r\nContent-Length: 1000\r\n\r\n{\"kind\":");
  await new Promise((r) => setTimeout(r, 500));
  assert.equal((await fetch(main.url + "/health")).status, 200);
  sock.destroy();
  assert.equal(main.proc.exitCode, null, "relayer still running");
});

test("token-fee spends are refused before any chain work", { skip }, async () => {
  const fakeExt = { recipient: DEV, relayer: main.address, relayerFee: 10n ** 20n, encryptedOutput0: "0x", encryptedOutput1: "0x" };
  const fakeArgs = { root: 1n, asset: 1, nullifiers: [1n, 2n], commitments: [3n, 4n], exitValue: 5n, transferFee: 0n };
  const r = await post(main.url, { kind: "unshroud", data: encodeUnshroud("0x00", fakeArgs, fakeExt) });
  assert.equal(r.status, 400);
  assert.match((await r.json()).error, /ETH/);
});

async function provenUnshroud(relayer, relayerFee) {
  const keys = deriveKeys("0x" + randomField().toString(16).padStart(64, "0") + "00".repeat(32) + "1b");
  const blinding = randomField();
  const amount = 10n ** 17n;
  const data = encodeShroud(0, amount, ownerHash(keys.pk, blinding), encryptNote(keys.viewPub, 0, 0n, blinding));
  const hash = await rpc("eth_sendTransaction", [{ from: DEV, to: POOL, data, value: "0x" + amount.toString(16) }]);
  for (let i = 0; i < 40 && !(await rpc("eth_getTransactionReceipt", [hash])); i++) await new Promise((r) => setTimeout(r, 250));
  const head = Number(await rpc("eth_blockNumber", []));
  const logs = [];
  for (let from = FROM_BLOCK; from <= head; from += 5000) {
    logs.push(...(await rpc("eth_getLogs", [{ address: POOL, fromBlock: "0x" + from.toString(16), toBlock: "0x" + Math.min(head, from + 4999).toString(16), topics: [[TOPIC.NewCommitment, TOPIC.Shrouded]] }])));
  }
  const leaves = leavesFromLogs(logs);
  const value = amount - (amount * 25n + 9999n) / 10000n;
  const c = noteCommitment(0, value, keys.pk, blinding);
  const leaf = leaves.find((l) => BigInt(l.c) === c);
  const note = { asset: 0, value, blinding, index: leaf.i, commitment: c, nullifier: nullifierOf(c, leaf.i, keys.sk) };
  const plan = buildSpend({ keys, asset: 0, inputs: [note], tree: new MerkleTree(leaves.map((l) => BigInt(l.c))), exitValue: value, feeBps: 10n, recipient: DEV, relayer, relayerFee, chainId: Number(await rpc("eth_chainId", [])), pool: POOL });
  const { proof } = await proveNode(plan.witness);
  return encodeUnshroud("0x" + Buffer.from(proof).toString("hex"), plan.args, plan.ext);
}

test("a fee below the gas cost is refused", { skip, timeout: 120_000 }, async () => {
  const data = await provenUnshroud(main.address, 1n);
  const r = await post(main.url, { kind: "unshroud", data });
  assert.equal(r.status, 400);
  assert.match((await r.json()).error, /fee too low/i);
});

test("the same proof is relayed once; a repeat is refused", { skip, timeout: 120_000 }, async () => {
  const data = await provenUnshroud(main.address, 5n * 10n ** 16n);
  const [a, b] = await Promise.all([post(main.url, { kind: "unshroud", data }), post(main.url, { kind: "unshroud", data })]);
  const bodies = [await a.json(), await b.json()];
  const codes = [a.status, b.status].sort();
  if (codes[0] !== 200) console.log(bodies, main.proc.log.slice(-800));
  assert.deepEqual(codes, [200, 400]);
  const refused = a.status === 400 ? bodies[0] : bodies[1];
  assert.match(refused.error, /already (being relayed|spent)/);
  assert.equal(main.proc.exitCode, null);
});
