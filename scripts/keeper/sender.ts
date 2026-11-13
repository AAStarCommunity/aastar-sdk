/**
 * One send path for price updates and operator pauses.
 * Calls take the mutex, then re-read the journal and the chain nonce before signing.
 */
import { keccak256, type Address, type Hex } from 'viem';
import { JOURNAL_ATTEMPT_CAP, JOURNAL_RAW_CAP, Journal, type JournalEntry, type JournalKind } from './journal.js';
import { CANCEL_GAS, type RawSigner, type SignRequest } from './castSigner.js';

export interface ChainReceipt {
    status: 'success' | 'reverted';
    gasUsed: bigint;
    blockHash: Hex;
    blockNumber: bigint;
    transactionHash: Hex;
}

export interface ChainIO {
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

const GAS_CAP = 30_000_000n;
const REFUSED = {
    gate: 'sender: gate closed',
    corrupt: 'sender: journal corrupt',
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
} as const;

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

/** Once a nonce is cancelled, only its latest raw may be broadcast. */
function rawsToBroadcast(entry: JournalEntry): Hex[] {
    const latest = entry.raws[entry.raws.length - 1];
    if (!latest) return [];
    if (entry.kind === 'cancel' || entry.cancelled === true) return [latest];
    if (entry.raws.length >= JOURNAL_RAW_CAP) return [latest];
    return entry.raws;
}

/** 1.25×, rounded up, and never under the floor. */
function bumpFee(prev: bigint, floor: bigint): bigint {
    const scaled = (prev * 5n + 3n) / 4n;
    return scaled > floor ? scaled : floor;
}

function fixedSignReason(error: unknown): string {
    const message = error instanceof Error ? error.message : '';
    if (message.startsWith('cast signer:') || message.startsWith('secret file:') || message.startsWith('sender:')) return message;
    return REFUSED.sign;
}

function copyReceipt(receipt: ChainReceipt, hash: Hex): ChainReceipt {
    return {
        status: receipt.status === 'success' ? 'success' : 'reverted',
        gasUsed: receipt.gasUsed,
        blockHash: receipt.blockHash,
        blockNumber: receipt.blockNumber,
        transactionHash: hash,
    };
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
    private gate: { price: boolean; pause: boolean; reason: string } = { price: false, pause: false, reason: REFUSED.gate };
    private queue: Promise<void> = Promise.resolve();
    private sticky: string | null = null;
    private readonly alerted = new Set<string>();

    constructor(opts: {
        chain: ChainIO;
        signer: RawSigner;
        journal: Journal;
        signerAddress: Address;
        chainId: number;
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
        this.chain = opts.chain;
        this.signer = opts.signer;
        this.journal = opts.journal;
        this.signerAddress = opts.signerAddress;
        this.chainId = opts.chainId;
        this.receiptWaitMs = receiptWaitMs;
        this.pollIntervalMs = pollIntervalMs;
        this.bumpAfterAttempts = bumpAfterAttempts;
        this.alert = opts.alert;
    }

    /** Price kinds and pause are separate. Pause can be closed while price still signs. */
    setGate(gate: { price: boolean; pause: boolean; reason: string }): void {
        if (!gate || typeof gate.price !== 'boolean' || typeof gate.pause !== 'boolean') throw new Error('sender: gate rejected');
        const reason = typeof gate.reason === 'string' ? gate.reason.slice(0, 500) : '';
        this.gate = { price: gate.price, pause: gate.pause, reason };
        if (gate.price && gate.pause) this.alerted.delete(REFUSED.gate);
    }

    /** True only when both scopes are open, so either closed scope is retried every tick. */
    gateOpen(): boolean {
        return this.gate.price && this.gate.pause;
    }

    private allows(kind: JournalKind): boolean {
        return kind === 'pause' ? this.gate.pause : this.gate.price;
    }

    async send(req: SendRequest): Promise<SendResult> {
        const job = copyJob(req);
        if (!job) return { status: 'refused', reason: REFUSED.request };
        const prev = this.queue;
        let release: () => void = () => {};
        this.queue = new Promise<void>((resolve) => {
            release = resolve;
        });
        try {
            await prev;
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
        if (!this.allows(job.kind)) return this.refuseGate();
        if (this.sticky) return { status: 'refused', reason: this.sticky };

        const loaded = await this.journal.load();
        if (loaded === 'corrupt') {
            this.alertOnce(REFUSED.corrupt);
            return { status: 'refused', reason: REFUSED.corrupt };
        }
        if (loaded === 'mismatch') {
            this.sticky = 'sender: journal belongs to another signer';
            this.alertOnce(this.sticky);
            return { status: 'refused', reason: this.sticky };
        }
        if (loaded === 'missing') {
            const baseline = await this.readNonces();
            if (baseline.kind !== 'ok') return baseline.result;
            if (baseline.latest !== baseline.pending) {
                this.alertOnce(`${REFUSED.baseline} expected latest==pending seen latest=${baseline.latest} pending=${baseline.pending}`);
                return { status: 'refused', reason: REFUSED.baseline };
            }
            if (baseline.latest > BigInt(Number.MAX_SAFE_INTEGER)) return { status: 'refused', reason: REFUSED.nonce };
            try {
                await this.journal.init(Number(baseline.latest));
            } catch {
                return { status: 'refused', reason: REFUSED.journal };
            }
        }

        if (!this.allows(job.kind)) return this.refuseGate();
        const settled = await this.settle(job);
        if (settled.kind === 'stop') {
            if (settled.result.status === 'pending' || settled.result.status === 'blocked') {
                const nonce = this.journal.inFlight()?.nonce;
                if (nonce !== undefined && settled.result.status === 'blocked') this.notePriceBlocked(job, nonce);
                if (settled.result.status === 'pending') {
                    if (nonce !== undefined) this.notePriceBlocked(job, nonce);
                    return { status: 'blocked', inFlightHash: settled.result.hash };
                }
                return settled.result;
            }
            return settled.result;
        }
        if (!this.allows(job.kind)) return this.refuseGate();

        const nonces = await this.readNonces();
        if (nonces.kind !== 'ok') return nonces.result;
        const next = this.journal.nextNonce();
        const nonceStop = await this.classifyNonce(nonces.latest, nonces.pending, next);
        if (nonceStop) return nonceStop;

        const quoted = await this.readFees();
        if (typeof quoted === 'string') return { status: 'refused', reason: quoted };
        let estimated: bigint;
        try {
            estimated = await this.chain.estimateGas({ to: job.to, data: job.data, from: this.signerAddress });
        } catch {
            return { status: 'refused', reason: REFUSED.gas };
        }
        if (typeof estimated !== 'bigint' || estimated <= 0n || estimated > GAS_CAP) {
            return { status: 'refused', reason: REFUSED.gas };
        }
        const gasLimit = estimated + estimated / 5n;
        if (gasLimit <= 0n || gasLimit > GAS_CAP) return { status: 'refused', reason: REFUSED.gas };
        let maxFee = 2n * quoted.baseFee + quoted.tip;
        const maxTip = quoted.tip;
        if (maxFee < maxTip) maxFee = maxTip;

        if (!this.allows(job.kind)) return this.refuseGate();
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
            createdAt: Date.now(),
        };
        try {
            await this.journal.append(entry);
        } catch {
            return { status: 'refused', reason: REFUSED.journal };
        }
        try {
            await this.chain.sendRawTransaction(signed.raw);
        } catch {
            // "already known" / "nonce too low" do not decide. A later receipt does.
        }
        try {
            await this.journal.updateInFlight({ status: 'sent' });
        } catch {
            return { status: 'pending', hash };
        }
        const polled = await this.poll(entry);
        if (polled === 'bad') {
            this.sticky = REFUSED.receipt;
            this.alertOnce(REFUSED.receipt);
            return { status: 'refused', reason: REFUSED.receipt };
        }
        if (polled === 'included' && this.seen) {
            const kind = job.kind;
            try {
                await this.journal.updateInFlight({ status: 'included' });
            } catch {
                return { status: 'included', hash: this.seen.transactionHash, receipt: this.seen };
            }
            this.clearResolved(next, kind);
            return { status: 'included', hash: this.seen.transactionHash, receipt: this.seen };
        }
        return { status: 'pending', hash };
    }

    private seen: ChainReceipt | null = null;

    private async classifyNonce(latest: bigint, pending: bigint, next: number): Promise<SendResult | null> {
        const expected = BigInt(next);
        if (latest < expected) {
            await this.rebroadcastReorg();
            this.alertOnce(REFUSED.behind, `${REFUSED.behind} expected=${next} seen latest=${latest} pending=${pending}`);
            return { status: 'refused', reason: REFUSED.behind };
        }
        const ahead = latest > expected;
        const pendingAhead = latest === expected && pending > latest;
        if (ahead || pendingAhead) {
            this.sticky = REFUSED.foreign;
            this.alertOnce(`${REFUSED.foreign} expected=${next} seen latest=${latest} pending=${pending}`);
            return { status: 'refused', reason: REFUSED.foreign };
        }
        if (pending !== latest) return { status: 'refused', reason: REFUSED.nonce };
        return null;
    }

    /** Included in the journal, absent on the chain: put the bytes back in flight and rebroadcast them. */
    private async rebroadcastReorg(): Promise<void> {
        const last = this.journal.lastEntry();
        if (!last || last.status !== 'included') return;
        const hit = await this.inspect(last);
        if (hit !== 'none') return;
        try {
            await this.journal.demoteIncluded();
        } catch {
            return;
        }
        const entry = this.journal.inFlight();
        if (!entry) return;
        for (const raw of rawsToBroadcast(entry)) {
            try {
                await this.chain.sendRawTransaction(raw);
            } catch {
                // Receipts decide.
            }
        }
    }

    private async readNonces(): Promise<{ kind: 'ok'; latest: bigint; pending: bigint } | { kind: 'stop'; result: SendResult }> {
        try {
            const latest = await this.chain.getTransactionCount(this.signerAddress, 'latest');
            const pending = await this.chain.getTransactionCount(this.signerAddress, 'pending');
            if (typeof latest !== 'bigint' || typeof pending !== 'bigint' || latest < 0n || pending < 0n) {
                return { kind: 'stop', result: { status: 'refused', reason: REFUSED.nonce } };
            }
            return { kind: 'ok', latest, pending };
        } catch {
            return { kind: 'stop', result: { status: 'refused', reason: REFUSED.nonce } };
        }
    }

    private async readFees(): Promise<{ baseFee: bigint; tip: bigint } | string> {
        try {
            const quoted = await this.chain.fees();
            const baseFee = quoted.baseFee;
            const tip = quoted.tip;
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

    private async settle(job: SendRequest): Promise<{ kind: 'clear' } | { kind: 'stop'; result: SendResult }> {
        const entry = this.journal.inFlight();
        if (!entry) return { kind: 'clear' };
        const hash = entry.hashes[entry.hashes.length - 1];
        if (!hash) return { kind: 'stop', result: { status: 'refused', reason: REFUSED.journal } };
        if (!this.allows(entry.kind)) {
            if (!this.allows(job.kind)) return { kind: 'stop', result: { status: 'blocked', inFlightHash: hash } };
            return this.cancelInFlight(entry);
        }
        const raws = rawsToBroadcast(entry);
        for (const raw of raws) {
            try {
                await this.chain.sendRawTransaction(raw);
            } catch {
                // Receipts decide.
            }
        }
        const hit = await this.poll(entry);
        if (hit === 'bad') {
            this.sticky = REFUSED.receipt;
            this.alertOnce(REFUSED.receipt);
            return { kind: 'stop', result: { status: 'refused', reason: REFUSED.receipt } };
        }
        if (hit === 'included') {
            const nonce = entry.nonce;
            const kind = entry.kind;
            try {
                await this.journal.updateInFlight({ status: 'included' });
            } catch {
                return { kind: 'stop', result: { status: 'refused', reason: REFUSED.journal } };
            }
            this.clearResolved(nonce, kind);
            return { kind: 'clear' };
        }
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
        if (attempts >= this.bumpAfterAttempts && freshEntry.raws.length < JOURNAL_RAW_CAP) {
            const bumped = await this.replace(freshEntry);
            if (bumped !== 'ok') return { kind: 'stop', result: { status: 'refused', reason: bumped } };
        }
        const fresh = this.journal.inFlight();
        const pendingHash = fresh?.hashes[fresh.hashes.length - 1] ?? hash;
        if (!pendingHash) return { kind: 'stop', result: { status: 'refused', reason: REFUSED.journal } };
        return { kind: 'stop', result: { status: 'pending', hash: pendingHash } };
    }

    /** Replace a gated in-flight nonce with a self-transfer so an allowed job can take the next nonce. */
    private async cancelInFlight(entry: JournalEntry): Promise<{ kind: 'clear' } | { kind: 'stop'; result: SendResult }> {
        const pendingHash = entry.hashes[entry.hashes.length - 1];
        if (!pendingHash) return { kind: 'stop', result: { status: 'refused', reason: REFUSED.journal } };
        if (!this.gate.price) return { kind: 'stop', result: this.refuseGate() };
        const quoted = await this.readFees();
        if (typeof quoted === 'string') return { kind: 'stop', result: { status: 'refused', reason: quoted } };
        const floorFee = 2n * quoted.baseFee + quoted.tip;
        let maxFee = bumpFee(entry.maxFeePerGas, floorFee);
        const maxTip = bumpFee(entry.maxPriorityFeePerGas, quoted.tip);
        if (maxFee < maxTip) maxFee = maxTip;
        if (!this.gate.price) return { kind: 'stop', result: this.refuseGate() };
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
        const gasLimit = entry.gasLimit > CANCEL_GAS ? entry.gasLimit : CANCEL_GAS;
        try {
            await this.journal.updateInFlight({
                raw: signed.raw,
                hash: cancelHash,
                maxFeePerGas: maxFee,
                maxPriorityFeePerGas: maxTip,
                gasLimit,
                kind: 'cancel',
                cancelled: true,
                status: 'signed',
            });
        } catch {
            return { kind: 'stop', result: { status: 'refused', reason: REFUSED.journal } };
        }
        try {
            await this.chain.sendRawTransaction(signed.raw);
        } catch {
            // Receipts decide. The pause raws stay on disk and are not broadcast again.
        }
        try {
            await this.journal.updateInFlight({ status: 'sent' });
        } catch {
            return { kind: 'stop', result: { status: 'pending', hash: cancelHash } };
        }
        const fresh = this.journal.inFlight();
        const hit = await this.poll(fresh ?? entry);
        if (hit === 'bad') {
            this.sticky = REFUSED.receipt;
            this.alertOnce(REFUSED.receipt);
            return { kind: 'stop', result: { status: 'refused', reason: REFUSED.receipt } };
        }
        if (hit === 'included') {
            const landed = this.seen?.transactionHash.toLowerCase() ?? '';
            if (landed !== '' && landed !== cancelHash.toLowerCase()) {
                this.alert(`pause landed before cancel nonce ${entry.nonce}`);
            }
            try {
                await this.journal.updateInFlight({ status: 'included' });
            } catch {
                return { kind: 'stop', result: { status: 'refused', reason: REFUSED.journal } };
            }
            this.clearResolved(entry.nonce, entry.kind);
            return { kind: 'clear' };
        }
        return { kind: 'stop', result: { status: 'pending', hash: cancelHash } };
    }

    private async replace(entry: JournalEntry): Promise<'ok' | string> {
        const quoted = await this.readFees();
        if (typeof quoted === 'string') return quoted;
        const floorFee = 2n * quoted.baseFee + quoted.tip;
        let maxFee = bumpFee(entry.maxFeePerGas, floorFee);
        const maxTip = bumpFee(entry.maxPriorityFeePerGas, quoted.tip);
        if (maxFee < maxTip) maxFee = maxTip;
        const cancelling = entry.kind === 'cancel' || entry.cancelled === true;
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
        try {
            await this.chain.sendRawTransaction(signed.raw);
        } catch {
            // Receipts decide.
        }
        try {
            await this.journal.updateInFlight({ status: 'sent' });
        } catch {
            return REFUSED.journal;
        }
        return 'ok';
    }

    private async poll(entry: JournalEntry): Promise<'included' | 'bad' | 'none'> {
        const deadline = Date.now() + this.receiptWaitMs;
        for (;;) {
            const hit = await this.inspect(entry);
            if (hit !== 'none') return hit;
            const left = deadline - Date.now();
            if (left <= 0) return 'none';
            await sleep(Math.min(this.pollIntervalMs, left));
        }
    }

    private async inspect(entry: JournalEntry): Promise<'included' | 'bad' | 'none'> {
        let found: ChainReceipt | null = null;
        for (const hash of entry.hashes) {
            let receipt: ChainReceipt | null;
            try {
                receipt = await this.chain.getTransactionReceipt(hash);
            } catch {
                continue;
            }
            if (!receipt) continue;
            const got = typeof receipt.transactionHash === 'string' ? receipt.transactionHash.toLowerCase() : '';
            if (got !== hash.toLowerCase()) return 'bad';
            if (typeof receipt.gasUsed !== 'bigint' || receipt.gasUsed <= 0n || receipt.gasUsed > entry.gasLimit) return 'bad';
            found = copyReceipt(receipt, hash);
        }
        if (!found) return 'none';
        this.seen = found;
        return 'included';
    }
}
