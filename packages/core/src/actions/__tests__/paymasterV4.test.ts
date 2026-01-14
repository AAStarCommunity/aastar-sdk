import { describe, it, expect, beforeEach } from 'vitest';
import { paymasterV4Actions } from '../paymasterV4.js';
import { mockClient, resetMocks, TEST_ADDRESSES } from '../../__tests__/utils.js';
import { PaymasterV4ABI } from '../../abis/index.js';

describe('PaymasterV4 Actions', () => {
    // PaymasterV4Actions is a factory function that takes an address
    const actions = paymasterV4Actions(TEST_ADDRESSES.superPaymaster)(mockClient);

    beforeEach(() => {
        resetMocks();
    });

    describe('Deposits & Staking', () => {
        it('should call depositFor (addDeposit)', async () => {
             // Alias addDeposit -> deposit (msg.sender)
             await actions.addDeposit({ account: TEST_ADDRESSES.owner });
             expect(mockClient.writeContract).toHaveBeenCalledWith(expect.objectContaining({
                 functionName: 'deposit',
                 args: []
             }));
        });
        
        it('should call withdrawTo', async () => {
             await actions.withdrawTo({ to: TEST_ADDRESSES.user, amount: 100n, account: TEST_ADDRESSES.owner });
             expect(mockClient.writeContract).toHaveBeenCalledWith(expect.objectContaining({
                 functionName: 'withdrawTo',
                 args: [TEST_ADDRESSES.user, 100n]
             }));
        });
        
        it('should call addStake', async () => {
             await actions.addStake({ unstakeDelaySec: 100n, amount: 1n, account: TEST_ADDRESSES.owner });
             expect(mockClient.writeContract).toHaveBeenCalledWith(expect.objectContaining({
                 functionName: 'addStake',
                 args: [100n],
                 value: 1n
             }));
        });
        
         it('should call unlockStake', async () => {
             await actions.unlockStake({ account: TEST_ADDRESSES.owner });
             expect(mockClient.writeContract).toHaveBeenCalledWith(expect.objectContaining({
                 functionName: 'unlockStake'
             }));
        });
        
        it('should call withdrawStake', async () => {
             await actions.withdrawStake({ to: TEST_ADDRESSES.user, account: TEST_ADDRESSES.owner });
             expect(mockClient.writeContract).toHaveBeenCalledWith(expect.objectContaining({
                 functionName: 'withdrawStake',
                 args: [TEST_ADDRESSES.user]
             }));
        });
    });

    describe('Token Logic', () => {
        it('should call addGasToken', async () => {
            await actions.addGasToken({ token: TEST_ADDRESSES.token, priceFeed: TEST_ADDRESSES.spender, account: TEST_ADDRESSES.owner });
             expect(mockClient.writeContract).toHaveBeenCalledWith(expect.objectContaining({
                 functionName: 'addGasToken',
                 args: [TEST_ADDRESSES.token, TEST_ADDRESSES.spender]
             }));
        });
         it('should call removeGasToken', async () => {
            await actions.removeGasToken({ token: TEST_ADDRESSES.token, account: TEST_ADDRESSES.owner });
             expect(mockClient.writeContract).toHaveBeenCalledWith(expect.objectContaining({
                 functionName: 'removeGasToken',
                 args: [TEST_ADDRESSES.token]
             }));
        });
        it('should call setTokenPrice', async () => {
             await actions.setTokenPrice({ token: TEST_ADDRESSES.token, price: 500n, account: TEST_ADDRESSES.owner });
             expect(mockClient.writeContract).toHaveBeenCalledWith(expect.objectContaining({
                 functionName: 'setTokenPrice',
                 // Note: arguments depend on implementation (legacy might use price, V4 might use oracle)
                 // Based on code, it calls setTokenPrice(token, price)
                 args: [TEST_ADDRESSES.token, 500n]
             }));
        });
        it('should call getRealtimeTokenCost', async () => {
            await actions.getRealtimeTokenCost({ token: TEST_ADDRESSES.token, gasCost: 1000n });
             expect(mockClient.readContract).toHaveBeenCalledWith(expect.objectContaining({
                 functionName: 'getRealtimeTokenCost',
                 args: [TEST_ADDRESSES.token, 1000n]
             }));
        });
    });
    
    describe('Validation', () => {
        it('should call validatePaymasterUserOp', async () => {
             const userOp = { sender: TEST_ADDRESSES.user, nonce: 0n };
             await actions.validatePaymasterUserOp({ userOp: userOp as any, userOpHash: '0x123', maxCost: 100n });
             expect(mockClient.readContract).toHaveBeenCalledWith(expect.objectContaining({
                 functionName: 'validatePaymasterUserOp',
                 args: [userOp, '0x123', 100n]
             }));
        });
        it('should throw on postOp', async () => {
             await expect(actions.postOp({ mode: 0, context: '0xabcdef', actualGasCost: 50n, actualUserOpFeePerGas: 10n }))
                .rejects.toThrow('postOp is called by EntryPoint');
        });
    });
    
    describe('Views & Constants', () => {
        it('should call ethUsdPriceFeed', async () => {
             await actions.ethUsdPriceFeed();
             expect(mockClient.readContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: 'ethUsdPriceFeed' }));
        });
        it('should call oracleDecimals', async () => {
             await actions.oracleDecimals();
             expect(mockClient.readContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: 'oracleDecimals' }));
        });
        it('should call serviceFeeRate', async () => {
             await actions.serviceFeeRate();
             expect(mockClient.readContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: 'serviceFeeRate' }));
        });
        it('should call version', async () => {
             await actions.version();
             expect(mockClient.readContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: 'version' }));
        });
        it('should call isActiveInRegistry', async () => {
             await actions.isActiveInRegistry();
             expect(mockClient.readContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: 'isActiveInRegistry' }));
        });
    });
    
    describe('Admin', () => {
        it('should call initialize', async () => {
             await actions.initialize({ owner: TEST_ADDRESSES.owner, account: TEST_ADDRESSES.owner });
             expect(mockClient.writeContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: 'initialize', args: [TEST_ADDRESSES.owner] }));
        });
        it('should call transferPaymasterV4Ownership', async () => {
             await actions.transferPaymasterV4Ownership({ newOwner: TEST_ADDRESSES.user, account: TEST_ADDRESSES.owner });
             expect(mockClient.writeContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: 'transferOwnership', args: [TEST_ADDRESSES.user] }));
        });
        it('should call setTreasury', async () => {
             await actions.setTreasury({ treasury: TEST_ADDRESSES.user, account: TEST_ADDRESSES.owner });
             expect(mockClient.writeContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: 'setTreasury', args: [TEST_ADDRESSES.user] }));
        });
        it('should call setMaxGasCostCap', async () => {
             await actions.setMaxGasCostCap({ cap: 1000n, account: TEST_ADDRESSES.owner });
             expect(mockClient.writeContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: 'setMaxGasCostCap', args: [1000n] }));
        });
        it('should call setServiceFeeRate', async () => {
             await actions.setServiceFeeRate({ rate: 50n, account: TEST_ADDRESSES.owner });
             expect(mockClient.writeContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: 'setServiceFeeRate', args: [50n] }));
        });
    });
});
