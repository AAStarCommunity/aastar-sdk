import { type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account } from 'viem';
import { SuperPaymasterABI } from '../abis/index.js';
import { validateAddress, validateRequired, validateAmount } from '../validators/index.js';
import { AAStarError } from '../errors/index.js';

export type SlashRecord = {
    timestamp: bigint;
    amount: bigint;
    reputationLoss: bigint;
    reason: string;
    level: number;
};

export type OperatorConfig = {
    aPNTsBalance: bigint;
    exchangeRate: bigint;
    isConfigured: boolean;
    isPaused: boolean;
    xPNTsToken: Address;
    reputation: number;
    minTxInterval: number;
    treasury: Address;
    totalSpent: bigint;
    totalTxSponsored: bigint;
};

export type SuperPaymasterActions = {
    // Deposit & Withdrawal (aPNTs / ETH)
    deposit: (args: { amount: bigint, account?: Account | Address }) => Promise<Hash>;
    depositETH: (args: { value: bigint, account?: Account | Address }) => Promise<Hash>;
    depositFor: (args: { targetOperator: Address, amount: bigint, account?: Account | Address }) => Promise<Hash>;
    withdrawTo: (args: { to: Address, amount: bigint, account?: Account | Address }) => Promise<Hash>;
    withdraw: (args: { amount: bigint, account?: Account | Address }) => Promise<Hash>;
    
    // Staking (for SuperPaymaster role)
    addStake: (args: { unstakeDelaySec: number, value: bigint, account?: Account | Address }) => Promise<Hash>;
    unlockStake: (args: { account?: Account | Address }) => Promise<Hash>;
    withdrawStake: (args: { to: Address, account?: Account | Address }) => Promise<Hash>;
    
    // Operator Management
    configureOperator: (args: { xPNTsToken: Address, opTreasury: Address, exchangeRate: bigint, account?: Account | Address }) => Promise<Hash>;
    setOperatorPaused: (args: { operator: Address, paused: boolean, account?: Account | Address }) => Promise<Hash>;
    setOperatorLimits: (args: { minTxInterval: number, account?: Account | Address }) => Promise<Hash>;
    updateReputation: (args: { operator: Address, newScore: bigint, account?: Account | Address }) => Promise<Hash>;
    executeSlashWithBLS: (args: { operator: Address, level: number, proof: Hex, account?: Account | Address }) => Promise<Hash>;
    slashOperator: (args: { operator: Address, level: number, penaltyAmount: bigint, reason: string, account?: Account | Address }) => Promise<Hash>;
    
    // User & SBT Management
    updateBlockedStatus: (args: { operator: Address, users: Address[], statuses: boolean[], account?: Account | Address }) => Promise<Hash>;
    updateSBTStatus: (args: { user: Address, status: boolean, account?: Account | Address }) => Promise<Hash>;
    
    // Price Management
    setAPNTSPrice: (args: { newPrice: bigint, account?: Account | Address }) => Promise<Hash>;
    updatePrice: (args: { account?: Account | Address }) => Promise<Hash>;
    updatePriceDVT: (args: { price: bigint, updatedAt: bigint, proof: Hex, account?: Account | Address }) => Promise<Hash>;
    
    // Global Config
    setProtocolFee: (args: { newFeeBPS: bigint, account?: Account | Address }) => Promise<Hash>;
    setTreasury: (args: { treasury: Address, account?: Account | Address }) => Promise<Hash>;
    setXPNTsFactory: (args: { factory: Address, account?: Account | Address }) => Promise<Hash>;
    setAPNTsToken: (args: { token: Address, account?: Account | Address }) => Promise<Hash>;
    setBLSAggregator: (args: { aggregator: Address, account?: Account | Address }) => Promise<Hash>;
    withdrawProtocolRevenue: (args: { to: Address, amount: bigint, account?: Account | Address }) => Promise<Hash>;
    
    // Callbacks
    onTransferReceived: (args: { operator: Address, from: Address, value: bigint, data: Hex }) => Promise<Hex>;
    
    // Validation
    validatePaymasterUserOp: (args: { userOp: any, userOpHash: Hex, maxCost: bigint }) => Promise<{ context: Hex, validationData: bigint }>;
    
    // View Functions
    operators: (args: { id: Address }) => Promise<OperatorConfig>;
    getAvailableCredit: (args: { user: Address, token: Address }) => Promise<bigint>;
    getDeposit: () => Promise<bigint>;
    getLatestSlash: (args: { operator: Address }) => Promise<SlashRecord>;
    getSlashCount: (args: { operator: Address }) => Promise<bigint>;
    getSlashHistory: (args: { operator: Address }) => Promise<SlashRecord[]>;
    slashHistory: (args: { operator: Address, index: bigint }) => Promise<SlashRecord>;
    userOpState: (args: { user: Address, operator: Address }) => Promise<{ lastTimestamp: number, isBlocked: boolean }>;
    cachedPrice: () => Promise<{ price: bigint, updatedAt: bigint, roundId: bigint, decimals: number }>;
    aPNTsPriceUSD: () => Promise<bigint>;
    protocolFeeBPS: () => Promise<bigint>;
    protocolRevenue: () => Promise<bigint>;
    totalTrackedBalance: () => Promise<bigint>;
    priceStalenessThreshold: () => Promise<bigint>;
    sbtHolders: (args: { user: Address }) => Promise<boolean>;
    
    // Constants
    APNTS_TOKEN: () => Promise<Address>;
    REGISTRY: () => Promise<Address>;
    BLS_AGGREGATOR: () => Promise<Address>;
    ETH_USD_PRICE_FEED: () => Promise<Address>;
    treasury: () => Promise<Address>;
    xpntsFactory: () => Promise<Address>;
    entryPoint: () => Promise<Address>;
    MAX_PROTOCOL_FEE: () => Promise<bigint>;
    MAX_ETH_USD_PRICE: () => Promise<bigint>;
    MIN_ETH_USD_PRICE: () => Promise<bigint>;
    PAYMASTER_DATA_OFFSET: () => Promise<bigint>;
    PRICE_CACHE_DURATION: () => Promise<bigint>;
    RATE_OFFSET: () => Promise<bigint>;
    VALIDATION_BUFFER_BPS: () => Promise<bigint>;
    BPS_DENOMINATOR: () => Promise<bigint>;
    
    // Ownership
    owner: () => Promise<Address>;
    transferOwnership: (args: { newOwner: Address, account?: Account | Address }) => Promise<Hash>;
    renounceOwnership: (args: { account?: Account | Address }) => Promise<Hash>;
    
    // Version
    version: () => Promise<string>;
};

