import { type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account } from 'viem';
import { SuperPaymasterABI } from '../abis/index.js';

export type SuperPaymasterActions = {
    // Deposit & Withdrawal
    superPaymasterDeposit: (args: { amount: bigint, account?: Account | Address }) => Promise<Hash>;
    /** @deprecated Use superPaymasterDeposit for clarity */
    superPaymasterDepositAPNTs: (args: { amount: bigint, account?: Account | Address }) => Promise<Hash>; 
    superPaymasterDepositETH: (args: { value: bigint, account?: Account | Address }) => Promise<Hash>; 
    superPaymasterDepositFor: (args: { operator: Address, amount: bigint, account?: Account | Address }) => Promise<Hash>;
    superPaymasterWithdrawTo: (args: { to: Address, amount: bigint, account?: Account | Address }) => Promise<Hash>;
    superPaymasterAddSuperStake: (args: { amount: bigint, account?: Account | Address }) => Promise<Hash>;
    superPaymasterUnlockSuperStake: (args: { account?: Account | Address }) => Promise<Hash>;
    superPaymasterWithdrawStake: (args: { to: Address, account?: Account | Address }) => Promise<Hash>;
   
    // Operator Management
    superPaymasterConfigureOperator: (args: { xPNTsToken: Address, treasury: Address, exchangeRate: bigint, account?: Account | Address }) => Promise<Hash>;
    superPaymasterSetOperatorPaused: (args: { operator: Address, paused: boolean, account?: Account | Address }) => Promise<Hash>;
    superPaymasterSetOperatorLimits: (args: { operator: Address, limits: any, account?: Account | Address }) => Promise<Hash>;
    superPaymasterUpdateReputation: (args: { operator: Address, newReputation: bigint, account?: Account | Address }) => Promise<Hash>;
    superPaymasterExecuteSlashWithBLS: (args: { operator: Address, roleId: Hex, amount: bigint, reason: string, blsSignature: Hex, account?: Account | Address }) => Promise<Hash>;
    superPaymasterSlashOperator: (args: { operator: Address, amount: bigint, reason: string, account?: Account | Address }) => Promise<Hash>;
    
    // Price & Configuration
    superPaymasterSetAPNTsPrice: (args: { priceUSD: bigint, account?: Account | Address }) => Promise<Hash>;
    superPaymasterSetCachedPrice: (args: { price: bigint, account?: Account | Address }) => Promise<Hash>;
    superPaymasterSetProtocolFee: (args: { feeRecipient: Address, feeBps: bigint, account?: Account | Address }) => Promise<Hash>;
    
    // User Management  
    superPaymasterBlockUser: (args: { user: Address, blocked: boolean, account?: Account | Address }) => Promise<Hash>;
    superPaymasterUpdateBlockedStatus: (args: { user: Address, blocked: boolean, account?: Account | Address }) => Promise<Hash>;
    
    // Validation (EntryPoint calls)
    superPaymasterValidatePaymasterUserOp: (args: { userOp: any, userOpHash: Hex, maxCost: bigint }) => Promise<any>;
    superPaymasterPostOp: (args: { mode: number, context: Hex, actualGasCost: bigint, actualUserOpFeePerGas: bigint }) => Promise<void>;
    
    // View Functions
    superPaymasterOperators: (args: { operator: Address }) => Promise<any>;
    superPaymasterGetDeposit: () => Promise<bigint>;
    superPaymasterGetAvailableCredit: (args: { operator: Address, user: Address }) => Promise<bigint>;
    superPaymasterBlockedUsers: (args: { user: Address }) => Promise<boolean>;
    superPaymasterBalanceOfOperator: (args: { operator: Address }) => Promise<bigint>; 
    superPaymasterAPNTsPriceUSD: () => Promise<bigint>;
    superPaymasterCachedPrice: () => Promise<any>;
    superPaymasterProtocolFee: () => Promise<any>;
    superPaymasterProtocolFeeBPS: () => Promise<bigint>;
    superPaymasterProtocolRevenue: () => Promise<bigint>;
    superPaymasterTreasury: () => Promise<Address>;
    superPaymasterXpntsFactory: () => Promise<Address>;
    superPaymasterEntryPoint: () => Promise<Address>;
    superPaymasterTotalTrackedBalance: () => Promise<bigint>;
    superPaymasterLastUserOpTimestamp: (args: { user: Address }) => Promise<bigint>;
    
    // Slash History
    superPaymasterGetSlashHistory: (args: { operator: Address }) => Promise<any[]>;
    superPaymasterGetSlashCount: (args: { operator: Address }) => Promise<bigint>;
    superPaymasterGetLatestSlash: (args: { operator: Address }) => Promise<any>;
    superPaymasterSlashHistory: (args: { operator: Address, index: bigint }) => Promise<any>;
    
    // Price Management
    superPaymasterUpdatePrice: (args: { account?: Account | Address }) => Promise<Hash>;
    superPaymasterUpdatePriceDVT: (args: { price: bigint, proof: Hex, account?: Account | Address }) => Promise<Hash>;
    
    // Treasury & Revenue
    superPaymasterSetTreasury: (args: { treasury: Address, account?: Account | Address }) => Promise<Hash>;
    superPaymasterWithdrawProtocolRevenue: (args: { to: Address, account?: Account | Address }) => Promise<Hash>;
    
    // Factory
    superPaymasterSetXPNTsFactory: (args: { factory: Address, account?: Account | Address }) => Promise<Hash>;
    superPaymasterSetAPNTsToken: (args: { token: Address, account?: Account | Address }) => Promise<Hash>;
    superPaymasterSetBLSAggregator: (args: { aggregator: Address, account?: Account | Address }) => Promise<Hash>;
    
    // Transfer callback
    superPaymasterOnTransferReceived: (args: { from: Address, amount: bigint, data: Hex }) => Promise<any>;
    
    // Withdraw alias
    superPaymasterWithdrawAPNTs: (args: { amount: bigint, account?: Account | Address }) => Promise<Hash>;
    
    // Constants
    superPaymasterAPNTS_TOKEN: () => Promise<Address>;
    superPaymasterREGISTRY: () => Promise<Address>;
    superPaymasterBLS_AGGREGATOR: () => Promise<Address>;
    superPaymasterETH_USD_PRICE_FEED: () => Promise<Address>;
    superPaymasterPAYMASTER_DATA_OFFSET: () => Promise<bigint>;
    superPaymasterRATE_OFFSET: () => Promise<bigint>;
    superPaymasterBPS_DENOMINATOR: () => Promise<bigint>;
    superPaymasterPRICE_CACHE_DURATION: () => Promise<bigint>;
    superPaymasterPRICE_STALENESS_THRESHOLD: () => Promise<bigint>;
    superPaymasterMAX_ETH_USD_PRICE: () => Promise<bigint>;
    superPaymasterMIN_ETH_USD_PRICE: () => Promise<bigint>;
    
    // Admin
    transferSuperPaymasterOwnership: (args: { newOwner: Address, account?: Account | Address }) => Promise<Hash>;
    superPaymasterOwner: () => Promise<Address>;
    renounceSuperPaymasterOwnership: (args: { account?: Account | Address }) => Promise<Hash>;
    
    // Aliases for ABI Compliance (Internal usage)
    superPaymasterAddStake: (args: { amount: bigint, account?: Account | Address }) => Promise<Hash>;
    superPaymasterDepositForAlias: (args: { operator: Address, amount: bigint, account?: Account | Address }) => Promise<Hash>;
    superPaymasterUnlockStake: (args: { account?: Account | Address }) => Promise<Hash>;
    superPaymasterWithdraw: (args: { amount: bigint, account?: Account | Address }) => Promise<Hash>;
    superPaymasterWithdrawAlias: (args: { amount: bigint, account?: Account | Address }) => Promise<Hash>;
    
    // Missing Constants & Views
    superPaymasterMAX_PROTOCOL_FEE: () => Promise<bigint>;
    superPaymasterVALIDATION_BUFFER_BPS: () => Promise<bigint>;
    superPaymasterPriceStalenessThreshold: () => Promise<bigint>;
    superPaymasterSbtHolders: (args: { user: Address }) => Promise<boolean>;
    superPaymasterUserOpState: (args: { userOpHash: Hex }) => Promise<any>;
    superPaymasterUpdateSBTStatus: (args: { user: Address, hasSBT: boolean, account?: Account | Address }) => Promise<Hash>;
    
    superPaymasterVersion: () => Promise<string>;
};

