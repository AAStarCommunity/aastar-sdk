import { describe, expect, it } from 'vitest';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BaseError, ContractFunctionExecutionError, ContractFunctionRevertedError, ContractFunctionZeroDataError, type Abi } from 'viem';
import { sp550PinnedAddressEntries } from '../packages/core/src/sp550Cutover.js';
import {
    AMSTERDAM_PROBE_PREDICATE, READBACK_CONTRACT_FIELDS, VERSION_NOT_IN_INTERFACE, recordedProbeProblems, READBACK_HEADER_FIELDS, READBACK_SCHEMA, READBACK_SCHEMA_FILE,
    classifyCallError, contractKeyOf, loadReadbackValidator, probeProblems, readbackProblems, type ChainReader, type Measured, type Observed,
} from './sp550-readback-compare-core.js';

const A = (n: number) => ('0x' + n.toString(16).padStart(40, '0')) as `0x${string}`;
const H = (n: number) => ('0x' + n.toString(16).padStart(2, '0').repeat(32)) as `0x${string}`;
const PINS: any = {
    tag: 'v5.5.0-rc.8', spVersion: 'SuperPaymaster-5.5.1', superPaymaster: A(0x10), spImpl: A(0x11), spImplCodehash: H(0x11),
    spAdminExtension: A(0x12), superPaymasterLens: A(0x13), lensVersion: 'SuperPaymasterLens-1.2.2', xPNTsFactoryV2: A(0x14),
    xPNTsTokenV2Impl: A(0x15), xPNTsTokenV2Ext: A(0x16), aoaProtocolRegistry: A(0x17), globalTierSource: A(0x18), aPNTsCapped: A(0x19),
    registryImpl: A(0x1b), disclosureRegistry: A(0x1c), readbackBlock: 500n,
    addresses: { registry: A(0x21), policyRegistry: A(0x22), blsAggregator: A(0x23), dvtValidator: A(0x24), reputationSystem: A(0x25) },
};
PINS.codehashes = Object.fromEntries(sp550PinnedAddressEntries(PINS).map(([k, a]) => [k, k === 'spImpl' ? PINS.spImplCodehash : H(parseInt((a as string).slice(-2), 16))]));
const DUMP = 'ab'.repeat(32);
const ANVIL = '4e8874b2bdc840929585ca73e170993c50a4a531';
const CTX = { chainId: 11155111, mode: 'upgrade' as const, source: 'fork' as const, allowRc: true, forkBlock: 400n, dumpSha256: DUMP, hardfork: 'amsterdam', anvilCommit: ANVIL, spCommit: 'c0ffee'.padEnd(40, '0') };
const BLOCK_HASH = H(0xbb);

/** The chain as the SDK reads it: versions where the contract has one, owners for SP and the Registry. */
const CHAIN: Record<string, Partial<Record<'version' | 'owner' | 'pendingOwner', Observed>>> = {
    [A(0x10)]: { version: { kind: 'value', value: 'SuperPaymaster-5.5.1' }, owner: { kind: 'value', value: A(0xb0) }, pendingOwner: { kind: 'value', value: A(0) } },
    [A(0x13)]: { version: { kind: 'value', value: 'SuperPaymasterLens-1.2.2' } },
    [A(0x19)]: { version: { kind: 'value', value: 'APNTsCapped-1.0.0' } },
    [A(0x21)]: { version: { kind: 'value', value: 'Registry-5.10.0' }, owner: { kind: 'value', value: A(0xb0) }, pendingOwner: { kind: 'reverted' } },
};
// Every other pinned contract has a version() except the two that have none by design (spAdminExtension, xPNTsTokenV2Ext).
for (const [k, a] of sp550PinnedAddressEntries(PINS)) {
    if (!CHAIN[a as string] && k !== 'spAdminExtension' && k !== 'xPNTsTokenV2Ext') CHAIN[a as string] = { version: { kind: 'value', value: `${k}-1.0.0` } };
}
/** Code on chain: each pinned address holds the code its pin names. */
const CODE: Record<string, string> = Object.fromEntries(sp550PinnedAddressEntries(PINS).map(([k, a]) => [(a as string).toLowerCase(), PINS.codehashes[k]]));
const SLOTS: Record<string, string> = { [A(0x10)]: A(0x11), [A(0x21)]: A(0x1b) };
const reader = (chain = CHAIN, code = CODE, slots = SLOTS, blockHash = BLOCK_HASH): ChainReader => async (address, what) => {
    if (what === 'blockHash') return { kind: 'value', value: blockHash };
    if (what === 'codehash') return { kind: 'value', value: code[address.toLowerCase()] ?? 'none' };
    if (what === 'erc1967Impl') return { kind: 'value', value: slots[address] ?? A(0) };
    if (what === 'EXTENSION') return address === A(0x10) ? { kind: 'value', value: A(0x12) } : { kind: 'reverted' };
    return chain[address]?.[what] ?? { kind: 'reverted' };
};

