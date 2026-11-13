/**
 * One in-flight price transaction. The key signs only the three alpha intents, and only while the gate is open.
 * Pause is not an intent. A nonce the chain has consumed is cleared whether or not we can see the receipt.
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
import { CANCEL_GAS, type RawSigner, type SignRequest } from './castSigner.js';
import type { JournalAccount } from './journal.js';
import { Journal, JOURNAL_HASH_CAP, JOURNAL_RAW_KEEP, type InFlight, type IntentKind } from './journal.js';
import { replayRawAllowed } from './replayGuard.js';

export const UPDATE_PRICE_DATA = encodeFunctionData({
    abi: parseAbi(['function updatePrice()']),
    functionName: 'updatePrice',
});

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
    /** Nonce moved and none of our retained hashes has a receipt. */
    unseen?: boolean;
    kind?: IntentKind;
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
    chain: 'sender: chain id mismatch',
    chainRead: 'sender: chain id unreadable',
    ceiling: 'sender: send ceiling',
    unresolved: 'sender: target unresolved',
} as const;

const ALERT = {
    foreign: 'signer nonce moved outside this keeper',
    feeCeiling: 'in-flight at fee ceiling',
    stuckCeiling: 'in-flight at fee ceiling; cannot replace or cancel',
    aboveCeiling: 'in-flight above current fee ceiling — cancel required',
    sendCeiling: 'send ceiling exceeded — all sends closed',
    unseen: 'nonce consumed (not by a tx we can see)',
} as const;

const DEFERRED_RECEIPT_TRIES = 10;

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

/** At least 125% of prev and at least one wei above it, and never under the floor. */
export function bumpFee(prev: bigint, floor: bigint): bigint {
    if (prev < 0n || floor < 0n) return 1n;
    const scaled = (prev * 5n + 3n) / 4n;
    let next = scaled > floor ? scaled : floor;
    if (next <= prev) next = prev + 1n;
    return next;
}

/**
 * Two price targets, once per poll, never above 30, plus six replacement slots.
 * pollIntervalSec is the keeper's poll, in seconds.
 */
export function defaultMaxSendsPerHour(pollIntervalSec: number): number {
    if (!Number.isInteger(pollIntervalSec) || pollIntervalSec <= 0 || pollIntervalSec > 86_400) {
        throw new Error('sender: pollIntervalSec invalid');
    }
    const perTarget = Math.ceil(3600 / pollIntervalSec);
    return Math.min(2 * perTarget, 30) + 6;
}

/**
 * The only authorization check. Price targets must be the configured addresses.
 * An unresolved PaymasterV4 or SuperPaymaster refuses that kind.
 */
export function checkIntent(kind: string, tx: IntentTx, targets: IntentTargets): boolean {
    if (!tx || typeof tx.to !== 'string' || typeof tx.data !== 'string') return false;
    if (tx.value !== 0n || tx.type !== 'eip1559' || tx.accessListEmpty !== true) return false;
    if (tx.chainId !== targets.chainId) return false;
    if (typeof tx.gas !== 'bigint' || tx.gas <= 0n) return false;
    const to = norm(tx.to);
    const data = norm(tx.data);
    if (kind === 'cancel') {
        return to === norm(targets.signer) && data === '0x' && tx.gas === CANCEL_GAS;
    }
    if (tx.gas > targets.maxGas) return false;
    if (data !== norm(UPDATE_PRICE_DATA)) return false;
    if (kind === 'price-super') {
        return targets.superPaymaster !== null && to === norm(targets.superPaymaster);
    }
    if (kind === 'price-paymaster') {
        return targets.paymaster !== null && to === norm(targets.paymaster);
    }
    return false;
}

