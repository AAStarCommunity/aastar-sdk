import { type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account } from 'viem';
import { PaymasterV4ABI } from '../abis/index.js';

// PaymasterV4 Actions (Deposit-Only Model v4.3.0)
export type PaymasterV4Actions = {
    // === NEW: Deposit-Only Model ===
    // Deposit Management
    depositFor: (args: { user: Address, token: Address, amount: bigint, account?: Account | Address }) => Promise<Hash>;
    withdraw: (args: { token: Address, amount: bigint, account?: Account | Address }) => Promise<Hash>;
    balances: (args: { user: Address, token: Address }) => Promise<bigint>;
    
    // Token Price Management (Operator/Owner only)
    setTokenPrice: (args: { token: Address, price: bigint, account?: Account | Address }) => Promise<Hash>;
    tokenPrices: (args: { token: Address }) => Promise<bigint>;
    
    // === DEPRECATED: Legacy V3 APIs (Not in V4 Deposit-Only) ===
    /** @deprecated V4 uses depositFor + tokenPrices instead */
    addGasToken: (args: { token: Address, priceFeed: Address, account?: Account | Address }) => Promise<Hash>;
    /** @deprecated V4 uses depositFor + tokenPrices instead */
    removeGasToken: (args: { token: Address, account?: Account | Address }) => Promise<Hash>;
    /** @deprecated V4 uses depositFor + tokenPrices instead */
    getSupportedGasTokens: () => Promise<Address[]>;
    /** @deprecated V4 uses depositFor + tokenPrices instead */
    isGasTokenSupported: (args: { token: Address }) => Promise<boolean>;
    /** @deprecated V4 does not use SBT whitelist */
    addSBT: (args: { sbt: Address, account?: Account | Address }) => Promise<Hash>;
    /** @deprecated V4 does not use SBT whitelist */
    removeSBT: (args: { sbt: Address, account?: Account | Address }) => Promise<Hash>;
    /** @deprecated V4 does not use SBT whitelist */
    getSupportedSBTs: () => Promise<Address[]>;
    /** @deprecated V4 does not use SBT whitelist */
    isSBTSupported: (args: { sbt: Address }) => Promise<boolean>;
    
    // Validation (EntryPoint calls)
    validatePaymasterUserOp: (args: { userOp: any, userOpHash: Hex, maxCost: bigint }) => Promise<any>;
    postOp: (args: { mode: number, context: Hex, actualGasCost: bigint, actualUserOpFeePerGas: bigint }) => Promise<void>;
    
    // Deposit & Withdrawal (EntryPoint accounting)
    deposit: (args: { account?: Account | Address }) => Promise<Hash>;
    withdrawTo: (args: { to: Address, amount: bigint, account?: Account | Address }) => Promise<Hash>;
    addStake: (args: { unstakeDelaySec: bigint, amount: bigint, account?: Account | Address }) => Promise<Hash>;
    unlockPaymasterStake: (args: { account?: Account | Address }) => Promise<Hash>;
    withdrawStake: (args: { to: Address, account?: Account | Address }) => Promise<Hash>;
    getDeposit: () => Promise<bigint>;
    
    // EntryPoint
    entryPoint: () => Promise<Address>;
    
    // Ownership
    owner: () => Promise<Address>;
    transferPaymasterV4Ownership: (args: { newOwner: Address, account?: Account | Address }) => Promise<Hash>;
    transferOwnership: (args: { newOwner: Address, account?: Account | Address }) => Promise<Hash>; // Alias
    renounceOwnership: (args: { account?: Account | Address }) => Promise<Hash>;
    
    // View Functions & Constants
    registry: () => Promise<Address>;
    treasury: () => Promise<Address>;
    paused: () => Promise<boolean>;
    maxGasCostCap: () => Promise<bigint>;
    MAX_ETH_USD_PRICE: () => Promise<bigint>;
    MAX_GAS_TOKENS: () => Promise<bigint>;
    MAX_SBTS: () => Promise<bigint>;
    MAX_SERVICE_FEE: () => Promise<bigint>;
    MIN_ETH_USD_PRICE: () => Promise<bigint>;
    priceStalenessThreshold: () => Promise<bigint>;
    
    // Aliases
    addDeposit: (args: { account?: Account | Address }) => Promise<Hash>; // Alias for deposit
    unlockStake: (args: { account?: Account | Address }) => Promise<Hash>; // Alias for unlockPaymasterStake
    
    // View Functions & Constants (Missing)
    ethUsdPriceFeed: () => Promise<Address>;
    oracleDecimals: () => Promise<number>;
    tokenDecimals: (args: { token: Address }) => Promise<number>;
    serviceFeeRate: () => Promise<bigint>;
    calculateCost: (args: { token: Address, gasCost: bigint, param: any }) => Promise<bigint>;
    getRealtimeTokenCost: (args: { token: Address, gasCost: bigint }) => Promise<bigint>;
    isActiveInRegistry: () => Promise<boolean>;
    isRegistrySet: () => Promise<boolean>;
    cachedPrice: (args: { token: Address }) => Promise<bigint>;
    
    // Admin (Missing)
    setCachedPrice: (args: { token: Address, price: bigint, account?: Account | Address }) => Promise<Hash>;
    setServiceFeeRate: (args: { rate: bigint, account?: Account | Address }) => Promise<Hash>;
    setMaxGasCostCap: (args: { cap: bigint, account?: Account | Address }) => Promise<Hash>;
    setPriceStalenessThreshold: (args: { threshold: bigint, account?: Account | Address }) => Promise<Hash>;
    setTreasury: (args: { treasury: Address, account?: Account | Address }) => Promise<Hash>;
    updatePrice: (args: { token: Address, account?: Account | Address }) => Promise<Hash>;
    deactivateFromRegistry: (args: { account?: Account | Address }) => Promise<Hash>;
    initialize: (args: { owner: Address, account?: Account | Address }) => Promise<Hash>;
    
    version: () => Promise<string>;
};

