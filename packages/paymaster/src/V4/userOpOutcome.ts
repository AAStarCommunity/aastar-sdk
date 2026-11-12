import { decodeEventLog, type Address, type Hex } from 'viem';
import { EntryPointABI } from '@aastar/core';

/**
 * What a mined UserOperation actually did. `success === false` still means the bundle
 * transaction was included and the user was charged (`actualGasCost`); it is not a revert of
 * `handleOps`.
 */
export type UserOperationExecutionResult = {
    success: boolean;
    userOpHash: Hex;
    transactionHash: Hex;
    actualGasCost: bigint;
    actualGasUsed: bigint;
    sender?: Address;
    paymaster?: Address;
    nonce?: bigint;
    /** Bundler receipt `reason`, when it sent one. */
    reason?: string;
    /** `UserOperationRevertReason.revertReason` for this hash, when that log is present. */
    revertReason?: Hex;
    receipt: unknown;
};

export type WaitForUserOperationResultOptions = {
    timeout?: number;
    /**
     * When true, `success === false` throws {@link UserOperationFailedError} instead of returning
     * the result. Default false: the caller inspects `success`.
     */
    throwOnFailure?: boolean;
};

/** Included UserOperation whose inner call reverted. Gas was still charged. */
export class UserOperationFailedError extends Error {
    readonly success = false as const;
    readonly userOpHash: Hex;
    readonly transactionHash: Hex;
    readonly actualGasCost: bigint;
    readonly actualGasUsed: bigint;
    readonly result: UserOperationExecutionResult;

    constructor(result: UserOperationExecutionResult) {
        super(
            `UserOperation ${result.userOpHash} was included but failed (success=false); ` +
            `gas was still charged (actualGasCost=${result.actualGasCost}, actualGasUsed=${result.actualGasUsed})`
        );
        this.name = 'UserOperationFailedError';
        this.userOpHash = result.userOpHash;
        this.transactionHash = result.transactionHash;
        this.actualGasCost = result.actualGasCost;
        this.actualGasUsed = result.actualGasUsed;
        this.result = result;
    }
}

/**
 * Bundler JSON-RPC -32503 (`ValidationErrors.ExpiresShortly`). SuperPaymaster 5.5.0 rate-limits
 * with `validAfter = lastTimestamp + minTxInterval`, and the reference bundler reports that as
 * "User operation is not valid yet". The same code is also "expires too soon" — `validAfter` /
 * `secondsToWait` are set only when the body actually carries them. No sleep and no retry.
 */
export class UserOperationNotYetValidError extends Error {
    readonly code = -32503 as const;
    /** Earliest timestamp (seconds) at which the bundler will accept the op, when the body says so. */
    readonly validAfter?: bigint;
    /** Bundler's `now` (chain time), when the body says so. Not `Date.now()`. */
    readonly now?: bigint;
    /** `validAfter - now` when both are present and `validAfter > now`; `0` when `validAfter <= now`. */
    readonly secondsToWait?: bigint;
    /** The JSON-RPC error object the bundler returned, unchanged. */
    readonly rpcError: unknown;

    constructor(
        message: string,
        options: {
            cause: Error;
            rpcError: unknown;
            validAfter?: bigint;
            now?: bigint;
            secondsToWait?: bigint;
        }
    ) {
        super(message, { cause: options.cause });
        this.name = 'UserOperationNotYetValidError';
        this.rpcError = options.rpcError;
        this.validAfter = options.validAfter;
        this.now = options.now;
        this.secondsToWait = options.secondsToWait;
    }
}

/** Receipt does not expose a trustworthy `success` for this userOpHash. */
export class UserOperationReceiptError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'UserOperationReceiptError';
    }
}

type RpcBody = { code?: unknown; message?: unknown; data?: unknown };

const NOT_YET_VALID_CODE = -32503;

function isNotYetValidCode(code: unknown): boolean {
    return code === NOT_YET_VALID_CODE || code === '-32503';
}

