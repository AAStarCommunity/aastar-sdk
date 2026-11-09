import { type Address, type Hex } from 'viem';
import {
    SuperPaymasterABI,
    SuperPaymasterV550ABI,
    xPNTsTokenV2ABI,
    XPNTS_V2_LOCK_RESULT,
    SUPER_PAYMASTER_MIN_POST_OP_GAS,
    SUPER_PAYMASTER_V55_VERIFICATION_GAS_FLOOR,
    type SuperPaymasterGeneration,
    getSuperPaymasterGasParams,
    getSuperPaymasterGeneration,
} from '@aastar/core';

/**
 * Everything the SDK reads from the chain before building a SuperPaymaster op. Read fresh per op:
 * 5.4.2 → 5.5.0 is an in-place upgrade at the same address, so a cached answer goes stale exactly
 * at the moment it matters.
 */
export type SuperPaymasterSponsorshipContext = {
    version: string;
    generation: SuperPaymasterGeneration;
    /** `operators(operator).xPNTsToken` — the token 5.5.0 requires in paymasterAndData. */
    token: Address;
    isConfigured: boolean;
    isPaused: boolean;
    /** Contract-enforced floor for paymasterPostOpGasLimit (5.5.0: gasParams(); 5.4.2: 200k constant). */
    minPostOpGas: bigint;
    /**
     * SDK floor for paymasterVerificationGasLimit. 5.5.0: the spec §3.2 draft value (250k);
     * 5.4.x: 0 (no floor — keep the existing efficiency tuning untouched on the live deployment).
     */
    verificationGasFloor: bigint;
};

export async function resolveSuperPaymasterSponsorship(
    client: any,
    paymaster: Address,
    operator: Address,
): Promise<SuperPaymasterSponsorshipContext> {
    const { version, generation } = await getSuperPaymasterGeneration(client, paymaster);
    // operators() has the same selector AND return shape on 5.4.2 and 5.5.0 (M-11 §2.6), so the
    // 5.4.2 ABI decodes both.
    const op = (await client.readContract({
        address: paymaster,
        abi: SuperPaymasterABI,
        functionName: 'operators',
        args: [operator],
    })) as readonly unknown[];
    const gp = await getSuperPaymasterGasParams(client, paymaster, generation);
    const minPostOpGas = gp.minPostOpGas > 0n ? gp.minPostOpGas : SUPER_PAYMASTER_MIN_POST_OP_GAS;
    return {
        version,
        generation,
        token: op[3] as Address,
        isConfigured: op[1] as boolean,
        isPaused: op[2] as boolean,
        minPostOpGas,
        verificationGasFloor: generation === 'v5.5' ? SUPER_PAYMASTER_V55_VERIFICATION_GAS_FLOOR : 0n,
    };
}

/**
 * `SuperPaymasterStorage.VALIDATION_BUFFER_BPS` (internal constant, SuperPaymasterStorage.sol:209 at
 * v5.5.0-rc.4). Not readable on chain, so it is pinned here; check:sp550-abis re-pins the tag.
 */
export const SUPER_PAYMASTER_VALIDATION_BUFFER_BPS = 1000n;

const ceilDiv = (a: bigint, b: bigint) => (a + b - 1n) / b;

/** EntryPoint v0.7 `maxCost` (requiredPrefund): every gas limit of the op times maxFeePerGas. */
export function userOpMaxCostV07(op: {
    verificationGasLimit: bigint;
    callGasLimit: bigint;
    paymasterVerificationGasLimit: bigint;
    paymasterPostOpGasLimit: bigint;
    preVerificationGas: bigint;
    maxFeePerGas: bigint;
}): bigint {
    return (op.verificationGasLimit + op.callGasLimit + op.paymasterVerificationGasLimit
        + op.paymasterPostOpGasLimit + op.preVerificationGas) * op.maxFeePerGas;
}

