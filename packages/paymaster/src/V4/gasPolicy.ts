import type { Hex } from 'viem';

/**
 * Gas limits and fees for a UserOperation, taken from the chain rather than written into the SDK.
 *
 * - Limits: the bundler's estimate (eth_estimateUserOperationGas on the target chain, so its own gas rules
 *   apply) times a stated coefficient. Contract-enforced floors read from the chain (SuperPaymaster
 *   minPostOpGas) only ever raise a limit.
 * - Fees: maxPriorityFeePerGas from eth_feeHistory (a stated percentile of recent blocks' rewards),
 *   maxFeePerGas = latest base fee × a stated multiplier + that priority fee. Fees the caller gives win.
 * - preVerificationGas is NOT a limit: EntryPoint v0.7 charges it in full (it is added to preOpGas whole), so it has
 *   its own coefficient, default 1.0 (the bundler's estimate as is; a bundler that wants more says "must be at least"
 *   and the submit retry raises it).
 * - What the gas values change in the charge (EntryPoint v0.7): the unused part of the two EXECUTION limits
 *   (callGasLimit + paymasterPostOpGasLimit) at 10% — v0.7 has no threshold, any unused execution gas is penalised
 *   (the 40,000 PENALTY_GAS_THRESHOLD is v0.8's) — and preVerificationGas in full. Verification limits do not.
 *   So a data collection fixes its limits once and passes them on every op (frozenGas), used as given.
 */

/** Limit = estimate × 1.5. Same coefficient as SuperPaymaster's three-arm collector; override per call. */
export const DEFAULT_GAS_LIMIT_COEFFICIENT_BPS = 15_000n;
/** preVerificationGas = estimate × 1.0: it is charged in full, so a margin on it is paid on every op. */
export const DEFAULT_PVG_COEFFICIENT_BPS = 10_000n;
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

/**
 * Where one sent limit came from: frozenGas, an explicit option, the caller's tuneEstimate, the bundler estimate ×
 * coefficient, a contract floor read from the chain, an SDK default (estimation off or skipped), the SDK's local
 * preVerificationGas calculation, or a bundler's explicit requirement in the retry loop.
 */
export type LimitSource = 'frozen' | 'explicit' | 'tuned' | 'estimate' | 'floor' | 'default' | 'computed' | 'bundler-retry';

/** What submitGaslessUserOperation decided for one op, handed to `onGasDecided` so a collector can record it. */
export interface GasDecision {
    limits: UserOpGasLimits;
    /** Per field: where the sent value came from. */
    limitSources: Record<keyof UserOpGasLimits, LimitSource>;
    fees: UserOpFees;
    /** True when a bundler's explicit "must be at least" made the SDK raise the fees before it accepted the op. */
    feesRaisedByBundler: boolean;
    /** 'frozen': all five frozen; 'estimate': every field from the estimate (or a floor over it); otherwise 'mixed'. */
    limitsSource: 'frozen' | 'estimate' | 'mixed';
    /** Coefficient applied to the estimate (bps), when any field came from it. */
    coefficientBps?: bigint;
    /** Coefficient applied to the preVerificationGas estimate (bps), when it came from the estimate. */
    pvgCoefficientBps?: bigint;
    /** The bundler's estimate before scaling; undefined for frozen limits. */
    estimate?: UserOpGasLimits;
    /** Floors applied: minPostOpGas read from the chain, and the caller's superPaymasterVerificationGasFloor when given. */
    floors: { paymasterPostOpGasLimit?: bigint; paymasterVerificationGasLimit?: bigint };
}

export function scaleGas(estimate: bigint, coefficientBps: bigint): bigint {
    if (coefficientBps < 10_000n) throw new Error(`gas coefficient ${coefficientBps} bps is below 1x; the limit would be under the estimate`);
    return (estimate * coefficientBps + 9_999n) / 10_000n;
}

/** Limits × coefficientBps; preVerificationGas × pvgCoefficientBps (default 1.0: it is charged in full, not a limit). */
export function scaleLimits(estimate: UserOpGasLimits, coefficientBps: bigint, pvgCoefficientBps: bigint = DEFAULT_PVG_COEFFICIENT_BPS): UserOpGasLimits {
    return {
        preVerificationGas: scaleGas(estimate.preVerificationGas, pvgCoefficientBps),
        verificationGasLimit: scaleGas(estimate.verificationGasLimit, coefficientBps),
        callGasLimit: scaleGas(estimate.callGasLimit, coefficientBps),
        paymasterVerificationGasLimit: scaleGas(estimate.paymasterVerificationGasLimit, coefficientBps),
        paymasterPostOpGasLimit: scaleGas(estimate.paymasterPostOpGasLimit, coefficientBps),
    };
}

