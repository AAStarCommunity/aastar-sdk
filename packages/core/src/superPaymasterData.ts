/**
 * SuperPaymaster `paymasterAndData` encoding + on-chain generation detection.
 *
 * Two contract generations share ONE proxy address (5.5.0 is an in-place UUPS upgrade of 5.4.2),
 * so the SDK cannot tell them apart by address. This module is the single place that knows both
 * byte layouts:
 *
 *   5.4.x  [paymaster 20][verifGas 16][postOpGas 16][operator 20][maxRate 32]                    = 104 B
 *   5.5.x  [paymaster 20][verifGas 16][postOpGas 16][operator 20][maxRate 32][token 20][flags 1] = 125 B
 *
 * Offsets are copied from the contract, not derived from this encoder:
 *   - SuperPaymaster v5.5.0-rc.4 `SuperPaymasterStorage.sol:176-182`
 *       PAYMASTER_DATA_OFFSET = 52, RATE_OFFSET = 72, POSTOP_GAS_OFFSET = 36,
 *       TOKEN_OFFSET = 104, FLAGS_OFFSET = 124, FLAG_SP_RENEW = 1, FLAG_ACCOUNT_RENEW = 2
 *   - SuperPaymaster v5.5.0-rc.4 `SuperPaymaster.sol:292-298` (validatePaymasterUserOp):
 *       length < TOKEN_OFFSET + 20 -> sigFail; token != operators[op].xPNTsToken -> sigFail;
 *       flags = length > FLAGS_OFFSET ? pmd[FLAGS_OFFSET] : 0; both renew bits set -> sigFail.
 *   - SuperPaymaster v5.4.2 `SuperPaymaster.sol:78` RATE_OFFSET = 72 and `:1200-1201` — 5.4.2 only
 *     reads maxRate when `length >= 104` and never bounds the length from above, so the 125-byte
 *     5.5.0 layout is ALSO accepted by 5.4.2 (the trailing token+flags are ignored there).
 *
 * That last fact is what makes the SDK's compatibility strategy safe: the high-level paths always
 * emit the 5.5.0 superset (with the operator's configured token), which works on the live 5.4.2
 * deployment today and keeps working at the instant the proxy is upgraded in place.
 */
import { type Address, type Hex, concat, getAddress, isAddress, pad, size, slice, toHex } from 'viem';

/** Byte offsets inside `paymasterAndData` (SuperPaymasterStorage.sol:176-180, v5.5.0-rc.4). */
export const SUPER_PAYMASTER_PMD_OFFSETS = {
    /** [0:20]   paymaster address (ERC-4337 v0.7). */
    PAYMASTER: 0,
    /** [20:36]  paymasterVerificationGasLimit (uint128). */
    VERIFICATION_GAS: 20,
    /** [36:52]  paymasterPostOpGasLimit (uint128) — `POSTOP_GAS_OFFSET`. */
    POSTOP_GAS: 36,
    /** [52:72]  operator — `PAYMASTER_DATA_OFFSET`. */
    OPERATOR: 52,
    /** [72:104] maxRate (uint256, abi word) — `RATE_OFFSET`. */
    MAX_RATE: 72,
    /** [104:124] token (5.5.0+) — `TOKEN_OFFSET`. */
    TOKEN: 104,
    /** [124]    flags (5.5.0+, optional) — `FLAGS_OFFSET`. */
    FLAGS: 124,
} as const;

/** Total length of the 5.4.x layout (ends after maxRate). */
export const SUPER_PAYMASTER_PMD_LENGTH_V54 = 104;
/** Minimum length 5.5.0 accepts (token present, flags omitted → treated as 0). */
export const SUPER_PAYMASTER_PMD_MIN_LENGTH_V55 = 124;
/** Length of the full 5.5.0 layout including the flags byte. */
export const SUPER_PAYMASTER_PMD_LENGTH_V55 = 125;

/**
 * `flags` bits (SuperPaymasterStorage.sol:181-182, v5.5.0-rc.4; spec 03-final-spec §3.2).
 *
 * - `SP_RENEW` (bit0): SP relays a K-bounded allowance renewal to `xPNTsTokenV2.tryLockForGas`.
 *   Only valid when the user set `renewalMode == SP_K`, has renewals left, and has no live lock or
 *   credit reservation — otherwise the token returns INVALID_RENEWAL and the WHOLE validation fails
 *   (spec §2.3 A-5). Never set it speculatively.
 * - `ACCOUNT_RENEW` (bit1): consumed by the account itself (AirAccount, "option A"); the SP ignores it.
 *
 * Setting both is a sigFail (SuperPaymaster.sol:296-298); the encoder refuses it.
 */
