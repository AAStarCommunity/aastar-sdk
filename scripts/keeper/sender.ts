/**
 * One in-flight price transaction. The key signs only the two alpha price intents, and only while the gate is open.
 * There is no fee replacement and no cancel. A nonce the chain has consumed is cleared before any receipt lookup.
 * Fees at signing: tip = min(quoted tip, max tip), maxFee = min(max fee, FEE_BASE_MULTIPLIER * baseFee + tip).
 * k = FEE_BASE_MULTIPLIER = 3. A formula above the ceiling still signs at the ceiling. The stall rule covers a slow tx.
 */
import {
    encodeFunctionData,
    keccak256,
    parseAbi,
    parseTransaction,
    recoverTransactionAddress,
    type Address,
    type Hex,
    type TransactionSerialized,
} from 'viem';
import type { RawSigner, SignRequest } from './castSigner.js';
import type { JournalAccount } from './journal.js';
import { Journal, JOURNAL_HASH_CAP, type InFlight, type IntentKind } from './journal.js';
import { replayRawAllowed } from './replayGuard.js';

export const UPDATE_PRICE_DATA = encodeFunctionData({
    abi: parseAbi(['function updatePrice()']),
    functionName: 'updatePrice',
});

/** Documented k in `k * baseFee + tip`. */
export const FEE_BASE_MULTIPLIER = 3n;
/** One receipt lookup. It is not on the signing queue. Each consumed nonce gets at most three. */
export const RECEIPT_LOOKUP_MS = 5_000;
export const RECEIPT_TRIES = 3;
const RECEIPT_QUEUE_MAX = 8;
const DEFAULT_STALL_SEC = 600;
const DEFAULT_MAX_TIP_WEI = 2n * 1_000_000_000n;

export interface ChainReceipt {
    status: 'success' | 'reverted';
    gasUsed: bigint;
    blockHash: Hex;
    blockNumber: bigint;
    transactionHash: Hex;
}

export interface ChainIO {
    chainId(): Promise<number>;
    getTransactionCount(addr: Address, tag: 'latest' | 'pending'): Promise<bigint>;
    getBalance(addr: Address): Promise<bigint>;
    estimateGas(tx: { to: Address; data: Hex; from: Address }): Promise<bigint>;
    fees(): Promise<{ baseFee: bigint; tip: bigint }>;
    sendRawTransaction(raw: Hex): Promise<Hex>;
    getTransactionReceipt(hash: Hex): Promise<ChainReceipt | null>;
    getBlockByNumber(n: bigint): Promise<{ hash: Hex; number: bigint } | null>;
    getBlockByHash(hash: Hex): Promise<{ hash: Hex; number: bigint } | null>;
    call(tx: { to: Address; data: Hex; from?: Address; blockHash?: Hex }): Promise<Hex>;
}

export type SendRequest = { kind: 'price-super' | 'price-paymaster'; to: Address; data: Hex };

export type SendResult =
    | { status: 'included'; hash: Hex; receipt: ChainReceipt }
    | { status: 'pending'; hash: Hex }
    | { status: 'blocked'; inFlightHash: Hex }
    | { status: 'refused'; reason: string };

export interface MaintainResult {
    status: 'idle' | 'pending' | 'consumed' | 'refused';
    hash?: Hex;
    receipt?: ChainReceipt;
    reason?: string;
    /** Nonce moved. The receipt, if any, is a settlement event, not this result. */
    unseen?: boolean;
    kind?: IntentKind;
}

/** Done or unavailable. The keeper loop drains these. They are not tied to one send call. */
export interface SettlementEvent {
    kind: IntentKind;
    nonce: number;
    outcome: 'receipt' | 'reverted' | 'unavailable';
    hash?: Hex;
    receipt?: ChainReceipt;
}

export interface EnabledKinds {
    'price-super': boolean;
    'price-paymaster': boolean;
}

/** Fields checkIntent reads. Fees are compared separately against the journal. */
export interface IntentTx {
    to: Address;
    data: Hex;
    value: bigint;
    gas: bigint;
    chainId: number;
    type: string;
    accessListEmpty: boolean;
}

export interface IntentTargets {
    superPaymaster: Address | null;
    paymaster: Address | null;
    signer: Address;
    chainId: number;
    maxGas: bigint;
}

export interface StalenessRead {
    updatedAtSec: bigint;
    thresholdSec: bigint;
}

const REFUSED = {
    gate: 'sender: gate closed',
    stopping: 'sender: stopping',
    disabled: 'sender: kind disabled',
    corrupt: 'sender: journal corrupt',
    unsafe: 'sender: journal unsafe',
    refusedJournal: 'sender: journal refused',
    nonce: 'sender: nonce read failed',
    journal: 'sender: journal write failed',
    gas: 'sender: gas estimate failed',
    fee: 'sender: fee read failed',
    sign: 'sender: sign failed',
    request: 'sender: request rejected',
    send: 'sender: send failed',
    broadcast: 'sender: broadcast failed',
    chain: 'sender: chain id mismatch',
    chainRead: 'sender: chain id unreadable',
    ceiling: 'sender: send ceiling',
    unresolved: 'sender: target unresolved',
    stalled: 'sender: stalled',
    paymasterIdentity: 'sender: paymaster identity pending',
    clearStall: 'sender: stall clear refused',
} as const;

const ALERT = {
    foreign: 'signer nonce moved outside this keeper',
    aboveFee: 'sender: above fee ceiling',
    sendCeiling: 'send ceiling exceeded — all sends closed',
    unavailable: 'nonce consumed, receipt unavailable',
} as const;

const HOUR_MS = 3_600_000;

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAddress(value: string): value is Address {
    if (value.length !== 42) return false;
    if (value.charCodeAt(0) !== 48 || value.charCodeAt(1) !== 120) return false;
    for (let i = 2; i < value.length; i++) {
        const c = value.charCodeAt(i);
        const hex = (c >= 48 && c <= 57) || (c >= 97 && c <= 102) || (c >= 65 && c <= 70);
        if (!hex) return false;
    }
    return true;
}

function isData(value: string): value is Hex {
    if (value.length < 2 || value.length > 200_000 || (value.length % 2) !== 0) return false;
    if (value.charCodeAt(0) !== 48 || value.charCodeAt(1) !== 120) return false;
    for (let i = 2; i < value.length; i++) {
        const c = value.charCodeAt(i);
        const hex = (c >= 48 && c <= 57) || (c >= 97 && c <= 102) || (c >= 65 && c <= 70);
        if (!hex) return false;
    }
    return true;
}

function norm(value: string): string {
    return value.toLowerCase();
}

function copyReceipt(receipt: ChainReceipt): ChainReceipt {
    return {
        status: receipt.status === 'success' ? 'success' : 'reverted',
        gasUsed: receipt.gasUsed,
        blockHash: receipt.blockHash,
        blockNumber: receipt.blockNumber,
        transactionHash: receipt.transactionHash,
    };
}

/**
 * Two price targets, once per poll, never above 30.
 * pollIntervalSec is the keeper's poll, in seconds. Replacements are not given slots.
 */
