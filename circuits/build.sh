#!/usr/bin/env bash
# Rebuilds the transact circuit, its Solidity verifier and the browser artifact.
# Needs nargo 1.0.0-beta.22 and bb 5.0.0-nightly.20260522 (the versions bb.js and noir_js in package.json match).
#   ~/.nargo/bin/nargo, ~/.bb/bb (or on PATH)
# With --check it only reports whether the committed files match a fresh build.
set -euo pipefail
cd "$(dirname "$0")/transact"
NARGO="$(command -v nargo || echo ~/.nargo/bin/nargo)"
BB="$(command -v bb || echo ~/.bb/bb)"
"$NARGO" --version | head -1
"$BB" --version
"$NARGO" test
"$NARGO" compile
"$BB" write_vk -b target/transact.json -o target -t evm
"$BB" write_solidity_verifier -k target/vk -o target/HonkVerifier.sol -t evm
if [ "${1:-}" = "--check" ]; then
  cmp target/HonkVerifier.sol ../../contracts/src/HonkVerifier.sol && echo "verifier matches"
  node -e 'const a=require("./target/transact.json"),b=require("../../public/zk/transact.json");process.exit(a.bytecode===b.bytecode?0:1)' && echo "circuit artifact matches"
else
  cp target/HonkVerifier.sol ../../contracts/src/HonkVerifier.sol
  # Ship only what provers need; debug symbols and the file map carry local paths.
  node -e 'const j=require("./target/transact.json");const o={noir_version:j.noir_version,hash:j.hash,abi:j.abi,bytecode:j.bytecode};require("fs").writeFileSync("../../public/zk/transact.json",JSON.stringify(o))'

  echo "verifier and artifact updated"
fi
