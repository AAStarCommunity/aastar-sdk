import { describe, it, expect, beforeEach } from 'vitest';
import { aggregatorActions } from '../../src/actions/aggregator';
import { createMockPublicClient, createMockWalletClient, resetMocks } from '../mocks/client';

const AGG_ADDRESS = '0x1111111111111111111111111111111111111111' as `0x${string}`;
const VALIDATOR_ADDRESS = '0x2222222222222222222222222222222222222222' as `0x${string}`;

describe('AggregatorActions', () => {
  let publicClient: any;
  let walletClient: any;

  beforeEach(() => {
    resetMocks();
    publicClient = createMockPublicClient();
    walletClient = createMockWalletClient();
  });

  describe('registerBLSPublicKey', () => {
    it('should register BLS key', async () => {
      walletClient.writeContract.mockResolvedValue('0xhash');
      const actions = aggregatorActions(AGG_ADDRESS)(walletClient);
      await actions.registerBLSPublicKey({
        validator: VALIDATOR_ADDRESS,
        publicKey: '0x1234',
        account: walletClient.account
      });
      expect(walletClient.writeContract).toHaveBeenCalled();
    });
  });

  describe('Thresholds', () => {
    it('should get default threshold', async () => {
      publicClient.readContract.mockResolvedValue(2n);
      const actions = aggregatorActions(AGG_ADDRESS)(publicClient);
      const result = await actions.defaultThreshold();
      expect(result).toBe(2n);
    });

    it('should set default threshold', async () => {
      walletClient.writeContract.mockResolvedValue('0xhash');
      const actions = aggregatorActions(AGG_ADDRESS)(walletClient);
      await actions.setDefaultThreshold({ newThreshold: 3n, account: walletClient.account });
      expect(walletClient.writeContract).toHaveBeenCalled();
    });
  });

  describe('executeProposal', () => {
    it('should execute proposal', async () => {
      walletClient.writeContract.mockResolvedValue('0xhash');
      const actions = aggregatorActions(AGG_ADDRESS)(walletClient);
      await actions.executeProposal({
        proposalId: '0x01',
        target: VALIDATOR_ADDRESS,
        callData: '0x',
        requiredThreshold: 2n,
        proof: '0x',
        account: walletClient.account
      });
      expect(walletClient.writeContract).toHaveBeenCalled();
    });
  });

  // DVT co-sign aggregation (frozen DVT program spec, hub #42)
  describe('DVT co-sign: slot reads + buildSignerMask + verify', () => {
    const SIGNER_A = ('0x' + 'aa'.repeat(20)) as `0x${string}`;
    const SIGNER_B = ('0x' + 'bb'.repeat(20)) as `0x${string}`;
    const G1 = { x_a: '0x01', x_b: '0x02', y_a: '0x03', y_b: '0x04' };

    /** Mock getBLSPublicKey keyed by validator → [G1Point, slot, isActive]. */
    const mockKeys = (byAddr: Record<string, [number, boolean]>) => {
      publicClient.readContract.mockImplementation(async ({ functionName, args }: any) => {
        if (functionName === 'getBLSPublicKey') {
          const entry = byAddr[(args[0] as string).toLowerCase()];
          if (!entry) throw new Error(`no mock for ${args[0]}`);
          return [G1, entry[0], entry[1]];
        }
        throw new Error(`unexpected read: ${functionName}`);
      });
    };

    it('getBLSPublicKey decodes (publicKey, slot, isActive)', async () => {
      publicClient.readContract.mockResolvedValue([G1, 3, true]);
      const actions = aggregatorActions(AGG_ADDRESS)(publicClient);
      const r = await actions.getBLSPublicKey({ validator: SIGNER_A });
      expect(r).toEqual({ publicKey: G1, slot: 3, isActive: true });
    });

    it('validatorAtSlot reads the address at a slot', async () => {
      publicClient.readContract.mockResolvedValue(SIGNER_A);
      const actions = aggregatorActions(AGG_ADDRESS)(publicClient);
      expect(await actions.validatorAtSlot({ slot: 2 })).toBe(SIGNER_A);
    });

    it('buildSignerMask sets bit (slot-1) per signer (slot 1→bit0, slot 3→bit2)', async () => {
      mockKeys({ [SIGNER_A.toLowerCase()]: [1, true], [SIGNER_B.toLowerCase()]: [3, true] });
      const actions = aggregatorActions(AGG_ADDRESS)(publicClient);
      const { signerMask, slots } = await actions.buildSignerMask({ signers: [SIGNER_A, SIGNER_B] });
      // slot 1 → bit 0 (0b001), slot 3 → bit 2 (0b100) → 0b101 = 5
      expect(signerMask).toBe(5n);
      expect(slots).toEqual([1, 3]);
    });

    it('buildSignerMask rejects an inactive/unregistered signer (slot 0)', async () => {
      mockKeys({ [SIGNER_A.toLowerCase()]: [0, false] });
      const actions = aggregatorActions(AGG_ADDRESS)(publicClient);
      await expect(actions.buildSignerMask({ signers: [SIGNER_A] }))
        .rejects.toThrow(/not a registered active DVT validator/);
    });

    it('buildSignerMask rejects duplicate slots', async () => {
      mockKeys({ [SIGNER_A.toLowerCase()]: [2, true], [SIGNER_B.toLowerCase()]: [2, true] });
      const actions = aggregatorActions(AGG_ADDRESS)(publicClient);
      await expect(actions.buildSignerMask({ signers: [SIGNER_A, SIGNER_B] }))
        .rejects.toThrow(/duplicate registration slots/);
    });

    it('buildSignerMask rejects an empty signer set', async () => {
      const actions = aggregatorActions(AGG_ADDRESS)(publicClient);
      await expect(actions.buildSignerMask({ signers: [] }))
        .rejects.toThrow(/non-empty/);
    });

    it('verify calls the on-chain verifier with (expectedMessageHash, signerMask, requiredThreshold, sigBytes)', async () => {
      publicClient.readContract.mockResolvedValue(true);
      const actions = aggregatorActions(AGG_ADDRESS)(publicClient);
      const ok = await actions.verify({
        expectedMessageHash: ('0x' + '11'.repeat(32)) as `0x${string}`,
        signerMask: 5n,
        requiredThreshold: 2n,
        sigBytes: '0xabcd',
      });
      expect(ok).toBe(true);
      const call = publicClient.readContract.mock.calls[0][0];
      expect(call.functionName).toBe('verify');
      expect(call.args).toEqual([('0x' + '11'.repeat(32)), 5n, 2n, '0xabcd']);
    });
  });
});
