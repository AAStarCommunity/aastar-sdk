import { describe, expect, it } from 'vitest';
import { keccak256, pad, toHex, type Address, type Hex } from 'viem';
import { optimism, optimismSepolia, sepolia } from 'viem/chains';
import { CANONICAL_ADDRESSES } from './addresses.js';
import { SP550_FRESH_OPTIONAL_ADDRESS_KEYS, SP550_FRESH_REQUIRED_ADDRESS_KEYS } from './sp550Deployments.js';
import { rpcEndpointKey, runSp550CutoverGate, type GateClient, type GateRpc } from './sp550CutoverGate.js';

const A = (n: number) => ('0x' + n.toString(16).padStart(40, '0')) as Address;
const HEAD = 5_000n;
const BLOCK_HASH = ('0x' + 'b1'.repeat(32)) as Hex;
const codeOf = (a: Address) => ('0x6080' + a.slice(2)) as Hex; // distinct non-empty code per address

/** A complete, consistent 5.5.0 deployment on `chainId`, and the pins that describe it. */
function deployment(chainId: number, mode: 'fresh' | 'upgrade') {
    const book = Object.fromEntries(SP550_FRESH_REQUIRED_ADDRESS_KEYS.map((k, i) => [k, A(0x100 + i)])) as Record<string, Address>;
    const p = {
        sp: book.superPaymaster, impl: A(1), lens: A(3), factory: A(4), tokenImpl: A(5), ext: A(6), aoa: A(7), tier: A(8), apnts: book.aPNTs,
    };
    const canonical = (CANONICAL_ADDRESSES as Record<number, any>)[chainId];
    const pins = {
        tag: 'v5.5.0', superPaymaster: p.sp, spImpl: p.impl, spImplCodehash: keccak256(codeOf(p.impl)), superPaymasterLens: p.lens,
        xPNTsFactoryV2: p.factory, xPNTsTokenV2Impl: p.tokenImpl, xPNTsTokenV2Ext: p.ext, aoaProtocolRegistry: p.aoa,
        globalTierSource: p.tier, aPNTsCapped: p.apnts, readbackBlock: HEAD - 10n,
        ...(mode === 'fresh' ? { addresses: book, absent: [...SP550_FRESH_OPTIONAL_ADDRESS_KEYS] } : {}),
    };
    const reads: Record<string, unknown> = {
        [`${p.sp}.version`]: 'SuperPaymaster-5.5.0', [`${p.sp}.APNTS_TOKEN`]: p.apnts, [`${p.sp}.xpntsFactory`]: p.factory,
        [`${p.sp}.REGISTRY`]: book.registry, [`${p.sp}.BLS_AGGREGATOR`]: book.blsAggregator,
        [`${p.sp}.agentIdentityRegistry`]: book.agentIdentityRegistry, [`${p.sp}.agentReputationRegistry`]: book.agentReputationRegistry,
        [`${p.sp}.entryPoint`]: canonical.entryPoint, [`${p.sp}.ETH_USD_PRICE_FEED`]: canonical.priceFeed,
        [`${p.apnts}.version`]: 'APNTsCapped-1.0.0',
        [`${p.factory}.SUPERPAYMASTER`]: p.sp, [`${p.factory}.implementation`]: p.tokenImpl, [`${p.factory}.defaultTierSource`]: p.tier,
        [`${p.factory}.implementationCodehash`]: keccak256(codeOf(p.tokenImpl)), [`${p.factory}.extensionCodehash`]: keccak256(codeOf(p.ext)),
        [`${p.tokenImpl}.EXTENSION`]: p.ext, [`${p.tokenImpl}.PROTOCOL_REGISTRY`]: p.aoa,
        [`${p.lens}.EXPECTED_SP_VERSION`]: keccak256(toHex('SuperPaymaster-5.5.0')),
    };
    return { chainId, pins, p, reads, slot: pad(p.impl, { size: 32 }) as Hex, blockHash: BLOCK_HASH as Hex | null, servedBlock: undefined as bigint | undefined,
        /** Per-address code overrides ('0x' = no code); default codeOf(address). */
        code: {} as Record<string, Hex> };
}