/** A fork read-back that is schema-valid and agrees with PINS and CHAIN. */
function good(): any {
    const contracts: Record<string, any> = {};
    for (const [pinName, a] of sp550PinnedAddressEntries(PINS)) {
        if (pinName === 'spImpl' || pinName === 'registryImpl') continue; // covered by the proxies' fields
        const onChain = CHAIN[a as string] ?? {};
        contracts[contractKeyOf(pinName)] = {
            address: (a as string).toUpperCase().replace('0X', '0x'), codehash: PINS.codehashes[pinName],
            version: onChain.version?.kind === 'value' ? onChain.version.value : null,
            erc1967Impl: 'n/a:not a proxy', implCodehash: 'n/a:not a proxy', extension: 'n/a:no extension', extensionCodehash: 'n/a:no extension',
            owner: 'n/a:not compared', pendingOwner: 'n/a:not compared', guardian: null, roles: {},
        };
    }
    Object.assign(contracts.superPaymaster, { erc1967Impl: PINS.spImpl, implCodehash: PINS.spImplCodehash, extension: PINS.spAdminExtension, extensionCodehash: PINS.codehashes.spAdminExtension, owner: A(0xb0), pendingOwner: A(0), OPERATOR_WITHDRAWAL_WINDOW: 86400 });
    Object.assign(contracts.registry, { erc1967Impl: PINS.registryImpl, implCodehash: PINS.codehashes.registryImpl, owner: A(0xb0), pendingOwner: null });
    contracts.multiSendCallOnly = { ...contracts.xPNTsTokenV2Ext, address: A(0x99), version: 'n/a:Safe library, no version()' }; // not a pin: not compared
    return {
        schema: READBACK_SCHEMA,
        header: {
            source: 'fork', spCommit: CTX.spCommit, tag: 'v5.5.0-rc.8', chainId: 11155111, hardfork: 'amsterdam', forkBlock: 400, readbackBlock: 500,
            readbackBlockHash: BLOCK_HASH, anvilVersion: 'anvil Version: 1.8.7-nightly', anvilCommit: ANVIL, dumpSha256: DUMP,
            providers: ['alchemy', 'tenderly'],
            ethConfig: { provider: 'alchemy', activationTime: 1791294816, forkId: '0x6c1d9423', corroboration: { provider: 'tenderly', blockNumber: 400, blockAccessListHash: true, slotNumber: true } },
        },
        contracts,
        checks: { 'superPaymaster.OPERATOR_WITHDRAWAL_WINDOW': 86400, 'community.creditPolicy': 'unreadable:example' },
        amsterdamProbe: {
            initcode: '0x6000600055', sender: A(0xdd), method: 'eth_estimateGas at forkBlock; receipt gasUsed',
            estimateLive: { alchemy: 53000, tenderly: 53000 }, estimateFork: 53000, gasUsedFork: 52000,
            expected: { estimate: 53000, gasUsed: 52000, source: 'live estimate; SP gasUsed' }, predicate: AMSTERDAM_PROBE_PREDICATE,
        },
    };
}
const run = (rb: any, o: { chain?: typeof CHAIN; ctx?: any; code?: typeof CODE; slots?: typeof SLOTS; pins?: any; blockHash?: string } = {}) =>
    readbackProblems(rb, o.pins ?? PINS, o.ctx ?? CTX, reader(o.chain, o.code, o.slots, o.blockHash));

