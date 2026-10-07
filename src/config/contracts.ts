import { BRAND, CHAIN, isAddress } from "@/config/brand";

/*
 * Oarkel contract addresses: the ONE place they are set (all live since 7 Oct 2026).
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
const POSEIDON_T3 = "0xa09ceb11d309f8c71bed947f85cbe524910ac53f";
const POSEIDON_T4 = "0xa4549b7d8c670a1d0982e8fbeda3c6d553d22f62";
const ZK_TRANSCRIPT_LIB = "0x25f4f66a94ab605254df054e0e0259a7a2bfb5e3";
const RELATIONS_LIB = "0xedb415e7c45c75baa05cf869147383aec3083772";
const VERIFIER = "0x6d375cd1d74f9391f2306a1aa91639f269fe04a2";
const POOL = "0xf65100f07a4bbf57047d774ec683f5b741dd55f2";
const POOL_DEPLOY_BLOCK = 82546758;
const FEE_SINK = "0x1ed5e92e2b1d007e3646c26e76438ebc9fc2bf99";

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

export const poolLive = () => isAddress(CONTRACTS.pool) && isAddress(CONTRACTS.token) && CONTRACTS.poolDeployBlock > 0;
export const verifierLive = () => isAddress(CONTRACTS.verifier);

export const explorerTx = (hash: string) => `${CHAIN.explorer}/tx/${hash}`;
