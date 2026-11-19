import { describe, expect, it } from 'vitest';
import { keccak256, pad, toHex, type Address, type Hex } from 'viem';
import { optimism, optimismSepolia, sepolia } from 'viem/chains';
import { CANONICAL_ADDRESSES, getCanonicalAddresses } from './addresses.js';
import { SP550_ADDRESS_OWNER, SP550_COEXIST_PINS, SP550_FRESH_OPTIONAL_ADDRESS_KEYS, SP550_FRESH_REQUIRED_ADDRESS_KEYS, resolveSp550Network, requireDeployedAddress, SP550_COEXIST_HOLDS, SP550_RELEASE_HOLDS, sp550CoexistOverlapProblems, sp550HoldFor, sp550OverlayBook, sp550NetworkPinProblems, requireSp550FreshDeployPins, Sp550NotDeployedError, sp550AddressSet, sp550PinsFor } from './sp550Deployments.js';
import { SP550_CERTIFIED_ADDRESS_KEYS, sp550PinnedAddressEntries } from './sp550Cutover.js';
import { SP550_WIRING_SCAN_ABI, SP550_WIRING_SCAN_EXEMPT, rpcEndpointKey, runSp550CutoverGate as rawGate, type GateClient, type GateInput, type GateRpc } from './sp550CutoverGate.js';

/** Fixture release strings (SP's current group heads); the real pins come from the tag's final list. */
const SP_VERSION = 'SuperPaymaster-5.5.1';
const LENS_VERSION = 'SuperPaymasterLens-1.2.2';
/** Each fixture's SDK address book, keyed by its pins object, so every call site stays as written. */
const BOOKS = new WeakMap<object, Record<string, unknown>>();
const runSp550CutoverGate = (i: GateInput) => rawGate({ ...i, book: i.book ?? (i.pins ? BOOKS.get(i.pins) : undefined) });
const LOOP = 'http://127.0.0.1:8545';

const A = (n: number) => ('0x' + n.toString(16).padStart(40, '0')) as Address;
const HEAD = 5_000n;
const BLOCK_HASH = ('0x' + 'b1'.repeat(32)) as Hex;
const NEUTRAL = ('0x' + 'fe'.repeat(20)) as Address;
const codeOf = (a: Address) => ('0x6080' + a.slice(2)) as Hex; // distinct non-empty code per address