export const superPaymasterActions = (address: Address) => (client: PublicClient | WalletClient): SuperPaymasterActions => ({
    // Deposit & Withdrawal
    async deposit({ amount, account }) {
        try {
            validateAmount(amount, 'amount');
            return await (client as any).writeContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'deposit',
                args: [amount],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'deposit');
        }
    },

    async depositETH({ value, account }) {
        try {
            validateAmount(value, 'value');
            return await (client as any).writeContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'deposit',
                args: [],
                value,
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'depositETH');
        }
    },

    async depositFor({ targetOperator, amount, account }) {
        try {
            validateAddress(targetOperator, 'targetOperator');
            validateAmount(amount, 'amount');
            return await (client as any).writeContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'depositFor',
                args: [targetOperator, amount],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'depositFor');
        }
    },

    async withdrawTo({ to, amount, account }) {
        try {
            validateAddress(to, 'to');
            validateAmount(amount, 'amount');
            return await (client as any).writeContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'withdrawTo',
                args: [to, amount],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'withdrawTo');
        }
    },

    async withdraw({ amount, account }) {
        try {
            validateAmount(amount, 'amount');
            return await (client as any).writeContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'withdraw',
                args: [amount],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'withdraw');
        }
    },

    // Staking
    async addStake({ unstakeDelaySec, value, account }) {
        try {
            validateRequired(unstakeDelaySec, 'unstakeDelaySec');
            validateAmount(value, 'value');
            return await (client as any).writeContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'addStake',
                args: [unstakeDelaySec],
                value,
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'addStake');
        }
    },

    async unlockStake({ account }) {
        try {
            return await (client as any).writeContract({
                address,
                abi: SuperPaymasterABI,
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
                abi: SuperPaymasterABI,
                functionName: 'withdrawStake',
                args: [to],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'withdrawStake');
        }
    },

    // Operator Management
    async configureOperator({ xPNTsToken, opTreasury, exchangeRate, account }) {
        try {
            validateAddress(xPNTsToken, 'xPNTsToken');
            validateAddress(opTreasury, 'opTreasury');
            validateAmount(exchangeRate, 'exchangeRate');
            return await (client as any).writeContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'configureOperator',
                args: [xPNTsToken, opTreasury, exchangeRate],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'configureOperator');
        }
    },

    async setOperatorPaused({ operator, paused, account }) {
        try {
            validateAddress(operator, 'operator');
            return await (client as any).writeContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'setOperatorPaused',
                args: [operator, paused],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setOperatorPaused');
        }
    },

    async setOperatorLimits({ minTxInterval, account }) {
        try {
            validateRequired(minTxInterval, 'minTxInterval');
            return await (client as any).writeContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'setOperatorLimits',
                args: [minTxInterval],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setOperatorLimits');
        }
    },

    async updateReputation({ operator, newScore, account }) {
        try {
            validateAddress(operator, 'operator');
            validateAmount(newScore, 'newScore');
            return await (client as any).writeContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'updateReputation',
                args: [operator, newScore],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'updateReputation');
        }
    },

    async executeSlashWithBLS({ operator, level, proof, account }) {
        try {
            validateAddress(operator, 'operator');
            validateRequired(level, 'level');
            validateRequired(proof, 'proof');
            return await (client as any).writeContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'executeSlashWithBLS',
                args: [operator, level, proof],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'executeSlashWithBLS');
        }
    },

    async slashOperator({ operator, level, penaltyAmount, reason, account }) {
        try {
            validateAddress(operator, 'operator');
            validateRequired(level, 'level');
            validateAmount(penaltyAmount, 'penaltyAmount');
            validateRequired(reason, 'reason');
            return await (client as any).writeContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'slashOperator',
                args: [operator, level, penaltyAmount, reason],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'slashOperator');
        }
    },

    // User & SBT
    async updateBlockedStatus({ operator, users, statuses, account }) {
        try {
            validateAddress(operator, 'operator');
            validateRequired(users, 'users');
            validateRequired(statuses, 'statuses');
            return await (client as any).writeContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'updateBlockedStatus',
                args: [operator, users, statuses],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'updateBlockedStatus');
        }
    },

    async updateSBTStatus({ user, status, account }) {
        try {
            validateAddress(user, 'user');
            return await (client as any).writeContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'updateSBTStatus',
                args: [user, status],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'updateSBTStatus');
        }
    },

    // Price
    async setAPNTSPrice({ newPrice, account }) {
        try {
            validateAmount(newPrice, 'newPrice');
            return await (client as any).writeContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'setAPNTSPrice',
                args: [newPrice],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setAPNTSPrice');
        }
    },

    async updatePrice({ account }) {
        try {
            return await (client as any).writeContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'updatePrice',
                args: [],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'updatePrice');
        }
    },

    async updatePriceDVT({ price, updatedAt, proof, account }) {
        try {
            validateRequired(price, 'price');
            validateRequired(updatedAt, 'updatedAt');
            validateRequired(proof, 'proof');
            return await (client as any).writeContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'updatePriceDVT',
                args: [price, updatedAt, proof],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'updatePriceDVT');
        }
    },

    // Fees & Admin
    async setProtocolFee({ newFeeBPS, account }) {
        try {
            validateAmount(newFeeBPS, 'newFeeBPS');
            return await (client as any).writeContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'setProtocolFee',
                args: [newFeeBPS],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setProtocolFee');
        }
    },

    async setTreasury({ treasury, account }) {
        try {
            validateAddress(treasury, 'treasury');
            return await (client as any).writeContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'setTreasury',
                args: [treasury],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setTreasury');
        }
    },

    async setXPNTsFactory({ factory, account }) {
        try {
            validateAddress(factory, 'factory');
            return await (client as any).writeContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'setXPNTsFactory',
                args: [factory],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setXPNTsFactory');
        }
    },

    async setAPNTsToken({ token, account }) {
        try {
            validateAddress(token, 'token');
            return await (client as any).writeContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'setAPNTsToken',
                args: [token],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setAPNTsToken');
        }
    },

    async setBLSAggregator({ aggregator, account }) {
        try {
            validateAddress(aggregator, 'aggregator');
            return await (client as any).writeContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'setBLSAggregator',
                args: [aggregator],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setBLSAggregator');
        }
    },

    async withdrawProtocolRevenue({ to, amount, account }) {
        try {
            validateAddress(to, 'to');
            validateAmount(amount, 'amount');
            return await (client as any).writeContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'withdrawProtocolRevenue',
                args: [to, amount],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'withdrawProtocolRevenue');
        }
    },

    // Callbacks & Validation
    async onTransferReceived({ operator, from, value, data }) {
        try {
            validateAddress(operator, 'operator');
            validateAddress(from, 'from');
            validateAmount(value, 'value');
            return await (client as PublicClient).readContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'onTransferReceived',
                args: [operator, from, value, data]
            }) as Hex;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'onTransferReceived');
        }
    },

    async validatePaymasterUserOp({ userOp, userOpHash, maxCost }) {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'validatePaymasterUserOp',
                args: [userOp, userOpHash, maxCost]
            }) as { context: Hex, validationData: bigint };
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'validatePaymasterUserOp');
        }
    },

    // View Functions
    async operators({ id }) {
        try {
            validateAddress(id, 'id');
            const result = await (client as PublicClient).readContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'operators',
                args: [id]
            }) as any;

            if (Array.isArray(result)) {
                return {
                    aPNTsBalance: result[0],
                    exchangeRate: result[1],
                    isConfigured: result[2],
                    isPaused: result[3],
                    xPNTsToken: result[4],
                    reputation: result[5],
                    minTxInterval: result[6],
                    treasury: result[7],
                    totalSpent: result[8],
                    totalTxSponsored: result[9]
                };
            }
            return result as OperatorConfig;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'operators');
        }
    },

    async getAvailableCredit({ user, token }) {
        try {
            validateAddress(user, 'user');
            validateAddress(token, 'token');
            return await (client as PublicClient).readContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'getAvailableCredit',
                args: [user, token]
            }) as bigint;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getAvailableCredit');
        }
    },

    async getDeposit() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'getDeposit',
                args: []
            }) as bigint;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getDeposit');
        }
    },

    async getLatestSlash({ operator }) {
        try {
            validateAddress(operator, 'operator');
            const res = await (client as PublicClient).readContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'getLatestSlash',
                args: [operator]
            }) as any;

            if (Array.isArray(res)) {
                return {
                    timestamp: res[0],
                    amount: res[1],
                    reputationLoss: res[2],
                    reason: res[3],
                    level: res[4]
                };
            }
            return res as SlashRecord;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getLatestSlash');
        }
    },

    async getSlashCount({ operator }) {
        try {
            validateAddress(operator, 'operator');
            return await (client as PublicClient).readContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'getSlashCount',
                args: [operator]
            }) as bigint;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getSlashCount');
        }
    },

    async getSlashHistory({ operator }) {
        try {
            validateAddress(operator, 'operator');
            const res = await (client as PublicClient).readContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'getSlashHistory',
                args: [operator]
            }) as any[];

            return res.map(r => {
                if (Array.isArray(r)) {
                    return {
                        timestamp: r[0],
                        amount: r[1],
                        reputationLoss: r[2],
                        reason: r[3],
                        level: r[4]
                    };
                }
                return r as SlashRecord;
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getSlashHistory');
        }
    },

    async slashHistory({ operator, index }) {
        try {
            validateAddress(operator, 'operator');
            validateRequired(index, 'index');
            const res = await (client as PublicClient).readContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'slashHistory',
                args: [operator, index]
            }) as any;

            if (Array.isArray(res)) {
                return {
                    timestamp: res[0],
                    amount: res[1],
                    reputationLoss: res[2],
                    reason: res[3],
                    level: res[4]
                };
            }
            return res as SlashRecord;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'slashHistory');
        }
    },

    async userOpState({ user, operator }) {
        try {
            validateAddress(user, 'user');
            validateAddress(operator, 'operator');
            const res = await (client as PublicClient).readContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'userOpState',
                args: [user, operator]
            }) as any;

            if (Array.isArray(res)) {
                return { lastTimestamp: Number(res[0]), isBlocked: res[1] };
            }
            return { lastTimestamp: Number(res.lastTimestamp), isBlocked: res.isBlocked };
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'userOpState');
        }
    },

    async cachedPrice() {
        try {
            const res = await (client as PublicClient).readContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'cachedPrice',
                args: []
            }) as any;

            if (Array.isArray(res)) {
                return {
                    price: res[0],
                    updatedAt: res[1],
                    roundId: res[2],
                    decimals: res[3]
                };
            }
            return res as { price: bigint, updatedAt: bigint, roundId: bigint, decimals: number };
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'cachedPrice');
        }
    },

    async aPNTsPriceUSD() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'aPNTsPriceUSD',
                args: []
            }) as bigint;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'aPNTsPriceUSD');
        }
    },

    async protocolFeeBPS() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'protocolFeeBPS',
                args: []
            }) as bigint;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'protocolFeeBPS');
        }
    },

    async protocolRevenue() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'protocolRevenue',
                args: []
            }) as bigint;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'protocolRevenue');
        }
    },

    async totalTrackedBalance() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'totalTrackedBalance',
                args: []
            }) as bigint;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'totalTrackedBalance');
        }
    },

    async priceStalenessThreshold() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'priceStalenessThreshold',
                args: []
            }) as bigint;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'priceStalenessThreshold');
        }
    },

    async sbtHolders({ user }) {
        try {
            validateAddress(user, 'user');
            return await (client as PublicClient).readContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'sbtHolders',
                args: [user]
            }) as Promise<boolean>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'sbtHolders');
        }
    },

    // Constants
    async APNTS_TOKEN() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'APNTS_TOKEN',
                args: []
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'APNTS_TOKEN');
        }
    },

    async REGISTRY() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'REGISTRY',
                args: []
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'REGISTRY');
        }
    },

    async BLS_AGGREGATOR() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'BLS_AGGREGATOR',
                args: []
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'BLS_AGGREGATOR');
        }
    },

    async ETH_USD_PRICE_FEED() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'ETH_USD_PRICE_FEED',
                args: []
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'ETH_USD_PRICE_FEED');
        }
    },

    async treasury() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'treasury',
                args: []
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'treasury');
        }
    },

    async xpntsFactory() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'xpntsFactory',
                args: []
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'xpntsFactory');
        }
    },

    async entryPoint() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'entryPoint',
                args: []
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'entryPoint');
        }
    },

    async MAX_PROTOCOL_FEE() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'MAX_PROTOCOL_FEE',
                args: []
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'MAX_PROTOCOL_FEE');
        }
    },

    async MAX_ETH_USD_PRICE() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: SuperPaymasterABI,
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
                abi: SuperPaymasterABI,
                functionName: 'MIN_ETH_USD_PRICE',
                args: []
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'MIN_ETH_USD_PRICE');
        }
    },

    async PAYMASTER_DATA_OFFSET() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'PAYMASTER_DATA_OFFSET',
                args: []
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'PAYMASTER_DATA_OFFSET');
        }
    },

    async PRICE_CACHE_DURATION() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'PRICE_CACHE_DURATION',
                args: []
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'PRICE_CACHE_DURATION');
        }
    },

    async RATE_OFFSET() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'RATE_OFFSET',
                args: []
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'RATE_OFFSET');
        }
    },

    async VALIDATION_BUFFER_BPS() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'VALIDATION_BUFFER_BPS',
                args: []
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'VALIDATION_BUFFER_BPS');
        }
    },

    async BPS_DENOMINATOR() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'BPS_DENOMINATOR',
                args: []
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'BPS_DENOMINATOR');
        }
    },

    // Admin
    async owner() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: SuperPaymasterABI,
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
                abi: SuperPaymasterABI,
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
                abi: SuperPaymasterABI,
                functionName: 'renounceOwnership',
                args: [],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'renounceOwnership');
        }
    },

    async version() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'version',
                args: []
            }) as Promise<string>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'version');
        }
    }
});
