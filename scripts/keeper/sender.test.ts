/**
 * One sender, one in-flight nonce. Fakes stand in for the chain and for cast.
 */
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { encodeFunctionData, getAddress, keccak256, parseAbi, type Address, type Hex } from 'viem';
import { signTransaction } from 'viem/accounts';
import { Journal, type InFlight } from './journal.js';
import { FEE_BASE_MULTIPLIER, UPDATE_PRICE_DATA, authorizeSign, bumpedFee, checkIntent, manualStallCommand, signingFees, Sender, type ChainIO, type ChainReceipt, type IntentTx, type SendRequest, type StalenessRead, type UpdatedAtRead } from './sender.js';

const TO = '0x1111111111111111111111111111111111111111' as Address;
const OTHER = '0x2222222222222222222222222222222222222222' as Address;
const KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as const;
const SIGNER = getAddress('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
const BLOCK = ('0x' + 'ab'.repeat(32)) as Hex;
const CHAIN_ID = 11155111;
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

function markerFile(journalPath: string): string {
    return join(dirname(journalPath), 'sepolia.stalled');
}

function harness(opts: {
    maxGas?: bigint;
    maxFeeWei?: bigint;
    maxTipWei?: bigint;
    stallSec?: number;
    progressMs?: number;
    enabled?: { 'price-super': boolean; 'price-paymaster': boolean };
    paymaster?: () => Address | null;
    superPaymaster?: Address | null;
    now?: () => number;
    minUpdateIntervalSec?: number;
    priceStalenessThresholdSec?: bigint;
    readUpdatedAt?: (to: Address) => Promise<UpdatedAtRead>;
    readStaleness?: () => Promise<StalenessRead | 'unreadable'>;
    manualStep?: (nonce: number) => string;
    paymasterIdentity?: boolean;
} = {}) {
    const dir = mkdtempSync(join(tmpdir(), 'keeper-sender-'));
    dirs.push(dir);
    const path = join(dir, 'journal.json');
    let latest = 7n;
    let pending = 7n;
    let baseFee = 100n;
    let tip = 10n;
    let chainReads = 0;
    let expireChainOnRead = 0;
    const clock = { now: 1_000 };
    const broadcasts: Hex[] = [];
    const alerts: string[] = [];
    const signed: { to: Address; data: Hex; nonce: number; gasLimit: bigint; maxFeePerGas: bigint; maxPriorityFeePerGas: bigint; cancel: boolean }[] = [];
    const receipts = new Map<string, ChainReceipt | 'throw'>();
    let shared: ChainReceipt | null = null;
    let crashSend = false;
    let signerTo: Address | null = null;
    let signerData: Hex | null = null;
    let signerValue = 0n;
    let signerGas: bigint | null = null;
    let signerNonce: number | null = null;
    let signerFee: bigint | null = null;
    let signerTip: bigint | null = null;
    let deliver: (() => boolean | Promise<boolean>) | null = null;
    let signWait: Promise<void> | null = null;
    let releaseSign: () => void = () => {};
    let signEntered = false;
    const chain: ChainIO = {
        async chainId() {
            chainReads += 1;
            if (expireChainOnRead > 0 && chainReads >= expireChainOnRead) clock.now = 9_999_999;
            return CHAIN_ID;
        },
        async getTransactionCount(_addr, tag) {
            return tag === 'pending' ? pending : latest;
        },
        async getBalance() { return 10n ** 18n; },
        async estimateGas() { return 100_000n; },
        async fees() { return { baseFee, tip }; },
        async sendRawTransaction(raw) {
            broadcasts.push(raw);
            if (crashSend) throw new Error('crash');
            const hash = keccak256(raw);
            receipts.set(hash.toLowerCase(), {
                status: 'success', gasUsed: 100n, blockHash: BLOCK, blockNumber: 1n, transactionHash: hash,
            });
            latest += 1n;
            pending = latest;
            return hash;
        },
        async getTransactionReceipt(hash) {
            const found = receipts.get(hash.toLowerCase());
            if (found === 'throw') throw new Error('rpc down');
            if (!found) return null;
            shared = found;
            return found;
        },
        async getBlockByNumber(n) { return { hash: BLOCK, number: n }; },
        async getBlockByHash() { return { hash: BLOCK, number: 1n }; },
        async call() { return '0x' as Hex; },
    };
    const signer = {
        async sign(req: { nonce: number; maxFeePerGas: bigint; maxPriorityFeePerGas: bigint; to: Address; data: Hex; gasLimit: bigint; chainId: number; cancel?: boolean }) {
            signEntered = true;
            if (signWait) await signWait;
            const to = signerTo ?? req.to;
            const data = signerData ?? req.data;
            const gas = signerGas ?? req.gasLimit;
            const nonce = signerNonce ?? req.nonce;
            const maxFeePerGas = signerFee ?? req.maxFeePerGas;
            const maxPriorityFeePerGas = signerTip ?? req.maxPriorityFeePerGas;
            const raw = await signTransaction({
                privateKey: KEY,
                transaction: {
                    type: 'eip1559', chainId: req.chainId, nonce, gas, maxFeePerGas,
                    maxPriorityFeePerGas, to, value: signerValue, data,
                },
            });
            signed.push({
                to, data, nonce: req.nonce, gasLimit: gas, maxFeePerGas: req.maxFeePerGas,
                maxPriorityFeePerGas: req.maxPriorityFeePerGas, cancel: req.cancel === true,
            });
            return raw;
        },
    };
    const journal = new Journal(path, { chainId: CHAIN_ID, signer: SIGNER }, null, opts.progressMs);
    const sender = new Sender({
        chain,
        signer,
        journal,
        signerAddress: SIGNER,
        chainId: CHAIN_ID,
        superPaymaster: opts.superPaymaster === undefined ? TO : opts.superPaymaster,
        paymaster: opts.paymaster ?? (() => OTHER),
        enabledKinds: opts.enabled,
        maxGas: opts.maxGas,
        maxFeeWei: opts.maxFeeWei ?? 1_000_000_000n,
        maxTipWei: opts.maxTipWei,
        stallSec: opts.stallSec,
        minUpdateIntervalSec: opts.minUpdateIntervalSec,
        priceStalenessThresholdSec: opts.priceStalenessThresholdSec,
        now: opts.now ?? (() => clock.now),
        alert: (msg) => {
            alerts.push(msg);
            return deliver ? deliver() : undefined;
        },
        readUpdatedAt: opts.readUpdatedAt,
        readStaleness: opts.readStaleness,
        manualStep: opts.manualStep,
    });
    sender.setPaymasterIdentity(opts.paymasterIdentity !== false);
    sender.setGate({ price: true, pause: true, reason: '', validUntil: 5_000 });
    const job = (kind: SendRequest['kind'] = 'price-super', to: Address = TO, data: Hex = UPDATE_PRICE_DATA): SendRequest => ({ kind, to, data });
    return {
        path, sender, broadcasts, alerts, signed, journal, chain, clock, job,
        shared: () => shared,
        setNonce: (n: bigint, p = n) => { latest = n; pending = p; },
        setFees: (base: bigint, nextTip: bigint) => { baseFee = base; tip = nextTip; },
        setCrash: (v: boolean) => { crashSend = v; },
        setChainId(fn: () => Promise<number>) { chain.chainId = fn; },
        expireOnChainRead(n: number) { expireChainOnRead = n; },
        chainReads: () => chainReads,
        tamperSigner(next: { to?: Address; data?: Hex; value?: bigint; gas?: bigint; nonce?: number; fee?: bigint; tip?: bigint }) {
            signerTo = next.to ?? null;
            signerData = next.data ?? null;
            signerValue = next.value ?? 0n;
            signerGas = next.gas ?? null;
            signerNonce = next.nonce ?? null;
            signerFee = next.fee ?? null;
            signerTip = next.tip ?? null;
        },
        setDeliver(fn: (() => boolean | Promise<boolean>) | null) { deliver = fn; },
        holdReceipt(hash: Hex) { receipts.delete(hash.toLowerCase()); },
        throwReceipt(hash: Hex) { receipts.set(hash.toLowerCase(), 'throw'); },
        holdSign() {
            signEntered = false;
            signWait = new Promise<void>((resolve) => { releaseSign = resolve; });
            return {
                entered: () => signEntered,
                release() { signWait = null; releaseSign(); },
            };
        },
        reopen(over: { maxFeeWei?: bigint; stallSec?: number; minUpdateIntervalSec?: number; priceStalenessThresholdSec?: bigint } = {}) {
            const next = new Sender({
                chain,
                signer,
                journal: new Journal(path, { chainId: CHAIN_ID, signer: SIGNER }),
                signerAddress: SIGNER,
                chainId: CHAIN_ID,
                superPaymaster: opts.superPaymaster === undefined ? TO : opts.superPaymaster,
                paymaster: opts.paymaster ?? (() => OTHER),
                enabledKinds: opts.enabled,
                maxGas: opts.maxGas,
                maxFeeWei: over.maxFeeWei ?? opts.maxFeeWei ?? 1_000_000_000n,
                maxTipWei: opts.maxTipWei,
                stallSec: over.stallSec ?? opts.stallSec,
                minUpdateIntervalSec: over.minUpdateIntervalSec ?? opts.minUpdateIntervalSec,
                priceStalenessThresholdSec: over.priceStalenessThresholdSec ?? opts.priceStalenessThresholdSec,
                now: opts.now ?? (() => clock.now),
                alert: (msg) => {
                    alerts.push(msg);
                    return deliver ? deliver() : undefined;
                },
                readUpdatedAt: opts.readUpdatedAt,
                readStaleness: opts.readStaleness,
                manualStep: opts.manualStep,
            });
            next.setPaymasterIdentity(opts.paymasterIdentity !== false);
            next.setGate({ price: true, pause: true, reason: '', validUntil: clock.now + 3_600_000 });
            return next;
        },
        plant(raw: Hex, included: boolean) {
            const hash = keccak256(raw);
            if (included) {
                receipts.set(hash.toLowerCase(), {
                    status: 'success', gasUsed: 50_000n, blockHash: BLOCK, blockNumber: 1n, transactionHash: hash,
                });
                latest += 1n;
                pending = latest;
            }
            return hash;
        },
    };
}

async function signedRaw(opts: { to: Address; data: Hex; nonce: number; gas?: bigint; maxFee?: bigint; tip?: bigint; value?: bigint; chainId?: number }): Promise<Hex> {
    return signTransaction({
        privateKey: KEY,
        transaction: {
            type: 'eip1559',
            chainId: opts.chainId ?? CHAIN_ID,
            nonce: opts.nonce,
            gas: opts.gas ?? 120_000n,
            maxFeePerGas: opts.maxFee ?? 210n,
            maxPriorityFeePerGas: opts.tip ?? 10n,
            to: opts.to,
            value: opts.value ?? 0n,
            data: opts.data,
        },
    });
}

const targets = {
    superPaymaster: TO,
    paymaster: OTHER,
    signer: SIGNER,
    chainId: CHAIN_ID,
    maxGas: 500_000n,
};

function intent(over: Partial<IntentTx> = {}): IntentTx {
    return {
        to: TO, data: UPDATE_PRICE_DATA, value: 0n, gas: 120_000n, chainId: CHAIN_ID, type: 'eip1559', accessListEmpty: true, ...over,
    };
}

describe('Sender', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
    it('two concurrent sends sign nonce then nonce+1, never the same nonce', async () => {
        const h = harness();
        let release: () => void = () => {};
        const gate = new Promise<void>((resolve) => { release = resolve; });
        const orig = h.chain.getTransactionCount.bind(h.chain);
        let first = true;
        h.chain.getTransactionCount = async (addr, tag) => {
            const value = await orig(addr, tag);
            if (first && tag === 'pending') {
                first = false;
                await gate;
            }
            return value;
        };
        const a = h.sender.send(h.job());
        const b = h.sender.send(h.job());
        await new Promise((resolve) => setTimeout(resolve, 30));
        release();
        const [ra, rb] = await Promise.all([a, b]);
        expect(ra.status === 'pending' || ra.status === 'blocked').toBe(true);
        expect(h.signed.map((s) => s.nonce)).toEqual([7, 8]);
        expect(rb.status === 'pending' || rb.status === 'blocked' || rb.status === 'refused').toBe(true);
    });

    it('a zero priority fee quote signs and broadcasts (#447 clestons M1\')', async () => {
        const h = harness();
        h.setFees(100n, 0n);
        const result = await h.sender.send(h.job());
        expect(result.status).toBe('pending');
        expect(h.signed.map((s) => s.maxPriorityFeePerGas)).toEqual([0n]);
        expect(h.broadcasts).toHaveLength(1);
    });

    it('a closed identity gate does not sign or broadcast', async () => {
        const h = harness();
        h.sender.setGate({ price: false, pause: false, reason: 'closed', validUntil: 5_000 });
        const result = await h.sender.send(h.job());
        expect(result).toEqual({ status: 'refused', reason: 'sender: gate closed' });
        expect(h.signed).toEqual([]);
        expect(h.broadcasts).toEqual([]);
    });

    it('a fourth intent is never signed', async () => {
        const h = harness();
        const extra = encodeFunctionData({ abi: parseAbi(['function updatePrice(uint256)']), functionName: 'updatePrice', args: [1n] });
        const badTo = await h.sender.send(h.job('price-super', OTHER, UPDATE_PRICE_DATA));
        const badData = await h.sender.send(h.job('price-super', TO, extra));
        expect(badTo.status).toBe('refused');
        expect(badData.status).toBe('refused');
        expect(h.signed).toEqual([]);
        expect(h.broadcasts).toEqual([]);

        h.tamperSigner({ to: OTHER });
        const castLie = await h.sender.send(h.job());
        expect(castLie.status).toBe('refused');
        expect(h.broadcasts).toEqual([]);

        const raw = await signedRaw({ to: OTHER, data: UPDATE_PRICE_DATA, nonce: 7 });
        expect(await h.journal.load()).toBe('ok');
        const flight: InFlight = {
            kind: 'price-super', nonce: 7, raws: [raw], hashes: [keccak256(raw)],
            gasLimit: 120_000n, maxFeePerGas: 210n, maxPriorityFeePerGas: 10n, attempts: 0, firstSentAt: 1,
        };
        await h.journal.writeInFlight(flight);
        h.setNonce(7n, 8n);
        const maintained = await h.sender.maintain();
        expect(maintained.status).toBe('refused');
        expect(h.broadcasts).toEqual([]);
        expect(checkIntent('pause', intent(), targets)).toBe(false);
        expect(checkIntent('price-super', intent({ value: 1n }), targets)).toBe(false);
        expect(checkIntent('price-super', intent({ chainId: 1 }), targets)).toBe(false);
        expect(checkIntent('price-super', intent({ gas: 500_001n }), targets)).toBe(false);
    });

    it('the gate expiring during the first-broadcast journal commit cannot broadcast', async () => {
        const h = harness();
        const raw = await signedRaw({ to: TO, data: UPDATE_PRICE_DATA, nonce: 7 });
        await h.journal.init();
        await h.journal.writeInFlight({
            kind: 'price-super', nonce: 7, raws: [raw], hashes: [keccak256(raw)],
            gasLimit: 120_000n, maxFeePerGas: 210n, maxPriorityFeePerGas: 10n, attempts: 0, firstSentAt: 1,
        });
        h.setNonce(7n, 8n);
        const original = h.journal.commit.bind(h.journal);
        let release: () => void = () => {};
        const held = new Promise<void>((resolve) => { release = resolve; });
        let waiting = false;
        h.journal.commit = (async (...args: Parameters<typeof h.journal.commit>) => {
            if (!waiting) {
                waiting = true;
                await held;
            }
            return original(...args);
        }) as typeof h.journal.commit;
        const pending = h.sender.maintain();
        const started = Date.now();
        while (!waiting && Date.now() - started < 2_000) await new Promise((resolve) => setTimeout(resolve, 5));
        expect(waiting).toBe(true);
        h.clock.now = 5_000;
        release();
        const settled = await pending;
        expect(settled.status).toBe('refused');
        expect(h.broadcasts).toEqual([]);
    });

    it('no price tx is signed while on-chain updatedAt is fresh', async () => {
        const h = harness({
            minUpdateIntervalSec: 3_600,
            priceStalenessThresholdSec: 7_200n,
            readUpdatedAt: async (to) => ({ to, updatedAtSec: BigInt(Math.floor(h.clock.now / 1000)) }),
        });
        h.clock.now = 10_000_000;
        h.sender.setGate({ price: true, pause: true, reason: '', validUntil: h.clock.now + 60_000 });
        const result = await h.sender.send(h.job());
        expect(result).toEqual({ status: 'refused', reason: 'sender: price cache refused' });
        expect(h.signed).toEqual([]);
        expect(h.broadcasts).toEqual([]);
        const again = await h.sender.send(h.job());
        expect(again).toEqual({ status: 'refused', reason: 'sender: price cache refused' });
        expect(h.alerts.filter((line) => line === 'sender: price cache refused')).toHaveLength(1);
        const wrong = harness({
            readUpdatedAt: async () => ({ to: OTHER, updatedAtSec: 0n }),
        });
        const mismatched = await wrong.sender.send(wrong.job());
        expect(mismatched).toEqual({ status: 'refused', reason: 'sender: price cache refused' });
        expect(wrong.signed).toEqual([]);
    });

    it('an unresolved PaymasterV4 signs nothing for price-paymaster', async () => {
        const h = harness({ paymaster: () => null });
        const result = await h.sender.send(h.job('price-paymaster', OTHER));
        expect(result.status).toBe('refused');
        expect(h.signed).toEqual([]);
        expect(h.broadcasts).toEqual([]);
        expect(h.alerts.some((a) => a.includes('unresolved'))).toBe(true);
    });

    it('maintenance rebroadcasts a disabled price-super raw and does not sign', async () => {
        const h = harness({ enabled: { 'price-super': false, 'price-paymaster': true } });
        const raw = await signedRaw({ to: TO, data: UPDATE_PRICE_DATA, nonce: 7 });
        await h.journal.init();
        await h.journal.writeInFlight({
            kind: 'price-super', nonce: 7, raws: [raw], hashes: [keccak256(raw)],
            gasLimit: 120_000n, maxFeePerGas: 210n, maxPriorityFeePerGas: 10n, attempts: 0, firstSentAt: 1,
        });
        h.setNonce(7n, 8n);
        h.chain.sendRawTransaction = async (rawTx) => {
            h.broadcasts.push(rawTx);
            return keccak256(rawTx);
        };
        const again = await h.sender.maintain();
        expect(again.status).toBe('pending');
        expect(h.signed).toEqual([]);
        expect(h.broadcasts).toEqual([raw]);
        expect(h.journal.inFlight()?.kind).toBe('price-super');
    });

    it('rebroadcasts a disabled price-paymaster raw above the current max gas and does not sign', async () => {
        const h = harness({ maxGas: 21_000n, enabled: { 'price-super': true, 'price-paymaster': false } });
        const raw = await signedRaw({ to: OTHER, data: UPDATE_PRICE_DATA, nonce: 7, gas: 120_000n });
        await h.journal.init();
        await h.journal.writeInFlight({
            kind: 'price-paymaster', nonce: 7, raws: [raw], hashes: [keccak256(raw)],
            gasLimit: 120_000n, maxFeePerGas: 210n, maxPriorityFeePerGas: 10n, attempts: 0, firstSentAt: 1,
        });
        h.setNonce(7n, 8n);
        h.chain.sendRawTransaction = async (rawTx) => {
            h.broadcasts.push(rawTx);
            return keccak256(rawTx);
        };
        const again = await h.sender.maintain();
        expect(again.status).toBe('pending');
        expect(h.signed).toEqual([]);
        expect(h.broadcasts).toEqual([]);
        expect(h.alerts).toContain('sender: above gas ceiling');
        expect(h.journal.inFlight()?.kind).toBe('price-paymaster');
        expect(h.journal.inFlight()?.nonce).toBe(7);
    });

    it('a nonce jump outside the keeper alerts once and sends continue', async () => {
        const h = harness();
        h.setNonce(7n, 9n);
        h.chain.sendRawTransaction = async (raw) => {
            h.broadcasts.push(raw);
            return keccak256(raw);
        };
        const result = await h.sender.send(h.job());
        expect(result.status).toBe('pending');
        expect(h.signed[0]?.nonce).toBe(9);
        expect(h.alerts.filter((a) => a === 'signer nonce moved outside this keeper')).toHaveLength(1);
        h.setNonce(10n, 12n);
        const again = await h.sender.send(h.job());
        expect(again.status === 'pending' || again.status === 'blocked').toBe(true);
        expect(h.alerts.filter((a) => a === 'signer nonce moved outside this keeper')).toHaveLength(1);
    });

    it('replay refuses a journal whose fees do not match the latest raw', async () => {
        const h = harness();
        const raw = await signedRaw({ to: TO, data: UPDATE_PRICE_DATA, nonce: 7, maxFee: 210n, tip: 10n });
        await h.journal.init();
        await h.journal.writeInFlight({
            kind: 'price-super', nonce: 7, raws: [raw], hashes: [keccak256(raw)],
            gasLimit: 120_000n, maxFeePerGas: 999n, maxPriorityFeePerGas: 10n, attempts: 0, firstSentAt: 1,
        });
        h.setNonce(7n, 8n);
        const settled = await h.sender.maintain();
        expect(settled.status).toBe('refused');
        expect(h.broadcasts).toEqual([]);
    });

    it('mutates the request while estimateGas is blocked; the signed copy stays', async () => {
        const h = harness();
        let release: () => void = () => {};
        const gate = new Promise<void>((resolve) => { release = resolve; });
        let blocked = false;
        h.chain.estimateGas = async () => {
            blocked = true;
            await gate;
            return 100_000n;
        };
        const req = h.job();
        const pending = h.sender.send(req);
        while (!blocked) await new Promise((resolve) => setTimeout(resolve, 5));
        req.to = OTHER;
        req.data = '0xdead' as Hex;
        release();
        const result = await pending;
        expect(result.status).toBe('pending');
        expect(h.signed[0]?.to).toBe(TO);
        expect(h.signed[0]?.data).toBe(UPDATE_PRICE_DATA);
        const disk = readFileSync(h.path, 'utf8').toLowerCase();
        expect(disk).toContain(UPDATE_PRICE_DATA.slice(2).toLowerCase());
        expect(disk).not.toContain(OTHER.slice(2).toLowerCase());
    });

    it('mutates the consumed receipt the chain returned; the snapshot stays', async () => {
        const h = harness();
        const raw = await signedRaw({ to: TO, data: UPDATE_PRICE_DATA, nonce: 7 });
        const hash = keccak256(raw);
        await h.journal.init();
        await h.journal.writeInFlight({
            kind: 'price-super', nonce: 7, raws: [raw], hashes: [hash],
            gasLimit: 120_000n, maxFeePerGas: 210n, maxPriorityFeePerGas: 10n, attempts: 0, firstSentAt: 1,
        });
        h.setNonce(8n, 8n);
        const planted: ChainReceipt = {
            status: 'success', gasUsed: 10n, blockHash: BLOCK, blockNumber: 1n, transactionHash: hash,
        };
        h.chain.getTransactionReceipt = async () => planted;
        const settled = await h.sender.maintain();
        expect(settled.status).toBe('consumed');
        expect(h.journal.inFlight()).toBeNull();
        await h.sender.flushReceipt();
        planted.gasUsed = 99n;
        planted.status = 'reverted';
        planted.transactionHash = ('0x' + '11'.repeat(32)) as Hex;
        const events = h.sender.drainSettlements();
        expect(events[0]?.receipt?.gasUsed).toBe(10n);
        expect(events[0]?.receipt?.status).toBe('success');
        expect(events[0]?.receipt?.transactionHash).toBe(hash);
        events[0]!.receipt!.gasUsed = 1n;
        expect(h.sender.drainSettlements()).toEqual([]);
    });

    it('writes the raw before broadcast and does not take a second nonce when broadcast throws', async () => {
        const h = harness();
        let onDisk = false;
        h.chain.sendRawTransaction = async (raw) => {
            onDisk = readFileSync(h.path, 'utf8').includes(raw);
            throw new Error('rpc rejected');
        };
        const result = await h.sender.send(h.job());
        expect(onDisk).toBe(true);
        expect(result).toEqual({ status: 'refused', reason: 'sender: broadcast failed' });
        expect(h.alerts).toContain('sender: broadcast failed');
        expect(h.journal.inFlight()?.raws[0]).toBeTruthy();
        const again = await h.sender.maintain();
        expect(again.status).toBe('refused');
        expect(h.signed).toHaveLength(1);
    });

    it('a receipt read failure does not close sends', async () => {
        const h = harness();
        const raw = await signedRaw({ to: TO, data: UPDATE_PRICE_DATA, nonce: 7 });
        await h.journal.init();
        await h.journal.writeInFlight({
            kind: 'price-super', nonce: 7, raws: [raw], hashes: [keccak256(raw)],
            gasLimit: 120_000n, maxFeePerGas: 210n, maxPriorityFeePerGas: 10n, attempts: 0, firstSentAt: 1,
        });
        h.setNonce(8n, 8n);
        h.throwReceipt(keccak256(raw));
        const settled = await h.sender.maintain();
        expect(settled.status).toBe('consumed');
        expect(h.journal.inFlight()).toBeNull();
        for (let i = 0; i < 3; i++) {
            h.sender.tick();
            await h.sender.flushReceipt();
        }
        expect(h.sender.drainSettlements()[0]?.outcome).toBe('unavailable');
        expect(h.alerts).toContain('nonce consumed, receipt unavailable');
        const next = await h.sender.send(h.job());
        expect(next.status).toBe('pending');
    });

    it('refuses a chain id mismatch without echoing the rpc value', async () => {
        const h = harness();
        h.setChainId(async () => 999);
        const result = await h.sender.send(h.job());
        expect(result.status).toBe('refused');
        expect(JSON.stringify(result)).not.toContain('999');
        expect(h.broadcasts).toEqual([]);
        expect(h.signed).toEqual([]);
        expect(h.journal.inFlight()).toBeNull();
    });

    it('validates config before any chain read', () => {
        const dir = mkdtempSync(join(tmpdir(), 'keeper-sender-cfg-'));
        dirs.push(dir);
        const chain: ChainIO = {
            async chainId() { throw new Error('called'); },
            async getTransactionCount() { return 0n; },
            async getBalance() { return 0n; },
            async estimateGas() { return 1n; },
            async fees() { return { baseFee: 1n, tip: 1n }; },
            async sendRawTransaction() { return '0x' as Hex; },
            async getTransactionReceipt() { return null; },
            async getBlockByNumber() { return null; },
            async getBlockByHash() { return null; },
            async call() { return '0x' as Hex; },
        };
        const journal = new Journal(join(dir, 'j.json'), { chainId: 1, signer: SIGNER });
        expect(() => new Sender({
            chain, signer: { async sign() { return '0x' as Hex; } }, journal, signerAddress: SIGNER, chainId: 1,
            superPaymaster: TO, paymaster: () => OTHER, maxFeeWei: 0n, alert: () => {},
        })).toThrow('sender: maxFeeWei invalid');
        expect(() => new Sender({
            chain, signer: { async sign() { return '0x' as Hex; } }, journal, signerAddress: SIGNER, chainId: 1,
            superPaymaster: TO, paymaster: () => OTHER, maxFeeWei: 1n, minUpdateIntervalSec: 0, alert: () => {},
        })).toThrow('sender: minUpdateIntervalSec invalid');
        expect(() => new Sender({
            chain, signer: { async sign() { return '0x' as Hex; } }, journal, signerAddress: SIGNER, chainId: 1,
            superPaymaster: TO, paymaster: () => OTHER, maxFeeWei: 1n, minUpdateIntervalSec: Number.NaN, alert: () => {},
        })).toThrow('sender: minUpdateIntervalSec invalid');
        expect(() => new Sender({
            chain, signer: { async sign() { return '0x' as Hex; } }, journal, signerAddress: SIGNER, chainId: 1,
            superPaymaster: TO, paymaster: () => OTHER, maxFeeWei: 1n, priceStalenessThresholdSec: 1n, alert: () => {},
        })).toThrow('sender: priceStalenessThresholdSec invalid');
        expect(() => new Sender({
            chain, signer: { async sign() { return '0x' as Hex; } }, journal, signerAddress: SIGNER, chainId: 1,
            superPaymaster: TO, paymaster: () => OTHER, maxFeeWei: 1n, alert: () => {},
            stallSec: Number.NaN,
        })).toThrow('sender: stallSec invalid');
        expect(() => new Sender({
            chain, signer: { async sign() { return '0x' as Hex; } }, journal, signerAddress: SIGNER, chainId: 1,
            superPaymaster: TO, paymaster: () => OTHER, maxFeeWei: 1n, alert: () => {},
            stallSec: -1,
        })).toThrow('sender: stallSec invalid');
        let called = false;
        chain.chainId = async () => { called = true; return 1; };
        expect(called).toBe(false);
    });
});

