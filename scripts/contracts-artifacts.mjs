// Collects the compiled contracts the site deploys and verifies into one generated file:
//   src/lib/onchain/artifacts.json  (creation + runtime bytecode, link and immutable references)
// Run after `forge build` in contracts/ (unlinked build: no --libraries):
//   (cd contracts && ./setup.sh && forge build --force) && node scripts/contracts-artifacts.mjs
// With --check it only compares the committed file against a fresh forge build.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const OUT = new URL("../contracts/out/", import.meta.url);
const TARGET = new URL("../src/lib/onchain/artifacts.json", import.meta.url);
const NAMES = [
  ["PoseidonT3", "PoseidonT3.sol"],
  ["PoseidonT4", "PoseidonT4.sol"],
  ["ZKTranscriptLib", "HonkVerifier.sol"],
  ["RelationsLib", "HonkVerifier.sol"],
  ["HonkVerifier", "HonkVerifier.sol"],
  ["OarkelPool", "OarkelPool.sol"],
  ["OarkelSwap", "OarkelSwap.sol"],
];

const flatLinks = (refs) =>
  Object.values(refs ?? {}).flatMap((byLib) => Object.entries(byLib).flatMap(([lib, list]) => list.map((r) => ({ lib, start: r.start, length: r.length }))));

/** Immutable byte ranges with the name of the variable they hold (from the AST). */
function namedImmutables(a) {
  const refs = a.deployedBytecode.immutableReferences ?? {};
  const names = {};
  const walk = (n) => {
    if (!n || typeof n !== "object") return;
    if (n.nodeType === "VariableDeclaration" && refs[String(n.id)]) names[n.id] = n.name;
    for (const v of Object.values(n)) walk(v);
  };
  walk(a.ast);
  return Object.entries(refs).flatMap(([id, list]) => {
    if (!names[id]) throw new Error(`no name for immutable ${id} (build with ast = true)`);
    return list.map((r) => ({ name: names[id], start: r.start, length: r.length }));
  });
}

/** The verifier's immutables are fixed by constants in its generated source. */
function verifierConstants() {
  const src = readFileSync(new URL("../contracts/src/HonkVerifier.sol", import.meta.url), "utf8");
  const c = (name) => BigInt(new RegExp(`uint256 constant ${name} = (0x[0-9a-fA-F]+|\\d+);`).exec(src)[1]);
  const logN = c("LOG_N");
  const libra = BigInt(/LIBRA_COMMITMENTS = (\d+);/.exec(src)[1]);
  return {
    $LOG_N: logN.toString(),
    $VK_HASH: c("VK_HASH").toString(),
    $NUM_PUBLIC_INPUTS: c("NUMBER_OF_PUBLIC_INPUTS").toString(),
    // $MSMSize = NUMBER_UNSHIFTED + NUM_MASKING_POLYNOMIALS + LOG_N + LIBRA_COMMITMENTS + 2 (constructor of BaseZKHonkVerifier)
    $MSMSize: (c("NUMBER_UNSHIFTED") + c("NUM_MASKING_POLYNOMIALS") + logN + libra + 2n).toString(),
  };
}

const contracts = {};
for (const [name, file] of NAMES) {
  const a = JSON.parse(readFileSync(new URL(`${file}/${name}.json`, OUT), "utf8"));
  const creation = a.bytecode.object.toLowerCase();
  const runtime = a.deployedBytecode.object.toLowerCase();
  if (!creation.startsWith("0x") || creation.length < 10) throw new Error(`${name}: no bytecode (build first)`);
  contracts[name] = {
    creation,
    runtime,
    creationLinks: flatLinks(a.bytecode.linkReferences),
    runtimeLinks: flatLinks(a.deployedBytecode.linkReferences),
    immutables: namedImmutables(a),
    sha256: createHash("sha256").update(creation).digest("hex"),
  };
}
contracts.HonkVerifier.expectedImmutables = verifierConstants();
const out = {
  generatedBy: "scripts/contracts-artifacts.mjs",
  compiler: "solc 0.8.28, optimizer 200 runs, evm paris, no via-ir, no metadata hash",
  contracts,
};
const text = JSON.stringify(out, null, 1) + "\n";
if (process.argv.includes("--check")) {
  const same = readFileSync(TARGET, "utf8") === text;
  console.log(same ? "artifacts.json matches this forge build" : "artifacts.json DIFFERS from this forge build");
  process.exit(same ? 0 : 1);
}
writeFileSync(TARGET, text);
for (const [n, c] of Object.entries(contracts)) console.log(`${n}: ${(c.creation.length - 2) / 2} bytes, sha256 ${c.sha256.slice(0, 16)}…`);
