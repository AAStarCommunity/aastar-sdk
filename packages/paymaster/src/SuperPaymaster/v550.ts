import { type Address } from 'viem';
import {
    SuperPaymasterABI,
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
    private static readonly pending = new Map<string, { nonce: bigint; userOpHash?: string }>();

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

    static record(chainId: number | bigint, entryPoint: Address, sender: Address, nonce: bigint, userOpHash?: string): void {
        this.pending.set(this.key(chainId, entryPoint, sender), { nonce, userOpHash });
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
