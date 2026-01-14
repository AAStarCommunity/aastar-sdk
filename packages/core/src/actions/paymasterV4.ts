import { type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account } from 'viem';
import { PaymasterV4ABI } from '../abis/index.js';

// PaymasterV4 Actions (Deposit-Only Model v4.3.0)
export type PaymasterV4Actions = {
    // === NEW: Deposit-Only Model ===
    // Deposit Management
    paymasterV4DepositFor: (args: { user: Address, token: Address, amount: bigint, account?: Account | Address }) => Promise<Hash>;
    paymasterV4Withdraw: (args: { token: Address, amount: bigint, account?: Account | Address }) => Promise<Hash>;
    paymasterV4Balances: (args: { user: Address, token: Address }) => Promise<bigint>;
    
    // Token Price Management (Operator/Owner only)
    paymasterV4SetTokenPrice: (args: { token: Address, price: bigint, account?: Account | Address }) => Promise<Hash>;
    paymasterV4TokenPrices: (args: { token: Address }) => Promise<bigint>;
    
    // === DEPRECATED: Legacy V3 APIs (Not in V4 Deposit-Only) ===
    /** @deprecated V4 uses depositFor + tokenPrices instead */
    paymasterV4AddGasToken: (args: { token: Address, priceFeed: Address, account?: Account | Address }) => Promise<Hash>;
    /** @deprecated V4 uses depositFor + tokenPrices instead */
    paymasterV4RemoveGasToken: (args: { token: Address, account?: Account | Address }) => Promise<Hash>;
    /** @deprecated V4 uses depositFor + tokenPrices instead */
    paymasterV4GetSupportedGasTokens: () => Promise<Address[]>;
    /** @deprecated V4 uses depositFor + tokenPrices instead */
    paymasterV4IsGasTokenSupported: (args: { token: Address }) => Promise<boolean>;
    /** @deprecated V4 does not use SBT whitelist */
    paymasterV4AddSBT: (args: { sbt: Address, account?: Account | Address }) => Promise<Hash>;
    /** @deprecated V4 does not use SBT whitelist */
    paymasterV4RemoveSBT: (args: { sbt: Address, account?: Account | Address }) => Promise<Hash>;
    /** @deprecated V4 does not use SBT whitelist */
    paymasterV4GetSupportedSBTs: () => Promise<Address[]>;
    /** @deprecated V4 does not use SBT whitelist */
    paymasterV4IsSBTSupported: (args: { sbt: Address }) => Promise<boolean>;
    
    // Validation (EntryPoint calls)
    paymasterV4ValidatePaymasterUserOp: (args: { userOp: any, userOpHash: Hex, maxCost: bigint }) => Promise<any>;
    paymasterV4PostOp: (args: { mode: number, context: Hex, actualGasCost: bigint, actualUserOpFeePerGas: bigint }) => Promise<void>;
    
    // Deposit & Withdrawal (EntryPoint accounting)
    paymasterV4Deposit: (args: { account?: Account | Address }) => Promise<Hash>;
    paymasterV4WithdrawTo: (args: { to: Address, amount: bigint, account?: Account | Address }) => Promise<Hash>;
    paymasterV4AddStake: (args: { unstakeDelaySec: bigint, amount: bigint, account?: Account | Address }) => Promise<Hash>;
    paymasterV4UnlockPaymasterStake: (args: { account?: Account | Address }) => Promise<Hash>;
    paymasterV4WithdrawStake: (args: { to: Address, account?: Account | Address }) => Promise<Hash>;
    paymasterV4GetDeposit: () => Promise<bigint>;
    
    // EntryPoint
    paymasterV4EntryPoint: () => Promise<Address>;
    
    // Ownership
    paymasterV4Owner: () => Promise<Address>;
    paymasterV4TransferOwnership: (args: { newOwner: Address, account?: Account | Address }) => Promise<Hash>;
    paymasterV4RenounceOwnership: (args: { account?: Account | Address }) => Promise<Hash>;
    
    // View Functions & Constants
    paymasterV4Registry: () => Promise<Address>;
    paymasterV4Treasury: () => Promise<Address>;
    paymasterV4Paused: () => Promise<boolean>;
    paymasterV4MaxGasCostCap: () => Promise<bigint>;
    paymasterV4MaxEthUsdPrice: () => Promise<bigint>;
    paymasterV4MaxGasTokens: () => Promise<bigint>;
    paymasterV4MaxSbts: () => Promise<bigint>;
    paymasterV4MaxServiceFee: () => Promise<bigint>;
    paymasterV4MinEthUsdPrice: () => Promise<bigint>;
    paymasterV4PriceStalenessThreshold: () => Promise<bigint>;
    
    // Aliases
    paymasterV4AddDeposit: (args: { account?: Account | Address }) => Promise<Hash>; // Alias for deposit
    paymasterV4UnlockStake: (args: { account?: Account | Address }) => Promise<Hash>; // Alias for unlockPaymasterStake
    
    // View Functions & Constants (Missing)
    paymasterV4EthUsdPriceFeed: () => Promise<Address>;
    paymasterV4OracleDecimals: () => Promise<number>;
    paymasterV4TokenDecimals: (args: { token: Address }) => Promise<number>;
    paymasterV4ServiceFeeRate: () => Promise<bigint>;
    paymasterV4CalculateCost: (args: { token: Address, gasCost: bigint, param: any }) => Promise<bigint>;
    paymasterV4GetRealtimeTokenCost: (args: { token: Address, gasCost: bigint }) => Promise<bigint>;
    paymasterV4IsActiveInRegistry: () => Promise<boolean>;
    paymasterV4IsRegistrySet: () => Promise<boolean>;
    paymasterV4CachedPriceView: (args: { token: Address }) => Promise<bigint>;
    
    // Admin (Missing)
    paymasterV4SetCachedPrice: (args: { token: Address, price: bigint, account?: Account | Address }) => Promise<Hash>;
    paymasterV4SetServiceFeeRate: (args: { rate: bigint, account?: Account | Address }) => Promise<Hash>;
    paymasterV4SetMaxGasCostCap: (args: { cap: bigint, account?: Account | Address }) => Promise<Hash>;
    paymasterV4SetPriceStalenessThreshold: (args: { threshold: bigint, account?: Account | Address }) => Promise<Hash>;
    paymasterV4SetTreasury: (args: { treasury: Address, account?: Account | Address }) => Promise<Hash>;
    paymasterV4UpdatePrice: (args: { token: Address, account?: Account | Address }) => Promise<Hash>;
    paymasterV4DeactivateFromRegistry: (args: { account?: Account | Address }) => Promise<Hash>;
    paymasterV4Initialize: (args: { owner: Address, account?: Account | Address }) => Promise<Hash>;
    
    paymasterV4Version: () => Promise<string>;
};

