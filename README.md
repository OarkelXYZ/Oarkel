# Oarkel

Oarkel — Shroud $OARKEL or ETH. Hold privately. Earn passive yield. Immutable. No admin.

**Public Chain. Private Balance.** Oarkel is a privacy protocol for Robinhood Chain: a shared pool where ETH and $OARKEL are held as private notes, and where the protocol's fees are designed to flow to private holders only. This repository holds the whole website, the practice engine behind its app, the pool contracts and their zero-knowledge circuit, and the tools used to check the token and any deployment against this code.

Website: [oarkel.xyz](https://oarkel.xyz) · X: [@oarkelxyz](https://x.com/oarkelxyz) · Token contract: `0xb34ceb0a58d9f270844076f77f0add5917ab77f7`

> **Status:** the pool, its proof verifier and their libraries are **deployed and verified on Robinhood Chain**. Their addresses are in `src/config/contracts.ts` and at `/docs/deployments`, and `npm run verify-deployment` checks them against this code. The contracts cannot be upgraded; use amounts you are prepared to lose.

## The problem

Every account on a public chain is an open book. Paste an address into an explorer and you get its balance, its holdings and every payment it has made. Once one address is tied to a person (an exchange withdrawal, a payment to a friend) their whole financial history comes with it. Privacy tools that exist tend to have two further problems:

- **Nobody stays.** Using them costs fees and earns nothing, so pools stay small, and a small pool protects badly.
- **Somebody holds the keys.** An operator who can pause, upgrade or freeze is a single point of failure and pressure.

## The solution

- **Shroud.** Move ETH or $OARKEL into one shared pool. The deposit is public; what comes back is a note only your keys can read.
- **Hold.** Shrouded $OARKEL is counted in vault shares. Fees (creator fee on $OARKEL trades, shroud, unshroud and private transfer fees) are added to the vault without minting shares, so every private share grows in value. Public holders earn nothing.
- **Spend or unshroud.** Pay someone inside the pool, or withdraw to any address, with a zero-knowledge proof that reveals nothing about which note paid.
- **No operator (in the code).** The pool contract has no owner, no admin function, no pause, no proxy and no upgrade path; every parameter is fixed in its constructor.
- **Your wallet sends every transaction.** Shrouds, private sends and unshrouds are submitted from the wallet you connect, which pays the gas in ETH. There is no relayer and no extra fee.

## How it works

```
 public wallet ──shroud──▶ [ shared pool: commitments only ] ──unshroud──▶ any address
                                 │        ▲
              private transfer ──┘        │ fees donated, no new shares
                                          │
                                   [ fee vault ] ──▶ value per private $OARKEL share rises
```

Notes are commitments in one Merkle tree (depth 24); spending publishes a nullifier so a note cannot be spent twice; a proof shows ownership, tree membership and conserved value. Proofs are built in the browser (a Noir circuit proven with UltraHonk, about four seconds) and need no project-specific trusted setup. The pool's proof format keeps a relayer field; the site always sets it to the zero address with a fee of zero, so the connected wallet submits the proof itself. ETH fees accrue in the pool and anyone can sweep them to the fee address fixed at deploy; turning them into $OARKEL for the vault is an operated, off-chain step. The docs on the site cover each piece: `/docs/concepts`, `/docs/pool-and-yield`, `/docs/fees`, `/docs/trust-model`.

## What you can try

Live now:

- Wallet connection on Robinhood Chain (EIP-6963 browser wallets, WalletConnect when configured); the network is added for you.
- Live chain readings: latest block, gas price and the Chainlink ETH/USD feed on Robinhood Chain.
- $OARKEL on `/token`, with a buy card that quotes on chain and sends the swap from your own wallet.
- The app at `/app` on mainnet: shroud ETH or $OARKEL into the pool, hold it as private notes, send privately and unshroud. Proofs are built in your browser and every transaction is sent from your own wallet.
- Six interactive research notes at `/research` on metadata leaks around private notes.

Coming later:

- The automated fee harvester (swept ETH fees bought back as $OARKEL and donated to the vault).

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
scripts/            verify-deployment.mjs, prover and artifact builds
tools/              verify-token.mjs
```

## Contracts and token

| Contract | Status |
| --- | --- |
| $OARKEL (ERC-20, launched on Pons) | `0xb34ceb0a58d9f270844076f77f0add5917ab77f7` |
| Private pool (OarkelPool) | `0xf65100f07a4bbf57047d774ec683f5b741dd55f2` (block 82546758) |
| Proof verifier (HonkVerifier) | `0x6d375cd1d74f9391f2306a1aa91639f269fe04a2` |
| PoseidonT3, PoseidonT4, ZKTranscriptLib, RelationsLib | `0xa09ceb11d309f8c71bed947f85cbe524910ac53f`, `0xa4549b7d8c670a1d0982e8fbeda3c6d553d22f62`, `0x25f4f66a94ab605254df054e0e0259a7a2bfb5e3`, `0xedb415e7c45c75baa05cf869147383aec3083772` |
| Fee harvester | Planned (operated off-chain) |

Deployed values: shroud fee 0.25%, private transfer fee 0.10%, flat unshroud fee 0.0005 ETH or 20 $OARKEL, fee address `0x1ed5e92e2b1d007e3646c26e76438ebc9fc2bf99`, fixed forever at deploy (the constructor refuses anything above 5%). Functions, events, errors and parameters are documented at `/docs/contracts` and `/docs/parameters`; deployed code can be checked with `npm run verify-deployment` and on [Blockscout](https://robinhoodchain.blockscout.com).

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
