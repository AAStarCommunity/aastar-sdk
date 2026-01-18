import { type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account } from 'viem';
import { PaymasterABI } from '../abis/index.js';
import { validateAddress, validateAmount, validatePositive, validateRequired } from '../validators/index.js';
import { AAStarError } from '../errors/index.js';

export type PaymasterActions = {
    // Deposit Management
    depositFor: (args: { user: Address, token: Address, amount: bigint, account?: Account | Address }) => Promise<Hash>;
    withdraw: (args: { token: Address, amount: bigint, account?: Account | Address }) => Promise<Hash>;
    balances: (args: { user: Address, token: Address }) => Promise<bigint>;
    
    // Token Price Management (Operator/Owner only)
    setTokenPrice: (args: { token: Address, price: bigint, account?: Account | Address }) => Promise<Hash>;
    setCachedPrice: (args: { price: bigint, timestamp: number, account?: Account | Address }) => Promise<Hash>;
    tokenPrices: (args: { token: Address }) => Promise<bigint>;
    
    // Validation (EntryPoint calls)
    validatePaymasterUserOp: (args: { userOp: any, userOpHash: Hex, maxCost: bigint }) => Promise<{ context: Hex, validationData: bigint }>;
    postOp: (args: { mode: number, context: Hex, actualGasCost: bigint, actualUserOpFeePerGas: bigint, account?: Account | Address }) => Promise<Hash>;
    
    // Initialization & Configuration
    initialize: (args: { _entryPoint: Address, _owner: Address, _treasury: Address, _ethUsdPriceFeed: Address, _serviceFeeRate: bigint, _maxGasCostCap: bigint, _priceStalenessThreshold: bigint, account?: Account | Address }) => Promise<Hash>;
    setTreasury: (args: { treasury: Address, account?: Account | Address }) => Promise<Hash>;
    setServiceFeeRate: (args: { _serviceFeeRate: bigint, account?: Account | Address }) => Promise<Hash>;
    setMaxGasCostCap: (args: { _maxGasCostCap: bigint, account?: Account | Address }) => Promise<Hash>;
    setPriceStalenessThreshold: (args: { _priceStalenessThreshold: bigint, account?: Account | Address }) => Promise<Hash>;
    
    // Pause/Unpause
    pause: (args: { account?: Account | Address }) => Promise<Hash>;
    unpause: (args: { account?: Account | Address }) => Promise<Hash>;
    paused: () => Promise<boolean>;
    
    // Price Management
    cachedPrice: () => Promise<{ price: bigint, updatedAt: number }>;
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
    addDeposit: (args: { account?: Account | Address, value?: bigint }) => Promise<Hash>;
    withdrawTo: (args: { to: Address, amount: bigint, account?: Account | Address }) => Promise<Hash>;
    addStake: (args: { unstakeDelaySec: number, account?: Account | Address, value?: bigint }) => Promise<Hash>;
    unlockStake: (args: { account?: Account | Address }) => Promise<Hash>;
    withdrawStake: (args: { to: Address, account?: Account | Address }) => Promise<Hash>;
    
    // EntryPoint
    entryPoint: () => Promise<Address>;
    
    // Ownership
    owner: () => Promise<Address>;
    transferOwnership: (args: { newOwner: Address, account?: Account | Address }) => Promise<Hash>;
    renounceOwnership: (args: { account?: Account | Address }) => Promise<Hash>;
    version: () => Promise<string>;
};

