/**
 * One sender, one nonce. Fakes stand in for the chain and for cast.
 */
import { chmodSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { keccak256, type Address, type Hex } from 'viem';
import { Journal } from './journal';
import { Sender, type ChainIO, type ChainReceipt, type SendRequest } from './sender';

const TO = '0x1111111111111111111111111111111111111111' as Address;
const OTHER = '0x2222222222222222222222222222222222222222' as Address;
const SIGNER = '0x3333333333333333333333333333333333333333' as Address;
const DATA = '0x1234' as Hex;
const BLOCK = ('0x' + 'ab'.repeat(32)) as Hex;

const SPAWN_VERDICT_TIMEOUT_MS = 30_000;

const dirs: string[] = [];
afterEach(() => {
    for (const dir of dirs.splice(0)) {
        try {
            if (statSync(dir).isDirectory()) chmodSync(dir, 0o700);
        } catch { /* already gone */ }
        rmSync(dir, { recursive: true, force: true });
    }
}, SPAWN_VERDICT_TIMEOUT_MS);

function rawFor(nonce: number, salt: number): Hex {
    return ('0x' + nonce.toString(16).padStart(2, '0') + salt.toString(16).padStart(4, '0') + '00') as Hex;
}

function harness(opts: { bumpAfterAttempts?: number; receiptWaitMs?: number; pollIntervalMs?: number; base?: bigint } = {}) {
    const dir = mkdtempSync(join(tmpdir(), 'keeper-sender-'));
    dirs.push(dir);
    const path = join(dir, 'journal.json');
    let latest = opts.base ?? 7n;
    let pending = latest;
    let baseFee = 100n;
    let tip = 10n;
    const broadcasts: Hex[] = [];
    const alerts: string[] = [];
    const signed: { nonce: number; maxFeePerGas: bigint; maxPriorityFeePerGas: bigint; to: Address; data: Hex; gasLimit: bigint; cancel: boolean }[] = [];
    const receipts = new Map<string, ChainReceipt>();
    let salt = 0;
    let crashSend = false;
    let landPauseHash: Hex | null = null;
    let rawOnDiskBeforeBroadcast: boolean | null = null;
    const journaledBeforeBroadcast: boolean[] = [];
    let shared: ChainReceipt | null = null;
    let beforeSign: (() => Promise<void>) | null = null;
    const chain: ChainIO = {
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
        async getBlockByNumber() {
            return { hash: BLOCK, number: 1n };
        },
        async getBlockByHash() {
            return { hash: BLOCK, number: 1n };
        },
        async call() {
            return '0x' as Hex;
        },
    };
    const signer = {
        async sign(req: { nonce: number; maxFeePerGas: bigint; maxPriorityFeePerGas: bigint; to: Address; data: Hex; gasLimit: bigint; cancel?: boolean }) {
            if (beforeSign) await beforeSign();
            salt += 1;
            signed.push({
                nonce: req.nonce,
                maxFeePerGas: req.maxFeePerGas,
                maxPriorityFeePerGas: req.maxPriorityFeePerGas,
                to: req.to,
                data: req.data,
                gasLimit: req.gasLimit,
                cancel: req.cancel === true,
            });
            return rawFor(req.nonce, salt);
        },
    };
    const journal = new Journal(path, { chainId: 11155111, signer: SIGNER });
    const sender = new Sender({
        chain,
        signer,
        journal,
        signerAddress: SIGNER,
        chainId: 11155111,
        receiptWaitMs: opts.receiptWaitMs ?? 200,
        pollIntervalMs: opts.pollIntervalMs,
        bumpAfterAttempts: opts.bumpAfterAttempts ?? 3,
        alert: (msg) => alerts.push(msg),
    });
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
        const restarted = new Sender({
            chain: h.chain,
            signer: h.signer,
            journal: new Journal(h.path, { chainId: 11155111, signer: SIGNER }),
            signerAddress: SIGNER,
            chainId: 11155111,
            receiptWaitMs: 200,
            alert: () => {},
        });
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
        expect(h.broadcasts[0]).toBe(rawFor(7, 2));
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

    it('stops growing attempts at the parse cap and rebroadcasts once raws are full', async () => {
        const h = harness({ bumpAfterAttempts: 1, receiptWaitMs: 20, pollIntervalMs: 5 });
        h.setCrash(true);
        const first = await h.sender.send(h.job());
        expect(first.status).toBe('pending');
        const body = JSON.parse(readFileSync(h.path, 'utf8')) as { entries: { attempts: number; raws: string[] }[] };
        body.entries[0]!.attempts = 1000;
        writeFileSync(h.path, JSON.stringify(body));
        const capped = new Sender({
            chain: h.chain,
            signer: h.signer,
            journal: new Journal(h.path, { chainId: 11155111, signer: SIGNER }),
            signerAddress: SIGNER,
            chainId: 11155111,
            receiptWaitMs: 20,
            pollIntervalMs: 5,
            bumpAfterAttempts: 1,
            alert: (msg) => h.alerts.push(msg),
        });
        capped.setGate({ price: true, pause: true, reason: '' });
        await capped.send(h.job('0xbbbb' as Hex));
        const reloaded = new Journal(h.path, { chainId: 11155111, signer: SIGNER });
        expect(await reloaded.load()).toBe('ok');
        expect(reloaded.inFlight()?.attempts).toBe(1000);

        const full = harness({ bumpAfterAttempts: 1, receiptWaitMs: 15, pollIntervalMs: 5 });
        full.setCrash(true);
        await full.sender.send(full.job());
        for (let i = 0; i < 19; i++) await full.sender.send(full.job('0xbbbb' as Hex));
        expect(full.signed).toHaveLength(20);
        const before = full.signed.length;
        const held = await full.sender.send(full.job('0xcccc' as Hex));
        expect(held.status).toBe('blocked');
        expect(full.signed).toHaveLength(before);
        const saved = new Journal(full.path, { chainId: 11155111, signer: SIGNER });
        expect(await saved.load()).toBe('ok');
        expect(saved.inFlight()?.raws).toHaveLength(20);
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
});
