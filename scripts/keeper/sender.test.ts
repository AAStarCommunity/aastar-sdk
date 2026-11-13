/**
 * One sender, one in-flight nonce. Fakes stand in for the chain and for cast.
 */
import { chmodSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { encodeFunctionData, getAddress, keccak256, parseAbi, type Address, type Hex } from 'viem';
import { signTransaction } from 'viem/accounts';
import { Journal, type InFlight } from './journal.js';
import { UPDATE_PRICE_DATA, bumpFee, checkIntent, Sender, type ChainIO, type ChainReceipt, type IntentTx, type SendRequest } from './sender.js';
import { CANCEL_GAS } from './castSigner.js';

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
    bumpAfterTicks?: number;
    maxSendsPerHour?: number;
    maxGas?: bigint;
    maxFeeWei?: bigint;
    enabled?: { 'price-super': boolean; 'price-paymaster': boolean };
    paymaster?: () => Address | null;
    superPaymaster?: Address | null;
    now?: () => number;
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
        maxSendsPerHour: opts.maxSendsPerHour ?? 30,
        bumpAfterTicks: opts.bumpAfterTicks ?? 3,
        now: opts.now ?? (() => clock.now),
        receiptWaitMs: 50,
        pollIntervalMs: 1,
        alert: (msg) => alerts.push(msg),
    });
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
        const h = harness({ bumpAfterTicks: 100 });
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

    it('maintenance runs every tick without a new eligible update', async () => {
        const h = harness({ bumpAfterTicks: 1, enabled: { 'price-super': false, 'price-paymaster': true } });
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
        const cancelled = await h.sender.maintain();
        expect(cancelled.status).toBe('pending');
        expect(h.signed[0]?.cancel).toBe(true);
        expect(h.signed[0]?.to).toBe(SIGNER);
        expect(h.signed[0]?.data).toBe('0x');
        expect(h.signed[0]?.gasLimit).toBe(CANCEL_GAS);

        const under = harness({ bumpAfterTicks: 1 });
        const priced = await signedRaw({ to: TO, data: UPDATE_PRICE_DATA, nonce: 4, maxFee: 50n, tip: 1n });
        await under.journal.init();
        await under.journal.writeInFlight({
            kind: 'price-super', nonce: 4, raws: [priced], hashes: [keccak256(priced)],
            gasLimit: 120_000n, maxFeePerGas: 50n, maxPriorityFeePerGas: 1n, attempts: 0, firstSentAt: 1,
        });
        under.setNonce(4n, 5n);
        under.setFees(1_000n, 20n);
        under.chain.sendRawTransaction = async (rawTx) => {
            under.broadcasts.push(rawTx);
            return keccak256(rawTx);
        };
        await under.sender.maintain();
        expect(under.signed).toHaveLength(1);
        expect(under.signed[0]?.maxFeePerGas).toBeGreaterThan(50n);
        expect(under.signed[0]?.nonce).toBe(4);
        const floor = 2n * 1_000n + 20n;
        expect(under.signed[0]!.maxFeePerGas >= bumpFee(50n, floor)).toBe(true);
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
        const h = harness({ bumpAfterTicks: 100 });
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

    it('mutates the request and the receipt the chain returned; the sender keeps its copies', async () => {
        const h = harness();
        const req = h.job();
        const planted: ChainReceipt = {
            status: 'success', gasUsed: 10n, blockHash: BLOCK, blockNumber: 3n, transactionHash: ('0x' + 'cd'.repeat(32)) as Hex,
        };
        h.chain.sendRawTransaction = async (raw) => {
            h.broadcasts.push(raw);
            return keccak256(raw);
        };
        h.chain.getTransactionReceipt = async (hash) => {
            planted.transactionHash = hash;
            return planted;
        };
        const result = await h.sender.send(req);
        req.to = OTHER;
        req.data = '0xdead' as Hex;
        planted.gasUsed = 1n;
        planted.status = 'reverted';
        expect(result.status).toBe('pending');
        const disk = readFileSync(h.path, 'utf8').toLowerCase();
        expect(disk).toContain(UPDATE_PRICE_DATA.slice(2).toLowerCase());
        expect(disk).not.toContain(OTHER.slice(2).toLowerCase());
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
        expect(result.status).toBe('pending');
        const again = await h.sender.maintain();
        expect(again.status === 'pending' || again.status === 'refused').toBe(true);
        expect(h.signed).toHaveLength(1);
    });

    it('a receipt read failure does not close sends', async () => {
        const h = harness({ bumpAfterTicks: 100 });
        const raw = await signedRaw({ to: TO, data: UPDATE_PRICE_DATA, nonce: 7 });
        await h.journal.init();
        await h.journal.writeInFlight({
            kind: 'price-super', nonce: 7, raws: [raw], hashes: [keccak256(raw)],
            gasLimit: 120_000n, maxFeePerGas: 210n, maxPriorityFeePerGas: 10n, attempts: 0, firstSentAt: 1,
        });
        h.setNonce(8n, 8n);
        h.throwReceipt(keccak256(raw));
        const settled = await h.sender.maintain();
        expect(settled.status).toBe('pending');
        expect(h.alerts.some((a) => a.includes('foreign'))).toBe(false);
        const next = await h.sender.send(h.job());
        expect(next.status === 'pending' || next.status === 'blocked').toBe(true);
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
    });
});

describe('checkIntent', { timeout: SPAWN_VERDICT_TIMEOUT_MS }, () => {
    it('accepts only the three alpha shapes', () => {
        expect(checkIntent('price-super', intent(), targets)).toBe(true);
        expect(checkIntent('price-paymaster', intent({ to: OTHER }), targets)).toBe(true);
        expect(checkIntent('cancel', intent({ to: SIGNER, data: '0x', gas: 21_000n }), targets)).toBe(true);
        expect(checkIntent('price-paymaster', intent({ to: OTHER }), { ...targets, paymaster: null })).toBe(false);
        expect(checkIntent('price-super', intent(), { ...targets, superPaymaster: null })).toBe(false);
    });
});