/** Non-negative integer only. Unsafe JS numbers are rejected so a rounded timestamp is never used. */
function parseUint(value: unknown): bigint | undefined {
    if (typeof value === 'bigint') return value >= 0n ? value : undefined;
    if (typeof value === 'number') {
        if (!Number.isSafeInteger(value) || value < 0) return undefined;
        return BigInt(value);
    }
    if (typeof value === 'string') {
        const s = value.trim();
        if (/^0x[0-9a-fA-F]+$/.test(s)) {
            try { return BigInt(s); } catch { return undefined; }
        }
        if (/^\d+$/.test(s)) return BigInt(s);
    }
    return undefined;
}

const VALID_AFTER_IN_TEXT = /validAfter\s*=\s*(0x[0-9a-fA-F]+|\d+)/i;
const NOW_IN_TEXT = /(?:^|[\s,;])now\s*=\s*(0x[0-9a-fA-F]+|\d+)/i;

function timingFromText(text: string): { validAfter?: bigint; now?: bigint } {
    const validAfter = text.match(VALID_AFTER_IN_TEXT);
    const now = text.match(NOW_IN_TEXT);
    return {
        validAfter: validAfter ? parseUint(validAfter[1]) : undefined,
        now: now ? parseUint(now[1]) : undefined,
    };
}

/**
 * Pull `validAfter` / `now` from the message and from `data`. Two sources that disagree on the
 * same field are a conflict: the caller still throws, but without a timestamp it would be wrong
 * to wait on.
 */
function readTiming(body: RpcBody): { validAfter?: bigint; now?: bigint } | 'conflict' {
    const parts: Array<{ validAfter?: bigint; now?: bigint }> = [];
    if (typeof body.message === 'string') parts.push(timingFromText(body.message));
    const data = body.data;
    if (typeof data === 'string') {
        parts.push(timingFromText(data));
    } else if (data && typeof data === 'object') {
        const record = data as Record<string, unknown>;
        const fromFields = {
            validAfter: parseUint(record.validAfter),
            now: parseUint(record.now),
        };
        if (fromFields.validAfter !== undefined || fromFields.now !== undefined) {
            parts.push(fromFields);
        } else if (typeof record.message === 'string') {
            parts.push(timingFromText(record.message));
        }
    }

    let validAfter: bigint | undefined;
    let now: bigint | undefined;
    for (const part of parts) {
        if (part.validAfter !== undefined) {
            if (validAfter !== undefined && validAfter !== part.validAfter) return 'conflict';
            validAfter = part.validAfter;
        }
        if (part.now !== undefined) {
            if (now !== undefined && now !== part.now) return 'conflict';
            now = part.now;
        }
    }
    return { validAfter, now };
}

function causeForRpc(body: RpcBody): Error {
    const message = typeof body.message === 'string' && body.message.length > 0
        ? body.message
        : `bundler rejected the user operation (-32503): ${JSON.stringify(body)}`;
    const cause = new Error(message);
    cause.name = 'BundlerRpcError';
    return Object.assign(cause, { code: body.code, data: body.data });
}

/**
 * Recognise a bundler -32503. Returns null for every other code so the caller keeps its existing
 * error. A -32503 whose timestamp cannot be read still returns an error (fail closed) with the
 * original body on `rpcError` and as `cause`.
 */
export function userOperationNotYetValidFromRpc(rpcError: unknown): UserOperationNotYetValidError | null {
    if (!rpcError || typeof rpcError !== 'object') return null;
    const body = rpcError as RpcBody;
    if (!isNotYetValidCode(body.code)) return null;

    const timing = readTiming(body);
    const validAfter = timing === 'conflict' ? undefined : timing.validAfter;
    const now = timing === 'conflict' ? undefined : timing.now;
    const secondsToWait = validAfter !== undefined && now !== undefined
        ? (validAfter > now ? validAfter - now : 0n)
        : undefined;

    let message: string;
    if (timing === 'conflict') {
        message = 'User operation rejected by bundler (-32503); validAfter/now in the error disagree';
    } else if (validAfter !== undefined && secondsToWait !== undefined && now !== undefined) {
        message = `User operation is not valid yet (validAfter=${validAfter}, now=${now}, wait ${secondsToWait}s)`;
    } else if (validAfter !== undefined) {
        message = `User operation is not valid yet (validAfter=${validAfter})`;
    } else if (typeof body.message === 'string' && body.message.length > 0) {
        message = `User operation rejected by bundler (-32503): ${body.message}`;
    } else {
        message = 'User operation rejected by bundler (-32503)';
    }

    return new UserOperationNotYetValidError(message, {
        cause: causeForRpc(body),
        rpcError,
        validAfter,
        now,
        secondsToWait,
    });
}