export function defaultMaxSendsPerHour(pollIntervalSec: number): number {
    if (!Number.isInteger(pollIntervalSec) || pollIntervalSec <= 0 || pollIntervalSec > 86_400) {
        throw new Error('sender: pollIntervalSec invalid');
    }
    const perTarget = Math.ceil(3600 / pollIntervalSec);
    return Math.min(2 * perTarget, 30);
}

/**
 * The only authorization check. Price targets must be the configured addresses.
 * An unresolved PaymasterV4 or SuperPaymaster refuses that kind.
 * Replay passes enforceMaxGas false so a lowered --max-gas does not block an already-signed raw.
 */
export function checkIntent(
    kind: string,
    tx: IntentTx,
    targets: IntentTargets,
    opts?: { enforceMaxGas?: boolean },
): boolean {
    if (!tx || typeof tx.to !== 'string' || typeof tx.data !== 'string') return false;
    if (tx.value !== 0n || tx.type !== 'eip1559' || tx.accessListEmpty !== true) return false;
    if (tx.chainId !== targets.chainId) return false;
    if (typeof tx.gas !== 'bigint' || tx.gas <= 0n) return false;
    const enforceMaxGas = opts?.enforceMaxGas !== false;
    if (enforceMaxGas && tx.gas > targets.maxGas) return false;
    const to = norm(tx.to);
    const data = norm(tx.data);
    if (data !== norm(UPDATE_PRICE_DATA)) return false;
    if (kind === 'price-super') {
        return targets.superPaymaster !== null && to === norm(targets.superPaymaster);
    }
    if (kind === 'price-paymaster') {
        return targets.paymaster !== null && to === norm(targets.paymaster);
    }
    return false;
}

/** Round up so the printed replacement is at least 125% of the stuck fee. */
export function bumpedFee(value: bigint): bigint {
    if (typeof value !== 'bigint' || value <= 0n) return 0n;
    return (value * 125n + 99n) / 100n;
}

/**
 * Operator command when --clear-stall is too early.
 * `$RPC_URL` is a shell instruction. The keeper does not print the URL.
 * The operator reads it from the same env file passed as --env-file.
 */
export function manualStallCommand(input: {
    chainId: number;
    nonce: number;
    maxFeePerGas: bigint;
    maxPriorityFeePerGas: bigint;
    keystorePath: string;
    passwordFilePath: string;
    signer: string;
}): string {
    const fee = bumpedFee(input.maxFeePerGas);
    const tip = bumpedFee(input.maxPriorityFeePerGas);
    return `Read RPC_URL from the keeper env file (the value is not printed). `
        + `cast send --chain ${input.chainId} --rpc-url "$RPC_URL" --nonce ${input.nonce} `
        + `--gas-price ${fee} --priority-gas-price ${tip} `
        + `--keystore ${input.keystorePath} --password-file ${input.passwordFilePath} ${input.signer} --value 0`;
}

/** The one signing gate. The request is the exact object cast will receive. */
export function authorizeSign(kind: string, req: SignRequest, targets: IntentTargets, maxFeeWei: bigint): boolean {
    if (!req || typeof req.to !== 'string' || typeof req.data !== 'string') return false;
    if (typeof req.gasLimit !== 'bigint' || typeof req.maxFeePerGas !== 'bigint' || typeof req.maxPriorityFeePerGas !== 'bigint') return false;
    if (typeof maxFeeWei !== 'bigint' || maxFeeWei <= 0n) return false;
    if (req.maxPriorityFeePerGas < 0n || req.maxFeePerGas < req.maxPriorityFeePerGas) return false;
    if (req.maxFeePerGas > maxFeeWei || req.maxPriorityFeePerGas > maxFeeWei) return false;
    return checkIntent(kind, {
        to: req.to,
        data: req.data,
        value: 0n,
        gas: req.gasLimit,
        chainId: req.chainId,
        type: 'eip1559',
        accessListEmpty: true,
    }, targets);
}

/**
 * tip = min(quoted tip, max tip). maxFee = min(max fee, 3 * baseFee + tip).
 * When the formula is above the ceiling, the signature uses the ceiling.
 */
export function signingFees(
    quoted: { baseFee: bigint; tip: bigint },
    maxFeeWei: bigint,
    maxTipWei: bigint,
): { fee: bigint; tip: bigint } | null {
    if (!quoted || typeof quoted.baseFee !== 'bigint' || typeof quoted.tip !== 'bigint') return null;
    if (quoted.baseFee < 0n || quoted.tip < 0n || maxFeeWei <= 0n || maxTipWei < 0n) return null;
    let tip = quoted.tip < maxTipWei ? quoted.tip : maxTipWei;
    if (tip > maxFeeWei) tip = maxFeeWei;
    const formula = FEE_BASE_MULTIPLIER * quoted.baseFee + tip;
    const fee = formula > maxFeeWei ? maxFeeWei : formula;
    if (fee < tip || fee <= 0n) return null;
    return { fee, tip };
}

function fixedSignReason(error: unknown): string {
    const message = error instanceof Error ? error.message : '';
    if (message.startsWith('cast signer:') || message.startsWith('secret file:') || message.startsWith('sender:')) return message;
    return REFUSED.sign;
}

interface Decoded {
    to: Address;
    data: Hex;
    value: bigint;
    gas: bigint;
    chainId: number;
    nonce: number;
    maxFeePerGas: bigint;
    maxPriorityFeePerGas: bigint;
    from: Address;
}

async function decodeRaw(raw: Hex, signer: Address): Promise<Decoded | null> {
    if (typeof raw !== 'string' || raw.length < 4 || raw.length > 200_000) return null;
    let tx;
    try {
        tx = parseTransaction(raw as TransactionSerialized);
    } catch {
        return null;
    }
    let from: Address;
    try {
        from = await recoverTransactionAddress({ serializedTransaction: raw as TransactionSerialized });
    } catch {
        return null;
    }
    if (!tx.to || tx.type !== 'eip1559') return null;
    if (norm(from) !== norm(signer)) return null;
    const accessEmpty = !tx.accessList || tx.accessList.length === 0;
    if (!accessEmpty) return null;
    if (tx.chainId === undefined || tx.nonce === undefined || tx.gas === undefined) return null;
    // viem parses a zero fee field of a type-2 tx as undefined; it means 0 (#447 clestons M1').
    const maxFeePerGas = tx.maxFeePerGas ?? 0n;
    const maxPriorityFeePerGas = tx.maxPriorityFeePerGas ?? 0n;
    return {
        to: tx.to,
        data: (tx.data ?? '0x') as Hex,
        value: tx.value ?? 0n,
        gas: tx.gas,
        chainId: tx.chainId,
        nonce: tx.nonce,
        maxFeePerGas,
        maxPriorityFeePerGas,
        from,
    };
}

function asIntent(decoded: Decoded): IntentTx {
    return {
        to: decoded.to,
        data: decoded.data,
        value: decoded.value,
        gas: decoded.gas,
        chainId: decoded.chainId,
        type: 'eip1559',
        accessListEmpty: true,
    };
}

interface ReceiptSnapshot {
    nonce: number;
    hashes: Hex[];
    kind: IntentKind;
}