export const SUPER_PAYMASTER_FLAGS = {
    NONE: 0,
    SP_RENEW: 1,
    ACCOUNT_RENEW: 2,
} as const;

/**
 * Default floor for `paymasterPostOpGasLimit`: `MIN_POST_OP_GAS = 200_000` in BOTH 5.4.2
 * (SuperPaymaster.sol:86, enforced at :1172-1174) and 5.5.0 (SuperPaymasterStorage.sol:193; in 5.5.0
 * it is the default of the governable `gasParams().minPostOpGas`, read it live when you can).
 * Spec §3.2: the SDK MUST set at least this and MUST NOT trust a bundler estimate for it.
 */
export const SUPER_PAYMASTER_MIN_POST_OP_GAS = 200_000n;

/**
 * Draft floor for `paymasterVerificationGasLimit` on 5.5.0. Spec §3.2 (F1/F2): bundlers estimate
 * ~38k while SP 5.5.0 validation measured 198k–238k; the spec's *draft* suggestion is 250k, to be
 * finalised after worst-path measurement. Exposed as a constant so callers can override; it is
 * NOT a contract-enforced value.
 */
export const SUPER_PAYMASTER_V55_VERIFICATION_GAS_FLOOR = 250_000n;

const MAX_UINT128 = (1n << 128n) - 1n;
const MAX_UINT256 = (1n << 256n) - 1n;

export type SuperPaymasterDataParams = {
    paymaster: Address;
    operator: Address;
    verificationGasLimit: bigint;
    postOpGasLimit: bigint;
    /** Rate commitment (rug-pull protection). Defaults to type(uint256).max = no commitment. */
    maxRate?: bigint;
    /**
     * The operator's configured xPNTs token (`operators(operator).xPNTsToken`). REQUIRED by 5.5.0 —
     * omitting it produces the 104-byte 5.4.x layout, which 5.5.0 rejects (sigFail / AA34).
     */
    token?: Address;
    /** 5.5.0 flags byte. Only meaningful together with `token`. Defaults to 0 (emitted explicitly). */
    flags?: number;
    /**
     * When false and `flags` is 0/undefined, the flags byte is omitted (124 bytes). The contract
     * treats 124 and 125 bytes with flags=0 identically (SuperPaymaster.sol:295). Default true.
     */
    emitFlagsByte?: boolean;
};

function assertUint(value: bigint, max: bigint, label: string): void {
    if (typeof value !== 'bigint' || value < 0n || value > max) {
        throw new Error(`encodeSuperPaymasterData: ${label} out of range (${String(value)})`);
    }
}

function assertAddress(value: Address, label: string): void {
    if (!isAddress(value, { strict: false })) {
        throw new Error(`encodeSuperPaymasterData: ${label} is not an address (${String(value)})`);
    }
}

/** Validate a 5.5.0 flags value; throws on unknown bits or the both-renew-bits sigFail combo. */
export function assertSuperPaymasterFlags(flags: number): void {
    if (!Number.isInteger(flags) || flags < 0 || flags > 0xff) {
        throw new Error(`SuperPaymaster flags must be a uint8, got ${flags}`);
    }
    const known = SUPER_PAYMASTER_FLAGS.SP_RENEW | SUPER_PAYMASTER_FLAGS.ACCOUNT_RENEW;
    if ((flags & ~known) !== 0) {
        // The contract ignores unknown bits today; refusing them keeps a future bit from being
        // set by accident before the SDK knows what it means.
        throw new Error(`SuperPaymaster flags 0x${flags.toString(16)} has bits outside SP_RENEW|ACCOUNT_RENEW`);
    }
    if ((flags & known) === known) {
        throw new Error('SuperPaymaster flags: SP_RENEW and ACCOUNT_RENEW together are a sigFail (SuperPaymaster.sol:296)');
    }
}

/**
 * Encode SuperPaymaster `paymasterAndData`.
 *
 * With `token`: the 5.5.0 layout (accepted by 5.4.2 too — see module docs). Without `token`: the
 * legacy 5.4.x layout, kept so existing 5.4.2 callers are byte-for-byte unchanged.
 */