/** The one signing gate. The request is the exact object cast will receive. */
export function authorizeSign(kind: string, req: SignRequest, targets: IntentTargets, maxFeeWei: bigint): boolean {
    if (!req || typeof req.to !== 'string' || typeof req.data !== 'string') return false;
    if (typeof req.gasLimit !== 'bigint' || typeof req.maxFeePerGas !== 'bigint' || typeof req.maxPriorityFeePerGas !== 'bigint') return false;
    if (typeof maxFeeWei !== 'bigint' || maxFeeWei <= 0n) return false;
    if (req.maxPriorityFeePerGas < 0n || req.maxFeePerGas < req.maxPriorityFeePerGas) return false;
    if (req.maxFeePerGas > maxFeeWei || req.maxPriorityFeePerGas > maxFeeWei) return false;
    if (kind === 'cancel') {
        if (req.cancel !== true) return false;
    } else if (req.cancel === true) {
        return false;
    }
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

/** Outgoing tip, then `2 * baseFee + tip`, then the ceiling. `over` cannot outbid inside the ceiling. */
export function replacementFees(
    prevFee: bigint,
    prevTip: bigint,
    quoted: { baseFee: bigint; tip: bigint },
    maxFeeWei: bigint,
): { fee: bigint; tip: bigint } | 'over' {
    if (prevFee < 0n || prevTip < 0n || quoted.baseFee < 0n || quoted.tip < 0n) return 'over';
    const tip = bumpFee(prevTip, quoted.tip);
    const floor = 2n * quoted.baseFee + tip;
    const fee = bumpFee(prevFee, floor);
    if (fee > maxFeeWei || tip > maxFeeWei) return 'over';
    if (fee <= prevFee || tip <= prevTip) return 'over';
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
    if (tx.maxFeePerGas === undefined || tx.maxPriorityFeePerGas === undefined) return null;
    return {
        to: tx.to,
        data: (tx.data ?? '0x') as Hex,
        value: tx.value ?? 0n,
        gas: tx.gas,
        chainId: tx.chainId,
        nonce: tx.nonce,
        maxFeePerGas: tx.maxFeePerGas,
        maxPriorityFeePerGas: tx.maxPriorityFeePerGas,
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

export class Sender {
    private readonly chain: ChainIO;
    private readonly signer: RawSigner;
    private readonly journal: Journal;
    private readonly signerAddress: Address;
    private readonly chainId: number;
    private readonly maxGas: bigint;
    private readonly maxFeeWei: bigint;
    private readonly maxSendsPerHour: number;
    private readonly bumpAfterTicks: number;
    private readonly receiptWaitMs: number;
    private readonly pollIntervalMs: number;
    private readonly alert: (msg: string) => void;
    private readonly now: () => number;
    private readonly paymaster: () => Address | null;
    private readonly superPaymaster: Address | null;
    private readonly enabled: EnabledKinds;
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
    /** Set by tick(). The next settle consumes each flag at most once. */
    private ageArmed = false;
    private gapArmed = false;
    private gapTicks = 0;
    private unreported: { nonce: number; hashes: Hex[]; kind: IntentKind; tries: number } | null = null;

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
        maxSendsPerHour: number;
        bumpAfterTicks?: number;
        now?: () => number;
        receiptWaitMs?: number;
        pollIntervalMs?: number;
        alert: (msg: string) => void;
        /** Clear a closed ceiling once the rolling hour has room again. */
        resetSendCeiling?: boolean;
    }) {
        const receiptWaitMs = opts.receiptWaitMs ?? 90_000;
        const pollIntervalMs = opts.pollIntervalMs ?? 3_000;
        const bumpAfterTicks = opts.bumpAfterTicks ?? 3;
        const maxGas = opts.maxGas ?? 500_000n;
        if (!Number.isInteger(receiptWaitMs) || receiptWaitMs <= 0) throw new Error('sender: receiptWaitMs invalid');
        if (!Number.isInteger(pollIntervalMs) || pollIntervalMs <= 0) throw new Error('sender: pollIntervalMs invalid');
        if (!Number.isInteger(bumpAfterTicks) || bumpAfterTicks <= 0) throw new Error('sender: bumpAfterTicks invalid');
        if (!Number.isInteger(opts.chainId) || opts.chainId <= 0) throw new Error('sender: chainId invalid');
        if (!Number.isInteger(opts.maxSendsPerHour) || opts.maxSendsPerHour <= 0 || opts.maxSendsPerHour > 10_000) {
            throw new Error('sender: maxSendsPerHour invalid');
        }
        if (typeof maxGas !== 'bigint' || maxGas < CANCEL_GAS || maxGas > 30_000_000n) throw new Error('sender: maxGas invalid');
        if (typeof opts.maxFeeWei !== 'bigint' || opts.maxFeeWei <= 0n || opts.maxFeeWei > 10_000n * 1_000_000_000n) {
            throw new Error('sender: maxFeeWei invalid');
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
        this.chain = opts.chain;
        this.signer = opts.signer;
        this.journal = opts.journal;
        this.signerAddress = opts.signerAddress;
        this.chainId = opts.chainId;
        this.maxGas = maxGas;
        this.maxFeeWei = opts.maxFeeWei;
        this.maxSendsPerHour = opts.maxSendsPerHour;
        this.bumpAfterTicks = bumpAfterTicks;
        this.receiptWaitMs = receiptWaitMs;
        this.pollIntervalMs = pollIntervalMs;
        this.alert = opts.alert;
        this.now = now;
        this.paymaster = opts.paymaster;
        this.superPaymaster = opts.superPaymaster;
        this.enabled = { 'price-super': enabled['price-super'], 'price-paymaster': enabled['price-paymaster'] };
        this.resetSendCeiling = opts.resetSendCeiling === true;
        Object.freeze(this.enabled);
    }

    /** One keeper loop iteration. Settlement from several call sites in that iteration ages once. */
    tick(): void {
        this.ageArmed = true;
        this.gapArmed = true;
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

    /** True only when both scopes are open and the decision has not expired. */
    gateOpen(): boolean {
        return this.gate.price && this.gate.pause && this.timeFresh();
    }

    /** Refuse new work. An in-flight send already on the queue still finishes. */
    stop(): void {
        this.stopping = true;
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
            return { status: 'refused', reason: REFUSED.send };
        }
    }

    /** Receipt, rebroadcast, bump, and cancel. Runs even when no new update is due. */
    async maintain(): Promise<MaintainResult> {
        if (this.stopping) return { status: 'refused', reason: REFUSED.stopping };
        try {
            return await this.enqueue(() => this.settle());
        } catch {
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

    /**
     * Sync. Call only after the last awaited prerequisite.
     * A disabled kind blocks a new send elsewhere. It does not block maintenance of a raw already signed.
     */
    private allows(kind: IntentKind): boolean {
        if (this.ceilingClosed || !this.chainIdOk || !this.timeFresh() || !this.gate.price) return false;
        return kind === 'cancel' || kind === 'price-super' || kind === 'price-paymaster';
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
        if (!this.enabled[job.kind]) return { status: 'refused', reason: REFUSED.disabled };
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
        return REFUSED.refusedJournal;
    }

    private async settle(): Promise<MaintainResult> {
        const loaded = await this.journal.load();
        if (loaded === 'missing') return { status: 'idle' };
        if (loaded !== 'ok') return { status: 'refused', reason: this.journalReason(loaded) };
        await this.hydrate();
        const flight = this.journal.inFlight();
        const result = flight ? await this.serviceFlight(flight) : await this.idleForeign();
        await this.reportDeferred();
        return result;
    }

    private async idleForeign(): Promise<MaintainResult> {
        await this.noteForeign(null);
        return { status: 'idle' };
    }

    private async serviceFlight(flight: InFlight): Promise<MaintainResult> {
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
        if (nonces.latest > BigInt(flight.nonce)) return this.consume(flight);
        if (nonces.latest < BigInt(flight.nonce) && nonces.pending <= nonces.latest) {
            if (this.gapArmed) {
                this.gapArmed = false;
                this.gapTicks += 1;
            }
            if (this.gapTicks >= this.bumpAfterTicks) {
                const message = `nonce gap below in-flight ${flight.nonce}; re-signing at latest`;
                this.alertOnce(`gap:${flight.nonce}`, message);
                try {
                    await this.journal.writeInFlight(null);
                } catch {
                    return { status: 'refused', reason: REFUSED.journal };
                }
                this.gapTicks = 0;
                return { status: 'idle' };
            }
        } else {
            this.gapTicks = 0;
        }
        const disabled = flight.kind !== 'cancel' && this.enabled[flight.kind] !== true;
        if (disabled) {
            const decoded = await this.decodedFlight(flight);
            if (!decoded) return { status: 'refused', reason: REFUSED.refusedJournal };
            return this.cancelInFlight(flight, decoded);
        }
        return this.serviceOpen(flight);
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

    private async consume(flight: InFlight): Promise<MaintainResult> {
        const found = await this.findReceipt(flight.hashes);
        try {
            await this.journal.writeInFlight(null);
        } catch {
            return { status: 'refused', reason: REFUSED.journal };
        }
        if (found === 'unread') {
            this.unreported = { nonce: flight.nonce, hashes: [...flight.hashes], kind: flight.kind, tries: 0 };
            return { status: 'pending' };
        }
        if (found === 'none') {
            this.alertOnce(`${ALERT.unseen}:${flight.nonce}`, ALERT.unseen);
            return { status: 'consumed', unseen: true, kind: flight.kind };
        }
        return { status: 'consumed', hash: found.transactionHash, receipt: found, kind: flight.kind };
    }

    /** Best-effort receipt for a nonce already cleared. It never decides the settle result. */
    private async reportDeferred(): Promise<void> {
        const pending = this.unreported;
        if (!pending) return;
        if (pending.tries >= DEFERRED_RECEIPT_TRIES) {
            this.unreported = null;
            return;
        }
        pending.tries += 1;
        const found = await this.findReceipt(pending.hashes);
        if (found === 'unread') return;
        this.unreported = null;
        if (found === 'none') this.alertOnce(`${ALERT.unseen}:${pending.nonce}`, ALERT.unseen);
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

    private takeAge(current: number): number {
        if (!this.ageArmed) return current;
        this.ageArmed = false;
        if (current >= Number.MAX_SAFE_INTEGER) return current;
        return current + 1;
    }

    private pendingOf(flight: InFlight): MaintainResult {
        const hash = flight.hashes[flight.hashes.length - 1];
        return hash ? { status: 'pending', hash } : { status: 'refused', reason: REFUSED.journal };
    }

    private aboveCeiling(decoded: Decoded): boolean {
        return decoded.maxFeePerGas > this.maxFeeWei || decoded.maxPriorityFeePerGas > this.maxFeeWei;
    }

    /** Journal metadata must match the decoded raw. The signer never sees a second set of fields. */
    private async decodedFlight(flight: InFlight): Promise<Decoded | null> {
        const raw = flight.raws[flight.raws.length - 1];
        if (!raw) return null;
        const decoded = await decodeRaw(raw, this.signerAddress);
        if (!decoded) return null;
        if (decoded.nonce !== flight.nonce || decoded.gas !== flight.gasLimit) return null;
        if (decoded.maxFeePerGas !== flight.maxFeePerGas || decoded.maxPriorityFeePerGas !== flight.maxPriorityFeePerGas) return null;
        if (!checkIntent(flight.kind, asIntent(decoded), this.targets())) return null;
        return decoded;
    }

    private async serviceOpen(flight: InFlight): Promise<MaintainResult> {
        const attempts = this.takeAge(flight.attempts);
        const once = flight.broadcastOnce ?? [];
        const aged = attempts === flight.attempts ? flight : { ...flight, attempts, raws: [...flight.raws], hashes: [...flight.hashes], broadcastOnce: [...once] };
        const decoded = await this.decodedFlight(aged);
        if (!decoded) return { status: 'refused', reason: REFUSED.refusedJournal };
        if (this.aboveCeiling(decoded)) {
            this.alertOnce(ALERT.aboveCeiling);
            if (flight.kind === 'cancel') return this.pendingOf(flight);
            return this.cancelInFlight(aged, decoded);
        }
        if (attempts >= this.bumpAfterTicks) {
            const bumped = await this.replace(aged, decoded);
            if (bumped === 'replaced') return this.pendingOf(this.journal.inFlight() ?? aged);
            if (bumped === 'kept') return this.pendingOf(this.journal.inFlight() ?? aged);
        }
        const sent = await this.rebroadcast(aged);
        if (sent === 'refused') return { status: 'refused', reason: REFUSED.refusedJournal };
        if (sent === 'gate') return { status: 'refused', reason: REFUSED.gate };
        if (sent === 'chain') return { status: 'refused', reason: REFUSED.chain };
        if (sent === 'ceiling') return { status: 'refused', reason: REFUSED.ceiling };
        if (sent === 'journal') return { status: 'refused', reason: REFUSED.journal };
        if (sent === 'above') return this.cancelInFlight(this.journal.inFlight() ?? aged, decoded);
        return this.pendingOf(this.journal.inFlight() ?? aged);
    }

    /** Latest raw, re-checked against the current ceiling, then broadcast. */
    private async rebroadcast(flight: InFlight): Promise<'ok' | 'refused' | 'gate' | 'chain' | 'ceiling' | 'above' | 'journal'> {
        const loaded = await this.journal.load();
        if (loaded !== 'ok') return 'refused';
        const current = this.journal.inFlight();
        if (!current) return 'refused';
        const raw = current.raws[current.raws.length - 1];
        if (!raw) return 'refused';
        const decoded = await this.decodedFlight({ ...current, attempts: flight.attempts });
        if (!decoded) return 'refused';
        if (this.aboveCeiling(decoded)) {
            this.alertOnce(ALERT.aboveCeiling);
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
        if (!(await replayRawAllowed(raw, entry, { chainId: this.chainId, signer: this.signerAddress }, () => true))) {
            return 'refused';
        }
        const aged = { ...current, attempts: flight.attempts };
        if (aged.attempts !== current.attempts) {
            try {
                await this.journal.writeInFlight(aged);
            } catch {
                return 'journal';
            }
        }
        return this.broadcast(raw, this.journal.inFlight() ?? aged);
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
        const maxTip = quoted.tip > this.maxFeeWei ? this.maxFeeWei : quoted.tip;
        let maxFee = 2n * quoted.baseFee + maxTip;
        if (maxFee < maxTip) maxFee = maxTip;
        if (maxFee > this.maxFeeWei || maxTip > this.maxFeeWei) return { status: 'refused', reason: REFUSED.fee };
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
        const request: SignRequest = {
            to: job.to,
            data: job.data,
            nonce,
            gasLimit,
            maxFeePerGas: maxFee,
            maxPriorityFeePerGas: maxTip,
            chainId: this.chainId,
        };
        if (!authorizeSign(job.kind, request, this.targets(), this.maxFeeWei)) {
            this.alertOnce(`${REFUSED.unresolved}:${job.kind}`, REFUSED.unresolved);
            return { status: 'refused', reason: REFUSED.request };
        }
        if ((await this.seenChain()) !== 'ok') return { status: 'refused', reason: REFUSED.chainRead };
        if (this.ceilingClosed) return { status: 'refused', reason: REFUSED.ceiling };
        if (!this.allows(job.kind)) return this.refuseGate();
        const signed = await this.signOf(request);
        if (!signed.ok) return { status: 'refused', reason: signed.reason };
        if (!this.allows(job.kind)) return this.refuseGate();
        const decoded = await decodeRaw(signed.raw, this.signerAddress);
        if (!decoded) return { status: 'refused', reason: REFUSED.sign };
        if (!checkIntent(job.kind, asIntent(decoded), this.targets())) return { status: 'refused', reason: REFUSED.sign };
        if (decoded.nonce !== nonce || decoded.gas !== gasLimit || decoded.maxFeePerGas !== maxFee || decoded.maxPriorityFeePerGas !== maxTip) {
            return { status: 'refused', reason: REFUSED.sign };
        }
        if (!this.allows(job.kind)) return this.refuseGate();
        const hash = keccak256(signed.raw);
        const entry: InFlight = {
            kind: job.kind,
            nonce,
            raws: [signed.raw],
            hashes: [hash],
            gasLimit,
            maxFeePerGas: maxFee,
            maxPriorityFeePerGas: maxTip,
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
            maxFeePerGas: maxFee,
            maxPriorityFeePerGas: maxTip,
        }, { chainId: this.chainId, signer: this.signerAddress }, () => true))) {
            return { status: 'refused', reason: REFUSED.sign };
        }
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
        return { status: 'pending', hash };
    }

    /**
     * Sign the decoded raw's fields, not a second copy stored beside it.
     * A cancel stays a cancel. Attempts restart after a bump that was journaled.
     */
    private async replace(flight: InFlight, decoded: Decoded): Promise<'replaced' | 'rebroadcast' | 'kept'> {
        const quoted = await this.readFees();
        if (typeof quoted === 'string') return 'rebroadcast';
        const fees = replacementFees(decoded.maxFeePerGas, decoded.maxPriorityFeePerGas, quoted, this.maxFeeWei);
        if (fees === 'over') {
            if (this.aboveCeiling(decoded)) this.alertOnce(ALERT.aboveCeiling);
            else this.alertOnce(ALERT.feeCeiling);
            return this.aboveCeiling(decoded) ? 'kept' : 'rebroadcast';
        }
        const request: SignRequest = {
            to: decoded.to,
            data: decoded.data,
            nonce: decoded.nonce,
            gasLimit: decoded.gas,
            maxFeePerGas: fees.fee,
            maxPriorityFeePerGas: fees.tip,
            chainId: this.chainId,
            cancel: flight.kind === 'cancel' ? true : undefined,
        };
        if (!authorizeSign(flight.kind, request, this.targets(), this.maxFeeWei)) return 'rebroadcast';
        if ((await this.seenChain()) !== 'ok') return 'rebroadcast';
        if (!this.allows(flight.kind)) return 'rebroadcast';
        const signed = await this.signOf(request);
        if (!signed.ok) return 'rebroadcast';
        if (!this.allows(flight.kind)) return 'rebroadcast';
        const again = await decodeRaw(signed.raw, this.signerAddress);
        if (!again || !authorizeSign(flight.kind, {
            to: again.to,
            data: again.data,
            nonce: again.nonce,
            gasLimit: again.gas,
            maxFeePerGas: again.maxFeePerGas,
            maxPriorityFeePerGas: again.maxPriorityFeePerGas,
            chainId: again.chainId,
            cancel: flight.kind === 'cancel' ? true : undefined,
        }, this.targets(), this.maxFeeWei)) {
            return 'rebroadcast';
        }
        if (again.maxFeePerGas !== fees.fee || again.maxPriorityFeePerGas !== fees.tip || again.nonce !== flight.nonce || again.gas !== decoded.gas) {
            return 'rebroadcast';
        }
        if (!this.allows(flight.kind)) return 'rebroadcast';
        const hash = keccak256(signed.raw);
        const hashes = [...flight.hashes, hash];
        while (hashes.length > JOURNAL_HASH_CAP) hashes.shift();
        const raws = [...flight.raws, signed.raw];
        while (raws.length > JOURNAL_RAW_KEEP) raws.shift();
        const next: InFlight = {
            ...flight,
            raws,
            hashes,
            gasLimit: decoded.gas,
            maxFeePerGas: fees.fee,
            maxPriorityFeePerGas: fees.tip,
            attempts: 0,
            broadcastOnce: [...(flight.broadcastOnce ?? [])],
        };
        try {
            await this.journal.writeInFlight(next);
        } catch {
            return 'rebroadcast';
        }
        await this.broadcast(signed.raw, next);
        return 'replaced';
    }

    private async cancelInFlight(flight: InFlight, decoded: Decoded): Promise<MaintainResult> {
        if (flight.kind === 'cancel') return this.pendingOf(flight);
        if (this.aboveCeiling(decoded)) this.alertOnce(ALERT.aboveCeiling);
        const quoted = await this.readFees();
        if (typeof quoted === 'string') return { status: 'refused', reason: quoted };
        const fees = replacementFees(decoded.maxFeePerGas, decoded.maxPriorityFeePerGas, quoted, this.maxFeeWei);
        if (fees === 'over') {
            if (this.aboveCeiling(decoded)) return this.pendingOf(flight);
            this.alertOnce(ALERT.stuckCeiling);
            const sent = await this.rebroadcast(flight);
            if (sent === 'gate') return { status: 'refused', reason: REFUSED.gate };
            if (sent === 'ceiling') return { status: 'refused', reason: REFUSED.ceiling };
            if (sent === 'chain') return { status: 'refused', reason: REFUSED.chain };
            if (sent === 'journal') return { status: 'refused', reason: REFUSED.journal };
            return this.pendingOf(this.journal.inFlight() ?? flight);
        }
        const request: SignRequest = {
            to: this.signerAddress,
            data: '0x',
            nonce: flight.nonce,
            gasLimit: CANCEL_GAS,
            maxFeePerGas: fees.fee,
            maxPriorityFeePerGas: fees.tip,
            chainId: this.chainId,
            cancel: true,
        };
        if (!authorizeSign('cancel', request, this.targets(), this.maxFeeWei)) return { status: 'refused', reason: REFUSED.request };
        if ((await this.seenChain()) !== 'ok') return { status: 'refused', reason: REFUSED.chainRead };
        if (this.ceilingClosed) return { status: 'refused', reason: REFUSED.ceiling };
        if (!this.allows('cancel')) return { status: 'refused', reason: REFUSED.gate };
        const signed = await this.signOf(request);
        if (!signed.ok) return { status: 'refused', reason: signed.reason };
        if (!this.allows('cancel')) return { status: 'refused', reason: REFUSED.gate };
        const again = await decodeRaw(signed.raw, this.signerAddress);
        if (!again || !checkIntent('cancel', asIntent(again), this.targets())) {
            return { status: 'refused', reason: REFUSED.sign };
        }
        if (again.maxFeePerGas !== fees.fee || again.maxPriorityFeePerGas !== fees.tip) {
            return { status: 'refused', reason: REFUSED.sign };
        }
        if (!this.allows('cancel')) return { status: 'refused', reason: REFUSED.gate };
        const hash = keccak256(signed.raw);
        const hashes = [...flight.hashes, hash];
        while (hashes.length > JOURNAL_HASH_CAP) hashes.shift();
        const next: InFlight = {
            kind: 'cancel',
            nonce: flight.nonce,
            raws: [signed.raw],
            hashes,
            gasLimit: CANCEL_GAS,
            maxFeePerGas: fees.fee,
            maxPriorityFeePerGas: fees.tip,
            attempts: 0,
            firstSentAt: flight.firstSentAt,
            broadcastOnce: [...(flight.broadcastOnce ?? [])],
        };
        try {
            await this.journal.writeInFlight(next);
        } catch {
            return { status: 'refused', reason: REFUSED.journal };
        }
        const sent = await this.broadcast(signed.raw, next);
        if (sent === 'gate') return { status: 'refused', reason: REFUSED.gate };
        if (sent === 'ceiling') return { status: 'refused', reason: REFUSED.ceiling };
        if (sent === 'journal') return { status: 'refused', reason: REFUSED.journal };
        return { status: 'pending', hash };
    }

    /**
     * Last awaited prerequisite is the journal write of a first broadcast, or the chain-id read for a repeat.
     * The gate check after that await is synchronous. A raw is charged once, on its first broadcast.
     */
    private async broadcast(raw: Hex, flight: InFlight): Promise<'ok' | 'refused' | 'gate' | 'chain' | 'ceiling' | 'above' | 'journal'> {
        const chainOk = await this.seenChain();
        if (chainOk !== 'ok') return 'chain';
        if (!this.allows(flight.kind)) return this.ceilingClosed ? 'ceiling' : 'gate';
        const decoded = await decodeRaw(raw, this.signerAddress);
        if (!decoded || decoded.maxFeePerGas !== flight.maxFeePerGas || decoded.maxPriorityFeePerGas !== flight.maxPriorityFeePerGas) {
            return 'refused';
        }
        if (this.aboveCeiling(decoded)) {
            this.alertOnce(ALERT.aboveCeiling);
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
            // A thrown broadcast is not a second nonce. The journal already has the raw.
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
