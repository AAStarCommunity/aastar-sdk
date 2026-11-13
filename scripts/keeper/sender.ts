/**
 * One send path for price updates and operator pauses.
 * Every send reconciles the journal under the sender lock before it signs or broadcasts.
 */
import { keccak256, type Address, type Hex } from 'viem';
import { CANCEL_GAS, type RawSigner, type SignRequest } from './castSigner.js';
import { JOURNAL_ATTEMPT_CAP, JOURNAL_HASH_CAP, Journal, type JournalEntry, type JournalKind } from './journal.js';
import { replayRawAllowed, type ReplayIntent } from './replayGuard.js';

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

export type SendRequest = { kind: 'price-super' | 'price-paymaster' | 'pause'; to: Address; data: Hex };

export type SendResult =
    | { status: 'included'; hash: Hex; receipt: ChainReceipt }
    | { status: 'pending'; hash: Hex }
    | { status: 'blocked'; inFlightHash: Hex }
    | { status: 'refused'; reason: string };

export interface EnabledKinds {
    'price-super': boolean;
    'price-paymaster': boolean;
    pause: boolean;
}

const GAS_CAP = 30_000_000n;
const REFUSED = {
    gate: 'sender: gate closed',
    stopping: 'sender: stopping',
    disabled: 'sender: kind disabled',
    corrupt: 'sender: journal corrupt',
    unsafe: 'sender: journal unsafe',
    refusedJournal: 'sender: journal refused',
    nonce: 'sender: nonce read failed',
    baseline: 'sender: nonce baseline refused',
    foreign: 'sender: foreign nonce',
    behind: 'sender: nonce behind journal',
    receipt: 'sender: receipt rejected',
    journal: 'sender: journal write failed',
    gas: 'sender: gas estimate failed',
    fee: 'sender: fee read failed',
    sign: 'sender: sign failed',
    request: 'sender: request rejected',
    send: 'sender: send failed',
    chain: 'sender: chain id mismatch',
    chainRead: 'sender: chain id unreadable',
} as const;

