/**
 * SuperPaymaster 5.5.0 (balance mode) helpers: generation detection, governable gas params,
 * SuperPaymasterLens dry-run, and the xPNTs v2 allowance / lock reads a wallet needs before it
 * submits a sponsored op.
 *
 * 5.5.0 is an in-place upgrade of the 5.4.2 proxy, so nothing here is selected by address: every
 * function that behaves differently per generation reads `version()` from the chain first.
 *
 * Spec: SuperPaymaster `docs/design/aoa-balance-mode/03-final-spec.md` (v4.1.1, tag v5.5.0-rc.4)
 * and `M-11-downstream-changes.md` §4.
 */
import { type Address, type Hex, type PublicClient, encodeFunctionData, hexToString, size, slice, trim } from 'viem';
import { SuperPaymasterABI, SuperPaymasterV550ABI, SuperPaymasterLensABI, xPNTsTokenV2ABI } from '../abis/index.js';
import {
    SUPER_PAYMASTER_MIN_POST_OP_GAS,
    type SuperPaymasterGeneration,
    superPaymasterGenerationFromVersion,
} from '../superPaymasterData.js';
import type { PackedUserOperation } from './superPaymaster.js';

/** Read `version()` and classify it. One RPC call; deliberately NOT cached (in-place upgrades). */
export async function getSuperPaymasterGeneration(
    client: PublicClient,
    superPaymaster: Address,
): Promise<{ version: string; generation: SuperPaymasterGeneration }> {
    const version = (await client.readContract({
        address: superPaymaster,
        abi: SuperPaymasterABI,
        functionName: 'version',
    })) as string;
    return { version, generation: superPaymasterGenerationFromVersion(version) };
}

/** The ABI matching a generation (5.4.2 core ABI vs 5.5.0 core ∪ Admin union). */
export function superPaymasterAbiFor(generation: SuperPaymasterGeneration) {
    return generation === 'v5.5' ? SuperPaymasterV550ABI : SuperPaymasterABI;
}

export type SuperPaymasterGasParams = {
    minPostOpGas: bigint;
    settleGasBound?: bigint;
    cWrap?: bigint;
    cPostop?: bigint;
    /** Where the value came from — 5.4.x has no getter, its floor is a compile-time constant. */
    source: 'gasParams()' | 'constant(MIN_POST_OP_GAS)';
};

/**
 * Current SP gas parameters. 5.5.0: `gasParams().current` (GOV-5, governable via a ≥48h queue,
 * SuperPaymasterAdmin.sol:331). 5.4.x: the compile-time `MIN_POST_OP_GAS = 200_000`
 * (SuperPaymaster.sol:86 at v5.4.2). Spec §3.2 / M-11 §4.3: read it, don't hardcode it.
 */
export async function getSuperPaymasterGasParams(
    client: PublicClient,
    superPaymaster: Address,
    generation?: SuperPaymasterGeneration,
): Promise<SuperPaymasterGasParams> {
    const gen = generation ?? (await getSuperPaymasterGeneration(client, superPaymaster)).generation;
    if (gen === 'v5.4') return { minPostOpGas: SUPER_PAYMASTER_MIN_POST_OP_GAS, source: 'constant(MIN_POST_OP_GAS)' };
    const res = (await client.readContract({
        address: superPaymaster,
        abi: SuperPaymasterV550ABI,
        functionName: 'gasParams',
    })) as any;
    const current = Array.isArray(res) ? res[0] : res.current;
    const pick = (k: string, i: number) => BigInt(current?.[k] ?? current?.[i] ?? 0);
    return {
        minPostOpGas: pick('minPostOpGas', 0),
        settleGasBound: pick('settleGasBound', 1),
        cWrap: pick('cWrap', 2),
        cPostop: pick('cPostop', 3),
        source: 'gasParams()',
    };
}

// ---------------------------------------------------------------------------------------------
// SuperPaymasterLens dry-run
// ---------------------------------------------------------------------------------------------

