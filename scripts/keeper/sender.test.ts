/**
 * One sender, one nonce. Fakes stand in for the chain and for cast.
 */
import { chmodSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { open } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { getAddress, keccak256, type Address, type Hex } from 'viem';
import { signTransaction } from 'viem/accounts';
import { JOURNAL_HASH_CAP, Journal, setDurabilityHooks, type DurabilityHooks } from './journal';
import { bumpFee, Sender, type ChainIO, type ChainReceipt, type EnabledKinds, type SendRequest } from './sender';
import type { ReplayIntent } from './replayGuard';

const TO = '0x1111111111111111111111111111111111111111' as Address;
const OTHER = '0x2222222222222222222222222222222222222222' as Address;
const KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as const;
const SIGNER = getAddress('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
const DATA = '0x1234' as Hex;
const BLOCK = ('0x' + 'ab'.repeat(32)) as Hex;
const CHAIN_ID = 11155111;

const SPAWN_VERDICT_TIMEOUT_MS = 30_000;

const dirs: string[] = [];
afterEach(() => {
    setDurabilityHooks(null);
    for (const dir of dirs.splice(0)) {
        try {
            if (statSync(dir).isDirectory()) chmodSync(dir, 0o700);
        } catch { /* already gone */ }
        rmSync(dir, { recursive: true, force: true });
    }
}, SPAWN_VERDICT_TIMEOUT_MS);

const testIntent: ReplayIntent = (kind, decoded) => {
    const to = decoded.to.toLowerCase();
    if (kind === 'price-super') return to === TO.toLowerCase();
    if (kind === 'price-paymaster') return to === OTHER.toLowerCase();
    if (kind === 'pause') return to === TO.toLowerCase();
    if (kind === 'cancel') return to === SIGNER.toLowerCase() && decoded.data.toLowerCase() === '0x' && decoded.gas === 21_000n;
    return false;
};

function harness(opts: {
    bumpAfterAttempts?: number;
    receiptWaitMs?: number;
    pollIntervalMs?: number;
    base?: bigint;
    enabledKinds?: EnabledKinds;
    intent?: ReplayIntent;
    now?: () => number;
} = {}) {
    const dir = mkdtempSync(join(tmpdir(), 'keeper-sender-'));
    dirs.push(dir);
    const path = join(dir, 'journal.json');
    let latest = opts.base ?? 7n;
    let pending = latest;
    let baseFee = 100n;
    let tip = 10n;
    const broadcasts: Hex[] = [];
    const alerts: string[] = [];
    const signed: { nonce: number; maxFeePerGas: bigint; maxPriorityFeePerGas: bigint; to: Address; data: Hex; gasLimit: bigint; cancel: boolean; raw: Hex }[] = [];
    const receipts = new Map<string, ChainReceipt>();
    let salt = 0;
    let crashSend = false;
    let landPauseHash: Hex | null = null;
    let rawOnDiskBeforeBroadcast: boolean | null = null;
    const journaledBeforeBroadcast: boolean[] = [];
    let shared: ChainReceipt | null = null;
    let beforeSign: (() => Promise<void>) | null = null;
    const chain: ChainIO = {
        async chainId() {
            return CHAIN_ID;
        },
        async getTransactionCount(_addr, tag) {
            return tag === 'pending' ? pending : latest;
        },
        async getBalance() {
            return 10n ** 18n;
        },
        async estimateGas() {
            return 100_000n;
        },
        async fees() {
            return { baseFee, tip };
        },
        async sendRawTransaction(raw) {
            let onDisk = '';
            try { onDisk = readFileSync(path, 'utf8'); } catch { onDisk = ''; }
            if (rawOnDiskBeforeBroadcast === null) rawOnDiskBeforeBroadcast = onDisk.includes(raw);
            journaledBeforeBroadcast.push(onDisk.includes(raw));
            broadcasts.push(raw);
            if (crashSend) throw new Error('crash');
            const hash = keccak256(raw);
            if (landPauseHash) {
                const planted = landPauseHash;
                landPauseHash = null;
                receipts.set(planted.toLowerCase(), {
                    status: 'success',
                    gasUsed: 50_000n,
                    blockHash: BLOCK,
                    blockNumber: 1n,
                    transactionHash: planted,
                });
                latest += 1n;
                pending = latest;
                return hash;
            }
            receipts.set(hash.toLowerCase(), {
                status: 'success',
                gasUsed: 100n,
                blockHash: BLOCK,
                blockNumber: 1n,
                transactionHash: hash,
            });
            latest += 1n;
            pending = latest;
            return hash;
        },
        async getTransactionReceipt(hash) {
            const found = receipts.get(hash.toLowerCase());
            if (!found) return null;
            shared = found;
            return found;
        },
        async getBlockByNumber(n) {
            return { hash: BLOCK, number: n };
        },
        async getBlockByHash() {
            return { hash: BLOCK, number: 1n };
        },
        async call() {
            return '0x' as Hex;
        },
    };
    const signer = {
        async sign(req: { nonce: number; maxFeePerGas: bigint; maxPriorityFeePerGas: bigint; to: Address; data: Hex; gasLimit: bigint; chainId: number; cancel?: boolean }) {
            if (beforeSign) await beforeSign();
            salt += 1;
            const raw = await signTransaction({
                privateKey: KEY,
                transaction: {
                    type: 'eip1559',
                    chainId: req.chainId,
                    nonce: req.nonce,
                    gas: req.gasLimit,
                    maxFeePerGas: req.maxFeePerGas,
                    maxPriorityFeePerGas: req.maxPriorityFeePerGas,
                    to: req.to,
                    value: 0n,
                    data: req.data,
                },
            });
            signed.push({
                nonce: req.nonce,
                maxFeePerGas: req.maxFeePerGas,
                maxPriorityFeePerGas: req.maxPriorityFeePerGas,
                to: req.to,
                data: req.data,
                gasLimit: req.gasLimit,
                cancel: req.cancel === true,
                raw,
            });
            return raw;
        },
    };
    const journal = new Journal(path, { chainId: CHAIN_ID, signer: SIGNER });
    const senderOpts = {
        chain,
        signer,
        signerAddress: SIGNER,
        chainId: CHAIN_ID,
        intent: opts.intent ?? testIntent,
        enabledKinds: opts.enabledKinds,
        now: opts.now,
        receiptWaitMs: opts.receiptWaitMs ?? 200,
        pollIntervalMs: opts.pollIntervalMs,
        bumpAfterAttempts: opts.bumpAfterAttempts ?? 3,
        alert: (msg: string) => alerts.push(msg),
    };
    const sender = new Sender({ ...senderOpts, journal });
    sender.setGate({ price: true, pause: true, reason: '' });
    const job = (data: Hex = DATA): SendRequest => ({ kind: 'price-super', to: TO, data });
    return {
        path, sender, signer, broadcasts, alerts, signed, chain, journal,
        shared: () => shared,
        setBaseFee: (n: bigint) => { baseFee = n; },
        setCrash: (v: boolean) => { crashSend = v; },
        plantPauseReceiptOnNextBroadcast: (hash: Hex) => { landPauseHash = hash; },
        journaledBeforeBroadcast: () => journaledBeforeBroadcast,
        rawOnDiskBeforeBroadcast: () => rawOnDiskBeforeBroadcast,
        setNonce: (n: bigint) => { latest = n; pending = n; },
        setBeforeSign: (fn: (() => Promise<void>) | null) => { beforeSign = fn; },
        job,
        another(extra: { enabledKinds?: EnabledKinds; intent?: ReplayIntent; now?: () => number } = {}) {
            return new Sender({
                ...senderOpts,
                ...extra,
                journal: new Journal(path, { chainId: CHAIN_ID, signer: SIGNER }),
                alert: (msg) => alerts.push(msg),
            });
        },
    };
}

describe('Sender', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
    it('two concurrent sends sign nonce then nonce+1, never the same nonce', async () => {
        const h = harness({ receiptWaitMs: 500 });
        let release: () => void = () => {};
        const held = new Promise<void>((resolve) => { release = resolve; });
        let entered = 0;
        let mark: () => void = () => {};
        const firstInside = new Promise<void>((resolve) => { mark = resolve; });
        h.setBeforeSign(async () => {
            entered += 1;
            if (entered === 1) {
                mark();
                await held;
            }
        });
        const first = h.sender.send(h.job('0xaaaa' as Hex));
        const second = h.sender.send(h.job('0xbbbb' as Hex));
        try {
            await firstInside;
            await new Promise((r) => setTimeout(r, 30));
            expect(entered).toBe(1);
        } finally {
            release();
        }
        const [a, b] = await Promise.all([first, second]);
        expect(a.status).toBe('included');
        expect(b.status).toBe('included');
        expect(h.signed.map((s) => s.nonce)).toEqual([7, 8]);
        expect(new Set(h.signed.map((s) => s.nonce)).size).toBe(2);
    });

    it('a closed identity gate does not sign or broadcast', async () => {
        const h = harness();
        h.sender.setGate({ price: false, pause: false, reason: 'no' });
        const result = await h.sender.send(h.job());
        expect(result).toEqual({ status: 'refused', reason: 'sender: gate closed' });
        expect(h.signed).toEqual([]);
        expect(h.broadcasts).toEqual([]);
    });

    it('a closed pause gate still signs a price send and refuses pause', async () => {
        const h = harness();
        h.sender.setGate({ price: true, pause: false, reason: 'pause only' });
        const price = await h.sender.send(h.job());
        expect(price.status).toBe('included');
        const pause = await h.sender.send({ kind: 'pause', to: TO, data: DATA });
        expect(pause).toEqual({ status: 'refused', reason: 'sender: gate closed' });
        expect(h.signed).toHaveLength(1);
        expect(h.signed[0]?.data).toBe(DATA);
    });

    it('an in-flight price replacement still signs when only the pause gate is closed', async () => {
        const h = harness({ bumpAfterAttempts: 1, receiptWaitMs: 30 });
        h.setCrash(true);
        const first = await h.sender.send(h.job());
        expect(first.status).toBe('pending');
        h.sender.setGate({ price: true, pause: false, reason: 'pause only' });
        const second = await h.sender.send(h.job('0xbbbb' as Hex));
        expect(second.status).toBe('blocked');
        expect(h.signed).toHaveLength(2);
        expect(h.signed.every((signed) => signed.nonce === 7)).toBe(true);
    });

    it('a thrown signer is refused and nothing is broadcast', async () => {
        const h = harness();
        h.setBeforeSign(async () => { throw new Error('keystore-path-sentinel'); });
        const result = await h.sender.send(h.job());
        expect(result).toEqual({ status: 'refused', reason: 'sender: sign failed' });
        expect(h.signed).toEqual([]);
        expect(h.broadcasts).toEqual([]);
    });

    it('a crash after the journal write rebroadcasts the same raw and does not take a second nonce', async () => {
        const h = harness({ receiptWaitMs: 40 });
        h.setCrash(true);
        const first = await h.sender.send(h.job());
        expect(first.status).toBe('pending');
        expect(h.rawOnDiskBeforeBroadcast()).toBe(true);
        expect(h.signed).toHaveLength(1);
        const raw = h.broadcasts[0];
        expect(raw).toBeTruthy();
        h.setCrash(false);
        const restarted = h.another();
        restarted.setGate({ price: true, pause: true, reason: '' });
        const second = await restarted.send(h.job('0xbbbb' as Hex));
        expect(second.status).toBe('included');
        expect(h.broadcasts.filter((item) => item === raw).length).toBeGreaterThanOrEqual(2);
        expect(h.signed.filter((s) => s.nonce === 7)).toHaveLength(1);
        expect(h.signed.map((s) => s.nonce)).toEqual([7, 8]);
    });

    it('a chain nonce ahead of the journal is refused and alerted', async () => {
        const h = harness({ receiptWaitMs: 200 });
        const first = await h.sender.send(h.job());
        expect(first.status).toBe('included');
        h.setNonce(90n);
        const second = await h.sender.send(h.job('0xbbbb' as Hex));
        expect(second.status).toBe('refused');
        if (second.status === 'refused') expect(second.reason).toBe('sender: foreign nonce');
        expect(h.alerts.some((a) => a.includes('expected=8') && a.includes('seen latest=90'))).toBe(true);
        expect(h.signed.filter((s) => s.nonce === 8)).toHaveLength(0);
    });

    it('a corrupt journal refuses every send and is not reset', async () => {
        const h = harness();
        writeFileSync(h.path, '{');
        chmodSync(h.path, 0o600);
        const result = await h.sender.send(h.job());
        expect(result.status).toBe('refused');
        expect(h.alerts.some((a) => a.includes('journal corrupt'))).toBe(true);
        expect(h.signed).toEqual([]);
        const again = await h.sender.send(h.job());
        expect(again.status).toBe('refused');
    });

    it('replacement keeps the nonce and does not go under the fee floor', async () => {
        const h = harness({ bumpAfterAttempts: 1, receiptWaitMs: 30 });
        h.setCrash(true);
        const first = await h.sender.send(h.job());
        expect(first.status).toBe('pending');
        h.setBaseFee(1_000n);
        const second = await h.sender.send(h.job('0xbbbb' as Hex));
        expect(second.status).toBe('blocked');
        expect(h.signed.map((s) => s.nonce)).toEqual([7, 7]);
        expect(h.signed[1]?.maxFeePerGas).toBe(2n * 1_000n + 10n);
        expect(h.signed[1]?.data).toBe(DATA);
    });

    it('mutates the request and the receipt the chain returned; the sender keeps its copies', async () => {
        const h = harness();
        const req = h.job();
        const pending = h.sender.send(req);
        req.to = OTHER;
        req.data = '0xdead' as Hex;
        const result = await pending;
        expect(h.signed[0]?.to).toBe(TO);
        expect(h.signed[0]?.data).toBe(DATA);
        expect(result.status).toBe('included');
        if (result.status !== 'included') return;
        const shared = h.shared();
        expect(shared).toBeTruthy();
        shared!.gasUsed = 1n;
        shared!.status = 'reverted';
        expect(result.receipt.gasUsed).toBe(100n);
        expect(result.receipt.status).toBe('success');
    });

    it('waits pollIntervalMs between receipt polls', async () => {
        const h = harness({ receiptWaitMs: 250, pollIntervalMs: 200 });
        const times: number[] = [];
        const orig = h.chain.getTransactionReceipt.bind(h.chain);
        let seen = 0;
        h.chain.getTransactionReceipt = async (hash) => {
            times.push(Date.now());
            seen += 1;
            if (seen < 2) return null;
            return orig(hash);
        };
        const result = await h.sender.send(h.job());
        expect(result.status).toBe('included');
        expect(times[1]! - times[0]!).toBeGreaterThanOrEqual(150);
    });

    it('bumps the fee on the third settle when bumpAfterAttempts is the default', async () => {
        const h = harness({ receiptWaitMs: 30, pollIntervalMs: 5 });
        h.setCrash(true);
        const first = await h.sender.send(h.job());
        expect(first.status).toBe('pending');
        const second = await h.sender.send(h.job('0xbbbb' as Hex));
        expect(second.status).toBe('blocked');
        expect(h.signed).toHaveLength(1);
        const third = await h.sender.send(h.job('0xcccc' as Hex));
        expect(third.status).toBe('blocked');
        expect(h.signed.map((s) => s.nonce)).toEqual([7, 7]);
        expect(h.signed[1]!.maxFeePerGas).toBeGreaterThan(h.signed[0]!.maxFeePerGas);
    });

    it('a lagging nonce is not sticky and a later send succeeds', async () => {
        const h = harness();
        const first = await h.sender.send(h.job());
        expect(first.status).toBe('included');
        h.setNonce(7n);
        const behind = await h.sender.send(h.job('0xbbbb' as Hex));
        expect(behind).toMatchObject({ status: 'refused', reason: 'sender: nonce behind journal' });
        expect(h.alerts.filter((a) => a.includes('nonce behind journal'))).toHaveLength(1);
        h.setNonce(8n);
        const recovered = await h.sender.send(h.job('0xcccc' as Hex));
        expect(recovered.status).toBe('included');
        expect(h.signed.map((s) => s.nonce)).toEqual([7, 8]);
    });

    it('a reorged included entry is rebroadcast and does not take a new nonce', async () => {
        const h = harness();
        const first = await h.sender.send(h.job());
        expect(first.status).toBe('included');
        const raw = h.broadcasts[0];
        h.chain.getTransactionReceipt = async () => null;
        h.setNonce(7n);
        const behind = await h.sender.send(h.job('0xbbbb' as Hex));
        expect(behind).toMatchObject({ status: 'refused', reason: 'sender: nonce behind journal' });
        expect(h.broadcasts.filter((item) => item === raw).length).toBeGreaterThanOrEqual(2);
        expect(h.signed).toHaveLength(1);
    });

    it('a send blocked on an older tx does not return that hash as its own pending', async () => {
        const h = harness({ receiptWaitMs: 20, pollIntervalMs: 5 });
        h.setCrash(true);
        const first = await h.sender.send(h.job());
        expect(first.status).toBe('pending');
        if (first.status !== 'pending') return;
        const second = await h.sender.send(h.job('0xbbbb' as Hex));
        expect(second).toEqual({ status: 'blocked', inFlightHash: first.hash });
        expect(h.signed).toHaveLength(1);
    });

    it('a failed journal persist does not broadcast the raw on the next settle', async () => {
        const h = harness();
        h.setBeforeSign(async () => { chmodSync(dirname(h.path), 0o500); });
        const first = await h.sender.send(h.job());
        expect(first).toEqual({ status: 'refused', reason: 'sender: journal write failed' });
        expect(h.broadcasts).toEqual([]);
        h.setBeforeSign(null);
        chmodSync(dirname(h.path), 0o700);
        const second = await h.sender.send(h.job());
        expect(second.status).toBe('included');
        expect(h.broadcasts).toHaveLength(1);
        expect(h.signed.map((s) => s.nonce)).toEqual([7, 7]);
    });

    it('an in-flight pause under a closed pause gate is cancelled at its nonce and the price send proceeds', async () => {
        const h = harness();
        h.setCrash(true);
        const pause = await h.sender.send({ kind: 'pause', to: TO, data: DATA });
        expect(pause.status).toBe('pending');
        const pauseRaw = h.broadcasts[0];
        expect(pauseRaw).toBeTypeOf('string');
        h.broadcasts.length = 0;
        h.setCrash(false);
        h.sender.setGate({ price: true, pause: false, reason: 'pause only' });
        const price = await h.sender.send(h.job('0xbbbb' as Hex));
        expect(price.status).toBe('included');
        expect(h.broadcasts).toHaveLength(2);
        expect(h.broadcasts).not.toContain(pauseRaw);
        const cancel = h.signed[1];
        expect(cancel).toMatchObject({
            to: SIGNER,
            data: '0x',
            gasLimit: 21_000n,
            nonce: 7,
            cancel: true,
            maxFeePerGas: 263n,
            maxPriorityFeePerGas: 13n,
        });
        expect(h.broadcasts[0]).toBe(h.signed[1]?.raw);
        expect(h.signed[2]).toMatchObject({ nonce: 8, to: TO, data: '0xbbbb', cancel: false });
        expect(h.journaledBeforeBroadcast().slice(1).every((seen) => seen)).toBe(true);
        const saved = JSON.parse(readFileSync(h.path, 'utf8')) as { entries: { nonce: number; kind: string; cancelled?: boolean }[] };
        expect(saved.entries[0]).toMatchObject({ nonce: 7, kind: 'cancel', cancelled: true });
    });

    it('the old pause landing before the cancel settles the nonce and alerts', async () => {
        const h = harness();
        h.setCrash(true);
        const pause = await h.sender.send({ kind: 'pause', to: TO, data: DATA });
        expect(pause.status).toBe('pending');
        const pauseRaw = h.broadcasts[0]!;
        h.broadcasts.length = 0;
        h.setCrash(false);
        h.plantPauseReceiptOnNextBroadcast(keccak256(pauseRaw));
        h.sender.setGate({ price: true, pause: false, reason: 'pause only' });
        const price = await h.sender.send(h.job('0xbbbb' as Hex));
        expect(price.status).toBe('included');
        expect(h.alerts).toContain('pause landed before cancel nonce 7');
        expect(h.broadcasts).not.toContain(pauseRaw);
        expect(h.signed.map((row) => row.nonce)).toEqual([7, 7, 8]);
        expect(h.signed[1]).toMatchObject({ to: SIGNER, data: '0x', cancel: true });
        expect(h.signed[2]?.nonce).toBe(8);
    });

    it('a cancel request with the price gate also closed is refused and broadcasts nothing', async () => {
        const h = harness();
        h.setCrash(true);
        const price = await h.sender.send(h.job());
        expect(price.status).toBe('pending');
        h.broadcasts.length = 0;
        h.setCrash(false);
        h.sender.setGate({ price: false, pause: true, reason: 'price closed' });
        const pause = await h.sender.send({ kind: 'pause', to: TO, data: DATA });
        expect(pause).toEqual({ status: 'refused', reason: 'sender: gate closed' });
        expect(h.broadcasts).toEqual([]);
        expect(h.signed).toHaveLength(1);
    });

    it('saturates attempts without rejecting the journal and keeps only the latest raws', async () => {
        const h = harness({ bumpAfterAttempts: 1, receiptWaitMs: 20, pollIntervalMs: 5 });
        h.setCrash(true);
        const first = await h.sender.send(h.job());
        expect(first.status).toBe('pending');
        const body = JSON.parse(readFileSync(h.path, 'utf8')) as { entries: { attempts: number; raws: string[]; hashes: string[] }[] };
        body.entries[0]!.attempts = Number.MAX_SAFE_INTEGER;
        writeFileSync(h.path, JSON.stringify(body));
        const capped = h.another();
        capped.setGate({ price: true, pause: true, reason: '' });
        await capped.send(h.job('0xbbbb' as Hex));
        const reloaded = new Journal(h.path, { chainId: CHAIN_ID, signer: SIGNER });
        expect(await reloaded.load()).toBe('ok');
        expect(reloaded.inFlight()?.attempts).toBe(Number.MAX_SAFE_INTEGER);
        expect(reloaded.inFlight()?.raws.length).toBeLessThanOrEqual(3);
    });

    it('refuses further bumps at the hash cap and still signs a cancel', async () => {
        const h = harness({ bumpAfterAttempts: 1, receiptWaitMs: 20, pollIntervalMs: 5 });
        h.setCrash(true);
        await h.sender.send(h.job());
        const body = JSON.parse(readFileSync(h.path, 'utf8')) as { entries: { hashes: string[]; raws: string[] }[] };
        const entry = body.entries[0]!;
        const tail = entry.hashes.slice();
        const fillers: string[] = [];
        for (let i = 0; i < JOURNAL_HASH_CAP - tail.length; i++) {
            fillers.push('0x' + (i + 1).toString(16).padStart(64, '0'));
        }
        entry.hashes = [...fillers, ...tail];
        writeFileSync(h.path, JSON.stringify(body));
        const before = h.signed.length;
        const blocked = h.another();
        blocked.setGate({ price: true, pause: true, reason: '' });
        const held = await blocked.send(h.job('0xbbbb' as Hex));
        expect(held.status).toBe('blocked');
        expect(h.signed).toHaveLength(before);
        const cancelling = h.another({ enabledKinds: { 'price-super': false, 'price-paymaster': true, pause: true } });
        cancelling.setGate({ price: true, pause: true, reason: '' });
        const cancelled = await cancelling.send({ kind: 'price-paymaster', to: OTHER, data: DATA });
        expect(cancelled.status === 'pending' || cancelled.status === 'blocked' || cancelled.status === 'included').toBe(true);
        expect(h.signed.at(-1)?.cancel).toBe(true);
        expect(h.signed.at(-1)?.nonce).toBe(7);
    });

    it('alerts a stuck in-flight nonce once and once again when it is included', async () => {
        const h = harness({ bumpAfterAttempts: 1, receiptWaitMs: 20, pollIntervalMs: 5 });
        h.setCrash(true);
        await h.sender.send(h.job());
        await h.sender.send(h.job('0xbbbb' as Hex));
        await h.sender.send(h.job('0xcccc' as Hex));
        const stuck = () => h.alerts.filter((msg) => msg.startsWith('stuck in-flight nonce 7'));
        expect(stuck()).toEqual(['stuck in-flight nonce 7 kind price-super attempts 3']);
        await h.sender.send(h.job('0xdddd' as Hex));
        expect(stuck()).toHaveLength(1);
        h.setCrash(false);
        await h.sender.send(h.job('0xeeee' as Hex));
        expect(h.alerts.filter((msg) => msg === 'stuck in-flight nonce 7 kind price-super recovered')).toHaveLength(1);
        await h.sender.send(h.job('0x1111' as Hex));
        expect(h.alerts.filter((msg) => msg.includes('recovered'))).toHaveLength(1);
    });

    it('alerts a price send blocked on an in-flight nonce once', async () => {
        const h = harness({ receiptWaitMs: 20, pollIntervalMs: 5 });
        h.setCrash(true);
        await h.sender.send({ kind: 'pause', to: TO, data: DATA });
        h.sender.setGate({ price: true, pause: false, reason: 'pause only' });
        const first = await h.sender.send(h.job());
        expect(first.status).toBe('blocked');
        const second = await h.sender.send(h.job('0xbbbb' as Hex));
        expect(second.status).toBe('blocked');
        expect(h.alerts.filter((msg) => msg === 'price update blocked behind in-flight nonce 7')).toHaveLength(1);
    });

    it('alerts nonce behind again after a successful send clears it', async () => {
        const h = harness();
        expect((await h.sender.send(h.job())).status).toBe('included');
        h.setNonce(7n);
        expect((await h.sender.send(h.job('0xbbbb' as Hex))).status).toBe('refused');
        h.setNonce(8n);
        expect((await h.sender.send(h.job('0xcccc' as Hex))).status).toBe('included');
        h.setNonce(8n);
        expect((await h.sender.send(h.job('0xdddd' as Hex))).status).toBe('refused');
        expect(h.alerts.filter((msg) => msg.startsWith('sender: nonce behind journal'))).toHaveLength(2);
    });

    it('alerts a closed gate again after the gate is reopened', async () => {
        const h = harness();
        h.sender.setGate({ price: false, pause: false, reason: 'no' });
        await h.sender.send(h.job());
        await h.sender.send(h.job());
        expect(h.alerts.filter((msg) => msg === 'sender: gate closed')).toHaveLength(1);
        h.sender.setGate({ price: true, pause: true, reason: '' });
        h.sender.setGate({ price: false, pause: false, reason: 'no' });
        await h.sender.send(h.job());
        expect(h.alerts.filter((msg) => msg === 'sender: gate closed')).toHaveLength(2);
    });

    it('a zero tip replacement is at least one wei and 25 percent higher', () => {
        expect(bumpFee(0n, 0n)).toBe(1n);
        expect(bumpFee(4n, 0n)).toBe(5n);
        expect(bumpFee(100n, 0n)).toBe(125n);
        expect(bumpFee(100n, 1_000n)).toBe(1_000n);
    });

    it('a disabled recovered kind is cancelled and not rebroadcast', async () => {
        const h = harness({ receiptWaitMs: 30, pollIntervalMs: 5 });
        h.setCrash(true);
        const first = await h.sender.send({ kind: 'price-paymaster', to: OTHER, data: DATA });
        expect(first.status).toBe('pending');
        const original = h.broadcasts[0];
        h.setCrash(false);
        const restarted = h.another({ enabledKinds: { 'price-super': true, 'price-paymaster': false, pause: false } });
        restarted.setGate({ price: true, pause: true, reason: '' });
        const next = await restarted.send(h.job('0xbbbb' as Hex));
        expect(next.status).toBe('included');
        expect(h.broadcasts.filter((raw) => raw === original)).toHaveLength(1);
        expect(h.signed[1]).toMatchObject({ cancel: true, nonce: 7, to: SIGNER, data: '0x' });
    });

    it('a reorged pause is cancelled through the same gate and not rebroadcast', async () => {
        const h = harness({ receiptWaitMs: 30, pollIntervalMs: 5 });
        expect((await h.sender.send({ kind: 'pause', to: TO, data: DATA })).status).toBe('included');
        const original = h.broadcasts[0];
        h.chain.getTransactionReceipt = async () => null;
        h.setNonce(7n);
        h.sender.setGate({ price: true, pause: false, reason: 'pause only' });
        const next = await h.sender.send(h.job('0xbbbb' as Hex));
        expect(next).toMatchObject({ status: 'refused', reason: 'sender: nonce behind journal' });
        expect(h.broadcasts.filter((raw) => raw === original)).toHaveLength(1);
        expect(h.signed.some((row) => row.cancel && row.nonce === 7 && row.to === SIGNER && row.data === '0x')).toBe(true);
    });

    it('a pause raw in the journal is refused and nothing is broadcast', async () => {
        const h = harness({ receiptWaitMs: 30, pollIntervalMs: 5 });
        h.setCrash(true);
        const pause = await h.sender.send({ kind: 'pause', to: TO, data: DATA });
        expect(pause.status).toBe('pending');
        h.broadcasts.length = 0;
        const restarted = h.another({
            intent: (kind, decoded) => kind === 'pause' ? false : testIntent(kind, decoded),
        });
        restarted.setGate({ price: true, pause: true, reason: '' });
        const again = await restarted.send(h.job());
        expect(again).toMatchObject({ status: 'refused', reason: 'sender: journal refused' });
        expect(h.broadcasts).toEqual([]);
    });

    it('persists a foreign nonce and a restart still refuses until the journal is realigned', async () => {
        const h = harness();
        expect((await h.sender.send(h.job())).status).toBe('included');
        h.chain.getTransactionReceipt = async () => null;
        h.setNonce(90n);
        const refused = await h.sender.send(h.job('0xbbbb' as Hex));
        expect(refused).toMatchObject({ status: 'refused', reason: 'sender: foreign nonce' });
        const saved = JSON.parse(readFileSync(h.path, 'utf8')) as { foreignNonce?: number };
        expect(saved.foreignNonce).toBe(7);
        h.setNonce(7n);
        const restarted = h.another();
        restarted.setGate({ price: true, pause: true, reason: '' });
        const again = await restarted.send(h.job('0xcccc' as Hex));
        expect(again).toMatchObject({ status: 'refused', reason: 'sender: foreign nonce' });
        expect(h.broadcasts).toHaveLength(1);
        expect(h.signed.filter((row) => row.nonce === 8)).toHaveLength(0);
    });

    it('demotes every included nonce from the earliest hole and rebroadcasts that nonce', async () => {
        const h = harness();
        expect((await h.sender.send(h.job())).status).toBe('included');
        expect((await h.sender.send(h.job('0xbbbb' as Hex))).status).toBe('included');
        const firstRaw = h.broadcasts[0];
        const secondRaw = h.broadcasts[1];
        h.chain.getTransactionReceipt = async () => null;
        h.setNonce(7n);
        const behind = await h.sender.send(h.job('0xcccc' as Hex));
        expect(behind).toMatchObject({ status: 'refused', reason: 'sender: nonce behind journal' });
        expect(h.broadcasts.filter((raw) => raw === firstRaw).length).toBeGreaterThanOrEqual(2);
        expect(h.broadcasts.filter((raw) => raw === secondRaw)).toHaveLength(1);
        expect(h.signed.map((row) => row.nonce)).toEqual([7, 8]);
    });

    it('does not treat a receipt as included when its hash or block is not canonical', async () => {
        const h = harness({ receiptWaitMs: 20, pollIntervalMs: 5 });
        h.setCrash(true);
        expect((await h.sender.send(h.job())).status).toBe('pending');
        h.setCrash(false);
        h.chain.getTransactionReceipt = async () => ({
            status: 'success',
            gasUsed: 100n,
            blockHash: BLOCK,
            blockNumber: 1n,
            transactionHash: ('0x' + '11'.repeat(32)) as Hex,
        });
        h.setNonce(8n);
        const foreign = await h.sender.send(h.job('0xbbbb' as Hex));
        expect(foreign).toMatchObject({ status: 'refused', reason: 'sender: foreign nonce' });

        const orphan = harness({ receiptWaitMs: 20, pollIntervalMs: 5 });
        orphan.setCrash(true);
        expect((await orphan.sender.send(orphan.job())).status).toBe('pending');
        orphan.setCrash(false);
        orphan.chain.getTransactionReceipt = async (asked) => ({
            status: 'success',
            gasUsed: 100n,
            blockHash: ('0x' + '22'.repeat(32)) as Hex,
            blockNumber: 1n,
            transactionHash: asked,
        });
        orphan.setNonce(8n);
        const still = await orphan.sender.send(orphan.job('0xcccc' as Hex));
        expect(still).toMatchObject({ status: 'refused', reason: 'sender: foreign nonce' });
    });

    it('refuses a chain id mismatch without echoing the rpc value', async () => {
        const h = harness();
        h.chain.chainId = async () => 1;
        const refused = await h.sender.send(h.job());
        expect(refused).toMatchObject({ status: 'refused', reason: 'sender: chain id mismatch' });
        expect(h.alerts.join('\n')).not.toContain('0x1');
        expect(h.signed).toEqual([]);
        const again = await h.sender.send(h.job());
        expect(again).toMatchObject({ status: 'refused', reason: 'sender: chain id mismatch' });
    });

    it('refuses a send when the gate expires before signing and before broadcast', async () => {
        let now = 1_000_000;
        const h = harness({ now: () => now });
        h.sender.setGate({ price: true, pause: true, reason: '', validUntil: now });
        const early = await h.sender.send(h.job());
        expect(early).toMatchObject({ status: 'refused', reason: 'sender: gate closed' });
        expect(h.signed).toEqual([]);
        now = 2_000_000;
        h.sender.setGate({ price: true, pause: true, reason: '', validUntil: now + 50_000 });
        let renamed = false;
        setDurabilityHooks({
            async write(fh, body) { await fh.writeFile(body, 'utf8'); },
            async fsyncFile(fh) { await fh.sync(); },
            async rename(from, to) {
                renamed = true;
                const { rename } = await import('node:fs/promises');
                await rename(from, to);
            },
            async fsyncDir(dir) {
                if (renamed && dir === dirname(h.path)) now = 2_000_000 + 50_000;
                const dh = await open(dir, 'r');
                try { await dh.sync(); } finally { await dh.close(); }
            },
        });
        const expired = await h.sender.send(h.job());
        expect(expired).toMatchObject({ status: 'refused', reason: 'sender: gate closed' });
        expect(h.broadcasts).toEqual([]);
        expect(readFileSync(h.path, 'utf8')).toContain('price-super');
    });

    it('fsyncs the journal before rename and the directory before broadcast', async () => {
        const h = harness({ receiptWaitMs: 30, pollIntervalMs: 5 });
        const events: string[] = [];
        const failAt = { step: '' };
        const hooks: DurabilityHooks = {
            async write(fh, body) {
                events.push('write');
                if (failAt.step === 'write') throw new Error('injected');
                await fh.writeFile(body, 'utf8');
            },
            async fsyncFile(fh) {
                events.push('fsyncFile');
                if (failAt.step === 'fsyncFile') throw new Error('injected');
                await fh.sync();
            },
            async rename(from, to) {
                events.push('rename');
                if (failAt.step === 'rename') throw new Error('injected');
                const { rename } = await import('node:fs/promises');
                await rename(from, to);
            },
            async fsyncDir(dir) {
                events.push(`fsyncDir:${dir}`);
                if (failAt.step === 'fsyncDir' && dir === dirname(h.path)) throw new Error('injected');
                const dh = await open(dir, 'r');
                try { await dh.sync(); } finally { await dh.close(); }
            },
        };
        setDurabilityHooks(hooks);
        const ok = await h.sender.send(h.job());
        expect(ok.status).toBe('included');
        const journalDir = dirname(h.path);
        const commit = events.filter((event) => event === 'write' || event === 'fsyncFile' || event === 'rename' || event === `fsyncDir:${journalDir}`);
        const renameAt = commit.lastIndexOf('rename');
        expect(commit[renameAt - 2]).toBe('write');
        expect(commit[renameAt - 1]).toBe('fsyncFile');
        expect(commit[renameAt + 1]).toBe(`fsyncDir:${journalDir}`);
        expect(h.journaledBeforeBroadcast().every(Boolean)).toBe(true);

        for (const step of ['write', 'fsyncFile', 'rename', 'fsyncDir'] as const) {
            const crashed = harness({ receiptWaitMs: 30, pollIntervalMs: 5 });
            let renamed = false;
            setDurabilityHooks({
                async write(fh, body) {
                    if (step === 'write') throw new Error('injected');
                    await fh.writeFile(body, 'utf8');
                },
                async fsyncFile(fh) {
                    if (step === 'fsyncFile') throw new Error('injected');
                    await fh.sync();
                },
                async rename(from, to) {
                    renamed = true;
                    if (step === 'rename') throw new Error('injected');
                    const { rename } = await import('node:fs/promises');
                    await rename(from, to);
                },
                async fsyncDir(dir) {
                    if (step === 'fsyncDir' && renamed && dir === dirname(crashed.path)) throw new Error('injected');
                    const dh = await open(dir, 'r');
                    try { await dh.sync(); } finally { await dh.close(); }
                },
            });
            const refused = await crashed.sender.send(crashed.job());
            expect(refused.status, step).toBe('refused');
            expect(crashed.broadcasts, step).toEqual([]);
            setDurabilityHooks(null);
            if (step === 'fsyncDir') {
                const restarted = crashed.another();
                restarted.setGate({ price: true, pause: true, reason: '' });
                const recovered = await restarted.send(crashed.job('0xbbbb' as Hex));
                expect(recovered.status).toBe('included');
                const recoveredRaw = crashed.signed.find((row) => row.nonce === 7)?.raw;
                expect(crashed.signed.filter((row) => row.nonce === 7)).toHaveLength(1);
                expect(crashed.broadcasts.filter((raw) => raw === recoveredRaw)).toHaveLength(1);
            }
        }
    });
});