describe('the binding schema (sha256-pinned)', () => {
    it("SP's example instance validates", () => {
        const example = JSON.parse(fs.readFileSync(path.join(path.dirname(READBACK_SCHEMA_FILE), 'aoa-a7-readback-1.example.json'), 'utf8'));
        expect(loadReadbackValidator()(example)).toEqual([]);
    });
    it("SP's live example instance validates", () => {
        const example = JSON.parse(fs.readFileSync(path.join(path.dirname(READBACK_SCHEMA_FILE), 'aoa-a7-readback-1.live.example.json'), 'utf8'));
        expect(example.header.source).toBe('live');
        expect(loadReadbackValidator()(example)).toEqual([]);
    });
    it('the vendored examples are the ones SP published', () => {
        const sha = (f: string) => createHash('sha256').update(new Uint8Array(fs.readFileSync(path.join(path.dirname(READBACK_SCHEMA_FILE), f)))).digest('hex');
        expect(sha('aoa-a7-readback-1.example.json')).toBe('c58133b9f8dfe2317af96c6a9a43e7b2521900a69c591843f5c0afb6233b4812');
        expect(sha('aoa-a7-readback-1.live.example.json')).toBe('61926c93fee774900765f9e9eca5d2dee44921d6191751929b18932d140e2b85');
    });
    it('the fixture validates', () => expect(loadReadbackValidator()(good())).toEqual([]));
    it('a schema file with another hash is refused before use', () => {
        const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rb-')), 's.json');
        fs.writeFileSync(f, fs.readFileSync(READBACK_SCHEMA_FILE, 'utf8') + ' ');
        expect(() => loadReadbackValidator(f)).toThrow(/sha256 .* != pinned/);
    });
    it.each([
        ['an omitted header field', (rb: any) => { delete rb.header.readbackBlockHash; }],
        ['an omitted contract field', (rb: any) => { delete rb.contracts.xPNTsTokenV2Ext.guardian; }],
        ['a bare "unreadable"', (rb: any) => { rb.contracts.xPNTsTokenV2Ext.owner = 'unreadable'; }],
        ['a top-level key outside the schema', (rb: any) => { rb.extra = 1; }],
        ['no amsterdamProbe', (rb: any) => { delete rb.amsterdamProbe; }],
        ['a malformed forkId', (rb: any) => { rb.header.ethConfig.forkId = '0x6c1d94'; }],
        ['a version on a contract without version() by design (schema 2228c0b6)', (rb: any) => { rb.contracts.spAdminExtension.version = 'Admin-1'; }],
        ['a null version on any other contract (schema 2228c0b6)', (rb: any) => { rb.contracts.registry.version = null; }],
    ])('an invalid file is refused before anything is compared: %s', async (_n, mutate) => {
        const rb = good(); mutate(rb);
        const p = await run(rb);
        expect(p.length).toBeGreaterThan(0);
        expect(p.every((x) => x.startsWith('schema: '))).toBe(true);
    });
});

describe('readbackProblems: a read-back that agrees with the pins and the chain passes', () => {
    it('A7 fork: every fact checked', async () => expect(await run(good())).toEqual([]));
    it('live: no anvil, no dump (anvilVersion "n/a:…" valid since schema 61d30b82)', async () => {
        const rb = good();
        Object.assign(rb.header, { source: 'live', anvilVersion: 'n/a:live', anvilCommit: 'n/a:live', dumpSha256: 'n/a:live' });
        expect(await run(rb, { ctx: { chainId: 11155111, mode: 'upgrade', source: 'live', allowRc: true } })).toEqual([]);
    });
    it('the header / contract field lists match the schema', () => {
        const schema = JSON.parse(fs.readFileSync(READBACK_SCHEMA_FILE, 'utf8'));
        expect([...schema.$defs.header.required].sort()).toEqual([...READBACK_HEADER_FIELDS].sort());
        expect([...schema.$defs.contract.required].sort()).toEqual([...READBACK_CONTRACT_FIELDS].sort());
    });
});

