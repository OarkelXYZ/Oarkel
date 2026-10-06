// Test helper called by forge (vm.ffi): builds and proves spends with the
// same TypeScript code the site uses, and prints ABI-encoded results.
//   node zk.mts pk <signature>                 -> abi.encode(uint256 pk)
//   node zk.mts spend <json>                   -> abi.encode(bytes proof, uint256[8] pub, bytes enc0, bytes enc1, uint256[2] outValues, uint256[2] outBlindings, uint256[2] outPks)
import { MerkleTree, deriveKeys, noteCommitment, nullifierOf } from "../../../src/lib/zk/core.ts";
import { buildSpend } from "../../../src/lib/zk/plan.ts";
import { proveNode, closeProver } from "../../../src/lib/zk/prover-node.ts";

// bb.js reports progress on stdout; keep stdout for the ABI result only.
console.log = (...a: unknown[]) => console.error(...a);

const w = (n: bigint | number) => BigInt(n).toString(16).padStart(64, "0");
const bytesTail = (hex: string) => {
  const h = hex.replace(/^0x/, "");
  return w(h.length / 2) + h.padEnd(Math.ceil(h.length / 64) * 64, "0");
};

const [cmd, arg] = process.argv.slice(2);
if (cmd === "pk") {
  process.stdout.write("0x" + w(deriveKeys(arg).pk));
} else if (cmd === "spend") {
  const j = JSON.parse(arg);
  const keys = deriveKeys(j.sig);
  const leaves = (j.leaves as string[]).map(BigInt);
  const tree = new MerkleTree(leaves);
  const inputs = (j.notes as { value: string; blinding: string; index: number }[]).map((n) => {
    const commitment = noteCommitment(j.asset, BigInt(n.value), keys.pk, BigInt(n.blinding));
    if (leaves[n.index] !== commitment && !j.allowMissing) throw new Error(`note ${n.index} not at its leaf`);
    return { asset: j.asset, value: BigInt(n.value), blinding: BigInt(n.blinding), index: n.index, commitment, nullifier: nullifierOf(commitment, n.index, keys.sk) };
  });
  const payKeys = j.paySig ? deriveKeys(j.paySig) : null;
  const plan = buildSpend({
    keys,
    asset: j.asset,
    inputs,
    tree,
    pay: payKeys ? { pk: payKeys.pk, viewPub: payKeys.viewPub, value: BigInt(j.payValue) } : undefined,
    exitValue: BigInt(j.exitValue),
    feeBps: BigInt(j.feeBps),
    recipient: j.recipient,
    relayer: j.relayer,
    relayerFee: BigInt(j.relayerFee),
    chainId: j.chainId,
    pool: j.pool,
  });
  if (j.overrideFee !== undefined) {
    // Negative tests: claim a different transfer fee than the circuit allows (proving must fail).
    plan.witness.transfer_fee = "0x" + w(BigInt(j.overrideFee));
  }
  const { proof } = await proveNode(plan.witness);
  const a = plan.args;
  const pub = [a.root, BigInt(a.asset), a.nullifiers[0], a.nullifiers[1], a.commitments[0], a.commitments[1], a.exitValue, a.transferFee];
  const proofHex = Buffer.from(proof).toString("hex");
  const tails = [bytesTail(proofHex), bytesTail(plan.ext.encryptedOutput0), bytesTail(plan.ext.encryptedOutput1)];
  const headWords = 1 + 8 + 1 + 1 + 2 + 2 + 2;
  let offset = headWords * 32;
  const offsets: bigint[] = [];
  for (const t of tails) {
    offsets.push(BigInt(offset));
    offset += t.length / 2;
  }
  const head =
    w(offsets[0]) +
    pub.map(w).join("") +
    w(offsets[1]) +
    w(offsets[2]) +
    plan.outputs.map((o) => w(o.value)).join("") +
    plan.outputs.map((o) => w(o.blinding)).join("") +
    plan.outputs.map((o) => w(o.pk)).join("");
  process.stdout.write("0x" + head + tails.join(""));
  await closeProver();
} else {
  console.error("unknown command");
  process.exit(1);
}
