import "server-only";
import { randomBytes } from "node:crypto";
import type { Store } from "@/lib/auth/store";
import { MICRO, WHOLE_SHARE, bpsFee, pricePerShare, sharesFor, sharesToBurn, valueOf, type Vault } from "@/lib/practice/vault";

/*
 * Practice ledger: the shroud / hold / send / unshroud flow with practice
 * balances only. Nothing here touches a chain. Every write happens under one
 * store-wide lock (SET NX with a random owner token), because a private
 * transfer touches two accounts and every fee touches the shared vault.
 *
 * Amounts are integers in micro units (1e-6). ETH notes hold an amount;
 * $OARKEL notes hold vault shares (BigInt, stored as decimal strings), so
 * their value grows when fees reach the vault.
 */

export type Asset = "eth" | "oarkel";
export const ASSETS: Asset[] = ["eth", "oarkel"];

/** Example values for practice only. The real contracts' rates are not set. */
export const RULES = {
  startEth: 1 * MICRO,
  startOarkel: 50_000 * MICRO,
  shroudBps: 25n,
  transferBps: 10n,
  unshroudFlat: { eth: 500, oarkel: 20 * MICRO } as Record<Asset, number>,
  /** ETH fees are converted for the vault at this fixed practice rate (not a price). */
  oarkelPerEth: 40_000,
  min: { eth: 1_000, oarkel: 1 * MICRO } as Record<Asset, number>,
  topUpEveryMs: 24 * 60 * 60 * 1000,
} as const;

export type Note = {
  id: string;
  asset: Asset;
  /** ETH: micro ETH. */
  amount?: number;
  /** $OARKEL: vault shares as a decimal string. */
  shares?: string;
  createdAt: number;
  origin: "shroud" | "received" | "change";
};

export type Account = {
  address: string;
  createdAt: number;
  eth: number;
  oarkel: number;
  notes: Note[];
  toppedUpAt: number;
  /** Newest first, capped at ACTIVITY_KEEP; kept inside the record so it expires with it. */
  activity?: Activity[];
};

/** `pending`: fees that arrived while no $OARKEL was shrouded; they join the backing with the first shares. */
type VaultRecord = { backing: string; shares: string; fees: string; donations: number; pending?: string };
export type Stats = { accounts: number; shrouds: number; transfers: number; unshrouds: number };
export type Activity = { t: number; kind: string; text: string };

export type Failure = { error: string; status: number };
export type Done = { ok: true; summary: string };

const LOCK_KEY = "practice:lock";
const LOCK_TTL = 10;
const LOCK_WAIT_MS = 4000;
const acctKey = (a: string) => `practice:acct:${a}`;
/** Practice records expire 30 days after their last change; every write renews the clock. */
export const RECORD_TTL = 30 * 24 * 60 * 60;
const ACTIVITY_KEEP = 30;
const VAULT_KEY = "practice:vault";
const STATS_KEY = "practice:stats";
const MAX_NOTES = 60;

const commitment = () => `0x${randomBytes(32).toString("hex")}`;
const tok = (micro: number | bigint, digits = 4) =>
  (Number(micro) / MICRO).toLocaleString("en-US", { maximumFractionDigits: digits });
const label = (a: Asset) => (a === "eth" ? "ETH" : "OARKEL");

async function withLock<T>(store: Store, fn: () => Promise<T>): Promise<T | Failure> {
  const token = randomBytes(12).toString("hex");
  const deadline = Date.now() + LOCK_WAIT_MS;
  while (Date.now() < deadline) {
    if (await store.setNx(LOCK_KEY, token, LOCK_TTL)) {
      try {
        return await fn();
      } finally {
        // Release only our own lock: it may have expired and been taken.
        if ((await store.get(LOCK_KEY).catch(() => null)) === token) await store.del(LOCK_KEY).catch(() => {});
      }
    }
    await new Promise((r) => setTimeout(r, 30 + Math.random() * 50));
  }
  return { error: "The practice pool is busy. Try again in a moment.", status: 409 };
}

/* ---------------------------------------------------------------- reads */

export async function readAccount(store: Store, address: string): Promise<Account | null> {
  const raw = await store.get(acctKey(address));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Account;
  } catch {
    return null;
  }
}

async function readVaultRecord(store: Store): Promise<VaultRecord> {
  const raw = await store.get(VAULT_KEY);
  if (raw) {
    try {
      return JSON.parse(raw) as VaultRecord;
    } catch {
      // fall through to an empty vault
    }
  }
  return { backing: "0", shares: "0", fees: "0", donations: 0 };
}