export type SpRenewDecision = {
    spRenew: boolean;
    /** The reservation SP 5.5.0 will ask the token for (`aPNTsAmount`, aPNTs), as computed by the SDK. */
    a0?: bigint;
    /** previewLock result without / with the renewal (XPNTS_V2_LOCK_RESULT names). */
    plain?: string;
    renewed?: string;
    reason: string;
};

/**
 * Whether a SuperPaymaster 5.5.0 op should carry SUPER_PAYMASTER_FLAGS.SP_RENEW: only when it is
 * NEEDED (the auto allowance cannot cover a0 without it) and ALLOWED (the token would accept it).
 * Both answers come from the token's own decision, `xPNTsTokenV2.previewLock`, the read-only mirror
 * of the `tryLockForGas` call SP makes in validation (xPNTsTokenV2.sol:190-222 at v5.5.0-rc.4):
 *
 * - plain = previewLock(sp, user, h, a0, false). OK → no flag (renewing would spend the single K
 *   for nothing). Anything but INSUFFICIENT → no flag (renewal cannot fix it).
 * - renewed = previewLock(…, true). OK → flag. INVALID_RENEWAL (mode ≠ MODE_SP_K, K used, a live
 *   lock or credit reservation) or INSUFFICIENT (the balance, not the allowance, is short) → no flag;
 *   SP then tries credit, as it would without the flag.
 *
 * a0 mirrors SuperPaymaster.sol:305-310 (`_calculateAPNTsAmount(maxCost)` × (1 + fee + buffer),
 * both roundings up) from the same reads SP makes. It is the reservation for THIS op's gas limits
 * and fee: call it again whenever they change. A keeper price update between this read and
 * inclusion moves a0; the decision is then off only if the remaining allowance sits within that move.
 *
 * Any read failure → no flag (the behaviour before this existed).
 */
export async function decideSuperPaymasterSpRenew(
    client: any,
    args: { superPaymaster: Address; token: Address; user: Address; maxCost: bigint },
): Promise<SpRenewDecision> {
    const { superPaymaster, token, user, maxCost } = args;
    try {
        const read = (functionName: string) =>
            client.readContract({ address: superPaymaster, abi: SuperPaymasterV550ABI, functionName }) as Promise<any>;
        const [cache, aPNTsPriceUSD, feeBps] = await Promise.all([read('cachedPrice'), read('aPNTsPriceUSD'), read('protocolFeeBPS')]);
        const price = BigInt(cache?.price ?? cache?.[0]);
        const decimals = BigInt(cache?.decimals ?? cache?.[3]);
        if (price <= 0n) return { spRenew: false, reason: 'cachedPrice <= 0 (SP would revert OracleError)' };
        const base = ceilDiv(maxCost * price * 10n ** 18n, 10n ** decimals * BigInt(aPNTsPriceUSD));
        const a0 = ceilDiv(base * (10_000n + BigInt(feeBps) + SUPER_PAYMASTER_VALIDATION_BUFFER_BPS), 10_000n);
        // opHash only feeds the CONFLICTING_LOCK check, and the real hash depends on the flag being
        // decided; no lock can exist under the zero hash.
        const h = ('0x' + '00'.repeat(32)) as Hex;
        const preview = async (spRenew: boolean) => {
            const r = (await client.readContract({
                address: token, abi: xPNTsTokenV2ABI, functionName: 'previewLock', args: [superPaymaster, user, h, a0, spRenew],
            })) as readonly [number | bigint, bigint];
            return XPNTS_V2_LOCK_RESULT[Number(r[0])] ?? `UNKNOWN(${r[0]})`;
        };
        const plain = await preview(false);
        if (plain === 'OK') return { spRenew: false, a0, plain, reason: 'the auto allowance covers a0' };
        if (plain !== 'INSUFFICIENT') return { spRenew: false, a0, plain, reason: `${plain}: a renewal would not change it` };
        const renewed = await preview(true);
        if (renewed === 'OK') return { spRenew: true, a0, plain, renewed, reason: 'allowance exhausted; the inline renewal is allowed' };
        return { spRenew: false, a0, plain, renewed, reason: `inline renewal not possible (${renewed})` };
    } catch (e: any) {
        return { spRenew: false, reason: `read failed: ${String(e?.shortMessage ?? e?.message ?? e).slice(0, 120)}` };
    }
}

