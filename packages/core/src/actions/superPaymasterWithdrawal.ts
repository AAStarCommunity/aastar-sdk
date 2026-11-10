import { type Account, type Address, type Hash, type Hex, type PublicClient, type WalletClient } from 'viem';
import { SuperPaymasterV550ABI } from '../abis/index.js';
import { validateAddress, validateAmount } from '../validators/index.js';
import { AAStarError, ErrorCode } from '../errors/index.js';

/** `pendingWithdrawals(operator)` (SuperPaymaster-5.5.1). amount 0 = no request. */
export type PendingOperatorWithdrawal = { amount: bigint; readyAt: bigint };

/** Where an operator's aPNTs withdrawal stands, read at one block. */
export type OperatorWithdrawalStatus = PendingOperatorWithdrawal & {
    /** `operators(operator).aPNTsBalance`. */
    balance: bigint;
    /** Block timestamp the status was read at. */
    now: bigint;
    /** A request exists and `now >= readyAt`. */
    matured: boolean;
    /** A slash is queued for this operator: request and withdraw both revert SlashPending. */
    slashQueued: boolean;
};

/** `slashQueues(operator)` (5.5.1): who queued the pending slash and when (guardian freezes expire). */
export type OperatorSlashQueue = { queuedBy: Address; queuedAt: bigint; guardianQueued: boolean };

export type SuperPaymasterWithdrawalActions = {
    /** `OPERATOR_WITHDRAWAL_DELAY()` — 48 h on 5.5.1. */
    withdrawalDelay: () => Promise<bigint>;
    /** `GUARDIAN_SLASH_FREEZE()` — how long a guardian-queued freeze lasts unconfirmed (7 days). */
    guardianSlashFreeze: () => Promise<bigint>;
    pendingWithdrawal: (args: { operator: Address }) => Promise<PendingOperatorWithdrawal>;
    /** Aggregate a0 still reserved between validation and settlement for this operator. */
    inflightReserved: (args: { operator: Address }) => Promise<bigint>;
    slashQueue: (args: { operator: Address }) => Promise<OperatorSlashQueue>;
    withdrawalStatus: (args: { operator: Address }) => Promise<OperatorWithdrawalStatus>;
    /**
     * Step 1: `requestWithdraw(amount)`. Starts the OPERATOR_WITHDRAWAL_DELAY; the funds stay
     * available for sponsorship and slashing meanwhile (a slash may shrink the request —
     * `WithdrawalRequestAdjusted`). Reverts WithdrawalPending if one is open, SlashPending if a slash
     * is queued. msg.sender is the operator.
     */
    requestWithdraw: (args: { amount: bigint, account?: Account | Address }) => Promise<Hash>;
    /** Cancel the open request (`cancelWithdraw()`). */
    cancelWithdraw: (args: { account?: Account | Address }) => Promise<Hash>;
    /**
     * Step 2: `withdraw(amount)` once the request has matured. The aPNTs go to the OPERATOR
     * (msg.sender) — there is no recipient parameter. Checked before sending: a request exists, it
     * has matured at the latest block, `amount` does not exceed it, and no slash is queued; otherwise
     * this throws INVALID_PARAMETER and sends nothing (the contract would revert).
     */
    executeWithdraw: (args: { operator: Address, amount?: bigint, account?: Account | Address }) => Promise<Hash>;
    /**
     * Permissionless: pause an operator whose role or effective stake is below the minimum.
     * Reverts OperatorNotConfigured / OperatorMeetsMinimumStake.
     */
    pauseUnderstakedOperator: (args: { operator: Address, account?: Account | Address }) => Promise<Hash>;
    /**
     * Owner only: release the supplied stale reservations, then slash (SlashBlockedByInflight
     * otherwise blocks a slash while reservations are live).
     */
    slashOperatorAfterReleasing: (args: { operator: Address, level: number, penaltyAmount: bigint, reason: string, staleOpHashes: Hex[], account?: Account | Address }) => Promise<Hash>;
};

/**
 * Whether a SuperPaymaster version() uses the two-step operator withdrawal (5.5.1+). 5.4.2 (and the
 * 5.5.0 rc builds) withdraw in one call; 5.5.1 keeps the `withdraw(uint256)` selector but requires a
 * matured `requestWithdraw` first.
 */
export function superPaymasterHasTwoStepWithdrawal(version: string): boolean {
    const m = /^SuperPaymaster-(\d+)\.(\d+)\.(\d+)/.exec(version.trim());
    if (!m) throw new Error(`Unrecognised SuperPaymaster version() string: "${version}"`);
    const [maj, min, pat] = [Number(m[1]), Number(m[2]), Number(m[3])];
    return maj > 5 || (maj === 5 && (min > 5 || (min === 5 && pat >= 1)));
}

/**
 * SuperPaymaster-5.5.1 operator withdrawal: request -> OPERATOR_WITHDRAWAL_DELAY -> withdraw.
 * `withdraw(uint256)` kept its selector from 5.4.2 but now REQUIRES a matured request, so the old
 * one-call withdrawal silently stops working: use these instead.
 * `reader` serves the reads when `client` is a wallet client without public actions.
 */