const toVault = (r: VaultRecord): Vault => ({ backing: BigInt(r.backing), shares: BigInt(r.shares) });

export async function readStats(store: Store): Promise<Stats> {
  const raw = await store.get(STATS_KEY);
  const base: Stats = { accounts: 0, shrouds: 0, transfers: 0, unshrouds: 0 };
  if (!raw) return base;
  try {
    return { ...base, ...(JSON.parse(raw) as Partial<Stats>) };
  } catch {
    return base;
  }
}

export async function readActivity(store: Store, address: string): Promise<Activity[]> {
  return (await readAccount(store, address))?.activity ?? [];
}

/** Everything the app shows for one wallet, with note values worked out. */
export async function accountView(store: Store, address: string) {
  const [account, record, stats, activity] = await Promise.all([
    readAccount(store, address),
    readVaultRecord(store),
    readStats(store),
    readActivity(store, address),
  ]);
  const vault = toVault(record);
  const notes = (account?.notes ?? []).map((n) => ({
    id: n.id,
    asset: n.asset,
    origin: n.origin,
    createdAt: n.createdAt,
    value: n.asset === "eth" ? (n.amount ?? 0) : Number(valueOf(vault, BigInt(n.shares ?? "0"))),
    shares: n.shares ?? null,
  }));
  const priv = { eth: 0, oarkel: 0 };
  for (const n of notes) priv[n.asset] += n.value;
  const canTopUp = Boolean(
    account && (account.eth < RULES.min.eth * 50 || account.oarkel < 2_000 * MICRO) && Date.now() - account.toppedUpAt >= RULES.topUpEveryMs,
  );
  return {
    account: account ? { address: account.address, createdAt: account.createdAt, eth: account.eth, oarkel: account.oarkel } : null,
    notes,
    private: priv,
    vault: {
      backing: Number(vault.backing),
      shares: vault.shares.toString(),
      pricePerShare: vault.shares > 0n ? Number(pricePerShare(vault)) : MICRO,
      fees: Number(BigInt(record.fees)),
      pending: Number(BigInt(record.pending ?? "0")),
      donations: record.donations,
    },
    stats,
    activity,
    canTopUp,
  };
}

/* ---------------------------------------------------------------- writes */

type Ctx = {
  vault: VaultRecord;
  stats: Stats;
  accounts: Map<string, Account>;
};

async function load(store: Store, ctx: Ctx, address: string) {
  if (ctx.accounts.has(address)) return ctx.accounts.get(address) ?? null;
  const a = await readAccount(store, address);
  if (a) ctx.accounts.set(address, a);
  return a;
}

async function commit(store: Store, ctx: Ctx) {
  // One key per account, always with an expiry; the vault and stats are single fixed keys.
  await Promise.all([...ctx.accounts.values()].map((a) => store.setEx(acctKey(a.address), JSON.stringify(a), RECORD_TTL)));
  await store.set(VAULT_KEY, JSON.stringify(ctx.vault));
  await store.set(STATS_KEY, JSON.stringify(ctx.stats));
}

async function run(store: Store, fn: (ctx: Ctx) => Promise<Done | Failure>): Promise<Done | Failure> {
  return withLock(store, async () => {
    const ctx: Ctx = { vault: await readVaultRecord(store), stats: await readStats(store), accounts: new Map() };
    const result = await fn(ctx);
    if ("ok" in result) await commit(store, ctx);
    return result;
  });
}

/** Adds fees to the vault backing without minting shares: every private $OARKEL share gains. */
function donate(ctx: Ctx, asset: Asset, fee: number) {
  if (fee <= 0) return;
  const inOarkel = asset === "eth" ? BigInt(fee) * BigInt(RULES.oarkelPerEth) : BigInt(fee);
  // With no shares outstanding there is nobody to pay yet; adding it to the backing now would only
  // distort the share price the first depositor gets.
  if (BigInt(ctx.vault.shares) === 0n) ctx.vault.pending = (BigInt(ctx.vault.pending ?? "0") + inOarkel).toString();
  else ctx.vault.backing = (BigInt(ctx.vault.backing) + inOarkel).toString();
  ctx.vault.fees = (BigInt(ctx.vault.fees) + inOarkel).toString();
  ctx.vault.donations += 1;
}

const vaultOf = (ctx: Ctx) => toVault(ctx.vault);
const noteValue = (ctx: Ctx, n: Note) => (n.asset === "eth" ? BigInt(n.amount ?? 0) : valueOf(vaultOf(ctx), BigInt(n.shares ?? "0")));

/**
 * Spends notes of one asset worth at least `need` micro tokens, largest
 * first, and returns the change as a new note (or nothing). For $OARKEL the
 * change keeps its leftover shares, so it goes on earning.
 */
