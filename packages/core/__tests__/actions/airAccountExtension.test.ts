import { describe, it, expect } from 'vitest';
import { numberToHex, type Hex } from 'viem';
import {
    airAccountExtensionActions,
    GUARDIAN_REMOVAL_NONCE_SLOT,
    TIER_LIMIT_NONCE_SLOT,
    RECOVERY_NONCE_SLOT,
    GUARDIAN_ADDITION_NONCE_SLOT,
    MAX_GUARDIAN_SLOT,
} from '../../src/actions/airAccountExtension';

const ACCOUNT = '0x1111111111111111111111111111111111111111' as const;
const OK_SIG = `0x${'00'.repeat(352)}` as Hex;

describe('airAccountExtension — nonce storage slots (AAStarAgentStorageLayout.sol)', () => {
    it('pins the EXACT slot constants from the contract layout', () => {
        // AAStarAgentStorageLayout.sol — do not change without re-reading the layout file.
        expect(GUARDIAN_REMOVAL_NONCE_SLOT).toBe(15n); // line 118
        expect(TIER_LIMIT_NONCE_SLOT).toBe(16n);       // line 119
        expect(RECOVERY_NONCE_SLOT).toBe(38n);         // line 182 (== public getRecoveryNonce())
        expect(GUARDIAN_ADDITION_NONCE_SLOT).toBe(39n);// line 186
        expect(MAX_GUARDIAN_SLOT).toBe(2);
    });

    it('reads each nonce from its slot via eth_getStorageAt', async () => {
        const reads: Record<string, bigint> = {};
        const client = {
            getStorageAt: async ({ slot }: { address: string; slot: Hex }) => {
                reads.lastSlot = BigInt(slot);
                return numberToHex(7n, { size: 32 });
            },
        } as any;
        const ext = airAccountExtensionActions(ACCOUNT)(client);

        expect(await ext.getGuardianAdditionNonce()).toBe(7n);
        expect(reads.lastSlot).toBe(GUARDIAN_ADDITION_NONCE_SLOT);
        await ext.getGuardianRemovalNonce();
        expect(reads.lastSlot).toBe(GUARDIAN_REMOVAL_NONCE_SLOT);
        await ext.getTierLimitNonce();
        expect(reads.lastSlot).toBe(TIER_LIMIT_NONCE_SLOT);
    });

    it('treats an empty (0x) slot as nonce 0', async () => {
        const client = { getStorageAt: async () => '0x' } as any;
        const ext = airAccountExtensionActions(ACCOUNT)(client);
        expect(await ext.getTierLimitNonce()).toBe(0n);
    });
});

describe('airAccountExtension — mixed-sig signerIdxs validation (L1)', () => {
    // writeContract MUST NOT be reached when validation fails.
    const client = {
        writeContract: async () => { throw new Error('writeContract should not be called when validation fails'); },
        chain: undefined,
    } as any;
    const ext = airAccountExtensionActions(ACCOUNT)(client);

    it('rejects mismatched signerIdxs / sigs lengths', async () => {
        await expect(ext.removeGuardianWithMixedSigs({ index: 0, signerIdxs: [0, 1], sigs: [OK_SIG] }))
            .rejects.toThrow(/equal length/);
    });

    it('rejects fewer than RECOVERY_THRESHOLD (2) signatures', async () => {
        await expect(ext.modifyTierLimitsWithMixedGuardians({ tier1: 1n, tier2: 2n, deadline: 9n, signerIdxs: [0], sigs: [OK_SIG] }))
            .rejects.toThrow(/RECOVERY_THRESHOLD/);
    });

    it('rejects an out-of-range guardian index (> 2)', async () => {
        await expect(ext.addGuardianWithMixedSigs({ guardian: ACCOUNT, signerIdxs: [0, 3], sigs: [OK_SIG, OK_SIG] }))
            .rejects.toThrow(/0\.\.2/);
    });

    it('rejects duplicate guardian indices', async () => {
        await expect(ext.addP256GuardianWithMixedSigs({ x: OK_SIG, y: OK_SIG, signerIdxs: [1, 1], sigs: [OK_SIG, OK_SIG] }))
            .rejects.toThrow(/unique/);
    });
});