export const paymasterV4Actions = (address: Address) => (client: PublicClient | WalletClient): PaymasterV4Actions => ({
    // === NEW: Deposit-Only Model ===
    async paymasterV4DepositFor({ user, token, amount, account }: { user: Address, token: Address, amount: bigint, account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterV4ABI,
            functionName: 'depositFor',
            args: [user, token, amount],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async paymasterV4Withdraw({ token, amount, account }: { token: Address, amount: bigint, account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterV4ABI,
            functionName: 'withdraw',
            args: [token, amount],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async paymasterV4Balances({ user, token }: { user: Address, token: Address }) {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterV4ABI,
            functionName: 'balances',
            args: [user, token]
        }) as Promise<bigint>;
    },

    async paymasterV4SetTokenPrice({ token, price, account }: { token: Address, price: bigint, account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterV4ABI,
            functionName: 'setTokenPrice',
            args: [token, price],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async paymasterV4TokenPrices({ token }: { token: Address }) {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterV4ABI,
            functionName: 'tokenPrices',
            args: [token]
        }) as Promise<bigint>;
    },

    // === DEPRECATED: Legacy Gas Token Management ===
    async paymasterV4AddGasToken({ token, priceFeed, account }: { token: Address, priceFeed: Address, account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterV4ABI,
            functionName: 'addGasToken',
            args: [token, priceFeed],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async paymasterV4RemoveGasToken({ token, account }: { token: Address, account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterV4ABI,
            functionName: 'removeGasToken',
            args: [token],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async paymasterV4GetSupportedGasTokens() {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterV4ABI,
            functionName: 'getSupportedGasTokens',
            args: []
        }) as Promise<Address[]>;
    },

    async paymasterV4IsGasTokenSupported({ token }: { token: Address }) {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterV4ABI,
            functionName: 'isGasTokenSupported',
            args: [token]
        }) as Promise<boolean>;
    },

    // SBT Management
    async paymasterV4AddSBT({ sbt, account }: { sbt: Address, account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterV4ABI,
            functionName: 'addSBT',
            args: [sbt],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async paymasterV4RemoveSBT({ sbt, account }: { sbt: Address, account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterV4ABI,
            functionName: 'removeSBT',
            args: [sbt],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async paymasterV4GetSupportedSBTs() {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterV4ABI,
            functionName: 'getSupportedSBTs',
            args: []
        }) as Promise<Address[]>;
    },

    async paymasterV4IsSBTSupported({ sbt }: { sbt: Address }) {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterV4ABI,
            functionName: 'isSBTSupported',
            args: [sbt]
        }) as Promise<boolean>;
    },

    // Validation
    async paymasterV4ValidatePaymasterUserOp({ userOp, userOpHash, maxCost }: { userOp: any, userOpHash: Hex, maxCost: bigint }) {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterV4ABI,
            functionName: 'validatePaymasterUserOp',
            args: [userOp, userOpHash, maxCost]
        });
    },

    async paymasterV4PostOp({ mode, context, actualGasCost, actualUserOpFeePerGas }: { mode: number, context: Hex, actualGasCost: bigint, actualUserOpFeePerGas: bigint }) {
        throw new Error('postOp is called by EntryPoint, not directly invoked');
    },

    // Deposit & Withdrawal (EntryPoint accounting)
    async paymasterV4Deposit({ account }: { account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterV4ABI,
            functionName: 'deposit',
            args: [],
            account: account as any,
            chain: (client as any).chain,
            value: 0n // Assuming non-payable or handled elsewhere if payable
        });
    },

    async paymasterV4WithdrawTo({ to, amount, account }: { to: Address, amount: bigint, account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterV4ABI,
            functionName: 'withdrawTo',
            args: [to, amount],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async paymasterV4AddStake({ unstakeDelaySec, amount, account }: { unstakeDelaySec: bigint, amount: bigint, account?: Account | Address }) {
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

    async paymasterV4UnlockPaymasterStake({ account }: { account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterV4ABI,
            functionName: 'unlockStake',
            args: [],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async paymasterV4WithdrawStake({ to, account }: { to: Address, account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterV4ABI,
            functionName: 'withdrawStake',
            args: [to],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async paymasterV4GetDeposit() {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterV4ABI,
            functionName: 'getDeposit',
            args: []
        }) as Promise<bigint>;
    },

    // EntryPoint
    async paymasterV4EntryPoint() {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterV4ABI,
            functionName: 'entryPoint',
            args: []
        }) as Promise<Address>;
    },

    // Ownership
    async paymasterV4Owner() {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterV4ABI,
            functionName: 'owner',
            args: []
        }) as Promise<Address>;
    },

    async paymasterV4TransferOwnership({ newOwner, account }: { newOwner: Address, account?: Account | Address }) {
        return (client as any).writeContract({
            address,
            abi: PaymasterV4ABI,
            functionName: 'transferOwnership',
            args: [newOwner],
            account: account as any,
            chain: (client as any).chain
        });
    },

    async paymasterV4RenounceOwnership({ account }: { account?: Account | Address }) {
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
    async paymasterV4Registry() {
        return (client as PublicClient).readContract({ address, abi: PaymasterV4ABI, functionName: 'registry', args: [] }) as Promise<Address>;
    },
    async paymasterV4Treasury() {
        return (client as PublicClient).readContract({ address, abi: PaymasterV4ABI, functionName: 'treasury', args: [] }) as Promise<Address>;
    },
    async paymasterV4Paused() {
        return (client as PublicClient).readContract({ address, abi: PaymasterV4ABI, functionName: 'paused', args: [] }) as Promise<boolean>;
    },
    async paymasterV4MaxGasCostCap() {
        return (client as PublicClient).readContract({ address, abi: PaymasterV4ABI, functionName: 'maxGasCostCap', args: [] }) as Promise<bigint>;
    },
    async paymasterV4MaxEthUsdPrice() {
        return (client as PublicClient).readContract({ address, abi: PaymasterV4ABI, functionName: 'MAX_ETH_USD_PRICE', args: [] }) as Promise<bigint>;
    },
    async paymasterV4MaxGasTokens() {
        return (client as PublicClient).readContract({ address, abi: PaymasterV4ABI, functionName: 'MAX_GAS_TOKENS', args: [] }) as Promise<bigint>;
    },
    async paymasterV4MaxSbts() {
        return (client as PublicClient).readContract({ address, abi: PaymasterV4ABI, functionName: 'MAX_SBTS', args: [] }) as Promise<bigint>;
    },
    async paymasterV4MaxServiceFee() {
        return (client as PublicClient).readContract({ address, abi: PaymasterV4ABI, functionName: 'MAX_SERVICE_FEE', args: [] }) as Promise<bigint>;
    },
    async paymasterV4MinEthUsdPrice() {
        return (client as PublicClient).readContract({ address, abi: PaymasterV4ABI, functionName: 'MIN_ETH_USD_PRICE', args: [] }) as Promise<bigint>;
    },
    async paymasterV4PriceStalenessThreshold() {
        return (client as PublicClient).readContract({ address, abi: PaymasterV4ABI, functionName: 'priceStalenessThreshold', args: [] }) as Promise<bigint>;
    },

    // Aliases
    async paymasterV4AddDeposit(args: { account?: Account | Address }) {
        return this.paymasterV4Deposit(args);
    },
    async paymasterV4UnlockStake(args: { account?: Account | Address }) {
        return this.paymasterV4UnlockPaymasterStake(args);
    },

    // View Functions & Constants (Missing)
    async paymasterV4EthUsdPriceFeed() {
        return (client as PublicClient).readContract({ address, abi: PaymasterV4ABI, functionName: 'ethUsdPriceFeed', args: [] }) as Promise<Address>;
    },
    async paymasterV4OracleDecimals() {
        return (client as PublicClient).readContract({ address, abi: PaymasterV4ABI, functionName: 'oracleDecimals', args: [] }) as Promise<number>;
    },
    async paymasterV4TokenDecimals({ token }: { token: Address }) {
        return (client as PublicClient).readContract({ address, abi: PaymasterV4ABI, functionName: 'tokenDecimals', args: [token] }) as Promise<number>;
    },
    async paymasterV4ServiceFeeRate() {
        return (client as PublicClient).readContract({ address, abi: PaymasterV4ABI, functionName: 'serviceFeeRate', args: [] }) as Promise<bigint>;
    },
    async paymasterV4CalculateCost({ token, gasCost, param }: { token: Address, gasCost: bigint, param: any }) {
        return (client as PublicClient).readContract({ address, abi: PaymasterV4ABI, functionName: 'calculateCost', args: [token, gasCost, param] }) as Promise<bigint>;
    },
    async paymasterV4GetRealtimeTokenCost({ token, gasCost }: { token: Address, gasCost: bigint }) {
         return (client as PublicClient).readContract({ address, abi: PaymasterV4ABI, functionName: 'getRealtimeTokenCost', args: [token, gasCost] }) as Promise<bigint>;
    },
    async paymasterV4IsActiveInRegistry() {
         return (client as PublicClient).readContract({ address, abi: PaymasterV4ABI, functionName: 'isActiveInRegistry', args: [] }) as Promise<boolean>;
    },
    async paymasterV4IsRegistrySet() {
         return (client as PublicClient).readContract({ address, abi: PaymasterV4ABI, functionName: 'isRegistrySet', args: [] }) as Promise<boolean>;
    },
    async paymasterV4CachedPriceView({ token }: { token: Address }) {
         return (client as PublicClient).readContract({ address, abi: PaymasterV4ABI, functionName: 'cachedPrice', args: [token] }) as Promise<bigint>;
    },

    // Admin (Missing)
    async paymasterV4SetCachedPrice({ token, price, account }: { token: Address, price: bigint, account?: Account | Address }) {
         return (client as any).writeContract({ address, abi: PaymasterV4ABI, functionName: 'setCachedPrice', args: [token, price], account: account as any, chain: (client as any).chain });
    },
    async paymasterV4SetServiceFeeRate({ rate, account }: { rate: bigint, account?: Account | Address }) {
         return (client as any).writeContract({ address, abi: PaymasterV4ABI, functionName: 'setServiceFeeRate', args: [rate], account: account as any, chain: (client as any).chain });
    },
    async paymasterV4SetMaxGasCostCap({ cap, account }: { cap: bigint, account?: Account | Address }) {
         return (client as any).writeContract({ address, abi: PaymasterV4ABI, functionName: 'setMaxGasCostCap', args: [cap], account: account as any, chain: (client as any).chain });
    },
    async paymasterV4SetPriceStalenessThreshold({ threshold, account }: { threshold: bigint, account?: Account | Address }) {
         return (client as any).writeContract({ address, abi: PaymasterV4ABI, functionName: 'setPriceStalenessThreshold', args: [threshold], account: account as any, chain: (client as any).chain });
    },
    async paymasterV4SetTreasury({ treasury, account }: { treasury: Address, account?: Account | Address }) {
         return (client as any).writeContract({ address, abi: PaymasterV4ABI, functionName: 'setTreasury', args: [treasury], account: account as any, chain: (client as any).chain });
    },
    async paymasterV4UpdatePrice({ token, account }: { token: Address, account?: Account | Address }) {
         return (client as any).writeContract({ address, abi: PaymasterV4ABI, functionName: 'updatePrice', args: [token], account: account as any, chain: (client as any).chain });
    },
    async paymasterV4DeactivateFromRegistry({ account }: { account?: Account | Address }) {
         return (client as any).writeContract({ address, abi: PaymasterV4ABI, functionName: 'deactivateFromRegistry', args: [], account: account as any, chain: (client as any).chain });
    },
    async paymasterV4Initialize({ owner, account }: { owner: Address, account?: Account | Address }) {
         return (client as any).writeContract({ address, abi: PaymasterV4ABI, functionName: 'initialize', args: [owner], account: account as any, chain: (client as any).chain });
    },

    async paymasterV4Version() {
        return (client as PublicClient).readContract({
            address,
            abi: PaymasterV4ABI,
            functionName: 'version',
            args: []
        }) as Promise<string>;
    }
});
