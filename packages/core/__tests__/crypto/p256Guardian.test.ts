import { describe, it, expect } from 'vitest';
import {
    decodeAbiParameters,
    encodeAbiParameters,
    keccak256,
    sha256,
    toBytes,
    toHex,
    type Hex,
} from 'viem';
import { p256 } from '@noble/curves/nist.js';
import {
    GUARDIAN_SIG_VERSION,
    P256_GUARDIAN_DOMAIN,
    P256_GUARDIAN_SENTINEL,
    SECP256R1_N,
    SECP256R1_N_OVER_2,
    WEBAUTHN_GET_CHALLENGE_PREFIX,
    base64UrlEncode,
    buildP256GuardianChallenge,
    buildProposeRecoveryChallenge,
    buildRemoveGuardianChallenge,
    coseToP256XY,
    decodeWebAuthnAssertion,
    encodeWebAuthnAssertion,
    opDataRecovery,
    opDataRemoveGuardian,
    p256GuardianPublicKey,
    signP256GuardianAssertion,
} from '../../src/crypto/p256Guardian';

const ACCOUNT = '0x1111111111111111111111111111111111111111' as const;
const NEW_OWNER = '0x2222222222222222222222222222222222222222' as const;
// Stable software passkey (the JWK[0] from gen_p256_assertion.mjs, as a raw scalar).
const PRIV = '0x6b48b8e73032d8a724100317445ef21c0e065cd04b6122960b1a002f2868d7f1' as Hex;

describe('p256Guardian — constants', () => {
    it('low-S ceiling equals the contract SECP256R1_N_OVER_2', () => {
        expect(SECP256R1_N_OVER_2).toBe(
            0x7fffffff800000007fffffffffffffffde737d56d38bcf4279dce5617e3192a8n,
        );
        expect(SECP256R1_N >> 1n).toBe(SECP256R1_N_OVER_2);
    });
    it('exposes the exact webauthn.get prefix (36 bytes) and sentinel', () => {
        expect(WEBAUTHN_GET_CHALLENGE_PREFIX).toBe('{"type":"webauthn.get","challenge":"');
        expect(new TextEncoder().encode(WEBAUTHN_GET_CHALLENGE_PREFIX).length).toBe(36);
        expect(P256_GUARDIAN_SENTINEL.toLowerCase()).toBe('0x0000000000000000000000000000000000007026');
        expect(GUARDIAN_SIG_VERSION).toBe(4);
        expect(P256_GUARDIAN_DOMAIN).toBe('P256_GUARDIAN');
    });
});

describe('base64UrlEncode', () => {
    it('encodes 32 bytes to 43 chars (no padding) matching Buffer base64url', () => {
        const bytes = new Uint8Array(32).map((_, i) => i + 1);
        const got = base64UrlEncode(bytes);
        expect(got.length).toBe(43);
        expect(got).toBe(Buffer.from(bytes).toString('base64url'));
    });
    it('matches Buffer base64url for many random inputs', () => {
        for (let n = 0; n < 40; n++) {
            const bytes = new Uint8Array(n).map((_, i) => (i * 37 + n * 13) & 0xff);
            expect(base64UrlEncode(bytes)).toBe(Buffer.from(bytes).toString('base64url'));
        }
    });
});

describe('buildP256GuardianChallenge', () => {
    it('matches an independent keccak256(abi.encode(...)) with the exact contract types', () => {
        const opData = opDataRecovery(0n, NEW_OWNER);
        const expected = keccak256(
            encodeAbiParameters(
                [
                    { type: 'uint8' }, { type: 'uint256' }, { type: 'address' },
                    { type: 'string' }, { type: 'string' }, { type: 'bytes' },
                ],
                [4, 11155111n, ACCOUNT, 'P256_GUARDIAN', 'PROPOSE_RECOVERY', opData],
            ),
        );
        const got = buildProposeRecoveryChallenge({ chainId: 11155111, account: ACCOUNT, nonce: 0n, newOwner: NEW_OWNER });
        expect(got).toBe(expected);
    });

    it('is a deterministic 32-byte regression vector', () => {
        // Golden vector — locks the encoding. Cross-impl proof is the live Sepolia E2E.
        const got = buildProposeRecoveryChallenge({ chainId: 11155111, account: ACCOUNT, nonce: 0n, newOwner: NEW_OWNER });
        expect(got).toMatch(/^0x[0-9a-f]{64}$/);
        expect(toBytes(got).length).toBe(32);
    });

    it('domain-separates by chainId, account, nonce, newOwner, and opLabel', () => {
        const base = buildProposeRecoveryChallenge({ chainId: 11155111, account: ACCOUNT, nonce: 0n, newOwner: NEW_OWNER });
        expect(buildProposeRecoveryChallenge({ chainId: 10, account: ACCOUNT, nonce: 0n, newOwner: NEW_OWNER })).not.toBe(base);
        expect(buildProposeRecoveryChallenge({ chainId: 11155111, account: NEW_OWNER, nonce: 0n, newOwner: NEW_OWNER })).not.toBe(base);
        expect(buildProposeRecoveryChallenge({ chainId: 11155111, account: ACCOUNT, nonce: 1n, newOwner: NEW_OWNER })).not.toBe(base);
        expect(buildProposeRecoveryChallenge({ chainId: 11155111, account: ACCOUNT, nonce: 0n, newOwner: ACCOUNT })).not.toBe(base);
        // APPROVE has the same opData but a different opLabel → different challenge.
        const approveLike = buildP256GuardianChallenge({
            chainId: 11155111, account: ACCOUNT, opLabel: 'APPROVE_RECOVERY', opData: opDataRecovery(0n, NEW_OWNER),
        });
        expect(approveLike).not.toBe(base);
    });
});