export class Sender {
    private readonly chain: ChainIO;
    private readonly signer: RawSigner;
    private readonly journal: Journal;
    private readonly signerAddress: Address;
    private readonly chainId: number;
    private readonly maxGas: bigint;
    private readonly maxFeeWei: bigint;
    private readonly maxTipWei: bigint;
    private readonly maxSendsPerHour: number;
    private readonly stallSec: number;
    private readonly alert: (msg: string) => void;
    private readonly now: () => number;
    private readonly paymaster: () => Address | null;
    private readonly superPaymaster: Address | null;
    private readonly enabled: EnabledKinds;
    private readonly readStaleness: () => Promise<StalenessRead | 'unreadable'>;
    private readonly manualStep: (nonce: number, fees: { maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }) => string;
    private readonly limits: Readonly<{
        chainId: number;
        maxGas: bigint;
        maxFeeWei: bigint;
        maxTipWei: bigint;
        stallSec: number;
        maxSendsPerHour: number;
        feeMultiplier: bigint;
        receiptLookupMs: number;
    }>;
    private gate: { price: boolean; pause: boolean; reason: string; validUntil: number } = {
        price: false,
        pause: false,
        reason: REFUSED.gate,
        validUntil: 0,
    };
    /** Set by the chain-id read that just returned. The next sync check reads it. */
    private chainIdOk = false;
    private queue: Promise<void> = Promise.resolve();
    private stopping = false;
    private ceilingClosed = false;
    private readonly sentAt: number[] = [];
    private readonly alerted = new Set<string>();
    private lastLatest: bigint | null = null;
    private hydrated = false;
    private accountDirty = false;
    private readonly resetSendCeiling: boolean;
    private stalled = false;
    private stalledNonce: number | null = null;
    /** Price-paymaster signs only after an identity check that included the current owner. */
    private paymasterIdentity = true;
    private readonly settlements: SettlementEvent[] = [];
    private readonly receiptQueue: { nonce: number; hashes: Hex[]; kind: IntentKind; tries: number }[] = [];
    private receiptTask: Promise<void> | null = null;
    /** Resolves once the deferred lookup has been started. */
    private receiptArm: Promise<void> | null = null;
    /** One lookup per nonce per tick. The epoch advances in tick(). */
    private receiptEpoch = 0;
    private readonly receiptEpochOf = new Map<number, number>();

    constructor(opts: {
        chain: ChainIO;
        signer: RawSigner;
        journal: Journal;
        signerAddress: Address;
        chainId: number;
        superPaymaster: Address | null;
        paymaster: () => Address | null;
        enabledKinds?: EnabledKinds;
        maxGas?: bigint;
        maxFeeWei: bigint;
        maxTipWei?: bigint;
        maxSendsPerHour: number;
        stallSec?: number;
        now?: () => number;
        alert: (msg: string) => void;
        /** Clear a closed ceiling once the rolling hour has room again. */
        resetSendCeiling?: boolean;
        /** Cached updatedAt plus the on-chain staleness threshold, read when a stall is declared. */
        readStaleness?: () => Promise<StalenessRead | 'unreadable'>;
        /** Exact command printed when --clear-stall is too early. Fees are the stuck transaction's. */
        manualStep?: (nonce: number, fees: { maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }) => string;
    }) {
        const stallSec = opts.stallSec ?? DEFAULT_STALL_SEC;
        const maxTipWei = opts.maxTipWei ?? DEFAULT_MAX_TIP_WEI;
        const maxGas = opts.maxGas ?? 500_000n;
        if (!Number.isInteger(stallSec) || stallSec <= 0 || stallSec > 86_400) throw new Error('sender: stallSec invalid');
        if (!Number.isInteger(opts.chainId) || opts.chainId <= 0) throw new Error('sender: chainId invalid');
        if (!Number.isInteger(opts.maxSendsPerHour) || opts.maxSendsPerHour <= 0 || opts.maxSendsPerHour > 10_000) {
            throw new Error('sender: maxSendsPerHour invalid');
        }
        if (typeof maxGas !== 'bigint' || maxGas < 21_000n || maxGas > 30_000_000n) throw new Error('sender: maxGas invalid');
        if (typeof opts.maxFeeWei !== 'bigint' || opts.maxFeeWei <= 0n || opts.maxFeeWei > 10_000n * 1_000_000_000n) {
            throw new Error('sender: maxFeeWei invalid');
        }
        if (typeof maxTipWei !== 'bigint' || maxTipWei < 0n || maxTipWei > 10_000n * 1_000_000_000n) {
            throw new Error('sender: maxTipWei invalid');
        }
        if (typeof opts.signerAddress !== 'string' || !isAddress(opts.signerAddress)) throw new Error('sender: signer invalid');
        if (opts.superPaymaster !== null && (typeof opts.superPaymaster !== 'string' || !isAddress(opts.superPaymaster))) {
            throw new Error('sender: superPaymaster invalid');
        }
        if (typeof opts.paymaster !== 'function') throw new Error('sender: paymaster invalid');
        if (typeof opts.alert !== 'function') throw new Error('sender: alert invalid');
        const enabled = opts.enabledKinds ?? { 'price-super': true, 'price-paymaster': true };
        if (typeof enabled['price-super'] !== 'boolean' || typeof enabled['price-paymaster'] !== 'boolean') {
            throw new Error('sender: enabledKinds invalid');
        }
        const now = opts.now ?? (() => Date.now());
        if (typeof now !== 'function') throw new Error('sender: now invalid');
        if (opts.resetSendCeiling !== undefined && typeof opts.resetSendCeiling !== 'boolean') {
            throw new Error('sender: resetSendCeiling invalid');
        }
        if (opts.readStaleness !== undefined && typeof opts.readStaleness !== 'function') {
            throw new Error('sender: readStaleness invalid');
        }
        if (opts.manualStep !== undefined && typeof opts.manualStep !== 'function') {
            throw new Error('sender: manualStep invalid');
        }
        this.chain = opts.chain;
        this.signer = opts.signer;
        this.journal = opts.journal;
        this.signerAddress = opts.signerAddress;
        this.chainId = opts.chainId;
        this.maxGas = maxGas;
        this.maxFeeWei = opts.maxFeeWei;
        this.maxTipWei = maxTipWei;
        this.maxSendsPerHour = opts.maxSendsPerHour;
        this.stallSec = stallSec;
        this.alert = opts.alert;
        this.now = now;
        this.paymaster = opts.paymaster;
        this.superPaymaster = opts.superPaymaster;
        this.enabled = { 'price-super': enabled['price-super'], 'price-paymaster': enabled['price-paymaster'] };
        this.resetSendCeiling = opts.resetSendCeiling === true;
        this.readStaleness = opts.readStaleness ?? (async () => 'unreadable');
        this.manualStep = opts.manualStep ?? ((nonce, fees) => manualStallCommand({
            chainId: opts.chainId,
            nonce,
            maxFeePerGas: fees.maxFeePerGas,
            maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
            keystorePath: '<path>',
            passwordFilePath: '<path>',
            signer: opts.signerAddress,
        }));
        this.limits = Object.freeze({
            chainId: opts.chainId,
            maxGas,
            maxFeeWei: opts.maxFeeWei,
            maxTipWei,
            stallSec,
            maxSendsPerHour: opts.maxSendsPerHour,
            feeMultiplier: FEE_BASE_MULTIPLIER,
            receiptLookupMs: RECEIPT_LOOKUP_MS,
        });
        Object.freeze(this.enabled);
    }

