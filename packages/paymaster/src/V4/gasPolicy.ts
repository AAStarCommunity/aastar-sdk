import type { Hex } from 'viem';

/**
 * Gas limits and fees for a UserOperation, taken from the chain rather than written into the SDK.
 *
 * - Limits: the bundler's estimate (eth_estimateUserOperationGas on the target chain, so its own gas rules
 *   apply) times a stated coefficient. Contract-enforced floors read from the chain (SuperPaymaster
 *   minPostOpGas) only ever raise a limit.
 * - Fees: maxPriorityFeePerGas from eth_feeHistory (a stated percentile of recent blocks' rewards),
 *   maxFeePerGas = latest base fee × a stated multiplier + that priority fee. Fees the caller gives win.
 * - Frozen limits: a data collection fixes its limits once and passes them on every op (they change the
 *   recorded actualGas through EntryPoint v0.7's unused-gas penalty), so they are used as given.
 */

/** Limit = estimate × 1.5. Same coefficient as SuperPaymaster's three-arm collector; override per call. */
export const DEFAULT_GAS_LIMIT_COEFFICIENT_BPS = 15_000n;
/** maxFeePerGas = base fee × 2 + priority fee. */
export const DEFAULT_BASE_FEE_MULTIPLIER = 2n;
/** Priority fee: the 50th percentile of eth_feeHistory rewards. */
export const DEFAULT_PRIORITY_FEE_PERCENTILE = 50;
/** Blocks eth_feeHistory looks back over. */
export const DEFAULT_FEE_HISTORY_BLOCKS = 10;

export interface UserOpGasLimits {
    preVerificationGas: bigint;
    verificationGasLimit: bigint;
    callGasLimit: bigint;
    paymasterVerificationGasLimit: bigint;
    paymasterPostOpGasLimit: bigint;
}

export interface UserOpFees {
    maxFeePerGas: bigint;
    maxPriorityFeePerGas: bigint;
    /** Where the values came from, for the data row. */
    source: 'caller' | 'feeHistory' | 'node-estimate';
    baseFeePerGas?: bigint;
}

export interface FeePolicy {
    baseFeeMultiplier?: bigint;
    priorityFeePercentile?: number;
    feeHistoryBlocks?: number;
}

/** What submitGaslessUserOperation decided for one op, handed to `onGasDecided` so a collector can record it. */
export interface GasDecision {
    limits: UserOpGasLimits;
    fees: UserOpFees;
    /** True when a bundler's explicit "must be at least" made the SDK raise the fees before it accepted the op. */
    feesRaisedByBundler: boolean;
    limitsSource: 'frozen' | 'estimate';
    /** Coefficient applied to the estimate (bps); undefined for frozen limits. */
    coefficientBps?: bigint;
    /** The bundler's estimate before scaling; undefined for frozen limits. */
    estimate?: UserOpGasLimits;
    /** Contract floors applied, read from the chain. */
    floors: { paymasterPostOpGasLimit?: bigint; paymasterVerificationGasLimit?: bigint };
}

export function scaleGas(estimate: bigint, coefficientBps: bigint): bigint {
    if (coefficientBps < 10_000n) throw new Error(`gas coefficient ${coefficientBps} bps is below 1x; the limit would be under the estimate`);
    return (estimate * coefficientBps + 9_999n) / 10_000n;
}

export function scaleLimits(estimate: UserOpGasLimits, coefficientBps: bigint): UserOpGasLimits {
    return {
        preVerificationGas: scaleGas(estimate.preVerificationGas, coefficientBps),
        verificationGasLimit: scaleGas(estimate.verificationGasLimit, coefficientBps),
        callGasLimit: scaleGas(estimate.callGasLimit, coefficientBps),
        paymasterVerificationGasLimit: scaleGas(estimate.paymasterVerificationGasLimit, coefficientBps),
        paymasterPostOpGasLimit: scaleGas(estimate.paymasterPostOpGasLimit, coefficientBps),
    };
}

const median = (xs: bigint[]): bigint => {
    const s = [...xs].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    return s[Math.floor((s.length - 1) / 2)];
};

/**
 * Fees for a UserOperation. Both caller values given → used as they are. Otherwise eth_feeHistory over the
 * last `feeHistoryBlocks` blocks: priority = median of the `priorityFeePercentile` rewards, maxFee = the
 * next block's base fee × `baseFeeMultiplier` + priority. A node without eth_feeHistory falls back to
 * eth_maxPriorityFeePerGas and the latest block's base fee. No floor is added for any chain; a bundler that
 * needs more says so in its rejection, and the caller passes explicit fees.
 */
export async function resolveUserOpFees(
    client: any,
    given: { maxFeePerGas?: bigint; maxPriorityFeePerGas?: bigint },
    policy: FeePolicy = {},
): Promise<UserOpFees> {
    const multiplier = policy.baseFeeMultiplier ?? DEFAULT_BASE_FEE_MULTIPLIER;
    if (given.maxFeePerGas !== undefined && given.maxPriorityFeePerGas !== undefined) {
        if (given.maxFeePerGas < given.maxPriorityFeePerGas) throw new Error('maxFeePerGas is below maxPriorityFeePerGas');
        return { maxFeePerGas: given.maxFeePerGas, maxPriorityFeePerGas: given.maxPriorityFeePerGas, source: 'caller' };
    }
    let priority: bigint | undefined;
    let baseFee: bigint | undefined;
    let source: UserOpFees['source'] = 'feeHistory';
    try {
        const h = await client.getFeeHistory({
            blockCount: policy.feeHistoryBlocks ?? DEFAULT_FEE_HISTORY_BLOCKS,
            blockTag: 'latest',
            rewardPercentiles: [policy.priorityFeePercentile ?? DEFAULT_PRIORITY_FEE_PERCENTILE],
        }) as { baseFeePerGas?: (bigint | Hex)[]; reward?: (bigint | Hex)[][] };
        const rewards = (h.reward ?? []).map((r) => BigInt(r[0])).filter((r) => r >= 0n);
        if (rewards.length > 0) priority = median(rewards);
        // baseFeePerGas has one more entry than blocks: the last is the next block's base fee.
        const bases = h.baseFeePerGas ?? [];
        if (bases.length > 0) baseFee = BigInt(bases[bases.length - 1]);
    } catch { /* fall back below */ }
    if (priority === undefined || baseFee === undefined) {
        source = 'node-estimate';
        if (priority === undefined) priority = BigInt(await client.estimateMaxPriorityFeePerGas());
        if (baseFee === undefined) {
            const block = await client.getBlock({ blockTag: 'latest' });
            if (block.baseFeePerGas === undefined || block.baseFeePerGas === null) throw new Error('the chain reports no base fee; pass maxFeePerGas and maxPriorityFeePerGas');
            baseFee = BigInt(block.baseFeePerGas);
        }
    }
    const maxPriorityFeePerGas = given.maxPriorityFeePerGas ?? priority;
    const maxFeePerGas = given.maxFeePerGas ?? baseFee * multiplier + maxPriorityFeePerGas;
    if (maxFeePerGas < maxPriorityFeePerGas) throw new Error('maxFeePerGas is below maxPriorityFeePerGas');
    return { maxFeePerGas, maxPriorityFeePerGas, source, baseFeePerGas: baseFee };
}
