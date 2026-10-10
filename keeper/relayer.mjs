// Oarkel relayer: submits a user's pool transaction (transact or unshroud) from
// its own hot wallet and is paid from the user's notes.
//
// It holds no power over anyone's funds. The proof binds the recipient, the
// relayer address and the relayer fee, so the relayer can only submit the
// transaction exactly as the user built it, or refuse.
//
// What it protects is its own gas. Before sending it checks, in order: it is
// the named relayer; the spend pays in ETH (token fees are refused until the
// relayer can price them on chain); the fee covers the estimated gas at the
// current gas price times a margin; no other request with the same nullifiers
// is in flight; the nullifiers are unspent and the root is known; and a fresh
// eth_call succeeds right before the transaction is signed. It stops taking
// work when the hot wallet runs low or too many of its transactions are
// pending. The pool itself only accepts a relayer-paid spend from the named
// relayer, so nobody can land the same proof first; a user can still spend
// the same note with a second proof between the last check and inclusion.
// Networks whose requests end in reverted transactions are backed off, and
// the gas lost to reverts is added to the fee the relayer asks for.
//
// Config (environment, see relayer.conf.example):
//   POOL_ADDRESS               OarkelPool address (the relayer idles while empty)
//   RELAYER_RPC_URL            Robinhood Chain RPC (default: public endpoint)
//   RELAYER_CHAIN_ID           default 4663
//   RELAYER_KEY_FILE           file holding the hot wallet's private key (0x + 64 hex)
//   RELAYER_PORT               default 8080
//   RELAYER_FEE_ETH_WEI        floor for the ETH fee (default 0.0002 ETH)
//   RELAYER_GAS_MARGIN_PCT     fee must be >= gas x price x this / 100 (default 150)
//   RELAYER_ALLOWED_ORIGINS    comma-separated CORS origins (default https://oarkel.xyz)
//   RELAYER_MAX_GAS            refuse transactions estimated above this (default 12,000,000)
//   RELAYER_TYPICAL_GAS        gas used to quote the fee on /info (default 7,000,000)
//   SWAP_ADDRESS               OarkelSwap; set to also carry private swaps (fee in ETH from the swap terms)
//   RELAYER_SWAP_TYPICAL_GAS   gas used to quote the swap fee on /info (default 8,500,000)
//   RELAYER_MAX_PENDING        max own transactions not yet mined (default 3)
//   RELAYER_MIN_BALANCE_WEI    stop accepting work below this balance (default 0.002 ETH)
//   RELAYER_PER_IP_PER_MIN     per client (IPv4 or IPv6 /64) per minute (default 6)
//   RELAYER_MAX_PER_MIN        submissions per minute for the whole relayer (default 30)
//   RELAYER_TRUST_PROXY        1 = read x-forwarded-for (only behind your own proxy)
//   RELAYER_PROXY_HOPS         which x-forwarded-for entry, counted from the right (default 1)
//   RELAYER_REVERT_ALLOWANCE_PCT  extra fee share for relays that revert anyway (default 10)
//   RELAYER_MAX_REVERT_WEI_PER_HOUR  pause intake past this much reverted gas in an hour (5 min, doubling to 1 h; default 0.01 ETH)
import http from "node:http";
import { readFileSync } from "node:fs";
import { createPublicClient, createWalletClient, decodeAbiParameters, decodeFunctionData, defineChain, http as viemHttp, parseAbi, parseAbiParameters } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const env = (k, d) => (process.env[k] ?? "").trim() || d;
const POOL = env("POOL_ADDRESS", "");
const RPC = env("RELAYER_RPC_URL", "https://rpc.mainnet.chain.robinhood.com");
const CHAIN_ID = Number(env("RELAYER_CHAIN_ID", "4663"));
const KEY_FILE = env("RELAYER_KEY_FILE", "/run/relayer/relayer.key");
const PORT = Number(env("RELAYER_PORT", "8080"));
const FEE_FLOOR = BigInt(env("RELAYER_FEE_ETH_WEI", "200000000000000"));
const MARGIN_PCT = BigInt(env("RELAYER_GAS_MARGIN_PCT", "150"));
const ORIGINS = env("RELAYER_ALLOWED_ORIGINS", "https://oarkel.xyz,https://www.oarkel.xyz").split(",").map((s) => s.trim()).filter(Boolean);
const MAX_GAS = BigInt(env("RELAYER_MAX_GAS", "12000000"));
const MAX_PENDING = Number(env("RELAYER_MAX_PENDING", "3"));
const MIN_BALANCE = BigInt(env("RELAYER_MIN_BALANCE_WEI", "2000000000000000"));
const PER_IP = Number(env("RELAYER_PER_IP_PER_MIN", "6"));
const GLOBAL_PER_MIN = Number(env("RELAYER_MAX_PER_MIN", "30"));
const TRUST_PROXY = env("RELAYER_TRUST_PROXY", "0") === "1";
const PROXY_HOPS = Math.max(1, Number.parseInt(env("RELAYER_PROXY_HOPS", "1"), 10) || 1);
const MAX_BODY = 64 * 1024;
const MAX_TRACKED_IPS = 5000;
const STRIKES_TO_BAN = 2; // per address or /64
const AGG_STRIKES_TO_BAN = 6; // per /24 or /48
const BAN_MS = 60 * 60_000;
/** Pause intake once reverts have cost this much within an hour. Pauses start at 5 minutes and double, up to an hour. */
const MAX_REVERT_WEI_PER_HOUR = BigInt(env("RELAYER_MAX_REVERT_WEI_PER_HOUR", "10000000000000000"));
const PAUSE_FIRST_MS = 5 * 60_000;
const PAUSE_MAX_MS = 60 * 60_000;
/** Expected share of relays that revert anyway (a note owner racing their own relayed proof); priced into every fee. */
const REVERT_ALLOWANCE_PCT = BigInt(env("RELAYER_REVERT_ALLOWANCE_PCT", "10"));
/** Gas a spend typically uses on chain, for the fee quoted on /info (the real check uses a fresh estimate). */
const TYPICAL_GAS = BigInt(env("RELAYER_TYPICAL_GAS", "7000000"));
/** OarkelSwap. Empty: the relayer carries no swaps and /info quotes none. */
const SWAP = env("SWAP_ADDRESS", "");
/** Gas a swap typically uses (unshroud, trade, shroud), for the swap fee quoted on /info. */
const SWAP_TYPICAL_GAS = BigInt(env("RELAYER_SWAP_TYPICAL_GAS", "8500000"));
/** First bytes of OarkelSwap terms: "OARKEL-SWAP-v1" padded to 16 bytes. */
const SWAP_MAGIC = "0x4f41524b454c2d535741502d76310000";
const SWAP_TERMS = parseAbiParameters("uint256 ownerHash, uint256 minOut, uint256 deadline, address submitter, uint256 submitterFee, bytes encryptedNote");