export const superPaymasterWithdrawalActions = (address: Address) => (client: PublicClient | WalletClient, reader?: PublicClient | WalletClient): SuperPaymasterWithdrawalActions => {
    const pub = (reader ?? client) as PublicClient;
    const read = (functionName: string, args: unknown[] = [], blockNumber?: bigint) =>
        pub.readContract({ address, abi: SuperPaymasterV550ABI, functionName, args, ...(blockNumber !== undefined ? { blockNumber } : {}) } as any) as Promise<any>;
    const write = (functionName: string, args: unknown[], account?: Account | Address) =>
        (client as any).writeContract({ address, abi: SuperPaymasterV550ABI, functionName, args, account: account as any, chain: (client as any).chain }) as Promise<Hash>;

    const actions: SuperPaymasterWithdrawalActions = {
        async withdrawalDelay() {
            try { return BigInt(await read('OPERATOR_WITHDRAWAL_DELAY')); } catch (e) { throw AAStarError.fromViemError(e as Error, 'withdrawalDelay'); }
        },
        async guardianSlashFreeze() {
            try { return BigInt(await read('GUARDIAN_SLASH_FREEZE')); } catch (e) { throw AAStarError.fromViemError(e as Error, 'guardianSlashFreeze'); }
        },
        async pendingWithdrawal({ operator }) {
            validateAddress(operator, 'operator');
            try {
                const r = await read('pendingWithdrawals', [operator]);
                return { amount: BigInt(r[0]), readyAt: BigInt(r[1]) };
            } catch (e) { throw AAStarError.fromViemError(e as Error, 'pendingWithdrawal'); }
        },
        async inflightReserved({ operator }) {
            validateAddress(operator, 'operator');
            try { return BigInt(await read('inflightReserved', [operator])); } catch (e) { throw AAStarError.fromViemError(e as Error, 'inflightReserved'); }
        },
        async slashQueue({ operator }) {
            validateAddress(operator, 'operator');
            try {
                const r = await read('slashQueues', [operator]);
                return { queuedBy: r[0] as Address, queuedAt: BigInt(r[1]), guardianQueued: Boolean(r[2]) };
            } catch (e) { throw AAStarError.fromViemError(e as Error, 'slashQueue'); }
        },
        async withdrawalStatus({ operator }) {
            validateAddress(operator, 'operator');
            try {
                const block = await pub.getBlock({ blockTag: 'latest' });
                const bn = block.number as bigint;
                const [pending, op, slashPending] = await Promise.all([
                    read('pendingWithdrawals', [operator], bn), read('operators', [operator], bn), read('isSlashPending', [operator], bn),
                ]);
                const amount = BigInt(pending[0]), readyAt = BigInt(pending[1]), now = BigInt(block.timestamp);
                // operators(): (aPNTsBalance, isConfigured, isPaused, xPNTsToken, …)
                return { amount, readyAt, balance: BigInt(op[0]), now, matured: amount > 0n && now >= readyAt, slashQueued: Boolean(slashPending) };
            } catch (e) { throw AAStarError.fromViemError(e as Error, 'withdrawalStatus'); }
        },
        async requestWithdraw({ amount, account }) {
            validateAmount(amount, 'amount');
            try { return await write('requestWithdraw', [amount], account); } catch (e) { throw AAStarError.fromViemError(e as Error, 'requestWithdraw'); }
        },
        async cancelWithdraw({ account }) {
            try { return await write('cancelWithdraw', [], account); } catch (e) { throw AAStarError.fromViemError(e as Error, 'cancelWithdraw'); }
        },
        async executeWithdraw({ operator, amount, account }) {
            const s = await actions.withdrawalStatus({ operator });
            const refuse = (m: string): never => { throw new AAStarError(ErrorCode.INVALID_PARAMETER, `executeWithdraw: ${m}; nothing was sent`); };
            if (s.slashQueued) refuse(`a slash is queued for ${operator} (withdraw reverts SlashPending)`);
            if (s.amount === 0n) refuse(`no withdrawal request for ${operator}: call requestWithdraw first, then wait the withdrawal delay`);
            if (!s.matured) refuse(`the request matures at ${s.readyAt} (latest block time ${s.now})`);
            const value = amount ?? s.amount;
            if (value <= 0n || value > s.amount) refuse(`amount ${value} is outside 1..${s.amount} (the matured request)`);
            if (value > s.balance) refuse(`amount ${value} exceeds the operator balance ${s.balance}`);
            try { return await write('withdraw', [value], account); } catch (e) { throw AAStarError.fromViemError(e as Error, 'executeWithdraw'); }
        },
        async pauseUnderstakedOperator({ operator, account }) {
            validateAddress(operator, 'operator');
            try { return await write('pauseUnderstakedOperator', [operator], account); } catch (e) { throw AAStarError.fromViemError(e as Error, 'pauseUnderstakedOperator'); }
        },
        async slashOperatorAfterReleasing({ operator, level, penaltyAmount, reason, staleOpHashes, account }) {
            validateAddress(operator, 'operator');
            try { return await write('slashOperatorAfterReleasing', [operator, level, penaltyAmount, reason, staleOpHashes], account); } catch (e) { throw AAStarError.fromViemError(e as Error, 'slashOperatorAfterReleasing'); }
        },
    };
    return actions;
};
