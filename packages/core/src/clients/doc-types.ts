import { type PublicClient as ViemPublicClient, type WalletClient as ViemWalletClient, type Transport, type Chain, type Account } from 'viem';

/**
 * Public Client Interface
 * Standardized interface for reading from the blockchain.
 */
export interface PublicClient extends ViemPublicClient {}

/**
 * Wallet Client Interface
 * Standardized interface for interacting with Ethereum wallets and accounts.
 */
export interface WalletClient<
    TTransport extends Transport = Transport,
    TChain extends Chain | undefined = Chain | undefined,
    TAccount extends Account | undefined = Account | undefined
> extends ViemWalletClient<TTransport, TChain, TAccount> {}