type Model = ReturnType<typeof deployment>;

const IMPL_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';

/** A mocked RPC over model `m`. State reads must name the snapshot block (HEAD) — a read without it throws. */
function rpc(label: string, url: string, m: Model, calls: string[]): GateRpc {
    const log = (s: string) => calls.push(`${label}:${s}`);
    const atSnapshot = (what: string, blockNumber: unknown) => {
        if (blockNumber !== HEAD) throw new Error(`${label} ${what}: read not pinned to the snapshot block (got ${String(blockNumber)})`);
    };
    const client: GateClient = {
        getChainId: async () => { log('getChainId'); return m.chainId; },
        getBlockNumber: async () => { log('getBlockNumber'); return HEAD; },
        getBlock: (async ({ blockNumber }: any) => { log('getBlock'); return { number: m.servedBlock ?? blockNumber, hash: m.blockHash }; }) as any,
        getStorageAt: (async ({ slot, blockNumber }: any) => {
            log('getStorageAt'); atSnapshot('getStorageAt', blockNumber);
            if (slot !== IMPL_SLOT) throw new Error(`unexpected slot ${slot}`);
            return m.slot;
        }) as any,
        getCode: (async ({ address, blockNumber }: any) => {
            log('getCode'); atSnapshot('getCode', blockNumber);
            return m.code[address] ?? codeOf(address);
        }) as any,
        readContract: (async ({ address, functionName, blockNumber }: any) => {
            log(`read ${functionName}`); atSnapshot(`read ${functionName}`, blockNumber);
            const k = `${address}.${functionName}`;
            if (!(k in m.reads)) throw Object.assign(new Error('reverted'), { shortMessage: `no ${functionName}` });
            return m.reads[k];
        }) as any,
    };
    return { label, url, client };
}

const twin = (m: Model, m2: Model = structuredClone(m), calls: string[] = []) => [
    rpc('--rpc', 'https://rpc-a.example/v2/key', m, calls), rpc('--rpc2', 'https://rpc-b.example/', m2, calls),
];

describe('SP 5.5.0 cutover gate: a consistent fresh deployment passes', () => {
    it('op-sepolia, complete pins, two independent RPCs that agree -> exit 0', async () => {
        const m = deployment(optimismSepolia.id, 'fresh');
        const r = await runSp550CutoverGate({ network: 'op-sepolia', rpcs: twin(m), pins: m.pins });
        expect(r.results.filter((c) => !c.ok)).toEqual([]);
        expect(r.exitCode).toBe(0);
    });
    it('sepolia upgrade mode with one RPC is unchanged -> exit 0', async () => {
        const m = deployment(sepolia.id, 'upgrade');
        const calls: string[] = [];
        const r = await runSp550CutoverGate({ network: 'sepolia', rpcs: [rpc('--rpc', 'https://a.example', m, calls)], pins: m.pins });
        expect(r.results.filter((c) => !c.ok)).toEqual([]);
        expect(r.exitCode).toBe(0);
    });
});

