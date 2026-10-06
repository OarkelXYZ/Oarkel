#!/usr/bin/env node
/*
 * Checks a token address on Robinhood Chain before it is published as the
 * official contract address:
 *
 *   node tools/verify-token.mjs 0xYourTokenAddress
 *
 * Confirms the RPC is on chain 4663, that the address holds contract code,
 * and prints name, symbol, decimals and total supply as read on chain, plus
 * whether the Pons factory knows it. Read-only; nothing is signed or sent.
 * Uses ROBINHOOD_RPC_URL when set, then the public RPCs.
 */
const RPCS = [process.env.ROBINHOOD_RPC_URL, "https://rpc.mainnet.chain.robinhood.com", "https://robinhood-rpc.publicnode.com"].filter(Boolean);
const PONS_FACTORY = "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e";
const address = (process.argv[2] || "").trim();
if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
  console.error("Usage: node tools/verify-token.mjs 0x<40 hex characters>");
  process.exit(1);
}
async function call(method, params) {
  let last;
  for (const url of RPCS) {
    try {
      const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
      const body = await res.json();
      if (body.error) throw new Error(body.error.message);
      return body.result;
    } catch (error) {
      last = error; // unreachable endpoint (or an intercepted one): try the next
    }
  }
  throw last;
}
const str = (hex) => {
  if (!hex || hex.length < 130) return "";
  const len = Number(BigInt("0x" + hex.slice(66, 130)));
  return Buffer.from(hex.slice(130, 130 + len * 2), "hex").toString("utf8");
};
const chainId = Number(BigInt(await call("eth_chainId", [])));
if (chainId !== 4663) throw new Error(`RPC is on chain ${chainId}, expected 4663 (Robinhood Chain)`);
const code = await call("eth_getCode", [address, "latest"]);
if (!code || code === "0x") throw new Error("No contract code at that address on Robinhood Chain.");
const [name, symbol, decimals, supply] = await Promise.all(
  ["0x06fdde03", "0x95d89b41", "0x313ce567", "0x18160ddd"].map((data) => call("eth_call", [{ to: address, data }, "latest"]).catch(() => null)),
);
const dec = decimals ? Number(BigInt(decimals)) : null;
console.log("chain id      ", chainId);
console.log("contract code ", `${(code.length - 2) / 2} bytes`);
console.log("name          ", str(name) || "(none)");
console.log("symbol        ", str(symbol) || "(none)");
console.log("decimals      ", dec ?? "(none)");
console.log("total supply  ", supply && dec !== null ? (Number(BigInt(supply) / 10n ** BigInt(Math.max(0, dec - 4))) / 1e4).toLocaleString("en-US") : "(none)");
const ok = str(symbol).toUpperCase() === "OARKEL";
console.log(ok ? "symbol matches OARKEL" : "WARNING: symbol is not OARKEL");
console.log("pons factory  ", PONS_FACTORY, "(check the launch page on ponsfamily.com before publishing)");
process.exit(ok ? 0 : 2);