describe('readbackProblems refuses', () => {
    it.each([
        ['another source', (rb: any) => { rb.header.source = 'live'; }, /header\.source "live" != fork/],
        ['another chain', (rb: any) => { rb.header.chainId = 1; }, /header\.chainId 1 != 11155111/],
        ['another dump', (rb: any) => { rb.header.dumpSha256 = 'cd'.repeat(32); }, /header\.dumpSha256 .* != the loaded dump/],
        ['another fork block', (rb: any) => { rb.header.forkBlock = 401; rb.header.ethConfig.corroboration.blockNumber = 401; }, /header\.forkBlock 401 != 400/],
        ['another hardfork', (rb: any) => { rb.header.hardfork = 'prague'; }, /header\.hardfork "prague" != amsterdam/],
        ['another anvil commit', (rb: any) => { rb.header.anvilCommit = 'f'.repeat(40); }, /header\.anvilCommit .* != the anvil this run used/],
        ['another SP commit', (rb: any) => { rb.header.spCommit = 'd'.repeat(40); }, /header\.spCommit .* != the SP checkout/],
        ['another tag', (rb: any) => { rb.header.tag = 'v5.5.0-rc.7'; }, /header\.tag "v5\.5\.0-rc\.7" != pins\.tag/],
        ['a null tag', (rb: any) => { rb.header.tag = null; }, /header\.tag null != pins\.tag/],
        ['another readback block', (rb: any) => { rb.header.readbackBlock = 499; }, /header\.readbackBlock 499 != pins\.readbackBlock 500/],
        ['another block hash at the read-back block', (rb: any) => { rb.header.readbackBlockHash = H(0xcc); }, /header\.readbackBlockHash .* != block 500 on chain/],
        ['a provider URL', (rb: any) => { rb.header.providers = ['alchemy', 'tenderly', 'https://x.example/key']; }, /not a provider NAME/],
        ['another Amsterdam activation', (rb: any) => { rb.header.ethConfig.activationTime = 1; }, /activationTime 1 != Amsterdam 1791294816/],
        ['another fork id', (rb: any) => { rb.header.ethConfig.forkId = '0x00000000'; }, /forkId "0x00000000" != Amsterdam 0x6c1d9423/],
        ['no Amsterdam-only header fields on the second provider', (rb: any) => { rb.header.ethConfig.corroboration.slotNumber = false; }, /corroboration: Amsterdam-only header fields not both present/],
        ['the same provider corroborating itself', (rb: any) => { rb.header.ethConfig.corroboration.provider = 'alchemy'; }, /must be a second one/],
        ['corroboration at another block', (rb: any) => { rb.header.ethConfig.corroboration.blockNumber = 1; }, /corroboration\.blockNumber 1 != header\.forkBlock 400/],
        ['a pinned contract left out', (rb: any) => { delete rb.contracts.dvtValidator; }, /^contracts\.dvtValidator: omitted$/],
        ['another address', (rb: any) => { rb.contracts.superPaymasterLens.address = A(0x99); }, /contracts\.superPaymasterLens\.address .* != pinned/],
        ['another codehash', (rb: any) => { rb.contracts.spAdminExtension.codehash = H(0x99); }, /contracts\.spAdminExtension\.codehash .* != pins\.codehashes\.spAdminExtension/],
        ['a book entry with another codehash', (rb: any) => { rb.contracts.blsAggregator.codehash = H(0x99); }, /contracts\.blsAggregator\.codehash .* != pins\.codehashes\.addresses\.blsAggregator/],
        ['"n/a:…" as the version of a contract that has version()', (rb: any) => { rb.contracts.registry.version = 'n/a:none'; }, /contracts\.registry\.version "n\/a:none" != version\(\) on chain "Registry-5\.10\.0"/],
        ['"unreadable:…" where the SDK reads a version', (rb: any) => { rb.contracts.aPNTsCapped.version = 'unreadable:timeout'; }, /contracts\.aPNTsCapped\.version "unreadable:timeout" != version\(\) on chain/],
        ['another SP implementation', (rb: any) => { rb.contracts.superPaymaster.erc1967Impl = A(0x99); }, /contracts\.superPaymaster\.erc1967Impl .* != pinned/],
        ['another Registry implementation hash', (rb: any) => { rb.contracts.registry.implCodehash = H(0x99); }, /contracts\.registry\.implCodehash .* != pinned/],
        ['another extension', (rb: any) => { rb.contracts.superPaymaster.extension = A(0x99); }, /contracts\.superPaymaster\.extension .* != pinned/],
        ['an implementation on a non-proxy', (rb: any) => { rb.contracts.superPaymasterLens.erc1967Impl = A(0x99); }, /superPaymasterLens\.erc1967Impl .* not a proxy here/],
        ['another SP owner', (rb: any) => { rb.contracts.superPaymaster.owner = A(0x99); }, /contracts\.superPaymaster\.owner .* != owner\(\) on chain/],
        ['a Registry pendingOwner although it has none', (rb: any) => { rb.contracts.registry.pendingOwner = A(0); }, /registry\.pendingOwner .*, but pendingOwner\(\) reverts on chain/],
    ])('%s', async (_n, mutate, msg) => {
        const rb = good(); mutate(rb);
        const p = await run(rb);
        expect(p).toEqual(expect.arrayContaining([expect.stringMatching(msg)]));
        expect(p).toHaveLength(1);
    });
    it('a live read-back that names an anvil or a dump', async () => {
        const rb = good(); rb.header.source = 'live';
        expect(await run(rb, { ctx: { chainId: 11155111, mode: 'upgrade', source: 'live', allowRc: true } }))
            .toEqual(['anvilVersion', 'anvilCommit', 'dumpSha256'].map((k) => expect.stringMatching(new RegExp(`header\\.${k} .*expected "n/a:…"`))));
    });
    it('no provider at all', async () => {
        const rb = good(); rb.header.providers = [];
        expect(await run(rb)).toEqual(expect.arrayContaining(['header.providers: empty']));
    });
    it('a fork comparison without the loaded dump facts is refused', async () => {
        expect(await run(good(), { ctx: { ...CTX, anvilCommit: undefined } })).toEqual([expect.stringMatching(/^context: a fork read-back/)]);
    });
    it('a chain with no Amsterdam reference cannot pass', async () => {
        const rb = good(); rb.header.chainId = 1;
        expect(await run(rb, { ctx: { ...CTX, chainId: 1 } })).toContain('header.ethConfig: no Amsterdam reference for chain 1');
    });
    it('incomplete pins are refused before anything is compared (no vacuous pass)', async () => {
        const rb = good(); rb.contracts = {};
        const p = await run(rb, { pins: { tag: 'v5.5.0-rc.8', readbackBlock: 500n } });
        expect(p.length).toBeGreaterThan(5);
        expect(p.every((x) => x.startsWith('pins: '))).toBe(true);
    });
    it('a file and pins that agree with each other but not with the chain fail: code', async () => {
        expect(await run(good(), { code: { ...CODE, [A(0x23)]: H(0x77) } })).toEqual([`contracts.blsAggregator: code on chain ${H(0x77)} != pins.codehashes.addresses.blsAggregator "${H(0x23)}"`]);
    });
    it('…: the Registry running another implementation', async () => {
        expect(await run(good(), { slots: { ...SLOTS, [A(0x21)]: A(0x99) } })).toEqual(expect.arrayContaining([expect.stringMatching(/contracts\.registry: ERC-1967 slot on chain 0x0+99 != pinned/)]));
    });
    it('…: the implementation behind the right slot carrying other code', async () => {
        expect(await run(good(), { code: { ...CODE, [A(0x11)]: H(0x77) } })).toEqual(expect.arrayContaining([expect.stringMatching(/contracts\.superPaymaster: implementation code on chain .* != pinned/)]));
    });
    it.each(['superPaymaster', 'superPaymasterLens', 'aPNTsCapped'])('a reverting version() on %s is a failure, never "absent by design"', async (k) => {
        const a = PINS[k];
        const rb = good(); rb.contracts[k].version = 'unreadable:execution reverted';
        expect(await run(rb, { chain: { ...CHAIN, [a]: { ...CHAIN[a], version: { kind: 'reverted' } } } })).toContain(`contracts.${k}: version() reverts on chain, but ${k} must have one`);
    });
    it('a reverting version() on the Registry is a failure too: absence comes from the interface, not a revert (Codex r2 H3)', async () => {
        const rb = good(); rb.contracts.registry.version = 'unreadable:execution reverted';
        expect(await run(rb, { chain: { ...CHAIN, [A(0x21)]: { ...CHAIN[A(0x21)], version: { kind: 'reverted' } } } })).toEqual(['contracts.registry: version() reverts on chain, but registry must have one']);
    });
    it('a contract without version() by design answering one is a failure (other code at that address?)', async () => {
        const rb = good(); // the file says null (as the schema requires); the chain answers a version
        expect(await run(rb, { chain: { ...CHAIN, [A(0x12)]: { version: { kind: 'value', value: 'X-1' } } } })).toEqual([
            'contracts.spAdminExtension: version() answers "X-1", but spAdminExtension has none by design (is this the pinned code?)',
            'contracts.spAdminExtension.version null != version() on chain "X-1"',
        ]);
    });
    it('the snapshot block changing during the reads fails', async () => {
        let n = 0;
        const r = reader();
        const moving: ChainReader = async (a, w) => (w === 'blockHash' ? { kind: 'value', value: n++ === 0 ? BLOCK_HASH : H(0xcc) } : r(a, w));
        expect(await readbackProblems(good(), PINS, CTX, moving)).toEqual([expect.stringMatching(/^snapshot: block 500 changed during the reads/)]);
    });
    it('SP without pendingOwner() is a failure (it is Ownable2Step)', async () => {
        const rb = good(); rb.contracts.superPaymaster.pendingOwner = null;
        expect(await run(rb, { chain: { ...CHAIN, [A(0x10)]: { ...CHAIN[A(0x10)], pendingOwner: { kind: 'reverted' } } } })).toEqual(['contracts.superPaymaster: pendingOwner() reverts on chain, but superPaymaster must have one']);
    });
    it('the chain disagreeing with a version pin is reported even when the file matches the chain', async () => {
        const rb = good(); rb.contracts.superPaymasterLens.version = 'SuperPaymasterLens-1.2.0';
        expect(await run(rb, { chain: { ...CHAIN, [A(0x13)]: { version: { kind: 'value', value: 'SuperPaymasterLens-1.2.0' } } } }))
            .toEqual(['contracts.superPaymasterLens: version() "SuperPaymasterLens-1.2.0" != its pin "SuperPaymasterLens-1.2.2"']);
    });
    it('a read the SDK could not make is a problem, not a pass', async () => {
        expect(await run(good(), { chain: { ...CHAIN, [A(0x21)]: { ...CHAIN[A(0x21)], owner: { kind: 'error', detail: 'timeout' } } } }))
            .toEqual(['contracts.registry.owner: the SDK could not read owner() (timeout)']);
    });
});