const ARGS = "(uint256 root, uint8 asset, uint256[2] nullifiers, uint256[2] commitments, uint256 exitValue, uint256 transferFee)";
const EXT = "(address recipient, address relayer, uint256 relayerFee, bytes encryptedOutput0, bytes encryptedOutput1)";
const abi = parseAbi([
  `function transact(bytes proof, ${ARGS} args, ${EXT} ext)`,
  `function unshroud(bytes proof, ${ARGS} args, ${EXT} ext)`,
  `function swap(bytes proof, ${ARGS} args, ${EXT} ext)`,
  "function nullifierSpent(uint256) view returns (bool)",
  "function isKnownRoot(uint256) view returns (bool)",
]);

const redact = (v) => (typeof v === "string" ? v.split(RPC).join("<rpc>").replace(/https?:\/\/[^\s"']+/g, "<url>") : v);
const log = (level, msg, extra = {}) =>
  console.log(JSON.stringify({ t: new Date().toISOString(), level, msg: redact(msg), ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, redact(String(v))])) }));

// One bad request must never take the service down.
process.on("unhandledRejection", (e) => log("error", "unhandled rejection", { error: e?.message ?? e }));
process.on("uncaughtException", (e) => log("error", "uncaught exception", { error: e?.message ?? e }));

/* ------------------------------------------------------------ client keys */

