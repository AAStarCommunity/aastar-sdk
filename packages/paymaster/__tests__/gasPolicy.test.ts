import { describe, it, expect, vi } from 'vitest';
import { DEFAULT_PVG_COEFFICIENT_BPS, resolveUserOpFees, scaleGas, scaleLimits } from '../src/V4/gasPolicy';

const client = (o: { history?: any; historyFails?: boolean; priority?: bigint; baseFee?: bigint | null } = {}) => ({
    getFeeHistory: vi.fn(async () => { if (o.historyFails) throw new Error('method not found'); return o.history; }),
    estimateMaxPriorityFeePerGas: vi.fn(async () => o.priority ?? 7n),
    getBlock: vi.fn(async () => ({ baseFeePerGas: o.baseFee === undefined ? 100n : o.baseFee })),
});

describe('resolveUserOpFees', () => {
    it('caller fees given in full are used as they are, with no chain read', async () => {
        const c = client();
        expect(await resolveUserOpFees(c, { maxFeePerGas: 5n, maxPriorityFeePerGas: 1n })).toEqual({ maxFeePerGas: 5n, maxPriorityFeePerGas: 1n, source: 'caller' });
        expect(c.getFeeHistory).not.toHaveBeenCalled();
    });

    it('priority = median of the percentile rewards; maxFee = next base fee × 2 + priority; asks for the stated percentile', async () => {
        const c = client({ history: { baseFeePerGas: [10n, 11n, 12n, 40n], reward: [[3n], [9n], [5n]] } });
        expect(await resolveUserOpFees(c, {})).toEqual({ maxFeePerGas: 40n * 2n + 5n, maxPriorityFeePerGas: 5n, source: 'feeHistory', baseFeePerGas: 40n });
        expect(c.getFeeHistory).toHaveBeenCalledWith({ blockCount: 10, blockTag: 'latest', rewardPercentiles: [50] });
        await resolveUserOpFees(c, {}, { priorityFeePercentile: 25, feeHistoryBlocks: 4, baseFeeMultiplier: 3n });
        expect(c.getFeeHistory).toHaveBeenLastCalledWith({ blockCount: 4, blockTag: 'latest', rewardPercentiles: [25] });
    });

    it('no floor is added on any chain: tiny chain fees stay tiny', async () => {
        const c = client({ history: { baseFeePerGas: [1n, 1n], reward: [[1n]] } });
        expect(await resolveUserOpFees(c, {})).toMatchObject({ maxFeePerGas: 3n, maxPriorityFeePerGas: 1n });
    });

    it('one caller value is kept and the other comes from the chain', async () => {
        const c = client({ history: { baseFeePerGas: [10n, 20n], reward: [[4n]] } });
        expect(await resolveUserOpFees(c, { maxPriorityFeePerGas: 6n })).toMatchObject({ maxPriorityFeePerGas: 6n, maxFeePerGas: 46n });
        expect(await resolveUserOpFees(c, { maxFeePerGas: 99n })).toMatchObject({ maxPriorityFeePerGas: 4n, maxFeePerGas: 99n });
    });

    it('without eth_feeHistory: the node priority estimate and the latest base fee; no base fee at all is refused', async () => {
        expect(await resolveUserOpFees(client({ historyFails: true, priority: 7n, baseFee: 100n }), {})).toEqual({ maxFeePerGas: 207n, maxPriorityFeePerGas: 7n, source: 'node-estimate', baseFeePerGas: 100n });
        await expect(resolveUserOpFees(client({ historyFails: true, baseFee: null }), {})).rejects.toThrow('no base fee');
    });

    it('maxFee below priority is refused', async () => {
        await expect(resolveUserOpFees(client(), { maxFeePerGas: 1n, maxPriorityFeePerGas: 2n })).rejects.toThrow('below maxPriorityFeePerGas');
        await expect(resolveUserOpFees(client({ history: { baseFeePerGas: [1n], reward: [[2n]] } }), { maxFeePerGas: 1n, maxPriorityFeePerGas: undefined })).rejects.toThrow('below');
    });
});

