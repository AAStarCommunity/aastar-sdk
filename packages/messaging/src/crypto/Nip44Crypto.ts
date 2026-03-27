// Nip44Crypto — NIP-44 encryption/decryption layer for Spore Protocol.
//
// NIP-44 uses:
//   - ECDH (secp256k1) to derive a shared secret between sender and recipient
//   - HKDF-SHA256 to expand the shared secret into a symmetric key
//   - ChaCha20-Poly1305 for authenticated encryption
//
// nostr-tools ships a compliant NIP-44 implementation.
// API note (nostr-tools v2):
//   - getConversationKey(privkeyBytes: Uint8Array, pubkeyHex: string): Uint8Array
//   - encrypt(plaintext: string, conversationKey: Uint8Array): string
//   - decrypt(payload: string, conversationKey: Uint8Array): string

import { getConversationKey, encrypt as nip44Encrypt, decrypt as nip44Decrypt } from 'nostr-tools/nip44';
import { hexToBytes } from '../utils/hex.js';

/**
 * Encrypt plaintext from sender to recipient using NIP-44.
 *
 * @param senderPrivkeyHex   - Sender's 32-byte private key (hex, no 0x prefix)
 * @param recipientPubkeyHex - Recipient's 32-byte Nostr pubkey (hex)
 * @param plaintext          - UTF-8 plaintext to encrypt
 * @returns Base64-encoded NIP-44 versioned ciphertext
 */
export function encrypt(
    senderPrivkeyHex: string,
    recipientPubkeyHex: string,
    plaintext: string
): string {
    const conversationKey = getConversationKey(
        hexToBytes(senderPrivkeyHex),
        recipientPubkeyHex
    );
    return nip44Encrypt(plaintext, conversationKey);
}

/**
 * Decrypt a NIP-44 ciphertext.
 *
 * @param recipientPrivkeyHex - Recipient's 32-byte private key (hex, no 0x prefix)
 * @param senderPubkeyHex     - Sender's 32-byte Nostr pubkey (hex)
 * @param ciphertext          - Base64-encoded NIP-44 ciphertext
 * @returns Decrypted UTF-8 plaintext
 */
export function decrypt(
    recipientPrivkeyHex: string,
    senderPubkeyHex: string,
    ciphertext: string
): string {
    const conversationKey = getConversationKey(
        hexToBytes(recipientPrivkeyHex),
        senderPubkeyHex
    );
    return nip44Decrypt(ciphertext, conversationKey);
}

/**
 * Pre-compute the shared conversation key for a keypair.
 * Useful when sending/receiving many messages with the same peer
 * to avoid repeated ECDH operations.
 *
 * @param myPrivkeyHex    - Own 32-byte private key (hex, no 0x prefix)
 * @param theirPubkeyHex  - Peer's 32-byte Nostr pubkey (hex)
 * @returns 32-byte shared conversation key
 */
export function deriveConversationKey(
    myPrivkeyHex: string,
    theirPubkeyHex: string
): Uint8Array {
    return getConversationKey(hexToBytes(myPrivkeyHex), theirPubkeyHex);
}

/**
 * Encrypt using a pre-computed conversation key.
 * More efficient for multiple messages to the same peer.
 */
export function encryptWithKey(conversationKey: Uint8Array, plaintext: string): string {
    return nip44Encrypt(plaintext, conversationKey);
}

/**
 * Decrypt using a pre-computed conversation key.
 */
export function decryptWithKey(conversationKey: Uint8Array, ciphertext: string): string {
    return nip44Decrypt(ciphertext, conversationKey);
}