describe('SP 5.5.0 cutover gate refuses before reading state (exit 2)', () => {
    const m = deployment(optimismSepolia.id, 'fresh');
    it.each([
        ['identical URL', 'https://rpc-a.example/v2/key'],
        ['same URL, trailing slash', 'https://rpc-a.example/v2/key/'],
        ['same URL, host case', 'https://RPC-A.example/v2/key'],
    ])('the same endpoint twice is not a two-RPC read-back: %s', async (_n, url2) => {
        const calls: string[] = [];
        const r = await runSp550CutoverGate({
            network: 'op-sepolia', pins: m.pins,
            rpcs: [rpc('--rpc', 'https://rpc-a.example/v2/key', m, calls), rpc('--rpc2', url2, m, calls)],
        });
        expect(r.exitCode).toBe(2);
        expect(r.error).toMatch(/same endpoint/);
        expect(calls).toEqual([]);
    });
    it('a fresh network with one RPC', async () => {
        const r = await runSp550CutoverGate({ network: 'op-mainnet', rpcs: [rpc('--rpc', 'https://a.example', m, [])] });
        expect(r).toMatchObject({ exitCode: 2, error: expect.stringMatching(/needs two RPCs/) });
    });
    it.each([undefined, 'optimism'])('unknown network %s', async (network) => {
        const r = await runSp550CutoverGate({ network, rpcs: twin(m) });
        expect(r).toMatchObject({ exitCode: 2, error: expect.stringMatching(/unknown SP 5.5.0 network/) });
    });
    it('a wrong chainId on the SECOND RPC stops everything after the chainId reads', async () => {
        const calls: string[] = [];
        const other = { ...structuredClone(m), chainId: sepolia.id };
        const r = await runSp550CutoverGate({ network: 'op-sepolia', rpcs: twin(m, other, calls), pins: m.pins });
        expect(r).toMatchObject({ exitCode: 2, error: expect.stringMatching(/--rpc2: .*expects chainId 11155420, but the RPC reports 11155111/) });
        expect(calls).toEqual(['--rpc:getChainId', '--rpc2:getChainId']);
    });
    it('chainId is read on every RPC before anything else', async () => {
        const calls: string[] = [];
        await runSp550CutoverGate({ network: 'op-sepolia', rpcs: twin(m, structuredClone(m), calls), pins: m.pins });
        expect(calls.slice(0, 2)).toEqual(['--rpc:getChainId', '--rpc2:getChainId']);
        expect(calls.slice(2).some((c) => c.endsWith('getChainId'))).toBe(false);
    });
    it('endpoint identity ignores trailing slashes and host case but not path or query', () => {
        expect(rpcEndpointKey('https://A.example/x/')).toBe(rpcEndpointKey('https://a.example/x'));
        expect(rpcEndpointKey('https://a.example/x')).not.toBe(rpcEndpointKey('https://a.example/y'));
        expect(rpcEndpointKey('https://a.example/?k=1')).not.toBe(rpcEndpointKey('https://a.example/?k=2'));
    });
});

describe('SP 5.5.0 cutover gate fails (exit 1) when the two RPCs disagree or the snapshot is unproven', () => {
    const failed = async (network: string, m: Model, m2: Model) => {
        const r = await runSp550CutoverGate({ network, rpcs: twin(m, m2), pins: m.pins });
        return { exitCode: r.exitCode, failed: r.results.filter((c) => !c.ok).map((c) => c.check) };
    };
    it('null block hashes on both RPCs do not count as the same block', async () => {
        const m = { ...deployment(optimismSepolia.id, 'fresh'), blockHash: null };
        expect(await failed('op-sepolia', m, structuredClone(m))).toEqual({ exitCode: 1, failed: ['every RPC serves the same block at the snapshot'] });
    });
    it('different block hashes (a fork or a lagging node)', async () => {
        const m = deployment(optimismSepolia.id, 'fresh');
        const m2 = { ...structuredClone(m), blockHash: ('0x' + 'c2'.repeat(32)) as Hex };
        expect(await failed('op-sepolia', m, m2)).toEqual({ exitCode: 1, failed: ['every RPC serves the same block at the snapshot'] });
    });
    it('an RPC that answers with a different block than the one asked for (same hash on both)', async () => {
        const m = { ...deployment(optimismSepolia.id, 'fresh'), servedBlock: HEAD + 7n };
        expect(await failed('op-sepolia', m, structuredClone(m))).toEqual({ exitCode: 1, failed: ['every RPC serves the same block at the snapshot'] });
    });
    it('RPC2 reports a different implementation behind the proxy', async () => {
        const m = deployment(optimismSepolia.id, 'fresh');
        const m2 = { ...structuredClone(m), slot: pad(A(0xdead), { size: 32 }) as Hex };
        const r = await failed('op-sepolia', m, m2);
        expect(r.exitCode).toBe(1);
        expect(r.failed).toContain('ERC-1967 impl == pins.spImpl');
    });
    it.each(['REGISTRY', 'version', 'xpntsFactory', 'entryPoint'])('RPC2 disagrees on SP.%s()', async (fn) => {
        const m = deployment(optimismSepolia.id, 'fresh');
        const m2 = structuredClone(m);
        m2.reads[`${m.p.sp}.${fn}`] = fn === 'version' ? 'SuperPaymaster-5.4.2' : A(0xbeef);
        const r = await failed('op-sepolia', m, m2);
        expect(r.exitCode).toBe(1);
        expect(r.failed.some((c) => c.includes(`SP.${fn}()`))).toBe(true);
    });
});

