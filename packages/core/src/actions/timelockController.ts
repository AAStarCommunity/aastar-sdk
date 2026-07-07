import { type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account } from 'viem';
import { TimelockControllerABI } from '../abis/index.js';
import { validateAddress, validateRequired } from '../validators/index.js';
import { AAStarError } from '../errors/index.js';

/** The 32-byte zero value used for a Timelock operation with no predecessor. */
export const ZERO_BYTES32: Hex = '0x0000000000000000000000000000000000000000000000000000000000000000';

/**
 * A single call to route through a {TimelockController}. `value` defaults to 0 and
 * `predecessor` to {@link ZERO_BYTES32}; `salt` distinguishes otherwise-identical
 * operations and MUST be reused verbatim between schedule and execute (the operation
 * id is derived from all of these — see {@link TimelockControllerActions.hashOperation}).
 */
export type TimelockOperation = {
    target: Address;
    data: Hex;
    value?: bigint;
    predecessor?: Hex;
    salt: Hex;
};

/**
 * viem action factory for a standard OpenZeppelin {TimelockController}. Governance
 * changes to timelock-gated admin setters (e.g. BLSAggregator `setSlashPolicyAdmin` /
 * `setSlashThreshold`, CC-13) flow through here: {@link schedule} the inner call,
 * wait out {@link getMinDelay}, then {@link execute} it. Operation state is read via
 * {@link getTimestamp} (0 = unset, 1 = done, else the ready-at unix timestamp).
 */
export type TimelockControllerActions = {
    /** The minimum delay (seconds) an operation must wait between schedule and execute. */
    getMinDelay: () => Promise<bigint>;
    /** Deterministic operation id for a scheduled call (matches on-chain `hashOperation`). */
    hashOperation: (args: TimelockOperation) => Promise<Hex>;
    /**
     * The unix timestamp at which the operation becomes ready. Sentinels: `0n` =
     * unset (never scheduled), `1n` = already executed (done). Any other value is the
     * ready-at time — the "pending change ETA" a governance UI surfaces.
     */
    getTimestamp: (args: { id: Hex }) => Promise<bigint>;
    isOperationPending: (args: { id: Hex }) => Promise<boolean>;
    isOperationReady: (args: { id: Hex }) => Promise<boolean>;
    isOperationDone: (args: { id: Hex }) => Promise<boolean>;

    /** Schedule an operation. Reverts unless `delay >= getMinDelay()` and caller has PROPOSER_ROLE. */
    schedule: (args: TimelockOperation & { delay: bigint, account?: Account | Address }) => Promise<Hash>;
    /** Execute a ready operation (caller needs EXECUTOR_ROLE). Reverts if not ready or predecessor unmet. */
    execute: (args: TimelockOperation & { account?: Account | Address }) => Promise<Hash>;
    /** Cancel a still-pending operation by id (caller needs CANCELLER_ROLE). */
    cancel: (args: { id: Hex, account?: Account | Address }) => Promise<Hash>;
};

export const timelockControllerActions = (address: Address) => (client: PublicClient | WalletClient): TimelockControllerActions => ({
    async getMinDelay() {
        try {
            return await (client as PublicClient).readContract({
                address,
                abi: TimelockControllerABI,
                functionName: 'getMinDelay',
                args: []
            }) as bigint;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getMinDelay');
        }
    },

    async hashOperation({ target, data, value = 0n, predecessor = ZERO_BYTES32, salt }) {
        try {
            validateAddress(target, 'target');
            validateRequired(data, 'data');
            validateRequired(salt, 'salt');
            return await (client as PublicClient).readContract({
                address,
                abi: TimelockControllerABI,
                functionName: 'hashOperation',
                args: [target, value, data, predecessor, salt]
            }) as Hex;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'hashOperation');
        }
    },

    async getTimestamp({ id }) {
        try {
            validateRequired(id, 'id');
            return await (client as PublicClient).readContract({
                address,
                abi: TimelockControllerABI,
                functionName: 'getTimestamp',
                args: [id]
            }) as bigint;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getTimestamp');
        }
    },

    async isOperationPending({ id }) {
        try {
            validateRequired(id, 'id');
            return await (client as PublicClient).readContract({
                address,
                abi: TimelockControllerABI,
                functionName: 'isOperationPending',
                args: [id]
            }) as boolean;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'isOperationPending');
        }
    },

    async isOperationReady({ id }) {
        try {
            validateRequired(id, 'id');
            return await (client as PublicClient).readContract({
                address,
                abi: TimelockControllerABI,
                functionName: 'isOperationReady',
                args: [id]
            }) as boolean;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'isOperationReady');
        }
    },

    async isOperationDone({ id }) {
        try {
            validateRequired(id, 'id');
            return await (client as PublicClient).readContract({
                address,
                abi: TimelockControllerABI,
                functionName: 'isOperationDone',
                args: [id]
            }) as boolean;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'isOperationDone');
        }
    },

    async schedule({ target, data, value = 0n, predecessor = ZERO_BYTES32, salt, delay, account }) {
        try {
            validateAddress(target, 'target');
            validateRequired(data, 'data');
            validateRequired(salt, 'salt');
            validateRequired(delay, 'delay');
            return await (client as any).writeContract({
                address,
                abi: TimelockControllerABI,
                functionName: 'schedule',
                args: [target, value, data, predecessor, salt, delay],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'schedule');
        }
    },

    async execute({ target, data, value = 0n, predecessor = ZERO_BYTES32, salt, account }) {
        try {
            validateAddress(target, 'target');
            validateRequired(data, 'data');
            validateRequired(salt, 'salt');
            return await (client as any).writeContract({
                address,
                abi: TimelockControllerABI,
                functionName: 'execute',
                args: [target, value, data, predecessor, salt],
                value,
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'execute');
        }
    },

    async cancel({ id, account }) {
        try {
            validateRequired(id, 'id');
            return await (client as any).writeContract({
                address,
                abi: TimelockControllerABI,
                functionName: 'cancel',
                args: [id],
                account: account as any,
                chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'cancel');
        }
    },
});
