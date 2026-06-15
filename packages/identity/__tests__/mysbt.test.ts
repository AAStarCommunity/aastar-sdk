import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkMySBT, getMySBTId } from '../src/mysbt';

const SBT = '0x1111111111111111111111111111111111111111' as `0x${string}`;
const USER = '0x2222222222222222222222222222222222222222' as `0x${string}`;

function mockClient(impl: (args: any) => any) {
    return { readContract: vi.fn(impl) };
}

describe('mysbt actions', () => {
    beforeEach(() => vi.clearAllMocks());

    describe('checkMySBT', () => {
        it('reports hasSBT=true when balance > 0', async () => {
            const client = mockClient(() => 1n);
            const res = await checkMySBT(client, SBT, USER);
            expect(res).toEqual({ hasSBT: true, balance: 1n });
            expect(client.readContract).toHaveBeenCalledWith(
                expect.objectContaining({ address: SBT, functionName: 'balanceOf', args: [USER] })
            );
        });

        it('reports hasSBT=false when balance is 0', async () => {
            const client = mockClient(() => 0n);
            expect(await checkMySBT(client, SBT, USER)).toEqual({ hasSBT: false, balance: 0n });
        });

        it('propagates read errors instead of masking them as no-SBT (false negative)', async () => {
            const client = mockClient(() => { throw new Error('rpc down'); });
            await expect(checkMySBT(client, SBT, USER)).rejects.toThrow(/rpc down/);
        });
    });

    describe('getMySBTId', () => {
        it('calls getUserSBT and returns the tokenId when the user holds an SBT', async () => {
            const client = mockClient(() => 42n);
            const id = await getMySBTId(client, SBT, USER);
            expect(id).toBe(42n);
            expect(client.readContract).toHaveBeenCalledWith(
                expect.objectContaining({ address: SBT, functionName: 'getUserSBT', args: [USER] })
            );
        });

        it('returns null when getUserSBT returns the 0 sentinel (no SBT)', async () => {
            const client = mockClient(() => 0n);
            expect(await getMySBTId(client, SBT, USER)).toBeNull();
        });

        it('propagates read errors instead of masking them as no-SBT (false negative)', async () => {
            const client = mockClient(() => { throw new Error('rpc down'); });
            await expect(getMySBTId(client, SBT, USER)).rejects.toThrow(/rpc down/);
        });
    });
});
