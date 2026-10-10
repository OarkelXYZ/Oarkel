// Creates keys/relayer.key (mode 400) and prints only the address to fund.
//   docker compose run --rm -v "$PWD/keys:/out" relayer node make-key.mjs
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const path = "/out/relayer.key";
mkdirSync("/out", { recursive: true });
if (!existsSync(path)) writeFileSync(path, generatePrivateKey() + "\n", { mode: 0o400 });
console.log(privateKeyToAccount(readFileSync(path, "utf8").trim()).address);