describe('amsterdamProbe', () => {
    const v = (n: number): Measured => ({ kind: 'value', value: BigInt(n) });
    const OK = { estimateFork: v(53000), gasUsedFork: v(52000), estimateLive: v(53000) };
    it("SP's recorded probe passes on its own terms, and the SDK's matching measurements pass", () => {
        expect(recordedProbeProblems(good().amsterdamProbe)).toEqual([]);
        expect(probeProblems(good().amsterdamProbe, OK)).toEqual([]);
    });
    it.each([
        ['another predicate', (pr: any) => { pr.predicate = 'false'; }, /predicate "false" is not the agreed rule/],
        ['a provider disagreeing', (pr: any) => { pr.estimateLive.tenderly = 53001; }, /estimateLive\.tenderly 53001 != estimateFork 53000/],
        ['no provider', (pr: any) => { pr.estimateLive = {}; }, /estimateLive: no provider/],
        ['gasUsedFork off expected', (pr: any) => { pr.gasUsedFork = 52001; }, /gasUsedFork 52001 != expected\.gasUsed 52000/],
        ['estimateFork off expected while every provider agrees with it', (pr: any) => { pr.estimateFork = 53001; pr.estimateLive = { alchemy: 53001 }; }, /^amsterdamProbe\.estimateFork 53001 != expected\.estimate 53000$/],
        ['a non-positive gas amount', (pr: any) => { pr.gasUsedFork = -5; pr.expected.gasUsed = -5; }, /gasUsedFork -5 is not a positive gas amount/],
    ])('the recorded probe fails, with or without --probe: %s', async (_n, mutate, msg) => {
        const pr = good().amsterdamProbe; mutate(pr);
        expect(recordedProbeProblems(pr)).toEqual(expect.arrayContaining([expect.stringMatching(msg)]));
        const rb = good(); mutate(rb.amsterdamProbe);
        expect(await run(rb)).toEqual(expect.arrayContaining([expect.stringMatching(msg)]));
    });
    it.each([
        ["the SDK's fork estimate differs", { ...OK, estimateFork: v(1) }, /the SDK's estimate on its fork 1 != SP's 53000/],
        ["the SDK's fork gasUsed differs (CREATE priced like 1.8.6)", { ...OK, gasUsedFork: v(52000 + 183600) }, /the SDK's whole-tx receipt gasUsed on its fork 235600 != SP's 52000/],
        ["the SDK's own live estimate differs", { ...OK, estimateLive: v(9) }, /the SDK's live estimate from its own upstream 9 != SP's 53000/],
        ['a measurement the SDK could not make', { ...OK, gasUsedFork: { kind: 'error', detail: 'ProbeReverted' } as Measured }, /could not measure whole-tx receipt gasUsed .*ProbeReverted/],
    ])('the SDK measurement fails: %s', (_n, mine, msg) => {
        expect(probeProblems(good().amsterdamProbe, mine as any)).toEqual([expect.stringMatching(msg)]);
    });
});

