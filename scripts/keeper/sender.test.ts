/**
 * One sender, one in-flight nonce. Fakes stand in for the chain and for cast.
 */
import { chmodSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { encodeFunctionData, getAddress, keccak256, parseAbi, type Address, type Hex } from 'viem';
import { signTransaction } from 'viem/accounts';
import { Journal, type InFlight } from './journal.js';
import { FEE_BASE_MULTIPLIER, UPDATE_PRICE_DATA, authorizeSign, checkIntent, signingFees, Sender, type ChainIO, type ChainReceipt, type IntentTx, type SendRequest, type StalenessRead } from './sender.js';

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

function harness(opts: {
    maxSendsPerHour?: number;
    maxGas?: bigint;
    maxFeeWei?: bigint;
    maxTipWei?: bigint;
    stallSec?: number;
    enabled?: { 'price-super': boolean; 'price-paymaster': boolean };
    paymaster?: () => Address | null;
    superPaymaster?: Address | null;
    now?: () => number;
    resetSendCeiling?: boolean;
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
            const raw = await signTransaction({
                privateKey: KEY,
                transaction: {
                    type: 'eip1559', chainId: req.chainId, nonce: req.nonce, gas, maxFeePerGas: req.maxFeePerGas,
                    maxPriorityFeePerGas: req.maxPriorityFeePerGas, to, value: signerValue, data,
                },
            });
            signed.push({
                to, data, nonce: req.nonce, gasLimit: gas, maxFeePerGas: req.maxFeePerGas,
                maxPriorityFeePerGas: req.maxPriorityFeePerGas, cancel: req.cancel === true,
            });
            return raw;
        },
    };
    const journal = new Journal(path, { chainId: CHAIN_ID, signer: SIGNER });
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
        maxSendsPerHour: opts.maxSendsPerHour ?? 30,
        now: opts.now ?? (() => clock.now),
        alert: (msg) => alerts.push(msg),
        resetSendCeiling: opts.resetSendCeiling,
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
        tamperSigner(next: { to?: Address; data?: Hex; value?: bigint; gas?: bigint }) {
            signerTo = next.to ?? null;
            signerData = next.data ?? null;
            signerValue = next.value ?? 0n;
            signerGas = next.gas ?? null;
        },
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
        reopen(over: { resetSendCeiling?: boolean; maxSendsPerHour?: number; maxFeeWei?: bigint; stallSec?: number } = {}) {
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
                maxSendsPerHour: over.maxSendsPerHour ?? opts.maxSendsPerHour ?? 30,
                now: opts.now ?? (() => clock.now),
                alert: (msg) => alerts.push(msg),
                resetSendCeiling: over.resetSendCeiling,
                readStaleness: opts.readStaleness,
                manualStep: opts.manualStep,
            });
            next.setPaymasterIdentity(opts.paymasterIdentity !== false);
            next.setGate({ price: true, pause: true, reason: '', validUntil: 5_000_000_000 });
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

    it('the gate expiring between check and broadcast cannot broadcast', async () => {
        const h = harness();
        const raw = await signedRaw({ to: TO, data: UPDATE_PRICE_DATA, nonce: 7 });
        await h.journal.init();
        await h.journal.writeInFlight({
            kind: 'price-super', nonce: 7, raws: [raw], hashes: [keccak256(raw)],
            gasLimit: 120_000n, maxFeePerGas: 210n, maxPriorityFeePerGas: 10n, attempts: 0, firstSentAt: 1,
        });
        h.setNonce(7n, 8n);
        h.expireOnChainRead(2);
        const settled = await h.sender.maintain();
        expect(settled.status).toBe('refused');
        expect(h.broadcasts).toEqual([]);
        expect(h.chainReads()).toBeGreaterThanOrEqual(2);
    });

    it('exceeding the send ceiling closes all sends and alerts', async () => {
        const h = harness({ maxSendsPerHour: 2 });
        h.chain.sendRawTransaction = async (raw) => {
            h.broadcasts.push(raw);
            h.setNonce(h.broadcasts.length === 1 ? 8n : 9n, h.broadcasts.length === 1 ? 8n : 9n);
            return keccak256(raw);
        };
        const first = await h.sender.send(h.job());
        const second = await h.sender.send(h.job('price-paymaster', OTHER));
        const third = await h.sender.send(h.job());
        expect(first.status).toBe('pending');
        expect(second.status).toBe('pending');
        expect(third).toEqual({ status: 'refused', reason: 'sender: send ceiling' });
        expect(h.alerts).toContain('send ceiling exceeded — all sends closed');
        h.setNonce(10n, 10n);
        const again = await h.sender.send(h.job('price-paymaster', OTHER));
        expect(again).toEqual({ status: 'refused', reason: 'sender: send ceiling' });
        expect(h.broadcasts).toHaveLength(2);
        expect(h.alerts.filter((a) => a === 'send ceiling exceeded — all sends closed')).toHaveLength(1);
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
        expect(h.broadcasts).toEqual([raw]);
        expect(h.journal.inFlight()?.kind).toBe('price-paymaster');
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
        await h.sender.flushReceipt();
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
            superPaymaster: TO, paymaster: () => OTHER, maxFeeWei: 0n, maxSendsPerHour: 1, alert: () => {},
        })).toThrow('sender: maxFeeWei invalid');
        expect(() => new Sender({
            chain, signer: { async sign() { return '0x' as Hex; } }, journal, signerAddress: SIGNER, chainId: 1,
            superPaymaster: TO, paymaster: () => OTHER, maxFeeWei: 1n, maxSendsPerHour: 0, alert: () => {},
        })).toThrow('sender: maxSendsPerHour invalid');
        expect(() => new Sender({
            chain, signer: { async sign() { return '0x' as Hex; } }, journal, signerAddress: SIGNER, chainId: 1,
            superPaymaster: TO, paymaster: () => OTHER, maxFeeWei: 1n, maxSendsPerHour: 1, alert: () => {},
            resetSendCeiling: 'yes' as unknown as boolean,
        })).toThrow('sender: resetSendCeiling invalid');
        expect(() => new Sender({
            chain, signer: { async sign() { return '0x' as Hex; } }, journal, signerAddress: SIGNER, chainId: 1,
            superPaymaster: TO, paymaster: () => OTHER, maxFeeWei: 1n, maxSendsPerHour: 1, alert: () => {},
            stallSec: Number.NaN,
        })).toThrow('sender: stallSec invalid');
        expect(() => new Sender({
            chain, signer: { async sign() { return '0x' as Hex; } }, journal, signerAddress: SIGNER, chainId: 1,
            superPaymaster: TO, paymaster: () => OTHER, maxFeeWei: 1n, maxSendsPerHour: 1, alert: () => {},
            stallSec: -1,
        })).toThrow('sender: stallSec invalid');
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
        const disk = JSON.parse(readFileSync(h.path, 'utf8')) as { stalled: boolean; stalledNonce: number; inFlight: { nonce: number } };
        expect(disk.stalled).toBe(true);
        expect(disk.stalledNonce).toBe(7);
        expect(disk.inFlight.nonce).toBe(7);
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

    it('charges the first broadcast of a raw whose chain-id read failed, then keeps the ceiling across a restart', async () => {
        const h = harness({ maxSendsPerHour: 1 });
        let failBroadcastChain = true;
        let reads = 0;
        h.chain.chainId = async () => {
            reads += 1;
            if (failBroadcastChain && reads >= 2) throw new Error('rpc path /tmp/secret');
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
        const body = JSON.parse(readFileSync(h.path, 'utf8')) as { sentAt: number[]; ceilingClosed: boolean; inFlight: { broadcastOnce: string[] } };
        expect(body.sentAt).toEqual([]);
        expect(body.ceilingClosed).toBe(false);
        expect(body.inFlight.broadcastOnce).toEqual([]);
        failBroadcastChain = false;
        const replayed = await h.sender.maintain();
        expect(replayed.status).toBe('pending');
        expect(h.broadcasts).toHaveLength(1);
        const charged = JSON.parse(readFileSync(h.path, 'utf8')) as { sentAt: number[]; ceilingClosed: boolean; inFlight: { broadcastOnce: string[] } };
        expect(charged.sentAt).toHaveLength(1);
        expect(charged.inFlight.broadcastOnce).toHaveLength(1);
        const again = await h.sender.maintain();
        expect(again.status).toBe('pending');
        expect(h.broadcasts).toHaveLength(2);
        const free = JSON.parse(readFileSync(h.path, 'utf8')) as { sentAt: number[]; ceilingClosed: boolean };
        expect(free.sentAt).toHaveLength(1);
        expect(free.ceilingClosed).toBe(false);
        h.setNonce(8n, 8n);
        await h.sender.maintain();
        const second = await h.sender.send(h.job());
        expect(second).toEqual({ status: 'refused', reason: 'sender: send ceiling' });
        expect(h.broadcasts).toHaveLength(2);
        const closed = h.reopen();
        const restarted = await closed.send(h.job());
        expect(restarted).toEqual({ status: 'refused', reason: 'sender: send ceiling' });
        const earlySender = h.reopen({ resetSendCeiling: true });
        const early = await earlySender.send(h.job());
        expect(early).toEqual({ status: 'refused', reason: 'sender: send ceiling' });
        const held = JSON.parse(readFileSync(h.path, 'utf8')) as { sentAt: number[]; ceilingClosed: boolean };
        expect(held.sentAt.length).toBeGreaterThan(0);
        expect(held.ceilingClosed).toBe(true);
        h.clock.now = 1_000 + 3_600_000 + 1;
        h.setNonce(9n, 9n);
        const opened = h.reopen({ resetSendCeiling: true });
        const allowed = await opened.send(h.job());
        expect(allowed.status).toBe('pending');
        const room = JSON.parse(readFileSync(h.path, 'utf8')) as { ceilingClosed: boolean };
        expect(room.ceilingClosed).toBe(false);
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

