import { describe, it, expect } from 'vitest';
import { BaseClient } from '../src/clients/BaseClient';
import { createMockWalletClient, createMockPublicClient } from './mocks/client';
import { type Address } from 'viem';

// Concrete implementation for testing
class TestClient extends BaseClient {
    public exposeRequireRegistry() { return this.requireRegistry(); }
    public exposeRequireGToken() { return this.requireGToken(); }
    public exposeRequireGTokenStaking() { return this.requireGTokenStaking(); }
    public exposeRequirePaymasterFactory() { return this.requirePaymasterFactory(); }
    public exposeRequireEntryPoint() { return this.requireEntryPoint(); }
}

const VALID_ADDR = '0x1111111111111111111111111111111111111111' as Address;

describe('BaseClient', () => {
    it('should initialize correctly with valid config', () => {
        const mockWallet = createMockWalletClient();
        const client = new TestClient({
            client: mockWallet as any,
            registryAddress: VALID_ADDR
        });
        
        expect(client.getAddress()).toBe(mockWallet.account.address);
        expect(client.getStartPublicClient()).toBe(mockWallet); // fallback
    });

    it('should prioritize public client if provided', () => {
        const mockWallet = createMockWalletClient();
        const mockPublic = createMockPublicClient();
        const client = new TestClient({
            client: mockWallet as any,
            publicClient: mockPublic as any
        });
        
        expect(client.getStartPublicClient()).toBe(mockPublic);
    });

    it('should throw if WalletClient is missing', () => {
        expect(() => new TestClient({} as any)).toThrow('WalletClient is required');
    });

    it('should throw if WalletClient has no account', () => {
        const mockWallet = createMockWalletClient();
        mockWallet.account = undefined;
        expect(() => new TestClient({ client: mockWallet as any })).toThrow('WalletClient must have an account');
    });

    it('should validate required addresses', () => {
        const mockWallet = createMockWalletClient();
        
        // Client with no extra addresses
        const clientEmpty = new TestClient({ client: mockWallet as any });
        expect(() => clientEmpty.exposeRequireRegistry()).toThrow('Registry address is not configured');
        expect(() => clientEmpty.exposeRequireGToken()).toThrow('GToken address is not configured');
        expect(() => clientEmpty.exposeRequireGTokenStaking()).toThrow('GTokenStaking address is not configured');
        expect(() => clientEmpty.exposeRequirePaymasterFactory()).toThrow('PaymasterFactory address is not configured');
        expect(() => clientEmpty.exposeRequireEntryPoint()).toThrow('EntryPoint address is not configured');

        // Client with all addresses
        const clientFull = new TestClient({ 
            client: mockWallet as any,
            registryAddress: VALID_ADDR,
            gTokenAddress: VALID_ADDR,
            gTokenStakingAddress: VALID_ADDR,
            paymasterFactoryAddress: VALID_ADDR,
            entryPointAddress: VALID_ADDR
        });

        expect(clientFull.exposeRequireRegistry()).toBe(VALID_ADDR);
        expect(clientFull.exposeRequireGToken()).toBe(VALID_ADDR);
        expect(clientFull.exposeRequireGTokenStaking()).toBe(VALID_ADDR);
        expect(clientFull.exposeRequirePaymasterFactory()).toBe(VALID_ADDR);
        expect(clientFull.exposeRequireEntryPoint()).toBe(VALID_ADDR);
    });
});