describe('Codex r3: version by interface, alias hashes, independent corroboration', () => {
    it('the no-version() interface table matches the core ABI (it cannot drift silently)', async () => {
        const { TimelockControllerABI, SuperPaymasterV550ABI } = await import('../packages/core/src/abis/index.js');
        const hasVersion = (abi: any[]) => abi.some((e) => e.type === 'function' && e.name === 'version' && !e.inputs?.length);
        expect(VERSION_NOT_IN_INTERFACE).toEqual(new Set(['timelockController']));
        expect(hasVersion(TimelockControllerABI as any[])).toBe(false);
        expect(hasVersion(SuperPaymasterV550ABI as any[])).toBe(true);
    });
    it('a book contract whose interface has no version() reports "n/a:…" (null is reserved by the schema)', async () => {
        const pins = { ...PINS, addresses: { ...PINS.addresses, timelockController: A(0x26) }, codehashes: { ...PINS.codehashes, 'addresses.timelockController': H(0x26) } };
        const rb = good();
        rb.contracts.timelockController = { ...rb.contracts.xPNTsTokenV2Ext, address: A(0x26), codehash: H(0x26), version: 'n/a:no version() in the OZ TimelockController interface' };
        const code = { ...CODE, [A(0x26)]: H(0x26) };
        expect(await run(rb, { pins, code })).toEqual([]);
        rb.contracts.timelockController.version = 'unreadable:timeout';
        expect(await run(rb, { pins, code })).toEqual([expect.stringMatching(/timelockController\.version "unreadable:timeout": timelockController's interface has no version\(\)/)]);
    });
    it('an alias book entry with its own, different codehash pin is refused (it would never be compared)', async () => {
        const pins = { ...PINS, addresses: { ...PINS.addresses, superPaymaster: PINS.superPaymaster }, codehashes: { ...PINS.codehashes, 'addresses.superPaymaster': H(0x77) } };
        expect(await run(good(), { pins })).toEqual(expect.arrayContaining([expect.stringMatching(/pins: codehashes\.addresses\.superPaymaster .* != codehashes\.superPaymaster/)]));
    });
    it('an unnamed eth_config provider cannot vouch for independent corroboration', async () => {
        const rb = good(); delete rb.header.ethConfig.provider; rb.header.providers = ['alchemy']; rb.header.ethConfig.corroboration.provider = 'alchemy';
        expect(await run(rb)).toEqual(['header.ethConfig.provider: omitted (the eth_config provider must be named to prove corroboration is independent)']);
    });
    it('a corroborating provider outside header.providers is refused', async () => {
        const rb = good(); rb.header.ethConfig.corroboration.provider = 'infura';
        expect(await run(rb)).toEqual(['header.ethConfig.corroboration.provider "infura" is not in header.providers']);
    });
});

describe('classifyCallError on real viem error graphs', () => {
    const abi = [{ type: 'function', name: 'version', inputs: [], outputs: [{ type: 'string' }], stateMutability: 'view' }] as Abi;
    const wrap = (cause: BaseError) => new ContractFunctionExecutionError(cause, { abi, functionName: 'version', args: [], contractAddress: A(1) });
    it('a revert is "reverted"', () => {
        expect(classifyCallError(wrap(new ContractFunctionRevertedError({ abi, functionName: 'version', data: '0x' })))).toEqual({ kind: 'reverted' });
    });
    it('empty return data is "reverted"', () => {
        expect(classifyCallError(wrap(new ContractFunctionZeroDataError({ functionName: 'version' })))).toEqual({ kind: 'reverted' });
    });
    it('a transport failure is an error, never "reverted"', () => {
        expect(classifyCallError(wrap(new BaseError('fetch failed'))).kind).toBe('error');
        expect(classifyCallError(new Error('socket hang up'))).toEqual({ kind: 'error', detail: 'Error: socket hang up' });
    });
});
