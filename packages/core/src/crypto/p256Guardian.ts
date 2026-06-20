import {
    type Address,
    type Hex,
    decodeAbiParameters,
    encodeAbiParameters,
    isHex,
    keccak256,
    numberToHex,
    pad,
    sha256,
    size,
    toBytes,
    toHex,
} from 'viem';
import { p256 } from '@noble/curves/nist.js';

/**
 * P-256 (WebAuthn passkey) guardian wire encoders — airaccount-contract v0.20.0
 * authoritative, byte-for-byte against the published
 * `AirAccountExtension._verifyWebAuthnP256Sig` + `_p256GuardianChallenge`
 * (src/core/AirAccountExtension.sol). See `docs/p256-guardian-spec.md` §2, §6.
 *
 * ## What the contract actually verifies (NOT the early "simplified" draft)
 *
 * A P-256 guardian signs a FULL WebAuthn assertion — exactly what
 * `navigator.credentials.get()` returns — over the operation challenge:
 *
 * ```
 *  challenge   = keccak256(abi.encode(
 *                  uint8  GUARDIAN_SIG_VERSION (=4),
 *                  uint256 chainId,
 *                  address account,
 *                  string  "P256_GUARDIAN",        // domain tag
 *                  string  opLabel,                // "PROPOSE_RECOVERY" / …
 *                  bytes   opData))                // per-op, see §6
 *  clientDataJSON = '{"type":"webauthn.get","challenge":"' || base64url(challenge) || suffix
 *  payloadHash    = sha256(authenticatorData || sha256(clientDataJSON))   // ES256 signs this
 *  sig (on-chain) = abi.encode(bytes authenticatorData, bytes clientDataJSONPrefix,
 *                              bytes clientDataJSONSuffix, bytes32 r, bytes32 s)
 * ```
 *
 * The contract rebuilds `base64url(challenge)` on-chain (`_base64UrlEncode32`) and
 * splices it between the SDK-supplied prefix/suffix, then runs the EIP-7212
 * precompile against the guardian's stored `(x, y)`. It enforces:
 *   - `clientDataJSONPrefix == '{"type":"webauthn.get","challenge":"'` (operation-type binding),
 *   - `authenticatorData.length >= 37` and the UP flag (`authenticatorData[32] & 0x01`),
 *   - low-S: `uint256(s) <= n/2`.
 *
 * It deliberately does NOT bind `origin` / `rpIdHash` / UV (platform-layer RP binding
 * + challenge domain-separation cover replay). See spec §9.5.
 *
 * @module
 */

/** Guardian signature scheme version embedded in every challenge (contract: `GUARDIAN_SIG_VERSION`). */
export const GUARDIAN_SIG_VERSION = 4 as const;

/** Domain tag mixed into every P-256 guardian challenge (separates from the ECDSA-guardian hash). */
export const P256_GUARDIAN_DOMAIN = 'P256_GUARDIAN' as const;

/**
 * The EXACT `clientDataJSON` prefix the contract requires (operation-type binding). Any other
 * prefix is rejected on-chain, so a `webauthn.create` (registration) assertion cannot be replayed
 * through the `webauthn.get` (recovery) path. The base64url(challenge) MUST immediately follow this.
 */
export const WEBAUTHN_GET_CHALLENGE_PREFIX = '{"type":"webauthn.get","challenge":"' as const;

/** Byte length of {@link WEBAUTHN_GET_CHALLENGE_PREFIX} (36). */
const PREFIX_LEN = 36;
/** Byte length of base64url(32-byte challenge), no padding (43). */
const CHALLENGE_B64_LEN = 43;

/** Sentinel address stored in a guardian slot to mark it P-256 (contract: `P256_GUARDIAN_SENTINEL`). */
export const P256_GUARDIAN_SENTINEL = '0x0000000000000000000000000000000000007026' as Address;

/** secp256r1 (P-256) curve order `n` (fixed curve parameter). */
export const SECP256R1_N = 0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551n;
/**
 * secp256r1 curve order / 2 — the low-S ceiling the contract enforces
 * (`AirAccountExtension.SECP256R1_N_OVER_2`).
 */
