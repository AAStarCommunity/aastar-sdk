import { type Address, type PublicClient, type WalletClient, type Chain, type Transport, type Account } from 'viem';
import { type ClientConfig } from './types.js';

export abstract class BaseClient {
    protected client: WalletClient<Transport, Chain, Account>;
    protected publicClient?: PublicClient;
    protected registryAddress?: Address;

    constructor(config: ClientConfig) {
        if (!config.client) {
            throw new Error('WalletClient is required for Business Clients');
        }
        if (!config.client.account) {
            throw new Error('WalletClient must have an account attached');
        }

        this.client = config.client;
        this.publicClient = config.publicClient;
        this.registryAddress = config.registryAddress;
    }

    /**
     * Get the account address of the connected wallet
     */
    public getAddress(): Address {
        return this.client.account.address;
    }

    /**
     * Helper to ensure public client exists or fallback to wallet client (if it supports read)
     */
    protected getStartPublicClient(): PublicClient | WalletClient<Transport, Chain, Account> {
        return this.publicClient || this.client;
    }

    protected requireRegistry(): Address {
        if (!this.registryAddress) {
            throw new Error('Registry address is not configured for this client');
        }
        return this.registryAddress;
    }
}
