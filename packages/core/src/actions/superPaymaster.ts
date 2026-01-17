import { type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account } from 'viem';
import { SuperPaymasterABI } from '../abis/index.js';
import { validateAddress, validateRequired, validateAmount } from '../validators/index.js';
import { AAStarError } from '../errors/index.js';

export type SuperPaymasterActions = {
    // Deposit & Withdrawal
    deposit: (args: { amount: bigint, account?: Account | Address }) => Promise<Hash>;
    /** @deprecated Use depositAPNTs for clarity */
    depositAPNTs: (args: { amount: bigint, account?: Account | Address }) => Promise<Hash>; // Semantic alias for deposit(uint256)
    depositETH: (args: { value: bigint, account?: Account | Address }) => Promise<Hash>; // For payable deposit()
    depositForOperator: (args: { operator: Address, amount: bigint, account?: Account | Address }) => Promise<Hash>;
    withdrawTo: (args: { to: Address, amount: bigint, account?: Account | Address }) => Promise<Hash>;
    addSuperStake: (args: { amount: bigint, account?: Account | Address }) => Promise<Hash>;
    unlockSuperStake: (args: { account?: Account | Address }) => Promise<Hash>;
    withdrawStake: (args: { to: Address, account?: Account | Address }) => Promise<Hash>;
   
    // Operator Management
    configureOperator: (args: { xPNTsToken: Address, treasury: Address, exchangeRate: bigint, account?: Account | Address }) => Promise<Hash>;
    setOperatorPaused: (args: { operator: Address, paused: boolean, account?: Account | Address }) => Promise<Hash>;
    setOperatorLimits: (args: { operator: Address, limits: any, account?: Account | Address }) => Promise<Hash>;
    updateReputation: (args: { operator: Address, newReputation: bigint, account?: Account | Address }) => Promise<Hash>;
    executeSlashWithBLS: (args: { operator: Address, roleId: Hex, amount: bigint, reason: string, blsSignature: Hex, account?: Account | Address }) => Promise<Hash>;
    slashOperator: (args: { operator: Address, amount: bigint, reason: string, account?: Account | Address }) => Promise<Hash>;
    
    // Price & Configuration
    setAPNTsPrice: (args: { priceUSD: bigint, account?: Account | Address }) => Promise<Hash>;
    setCachedPrice: (args: { price: bigint, account?: Account | Address }) => Promise<Hash>;
    setProtocolFee: (args: { feeRecipient: Address, feeBps: bigint, account?: Account | Address }) => Promise<Hash>;
    
    // User Management  
    blockUser: (args: { user: Address, blocked: boolean, account?: Account | Address }) => Promise<Hash>;
    updateBlockedStatus: (args: { user: Address, blocked: boolean, account?: Account | Address }) => Promise<Hash>;
    
    // Validation (EntryPoint calls)
    validatePaymasterUserOp: (args: { userOp: any, userOpHash: Hex, maxCost: bigint }) => Promise<any>;
    postOp: (args: { mode: number, context: Hex, actualGasCost: bigint, actualUserOpFeePerGas: bigint }) => Promise<void>;
    
    // View Functions
    operators: (args: { operator: Address }) => Promise<any>;
    getDeposit: () => Promise<bigint>;
    getAvailableCredit: (args: { operator: Address, user: Address }) => Promise<bigint>;
    blockedUsers: (args: { user: Address }) => Promise<boolean>;
    balanceOfOperator: (args: { operator: Address }) => Promise<bigint>; // Get operator's aPNTs balance
    aPNTsPriceUSD: () => Promise<bigint>;
    cachedPrice: () => Promise<any>;
    protocolFee: () => Promise<any>;
    protocolFeeBPS: () => Promise<bigint>;
    protocolRevenue: () => Promise<bigint>;
    treasury: () => Promise<Address>;
    xpntsFactory: () => Promise<Address>;
    entryPoint: () => Promise<Address>;
    totalTrackedBalance: () => Promise<bigint>;
    lastUserOpTimestamp: (args: { user: Address }) => Promise<bigint>;
    
    // Slash History
    getSlashHistory: (args: { operator: Address }) => Promise<any[]>;
    getSlashCount: (args: { operator: Address }) => Promise<bigint>;
    getLatestSlash: (args: { operator: Address }) => Promise<any>;
    slashHistory: (args: { operator: Address, index: bigint }) => Promise<any>;
    
    // Price Management
    updatePrice: (args: { account?: Account | Address }) => Promise<Hash>;
    updatePriceDVT: (args: { price: bigint, proof: Hex, account?: Account | Address }) => Promise<Hash>;
    
    // Treasury & Revenue
    setTreasury: (args: { treasury: Address, account?: Account | Address }) => Promise<Hash>;
    withdrawProtocolRevenue: (args: { to: Address, account?: Account | Address }) => Promise<Hash>;
    
    // Factory
    setXPNTsFactory: (args: { factory: Address, account?: Account | Address }) => Promise<Hash>;
    setAPNTsToken: (args: { token: Address, account?: Account | Address }) => Promise<Hash>;
    setBLSAggregator: (args: { aggregator: Address, account?: Account | Address }) => Promise<Hash>;
    
    // Transfer callback
    onTransferReceived: (args: { from: Address, amount: bigint, data: Hex }) => Promise<any>;
    
    // Withdraw alias
    withdrawAPNTs: (args: { amount: bigint, account?: Account | Address }) => Promise<Hash>;
    
    // Constants
    APNTS_TOKEN: () => Promise<Address>;
    REGISTRY: () => Promise<Address>;
    BLS_AGGREGATOR: () => Promise<Address>;
    ETH_USD_PRICE_FEED: () => Promise<Address>;
    PAYMASTER_DATA_OFFSET: () => Promise<bigint>;
    RATE_OFFSET: () => Promise<bigint>;
    BPS_DENOMINATOR: () => Promise<bigint>;
    PRICE_CACHE_DURATION: () => Promise<bigint>;
    PRICE_STALENESS_THRESHOLD: () => Promise<bigint>;
    MAX_ETH_USD_PRICE: () => Promise<bigint>;
    MIN_ETH_USD_PRICE: () => Promise<bigint>;
    
    // Admin
    transferOwnership: (args: { newOwner: Address, account?: Account | Address }) => Promise<Hash>;
    owner: () => Promise<Address>;
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

    // Semantic alias: depositAPNTs - uses aPNTs token (nonpayable)
    async depositAPNTs({ amount, account }) {
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
            throw AAStarError.fromViemError(error as Error, 'depositAPNTs');
        }
    },

    // depositETH - uses native ETH (payable, no args)
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

    async depositForOperator({ operator, amount, account }) {
        try {
            validateAddress(operator, 'operator');
            validateAmount(amount, 'amount');
            return await (client as any).writeContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'depositFor',
                args: [operator, amount],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'depositForOperator');
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

    async addSuperStake({ amount, account }) {
        try {
            validateAmount(amount, 'amount');
            return await (client as any).writeContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'addStake',
                args: [amount],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'addSuperStake');
        }
    },

    async unlockSuperStake({ account }) {
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
            throw AAStarError.fromViemError(error as Error, 'unlockSuperStake');
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
    async configureOperator({ xPNTsToken, treasury, exchangeRate, account }) {
        try {
            validateAddress(xPNTsToken, 'xPNTsToken');
            validateAddress(treasury, 'treasury');
            return await (client as any).writeContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'configureOperator',
                args: [xPNTsToken, treasury, exchangeRate],
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

    async updateReputation({ operator, newReputation, account }) {
        try {
            validateAddress(operator, 'operator');
            return await (client as any).writeContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'updateReputation',
                args: [operator, newReputation],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'updateReputation');
        }
    },

    async executeSlashWithBLS({ operator, roleId, amount, reason, blsSignature, account }) {
        try {
            validateAddress(operator, 'operator');
            validateRequired(roleId, 'roleId');
            validateAmount(amount, 'amount');
            return await (client as any).writeContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'executeSlashWithBLS',
                args: [operator, roleId, amount, reason, blsSignature],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'executeSlashWithBLS');
        }
    },

    // Price & Configuration
    async setAPNTsPrice({ priceUSD, account }) {
        try {
            validateAmount(priceUSD, 'priceUSD');
            return await (client as any).writeContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'setAPNTsPrice',
                args: [priceUSD],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setAPNTsPrice');
        }
    },

    async setCachedPrice({ price, account }) {
        try {
            validateAmount(price, 'price');
            return await (client as any).writeContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'setCachedPrice',
                args: [price],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setCachedPrice');
        }
    },

    async setProtocolFee({ feeRecipient, feeBps, account }) {
        try {
            validateAddress(feeRecipient, 'feeRecipient');
            return await (client as any).writeContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'setProtocolFee',
                args: [feeRecipient, feeBps],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setProtocolFee');
        }
    },

    // User Management
    async blockUser({ user, blocked, account }) {
        try {
            validateAddress(user, 'user');
            return await (client as any).writeContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'blockUser',
                args: [user, blocked],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'blockUser');
        }
    },

    // Validation (EntryPoint calls)
    async validatePaymasterUserOp({ userOp, userOpHash, maxCost }) {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'validatePaymasterUserOp',
                args: [userOp, userOpHash, maxCost]
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'validatePaymasterUserOp');
        }
    },

    async postOp({ mode, context, actualGasCost, actualUserOpFeePerGas }) {
        // postOp is called by EntryPoint, typically not called directly
        throw new Error('postOp is called by EntryPoint after UserOp execution');
    },

    // View Functions
    async operators({ operator }) {
        try {
            validateAddress(operator, 'operator');
            return await (client as PublicClient).readContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'operators',
                args: [operator]
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'operators');
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

    async getAvailableCredit({ operator, user }) {
        try {
            validateAddress(operator, 'operator');
            validateAddress(user, 'user');
            return await (client as PublicClient).readContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'getAvailableCredit',
                args: [operator, user]
            }) as bigint;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getAvailableCredit');
        }
    },

    async blockedUsers({ user }) {
        try {
            validateAddress(user, 'user');
            return await (client as PublicClient).readContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'blockedUsers',
                args: [user]
            }) as boolean;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'blockedUsers');
        }
    },

    // Convenience function: Get operator's aPNTs balance
    async balanceOfOperator({ operator }: { operator: Address }) {
        const operatorConfig = await this.operators({ operator });
        return operatorConfig[0]; // aPNTsBalance is the first field
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

    async cachedPrice() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'cachedPrice',
                args: []
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'cachedPrice');
        }
    },

    async protocolFee() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'protocolFee',
                args: []
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'protocolFee');
        }
    },

    async entryPoint() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'entryPoint',
                args: []
            }) as Address;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'entryPoint');
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
            }) as Address;
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
            }) as Address;
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
            }) as Address;
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
            }) as Address;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'ETH_USD_PRICE_FEED');
        }
    },

    async PAYMASTER_DATA_OFFSET() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'PAYMASTER_DATA_OFFSET',
                args: []
            }) as bigint;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'PAYMASTER_DATA_OFFSET');
        }
    },

    async RATE_OFFSET() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'RATE_OFFSET',
                args: []
            }) as bigint;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'RATE_OFFSET');
        }
    },

    async BPS_DENOMINATOR() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'BPS_DENOMINATOR',
                args: []
            }) as bigint;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'BPS_DENOMINATOR');
        }
    },

    async PRICE_CACHE_DURATION() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'PRICE_CACHE_DURATION',
                args: []
            }) as bigint;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'PRICE_CACHE_DURATION');
        }
    },

    async PRICE_STALENESS_THRESHOLD() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'PRICE_STALENESS_THRESHOLD',
                args: []
            }) as bigint;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'PRICE_STALENESS_THRESHOLD');
        }
    },

    async MAX_ETH_USD_PRICE() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'MAX_ETH_USD_PRICE',
                args: []
            }) as bigint;
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
            }) as bigint;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'MIN_ETH_USD_PRICE');
        }
    },

    // Admin
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

    async owner() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'owner',
                args: []
            }) as Address;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'owner');
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

    // Additional Operator Management
    async setOperatorLimits({ operator, limits, account }) {
        try {
            validateAddress(operator, 'operator');
            return await (client as any).writeContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'setOperatorLimits',
                args: [operator, limits],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setOperatorLimits');
        }
    },

    async slashOperator({ operator, amount, reason, account }) {
        try {
            validateAddress(operator, 'operator');
            validateAmount(amount, 'amount');
            return await (client as any).writeContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'slashOperator',
                args: [operator, amount, reason],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'slashOperator');
        }
    },

    // User Management
    async updateBlockedStatus({ user, blocked, account }) {
        try {
            validateAddress(user, 'user');
            return await (client as any).writeContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'updateBlockedStatus',
                args: [user, blocked],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'updateBlockedStatus');
        }
    },

    // Additional View Functions
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

    async treasury() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'treasury',
                args: []
            }) as Address;
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
            }) as Address;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'xpntsFactory');
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

    async lastUserOpTimestamp({ user }) {
        try {
            validateAddress(user, 'user');
            return await (client as PublicClient).readContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'lastUserOpTimestamp',
                args: [user]
            }) as bigint;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'lastUserOpTimestamp');
        }
    },

    // Slash History
    async getSlashHistory({ operator }) {
        try {
            validateAddress(operator, 'operator');
            return await (client as PublicClient).readContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'getSlashHistory',
                args: [operator]
            }) as Promise<any[]>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getSlashHistory');
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

    async getLatestSlash({ operator }) {
        try {
            validateAddress(operator, 'operator');
            return await (client as PublicClient).readContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'getLatestSlash',
                args: [operator]
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getLatestSlash');
        }
    },

    async slashHistory({ operator, index }) {
        try {
            validateAddress(operator, 'operator');
            return await (client as PublicClient).readContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'slashHistory',
                args: [operator, index]
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'slashHistory');
        }
    },

    // Price Management
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

    async updatePriceDVT({ price, proof, account }) {
        try {
            validateAmount(price, 'price');
            validateRequired(proof, 'proof');
            return await (client as any).writeContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'updatePriceDVT',
                args: [price, proof],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'updatePriceDVT');
        }
    },

    // Treasury & Revenue
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

    async withdrawProtocolRevenue({ to, account }) {
        try {
            validateAddress(to, 'to');
            return await (client as any).writeContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'withdrawProtocolRevenue',
                args: [to],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'withdrawProtocolRevenue');
        }
    },

    // Factory & Config
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

    // Transfer callback
    async onTransferReceived({ from, amount, data }) {
        try {
            validateAddress(from, 'from');
            validateAmount(amount, 'amount');
            return await (client as PublicClient).readContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'onTransferReceived',
                args: [from, amount, data]
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'onTransferReceived');
        }
    },

    // Withdraw alias
    async withdrawAPNTs({ amount, account }) {
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
            throw AAStarError.fromViemError(error as Error, 'withdrawAPNTs');
        }
    },

    // Version
    async version() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'version',
                args: []
            }) as string;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'version');
        }
    }
});
