// AirAccountIdentity — derives Nostr identity from an AirAccount EOA private key.
//
// Both Ethereum and Nostr use secp256k1. The private key is identical;
// only the public key encoding differs:
//   - Ethereum: keccak256(uncompressed pubkey bytes)[12:] → 20-byte address
//   - Nostr:    x-coordinate of secp256k1 pubkey (32 bytes, hex) → npub / hex pubkey
//
// nostr-tools v2 getPublicKey() takes a Uint8Array private key and returns
// the x-only Nostr pubkey as a 64-char hex string.

import { getPublicKey } from 'nostr-tools/pure';
import { secp256k1 } from '@noble/curves/secp256k1';
import { keccak_256 } from '@noble/hashes/sha3';
import type { SporeIdentity, PrivateKeyHex } from '../types.js';

/** Convert a hex string to Uint8Array (no 0x prefix expected) */
function hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
}

/**
 * Normalise a private key to the 32-byte hex string (no 0x prefix).
 * Accepts either "0x"-prefixed Ethereum hex or plain hex.
 */
function normalisePrivateKey(key: PrivateKeyHex): string {
    const raw = key.startsWith('0x') ? key.slice(2) : key;
    if (raw.length !== 64) {
        throw new Error(
            `Private key must be 32 bytes (64 hex chars). Got ${raw.length} chars.`
        );
    }
    return raw;
}

/**
 * Derive the Ethereum address from a secp256k1 private key.
 *
 * Algorithm:
 *   1. Get the uncompressed 65-byte public key (04 || x || y) via @noble/curves
 *   2. keccak256 the last 64 bytes (x || y)
 *   3. Take the last 20 bytes → Ethereum address
 *
 * @noble/curves is a direct runtime dependency of nostr-tools v2.
 */
function deriveEthAddress(privKeyHex: string): `0x${string}` {
    // getPublicKey(privKey, compressed=false) → 65 bytes: 04 || x || y
    const privKeyBytes = hexToBytes(privKeyHex);
    const pubKeyBytes = secp256k1.getPublicKey(privKeyBytes, false);
    const pubKeyXY = pubKeyBytes.slice(1); // 64 bytes: x || y (drop 0x04 prefix)

    // keccak256(x || y), take last 20 bytes → Ethereum address
    const hash = keccak_256(pubKeyXY);
    const addressBytes = hash.slice(12);
    const hexAddr = Array.from(addressBytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    return `0x${hexAddr}` as `0x${string}`;
}

/**
 * Build a SporeIdentity from an AirAccount EOA private key.
 *
 * @param privateKeyHex - Hex-encoded 32-byte private key (with or without 0x prefix)
 * @returns SporeIdentity with Nostr pubkey, Ethereum address, and normalised key
 */
export async function createIdentity(privateKeyHex: PrivateKeyHex): Promise<SporeIdentity> {
    const normalisedKey = normalisePrivateKey(privateKeyHex);

    // getPublicKey takes Uint8Array and returns the x-only Nostr pubkey (64-char hex)
    const pubkey = getPublicKey(hexToBytes(normalisedKey));

    const address = deriveEthAddress(normalisedKey);

    return {
        pubkey,
        address,
        privateKeyHex: normalisedKey,
    };
}

/**
 * Create a SporeIdentity from environment variables.
 * Reads SPORE_WALLET_KEY (or WALLET_KEY / KEY as fallbacks).
 */
export async function createIdentityFromEnv(): Promise<SporeIdentity> {
    const key =
        process.env['SPORE_WALLET_KEY'] ??
        process.env['WALLET_KEY'] ??
        process.env['KEY'];

    if (!key) {
        throw new Error(
            'No private key found. Set SPORE_WALLET_KEY environment variable.'
        );
    }

    return createIdentity(key);
}