    /** One keeper loop iteration. Stall is measured from firstSentAt, not from tick counts. */
    tick(): void {
        this.receiptEpoch += 1;
        this.pumpReceipts();
    }

    /** Price and pause scopes stay separate. Pause does not authorize a transaction. */
    setGate(gate: { price: boolean; pause: boolean; reason: string; validUntil?: number }): void {
        if (!gate || typeof gate.price !== 'boolean' || typeof gate.pause !== 'boolean') throw new Error('sender: gate rejected');
        const validUntil = gate.validUntil === undefined ? Number.MAX_SAFE_INTEGER : gate.validUntil;
        if (!Number.isSafeInteger(validUntil) || validUntil < 0) throw new Error('sender: gate rejected');
        const reason = typeof gate.reason === 'string' ? gate.reason.slice(0, 500) : '';
        this.gate = { price: gate.price, pause: gate.pause, reason, validUntil };
        if (gate.price && gate.pause) this.alerted.delete(REFUSED.gate);
    }

    /**
     * False until a successful identity check included this PaymasterV4 owner.
     * A grace period from a check that omitted it does not open price-paymaster.
     */
    setPaymasterIdentity(cleared: boolean): void {
        if (typeof cleared !== 'boolean') throw new Error('sender: paymaster identity rejected');
        this.paymasterIdentity = cleared;
    }

    /** True only when both scopes are open and the decision has not expired. */
    gateOpen(): boolean {
        return this.gate.price && this.gate.pause && this.timeFresh();
    }

    /** Refuse new work. An in-flight send already on the queue still finishes. */
    stop(): void {
        this.stopping = true;
    }

    /** Copies. Mutating a returned event does not change the next drain. */
    drainSettlements(): SettlementEvent[] {
        const out = this.settlements.map((ev) => ({
            kind: ev.kind,
            nonce: ev.nonce,
            outcome: ev.outcome,
            hash: ev.hash,
            receipt: ev.receipt ? copyReceipt(ev.receipt) : undefined,
        }));
        this.settlements.length = 0;
        return out;
    }

    /** Wait for receipt lookups already started. It is not inside the signing queue. */
    async flushReceipt(): Promise<void> {
        for (let i = 0; i < RECEIPT_QUEUE_MAX + 1; i++) {
            if (this.receiptArm) await this.receiptArm;
            const task = this.receiptTask;
            if (!task) return;
            await task;
        }
    }

    /** Wait until the queue is idle, or until timeoutMs. Does not cancel the in-flight send. */
    async drain(timeoutMs: number): Promise<void> {
        const start = Date.now();
        for (;;) {
            const pending = this.queue;
            const left = timeoutMs - (Date.now() - start);
            if (left <= 0) return;
            await Promise.race([pending, sleep(left)]);
            if (this.queue === pending) return;
        }
    }

    async send(req: SendRequest): Promise<SendResult> {
        if (this.stopping) return { status: 'refused', reason: REFUSED.stopping };
        const job = this.copyJob(req);
        if (!job) return { status: 'refused', reason: REFUSED.request };
        try {
            return await this.enqueue(() => this.sendLocked(job));
        } catch {
            this.alertOnce(REFUSED.send);
            return { status: 'refused', reason: REFUSED.send };
        }
    }

    /** Rebroadcast or settle. Runs even when no new update is due. */
    async maintain(): Promise<MaintainResult> {
        if (this.stopping) return { status: 'refused', reason: REFUSED.stopping };
        try {
            return await this.enqueue(() => this.settle());
        } catch {
            this.alertOnce(REFUSED.send);
            return { status: 'refused', reason: REFUSED.send };
        }
    }

    /** One-shot. Accepted only when the chain nonce is already past the stalled nonce. */
    async clearStall(): Promise<{ status: 'cleared' | 'idle' | 'refused'; reason?: string }> {
        if (this.stopping) return { status: 'refused', reason: REFUSED.stopping };
        try {
            return await this.enqueue(() => this.clearStallLocked());
        } catch {
            this.alertOnce(REFUSED.send);
            return { status: 'refused', reason: REFUSED.send };
        }
    }

    private enqueue<T>(job: () => Promise<T>): Promise<T> {
        const prev = this.queue;
        let release: () => void = () => {};
        this.queue = new Promise<void>((resolve) => {
            release = resolve;
        });
        return prev.then(() => job()).finally(release);
    }

    private copyJob(req: SendRequest): SendRequest | null {
        if (!req || (req.kind !== 'price-super' && req.kind !== 'price-paymaster')) return null;
        if (typeof req.to !== 'string' || typeof req.data !== 'string') return null;
        if (!isAddress(req.to) || !isData(req.data)) return null;
        return { kind: req.kind, to: req.to, data: req.data };
    }

    /** Configured addresses, including a kind whose updates are disabled. */
    private targets(): IntentTargets {
        const pm = this.paymaster();
        return {
            superPaymaster: this.superPaymaster,
            paymaster: typeof pm === 'string' && isAddress(pm) ? pm : null,
            signer: this.signerAddress,
            chainId: this.chainId,
            maxGas: this.maxGas,
        };
    }

    private timeFresh(): boolean {
        const now = this.now();
        return Number.isSafeInteger(now) && now >= 0 && now < this.gate.validUntil;
    }

    /** Sync. Call only after the last awaited prerequisite. */
    private allows(kind: IntentKind): boolean {
        if (this.stalled || this.ceilingClosed || !this.chainIdOk || !this.timeFresh() || !this.gate.price) return false;
        return kind === 'price-super' || kind === 'price-paymaster';
    }

    private alertOnce(key: string, message = key): void {
        if (this.alerted.has(key)) return;
        this.alerted.add(key);
        this.alert(message);
    }

    private async seenChain(): Promise<'ok' | 'mismatch' | 'unreadable'> {
        let id: number;
        try {
            id = await this.chain.chainId();
        } catch {
            this.chainIdOk = false;
            return 'unreadable';
        }
        if (!Number.isInteger(id) || id <= 0) {
            this.chainIdOk = false;
            return 'unreadable';
        }
        this.chainIdOk = id === this.chainId;
        return this.chainIdOk ? 'ok' : 'mismatch';
    }

    private async sendLocked(job: SendRequest): Promise<SendResult> {
        if (this.stopping) return { status: 'refused', reason: REFUSED.stopping };
        const settled = await this.settle();
        if (settled.status === 'refused' && settled.reason && settled.reason !== REFUSED.gate) {
            return { status: 'refused', reason: settled.reason };
        }
        const flight = await this.openFlight();
        if (flight === 'bad') return { status: 'refused', reason: REFUSED.refusedJournal };
        if (flight) {
            const hash = flight.hashes[flight.hashes.length - 1];
            if (!hash) return { status: 'refused', reason: REFUSED.journal };
            return { status: 'blocked', inFlightHash: hash };
        }
        if (this.stalled) return { status: 'refused', reason: REFUSED.stalled };
        if (!this.enabled[job.kind]) return { status: 'refused', reason: REFUSED.disabled };
        if (job.kind === 'price-paymaster' && !this.paymasterIdentity) {
            this.alertOnce(REFUSED.paymasterIdentity);
            return { status: 'refused', reason: REFUSED.paymasterIdentity };
        }
        return this.signNew(job);
    }

