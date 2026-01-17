import { type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account } from 'viem';
import { PaymasterABI } from '../abis/index.js';

// Paymaster Actions (Official SuperPaymaster Paymaster Contract)
export type PaymasterActions = {
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
    
    // Initialization & Configuration
    initialize: (args: { _entryPoint: Address, _owner: Address, _treasury: Address, _ethUsdPriceFeed: Address, _serviceFeeRate: bigint, _maxGasCostCap: bigint, _priceStalenessThreshold: bigint, account?: Account | Address }) => Promise<Hash>;
    setTreasury: (args: { _treasury: Address, account?: Account | Address }) => Promise<Hash>;
    setServiceFeeRate: (args: { _serviceFeeRate: bigint, account?: Account | Address }) => Promise<Hash>;
    setMaxGasCostCap: (args: { _maxGasCostCap: bigint, account?: Account | Address }) => Promise<Hash>;
    setPriceStalenessThreshold: (args: { _priceStalenessThreshold: bigint, account?: Account | Address }) => Promise<Hash>;
    
    // Pause/Unpause
    pause: (args: { account?: Account | Address }) => Promise<Hash>;
    unpause: (args: { account?: Account | Address }) => Promise<Hash>;
    paused: () => Promise<boolean>;
    
    // Price Management
    cachedPrice: () => Promise<{ price: bigint, timestamp: number }>;
    updatePrice: (args: { account?: Account | Address }) => Promise<Hash>;
    getRealtimeTokenCost: (args: { gasCost: bigint, token: Address }) => Promise<bigint>;
    calculateCost: (args: { gasCost: bigint, token: Address, useRealtime: boolean }) => Promise<bigint>;
    
    // Registry Integration
    isActiveInRegistry: () => Promise<boolean>;
    isRegistrySet: () => Promise<boolean>;
    deactivateFromRegistry: (args: { account?: Account | Address }) => Promise<Hash>;
    registry: () => Promise<Address>;
    
    // Configuration Getters
    ethUsdPriceFeed: () => Promise<Address>;
    serviceFeeRate: () => Promise<bigint>;
    maxGasCostCap: () => Promise<bigint>;
    priceStalenessThreshold: () => Promise<bigint>;
    treasury: () => Promise<Address>;
    oracleDecimals: () => Promise<number>;
    tokenDecimals: (args: { token: Address }) => Promise<number>;
    
    // Constants
    MAX_ETH_USD_PRICE: () => Promise<bigint>;
    MIN_ETH_USD_PRICE: () => Promise<bigint>;
    MAX_GAS_TOKENS: () => Promise<bigint>;
    MAX_SBTS: () => Promise<bigint>;
    MAX_SERVICE_FEE: () => Promise<bigint>;
    
    // Deposit & Withdrawal (EntryPoint accounting)
    deposit: (args: { account?: Account | Address }) => Promise<Hash>;
    withdrawTo: (args: { to: Address, amount: bigint, account?: Account | Address }) => Promise<Hash>;
    addStake: (args: { unstakeDelaySec: bigint, account?: Account | Address }) => Promise<Hash>;
    unlockPaymasterStake: (args: { account?: Account | Address }) => Promise<Hash>;
    withdrawStake: (args: { to: Address, account?: Account | Address }) => Promise<Hash>;
    getDeposit: () => Promise<bigint>;
    
    // EntryPoint
    entryPoint: () => Promise<Address>;
    
    // Ownership
    owner: () => Promise<Address>;
    transferOwnership: (args: { newOwner: Address, account?: Account | Address }) => Promise<Hash>;
    renounceOwnership: (args: { account?: Account | Address }) => Promise<Hash>;
    version: () => Promise<string>;
};

