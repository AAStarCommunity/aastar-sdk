import { type Address, type Hex, isAddressEqual, size, isHex } from 'viem';
import type { InitConfig, TokenConfig } from './airAccount.js';
import { AAStarError, ErrorCode } from '../errors/index.js';

/**
 * High-level `InitConfig` builder for v0.20.0 account creation — wires P-256 (passkey)
 * guardians through the factory's 8-field `InitConfig` (airaccount-contract #120, spec §9).
 *
 * Each guardian slot is either:
 *   - an **ECDSA** guardian (`{ ecdsa: 0x… }`) → `guardians[i] = addr`, `guardianP256X/Y[i] = 0`, or
 *   - a **P-256** passkey guardian (`{ p256: { x, y } }`) → `guardians[i] = address(0)`,
 *     `guardianP256X/Y[i] = (x, y)`. The contract converts this to the `0x7026` sentinel + parallel
 *     `(x, y)` storage at init.
 *
 * Mirrors and pre-checks the on-chain invariants the contract's `_initialize` enforces (so a bad
 * config fails locally with a clear message, not as an opaque `InvalidGuardian` revert):
 *   - an ECDSA slot carries NO P-256 coordinates,
 *   - P-256 coordinates are all-or-nothing (`x == 0` iff `y == 0`),
 *   - ≤ 3 guardian slots, and the `0x7026` sentinel is never used as a plain ECDSA address.
 *
 * Feed the result straight into `airAccountFactoryActions(factory).createAccount({ owner, salt, config })`.
 */

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address;
const ZERO32 = `0x${'00'.repeat(32)}` as Hex;
const P256_GUARDIAN_SENTINEL = '0x0000000000000000000000000000000000007026' as Address;
const ALG_ECDSA = 2;
const ALG_PASSKEY_P256 = 1;

/** One guardian slot for {@link buildInitConfig}: supply EXACTLY one of `ecdsa` or `p256`. */
export interface GuardianSpec {
    /** An ECDSA (EOA / Safe) guardian address. Mutually exclusive with `p256`. */
    ecdsa?: Address;
    /** A P-256 (WebAuthn passkey) guardian public key (x, y, each bytes32). Mutually exclusive with `ecdsa`. */
    p256?: { x: Hex; y: Hex };
}

/** Parameters for {@link buildInitConfig}. */
export interface BuildInitConfigParams {
    /** Up to 3 guardian slots (ECDSA and/or P-256, freely mixed). Empty/omitted ⇒ no guardians. */
    guardians?: readonly GuardianSpec[];
    /** Per-account daily spend limit (wei). Must be > 0 to enable the on-chain GUARD. */
    dailyLimit: bigint;
    /**
     * Validator algorithm ids approved at init (e.g. 2 = ECDSA, 1 = P-256/passkey). If omitted,
     * derived from the owner/guardian mix is NOT possible (owner alg is separate), so it defaults
     * to `[2]` (ECDSA) plus `1` (P-256) when any P-256 guardian is present.
     */
    approvedAlgIds?: readonly number[];
    /** Floor the daily limit can be decreased to via the guard. Defaults to 0. */
    minDailyLimit?: bigint;
    /** ERC-20 tokens to pre-register with the guard. Defaults to none. */
    initialTokens?: readonly Address[];
    /** Per-token tier configs, index-aligned with `initialTokens`. Defaults to none. */
    initialTokenConfigs?: readonly TokenConfig[];
}

function isZero32(v: Hex): boolean {
    return /^0x0*$/.test(v);
}

/**
 * Build a v0.20.0 `InitConfig` with mixed ECDSA + P-256 guardians.
 * @throws {AAStarError} if any slot is ambiguous, the sentinel is misused, or > 3 guardians are given.
 */
export function buildInitConfig(params: BuildInitConfigParams): InitConfig {
    const specs = params.guardians ?? [];
    if (specs.length > 3) {
        throw new AAStarError(ErrorCode.INVALID_PARAMETER, `at most 3 guardians are supported, got ${specs.length}`);
    }
    if (params.dailyLimit <= 0n) {
        throw new AAStarError(ErrorCode.INVALID_PARAMETER, 'dailyLimit must be > 0 to enable the on-chain GUARD');
    }

    const guardians: [Address, Address, Address] = [ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS];
    const guardianP256X: [Hex, Hex, Hex] = [ZERO32, ZERO32, ZERO32];
    const guardianP256Y: [Hex, Hex, Hex] = [ZERO32, ZERO32, ZERO32];
    let hasP256 = false;

    specs.forEach((spec, i) => {
        const hasEcdsa = spec.ecdsa !== undefined && spec.ecdsa !== ZERO_ADDRESS;
        const hasP256Key = spec.p256 !== undefined;
        if (hasEcdsa && hasP256Key) {
            throw new AAStarError(ErrorCode.INVALID_PARAMETER, `guardian[${i}]: supply exactly one of { ecdsa, p256 }, not both`);
        }
        if (!hasEcdsa && !hasP256Key) {
            throw new AAStarError(ErrorCode.INVALID_PARAMETER, `guardian[${i}]: supply one of { ecdsa, p256 }`);
        }

        if (hasP256Key) {
            const { x, y } = spec.p256!;
            if (!isHex(x) || size(x) !== 32 || !isHex(y) || size(y) !== 32) {
                throw new AAStarError(ErrorCode.INVALID_PARAMETER, `guardian[${i}].p256: x and y must each be 32-byte hex values`);
            }
            if (isZero32(x) || isZero32(y)) {
                throw new AAStarError(ErrorCode.INVALID_PARAMETER, `guardian[${i}].p256: x and y must be non-zero (all-or-nothing per the contract)`);
            }
            guardians[i] = ZERO_ADDRESS;
            guardianP256X[i] = x;
            guardianP256Y[i] = y;
            hasP256 = true;
        } else {
            const ecdsa = spec.ecdsa!;
            if (isAddressEqual(ecdsa, P256_GUARDIAN_SENTINEL)) {
                throw new AAStarError(ErrorCode.INVALID_PARAMETER, `guardian[${i}].ecdsa: the P-256 sentinel ${P256_GUARDIAN_SENTINEL} is not a valid ECDSA guardian`);
            }
            guardians[i] = ecdsa;
        }
    });

    const approvedAlgIds = params.approvedAlgIds
        ?? (hasP256 ? [ALG_ECDSA, ALG_PASSKEY_P256] : [ALG_ECDSA]);

    return {
        guardians,
        guardianP256X,
        guardianP256Y,
        dailyLimit: params.dailyLimit,
        approvedAlgIds,
        minDailyLimit: params.minDailyLimit ?? 0n,
        initialTokens: params.initialTokens ?? [],
        initialTokenConfigs: params.initialTokenConfigs ?? [],
    };
}
