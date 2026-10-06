import { test } from "node:test";
import assert from "node:assert/strict";
import { MICRO, WHOLE_SHARE, bpsFee, pricePerShare, sharesFor, sharesToBurn, valueOf, type Vault } from "./vault.ts";

const M = BigInt(MICRO);

test("first deposit mints one whole share per token", () => {
  const v: Vault = { backing: 0n, shares: 0n };
  assert.equal(sharesFor(v, 1000n * M), 1000n * WHOLE_SHARE);
});

test("a donation raises the value of existing shares and never mints", () => {
  const v: Vault = { backing: 1_000_000n * M, shares: 1_000_000n * WHOLE_SHARE };
  const mine = 10_000n * WHOLE_SHARE;
  const before = valueOf(v, mine);
  const after = valueOf({ backing: v.backing + 30_000n * M, shares: v.shares }, mine);
  assert.ok(10_000n * M - before <= 1n);
  assert.ok(10_300n * M - after <= 1n && after <= 10_300n * M);
});

test("deposit then withdraw never returns more than was put in", () => {
  const v: Vault = { backing: 777_777n * M, shares: 500_123n * WHOLE_SHARE };
  const amount = 12_345n * M;
  const s = sharesFor(v, amount);
  const v2 = { backing: v.backing + amount, shares: v.shares + s };
  assert.ok(valueOf(v2, s) <= amount);
});

test("burning for an amount rounds up, so the vault keeps the dust", () => {
  const v: Vault = { backing: 3n * M, shares: 7n * WHOLE_SHARE };
  const burn = sharesToBurn(v, 1n * M);
  assert.ok(valueOf(v, burn) >= 1n * M);
});

test("inflation attack: a dust first deposit plus a huge donation cannot zero the next depositor", () => {
  const s1 = sharesFor({ backing: 0n, shares: 0n }, 1n);
  const v2 = { backing: 1n + 1_000_000n * M, shares: s1 };
  assert.ok(sharesFor(v2, 1000n * M) > 0n);
});

test("fees round up; price per share starts at one token", () => {
  assert.equal(bpsFee(1n, 25n), 1n);
  assert.equal(bpsFee(10_000n, 25n), 25n);
  assert.equal(pricePerShare({ backing: 5n * M, shares: 5n * WHOLE_SHARE }), M);
});
