import { type Address, type Hash, type Hex } from 'viem';
import {
    BaseClient,
    type ClientConfig,
    type TransactionOptions,
    aggregatorActions,
    timelockControllerActions,
    encodeSetSlashPolicyAdmin,
    encodeSetSlashThreshold,
    ZERO_BYTES32,
    type SlashLevel,
} from '@aastar/core';

/**
 * SlashGovernance — L3 orchestration for the BLSAggregator slash-policy admin surface
 * behind an OpenZeppelin {TimelockController} (CC-13 batch B; multisig target locked to
 * TimelockController, viem-only).
 *
 * The BLSAggregator's `setSlashPolicyAdmin` / `setSlashThreshold` are `onlyPolicyAdmin`.
 * Once the policy admin has been handed to a timelock, changing them is a two-step
 * `schedule()` → wait `getMinDelay()` → `execute()` flow — this client encodes the inner
 * call and drives that flow, and reads the current governance state + a pending change's
 * ETA for a UI to render.
 *
 * IMPORTANT: `salt` distinguishes otherwise-identical operations and MUST be persisted by
 * the caller and reused verbatim between schedule / execute / eta lookups (the operation id
 * is derived from target+value+data+predecessor+salt). Two identical (call, salt) pairs
 * collide on-chain.
 */
export class SlashGovernance extends BaseClient {
    public blsAggregatorAddress: Address;
    public timelockAddress: Address;

    constructor(config: ClientConfig & {
        blsAggregatorAddress: Address;
        timelockAddress: Address;
    }) {
        super(config);
        this.blsAggregatorAddress = config.blsAggregatorAddress;
        this.timelockAddress = config.timelockAddress;
    }

    // ===========================================
    // Reads — current governance state
    // ===========================================

    /** The address currently authorised to change the slash threshold table. */
    async getSlashPolicyAdmin(): Promise<Address> {
        return await aggregatorActions(this.blsAggregatorAddress)(this.client).slashPolicyAdmin();
    }

    /** The full slash threshold table (WARNING/MINOR/MAJOR co-sign quorums). */
    async getSlashThresholds(): Promise<{ warning: number; minor: number; major: number }> {
        return await aggregatorActions(this.blsAggregatorAddress)(this.client).getSlashThresholds();
    }

    /** The timelock's minimum delay (seconds) between schedule and execute. */
    async getMinDelay(): Promise<bigint> {
        return await timelockControllerActions(this.timelockAddress)(this.client).getMinDelay();
    }

    // ===========================================
    // setSlashPolicyAdmin — schedule / execute / eta
    // ===========================================

    /**
     * Schedule handing the slash policy admin to `newAdmin` (usually the timelock itself,
     * or a follow-on multisig) through the timelock. `delay` defaults to the timelock's
     * `getMinDelay()`. Persist `salt` to execute later.
     */
    async scheduleSetSlashPolicyAdmin(args: {
        newAdmin: Address;
        salt?: Hex;
        delay?: bigint;
        options?: TransactionOptions;
    }): Promise<Hash> {
        const data = encodeSetSlashPolicyAdmin(args.newAdmin);
        return await this.schedule(data, args.salt, args.delay, args.options);
    }

    /** Execute a previously-scheduled `setSlashPolicyAdmin(newAdmin)` once its delay has elapsed. */
    async executeSetSlashPolicyAdmin(args: {
        newAdmin: Address;
        salt?: Hex;
        options?: TransactionOptions;
    }): Promise<Hash> {
        const data = encodeSetSlashPolicyAdmin(args.newAdmin);
        return await this.execute(data, args.salt, args.options);
    }

    /**
     * The unix timestamp at which a scheduled `setSlashPolicyAdmin(newAdmin)` becomes
     * ready. `0n` = not scheduled, `1n` = already executed, else the ready-at time.
     */
    async getSetSlashPolicyAdminEta(args: { newAdmin: Address; salt?: Hex }): Promise<bigint> {
        const data = encodeSetSlashPolicyAdmin(args.newAdmin);
        return await this.getChangeEta(data, args.salt);
    }

    // ===========================================
    // setSlashThreshold — schedule / execute / eta
    // ===========================================

    /**
     * Schedule updating the co-sign quorum for a {@link SlashLevel} through the timelock.
     * `delay` defaults to `getMinDelay()`. Persist `salt` to execute later.
     */
    async scheduleSetSlashThreshold(args: {
        slashLevel: SlashLevel | number;
        threshold: number;
        salt?: Hex;
        delay?: bigint;
        options?: TransactionOptions;
    }): Promise<Hash> {
        const data = encodeSetSlashThreshold(args.slashLevel, args.threshold);
        return await this.schedule(data, args.salt, args.delay, args.options);
    }

    /** Execute a previously-scheduled `setSlashThreshold(level, threshold)` once its delay has elapsed. */
    async executeSetSlashThreshold(args: {
        slashLevel: SlashLevel | number;
        threshold: number;
        salt?: Hex;
        options?: TransactionOptions;
    }): Promise<Hash> {
        const data = encodeSetSlashThreshold(args.slashLevel, args.threshold);
        return await this.execute(data, args.salt, args.options);
    }

    /** ETA (see {@link getSetSlashPolicyAdminEta}) for a scheduled `setSlashThreshold(level, threshold)`. */
    async getSetSlashThresholdEta(args: {
        slashLevel: SlashLevel | number;
        threshold: number;
        salt?: Hex;
    }): Promise<bigint> {
        const data = encodeSetSlashThreshold(args.slashLevel, args.threshold);
        return await this.getChangeEta(data, args.salt);
    }

    // ===========================================
    // Internal — shared timelock plumbing
    // ===========================================

    /** Schedule `data` against the BLSAggregator via the timelock; delay defaults to getMinDelay(). */
    private async schedule(data: Hex, salt: Hex = ZERO_BYTES32, delay?: bigint, options?: TransactionOptions): Promise<Hash> {
        const timelock = timelockControllerActions(this.timelockAddress)(this.client);
        const effectiveDelay = delay ?? await timelock.getMinDelay();
        return await timelock.schedule({
            target: this.blsAggregatorAddress,
            data,
            salt,
            delay: effectiveDelay,
            account: options?.account,
        });
    }

    /** Execute the timelock operation that runs `data` against the BLSAggregator. */
    private async execute(data: Hex, salt: Hex = ZERO_BYTES32, options?: TransactionOptions): Promise<Hash> {
        return await timelockControllerActions(this.timelockAddress)(this.client).execute({
            target: this.blsAggregatorAddress,
            data,
            salt,
            account: options?.account,
        });
    }

    /** Resolve the timelock operation id for `data` and read its ready-at timestamp. */
    private async getChangeEta(data: Hex, salt: Hex = ZERO_BYTES32): Promise<bigint> {
        const timelock = timelockControllerActions(this.timelockAddress)(this.client);
        const id = await timelock.hashOperation({ target: this.blsAggregatorAddress, data, salt });
        return await timelock.getTimestamp({ id });
    }
}