/** xPNTs v2 `LockResult` (spec §2.2), appended to DRYRUN_LOCK_REJECTED's low byte by the lens. */
export const XPNTS_V2_LOCK_RESULT = ['OK', 'INSUFFICIENT', 'EMERGENCY', 'SINGLE_TX_LIMIT', 'INVALID_RENEWAL', 'CONFLICTING_LOCK', 'DISABLED'] as const;
/** xPNTs v2 `CreditResult` (spec §2.2), appended to DRYRUN_CREDIT_REJECTED's low byte. */
export const XPNTS_V2_CREDIT_RESULT = ['OK', 'NO_CREDIT', 'EXCEEDS_CAP', 'EMERGENCY', 'SINGLE_TX_LIMIT', 'CONFLICTING', 'DISABLED'] as const;

export type LensReason = {
    /** The `DRYRUN_*` constant name without the prefix, e.g. "TOKEN_MISMATCH"; "OK" for zero. */
    code: string;
    /** For LOCK_REJECTED / CREDIT_REJECTED: the token's typed sub-result, when the lens appended one. */
    detail?: string;
};

/**
 * Decode a lens reason code. The lens returns `bytes32("NAME")` (left-aligned ASCII), and for the
 * two token-side rejections ORs the token's enum value into the LAST byte
 * (`DRYRUN_LOCK_REJECTED | bytes32(lr)`, SuperPaymasterLens.sol:158 / :168 at v5.5.0-rc.4).
 */
export function decodeLensReasonCode(reasonCode: Hex): LensReason {
    if (size(reasonCode) !== 32) throw new Error(`lens reason code must be bytes32, got ${size(reasonCode)} bytes`);
    if (/^0x0{64}$/i.test(reasonCode)) return { code: 'OK' };
    const last = Number(BigInt(slice(reasonCode, 31, 32)));
    const head = slice(reasonCode, 0, 31);
    const text = hexToString(trim(head, { dir: 'right' }));
    if (text === 'LOCK_REJECTED' || text === 'CREDIT_REJECTED') {
        const table = text === 'LOCK_REJECTED' ? XPNTS_V2_LOCK_RESULT : XPNTS_V2_CREDIT_RESULT;
        return last === 0 ? { code: text } : { code: text, detail: table[last] ?? `UNKNOWN(${last})` };
    }
    // Any other code is plain ASCII in all 32 bytes.
    return { code: hexToString(trim(reasonCode, { dir: 'right' })) };
}

export type LensDryRunResult = { ok: boolean; reasonCode: Hex; reason: LensReason };

export type SuperPaymasterLensActions = {
    /** `SuperPaymasterLens.dryRunValidation(sp, userOp, maxCost)` — view; never mutates. */
    dryRunValidation: (args: { superPaymaster: Address; userOp: PackedUserOperation; maxCost: bigint }) => Promise<LensDryRunResult>;
    /** keccak256 of the SP version string the lens is pinned to. */
    expectedSpVersion: () => Promise<Hex>;
    version: () => Promise<string>;
};

export const superPaymasterLensActions = (lens: Address) => (client: PublicClient): SuperPaymasterLensActions => ({
    async dryRunValidation({ superPaymaster, userOp, maxCost }) {
        const res = (await client.readContract({
            address: lens,
            abi: SuperPaymasterLensABI,
            functionName: 'dryRunValidation',
            args: [superPaymaster, userOp, maxCost],
        })) as readonly [boolean, Hex];
        const reasonCode = res[1];
        return { ok: res[0], reasonCode, reason: decodeLensReasonCode(reasonCode) };
    },
    async expectedSpVersion() {
        return (await client.readContract({ address: lens, abi: SuperPaymasterLensABI, functionName: 'EXPECTED_SP_VERSION' })) as Hex;
    },
    async version() {
        return (await client.readContract({ address: lens, abi: SuperPaymasterLensABI, functionName: 'version' })) as string;
    },
});

// ---------------------------------------------------------------------------------------------
// xPNTs v2 (balance mode) reads
// ---------------------------------------------------------------------------------------------

