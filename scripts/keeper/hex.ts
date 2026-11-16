/**
 * Bounded hex checks for adapter results. A bad payload names its reason.
 */
import type { Hex } from 'viem';

export function explainHex(value: unknown, max: number): { ok: true; data: Hex } | { ok: false; reason: string } {
    if (typeof value !== 'string' || value.length < 2) return { ok: false, reason: 'unavailable' };
    if (value.length > max) return { ok: false, reason: 'too-long' };
    if (value.charCodeAt(0) !== 48 || value.charCodeAt(1) !== 120) return { ok: false, reason: 'not-hex' };
    if ((value.length % 2) !== 0) return { ok: false, reason: 'odd-length' };
    for (let i = 2; i < value.length; i++) {
        const c = value.charCodeAt(i);
        const hex = (c >= 48 && c <= 57) || (c >= 97 && c <= 102) || (c >= 65 && c <= 70);
        if (!hex) return { ok: false, reason: 'not-hex' };
    }
    return { ok: true, data: value as Hex };
}
