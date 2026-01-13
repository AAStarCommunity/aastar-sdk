import { describe, it, expect, vi } from 'vitest';
import { ExperimentClient } from './ExperimentClient.js';
import { type Hash } from 'viem';

describe('ExperimentClient', () => {
    it('should record transaction result', () => {
        const client = new ExperimentClient('test-scenario', 'AA');
        const receipt = { gasUsed: 21000n, effectiveGasPrice: 1000000000n };
        const record = client.recordTx('0xhash' as Hash, receipt, 'Success');
        
        expect(record.txHash).toBe('0xhash');
        expect(record.group).toBe('AA');
        expect(record.status).toBe('Success');
        expect(record.costETH).toBe('0.000021');
        expect(client.getRecords()).toHaveLength(1);
    });

    it('should measure transaction automatically', async () => {
        const client = new ExperimentClient('test-scenario', 'SuperPaymaster');
        const mockPublicClient = {
            waitForTransactionReceipt: vi.fn().mockResolvedValue({
                gasUsed: 50000n,
                effectiveGasPrice: 2000000000n
            })
        };
        
        const txPromise = Promise.resolve('0xhash' as Hash);
        const hash = await client.measureTx('test-task', txPromise, mockPublicClient);
        
        expect(hash).toBe('0xhash');
        expect(client.getRecords()).toHaveLength(1);
        expect(client.getRecords()[0].status).toBe('Success');
    });

    it('should handle failed measureTx', async () => {
        const client = new ExperimentClient('test-scenario', 'EOA');
        const txPromise = Promise.reject(new Error('tx failed'));
        
        await expect(client.measureTx('test-task', txPromise, {})).rejects.toThrow('tx failed');
    });

    it('should handle missing gas fields in receipt', () => {
        const client = new ExperimentClient('test-scenario', 'AA');
        const record = client.recordTx('0xhash' as Hash, {} as any, 'Success');
        
        expect(record.gasUsed).toBe(0n);
        expect(record.gasPrice).toBe(0n);
        expect(record.costETH).toBe('0');
    });

    it('should record latency in measureTx', async () => {
        const client = new ExperimentClient('test-scenario', 'AA');
        const mockPublicClient = {
            waitForTransactionReceipt: vi.fn().mockResolvedValue({
                gasUsed: 21000n,
                effectiveGasPrice: 1000000000n
            })
        };
        
        await client.measureTx('test', Promise.resolve('0xhash' as Hash), mockPublicClient);
        const record = client.getRecords()[0];
        expect(record.meta?.latency).toBeDefined();
        expect(typeof record.meta.latency).toBe('number');
    });
});
