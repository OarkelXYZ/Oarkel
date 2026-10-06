/*
 * Node prover for tests, the contract test harness (forge ffi) and tools.
 * Uses the same circuit artifact as the browser (public/zk/transact.json).
 */
import { readFileSync } from "node:fs";
import { Noir } from "@noir-lang/noir_js";
import { Barretenberg, UltraHonkBackend } from "@aztec/bb.js";

const CIRCUIT = JSON.parse(readFileSync(new URL("../../../public/zk/transact.json", import.meta.url), "utf8"));

let ready: Promise<{ noir: Noir; backend: UltraHonkBackend; api: Barretenberg }> | null = null;

function init() {
  ready ??= (async () => {
    const api = await Barretenberg.new({ threads: 4 });
    return { noir: new Noir(CIRCUIT), backend: new UltraHonkBackend(CIRCUIT.bytecode, api), api };
  })();
  return ready;
}

export async function proveNode(witness: Record<string, unknown>) {
  const { noir, backend } = await init();
  const { witness: solved } = await noir.execute(witness as never);
  const { proof, publicInputs } = await backend.generateProof(solved, { verifierTarget: "evm" });
  return { proof, publicInputs };
}

export async function verifyNode(proof: Uint8Array, publicInputs: string[]) {
  const { backend } = await init();
  return backend.verifyProof({ proof, publicInputs }, { verifierTarget: "evm" });
}

export async function closeProver() {
  if (!ready) return;
  const { api } = await ready;
  await api.destroy();
  ready = null;
}