export function encodeSuperPaymasterData(params: SuperPaymasterDataParams): Hex {
    assertAddress(params.paymaster, 'paymaster');
    assertAddress(params.operator, 'operator');
    assertUint(params.verificationGasLimit, MAX_UINT128, 'verificationGasLimit');
    assertUint(params.postOpGasLimit, MAX_UINT128, 'postOpGasLimit');
    const maxRate = params.maxRate ?? MAX_UINT256;
    assertUint(maxRate, MAX_UINT256, 'maxRate');

    const head: Hex[] = [
        params.paymaster,
        pad(toHex(params.verificationGasLimit), { size: 16 }),
        pad(toHex(params.postOpGasLimit), { size: 16 }),
        params.operator,
        pad(toHex(maxRate), { size: 32 }),
    ];

    if (params.token === undefined) {
        if (params.flags !== undefined && params.flags !== 0) {
            throw new Error('encodeSuperPaymasterData: flags require token (5.5.0 layout)');
        }
        return concat(head);
    }

    assertAddress(params.token, 'token');
    const flags = params.flags ?? 0;
    assertSuperPaymasterFlags(flags);
    const parts = [...head, params.token];
    if (flags !== 0 || params.emitFlagsByte !== false) parts.push(pad(toHex(flags), { size: 1 }));
    return concat(parts);
}

export type DecodedSuperPaymasterData = {
    paymaster: Address;
    verificationGasLimit: bigint;
    postOpGasLimit: bigint;
    operator: Address;
    maxRate: bigint;
    /** undefined for the 104-byte 5.4.x layout. */
    token?: Address;
    /** Effective flags as the 5.5.0 contract reads them (0 when the byte is absent). */
    flags: number;
    layout: 'v5.4' | 'v5.5';
};

/** Decode at the contract's offsets. Throws if shorter than the 5.4.x layout. */
export function decodeSuperPaymasterData(pmd: Hex): DecodedSuperPaymasterData {
    const len = size(pmd);
    if (len < SUPER_PAYMASTER_PMD_LENGTH_V54) {
        throw new Error(`SuperPaymaster paymasterAndData too short: ${len} bytes`);
    }
    const O = SUPER_PAYMASTER_PMD_OFFSETS;
    const out: DecodedSuperPaymasterData = {
        paymaster: getAddress(slice(pmd, O.PAYMASTER, O.VERIFICATION_GAS)),
        verificationGasLimit: BigInt(slice(pmd, O.VERIFICATION_GAS, O.POSTOP_GAS)),
        postOpGasLimit: BigInt(slice(pmd, O.POSTOP_GAS, O.OPERATOR)),
        operator: getAddress(slice(pmd, O.OPERATOR, O.MAX_RATE)),
        maxRate: BigInt(slice(pmd, O.MAX_RATE, O.TOKEN)),
        flags: 0,
        layout: 'v5.4',
    };
    if (len >= SUPER_PAYMASTER_PMD_MIN_LENGTH_V55) {
        out.token = getAddress(slice(pmd, O.TOKEN, O.FLAGS));
        out.flags = len > O.FLAGS ? Number(BigInt(slice(pmd, O.FLAGS, O.FLAGS + 1))) : 0;
        out.layout = 'v5.5';
    }
    return out;
}

// ---------------------------------------------------------------------------------------------
// Generation detection
// ---------------------------------------------------------------------------------------------

/**
 * Which SuperPaymaster interface a deployed proxy speaks.
 * - `v5.4`: 5.4.x and earlier — `dryRunValidation` on the SP, pending-debt API, 104-byte data accepted.
 * - `v5.5`: 5.5.x — token required in data, dryRun via SuperPaymasterLens, pending-debt API removed.
 */
export type SuperPaymasterGeneration = 'v5.4' | 'v5.5';

/**
 * Map an on-chain `version()` string to a generation. Throws for an unrecognised string or a
 * version newer than 5.5.x: the SDK knows 5.5.0's breaking changes, not the next one's, so it
 * refuses to guess rather than encode for the wrong contract.
 */
export function superPaymasterGenerationFromVersion(version: string): SuperPaymasterGeneration {
    const m = /^SuperPaymaster-(\d+)\.(\d+)\.(\d+)/.exec(version.trim());
    if (!m) throw new Error(`Unrecognised SuperPaymaster version() string: "${version}"`);
    const major = Number(m[1]);
    const minor = Number(m[2]);
    if (major < 5 || (major === 5 && minor < 5)) return 'v5.4';
    if (major === 5 && minor === 5) return 'v5.5';
    throw new Error(
        `SuperPaymaster ${version} is newer than this SDK understands (max 5.5.x). Upgrade @aastar/sdk.`,
    );
}
