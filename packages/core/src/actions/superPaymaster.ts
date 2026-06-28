import { type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account, zeroAddress } from 'viem';
import { SuperPaymasterABI } from '../abis/index.js';
import { validateAddress, validateRequired, validateAmount } from '../validators/index.js';
import { AAStarError, ErrorCode } from '../errors/index.js';

/**
 * ERC-4337 v0.7 PackedUserOperation tuple, matching the `struct PackedUserOperation`
 * input of `dryRunValidation` / `validatePaymasterUserOp` in the SuperPaymaster ABI.
 * Field order is load-bearing: viem encodes the tuple positionally from this shape.
 */
export type PackedUserOperation = {
    sender: Address;
    nonce: bigint;
    initCode: Hex;
    callData: Hex;
    accountGasLimits: Hex;
    preVerificationGas: bigint;
    gasFees: Hex;
    paymasterAndData: Hex;
    signature: Hex;
};

/**
 * Result of an off-chain `dryRunValidation` pre-flight check.
 * `ok` mirrors whether the paymaster would accept the UserOp; `reasonCode` is a
 * bytes32 machine-readable rejection code (zero when `ok` is true).
 */
export type DryRunValidationResult = {
    ok: boolean;
    reasonCode: Hex;
};

export type SlashRecord = {
    timestamp: bigint;
    amount: bigint;
    reputationLoss: bigint;
    reason: string;
    level: number;
};

export type OperatorConfig = {
    aPNTsBalance: bigint;
    // exchangeRate removed in v5.3.3: read live from xPNTsToken.exchangeRate() at runtime
    isConfigured: boolean;
    isPaused: boolean;
    xPNTsToken: Address;
    reputation: number;
    minTxInterval: number;
    treasury: Address;
    totalSpent: bigint;
    totalTxSponsored: bigint;
};

/**
 * Runtime-resolved aPNTs token state read live from the SuperPaymaster contract.
 *
 * The contract exposes the currently active token via `APNTS_TOKEN()` and an
 * upcoming (timelocked) token via `pendingAPNTsToken()` / `pendingAPNTsTokenEta()`.
 * Consumers should prefer `active` and may surface `pending` to warn about an
 * upcoming migration.
 */
