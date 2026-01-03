import { type Address, type PublicClient, type WalletClient, type Chain, type Transport, type Account } from 'viem';

/**
 * Base configuration for all L2 Business Clients
 */
export interface ClientConfig {
    /**
     * Viem WalletClient for write operations.
     * Must have an account attached.
     */
    client: WalletClient<Transport, Chain, Account>;
    
    /**
     * Optional PublicClient for read operations.
     * If not provided, one will be derived from the WalletClient or created internally if possible (but usually explicit is better).
     * Currently L1 actions use PublicClient | WalletClient, so WalletClient is enough for both if it has a provider.
     * However, explicitly accepting PublicClient encourages separation.
     */
    publicClient?: PublicClient;

    /**
     * Registry contract address.
     * Essential for looking up other contracts if not provided explicitly.
     */
    registryAddress?: Address;

    /**
     * GToken contract address.
     * Required for operations involving token approvals and transfers.
     */
    gTokenAddress?: Address;

    /**
     * GTokenStaking contract address.
     * Required for role registration that involves staking.
     */
    gTokenStakingAddress?: Address;
}

/**
 * Common options for transaction methods
 */
export interface TransactionOptions {
    /**
     * Override the account to use for the transaction.
     * If not provided, uses the account from the WalletClient.
     */
    account?: Account | Address;
    
    /**
     * Optional value to send with the transaction (in wei)
     */
    value?: bigint;
}

/**
 * Generic result wrapper for business operations
 * Currently just returns the type directly, but can be expanded for metadata.
 */
export type BusinessResult<T> = Promise<T>;
