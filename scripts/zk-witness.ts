// Prints one honest spend witness as JSON (used to test the browser prover).
import { MerkleTree, deriveKeys, noteCommitment, nullifierOf, randomField } from "../src/lib/zk/core.ts";
import { buildSpend } from "../src/lib/zk/plan.ts";
const keys = deriveKeys("0x" + "11".repeat(65));
const blinding = randomField();
const value = 10n ** 18n;
const c = noteCommitment(0, value, keys.pk, blinding);
const tree = new MerkleTree([123n, c]);
const note = { asset: 0, value, blinding, index: 1, commitment: c, nullifier: nullifierOf(c, 1, keys.sk) };
const plan = buildSpend({ keys, asset: 0, inputs: [note], tree, exitValue: value / 2n, feeBps: 10n, recipient: "0x00000000000000000000000000000000000000aa", relayer: "0x0000000000000000000000000000000000000000", relayerFee: 0n, chainId: 4663, pool: "0x00000000000000000000000000000000000000bb" });
process.stdout.write(JSON.stringify(plan.witness));
