// Shared hex encode/decode utilities used across the messaging package.

/**
 * Decode a hex string to Uint8Array.
 * Accepts an optional 0x prefix.
 * Throws if the string contains non-hex characters.
 */
export function hexToBytes(hex: string): Uint8Array {
    const h = hex.startsWith('0x') ? hex.slice(2) : hex;
    if (h.length % 2 !== 0) {
        throw new Error(`hexToBytes: odd-length hex string (${h.length} chars)`);
    }
    if (h.length > 0 && !/^[0-9a-fA-F]+$/.test(h)) {
        throw new Error('hexToBytes: invalid hex characters');
    }
    const result = new Uint8Array(h.length / 2);
    for (let i = 0; i < result.length; i++) {
        result[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
    }
    return result;
}

/**
 * Encode a Uint8Array to lowercase hex string (no 0x prefix).
 */
export function bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}
