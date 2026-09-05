import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseEther } from 'viem';
import { PaymasterOperator } from '../src/V4/PaymasterOperator';

/**
 * Every write must hand viem a PARSED abi that actually declares the function being called.
 *
 * Asserting a function NAME against a mock is free — the mock repeats back whatever it was told,
 * which is exactly how `addGasToken` (on no deployed PaymasterV4, and passed a raw string array
 * viem cannot parse) kept a green test for as long as it did. This is the assertion that costs
 * something.
 */
function expectEveryWriteCarriesARealAbi(mockWallet: any) {
    const calls = mockWallet.writeContract.mock.calls as any[];
    expect(calls.length, 'no writes recorded — this check would be vacuous').toBeGreaterThan(0);
    for (const [arg] of calls) {
        expect(Array.isArray(arg.abi), `${arg.functionName}: abi must be an array`).toBe(true);
        const declared = (arg.abi as any[]).filter((e) => typeof e === 'object' && e?.type === 'function');
        expect(declared.length, `${arg.functionName}: abi is not a parsed ABI (raw strings?)`).toBeGreaterThan(0);
        expect(
            declared.map((e) => e.name),
            `${arg.functionName}: not declared by the abi passed with it`,
        ).toContain(arg.functionName);
    }
}

describe('PaymasterOperator', () => {
    let mockWallet: any;
    let mockPublicClient: any;
    const PAYMASTER = '0x1111111111111111111111111111111111111111';
    const TOKEN = '0x2222222222222222222222222222222222222222';
    const USER = '0x3333333333333333333333333333333333333333';

    beforeEach(() => {
        mockWallet = {
            writeContract: vi.fn().mockResolvedValue('0xHash'),
            chain: { id: 1 },
            account: { address: '0xOperator' }
        };
        mockPublicClient = {
            readContract: vi.fn(),
            waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: 'success' })
        };
    });

    it('should updatePrice', async () => {
        await PaymasterOperator.updatePrice(mockWallet, PAYMASTER);
        expect(mockWallet.writeContract).toHaveBeenCalled();
        const args = mockWallet.writeContract.mock.calls[0][0];
        expect(args.functionName).toBe('updatePrice');
        expect(args.address).toBe(PAYMASTER);
    });

    it('should setTokenPrice', async () => {
        await PaymasterOperator.setTokenPrice(mockWallet, PAYMASTER, TOKEN, 100n);
        expect(mockWallet.writeContract).toHaveBeenCalledWith(expect.objectContaining({
            functionName: 'setTokenPrice',
            args: [TOKEN, 100n]
        }));
    });

    it('should getCachedPrice', async () => {
        mockPublicClient.readContract.mockResolvedValue([200000000000n, 1234567890n]);
        const result = await PaymasterOperator.getCachedPrice(mockPublicClient, PAYMASTER);
        expect(result.price).toBe(200000000000n);
        expect(result.updatedAt).toBe(1234567890n);
    });

    it('should include all write methods', async () => {
        await PaymasterOperator.removeToken(mockWallet, PAYMASTER, TOKEN);
        expect(mockWallet.writeContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: 'removeToken' }));

        await PaymasterOperator.setServiceFeeRate(mockWallet, PAYMASTER, 100n);
        expect(mockWallet.writeContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: 'setServiceFeeRate' }));

        await PaymasterOperator.setMaxGasCostCap(mockWallet, PAYMASTER, 500000n);
        expect(mockWallet.writeContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: 'setMaxGasCostCap' }));
        
        await PaymasterOperator.withdrawTo(mockWallet, PAYMASTER, USER, 100n);
        expect(mockWallet.writeContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: 'withdrawTo' }));

        await PaymasterOperator.addStake(mockWallet, PAYMASTER, parseEther('1'), 86400);
        expect(mockWallet.writeContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: 'addStake', value: parseEther('1') }));

        expectEveryWriteCarriesARealAbi(mockWallet);

        await PaymasterOperator.addDeposit(mockWallet, PAYMASTER, parseEther('1'));
        expect(mockWallet.writeContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: 'addDeposit', value: parseEther('1') }));
    });
    
    describe('Readiness & Automation', () => {
        it('should detect uninitiialized price', async () => {
            mockPublicClient.readContract.mockResolvedValue([0n, 0n]); // cachedPrice 0
            const needsInit = await PaymasterOperator.ensurePriceInitialized(mockWallet, mockPublicClient, PAYMASTER);
            expect(needsInit).toBe(true);
            expect(mockWallet.writeContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: 'updatePrice' }));
        });

        it('should skip init if price exists', async () => {
             mockPublicClient.readContract.mockResolvedValue([100n, 123n]); // cachedPrice > 0
             const needsInit = await PaymasterOperator.ensurePriceInitialized(mockWallet, mockPublicClient, PAYMASTER);
             expect(needsInit).toBe(false);
             expect(mockWallet.writeContract).not.toHaveBeenCalled();
        });

        it('should prepare gasless environment', async () => {
            // Mock readContract for checkGaslessReadiness
            mockPublicClient.readContract.mockImplementation(async ({ functionName }: any) => {
                if (functionName === 'getDepositInfo') return [0n, false, 0n, 0, 0]; // No deposit/stake
                if (functionName === 'cachedPrice') return [0n, 0n]; // No price
                if (functionName === 'tokenPrices') return 0n; // No token price
                if (functionName === 'balanceOf') return 0n;
                if (functionName === 'balances') return 0n;
                return undefined;
            });
            
            // Mock ensurePriceInitialized inside prepareGaslessEnvironment if needed? 
            // Actually prepareGaslessEnvironment calls updatePrice directly.
            
            const results = await PaymasterOperator.prepareGaslessEnvironment(
                mockWallet, mockPublicClient, '0xEntryPoint', PAYMASTER, TOKEN, 
                { minStake: parseEther('0.1'), minDeposit: parseEther('0.1'), tokenPriceUSD: 100n }
            );
            
            expect(mockWallet.writeContract).toHaveBeenCalled();
            // Just verifying it ran through without error is enough for coverage.
            // But we can check calls too.
            const callNames = mockWallet.writeContract.mock.calls.map((c: any) => c[0].functionName);
            // Some calls might be conditional/skipped based on mocks.
            // With current mocks:
            // deposit info [0, false...] -> needs stake & deposit
            const calls = mockWallet.writeContract.mock.calls.map((c: any) => c[0].functionName);
            expect(calls).toContain('addStake');
            expect(calls).toContain('addDeposit');
            // ensurePriceInitialized might be skipped if mock state is tricky, but we covered updatePrice in specific test above.
            expect(calls).toContain('setTokenPrice');

            // `addGasToken` used to be asserted here, and it PASSED — because a mock records the
            // name it is handed without ever reaching viem. On a real chain that call threw every
            // time (raw string array as `abi:`) and its exception was eaten by an empty catch, so
            // the step it claimed to perform never happened. The assertion held while the
            // behaviour did not.
            expect(calls, 'a name that is on no deployed PaymasterV4').not.toContain('addGasToken');

            expectEveryWriteCarriesARealAbi(mockWallet);

        });
    });
});
