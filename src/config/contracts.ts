import { BRAND, CHAIN, isAddress } from "@/config/brand";

/*
 * Oarkel contract addresses: the ONE place to fill in after deployment (the
 * owner page /deploy prints the exact lines).
 *
 * Before the CA (none of these depend on the token):
 *   POSEIDON_T3, POSEIDON_T4          hash libraries the pool links to
 *   ZK_TRANSCRIPT_LIB, RELATIONS_LIB  libraries the verifier links to
 *   VERIFIER                          HonkVerifier (verification key of circuits/transact)
 * After the CA:
 *   POOL, POOL_DEPLOY_BLOCK           OarkelPool and its deployment block (where log scans start)
 *   FEE_SINK                          the fee address given to the pool's constructor (for verify-deployment)
 *
 * Empty addresses keep the app in practice mode. When POOL, POOL_DEPLOY_BLOCK
 * and the real CA (src/config/brand.ts) are all set, /app sends real
 * transactions through the connected wallet.
 */
const POSEIDON_T3 = "";
const POSEIDON_T4 = "";
const ZK_TRANSCRIPT_LIB = "";
const RELATIONS_LIB = "";
const VERIFIER = "";
const POOL = "";
const POOL_DEPLOY_BLOCK = 0;
const FEE_SINK = "";

/**
 * Local end-to-end testing only (anvil): a JSON object passed at build time,
 * e.g. NEXT_PUBLIC_OARKEL_TEST_CONTRACTS='{"pool":"0x…","verifier":"0x…","token":"0x…","block":1}'.
 * Never set on a real deployment.
 */
type TestContracts = { pool: string; verifier: string; token: string; block: number };
const TEST: TestContracts | null = (() => {
  const raw = process.env.NEXT_PUBLIC_OARKEL_TEST_CONTRACTS;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TestContracts;
  } catch {
    return null;
  }
})();

export const LIBRARIES = {
  PoseidonT3: POSEIDON_T3,
  PoseidonT4: POSEIDON_T4,
  ZKTranscriptLib: ZK_TRANSCRIPT_LIB,
  RelationsLib: RELATIONS_LIB,
} as const;

export const CONTRACTS = {
  feeSink: FEE_SINK,
  verifier: TEST?.verifier ?? VERIFIER,
  pool: TEST?.pool ?? POOL,
  poolDeployBlock: TEST?.block ?? POOL_DEPLOY_BLOCK,
  token: TEST?.token ?? BRAND.ca,
} as const;

/** Constructor parameters the deploy page proposes. Fixed forever once deployed. */
export const POOL_DEFAULTS = {
  shroudFeeBps: 25,
  transferFeeBps: 10,
  /** 0.0005 ETH */
  unshroudFeeEthWei: 500_000_000_000_000n,
  /** 20 $OARKEL, in whole tokens (multiplied by the token's decimals on deploy). */
  unshroudFeeTokens: 20n,
} as const;

/** Suggested relayer fees (the relayer sets its own; these are what the app offers by default). */
export const RELAYER_DEFAULT_FEE = { ethWei: 200_000_000_000_000n, tokens: 8n } as const;

/**
 * Optional relayers (keeper/relayer.mjs), comma-separated, tried in order: the app uses the first one
 * that answers and moves to the next when one refuses work. Empty: users submit from their own wallet.
 */
export const RELAYER_URL = process.env.NEXT_PUBLIC_OARKEL_RELAYER_URL || "";

export const poolLive = () => isAddress(CONTRACTS.pool) && isAddress(CONTRACTS.token) && CONTRACTS.poolDeployBlock > 0;
export const verifierLive = () => isAddress(CONTRACTS.verifier);

export const explorerTx = (hash: string) => `${CHAIN.explorer}/tx/${hash}`;