function spend(ctx: Ctx, account: Account, asset: Asset, need: bigint): { burnShares: bigint; change: Note | null } | null {
  const mine = account.notes.filter((n) => n.asset === asset).sort((a, b) => (noteValue(ctx, b) > noteValue(ctx, a) ? 1 : -1));
  const total = mine.reduce((s, n) => s + noteValue(ctx, n), 0n);
  if (total < need) return null;
  const picked: Note[] = [];
  let sum = 0n;
  for (const n of mine) {
    if (sum >= need) break;
    picked.push(n);
    sum += noteValue(ctx, n);
  }
  account.notes = account.notes.filter((n) => !picked.includes(n));
  if (asset === "eth") {
    const left = sum - need;
    return { burnShares: 0n, change: left > 0n ? { id: commitment(), asset, amount: Number(left), createdAt: Date.now(), origin: "change" } : null };
  }
  const pickedShares = picked.reduce((s, n) => s + BigInt(n.shares ?? "0"), 0n);
  const burn = sharesToBurn(vaultOf(ctx), need);
  const leftShares = pickedShares - (burn > pickedShares ? pickedShares : burn);
  return {
    burnShares: burn > pickedShares ? pickedShares : burn,
    change: leftShares > 0n ? { id: commitment(), asset, shares: leftShares.toString(), createdAt: Date.now(), origin: "change" } : null,
  };
}

function addNote(account: Account, note: Note | null) {
  if (note) account.notes.push(note);
}

function log(ctx: Ctx, address: string, kind: string, text: string) {
  const account = ctx.accounts.get(address);
  if (!account) return;
  account.activity = [{ t: Date.now(), kind, text }, ...(account.activity ?? [])].slice(0, ACTIVITY_KEEP);
}

export async function join(store: Store, address: string): Promise<Done | Failure> {
  return run(store, async (ctx) => {
    if (await load(store, ctx, address)) return { ok: true, summary: "Your practice account is already open." };
    const account: Account = { address, createdAt: Date.now(), eth: RULES.startEth, oarkel: RULES.startOarkel, notes: [], toppedUpAt: Date.now() };
    ctx.accounts.set(address, account);
    ctx.stats.accounts += 1;
    log(ctx, address, "open", `Practice account opened with ${tok(RULES.startEth)} ETH and ${tok(RULES.startOarkel)} OARKEL`);
    return { ok: true, summary: "Practice account opened." };
  });
}

export async function topUp(store: Store, address: string): Promise<Done | Failure> {
  return run(store, async (ctx) => {
    const a = await load(store, ctx, address);
    if (!a) return { error: "Open a practice account first.", status: 404 };
    const low = a.eth < RULES.min.eth * 50 || a.oarkel < 2_000 * MICRO;
    if (!low || Date.now() - a.toppedUpAt < RULES.topUpEveryMs) return { error: "Top-ups are for low balances, once a day.", status: 429 };
    a.eth = Math.max(a.eth, RULES.startEth);
    a.oarkel = Math.max(a.oarkel, RULES.startOarkel);
    a.toppedUpAt = Date.now();
    log(ctx, address, "topup", "Public practice balance topped up");
    return { ok: true, summary: "Practice balance topped up." };
  });
}

export async function shroud(store: Store, address: string, asset: Asset, amount: number): Promise<Done | Failure> {
  return run(store, async (ctx) => {
    const a = await load(store, ctx, address);
    if (!a) return { error: "Open a practice account first.", status: 404 };
    if (a.notes.length >= MAX_NOTES) return { error: "Too many notes. Unshroud or send some first.", status: 400 };
    const balance = asset === "eth" ? a.eth : a.oarkel;
    if (amount > balance) return { error: `Not enough public practice ${label(asset)}.`, status: 400 };
    const fee = Number(bpsFee(BigInt(amount), RULES.shroudBps));
    const net = amount - fee;
    if (asset === "eth") {
      a.eth -= amount;
      addNote(a, { id: commitment(), asset, amount: net, createdAt: Date.now(), origin: "shroud" });
    } else {
      a.oarkel -= amount;
      if (BigInt(ctx.vault.shares) === 0n && BigInt(ctx.vault.backing) > 0n) {
        // Every share was burned earlier; leftover backing waits for the next shares like any fee.
        ctx.vault.pending = (BigInt(ctx.vault.pending ?? "0") + BigInt(ctx.vault.backing)).toString();
        ctx.vault.backing = "0";
      }
      const v = vaultOf(ctx);
      const shares = sharesFor(v, BigInt(net));
      const pending = BigInt(ctx.vault.pending ?? "0");
      ctx.vault.backing = (v.backing + BigInt(net) + pending).toString();
      ctx.vault.shares = (v.shares + shares).toString();
      ctx.vault.pending = "0";
      addNote(a, { id: commitment(), asset, shares: shares.toString(), createdAt: Date.now(), origin: "shroud" });
    }
    donate(ctx, asset, fee);
    ctx.stats.shrouds += 1;
    log(ctx, address, "shroud", `Shrouded ${tok(amount)} ${label(asset)} (fee ${tok(fee, 6)})`);
    return { ok: true, summary: `Shrouded ${tok(net)} ${label(asset)} into a new private note.` };
  });
}

