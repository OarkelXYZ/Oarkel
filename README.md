# Oarkel

Oarkel — Shroud $OARKEL or ETH. Hold privately. Earn passive yield. Immutable. No admin.

**Public Chain. Private Balance.** Oarkel is a privacy protocol for Robinhood Chain: a shared pool where ETH and $OARKEL are held as private notes, and where the protocol's fees are designed to flow to private holders only. This repository holds the whole website, the practice engine behind its app, the pool contracts and their zero-knowledge circuit, an open-source relayer, and the tools used to check the token and any deployment against this code.

Website: [oarkel.xyz](https://oarkel.xyz) · X: [@oarkelxyz](https://x.com/oarkelxyz) · Token contract: not published yet

> **Status:** the pool and proof contracts are **written and tested, but not deployed**. What this README says about immutability, the missing owner and admin function, and fees describes the code in `contracts/`; it becomes true on chain once the contracts are deployed and their addresses are published. Until then the app runs the full flow in practice mode: every action is a free wallet signature, no transaction is sent and no real value moves.

## The problem

Every account on a public chain is an open book. Paste an address into an explorer and you get its balance, its holdings and every payment it has made. Once one address is tied to a person (an exchange withdrawal, a payment to a friend) their whole financial history comes with it. Privacy tools that exist tend to have two further problems:

- **Nobody stays.** Using them costs fees and earns nothing, so pools stay small, and a small pool protects badly.
- **Somebody holds the keys.** An operator who can pause, upgrade or freeze is a single point of failure and pressure.

## The solution

- **Shroud.** Move ETH or $OARKEL into one shared pool. The deposit is public; what comes back is a note only your keys can read.
- **Hold.** Shrouded $OARKEL is counted in vault shares. Fees (creator fee on $OARKEL trades, shroud, unshroud and private transfer fees) are added to the vault without minting shares, so every private share grows in value. Public holders earn nothing.
- **Spend or unshroud.** Pay someone inside the pool, or withdraw to any address, with a zero-knowledge proof that reveals nothing about which note paid.
- **No operator (in the code).** The pool contract has no owner, no admin function, no pause, no proxy and no upgrade path; every parameter is fixed in its constructor. A relayer can pay gas so exit addresses need no ETH.

## How it works

```
 public wallet ──shroud──▶ [ shared pool: commitments only ] ──unshroud──▶ any address
                                 │        ▲
              private transfer ──┘        │ fees donated, no new shares
                                          │
                                   [ fee vault ] ──▶ value per private $OARKEL share rises
```

Notes are commitments in one Merkle tree (depth 24); spending publishes a nullifier so a note cannot be spent twice; a proof shows ownership, tree membership and conserved value. Proofs are built in the browser (a Noir circuit proven with UltraHonk, about four seconds) and need no project-specific trusted setup. ETH fees accrue in the pool and anyone can sweep them to the fee address fixed at deploy; turning them into $OARKEL for the vault is an operated, off-chain step. The docs on the site cover each piece: `/docs/concepts`, `/docs/pool-and-yield`, `/docs/fees`, `/docs/trust-model`.

## What you can try

Live now:

- Wallet connection on Robinhood Chain (EIP-6963 browser wallets, WalletConnect when configured); the network is added for you.
- Live chain readings: latest block, gas price and the Chainlink ETH/USD feed on Robinhood Chain.
- The app at `/app` in **practice mode**: open a practice account, shroud, hold, send privately and unshroud. Each step is a one-time message signed with `personal_sign`; the server verifies the signature, burns the nonce and applies exactly what was signed. Fees from every visitor's practice actions feed one practice vault, so share value moves only with real practice activity.
- Six interactive research notes at `/research` on metadata leaks around private notes.

Coming later:

- $OARKEL itself (the buy card on `/token` switches on once the address is set).
- The private pool and its fee vault on mainnet (the app switches from practice to real transactions once the addresses are set in `src/config/contracts.ts`).
- Public relayers run by anyone with `keeper/`, and the automated fee harvester.

## Run it locally

Requires Node.js 20 or newer. Download ZIP or fork this repository, then:

```bash
npm install
npm run build
npm start            # http://localhost:4910
```

Checks:

```bash
npm run typecheck
npm run lint
npm test             # vault share math, rate limiter, network keys, proofs
npm run verify-token -- 0xTokenAddress   # read-only check of a token on Robinhood Chain
npm run verify-deployment -- 0xAddress --tx 0xCreationTx   # proves deployed bytecode = this build
```

Contracts (Foundry) and circuit (Noir):

```bash
contracts/setup.sh && (cd contracts && forge test)   # unit, proof, invariant tests
circuits/build.sh --check                            # circuit, verifier and browser artifact match a fresh build
```

Every environment variable is optional; without them the site uses public endpoints and says what is missing instead of failing. Put them in a local env file (see `.env.example`, values empty) or in your host's project settings:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_ROBINHOOD_RPC_URL` / `ROBINHOOD_RPC_URL` | Your own Robinhood Chain RPC (for example an Alchemy URL) for the browser / the server |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Project id from cloud.reown.com; enables WalletConnect |
| `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`, or `KV_REDIS_URL` | Storage for practice accounts. Without it a local file is used when running locally; on a serverless host the app shows "not configured yet" |
| `CHAT_KEY_PREFIX` | Key prefix when several sites share one Redis (default `oarkel:`) |
| `NEXT_PUBLIC_OARKEL_RELAYER_URL` | One or more relayer URLs (comma-separated) run with `keeper/`; without it users submit from their own wallet |

To publish the token address, edit the single `CA` constant in `src/config/brand.ts`. The navbar copy button, footer, token page, buy card and explorer links all derive from it.

## Network in your wallet

| Field | Value |
| --- | --- |
| Network name | Robinhood Chain |
| Chain id | 4663 (0x1237) |
| Currency | ETH |
| RPC | https://rpc.mainnet.chain.robinhood.com |
| Explorer | https://robinhoodchain.blockscout.com |

## Project layout

```
src/app/            routes: home, token, docs, research, app (practice), API (chain status, RPC relay, practice)
src/components/     UI; wallet/ is the shared connect dialog and account menu
src/config/         brand.ts (name, links, contract address), wallets.ts
src/lib/            rpc relay + guards + rate limits, practice ledger, intents and vault math, zk prover
contracts/          OarkelPool, HonkVerifier, Poseidon libraries, Foundry tests
circuits/transact/  the Noir circuit behind every spend (two notes in, two out)
keeper/             open-source relayer: anyone can run one and set its own fee
scripts/            verify-deployment.mjs, prover and artifact builds
tools/              verify-token.mjs
```

## Contracts and token

| Contract | Status |
| --- | --- |
| $OARKEL (ERC-20, launched on Pons) | Address not published yet |
| Private pool (OarkelPool), proof verifier (HonkVerifier), libraries | Written and tested, not deployed |
| Fee harvester | Planned (operated off-chain) |

Default deploy values: shroud fee 0.25%, private transfer fee 0.10%, flat unshroud fee 0.0005 ETH or 20 $OARKEL, fixed forever at deploy (the constructor refuses anything above 5%). Functions, events, errors and parameters are documented at `/docs/contracts` and `/docs/parameters`; deployed code can be checked with `npm run verify-deployment` and on [Blockscout](https://robinhoodchain.blockscout.com).

## Security and status

- The contracts are immutable: no owner, no admin function, no pause, no upgrade path. A bug cannot be patched, so put in only what you are prepared to lose. All code is open source and `npm run verify-deployment` proves a deployment matches it.
- The RPC relay (`/api/rpc`) forwards read methods only, with a method allowlist, a bounded `eth_getLogs` range and per-network budgets.
- Practice actions require a fresh signature per action; nonces are single-use and expire after five minutes. Signed messages name this site's own domain, never the request's host header.
- Practice storage is bounded: records expire 30 days after their last change, activity is limited per account, and new accounts are rate limited per network and per wallet.

Report security issues privately through a direct message to [@oarkelxyz](https://x.com/oarkelxyz).

## Contributing

Issues and pull requests are welcome. Keep code, comments and copy in English, run `npm run typecheck`, `npm run lint` and `npm test` before opening a pull request, and describe anything that changes what is live versus planned.

## License

MIT. See [LICENSE](LICENSE).