/** Raise `value` to `floor` (never lowers a caller's limit). */
export function atLeast(value: bigint | undefined, floor: bigint): bigint {
    const v = value ?? 0n;
    return v > floor ? v : floor;
}

/**
 * Single in-flight op per sender through SuperPaymaster 5.5.0 (spec 03-final-spec §3.2, F1):
 * "SDK and AirAccount enforce". This is the SDK half, scoped to what an SDK can actually know —
 * the ops IT submitted in this process. An op is in flight from submission until the account's
 * EntryPoint nonce moves past the nonce it was signed with.
 *
 * It does not (cannot) see ops submitted by another process or wallet for the same sender; the
 * bundler-side `same_sender_mempool_count 1` (spec §3.2, measured on Rundler) covers that.
 */
export class SuperPaymasterInflightGuard {
    private static readonly pending = new Map<string, { nonce: bigint; userOpHash?: string; reservation?: symbol }>();

    private static key(chainId: number | bigint, entryPoint: Address, sender: Address): string {
        return `${chainId}:${entryPoint.toLowerCase()}:${sender.toLowerCase()}`;
    }

    /**
     * Throw if this process already has an op from `sender` that the chain has not consumed yet
     * (recorded nonce >= current on-chain nonce). Clears the record once it has been consumed.
     */
    static assertNoneInFlight(chainId: number | bigint, entryPoint: Address, sender: Address, currentNonce: bigint): void {
        const k = this.key(chainId, entryPoint, sender);
        const rec = this.pending.get(k);
        if (!rec) return;
        if (currentNonce > rec.nonce) {
            this.pending.delete(k);
            return;
        }
        throw new Error(
            `SuperPaymaster 5.5.0 allows one in-flight sponsored op per sender (spec §3.2 F1): ` +
            `${sender} already has nonce ${rec.nonce} pending${rec.userOpHash ? ` (${rec.userOpHash})` : ''}. ` +
            `Wait for its receipt before submitting the next one (if the bundler dropped it, call ` +
            `SuperPaymasterInflightGuard.release(chainId, entryPoint, sender)).`,
        );
    }

    /**
     * Check-and-claim in one synchronous step: throws like assertNoneInFlight, otherwise records
     * `currentNonce` as in flight before returning, so a concurrent caller for the same sender is
     * rejected even while this one is still signing. Returns a release function that only drops
     * THIS reservation (a later record() for the same sender is left alone).
     */
    static reserve(chainId: number | bigint, entryPoint: Address, sender: Address, currentNonce: bigint): () => void {
        this.assertNoneInFlight(chainId, entryPoint, sender, currentNonce);
        const k = this.key(chainId, entryPoint, sender);
        const reservation = Symbol(k);
        this.pending.set(k, { nonce: currentNonce, reservation });
        return () => {
            if (this.pending.get(k)?.reservation === reservation) this.pending.delete(k);
        };
    }

    /**
     * Record a submitted op. Never lowers the recorded nonce: a send for nonce N whose answer
     * arrives after the chain consumed N and another call reserved N+1 must not overwrite N+1 —
     * that would let a third call clear the stale N and sign N+1 a second time.
     */
    static record(chainId: number | bigint, entryPoint: Address, sender: Address, nonce: bigint, userOpHash?: string): void {
        const k = this.key(chainId, entryPoint, sender);
        const prev = this.pending.get(k);
        if (prev && prev.nonce > nonce) return;
        this.pending.set(k, { nonce, userOpHash });
    }

    /** Drop a record (e.g. after the caller observed a receipt or decided the op was dropped). */
    static release(chainId: number | bigint, entryPoint: Address, sender: Address): void {
        this.pending.delete(this.key(chainId, entryPoint, sender));
    }

    /** Test helper. */
    static clearAll(): void {
        this.pending.clear();
    }
}
