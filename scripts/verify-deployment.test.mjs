// verify-deployment against a devnet (referensi-style devnet.sh output):
//   TEST_RPC=http://127.0.0.1:8595 TEST_DEVNET='{"pool":…,"poolTx":…,"verifier":…,"token":…,"t3":…}' node --test scripts/verify-deployment.test.mjs
// Uses anvil cheat methods (anvil_setCode) to tamper with contracts. Skips without TEST_RPC.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const RPC = process.env.TEST_RPC;
const D = process.env.TEST_DEVNET ? JSON.parse(process.env.TEST_DEVNET) : null;
const skip = !RPC || !D;
const SCRIPT = fileURLToPath(new URL("./verify-deployment.mjs", import.meta.url));
const FEE_SINK = "0xa0ee7a142d267c1f36714e4a8f75612f20a79720";

const rpc = async (method, params) => {
  const j = await (await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) })).json();
  if (j.error) throw new Error(j.error.message);
  return j.result;
};
const run = (...args) => spawnSync(process.execPath, [SCRIPT, ...args, "--rpc", RPC], { encoding: "utf8" });
const expected = () => ["--verifier", D.verifier, "--token", D.token, "--fee-sink", FEE_SINK];

test("the devnet deployment matches, including the creation transaction", { skip }, () => {
  const r = run(D.pool, ...expected(), "--tx", D.poolTx);
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /MATCH: .* is OarkelPool/);
  assert.doesNotMatch(r.stdout, /FAIL/);
});

test("wrong expected settings fail", { skip }, () => {
  assert.equal(run(D.pool, ...expected(), "--shroud-bps", "30").status, 1);
  assert.equal(run(D.pool, "--verifier", D.verifier, "--token", D.verifier, "--fee-sink", FEE_SINK).status, 1);
  assert.equal(run(D.pool, "--verifier", D.verifier, "--token", D.token).status, 1, "a missing expected fee sink is a failure, not a pass");
});

test("a pool wired to another verifier fails", { skip, timeout: 120_000 }, () => {
  const cwd = fileURLToPath(new URL("../contracts/", import.meta.url));
  const create = (...a) =>
    execFileSync(process.env.HOME + "/.foundry/bin/forge", ["create", "--rpc-url", RPC, "--unlocked", "--from", "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266", "--broadcast", ...a], { cwd, encoding: "utf8" })
      .match(/Deployed to: (0x[0-9a-fA-F]{40})/)[1];
  const fake = create("test/Mocks.sol:AcceptAllVerifier");
  const libs = ["--libraries", `src/poseidon/PoseidonT3.sol:PoseidonT3:${D.t3}`, "--libraries", `src/poseidon/PoseidonT4.sol:PoseidonT4:${D.t4}`];
  const evil = create("src/OarkelPool.sol:OarkelPool", ...libs, "--constructor-args", fake, D.token, FEE_SINK, "25", "10", "500000000000000", "20000000000000000000");
  execFileSync(process.env.HOME + "/.foundry/bin/forge", ["build", "--force"], { cwd });
  const r = run(evil, ...expected());
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stdout, /FAIL\s+OarkelPool.verifier/);
  assert.match(r.stdout, /FAIL\s+HonkVerifier at .*differs/);
});

test("a tampered library fails, even when it still hashes the reference vector", { skip }, async () => {
  const code = await rpc("eth_getCode", [D.t3, "latest"]);
  // Flip one byte near the end (outside the PUSH20 prefix).
  const i = code.length - 10;
  const flipped = code.slice(0, i) + ((parseInt(code.slice(i, i + 2), 16) ^ 1).toString(16).padStart(2, "0")) + code.slice(i + 2);
  await rpc("anvil_setCode", [D.t3, flipped]);
  try {
    const r = run(D.pool, ...expected());
    assert.equal(r.status, 1, r.stdout);
    assert.match(r.stdout, /FAIL\s+PoseidonT3 at .*differs/);
  } finally {
    await rpc("anvil_setCode", [D.t3, code]);
  }
});

test("a library checked as the wrong kind fails; the kind is never guessed from size", { skip }, () => {
  assert.equal(run(D.t3, "--kind", "PoseidonT4").status, 1);
  const r = run(D.t3);
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /is PoseidonT3/);
});