export const paymasterV4Actions = (address: Address) => (client: PublicClient | WalletClient): PaymasterV4Actions => ({
    // === NEW: Deposit-Only Model ===
    async depositFor({ user, token, amount, account }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterV4ABI,
            functionName: 'depositFor',
            args: [user, token, amount],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async withdraw({ token, amount, account }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterV4ABI,
            functionName: 'withdraw',
            args: [token, amount],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async balances({ user, token }) {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterV4ABI,
            functionName: 'balances',
            args: [user, token]
        }) as Promise<bigint>;
    },

    async setTokenPrice({ token, price, account }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterV4ABI,
            functionName: 'setTokenPrice',
            args: [token, price],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async tokenPrices({ token }) {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterV4ABI,
            functionName: 'tokenPrices',
            args: [token]
        }) as Promise<bigint>;
    },

    // === DEPRECATED: Legacy Gas Token Management ===
    async addGasToken({ token, priceFeed, account }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterV4ABI,
            functionName: 'addGasToken',
            args: [token, priceFeed],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async removeGasToken({ token, account }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterV4ABI,
            functionName: 'removeGasToken',
            args: [token],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async getSupportedGasTokens() {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterV4ABI,
            functionName: 'getSupportedGasTokens',
            args: []
        }) as Promise<Address[]>;
    },

    async isGasTokenSupported({ token }) {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterV4ABI,
            functionName: 'isGasTokenSupported',
            args: [token]
        }) as Promise<boolean>;
    },

    // SBT Management
    async addSBT({ sbt, account }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterV4ABI,
            functionName: 'addSBT',
            args: [sbt],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async removeSBT({ sbt, account }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterV4ABI,
            functionName: 'removeSBT',
            args: [sbt],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async getSupportedSBTs() {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterV4ABI,
            functionName: 'getSupportedSBTs',
            args: []
        }) as Promise<Address[]>;
    },

    async isSBTSupported({ sbt }) {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterV4ABI,
            functionName: 'isSBTSupported',
            args: [sbt]
        }) as Promise<boolean>;
    },

    // Validation
    async validatePaymasterUserOp({ userOp, userOpHash, maxCost }) {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterV4ABI,
            functionName: 'validatePaymasterUserOp',
            args: [userOp, userOpHash, maxCost]
        });
    },

    async postOp({ mode, context, actualGasCost, actualUserOpFeePerGas }) {
        throw new Error('postOp is called by EntryPoint, not directly invoked');
    },

    // Deposit & Withdrawal
    async deposit({ account }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterV4ABI,
            functionName: 'deposit',
            args: [],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async withdrawTo({ to, amount, account }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterV4ABI,
            functionName: 'withdrawTo',
            args: [to, amount],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async addStake({ unstakeDelaySec, amount, account }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterV4ABI,
            functionName: 'addStake',
            args: [unstakeDelaySec],
            value: amount,
            account: account as any,
            chain: (client as any).chain
        });
    },

    async unlockPaymasterStake({ account }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterV4ABI,
            functionName: 'unlockStake',
            args: [],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async withdrawStake({ to, account }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterV4ABI,
            functionName: 'withdrawStake',
            args: [to],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async getDeposit() {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterV4ABI,
            functionName: 'getDeposit',
            args: []
        }) as Promise<bigint>;
    },

    // EntryPoint
    async entryPoint() {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterV4ABI,
            functionName: 'entryPoint',
            args: []
        }) as Promise<Address>;
    },

    // Ownership
    async owner() {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterV4ABI,
            functionName: 'owner',
            args: []
        }) as Promise<Address>;
    },

    async transferPaymasterV4Ownership({ newOwner, account }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterV4ABI,
            functionName: 'transferOwnership',
            args: [newOwner],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async transferOwnership(args) {
        return this.transferPaymasterV4Ownership(args);
    },

    async renounceOwnership({ account }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterV4ABI,
            functionName: 'renounceOwnership',
            args: [],
            account: account as any,
            chain: (client as any).chain
        });
    },

    // View Functions & Constants
    async registry() {
        return (client as PublicClient).readContract({ address, abi: PaymasterV4ABI, functionName: 'registry', args: [] }) as Promise<Address>;
    },
    async treasury() {
        return (client as PublicClient).readContract({ address, abi: PaymasterV4ABI, functionName: 'treasury', args: [] }) as Promise<Address>;
    },
    async paused() {
        return (client as PublicClient).readContract({ address, abi: PaymasterV4ABI, functionName: 'paused', args: [] }) as Promise<boolean>;
    },
    async maxGasCostCap() {
        return (client as PublicClient).readContract({ address, abi: PaymasterV4ABI, functionName: 'maxGasCostCap', args: [] }) as Promise<bigint>;
    },
    async MAX_ETH_USD_PRICE() {
        return (client as PublicClient).readContract({ address, abi: PaymasterV4ABI, functionName: 'MAX_ETH_USD_PRICE', args: [] }) as Promise<bigint>;
    },
    async MAX_GAS_TOKENS() {
        return (client as PublicClient).readContract({ address, abi: PaymasterV4ABI, functionName: 'MAX_GAS_TOKENS', args: [] }) as Promise<bigint>;
    },
    async MAX_SBTS() {
        return (client as PublicClient).readContract({ address, abi: PaymasterV4ABI, functionName: 'MAX_SBTS', args: [] }) as Promise<bigint>;
    },
    async MAX_SERVICE_FEE() {
        return (client as PublicClient).readContract({ address, abi: PaymasterV4ABI, functionName: 'MAX_SERVICE_FEE', args: [] }) as Promise<bigint>;
    },
    async MIN_ETH_USD_PRICE() {
        return (client as PublicClient).readContract({ address, abi: PaymasterV4ABI, functionName: 'MIN_ETH_USD_PRICE', args: [] }) as Promise<bigint>;
    },
    async priceStalenessThreshold() {
        return (client as PublicClient).readContract({ address, abi: PaymasterV4ABI, functionName: 'priceStalenessThreshold', args: [] }) as Promise<bigint>;
    },

    // Aliases
    async addDeposit(args) {
        return this.deposit(args);
    },
    async unlockStake(args) {
        return this.unlockPaymasterStake(args);
    },

    // View Functions & Constants (Missing)
    async ethUsdPriceFeed() {
        return (client as PublicClient).readContract({ address, abi: PaymasterV4ABI, functionName: 'ethUsdPriceFeed', args: [] }) as Promise<Address>;
    },
    async oracleDecimals() {
        return (client as PublicClient).readContract({ address, abi: PaymasterV4ABI, functionName: 'oracleDecimals', args: [] }) as Promise<number>;
    },
    async tokenDecimals({ token }) {
        return (client as PublicClient).readContract({ address, abi: PaymasterV4ABI, functionName: 'tokenDecimals', args: [token] }) as Promise<number>;
    },
    async serviceFeeRate() {
        return (client as PublicClient).readContract({ address, abi: PaymasterV4ABI, functionName: 'serviceFeeRate', args: [] }) as Promise<bigint>;
    },
    async calculateCost({ token, gasCost, param }) {
        return (client as PublicClient).readContract({ address, abi: PaymasterV4ABI, functionName: 'calculateCost', args: [token, gasCost, param] }) as Promise<bigint>;
    },
    async getRealtimeTokenCost({ token, gasCost }) {
         return (client as PublicClient).readContract({ address, abi: PaymasterV4ABI, functionName: 'getRealtimeTokenCost', args: [token, gasCost] }) as Promise<bigint>;
    },
    async isActiveInRegistry() {
         return (client as PublicClient).readContract({ address, abi: PaymasterV4ABI, functionName: 'isActiveInRegistry', args: [] }) as Promise<boolean>;
    },
    async isRegistrySet() {
         return (client as PublicClient).readContract({ address, abi: PaymasterV4ABI, functionName: 'isRegistrySet', args: [] }) as Promise<boolean>;
    },
    async cachedPrice({ token }) {
         return (client as PublicClient).readContract({ address, abi: PaymasterV4ABI, functionName: 'cachedPrice', args: [token] }) as Promise<bigint>;
    },

    // Admin (Missing)
    async setCachedPrice({ token, price, account }) {
         return (client as any).writeContract({ address, abi: PaymasterV4ABI, functionName: 'setCachedPrice', args: [token, price], account: account as any, chain: (client as any).chain });
    },
    async setServiceFeeRate({ rate, account }) {
         return (client as any).writeContract({ address, abi: PaymasterV4ABI, functionName: 'setServiceFeeRate', args: [rate], account: account as any, chain: (client as any).chain });
    },
    async setMaxGasCostCap({ cap, account }) {
         return (client as any).writeContract({ address, abi: PaymasterV4ABI, functionName: 'setMaxGasCostCap', args: [cap], account: account as any, chain: (client as any).chain });
    },
    async setPriceStalenessThreshold({ threshold, account }) {
         return (client as any).writeContract({ address, abi: PaymasterV4ABI, functionName: 'setPriceStalenessThreshold', args: [threshold], account: account as any, chain: (client as any).chain });
    },
    async setTreasury({ treasury, account }) {
         return (client as any).writeContract({ address, abi: PaymasterV4ABI, functionName: 'setTreasury', args: [treasury], account: account as any, chain: (client as any).chain });
    },
    async updatePrice({ token, account }) {
         return (client as any).writeContract({ address, abi: PaymasterV4ABI, functionName: 'updatePrice', args: [token], account: account as any, chain: (client as any).chain });
    },
    async deactivateFromRegistry({ account }) {
         return (client as any).writeContract({ address, abi: PaymasterV4ABI, functionName: 'deactivateFromRegistry', args: [], account: account as any, chain: (client as any).chain });
    },
    async initialize({ owner, account }) {
         return (client as any).writeContract({ address, abi: PaymasterV4ABI, functionName: 'initialize', args: [owner], account: account as any, chain: (client as any).chain });
    },

    async version() {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterV4ABI,
            functionName: 'version',
            args: []
        }) as Promise<string>;
    }
});