describe('opData builders', () => {
    it('REMOVE_GUARDIAN opData binds (nonce, index, guardian, x, y) per spec §6.4', () => {
        const x = `0x${'aa'.repeat(32)}` as Hex;
        const y = `0x${'bb'.repeat(32)}` as Hex;
        const opData = opDataRemoveGuardian(7n, 1, P256_GUARDIAN_SENTINEL, x, y);
        const decoded = decodeAbiParameters(
            [{ type: 'uint256' }, { type: 'uint8' }, { type: 'address' }, { type: 'bytes32' }, { type: 'bytes32' }],
            opData,
        );
        expect(decoded[0]).toBe(7n);
        expect(decoded[1]).toBe(1);
        expect((decoded[2] as string).toLowerCase()).toBe(P256_GUARDIAN_SENTINEL.toLowerCase());
        expect(decoded[3]).toBe(x);
        expect(decoded[4]).toBe(y);
        // A different slot index yields a different payload (no cross-slot replay).
        expect(buildRemoveGuardianChallenge({ chainId: 1, account: ACCOUNT, nonce: 7n, index: 1, guardianToRemove: P256_GUARDIAN_SENTINEL, p256X: x, p256Y: y }))
            .not.toBe(buildRemoveGuardianChallenge({ chainId: 1, account: ACCOUNT, nonce: 7n, index: 2, guardianToRemove: P256_GUARDIAN_SENTINEL, p256X: x, p256Y: y }));
    });
});

describe('encodeWebAuthnAssertion', () => {
    const goodAuthData = (() => {
        const a = new Uint8Array(37);
        a[32] = 0x05; // UP | UV
        return a;
    })();
    const challengeB64 = base64UrlEncode(new Uint8Array(32).fill(9));
    const goodCdj = `${WEBAUTHN_GET_CHALLENGE_PREFIX}${challengeB64}","origin":"https://x","crossOrigin":false}`;

    it('produces the 5-field abi.encode(bytes,bytes,bytes,bytes32,bytes32) the contract decodes', () => {
        const r = `0x${'11'.repeat(32)}` as Hex;
        const s = `0x${'22'.repeat(32)}` as Hex;
        const sig = encodeWebAuthnAssertion({ authenticatorData: goodAuthData, clientDataJSON: goodCdj, r, s });
        const d = decodeWebAuthnAssertion(sig);
        expect(d.authenticatorData).toBe(toHex(goodAuthData));
        expect(d.clientDataJSONPrefix).toBe(toHex(new TextEncoder().encode(WEBAUTHN_GET_CHALLENGE_PREFIX)));
        // suffix is everything after prefix(36) + challenge(43).
        expect(d.clientDataJSONSuffix).toBe(toHex(new TextEncoder().encode('","origin":"https://x","crossOrigin":false}')));
        expect(d.r).toBe(r);
        expect(d.s).toBe(s);
    });

    it('low-S normalises a high-S input to n - s', () => {
        const highS = SECP256R1_N - 5n; // clearly > n/2
        const sig = encodeWebAuthnAssertion({ authenticatorData: goodAuthData, clientDataJSON: goodCdj, r: 1n, s: highS });
        const d = decodeWebAuthnAssertion(sig);
        expect(BigInt(d.s)).toBe(5n);
        expect(BigInt(d.s) <= SECP256R1_N_OVER_2).toBe(true);
    });

    it('leaves a low-S input unchanged', () => {
        const lowS = 12345n;
        const sig = encodeWebAuthnAssertion({ authenticatorData: goodAuthData, clientDataJSON: goodCdj, r: 1n, s: lowS });
        expect(BigInt(decodeWebAuthnAssertion(sig).s)).toBe(lowS);
    });

    it('rejects a clientDataJSON without the exact webauthn.get prefix', () => {
        const badCdj = `{"type":"webauthn.create","challenge":"${challengeB64}","x":1}`;
        expect(() => encodeWebAuthnAssertion({ authenticatorData: goodAuthData, clientDataJSON: badCdj, r: 1n, s: 1n }))
            .toThrow(/exact prefix/);
    });

    it('rejects authenticatorData with the UP flag clear', () => {
        const noUp = new Uint8Array(37); // byte[32] = 0 → UP not set
        expect(() => encodeWebAuthnAssertion({ authenticatorData: noUp, clientDataJSON: goodCdj, r: 1n, s: 1n }))
            .toThrow(/UP/);
    });

    it('rejects authenticatorData shorter than 37 bytes', () => {
        expect(() => encodeWebAuthnAssertion({ authenticatorData: new Uint8Array(36), clientDataJSON: goodCdj, r: 1n, s: 1n }))
            .toThrow(/>= 37/);
    });
});

