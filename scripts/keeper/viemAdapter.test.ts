import { describe, expect, it } from 'vitest';
import type { Hex } from 'viem';
import { adaptChainIO } from './viemAdapter';

const ASKED = ('0x' + 'ab'.repeat(32)) as Hex;
const REAL = ('0x' + 'cd'.repeat(32)) as Hex;
const BLOCK = ('0x' + '11'.repeat(32)) as Hex;

describe('adaptChainIO', { timeout: 30_000 }, () => {
    it('returns the receipt transaction hash and the endpoint chain id', async () => {
        const client = {
            async request(args: { method: string }) {
                if (args.method === 'eth_chainId') return '0xaa36a7';
                throw new Error('unexpected');
            },
            async getTransactionReceipt() {
                return {
                    status: 'success' as const,
                    gasUsed: 21_000n,
                    blockHash: BLOCK,
                    blockNumber: 4n,
                    transactionHash: REAL,
                };
            },
        };
        const chain = adaptChainIO(client as never);
        expect(await chain.chainId()).toBe(11155111);
        const receipt = await chain.getTransactionReceipt(ASKED);
        expect(receipt?.transactionHash).toBe(REAL);
        expect(receipt?.transactionHash).not.toBe(ASKED);
    });
});