export const paymasterActions = (address: Address) => (client: PublicClient | WalletClient): PaymasterActions => ({
    // Deposit Management
    async depositFor({ user, token, amount, account }) {
        try {
            validateAddress(user, 'user');
            validateAddress(token, 'token');
            validatePositive(amount, 'amount');
            return await (client as any).writeContract({
                address,
                abi: PaymasterABI,
                functionName: 'depositFor',
                args: [user, token, amount],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'depositFor');
        }
    },

    async withdraw({ token, amount, account }) {
        try {
            validateAddress(token, 'token');
            validateAmount(amount, 'amount');
            return await (client as any).writeContract({
                address,
                abi: PaymasterABI,
                functionName: 'withdraw',
                args: [token, amount],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'withdraw');
        }
    },

    async balances({ user, token }) {
        try {
            validateAddress(user, 'user');
            validateAddress(token, 'token');
            return await (client as PublicClient).readContract({
                address,
                abi: PaymasterABI,
                functionName: 'balances',
                args: [user, token]
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'balances');
        }
    },

    async setTokenPrice({ token, price, account }) {
        try {
            validateAddress(token, 'token');
            validateAmount(price, 'price');
            return await (client as any).writeContract({
                address,
                abi: PaymasterABI,
                functionName: 'setTokenPrice',
                args: [token, price],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setTokenPrice');
        }
    },

    async setCachedPrice({ price, timestamp, account }) {
        try {
            validatePositive(price, 'price');
            validatePositive(BigInt(timestamp), 'timestamp');
            return await (client as any).writeContract({
                address,
                abi: PaymasterABI,
                functionName: 'setCachedPrice',
                args: [price, timestamp],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setCachedPrice');
        }
    },

    async tokenPrices({ token }) {
        try {
            validateAddress(token, 'token');
            return await (client as PublicClient).readContract({
                address,
                abi: PaymasterABI,
                functionName: 'tokenPrices',
                args: [token]
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'tokenPrices');
        }
    },

    // Validation
    async validatePaymasterUserOp({ userOp, userOpHash, maxCost }) {
        try {
            validateRequired(userOp, 'userOp');
            validateRequired(userOpHash, 'userOpHash');
            validateAmount(maxCost, 'maxCost');
            const result = await (client as PublicClient).readContract({
                address,
                abi: PaymasterABI,
                functionName: 'validatePaymasterUserOp',
                args: [userOp, userOpHash, maxCost]
            }) as any;
            return { context: result[0], validationData: result[1] };
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'validatePaymasterUserOp');
        }
    },

    async postOp({ mode, context, actualGasCost, actualUserOpFeePerGas, account }) {
        try {
            validateRequired(mode, 'mode');
            validateRequired(context, 'context');
            validateAmount(actualGasCost, 'actualGasCost');
            validateAmount(actualUserOpFeePerGas, 'actualUserOpFeePerGas');
            return await (client as any).writeContract({
                address,
                abi: PaymasterABI,
                functionName: 'postOp',
                args: [mode, context, actualGasCost, actualUserOpFeePerGas],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'postOp');
        }
    },

    // Deposit & Withdrawal
    async addDeposit({ account, value }) {
        try {
            return await (client as any).writeContract({
                address,
                abi: PaymasterABI,
                functionName: 'addDeposit',
                args: [],
                account: account as any,
                chain: (client as any).chain,
                value
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'addDeposit');
        }
    },

    async withdrawTo({ to, amount, account }) {
        try {
            validateAddress(to, 'to');
            validatePositive(amount, 'amount');
            return await (client as any).writeContract({
                address,
                abi: PaymasterABI,
                functionName: 'withdrawTo',
                args: [to, amount],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'withdrawTo');
        }
    },

    async addStake({ unstakeDelaySec, account, value }) {
        try {
            validateRequired(unstakeDelaySec, 'unstakeDelaySec');
            return await (client as any).writeContract({
                address,
                abi: PaymasterABI,
                functionName: 'addStake',
                args: [unstakeDelaySec],
                account: account as any,
                chain: (client as any).chain,
                value
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'addStake');
        }
    },

    async unlockStake({ account }) {
        try {
            return await (client as any).writeContract({
                address,
                abi: PaymasterABI,
                functionName: 'unlockStake',
                args: [],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'unlockStake');
        }
    },

    async withdrawStake({ to, account }) {
        try {
            validateAddress(to, 'to');
            return await (client as any).writeContract({
                address,
                abi: PaymasterABI,
                functionName: 'withdrawStake',
                args: [to],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'withdrawStake');
        }
    },

    // EntryPoint
    async entryPoint() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: PaymasterABI,
                functionName: 'entryPoint',
                args: []
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'entryPoint');
        }
    },

    // Ownership
    async owner() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: PaymasterABI,
                functionName: 'owner',
                args: []
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'owner');
        }
    },

    async transferOwnership({ newOwner, account }) {
        try {
            validateAddress(newOwner, 'newOwner');
            return await (client as any).writeContract({
                address,
                abi: PaymasterABI,
                functionName: 'transferOwnership',
                args: [newOwner],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'transferOwnership');
        }
    },

    async renounceOwnership({ account }) {
        try {
            return await (client as any).writeContract({
                address,
                abi: PaymasterABI,
                functionName: 'renounceOwnership',
                args: [],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'renounceOwnership');
        }
    },

    // Initialization & Configuration
    async initialize({ _entryPoint, _owner, _treasury, _ethUsdPriceFeed, _serviceFeeRate, _maxGasCostCap, _priceStalenessThreshold, account }) {
        try {
            validateAddress(_entryPoint, 'entryPoint');
            validateAddress(_owner, 'owner');
            validateAddress(_treasury, 'treasury');
            validateAddress(_ethUsdPriceFeed, 'ethUsdPriceFeed');
            validateAmount(_serviceFeeRate, 'serviceFeeRate');
            validateAmount(_maxGasCostCap, 'maxGasCostCap');
            validateAmount(_priceStalenessThreshold, 'priceStalenessThreshold');
            return await (client as any).writeContract({
                address,
                abi: PaymasterABI,
                functionName: 'initialize',
                args: [_entryPoint, _owner, _treasury, _ethUsdPriceFeed, _serviceFeeRate, _maxGasCostCap, _priceStalenessThreshold],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'initialize');
        }
    },

    async setTreasury({ treasury, account }) {
        try {
            validateAddress(treasury, 'treasury');
            return await (client as any).writeContract({
                address,
                abi: PaymasterABI,
                functionName: 'setTreasury',
                args: [treasury],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setTreasury');
        }
    },

    async setServiceFeeRate({ _serviceFeeRate, account }) {
        try {
            validateAmount(_serviceFeeRate, 'serviceFeeRate');
            return await (client as any).writeContract({
                address,
                abi: PaymasterABI,
                functionName: 'setServiceFeeRate',
                args: [_serviceFeeRate],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setServiceFeeRate');
        }
    },

    async setMaxGasCostCap({ _maxGasCostCap, account }) {
        try {
            validateAmount(_maxGasCostCap, 'maxGasCostCap');
            return await (client as any).writeContract({
                address,
                abi: PaymasterABI,
                functionName: 'setMaxGasCostCap',
                args: [_maxGasCostCap],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setMaxGasCostCap');
        }
    },

    async setPriceStalenessThreshold({ _priceStalenessThreshold, account }) {
        try {
            validateAmount(_priceStalenessThreshold, 'priceStalenessThreshold');
            return await (client as any).writeContract({
                address,
                abi: PaymasterABI,
                functionName: 'setPriceStalenessThreshold',
                args: [_priceStalenessThreshold],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setPriceStalenessThreshold');
        }
    },

    // Pause/Unpause
    async pause({ account }) {
        try {
            return await (client as any).writeContract({
                address,
                abi: PaymasterABI,
                functionName: 'pause',
                args: [],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'pause');
        }
    },

    async unpause({ account }) {
        try {
            return await (client as any).writeContract({
                address,
                abi: PaymasterABI,
                functionName: 'unpause',
                args: [],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'unpause');
        }
    },

    async paused() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: PaymasterABI,
                functionName: 'paused',
                args: []
            }) as Promise<boolean>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'paused');
        }
    },

    // Price Management
    async cachedPrice() {
        try {
            const result = await (client as PublicClient).readContract({
                address,
                abi: PaymasterABI,
                functionName: 'cachedPrice',
                args: []
            }) as any;
            
            if (Array.isArray(result)) {
                return { price: result[0], updatedAt: Number(result[1]) };
            }
            return { 
                price: result.price, 
                updatedAt: Number(result.updatedAt) 
            };
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'cachedPrice');
        }
    },

    async updatePrice({ account }) {
        try {
            return await (client as any).writeContract({
                address,
                abi: PaymasterABI,
                functionName: 'updatePrice',
                args: [],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'updatePrice');
        }
    },

    async getRealtimeTokenCost({ gasCost, token }) {
        try {
            validateAmount(gasCost, 'gasCost');
            validateAddress(token, 'token');
            return await (client as PublicClient).readContract({
                address,
                abi: PaymasterABI,
                functionName: 'getRealtimeTokenCost',
                args: [gasCost, token]
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getRealtimeTokenCost');
        }
    },

    async calculateCost({ gasCost, token, useRealtime }) {
        try {
            validateAmount(gasCost, 'gasCost');
            validateAddress(token, 'token');
            return await (client as PublicClient).readContract({
                address,
                abi: PaymasterABI,
                functionName: 'calculateCost',
                args: [gasCost, token, useRealtime]
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'calculateCost');
        }
    },

    // Registry Integration
    async isActiveInRegistry() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: PaymasterABI,
                functionName: 'isActiveInRegistry',
                args: []
            }) as Promise<boolean>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'isActiveInRegistry');
        }
    },

    async isRegistrySet() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: PaymasterABI,
                functionName: 'isRegistrySet',
                args: []
            }) as Promise<boolean>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'isRegistrySet');
        }
    },

    async deactivateFromRegistry({ account }) {
        try {
            return await (client as any).writeContract({
                address,
                abi: PaymasterABI,
                functionName: 'deactivateFromRegistry',
                args: [],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'deactivateFromRegistry');
        }
    },

    async registry() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: PaymasterABI,
                functionName: 'registry',
                args: []
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'registry');
        }
    },

    // Configuration Getters
    async ethUsdPriceFeed() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: PaymasterABI,
                functionName: 'ethUsdPriceFeed',
                args: []
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'ethUsdPriceFeed');
        }
    },

    async serviceFeeRate() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: PaymasterABI,
                functionName: 'serviceFeeRate',
                args: []
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'serviceFeeRate');
        }
    },

    async maxGasCostCap() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: PaymasterABI,
                functionName: 'maxGasCostCap',
                args: []
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'maxGasCostCap');
        }
    },

    async priceStalenessThreshold() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: PaymasterABI,
                functionName: 'priceStalenessThreshold',
                args: []
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'priceStalenessThreshold');
        }
    },

    async treasury() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: PaymasterABI,
                functionName: 'treasury',
                args: []
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'treasury');
        }
    },

    async oracleDecimals() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: PaymasterABI,
                functionName: 'oracleDecimals',
                args: []
            }) as Promise<number>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'oracleDecimals');
        }
    },

    async tokenDecimals({ token }) {
        try {
            validateAddress(token, 'token');
            return await (client as PublicClient).readContract({
                address,
                abi: PaymasterABI,
                functionName: 'tokenDecimals',
                args: [token]
            }) as Promise<number>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'tokenDecimals');
        }
    },

    // Constants
    async MAX_ETH_USD_PRICE() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: PaymasterABI,
                functionName: 'MAX_ETH_USD_PRICE',
                args: []
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'MAX_ETH_USD_PRICE');
        }
    },

    async MIN_ETH_USD_PRICE() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: PaymasterABI,
                functionName: 'MIN_ETH_USD_PRICE',
                args: []
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'MIN_ETH_USD_PRICE');
        }
    },

    async MAX_GAS_TOKENS() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: PaymasterABI,
                functionName: 'MAX_GAS_TOKENS',
                args: []
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'MAX_GAS_TOKENS');
        }
    },

    async MAX_SBTS() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: PaymasterABI,
                functionName: 'MAX_SBTS',
                args: []
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'MAX_SBTS');
        }
    },

    async MAX_SERVICE_FEE() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: PaymasterABI,
                functionName: 'MAX_SERVICE_FEE',
                args: []
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'MAX_SERVICE_FEE');
        }
    },

    async version() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: PaymasterABI,
                functionName: 'version',
                args: []
            }) as Promise<string>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'version');
        }
    }
});
