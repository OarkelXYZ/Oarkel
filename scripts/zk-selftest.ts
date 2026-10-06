// Proves one shroud-then-unshroud spend in Node and checks the proof off-chain.
import { MerkleTree, deriveKeys, noteCommitment, nullifierOf, ownerHash, randomField, decryptNote } from "../src/lib/zk/core.ts";
import { buildSpend } from "../src/lib/zk/plan.ts";
import { proveNode, verifyNode, closeProver } from "../src/lib/zk/prover-node.ts";

const keys = deriveKeys("0x" + "11".repeat(65));
const blinding = randomField();
const value = 10n ** 18n;
const c = noteCommitment(0, value, keys.pk, blinding);
const tree = new MerkleTree([123n, c]);
const note = { asset: 0, value, blinding, index: 1, commitment: c, nullifier: nullifierOf(c, 1, keys.sk) };
console.log("owner hash", ownerHash(keys.pk, blinding).toString(16).slice(0, 8));
const plan = buildSpend({ keys, asset: 0, inputs: [note], tree, exitValue: value / 2n, feeBps: 10n, recipient: "0x00000000000000000000000000000000000000aa", relayer: "0x0000000000000000000000000000000000000000", relayerFee: 0n, chainId: 4663, pool: "0x00000000000000000000000000000000000000bb" });
const mine = plan.outputs.map((o, i) => decryptNote(keys, [plan.ext.encryptedOutput0, plan.ext.encryptedOutput1][i]));
console.log("decrypted", mine.map((m) => m?.value.toString()));
let t = Date.now();
const { proof, publicInputs } = await proveNode(plan.witness);
console.log("proved in", Date.now() - t, "ms; proof bytes", proof.length, "public inputs", publicInputs.length);
t = Date.now();
console.log("verify", await verifyNode(proof, publicInputs), Date.now() - t, "ms");
await closeProver();
