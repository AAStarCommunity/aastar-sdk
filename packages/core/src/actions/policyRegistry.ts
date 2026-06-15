import { type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account } from 'viem';
import { PolicyRegistryABI } from '../abis/index.js';
import { validateAddress, validateRequired } from '../validators/index.js';
import { AAStarError } from '../errors/index.js';

/**
 * Tri-state result of a validation-time policy read ({@link checkPolicy}).
 * Mirrors `IPolicyRegistry.PolicyDecision` (the on-chain `uint8` enum):
 *   0 ALLOW       — proceed with normal single-signature validation.
 *   1 REQUIRE_DVT — within the hard ceiling but past a configured DVT trigger; the
 *                   consumer MUST additionally verify a >=threshold DVT BLS co-sign.
 *   2 REJECT      — frozen sender, over a hard cap / daily limit, or off-allowlist.
 */
export enum PolicyDecision {
    ALLOW = 0,
    REQUIRE_DVT = 1,
    REJECT = 2,
}

/** Per-(sender, asset) amount policy. Native-unit amounts (no USD oracle). */
export type AssetPolicy = {
    /** Single-tx amount >= this => REQUIRE_DVT; 0 => amount-based trigger DISABLED. */
    dvtTriggerAmount: bigint;
    /** Single-tx amount > this => REJECT (enforced only when configured). */
    perTxHardCap: bigint;
    /** Cumulative spend over `windowSeconds` => REJECT when exceeded. */
    dailyLimit: bigint;
    /** Daily-limit window length in seconds; 0 => DEFAULT_WINDOW (1 day). */
    windowSeconds: bigint;
    /** false => no policy for this (sender, asset) => UNRESTRICTED (opt-in). */
    configured: boolean;
};

/** Input form of {@link AssetPolicy} for governance setters (no `configured` flag). */
export type AssetPolicyInput = {
    dvtTriggerAmount: bigint;
    perTxHardCap: bigint;
    dailyLimit: bigint;
    /** 0 => DEFAULT_WINDOW (1 day). */
    windowSeconds: bigint;
};

/** Per-(sender, target) scope. Selectors are queried via {@link isSelectorAllowed}. */
export type ContractScope = {
    /** target on this sender's call-target allowlist. */
    allowed: boolean;
    /** this target always requires DVT co-sign regardless of amount. */
    requireDVTAlways: boolean;
    /** max cumulative amount routed to this target per window. */
    velocityLimit: bigint;
    /** velocity window length, seconds (0 => no velocity limit). */
    velocityWindow: bigint;
    /** false => no scope set for this (sender, target). */
    configured: boolean;
};

/** Input form of {@link ContractScope} for governance setters; selectors set as a batch. */
export type ContractScopeInput = {
    allowed: boolean;
    requireDVTAlways: boolean;
    velocityLimit: bigint;
    velocityWindow: bigint;
    /** selectors to mark allowed for this target (ADDITIVE on `setContractScope`). */
    selectorAllowlist: Hex[];
};

/** Sender-keyed cumulative spend counter for one asset/target window. */
export type SpendCounter = {
    /** cumulative native-unit spend in the current window. */
    spentInWindow: bigint;
    /** unix timestamp the current window began. */
    windowStart: bigint;
};