export async function send(store: Store, address: string, asset: Asset, amount: number, to: string): Promise<Done | Failure> {
  return run(store, async (ctx) => {
    if (to === address) return { error: "Send to a different practice account.", status: 400 };
    const a = await load(store, ctx, address);
    if (!a) return { error: "Open a practice account first.", status: 404 };
    const b = await load(store, ctx, to);
    if (!b) return { error: "That wallet has no practice account. Ask them to open one first.", status: 404 };
    if (b.notes.length >= MAX_NOTES) return { error: "The recipient holds too many notes right now.", status: 400 };
    const fee = Number(bpsFee(BigInt(amount), RULES.transferBps));
    const spent = spend(ctx, a, asset, BigInt(amount + fee));
    if (!spent) return { error: `Not enough private practice ${label(asset)} for that plus the fee.`, status: 400 };
    addNote(a, spent.change);
    if (asset === "eth") {
      addNote(b, { id: commitment(), asset, amount, createdAt: Date.now(), origin: "received" });
      donate(ctx, asset, fee);
    } else {
      // The recipient's shares are worth `amount`; the fee's shares are burned, so their value stays with every other share.
      const v = vaultOf(ctx);
      const theirs = sharesFor(v, BigInt(amount));
      const burned = spent.burnShares - theirs > 0n ? spent.burnShares - theirs : 0n;
      ctx.vault.shares = (v.shares - burned).toString();
      ctx.vault.fees = (BigInt(ctx.vault.fees) + BigInt(fee)).toString();
      ctx.vault.donations += 1;
      addNote(b, { id: commitment(), asset, shares: theirs.toString(), createdAt: Date.now(), origin: "received" });
    }
    ctx.stats.transfers += 1;
    log(ctx, address, "send", `Sent ${tok(amount)} ${label(asset)} privately (fee ${tok(fee, 6)})`);
    log(ctx, to, "receive", `Received a private ${label(asset)} note`);
    return { ok: true, summary: `Sent ${tok(amount)} ${label(asset)} privately.` };
  });
}

export async function unshroud(
  store: Store,
  address: string,
  asset: Asset,
  amount: number,
  to: string,
): Promise<Done | Failure> {
  return run(store, async (ctx) => {
    const a = await load(store, ctx, address);
    if (!a) return { error: "Open a practice account first.", status: 404 };
    const fee = RULES.unshroudFlat[asset];
    const spent = spend(ctx, a, asset, BigInt(amount + fee));
    if (!spent) return { error: `Not enough private practice ${label(asset)} for that plus the fees.`, status: 400 };
    addNote(a, spent.change);
    if (asset === "eth") {
      donate(ctx, asset, fee);
    } else {
      // Burn the spent shares; the amount leaves the backing, the exit fee stays in it.
      const v = vaultOf(ctx);
      ctx.vault.shares = (v.shares - spent.burnShares).toString();
      ctx.vault.backing = (v.backing - BigInt(amount)).toString();
      ctx.vault.fees = (BigInt(ctx.vault.fees) + BigInt(fee)).toString();
      ctx.vault.donations += 1;
    }
    // Where the value lands: own public balance, another practice account, or out of practice entirely.
    const target = to === address ? a : await load(store, ctx, to);
    if (target) {
      if (asset === "eth") target.eth += amount;
      else target.oarkel += amount;
      if (target !== a) log(ctx, to, "incoming", `Received ${tok(amount)} ${label(asset)} publicly from the pool`);
    }
    ctx.stats.unshrouds += 1;
    const dest = to === address ? "your own address" : `${to.slice(0, 6)}…${to.slice(-4)}`;
    log(ctx, address, "unshroud", `Unshrouded ${tok(amount)} ${label(asset)} to ${dest}`);
    return { ok: true, summary: `Unshrouded ${tok(amount)} ${label(asset)} to ${dest}.` };
  });
}

export { WHOLE_SHARE };
