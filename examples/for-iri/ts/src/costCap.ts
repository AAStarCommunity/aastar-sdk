import type { PublicClient } from 'viem';

/**
 * Chains where a UserOperation spends nothing real: anvil, Sepolia, OP Sepolia. Any other chain counts as real money.
 * A copy of tests/regression/userop-chain-gate.ts TEST_CHAIN_IDS (this package does not import the repo's tests);
 * scripts/check-gasless-cost-cap.test.ts asserts the two are equal.
 */
export const TEST_CHAIN_IDS: ReadonlySet<number> = new Set([31337, 11155111, 11155420]);

/**
 * The per-UserOp cost ceiling these examples pass to the SDK, from AASTAR_MAX_USEROP_COST_WEI (wei; no default).
 * The chain is the one the RPC reports (and the bundler, when given, must report the same), not a constant in the
 * script: outside TEST_CHAIN_IDS a missing or malformed ceiling throws before anything is signed.
 */
export async function gaslessCostCapFromEnv(publicClient: Pick<PublicClient, 'getChainId'>, bundler?: Pick<PublicClient, 'getChainId'>): Promise<{ maxUserOpCostWei: bigint | undefined }> {
    const raw = process.env.AASTAR_MAX_USEROP_COST_WEI;
    let cap: bigint | undefined;
    if (raw !== undefined) {
        if (!/^[1-9][0-9]{0,40}$/.test(raw)) throw new Error(`AASTAR_MAX_USEROP_COST_WEI must be a positive integer in wei (got ${JSON.stringify(raw)})`);
        cap = BigInt(raw);
    }
    const chainId = await publicClient.getChainId();
    if (bundler) {
        const b = await bundler.getChainId();
        if (b !== chainId) throw new Error(`the bundler reports chain ${b}, but the RPC reports chain ${chainId}; refusing to sign`);
    }
    if (!TEST_CHAIN_IDS.has(chainId) && cap === undefined) {
        throw new Error(`chain ${chainId} is not a test chain: a gasless send there needs an explicit per-UserOp cost ceiling: set AASTAR_MAX_USEROP_COST_WEI (no default)`);
    }
    return { maxUserOpCostWei: cap };
}
