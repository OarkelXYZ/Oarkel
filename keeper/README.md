# Oarkel relayer

Submits Oarkel pool spends (private sends and unshrouds) for users, so their own wallet never appears as the sender. The user's proof names this relayer and its fee; the relayer cannot change the recipient, the amount or the fee, only submit or refuse.

## Run it

1. `cp relayer.conf.example relayer.conf` and set `POOL_ADDRESS` (and your own RPC in `RELAYER_RPC_URL` if you have one).
2. Create the hot wallet key: `docker compose run --rm -v "$PWD/keys:/out" relayer node make-key.mjs`. It writes `keys/relayer.key` (mode 400) and prints only the address. Never commit or copy the key.
3. Send that address a small amount of ETH on Robinhood Chain (a spend costs roughly 3.5 to 4.7 million gas).
4. `docker compose up -d`. It listens on 127.0.0.1:8080; put it behind HTTPS and give users the https URL (Settings in the app, or `NEXT_PUBLIC_OARKEL_RELAYER_URL` for a site default).

Endpoints: `GET /info` (address, pool, current ETH fee), `POST /relay` with `{ "kind": "transact" | "unshroud", "data": "0x…" }`, `GET /health`.

## What it checks before paying gas

- It is the relayer named in the proof, and the spend pays in ETH (token fees are refused until the relayer can price them on chain).
- The fee covers estimated gas x current gas price x `RELAYER_GAS_MARGIN_PCT` / 100 (and the floor).
- No other request with the same nullifiers is in flight; the nullifiers are unspent and the root is still known.
- A fresh `eth_call` succeeds right before signing.
- Fewer than `RELAYER_MAX_PENDING` of its transactions are pending and its balance is above `RELAYER_MIN_BALANCE_WEI`.
- Rate limits per client (IPv4 address or IPv6 /64, from the socket; `x-forwarded-for` only with `RELAYER_TRUST_PROXY=1`, read from the right), per wider network (IPv4 /24, IPv6 /48, 16x the budget) and for the whole relayer.
- Networks whose relays end in reverted transactions are backed off for an hour (two strikes per address or /64, six per /24 or /48). Past `RELAYER_MAX_REVERT_WEI_PER_HOUR` of reverted gas in an hour, the relayer stops taking work for 5 minutes, doubling with each repeat up to an hour (a quiet period resets it). Someone willing to burn their own gas can trigger such a pause; that is the chosen trade-off (a pause instead of a drained hot wallet). During a pause users are never stuck: the app falls back to the next relayer in its list, and anyone can always unshroud or send by submitting from their own wallet with no relayer fee.

Run more than one relayer if you can: the site takes a comma-separated list in `NEXT_PUBLIC_OARKEL_RELAYER_URL` and moves to the next one when one refuses.

The fee asked is estimated gas x gas price x (`RELAYER_GAS_MARGIN_PCT` + `RELAYER_REVERT_ALLOWANCE_PCT`) / 100, plus the gas lost to reverts in the last hour spread over the successful relays.

## Operator risk (accepted)

The pool only accepts a spend that pays a relayer from that relayer (`msg.sender` must be the relayer named in the proof), so nobody can land a relayed proof ahead of it. What remains: a note owner can race their own relayed proof by spending the same note with a second proof submitted from their own wallet. If that lands first, the relayer's transaction reverts and it loses one transaction's gas. The owner gains nothing (they pay their own gas and the relayer's fee is simply not paid), so this is griefing, not theft. It is accepted and bounded: the revert allowance in the fee, the per-network back-off, the hourly reverted-gas cap with a pause, the pending cap and a small hot-wallet balance. IP-based limits can be evaded with enough addresses; the hourly cap is what bounds the loss.

## Tests

`node --test test/relayer.test.mjs` with `TEST_RPC`, `TEST_POOL` and `TEST_POOL_BLOCK` pointing at a local devnet that has the pool deployed (spoofed headers, malformed/oversized/slow bodies, token fees, a fee below gas cost, the same proof sent twice).