export const SECP256R1_N_OVER_2 = SECP256R1_N >> 1n;

/** base64url alphabet (RFC 4648 §5, no padding) — matches the contract's on-chain table. */
const B64URL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/**
 * base64url-encode bytes with no padding — byte-identical to the contract's `_base64UrlEncode32`
 * for 32-byte input (43 chars) and to `Buffer.from(x).toString('base64url')`. Pure JS so `@aastar/core`
 * stays isomorphic (no node `Buffer`).
 */
export function base64UrlEncode(bytes: Uint8Array): string {
    let out = '';
    let i = 0;
    for (; i + 3 <= bytes.length; i += 3) {
        const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
        out += B64URL_ALPHABET[(n >> 18) & 63] + B64URL_ALPHABET[(n >> 12) & 63]
            + B64URL_ALPHABET[(n >> 6) & 63] + B64URL_ALPHABET[n & 63];
    }
    const rem = bytes.length - i;
    if (rem === 1) {
        const n = bytes[i] << 16;
        out += B64URL_ALPHABET[(n >> 18) & 63] + B64URL_ALPHABET[(n >> 12) & 63];
    } else if (rem === 2) {
        const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
        out += B64URL_ALPHABET[(n >> 18) & 63] + B64URL_ALPHABET[(n >> 12) & 63]
            + B64URL_ALPHABET[(n >> 6) & 63];
    }
    return out;
}

// ── Challenge / opData builders ───────────────────────────────────────────────

/** The set of operation labels the contract recognises (string-matched in the challenge). */
export type GuardianOpLabel =
    | 'PROPOSE_RECOVERY'
    | 'APPROVE_RECOVERY'
    | 'CANCEL_RECOVERY'
    | 'REMOVE_GUARDIAN'
    | 'MODIFY_TIER_LIMITS'
    | 'ADD_P256_GUARDIAN'
    | 'ADD_GUARDIAN';

/** Parameters for {@link buildP256GuardianChallenge}. */
export interface BuildP256GuardianChallengeParams {
    /** Signature scheme version. Defaults to {@link GUARDIAN_SIG_VERSION} (4). */
    version?: number;
    /** EVM chain id the account lives on (`block.chainid`). */
    chainId: number | bigint;
    /** The smart-account address (`address(this)` in the extension). */
    account: Address;
    /** Operation label, e.g. `"PROPOSE_RECOVERY"`. */
    opLabel: GuardianOpLabel | string;
    /** Operation payload (`abi.encode(...)` per op — use the `opData*` builders below). */
    opData: Hex;
}

/**
 * Build the 32-byte operation challenge the contract derives in `_p256GuardianChallenge`:
 * `keccak256(abi.encode(uint8 version, uint256 chainId, address account, string "P256_GUARDIAN",
 *  string opLabel, bytes opData))`. This is the value passed to `navigator.credentials.get()`.
 */
export function buildP256GuardianChallenge(params: BuildP256GuardianChallengeParams): Hex {
    const version = params.version ?? GUARDIAN_SIG_VERSION;
    return keccak256(
        encodeAbiParameters(
            [
                { type: 'uint8' },
                { type: 'uint256' },
                { type: 'address' },
                { type: 'string' },
                { type: 'string' },
                { type: 'bytes' },
            ],
            [version, BigInt(params.chainId), params.account, P256_GUARDIAN_DOMAIN, params.opLabel, params.opData],
        ),
    );
}

/** `opData` for PROPOSE_RECOVERY / APPROVE_RECOVERY / CANCEL_RECOVERY: `abi.encode(uint256 nonce, address newOwner)`. */
export function opDataRecovery(nonce: bigint, newOwner: Address): Hex {
    return encodeAbiParameters([{ type: 'uint256' }, { type: 'address' }], [nonce, newOwner]);
}

/** `opData` for ADD_P256_GUARDIAN: `abi.encode(uint256 nonce, bytes32 x, bytes32 y)`. */
export function opDataAddP256Guardian(nonce: bigint, x: Hex, y: Hex): Hex {
    return encodeAbiParameters(
        [{ type: 'uint256' }, { type: 'bytes32' }, { type: 'bytes32' }],
        [nonce, toBytes32(x, 'x'), toBytes32(y, 'y')],
    );
}