const STICKY = new Set<string>([REFUSED.corrupt, REFUSED.unsafe, REFUSED.refusedJournal, REFUSED.foreign, REFUSED.receipt, REFUSED.chain, 'sender: journal belongs to another signer']);

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAddress(value: string): value is Address {
    if (value.length !== 42) return false;
    for (let i = 2; i < value.length; i++) {
        const c = value.charCodeAt(i);
        const hex = (c >= 48 && c <= 57) || (c >= 97 && c <= 102) || (c >= 65 && c <= 70);
        if (!hex) return false;
    }
    return value.charCodeAt(0) === 48 && value.charCodeAt(1) === 120;
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

function copyJob(req: SendRequest): SendRequest | null {
    if (!req || (req.kind !== 'price-super' && req.kind !== 'price-paymaster' && req.kind !== 'pause')) return null;
    if (typeof req.to !== 'string' || typeof req.data !== 'string') return null;
    if (!isAddress(req.to) || !isData(req.data)) return null;
    return { kind: req.kind, to: req.to, data: req.data };
}

/** Cancel broadcasts only its latest raw. Price broadcasts the raws still on disk. */
function rawsToBroadcast(entry: JournalEntry): Hex[] {
    const latest = entry.raws[entry.raws.length - 1];
    if (!latest) return [];
    if (entry.kind === 'cancel' || entry.cancelled === true) return [latest];
    return [...entry.raws];
}

/** At least 125% of prev and at least one wei above it, and never under the floor. */
export function bumpFee(prev: bigint, floor: bigint): bigint {
    if (prev < 0n || floor < 0n) return 1n;
    const scaled = (prev * 5n + 3n) / 4n;
    let next = scaled > floor ? scaled : floor;
    if (next <= prev) next = prev + 1n;
    return next;
}

function fixedSignReason(error: unknown): string {
    const message = error instanceof Error ? error.message : '';
    if (message.startsWith('cast signer:') || message.startsWith('secret file:') || message.startsWith('sender:')) return message;
    return REFUSED.sign;
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

export interface ReconcileReport {
    ok: boolean;
    missing: boolean;
    reason: string | null;
    latest: bigint;
    pending: bigint;
    service: JournalEntry | null;
    /** There was already a signed or sent entry before demotion. */
    hadOpen: boolean;
    /** An open nonce was proven consumed and foreignNonce was written. */
    consumedOpen: boolean;
}

const EMPTY_REPORT: ReconcileReport = {
    ok: false,
    missing: false,
    reason: REFUSED.send,
    latest: 0n,
    pending: 0n,
    service: null,
    hadOpen: false,
    consumedOpen: false,
};

async function readChainId(chain: ChainIO, expected: number): Promise<string | null> {
    let id: number;
    try {
        id = await chain.chainId();
    } catch {
        return REFUSED.chainRead;
    }
    if (!Number.isInteger(id) || id <= 0) return REFUSED.chainRead;
    if (id !== expected) return REFUSED.chain;
    return null;
}

/**
 * Chain id, then nonce walk. Included-ahead entries are demoted from the earliest hole.
 * A consumed nonce with no canonical receipt for our hashes is persisted as foreignNonce.
 */
export async function reconcileLoaded(opts: {
    chain: ChainIO;
    journal: Journal;
    chainId: number;
    signerAddress: Address;
    intent: ReplayIntent;
}): Promise<ReconcileReport> {
    const chainReason = await readChainId(opts.chain, opts.chainId);
    if (chainReason) return { ...EMPTY_REPORT, reason: chainReason };
    const loaded = await opts.journal.load();
    if (loaded === 'missing') {
        const nonces = await readNonces(opts.chain, opts.signerAddress);
        if (nonces.kind !== 'ok') return { ...EMPTY_REPORT, reason: nonces.reason };
        return { ...EMPTY_REPORT, ok: true, missing: true, reason: null, latest: nonces.latest, pending: nonces.pending };
    }
    if (loaded === 'corrupt') return { ...EMPTY_REPORT, reason: REFUSED.corrupt };
    if (loaded === 'unsafe') return { ...EMPTY_REPORT, reason: REFUSED.unsafe };
    if (loaded === 'mismatch') return { ...EMPTY_REPORT, reason: 'sender: journal belongs to another signer' };
    const identity = { chainId: opts.chainId, signer: opts.signerAddress };
    for (const entry of opts.journal.entries()) {
        for (const raw of entry.raws) {
            const allowed = await replayRawAllowed(raw, entry, identity, opts.intent);
            if (!allowed) return { ...EMPTY_REPORT, reason: REFUSED.refusedJournal };
        }
    }
    if (opts.journal.foreignNonce() !== null) {
        return { ...EMPTY_REPORT, reason: REFUSED.foreign, consumedOpen: true };
    }
    const nonces = await readNonces(opts.chain, opts.signerAddress);
    if (nonces.kind !== 'ok') return { ...EMPTY_REPORT, reason: nonces.reason };
    const hadOpen = opts.journal.hasOpenEntry();
    const entries = opts.journal.entries();
    let changed = false;
    for (const entry of entries) {
        if (entry.nonce < nonces.latest) {
            const hit = await findCanonical(opts.chain, entry, entry.hashes);
            if (hit === 'bad') return { ...EMPTY_REPORT, reason: REFUSED.receipt, latest: nonces.latest, pending: nonces.pending };
            if (hit) {
                if (entry.status !== 'included') {
                    entry.status = 'included';
                    changed = true;
                }
                continue;
            }
            if (nonces.pending !== nonces.latest) {
                return { ...EMPTY_REPORT, reason: REFUSED.baseline, latest: nonces.latest, pending: nonces.pending, hadOpen };
            }
            try {
                await opts.journal.rewrite(entries, entry.nonce);
            } catch {
                return { ...EMPTY_REPORT, reason: REFUSED.journal, latest: nonces.latest, pending: nonces.pending };
            }
            return {
                ...EMPTY_REPORT,
                reason: REFUSED.foreign,
                latest: nonces.latest,
                pending: nonces.pending,
                consumedOpen: true,
                hadOpen,
            };
        }
        if (entry.status === 'included') {
            entry.status = 'sent';
            changed = true;
        }
    }
    if (changed) {
        try {
            await opts.journal.rewrite(entries, null);
        } catch {
            return { ...EMPTY_REPORT, reason: REFUSED.journal, latest: nonces.latest, pending: nonces.pending, hadOpen };
        }
    }
    const service = opts.journal.inFlight();
    if (!service && nonces.latest > BigInt(opts.journal.nextNonce())) {
        if (nonces.pending !== nonces.latest) {
            return { ...EMPTY_REPORT, reason: REFUSED.baseline, latest: nonces.latest, pending: nonces.pending, hadOpen };
        }
        try {
            await opts.journal.rewrite(opts.journal.entries(), opts.journal.nextNonce());
        } catch {
            return { ...EMPTY_REPORT, reason: REFUSED.journal, latest: nonces.latest, pending: nonces.pending };
        }
        return { ...EMPTY_REPORT, reason: REFUSED.foreign, latest: nonces.latest, pending: nonces.pending, consumedOpen: false, hadOpen };
    }
    return {
        ok: true,
        missing: false,
        reason: null,
        latest: nonces.latest,
        pending: nonces.pending,
        service,
        hadOpen,
        consumedOpen: false,
    };
}

async function readNonces(chain: ChainIO, signer: Address): Promise<{ kind: 'ok'; latest: bigint; pending: bigint } | { kind: 'stop'; reason: string }> {
    try {
        const latest = await chain.getTransactionCount(signer, 'latest');
        const pending = await chain.getTransactionCount(signer, 'pending');
        if (typeof latest !== 'bigint' || typeof pending !== 'bigint' || latest < 0n || pending < 0n) {
            return { kind: 'stop', reason: REFUSED.nonce };
        }
        return { kind: 'ok', latest, pending };
    } catch {
        return { kind: 'stop', reason: REFUSED.nonce };
    }
}

async function findCanonical(chain: ChainIO, entry: JournalEntry, hashes: readonly Hex[]): Promise<'bad' | ChainReceipt | null> {
    for (const hash of hashes) {
        let receipt: ChainReceipt | null;
        try {
            receipt = await chain.getTransactionReceipt(hash);
        } catch {
            continue;
        }
        if (!receipt) continue;
        const got = typeof receipt.transactionHash === 'string' ? receipt.transactionHash.toLowerCase() : '';
        if (got !== hash.toLowerCase()) continue;
        let block: { hash: Hex; number: bigint } | null = null;
        try {
            block = await chain.getBlockByNumber(receipt.blockNumber);
        } catch {
            block = null;
        }
        if (!block || typeof block.hash !== 'string' || typeof block.number !== 'bigint') continue;
        if (block.number !== receipt.blockNumber || block.hash.toLowerCase() !== receipt.blockHash.toLowerCase()) continue;
        if (typeof receipt.gasUsed !== 'bigint' || receipt.gasUsed <= 0n) return 'bad';
        const latest = entry.hashes[entry.hashes.length - 1]?.toLowerCase() === hash.toLowerCase();
        if (latest && receipt.gasUsed > entry.gasLimit) return 'bad';
        return copyReceipt(receipt);
    }
    return null;
}

export class Sender {
    private readonly chain: ChainIO;
    private readonly signer: RawSigner;
    private readonly journal: Journal;
    private readonly signerAddress: Address;
    private readonly chainId: number;
    private readonly receiptWaitMs: number;
    private readonly pollIntervalMs: number;
    private readonly bumpAfterAttempts: number;
    private readonly alert: (msg: string) => void;
    private readonly intent: ReplayIntent;
    private readonly enabled: EnabledKinds;
    private readonly now: () => number;
    private gate: { price: boolean; pause: boolean; reason: string; validUntil: number } = {
        price: false,
        pause: false,
        reason: REFUSED.gate,
        validUntil: 0,
    };
    private queue: Promise<void> = Promise.resolve();
    private sticky: string | null = null;
    private stopping = false;
    private readonly alerted = new Set<string>();

    constructor(opts: {
        chain: ChainIO;
        signer: RawSigner;
        journal: Journal;
        signerAddress: Address;
        chainId: number;
        intent: ReplayIntent;
        enabledKinds?: EnabledKinds;
        now?: () => number;
        receiptWaitMs?: number;
        pollIntervalMs?: number;
        bumpAfterAttempts?: number;
        alert: (msg: string) => void;
    }) {
        const receiptWaitMs = opts.receiptWaitMs ?? 90_000;
        const pollIntervalMs = opts.pollIntervalMs ?? 3_000;
        const bumpAfterAttempts = opts.bumpAfterAttempts ?? 3;
        if (!Number.isInteger(receiptWaitMs) || receiptWaitMs <= 0) throw new Error('sender: receiptWaitMs invalid');
        if (!Number.isInteger(pollIntervalMs) || pollIntervalMs <= 0) throw new Error('sender: pollIntervalMs invalid');
        if (!Number.isInteger(bumpAfterAttempts) || bumpAfterAttempts <= 0) throw new Error('sender: bumpAfterAttempts invalid');
        if (!Number.isInteger(opts.chainId) || opts.chainId <= 0) throw new Error('sender: chainId invalid');
        if (typeof opts.signerAddress !== 'string' || !isAddress(opts.signerAddress)) throw new Error('sender: signer invalid');
        if (typeof opts.alert !== 'function') throw new Error('sender: alert invalid');
        if (typeof opts.intent !== 'function') throw new Error('sender: intent invalid');
        const enabled = opts.enabledKinds ?? { 'price-super': true, 'price-paymaster': true, pause: true };
        if (typeof enabled['price-super'] !== 'boolean' || typeof enabled['price-paymaster'] !== 'boolean' || typeof enabled.pause !== 'boolean') {
            throw new Error('sender: enabledKinds invalid');
        }
        const now = opts.now ?? (() => Date.now());
        if (typeof now !== 'function') throw new Error('sender: now invalid');
        this.chain = opts.chain;
        this.signer = opts.signer;
        this.journal = opts.journal;
        this.signerAddress = opts.signerAddress;
        this.chainId = opts.chainId;
        this.receiptWaitMs = receiptWaitMs;
        this.pollIntervalMs = pollIntervalMs;
        this.bumpAfterAttempts = bumpAfterAttempts;
        this.alert = opts.alert;
        this.intent = opts.intent;
        this.enabled = { 'price-super': enabled['price-super'], 'price-paymaster': enabled['price-paymaster'], pause: enabled.pause };
        this.now = now;
    }

    /** Price kinds and pause are separate. Pause can be closed while price still signs. */
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

    private allows(kind: JournalKind): boolean {
        return kind === 'pause' ? this.gate.pause : this.gate.price;
    }

    private timeFresh(): boolean {
        const now = this.now();
        return Number.isSafeInteger(now) && now >= 0 && now < this.gate.validUntil;
    }

    private priceFresh(): boolean {
        return this.gate.price && this.timeFresh();
    }

    private kindFresh(kind: JournalKind): boolean {
        if (!this.timeFresh()) return false;
        if (kind === 'pause') return this.gate.pause;
        return this.gate.price;
    }

    async send(req: SendRequest): Promise<SendResult> {
        if (this.stopping) return { status: 'refused', reason: REFUSED.stopping };
        const job = copyJob(req);
        if (!job) return { status: 'refused', reason: REFUSED.request };
        const prev = this.queue;
        let release: () => void = () => {};
        this.queue = new Promise<void>((resolve) => {
            release = resolve;
        });
        try {
            await prev;
            if (this.stopping) return { status: 'refused', reason: REFUSED.stopping };
            return await this.sendLocked(job);
        } catch {
            return { status: 'refused', reason: REFUSED.send };
        } finally {
            release();
        }
    }

    private alertOnce(key: string, message = key): void {
        if (this.alerted.has(key)) return;
        this.alerted.add(key);
        this.alert(message);
    }

    private noteSticky(reason: string): void {
        if (!STICKY.has(reason)) return;
        this.sticky = reason;
        this.alertOnce(reason);
    }

    /** A resolved nonce may be behind, stuck, or blocking price again later. Sticky refusals stay. */
    private clearResolved(nonce: number, kind: string): void {
        const stuck = `stuck:${nonce}`;
        if (this.alerted.delete(stuck)) this.alert(`stuck in-flight nonce ${nonce} kind ${kind} recovered`);
        this.alerted.delete(`price-blocked:${nonce}`);
        this.alerted.delete(REFUSED.behind);
    }

    private notePriceBlocked(job: SendRequest, nonce: number): void {
        if (job.kind === 'pause') return;
        this.alertOnce(`price-blocked:${nonce}`, `price update blocked behind in-flight nonce ${nonce}`);
    }

    private refuseGate(): SendResult {
        this.alertOnce(REFUSED.gate);
        return { status: 'refused', reason: REFUSED.gate };
    }

    private async sendLocked(job: SendRequest): Promise<SendResult> {
        if (!this.enabled[job.kind]) return { status: 'refused', reason: REFUSED.disabled };
        if (!this.kindFresh(job.kind)) return this.refuseGate();
        if (this.sticky) return { status: 'refused', reason: this.sticky };

        const report = await reconcileLoaded({
            chain: this.chain,
            journal: this.journal,
            chainId: this.chainId,
            signerAddress: this.signerAddress,
            intent: this.intent,
        });
        if (!report.ok) {
            this.noteSticky(report.reason ?? REFUSED.send);
            if (report.reason === REFUSED.foreign) {
                this.alertOnce(`${REFUSED.foreign} expected=${this.safeNext()} seen latest=${report.latest} pending=${report.pending}`);
            }
            if (report.reason === REFUSED.chain || report.reason === REFUSED.chainRead) this.alertOnce(report.reason);
            return { status: 'refused', reason: report.reason ?? REFUSED.send };
        }
        if (report.missing) {
            if (report.latest !== report.pending) {
                this.alertOnce(`${REFUSED.baseline} expected latest==pending seen latest=${report.latest} pending=${report.pending}`);
                return { status: 'refused', reason: REFUSED.baseline };
            }
            if (report.latest > BigInt(Number.MAX_SAFE_INTEGER)) return { status: 'refused', reason: REFUSED.nonce };
            try {
                await this.journal.init(Number(report.latest));
            } catch {
                return { status: 'refused', reason: REFUSED.journal };
            }
        }

        if (report.service) {
            const serviced = await this.service(report.service, job);
            if (!report.hadOpen && report.latest < BigInt(this.safeNext())) {
                this.alertOnce(REFUSED.behind, `${REFUSED.behind} expected=${this.safeNext()} seen latest=${report.latest} pending=${report.pending}`);
                return { status: 'refused', reason: REFUSED.behind };
            }
            if (serviced.kind === 'stop') {
                if (serviced.result.status === 'pending' || serviced.result.status === 'blocked') {
                    const nonce = this.journal.inFlight()?.nonce;
                    if (nonce !== undefined) this.notePriceBlocked(job, nonce);
                    if (serviced.result.status === 'pending') return { status: 'blocked', inFlightHash: serviced.result.hash };
                    return serviced.result;
                }
                return serviced.result;
            }
            if (this.journal.inFlight()) {
                const nonce = this.journal.inFlight()?.nonce;
                const hash = this.journal.inFlight()?.hashes.at(-1);
                if (nonce !== undefined && hash) {
                    this.notePriceBlocked(job, nonce);
                    return { status: 'blocked', inFlightHash: hash };
                }
                return { status: 'refused', reason: REFUSED.journal };
            }
        }

        if (!this.kindFresh(job.kind)) return this.refuseGate();
        const nonces = await readNonces(this.chain, this.signerAddress);
        if (nonces.kind !== 'ok') return { status: 'refused', reason: nonces.reason };
        const next = this.journal.nextNonce();
        const nonceStop = await this.classifyFresh(nonces.latest, nonces.pending, next);
        if (nonceStop) return nonceStop;
        return this.signNew(job, next);
    }

    private safeNext(): number {
        try {
            return this.journal.nextNonce();
        } catch {
            return -1;
        }
    }

    private async classifyFresh(latest: bigint, pending: bigint, next: number): Promise<SendResult | null> {
        const expected = BigInt(next);
        if (latest < expected) {
            this.alertOnce(REFUSED.behind, `${REFUSED.behind} expected=${next} seen latest=${latest} pending=${pending}`);
            return { status: 'refused', reason: REFUSED.behind };
        }
        if (latest > expected) {
            if (pending === latest) {
                try {
                    await this.journal.rewrite(this.journal.entries(), next);
                } catch {
                    return { status: 'refused', reason: REFUSED.journal };
                }
            }
            this.noteSticky(REFUSED.foreign);
            this.alertOnce(`${REFUSED.foreign} expected=${next} seen latest=${latest} pending=${pending}`);
            return { status: 'refused', reason: REFUSED.foreign };
        }
        if (pending > latest) {
            this.noteSticky(REFUSED.foreign);
            this.alertOnce(`${REFUSED.foreign} expected=${next} seen latest=${latest} pending=${pending}`);
            return { status: 'refused', reason: REFUSED.foreign };
        }
        if (pending !== latest) return { status: 'refused', reason: REFUSED.nonce };
        return null;
    }

    /** One outstanding nonce: rebroadcast and bump when the kind is allowed, otherwise cancel it. */
    private async service(entry: JournalEntry, job: SendRequest): Promise<{ kind: 'clear' } | { kind: 'stop'; result: SendResult }> {
        const disabled = entry.kind !== 'cancel' && this.enabled[entry.kind] !== true;
        if (disabled || !this.allows(entry.kind)) {
            if (!this.allows(job.kind) && !disabled) return { kind: 'stop', result: { status: 'blocked', inFlightHash: entry.hashes.at(-1) ?? '0x' } };
            if (!this.priceFresh()) return { kind: 'stop', result: this.refuseGate() };
            return this.cancelInFlight(entry);
        }
        if (!this.kindFresh(entry.kind)) return { kind: 'stop', result: this.refuseGate() };
        const verified = await this.verifiedRaws(entry);
        if (!verified) return { kind: 'stop', result: this.stickyResult(REFUSED.refusedJournal) };
        for (const raw of verified) {
            const sent = await this.broadcast(raw, entry.kind);
            if (sent) return { kind: 'stop', result: sent };
        }
        const hit = await this.poll(entry, entry.hashes.slice(-3));
        if (hit === 'bad') return { kind: 'stop', result: this.stickyResult(REFUSED.receipt) };
        if (hit === 'included') return this.markIncluded(entry);
        const attempts = entry.attempts >= JOURNAL_ATTEMPT_CAP ? entry.attempts : entry.attempts + 1;
        if (attempts !== entry.attempts) {
            try {
                await this.journal.updateInFlight({ attempts });
            } catch {
                return { kind: 'stop', result: { status: 'refused', reason: REFUSED.journal } };
            }
        }
        if (attempts >= this.bumpAfterAttempts * 3) {
            this.alertOnce(`stuck:${entry.nonce}`, `stuck in-flight nonce ${entry.nonce} kind ${entry.kind} attempts ${attempts}`);
        }
        const freshEntry = this.journal.inFlight();
        if (!freshEntry) return { kind: 'stop', result: { status: 'refused', reason: REFUSED.journal } };
        if (attempts >= this.bumpAfterAttempts && freshEntry.hashes.length < JOURNAL_HASH_CAP) {
            if (!this.kindFresh(freshEntry.kind)) return { kind: 'stop', result: this.refuseGate() };
            const bumped = await this.replace(freshEntry);
            if (bumped !== 'ok') return { kind: 'stop', result: { status: 'refused', reason: bumped } };
        }
        const fresh = this.journal.inFlight();
        const pendingHash = fresh?.hashes[fresh.hashes.length - 1] ?? entry.hashes.at(-1);
        if (!pendingHash) return { kind: 'stop', result: { status: 'refused', reason: REFUSED.journal } };
        return { kind: 'stop', result: { status: 'pending', hash: pendingHash } };
    }

    private seen: ChainReceipt | null = null;

    private async signNew(job: SendRequest, next: number): Promise<SendResult> {
        const quoted = await this.readFees();
        if (typeof quoted === 'string') return { status: 'refused', reason: quoted };
        let estimated: bigint;
        try {
            estimated = await this.chain.estimateGas({ to: job.to, data: job.data, from: this.signerAddress });
        } catch {
            return { status: 'refused', reason: REFUSED.gas };
        }
        if (typeof estimated !== 'bigint' || estimated <= 0n || estimated > GAS_CAP) return { status: 'refused', reason: REFUSED.gas };
        const gasLimit = estimated + estimated / 5n;
        if (gasLimit <= 0n || gasLimit > GAS_CAP) return { status: 'refused', reason: REFUSED.gas };
        let maxFee = 2n * quoted.baseFee + quoted.tip;
        const maxTip = quoted.tip;
        if (maxFee < maxTip) maxFee = maxTip;
        if (maxTip === 0n) {
            // A later replacement must be able to raise a zero tip. The first send may still be zero.
        }
        if (!this.kindFresh(job.kind)) return this.refuseGate();
        const chainReason = await readChainId(this.chain, this.chainId);
        if (chainReason) {
            this.noteSticky(chainReason === REFUSED.chain ? chainReason : '');
            if (chainReason === REFUSED.chain) this.alertOnce(chainReason);
            return { status: 'refused', reason: chainReason };
        }
        const signed = await this.signOf({
            to: job.to,
            data: job.data,
            nonce: next,
            gasLimit,
            maxFeePerGas: maxFee,
            maxPriorityFeePerGas: maxTip,
            chainId: this.chainId,
        });
        if (!signed.ok) return { status: 'refused', reason: signed.reason };
        const hash = keccak256(signed.raw);
        const entry: JournalEntry = {
            nonce: next,
            kind: job.kind,
            to: job.to,
            data: job.data,
            raws: [signed.raw],
            hashes: [hash],
            gasLimit,
            maxFeePerGas: maxFee,
            maxPriorityFeePerGas: maxTip,
            status: 'signed',
            attempts: 1,
            createdAt: this.now(),
        };
        if (!(await replayRawAllowed(signed.raw, entry, { chainId: this.chainId, signer: this.signerAddress }, this.intent))) {
            return { status: 'refused', reason: REFUSED.refusedJournal };
        }
        if (!this.kindFresh(job.kind)) return this.refuseGate();
        try {
            await this.journal.append(entry);
        } catch {
            return { status: 'refused', reason: REFUSED.journal };
        }
        const sent = await this.broadcast(signed.raw, job.kind);
        if (sent) return sent.status === 'refused' && sent.reason === REFUSED.gate ? sent : { status: 'pending', hash };
        try {
            await this.journal.updateInFlight({ status: 'sent' });
        } catch {
            return { status: 'pending', hash };
        }
        const polled = await this.poll(entry, entry.hashes.slice(-3));
        if (polled === 'bad') return this.stickyResult(REFUSED.receipt);
        if (polled === 'included' && this.seen) {
            try {
                await this.journal.updateInFlight({ status: 'included' });
            } catch {
                return { status: 'included', hash: this.seen.transactionHash, receipt: this.seen };
            }
            this.clearResolved(next, job.kind);
            return { status: 'included', hash: this.seen.transactionHash, receipt: this.seen };
        }
        return { status: 'pending', hash };
    }

    private stickyResult(reason: string): SendResult {
        this.noteSticky(reason);
        return { status: 'refused', reason };
    }

    private async verifiedRaws(entry: JournalEntry): Promise<Hex[] | null> {
        const raws = rawsToBroadcast(entry);
        for (const raw of raws) {
            const allowed = await replayRawAllowed(raw, entry, { chainId: this.chainId, signer: this.signerAddress }, this.intent);
            if (!allowed) {
                this.noteSticky(REFUSED.refusedJournal);
                return null;
            }
        }
        return raws;
    }

    /** Gate and chain id are checked immediately before the bytes leave the process. */
    private async broadcast(raw: Hex, kind: JournalKind): Promise<SendResult | null> {
        const allowedKind = kind === 'cancel' ? 'price-super' : kind;
        if (kind === 'cancel') {
            if (!this.priceFresh()) return this.refuseGate();
        } else if (!this.kindFresh(allowedKind)) return this.refuseGate();
        const chainReason = await readChainId(this.chain, this.chainId);
        if (chainReason) {
            if (chainReason === REFUSED.chain) this.noteSticky(chainReason);
            return { status: 'refused', reason: chainReason };
        }
        try {
            await this.chain.sendRawTransaction(raw);
        } catch {
            // Receipts decide. A thrown broadcast is not a second nonce.
        }
        return null;
    }

    private async markIncluded(entry: JournalEntry): Promise<{ kind: 'clear' } | { kind: 'stop'; result: SendResult }> {
        if (!this.seen) return { kind: 'stop', result: { status: 'refused', reason: REFUSED.receipt } };
        try {
            await this.journal.updateInFlight({ status: 'included' });
        } catch {
            return { kind: 'stop', result: { status: 'refused', reason: REFUSED.journal } };
        }
        this.clearResolved(entry.nonce, entry.kind);
        return { kind: 'clear' };
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

    private async signOf(req: SignRequest): Promise<{ ok: true; raw: Hex } | { ok: false; reason: string }> {
        try {
            const raw = await this.signer.sign(req);
            if (typeof raw !== 'string' || !isData(raw)) return { ok: false, reason: REFUSED.sign };
            return { ok: true, raw };
        } catch (error) {
            return { ok: false, reason: fixedSignReason(error) };
        }
    }

    /** Replace a gated-off nonce with a self-transfer so an allowed job can take the next nonce. */
    private async cancelInFlight(entry: JournalEntry): Promise<{ kind: 'clear' } | { kind: 'stop'; result: SendResult }> {
        const pendingHash = entry.hashes[entry.hashes.length - 1];
        if (!pendingHash) return { kind: 'stop', result: { status: 'refused', reason: REFUSED.journal } };
        if (!this.priceFresh()) return { kind: 'stop', result: this.refuseGate() };
        const quoted = await this.readFees();
        if (typeof quoted === 'string') return { kind: 'stop', result: { status: 'refused', reason: quoted } };
        const floorFee = 2n * quoted.baseFee + quoted.tip;
        let maxFee = bumpFee(entry.maxFeePerGas, floorFee);
        const maxTip = bumpFee(entry.maxPriorityFeePerGas, quoted.tip);
        if (maxFee < maxTip) maxFee = maxTip;
        if (!this.priceFresh()) return { kind: 'stop', result: this.refuseGate() };
        const chainReason = await readChainId(this.chain, this.chainId);
        if (chainReason) return { kind: 'stop', result: { status: 'refused', reason: chainReason } };
        const signed = await this.signOf({
            to: this.signerAddress,
            data: '0x',
            nonce: entry.nonce,
            gasLimit: CANCEL_GAS,
            maxFeePerGas: maxFee,
            maxPriorityFeePerGas: maxTip,
            chainId: this.chainId,
            cancel: true,
        });
        if (!signed.ok) return { kind: 'stop', result: { status: 'refused', reason: signed.reason } };
        const cancelHash = keccak256(signed.raw);
        const cancelEntry: JournalEntry = {
            ...entry,
            kind: 'cancel',
            to: this.signerAddress,
            data: '0x',
            gasLimit: CANCEL_GAS,
            raws: [signed.raw],
            cancelled: true,
            maxFeePerGas: maxFee,
            maxPriorityFeePerGas: maxTip,
        };
        if (!(await replayRawAllowed(signed.raw, cancelEntry, { chainId: this.chainId, signer: this.signerAddress }, this.intent))) {
            return { kind: 'stop', result: { status: 'refused', reason: REFUSED.refusedJournal } };
        }
        if (!this.priceFresh()) return { kind: 'stop', result: this.refuseGate() };
        try {
            await this.journal.updateInFlight({
                raw: signed.raw,
                hash: cancelHash,
                maxFeePerGas: maxFee,
                maxPriorityFeePerGas: maxTip,
                gasLimit: CANCEL_GAS,
                to: this.signerAddress,
                data: '0x',
                kind: 'cancel',
                cancelled: true,
                replaceRaws: true,
                status: 'signed',
            });
        } catch {
            return { kind: 'stop', result: { status: 'refused', reason: REFUSED.journal } };
        }
        const sent = await this.broadcast(signed.raw, 'cancel');
        if (sent?.status === 'refused' && sent.reason === REFUSED.gate) return { kind: 'stop', result: sent };
        try {
            await this.journal.updateInFlight({ status: 'sent' });
        } catch {
            return { kind: 'stop', result: { status: 'pending', hash: cancelHash } };
        }
        const fresh = this.journal.inFlight() ?? cancelEntry;
        const hit = await this.poll(fresh, fresh.hashes.slice(-3));
        if (hit === 'bad') return { kind: 'stop', result: this.stickyResult(REFUSED.receipt) };
        if (hit === 'included') {
            const landed = this.seen?.transactionHash.toLowerCase() ?? '';
            if (landed !== '' && landed !== cancelHash.toLowerCase()) this.alert(`pause landed before cancel nonce ${entry.nonce}`);
            const marked = await this.markIncluded(fresh);
            return marked;
        }
        return { kind: 'stop', result: { status: 'pending', hash: cancelHash } };
    }

    private async replace(entry: JournalEntry): Promise<'ok' | string> {
        if (!this.kindFresh(entry.kind === 'cancel' ? 'price-super' : entry.kind) && entry.kind !== 'cancel') return REFUSED.gate;
        if (entry.kind === 'cancel' && !this.priceFresh()) return REFUSED.gate;
        const quoted = await this.readFees();
        if (typeof quoted === 'string') return quoted;
        const floorFee = 2n * quoted.baseFee + quoted.tip;
        let maxFee = bumpFee(entry.maxFeePerGas, floorFee);
        const maxTip = bumpFee(entry.maxPriorityFeePerGas, quoted.tip);
        if (maxFee < maxTip) maxFee = maxTip;
        const cancelling = entry.kind === 'cancel' || entry.cancelled === true;
        if (!this.priceFresh() && cancelling) return REFUSED.gate;
        if (!cancelling && !this.kindFresh(entry.kind)) return REFUSED.gate;
        const chainReason = await readChainId(this.chain, this.chainId);
        if (chainReason) return chainReason;
        const signed = await this.signOf({
            to: cancelling ? this.signerAddress : entry.to,
            data: cancelling ? '0x' : entry.data,
            nonce: entry.nonce,
            gasLimit: cancelling ? CANCEL_GAS : entry.gasLimit,
            maxFeePerGas: maxFee,
            maxPriorityFeePerGas: maxTip,
            chainId: this.chainId,
            ...(cancelling ? { cancel: true } : {}),
        });
        if (!signed.ok) return signed.reason;
        const hash = keccak256(signed.raw);
        const nextEntry: JournalEntry = {
            ...entry,
            to: cancelling ? this.signerAddress : entry.to,
            data: cancelling ? '0x' : entry.data,
            gasLimit: cancelling ? CANCEL_GAS : entry.gasLimit,
            raws: [signed.raw],
            maxFeePerGas: maxFee,
            maxPriorityFeePerGas: maxTip,
        };
        if (!(await replayRawAllowed(signed.raw, nextEntry, { chainId: this.chainId, signer: this.signerAddress }, this.intent))) {
            return REFUSED.refusedJournal;
        }
        if (cancelling ? !this.priceFresh() : !this.kindFresh(entry.kind)) return REFUSED.gate;
        try {
            await this.journal.updateInFlight({
                raw: signed.raw,
                hash,
                attempts: entry.attempts,
                maxFeePerGas: maxFee,
                maxPriorityFeePerGas: maxTip,
                status: 'signed',
            });
        } catch {
            return REFUSED.journal;
        }
        const sent = await this.broadcast(signed.raw, cancelling ? 'cancel' : entry.kind);
        if (sent?.status === 'refused' && (sent.reason === REFUSED.gate || sent.reason === REFUSED.chain || sent.reason === REFUSED.chainRead)) {
            return sent.reason;
        }
        try {
            await this.journal.updateInFlight({ status: 'sent' });
        } catch {
            return REFUSED.journal;
        }
        return 'ok';
    }

    private async poll(entry: JournalEntry, hashes: readonly Hex[]): Promise<'included' | 'bad' | 'none'> {
        const deadline = this.now() + this.receiptWaitMs;
        for (;;) {
            const hit = await findCanonical(this.chain, entry, hashes);
            if (hit === 'bad') return 'bad';
            if (hit) {
                this.seen = hit;
                return 'included';
            }
            const left = deadline - this.now();
            if (left <= 0) return 'none';
            await sleep(Math.min(this.pollIntervalMs, left));
        }
    }
}