/** True iff `token` reports `BALANCE_MODE_VERSION() == 1` (what SP 5.5.0 configureOperator requires). */
export async function isXPNTsV2(client: PublicClient, token: Address): Promise<boolean> {
    try {
        const v = await client.readContract({ address: token, abi: xPNTsTokenV2ABI, functionName: 'BALANCE_MODE_VERSION' });
        return BigInt(v as any) === 1n;
    } catch {
        return false;
    }
}

export type XPNTsV2SponsorshipState = {
    balance: bigint;
    /** xPNTs escrowed by live/stale locks; `balance - lockedOf` is what the user can still move. */
    lockedOf: bigint;
    /** Per-SP auto allowance in aPNTs (default cap 5,000 aPNTs for the current SP). */
    autoAllowance: { cap: bigint; used: bigint };
    /** User-wide budget in aPNTs (default cap 5,000 aPNTs). */
    userTotal: { cap: bigint; used: bigint };
    /** min(cap - used) over both — the largest aPNTs reservation a new lock can take. */
    remainingAPNTs: bigint;
    renewalMode: number;
    debts: bigint;
    creditReservedOf: bigint;
    effectiveCreditCap: bigint;
};

/**
 * Everything the SP 5.5.0 lock path reads about a user, in one place.
 *
 * Note what is NOT here: an ERC-20 `allowance`. The lock path (`xPNTsTokenV2._lockDecision`,
 * xPNTsTokenV2.sol:190-214) checks only the bounded auto allowance (`_remainingWith`,
 * xPNTsV2Base.sol:275-285) and the free balance; an explicit `approve(SP, …)` does not raise it, and
 * SP-as-caller `transferFrom`/`burn(from)` always revert (spec A-3). When `remainingAPNTs` is too
 * small, the user must renew (`renewForSelf(sp)`, needs lockedOf == 0 and creditReservedOf == 0)
 * or raise the cap (`setAutoAllowance`), both as the USER (msg.sender = the account).
 */
export async function getXPNTsV2SponsorshipState(
    client: PublicClient,
    args: { token: Address; user: Address; superPaymaster: Address },
): Promise<XPNTsV2SponsorshipState> {
    const { token, user, superPaymaster } = args;
    const read = (functionName: string, a: readonly unknown[]) =>
        client.readContract({ address: token, abi: xPNTsTokenV2ABI, functionName, args: a } as any) as Promise<any>;
    const [balance, lockedOf, auto, total, renewalMode, debts, creditReservedOf, effectiveCreditCap] = await Promise.all([
        read('balanceOf', [user]),
        read('lockedOf', [user]),
        read('autoAllowance', [user, superPaymaster]),
        read('userTotal', [user]),
        read('renewalMode', [user]),
        read('debts', [user]),
        read('creditReservedOf', [user]),
        read('effectiveCreditCap', [user]),
    ]);
    const autoAllowance = { cap: BigInt(auto[0]), used: BigInt(auto[1]) };
    const userTotal = { cap: BigInt(total[0]), used: BigInt(total[1]) };
    const r1 = autoAllowance.cap > autoAllowance.used ? autoAllowance.cap - autoAllowance.used : 0n;
    const r2 = userTotal.cap > userTotal.used ? userTotal.cap - userTotal.used : 0n;
    return {
        balance: BigInt(balance),
        lockedOf: BigInt(lockedOf),
        autoAllowance,
        userTotal,
        remainingAPNTs: r1 < r2 ? r1 : r2,
        renewalMode: Number(renewalMode),
        debts: BigInt(debts),
        creditReservedOf: BigInt(creditReservedOf),
        effectiveCreditCap: BigInt(effectiveCreditCap),
    };
}

/**
 * Calldata for `xPNTsTokenV2.renewForSelf(sp)`. It must be executed BY the user (for a smart
 * account: as the account's own call), never by a relayer — the token only touches msg.sender's
 * slots (spec A-6).
 */
export function encodeXPNTsV2RenewForSelf(superPaymaster: Address): Hex {
    return encodeFunctionData({ abi: xPNTsTokenV2ABI, functionName: 'renewForSelf', args: [superPaymaster] });
}