type DecodedUserOpEvent = {
    userOpHash: Hex;
    sender: Address;
    paymaster: Address;
    nonce: bigint;
    success: boolean;
    actualGasCost: bigint;
    actualGasUsed: bigint;
};

function eqHex(a: string, b: string): boolean {
    return a.toLowerCase() === b.toLowerCase();
}

function isHex(value: unknown, bytes: number): value is Hex {
    return typeof value === 'string' && new RegExp(`^0x[0-9a-fA-F]{${bytes * 2}}$`).test(value);
}

/** `bytes` of any length, including empty `0x`. */
function isBytesHex(value: unknown): value is Hex {
    return typeof value === 'string' && /^0x([0-9a-fA-F]{2})*$/.test(value);
}

function collectLogs(receipt: any): any[] {
    const out: any[] = [];
    if (Array.isArray(receipt?.logs)) out.push(...receipt.logs);
    if (Array.isArray(receipt?.receipt?.logs)) out.push(...receipt.receipt.logs);
    return out;
}

function decodeLog(log: any): { eventName: string; args: any } | undefined {
    if (!log || typeof log !== 'object' || log.data == null || !Array.isArray(log.topics)) return undefined;
    try {
        return decodeEventLog({ abi: EntryPointABI, data: log.data, topics: log.topics as any }) as any;
    } catch {
        return undefined;
    }
}

/**
 * Every `UserOperationEvent` in the receipt whose `userOpHash` is this op. A log for a different
 * hash is ignored — a bundle receipt's first event belongs to someone else. Logs from a contract
 * other than `receipt.entryPoint` are ignored when that field is set.
 */
function matchingUserOpEvents(receipt: any, userOpHash: Hex): DecodedUserOpEvent[] {
    const entryPoint = isHex(receipt?.entryPoint, 20) ? receipt.entryPoint.toLowerCase() : undefined;
    const found: DecodedUserOpEvent[] = [];
    for (const log of collectLogs(receipt)) {
        if (entryPoint && isHex(log?.address, 20) && log.address.toLowerCase() !== entryPoint) continue;
        const decoded = decodeLog(log);
        if (!decoded || decoded.eventName !== 'UserOperationEvent') continue;
        const args = decoded.args as DecodedUserOpEvent;
        if (!isHex(args?.userOpHash, 32) || !eqHex(args.userOpHash, userOpHash)) continue;
        if (typeof args.success !== 'boolean') continue;
        const actualGasCost = parseUint(args.actualGasCost);
        const actualGasUsed = parseUint(args.actualGasUsed);
        if (actualGasCost === undefined || actualGasUsed === undefined) continue;
        found.push({ ...args, actualGasCost, actualGasUsed });
    }
    return found;
}

function sameEvent(a: DecodedUserOpEvent, b: DecodedUserOpEvent): boolean {
    return a.success === b.success
        && a.actualGasCost === b.actualGasCost
        && a.actualGasUsed === b.actualGasUsed
        && a.nonce === b.nonce
        && eqHex(a.sender, b.sender)
        && eqHex(a.paymaster, b.paymaster);
}

function matchingRevertReason(receipt: any, userOpHash: Hex): Hex | undefined {
    const entryPoint = isHex(receipt?.entryPoint, 20) ? receipt.entryPoint.toLowerCase() : undefined;
    let found: Hex | undefined;
    for (const log of collectLogs(receipt)) {
        if (entryPoint && isHex(log?.address, 20) && log.address.toLowerCase() !== entryPoint) continue;
        const decoded = decodeLog(log);
        if (!decoded || decoded.eventName !== 'UserOperationRevertReason') continue;
        const args = decoded.args as { userOpHash?: Hex; revertReason?: Hex };
        if (!isHex(args?.userOpHash, 32) || !eqHex(args.userOpHash, userOpHash)) continue;
        if (!isBytesHex(args.revertReason)) continue;
        if (found !== undefined && !eqHex(found, args.revertReason)) return undefined;
        found = args.revertReason;
    }
    return found;
}