/** `opData` for ADD_GUARDIAN (ECDSA): `abi.encode(uint256 nonce, address guardian)`. */
export function opDataAddGuardian(nonce: bigint, guardian: Address): Hex {
    return encodeAbiParameters([{ type: 'uint256' }, { type: 'address' }], [nonce, guardian]);
}

/**
 * `opData` for REMOVE_GUARDIAN (spec §6.4):
 * `abi.encode(uint256 nonce, uint8 index, address guardianToRemove, bytes32 p256X, bytes32 p256Y)`.
 * For an ECDSA slot pass the guardian address with `p256X=p256Y=0x0…0`; for a P-256 slot pass
 * {@link P256_GUARDIAN_SENTINEL} with the slot's stored `(x, y)`.
 */
export function opDataRemoveGuardian(
    nonce: bigint,
    index: number,
    guardianToRemove: Address,
    p256X: Hex,
    p256Y: Hex,
): Hex {
    return encodeAbiParameters(
        [{ type: 'uint256' }, { type: 'uint8' }, { type: 'address' }, { type: 'bytes32' }, { type: 'bytes32' }],
        [nonce, index, guardianToRemove, toBytes32(p256X, 'p256X'), toBytes32(p256Y, 'p256Y')],
    );
}

/** `opData` for MODIFY_TIER_LIMITS: `abi.encode(uint256 nonce, uint256 tier1, uint256 tier2, uint256 deadline)`. */
export function opDataModifyTierLimits(nonce: bigint, tier1: bigint, tier2: bigint, deadline: bigint): Hex {
    return encodeAbiParameters(
        [{ type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }],
        [nonce, tier1, tier2, deadline],
    );
}

// ── Convenience per-op challenge builders (combine opLabel + opData) ───────────

interface OpChainCtx {
    chainId: number | bigint;
    account: Address;
    version?: number;
}

/** Challenge for `proposeRecoveryWithSig(newOwner, gIdx, sig)`. `nonce` = `getRecoveryNonce()`. */
export function buildProposeRecoveryChallenge(p: OpChainCtx & { nonce: bigint; newOwner: Address }): Hex {
    return buildP256GuardianChallenge({ ...p, opLabel: 'PROPOSE_RECOVERY', opData: opDataRecovery(p.nonce, p.newOwner) });
}

/** Challenge for `approveRecoveryWithSig(gIdx, sig)`. `newOwner` = `activeRecovery().newOwner`. */
export function buildApproveRecoveryChallenge(p: OpChainCtx & { nonce: bigint; newOwner: Address }): Hex {
    return buildP256GuardianChallenge({ ...p, opLabel: 'APPROVE_RECOVERY', opData: opDataRecovery(p.nonce, p.newOwner) });
}

/** Challenge for `cancelRecoveryWithSig(gIdx, sig)`. `newOwner` = `activeRecovery().newOwner`. */
export function buildCancelRecoveryChallenge(p: OpChainCtx & { nonce: bigint; newOwner: Address }): Hex {
    return buildP256GuardianChallenge({ ...p, opLabel: 'CANCEL_RECOVERY', opData: opDataRecovery(p.nonce, p.newOwner) });
}

/** Challenge for `addP256GuardianWithMixedSigs(x, y, …)`. `nonce` = `_guardianAdditionNonce`. */
export function buildAddP256GuardianChallenge(p: OpChainCtx & { nonce: bigint; x: Hex; y: Hex }): Hex {
    return buildP256GuardianChallenge({ ...p, opLabel: 'ADD_P256_GUARDIAN', opData: opDataAddP256Guardian(p.nonce, p.x, p.y) });
}

/** Challenge for `addGuardianWithMixedSigs(guardian, …)`. `nonce` = `_guardianAdditionNonce`. */
export function buildAddGuardianChallenge(p: OpChainCtx & { nonce: bigint; guardian: Address }): Hex {
    return buildP256GuardianChallenge({ ...p, opLabel: 'ADD_GUARDIAN', opData: opDataAddGuardian(p.nonce, p.guardian) });
}