/** A complete, consistent 5.5.0 deployment on `chainId`, and the pins that describe it. */
function deployment(chainId: number, mode: 'fresh' | 'upgrade') {
    const book = Object.fromEntries(SP550_FRESH_REQUIRED_ADDRESS_KEYS.map((k, i) => [k, A(0x100 + i)])) as Record<string, Address>;
    const p = {
        sp: book.superPaymaster, impl: A(1), lens: A(3), factory: A(4), tokenImpl: A(5), ext: A(6), aoa: A(7), tier: A(8), apnts: book.aPNTs,
        admin: A(0xa), registryImpl: A(0xb), disclosure: A(0xc),
    };
    // An upgrade certifies the SP-owned entries every read-back names; a fresh deploy the whole SP-owned book.
    // A fresh book's xPNTsFactory IS the V2 factory (sp550FreshPinProblems), so the fixture pins it rather than declaring it absent.
    const certified = mode === 'fresh' ? { ...book, xPNTsFactory: p.factory } : Object.fromEntries(SP550_CERTIFIED_ADDRESS_KEYS.map((k) => [k, book[k]])) as Record<string, Address>;
    const canonical = (CANONICAL_ADDRESSES as Record<number, any>)[chainId];
    const base = {
        tag: 'v5.5.0', spVersion: SP_VERSION, superPaymaster: p.sp, spImpl: p.impl, spImplCodehash: keccak256(codeOf(p.impl)), superPaymasterLens: p.lens,
        xPNTsFactoryV2: p.factory, xPNTsTokenV2Impl: p.tokenImpl, xPNTsTokenV2Ext: p.ext, aoaProtocolRegistry: p.aoa,
        globalTierSource: p.tier, aPNTsCapped: p.apnts, readbackBlock: HEAD - 10n,
        spAdminExtension: p.admin, lensVersion: LENS_VERSION, registryImpl: p.registryImpl, disclosureRegistry: p.disclosure,
        addresses: certified, ...(mode === 'fresh' ? { absent: SP550_FRESH_OPTIONAL_ADDRESS_KEYS.filter((k) => k !== 'xPNTsFactory') } : {}),
    };
    // The read-back runtime codehash of every pinned address (the model serves codeOf(address)).
    const pins = { ...base, codehashes: Object.fromEntries(sp550PinnedAddressEntries(base).map(([k, a]) => [k, keccak256(codeOf(a as Address))])) as Record<string, Hex> };
    const reads: Record<string, unknown> = {
        [`${p.sp}.version`]: SP_VERSION, [`${p.sp}.EXTENSION`]: p.admin, [`${p.lens}.version`]: LENS_VERSION, [`${p.sp}.APNTS_TOKEN`]: p.apnts, [`${p.sp}.xpntsFactory`]: p.factory,
        [`${p.sp}.REGISTRY`]: book.registry, [`${p.sp}.BLS_AGGREGATOR`]: book.blsAggregator,
        [`${p.sp}.agentIdentityRegistry`]: book.agentIdentityRegistry, [`${p.sp}.agentReputationRegistry`]: book.agentReputationRegistry,
        [`${p.sp}.entryPoint`]: canonical.entryPoint, [`${p.sp}.ETH_USD_PRICE_FEED`]: canonical.priceFeed,
        [`${p.apnts}.version`]: 'APNTsCapped-1.0.0',
        [`${p.factory}.SUPERPAYMASTER`]: p.sp, [`${p.factory}.implementation`]: p.tokenImpl, [`${p.factory}.defaultTierSource`]: p.tier,
        [`${p.factory}.implementationCodehash`]: keccak256(codeOf(p.tokenImpl)), [`${p.factory}.extensionCodehash`]: keccak256(codeOf(p.ext)),
        [`${p.tokenImpl}.EXTENSION`]: p.ext, [`${p.tokenImpl}.PROTOCOL_REGISTRY`]: p.aoa,
        [`${p.lens}.EXPECTED_SP_VERSION`]: keccak256(toHex(SP_VERSION)),
        // The BLS / DVT / Registry wiring legs, all naming the certified contracts.
        [`${book.registry}.blsAggregator`]: book.blsAggregator, [`${book.registry}.SUPER_PAYMASTER`]: p.sp,
        [`${book.dvtValidator}.BLS_AGGREGATOR`]: book.blsAggregator, [`${book.dvtValidator}.REGISTRY`]: book.registry,
        [`${book.blsAggregator}.DVT_VALIDATOR`]: book.dvtValidator, [`${book.blsAggregator}.REGISTRY`]: book.registry,
        [`${book.blsAggregator}.SUPERPAYMASTER`]: p.sp, [`${book.reputationSystem}.REGISTRY`]: book.registry,
        // The token / staking / SBT legs (checked for a fresh stack).
        [`${book.registry}.GTOKEN_STAKING`]: book.staking, [`${book.registry}.MYSBT`]: book.sbt,
        [`${book.staking}.REGISTRY`]: book.registry, [`${book.staking}.GTOKEN`]: book.gToken,
        [`${book.sbt}.REGISTRY`]: book.registry, [`${book.sbt}.GTOKEN_STAKING`]: book.staking, [`${book.sbt}.GTOKEN`]: book.gToken,
        [`${p.factory}.REGISTRY`]: book.registry, [`${book.paymasterFactory}.registry`]: book.registry, [`${book.x402Facilitator}.REGISTRY`]: book.registry,
        [`${book.x402Facilitator}.XPNTS_FACTORY`]: p.factory, [`${book.paymasterV4Impl}.registry`]: book.registry, [`${p.tier}.REGISTRY`]: book.registry,
    };
    // The SDK book that ships with these pins: a fresh stack's book IS the pinned SP-owned entries
    // (plus the external ones); an upgrade's book keeps its proxy and switches aPNTs / the factory.
    const sdkBook: Record<string, unknown> = mode === 'fresh'
        ? { ...certified, entryPoint: canonical.entryPoint, priceFeed: canonical.priceFeed }
        : { ...canonical, ...certified, superPaymaster: p.sp, aPNTs: p.apnts, xPNTsFactory: p.factory };
    BOOKS.set(pins, sdkBook);
    return { chainId, pins, p, reads, slot: pad(p.impl, { size: 32 }) as Hex,
        /** ERC-1967 slots of proxies other than SP (the Registry); SP's is `slot`. */
        slots: { [book.registry]: pad(p.registryImpl, { size: 32 }) } as Record<string, Hex>, blockHash: BLOCK_HASH as Hex | null, servedBlock: undefined as bigint | undefined,
        /** The block this RPC reports as finalized (default HEAD); null = it serves none. */
        finalized: HEAD as bigint | null,
        /** Per-address code overrides ('0x' = no code); default codeOf(address). */
        code: {} as Record<string, Hex>,
        /** Called after each readContract answer (lets a test reorg the model mid-run). */
        afterRead: undefined as undefined | ((functionName: string) => void),
        /** Unset address getters revert instead of answering NEUTRAL. */
        revertUnset: false };
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
        getBlock: (async ({ blockNumber, blockTag }: any) => {
            if (blockTag !== undefined) {
                log(`getBlock ${blockTag}`);
                if (blockTag !== 'finalized') throw new Error(`unexpected blockTag ${blockTag}`);
                if (m.finalized === null) throw Object.assign(new Error('unsupported'), { shortMessage: 'finalized tag not supported' });
                return { number: m.finalized, hash: m.blockHash };
            }
            log('getBlock'); return { number: m.servedBlock ?? blockNumber, hash: m.blockHash };
        }) as any,
        getStorageAt: (async ({ address, slot, blockNumber }: any) => {
            log('getStorageAt'); atSnapshot('getStorageAt', blockNumber);
            if (slot !== IMPL_SLOT) throw new Error(`unexpected slot ${slot}`);
            return address in m.slots ? m.slots[address] : m.slot;
        }) as any,
        getCode: (async ({ address, blockNumber }: any) => {
            log('getCode'); atSnapshot('getCode', blockNumber);
            return m.code[address] ?? codeOf(address);
        }) as any,
        readContract: (async ({ address, abi, functionName, blockNumber }: any) => {
            log(`read ${functionName}`); atSnapshot(`read ${functionName}`, blockNumber);
            const k = `${address}.${functionName}`;
            if (!(k in m.reads)) {
                // An address getter no test sets answers a neutral address (not a pin, not the shipped stack).
                const e = (abi as any[]).find((x) => x.type === 'function' && x.name === functionName);
                // Address-carrying views no test sets: neutral values (address -> NEUTRAL, arrays empty, numbers 0).
                const neutral = (o: any): unknown => o.type.endsWith('[]') ? [] : o.type === 'address' ? NEUTRAL : o.type === 'bool' ? false
                    : /^u?int/.test(o.type) ? 0n : o.type === 'string' ? '' : /^bytes\d+$/.test(o.type) ? '0x' + '00'.repeat(Number(o.type.slice(5)))
                    : o.type === 'bytes' ? '0x' : o.type === 'tuple' ? (o.components ?? []).map(neutral) : undefined;
                if (e && (e.inputs ?? []).length === 0 && (e.outputs ?? []).some((o: any) => o.type.startsWith('address')) && !m.revertUnset) {
                    const vals = e.outputs.map(neutral);
                    if (vals.every((v: unknown) => v !== undefined)) return vals.length === 1 ? vals[0] : vals;
                }
                throw Object.assign(new Error('reverted'), { shortMessage: `no ${functionName}` });
            }
            const v = m.reads[k];
            m.afterRead?.(functionName);
            return v;
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
    it('sepolia upgrade mode with one loopback RPC (fork rehearsal) -> exit 0', async () => {
        const m = deployment(sepolia.id, 'upgrade');
        const calls: string[] = [];
        const r = await runSp550CutoverGate({ network: 'sepolia', rpcs: [rpc('--rpc', LOOP, m, calls)], pins: m.pins });
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
        expect(await failed('op-sepolia', m, structuredClone(m))).toEqual({ exitCode: 1, failed: [
            'every RPC serves the same block at the snapshot', 'the snapshot block did not change during the reads (no reorg)'] });
    });
    it('different block hashes (a fork or a lagging node)', async () => {
        const m = deployment(optimismSepolia.id, 'fresh');
        const m2 = { ...structuredClone(m), blockHash: ('0x' + 'c2'.repeat(32)) as Hex };
        expect(await failed('op-sepolia', m, m2)).toEqual({ exitCode: 1, failed: ['every RPC serves the same block at the snapshot'] });
    });
    it('an RPC that answers with a different block than the one asked for (same hash on both)', async () => {
        const m = { ...deployment(optimismSepolia.id, 'fresh'), servedBlock: HEAD + 7n };
        expect(await failed('op-sepolia', m, structuredClone(m))).toEqual({ exitCode: 1, failed: [
            'every RPC serves the same block at the snapshot', 'the snapshot block did not change during the reads (no reorg)'] });
    });
    it('a reorg on RPC2 after its version() answer: later reads agree, but the snapshot moved', async () => {
        const m = deployment(optimismSepolia.id, 'fresh');
        const m2 = structuredClone(m);
        m2.afterRead = (fn) => {
            if (fn !== 'version' || m2.blockHash !== BLOCK_HASH) return;
            m2.blockHash = ('0x' + 'f0'.repeat(32)) as Hex; // fork B at the same height
            m2.reads[`${m.p.sp}.version`] = 'SuperPaymaster-5.4.2';
        };
        expect(await failed('op-sepolia', m, m2)).toEqual({ exitCode: 1, failed: ['the snapshot block did not change during the reads (no reorg)'] });
    });
    it('a reorg is caught with a single RPC too (upgrade mode)', async () => {
        const m = deployment(sepolia.id, 'upgrade');
        m.afterRead = (fn) => { if (fn === 'version') m.blockHash = ('0x' + 'f0'.repeat(32)) as Hex; };
        const r = await runSp550CutoverGate({ network: 'sepolia', rpcs: [rpc('--rpc', LOOP, m, [])], pins: m.pins });
        expect(r.results.filter((c) => !c.ok).map((c) => c.check)).toEqual(['the snapshot block did not change during the reads (no reorg)']);
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
        expect(await failed(m, structuredClone(m))).toEqual({ exitCode: 1, failed: [`${k} has the same non-empty code on every RPC`, `keccak256(code(${k})) == pins.codehashes.${k}`] });
    });
    it('the Lens has different code on RPC2 while EXPECTED_SP_VERSION agrees', async () => {
        const m = deployment(optimismSepolia.id, 'fresh');
        const m2 = structuredClone(m);
        m2.code[m.p.lens] = '0x6080dead';
        expect(await failed(m, m2)).toEqual({ exitCode: 1, failed: ['superPaymasterLens has the same non-empty code on every RPC', 'keccak256(code(superPaymasterLens)) == pins.codehashes.superPaymasterLens'] });
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
        const r = await runSp550CutoverGate({ network: 'sepolia', rpcs: [rpc('--rpc', LOOP, m, [])], pins: m.pins });
        expect(r.results.filter((c) => !c.ok).map((c) => c.check)).toEqual(['aoaProtocolRegistry has the same non-empty code on every RPC', 'keccak256(code(aoaProtocolRegistry)) == pins.codehashes.aoaProtocolRegistry']);
    });
});

describe('every pinned contract is held to its read-back runtime codehash (DSR 13dbedac)', () => {
    // version() does not identify a build: SP-a at a8b57e17 and the escrow build both answer
    // "SuperPaymaster-5.5.1". A different build at a pinned address must fail on its codehash alone.
    it.each([['sepolia', 'upgrade'], ['op-sepolia', 'fresh']] as const)('%s: same version(), same getters, different code at the Lens -> only the codehash check fails', async (network, mode) => {
        const m = deployment(network === 'sepolia' ? sepolia.id : optimismSepolia.id, mode);
        m.code[m.p.lens] = '0x6080a8b57e17';
        const rpcs = mode === 'fresh' ? twin(m) : [rpc('--rpc', LOOP, m, [])];
        const r = await runSp550CutoverGate({ network, rpcs, pins: m.pins });
        expect(r.exitCode).toBe(1);
        expect(failed(r)).toEqual(['keccak256(code(superPaymasterLens)) == pins.codehashes.superPaymasterLens']);
    });
    it('fresh: an SP-owned book entry with different code fails on its codehash', async () => {
        const m = deployment(optimismSepolia.id, 'fresh');
        m.code[(m.pins as any).addresses.registry] = '0x6080beef';
        const r = await runSp550CutoverGate({ network: 'op-sepolia', rpcs: twin(m), pins: m.pins });
        expect(failed(r)).toEqual(['keccak256(code(addresses.registry)) == pins.codehashes.addresses.registry']);
    });
    it('a pin set without codehashes is not usable', async () => {
        const m = deployment(sepolia.id, 'upgrade');
        const { codehashes: _drop, ...pins } = m.pins as any; BOOKS.set(pins, BOOKS.get(m.pins)!);
        const r = await runSp550CutoverGate({ network: 'sepolia', rpcs: [rpc('--rpc', LOOP, m, [])], pins });
        expect(r.exitCode).toBe(1);
        expect(r.results.find((c) => c.check === 'pins complete and well-formed')!.detail).toMatch(/codehashes: unpinned/);
    });
    it('one pinned address missing from codehashes is not usable', async () => {
        const m = deployment(sepolia.id, 'upgrade');
        const pins = { ...m.pins, codehashes: { ...m.pins.codehashes } }; delete pins.codehashes.globalTierSource; BOOKS.set(pins, BOOKS.get(m.pins)!);
        const r = await runSp550CutoverGate({ network: 'sepolia', rpcs: [rpc('--rpc', LOOP, m, [])], pins });
        expect(r.results.find((c) => c.check === 'pins complete and well-formed')!.detail).toMatch(/codehashes\.globalTierSource: unpinned/);
        expect(failed(r)).toContain('keccak256(code(globalTierSource)) == pins.codehashes.globalTierSource');
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

describe('SP 5.5.0 cutover gate: the snapshot block defaults to finalized', () => {
    it('with no --block, every read is at the lowest finalized block, and the head is never asked for', async () => {
        const m = deployment(optimismSepolia.id, 'fresh');
        const m2 = { ...structuredClone(m), finalized: HEAD + 3n }; // RPC2 finalized further; the snapshot must be the lower one
        const calls: string[] = [];
        const r = await runSp550CutoverGate({ network: 'op-sepolia', rpcs: twin(m, m2, calls), pins: m.pins });
        expect(r.results.filter((c) => !c.ok)).toEqual([]);
        expect(r.exitCode).toBe(0);
        expect(r.header).toMatch(new RegExp(`block ${HEAD} \\(lowest finalized\\)`));
        expect(calls.slice(2, 4)).toEqual(['--rpc:getBlock finalized', '--rpc2:getBlock finalized']);
        expect(calls.some((c) => c.endsWith('getBlockNumber'))).toBe(false);
    });
    it('an RPC that serves no finalized block is refused before any state read (exit 2)', async () => {
        const m = deployment(optimismSepolia.id, 'fresh');
        const calls: string[] = [];
        const r = await runSp550CutoverGate({ network: 'op-sepolia', rpcs: twin(m, { ...structuredClone(m), finalized: null }, calls), pins: m.pins });
        expect(r).toMatchObject({ exitCode: 2, error: expect.stringMatching(/could not read the finalized block .*pass --block/) });
        expect(calls.some((c) => /getStorageAt|getCode|read /.test(c))).toBe(false);
    });
    it('a finalized answer without a block number is refused, not read at an undefined block (exit 2)', async () => {
        const m = deployment(optimismSepolia.id, 'fresh');
        const [a, b] = twin(m);
        const getBlock = b.client.getBlock;
        b.client.getBlock = (async (q: any) => (q.blockTag ? { number: null, hash: null } : getBlock(q))) as any;
        const r = await runSp550CutoverGate({ network: 'op-sepolia', rpcs: [a, b], pins: m.pins });
        expect(r).toMatchObject({ exitCode: 2, error: expect.stringMatching(/--rpc2 served no finalized block number/) });
    });
    it("'latest' (fork rehearsal) takes the lower head instead", async () => {
        const m = deployment(sepolia.id, 'upgrade');
        const calls: string[] = [];
        const r = await runSp550CutoverGate({ network: 'sepolia', rpcs: [rpc('--rpc', LOOP, { ...m, finalized: null }, calls)], pins: m.pins, block: 'latest' });
        expect(r.exitCode).toBe(0);
        expect(r.header).toMatch(/\(lowest latest\)/);
        expect(calls).toContain('--rpc:getBlockNumber');
    });
    it('an explicit block number is used as given', async () => {
        const m = deployment(sepolia.id, 'upgrade');
        const r = await runSp550CutoverGate({ network: 'sepolia', rpcs: [rpc('--rpc', LOOP, { ...m, finalized: null }, [])], pins: m.pins, block: HEAD });
        expect(r.exitCode).toBe(0);
        expect(r.header).toMatch(new RegExp(`block ${HEAD}, pins`));
    });
});

const failed = (r: { results: { check: string; ok: boolean }[] }) => r.results.filter((c) => !c.ok).map((c) => c.check);

describe('SP version comes from the pin (pins.spVersion), never a constant', () => {
    it('a deployed version that differs from the pin fails closed', async () => {
        const m = deployment(optimismSepolia.id, 'fresh');
        const pins = { ...m.pins }; BOOKS.set(pins, BOOKS.get(m.pins)!);
        m.reads[`${m.p.sp}.version`] = 'SuperPaymaster-5.5.0';
        const r = await runSp550CutoverGate({ network: 'op-sepolia', rpcs: twin(m), pins });
        expect(r.exitCode).toBe(1);
        expect(failed(r)).toEqual(['SP.version() == pins.spVersion']);
    });
    it('the Lens check follows the pin: bump the pin (and the SP) but not the Lens, and the Lens check fails', async () => {
        const m = deployment(optimismSepolia.id, 'fresh');
        const pins = { ...m.pins, spVersion: 'SuperPaymaster-5.5.2' }; BOOKS.set(pins, BOOKS.get(m.pins)!);
        m.reads[`${m.p.sp}.version`] = 'SuperPaymaster-5.5.2';
        const r = await runSp550CutoverGate({ network: 'op-sepolia', rpcs: twin(m), pins });
        expect(r.exitCode).toBe(1);
        expect(failed(r)).toEqual(['Lens.EXPECTED_SP_VERSION() == keccak256(pins.spVersion)']);
    });
    it.each([['empty', ''], ['absent', undefined], ['not a 5.5.x string', 'SuperPaymaster-5.4.2']])('an %s spVersion pin fails closed', async (_n, spVersion) => {
        const m = deployment(sepolia.id, 'upgrade');
        const pins: any = { ...m.pins, spVersion }; if (spVersion === undefined) delete pins.spVersion;
        BOOKS.set(pins, BOOKS.get(m.pins)!);
        const r = await runSp550CutoverGate({ network: 'sepolia', rpcs: [rpc('--rpc', LOOP, m, [])], pins });
        expect(r.exitCode).toBe(1);
        expect(failed(r)).toContain('pins complete and well-formed');
        expect(r.results.find((c) => c.check === 'pins complete and well-formed')!.detail).toMatch(/spVersion/);
    });
});

describe('the SDK book names what the gate certified (clestons B1 / N1 / N2)', () => {
    it.each([['sepolia', 'upgrade'], ['op-sepolia', 'fresh']] as const)('%s: a pinned proxy that is not the SDK book\'s fails', async (network, mode) => {
        const m = deployment(network === 'sepolia' ? sepolia.id : optimismSepolia.id, mode);
        const book = { ...BOOKS.get(m.pins)!, superPaymaster: A(0x999) };
        const rpcs = mode === 'fresh' ? twin(m) : [rpc('--rpc', LOOP, m, [])];
        const r = await runSp550CutoverGate({ network, rpcs, pins: m.pins, book });
        expect(r.exitCode).toBe(1);
        expect(failed(r)).toContain('pins.superPaymaster == SDK book superPaymaster');
    });
    it.each([['aPNTs', 'SDK book aPNTs == SP.APNTS_TOKEN()'], ['xPNTsFactory', 'SDK book xPNTsFactory == SP.xpntsFactory()']])(
        'upgrade: a book %s not switched with the cutover fails', async (key, check) => {
            const m = deployment(sepolia.id, 'upgrade');
            const book = { ...BOOKS.get(m.pins)!, [key]: A(0x998) };
            const r = await runSp550CutoverGate({ network: 'sepolia', rpcs: [rpc('--rpc', LOOP, m, [])], pins: m.pins, book });
            expect(r.exitCode).toBe(1);
            expect(failed(r)).toEqual([check]);
        });
    it('fresh: an SDK book entry that differs from its pin fails', async () => {
        const m = deployment(optimismSepolia.id, 'fresh');
        const book = { ...BOOKS.get(m.pins)!, staking: A(0x997) };
        const r = await runSp550CutoverGate({ network: 'op-sepolia', rpcs: twin(m), pins: m.pins, book });
        expect(failed(r)).toEqual(['SDK book staking == addresses.staking']);
    });
    it('fresh: addresses.xPNTsFactory = the SP proxy is an alias, refused (Codex repro of N2)', async () => {
        const m = deployment(optimismSepolia.id, 'fresh');
        const pins = { ...m.pins, addresses: { ...m.pins.addresses!, xPNTsFactory: m.p.sp }, absent: m.pins.absent };
        BOOKS.set(pins, { ...BOOKS.get(m.pins)!, xPNTsFactory: m.p.sp });
        const r = await runSp550CutoverGate({ network: 'op-sepolia', rpcs: twin(m), pins });
        expect(r.exitCode).toBe(1);
        expect(r.results.find((c) => c.check === 'pins complete and well-formed')!.detail).toMatch(/superPaymaster and addresses\.xPNTsFactory are the same address/);
    });
    it('fresh: a key declared absent must not be in the SDK book', async () => {
        const m = deployment(optimismSepolia.id, 'fresh');
        const book = { ...BOOKS.get(m.pins)!, pnts: A(0x996) };
        const r = await runSp550CutoverGate({ network: 'op-sepolia', rpcs: twin(m), pins: m.pins, book });
        expect(failed(r)).toEqual(['SDK book has no pnts (declared absent)']);
    });
});

describe('RPC failures fail the run (exit 1) instead of crashing it (clestons N3)', () => {
    it('getCode throwing on one RPC fails that address check', async () => {
        const m = deployment(optimismSepolia.id, 'fresh');
        const [a, b] = twin(m);
        b.client.getCode = (async () => { throw Object.assign(new Error('pruned'), { shortMessage: 'missing trie node' }); }) as any;
        const r = await runSp550CutoverGate({ network: 'op-sepolia', rpcs: [a, b], pins: m.pins });
        expect(r.exitCode).toBe(1);
        expect(failed(r).some((c) => /has the same non-empty code on every RPC|codehash/.test(c))).toBe(true);
    });
    it('getBlock throwing on one RPC fails the snapshot check', async () => {
        const m = deployment(optimismSepolia.id, 'fresh');
        const [a, b] = twin(m);
        const orig = b.client.getBlock;
        b.client.getBlock = (async (q: any) => { if (q.blockNumber !== undefined) throw new Error('header not found'); return orig(q); }) as any;
        const r = await runSp550CutoverGate({ network: 'op-sepolia', rpcs: [a, b], pins: m.pins });
        expect(r.exitCode).toBe(1);
        expect(failed(r)).toContain('every RPC serves the same block at the snapshot');
    });
});

describe('a single RPC is only for a loopback fork rehearsal (clestons N4)', () => {
    it('sepolia with one non-loopback RPC is refused before any read (exit 2)', async () => {
        const m = deployment(sepolia.id, 'upgrade');
        const calls: string[] = [];
        const r = await runSp550CutoverGate({ network: 'sepolia', rpcs: [rpc('--rpc', 'https://rpc.example', m, calls)], pins: m.pins });
        expect(r).toMatchObject({ exitCode: 2, error: expect.stringMatching(/two independent RPCs/) });
        expect(calls).toEqual([]);
    });
});

describe('pins schema v2: admin extension, Lens version, Registry impl, certified book (DSR a25d86f4 / 9c8cded5)', () => {
    const run = (m: Model, pins: any = m.pins, book?: Record<string, unknown>) =>
        runSp550CutoverGate({ network: 'sepolia', rpcs: [rpc('--rpc', LOOP, m, [])], pins, ...(book ? { book } : {}) });
    it('SP.EXTENSION() pointing at other code fails exactly that row (the fallback would run it)', async () => {
        const m = deployment(sepolia.id, 'upgrade');
        m.reads[`${m.p.sp}.EXTENSION`] = A(0xbad);
        expect(failed(await run(m))).toEqual(['SP.EXTENSION() == pins.spAdminExtension']);
    });
    it('the admin extension is held to its codehash (it has no version())', async () => {
        const m = deployment(sepolia.id, 'upgrade');
        m.code[m.p.admin] = '0x6001';
        expect(failed(await run(m))).toEqual(['keccak256(code(spAdminExtension)) == pins.codehashes.spAdminExtension']);
    });
    it('Lens.version() other than pins.lensVersion fails exactly that row', async () => {
        const m = deployment(sepolia.id, 'upgrade');
        m.reads[`${m.p.lens}.version`] = 'SuperPaymasterLens-1.2.0';
        expect(failed(await run(m))).toEqual(['Lens.version() == pins.lensVersion']);
    });
    it('the Registry proxy running another implementation fails exactly that row', async () => {
        const m = deployment(sepolia.id, 'upgrade');
        m.slots[m.pins.addresses.registry!] = pad(A(0xbad), { size: 32 }) as Hex;
        expect(failed(await run(m))).toEqual(['ERC-1967 impl of addresses.registry == pins.registryImpl']);
    });
    it('upgrade: SP wired to another BLS aggregator than the certified one fails', async () => {
        const m = deployment(sepolia.id, 'upgrade');
        m.reads[`${m.p.sp}.BLS_AGGREGATOR`] = A(0xbad);
        expect(failed(await run(m))).toEqual(['SP.BLS_AGGREGATOR() == addresses.blsAggregator']);
    });
    it('pins read back after the snapshot block fail (PR-Daemon F4: this predicate had no red test)', async () => {
        const m = deployment(sepolia.id, 'upgrade');
        const pins = { ...m.pins, readbackBlock: HEAD + 1n };
        expect(failed(await run(m, pins, BOOKS.get(m.pins)!))).toEqual(['pins.readbackBlock <= snapshot block']);
    });
    it.each(['registry', 'policyRegistry', 'blsAggregator', 'dvtValidator', 'reputationSystem'])(
        'upgrade: an SDK book %s that is not the certified address fails', async (k) => {
            const m = deployment(sepolia.id, 'upgrade');
            expect(failed(await run(m, m.pins, { ...BOOKS.get(m.pins)!, [k]: A(0x996) }))).toEqual([`SDK book ${k} == addresses.${k}`]);
        });
    it.each([
        ['addresses.aPNTs listed', (p: any) => ({ ...p, addresses: { ...p.addresses, aPNTs: p.aPNTsCapped } }), /addresses\.aPNTs: an upgrade derives it from aPNTsCapped/],
        ['addresses.xPNTsFactory listed', (p: any) => ({ ...p, addresses: { ...p.addresses, xPNTsFactory: p.xPNTsFactoryV2 } }), /addresses\.xPNTsFactory: an upgrade derives it from xPNTsFactoryV2/],
        ['an external key', (p: any) => ({ ...p, addresses: { ...p.addresses, entryPoint: A(0x77) } }), /addresses\.entryPoint: external/],
        ['addresses.superPaymaster listed (a moved proxy)', (p: any) => ({ ...p, addresses: { ...p.addresses, superPaymaster: A(0x778) } }), /addresses\.superPaymaster: an upgrade keeps the proxy address/],
        ['a certified key missing', (p: any) => { const { dvtValidator: _d, ...rest } = p.addresses; return { ...p, addresses: rest }; }, /addresses\.dvtValidator: unpinned/],
        ['no hash for a certified entry', (p: any) => { const { 'addresses.registry': _d, ...rest } = p.codehashes; return { ...p, codehashes: rest }; }, /codehashes\.addresses\.registry: unpinned/],
        ['no hash for the admin extension', (p: any) => { const { spAdminExtension: _d, ...rest } = p.codehashes; return { ...p, codehashes: rest }; }, /codehashes\.spAdminExtension: unpinned/],
        ['a malformed lensVersion', (p: any) => ({ ...p, lensVersion: 'Lens-1.2.2' }), /lensVersion: "Lens-1\.2\.2" is not a SuperPaymasterLens-x\.y\.z/],
        ['no disclosureRegistry', (p: any) => { const { disclosureRegistry: _d, ...rest } = p; return rest; }, /disclosureRegistry: unpinned/],
        ['the admin extension aliasing the impl', (p: any) => ({ ...p, spAdminExtension: p.spImpl, codehashes: { ...p.codehashes, spAdminExtension: p.codehashes.spImpl } }), /spImpl and spAdminExtension are the same address/],
    ])('upgrade pins: %s is refused', async (_n, patch, msg) => {
        const m = deployment(sepolia.id, 'upgrade');
        const pins = patch(m.pins);
        BOOKS.set(pins, BOOKS.get(m.pins)!);
        const r = await run(m, pins);
        expect(r.exitCode).toBe(1);
        expect(r.results.find((c) => c.check === 'pins complete and well-formed')!.detail).toMatch(msg);
    });
});

describe('the BLS / DVT / Registry wiring: every leg names the certified contracts (Grok Critical)', () => {
    it.each([
        ['Registry pointing at another aggregator (the 2026-08-26 split)', 'registry', 'blsAggregator', 'Registry.blsAggregator() == addresses.blsAggregator'],
        ['DVTValidator pointing at another aggregator', 'dvtValidator', 'BLS_AGGREGATOR', 'DVTValidator.BLS_AGGREGATOR() == addresses.blsAggregator'],
        ['the aggregator naming another DVTValidator', 'blsAggregator', 'DVT_VALIDATOR', 'BLSAggregator.DVT_VALIDATOR() == addresses.dvtValidator'],
        ['the aggregator wired to another SP', 'blsAggregator', 'SUPERPAYMASTER', 'BLSAggregator.SUPERPAYMASTER() == pins.superPaymaster'],
        ['the Registry wired to another SP', 'registry', 'SUPER_PAYMASTER', 'Registry.SUPER_PAYMASTER() == pins.superPaymaster'],
        ['ReputationSystem on another Registry', 'reputationSystem', 'REGISTRY', 'ReputationSystem.REGISTRY() == addresses.registry'],
    ] as const)('%s fails exactly that row', async (_n, key, fn, check) => {
        const m = deployment(sepolia.id, 'upgrade');
        m.reads[`${(m.pins.addresses as any)[key]}.${fn}`] = A(0xbad);
        const r = await runSp550CutoverGate({ network: 'sepolia', rpcs: [rpc('--rpc', LOOP, m, [])], pins: m.pins });
        expect(failed(r)).toEqual([check]);
    });
});

describe('a single loopback RPC: every loopback spelling (Grok Low)', () => {
    it.each(['http://127.0.0.2:8545', 'http://[::1]:8545', 'http://0.0.0.0:8545', 'http://[::ffff:127.0.0.1]:8545', 'http://localhost.:8545'])('%s is accepted as a fork rehearsal', async (url) => {
        const m = deployment(sepolia.id, 'upgrade');
        const r = await runSp550CutoverGate({ network: 'sepolia', rpcs: [rpc('--rpc', url, m, [])], pins: m.pins });
        expect(r.exitCode).toBe(0);
    });
    it('a public host alone is refused', async () => {
        const m = deployment(sepolia.id, 'upgrade');
        const r = await runSp550CutoverGate({ network: 'sepolia', rpcs: [rpc('--rpc', 'https://rpc.example/', m, [])], pins: m.pins });
        expect(r.exitCode).toBe(2);
    });
});

describe('an upgrade declaring no timelock: the SDK book must not still name one live (Grok r15)', () => {
    it('absent timelockController + a live book entry fails; without the entry it passes', async () => {
        const m = deployment(sepolia.id, 'upgrade');
        const pins = { ...m.pins, absent: ['timelockController'] };
        BOOKS.set(pins, { ...BOOKS.get(m.pins)!, timelockController: A(0x86) });
        const bad = await runSp550CutoverGate({ network: 'sepolia', rpcs: [rpc('--rpc', LOOP, m, [])], pins });
        expect(failed(bad)).toEqual(['SDK book has no live timelockController (declared absent)']);
        // the book's "not deployed" is the zero address (every chain keeps every key)
        BOOKS.set(pins, { ...BOOKS.get(m.pins)!, timelockController: '0x0000000000000000000000000000000000000000' });
        const ok = await runSp550CutoverGate({ network: 'sepolia', rpcs: [rpc('--rpc', LOOP, m, [])], pins });
        expect(failed(ok)).toEqual([]);
    });
});

describe('5.5.0 deploys no DisclosureRegistry (author 2026-11-12): absent stands in for its pin', () => {
    const noDisclosure = (p: any) => {
        const { disclosureRegistry: _d, ...rest } = p;
        const { disclosureRegistry: _h, ...codehashes } = p.codehashes;
        return { ...rest, codehashes, absent: [...(p.absent ?? []), 'disclosureRegistry'] };
    };
    it.each([['sepolia', sepolia.id, 'upgrade'], ['op-sepolia', optimismSepolia.id, 'fresh']] as const)('%s passes without a registry address', async (network, chainId, mode) => {
        const m = deployment(chainId, mode);
        const pins = noDisclosure(m.pins);
        BOOKS.set(pins, BOOKS.get(m.pins)!);
        const r = await runSp550CutoverGate({ network, rpcs: mode === 'fresh' ? twin(m) : [rpc('--rpc', LOOP, m, [])], pins });
        expect(failed(r)).toEqual([]);
        expect(r.exitCode).toBe(0);
    });
    it.each([
        ['pinned and declared absent', (p: any) => ({ ...p, absent: [...(p.absent ?? []), 'disclosureRegistry'] }), /disclosureRegistry: pinned and declared absent/],
        ['a codehash for an absent registry', (p: any) => ({ ...noDisclosure(p), codehashes: { ...p.codehashes } }), /codehashes\.disclosureRegistry: given for a DisclosureRegistry declared absent/],
    ])('upgrade pins: %s is refused', async (_n, patch, msg) => {
        const m = deployment(sepolia.id, 'upgrade');
        const pins = patch(m.pins);
        BOOKS.set(pins, BOOKS.get(m.pins)!);
        const r = await runSp550CutoverGate({ network: 'sepolia', rpcs: [rpc('--rpc', LOOP, m, [])], pins });
        expect(r.exitCode).toBe(1);
        expect(r.results.find((c) => c.check === 'pins complete and well-formed')!.detail).toMatch(msg);
    });
});

describe('sepolia-rc8: a fresh stack coexisting with Sepolia 5.4.2 (DSR 2026-11-19)', () => {
    const shippedSepolia = structuredClone((CANONICAL_ADDRESSES as Record<number, any>)[sepolia.id]);
    const shippedSnapshot = JSON.stringify((CANONICAL_ADDRESSES as Record<number, any>)[sepolia.id]);

    it('resolves as fresh + coexist on chain 11155111, next to the sepolia upgrade entry', () => {
        expect(resolveSp550Network('sepolia-rc8')).toEqual({ network: 'sepolia-rc8', chainId: sepolia.id, mode: 'fresh', coexist: true, allowRc: true });
        expect(resolveSp550Network('sepolia').coexist).toBe(false);
        expect(sp550PinsFor('sepolia-rc8')).toMatchObject({ table: 'SP550_COEXIST_PINS', key: 'sepolia-rc8' });
        expect(sp550PinsFor('sepolia')).toMatchObject({ table: 'SP550_CUTOVER_PINS', key: String(sepolia.id) });
    });

    it('the gate holds its pins against the shipped book overlaid with them, without an injected book', async () => {
        const m = deployment(sepolia.id, 'fresh');
        const r = await rawGate({ network: 'sepolia-rc8', rpcs: twin(m), pins: m.pins });
        expect(r.results.filter((c) => !c.ok)).toEqual([]);
        expect(r.exitCode).toBe(0);
        expect(r.header).toContain('coexisting stack');
    });

    it('held against the shipped Sepolia book itself (no overlay), the same pins fail', async () => {
        const m = deployment(sepolia.id, 'fresh');
        const r = await rawGate({ network: 'sepolia-rc8', rpcs: twin(m), pins: m.pins, book: shippedSepolia });
        expect(r.exitCode).toBe(1);
        expect(r.results.find((c) => c.check === 'pins.superPaymaster == SDK book superPaymaster')?.ok).toBe(false);
    });

    it('its shipped table entry is empty, so the gate and sp550AddressSet fail closed', async () => {
        expect(SP550_COEXIST_PINS['sepolia-rc8']).toEqual({});
        expect(() => sp550AddressSet('sepolia-rc8')).toThrow(/fresh-deploy pins for chain 11155111 are not usable/);
        const m = deployment(sepolia.id, 'fresh');
        expect((await rawGate({ network: 'sepolia-rc8', rpcs: twin(m) })).exitCode).toBe(1);
    });

    it('sp550AddressSet: a complete set — SP entries and client aliases from the pins, external ones shipped, absent ones zero', () => {
        const m = deployment(sepolia.id, 'fresh');
        const set = sp550AddressSet('sepolia-rc8', m.pins);
        const a = set.addresses as Record<string, string>;
        expect(set.chainId).toBe(sepolia.id);
        for (const [k, v] of Object.entries(m.pins.addresses)) expect(a[k]).toBe(v);
        expect(a.gTokenStaking).toBe(m.pins.addresses.staking);
        expect(a.mySBT).toBe(m.pins.addresses.sbt);
        expect(a.entryPoint).toBe(shippedSepolia.entryPoint);
        expect(a.priceFeed).toBe(shippedSepolia.priceFeed);
        expect(set.absent.length).toBeGreaterThan(0);
        for (const k of set.absent) expect(a[k]).toBe('0x0000000000000000000000000000000000000000');
        expect(a.timelockControllerLegacy).toBe('0x0000000000000000000000000000000000000000');
        expect(JSON.stringify((CANONICAL_ADDRESSES as Record<number, any>)[sepolia.id])).toBe(shippedSnapshot); // by value, captured before
        expect(() => sp550AddressSet('sepolia' as any, m.pins)).toThrow('is not a coexisting');
    });

    it('merged the way the client factories merge, no entry of the shipped Sepolia stack survives (Codex r1 H1/H2)', () => {
        const m = deployment(sepolia.id, 'fresh');
        const set = sp550AddressSet('sepolia-rc8', m.pins).addresses as Record<string, string>;
        const used = { ...getCanonicalAddresses(sepolia.id), ...set } as Record<string, string>; // createXClient: { ...chainDefaults, ...addresses }
        const shipped = getCanonicalAddresses(sepolia.id) as Record<string, string>;
        const external = new Set(Object.entries(SP550_ADDRESS_OWNER).filter(([, o]) => o === 'external').map(([k]) => k));
        for (const [k, v] of Object.entries(used)) {
            if (external.has(k)) continue;
            if (v === '0x0000000000000000000000000000000000000000') continue;
            expect(v.toLowerCase(), k).not.toBe(String(shipped[k]).toLowerCase());
        }
        expect(used.gTokenStaking).toBe(m.pins.addresses.staking);
        expect(used.mySBT).toBe(m.pins.addresses.sbt);
        expect(used.paymasterV4).toBe('0x0000000000000000000000000000000000000000');
    });

    it('book aPNTs / xPNTsFactory must be the aPNTsCapped / xPNTsFactoryV2 contracts: a mismatch or an absence is refused (Codex r1 H3/M5)', async () => {
        const m = deployment(sepolia.id, 'fresh');
        const wrongFactory = { ...m.pins, addresses: { ...m.pins.addresses, xPNTsFactory: A(0x999) }, codehashes: { ...m.pins.codehashes, 'addresses.xPNTsFactory': keccak256(codeOf(A(0x999))) } };
        expect(() => sp550AddressSet('sepolia-rc8', wrongFactory)).toThrow(/addresses.xPNTsFactory .* != xPNTsFactoryV2/);
        expect((await rawGate({ network: 'sepolia-rc8', rpcs: twin(m), pins: wrongFactory })).exitCode).toBe(1);
        const { xPNTsFactory: _f, ...noFactory } = m.pins.addresses;
        const { ['addresses.xPNTsFactory']: _h, ...hashes } = m.pins.codehashes;
        const absentFactory = { ...m.pins, addresses: noFactory, codehashes: hashes, absent: [...m.pins.absent!, 'xPNTsFactory'] };
        expect(() => sp550AddressSet('sepolia-rc8', absentFactory as any)).toThrow(/addresses.xPNTsFactory: declared absent, but xPNTsFactoryV2 is pinned/);
        expect((await rawGate({ network: 'sepolia-rc8', rpcs: twin(m), pins: absentFactory as any })).exitCode).toBe(1);
        const wrongApnts = { ...m.pins, aPNTsCapped: A(0x998), codehashes: { ...m.pins.codehashes, aPNTsCapped: keccak256(codeOf(A(0x998))) } };
        expect(() => sp550AddressSet('sepolia-rc8', wrongApnts)).toThrow(/addresses.aPNTs .* != aPNTsCapped/);
    });

    it('the rc.8 stack accepts its v5.5.0-rc.N tag in the gate and the consumer alike; other networks still need --allow-rc (Codex r1 M4)', async () => {
        const m = deployment(sepolia.id, 'fresh');
        const rc = { ...m.pins, tag: 'v5.5.0-rc.8' };
        expect(sp550AddressSet('sepolia-rc8', rc).pins.tag).toBe('v5.5.0-rc.8');
        expect((await rawGate({ network: 'sepolia-rc8', rpcs: twin(m), pins: rc })).exitCode).toBe(0);
        const op = deployment(optimismSepolia.id, 'fresh');
        const opRc = { ...op.pins, tag: 'v5.5.0-rc.8' };
        BOOKS.set(opRc, BOOKS.get(op.pins)!);
        expect((await runSp550CutoverGate({ network: 'op-sepolia', rpcs: twin(op), pins: opRc })).exitCode).toBe(1);
        expect((await runSp550CutoverGate({ network: 'op-sepolia', rpcs: twin(op), pins: opRc, allowRc: true })).exitCode).toBe(0);
    });

    it('resolveSp550Network narrows: a coexist check makes the name usable with sp550AddressSet (Codex r1 L8)', () => {
        const net = resolveSp550Network('sepolia-rc8');
        if (net.coexist) expect(() => sp550AddressSet(net.network)).toThrow(/not usable/); // compiles without a cast
        else throw new Error('sepolia-rc8 must be coexisting');
    });

    it('requireDeployedAddress: a declared-absent (zero) key throws a named error instead of yielding address zero (DSR 2026-11-19)', () => {
        const m = deployment(sepolia.id, 'fresh');
        const set = sp550AddressSet('sepolia-rc8', m.pins);
        expect(requireDeployedAddress(set.addresses, 'superPaymaster', 'sepolia-rc8')).toBe(m.pins.superPaymaster);
        expect(requireDeployedAddress(set.addresses, 'gTokenStaking', 'sepolia-rc8')).toBe(m.pins.addresses.staking);
        for (const k of set.absent) {
            expect(() => requireDeployedAddress(set.addresses, k, 'sepolia-rc8')).toThrow(Sp550NotDeployedError);
            expect(() => requireDeployedAddress(set.addresses, k, 'sepolia-rc8')).toThrow(`the sepolia-rc8 deployment does not include ${k}`);
        }
        expect(() => requireDeployedAddress(set.addresses, 'nope', 'sepolia-rc8')).toThrow(/does not include nope \(no entry\)/);
        expect(() => requireDeployedAddress({ token: '0x12' }, 'token', 'chain read')).toThrow(Sp550NotDeployedError);
        expect(() => requireDeployedAddress(undefined, 'registry', 'sepolia-rc8')).toThrow(Sp550NotDeployedError);
    });

    it('a coexisting stack may not reuse an SP-owned address of the shipped Sepolia stack, even with a matching codehash (Codex r2 H1)', async () => {
        const m = deployment(sepolia.id, 'fresh');
        const old = shippedSepolia.staking as Address;
        const pins = { ...m.pins, addresses: { ...m.pins.addresses, staking: old }, codehashes: { ...m.pins.codehashes, 'addresses.staking': keccak256(codeOf(old)) } };
        expect(sp550CoexistOverlapProblems('sepolia-rc8', pins)).toEqual([expect.stringMatching(/addresses\.staking .* is the shipped stack's staking/)]);
        expect(() => sp550AddressSet('sepolia-rc8', pins)).toThrow(/is the shipped stack's staking/);
        const r = await rawGate({ network: 'sepolia-rc8', rpcs: twin(m), pins });
        expect(r.exitCode).toBe(1);
        expect(r.results.find((c) => c.check === 'pins complete and well-formed')!.detail).toMatch(/is the shipped stack's staking/);
        expect(sp550CoexistOverlapProblems('sepolia-rc8', m.pins)).toEqual([]);
    });

    it('holds are per deployment: holding sepolia-rc8 does not hold the sepolia upgrade, and the reverse (Codex r2 M3)', () => {
        const m = deployment(sepolia.id, 'fresh');
        expect(sp550HoldFor('sepolia-rc8')).toBeUndefined();
        SP550_COEXIST_HOLDS['sepolia-rc8'] = 'test hold';
        try {
            expect(sp550HoldFor('sepolia-rc8')).toBe('test hold');
            expect(sp550HoldFor('sepolia')).toBeUndefined();
            expect(() => sp550AddressSet('sepolia-rc8', m.pins)).toThrow(/release hold: test hold/);
        } finally { delete SP550_COEXIST_HOLDS['sepolia-rc8']; }
        SP550_RELEASE_HOLDS[sepolia.id] = 'chain hold';
        try {
            expect(sp550HoldFor('sepolia')).toBe('chain hold');
            expect(sp550HoldFor('sepolia-rc8')).toBeUndefined();
            expect(sp550AddressSet('sepolia-rc8', m.pins).chainId).toBe(sepolia.id);
        } finally { delete SP550_RELEASE_HOLDS[sepolia.id]; }
        expect(sp550HoldFor('op-mainnet')).toMatch(/3\.2\.2/);
    });

    it('the overlay zeroes the shipped stack\'s history (timelockControllerLegacy), even when it is set (Codex r2 L4)', () => {
        const m = deployment(sepolia.id, 'fresh');
        const book = sp550OverlayBook({ ...shippedSepolia, timelockControllerLegacy: A(0x777) }, m.pins);
        expect(book.timelockControllerLegacy).toBe('0x0000000000000000000000000000000000000000');
        expect(book.entryPoint).toBe(shippedSepolia.entryPoint);
    });

    it.each([
        ['Registry.GTOKEN_STAKING', 'registry', 'GTOKEN_STAKING', 'staking'],
        ['Registry.MYSBT', 'registry', 'MYSBT', 'sbt'],
        ['GTokenStaking.GTOKEN', 'staking', 'GTOKEN', 'gToken'],
        ['MySBT.GTOKEN_STAKING', 'sbt', 'GTOKEN_STAKING', 'staking'],
    ] as const)('every pin new and correct, but %s() still names the shipped stack → the gate fails (Codex r3 H2)', async (label, holder, fn, oldKey) => {
        const m = deployment(sepolia.id, 'fresh');
        m.reads[`${m.pins.addresses[holder]}.${fn}`] = shippedSepolia[oldKey];
        const r = await rawGate({ network: 'sepolia-rc8', rpcs: twin(m), pins: m.pins });
        expect(r.exitCode).toBe(1);
        // The explicit leg fails, and the exhaustive scan names the same getter.
        expect(r.results.filter((c) => !c.ok).map((c) => c.check)).toContainEqual(expect.stringContaining(label.split('.')[1]));
    });

    it('the chain-keyed validator refuses a chain that hosts a coexisting stack (Codex r3 M3)', () => {
        const m = deployment(sepolia.id, 'fresh');
        expect(() => requireSp550FreshDeployPins(sepolia.id, m.pins, { allowRc: true })).toThrow(/no chain-keyed fresh SP 5.5.0 stack/);
        const old = shippedSepolia.staking as Address;
        const overlap = { ...m.pins, addresses: { ...m.pins.addresses, staking: old }, codehashes: { ...m.pins.codehashes, 'addresses.staking': keccak256(codeOf(old)) } };
        expect(sp550NetworkPinProblems('sepolia-rc8', overlap).problems).toEqual([expect.stringMatching(/shipped stack's staking/)]);
        SP550_COEXIST_HOLDS['sepolia-rc8'] = 'held';
        try { expect(sp550NetworkPinProblems('sepolia-rc8', m.pins).hold).toBe('held'); } finally { delete SP550_COEXIST_HOLDS['sepolia-rc8']; }
    });

    it.each([
        ['xPNTsFactoryV2.REGISTRY', (m: any) => `${m.p.factory}.REGISTRY`],
        ['PaymasterFactory.registry', (m: any) => `${m.pins.addresses.paymasterFactory}.registry`],
        ['X402Facilitator.REGISTRY', (m: any) => `${m.pins.addresses.x402Facilitator}.REGISTRY`],
    ] as const)('%s() naming the shipped Registry fails the gate (Codex r4 H1)', async (label, key) => {
        const m = deployment(sepolia.id, 'fresh');
        m.reads[key(m)] = shippedSepolia.registry;
        const r = await rawGate({ network: 'sepolia-rc8', rpcs: twin(m), pins: m.pins });
        expect(r.exitCode).toBe(1);
        expect(r.results.filter((c) => !c.ok).map((c) => c.check)).toContainEqual(expect.stringContaining(label));
    });

    it('the exhaustive scan: ANY address getter naming a shipped-stack contract fails, even one no hand check reads (Codex r4 H1)', async () => {
        const m = deployment(sepolia.id, 'fresh');
        // GTokenStaking.treasury() is in the vendored ABI and is checked by no explicit comparison.
        m.reads[`${m.pins.addresses.staking}.treasury`] = shippedSepolia.superPaymaster;
        const r = await rawGate({ network: 'sepolia-rc8', rpcs: twin(m), pins: m.pins });
        expect(r.exitCode).toBe(1);
        const bad = r.results.filter((c) => !c.ok);
        expect(bad.map((c) => c.check)).toEqual(['address getters of addresses.staking name no shipped-stack contract']);
        expect(bad[0].detail).toMatch(/treasury\(\) names .* \(the shipped stack's superPaymaster\)/);
    });

    it('the scan fails on RPC disagreement, on one RPC failing, and on a revert not listed as unsupported (Codex r5 H1)', async () => {
        const m = deployment(sepolia.id, 'fresh');
        const t = `${m.pins.addresses.staking}.treasury`;
        // Disagreement: rpc2 sees another address.
        const m2 = structuredClone(m); m2.reads[t] = A(0xabc);
        let r = await rawGate({ network: 'sepolia-rc8', rpcs: twin(m, m2), pins: m.pins });
        expect(r.results.filter((c) => !c.ok).map((c) => c.check)).toEqual(['address getters of addresses.staking name no shipped-stack contract']);
        // One RPC fails the call.
        const m3 = structuredClone(m); m3.revertUnset = true;
        r = await rawGate({ network: 'sepolia-rc8', rpcs: twin(m, m3), pins: m.pins });
        expect(r.exitCode).toBe(1);
        // Both revert: fails unless the getter is listed as unsupported for this entry.
        const both = { ...deployment(sepolia.id, 'fresh'), revertUnset: true };
        r = await rawGate({ network: 'sepolia-rc8', rpcs: twin(both, structuredClone(both)), pins: both.pins });
        expect(r.exitCode).toBe(1);
        expect(r.results.find((c) => c.check === 'address getters of addresses.staking name no shipped-stack contract')!.detail).toMatch(/treasury\(\) ERR/);
    });

    it('every pinned entry is scanned or has a reasoned exemption (Codex r5 H3)', () => {
        const m = deployment(sepolia.id, 'fresh');
        for (const [entry] of sp550PinnedAddressEntries(m.pins)) expect(entry in SP550_WIRING_SCAN_ABI || entry in SP550_WIRING_SCAN_EXEMPT, entry).toBe(true);
        expect(SP550_WIRING_SCAN_ABI['addresses.paymasterV4Impl']).toBeDefined();
    });

    it('a new Paymaster implementation wired to the shipped Registry fails; so does a facilitator on an unrelated factory (Codex r5 H3/M4)', async () => {
        let m = deployment(sepolia.id, 'fresh');
        m.reads[`${m.pins.addresses.paymasterV4Impl}.registry`] = shippedSepolia.registry;
        let r = await rawGate({ network: 'sepolia-rc8', rpcs: twin(m), pins: m.pins });
        expect(r.results.filter((c) => !c.ok).map((c) => c.check)).toContainEqual('PaymasterV4 impl registry() == addresses.registry');
        m = deployment(sepolia.id, 'fresh');
        m.reads[`${m.pins.addresses.x402Facilitator}.XPNTS_FACTORY`] = A(0xbeef); // not a pin, not the shipped stack
        r = await rawGate({ network: 'sepolia-rc8', rpcs: twin(m), pins: m.pins });
        expect(r.results.filter((c) => !c.ok).map((c) => c.check)).toEqual(['X402Facilitator.XPNTS_FACTORY() == pins.xPNTsFactoryV2']);
    });

    it('a chain-keyed fresh stack still passes after its switch put the pinned addresses into CANONICAL_ADDRESSES (Codex r5 H2)', async () => {
        const m = deployment(optimismSepolia.id, 'fresh');
        const live = (CANONICAL_ADDRESSES as Record<number, any>)[optimismSepolia.id];
        const saved = { ...live };
        Object.assign(live, BOOKS.get(m.pins)); // the post-write state the re-run gate imports: switched entries in,
        for (const k of m.pins.absent ?? []) delete live[k]; // declared-absent ones removed (bookSwitch: null)
        try {
            const r = await rawGate({ network: 'op-sepolia', rpcs: twin(m), pins: m.pins });
            expect(r.results.filter((c) => !c.ok)).toEqual([]);
        } finally { for (const k of Object.keys(live)) delete live[k]; Object.assign(live, saved); }
    });

    it('GlobalTierSource.REGISTRY() naming an unrelated address (not the shipped stack) fails (Codex r6 H1)', async () => {
        const m = deployment(sepolia.id, 'fresh');
        m.reads[`${m.p.tier}.REGISTRY`] = A(0xbad);
        const r = await rawGate({ network: 'sepolia-rc8', rpcs: twin(m), pins: m.pins });
        expect(r.results.filter((c) => !c.ok).map((c) => c.check)).toEqual(['GlobalTierSource.REGISTRY() == addresses.registry']);
    });

    it('an address inside an array getter (Paymaster getSupportedTokens) naming the shipped aPNTs fails the coexist scan (Codex r6 H2)', async () => {
        const m = deployment(sepolia.id, 'fresh');
        m.reads[`${m.pins.addresses.paymasterV4Impl}.getSupportedTokens`] = [A(0x123), shippedSepolia.aPNTs];
        const r = await rawGate({ network: 'sepolia-rc8', rpcs: twin(m), pins: m.pins });
        const bad = r.results.filter((c) => !c.ok);
        expect(bad.map((c) => c.check)).toEqual(['address getters of addresses.paymasterV4Impl name no shipped-stack contract']);
        expect(bad[0].detail).toMatch(/getSupportedTokens\(\) names .* \(the shipped stack's aPNTs\)/);
    });

    it('addresses.paymasterV4 = addresses.aPNTsPaymasterV4 is a declared alias (the shipped books use it) (Codex r6 M5)', () => {
        const m = deployment(sepolia.id, 'fresh');
        const pm = A(0x4321);
        const hash = keccak256(codeOf(pm));
        const pins = { ...m.pins, addresses: { ...m.pins.addresses, paymasterV4: pm, aPNTsPaymasterV4: pm },
            absent: m.pins.absent!.filter((k: string) => k !== 'paymasterV4' && k !== 'aPNTsPaymasterV4'),
            codehashes: { ...m.pins.codehashes, 'addresses.paymasterV4': hash, 'addresses.aPNTsPaymasterV4': hash } };
        expect(sp550NetworkPinProblems('sepolia-rc8', pins as any).problems).toEqual([]);
    });
});