export type PolicyRegistryActions = {
    // ── Validation-time read (cheap view, sender-keyed) ────────────────────────
    /**
     * Validation-time policy decision for one intended action. OPT-IN, default-ALLOW:
     * a sender with nothing configured for (asset, target) is UNRESTRICTED.
     * @returns decision (see {@link PolicyDecision}) + `remainingDaily` headroom in the
     *          current window AFTER `amount` would post (`type(uint256).max` when unrestricted).
     */
    checkPolicy: (args: { sender: Address, target: Address, asset: Address, amount: bigint, selector: Hex }) => Promise<{ decision: PolicyDecision, remainingDaily: bigint }>;

    // ── Config + counter views ─────────────────────────────────────────────────
    getAssetPolicy: (args: { sender: Address, asset: Address }) => Promise<AssetPolicy>;
    getContractScope: (args: { sender: Address, target: Address }) => Promise<ContractScope>;
    isSelectorAllowed: (args: { sender: Address, target: Address, selector: Hex }) => Promise<boolean>;
    /** Cumulative native-unit spend + window start for this (sender, asset). */
    getAssetSpend: (args: { sender: Address, asset: Address }) => Promise<SpendCounter>;
    isFrozen: (args: { sender: Address }) => Promise<boolean>;
    isAuthorizedConsumer: (args: { consumer: Address }) => Promise<boolean>;

    // ── Governance state views ──────────────────────────────────────────────────
    /** AirAccount 2-of-3 RecoveryService allowed to freeze/tighten immediately. */
    guardian: () => Promise<Address>;
    /**
     * The OZ {TimelockController} whose `minDelay` (2 days) gates every loosening.
     * It is the ONLY address allowed to call the `onlyTimelock` loosen/admin setters
     * ({@link setAssetPolicy} / {@link setContractScope} / {@link unfreezeSender} /
     * {@link setGuardian} / {@link setConsumerAuthorization}). Read this to find the
     * controller through which loosen calls must be scheduled + executed.
     */
    timelock: () => Promise<Address>;
    /** Default daily-limit window length (seconds) used when `windowSeconds == 0`. */
    DEFAULT_WINDOW: () => Promise<bigint>;
    /** The ETH sentinel address used as `asset` for native ETH (address(0) is invalid). */
    ETH_SENTINEL: () => Promise<Address>;
    version: () => Promise<string>;

    // ── Governance — IMMEDIATE TIGHTEN / FREEZE (guardian OR timelock) ──────────
    /**
     * Immediately tighten a (sender, asset) policy. Reverts `NotStrictlyTighter`
     * unless the new params are <= current on every dimension. Callable by the
     * guardian or the timelock (`onlyGuardianOrTimelock`) — NO timelock delay.
     */
    tightenAssetPolicy: (args: { sender: Address, asset: Address, params: AssetPolicyInput, account?: Account | Address }) => Promise<Hash>;
    /**
     * Immediately tighten a (sender, target) scope (disallow target, remove selectors,
     * lower velocity, set requireDVTAlways). Reverts unless strictly tighter.
     * `onlyGuardianOrTimelock` — NO timelock delay.
     */
    tightenContractScope: (args: { sender: Address, target: Address, params: ContractScopeInput, account?: Account | Address }) => Promise<Hash>;
    /**
     * Immediately freeze `sender`: {@link checkPolicy} returns REJECT for all ops.
     * `onlyGuardianOrTimelock` (guardian = AirAccount 2-of-3 RecoveryService). Lifting
     * the freeze is a loosening → {@link unfreezeSender} (timelocked).
     */
    freezeSender: (args: { sender: Address, account?: Account | Address }) => Promise<Hash>;

    // ── Governance — TIMELOCKED LOOSEN / ADMIN (onlyTimelock) ───────────────────
    /**
     * Set a (sender, asset) policy. `onlyTimelock` — reverts unless `msg.sender ==`
     * {@link timelock}`()`. There is NO registry-level pending store: the 2-day delay is
     * the EXTERNAL OZ {TimelockController}'s own `minDelay`. To loosen, governance must
     * `schedule()` this call on the timelock, wait out the delay, then `execute()` it
     * (which makes the timelock call back here). Calling this directly with an EOA/owner
     * key will revert `NotTimelock`. Read {@link timelock} for the controller address and
     * surface its scheduled-operation ETA (TimelockController.getTimestamp) to callers.
     */
    setAssetPolicy: (args: { sender: Address, asset: Address, params: AssetPolicyInput, account?: Account | Address }) => Promise<Hash>;
    /**
     * Set a (sender, target) scope and ADD the listed selectors (additive union, NOT
     * replace; remove via {@link tightenContractScope}). `onlyTimelock` — same external
     * TimelockController gating as {@link setAssetPolicy}; calling directly reverts
     * `NotTimelock`. Schedule + execute through {@link timelock}.
     */
    setContractScope: (args: { sender: Address, target: Address, params: ContractScopeInput, account?: Account | Address }) => Promise<Hash>;
    /**
     * Lift a freeze on `sender`. Unfreeze is a loosening → `onlyTimelock`; must be
     * scheduled + executed through the external {@link timelock} controller (2-day delay).
     * Calling directly reverts `NotTimelock`.
     */
    unfreezeSender: (args: { sender: Address, account?: Account | Address }) => Promise<Hash>;
    /** Set the guardian. `onlyTimelock` — route through {@link timelock}. */
    setGuardian: (args: { newGuardian: Address, account?: Account | Address }) => Promise<Hash>;
    /**
     * Authorize / revoke a staked consumer permitted to call `recordSpend`.
     * `onlyTimelock` — route through {@link timelock}.
     */
    setConsumerAuthorization: (args: { consumer: Address, authorized: boolean, account?: Account | Address }) => Promise<Hash>;
};