describe('checkIntent', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
    it('accepts only the two alpha price intents', () => {
        expect(checkIntent('price-super', intent(), targets)).toBe(true);
        expect(checkIntent('price-paymaster', intent({ to: OTHER }), targets)).toBe(true);
        expect(checkIntent('cancel', intent({ to: SIGNER, data: '0x', gas: 21_000n }), targets)).toBe(false);
        expect(checkIntent('price-paymaster', intent({ to: OTHER }), { ...targets, paymaster: null })).toBe(false);
        expect(checkIntent('price-super', intent(), { ...targets, superPaymaster: null })).toBe(false);
        expect(checkIntent('price-super', intent({ gas: 9_000_000n }), targets, { enforceMaxGas: false })).toBe(true);
    });

    it('signs at k * baseFee + tip and clamps to the ceiling', () => {
        const fees = signingFees({ baseFee: 200n, tip: 10n }, 1_000_000_000n, 2n);
        expect(fees).toEqual({ fee: FEE_BASE_MULTIPLIER * 200n + 2n, tip: 2n });
        const capped = signingFees({ baseFee: 100n, tip: 90n }, 120n, 80n);
        expect(capped).toEqual({ fee: 120n, tip: 80n });
    });
});

describe('sender alpha R4', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
    async function plant(h: ReturnType<typeof harness>, opts: { nonce: number; gas?: bigint; maxFee?: bigint; tip?: bigint; to?: Address; data?: Hex; kind?: InFlight['kind'] }) {
        const to = opts.to ?? TO;
        const data = opts.data ?? UPDATE_PRICE_DATA;
        const gas = opts.gas ?? 120_000n;
        const maxFee = opts.maxFee ?? 210n;
        const tip = opts.tip ?? 10n;
        const raw = await signedRaw({ to, data, nonce: opts.nonce, gas, maxFee, tip });
        if ((await h.journal.load()) === 'missing') await h.journal.init();
        await h.journal.writeInFlight({
            kind: opts.kind ?? 'price-super',
            nonce: opts.nonce,
            raws: [raw],
            hashes: [keccak256(raw)],
            gasLimit: gas,
            maxFeePerGas: maxFee,
            maxPriorityFeePerGas: tip,
            attempts: 0,
            firstSentAt: 1,
        });
        return raw;
    }

    it('refuses to sign a replacement when journal gasLimit disagrees with the raw', async () => {
        const h = harness({ maxGas: 500_000n });
        const raw = await signedRaw({ to: TO, data: UPDATE_PRICE_DATA, nonce: 7, gas: 120_000n });
        await h.journal.init();
        await h.journal.writeInFlight({
            kind: 'price-super', nonce: 7, raws: [raw], hashes: [keccak256(raw)],
            gasLimit: 600_000n, maxFeePerGas: 210n, maxPriorityFeePerGas: 10n, attempts: 0, firstSentAt: 1,
        });
        h.setNonce(7n, 8n);
        h.sender.tick();
        const settled = await h.sender.maintain();
        expect(settled.status).toBe('refused');
        expect(h.signed).toEqual([]);
        expect(h.broadcasts).toEqual([]);
    });

    it('no replacement or cancel is ever signed', async () => {
        const h = harness();
        h.sender.setGate({ price: true, pause: true, reason: '', validUntil: 1_000_000_000 });
        h.chain.sendRawTransaction = async (raw) => {
            h.broadcasts.push(raw);
            return keccak256(raw);
        };
        const first = await h.sender.send(h.job());
        expect(first.status).toBe('pending');
        expect(h.signed).toHaveLength(1);
        for (let i = 0; i < 6; i++) {
            h.setFees(BigInt(100 + i * 500), BigInt(10 + i));
            h.clock.now += 1_000;
            h.sender.tick();
            const again = await h.sender.maintain();
            expect(again.status).toBe('pending');
        }
        expect(h.signed).toHaveLength(1);
        expect(h.broadcasts.length).toBeGreaterThan(1);
        expect(new Set(h.broadcasts).size).toBe(1);
    });

    it('a done nonce is cleared before the receipt lookup, and a hanging receipt lookup does not delay the next send', async () => {
        const h = harness();
        const raw = await signedRaw({ to: TO, data: UPDATE_PRICE_DATA, nonce: 7 });
        await h.journal.init();
        await h.journal.writeInFlight({
            kind: 'price-super', nonce: 7, raws: [raw], hashes: [keccak256(raw)],
            gasLimit: 120_000n, maxFeePerGas: 210n, maxPriorityFeePerGas: 10n, attempts: 0, firstSentAt: 1,
        });
        let entered = false;
        let clearedFirst = false;
        let release: () => void = () => {};
        const gate = new Promise<void>((resolve) => { release = resolve; });
        h.chain.getTransactionReceipt = async () => {
            entered = true;
            clearedFirst = h.journal.inFlight() === null;
            await gate;
            return null;
        };
        h.setNonce(8n, 8n);
        const started = Date.now();
        const settled = await h.sender.maintain();
        expect(settled.status).toBe('consumed');
        expect(h.journal.inFlight()).toBeNull();
        h.chain.sendRawTransaction = async (rawTx) => {
            h.broadcasts.push(rawTx);
            return keccak256(rawTx);
        };
        const next = await h.sender.send(h.job());
        expect(Date.now() - started).toBeLessThan(1_000);
        expect(next.status).toBe('pending');
        expect(h.signed[0]?.nonce).toBe(8);
        const lookupWait = Date.now();
        while (!entered && Date.now() - lookupWait < 500) await new Promise((resolve) => setTimeout(resolve, 5));
        expect(entered).toBe(true);
        expect(clearedFirst).toBe(true);
        release();
    });

    it('a stalled in-flight closes all sends, names the staleness deadline, persists across restart, and --clear-stall only works once latest > nonce', async () => {
        const h = harness({
            stallSec: 600,
            readStaleness: async () => ({ updatedAtSec: 1_700_000_000n, thresholdSec: 4_200n }),
            manualStep: (nonce) => `cast send --nonce ${nonce} --keystore /tmp/ks --password-file /tmp/pw ${SIGNER} --value 0`,
        });
        await plant(h, { nonce: 7 });
        h.setNonce(7n, 8n);
        h.clock.now = 1 + 600_000;
        const stalled = await h.sender.maintain();
        expect(stalled).toEqual({ status: 'refused', reason: 'sender: stalled' });
        const alert = h.alerts.find((line) => line.includes('ALL sends closed'));
        expect(alert).toBeTruthy();
        expect(alert).toContain('in-flight nonce 7 not included after 600s');
        expect(alert).toContain('SuperPaymaster price goes stale at 2023-11-14T23:23:20.000Z');
        expect(alert).toMatch(/in \d+ min/);
        const disk = JSON.parse(readFileSync(h.path, 'utf8')) as { stalled?: boolean; inFlight: { nonce: number } };
        expect(disk.stalled).toBeUndefined();
        expect(disk.inFlight.nonce).toBe(7);
        expect(JSON.parse(readFileSync(markerFile(h.path), 'utf8'))).toMatchObject({ nonce: 7 });
        const restarted = h.reopen();
        const still = await restarted.send(h.job());
        expect(still).toEqual({ status: 'refused', reason: 'sender: stalled' });
        const early = await restarted.clearStall();
        expect(early.status).toBe('refused');
        expect(h.alerts.some((line) => line.includes('stall clear refused') && line.includes('cast send --nonce 7'))).toBe(true);
        expect(h.signed).toEqual([]);
        h.setNonce(8n, 8n);
        const cleared = await restarted.clearStall();
        expect(cleared.status).toBe('cleared');
        const after = await restarted.send(h.job());
        expect(after.status).toBe('pending');
    });

    it('a failed chain-id read before broadcast journals the raw and does not echo the rpc error', async () => {
        const h = harness();
        let failBroadcastChain = true;
        let reads = 0;
        h.chain.chainId = async () => {
            reads += 1;
            if (failBroadcastChain && reads >= 3) throw new Error('rpc path /tmp/secret');
            return CHAIN_ID;
        };
        h.chain.sendRawTransaction = async (raw) => {
            h.broadcasts.push(raw);
            return keccak256(raw);
        };
        const first = await h.sender.send(h.job());
        expect(first.status).toBe('refused');
        expect(h.broadcasts).toEqual([]);
        expect(JSON.stringify(first)).not.toContain('secret');
        const body = JSON.parse(readFileSync(h.path, 'utf8')) as { sentAt?: unknown; ceilingClosed?: unknown; inFlight: { raws: string[] } };
        expect(body.sentAt).toBeUndefined();
        expect(body.ceilingClosed).toBeUndefined();
        expect(body.inFlight.raws).toHaveLength(1);
        failBroadcastChain = false;
        const replayed = await h.sender.maintain();
        expect(replayed.status).toBe('pending');
        expect(h.broadcasts).toHaveLength(1);
    });

    it('rebroadcasts the same raw when the base fee rises', async () => {
        const h = harness();
        const raw = await plant(h, { nonce: 7, maxFee: 210n, tip: 10n });
        h.setNonce(7n, 8n);
        h.setFees(200n, 1n);
        h.chain.sendRawTransaction = async (rawTx) => {
            h.broadcasts.push(rawTx);
            return keccak256(rawTx);
        };
        h.sender.tick();
        await h.sender.maintain();
        expect(h.signed).toEqual([]);
        expect(h.broadcasts).toEqual([raw]);
    });

    it('does not rebroadcast above the current ceiling and does not journal a cancel that cannot outbid', async () => {
        const above = harness({ maxFeeWei: 100n });
        await plant(above, { nonce: 7, maxFee: 210n, tip: 10n });
        above.setNonce(7n, 8n);
        above.chain.sendRawTransaction = async (raw) => {
            above.broadcasts.push(raw);
            return keccak256(raw);
        };
        const held = await above.sender.maintain();
        expect(held.status).toBe('pending');
        expect(above.broadcasts).toEqual([]);
        expect(above.alerts).toContain('sender: above fee ceiling');
        expect(above.journal.inFlight()?.kind).toBe('price-super');
        expect(above.signed).toEqual([]);

        const stuck = harness({
            maxFeeWei: 210n,
            enabled: { 'price-super': false, 'price-paymaster': true },
        });
        await plant(stuck, { nonce: 4, maxFee: 210n, tip: 10n });
        stuck.setNonce(4n, 5n);
        stuck.setFees(1n, 1n);
        stuck.chain.sendRawTransaction = async (raw) => {
            stuck.broadcasts.push(raw);
            return keccak256(raw);
        };
        const kept = await stuck.sender.maintain();
        expect(kept.status).toBe('pending');
        expect(stuck.journal.inFlight()?.kind).toBe('price-super');
        expect(stuck.signed).toEqual([]);
        expect(stuck.broadcasts).toEqual([stuck.journal.inFlight()!.raws[0]]);
    });

    it('keeps servicing a later nonce while an earlier receipt stays unreadable', async () => {
        const h = harness();
        const raw7 = await plant(h, { nonce: 7 });
        h.setNonce(8n, 8n);
        h.throwReceipt(keccak256(raw7));
        const first = await h.sender.maintain();
        expect(first.status).toBe('consumed');
        await h.sender.flushReceipt();
        expect(h.journal.inFlight()).toBeNull();
        const raw8 = await signedRaw({ to: TO, data: UPDATE_PRICE_DATA, nonce: 8 });
        await h.journal.writeInFlight({
            kind: 'price-super', nonce: 8, raws: [raw8], hashes: [keccak256(raw8)],
            gasLimit: 120_000n, maxFeePerGas: 210n, maxPriorityFeePerGas: 10n, attempts: 0, firstSentAt: 1,
        });
        h.setNonce(8n, 9n);
        h.chain.sendRawTransaction = async (raw) => {
            h.broadcasts.push(raw);
            return keccak256(raw);
        };
        const serviced = await h.sender.maintain();
        expect(serviced.status).toBe('pending');
        expect(h.broadcasts).toHaveLength(1);
        h.setNonce(9n, 9n);
        h.throwReceipt(keccak256(raw8));
        const consumed = await h.sender.maintain();
        expect(consumed.status).toBe('consumed');
        const next = await h.sender.send(h.job());
        expect(next.status).toBe('pending');
        expect(h.signed[h.signed.length - 1]?.nonce).toBe(9);
    });

    it('does not clear or re-sign when a lower nonce is empty', async () => {
        const foreign = harness();
        foreign.setNonce(7n, 8n);
        foreign.chain.sendRawTransaction = async (raw) => {
            foreign.broadcasts.push(raw);
            return keccak256(raw);
        };
        const signed8 = await foreign.sender.send(foreign.job());
        expect(signed8.status).toBe('pending');
        expect(foreign.signed[0]?.nonce).toBe(8);
        foreign.setNonce(7n, 7n);
        await foreign.sender.maintain();
        await foreign.sender.maintain();
        expect(foreign.journal.inFlight()?.nonce).toBe(8);
        expect(foreign.signed).toHaveLength(1);
        expect(foreign.alerts.some((line) => line.includes('re-signing'))).toBe(false);
    });

    it('discards a raw when the gate closes during signing', async () => {
        const h = harness();
        const held = h.holdSign();
        const pending = h.sender.send(h.job());
        while (!held.entered()) await new Promise((resolve) => setTimeout(resolve, 5));
        h.sender.setGate({ price: false, pause: false, reason: 'closed', validUntil: 5_000 });
        held.release();
        const result = await pending;
        expect(result).toEqual({ status: 'refused', reason: 'sender: gate closed' });
        expect(h.signed).toHaveLength(1);
        expect(h.broadcasts).toEqual([]);
        expect(h.journal.inFlight()).toBeNull();
    });

    it('does not sign a new, replacement, or cancel intent while the gate is closed or expired', async () => {
        const closed = harness();
        closed.sender.setGate({ price: false, pause: true, reason: 'closed', validUntil: 5_000 });
        expect((await closed.sender.send(closed.job())).status).toBe('refused');
        expect(closed.signed).toEqual([]);

        const expired = harness();
        expired.sender.setGate({ price: true, pause: true, reason: '', validUntil: 1 });
        expect((await expired.sender.send(expired.job())).status).toBe('refused');
        await plant(expired, { nonce: 7 });
        expired.setNonce(7n, 8n);
        expired.sender.tick();
        await expired.sender.maintain();
        expect(expired.signed).toEqual([]);
        expect(expired.broadcasts).toEqual([]);

        const cancel = harness({ enabled: { 'price-super': false, 'price-paymaster': true } });
        cancel.sender.setGate({ price: false, pause: true, reason: 'closed', validUntil: 5_000 });
        await plant(cancel, { nonce: 3 });
        cancel.setNonce(3n, 4n);
        await cancel.sender.maintain();
        expect(cancel.signed).toEqual([]);
        expect(cancel.broadcasts).toEqual([]);
    });

    it('alerts when latest advances by one with nothing in flight, including after a restart', async () => {
        const h = harness();
        await h.journal.init();
        h.setNonce(7n, 7n);
        const first = await h.sender.maintain();
        expect(first.status).toBe('idle');
        expect(h.alerts).toEqual([]);
        const baseline = JSON.parse(readFileSync(h.path, 'utf8')) as { lastLatest: string };
        expect(baseline.lastLatest).toBe('7');
        h.setNonce(8n, 8n);
        await h.sender.maintain();
        expect(h.alerts.filter((a) => a === 'signer nonce moved outside this keeper')).toHaveLength(1);
        const next = h.reopen();
        h.setNonce(9n, 9n);
        await next.maintain();
        expect(h.alerts.filter((a) => a === 'signer nonce moved outside this keeper')).toHaveLength(2);
    });

    it('does not broadcast a journal whose directory barrier has not succeeded', async () => {
        const h = harness();
        await plant(h, { nonce: 7 });
        h.setNonce(7n, 8n);
        const { setDurabilityHooks } = await import('./journal.js');
        setDurabilityHooks({
            async write() { throw new Error('unused'); },
            async fsyncFile() { throw new Error('unused'); },
            async rename() { throw new Error('unused'); },
            async link() { throw new Error('unused'); },
            async fsyncDir() { throw new Error('injected'); },
        });
        try {
            const settled = await h.sender.maintain();
            expect(settled.status).toBe('refused');
            expect(settled.reason).toBe('sender: journal barrier incomplete');
            expect(h.broadcasts).toEqual([]);
        } finally {
            setDurabilityHooks(null);
        }
    });

    it('pending nonce failure still closes sends and alerts when the stall window has elapsed', async () => {
        const h = harness({ stallSec: 600 });
        await plant(h, { nonce: 7 });
        h.clock.now = 1 + 600_000;
        h.chain.getTransactionCount = async (_addr, tag) => {
            if (tag === 'pending') throw new Error('pending-nonce-sentinel');
            return 7n;
        };
        const stalled = await h.sender.maintain();
        expect(stalled).toEqual({ status: 'refused', reason: 'sender: stalled' });
        expect(h.alerts.some((line) => line.includes('ALL sends closed'))).toBe(true);
        expect(h.alerts.join('\n')).not.toContain('pending-nonce-sentinel');
        const disk = JSON.parse(readFileSync(h.path, 'utf8')) as { stalled?: boolean; inFlight: { nonce: number } | null };
        expect(disk.stalled).toBeUndefined();
        expect(disk.inFlight?.nonce).toBe(7);
        expect(JSON.parse(readFileSync(markerFile(h.path), 'utf8')).nonce).toBe(7);
        const again = await h.sender.send(h.job());
        expect(again).toEqual({ status: 'refused', reason: 'sender: stalled' });
        expect(h.signed).toEqual([]);
    });

    it('a failed stall commit still closes sends and alerts', async () => {
        const h = harness({ stallSec: 600 });
        await plant(h, { nonce: 7 });
        h.setNonce(7n, 8n);
        h.clock.now = 1 + 600_000;
        const before = readFileSync(h.path, 'utf8');
        const originalCommit = h.journal.commit.bind(h.journal);
        let failCommit = true;
        h.journal.commit = ((...args: Parameters<typeof h.journal.commit>) => {
            if (failCommit) return Promise.reject(new Error('journal-commit-sentinel'));
            return originalCommit(...args);
        }) as typeof h.journal.commit;
        const stalled = await h.sender.maintain();
        expect(stalled).toEqual({ status: 'refused', reason: 'sender: stalled' });
        expect(h.alerts.some((line) => line.includes('ALL sends closed'))).toBe(true);
        expect(h.alerts.join('\n')).not.toContain('journal-commit-sentinel');
        expect(readFileSync(h.path, 'utf8')).toBe(before);
        // Journal writes work again, and the flight is inside the stall window.
        // Only the in-memory latch may keep the next send closed.
        failCommit = false;
        h.clock.now = 1_000;
        const again = await h.sender.send(h.job());
        expect(again).toEqual({ status: 'refused', reason: 'sender: stalled' });
        expect(h.signed).toEqual([]);
    });

    it('a mined stalled nonce stays closed until --clear-stall', async () => {
        const h = harness({ stallSec: 600 });
        await plant(h, { nonce: 7 });
        h.setNonce(7n, 8n);
        h.clock.now = 1 + 600_000;
        expect((await h.sender.maintain()).status).toBe('refused');
        h.setNonce(8n, 8n);
        const mined = await h.sender.maintain();
        expect(mined).toEqual({ status: 'refused', reason: 'sender: stalled' });
        expect(h.journal.inFlight()).toBeNull();
        const disk = JSON.parse(readFileSync(h.path, 'utf8')) as { stalled?: boolean };
        expect(disk.stalled).toBeUndefined();
        expect(JSON.parse(readFileSync(markerFile(h.path), 'utf8')).nonce).toBe(7);
        const before = h.alerts.length;
        const restarted = h.reopen();
        expect(await restarted.send(h.job())).toEqual({ status: 'refused', reason: 'sender: stalled' });
        expect(h.alerts.slice(before).some((line) => line.includes('ALL sends closed'))).toBe(true);
        const cleared = await restarted.clearStall();
        expect(cleared.status).toBe('cleared');
        expect((await restarted.send(h.job())).status).toBe('pending');
    });

    it('a failed updatedAt read signs nothing', async () => {
        const thrown = harness({
            readUpdatedAt: async () => { throw new Error('rpc secret /tmp/keystore'); },
        });
        const refused = await thrown.sender.send(thrown.job());
        expect(refused).toEqual({ status: 'refused', reason: 'sender: price cache refused' });
        expect(thrown.signed).toEqual([]);
        expect(thrown.broadcasts).toEqual([]);
        expect(JSON.stringify(refused) + thrown.alerts.join('\n')).not.toContain('keystore');
        const again = await thrown.sender.send(thrown.job());
        expect(again).toEqual({ status: 'refused', reason: 'sender: price cache refused' });
        expect(thrown.alerts.filter((line) => line === 'sender: price cache refused')).toHaveLength(1);

        const malformed = harness({
            readUpdatedAt: async () => 'unreadable',
        });
        expect(await malformed.sender.send(malformed.job())).toEqual({ status: 'refused', reason: 'sender: price cache refused' });
        expect(malformed.signed).toEqual([]);
    });

    it('two consumed nonces each settle, including when lookups overlap', async () => {
        const straight = harness();
        straight.chain.getTransactionReceipt = async (hash) => ({
            status: 'success', gasUsed: 10n, blockHash: BLOCK, blockNumber: 1n, transactionHash: hash,
        });
        const firstRaw = await plant(straight, { nonce: 7 });
        const secondRaw = await signedRaw({ to: TO, data: UPDATE_PRICE_DATA, nonce: 8 });
        straight.setNonce(8n, 8n);
        expect((await straight.sender.maintain()).status).toBe('consumed');
        straight.sender.tick();
        await straight.sender.flushReceipt();
        await straight.journal.writeInFlight({
            kind: 'price-super', nonce: 8, raws: [secondRaw], hashes: [keccak256(secondRaw)],
            gasLimit: 120_000n, maxFeePerGas: 210n, maxPriorityFeePerGas: 10n, attempts: 0, firstSentAt: 1,
        });
        straight.setNonce(9n, 9n);
        expect((await straight.sender.maintain()).status).toBe('consumed');
        straight.sender.tick();
        await straight.sender.flushReceipt();
        const straightEvents = straight.sender.drainSettlements();
        expect(straightEvents.map((ev) => ev.nonce)).toEqual([7, 8]);
        expect(straightEvents.every((ev) => ev.outcome === 'receipt')).toBe(true);
        expect(keccak256(firstRaw)).toBe(straightEvents[0]?.hash);

        const h = harness();
        const raw7 = await plant(h, { nonce: 7 });
        const hash7 = keccak256(raw7);
        let release: () => void = () => {};
        let entered = false;
        const gate = new Promise<void>((resolve) => { release = resolve; });
        h.chain.getTransactionReceipt = async (hash) => {
            if (hash.toLowerCase() === hash7.toLowerCase()) {
                entered = true;
                await gate;
                return { status: 'success', gasUsed: 10n, blockHash: BLOCK, blockNumber: 1n, transactionHash: hash7 };
            }
            return { status: 'reverted', gasUsed: 11n, blockHash: BLOCK, blockNumber: 2n, transactionHash: hash };
        };
        h.setNonce(8n, 8n);
        expect((await h.sender.maintain()).status).toBe('consumed');
        const wait = Date.now();
        while (!entered && Date.now() - wait < 1_000) await new Promise((resolve) => setTimeout(resolve, 5));
        expect(entered).toBe(true);
        const raw8 = await signedRaw({ to: TO, data: UPDATE_PRICE_DATA, nonce: 8 });
        const hash8 = keccak256(raw8);
        await h.journal.writeInFlight({
            kind: 'price-super', nonce: 8, raws: [raw8], hashes: [hash8],
            gasLimit: 120_000n, maxFeePerGas: 210n, maxPriorityFeePerGas: 10n, attempts: 0, firstSentAt: 1,
        });
        h.setNonce(9n, 9n);
        expect((await h.sender.maintain()).status).toBe('consumed');
        const started = Date.now();
        const next = await h.sender.send(h.job());
        expect(Date.now() - started).toBeLessThan(1_000);
        expect(next.status).toBe('pending');
        release();
        h.sender.tick();
        await h.sender.flushReceipt();
        h.sender.tick();
        await h.sender.flushReceipt();
        const events = h.sender.drainSettlements();
        expect(events.map((ev) => ev.nonce).sort()).toEqual([7, 8]);
        expect(events.find((ev) => ev.nonce === 7)?.outcome).toBe('receipt');
        expect(events.find((ev) => ev.nonce === 8)?.outcome).toBe('reverted');
    });

    it('clear-stall refuses a mismatched or unreadable chain id and keeps the journal', async () => {
        const mismatched = harness({ stallSec: 600 });
        await plant(mismatched, { nonce: 7 });
        mismatched.setNonce(7n, 8n);
        mismatched.clock.now = 1 + 600_000;
        await mismatched.sender.maintain();
        const before = readFileSync(mismatched.path, 'utf8');
        mismatched.setChainId(async () => 999);
        const refused = await mismatched.sender.clearStall();
        expect(refused).toEqual({ status: 'refused', reason: 'sender: chain id mismatch' });
        expect(JSON.stringify(refused)).not.toContain('999');
        expect(readFileSync(mismatched.path, 'utf8')).toBe(before);

        const unread = harness({ stallSec: 600 });
        await plant(unread, { nonce: 7 });
        unread.setNonce(7n, 8n);
        unread.clock.now = 1 + 600_000;
        await unread.sender.maintain();
        const kept = readFileSync(unread.path, 'utf8');
        unread.setChainId(async () => { throw new Error('chain-id-sentinel'); });
        const blocked = await unread.sender.clearStall();
        expect(blocked).toEqual({ status: 'refused', reason: 'sender: chain id unreadable' });
        expect(JSON.stringify(blocked) + unread.alerts.join('\n')).not.toContain('chain-id-sentinel');
        expect(readFileSync(unread.path, 'utf8')).toBe(kept);
    });

    it('post-sign chain mismatch journals nothing', async () => {
        const h = harness();
        h.chain.chainId = async () => (h.signed.length > 0 ? 999 : CHAIN_ID);
        const result = await h.sender.send(h.job());
        expect(result).toEqual({ status: 'refused', reason: 'sender: chain id mismatch' });
        expect(JSON.stringify(result)).not.toContain('999');
        expect(h.signed).toHaveLength(1);
        expect(h.broadcasts).toEqual([]);
        expect(h.journal.inFlight()).toBeNull();
    });

    it('manual stall command names the chain, the env-file RPC, and a 125% fee', async () => {
        expect(bumpedFee(210n)).toBe(263n);
        expect(bumpedFee(10n)).toBe(13n);
        expect(manualStallCommand({
            chainId: CHAIN_ID, nonce: 7, maxFeePerGas: 210n, maxPriorityFeePerGas: 10n,
            keystorePath: '<path>', passwordFilePath: '<path>', signer: SIGNER,
        })).toContain('--rpc-url "$RPC_URL"');
        const h = harness({ stallSec: 600 });
        await plant(h, { nonce: 7, maxFee: 210n, tip: 10n });
        h.setNonce(7n, 8n);
        h.clock.now = 1 + 600_000;
        await h.sender.maintain();
        const early = await h.sender.clearStall();
        expect(early.status).toBe('refused');
        const line = h.alerts.find((item) => item.includes('stall clear refused')) ?? '';
        expect(line).toContain(`--chain ${CHAIN_ID}`);
        expect(line).toContain('--rpc-url "$RPC_URL"');
        expect(line).toContain('--nonce 7');
        expect(line).toContain('--gas-price 263');
        expect(line).toContain('--priority-gas-price 13');
        expect(line).not.toMatch(/https?:/);
    });

    it('shell-quotes keystore and password paths that contain spaces and apostrophes', () => {
        const keystorePath = "/tmp/keeper's keys/store";
        const passwordFilePath = '/tmp/my pw/password';
        const line = manualStallCommand({
            chainId: CHAIN_ID, nonce: 7, maxFeePerGas: 210n, maxPriorityFeePerGas: 10n,
            keystorePath, passwordFilePath, signer: SIGNER,
        });
        expect(line).toContain(`--keystore '/tmp/keeper'"'"'s keys/store'`);
        expect(line).toContain("--password-file '/tmp/my pw/password'");
        expect(line).toContain(`'${SIGNER}'`);
        expect(line).toContain('--rpc-url "$RPC_URL"');
        expect(line).not.toContain('--keystore /tmp/keeper');
    });

    it('an overdue flight whose nonce is already mined is settled without a new stall latch', async () => {
        const h = harness({ stallSec: 600 });
        await plant(h, { nonce: 7 });
        h.setNonce(8n, 8n);
        h.clock.now = 1 + 600_000;
        const settled = await h.sender.maintain();
        expect(settled.status).toBe('consumed');
        expect(h.journal.inFlight()).toBeNull();
        const disk = JSON.parse(readFileSync(h.path, 'utf8')) as { stalled?: boolean };
        expect(disk.stalled).toBeUndefined();
        expect(existsSync(markerFile(h.path))).toBe(false);
        expect(h.alerts.some((line) => line.includes('ALL sends closed'))).toBe(false);
    });

    it('pending failure still settles and still clears a stall when latest is already past the nonce', async () => {
        const fresh = harness({ stallSec: 600 });
        await plant(fresh, { nonce: 7 });
        fresh.chain.getTransactionCount = async (_addr, tag) => {
            if (tag === 'pending') throw new Error('pending-nonce-sentinel');
            return 8n;
        };
        const beforeDeadline = await fresh.sender.maintain();
        expect(beforeDeadline.status).toBe('consumed');
        expect(fresh.alerts.join('\n')).not.toContain('pending-nonce-sentinel');

        const settle = harness({ stallSec: 600 });
        await plant(settle, { nonce: 7 });
        settle.clock.now = 1 + 600_000;
        settle.chain.getTransactionCount = async (_addr, tag) => {
            if (tag === 'pending') throw new Error('pending-nonce-sentinel');
            return 8n;
        };
        const consumed = await settle.sender.maintain();
        expect(consumed.status).toBe('consumed');
        expect(settle.alerts.join('\n')).not.toContain('pending-nonce-sentinel');
        expect(settle.alerts.some((line) => line.includes('ALL sends closed'))).toBe(false);

        const clear = harness({ stallSec: 600 });
        await plant(clear, { nonce: 7 });
        clear.setNonce(7n, 8n);
        clear.clock.now = 1 + 600_000;
        expect((await clear.sender.maintain()).status).toBe('refused');
        clear.chain.getTransactionCount = async (_addr, tag) => {
            if (tag === 'pending') throw new Error('pending-nonce-sentinel');
            return 8n;
        };
        const cleared = await clear.sender.clearStall();
        expect(cleared.status).toBe('cleared');
        expect(clear.alerts.join('\n')).not.toContain('pending-nonce-sentinel');
    });

    it('a huge staleness threshold still alerts and persists the stall latch', async () => {
        const h = harness({
            stallSec: 600,
            readStaleness: async () => ({ updatedAtSec: 0n, thresholdSec: 8_640_000_000_001n }),
        });
        await plant(h, { nonce: 7 });
        h.setNonce(7n, 8n);
        h.clock.now = 1 + 600_000;
        const stalled = await h.sender.maintain();
        expect(stalled).toEqual({ status: 'refused', reason: 'sender: stalled' });
        const alert = h.alerts.find((line) => line.includes('ALL sends closed')) ?? '';
        expect(alert).toContain('staleness unreadable');
        const disk = JSON.parse(readFileSync(h.path, 'utf8')) as { stalled?: boolean };
        expect(disk.stalled).toBeUndefined();
        expect(JSON.parse(readFileSync(markerFile(h.path), 'utf8')).nonce).toBe(7);
    });

    it('the stall watchdog alerts while the journal barrier is failing and maintain is not called again', async () => {
        const h = harness({ stallSec: 1, now: () => Date.now() });
        h.sender.setGate({ price: true, pause: true, reason: '', validUntil: Date.now() + 60_000 });
        h.chain.sendRawTransaction = async (raw) => {
            h.broadcasts.push(raw);
            return keccak256(raw);
        };
        const sent = await h.sender.send(h.job());
        expect(sent.status).toBe('pending');
        const { setDurabilityHooks } = await import('./journal.js');
        setDurabilityHooks({
            async write() { throw new Error('unused'); },
            async fsyncFile() { throw new Error('unused'); },
            async rename() { throw new Error('unused'); },
            async link() { throw new Error('unused'); },
            async fsyncDir() { throw new Error('barrier-sentinel'); },
        });
        try {
            const deadline = Date.now() + 3_000;
            while (Date.now() < deadline && !h.alerts.some((line) => line.includes('ALL sends closed'))) {
                await new Promise((resolve) => setTimeout(resolve, 50));
            }
            expect(h.alerts.some((line) => line.includes('ALL sends closed'))).toBe(true);
            expect(h.alerts.join('\n')).not.toContain('barrier-sentinel');
            expect(h.broadcasts).toHaveLength(1);
            setDurabilityHooks(null);
            const again = await h.sender.send(h.job());
            expect(again).toEqual({ status: 'refused', reason: 'sender: stalled' });
        } finally {
            setDurabilityHooks(null);
            h.sender.stop();
        }
    });

    it('a blocked journal write across the stall deadline latches and refuses the resumed broadcast', async () => {
        const h = harness({ stallSec: 1, now: () => Date.now() });
        h.sender.setGate({ price: true, pause: true, reason: '', validUntil: Date.now() + 60_000 });
        let release!: () => void;
        const gate = new Promise<void>((resolve) => { release = resolve; });
        const { setDurabilityHooks } = await import('./journal.js');
        const real = await import('node:fs/promises');
        setDurabilityHooks({
            async write(fh, body) {
                if (body.includes('"raws"')) await gate;
                await fh.writeFile(body, 'utf8');
            },
            async fsyncFile(fh) { await fh.sync(); },
            async rename(from, to) { await real.rename(from, to); },
            async link(from, to) { await real.link(from, to); },
            async fsyncDir(dirPath) {
                const dh = await real.open(dirPath, 'r');
                try { await dh.sync(); } finally { await dh.close(); }
            },
        });
        try {
            const pending = h.sender.send(h.job());
            const deadline = Date.now() + 3_000;
            while (Date.now() < deadline && !h.alerts.some((line) => line.includes('price-staleness deadline: check on chain'))) {
                await new Promise((resolve) => setTimeout(resolve, 20));
            }
            expect(h.alerts.some((line) => line.includes('ALL sends closed') && line.includes('price-staleness deadline: check on chain'))).toBe(true);
            expect(h.broadcasts).toEqual([]);
            release();
            const result = await pending;
            expect(result.status).toBe('refused');
            expect(h.broadcasts).toEqual([]);
        } finally {
            release();
            setDurabilityHooks(null);
            h.sender.stop();
        }
    });

    it('a hanging chain read across the stall deadline refuses the broadcast', async () => {
        const h = harness({ stallSec: 1, now: () => Date.now() });
        h.sender.setGate({ price: true, pause: true, reason: '', validUntil: Date.now() + 60_000 });
        let reads = 0;
        let release!: () => void;
        const gate = new Promise<void>((resolve) => { release = resolve; });
        h.chain.chainId = async () => {
            reads += 1;
            if (reads >= 3) await gate;
            return CHAIN_ID;
        };
        h.chain.sendRawTransaction = async (raw) => {
            h.broadcasts.push(raw);
            return keccak256(raw);
        };
        try {
            const pending = h.sender.send(h.job());
            const started = Date.now();
            while (reads < 3 && Date.now() - started < 2_000) await new Promise((resolve) => setTimeout(resolve, 10));
            expect(reads).toBeGreaterThanOrEqual(3);
            const deadline = Date.now() + 3_000;
            while (Date.now() < deadline && !h.alerts.some((line) => line.includes('price-staleness deadline: check on chain'))) {
                await new Promise((resolve) => setTimeout(resolve, 20));
            }
            expect(h.broadcasts).toEqual([]);
            expect(h.alerts.some((line) => line.includes('ALL sends closed'))).toBe(true);
            release();
            const result = await pending;
            expect(result.status).toBe('refused');
            expect(h.broadcasts).toEqual([]);
        } finally {
            release();
            h.sender.stop();
        }
    });

    it('a chain id that changes after the first-broadcast commit is not broadcast', async () => {
        const h = harness();
        let reads = 0;
        h.chain.chainId = async () => {
            reads += 1;
            return reads >= 3 ? 999 : CHAIN_ID;
        };
        h.chain.sendRawTransaction = async (raw) => {
            h.broadcasts.push(raw);
            return keccak256(raw);
        };
        const result = await h.sender.send(h.job());
        expect(result).toEqual({ status: 'refused', reason: 'sender: chain id mismatch' });
        expect(JSON.stringify(result)).not.toContain('999');
        expect(h.broadcasts).toEqual([]);
        const body = JSON.parse(readFileSync(h.path, 'utf8')) as { sentAt?: unknown; inFlight: { raws: string[]; broadcastOnce?: unknown } };
        expect(body.sentAt).toBeUndefined();
        expect(body.inFlight.broadcastOnce).toBeUndefined();
        expect(body.inFlight.raws).toHaveLength(1);
    });

    it('armFlight alerts an overdue flight at startup even when load returns barrier', async () => {
        const h = harness({ stallSec: 600 });
        await plant(h, { nonce: 7 });
        const { Journal, setDurabilityHooks } = await import('./journal.js');
        const real = await import('node:fs/promises');
        setDurabilityHooks({
            async write(fh, body) { await fh.writeFile(body, 'utf8'); },
            async fsyncFile(fh) { await fh.sync(); },
            async rename(from, to) { await real.rename(from, to); },
            async link(from, to) { await real.link(from, to); },
            async fsyncDir() { throw new Error('barrier-sentinel'); },
        });
        try {
            const journal = new Journal(h.path, { chainId: CHAIN_ID, signer: SIGNER });
            expect(await journal.load()).toBe('barrier');
            const alarm = journal.alarmFlight();
            expect(alarm?.nonce).toBe(7);
            h.clock.now = 1 + 600_000;
            h.sender.armFlight(alarm);
            expect(h.alerts.some((line) => line.includes('ALL sends closed'))).toBe(true);
            expect(h.alerts.join('\n')).not.toContain('barrier-sentinel');
            setDurabilityHooks(null);
            const again = await h.sender.send(h.job());
            expect(again).toEqual({ status: 'refused', reason: 'sender: stalled' });
        } finally {
            setDurabilityHooks(null);
            h.sender.stop();
        }
    });

    it('the watchdog fires during a consumption commit, the follow-up fails, process restarts → still latched', async () => {
        const h = harness({ stallSec: 1, now: () => Date.now() });
        h.sender.setGate({ price: true, pause: true, reason: '', validUntil: Date.now() + 60_000 });
        let arm = false;
        let failDir = false;
        let release!: () => void;
        const gate = new Promise<void>((resolve) => { release = resolve; });
        const { setDurabilityHooks } = await import('./journal.js');
        const real = await import('node:fs/promises');
        setDurabilityHooks({
            async write(fh, body) {
                if (arm && body.includes('"inFlight":null')) {
                    arm = false;
                    await gate;
                }
                await fh.writeFile(body, 'utf8');
            },
            async fsyncFile(fh) { await fh.sync(); },
            async rename(from, to) { await real.rename(from, to); },
            async link(from, to) { await real.link(from, to); },
            async fsyncDir(dirPath) {
                if (failDir) throw new Error('follow-up-sentinel');
                const dh = await real.open(dirPath, 'r');
                try { await dh.sync(); } finally { await dh.close(); }
            },
        });
        try {
            const sent = await h.sender.send(h.job());
            expect(sent.status).toBe('pending');
            h.setNonce(8n, 8n);
            arm = true;
            const pending = h.sender.maintain();
            const marker = markerFile(h.path);
            const deadline = Date.now() + 4_000;
            while (Date.now() < deadline && !existsSync(marker)) {
                await new Promise((resolve) => setTimeout(resolve, 20));
            }
            expect(existsSync(marker)).toBe(true);
            const kept = readFileSync(marker, 'utf8');
            failDir = true;
            release();
            await pending;
            expect(readFileSync(marker, 'utf8')).toBe(kept);
            expect(readFileSync(h.path, 'utf8')).not.toContain('"stalled"');
            setDurabilityHooks(null);
            const restarted = h.reopen();
            restarted.setGate({ price: true, pause: true, reason: '', validUntil: Date.now() + 60_000 });
            const still = await restarted.send(h.job());
            expect(still).toEqual({ status: 'refused', reason: 'sender: stalled' });
            expect(readFileSync(marker, 'utf8')).toBe(kept);
            expect(h.signed).toHaveLength(1);
        } finally {
            release();
            setDurabilityHooks(null);
            h.sender.stop();
        }
    });

    it('only --clear-stall removes the marker', async () => {
        const h = harness({ stallSec: 600 });
        await plant(h, { nonce: 7 });
        h.setNonce(7n, 8n);
        h.clock.now = 1 + 600_000;
        expect((await h.sender.maintain()).status).toBe('refused');
        const marker = markerFile(h.path);
        const kept = readFileSync(marker, 'utf8');
        expect(JSON.parse(kept).nonce).toBe(7);
        expect((await h.sender.send(h.job())).status).toBe('refused');
        expect(readFileSync(marker, 'utf8')).toBe(kept);
        const restarted = h.reopen();
        expect((await restarted.send(h.job())).status).toBe('refused');
        expect(readFileSync(marker, 'utf8')).toBe(kept);
        h.setNonce(8n, 8n);
        expect((await restarted.clearStall()).status).toBe('cleared');
        expect(existsSync(marker)).toBe(false);
        expect((await restarted.send(h.job())).status).toBe('pending');
    });

    it('an unreadable marker latches', async () => {
        const h = harness();
        await h.journal.init();
        const marker = markerFile(h.path);
        writeFileSync(marker, '{not-json');
        chmodSync(marker, 0o600);
        const bad = h.reopen();
        expect(await bad.send(h.job())).toEqual({ status: 'refused', reason: 'sender: stalled' });
        expect(h.signed).toEqual([]);
        expect((await bad.clearStall()).status).toBe('refused');
        expect(existsSync(marker)).toBe(true);

        const loose = harness();
        await loose.journal.init();
        const looseMarker = markerFile(loose.path);
        writeFileSync(looseMarker, JSON.stringify({ nonce: 1, firstSentAt: 0 }));
        chmodSync(looseMarker, 0o644);
        const opened = loose.reopen();
        expect(await opened.send(loose.job())).toEqual({ status: 'refused', reason: 'sender: stalled' });
        expect(loose.signed).toEqual([]);
    });

    it('10 rapid restarts produce at most one price tx per min-update-interval', async () => {
        let updatedAt = 0n;
        let nonce = 7n;
        const h = harness({
            minUpdateIntervalSec: 3_600,
            priceStalenessThresholdSec: 7_200n,
            stallSec: 86_400,
            readUpdatedAt: async (to) => ({ to, updatedAtSec: updatedAt }),
        });
        h.clock.now = 4_000_000_000_000;
        h.sender.setGate({ price: true, pause: true, reason: '', validUntil: h.clock.now + 60_000 });
        h.setNonce(nonce, nonce);
        h.chain.sendRawTransaction = async (raw) => {
            h.broadcasts.push(raw);
            updatedAt = BigInt(Math.floor(h.clock.now / 1000));
            nonce += 1n;
            h.setNonce(nonce, nonce);
            return keccak256(raw);
        };
        expect((await h.sender.send(h.job())).status).toBe('pending');
        expect(h.signed).toHaveLength(1);
        for (let i = 0; i < 9; i++) {
            const next = h.reopen({ minUpdateIntervalSec: 3_600, priceStalenessThresholdSec: 7_200n });
            const result = await next.send(h.job());
            expect(result.status).toBe('refused');
            expect(h.signed).toHaveLength(1);
        }
        expect(h.broadcasts).toHaveLength(1);
    });

    it('retries an undelivered stall alert after five minutes and then stops once delivery succeeds', async () => {
        const h = harness({ stallSec: 600 });
        let up = false;
        h.setDeliver(() => up);
        await plant(h, { nonce: 7 });
        h.setNonce(7n, 8n);
        h.clock.now = 1 + 600_000;
        const stalled = await h.sender.maintain();
        expect(stalled).toEqual({ status: 'refused', reason: 'sender: stalled' });
        const stallLines = () => h.alerts.filter((line) => line.includes('ALL sends closed'));
        expect(stallLines()).toHaveLength(1);
        h.clock.now += 299_000;
        h.sender.tick();
        expect(stallLines()).toHaveLength(1);
        h.clock.now += 1_000;
        h.sender.tick();
        expect(stallLines()).toHaveLength(2);
        up = true;
        h.clock.now += 300_000;
        h.sender.tick();
        expect(stallLines()).toHaveLength(3);
        h.sender.tick();
        expect(stallLines()).toHaveLength(3);
        await h.sender.maintain();
        expect(stallLines()).toHaveLength(3);
    });

    it('refuses a signed raw whose nonce, gas, max fee, or tip differs from the request', async () => {
        const tampers: { nonce?: number; gas?: bigint; fee?: bigint; tip?: bigint }[] = [
            { nonce: 8 },
            { gas: 120_001n },
            { fee: 311n },
            { tip: 11n },
        ];
        for (const tamper of tampers) {
            const h = harness();
            h.tamperSigner(tamper);
            const result = await h.sender.send(h.job());
            expect(result).toEqual({ status: 'refused', reason: 'sender: sign failed' });
            expect(h.broadcasts).toEqual([]);
            expect(h.journal.inFlight()).toBeNull();
        }
    });

    it('alerts and refuses when a journal fsync misses the progress deadline', async () => {
        const h = harness({ progressMs: 40 });
        const { setDurabilityHooks, setJournalDeadlineExitForTest } = await import('./journal.js');
        const real = await import('node:fs/promises');
        setJournalDeadlineExitForTest(() => {
            throw new Error('journal: progress deadline');
        });
        setDurabilityHooks({
            async write(fh, body) { await fh.writeFile(body, 'utf8'); },
            async fsyncFile(fh) { await fh.sync(); },
            async rename(from, to) { await real.rename(from, to); },
            async link(from, to) { await real.link(from, to); },
            async fsyncDir() { await new Promise(() => {}); },
        });
        try {
            const started = Date.now();
            const result = await h.sender.send(h.job());
            expect(Date.now() - started).toBeLessThan(2_000);
            expect(result).toEqual({ status: 'refused', reason: 'sender: send failed' });
            expect(h.alerts).toContain('sender: journal progress deadline');
            expect(JSON.stringify(result)).not.toContain('unused');
            expect(h.broadcasts).toEqual([]);
        } finally {
            setJournalDeadlineExitForTest(null);
            setDurabilityHooks(null);
            h.sender.stop();
        }
    }, 2_000);
});

describe('authorizeSign is the signing gate on fees (#447 clestons M2)', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
    const SP = getAddress('0x00000000000000000000000000000000000000a1');
    const targets = { superPaymaster: SP, paymaster: null, signer: SIGNER, chainId: 11155111, maxGas: 500_000n };
    const req = (maxFeePerGas: bigint, maxPriorityFeePerGas: bigint) => ({
        to: SP, data: UPDATE_PRICE_DATA, nonce: 1, gasLimit: 100_000n, maxFeePerGas, maxPriorityFeePerGas, chainId: 11155111,
    });
    it('accepts a request at the ceiling and refuses one a single wei above it', () => {
        expect(authorizeSign('price-super', req(1_000n, 10n), targets, 1_000n)).toBe(true);
        expect(authorizeSign('price-super', req(1_001n, 10n), targets, 1_000n)).toBe(false);
        expect(authorizeSign('price-super', req(1_000n, 1_001n), targets, 1_000n)).toBe(false);
    });
});