/** Challenge for `removeGuardianWithMixedSigs(index, …)`. `nonce` = `_guardianRemovalNonce`. */
export function buildRemoveGuardianChallenge(
    p: OpChainCtx & { nonce: bigint; index: number; guardianToRemove: Address; p256X: Hex; p256Y: Hex },
): Hex {
    return buildP256GuardianChallenge({
        ...p,
        opLabel: 'REMOVE_GUARDIAN',
        opData: opDataRemoveGuardian(p.nonce, p.index, p.guardianToRemove, p.p256X, p.p256Y),
    });
}

/** Challenge for `modifyTierLimitsWithMixedGuardians(tier1, tier2, deadline, …)`. `nonce` = `_tierLimitNonce`. */
export function buildModifyTierLimitsChallenge(
    p: OpChainCtx & { nonce: bigint; tier1: bigint; tier2: bigint; deadline: bigint },
): Hex {
    return buildP256GuardianChallenge({
        ...p,
        opLabel: 'MODIFY_TIER_LIMITS',
        opData: opDataModifyTierLimits(p.nonce, p.tier1, p.tier2, p.deadline),
    });
}

// ── WebAuthn assertion encoding ───────────────────────────────────────────────

/** A signature scalar accepted as a 0x-hex (≤32 bytes), raw bytes, or bigint. */
export type ScalarLike = Hex | Uint8Array | bigint;

function scalarToBigInt(v: ScalarLike, name: string): bigint {
    if (typeof v === 'bigint') return v;
    if (v instanceof Uint8Array) return BigInt(toHex(v));
    if (isHex(v)) return BigInt(v);
    throw new Error(`encodeWebAuthnAssertion: ${name} must be a hex string, Uint8Array, or bigint`);
}

function toBytes32(v: Hex, name: string): Hex {
    if (!isHex(v)) throw new Error(`${name} must be a 0x-hex value`);
    if (size(v) > 32) throw new Error(`${name} must be at most 32 bytes`);
    return pad(v, { size: 32 });
}

function asBytes(v: Hex | Uint8Array | string, name: string): Uint8Array {
    if (v instanceof Uint8Array) return v;
    if (typeof v === 'string' && isHex(v)) return toBytes(v);
    if (typeof v === 'string') return new TextEncoder().encode(v);
    throw new Error(`${name} must be hex, bytes, or a string`);
}

/** Parameters for {@link encodeWebAuthnAssertion}. */
export interface EncodeWebAuthnAssertionParams {
    /** `authenticatorData` from the assertion: `rpIdHash(32) || flags(1) || signCount(4)` (≥37 bytes, UP set). */
    authenticatorData: Hex | Uint8Array;
    /**
     * The FULL `clientDataJSON` the authenticator signed. MUST start with
     * {@link WEBAUTHN_GET_CHALLENGE_PREFIX}, immediately followed by the 43-char base64url(challenge).
     * Split into prefix/suffix here; the contract rebuilds the challenge on-chain.
     */
    clientDataJSON: Hex | Uint8Array | string;
    /** ES256 signature `r` (32-byte scalar). */
    r: ScalarLike;
    /** ES256 signature `s` (32-byte scalar). Auto low-S normalised to satisfy the contract. */
    s: ScalarLike;
}

/**
 * ABI-encode a WebAuthn assertion into the on-chain `sig` the contract consumes:
 * `abi.encode(bytes authenticatorData, bytes clientDataJSONPrefix, bytes clientDataJSONSuffix,
 *  bytes32 r, bytes32 s)`.
 *
 * Validates the assertion against every constraint the contract enforces so a bad blob fails here
 * (with a clear message) rather than as a generic on-chain revert:
 *   - `authenticatorData.length >= 37` and the UP flag (`byte[32] & 0x01`) is set,
 *   - `clientDataJSON` starts with the exact `webauthn.get` prefix and the 43-char challenge slot
 *     is immediately followed by the closing `"` (so the contract's reconstruction lines up),
 *   - `s` is low-S (`<= n/2`) — auto-normalised to `n - s` if the input was high-S (ECDSA-valid).
 */
