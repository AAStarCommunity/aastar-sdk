import { afterEach, describe, expect, it } from 'vitest';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BaseError, ContractFunctionExecutionError, ContractFunctionRevertedError, ContractFunctionZeroDataError, type Abi } from 'viem';
import { sp550PinnedAddressEntries } from '../packages/core/src/sp550Cutover.js';
import {
    AMSTERDAM_PROBE_PREDICATE, READBACK_CONTRACT_FIELDS, aggregateAmsterdam, VERSION_NOT_IN_INTERFACE, recordedProbeProblems, READBACK_HEADER_FIELDS, READBACK_SCHEMA, READBACK_SCHEMA_FILE,
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
    [A(0x21)]: { version: { kind: 'value', value: 'Registry-5.10.0' }, owner: { kind: 'value', value: A(0xb0) }, pendingOwner: { kind: 'value', value: A(0) } },
};
// Every other pinned contract has a version() except the two that have none by design (spAdminExtension, xPNTsTokenV2Ext).
for (const [k, a] of sp550PinnedAddressEntries(PINS)) {
    if (!CHAIN[a as string] && k !== 'spAdminExtension' && k !== 'xPNTsTokenV2Ext') CHAIN[a as string] = { version: { kind: 'value', value: `${k}-1.0.0` } };
}
/** Code on chain: each pinned address holds the code its pin names. */
const CODE: Record<string, string> = Object.fromEntries(sp550PinnedAddressEntries(PINS).map(([k, a]) => [(a as string).toLowerCase(), PINS.codehashes[k]]));
const SLOTS: Record<string, string> = { [A(0x10)]: A(0x11), [A(0x21)]: A(0x1b) };
let PENDING_SLOT: Record<string, string> = { [A(0x21)]: A(0) };
let AMSTERDAM: Observed = { kind: 'value', value: JSON.stringify({ blockAccessListHash: true, slotNumber: true, ethConfigs: [{ activationTime: 1791294816, forkId: '0x6c1d9423' }] }) };
const reader = (chain = CHAIN, code = CODE, slots = SLOTS, blockHash = BLOCK_HASH): ChainReader => async (address, what) => {
    if (what === 'blockHash') return { kind: 'value', value: blockHash };
    if (what === 'ownership2StepSlot') return { kind: 'value', value: PENDING_SLOT[address] ?? A(0) };
    if (what === 'amsterdamAtForkBlock') return AMSTERDAM;
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
            owner: 'n/a:not compared', pendingOwner: 'n/a:not compared', guardian: null, roles: 'n/a:no role system',
        };
    }
    Object.assign(contracts.superPaymaster, { erc1967Impl: PINS.spImpl, implCodehash: PINS.spImplCodehash, extension: PINS.spAdminExtension, extensionCodehash: PINS.codehashes.spAdminExtension, owner: A(0xb0), pendingOwner: A(0), OPERATOR_WITHDRAWAL_WINDOW: 86400 });
    Object.assign(contracts.registry, { erc1967Impl: PINS.registryImpl, implCodehash: PINS.codehashes.registryImpl, owner: A(0xb0), pendingOwner: A(0) }); // from its ERC-7201 slot
    // Contracts the schema requires but the SDK does not pin: schema-checked only, not compared.
    contracts.multiSendCallOnly = { ...contracts.xPNTsTokenV2Ext, address: A(0x99), version: 'n/a:Safe library, no version()' };
    contracts.gTokenStaking = { ...contracts.xPNTsTokenV2Ext, address: A(0x9a), version: 'GTokenStaking-3.2.0' };
    contracts.entryPoint = { ...contracts.xPNTsTokenV2Ext, address: A(0x9b), version: 'n/a:EntryPoint v0.7 has no version()', getDepositInfo: { deposit: '0', staked: false } };
    contracts.ownerSafe = { ...contracts.xPNTsTokenV2Ext, address: A(0x9c), version: '1.4.1' };
    contracts.evaluationCommunityToken = { ...contracts.xPNTsTokenV2Ext, address: A(0x9d), version: 'XPNTs-4.0.3' };
    contracts.registry.roles = { ROLE_COMMUNITY: [A(0x66)] }; // the registry has a role system
    // Contract-specific fields the schema requires (BLS, entryPoint, evaluation community, …): taken from
    // SP's own fork example, so the fixture follows the binding schema instead of a hand-kept copy.
    const example = JSON.parse(fs.readFileSync(path.join(path.dirname(READBACK_SCHEMA_FILE), 'aoa-a7-readback-1.example.json'), 'utf8'));
    for (const [k, c] of Object.entries(example.contracts as Record<string, Record<string, unknown>>)) {
        if (!contracts[k] || c === null) continue;
        for (const [f, v] of Object.entries(c)) if (!(READBACK_CONTRACT_FIELDS as readonly string[]).includes(f)) contracts[k][f] = v;
    } // not a pin: not compared
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
            initcode: '0x60206000f3', sender: A(0xdd), method: 'eth_simulateV1 / eth_call at forkBlock; receipt gasUsed',
            estimateLive: { alchemy: 259849, tenderly: 259849 }, estimateFork: 256645, estimateSimulate: { alchemy: 256645, tenderly: 'n/a:no eth_simulateV1' },
            gasUsedFork: 256645, callAtGasUsed: { alchemy: true, tenderly: true }, callAtGasUsedMinusOne: { alchemy: false, tenderly: false },
            expected: { gasUsed: 256645, source: 'SP A7 fork receipt; upstream eth_simulateV1' }, predicate: AMSTERDAM_PROBE_PREDICATE,
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
        expect(sha('aoa-a7-readback-1.example.json')).toBe('20fd1d952f52b195ab3379038be27ac63619ec76eff8a04796318b3d7a4da11b');
        expect(sha('aoa-a7-readback-1.live.example.json')).toBe('a184468e12e157781433bef06dbe4c187710f1306c53d9824495d59200da9e7e');
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
        ['a required contract dropped (schema 3bf4bba2)', (rb: any) => { delete rb.contracts.ownerSafe; }],
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
    afterEach(() => {
        PENDING_SLOT = { [A(0x21)]: A(0) };
        AMSTERDAM = { kind: 'value', value: JSON.stringify({ blockAccessListHash: true, slotNumber: true, ethConfigs: [{ activationTime: 1791294816, forkId: '0x6c1d9423' }] }) };
    });
    it.each([
        ['an upstream block without Amsterdam header fields', { kind: 'value', value: JSON.stringify({ blockAccessListHash: false, slotNumber: false }) }, /the upstream block 400 lacks Amsterdam header fields/],
        ['an upstream eth_config that is not Amsterdam', { kind: 'value', value: JSON.stringify({ blockAccessListHash: true, slotNumber: true, ethConfigs: [{ activationTime: 1791294816, forkId: '0x6c1d9423' }, { activationTime: 1, forkId: '0x00000000' }] }) }, /the upstream eth_config reports .*not Amsterdam/],
        ['no upstream to check against', { kind: 'error', detail: 'a fork read-back needs SP550_FORK_URL' }, /the SDK could not read the upstream at forkBlock 400/],
    ] as const)('the file copying Amsterdam constants is not enough (Grok High): %s', async (_n, obs, msg) => {
        AMSTERDAM = obs as Observed;
        expect(await run(good())).toEqual([expect.stringMatching(msg)]);
    });
    it('an upstream answer that is not JSON is a problem, not a crash', async () => {
        AMSTERDAM = { kind: 'value', value: 'not json' };
        expect(await run(good())).toEqual(expect.arrayContaining([expect.stringMatching(/the upstream answer is not a JSON object/)]));
    });
    it('an upstream without eth_config is fine when the header fields are there', async () => {
        AMSTERDAM = { kind: 'value', value: JSON.stringify({ blockAccessListHash: true, slotNumber: true, ethConfigs: [] }) };
        expect(await run(good())).toEqual([]);
        // one provider serves eth_config and one does not (the schema's corroboration case): its config is checked alone
        AMSTERDAM = { kind: 'value', value: JSON.stringify({ blockAccessListHash: true, slotNumber: true, ethConfigs: [{ activationTime: 1791294816, forkId: '0x6c1d9423' }] }) };
        expect(await run(good())).toEqual([]);
    });
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
        ['another Amsterdam activation', (rb: any) => { rb.header.ethConfig.activationTime = 1; }, /activationTime 1 != Amsterdam 1791294816/],
        ['another fork id', (rb: any) => { rb.header.ethConfig.forkId = '0x00000000'; }, /forkId "0x00000000" != Amsterdam 0x6c1d9423/],
        ['no Amsterdam-only header fields on the second provider', (rb: any) => { rb.header.ethConfig.corroboration.slotNumber = false; }, /corroboration: Amsterdam-only header fields not both present/],
        ['the same provider corroborating itself', (rb: any) => { rb.header.ethConfig.corroboration.provider = 'alchemy'; }, /must be a second one/],
        ['corroboration at another block', (rb: any) => { rb.header.ethConfig.corroboration.blockNumber = 1; }, /corroboration\.blockNumber 1 != header\.forkBlock 400/],
        ['another address', (rb: any) => { rb.contracts.superPaymasterLens.address = A(0x99); }, /contracts\.superPaymasterLens\.address .* != pinned/],
        ['another codehash', (rb: any) => { rb.contracts.xPNTsTokenV2Ext.codehash = H(0x99); }, /contracts\.xPNTsTokenV2Ext\.codehash .* != pins\.codehashes\.xPNTsTokenV2Ext/],
        ['a book entry with another codehash', (rb: any) => { rb.contracts.blsAggregator.codehash = H(0x99); }, /contracts\.blsAggregator\.codehash .* != pins\.codehashes\.addresses\.blsAggregator/],
        ['"n/a:…" as the version of a contract that has version()', (rb: any) => { rb.contracts.registry.version = 'n/a:none'; }, /contracts\.registry\.version "n\/a:none" != version\(\) on chain "Registry-5\.10\.0"/],
        ['"unreadable:…" where the SDK reads a version', (rb: any) => { rb.contracts.aPNTsCapped.version = 'unreadable:timeout'; }, /contracts\.aPNTsCapped\.version "unreadable:timeout" != version\(\) on chain/],
        ['another SP implementation', (rb: any) => { rb.contracts.superPaymaster.erc1967Impl = A(0x99); }, /contracts\.superPaymaster\.erc1967Impl .* != pinned/],
        ['another Registry implementation hash', (rb: any) => { rb.contracts.registry.implCodehash = H(0x99); }, /contracts\.registry\.implCodehash .* != pinned/],
        ['another extension', (rb: any) => { rb.contracts.superPaymaster.extension = A(0x99); }, /contracts\.superPaymaster\.extension .* != pinned/],
        ['an implementation on a non-proxy', (rb: any) => { rb.contracts.superPaymasterLens.erc1967Impl = A(0x99); }, /superPaymasterLens\.erc1967Impl .* not a proxy here/],
        ['another SP owner', (rb: any) => { rb.contracts.superPaymaster.owner = A(0x99); }, /contracts\.superPaymaster\.owner .* != owner\(\) on chain/],
        ['another Registry pendingOwner than its getter', (rb: any) => { rb.contracts.registry.pendingOwner = A(0x55); PENDING_SLOT = { [A(0x21)]: A(0x55) }; }, /contracts\.registry\.pendingOwner .* != pendingOwner\(\) on chain/],
    ])('%s', async (_n, mutate, msg) => {
        const rb = good(); mutate(rb);
        const p = await run(rb);
        expect(p).toEqual(expect.arrayContaining([expect.stringMatching(msg)]));
        expect(p).toHaveLength(1);
    });
    it("the SP entry's extensionCodehash must equal the spAdminExtension entry's codehash (x-readMethods)", async () => {
        const rb = good(); rb.contracts.spAdminExtension.codehash = H(0x99);
        const p = await run(rb);
        expect(p).toHaveLength(2);
        expect(p).toEqual(expect.arrayContaining([
            expect.stringMatching(/contracts\.spAdminExtension\.codehash .* != pins\.codehashes\.spAdminExtension/),
            expect.stringMatching(/contracts\.superPaymaster\.extensionCodehash .* != contracts\.spAdminExtension\.codehash/),
        ]));
    });
    it("the Registry's ERC-7201 pending-owner slot must agree with its getter and the file (SP 248ef831)", async () => {
        PENDING_SLOT = { [A(0x21)]: A(0x66) };
        try { expect(await run(good())).toEqual([`contracts.registry.pendingOwner "${A(0)}" != ERC-7201 slot 0xdb5a3168abaa6147a9f3a4cb66016161119d4d50b6393344d27120286f742a00 on chain ${A(0x66)}`]); }
        finally { PENDING_SLOT = { [A(0x21)]: A(0) }; }
    });
    it('a live read-back that names an anvil or a dump', async () => {
        const rb = good(); rb.header.source = 'live';
        expect(await run(rb, { ctx: { chainId: 11155111, mode: 'upgrade', source: 'live', allowRc: true } }))
            .toEqual(['anvilVersion', 'anvilCommit', 'dumpSha256'].map((k) => expect.stringMatching(new RegExp(`header\\.${k} .*expected "n/a:…"`))));
    });
    it('a provider URL', async () => {
        const rb = good(); rb.header.providers = ['alchemy', 'tenderly', 'https://x.example/key'];
        expect(await run(rb)).toEqual(expect.arrayContaining([expect.stringMatching(/not a provider NAME/)]));
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

describe('amsterdamProbe (revision 3: simulateV1 judged, estimates recorded only)', () => {
    const v = (n: number): Measured => ({ kind: 'value', value: BigInt(n) });
    const OK = { gasUsedFork: v(256645), simulateUpstream: v(256645), callUpstream: v(1), callFork: v(1) };
    it("SP's recorded probe passes on its own terms, and the SDK's matching measurements pass", () => {
        expect(recordedProbeProblems(good().amsterdamProbe)).toEqual([]);
        expect(probeProblems(good().amsterdamProbe, OK)).toEqual([]);
    });
    it('estimates with headroom are recorded, never judged (reth 259849 vs exact 256645)', () => {
        const rb = good(); rb.amsterdamProbe.estimateLive = { alchemy: 259849, tenderly: 259849 }; rb.amsterdamProbe.estimateFork = 1;
        expect(recordedProbeProblems(rb.amsterdamProbe, rb.header.providers)).toEqual([]);
    });
    it.each([
        ['callAtGasUsed for an unrelated provider', (pr: any) => { pr.callAtGasUsed = { unrelated: true }; }, /callAtGasUsed covers providers \["unrelated"\], not header\.providers \["alchemy","tenderly"\]/],
        ['estimateSimulate for an unrelated provider', (pr: any) => { pr.estimateSimulate = { unrelated: 256645 }; }, /estimateSimulate covers providers \["unrelated"\]/],
        ['a provider missing from callAtGasUsed', (pr: any) => { delete pr.callAtGasUsed.tenderly; }, /callAtGasUsed covers providers \["alchemy"\]/],
        ['one key spelling two providers ("alchemy,tenderly", Codex r5)', (pr: any) => {
            for (const m of ['estimateLive', 'estimateSimulate', 'callAtGasUsed', 'callAtGasUsedMinusOne']) pr[m] = { 'alchemy,tenderly': Object.values(pr[m])[0] };
        }, /estimateLive covers providers \["alchemy,tenderly"\], not header\.providers \["alchemy","tenderly"\]/],
    ])('provider coverage (Codex r4): %s', async (_n, mutate, msg) => {
        const rb = good(); mutate(rb.amsterdamProbe);
        expect(await run(rb)).toEqual(expect.arrayContaining([expect.stringMatching(msg)]));
    });
    it.each([
        ['another predicate', (pr: any) => { pr.predicate = 'true'; }, /predicate "true" is not the agreed rule/],
        ['a simulateV1 gasUsed off the fork receipt', (pr: any) => { pr.estimateSimulate.alchemy = 256646; }, /estimateSimulate\.alchemy 256646 != gasUsedFork 256645/],
        ['no provider with simulateV1', (pr: any) => { pr.estimateSimulate = { alchemy: 'n/a:no eth_simulateV1' }; }, /no provider supplied eth_simulateV1/],
        ['gasUsedFork off expected', (pr: any) => { pr.gasUsedFork = 256646; pr.estimateSimulate.alchemy = 256646; }, /gasUsedFork 256646 != expected\.gasUsed 256645/],
        ['eth_call at gasUsed failing on a provider', (pr: any) => { pr.callAtGasUsed.tenderly = false; }, /callAtGasUsed\.tenderly is false/],
        ['no callAtGasUsed provider', (pr: any) => { pr.callAtGasUsed = {}; }, /callAtGasUsed(: no provider| covers providers \[\])/],
        ['a non-positive gas amount', (pr: any) => { pr.gasUsedFork = 0; pr.expected.gasUsed = 0; pr.estimateSimulate.alchemy = 0; }, /gasUsedFork 0 is not a positive gas amount/],
    ])('the recorded probe fails, with or without --probe: %s', async (_n, mutate, msg) => {
        const pr = good().amsterdamProbe; mutate(pr);
        expect(recordedProbeProblems(pr)).toEqual(expect.arrayContaining([expect.stringMatching(msg)]));
        const rb = good(); mutate(rb.amsterdamProbe);
        expect(await run(rb)).toEqual(expect.arrayContaining([expect.stringMatching(msg)]));
    });
    it.each([
        ["the SDK's fork gasUsed differs (CREATE priced like stable 1.8.6)", { ...OK, gasUsedFork: v(256645 - 183600) }, /the SDK's whole-tx receipt gasUsed on its fork 73045 != SP's 256645/],
        ["the SDK's upstream simulateV1 differs", { ...OK, simulateUpstream: v(256600) }, /eth_simulateV1 gasUsed on its own upstream 256600 != SP's 256645/],
        ['eth_call at gasUsed failing on the upstream', { ...OK, callUpstream: { kind: 'error', detail: 'CallExecutionError' } as Measured }, /eth_call at gas = expected\.gasUsed on its own upstream failed/],
        ['eth_call at gasUsed failing on the fork', { ...OK, callFork: { kind: 'error', detail: 'CallExecutionError' } as Measured }, /on its fork failed/],
        ['a fork measurement the SDK could not make', { ...OK, gasUsedFork: { kind: 'error', detail: 'ProbeReverted' } as Measured }, /could not measure whole-tx receipt gasUsed .*ProbeReverted/],
    ])('the SDK measurement fails: %s', (_n, mine, msg) => {
        expect(probeProblems(good().amsterdamProbe, mine as any)).toEqual([expect.stringMatching(msg)]);
    });
    it('an upstream without eth_simulateV1 is n/a, not a failure (SP must still supply one)', () => {
        expect(probeProblems(good().amsterdamProbe, { ...OK, simulateUpstream: { kind: 'n/a', detail: 'upstream has no eth_simulateV1 (-32601)' } })).toEqual([]);
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
        rb.contracts.timelockController = { ...rb.contracts.xPNTsTokenV2Ext, address: A(0x26), codehash: H(0x26), version: 'n/a:no version() in the OZ TimelockController interface', roles: { PROPOSER_ROLE: [A(0x67)] } };
        const code = { ...CODE, [A(0x26)]: H(0x26) };
        expect(await run(rb, { pins, code })).toEqual([]);
        rb.contracts.timelockController.version = 'unreadable:timeout';
        expect(await run(rb, { pins, code })).toEqual([expect.stringMatching(/timelockController\.version "unreadable:timeout": timelockController's interface has no version\(\)/)]);
    });
    it('an alias book entry with its own, different codehash pin is refused (it would never be compared)', async () => {
        const pins = { ...PINS, addresses: { ...PINS.addresses, superPaymaster: PINS.superPaymaster }, codehashes: { ...PINS.codehashes, 'addresses.superPaymaster': H(0x77) } };
        expect(await run(good(), { pins })).toEqual(expect.arrayContaining([expect.stringMatching(/^pins: codehashes\.(addresses\.)?superPaymaster .* != codehashes\.(addresses\.)?superPaymaster/)]));
    });
    it('an unnamed eth_config provider cannot vouch for independent corroboration', async () => {
        const rb = good(); delete rb.header.ethConfig.provider; rb.header.providers = ['alchemy']; rb.header.ethConfig.corroboration.provider = 'alchemy';
        expect(await run(rb)).toEqual(expect.arrayContaining(['header.ethConfig.provider: omitted (the eth_config provider must be named to prove corroboration is independent)']));
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

describe('book keys renamed in the read-back (SP: staking -> gTokenStaking)', () => {
    it('addresses.staking is compared as contracts.gTokenStaking; other book keys keep their name', () => {
        expect(contractKeyOf('addresses.staking')).toBe('gTokenStaking');
        expect(contractKeyOf('addresses.registry')).toBe('registry');
        expect(contractKeyOf('superPaymaster')).toBe('superPaymaster');
    });
});

describe('aggregateAmsterdam: header VALUES agree across upstreams (Grok)', () => {
    const H = '0x' + 'ab'.repeat(32);
    it('agreeing well-formed values pass, every served eth_config is handed on', () => {
        const o = aggregateAmsterdam([{ blockAccessListHash: H, slotNumber: '0x10', ethConfig: { activationTime: 1, forkId: '0x1' } }, { blockAccessListHash: H, slotNumber: '0x10', ethConfig: null }]);
        expect(o).toEqual({ kind: 'value', value: JSON.stringify({ blockAccessListHash: true, slotNumber: true, ethConfigs: [{ activationTime: 1, forkId: '0x1' }] }) });
    });
    it('two well-formed but different hashes are a disagreement, not a pass', () => {
        expect(aggregateAmsterdam([{ blockAccessListHash: H, slotNumber: '0x10' }, { blockAccessListHash: '0x' + 'cd'.repeat(32), slotNumber: '0x10' }]).kind).toBe('error');
        expect(aggregateAmsterdam([{ blockAccessListHash: H, slotNumber: '0x10' }, { blockAccessListHash: H, slotNumber: '0x11' }]).kind).toBe('error');
    });
    it('an all-zero hash or a missing field is not Amsterdam', () => {
        expect(JSON.parse((aggregateAmsterdam([{ blockAccessListHash: '0x' + '00'.repeat(32), slotNumber: '0x1' }]) as any).value).blockAccessListHash).toBe(false);
        expect(JSON.parse((aggregateAmsterdam([{ slotNumber: '0x1' }]) as any).value).blockAccessListHash).toBe(false);
    });
    it('a failed upstream is an error', () => expect(aggregateAmsterdam(['ERR HttpRequestError']).kind).toBe('error'));
    it('slotNumber compares as a quantity: 0x10 == 0x010 (Grok)', () => {
        expect(aggregateAmsterdam([{ blockAccessListHash: H, slotNumber: '0x10' }, { blockAccessListHash: H.toUpperCase().replace('0X', '0x'), slotNumber: '0x010' }]).kind).toBe('value');
    });
    it('a JSON null answer is a problem, not a crash', async () => {
        AMSTERDAM = { kind: 'value', value: 'null' };
        try { expect(await run(good())).toEqual(expect.arrayContaining([expect.stringMatching(/not a JSON object/)])); }
        finally { AMSTERDAM = { kind: 'value', value: JSON.stringify({ blockAccessListHash: true, slotNumber: true, ethConfigs: [{ activationTime: 1791294816, forkId: '0x6c1d9423' }] }) }; }
    });
});

describe('a pinned timelock must be in the read-back (schema 543f3498: timelockController optional)', () => {
    it('pins with addresses.timelockController and a read-back without it fail', async () => {
        const pins = { ...PINS, addresses: { ...PINS.addresses, timelockController: A(0x26) }, codehashes: { ...PINS.codehashes, 'addresses.timelockController': H(0x26) } };
        expect(await run(good(), { pins, code: { ...CODE, [A(0x26)]: H(0x26) } })).toContain('contracts.timelockController: omitted');
    });
    it('pins without a timelock and a read-back without one pass', async () => expect(await run(good())).toEqual([]));
});

describe('a contract the pins declare absent must not be in the read-back (Grok)', () => {
    it('pins absent: [timelockController] and a read-back with one fail', async () => {
        const rb = good(); rb.contracts.timelockController = { ...rb.contracts.xPNTsTokenV2Ext, address: A(0x26), codehash: H(0x26), version: 'n/a:none', roles: {} };
        expect(await run(rb, { pins: { ...PINS, absent: ['timelockController'] } })).toEqual([expect.stringMatching(/contracts\.timelockController: not an "n\/a:" not-deployed placeholder/)]);
    });
    it('an "n/a:not deployed" placeholder is not a contradiction (Codex r14)', async () => {
        const rb = good();
        rb.contracts.timelockController = { ...rb.contracts.xPNTsTokenV2Ext, address: 'n/a:not deployed', codehash: 'n/a:not deployed', version: 'n/a:not deployed', roles: 'unreadable:not deployed' };
        expect(await run(rb, { pins: { ...PINS, absent: ['timelockController'] } })).toEqual([]);
    });
    it.each([
        ['an n/a address with a real codehash', { address: 'n/a:x', codehash: H(0x26) }],
        ['an unreadable address', { address: 'unreadable:timeout', codehash: 'n/a:x' }],
        ['n/a address/codehash but a real implementation (Codex r16)', { address: 'n/a:x', codehash: 'n/a:x', erc1967Impl: A(0x27), implCodehash: H(0x27) }],
    ])('a declared-absent contract with %s is a contradiction', async (_n, patch) => {
        const rb = good();
        rb.contracts.timelockController = { ...rb.contracts.xPNTsTokenV2Ext, version: 'n/a:none', roles: 'unreadable:x', ...patch };
        expect(await run(rb, { pins: { ...PINS, absent: ['timelockController'] } })).toEqual(expect.arrayContaining([expect.stringMatching(/not an "n\/a:" not-deployed placeholder/)]));
    });
});
