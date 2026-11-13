import { hexToBytes, keccak256, toHex, type Hex } from 'viem';

/** Ethereum logsBloom (yellow paper §4.3.1): 2048 bits, 3 bits from keccak256. Unreadable ≠ absence. */
const BYTES = 256;
const BLOOM_RE = /^0x[0-9a-fA-F]{512}$/;

export interface BloomLog { address: string; topics?: readonly string[] }

function bits(item: Hex): number[] {
    const h = hexToBytes(keccak256(item));
    return [0, 2, 4].map((i) => ((h[i]! << 8) | h[i + 1]!) & 2047);
}

function poke(bloom: Uint8Array, item: string): void {
    for (const bit of bits(item as Hex)) bloom[BYTES - 1 - (bit >> 3)]! |= 1 << (bit & 7);
}

const MAX_LOGS = 16384;
const MAX_TOPICS = 8;

/** 256-byte bloom of `{ address, topics }` logs. */
export function bloomOf(logs: readonly BloomLog[]): Hex {
    if (logs.length > MAX_LOGS) throw new Error('too many logs');
    const bloom = new Uint8Array(BYTES);
    for (let i = 0; i < logs.length; i++) {
        const log = logs[i]!;
        if (typeof log.address !== 'string' || log.address.length > 66) throw new Error('invalid bloom item');
        poke(bloom, log.address);
        const topics = log.topics ?? [];
        if (topics.length > MAX_TOPICS) throw new Error('too many topics');
        for (let j = 0; j < topics.length; j++) {
            const topic = topics[j]!;
            if (typeof topic !== 'string' || topic.length > 66) throw new Error('invalid bloom item');
            poke(bloom, topic);
        }
    }
    return toHex(bloom);
}

/** `true` when every bit is set. An unreadable bloom returns `true` (never trust absence). */
export function mayContain(bloomHex: string, item: Hex): boolean {
    if (typeof bloomHex !== 'string' || bloomHex.length !== 514 || !BLOOM_RE.test(bloomHex)) return true;
    if (typeof item !== 'string' || item.length < 2 || item.length > 66) return true;
    let bloom: Uint8Array;
    try { bloom = hexToBytes(bloomHex as Hex); } catch { return true; }
    if (bloom.length !== BYTES) return true;
    return bits(item).every((bit) => (bloom[BYTES - 1 - (bit >> 3)]! & (1 << (bit & 7))) !== 0);
}

/** Address-only probe. `null` when the bloom is not 256 bytes. */
export function mayContainAddress(bloom: string | null | undefined, address: string): boolean | null {
    if (typeof bloom !== 'string' || bloom.length !== 514 || !BLOOM_RE.test(bloom)) return null;
    return mayContain(bloom, address as Hex);
}

/** Address and any one topic. `null` when the bloom cannot be read. Topic-table seam for step 4. */
export function mayHaveLog(bloomHex: string | null | undefined, address: string, topics: readonly string[]): boolean | null {
    if (typeof bloomHex !== 'string' || bloomHex.length !== 514 || !BLOOM_RE.test(bloomHex)) return null;
    if (topics.length > MAX_TOPICS) return null;
    return mayContain(bloomHex, address as Hex) && topics.some((topic) => mayContain(bloomHex, topic as Hex));
}