describe('SP 5.5.0 cutover gate: every pinned address is real, identical code', () => {
    const failed = async (m: Model, m2: Model) => {
        const r = await runSp550CutoverGate({ network: 'op-sepolia', rpcs: twin(m, m2), pins: m.pins });
        return { exitCode: r.exitCode, failed: r.results.filter((c) => !c.ok).map((c) => c.check) };
    };
    it.each(['aoaProtocolRegistry', 'globalTierSource'])('a top-level pin with no code on either RPC (%s), though getters return it', async (k) => {
        const m = deployment(optimismSepolia.id, 'fresh');
        m.code[(m.pins as any)[k]] = '0x';
        expect(await failed(m, structuredClone(m))).toEqual({ exitCode: 1, failed: [`${k} has the same non-empty code on every RPC`] });
    });
    it('the Lens has different code on RPC2 while EXPECTED_SP_VERSION agrees', async () => {
        const m = deployment(optimismSepolia.id, 'fresh');
        const m2 = structuredClone(m);
        m2.code[m.p.lens] = '0x6080dead';
        expect(await failed(m, m2)).toEqual({ exitCode: 1, failed: ['superPaymasterLens has the same non-empty code on every RPC'] });
    });
    it('each RPC self-consistent but different (code A + hash A vs code B + hash B): two DIVERGE results never compare equal', async () => {
        const m = deployment(optimismSepolia.id, 'fresh');
        const m2 = structuredClone(m);
        m2.code[m.p.ext] = '0x6080beef';
        m2.reads[`${m.p.factory}.extensionCodehash`] = keccak256('0x6080beef');
        const r = await failed(m, m2);
        expect(r.exitCode).toBe(1);
        expect(r.failed).toEqual(expect.arrayContaining([
            'factory.extensionCodehash() == keccak256(code(xPNTsTokenV2Ext))', 'xPNTsTokenV2Ext has the same non-empty code on every RPC',
        ]));
    });
    it('the same for the implementation: RPC2 serves other impl code and reports nothing else differently', async () => {
        const m = deployment(optimismSepolia.id, 'fresh');
        const m2 = structuredClone(m);
        m2.code[m.p.impl] = '0x6080cafe';
        expect((await failed(m, m2)).failed).toEqual(expect.arrayContaining([
            'keccak256(code(impl)) == pins.spImplCodehash', 'spImpl has the same non-empty code on every RPC',
        ]));
    });
    it('upgrade mode checks the top-level pins too', async () => {
        const m = deployment(sepolia.id, 'upgrade');
        m.code[m.p.aoa] = '0x';
        const r = await runSp550CutoverGate({ network: 'sepolia', rpcs: [rpc('--rpc', 'https://a.example', m, [])], pins: m.pins });
        expect(r.results.filter((c) => !c.ok).map((c) => c.check)).toEqual(['aoaProtocolRegistry has the same non-empty code on every RPC']);
    });
});

describe('SP 5.5.0 cutover gate: pins and holds', () => {
    it('op-mainnet with a complete, consistent deployment still fails on the release hold', async () => {
        const m = deployment(optimism.id, 'fresh');
        const r = await runSp550CutoverGate({ network: 'op-mainnet', rpcs: twin(m), pins: m.pins });
        expect(r.exitCode).toBe(1);
        expect(r.results.filter((c) => !c.ok).map((c) => c.check)).toEqual(['no release hold on this chain']);
    });
    it('the committed (empty) OP Sepolia pins fail closed against a perfect chain', async () => {
        const m = deployment(optimismSepolia.id, 'fresh');
        const r = await runSp550CutoverGate({ network: 'op-sepolia', rpcs: twin(m) });
        expect(r.exitCode).toBe(1);
        expect(r.results.find((c) => c.check === 'pins complete and well-formed')).toMatchObject({ ok: false });
    });
});
