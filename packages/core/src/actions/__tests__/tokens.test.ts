import { describe, it, expect, beforeEach } from 'vitest';
import { tokenActions } from '../tokens.js';
import { mockClient, resetMocks, TEST_ADDRESSES } from '../../__tests__/utils.js';
import { GTokenABI, xPNTsTokenABI } from '../../abis/index.js';

describe('Token Actions', () => {
    const actions = tokenActions(TEST_ADDRESSES.token)(mockClient);

    beforeEach(() => {
        resetMocks();
    });

    describe('GToken (Base)', () => {
        it('should call balanceOf', async () => {
            await actions.balanceOf({ token: TEST_ADDRESSES.token, account: TEST_ADDRESSES.user });
            expect(mockClient.readContract).toHaveBeenCalledWith({
                address: TEST_ADDRESSES.token,
                abi: expect.anything(), // generic
                functionName: 'balanceOf',
                args: [TEST_ADDRESSES.user]
            });
        });

        it('should call mint', async () => {
            await actions.mint({ token: TEST_ADDRESSES.token, to: TEST_ADDRESSES.user, amount: 100n, account: TEST_ADDRESSES.owner });
            expect(mockClient.writeContract).toHaveBeenCalledWith(expect.objectContaining({
                address: TEST_ADDRESSES.token,
                functionName: 'mint',
                args: [TEST_ADDRESSES.user, 100n]
            }));
        });

        it('should call burn', async () => {
            await actions.burn({ token: TEST_ADDRESSES.token, amount: 50n, account: TEST_ADDRESSES.user });
            expect(mockClient.writeContract).toHaveBeenCalledWith(expect.objectContaining({
                address: TEST_ADDRESSES.token,
                functionName: 'burn',
                args: [50n]
            }));
        });

        it('should call approve', async () => {
            await actions.approve({ token: TEST_ADDRESSES.token, spender: TEST_ADDRESSES.spender, amount: 100n, account: TEST_ADDRESSES.user });
            expect(mockClient.writeContract).toHaveBeenCalledWith(expect.objectContaining({
                address: TEST_ADDRESSES.token,
                functionName: 'approve',
                args: [TEST_ADDRESSES.spender, 100n]
            }));
        });

        it('should call transfer', async () => {
            await actions.transfer({ token: TEST_ADDRESSES.token, to: TEST_ADDRESSES.user, amount: 100n, account: TEST_ADDRESSES.owner });
            expect(mockClient.writeContract).toHaveBeenCalledWith(expect.objectContaining({
                address: TEST_ADDRESSES.token,
                functionName: 'transfer',
                args: [TEST_ADDRESSES.user, 100n]
            }));
        });

        it('should call transferFrom', async () => {
            await actions.transferFrom({ token: TEST_ADDRESSES.token, from: TEST_ADDRESSES.owner, to: TEST_ADDRESSES.user, amount: 100n, account: TEST_ADDRESSES.spender });
            expect(mockClient.writeContract).toHaveBeenCalledWith(expect.objectContaining({
                address: TEST_ADDRESSES.token,
                functionName: 'transferFrom',
                args: [TEST_ADDRESSES.owner, TEST_ADDRESSES.user, 100n]
            }));
        });
    });

    describe('Token Metadata & Ownership', () => {
        it('should call name', async () => {
            await actions.name({ token: TEST_ADDRESSES.token });
            expect(mockClient.readContract).toHaveBeenCalledWith(expect.objectContaining({
                functionName: 'name'
            }));
        });
        it('should call symbol', async () => {
            await actions.symbol({ token: TEST_ADDRESSES.token });
            expect(mockClient.readContract).toHaveBeenCalledWith(expect.objectContaining({
                 functionName: 'symbol'
            }));
        });
        it('should call decimals', async () => {
            await actions.decimals({ token: TEST_ADDRESSES.token });
            expect(mockClient.readContract).toHaveBeenCalledWith(expect.objectContaining({
                 functionName: 'decimals'
            }));
        });
        it('should call totalSupply', async () => {
            await actions.totalSupply({ token: TEST_ADDRESSES.token });
            expect(mockClient.readContract).toHaveBeenCalledWith(expect.objectContaining({
                 functionName: 'totalSupply'
            }));
        });
        it('should call owner', async () => {
            await actions.owner({ token: TEST_ADDRESSES.token });
             expect(mockClient.readContract).toHaveBeenCalledWith(expect.objectContaining({
                 functionName: 'owner'
             }));
        });
        it('should call transferTokenOwnership', async () => {
            await actions.transferTokenOwnership({ token: TEST_ADDRESSES.token, newOwner: TEST_ADDRESSES.user, account: TEST_ADDRESSES.owner });
            expect(mockClient.writeContract).toHaveBeenCalledWith(expect.objectContaining({
                functionName: 'transferOwnership',
                args: [TEST_ADDRESSES.user]
            }));
        });
        it('should call renounceOwnership', async () => {
            await actions.renounceOwnership({ token: TEST_ADDRESSES.token, account: TEST_ADDRESSES.owner });
            expect(mockClient.writeContract).toHaveBeenCalledWith(expect.objectContaining({
                functionName: 'renounceOwnership'
            }));
        });
    });

    describe('xPNTs Specific & Auto Approval', () => {
        it('should call updateExchangeRate', async () => {
            await actions.updateExchangeRate({ token: TEST_ADDRESSES.token, newRate: 2n, account: TEST_ADDRESSES.owner });
             expect(mockClient.writeContract).toHaveBeenCalledWith(expect.objectContaining({
                 functionName: 'updateExchangeRate',
                 args: [2n]
             }));
        });
        it('should call getDebt', async () => {
             await actions.getDebt({ token: TEST_ADDRESSES.token, user: TEST_ADDRESSES.user });
             expect(mockClient.readContract).toHaveBeenCalledWith(expect.objectContaining({
                 functionName: 'getDebt',
                 args: [TEST_ADDRESSES.user]
             }));
        });
        it('should call repayDebt', async () => {
             await actions.repayDebt({ token: TEST_ADDRESSES.token, amount: 100n, account: TEST_ADDRESSES.user });
             expect(mockClient.writeContract).toHaveBeenCalledWith(expect.objectContaining({
                 functionName: 'repayDebt',
                 args: [100n]
             }));
        });
        it('should call transferAndCall', async () => {
             await actions.transferAndCall({ token: TEST_ADDRESSES.token, to: TEST_ADDRESSES.user, amount: 100n, account: TEST_ADDRESSES.owner });
             expect(mockClient.writeContract).toHaveBeenCalledWith(expect.objectContaining({
                 functionName: 'transferAndCall'
             }));
        });
        it('should call addAutoApprovedSpender', async () => {
             await actions.addAutoApprovedSpender({ token: TEST_ADDRESSES.token, spender: TEST_ADDRESSES.spender, account: TEST_ADDRESSES.owner });
             expect(mockClient.writeContract).toHaveBeenCalledWith(expect.objectContaining({
                 functionName: 'addAutoApprovedSpender',
                 args: [TEST_ADDRESSES.spender]
             }));
        });
         it('should call removeAutoApprovedSpender', async () => {
             await actions.removeAutoApprovedSpender({ token: TEST_ADDRESSES.token, spender: TEST_ADDRESSES.spender, account: TEST_ADDRESSES.owner });
             expect(mockClient.writeContract).toHaveBeenCalledWith(expect.objectContaining({
                 functionName: 'removeAutoApprovedSpender',
                 args: [TEST_ADDRESSES.spender]
             }));
        });
        it('should call isAutoApprovedSpender', async () => {
            await actions.isAutoApprovedSpender({ token: TEST_ADDRESSES.token, spender: TEST_ADDRESSES.spender });
             expect(mockClient.readContract).toHaveBeenCalledWith(expect.objectContaining({
                 functionName: 'isAutoApprovedSpender',
                 args: [TEST_ADDRESSES.spender]
             }));
        });
    });

    describe('Constants & Helpers', () => {
         it('should call SUPERPAYMASTER_ADDRESS', async () => {
             await actions.SUPERPAYMASTER_ADDRESS({ token: TEST_ADDRESSES.token });
             expect(mockClient.readContract).toHaveBeenCalledWith(expect.objectContaining({
                 functionName: 'SUPERPAYMASTER_ADDRESS'
             }));
         });
         it('should call FACTORY', async () => {
             await actions.FACTORY({ token: TEST_ADDRESSES.token });
             expect(mockClient.readContract).toHaveBeenCalledWith(expect.objectContaining({
                 functionName: 'FACTORY'
             }));
         });
         it('should call version', async () => {
             await actions.version({ token: TEST_ADDRESSES.token });
             expect(mockClient.readContract).toHaveBeenCalledWith(expect.objectContaining({
                 functionName: 'version'
             }));
         });
    });
    
    describe('xPNTs Additional', () => {
        it('should call autoApprovedSpenders', async () => {
            await actions.autoApprovedSpenders({ token: TEST_ADDRESSES.token, spender: TEST_ADDRESSES.spender });
            expect(mockClient.readContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: 'autoApprovedSpenders' }));
        });
        it('should call burnFromWithOpHash', async () => {
            await actions.burnFromWithOpHash({ token: TEST_ADDRESSES.token, account: TEST_ADDRESSES.user, amount: 100n, opHash: '0x123', userOpAccount: TEST_ADDRESSES.owner });
             expect(mockClient.writeContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: 'burnFromWithOpHash' }));
        });
        it('should call communityOwner', async () => {
            await actions.communityOwner({ token: TEST_ADDRESSES.token });
             expect(mockClient.readContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: 'communityOwner' }));
        });
        it('should call eip712Domain', async () => {
            await actions.eip712Domain({ token: TEST_ADDRESSES.token });
             expect(mockClient.readContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: 'eip712Domain' }));
        });
        it('should call getDefaultSpendingLimitXPNTs', async () => {
            await actions.getDefaultSpendingLimitXPNTs({ token: TEST_ADDRESSES.token });
             expect(mockClient.readContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: 'getDefaultSpendingLimitXPNTs' }));
        });
        it('should call getMetadata', async () => {
            await actions.getMetadata({ token: TEST_ADDRESSES.token });
             expect(mockClient.readContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: 'getMetadata' }));
        });
         it('should call needsApproval', async () => {
            await actions.needsApproval({ token: TEST_ADDRESSES.token, owner: TEST_ADDRESSES.owner, spender: TEST_ADDRESSES.spender, amount: 100n });
             expect(mockClient.readContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: 'needsApproval' }));
        });
        it('should call recordDebt', async () => {
            await actions.recordDebt({ token: TEST_ADDRESSES.token, user: TEST_ADDRESSES.user, amount: 100n, account: TEST_ADDRESSES.owner });
             expect(mockClient.writeContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: 'recordDebt' }));
        });
         it('should call DEFAULT_SPENDING_LIMIT_APNTS', async () => {
            await actions.DEFAULT_SPENDING_LIMIT_APNTS({ token: TEST_ADDRESSES.token });
             expect(mockClient.readContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: 'DEFAULT_SPENDING_LIMIT_APNTS' }));
        });
    });

    describe('xPNTs Token (Phase 5 Actions)', () => { 
        it('should call transferOwnership', async () => {
             await actions.transferOwnership({ token: TEST_ADDRESSES.token, newOwner: TEST_ADDRESSES.user, account: TEST_ADDRESSES.owner });
             expect(mockClient.writeContract).toHaveBeenCalledWith(expect.objectContaining({
                 address: TEST_ADDRESSES.token,
                 abi: xPNTsTokenABI,
                 functionName: 'transferOwnership',
                 args: [TEST_ADDRESSES.user]
             }));
        });

        it('should call communityName', async () => {
            await actions.communityName({ token: TEST_ADDRESSES.token });
            expect(mockClient.readContract).toHaveBeenCalledWith({
                address: TEST_ADDRESSES.token,
                abi: xPNTsTokenABI,
                functionName: 'communityName',
                args: []
            });
        });

        it('should call exchangeRate', async () => {
            await actions.exchangeRate({ token: TEST_ADDRESSES.token });
            expect(mockClient.readContract).toHaveBeenCalledWith({
                address: TEST_ADDRESSES.token,
                abi: xPNTsTokenABI,
                functionName: 'exchangeRate',
                args: []
            });
        });
        
        it('should call spendingLimits', async () => {
            await actions.spendingLimits({ token: TEST_ADDRESSES.token, user: TEST_ADDRESSES.user });
            expect(mockClient.readContract).toHaveBeenCalledWith({
                address: TEST_ADDRESSES.token,
                abi: xPNTsTokenABI,
                functionName: 'spendingLimits',
                args: [TEST_ADDRESSES.user]
            });
        });
        
        it('should call DOMAIN_SEPARATOR', async () => {
            await actions.DOMAIN_SEPARATOR({ token: TEST_ADDRESSES.token });
            expect(mockClient.readContract).toHaveBeenCalledWith({
                address: TEST_ADDRESSES.token,
                abi: xPNTsTokenABI,
                functionName: 'DOMAIN_SEPARATOR',
                args: []
            });
        });

        it('should call nonces', async () => {
             await actions.nonces({ token: TEST_ADDRESSES.token, owner: TEST_ADDRESSES.owner });
             expect(mockClient.readContract).toHaveBeenCalledWith({
                 address: TEST_ADDRESSES.token,
                 abi: xPNTsTokenABI,
                 functionName: 'nonces',
                 args: [TEST_ADDRESSES.owner]
             });
        });

        it('should call permit', async () => {
            const hex = '0x00';
            await actions.permit({ token: TEST_ADDRESSES.token, owner: TEST_ADDRESSES.owner, spender: TEST_ADDRESSES.spender, value: 100n, deadline: 999n, v: 27, r: hex, s: hex, account: TEST_ADDRESSES.owner });
            expect(mockClient.writeContract).toHaveBeenCalledWith(expect.objectContaining({
                functionName: 'permit',
                args: [TEST_ADDRESSES.owner, TEST_ADDRESSES.spender, 100n, 999n, 27, hex, hex]
            }));
        });
        
        it('should call setPaymasterLimit', async () => {
             await actions.setPaymasterLimit({ token: TEST_ADDRESSES.token, user: TEST_ADDRESSES.user, limit: 100n, account: TEST_ADDRESSES.owner });
             expect(mockClient.writeContract).toHaveBeenCalledWith(expect.objectContaining({
                 functionName: 'setPaymasterLimit',
                 args: [TEST_ADDRESSES.user, 100n]
             }));
        });
    });
});