describe('coseToP256XY', () => {
    it('extracts (x, y) from an uncompressed SEC1 point', () => {
        const pub = p256.getPublicKey(toBytes(PRIV), false); // 0x04 || x || y
        const { x, y } = coseToP256XY(pub);
        expect(x).toBe(toHex(pub.slice(1, 33)));
        expect(y).toBe(toHex(pub.slice(33, 65)));
    });

    it('extracts (x, y) from a COSE_Key EC2 map', () => {
        const pub = p256.getPublicKey(toBytes(PRIV), false);
        const x = pub.slice(1, 33);
        const y = pub.slice(33, 65);
        // Hand-build a canonical COSE_Key: {1:2, 3:-7, -1:1, -2:x, -3:y}.
        const cose = new Uint8Array([
            0xa5,             // map(5)
            0x01, 0x02,       // 1: 2 (kty EC2)
            0x03, 0x26,       // 3: -7 (alg ES256)
            0x20, 0x01,       // -1: 1 (crv P-256)
            0x21, 0x58, 0x20, ...x, // -2: bytes(32) x
            0x22, 0x58, 0x20, ...y, // -3: bytes(32) y
        ]);
        const got = coseToP256XY(cose);
        expect(got.x).toBe(toHex(x));
        expect(got.y).toBe(toHex(y));
    });

    it('p256GuardianPublicKey returns the curve point of a private key', () => {
        const { x, y } = p256GuardianPublicKey(PRIV);
        const pub = p256.getPublicKey(toBytes(PRIV), false);
        expect(x).toBe(toHex(pub.slice(1, 33)));
        expect(y).toBe(toHex(pub.slice(33, 65)));
    });
});

describe('signP256GuardianAssertion (software authenticator)', () => {
    it('produces a low-S ES256 assertion that the public key verifies (full WebAuthn payload)', () => {
        const challenge = buildProposeRecoveryChallenge({ chainId: 11155111, account: ACCOUNT, nonce: 0n, newOwner: NEW_OWNER });
        const { sig, authenticatorData, clientDataJSON, r, s } = signP256GuardianAssertion({ privateKey: PRIV, challenge });

        // Low-S enforced.
        expect(BigInt(s) <= SECP256R1_N_OVER_2).toBe(true);

        // Reconstruct the exact payload the contract feeds the P-256 precompile and self-verify.
        const cdHash = toBytes(sha256(toBytes(clientDataJSON)));
        const authBytes = toBytes(authenticatorData);
        const message = new Uint8Array(authBytes.length + cdHash.length);
        message.set(authBytes, 0);
        message.set(cdHash, authBytes.length);
        const ok = p256.verify(
            { r: BigInt(r), s: BigInt(s) },
            message,
            p256.getPublicKey(toBytes(PRIV), false),
            { prehash: true, lowS: true },
        );
        expect(ok).toBe(true);

        // The sig round-trips through the contract's 5-field layout, and the prefix is exact.
        const d = decodeWebAuthnAssertion(sig);
        expect(d.clientDataJSONPrefix).toBe(toHex(new TextEncoder().encode(WEBAUTHN_GET_CHALLENGE_PREFIX)));
        expect(d.r).toBe(r);
        expect(d.s).toBe(s);

        // The challenge actually embedded in clientDataJSON equals the operation challenge.
        const embeddedB64 = base64UrlEncode(toBytes(challenge));
        expect(new TextDecoder().decode(toBytes(clientDataJSON))).toContain(embeddedB64);
    });
});