export function encodeWebAuthnAssertion(params: EncodeWebAuthnAssertionParams): Hex {
    const authData = asBytes(params.authenticatorData, 'authenticatorData');
    if (authData.length < 37) {
        throw new Error(`encodeWebAuthnAssertion: authenticatorData must be >= 37 bytes, got ${authData.length}`);
    }
    if ((authData[32] & 0x01) === 0) {
        throw new Error('encodeWebAuthnAssertion: authenticatorData UP (User Present) flag (byte 32, bit 0) must be set');
    }

    const cdj = asBytes(params.clientDataJSON, 'clientDataJSON');
    const prefixBytes = new TextEncoder().encode(WEBAUTHN_GET_CHALLENGE_PREFIX);
    if (cdj.length < PREFIX_LEN + CHALLENGE_B64_LEN + 1) {
        throw new Error(
            `encodeWebAuthnAssertion: clientDataJSON too short (${cdj.length} bytes) — expected at least ` +
            `prefix(${PREFIX_LEN}) + base64url(challenge)(${CHALLENGE_B64_LEN}) + closing quote`,
        );
    }
    for (let i = 0; i < PREFIX_LEN; i++) {
        if (cdj[i] !== prefixBytes[i]) {
            throw new Error(
                'encodeWebAuthnAssertion: clientDataJSON must start with the exact prefix ' +
                `${JSON.stringify(WEBAUTHN_GET_CHALLENGE_PREFIX)} (the contract rejects any other prefix)`,
            );
        }
    }
    // The challenge slot is exactly 43 base64url chars; byte right after it must be the closing quote.
    if (cdj[PREFIX_LEN + CHALLENGE_B64_LEN] !== 0x22 /* '"' */) {
        throw new Error(
            'encodeWebAuthnAssertion: the base64url(challenge) slot is not exactly 43 chars ' +
            '(no closing quote at the expected position) — clientDataJSON is malformed for the contract',
        );
    }

    const prefix = cdj.slice(0, PREFIX_LEN);
    const suffix = cdj.slice(PREFIX_LEN + CHALLENGE_B64_LEN);

    const r = scalarToBigInt(params.r, 'r');
    let s = scalarToBigInt(params.s, 's');
    if (s > SECP256R1_N_OVER_2) s = SECP256R1_N - s; // low-S normalisation (ECDSA-valid)

    return encodeAbiParameters(
        [{ type: 'bytes' }, { type: 'bytes' }, { type: 'bytes' }, { type: 'bytes32' }, { type: 'bytes32' }],
        [toHex(authData), toHex(prefix), toHex(suffix), numberToHex(r, { size: 32 }), numberToHex(s, { size: 32 })],
    );
}

/** Decoded view of an on-chain P-256 guardian `sig` blob. */
export interface DecodedWebAuthnAssertion {
    authenticatorData: Hex;
    clientDataJSONPrefix: Hex;
    clientDataJSONSuffix: Hex;
    r: Hex;
    s: Hex;
}

/**
 * Inverse of {@link encodeWebAuthnAssertion} — decode an on-chain `sig` blob back into its parts.
 * Useful for evidence/decode-verification and debugging a rejected signature.
 */
export function decodeWebAuthnAssertion(sig: Hex): DecodedWebAuthnAssertion {
    const [authenticatorData, clientDataJSONPrefix, clientDataJSONSuffix, r, s] = decodeAbiParameters(
        [{ type: 'bytes' }, { type: 'bytes' }, { type: 'bytes' }, { type: 'bytes32' }, { type: 'bytes32' }],
        sig,
    ) as [Hex, Hex, Hex, Hex, Hex];
    return { authenticatorData, clientDataJSONPrefix, clientDataJSONSuffix, r, s };
}

// ── COSE public-key extraction ────────────────────────────────────────────────

/**
 * Extract `(x, y)` (each a 32-byte bytes32 hex) from a WebAuthn registration public key.
 *
 * Accepts either:
 *   - a **COSE_Key** EC2 map (the bytes in `attestedCredentialData`, kty=2/EC2, crv=1/P-256,
 *     `-2` ⇒ x, `-3` ⇒ y), or
 *   - an **uncompressed SEC1** point (`0x04 || x(32) || y(32)`, 65 bytes).
 *
 * The result feeds `addP256Guardian(x, y)` / the `InitConfig.guardianP256X/Y` slots.
 */