/** Median; for an even count the mean of the two middle values, rounded down. */
const median = (xs: bigint[]): bigint => {
    const s = [...xs].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const mid = Math.floor(s.length / 2);
    return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2n;
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
    if (multiplier < 1n) throw new Error(`baseFeeMultiplier ${multiplier} is below 1: maxFeePerGas would be under the base fee`);
    if (given.maxFeePerGas !== undefined && given.maxPriorityFeePerGas !== undefined) {
        if (given.maxFeePerGas < given.maxPriorityFeePerGas) throw new Error('maxFeePerGas is below maxPriorityFeePerGas');
        return { maxFeePerGas: given.maxFeePerGas, maxPriorityFeePerGas: given.maxPriorityFeePerGas, source: 'caller' };
    }
    // Only the missing fields are taken from the chain: the priority fee when it is not given, the base fee only
    // when maxFeePerGas has to be calculated.
    const needPriority = given.maxPriorityFeePerGas === undefined;
    const needBase = given.maxFeePerGas === undefined;
    let priority = given.maxPriorityFeePerGas;
    let baseFee: bigint | undefined;
    let source: UserOpFees['source'] = 'feeHistory';
    try {
        const h = await client.getFeeHistory({
            blockCount: policy.feeHistoryBlocks ?? DEFAULT_FEE_HISTORY_BLOCKS,
            blockTag: 'latest',
            rewardPercentiles: [policy.priorityFeePercentile ?? DEFAULT_PRIORITY_FEE_PERCENTILE],
        }) as { baseFeePerGas?: (bigint | Hex)[]; reward?: (bigint | Hex)[][] };
        const rewards = (h.reward ?? []).map((r) => BigInt(r[0])).filter((r) => r >= 0n);
        if (needPriority && rewards.length > 0) priority = median(rewards);
        // baseFeePerGas has one more entry than blocks: the last is the next block's base fee.
        const bases = h.baseFeePerGas ?? [];
        if (bases.length > 0) baseFee = BigInt(bases[bases.length - 1]);
    } catch { /* fall back below */ }
    if (priority === undefined || (needBase && baseFee === undefined)) {
        source = 'node-estimate';
        if (priority === undefined) priority = BigInt(await client.estimateMaxPriorityFeePerGas());
        if (needBase && baseFee === undefined) {
            const block = await client.getBlock({ blockTag: 'latest' });
            if (block.baseFeePerGas === undefined || block.baseFeePerGas === null) throw new Error('the chain reports no base fee; pass maxFeePerGas and maxPriorityFeePerGas');
            baseFee = BigInt(block.baseFeePerGas);
        }
    }
    const maxPriorityFeePerGas = priority as bigint;
    const maxFeePerGas = given.maxFeePerGas ?? (baseFee as bigint) * multiplier + maxPriorityFeePerGas;
    if (maxFeePerGas < maxPriorityFeePerGas) throw new Error('maxFeePerGas is below maxPriorityFeePerGas');
    return { maxFeePerGas, maxPriorityFeePerGas, source, baseFeePerGas: baseFee };
}

/**
 * The most a UserOperation can cost, in wei: all five gas terms × maxFeePerGas,
 * (preVerificationGas + verificationGasLimit + callGasLimit + paymasterVerificationGasLimit + paymasterPostOpGasLimit)
 * × maxFeePerGas — EntryPoint v0.7's requiredPrefund, and the maxCost SuperPaymaster locks against.
 */
export function userOpCostCeilingWei(limits: UserOpGasLimits, maxFeePerGas: bigint): bigint {
    return (limits.preVerificationGas + limits.verificationGasLimit + limits.callGasLimit
        + limits.paymasterVerificationGasLimit + limits.paymasterPostOpGasLimit) * maxFeePerGas;
}

/** The UserOperation exactly as it is about to be signed (every signature, retries included). */
export interface UserOpSignView {
    userOpHash: `0x${string}`;
    sender: `0x${string}`;
    nonce: bigint;
    limits: UserOpGasLimits;
    maxFeePerGas: bigint;
    maxPriorityFeePerGas: bigint;
    /** userOpCostCeilingWei(limits, maxFeePerGas). */
    maxCostWei: bigint;
    paymasterAndData: `0x${string}`;
}

/** The cost ceiling on what the SDK signs: refused before any signature, nothing signed or sent. */
export class UserOpCostCapError extends Error {
    constructor(readonly maxCostWei: bigint, readonly capWei: bigint) {
        super(`refusing to sign: the UserOperation can cost up to ${maxCostWei} wei (all five gas terms × maxFeePerGas), above maxUserOpCostWei ${capWei}; nothing was signed or sent`);
        this.name = 'UserOpCostCapError';
    }
}

/** What a signing path may be given: a hard ceiling (default off) and a hook that sees the op and can refuse it. */
export interface UserOpSignGuardOptions {
    /** Refuse, before signing, an op whose userOpCostCeilingWei exceeds this. Default off (no ceiling). */
    maxUserOpCostWei?: bigint;
    /** Called with the exact op before EVERY signature (retries included); throwing refuses it, nothing is signed. */
    beforeSignUserOp?: (op: UserOpSignView) => void | Promise<void>;
}

/** Runs the ceiling, then the hook; returns only when the op may be signed. */
export async function guardUserOpSignature(op: UserOpSignView, o: UserOpSignGuardOptions | undefined): Promise<void> {
    if (o?.maxUserOpCostWei !== undefined) {
        if (typeof o.maxUserOpCostWei !== 'bigint' || o.maxUserOpCostWei <= 0n) throw new Error(`maxUserOpCostWei must be a positive bigint (got ${String(o.maxUserOpCostWei)}); nothing was signed`);
        if (op.maxCostWei > o.maxUserOpCostWei) throw new UserOpCostCapError(op.maxCostWei, o.maxUserOpCostWei);
    }
    if (o?.beforeSignUserOp) await o.beforeSignUserOp(op);
}