    private async openFlight(): Promise<InFlight | null | 'bad'> {
        const loaded = await this.journal.load();
        if (loaded === 'missing') return null;
        if (loaded !== 'ok') return 'bad';
        await this.hydrate();
        return this.journal.inFlight();
    }

    private journalReason(loaded: string): string {
        if (loaded === 'mismatch') return 'sender: journal belongs to another signer';
        if (loaded === 'unsafe') return REFUSED.unsafe;
        if (loaded === 'corrupt') return REFUSED.corrupt;
        if (loaded === 'barrier') return 'sender: journal barrier incomplete';
        return REFUSED.refusedJournal;
    }

    private async settle(): Promise<MaintainResult> {
        const loaded = await this.journal.load();
        if (loaded === 'missing') return { status: 'idle' };
        if (loaded !== 'ok') return { status: 'refused', reason: this.journalReason(loaded) };
        await this.hydrate();
        const flight = this.journal.inFlight();
        if (!flight) {
            await this.noteForeign(null);
            if (this.stalled) return { status: 'refused', reason: REFUSED.stalled };
            return { status: 'idle' };
        }
        return this.serviceFlight(flight);
    }

    private async serviceFlight(flight: InFlight): Promise<MaintainResult> {
        const overdue = this.stallDue(flight);
        if (overdue || this.stalled) {
            this.rememberStall(flight);
            await this.emitStall(flight);
            if ((await this.seenChain()) === 'ok') {
                const nonces = await this.readNonces();
                if (nonces.kind === 'ok') {
                    this.noteNonce(nonces.latest, nonces.pending, flight);
                    if (nonces.latest > BigInt(flight.nonce)) {
                        await this.consume(flight, nonces.latest);
                        return { status: 'refused', reason: REFUSED.stalled };
                    }
                }
            }
            if (this.accountDirty) await this.persistAccount();
            return { status: 'refused', reason: REFUSED.stalled };
        }
        const chain = await this.seenChain();
        if (chain !== 'ok') {
            const reason = chain === 'mismatch' ? REFUSED.chain : REFUSED.chainRead;
            this.alertOnce(reason);
            return { status: 'refused', reason };
        }
        const nonces = await this.readNonces();
        if (nonces.kind !== 'ok') return { status: 'refused', reason: nonces.reason };
        if (!(await this.rememberNonce(nonces.latest, nonces.pending, flight))) {
            return { status: 'refused', reason: REFUSED.journal };
        }
        if (nonces.latest > BigInt(flight.nonce)) return this.consume(flight, nonces.latest);
        const sent = await this.rebroadcast(flight);
        if (sent === 'above') return this.pendingOf(flight);
        if (sent === 'refused') return { status: 'refused', reason: REFUSED.refusedJournal };
        if (sent === 'gate') return { status: 'refused', reason: REFUSED.gate };
        if (sent === 'chain') return { status: 'refused', reason: REFUSED.chain };
        if (sent === 'ceiling') return { status: 'refused', reason: REFUSED.ceiling };
        if (sent === 'journal') return { status: 'refused', reason: REFUSED.journal };
        if (sent === 'broadcast') return { status: 'refused', reason: REFUSED.broadcast };
        return this.pendingOf(this.journal.inFlight() ?? flight);
    }

    private stallDue(flight: InFlight): boolean {
        const age = this.safeNow() - flight.firstSentAt;
        return Number.isSafeInteger(age) && age >= this.stallSec * 1000;
    }

    /** In-memory latch first. A failed journal write does not clear it. */
    private rememberStall(flight: InFlight): void {
        if (this.stalled) return;
        this.stalled = true;
        this.stalledNonce = flight.nonce;
        this.accountDirty = true;
    }

    private async emitStall(flight: InFlight): Promise<void> {
        const text = await this.stalenessText();
        const message = `in-flight nonce ${flight.nonce} not included after ${this.stallSec}s; ALL sends closed until a human acts; ${text}`;
        this.alertOnce(`stall:${flight.nonce}`, message);
    }

    private async stalenessText(): Promise<string> {
        let read: StalenessRead | 'unreadable' | 'timeout';
        try {
            read = await this.withTimeout(this.readStaleness(), this.limits.receiptLookupMs);
        } catch {
            read = 'unreadable';
        }
        if (read === 'timeout') read = 'unreadable';
        if (read === 'unreadable' || typeof read.updatedAtSec !== 'bigint' || typeof read.thresholdSec !== 'bigint') {
            return 'SuperPaymaster price staleness unreadable';
        }
        if (read.updatedAtSec < 0n || read.thresholdSec < 0n) return 'SuperPaymaster price staleness unreadable';
        const deadlineSec = read.updatedAtSec + read.thresholdSec;
        if (deadlineSec > BigInt(Number.MAX_SAFE_INTEGER)) return 'SuperPaymaster price staleness unreadable';
        const deadlineMs = Number(deadlineSec) * 1000;
        const iso = new Date(deadlineMs).toISOString();
        const left = deadlineMs - this.safeNow();
        const minutes = left <= 0 ? 0 : Math.ceil(left / 60_000);
        return `SuperPaymaster price goes stale at ${iso} (in ${minutes} min)`;
    }

    private async clearStallLocked(): Promise<{ status: 'cleared' | 'idle' | 'refused'; reason?: string }> {
        const loaded = await this.journal.load();
        if (loaded === 'missing') return { status: 'idle' };
        if (loaded !== 'ok') return { status: 'refused', reason: this.journalReason(loaded) };
        await this.hydrate();
        const flight = this.journal.inFlight();
        if (!this.stalled && !flight) return { status: 'idle' };
        const chain = await this.seenChain();
        if (chain !== 'ok') return { status: 'refused', reason: chain === 'mismatch' ? REFUSED.chain : REFUSED.chainRead };
        const nonce = this.stalledNonce ?? flight?.nonce ?? null;
        const fees = {
            maxFeePerGas: flight?.maxFeePerGas ?? 0n,
            maxPriorityFeePerGas: flight?.maxPriorityFeePerGas ?? 0n,
        };
        if (nonce === null) {
            this.alert(this.manualStep(0, fees));
            return { status: 'refused', reason: REFUSED.clearStall };
        }
        const nonces = await this.readNonces();
        if (nonces.kind !== 'ok') return { status: 'refused', reason: nonces.reason };
        if (nonces.latest > BigInt(nonce)) {
            const snapshot: ReceiptSnapshot | null = flight
                ? { nonce: flight.nonce, hashes: [...flight.hashes], kind: flight.kind }
                : null;
            try {
                await this.journal.commit({
                    inFlight: null,
                    sentAt: [...this.sentAt],
                    ceilingClosed: this.ceilingClosed,
                    lastLatest: nonces.latest,
                    stalled: false,
                    stalledNonce: null,
                });
            } catch {
                return { status: 'refused', reason: REFUSED.journal };
            }
            this.stalled = false;
            this.stalledNonce = null;
            this.lastLatest = nonces.latest;
            this.accountDirty = false;
            if (snapshot) this.deferReceipt(snapshot);
            return { status: 'cleared' };
        }
        this.alert(`stall clear refused: chain latest is not past nonce ${nonce}. ${this.manualStep(nonce, fees)}`);
        return { status: 'refused', reason: REFUSED.clearStall };
    }