export function coseToP256XY(cosePublicKey: Hex | Uint8Array): { x: Hex; y: Hex } {
    const bytes = cosePublicKey instanceof Uint8Array ? cosePublicKey : toBytes(cosePublicKey);

    // Uncompressed SEC1 point fast-path: 0x04 || x(32) || y(32).
    if (bytes.length === 65 && bytes[0] === 0x04) {
        return { x: toHex(bytes.slice(1, 33)), y: toHex(bytes.slice(33, 65)) };
    }

    const map = decodeCoseMap(bytes);
    const kty = map.get(1);
    const crv = map.get(-1);
    if (typeof kty === 'bigint' && kty !== 2n) {
        throw new Error(`coseToP256XY: COSE key type ${kty} is not EC2 (2)`);
    }
    if (typeof crv === 'bigint' && crv !== 1n) {
        throw new Error(`coseToP256XY: COSE curve ${crv} is not P-256 (1)`);
    }
    const x = map.get(-2);
    const y = map.get(-3);
    if (!(x instanceof Uint8Array) || !(y instanceof Uint8Array)) {
        throw new Error('coseToP256XY: COSE key missing the -2 (x) / -3 (y) coordinate byte strings');
    }
    if (x.length !== 32 || y.length !== 32) {
        throw new Error(`coseToP256XY: P-256 coordinates must be 32 bytes (got x=${x.length}, y=${y.length})`);
    }
    return { x: toHex(x), y: toHex(y) };
}

/**
 * Minimal CBOR decoder for a COSE_Key map. Handles only what a COSE EC2 key uses:
 * maps, (negative) integers, and byte strings — enough to pull `-2`/`-3`. Rejects anything else.
 */
function decodeCoseMap(buf: Uint8Array): Map<number, bigint | Uint8Array> {
    let pos = 0;

    function readArgument(ai: number): number {
        if (ai < 24) return ai;
        if (ai === 24) return buf[pos++];
        if (ai === 25) { const v = (buf[pos] << 8) | buf[pos + 1]; pos += 2; return v; }
        if (ai === 26) {
            const v = (buf[pos] * 0x1000000) + (buf[pos + 1] << 16) + (buf[pos + 2] << 8) + buf[pos + 3];
            pos += 4;
            return v;
        }
        throw new Error('decodeCoseMap: unsupported CBOR argument size (64-bit values not supported for COSE keys)');
    }

    function readItem(): bigint | Uint8Array {
        const ib = buf[pos++];
        const major = ib >> 5;
        const ai = ib & 0x1f;
        switch (major) {
            case 0: // unsigned int
                return BigInt(readArgument(ai));
            case 1: // negative int  (-1 - n)
                return BigInt(-1 - readArgument(ai));
            case 2: { // byte string
                const len = readArgument(ai);
                const out = buf.slice(pos, pos + len);
                pos += len;
                return out;
            }
            default:
                throw new Error(`decodeCoseMap: unsupported CBOR major type ${major} in COSE key`);
        }
    }

    const ib = buf[pos++];
    if (ib >> 5 !== 5) throw new Error('coseToP256XY: input is not a CBOR map (COSE_Key)');
    const n = readArgument(ib & 0x1f);
    const map = new Map<number, bigint | Uint8Array>();
    for (let i = 0; i < n; i++) {
        const key = readItem();
        const val = readItem();
        if (typeof key === 'bigint') map.set(Number(key), val);
    }
    return map;
}

// ── Software authenticator (test / relayer for software-held passkeys) ─────────