function transactionHashOf(receipt: any): Hex | undefined {
    const candidate = receipt?.receipt?.transactionHash ?? receipt?.transactionHash;
    return isHex(candidate, 32) ? candidate : undefined;
}

function exposedSuccess(receipt: any): boolean | undefined {
    // Transaction `status` is the bundle, not the op: handleOps stays successful when the inner
    // call reverts and the user is still charged. Only a boolean `success` counts.
    return typeof receipt?.success === 'boolean' ? receipt.success : undefined;
}

/**
 * Read one UserOperation out of a bundler userOp receipt or a raw transaction receipt.
 * Prefers a boolean `success` already on the receipt; otherwise decodes `UserOperationEvent`
 * from {@link EntryPointABI}, matched by `userOpHash`. A log that disagrees with the receipt's
 * own `success` or gas figures is an error, not a silent pick.
 */
export function readUserOperationResult(receipt: unknown, userOpHash: Hex): UserOperationExecutionResult {
    if (!isHex(userOpHash, 32)) {
        throw new UserOperationReceiptError(`userOpHash is not a bytes32: ${String(userOpHash)}`);
    }
    const body = receipt as any;
    const events = matchingUserOpEvents(body, userOpHash);
    const unique = events.filter((event, index) => events.findIndex((other) => sameEvent(event, other)) === index);
    if (unique.length > 1) {
        throw new UserOperationReceiptError(
            `UserOperation ${userOpHash} has ${unique.length} disagreeing UserOperationEvent logs`
        );
    }
    const event = unique[0];
    const fromReceipt = exposedSuccess(body);
    if (fromReceipt !== undefined && event && event.success !== fromReceipt) {
        throw new UserOperationReceiptError(
            `UserOperation ${userOpHash} receipt.success=${fromReceipt} but UserOperationEvent.success=${event.success}`
        );
    }
    const success = fromReceipt ?? event?.success;
    if (typeof success !== 'boolean') {
        throw new UserOperationReceiptError(
            `Cannot determine success for UserOperation ${userOpHash}: receipt has no boolean success and no matching UserOperationEvent`
        );
    }

    const receiptGasCost = parseUint(body?.actualGasCost);
    const receiptGasUsed = parseUint(body?.actualGasUsed);
    if (event && receiptGasCost !== undefined && receiptGasCost !== event.actualGasCost) {
        throw new UserOperationReceiptError(
            `UserOperation ${userOpHash} receipt.actualGasCost=${receiptGasCost} but UserOperationEvent.actualGasCost=${event.actualGasCost}`
        );
    }
    if (event && receiptGasUsed !== undefined && receiptGasUsed !== event.actualGasUsed) {
        throw new UserOperationReceiptError(
            `UserOperation ${userOpHash} receipt.actualGasUsed=${receiptGasUsed} but UserOperationEvent.actualGasUsed=${event.actualGasUsed}`
        );
    }
    const actualGasCost = receiptGasCost ?? event?.actualGasCost;
    const actualGasUsed = receiptGasUsed ?? event?.actualGasUsed;
    if (actualGasCost === undefined || actualGasUsed === undefined) {
        throw new UserOperationReceiptError(
            `UserOperation ${userOpHash} is missing actualGasCost or actualGasUsed`
        );
    }

    const transactionHash = transactionHashOf(body);
    if (!transactionHash) {
        throw new UserOperationReceiptError(`UserOperation ${userOpHash} receipt has no transactionHash`);
    }

    const sender = (event?.sender ?? (isHex(body?.sender, 20) ? body.sender : undefined)) as Address | undefined;
    const paymaster = (event?.paymaster ?? (isHex(body?.paymaster, 20) ? body.paymaster : undefined)) as Address | undefined;
    const nonce = event?.nonce ?? parseUint(body?.nonce);
    const reason = typeof body?.reason === 'string' && body.reason.length > 0 ? body.reason : undefined;

    return {
        success,
        userOpHash,
        transactionHash,
        actualGasCost,
        actualGasUsed,
        sender,
        paymaster,
        nonce,
        reason,
        revertReason: matchingRevertReason(body, userOpHash),
        receipt,
    };
}