describe('scaleGas / scaleLimits', () => {
    it('rounds up and refuses a coefficient below 1x', () => {
        expect(scaleGas(3n, 15_000n)).toBe(5n); // 4.5 → 5
        expect(scaleGas(200_000n, 15_000n)).toBe(300_000n);
        expect(() => scaleGas(1n, 9_999n)).toThrow('below 1x');
        // preVerificationGas keeps its own coefficient, default 1.0: it is charged in full (clestons #464 B2).
        expect(scaleLimits({ preVerificationGas: 2n, verificationGasLimit: 4n, callGasLimit: 6n, paymasterVerificationGasLimit: 8n, paymasterPostOpGasLimit: 10n }, 15_000n))
            .toEqual({ preVerificationGas: 2n, verificationGasLimit: 6n, callGasLimit: 9n, paymasterVerificationGasLimit: 12n, paymasterPostOpGasLimit: 15n });
        expect(scaleLimits({ preVerificationGas: 2n, verificationGasLimit: 4n, callGasLimit: 6n, paymasterVerificationGasLimit: 8n, paymasterPostOpGasLimit: 10n }, 15_000n, 12_000n).preVerificationGas).toBe(3n); // 2.4 → 3
        expect(DEFAULT_PVG_COEFFICIENT_BPS).toBe(10_000n);
    });
});

describe('resolveUserOpFees asks the chain only for what is missing', () => {
    it('given priority + no feeHistory: no priority estimate is requested; the base fee still comes from the block', async () => {
        const c = { getFeeHistory: vi.fn(async () => { throw new Error('no'); }), estimateMaxPriorityFeePerGas: vi.fn(async () => { throw new Error('unsupported'); }), getBlock: vi.fn(async () => ({ baseFeePerGas: 10n })) };
        expect(await resolveUserOpFees(c, { maxPriorityFeePerGas: 3n })).toMatchObject({ maxPriorityFeePerGas: 3n, maxFeePerGas: 23n });
        expect(c.estimateMaxPriorityFeePerGas).not.toHaveBeenCalled();
    });

    it('given maxFee + no feeHistory: no base fee is needed', async () => {
        const c = { getFeeHistory: vi.fn(async () => { throw new Error('no'); }), estimateMaxPriorityFeePerGas: vi.fn(async () => 4n), getBlock: vi.fn(async () => { throw new Error('no block'); }) };
        expect(await resolveUserOpFees(c, { maxFeePerGas: 50n })).toMatchObject({ maxPriorityFeePerGas: 4n, maxFeePerGas: 50n });
        expect(c.getBlock).not.toHaveBeenCalled();
    });
});

describe('median over an even number of blocks', () => {
    it('is the mean of the two middle rewards, rounded down', async () => {
        const c = { getFeeHistory: vi.fn(async () => ({ baseFeePerGas: [1n, 1n], reward: [1n, 1n, 1n, 1n, 1n, 9n, 9n, 9n, 9n, 9n].map((r) => [r]) })), estimateMaxPriorityFeePerGas: vi.fn(), getBlock: vi.fn() };
        expect((await resolveUserOpFees(c, {})).maxPriorityFeePerGas).toBe(5n);
        const c2 = { getFeeHistory: vi.fn(async () => ({ baseFeePerGas: [1n, 1n], reward: [[2n], [5n]] })), estimateMaxPriorityFeePerGas: vi.fn(), getBlock: vi.fn() };
        expect((await resolveUserOpFees(c2, {})).maxPriorityFeePerGas).toBe(3n); // (2 + 5) / 2 rounded down
    });
});

describe('fee policy bounds (clestons #464 Info)', () => {
    it('a baseFeeMultiplier below 1 is refused', async () => {
        const client: any = { getFeeHistory: async () => ({ baseFeePerGas: [10n, 10n], reward: [[1n]], gasUsedRatio: [0.5], oldestBlock: 1n }), getBlock: async () => ({ baseFeePerGas: 10n }), estimateMaxPriorityFeePerGas: async () => 1n };
        await expect(resolveUserOpFees(client, {}, { baseFeeMultiplier: 0n })).rejects.toThrow('below 1');
    });
});
