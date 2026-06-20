import { describe, it, expect } from 'vitest';
import type { Hex } from 'viem';
import { buildInitConfig } from '../../src/actions/initConfig';

const ZERO = '0x0000000000000000000000000000000000000000';
const ZERO32 = `0x${'00'.repeat(32)}`;
const ECDSA_G = '0x1111111111111111111111111111111111111111' as const;
const X = `0x${'aa'.repeat(32)}` as Hex;
const Y = `0x${'bb'.repeat(32)}` as Hex;

describe('buildInitConfig', () => {
    it('produces the 8-field config with zeroed slots for an ECDSA-only account', () => {
        const cfg = buildInitConfig({ guardians: [{ ecdsa: ECDSA_G }], dailyLimit: 1n });
        expect(cfg.guardians).toEqual([ECDSA_G, ZERO, ZERO]);
        expect(cfg.guardianP256X).toEqual([ZERO32, ZERO32, ZERO32]);
        expect(cfg.guardianP256Y).toEqual([ZERO32, ZERO32, ZERO32]);
        expect(cfg.approvedAlgIds).toEqual([2]);
    });

    it('wires a P-256 slot as guardians[i]=address(0) + (x,y), and approves ECDSA + P-256 (0x02, 0x03)', () => {
        const cfg = buildInitConfig({ guardians: [{ ecdsa: ECDSA_G }, { p256: { x: X, y: Y } }], dailyLimit: 1n });
        expect(cfg.guardians).toEqual([ECDSA_G, ZERO, ZERO]);
        expect(cfg.guardianP256X).toEqual([ZERO32, X, ZERO32]);
        expect(cfg.guardianP256Y).toEqual([ZERO32, Y, ZERO32]);
        // #118 H1: ALG_P256 == 0x03 (NOT 0x01 = BLS). Default must whitelist ECDSA owner + P-256, never BLS.
        expect(cfg.approvedAlgIds).toEqual([0x02, 0x03]);
        expect(cfg.approvedAlgIds).toContain(0x03);
        expect(cfg.approvedAlgIds).not.toContain(0x01);
    });

    it('rejects > 3 guardians', () => {
        expect(() => buildInitConfig({ guardians: [{ ecdsa: ECDSA_G }, { ecdsa: ECDSA_G }, { ecdsa: ECDSA_G }, { ecdsa: ECDSA_G }], dailyLimit: 1n }))
            .toThrow(/at most 3/);
    });

    it('rejects a slot with both ecdsa and p256', () => {
        expect(() => buildInitConfig({ guardians: [{ ecdsa: ECDSA_G, p256: { x: X, y: Y } }], dailyLimit: 1n }))
            .toThrow(/exactly one/);
    });

    it('rejects a half-specified P-256 key (x set, y zero)', () => {
        expect(() => buildInitConfig({ guardians: [{ p256: { x: X, y: ZERO32 as Hex } }], dailyLimit: 1n }))
            .toThrow(/non-zero/);
    });

    it('rejects the P-256 sentinel as a plain ECDSA guardian', () => {
        expect(() => buildInitConfig({ guardians: [{ ecdsa: '0x0000000000000000000000000000000000007026' }], dailyLimit: 1n }))
            .toThrow(/sentinel/);
    });

    it('rejects dailyLimit <= 0', () => {
        expect(() => buildInitConfig({ dailyLimit: 0n })).toThrow(/dailyLimit/);
    });
});