export const superPaymasterActions = (address: Address) => (client: PublicClient | WalletClient): SuperPaymasterActions => ({
    // Deposit & Withdrawal
    async superPaymasterDeposit({ amount, account }: { amount: bigint, account?: Account | Address }) {
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
    async superPaymasterDepositAPNTs({ amount, account }: { amount: bigint, account?: Account | Address }) {
        return this.superPaymasterDeposit({ amount, account });
    },

    // depositETH - uses native ETH (payable, no args)
    async superPaymasterDepositETH({ value, account }: { value: bigint, account?: Account | Address }) {
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

    async superPaymasterWithdraw({ amount, account }: { amount: bigint, account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'withdraw',
            args: [amount],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async superPaymasterDepositFor({ operator, amount, account }: { operator: Address, amount: bigint, account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'depositFor',
            args: [operator, amount],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async superPaymasterWithdrawTo({ to, amount, account }: { to: Address, amount: bigint, account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'withdrawTo',
            args: [to, amount],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async superPaymasterAddSuperStake({ amount, account }: { amount: bigint, account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'addStake',
            args: [amount],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async superPaymasterUnlockSuperStake({ account }: { account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'unlockStake',
            args: [],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async superPaymasterWithdrawStake({ to, account }: { to: Address, account?: Account | Address }) {
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
    async superPaymasterConfigureOperator({ xPNTsToken, treasury, exchangeRate, account }: { xPNTsToken: Address, treasury: Address, exchangeRate: bigint, account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'configureOperator',
            args: [xPNTsToken, treasury, exchangeRate],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async superPaymasterSetOperatorPaused({ operator, paused, account }: { operator: Address, paused: boolean, account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'setOperatorPaused',
            args: [operator, paused],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async superPaymasterUpdateReputation({ operator, newReputation, account }: { operator: Address, newReputation: bigint, account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'updateReputation',
            args: [operator, newReputation],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async superPaymasterExecuteSlashWithBLS({ operator, roleId, amount, reason, blsSignature, account }: { operator: Address, roleId: Hex, amount: bigint, reason: string, blsSignature: Hex, account?: Account | Address }) {
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
    async superPaymasterSetAPNTsPrice({ priceUSD, account }: { priceUSD: bigint, account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'setAPNTsPrice',
            args: [priceUSD],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async superPaymasterSetCachedPrice({ price, account }: { price: bigint, account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'setCachedPrice',
            args: [price],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async superPaymasterSetProtocolFee({ feeRecipient, feeBps, account }: { feeRecipient: Address, feeBps: bigint, account?: Account | Address }) {
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
    async superPaymasterBlockUser({ user, blocked, account }: { user: Address, blocked: boolean, account?: Account | Address }) {
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
    async superPaymasterValidatePaymasterUserOp({ userOp, userOpHash, maxCost }: { userOp: any, userOpHash: Hex, maxCost: bigint }) {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'validatePaymasterUserOp',
            args: [userOp, userOpHash, maxCost]
        });
    },

    async superPaymasterPostOp({ mode, context, actualGasCost, actualUserOpFeePerGas }: { mode: number, context: Hex, actualGasCost: bigint, actualUserOpFeePerGas: bigint }) {
        // postOp is called by EntryPoint, typically not called directly
        throw new Error('postOp is called by EntryPoint after UserOp execution');
    },

    // View Functions
    async superPaymasterOperators({ operator }: { operator: Address }) {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'operators',
            args: [operator]
        });
    },

    async superPaymasterGetDeposit() {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'getDeposit',
            args: []
        }) as Promise<bigint>;
    },

    async superPaymasterGetAvailableCredit({ operator, user }: { operator: Address, user: Address }) {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'getAvailableCredit',
            args: [operator, user]
        }) as Promise<bigint>;
    },

    async superPaymasterBlockedUsers({ user }: { user: Address }) {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'blockedUsers',
            args: [user]
        }) as Promise<boolean>;
    },

    // Convenience function: Get operator's aPNTs balance
    async superPaymasterBalanceOfOperator({ operator }: { operator: Address }) {
        const operatorConfig = await this.superPaymasterOperators({ operator });
        return operatorConfig[0]; // aPNTsBalance is the first field
    },

    async superPaymasterAPNTsPriceUSD() {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'aPNTsPriceUSD',
            args: []
        }) as Promise<bigint>;
    },

    async superPaymasterCachedPrice() {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'cachedPrice',
            args: []
        });
    },

    async superPaymasterProtocolFee() {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'protocolFee',
            args: []
        });
    },

    async superPaymasterEntryPoint() {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'entryPoint',
            args: []
        }) as Promise<Address>;
    },

    // Constants
    async superPaymasterAPNTS_TOKEN() {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'APNTS_TOKEN',
            args: []
        }) as Promise<Address>;
    },

    async superPaymasterREGISTRY() {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'REGISTRY',
            args: []
        }) as Promise<Address>;
    },

    async superPaymasterBLS_AGGREGATOR() {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'BLS_AGGREGATOR',
            args: []
        }) as Promise<Address>;
    },

    async superPaymasterETH_USD_PRICE_FEED() {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'ETH_USD_PRICE_FEED',
            args: []
        }) as Promise<Address>;
    },

    async superPaymasterPAYMASTER_DATA_OFFSET() {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'PAYMASTER_DATA_OFFSET',
            args: []
        }) as Promise<bigint>;
    },

    async superPaymasterRATE_OFFSET() {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'RATE_OFFSET',
            args: []
        }) as Promise<bigint>;
    },

    async superPaymasterBPS_DENOMINATOR() {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'BPS_DENOMINATOR',
            args: []
        }) as Promise<bigint>;
    },

    async superPaymasterPRICE_CACHE_DURATION() {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'PRICE_CACHE_DURATION',
            args: []
        }) as Promise<bigint>;
    },

    async superPaymasterPRICE_STALENESS_THRESHOLD() {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'PRICE_STALENESS_THRESHOLD',
            args: []
        }) as Promise<bigint>;
    },

    async superPaymasterMAX_ETH_USD_PRICE() {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'MAX_ETH_USD_PRICE',
            args: []
        }) as Promise<bigint>;
    },

    async superPaymasterMIN_ETH_USD_PRICE() {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'MIN_ETH_USD_PRICE',
            args: []
        }) as Promise<bigint>;
    },

    // Admin
    async transferSuperPaymasterOwnership({ newOwner, account }: { newOwner: Address, account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'transferOwnership',
            args: [newOwner],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async superPaymasterOwner() {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'owner',
            args: []
        }) as Promise<Address>;
    },

    async renounceSuperPaymasterOwnership({ account }: { account?: Account | Address }) {
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
    async superPaymasterSetOperatorLimits({ operator, limits, account }: { operator: Address, limits: any, account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'setOperatorLimits',
            args: [operator, limits],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async superPaymasterSlashOperator({ operator, amount, reason, account }: { operator: Address, amount: bigint, reason: string, account?: Account | Address }) {
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
    async superPaymasterUpdateBlockedStatus({ user, blocked, account }: { user: Address, blocked: boolean, account?: Account | Address }) {
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
    async superPaymasterProtocolFeeBPS() {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'protocolFeeBPS',
            args: []
        }) as Promise<bigint>;
    },

    async superPaymasterProtocolRevenue() {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'protocolRevenue',
            args: []
        }) as Promise<bigint>;
    },

    async superPaymasterTreasury() {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'treasury',
            args: []
        }) as Promise<Address>;
    },

    async superPaymasterXpntsFactory() {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'xpntsFactory',
            args: []
        }) as Promise<Address>;
    },

    async superPaymasterTotalTrackedBalance() {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'totalTrackedBalance',
            args: []
        }) as Promise<bigint>;
    },

    async superPaymasterLastUserOpTimestamp({ user }: { user: Address }) {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'lastUserOpTimestamp',
            args: [user]
        }) as Promise<bigint>;
    },

    // Slash History
    async superPaymasterGetSlashHistory({ operator }: { operator: Address }) {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'getSlashHistory',
            args: [operator]
        }) as Promise<any[]>;
    },

    async superPaymasterGetSlashCount({ operator }: { operator: Address }) {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'getSlashCount',
            args: [operator]
        }) as Promise<bigint>;
    },

    async superPaymasterGetLatestSlash({ operator }: { operator: Address }) {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'getLatestSlash',
            args: [operator]
        });
    },

    async superPaymasterSlashHistory({ operator, index }: { operator: Address, index: bigint }) {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'slashHistory',
            args: [operator, index]
        });
    },

    // Price Management
    async superPaymasterUpdatePrice({ account }: { account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'updatePrice',
            args: [],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async superPaymasterUpdatePriceDVT({ price, proof, account }: { price: bigint, proof: Hex, account?: Account | Address }) {
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
    async superPaymasterSetTreasury({ treasury, account }: { treasury: Address, account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'setTreasury',
            args: [treasury],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async superPaymasterWithdrawProtocolRevenue({ to, account }: { to: Address, account?: Account | Address }) {
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
    async superPaymasterSetXPNTsFactory({ factory, account }: { factory: Address, account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'setXPNTsFactory',
            args: [factory],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async superPaymasterSetAPNTsToken({ token, account }: { token: Address, account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'setAPNTsToken',
            args: [token],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async superPaymasterSetBLSAggregator({ aggregator, account }: { aggregator: Address, account?: Account | Address }) {
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
    async superPaymasterOnTransferReceived({ from, amount, data }: { from: Address, amount: bigint, data: Hex }) {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'onTransferReceived',
            args: [from, amount, data]
        });
    },

    // Withdraw alias
    async superPaymasterWithdrawAPNTs({ amount, account }: { amount: bigint, account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'withdraw',
            args: [amount],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async superPaymasterVersion() {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'version',
            args: []
        }) as Promise<string>;
    },

    // Aliases including implementation
    async superPaymasterAddStake(args: any) { return (this as any).superPaymasterDepositFor(args); },
    async superPaymasterDepositForAlias(args: any) { return (this as any).superPaymasterDepositFor(args); },
    async superPaymasterUnlockStake(args: any) { return (this as any).superPaymasterUnlockSuperStake(args); },
    async superPaymasterWithdrawAlias(args: any) { return (this as any).superPaymasterWithdraw(args); },

    async superPaymasterMAX_PROTOCOL_FEE() {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'MAX_PROTOCOL_FEE',
            args: []
        }) as Promise<bigint>;
    },

    async superPaymasterVALIDATION_BUFFER_BPS() {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'VALIDATION_BUFFER_BPS',
            args: []
        }) as Promise<bigint>;
    },

    async superPaymasterPriceStalenessThreshold() {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'priceStalenessThreshold', // Assuming ABI has this exact name
            args: []
        }) as Promise<bigint>;
    },
    
    async superPaymasterSbtHolders({ user }) {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'sbtHolders',
            args: [user]
        }) as Promise<boolean>;
    },

    async superPaymasterUserOpState({ userOpHash }) {
        return (client as PublicClient).readContract({
            address,
            abi: SuperPaymasterABI,
            functionName: 'userOpState',
            args: [userOpHash]
        });
    },

    async superPaymasterUpdateSBTStatus({ user, hasSBT, account }) {
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
