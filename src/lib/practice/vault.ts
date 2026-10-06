/*
 * Share arithmetic for the practice fee vault, kept free of imports so it can
 * be unit-tested with plain `node --test`. Token amounts are integers in
 * micro units (1e-6 of a token); shares are BigInt (stored as decimal
 * strings) because the virtual offset makes them large.
 *
 *   shares_out = amount * (shares + OFFSET) / (backing + 1)        (rounded down)
 *   amount_out = shares * (backing + 1) / (shares_total + OFFSET)   (rounded down)
 *
 * The virtual offset makes the first-depositor inflation trick uneconomic.
 */

export const MICRO = 1_000_000;
export const OFFSET = 1_000_000n;
/** Shares a first depositor receives for one whole token. */
export const WHOLE_SHARE = BigInt(MICRO) * OFFSET;

export type Vault = { backing: bigint; shares: bigint };

/** Shares minted for depositing `amount` micro tokens (rounded down, in the vault's favour). */
export function sharesFor(v: Vault, amount: bigint) {
  return (amount * (v.shares + OFFSET)) / (v.backing + 1n);
}

/** Shares that must be burned to take out `amount` micro tokens (rounded up, in the vault's favour). */
export function sharesToBurn(v: Vault, amount: bigint) {
  const num = amount * (v.shares + OFFSET);
  const den = v.backing + 1n;
  return (num + den - 1n) / den;
}

/** Micro-token value of `shares` (rounded down). */
export function valueOf(v: Vault, shares: bigint) {
  return (shares * (v.backing + 1n)) / (v.shares + OFFSET);
}

/** Micro-token value of one whole share. */
export function pricePerShare(v: Vault) {
  return valueOf(v, WHOLE_SHARE);
}

/** Fee in basis points, rounded up so a fee is never zero on a non-zero amount. */
export function bpsFee(amount: bigint, bps: bigint) {
  return (amount * bps + 9_999n) / 10_000n;
}