    private noteNonce(latest: bigint, pending: bigint, flight: InFlight | null): boolean {
        const unexplained = flight
            ? latest > BigInt(flight.nonce) + 1n || (latest <= BigInt(flight.nonce) && pending > BigInt(flight.nonce) + 1n)
            : (this.lastLatest !== null && latest > this.lastLatest) || pending > latest;
        if (unexplained) this.alertOnce(ALERT.foreign);
        const changed = this.lastLatest !== latest;
        this.lastLatest = latest;
        return changed;
    }

    private async rememberNonce(latest: bigint, pending: bigint, flight: InFlight | null): Promise<boolean> {
        const changed = this.noteNonce(latest, pending, flight);
        if (!changed && !this.accountDirty) return true;
        return this.persistAccount();
    }

    private async noteForeign(flight: InFlight | null): Promise<void> {
        const nonces = await this.readNonces();
        if (nonces.kind !== 'ok') return;
        await this.rememberNonce(nonces.latest, nonces.pending, flight);
    }

    /**
     * Durable clear of the flight first. The stall latch stays until --clear-stall.
     * The receipt lookup is outside this queue.
     */
    private async consume(flight: InFlight, latest?: bigint): Promise<MaintainResult> {
        const snapshot: ReceiptSnapshot = { nonce: flight.nonce, hashes: [...flight.hashes], kind: flight.kind };
        try {
            await this.journal.commit({
                inFlight: null,
                sentAt: [...this.sentAt],
                ceilingClosed: this.ceilingClosed,
                lastLatest: latest ?? this.lastLatest,
                stalled: this.stalled,
                stalledNonce: this.stalledNonce,
            });
        } catch {
            return { status: 'refused', reason: REFUSED.journal };
        }
        this.accountDirty = false;
        this.deferReceipt(snapshot);
        return { status: 'consumed', unseen: true, kind: flight.kind };
    }

    /** After the journal commit returns. The lookup is not on the signing queue. */
    private deferReceipt(snapshot: ReceiptSnapshot): void {
        if (this.receiptQueue.some((job) => job.nonce === snapshot.nonce)) return;
        const hashes: Hex[] = [];
        const source = snapshot.hashes.length > JOURNAL_HASH_CAP
            ? snapshot.hashes.slice(snapshot.hashes.length - JOURNAL_HASH_CAP)
            : snapshot.hashes;
        if (source.length > JOURNAL_HASH_CAP) return;
        for (let i = 0; i < source.length; i++) {
            const hash = source[i];
            if (typeof hash !== 'string' || hash.length < 4 || hash.length > 66) continue;
            hashes.push(hash);
        }
        if (this.receiptQueue.length >= RECEIPT_QUEUE_MAX) {
            this.settlements.push({ kind: snapshot.kind, nonce: snapshot.nonce, outcome: 'unavailable' });
            this.alertOnce(`${ALERT.unavailable}:${snapshot.nonce}`, ALERT.unavailable);
            return;
        }
        this.receiptQueue.push({ nonce: snapshot.nonce, hashes, kind: snapshot.kind, tries: 0 });
        this.receiptArm = Promise.resolve().then(() => {
            this.pumpReceipts();
        });
    }

    /** One bounded lookup per queued nonce for this tick. A running lookup is not cancelled. */
    private pumpReceipts(): void {
        if (this.receiptTask) return;
        let job: { nonce: number; hashes: Hex[]; kind: IntentKind; tries: number } | undefined;
        for (let i = 0; i < this.receiptQueue.length; i++) {
            const item = this.receiptQueue[i];
            if (!item || item.tries >= RECEIPT_TRIES) continue;
            if (this.receiptEpochOf.get(item.nonce) === this.receiptEpoch) continue;
            job = item;
            break;
        }
        if (!job) return;
        this.receiptEpochOf.set(job.nonce, this.receiptEpoch);
        job.tries += 1;
        const task = this.lookupReceipt(job).finally(() => {
            if (this.receiptTask === task) this.receiptTask = null;
            this.pumpReceipts();
        });
        this.receiptTask = task;
    }

    private dropReceipt(nonce: number): void {
        for (let i = 0; i < this.receiptQueue.length; i++) {
            if (this.receiptQueue[i]?.nonce !== nonce) continue;
            this.receiptQueue.splice(i, 1);
            return;
        }
    }

    private async lookupReceipt(snapshot: { nonce: number; hashes: Hex[]; kind: IntentKind; tries: number }): Promise<void> {
        const found = await this.withTimeout(this.findReceipt(snapshot.hashes), this.limits.receiptLookupMs);
        if (found === 'timeout' || found === 'unread' || found === 'none') {
            if (snapshot.tries < RECEIPT_TRIES) return;
            this.dropReceipt(snapshot.nonce);
            this.settlements.push({ kind: snapshot.kind, nonce: snapshot.nonce, outcome: 'unavailable' });
            this.alertOnce(`${ALERT.unavailable}:${snapshot.nonce}`, ALERT.unavailable);
            return;
        }
        this.dropReceipt(snapshot.nonce);
        this.settlements.push({
            kind: snapshot.kind,
            nonce: snapshot.nonce,
            outcome: found.status === 'success' ? 'receipt' : 'reverted',
            hash: found.transactionHash,
            receipt: copyReceipt(found),
        });
    }

    private withTimeout<T>(work: Promise<T>, ms: number): Promise<T | 'timeout'> {
        return new Promise((resolve) => {
            const timer = setTimeout(() => resolve('timeout'), ms);
            work.then(
                (value) => {
                    clearTimeout(timer);
                    resolve(value);
                },
                () => {
                    clearTimeout(timer);
                    resolve('timeout');
                },
            );
        });
    }

    private async findReceipt(hashes: readonly Hex[]): Promise<'unread' | 'none' | ChainReceipt> {
        let unread = false;
        const list = hashes.length > JOURNAL_HASH_CAP ? hashes.slice(hashes.length - JOURNAL_HASH_CAP) : hashes;
        for (const hash of list) {
            let receipt: ChainReceipt | null;
            try {
                receipt = await this.chain.getTransactionReceipt(hash);
            } catch {
                unread = true;
                continue;
            }
            if (!receipt) continue;
            const got = typeof receipt.transactionHash === 'string' ? receipt.transactionHash.toLowerCase() : '';
            if (got !== hash.toLowerCase()) continue;
            let block: { hash: Hex; number: bigint } | null;
            try {
                block = await this.chain.getBlockByNumber(receipt.blockNumber);
            } catch {
                unread = true;
                continue;
            }
            if (!block || typeof block.hash !== 'string' || typeof block.number !== 'bigint') {
                unread = true;
                continue;
            }
            if (block.number !== receipt.blockNumber || block.hash.toLowerCase() !== receipt.blockHash.toLowerCase()) {
                unread = true;
                continue;
            }
            return copyReceipt(receipt);
        }
        return unread ? 'unread' : 'none';
    }

    private pendingOf(flight: InFlight): MaintainResult {
        const hash = flight.hashes[flight.hashes.length - 1];
        return hash ? { status: 'pending', hash } : { status: 'refused', reason: REFUSED.journal };
    }

