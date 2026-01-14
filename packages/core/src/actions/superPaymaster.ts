import { type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account } from 'viem';
import { SuperPaymasterABI } from '../abis/index.js';

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
    transferSuperPaymasterOwnership: (args: { newOwner: Address, account?: Account | Address }) => Promise<Hash>;
    owner: () => Promise<Address>;
    renounceOwnership: (args: { account?: Account | Address }) => Promise<Hash>;
    
    // Aliases for ABI Compliance
    addStake: (args: { amount: bigint, account?: Account | Address }) => Promise<Hash>;
    depositFor: (args: { operator: Address, amount: bigint, account?: Account | Address }) => Promise<Hash>;
    transferOwnership: (args: { newOwner: Address, account?: Account | Address }) => Promise<Hash>;
    unlockStake: (args: { account?: Account | Address }) => Promise<Hash>;
    withdraw: (args: { amount: bigint, account?: Account | Address }) => Promise<Hash>;
    
    // Missing Constants & Views
    MAX_PROTOCOL_FEE: () => Promise<bigint>;
    VALIDATION_BUFFER_BPS: () => Promise<bigint>;
    priceStalenessThreshold: () => Promise<bigint>;
    sbtHolders: (args: { user: Address }) => Promise<boolean>;
    userOpState: (args: { userOpHash: Hex }) => Promise<any>;
    updateSBTStatus: (args: { user: Address, hasSBT: boolean, account?: Account | Address }) => Promise<Hash>;
    
    // Version
    version: () => Promise<string>;
};