/**
 * Action factory for the SuperPaymaster v5.4 PolicyRegistry (DVT layer-1 account policy).
 *
 * Asymmetric lifecycle (enforced ON-CHAIN — the SDK is only a client and does NOT
 * re-implement the delay):
 *   - IMMEDIATE tighten/freeze: {@link PolicyRegistryActions.tightenAssetPolicy} /
 *     {@link PolicyRegistryActions.tightenContractScope} / {@link PolicyRegistryActions.freezeSender}
 *     (guardian OR timelock).
 *   - TIMELOCKED loosen/unfreeze/admin: {@link PolicyRegistryActions.setAssetPolicy} /
 *     {@link PolicyRegistryActions.setContractScope} / {@link PolicyRegistryActions.unfreezeSender} /
 *     {@link PolicyRegistryActions.setGuardian} / {@link PolicyRegistryActions.setConsumerAuthorization}
 *     — `onlyTimelock`. The 2-day delay is the EXTERNAL OZ TimelockController's `minDelay`;
 *     this registry has NO pending-change store, so callers must schedule/execute through
 *     {@link PolicyRegistryActions.timelock} and read the controller's ETA themselves.
 */
export const policyRegistryActions = (address: Address) => (client: PublicClient | WalletClient): PolicyRegistryActions => ({
    // ── Validation-time read ────────────────────────────────────────────────────
    async checkPolicy({ sender, target, asset, amount, selector }) {
        try {
            validateAddress(sender, 'sender');
            validateAddress(target, 'target');
            validateAddress(asset, 'asset');
            validateRequired(amount, 'amount');
            validateRequired(selector, 'selector');
            const r = await (client as PublicClient).readContract({
                address,
                abi: PolicyRegistryABI,
                functionName: 'checkPolicy',
                args: [sender, target, asset, amount, selector]
            }) as any;
            // outputs: (uint8 decision, uint256 remainingDaily)
            return { decision: Number(r[0]) as PolicyDecision, remainingDaily: r[1] as bigint };
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'checkPolicy');
        }
    },

    // ── Config + counter views ──────────────────────────────────────────────────
    async getAssetPolicy({ sender, asset }) {
        try {
            validateAddress(sender, 'sender');
            validateAddress(asset, 'asset');
            const r = await (client as PublicClient).readContract({
                address,
                abi: PolicyRegistryABI,
                functionName: 'getAssetPolicy',
                args: [sender, asset]
            }) as any;
            return {
                dvtTriggerAmount: r.dvtTriggerAmount as bigint,
                perTxHardCap: r.perTxHardCap as bigint,
                dailyLimit: r.dailyLimit as bigint,
                windowSeconds: r.windowSeconds as bigint,
                configured: r.configured as boolean,
            };
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getAssetPolicy');
        }
    },

    async getContractScope({ sender, target }) {
        try {
            validateAddress(sender, 'sender');
            validateAddress(target, 'target');
            const r = await (client as PublicClient).readContract({
                address,
                abi: PolicyRegistryABI,
                functionName: 'getContractScope',
                args: [sender, target]
            }) as any;
            return {
                allowed: r.allowed as boolean,
                requireDVTAlways: r.requireDVTAlways as boolean,
                velocityLimit: r.velocityLimit as bigint,
                velocityWindow: r.velocityWindow as bigint,
                configured: r.configured as boolean,
            };
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getContractScope');
        }
    },

    async isSelectorAllowed({ sender, target, selector }) {
        try {
            validateAddress(sender, 'sender');
            validateAddress(target, 'target');
            validateRequired(selector, 'selector');
            return await (client as PublicClient).readContract({
                address,
                abi: PolicyRegistryABI,
                functionName: 'isSelectorAllowed',
                args: [sender, target, selector]
            }) as Promise<boolean>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'isSelectorAllowed');
        }
    },

    async getAssetSpend({ sender, asset }) {
        try {
            validateAddress(sender, 'sender');
            validateAddress(asset, 'asset');
            const r = await (client as PublicClient).readContract({
                address,
                abi: PolicyRegistryABI,
                functionName: 'getAssetSpend',
                args: [sender, asset]
            }) as any;
            // outputs: (uint128 spentInWindow, uint64 windowStart)
            return { spentInWindow: r[0] as bigint, windowStart: r[1] as bigint };
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getAssetSpend');
        }
    },

    async isFrozen({ sender }) {
        try {
            validateAddress(sender, 'sender');
            return await (client as PublicClient).readContract({
                address,
                abi: PolicyRegistryABI,
                functionName: 'isFrozen',
                args: [sender]
            }) as Promise<boolean>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'isFrozen');
        }
    },

    async isAuthorizedConsumer({ consumer }) {
        try {
            validateAddress(consumer, 'consumer');
            return await (client as PublicClient).readContract({
                address,
                abi: PolicyRegistryABI,
                functionName: 'isAuthorizedConsumer',
                args: [consumer]
            }) as Promise<boolean>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'isAuthorizedConsumer');
        }
    },

    // ── Governance state views ────────────────────────────────────────────────
    async guardian() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: PolicyRegistryABI,
                functionName: 'guardian',
                args: []
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'guardian');
        }
    },

    async timelock() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: PolicyRegistryABI,
                functionName: 'timelock',
                args: []
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'timelock');
        }
    },

    async DEFAULT_WINDOW() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: PolicyRegistryABI,
                functionName: 'DEFAULT_WINDOW',
                args: []
            }) as Promise<bigint>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'DEFAULT_WINDOW');
        }
    },

    async ETH_SENTINEL() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: PolicyRegistryABI,
                functionName: 'ETH_SENTINEL',
                args: []
            }) as Promise<Address>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'ETH_SENTINEL');
        }
    },

    async version() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: PolicyRegistryABI,
                functionName: 'version',
                args: []
            }) as Promise<string>;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'version');
        }
    },

    // ── Governance — immediate tighten / freeze ────────────────────────────────
    async tightenAssetPolicy({ sender, asset, params, account }) {
        try {
            validateAddress(sender, 'sender');
            validateAddress(asset, 'asset');
            validateRequired(params, 'params');
            return await (client as any).writeContract({
                address,
                abi: PolicyRegistryABI,
                functionName: 'tightenAssetPolicy',
                args: [sender, asset, params],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'tightenAssetPolicy');
        }
    },

    async tightenContractScope({ sender, target, params, account }) {
        try {
            validateAddress(sender, 'sender');
            validateAddress(target, 'target');
            validateRequired(params, 'params');
            return await (client as any).writeContract({
                address,
                abi: PolicyRegistryABI,
                functionName: 'tightenContractScope',
                args: [sender, target, params],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'tightenContractScope');
        }
    },

    async freezeSender({ sender, account }) {
        try {
            validateAddress(sender, 'sender');
            return await (client as any).writeContract({
                address,
                abi: PolicyRegistryABI,
                functionName: 'freezeSender',
                args: [sender],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'freezeSender');
        }
    },

    // ── Governance — timelocked loosen / admin (onlyTimelock) ──────────────────
    async setAssetPolicy({ sender, asset, params, account }) {
        try {
            validateAddress(sender, 'sender');
            validateAddress(asset, 'asset');
            validateRequired(params, 'params');
            return await (client as any).writeContract({
                address,
                abi: PolicyRegistryABI,
                functionName: 'setAssetPolicy',
                args: [sender, asset, params],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setAssetPolicy');
        }
    },

    async setContractScope({ sender, target, params, account }) {
        try {
            validateAddress(sender, 'sender');
            validateAddress(target, 'target');
            validateRequired(params, 'params');
            return await (client as any).writeContract({
                address,
                abi: PolicyRegistryABI,
                functionName: 'setContractScope',
                args: [sender, target, params],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setContractScope');
        }
    },

    async unfreezeSender({ sender, account }) {
        try {
            validateAddress(sender, 'sender');
            return await (client as any).writeContract({
                address,
                abi: PolicyRegistryABI,
                functionName: 'unfreezeSender',
                args: [sender],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'unfreezeSender');
        }
    },

    async setGuardian({ newGuardian, account }) {
        try {
            validateAddress(newGuardian, 'newGuardian');
            return await (client as any).writeContract({
                address,
                abi: PolicyRegistryABI,
                functionName: 'setGuardian',
                args: [newGuardian],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setGuardian');
        }
    },

    async setConsumerAuthorization({ consumer, authorized, account }) {
        try {
            validateAddress(consumer, 'consumer');
            validateRequired(authorized, 'authorized');
            return await (client as any).writeContract({
                address,
                abi: PolicyRegistryABI,
                functionName: 'setConsumerAuthorization',
                args: [consumer, authorized],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'setConsumerAuthorization');
        }
    }
});
