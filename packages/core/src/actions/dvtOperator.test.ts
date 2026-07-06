import { describe, it, expect, vi } from 'vitest';
import { dvtOperatorActions } from './dvtOperator.js';

const VALIDATOR = '0x539B9681aFd5BFbCaa655Fe4c6BdcFe1fa7864bC' as const;
const G1 = ('0x' + '11'.repeat(128)) as `0x${string}`; // 128-byte
const G2 = ('0x' + '22'.repeat(256)) as `0x${string}`; // 256-byte

/** A wallet-client stub whose writeContract records that it was reached (i.e. validation passed). */
function stubClient() {
    const writeContract = vi.fn().mockResolvedValue('0xhash');
    return { client: { writeContract, chain: undefined } as any, writeContract };
}

describe('dvtOperatorActions.registerWithProof length guards (contract reverts on mismatch)', () => {
    it('rejects a publicKey that is not 128 bytes BEFORE sending the tx', async () => {
        const { client, writeContract } = stubClient();
        const dvt = dvtOperatorActions(VALIDATOR)(client);
        await expect(
            dvt.registerWithProof({ publicKey: ('0x' + '11'.repeat(64)) as any, popPoint: G2, popSig: G2 })
        ).rejects.toThrow(/publicKey must be a 128-byte/);
        expect(writeContract).not.toHaveBeenCalled();
    });

    it('rejects a popPoint / popSig that is not 256 bytes BEFORE sending the tx', async () => {
        const { client, writeContract } = stubClient();
        const dvt = dvtOperatorActions(VALIDATOR)(client);
        await expect(
            dvt.registerWithProof({ publicKey: G1, popPoint: ('0x' + '22'.repeat(128)) as any, popSig: G2 })
        ).rejects.toThrow(/popPoint must be a 256-byte/);
        await expect(
            dvt.registerWithProof({ publicKey: G1, popPoint: G2, popSig: ('0x' + '22'.repeat(255)) as any })
        ).rejects.toThrow(/popSig must be a 256-byte/);
        expect(writeContract).not.toHaveBeenCalled();
    });

    it('passes correctly-sized EIP-2537 args through to writeContract', async () => {
        const { client, writeContract } = stubClient();
        const dvt = dvtOperatorActions(VALIDATOR)(client);
        await dvt.registerWithProof({ publicKey: G1, popPoint: G2, popSig: G2 });
        expect(writeContract).toHaveBeenCalledOnce();
        expect(writeContract.mock.calls[0][0]).toMatchObject({ functionName: 'registerWithProof', args: [G1, G2, G2] });
    });
});

describe('dvtOperatorActions.getRegisteredNodes empty-validator guard', () => {
    it('returns [] for an empty validator instead of hitting the contract "Offset out of bounds" revert', async () => {
        const readContract = vi.fn().mockResolvedValue(0n); // getRegisteredNodeCount -> 0
        const dvt = dvtOperatorActions(VALIDATOR)({ readContract } as any);
        await expect(dvt.getRegisteredNodes()).resolves.toEqual([]);
        // Only the count read happened — the paginated getter (which would revert) was never called.
        expect(readContract).toHaveBeenCalledOnce();
        expect(readContract.mock.calls[0][0]).toMatchObject({ functionName: 'getRegisteredNodeCount' });
    });

    it('zips nodeIds + publicKeys when the validator has nodes', async () => {
        const readContract = vi.fn()
            .mockResolvedValueOnce(2n) // count
            .mockResolvedValueOnce([['0xaa', '0xbb'], ['0x01', '0x02']]); // getRegisteredNodes
        const dvt = dvtOperatorActions(VALIDATOR)({ readContract } as any);
        await expect(dvt.getRegisteredNodes()).resolves.toEqual([
            { nodeId: '0xaa', publicKey: '0x01' },
            { nodeId: '0xbb', publicKey: '0x02' },
        ]);
    });
});