export const superPaymasterActions = (address: Address) => (client: PublicClient | WalletClient): SuperPaymasterActions => ({
    // Deposit & Withdrawal
    async deposit({ amount, account }) {
        return (client as any).writeContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'deposit',
            args: [amount],
            account: account as any,
            chain: (client as any).chain
        });
    },

    // Semantic alias: depositAPNTs - uses aPNTs token (nonpayable)
    async depositAPNTs({ amount, account }) {
        return (client as any).writeContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'deposit',
            args: [amount],
            account: account as any,
            chain: (client as any).chain
        });
    },

    // depositETH - uses native ETH (payable, no args)
    async depositETH({ value, account }) {
        return (client as any).writeContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'deposit',
            args: [],
            value,
            account: account as any,
            chain: (client as any).chain
        });
    },

    async depositForOperator({ operator, amount, account }) {
        return (client as any).writeContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'depositFor',
            args: [operator, amount],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async withdrawTo({ to, amount, account }) {
        return (client as any).writeContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'withdrawTo',
            args: [to, amount],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async addSuperStake({ amount, account }) {
        return (client as any).writeContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'addStake',
            args: [amount],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async unlockSuperStake({ account }) {
        return (client as any).writeContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'unlockStake',
            args: [],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async withdrawStake({ to, account }) {
        return (client as any).writeContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'withdrawStake',
            args: [to],
            account: account as any,
            chain: (client as any).chain
        });
    },

    // Operator Management
    async configureOperator({ xPNTsToken, treasury, exchangeRate, account }) {
        return (client as any).writeContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'configureOperator',
            args: [xPNTsToken, treasury, exchangeRate],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async setOperatorPaused({ operator, paused, account }) {
        return (client as any).writeContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'setOperatorPaused',
            args: [operator, paused],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async updateReputation({ operator, newReputation, account }) {
        return (client as any).writeContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'updateReputation',
            args: [operator, newReputation],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async executeSlashWithBLS({ operator, roleId, amount, reason, blsSignature, account }) {
        return (client as any).writeContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'executeSlashWithBLS',
            args: [operator, roleId, amount, reason, blsSignature],
            account: account as any,
            chain: (client as any).chain
        });
    },

    // Price & Configuration
    async setAPNTsPrice({ priceUSD, account }) {
        return (client as any).writeContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'setAPNTsPrice',
            args: [priceUSD],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async setCachedPrice({ price, account }) {
        return (client as any).writeContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'setCachedPrice',
            args: [price],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async setProtocolFee({ feeRecipient, feeBps, account }) {
        return (client as any).writeContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'setProtocolFee',
            args: [feeRecipient, feeBps],
            account: account as any,
            chain: (client as any).chain
        });
    },

    // User Management
    async blockUser({ user, blocked, account }) {
        return (client as any).writeContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'blockUser',
            args: [user, blocked],
            account: account as any,
            chain: (client as any).chain
        });
    },

    // Validation (EntryPoint calls)
    async validatePaymasterUserOp({ userOp, userOpHash, maxCost }) {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'validatePaymasterUserOp',
            args: [userOp, userOpHash, maxCost]
        });
    },

    async postOp({ mode, context, actualGasCost, actualUserOpFeePerGas }) {
        // postOp is called by EntryPoint, typically not called directly
        throw new Error('postOp is called by EntryPoint after UserOp execution');
    },

    // View Functions
    async operators({ operator }) {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'operators',
            args: [operator]
        });
    },

    async getDeposit() {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'getDeposit',
            args: []
        }) as Promise<bigint>;
    },

    async getAvailableCredit({ operator, user }) {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'getAvailableCredit',
            args: [operator, user]
        }) as Promise<bigint>;
    },

    async blockedUsers({ user }) {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'blockedUsers',
            args: [user]
        }) as Promise<boolean>;
    },

    // Convenience function: Get operator's aPNTs balance
    async balanceOfOperator({ operator }: { operator: Address }) {
        const operatorConfig = await this.operators({ operator });
        return operatorConfig[0]; // aPNTsBalance is the first field
    },

    async aPNTsPriceUSD() {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'aPNTsPriceUSD',
            args: []
        }) as Promise<bigint>;
    },

    async cachedPrice() {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'cachedPrice',
            args: []
        });
    },

    async protocolFee() {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'protocolFee',
            args: []
        });
    },

    async entryPoint() {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'entryPoint',
            args: []
        }) as Promise<Address>;
    },

    // Constants
    async APNTS_TOKEN() {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'APNTS_TOKEN',
            args: []
        }) as Promise<Address>;
    },

    async REGISTRY() {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'REGISTRY',
            args: []
        }) as Promise<Address>;
    },

    async BLS_AGGREGATOR() {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'BLS_AGGREGATOR',
            args: []
        }) as Promise<Address>;
    },

    async ETH_USD_PRICE_FEED() {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'ETH_USD_PRICE_FEED',
            args: []
        }) as Promise<Address>;
    },

    async PAYMASTER_DATA_OFFSET() {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'PAYMASTER_DATA_OFFSET',
            args: []
        }) as Promise<bigint>;
    },

    async RATE_OFFSET() {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'RATE_OFFSET',
            args: []
        }) as Promise<bigint>;
    },

    async BPS_DENOMINATOR() {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'BPS_DENOMINATOR',
            args: []
        }) as Promise<bigint>;
    },

    async PRICE_CACHE_DURATION() {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'PRICE_CACHE_DURATION',
            args: []
        }) as Promise<bigint>;
    },

    async PRICE_STALENESS_THRESHOLD() {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'PRICE_STALENESS_THRESHOLD',
            args: []
        }) as Promise<bigint>;
    },

    async MAX_ETH_USD_PRICE() {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'MAX_ETH_USD_PRICE',
            args: []
        }) as Promise<bigint>;
    },

    async MIN_ETH_USD_PRICE() {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'MIN_ETH_USD_PRICE',
            args: []
        }) as Promise<bigint>;
    },

    // Admin
    async transferSuperPaymasterOwnership({ newOwner, account }) {
        return (client as any).writeContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'transferOwnership',
            args: [newOwner],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async owner() {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'owner',
            args: []
        }) as Promise<Address>;
    },

    async renounceOwnership({ account }) {
        return (client as any).writeContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'renounceOwnership',
            args: [],
            account: account as any,
            chain: (client as any).chain
        });
    },

    // Additional Operator Management
    async setOperatorLimits({ operator, limits, account }) {
        return (client as any).writeContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'setOperatorLimits',
            args: [operator, limits],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async slashOperator({ operator, amount, reason, account }) {
        return (client as any).writeContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'slashOperator',
            args: [operator, amount, reason],
            account: account as any,
            chain: (client as any).chain
        });
    },

    // User Management
    async updateBlockedStatus({ user, blocked, account }) {
        return (client as any).writeContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'updateBlockedStatus',
            args: [user, blocked],
            account: account as any,
            chain: (client as any).chain
        });
    },

    // Additional View Functions
    async protocolFeeBPS() {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'protocolFeeBPS',
            args: []
        }) as Promise<bigint>;
    },

    async protocolRevenue() {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'protocolRevenue',
            args: []
        }) as Promise<bigint>;
    },

    async treasury() {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'treasury',
            args: []
        }) as Promise<Address>;
    },

    async xpntsFactory() {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'xpntsFactory',
            args: []
        }) as Promise<Address>;
    },

    async totalTrackedBalance() {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'totalTrackedBalance',
            args: []
        }) as Promise<bigint>;
    },

    async lastUserOpTimestamp({ user }) {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'lastUserOpTimestamp',
            args: [user]
        }) as Promise<bigint>;
    },

    // Slash History
    async getSlashHistory({ operator }) {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'getSlashHistory',
            args: [operator]
        }) as Promise<any[]>;
    },

    async getSlashCount({ operator }) {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'getSlashCount',
            args: [operator]
        }) as Promise<bigint>;
    },

    async getLatestSlash({ operator }) {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'getLatestSlash',
            args: [operator]
        });
    },

    async slashHistory({ operator, index }) {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'slashHistory',
            args: [operator, index]
        });
    },

    // Price Management
    async updatePrice({ account }) {
        return (client as any).writeContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'updatePrice',
            args: [],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async updatePriceDVT({ price, proof, account }) {
        return (client as any).writeContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'updatePriceDVT',
            args: [price, proof],
            account: account as any,
            chain: (client as any).chain
        });
    },

    // Treasury & Revenue
    async setTreasury({ treasury, account }) {
        return (client as any).writeContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'setTreasury',
            args: [treasury],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async withdrawProtocolRevenue({ to, account }) {
        return (client as any).writeContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'withdrawProtocolRevenue',
            args: [to],
            account: account as any,
            chain: (client as any).chain
        });
    },

    // Factory & Config
    async setXPNTsFactory({ factory, account }) {
        return (client as any).writeContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'setXPNTsFactory',
            args: [factory],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async setAPNTsToken({ token, account }) {
        return (client as any).writeContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'setAPNTsToken',
            args: [token],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async setBLSAggregator({ aggregator, account }) {
        return (client as any).writeContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'setBLSAggregator',
            args: [aggregator],
            account: account as any,
            chain: (client as any).chain
        });
    },

    // Transfer callback
    async onTransferReceived({ from, amount, data }) {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'onTransferReceived',
            args: [from, amount, data]
        });
    },

    // Withdraw alias
    async withdrawAPNTs({ amount, account }) {
        return (client as any).writeContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'withdraw',
            args: [amount],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async version() {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'version',
            args: []
        }) as Promise<string>;
    },

    // Aliases including implementation
    async addStake(args) { return this.addSuperStake(args); },
    async depositFor(args) { return this.depositForOperator(args); },
    async transferOwnership(args) { return this.transferSuperPaymasterOwnership(args); },
    async unlockStake(args) { return this.unlockSuperStake(args); },
    async withdraw(args) { return this.withdrawAPNTs(args); },

    async MAX_PROTOCOL_FEE() {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'MAX_PROTOCOL_FEE',
            args: []
        }) as Promise<bigint>;
    },

    async VALIDATION_BUFFER_BPS() {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'VALIDATION_BUFFER_BPS',
            args: []
        }) as Promise<bigint>;
    },

    async priceStalenessThreshold() {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'priceStalenessThreshold', // Assuming ABI has this exact name
            args: []
        }) as Promise<bigint>;
    },
    
    async sbtHolders({ user }) {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'sbtHolders',
            args: [user]
        }) as Promise<boolean>;
    },

    async userOpState({ userOpHash }) {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'userOpState',
            args: [userOpHash]
        });
    },

    async updateSBTStatus({ user, hasSBT, account }) {
        return (client as any).writeContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'updateSBTStatus',
            args: [user, hasSBT],
            account: account as any,
            chain: (client as any).chain
        });
    }
});