export type ResolvedAPNTsToken = {
    /** Currently active aPNTs token address, read from `APNTS_TOKEN()`. */
    active: Address;
    /** aPNTs token queued for migration; `zeroAddress` when none is queued. */
    pending: Address;
    /** Unix-second ETA when the pending change becomes executable; `0n` when none is queued. */
    pendingEta: bigint;
    /** True only when `active` came from the explicit `fallback` option after a failed chain read. */
    fallbackUsed: boolean;
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
    configureOperator: (args: { xPNTsToken: Address, opTreasury: Address, account?: Account | Address }) => Promise<Hash>;
    setOperatorPaused: (args: { operator: Address, paused: boolean, account?: Account | Address }) => Promise<Hash>;
    setOperatorLimits: (args: { minTxInterval: number, account?: Account | Address }) => Promise<Hash>;
    updateReputation: (args: { operator: Address, newScore: bigint, account?: Account | Address }) => Promise<Hash>;
    executeSlashWithBLS: (args: { operator: Address, level: number, proof: Hex, account?: Account | Address }) => Promise<Hash>;
    slashOperator: (args: { operator: Address, level: number, penaltyAmount: bigint, reason: string, account?: Account | Address }) => Promise<Hash>;
    /**
     * Two-step slash guard (v5.4.1-rc.1 #249): queue a pending slash for `operator`.
     * Both {@link slashOperator} and {@link executeSlashWithBLS} now revert with
     * `SlashPending()` unless `_pendingSlash[operator]` was set first via this call,
     * and `withdraw()` reverts while it is set (closes the slash-escape window).
     * Governance-gated.
     */
    queueSlash: (args: { operator: Address, account?: Account | Address }) => Promise<Hash>;
    /** Cancel a queued slash (governance escape hatch); clears the pending-slash flag. */
    cancelSlash: (args: { operator: Address, account?: Account | Address }) => Promise<Hash>;

    // User & SBT Management
    updateBlockedStatus: (args: { operator: Address, users: Address[], statuses: boolean[], account?: Account | Address }) => Promise<Hash>;
    updateSBTStatus: (args: { user: Address, status: boolean, account?: Account | Address }) => Promise<Hash>;

    // Pending-Debt Reconciliation (operator)
    /** Read the unrecovered debt recorded for a user after a failed burn/recordDebt. */
    pendingDebts: (args: { token: Address, user: Address }) => Promise<bigint>;
    /** Operator retries recovering up to `amount` of the user's pending debt. */
    retryPendingDebt: (args: { token: Address, user: Address, amount: bigint, account?: Account | Address }) => Promise<Hash>;
    /** Operator force-clears the user's pending-debt entry without recording it. */
    clearPendingDebt: (args: { token: Address, user: Address, account?: Account | Address }) => Promise<Hash>;
    
    // Price Management
    setAPNTSPrice: (args: { newPrice: bigint, account?: Account | Address }) => Promise<Hash>;
    updatePrice: (args: { account?: Account | Address }) => Promise<Hash>;
    updatePriceDVT: (args: { price: bigint, updatedAt: bigint, proof: Hex, account?: Account | Address }) => Promise<Hash>;
    
    // Global Config
    setProtocolFee: (args: { newFeeBPS: bigint, account?: Account | Address }) => Promise<Hash>;
    setTreasury: (args: { treasury: Address, account?: Account | Address }) => Promise<Hash>;
    setXPNTsFactory: (args: { factory: Address, account?: Account | Address }) => Promise<Hash>;
    setAPNTsToken: (args: { token: Address, account?: Account | Address }) => Promise<Hash>;
    /** @deprecated The deployed SuperPaymaster ABI has no direct `setBLSAggregator` — the aggregator change is timelocked via {@link queueBLSAggregator} + {@link applyBLSAggregator}. Throws {@link ErrorCode.NOT_IMPLEMENTED}. */
    setBLSAggregator: (args: { aggregator: Address, account?: Account | Address }) => Promise<Hash>;
    withdrawProtocolRevenue: (args: { to: Address, amount: bigint, account?: Account | Address }) => Promise<Hash>;

    // Timelocked aPNTs Token Migration (setAPNTsToken queues the change)
    executeAPNTsTokenChange: (args: { account?: Account | Address }) => Promise<Hash>;
    cancelAPNTsTokenChange: (args: { account?: Account | Address }) => Promise<Hash>;
    pendingAPNTsToken: () => Promise<Address>;
    pendingAPNTsTokenEta: () => Promise<bigint>;
    /**
     * Resolve the live aPNTs token address from chain instead of relying on a static constant.
     *
     * Reads `APNTS_TOKEN()` (active), `pendingAPNTsToken()` and `pendingAPNTsTokenEta()`
     * in parallel and returns them as a structured result. Prefer `active` for runtime use.
     *
     * If `fallback` is supplied and the chain reads fail, the static `fallback` address is
     * returned with `fallbackUsed: true` (pending fields zeroed). Without a `fallback` the
     * underlying error is re-thrown rather than silently masked.
     */
    resolveAPNTsToken: (args?: { fallback?: Address }) => Promise<ResolvedAPNTsToken>;

    // Emergency Price (kill switch)
    emergencySetPrice: (args: { newPrice: bigint, account?: Account | Address }) => Promise<Hash>;
    executeEmergencyPrice: (args: { account?: Account | Address }) => Promise<Hash>;
    cancelEmergencyPrice: (args: { account?: Account | Address }) => Promise<Hash>;
    emergencyPendingPrice: () => Promise<bigint>;
    emergencyActivatedAt: () => Promise<bigint>;
    emergencyQueuedAt: () => Promise<bigint>;
    EMERGENCY_TIMELOCK: () => Promise<bigint>;

    // BLS Aggregator Timelock (setBLSAggregator sets directly; queue/apply is timelocked)
    queueBLSAggregator: (args: { aggregator: Address, account?: Account | Address }) => Promise<Hash>;
    applyBLSAggregator: (args: { account?: Account | Address }) => Promise<Hash>;
    /**
     * One-time BLS_AGGREGATOR wiring for a fresh deploy (v5.4.1-rc.1 #S3): callable
     * only while `BLS_AGGREGATOR == address(0)`; `onlyOwner`, no timelock. To change
     * an already-set aggregator use {@link queueBLSAggregator} + {@link applyBLSAggregator}.
     */
    initBLSAggregator: (args: { aggregator: Address, account?: Account | Address }) => Promise<Hash>;

    // Callbacks
    onTransferReceived: (args: { operator: Address, from: Address, value: bigint, data: Hex }) => Promise<Hex>;
    
    // Validation
    validatePaymasterUserOp: (args: { userOp: any, userOpHash: Hex, maxCost: bigint }) => Promise<{ context: Hex, validationData: bigint }>;
    /**
     * Off-chain pre-flight validation of a UserOp against this paymaster.
     * Returns `{ ok, reasonCode }` so callers can detect AA34-style rejections
     * before submitting the UserOp on-chain. View call; never mutates state.
     */
    dryRunValidation: (args: { userOp: PackedUserOperation, maxCost: bigint }) => Promise<DryRunValidationResult>;
    
    // View Functions
    operators: (args: { operator: Address }) => Promise<OperatorConfig>;
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
    /** True when the Chainlink ETH/USD feed is considered stale by the contract. */
    isChainlinkStale: () => Promise<boolean>;
    /** Current pricing mode (uint8 enum on the contract). */
    priceMode: () => Promise<number>;
    /** Unix-second timestamp until which the cached price remains valid (uint48). */
    priceValidUntil: () => Promise<bigint>;
    /** Address of the BLS aggregator pending the timelock (`zeroAddress` if none queued). */
    pendingBLSAgg: () => Promise<Address>;
    /** Unix-second ETA at which the pending BLS aggregator change becomes executable (uint48). */
    pendingBLSAggEta: () => Promise<bigint>;
    
    // Constants
    APNTS_TOKEN: () => Promise<Address>;
    REGISTRY: () => Promise<Address>;
    BLS_AGGREGATOR: () => Promise<Address>;
    ETH_USD_PRICE_FEED: () => Promise<Address>;
    treasury: () => Promise<Address>;
    xpntsFactory: () => Promise<Address>;
    entryPoint: () => Promise<Address>;
    /** @deprecated Removed in the v5.x contract refactor — not in the deployed SuperPaymaster ABI. Throws {@link ErrorCode.NOT_IMPLEMENTED}. */
    MAX_PROTOCOL_FEE: () => Promise<bigint>;
    /** @deprecated Removed from SuperPaymaster in the v5.x refactor (this bound belongs to the standalone Paymaster contract). Throws {@link ErrorCode.NOT_IMPLEMENTED}. */
    MAX_ETH_USD_PRICE: () => Promise<bigint>;
    /** @deprecated Removed from SuperPaymaster in the v5.x refactor (this bound belongs to the standalone Paymaster contract). Throws {@link ErrorCode.NOT_IMPLEMENTED}. */
    MIN_ETH_USD_PRICE: () => Promise<bigint>;
    /** @deprecated Removed in the v5.x contract refactor — not in the deployed SuperPaymaster ABI. Throws {@link ErrorCode.NOT_IMPLEMENTED}. */
    PAYMASTER_DATA_OFFSET: () => Promise<bigint>;
    /** @deprecated Removed in the v5.x contract refactor — not in the deployed SuperPaymaster ABI. Throws {@link ErrorCode.NOT_IMPLEMENTED}. */
    PRICE_CACHE_DURATION: () => Promise<bigint>;
    /** @deprecated Removed in the v5.x contract refactor — not in the deployed SuperPaymaster ABI. Throws {@link ErrorCode.NOT_IMPLEMENTED}. */
    RATE_OFFSET: () => Promise<bigint>;
    /** @deprecated Removed in the v5.x contract refactor — not in the deployed SuperPaymaster ABI. Throws {@link ErrorCode.NOT_IMPLEMENTED}. */
    VALIDATION_BUFFER_BPS: () => Promise<bigint>;
    /** @deprecated Removed in the v5.x contract refactor — not in the deployed SuperPaymaster ABI. Throws {@link ErrorCode.NOT_IMPLEMENTED}. */
    BPS_DENOMINATOR: () => Promise<bigint>;
    /** Duration (seconds) of the aPNTs-token-change timelock. */
    APNTS_TOKEN_TIMELOCK: () => Promise<bigint>;
    
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
    async configureOperator({ xPNTsToken, opTreasury, account }) {
        try {
            validateAddress(xPNTsToken, 'xPNTsToken');
            validateAddress(opTreasury, 'opTreasury');
            return await (client as any).writeContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'configureOperator',
                args: [xPNTsToken, opTreasury],
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

    async queueSlash({ operator, account }) {
        try {
            validateAddress(operator, 'operator');
            return await (client as any).writeContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'queueSlash',
                args: [operator],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'queueSlash');
        }
    },

    async cancelSlash({ operator, account }) {
        try {
            validateAddress(operator, 'operator');
            return await (client as any).writeContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'cancelSlash',
                args: [operator],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'cancelSlash');
        }
    },

    async initBLSAggregator({ aggregator, account }) {
        try {
            validateAddress(aggregator, 'aggregator');
            return await (client as any).writeContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'initBLSAggregator',
                args: [aggregator],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'initBLSAggregator');
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

    // Pending-Debt Reconciliation
    async pendingDebts({ token, user }) {
        try {
            validateAddress(token, 'token');
            validateAddress(user, 'user');
            return await (client as PublicClient).readContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'pendingDebts',
                args: [token, user]
            }) as bigint;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'pendingDebts');
        }
    },

    async retryPendingDebt({ token, user, amount, account }) {
        try {
            validateAddress(token, 'token');
            validateAddress(user, 'user');
            validateAmount(amount, 'amount');
            return await (client as any).writeContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'retryPendingDebt',
                args: [token, user, amount],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'retryPendingDebt');
        }
    },

    async clearPendingDebt({ token, user, account }) {
        try {
            validateAddress(token, 'token');
            validateAddress(user, 'user');
            return await (client as any).writeContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'clearPendingDebt',
                args: [token, user],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'clearPendingDebt');
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

    async setBLSAggregator({ aggregator }) {
        // The deployed SuperPaymaster ABI has no direct `setBLSAggregator`: the aggregator
        // change is timelocked. Validate then throw, pointing callers at the two-step path.
        validateAddress(aggregator, 'aggregator');
        throw new AAStarError(
            ErrorCode.NOT_IMPLEMENTED,
            'setBLSAggregator is not available on this SuperPaymaster: the aggregator change is ' +
            'timelocked. Use queueBLSAggregator({ aggregator }) then applyBLSAggregator() after ' +
            'the timelock elapses.'
        );
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

    // Timelocked aPNTs Token Migration
    /** Execute a queued aPNTs token change after the timelock has elapsed. */
    async executeAPNTsTokenChange({ account }) {
        try {
            return await (client as any).writeContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'executeAPNTsTokenChange',
                args: [],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'executeAPNTsTokenChange');
        }
    },

    /** Cancel a queued aPNTs token change before it is executed. */
    async cancelAPNTsTokenChange({ account }) {
        try {
            return await (client as any).writeContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'cancelAPNTsTokenChange',
                args: [],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'cancelAPNTsTokenChange');
        }
    },

    /** Address of the aPNTs token pending migration (zero if none queued). */
    async pendingAPNTsToken() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'pendingAPNTsToken',
                args: []
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'pendingAPNTsToken');
        }
    },

    /** ETA (unix timestamp) at which the pending aPNTs token change becomes executable. */
    async pendingAPNTsTokenEta() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'pendingAPNTsTokenEta',
                args: []
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'pendingAPNTsTokenEta');
        }
    },

    /**
     * Resolve the live aPNTs token address (active + pending) from chain.
     * See {@link SuperPaymasterActions.resolveAPNTsToken} for fallback semantics.
     */
    async resolveAPNTsToken(args?: { fallback?: Address }) {
        const pub = client as PublicClient;
        try {
            const [active, pending, pendingEta] = await Promise.all([
                pub.readContract({ address, abi: SuperPaymasterABI, functionName: 'APNTS_TOKEN', args: [] }) as Promise<Address>,
                pub.readContract({ address, abi: SuperPaymasterABI, functionName: 'pendingAPNTsToken', args: [] }) as Promise<Address>,
                pub.readContract({ address, abi: SuperPaymasterABI, functionName: 'pendingAPNTsTokenEta', args: [] }) as Promise<bigint>,
            ]);
            return { active, pending, pendingEta, fallbackUsed: false };
        } catch (error) {
            // Only mask the failure when the caller explicitly opted into a static fallback.
            if (args?.fallback) {
                return { active: args.fallback, pending: zeroAddress, pendingEta: 0n, fallbackUsed: true };
            }
            throw AAStarError.fromViemError(error as Error, 'resolveAPNTsToken');
        }
    },

    // Emergency Price (kill switch)
    /** Queue an emergency price (int256) subject to the emergency timelock. */
    async emergencySetPrice({ newPrice, account }) {
        try {
            validateRequired(newPrice, 'newPrice');
            return await (client as any).writeContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'emergencySetPrice',
                args: [newPrice],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'emergencySetPrice');
        }
    },

    /** Execute a queued emergency price after the emergency timelock has elapsed. */
    async executeEmergencyPrice({ account }) {
        try {
            return await (client as any).writeContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'executeEmergencyPrice',
                args: [],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'executeEmergencyPrice');
        }
    },

    /** Cancel a queued emergency price before it is executed. */
    async cancelEmergencyPrice({ account }) {
        try {
            return await (client as any).writeContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'cancelEmergencyPrice',
                args: [],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'cancelEmergencyPrice');
        }
    },

    /** Pending emergency price (int256) awaiting execution. */
    async emergencyPendingPrice() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'emergencyPendingPrice',
                args: []
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'emergencyPendingPrice');
        }
    },

    /** Timestamp at which the emergency price was activated (0 if inactive). */
    async emergencyActivatedAt() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'emergencyActivatedAt',
                args: []
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'emergencyActivatedAt');
        }
    },

    /** Timestamp at which the emergency price was queued (0 if none queued). */
    async emergencyQueuedAt() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'emergencyQueuedAt',
                args: []
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'emergencyQueuedAt');
        }
    },

    /** Duration (seconds) of the emergency price timelock. */
    async EMERGENCY_TIMELOCK() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'EMERGENCY_TIMELOCK',
                args: []
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'EMERGENCY_TIMELOCK');
        }
    },

    // BLS Aggregator Timelock
    /** Queue a new BLS aggregator address subject to the timelock. */
    async queueBLSAggregator({ aggregator, account }) {
        try {
            validateAddress(aggregator, 'aggregator');
            return await (client as any).writeContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'queueBLSAggregator',
                args: [aggregator],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'queueBLSAggregator');
        }
    },

    /** Apply a queued BLS aggregator change after the timelock has elapsed. */
    async applyBLSAggregator({ account }) {
        try {
            return await (client as any).writeContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'applyBLSAggregator',
                args: [],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'applyBLSAggregator');
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

    async dryRunValidation({ userOp, maxCost }) {
        try {
            const res = await (client as PublicClient).readContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'dryRunValidation',
                args: [userOp, maxCost]
            }) as any;

            // Solidity returns (bool ok, bytes32 reasonCode); viem decodes to a tuple.
            if (Array.isArray(res)) {
                return { ok: res[0], reasonCode: res[1] };
            }
            return res as DryRunValidationResult;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'dryRunValidation');
        }
    },

    // View Functions
    async operators({ operator }) {
        try {
            validateAddress(operator, 'operator');
            const result = await (client as PublicClient).readContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'operators',
                args: [operator]
            }) as any;

            if (Array.isArray(result)) {
                return {
                    aPNTsBalance: result[0],
                    isConfigured: result[1],
                    isPaused: result[2],
                    xPNTsToken: result[3],
                    reputation: result[4],
                    minTxInterval: result[5],
                    treasury: result[6],
                    totalSpent: result[7],
                    totalTxSponsored: result[8]
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

    /** True when the Chainlink ETH/USD feed is considered stale by the contract. */
    async isChainlinkStale() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'isChainlinkStale',
                args: []
            }) as Promise<boolean>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'isChainlinkStale');
        }
    },

    /** Current pricing mode (uint8 enum). Decoded to a JS number. */
    async priceMode() {
        try {
            const res = await (client as PublicClient).readContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'priceMode',
                args: []
            });
            return Number(res);
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'priceMode');
        }
    },

    /** Unix-second timestamp (uint48) until which the cached price remains valid. */
    async priceValidUntil() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'priceValidUntil',
                args: []
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'priceValidUntil');
        }
    },

    /** Address of the BLS aggregator pending the timelock (zero if none queued). */
    async pendingBLSAgg() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'pendingBLSAgg',
                args: []
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'pendingBLSAgg');
        }
    },

    /** Unix-second ETA (uint48) at which the pending BLS aggregator change becomes executable. */
    async pendingBLSAggEta() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'pendingBLSAggEta',
                args: []
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'pendingBLSAggEta');
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

    // The following constants were removed from the SuperPaymaster ABI in the v5.x refactor
    // (MAX_ETH_USD_PRICE / MIN_ETH_USD_PRICE now live only on the standalone Paymaster
    // contract). Each throws NOT_IMPLEMENTED rather than issuing a call that reverts on-chain.
    async MAX_PROTOCOL_FEE() {
        throw new AAStarError(ErrorCode.NOT_IMPLEMENTED,
            'MAX_PROTOCOL_FEE was removed in the v5.x contract refactor; it is no longer exposed by SuperPaymaster.');
    },

    async MAX_ETH_USD_PRICE() {
        throw new AAStarError(ErrorCode.NOT_IMPLEMENTED,
            'MAX_ETH_USD_PRICE was removed from SuperPaymaster in the v5.x refactor; read it from the standalone Paymaster contract instead.');
    },

    async MIN_ETH_USD_PRICE() {
        throw new AAStarError(ErrorCode.NOT_IMPLEMENTED,
            'MIN_ETH_USD_PRICE was removed from SuperPaymaster in the v5.x refactor; read it from the standalone Paymaster contract instead.');
    },

    async PAYMASTER_DATA_OFFSET() {
        throw new AAStarError(ErrorCode.NOT_IMPLEMENTED,
            'PAYMASTER_DATA_OFFSET was removed in the v5.x contract refactor; it is no longer exposed by SuperPaymaster.');
    },

    async PRICE_CACHE_DURATION() {
        throw new AAStarError(ErrorCode.NOT_IMPLEMENTED,
            'PRICE_CACHE_DURATION was removed in the v5.x contract refactor; it is no longer exposed by SuperPaymaster.');
    },

    async RATE_OFFSET() {
        throw new AAStarError(ErrorCode.NOT_IMPLEMENTED,
            'RATE_OFFSET was removed in the v5.x contract refactor; it is no longer exposed by SuperPaymaster.');
    },

    async VALIDATION_BUFFER_BPS() {
        throw new AAStarError(ErrorCode.NOT_IMPLEMENTED,
            'VALIDATION_BUFFER_BPS was removed in the v5.x contract refactor; it is no longer exposed by SuperPaymaster.');
    },

    async BPS_DENOMINATOR() {
        throw new AAStarError(ErrorCode.NOT_IMPLEMENTED,
            'BPS_DENOMINATOR was removed in the v5.x contract refactor; it is no longer exposed by SuperPaymaster.');
    },

    /** Duration (seconds) of the aPNTs-token-change timelock. */
    async APNTS_TOKEN_TIMELOCK() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: SuperPaymasterABI,
                functionName: 'APNTS_TOKEN_TIMELOCK',
                args: []
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'APNTS_TOKEN_TIMELOCK');
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