/** Parameters for {@link signP256GuardianAssertion}. */
export interface SignP256GuardianAssertionParams {
    /** Raw 32-byte P-256 private scalar (hex or bytes). */
    privateKey: Hex | Uint8Array;
    /** The 32-byte operation challenge (from a `build*Challenge` helper). */
    challenge: Hex;
    /**
     * RP id whose SHA-256 becomes `rpIdHash`. The contract does NOT verify this (§9.5), so any value
     * works on-chain; defaults to a stable test RP. Set it to your real rpId for fidelity.
     */
    rpId?: string;
    /** `origin` embedded in `clientDataJSON` suffix (also not verified on-chain). */
    origin?: string;
    /** authenticatorData flags byte. Defaults to `0x05` (UP | UV); the contract only requires UP (bit 0). */
    flags?: number;
    /** authenticatorData signCount (4-byte big-endian). */
    signCount?: number;
}

/** Result of {@link signP256GuardianAssertion}. */
export interface SignedP256GuardianAssertion {
    /** The on-chain `sig` blob, ready for `proposeRecoveryWithSig` / mixed-sig calls. */
    sig: Hex;
    /** authenticatorData used (hex). */
    authenticatorData: Hex;
    /** Full clientDataJSON signed (hex). */
    clientDataJSON: Hex;
    /** Low-S–normalised signature `r` (bytes32 hex). */
    r: Hex;
    /** Low-S–normalised signature `s` (bytes32 hex). */
    s: Hex;
}

/**
 * Software P-256 authenticator — produces a FULL WebAuthn assertion over `challenge`, byte-for-byte
 * in the format `navigator.credentials.get()` returns (mirrors the contract's
 * `test/webauthn/gen_p256_assertion.mjs`). The only difference vs a hardware passkey is WHERE the
 * key lives. Use for the on-chain evidence E2E and for relaying software-held guardian keys.
 */
export function signP256GuardianAssertion(params: SignP256GuardianAssertionParams): SignedP256GuardianAssertion {
    const priv = params.privateKey instanceof Uint8Array ? params.privateKey : toBytes(params.privateKey);
    const rpId = params.rpId ?? 'airaccount.example';
    const origin = params.origin ?? 'https://airaccount.example';
    const flags = params.flags ?? 0x05;
    const signCount = params.signCount ?? 0;

    const challengeBytes = toBytes(params.challenge);
    if (challengeBytes.length !== 32) throw new Error('signP256GuardianAssertion: challenge must be 32 bytes');

    // clientDataJSON = prefix || base64url(challenge) || suffix
    const challengeB64 = base64UrlEncode(challengeBytes);
    const clientDataJSONStr = `${WEBAUTHN_GET_CHALLENGE_PREFIX}${challengeB64}","origin":"${origin}","crossOrigin":false}`;
    const clientDataJSON = new TextEncoder().encode(clientDataJSONStr);

    // authenticatorData = sha256(rpId)(32) || flags(1) || signCount(4, big-endian)
    const rpIdHash = toBytes(sha256(new TextEncoder().encode(rpId)));
    const authData = new Uint8Array(37);
    authData.set(rpIdHash, 0);
    authData[32] = flags & 0xff;
    new DataView(authData.buffer).setUint32(33, signCount >>> 0, false);

    // WebAuthn signed message = authenticatorData || sha256(clientDataJSON); ES256 = ECDSA-SHA-256.
    const clientDataHash = toBytes(sha256(clientDataJSON));
    const message = new Uint8Array(authData.length + clientDataHash.length);
    message.set(authData, 0);
    message.set(clientDataHash, authData.length);

    // noble applies SHA-256 (prehash) and emits canonical low-S by default.
    const signature = p256.sign(message, priv, { prehash: true, lowS: true });
    const r = numberToHex(signature.r, { size: 32 });
    const s = numberToHex(signature.s, { size: 32 });

    const sig = encodeWebAuthnAssertion({ authenticatorData: authData, clientDataJSON, r, s });
    return { sig, authenticatorData: toHex(authData), clientDataJSON: toHex(clientDataJSON), r, s };
}

/** Derive the uncompressed-SEC1 `(x, y)` of a P-256 private key (for `addP256Guardian`). */
export function p256GuardianPublicKey(privateKey: Hex | Uint8Array): { x: Hex; y: Hex } {
    const priv = privateKey instanceof Uint8Array ? privateKey : toBytes(privateKey);
    const pub = p256.getPublicKey(priv, false); // 0x04 || x || y
    return coseToP256XY(pub);
}