    private aboveCeiling(decoded: Decoded): boolean {
        return decoded.maxFeePerGas > this.maxFeeWei || decoded.maxPriorityFeePerGas > this.maxFeeWei;
    }

    /** Journal metadata must match the decoded raw. Replay does not apply the current gas cap. */
    private async decodedFlight(flight: InFlight): Promise<Decoded | null> {
        const raw = flight.raws[flight.raws.length - 1];
        if (!raw) return null;
        const decoded = await decodeRaw(raw, this.signerAddress);
        if (!decoded) return null;
        if (decoded.nonce !== flight.nonce || decoded.gas !== flight.gasLimit) return null;
        if (decoded.maxFeePerGas !== flight.maxFeePerGas || decoded.maxPriorityFeePerGas !== flight.maxPriorityFeePerGas) return null;
        if (!checkIntent(flight.kind, asIntent(decoded), this.targets(), { enforceMaxGas: false })) return null;
        return decoded;
    }

    /** Same raw. Free when this raw was already charged. A fee above the current ceiling is not sent. */
    private async rebroadcast(flight: InFlight): Promise<'ok' | 'refused' | 'gate' | 'chain' | 'ceiling' | 'above' | 'journal' | 'broadcast'> {
        const loaded = await this.journal.load();
        if (loaded !== 'ok') return 'refused';
        const current = this.journal.inFlight();
        if (!current) return 'refused';
        const raw = current.raws[current.raws.length - 1];
        if (!raw) return 'refused';
        const decoded = await this.decodedFlight(current);
        if (!decoded) return 'refused';
        if (this.aboveCeiling(decoded)) {
            this.alertOnce(ALERT.aboveFee);
            return 'above';
        }
        const entry = {
            nonce: current.nonce,
            kind: current.kind,
            to: decoded.to,
            data: decoded.data,
            gasLimit: decoded.gas,
            maxFeePerGas: decoded.maxFeePerGas,
            maxPriorityFeePerGas: decoded.maxPriorityFeePerGas,
        };
        const allowed = await replayRawAllowed(raw, entry, { chainId: this.chainId, signer: this.signerAddress }, (kind, tx) => {
            return checkIntent(kind, {
                to: tx.to,
                data: tx.data,
                value: 0n,
                gas: tx.gas,
                chainId: this.chainId,
                type: 'eip1559',
                accessListEmpty: true,
            }, this.targets(), { enforceMaxGas: false });
        });
        if (!allowed) return 'refused';
        return this.broadcast(raw, current);
    }

    private async signNew(job: SendRequest): Promise<SendResult> {
        const quoted = await this.readFees();
        if (typeof quoted === 'string') return { status: 'refused', reason: quoted };
        let estimated: bigint;
        try {
            estimated = await this.chain.estimateGas({ to: job.to, data: job.data, from: this.signerAddress });
        } catch {
            return { status: 'refused', reason: REFUSED.gas };
        }
        if (typeof estimated !== 'bigint' || estimated <= 0n || estimated > this.maxGas) return { status: 'refused', reason: REFUSED.gas };
        let gasLimit = estimated + estimated / 5n;
        if (gasLimit > this.maxGas) gasLimit = this.maxGas;
        if (gasLimit < estimated) return { status: 'refused', reason: REFUSED.gas };
        const fees = signingFees(quoted, this.maxFeeWei, this.maxTipWei);
        if (!fees) return { status: 'refused', reason: REFUSED.fee };
        const nonces = await this.readNonces();
        if (nonces.kind !== 'ok') return { status: 'refused', reason: nonces.reason };
        if (nonces.pending > BigInt(Number.MAX_SAFE_INTEGER)) return { status: 'refused', reason: REFUSED.nonce };
        const nonce = Number(nonces.pending);
        const opened = await this.ensureJournal();
        if (opened !== 'ok') return { status: 'refused', reason: opened };
        if (!(await this.rememberNonce(nonces.latest, nonces.pending, null))) {
            return { status: 'refused', reason: REFUSED.journal };
        }
        if (this.journal.inFlight()) return { status: 'refused', reason: REFUSED.journal };
        if (this.stalled) return { status: 'refused', reason: REFUSED.stalled };
        const request: SignRequest = {
            to: job.to,
            data: job.data,
            nonce,
            gasLimit,
            maxFeePerGas: fees.fee,
            maxPriorityFeePerGas: fees.tip,
            chainId: this.chainId,
        };
        if (!authorizeSign(job.kind, request, this.targets(), this.maxFeeWei)) {
            this.alertOnce(`${REFUSED.unresolved}:${job.kind}`, REFUSED.unresolved);
            return { status: 'refused', reason: REFUSED.request };
        }
        const beforeSign = await this.seenChain();
        if (beforeSign !== 'ok') return { status: 'refused', reason: beforeSign === 'mismatch' ? REFUSED.chain : REFUSED.chainRead };
        if (this.ceilingClosed || this.budgetExhausted()) {
            this.ceilingClosed = true;
            this.alertOnce(ALERT.sendCeiling);
            if (!(await this.persistAccount())) return { status: 'refused', reason: REFUSED.journal };
            return { status: 'refused', reason: REFUSED.ceiling };
        }
        if (this.stalled) return { status: 'refused', reason: REFUSED.stalled };
        if (!this.allows(job.kind)) return this.refuseGate();
        const signed = await this.signOf(request);
        if (!signed.ok) {
            this.alertOnce(signed.reason);
            return { status: 'refused', reason: signed.reason };
        }
        const decoded = await decodeRaw(signed.raw, this.signerAddress);
        if (!decoded) return { status: 'refused', reason: REFUSED.sign };
        if (!checkIntent(job.kind, asIntent(decoded), this.targets())) return { status: 'refused', reason: REFUSED.sign };
        if (decoded.nonce !== nonce || decoded.gas !== gasLimit || decoded.maxFeePerGas !== fees.fee || decoded.maxPriorityFeePerGas !== fees.tip) {
            return { status: 'refused', reason: REFUSED.sign };
        }
        const hash = keccak256(signed.raw);
        const entry: InFlight = {
            kind: job.kind,
            nonce,
            raws: [signed.raw],
            hashes: [hash],
            gasLimit,
            maxFeePerGas: fees.fee,
            maxPriorityFeePerGas: fees.tip,
            attempts: 0,
            firstSentAt: this.safeNow(),
            broadcastOnce: [],
        };
        if (!(await replayRawAllowed(signed.raw, {
            nonce,
            kind: job.kind,
            to: decoded.to,
            data: decoded.data,
            gasLimit,
            maxFeePerGas: fees.fee,
            maxPriorityFeePerGas: fees.tip,
        }, { chainId: this.chainId, signer: this.signerAddress }, () => true))) {
            return { status: 'refused', reason: REFUSED.sign };
        }
        const afterSign = await this.seenChain();
        if (afterSign !== 'ok') return { status: 'refused', reason: afterSign === 'mismatch' ? REFUSED.chain : REFUSED.chainRead };
        if (!this.allows(job.kind)) return this.refuseGate();
        try {
            await this.journal.writeInFlight(entry);
        } catch {
            return { status: 'refused', reason: REFUSED.journal };
        }
        const sent = await this.broadcast(signed.raw, entry);
        if (sent === 'gate') return this.refuseGate();
        if (sent === 'chain') return { status: 'refused', reason: REFUSED.chain };
        if (sent === 'ceiling') return { status: 'refused', reason: REFUSED.ceiling };
        if (sent === 'above') return { status: 'refused', reason: REFUSED.fee };
        if (sent === 'journal') return { status: 'refused', reason: REFUSED.journal };
        if (sent === 'refused') return { status: 'refused', reason: REFUSED.refusedJournal };
        if (sent === 'broadcast') return { status: 'refused', reason: REFUSED.broadcast };
        return { status: 'pending', hash };
    }