function groups(addr) {
  const [head, tail = ""] = addr.split("::");
  const left = head ? head.split(":") : [];
  const right = addr.includes("::") && tail ? tail.split(":") : [];
  const all = addr.includes("::") ? [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill("0"), ...right] : left;
  return all.map((g) => (g || "0").replace(/^0+(?=.)/, ""));
}

/** IPv4 whole, IPv6 cut to its /64. */
export function networkKey(ip) {
  let a = String(ip || "").trim().toLowerCase().replace(/^\[|\]$/g, "").split("%")[0];
  const mapped = a.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) a = mapped[1];
  if (!a.includes(":")) return a || "unknown";
  return `${groups(a).slice(0, 4).join(":")}::/64`;
}

/** The wider network: IPv4 /24, IPv6 /48. Bans and limits also count here, so rotating inside it does not help. */
export function networkAggregate(ip) {
  let a = String(ip || "").trim().toLowerCase().replace(/^\[|\]$/g, "").split("%")[0];
  const mapped = a.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) a = mapped[1];
  if (!a.includes(":")) {
    const parts = a.split(".");
    return parts.length === 4 ? `${parts.slice(0, 3).join(".")}.0/24` : a || "unknown";
  }
  return `${groups(a).slice(0, 3).join(":")}::/48`;
}

/**
 * The client address: the socket peer, unless RELAYER_TRUST_PROXY=1, then the
 * x-forwarded-for entry RELAYER_PROXY_HOPS from the RIGHT (the part written by
 * our own proxy). The leftmost entries are whatever the client sent.
 */
function clientIp(req) {
  if (TRUST_PROXY) {
    const chain = String(req.headers["x-forwarded-for"] || "").split(",").map((p) => p.trim()).filter(Boolean);
    const ip = chain.length >= PROXY_HOPS ? chain[chain.length - PROXY_HOPS] : "";
    // Falling back to the socket here would put every client behind the proxy into one bucket,
    // so one noisy caller could rate-limit or back off everyone. No usable header: no relay.
    return /^[0-9a-fA-F:.[\]%]{2,64}$/.test(ip) ? ip : null;
  }
  return req.socket.remoteAddress || null;
}
/** [own key (IPv4 or IPv6 /64), aggregate (IPv4 /24 or IPv6 /48)] */
const clientKeys = (req) => {
  const ip = clientIp(req);
  return ip ? [networkKey(ip), "agg:" + networkAggregate(ip)] : null;
};

/* ------------------------------------------------------------ main */

if (!/^0x[0-9a-fA-F]{40}$/.test(POOL)) {
  log("info", "POOL_ADDRESS not set yet; idling");
  setInterval(() => log("info", "still idle: set POOL_ADDRESS and restart"), 3600_000);
} else {
  const key = readFileSync(KEY_FILE, "utf8").trim();
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error(`Bad key in ${KEY_FILE}`);
  const account = privateKeyToAccount(key);
  const chain = defineChain({ id: CHAIN_ID, name: "Robinhood Chain", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [RPC] } } });
  const pub = createPublicClient({ chain, transport: viemHttp(RPC, { timeout: 20_000, retryCount: 2 }) });
  const wallet = createWalletClient({ account, chain, transport: viemHttp(RPC, { timeout: 20_000, retryCount: 2 }) });
  serve(pub, wallet, account.address);
}