export const paymasterActions = (address: Address) => (client: PublicClient | WalletClient): PaymasterActions => ({
    // === NEW: Deposit-Only Model ===
    async depositFor({ user, token, amount, account }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterABI,
            functionName: 'depositFor',
            args: [user, token, amount],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async withdraw({ token, amount, account }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterABI,
            functionName: 'withdraw',
            args: [token, amount],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async balances({ user, token }) {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterABI,
            functionName: 'balances',
            args: [user, token]
        }) as Promise<bigint>;
    },

    async setTokenPrice({ token, price, account }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterABI,
            functionName: 'setTokenPrice',
            args: [token, price],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async tokenPrices({ token }) {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterABI,
            functionName: 'tokenPrices',
            args: [token]
        }) as Promise<bigint>;
    },

    // === DEPRECATED: Legacy Gas Token Management ===
    async addGasToken({ token, priceFeed, account }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterABI,
            functionName: 'addGasToken',
            args: [token, priceFeed],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async removeGasToken({ token, account }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterABI,
            functionName: 'removeGasToken',
            args: [token],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async getSupportedGasTokens() {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterABI,
            functionName: 'getSupportedGasTokens',
            args: []
        }) as Promise<Address[]>;
    },

    async isGasTokenSupported({ token }) {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterABI,
            functionName: 'isGasTokenSupported',
            args: [token]
        }) as Promise<boolean>;
    },

    // SBT Management
    async addSBT({ sbt, account }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterABI,
            functionName: 'addSBT',
            args: [sbt],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async removeSBT({ sbt, account }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterABI,
            functionName: 'removeSBT',
            args: [sbt],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async getSupportedSBTs() {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterABI,
            functionName: 'getSupportedSBTs',
            args: []
        }) as Promise<Address[]>;
    },

    async isSBTSupported({ sbt }) {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterABI,
            functionName: 'isSBTSupported',
            args: [sbt]
        }) as Promise<boolean>;
    },

    // Validation
    async validatePaymasterUserOp({ userOp, userOpHash, maxCost }) {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterABI,
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
            abi: PaymasterABI,
            functionName: 'deposit',
            args: [],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async withdrawTo({ to, amount, account }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterABI,
            functionName: 'withdrawTo',
            args: [to, amount],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async addStake({ unstakeDelaySec, account }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterABI,
            functionName: 'addStake',
            args: [unstakeDelaySec],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async unlockPaymasterStake({ account }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterABI,
            functionName: 'unlockStake',
            args: [],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async withdrawStake({ to, account }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterABI,
            functionName: 'withdrawStake',
            args: [to],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async getDeposit() {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterABI,
            functionName: 'getDeposit',
            args: []
        }) as Promise<bigint>;
    },

    // EntryPoint
    async entryPoint() {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterABI,
            functionName: 'entryPoint',
            args: []
        }) as Promise<Address>;
    },

    // Ownership
    async owner() {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterABI,
            functionName: 'owner',
            args: []
        }) as Promise<Address>;
    },

    async transferOwnership({ newOwner, account }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterABI,
            functionName: 'transferOwnership',
            args: [newOwner],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async renounceOwnership({ account }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterABI,
            functionName: 'renounceOwnership',
            args: [],
            account: account as any,
            chain: (client as any).chain
        });
    },

    // Initialization & Configuration
    async initialize({ _entryPoint, _owner, _treasury, _ethUsdPriceFeed, _serviceFeeRate, _maxGasCostCap, _priceStalenessThreshold, account }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterABI,
            functionName: 'initialize',
            args: [_entryPoint, _owner, _treasury, _ethUsdPriceFeed, _serviceFeeRate, _maxGasCostCap, _priceStalenessThreshold],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async setTreasury({ _treasury, account }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterABI,
            functionName: 'setTreasury',
            args: [_treasury],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async setServiceFeeRate({ _serviceFeeRate, account }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterABI,
            functionName: 'setServiceFeeRate',
            args: [_serviceFeeRate],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async setMaxGasCostCap({ _maxGasCostCap, account }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterABI,
            functionName: 'setMaxGasCostCap',
            args: [_maxGasCostCap],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async setPriceStalenessThreshold({ _priceStalenessThreshold, account }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterABI,
            functionName: 'setPriceStalenessThreshold',
            args: [_priceStalenessThreshold],
            account: account as any,
            chain: (client as any).chain
        });
    },

    // Pause/Unpause
    async pause({ account }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterABI,
            functionName: 'pause',
            args: [],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async unpause({ account }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterABI,
            functionName: 'unpause',
            args: [],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async paused() {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterABI,
            functionName: 'paused',
            args: []
        }) as Promise<boolean>;
    },

    // Price Management
    async cachedPrice() {
        const result = await (client as PublicClient).readContract({
            address,
            abi: PaymasterABI,
            functionName: 'cachedPrice',
            args: []
        }) as any;
        return { price: result[0], timestamp: Number(result[1]) };
    },

    async updatePrice({ account }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterABI,
            functionName: 'updatePrice',
            args: [],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async getRealtimeTokenCost({ gasCost, token }) {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterABI,
            functionName: 'getRealtimeTokenCost',
            args: [gasCost, token]
        }) as Promise<bigint>;
    },

    async calculateCost({ gasCost, token, useRealtime }) {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterABI,
            functionName: 'calculateCost',
            args: [gasCost, token, useRealtime]
        }) as Promise<bigint>;
    },

    // Registry Integration
    async isActiveInRegistry() {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterABI,
            functionName: 'isActiveInRegistry',
            args: []
        }) as Promise<boolean>;
    },

    async isRegistrySet() {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterABI,
            functionName: 'isRegistrySet',
            args: []
        }) as Promise<boolean>;
    },

    async deactivateFromRegistry({ account }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterABI,
            functionName: 'deactivateFromRegistry',
            args: [],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async registry() {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterABI,
            functionName: 'registry',
            args: []
        }) as Promise<Address>;
    },

    // Configuration Getters
    async ethUsdPriceFeed() {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterABI,
            functionName: 'ethUsdPriceFeed',
            args: []
        }) as Promise<Address>;
    },

    async serviceFeeRate() {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterABI,
            functionName: 'serviceFeeRate',
            args: []
        }) as Promise<bigint>;
    },

    async maxGasCostCap() {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterABI,
            functionName: 'maxGasCostCap',
            args: []
        }) as Promise<bigint>;
    },

    async priceStalenessThreshold() {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterABI,
            functionName: 'priceStalenessThreshold',
            args: []
        }) as Promise<bigint>;
    },

    async treasury() {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterABI,
            functionName: 'treasury',
            args: []
        }) as Promise<Address>;
    },

    async oracleDecimals() {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterABI,
            functionName: 'oracleDecimals',
            args: []
        }) as Promise<number>;
    },

    async tokenDecimals({ token }) {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterABI,
            functionName: 'tokenDecimals',
            args: [token]
        }) as Promise<number>;
    },

    // Constants
    async MAX_ETH_USD_PRICE() {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterABI,
            functionName: 'MAX_ETH_USD_PRICE',
            args: []
        }) as Promise<bigint>;
    },

    async MIN_ETH_USD_PRICE() {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterABI,
            functionName: 'MIN_ETH_USD_PRICE',
            args: []
        }) as Promise<bigint>;
    },

    async MAX_GAS_TOKENS() {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterABI,
            functionName: 'MAX_GAS_TOKENS',
            args: []
        }) as Promise<bigint>;
    },

    async MAX_SBTS() {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterABI,
            functionName: 'MAX_SBTS',
            args: []
        }) as Promise<bigint>;
    },

    async MAX_SERVICE_FEE() {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterABI,
            functionName: 'MAX_SERVICE_FEE',
            args: []
        }) as Promise<bigint>;
    },

    async version() {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterABI,
            functionName: 'version',
            args: []
        }) as Promise<string>;
    }
});