    /**
     * Last awaited prerequisite is the journal write of a first broadcast, or the chain-id read for a repeat.
     * The gate check after that await is synchronous. A raw is charged once, on its first broadcast.
     */
    private async broadcast(raw: Hex, flight: InFlight): Promise<'ok' | 'refused' | 'gate' | 'chain' | 'ceiling' | 'above' | 'journal' | 'broadcast'> {
        const chainOk = await this.seenChain();
        if (chainOk !== 'ok') return 'chain';
        if (this.stalled) return 'gate';
        if (!this.allows(flight.kind)) return this.ceilingClosed ? 'ceiling' : 'gate';
        const decoded = await decodeRaw(raw, this.signerAddress);
        if (!decoded || decoded.maxFeePerGas !== flight.maxFeePerGas || decoded.maxPriorityFeePerGas !== flight.maxPriorityFeePerGas) {
            return 'refused';
        }
        if (this.aboveCeiling(decoded)) {
            this.alertOnce(ALERT.aboveFee);
            return 'above';
        }
        if (!this.allows(flight.kind)) return this.ceilingClosed ? 'ceiling' : 'gate';
        const hash = keccak256(raw);
        const already = flight.broadcastOnce ?? [];
        const counted = already.some((item) => norm(item) === norm(hash));
        if (!counted) {
            if (!this.takeSendSlot()) {
                if (!(await this.persistAccount())) return 'journal';
                return 'ceiling';
            }
            const broadcastOnce = [...already, hash];
            while (broadcastOnce.length > JOURNAL_HASH_CAP) broadcastOnce.shift();
            const next = { ...flight, broadcastOnce };
            try {
                await this.journal.commit({
                    inFlight: next,
                    sentAt: [...this.sentAt],
                    ceilingClosed: this.ceilingClosed,
                    lastLatest: this.lastLatest,
                    stalled: this.stalled,
                    stalledNonce: this.stalledNonce,
                });
                this.accountDirty = false;
            } catch {
                this.hydrated = false;
                this.accountDirty = true;
                return 'journal';
            }
            if (!this.allows(flight.kind)) return this.ceilingClosed ? 'ceiling' : 'gate';
        }
        try {
            await this.chain.sendRawTransaction(raw);
        } catch {
            this.alertOnce(REFUSED.broadcast);
            return 'broadcast';
        }
        return 'ok';
    }

    private async hydrate(): Promise<void> {
        if (this.hydrated) return;
        const account: JournalAccount = this.journal.account();
        this.sentAt.length = 0;
        for (const at of account.sentAt) this.sentAt.push(at);
        this.ceilingClosed = account.ceilingClosed;
        if (this.lastLatest === null) this.lastLatest = account.lastLatest;
        this.stalled = account.stalled === true;
        this.stalledNonce = account.stalled ? account.stalledNonce : null;
        this.pruneSends();
        let reopen = false;
        if (this.resetSendCeiling && this.ceilingClosed && this.sentAt.length < this.maxSendsPerHour) {
            this.ceilingClosed = false;
            reopen = true;
        }
        this.hydrated = true;
        if (reopen) await this.persistAccount();
    }

    private async ensureJournal(): Promise<'ok' | string> {
        const loaded = await this.journal.load();
        if (loaded === 'missing') {
            try {
                await this.journal.init();
            } catch {
                return REFUSED.journal;
            }
            this.hydrated = true;
            if (!(await this.persistAccount())) return REFUSED.journal;
            return 'ok';
        }
        if (loaded !== 'ok') return this.journalReason(loaded);
        await this.hydrate();
        return 'ok';
    }

    private async persistAccount(): Promise<boolean> {
        try {
            await this.journal.commit({
                sentAt: [...this.sentAt],
                ceilingClosed: this.ceilingClosed,
                lastLatest: this.lastLatest,
                stalled: this.stalled,
                stalledNonce: this.stalledNonce,
            });
            this.accountDirty = false;
            return true;
        } catch {
            this.accountDirty = true;
            return false;
        }
    }

    private pruneSends(): void {
        const now = this.safeNow();
        const fresh = this.sentAt.filter((at) => now - at < HOUR_MS);
        this.sentAt.length = 0;
        for (const at of fresh) this.sentAt.push(at);
    }

    /** True when the first broadcast of a new raw would be refused. Does not charge a slot. */
    private budgetExhausted(): boolean {
        if (this.ceilingClosed) return true;
        this.pruneSends();
        return this.sentAt.length >= this.maxSendsPerHour;
    }

    private takeSendSlot(): boolean {
        if (this.ceilingClosed) return false;
        this.pruneSends();
        if (this.sentAt.length >= this.maxSendsPerHour) {
            this.ceilingClosed = true;
            this.alertOnce(ALERT.sendCeiling);
            return false;
        }
        this.sentAt.push(this.safeNow());
        return true;
    }

    private safeNow(): number {
        const now = this.now();
        return Number.isSafeInteger(now) && now >= 0 ? now : 0;
    }

    private refuseGate(): SendResult {
        this.alertOnce(REFUSED.gate);
        return { status: 'refused', reason: REFUSED.gate };
    }

    private async readFees(): Promise<{ baseFee: bigint; tip: bigint } | string> {
        try {
            const quoted = await this.chain.fees();
            const baseFee = quoted?.baseFee;
            const tip = quoted?.tip;
            if (typeof baseFee !== 'bigint' || typeof tip !== 'bigint' || baseFee < 0n || tip < 0n) return REFUSED.fee;
            return { baseFee, tip };
        } catch {
            return REFUSED.fee;
        }
    }

    private async readNonces(): Promise<{ kind: 'ok'; latest: bigint; pending: bigint } | { kind: 'stop'; reason: string }> {
        try {
            const latest = await this.chain.getTransactionCount(this.signerAddress, 'latest');
            const pending = await this.chain.getTransactionCount(this.signerAddress, 'pending');
            if (typeof latest !== 'bigint' || typeof pending !== 'bigint' || latest < 0n || pending < 0n || pending < latest) {
                return { kind: 'stop', reason: REFUSED.nonce };
            }
            return { kind: 'ok', latest, pending };
        } catch {
            return { kind: 'stop', reason: REFUSED.nonce };
        }
    }

    private async signOf(req: SignRequest): Promise<{ ok: true; raw: Hex } | { ok: false; reason: string }> {
        try {
            const raw = await this.signer.sign(req);
            if (typeof raw !== 'string' || !isData(raw)) return { ok: false, reason: REFUSED.sign };
            return { ok: true, raw };
        } catch (error) {
            return { ok: false, reason: fixedSignReason(error) };
        }
    }
}