function serve(pub, wallet, me) {
  const hits = new Map(); // client key -> timestamps (last minute)
  let globalHits = [];
  const inflight = new Set(); // nullifiers of requests being handled or pending
  const strikes = new Map(); // client key -> { n, until }
  let outcomes = []; // { t, ok, lostWei } for the last hour

  const banned = (key) => {
    const s = strikes.get(key);
    return Boolean(s && s.until > Date.now());
  };
  let pausedUntil = 0;
  let nextPauseMs = PAUSE_FIRST_MS;
  let lastPauseAt = 0;
  const strike = (key) => {
    const s = strikes.get(key) || { n: 0, until: 0 };
    s.n += 1;
    if (s.n >= (key.startsWith("agg:") ? AGG_STRIKES_TO_BAN : STRIKES_TO_BAN)) {
      s.until = Date.now() + BAN_MS;
      s.n = 0;
      log("warn", "client backed off after reverted transactions", { client: key });
    }
    strikes.delete(key);
    strikes.set(key, s);
    while (strikes.size > MAX_TRACKED_IPS) strikes.delete(strikes.keys().next().value);
  };
  /** Gas lost to reverts in the last hour, spread over the successful relays: added to every fee. */
  const lossSurcharge = () => {
    const now = Date.now();
    outcomes = outcomes.filter((o) => now - o.t < 60 * 60_000);
    const lost = outcomes.reduce((s, o) => s + o.lostWei, 0n);
    const wins = BigInt(Math.max(1, outcomes.filter((o) => o.ok).length));
    return lost / wins;
  };
  let pending = 0;
  let queue = Promise.resolve();

  const limited = (key, max) => {
    const now = Date.now();
    const list = (hits.get(key) || []).filter((t) => now - t < 60_000);
    list.push(now);
    hits.delete(key);
    hits.set(key, list); // re-insert: Map order = least recently seen first
    while (hits.size > MAX_TRACKED_IPS) hits.delete(hits.keys().next().value);
    return list.length > max;
  };
  const globalLimited = () => {
    const now = Date.now();
    globalHits = globalHits.filter((t) => now - t < 60_000);
    if (globalHits.length >= GLOBAL_PER_MIN) return true;
    globalHits.push(now);
    return false;
  };
  setInterval(() => {
    const now = Date.now();
    for (const [k, list] of hits) if (!list.some((t) => now - t < 60_000)) hits.delete(k);
  }, 60_000).unref();

  const quoteFee = async (gas) => {
    const price = await pub.getGasPrice();
    const cost = (gas * price * (MARGIN_PCT + REVERT_ALLOWANCE_PCT)) / 100n + lossSurcharge();
    return cost > FEE_FLOOR ? cost : FEE_FLOOR;
  };

  /** Refusal reason, or null with what is needed to send. */
  async function check(kind, data) {
    let decoded;
    try {
      decoded = decodeFunctionData({ abi, data });
    } catch {
      return { reason: "Not an OarkelPool spend." };
    }
    if (decoded.functionName !== kind) return { reason: "The data does not match the requested kind." };
    const [, args, ext] = decoded.args;
    let paid;
    let to = POOL;
    if (kind === "swap") {
      // The proof hands the notes to the swap contract; the swap terms in its second output pay this relayer in ETH.
      if (!SWAP) return { reason: "This relayer does not carry swaps." };
      if (ext.recipient.toLowerCase() !== SWAP.toLowerCase() || ext.relayer.toLowerCase() !== SWAP.toLowerCase()) return { reason: "This is not a swap for this site's swap contract." };
      const blob = ext.encryptedOutput1;
      if (blob.slice(0, 34).toLowerCase() !== SWAP_MAGIC) return { reason: "These are not swap terms." };
      let terms;
      try {
        terms = decodeAbiParameters(SWAP_TERMS, `0x${blob.slice(34)}`);
      } catch {
        return { reason: "These are not swap terms." };
      }
      const [, , deadline, submitter, submitterFee] = terms;
      if (submitter.toLowerCase() !== me.toLowerCase()) return { reason: "This swap names a different relayer." };
      if (deadline < BigInt(Math.floor(Date.now() / 1000) + 30)) return { reason: "The swap's deadline is too close. Prove again." };
      paid = submitterFee;
      to = SWAP;
    } else {
      if (ext.relayer.toLowerCase() !== me.toLowerCase()) return { reason: "This proof names a different relayer." };
      if (args.asset !== 0) return { reason: "This relayer only takes spends that pay its fee in ETH." };
      paid = kind === "unshroud" ? ext.relayerFee : args.exitValue;
    }
    const nullifiers = args.nullifiers.map(String);
    if (nullifiers.some((n) => inflight.has(n))) return { reason: "This note is already being relayed." };
    const [spent0, spent1, rootKnown] = await Promise.all([
      pub.readContract({ address: POOL, abi, functionName: "nullifierSpent", args: [args.nullifiers[0]] }),
      pub.readContract({ address: POOL, abi, functionName: "nullifierSpent", args: [args.nullifiers[1]] }),
      pub.readContract({ address: POOL, abi, functionName: "isKnownRoot", args: [args.root] }),
    ]);
    if (spent0 || spent1) return { reason: "A note in this proof is already spent." };
    if (!rootKnown) return { reason: "The proof's root is no longer known. Prove again." };
    let gas;
    try {
      gas = await pub.estimateGas({ account: me, to, data });
    } catch (e) {
      return { reason: "The transaction would fail: " + String(e?.shortMessage || e?.message || e).slice(0, 160) };
    }
    log("info", "estimated", { kind, gas: String(gas) });
    if (gas > MAX_GAS) return { reason: `Gas estimate too high: ${gas} gas, this relayer stops at ${MAX_GAS}.` };
    const needed = await quoteFee(gas);
    if (paid < needed) return { reason: `Relayer fee too low: ${paid} wei offered, ${needed} wei needed at the current gas price.` };
    return { nullifiers, gas, to };
  }

  async function handle(kind, data, keys) {
    if (Date.now() < pausedUntil) return { status: 503, body: { error: "The relayer is paused for a while. Submit from your wallet instead." } };
    if (keys.some(banned)) return { status: 429, body: { error: "Too many of your recent relays failed. Try again later or submit from your wallet." } };
    if (pending >= MAX_PENDING) return { status: 503, body: { error: "The relayer is busy. Try again in a moment." } };
    const balance = await pub.getBalance({ address: me });
    if (balance < MIN_BALANCE) return { status: 503, body: { error: "The relayer is out of gas money." } };
    const c = await check(kind, data);
    if (c.reason) return { status: 400, body: { error: c.reason } };
    for (const n of c.nullifiers) inflight.add(n);
    let sent = false;
    try {
      // Last look, right before signing: state may have moved since the estimate.
      await pub.call({ account: me, to: c.to, data });
      const hash = await wallet.sendTransaction({ to: c.to, data, gas: (c.gas * 12n) / 10n });
      sent = true;
      pending++;
      log("info", "submitted", { kind, hash, gas: c.gas });
      pub
        .waitForTransactionReceipt({ hash, timeout: 300_000 })
        .then((r) => {
          const lostWei = r.status === "success" ? 0n : r.gasUsed * r.effectiveGasPrice;
          outcomes.push({ t: Date.now(), ok: r.status === "success", lostWei });
          if (r.status !== "success") {
            keys.forEach(strike);
            const hourLoss = outcomes.filter((o) => Date.now() - o.t < 60 * 60_000).reduce((sum, o) => sum + o.lostWei, 0n);
            if (hourLoss >= MAX_REVERT_WEI_PER_HOUR && Date.now() >= pausedUntil) {
              // A quiet hour since the last pause resets the back-off.
              if (Date.now() - lastPauseAt > PAUSE_MAX_MS + 60 * 60_000) nextPauseMs = PAUSE_FIRST_MS;
              pausedUntil = Date.now() + nextPauseMs;
              lastPauseAt = Date.now();
              log("warn", "reverted gas over the hourly cap: intake paused", { lostWei: hourLoss, pauseMs: nextPauseMs });
              nextPauseMs = Math.min(PAUSE_MAX_MS, nextPauseMs * 2);
              // Losses that caused this pause do not count again after it.
              outcomes = outcomes.map((o) => ({ ...o, lostWei: 0n }));
            }
          }
          log(r.status === "success" ? "info" : "warn", "mined", { hash, status: r.status, lostWei });
        })
        .catch((e) => log("warn", "receipt not seen", { hash, error: e?.message ?? e }))
        .finally(() => {
          pending--;
          for (const n of c.nullifiers) inflight.delete(n);
        });
      return { status: 200, body: { hash } };
    } catch (e) {
      log("warn", "refused at send", { kind, error: e?.shortMessage || e?.message || e });
      return { status: 400, body: { error: "The transaction would fail now. Prove again." } };
    } finally {
      if (!sent) for (const n of c.nullifiers) inflight.delete(n);
    }
  }

  const reply = (req, res, status, body) => {
    if (res.headersSent || res.destroyed) return;
    const origin = req.headers.origin;
    const headers = { "content-type": "application/json", "cache-control": "no-store" };
    if (origin && ORIGINS.includes(origin)) {
      headers["access-control-allow-origin"] = origin;
      headers["access-control-allow-methods"] = "GET, POST, OPTIONS";
      headers["access-control-allow-headers"] = "content-type";
      headers.vary = "origin";
    }
    res.writeHead(status, headers);
    res.end(body === null ? "" : JSON.stringify(body));
  };

  const server = http.createServer((req, res) => {
    try {
      if (req.method === "OPTIONS") return reply(req, res, 204, null);
      if (req.method === "GET" && req.url === "/health") return reply(req, res, 200, { ok: true, pending });
      if (req.method === "GET" && req.url === "/info") {
        quoteFee(TYPICAL_GAS)
          .then(async (fee) => {
            const swap = SWAP ? { swap: SWAP, swapFeeEthWei: (await quoteFee(SWAP_TYPICAL_GAS)).toString() } : {};
            reply(req, res, 200, { address: me, chainId: CHAIN_ID, pool: POOL, feeEthWei: fee.toString(), acceptsTokenFees: false, ...swap });
          })
          .catch(() => reply(req, res, 503, { error: "Cannot read the gas price." }));
        return;
      }
      if (req.method !== "POST" || req.url !== "/relay") return reply(req, res, 404, { error: "Not found" });
      const keys = clientKeys(req);
      if (!keys) return reply(req, res, 400, { error: "Cannot tell where this request came from." });
      // The aggregate gets 16x the budget of one address.
      const overOwn = limited(keys[0], PER_IP);
      const overAgg = limited(keys[1], PER_IP * 16);
      if (overOwn || overAgg) return reply(req, res, 429, { error: "Too many requests." });
      if (Number(req.headers["content-length"] || 0) > MAX_BODY) {
        reply(req, res, 413, { error: "Too large." });
        return req.destroy();
      }
      let size = 0;
      const chunks = [];
      req.on("error", () => {});
      req.on("data", (c) => {
        size += c.length;
        if (size > MAX_BODY) {
          reply(req, res, 413, { error: "Too large." });
          req.destroy();
        } else chunks.push(c);
      });
      req.on("end", () => {
        if (size > MAX_BODY) return;
        let body;
        try {
          body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        } catch {
          return reply(req, res, 400, { error: "Bad JSON." });
        }
        const { kind, data } = body || {};
        const kinds = SWAP ? ["transact", "unshroud", "swap"] : ["transact", "unshroud"];
        if (!kinds.includes(kind) || typeof data !== "string" || !/^0x[0-9a-fA-F]+$/.test(data)) {
          return reply(req, res, 400, { error: "Expected { kind, data }." });
        }
        if (globalLimited()) return reply(req, res, 429, { error: "The relayer is at capacity. Try again in a minute." });
        // One request at a time keeps nonces, balance and pending counts consistent.
        const job = queue.then(() => handle(kind, data, keys)).catch((e) => {
          log("error", "relay failed", { error: e?.message ?? e });
          return { status: 500, body: { error: "The relayer could not process this." } };
        });
        queue = job.then(() => undefined);
        job.then((out) => reply(req, res, out.status, out.body)).catch(() => {});
      });
    } catch (e) {
      log("error", "request failed", { error: e?.message ?? e });
      reply(req, res, 500, { error: "Internal error." });
    }
  });
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  server.keepAliveTimeout = 5_000;
  server.on("clientError", (_e, socket) => socket.destroy());
  server.listen(PORT, () => log("info", "relayer listening", { port: PORT, address: me, pool: POOL }));
}
