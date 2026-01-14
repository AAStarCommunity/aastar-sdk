import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type Address, type PublicClient, type WalletClient, type Account, type Hex } from 'viem';
import { dvtActions, blsActions } from './validators.js';

describe('Validator Actions', () => {
    let mockPublicClient: Partial<PublicClient>;
    let mockWalletClient: Partial<WalletClient>;
    let mockAccount: Account;

    const MOCK_VALIDATOR: Address = '0x1111111111111111111111111111111111111111';
    const MOCK_TARGET: Address = '0x2222222222222222222222222222222222222222';
    const MOCK_USER: Address = '0x3333333333333333333333333333333333333333';
    const MOCK_PROPOSAL_ID = 1n;

    beforeEach(() => {
        mockAccount = {
            address: MOCK_USER,
            type: 'json-rpc'
        } as Account;

        mockPublicClient = {
            readContract: vi.fn(),
        };

        mockWalletClient = {
            writeContract: vi.fn(),
            account: mockAccount,
        };
    });

    describe('dvtActions', () => {
        it('should create proposal', async () => {
            const txHash = '0xhash';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);
            const actions = dvtActions(MOCK_VALIDATOR)(mockWalletClient as WalletClient);
            const result = await actions.createProposal({
                target: MOCK_TARGET,
                calldata: '0x',
                description: 'test',
                account: mockAccount
            });
            expect(result).toBe(txHash);
        });

        it('should sign proposal', async () => {
            const txHash = '0xhash';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);
            const actions = dvtActions(MOCK_VALIDATOR)(mockWalletClient as WalletClient);
            const result = await actions.signProposal({ proposalId: MOCK_PROPOSAL_ID, account: mockAccount });
            expect(result).toBe(txHash);
        });

        it('should execute with proof', async () => {
            const txHash = '0xhash';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);
            const actions = dvtActions(MOCK_VALIDATOR)(mockWalletClient as WalletClient);
            const result = await actions.executeWithProof({ 
                proposalId: MOCK_PROPOSAL_ID, 
                signatures: ['0x123'], 
                account: mockAccount 
            });
            expect(result).toBe(txHash);
        });

        it('should cancel proposal', async () => {
            const txHash = '0xhash';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);
            const actions = dvtActions(MOCK_VALIDATOR)(mockWalletClient as WalletClient);
            const result = await actions.cancelProposal({ proposalId: MOCK_PROPOSAL_ID, account: mockAccount });
            expect(result).toBe(txHash);
        });

        it('should query validator info', async () => {
            (mockPublicClient.readContract as any)
                .mockResolvedValueOnce(true) // isValidator
                .mockResolvedValueOnce(['0xV1']) // getValidators
                .mockResolvedValueOnce(1n); // getValidatorCount
            const actions = dvtActions(MOCK_VALIDATOR)(mockPublicClient as PublicClient);
            expect(await actions.isValidator({ validator: MOCK_USER })).toBe(true);
            expect(await actions.getValidators()).toEqual(['0xV1']);
            expect(await actions.getValidatorCount()).toBe(1n);
        });

        it('should query proposal details', async () => {
            (mockPublicClient.readContract as any)
                .mockResolvedValueOnce({ id: 1n }) // getProposal
                .mockResolvedValueOnce(1n) // getProposalCount
                .mockResolvedValueOnce(1) // getProposalState
                .mockResolvedValueOnce(5n) // getSignatureCount
                .mockResolvedValueOnce(true); // hasVoted
            const actions = dvtActions(MOCK_VALIDATOR)(mockPublicClient as PublicClient);
            const prop = await actions.getProposal({ proposalId: MOCK_PROPOSAL_ID });
            expect(prop.id).toBe(1n);
            expect(await actions.getProposalCount()).toBe(1n);
            expect(await actions.getProposalState({ proposalId: MOCK_PROPOSAL_ID })).toBe(1);
            expect(await actions.getSignatureCount({ proposalId: MOCK_PROPOSAL_ID })).toBe(5n);
            expect(await actions.hasVoted({ proposalId: MOCK_PROPOSAL_ID, validator: MOCK_USER })).toBe(true);
        });

        it('should manage validators and threshold', async () => {
            const txHash = '0xhash';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);
            const actions = dvtActions(MOCK_VALIDATOR)(mockWalletClient as WalletClient);
            expect(await actions.addValidator({ validator: MOCK_USER, account: mockAccount })).toBe(txHash);
            expect(await actions.removeValidator({ validator: MOCK_USER, account: mockAccount })).toBe(txHash);
            expect(await actions.setThreshold({ newThreshold: 2n, account: mockAccount })).toBe(txHash);
        });

        it('should system config and view', async () => {
            (mockPublicClient.readContract as any)
                .mockResolvedValueOnce(3n) // threshold
                .mockResolvedValueOnce(MOCK_USER) // owner
                .mockResolvedValueOnce('v1'); // version
            const actions = dvtActions(MOCK_VALIDATOR)(mockPublicClient as PublicClient);
            expect(await actions.threshold()).toBe(3n);
            expect(await actions.owner()).toBe(MOCK_USER);
            expect(await actions.version()).toBe('v1');
        });
        it('should call admin setters', async () => {
            const txHash = '0xhash';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);
            const actions = dvtActions(MOCK_VALIDATOR)(mockWalletClient as WalletClient);
            expect(await actions.setRegistry({ registry: MOCK_USER, account: mockAccount })).toBe(txHash);
            expect(await actions.setBLSAggregator({ aggregator: MOCK_USER, account: mockAccount })).toBe(txHash);
            expect(await actions.markProposalExecuted({ proposalId: 1n, account: mockAccount })).toBe(txHash);
            expect(await actions.transferOwnership({ newOwner: MOCK_USER, account: mockAccount })).toBe(txHash);
            expect(await actions.renounceOwnership({ account: mockAccount })).toBe(txHash);
        });

        it('should call views', async () => {
            (mockPublicClient.readContract as any)
                .mockResolvedValueOnce({}) // proposals
                .mockResolvedValueOnce(2n) // nextProposalId
                .mockResolvedValueOnce(MOCK_USER); // BLS_AGGREGATOR
            const actions = dvtActions(MOCK_VALIDATOR)(mockPublicClient as PublicClient);
            expect(await actions.proposals({ proposalId: 1n })).toEqual({});
            expect(await actions.nextProposalId()).toBe(2n);
            expect(await actions.BLS_AGGREGATOR()).toBe(MOCK_USER);
        });
    });

    describe('blsActions', () => {
        const MOCK_BLS: Address = '0x4444444444444444444444444444444444444444';
        const MOCK_KEY: Hex = '0x1234';

        it('should manage BLS public keys', async () => {
            const txHash = '0xhash';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);
            const actions = blsActions(MOCK_BLS)(mockWalletClient as WalletClient);
            expect(await actions.registerBLSPublicKey({ publicKey: MOCK_KEY, account: mockAccount })).toBe(txHash);
            expect(await actions.deregisterBLSPublicKey({ account: mockAccount })).toBe(txHash);
            expect(await actions.updatePublicKey({ newKey: MOCK_KEY, account: mockAccount })).toBe(txHash);
        });

        it('should aggregate and verify signatures', async () => {
            (mockPublicClient.readContract as any)
                .mockResolvedValueOnce('0xagg') // aggregateSignatures
                .mockResolvedValueOnce(true) // verifyAggregatedSignature
                .mockResolvedValueOnce(true); // validateSignature
            const actions = blsActions(MOCK_BLS)(mockPublicClient as PublicClient);
            expect(await actions.aggregateSignatures({ signatures: ['0x1'] })).toBe('0xagg');
            expect(await actions.verifyAggregatedSignature({ message: '0x', aggregatedSignature: '0x', publicKeys: ['0x'] })).toBe(true);
            expect(await actions.validateSignature({ message: '0x', signature: '0x', publicKey: '0x' })).toBe(true);
        });

        it('should query public keys and status', async () => {
            (mockPublicClient.readContract as any)
                .mockResolvedValueOnce(MOCK_KEY) // getPublicKey
                .mockResolvedValueOnce([MOCK_KEY]) // getPublicKeys
                .mockResolvedValueOnce(MOCK_KEY) // getAggregatedPublicKey
                .mockResolvedValueOnce(true) // isKeyRegistered
                .mockResolvedValueOnce(10n); // getRegisteredCount
            const actions = blsActions(MOCK_BLS)(mockPublicClient as PublicClient);
            expect(await actions.getPublicKey({ address: MOCK_USER })).toBe(MOCK_KEY);
            expect(await actions.getPublicKeys({ addresses: [MOCK_USER] })).toEqual([MOCK_KEY]);
            expect(await actions.getAggregatedPublicKey({ addresses: [MOCK_USER] })).toBe(MOCK_KEY);
            expect(await actions.isKeyRegistered({ address: MOCK_USER })).toBe(true);
            expect(await actions.getRegisteredCount()).toBe(10n);
        });

        it('should manage threshold and system', async () => {
            const txHash = '0xhash';
            (mockWalletClient.writeContract as any).mockResolvedValue(txHash);
            const actions = blsActions(MOCK_BLS)(mockWalletClient as WalletClient);
            expect(await actions.setThreshold({ newThreshold: 5n, account: mockAccount })).toBe(txHash);
            expect(await actions.setRegistry({ registry: MOCK_USER, account: mockAccount })).toBe(txHash);
            expect(await actions.transferOwnership({ newOwner: MOCK_USER, account: mockAccount })).toBe(txHash);
        });
        it('should call proposal execution extensions', async () => {
             const txHash = '0xhash';
             (mockWalletClient.writeContract as any).mockResolvedValue(txHash);
             const actions = blsActions(MOCK_BLS)(mockWalletClient as WalletClient);
             expect(await actions.executeProposal({ proposalId: 1n, signatures: ['0x'], account: mockAccount })).toBe(txHash);
             expect(await actions.verifyAndExecute({ proposalId: 1n, signatures: ['0x'], account: mockAccount })).toBe(txHash);
        });
        
        it('should manage thresholds extended', async () => {
             const txHash = '0xhash';
             (mockWalletClient.writeContract as any).mockResolvedValue(txHash);
             const actions = blsActions(MOCK_BLS)(mockWalletClient as WalletClient);
             
             expect(await actions.setMinThreshold({ newThreshold: 2n, account: mockAccount })).toBe(txHash);
             expect(await actions.setDefaultThreshold({ newThreshold: 3n, account: mockAccount })).toBe(txHash);
             expect(await actions.setDVTValidator({ validator: MOCK_USER, account: mockAccount })).toBe(txHash);
             expect(await actions.setSuperPaymaster({ paymaster: MOCK_USER, account: mockAccount })).toBe(txHash);
             expect(await actions.renounceOwnership({ account: mockAccount })).toBe(txHash);
        });

        it('should call extended views', async () => {
             (mockPublicClient.readContract as any)
                .mockResolvedValueOnce(['0x']) // blsPublicKeys
                .mockResolvedValueOnce(1n) // threshold
                .mockResolvedValueOnce(1n) // minThreshold
                .mockResolvedValueOnce(1n) // defaultThreshold
                .mockResolvedValueOnce(MOCK_USER) // REGISTRY
                .mockResolvedValueOnce(MOCK_USER) // DVT_VALIDATOR
                .mockResolvedValueOnce(MOCK_USER) // SUPERPAYMASTER
                .mockResolvedValueOnce(10n) // MAX_VALIDATORS
                .mockResolvedValueOnce(true) // executedProposals
                .mockResolvedValueOnce(0n) // proposalNonces
                .mockResolvedValueOnce(MOCK_USER) // owner
                .mockResolvedValueOnce('v1'); // version
                
             const actions = blsActions(MOCK_BLS)(mockPublicClient as PublicClient);
             expect(await actions.blsPublicKeys({ address: MOCK_USER })).toEqual(['0x']);
             expect(await actions.threshold()).toBe(1n);
             expect(await actions.minThreshold()).toBe(1n);
             expect(await actions.defaultThreshold()).toBe(1n);
             expect(await actions.REGISTRY()).toBe(MOCK_USER);
             expect(await actions.DVT_VALIDATOR()).toBe(MOCK_USER);
             expect(await actions.SUPERPAYMASTER()).toBe(MOCK_USER);
             expect(await actions.MAX_VALIDATORS()).toBe(10n);
             expect(await actions.executedProposals({ proposalId: 1n })).toBe(true);
             expect(await actions.proposalNonces({ proposalId: 1n })).toBe(0n);
             expect(await actions.owner()).toBe(MOCK_USER);
             expect(await actions.version()).toBe('v1');
        });
    });
});
