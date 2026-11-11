import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { getAddress } from 'viem';
import { PINS_FILE_ALIASES, SP_REPO, UPGRADE_SWITCHABLE_KEYS, isLoopbackHost, spCommitOnMain, upgradeBookProblems, addressesOverlap, normalizeIp, applyBookSwitch, bookSwitch, changedEntries, fillPinsTable, isLoopbackUrl, spLiveReadbackProblems, spReadbackApiPath, withTimelockLegacy, writeAll, type WriteIo, parseManifestPins, switchBook } from './sp550-pin-fill-core.js';
import { sp550PinProblems, sp550PinnedAddressEntries } from '../packages/core/src/sp550Cutover.js';
import { CANONICAL_ADDRESSES } from '../packages/core/src/addresses.js';

const SRC = path.resolve(import.meta.dirname, '../packages/core/src');
const A = (n: number) => ('0x' + n.toString(16).padStart(40, '0')) as `0x${string}`;
const MANIFEST = {
    tag: 'v5.5.0-rc.8', spVersion: 'SuperPaymaster-5.5.1', superPaymaster: '0x09DF0d2e3722EC0e401fE3819E64278a42ae4DE9',
    spImpl: A(0x11), spImplCodehash: '0x' + 'ab'.repeat(32), superPaymasterLens: A(0x13), xPNTsFactoryV2: A(0x14),
    xPNTsTokenV2Impl: A(0x15), xPNTsTokenV2Ext: A(0x16), aoaProtocolRegistry: A(0x17), globalTierSource: A(0x18),
    aPNTsCapped: A(0x19), readbackBlock: 12_345_678,
    spAdminExtension: A(0x1a), lensVersion: 'SuperPaymasterLens-1.2.2', registryImpl: A(0x1b), disclosureRegistry: A(0x1c), timelockController: 'n/a:none',
    addresses: { registry: A(0x21), policyRegistry: A(0x22), blsAggregator: A(0x23), dvtValidator: A(0x24), reputationSystem: A(0x25) },
} as Record<string, any>;
MANIFEST.codehashes = Object.fromEntries(sp550PinnedAddressEntries(MANIFEST as any).map(([k], i) =>
    [k, k === 'spImpl' ? MANIFEST.spImplCodehash : '0x' + (i + 1).toString(16).padStart(2, '0').repeat(32)]));

/** Write `source` next to the real module so its imports resolve, import it, delete it. */
const temps: string[] = [];
afterEach(() => { for (const f of temps.splice(0)) fs.rmSync(f, { force: true }); });
async function load(name: string, source: string) {
    const f = path.join(SRC, `.pinfill-test-${process.pid}-${name}.ts`);
    temps.push(f);
    fs.writeFileSync(f, source);
    return import(f);
}

describe('parseManifestPins: the manifest is read the way the gate reads --pins, strictly', () => {
    it('readbackBlock becomes a bigint; the rest passes through', () => {
        const p = parseManifestPins(MANIFEST, 'upgrade');
        expect(p.readbackBlock).toBe(12_345_678n);
        expect(p.codehashes).toEqual(MANIFEST.codehashes);
    });
    it('an unknown key is refused, not dropped (a renamed field would otherwise vanish)', () => {
        expect(() => parseManifestPins({ ...MANIFEST, lens: A(1) }, 'upgrade')).toThrow(/unknown key\(s\) for a upgrade deploy: lens/);
        expect(() => parseManifestPins({ ...MANIFEST, absent: ['pnts'] }, 'upgrade')).toThrow(/declares absence only for the timelock/);
        expect(parseManifestPins({ ...MANIFEST, addresses: {}, absent: [] }, 'fresh').addresses).toEqual({});
    });
    it('a readbackBlock that is not a block number is refused', () => {
        for (const rb of [-1, 1.5, '0x10', 'latest', 2 ** 60]) expect(() => parseManifestPins({ ...MANIFEST, readbackBlock: rb }, 'upgrade')).toThrow(/readbackBlock/);
        expect(parseManifestPins({ ...MANIFEST, readbackBlock: '99999999999999999999' }, 'upgrade').readbackBlock).toBe(99999999999999999999n);
    });
    it('not an object is refused', () => {
        for (const j of [null, [], 'x']) expect(() => parseManifestPins(j, 'upgrade')).toThrow(/not a JSON object/);
    });
});

describe('bookSwitch', () => {
    it('upgrade: the book follows SP onto the capped aPNTs and the v2 factory, plus the certified entries', () => {
        // MANIFEST declares timelockController: "n/a:none", so the live entry is removed too.
        expect(bookSwitch('upgrade', parseManifestPins(MANIFEST, 'upgrade'))).toEqual({ ...MANIFEST.addresses, aPNTs: A(0x19), xPNTsFactory: A(0x14), timelockController: A(0) });
    });
    it('only entries whose address changes are rewritten', () => {
        expect(changedEntries({ registry: A(1), aPNTs: A(2), pnts: A(3) }, { registry: A(1).toUpperCase().replace('0X', '0x'), aPNTs: A(9) })).toEqual({ aPNTs: A(2), pnts: A(3) });
    });
    it('fresh: every manifest address-book entry', () => {
        expect(bookSwitch('fresh', parseManifestPins({ ...MANIFEST, addresses: { registry: A(1), aPNTs: A(0x19) } }, 'fresh'))).toEqual({ registry: A(1), aPNTs: A(0x19), timelockController: null });
    });
    it('a missing or malformed address is refused', () => {
        const { aPNTsCapped: _d, ...rest } = MANIFEST;
        expect(() => bookSwitch('upgrade', parseManifestPins(rest, 'upgrade'))).toThrow(/book switch aPNTs: undefined is not an address/);
        expect(() => bookSwitch('fresh', parseManifestPins({ ...MANIFEST, addresses: { registry: '0x12' } }, 'fresh'))).toThrow(/registry/);
    });
});

describe('fillPinsTable on the real sp550Cutover.ts: the written entry IS the manifest', () => {
    const source = fs.readFileSync(path.join(SRC, 'sp550Cutover.ts'), 'utf8');
    it('the filled table, imported, holds the manifest pins and they pass the pin check', async () => {
        const pins = parseManifestPins(MANIFEST, 'upgrade');
        const m = await load('cut', fillPinsTable(source, 'SP550_CUTOVER_PINS', 11155111, pins));
        const got = m.SP550_CUTOVER_PINS[11155111];
        const checksummed = Object.fromEntries(sp550PinnedAddressEntries(pins).filter(([k]) => !k.startsWith('addresses.')).map(([k, a]) => [k, getAddress(a as string)]));
        const book = Object.fromEntries(Object.entries(pins.addresses!).map(([k, a]) => [k, getAddress(a!)]));
        expect(got).toEqual({ ...pins, ...checksummed, addresses: book });
        expect(sp550PinProblems(got, { allowRc: true })).toEqual([]);
    });
    it('a filled entry is never overwritten', () => {
        const once = fillPinsTable(source, 'SP550_CUTOVER_PINS', 11155111, parseManifestPins(MANIFEST, 'upgrade'));
        expect(() => fillPinsTable(once, 'SP550_CUTOVER_PINS', 11155111, parseManifestPins(MANIFEST, 'upgrade'))).toThrow(/already filled/);
    });
    it('two entries for one chain are refused, even when one is empty (Codex M7)', () => {
        const twice = source.replace('    11155111: {},', '    11155111: { tag: "x" },\n    11155111: {},');
        expect(() => fillPinsTable(twice, 'SP550_CUTOVER_PINS', 11155111, parseManifestPins(MANIFEST, 'upgrade'))).toThrow(/2 entries for this chain/);
    });
    it('a chain with no entry, or a missing table, is refused', () => {
        expect(() => fillPinsTable(source, 'SP550_CUTOVER_PINS', 1, parseManifestPins(MANIFEST, 'upgrade'))).toThrow(/no entry for this chain/);
        expect(() => fillPinsTable(source, 'NOPE', 11155111, parseManifestPins(MANIFEST, 'upgrade'))).toThrow(/NOPE: 0 declarations at line start/);
    });
    it('fresh: the [optimismSepolia.id] spelling is filled in sp550Deployments.ts', async () => {
        const dep = fs.readFileSync(path.join(SRC, 'sp550Deployments.ts'), 'utf8');
        const pins = parseManifestPins({ ...MANIFEST, addresses: { registry: A(0x21) }, absent: ['pnts'] }, 'fresh');
        const m = await load('dep', fillPinsTable(dep, 'SP550_FRESH_DEPLOY_PINS', 11155420, pins));
        expect(m.SP550_FRESH_DEPLOY_PINS[11155420].addresses).toEqual({ registry: getAddress(A(0x21)) });
        expect(m.SP550_FRESH_DEPLOY_PINS[11155420].absent).toEqual(['pnts', 'timelockController']);
        expect(m.SP550_FRESH_DEPLOY_PINS[10]).toEqual({});
    });
});

describe('switchBook on the real addresses.ts: only the switched entries change', () => {
    const source = fs.readFileSync(path.join(SRC, 'addresses.ts'), 'utf8');
    it('Sepolia aPNTs / xPNTsFactory point at the new contracts; every other entry and chain is untouched', async () => {
        const m = await load('book', switchBook(source, 11155111, { aPNTs: A(0x19), xPNTsFactory: A(0x14) }, 'note'));
        const was = CANONICAL_ADDRESSES as Record<number, Record<string, string>>;
        const now = m.CANONICAL_ADDRESSES as Record<number, Record<string, string>>;
        expect(now[11155111].aPNTs).toBe(getAddress(A(0x19)));
        expect(now[11155111].xPNTsFactory).toBe(getAddress(A(0x14)));
        expect({ ...now[11155111], aPNTs: 0, xPNTsFactory: 0 }).toEqual({ ...was[11155111], aPNTs: 0, xPNTsFactory: 0 });
        for (const c of [10, 11155420]) expect(now[c]).toEqual(was[c]);
    });
    it('a key the book lacks is added to that chain only, once', async () => {
        // Remove the key first, so the test exercises insertion, not replacement (Codex L10).
        const without = source.replace(/\n    policyRegistry: "0x[0-9a-fA-F]{40}",[^\n]*(?=[\s\S]*\n  11155420: \{)/, '');
        const opSep = (src: string) => src.slice(src.indexOf('\n  11155420: {'));
        expect(opSep(without).includes('\n    policyRegistry:')).toBe(true);
        const stripped = without.slice(0, without.indexOf('\n  11155420: {')) + opSep(without).replace(/\n    policyRegistry: "0x[0-9a-fA-F]{40}",[^\n]*/, '');
        expect(opSep(stripped).includes('\n    policyRegistry:')).toBe(false);
        const out = switchBook(stripped, 11155420, { policyRegistry: A(0x31) }, 'note');
        expect(opSep(out).split('\n    policyRegistry:').length - 1).toBe(1);
        const m = await load('add', out);
        expect(m.CANONICAL_ADDRESSES[11155420].policyRegistry).toBe(getAddress(A(0x31)));
    });
    it('a null entry removes the key (a fresh deploy declaring it absent)', async () => {
        const m = await load('rm', switchBook(source, 11155420, { microPaymentChannel: null }, 'note'));
        expect('microPaymentChannel' in m.CANONICAL_ADDRESSES[11155420]).toBe(false);
        expect({ ...m.CANONICAL_ADDRESSES[11155420], microPaymentChannel: 0 }).toEqual({ ...(CANONICAL_ADDRESSES as any)[11155420], microPaymentChannel: 0 });
    });
    it('a duplicate declaration, or a block comment in the block, is refused', () => {
        const dup = source.replace('\n  11155111: {\n', '\n  11155111: {\n    aPNTs: "0x0000000000000000000000000000000000000001",\n');
        expect(() => switchBook(dup, 11155111, { aPNTs: A(1) }, 'n')).toThrow(/aPNTs: 2 declarations/);
        const commented = source.replace('\n  11155111: {\n', '\n  11155111: {\n    /* aPNTs: "0x0000000000000000000000000000000000000001", */\n');
        expect(() => switchBook(commented, 11155111, { aPNTs: A(1) }, 'n')).toThrow(/block comment/);
    });
    it('a chain with no block is refused', () => {
        expect(() => switchBook(source, 1, { aPNTs: A(1) }, 'n')).toThrow(/CANONICAL_ADDRESSES\[1\]: no block/);
    });
    it('a key whose line is not a plain address literal is refused rather than duplicated', () => {
        const odd = source.replace(/\n    aPNTs: "0x696A73701b104c6cCBbAadDD2216788ea08EaB89",[^\n]*/, '\n    aPNTs: SOME_CONST,');
        expect(odd).not.toBe(source);
        expect(() => switchBook(odd, 11155111, { aPNTs: A(1) }, 'n')).toThrow(/not a plain address literal/);
    });
});

describe('fresh absent keys and loopback detection', () => {
    it('absent keys are removed from the switched book; pinned-and-absent is refused', () => {
        const pins = parseManifestPins({ ...MANIFEST, addresses: { registry: A(0x21) }, absent: ['pnts'] }, 'fresh');
        const sw = bookSwitch('fresh', pins);
        expect(sw).toEqual({ registry: A(0x21), pnts: null, timelockController: null });
        expect(applyBookSwitch({ registry: A(1), pnts: A(2), entryPoint: A(3) }, sw)).toEqual({ registry: A(0x21), entryPoint: A(3) });
        expect(changedEntries(sw, { registry: A(0x21) })).toEqual({});
        expect(() => bookSwitch('fresh', parseManifestPins({ ...MANIFEST, addresses: { pnts: A(1) }, absent: ['pnts'] }, 'fresh'))).toThrow(/both pinned and declared absent/);
    });
    it.each(['http://127.0.0.1:8545', 'http://127.1:8545', 'http://user:pass@127.0.0.1:8545', 'http://LOCALHOST:8545', 'http://[::1]:8545', 'http://0.0.0.0:8545', 'http://a.localhost/', 'not a url',
        'http://localhost.:8545', 'http://[::ffff:127.0.0.1]:8545', 'http://[0:0:0:0:0:0:0:1]:8545', 'http://[::]:8545', 'http://[::ffff:0.0.0.0]:8545'])(
        '%s is loopback (or unparsable)', (u) => expect(isLoopbackUrl(u)).toBe(true));
    it.each(['https://sepolia.example.org/v2/key', 'https://127.0.0.1.example.org/'])('%s is not loopback', (u) => expect(isLoopbackUrl(u)).toBe(false));
});

describe('round-2 rewrite guards (Codex r2 on 7cefda78)', () => {
    const book = fs.readFileSync(path.join(SRC, 'addresses.ts'), 'utf8');
    const table = fs.readFileSync(path.join(SRC, 'sp550Cutover.ts'), 'utf8');
    it('a declaration sharing its line with another property is refused, never rewritten whole', () => {
        const two = book.replace(/\n    aPNTs: "0x696A73701b104c6cCBbAadDD2216788ea08EaB89",[^\n]*/, '\n    aPNTs: "0x696A73701b104c6cCBbAadDD2216788ea08EaB89", pnts: "0x0000000000000000000000000000000000000001",');
        expect(two).not.toBe(book);
        expect(() => switchBook(two, 11155111, { aPNTs: A(1) }, 'n')).toThrow(/not a plain address literal on its own line/);
    });
    it('a second block for the same chain is refused (the last one would win)', () => {
        const dup = book.replace('\n  11155420: {\n', '\n  11155111: {\n    aPNTs: "0x0000000000000000000000000000000000000001",\n  },\n  11155420: {\n');
        expect(() => switchBook(dup, 11155111, { aPNTs: A(1) }, 'n')).toThrow(/2 blocks for this chain/);
    });
    it('a commented-out table declaration is not the table (and two real ones are refused)', () => {
        const commented = table.replace('\nexport const SP550_CUTOVER_PINS', '\n// export const SP550_CUTOVER_PINS: Record<number, Sp550CutoverPins> = {\n//     11155111: {},\n// };\nexport const SP550_CUTOVER_PINS');
        const out = fillPinsTable(commented, 'SP550_CUTOVER_PINS', 11155111, parseManifestPins(MANIFEST, 'upgrade'));
        expect(out).toContain('//     11155111: {},');
        expect(out.split('\n    11155111: {\n').length - 1).toBe(1);
        const twice = table.replace('\nexport const SP550_CUTOVER_PINS', '\nexport const SP550_CUTOVER_PINS_OLD = {};\nexport const SP550_CUTOVER_PINS');
        expect(() => fillPinsTable(twice, 'SP550_CUTOVER_PINS', 11155111, parseManifestPins(MANIFEST, 'upgrade'))).toThrow(/2 declarations at line start/);
    });
});

describe('writeAll: all or nothing, never clobbering another writer', () => {
    const memIo = (files: Record<string, string>, fail: Partial<Record<'rename' | 'read' | 'write', (p: string) => boolean>> = {}): WriteIo & { files: Record<string, string> } => ({
        files,
        read: (p) => { if (fail.read?.(p)) throw new Error(`ENOENT ${p}`); if (!(p in files)) throw new Error(`ENOENT ${p}`); return files[p]; },
        write: (p, v) => { if (fail.write?.(p)) throw new Error(`EACCES ${p}`); files[p] = v; },
        rename: (a, b) => { if (fail.rename?.(b)) throw new Error(`EACCES ${b}`); files[b] = files[a]; delete files[a]; },
        remove: (p) => { delete files[p]; },
    });
    const F = [{ path: '/r/table.ts', before: 'old-table', after: 'new-table' }, { path: '/r/book.ts', before: 'old-book', after: 'new-book' }];
    it('the second rename failing restores the first; no temp file is left', () => {
        const io = memIo({ '/r/table.ts': 'old-table', '/r/book.ts': 'old-book' }, { rename: (p) => p === '/r/book.ts' });
        expect(() => writeAll(F, '/r', io)).toThrow(/write failed .*nothing left changed/);
        expect(io.files).toEqual({ '/r/table.ts': 'old-table', '/r/book.ts': 'old-book' });
    });
    it('…but a file another writer changed in between is left alone and reported', () => {
        const io = memIo({ '/r/table.ts': 'old-table', '/r/book.ts': 'old-book' }, { rename: (p) => { if (p === '/r/book.ts') { io.files['/r/table.ts'] = 'their-edit'; return true; } return false; } });
        expect(() => writeAll(F, '/r', io)).toThrow(/table\.ts changed since this run wrote it/);
        expect(io.files['/r/table.ts']).toBe('their-edit');
    });
    it('a failed rename whose rollback also fails reports the unrestored file (the caller keeps its recovery data)', () => {
        const io = memIo({ '/r/table.ts': 'old-table', '/r/book.ts': 'old-book' }, {
            rename: (p) => p === '/r/book.ts',
            write: (p) => p === '/r/table.ts', // the rollback of the already-renamed table fails
        });
        let err: any;
        try { writeAll(F, '/r', io); } catch (e) { err = e; }
        expect(err?.message).toMatch(/table\.ts could not be restored/);
        expect(err?.unrestored).toEqual([expect.stringMatching(/table\.ts could not be restored/)]);
    });
    it('a temp file that cannot be removed does not mask the rollback status (Codex r9)', () => {
        const io = memIo({ '/r/table.ts': 'old-table', '/r/book.ts': 'old-book' }, { rename: (p) => p === '/r/book.ts' });
        io.remove = () => { throw new Error('EBUSY'); };
        let err: any;
        try { writeAll(F, '/r', io); } catch (e) { err = e; }
        expect(err?.unrestored).toEqual(expect.arrayContaining([expect.stringMatching(/pin-fill\.tmp could not be removed \(EBUSY\)/)]));
    });
    it('restore() attempts every file and reports each failure', () => {
        const io = memIo({ '/r/table.ts': 'old-table', '/r/book.ts': 'old-book' });
        const restore = writeAll(F, '/r', io);
        expect(io.files).toEqual({ '/r/table.ts': 'new-table', '/r/book.ts': 'new-book' });
        delete io.files['/r/table.ts'];
        expect(restore()).toEqual([expect.stringMatching(/table\.ts could not be restored/)]);
        expect(io.files['/r/book.ts']).toBe('old-book');
    });
});

describe('Codex r3: the last property of a chain block', () => {
    it('the final entry of a block can be rewritten and removed', async () => {
        const src = fs.readFileSync(path.join(SRC, 'addresses.ts'), 'utf8');
        const opSep = src.slice(src.indexOf('\n  11155420: {'));
        const last = /\n    (\w+): "0x[0-9a-fA-F]{40}",[^\n]*\n  \}/.exec(opSep)!;
        const key = last[1];
        const removed = await load('last-rm', switchBook(src, 11155420, { [key]: null }, 'n'));
        expect(key in removed.CANONICAL_ADDRESSES[11155420]).toBe(false);
        const moved = await load('last-mv', switchBook(src, 11155420, { [key]: A(0x41) }, 'n'));
        expect(moved.CANONICAL_ADDRESSES[11155420][key]).toBe(getAddress(A(0x41)));
    });
});

describe("SP pins files: _aliases (SP, 2026-11-11)", () => {
    it('the exact alias map is accepted and dropped', () => {
        const p = parseManifestPins({ ...MANIFEST, _aliases: { staking: 'contracts.gTokenStaking' } }, 'upgrade');
        expect('_aliases' in p).toBe(false);
        expect(PINS_FILE_ALIASES).toEqual({ staking: 'contracts.gTokenStaking' });
    });
    it('any other alias map is refused', () => {
        expect(() => parseManifestPins({ ...MANIFEST, _aliases: { staking: 'contracts.staking' } }, 'upgrade')).toThrow(/_aliases .* != the SDK's/);
        expect(() => parseManifestPins({ ...MANIFEST, _aliases: {} }, 'upgrade')).toThrow(/_aliases/);
    });
});

describe("--write's cross-check against SP's own live read-back (DSR, H3)", () => {
    const pins = parseManifestPins(MANIFEST, 'upgrade');
    const entries = sp550PinnedAddressEntries(pins);
    /** SP's live read-back naming exactly the manifest pins. */
    const live = (): any => {
        const contracts: Record<string, any> = {};
        for (const [k, a] of entries) {
            if (k === 'spImpl' || k === 'registryImpl') continue;
            contracts[k.startsWith('addresses.') ? k.slice(10) : k] = { address: a, codehash: pins.codehashes![k] };
        }
        Object.assign(contracts.superPaymaster, { erc1967Impl: pins.spImpl, implCodehash: pins.codehashes!.spImpl, extension: pins.spAdminExtension, extensionCodehash: pins.codehashes!.spAdminExtension });
        Object.assign(contracts.registry, { erc1967Impl: pins.registryImpl, implCodehash: pins.codehashes!.registryImpl });
        return { header: { source: 'live', chainId: 11155111, tag: pins.tag, readbackBlock: Number(pins.readbackBlock) }, contracts };
    };
    it('agreement passes', () => expect(spLiveReadbackProblems(live(), pins, 11155111, entries)).toEqual([]));
    it.each([
        ['a fork read-back instead of the live one', (rb: any) => { rb.header.source = 'fork'; }, /header\.source "fork" is not "live"/],
        ['another chain', (rb: any) => { rb.header.chainId = 10; }, /header\.chainId 10 != 11155111/],
        ['another tag', (rb: any) => { rb.header.tag = 'v5.5.0-rc.7'; }, /header\.tag/],
        ['another address', (rb: any) => { rb.contracts.dvtValidator.address = A(0x99); }, /contracts\.dvtValidator\.address .* != pins\.addresses\.dvtValidator/],
        ['another codehash', (rb: any) => { rb.contracts.superPaymasterLens.codehash = '0x' + '99'.repeat(32); }, /contracts\.superPaymasterLens\.codehash .* != pins\.codehashes\.superPaymasterLens/],
        ['another SP implementation', (rb: any) => { rb.contracts.superPaymaster.erc1967Impl = A(0x99); }, /contracts\.superPaymaster\.erc1967Impl .* != pins\.spImpl/],
        ['another Registry implementation hash', (rb: any) => { rb.contracts.registry.implCodehash = '0x' + '99'.repeat(32); }, /contracts\.registry\.implCodehash .* != pins\.codehashes\.registryImpl/],
        ['another extension', (rb: any) => { rb.contracts.superPaymaster.extension = A(0x99); }, /superPaymaster\.extension .* != pins\.spAdminExtension/],
        ['a pinned contract missing', (rb: any) => { delete rb.contracts.policyRegistry; }, /contracts\.policyRegistry missing/],
        ['another read-back block (Grok)', (rb: any) => { rb.header.readbackBlock = 1; }, /header\.readbackBlock 1 != pins\.readbackBlock/],
        ['another extension codehash (Grok)', (rb: any) => { rb.contracts.superPaymaster.extensionCodehash = '0x' + '99'.repeat(32); }, /extensionCodehash .* != pins\.codehashes\.spAdminExtension/],
    ])('a disagreement stops --write: %s', (_n, mutate, msg) => {
        const rb = live(); mutate(rb);
        expect(spLiveReadbackProblems(rb, pins, 11155111, entries)).toEqual(expect.arrayContaining([expect.stringMatching(msg)]));
    });
    it('fresh aliases (addresses.aPNTs / xPNTsFactory / superPaymaster) are read back under their top-level names (Codex r9)', () => {
        const aliased: any = { ...pins, addresses: { ...pins.addresses, aPNTs: pins.aPNTsCapped, xPNTsFactory: pins.xPNTsFactoryV2, superPaymaster: pins.superPaymaster },
            codehashes: { ...pins.codehashes, 'addresses.aPNTs': pins.codehashes!.aPNTsCapped, 'addresses.xPNTsFactory': pins.codehashes!.xPNTsFactoryV2, 'addresses.superPaymaster': pins.codehashes!.superPaymaster } };
        expect(spLiveReadbackProblems(live(), aliased, 11155111, sp550PinnedAddressEntries(aliased))).toEqual([]);
        const split: any = { ...aliased, addresses: { ...aliased.addresses, aPNTs: A(0x77) } };
        expect(spLiveReadbackProblems(live(), split, 11155111, sp550PinnedAddressEntries(split))).toEqual([expect.stringMatching(/pins: addresses\.aPNTs .* != aPNTsCapped .*declared alias/)]);
        // same address, another codehash: the alias is still two contracts (PR-Daemon F4: this predicate had no red test)
        const hashSplit: any = { ...aliased, codehashes: { ...aliased.codehashes, 'addresses.aPNTs': '0x' + '77'.repeat(32) } };
        expect(spLiveReadbackProblems(live(), hashSplit, 11155111, sp550PinnedAddressEntries(hashSplit))).toEqual([expect.stringMatching(/pins: codehashes\.addresses\.aPNTs != codehashes\.aPNTsCapped \(declared alias\)/)]);
    });
    it('a contract the pins declare absent must not appear in the live read-back (Grok)', () => {
        const rb = live(); rb.contracts.timelockController = { address: A(0x26), codehash: '0x' + '26'.repeat(32) };
        expect(spLiveReadbackProblems(rb, { ...pins, absent: ['timelockController'] } as any, 11155111, entries)).toEqual([expect.stringMatching(/contracts\.timelockController is not an "n\/a:" not-deployed placeholder/)]);
        // an explicit not-deployed placeholder is not a contradiction (Codex r14) …
        rb.contracts.timelockController = { address: 'n/a:not deployed', codehash: 'n/a:not deployed' };
        expect(spLiveReadbackProblems(rb, { ...pins, absent: ['timelockController'] } as any, 11155111, entries)).toEqual([]);
        // … but a placeholder address with a real codehash, or an unreadable address, is (Grok r15)
        for (const e of [{ address: 'n/a:not deployed', codehash: '0x' + '26'.repeat(32) }, { address: 'unreadable:timeout', codehash: 'n/a:x' }]) {
            rb.contracts.timelockController = e;
            expect(spLiveReadbackProblems(rb, { ...pins, absent: ['timelockController'] } as any, 11155111, entries)).toEqual([expect.stringMatching(/not an "n\/a:" not-deployed placeholder/)]);
        }
    });
    it('a staking book entry is looked up under contracts.gTokenStaking', () => {
        const withStaking: any = { ...pins, addresses: { ...pins.addresses, staking: A(0x2a) }, codehashes: { ...pins.codehashes, 'addresses.staking': '0x' + '2a'.repeat(32) } }; // as parsed (with _aliases)
        const rb = live(); rb.contracts.gTokenStaking = { address: A(0x2a), codehash: '0x' + '2a'.repeat(32) };
        expect(spLiveReadbackProblems(rb, withStaking, 11155111, sp550PinnedAddressEntries(withStaking))).toEqual([]);
    });
});

describe('spReadbackApiPath: the fetch cannot leave the pinned commit (Codex r9)', () => {
    const C = 'a'.repeat(40);
    it('a plain path is fetched at exactly that commit', () => {
        expect(spReadbackApiPath('deployments/release/rc8/sepolia.readback.live.json', C, 'sepolia', undefined, true)).toBe(`repos/AAStarCommunity/SuperPaymaster/contents/deployments/release/rc8/sepolia.readback.live.json?ref=${C}`);
    });
    it.each(['x.json?ref=main#', 'x.json#frag', '../x.json', 'a/./x.json', 'a/x.txt', '/abs.json', 'a//x.json', 'x%3Fref=main.json', 'x .json'])('%s is refused', (p) => {
        expect(() => spReadbackApiPath(p, C, 'sepolia', undefined, true)).toThrow(/not a plain repository path/);
    });
    it.each(['test/fixtures/live.json', 'deployments/release/rc8/sepolia.readback.a7.json', 'deployments/release/rc8/sepolia.pins.json', 'docs/release/a7/aoa-a7-readback-1.live.example.json'])(
        'any other JSON in the commit is refused (Grok): %s', (p) => expect(() => spReadbackApiPath(p, C, 'sepolia', undefined, true)).toThrow(/not an SP release live read-back/));
    it('a non-sha commit is refused', () => expect(() => spReadbackApiPath('deployments/release/rc8/sepolia.readback.live.json', 'main', 'sepolia', undefined, true)).toThrow(/not a 40-hex sha/));
    it("another network's live read-back is refused (Grok)", () => {
        expect(spReadbackApiPath('deployments/release/rc8/sepolia.readback.live.json', C, 'sepolia', undefined, true)).toContain('sepolia.readback.live.json');
        expect(() => spReadbackApiPath('deployments/release/rc8/op-sepolia.readback.live.json', C, 'sepolia', undefined, true)).toThrow(/is not the sepolia live read-back/);
    });
    it("another release's directory is refused: tag v5.5.0-rc.8 means deployments/release/rc8/ (Grok)", () => {
        expect(spReadbackApiPath('deployments/release/rc8/sepolia.readback.live.json', C, 'sepolia', 'v5.5.0-rc.8', true)).toContain('/rc8/');
        expect(() => spReadbackApiPath('deployments/release/rc7/sepolia.readback.live.json', C, 'sepolia', 'v5.5.0-rc.8', true)).toThrow(/not under deployments\/release\/rc8/);
    });
});

describe('two RPCs on one machine are one provider: IPs compared normalized (Grok)', () => {
    it.each([['1.2.3.4', '::ffff:1.2.3.4'], ['1.2.3.4', '[::ffff:102:304]'], ['2001:db8::1', '2001:0DB8:0:0:0:0:0:1']])('%s and %s overlap', (a, b) => {
        expect(normalizeIp(a)).toBe(normalizeIp(b));
        expect(addressesOverlap([a], [b])).toBe(true);
    });
    it('different machines do not overlap', () => expect(addressesOverlap(['1.2.3.4'], ['1.2.3.5', '2001:db8::2'])).toBe(false));
});

describe('_aliases is required when a renamed key is pinned (Grok)', () => {
    it('addresses.staking without _aliases is refused; with it, accepted', () => {
        const m = { ...MANIFEST, addresses: { ...MANIFEST.addresses, staking: A(0x2a) } };
        expect(() => parseManifestPins(m, 'upgrade')).toThrow(/addresses\.staking pinned without _aliases/);
        expect(parseManifestPins({ ...m, _aliases: { staking: 'contracts.gTokenStaking' } }, 'upgrade').addresses?.staking).toBe(A(0x2a));
    });
});

describe('the pins file declares the timelock (SP, schema 543f3498)', () => {
    it('an address becomes a certified book entry, its codehash re-keyed', () => {
        const p = parseManifestPins({ ...MANIFEST, timelockController: A(0x26), codehashes: { ...MANIFEST.codehashes, timelockController: '0x' + '26'.repeat(32) } }, 'upgrade');
        expect(p.addresses?.timelockController).toBe(A(0x26));
        expect(p.codehashes?.['addresses.timelockController']).toBe('0x' + '26'.repeat(32));
        expect('timelockController' in p).toBe(false);
    });
    it('"n/a:none" means no timelock, recorded as absent in an upgrade too (Grok)', () => {
        const p = parseManifestPins({ ...MANIFEST, timelockController: 'n/a:none' }, 'upgrade');
        expect(p.addresses?.timelockController).toBeUndefined();
        expect(p.absent).toEqual(['timelockController']);
    });
    it('an upgrade cannot declare anything else absent', () => {
        expect(() => parseManifestPins({ ...MANIFEST, absent: ['pnts'] }, 'upgrade')).toThrow(/declares absence only for the timelock/);
    });
    it.each([
        ['an addresses.timelockController entry (DSR: top-level only)', { timelockController: A(0x26), addresses: { ...MANIFEST.addresses, timelockController: A(0x26) } }, /declared only by the top-level/],
        ['a codehash under addresses.*', { timelockController: A(0x26), codehashes: { ...MANIFEST.codehashes, timelockController: '0x' + '26'.repeat(32), 'addresses.timelockController': '0x' + '26'.repeat(32) } }, /goes under codehashes\.timelockController/],
        ['an address without its codehash', { timelockController: A(0x26) }, /pinned without codehashes\.timelockController/],
        ['"n/a:none" with a codehash', { timelockController: 'n/a:none', codehashes: { ...MANIFEST.codehashes, timelockController: '0x' + '26'.repeat(32) } }, /"n\/a:none" but codehashes\.timelockController is given/],
        ['an address that is also declared absent (Grok)', { timelockController: A(0x26), codehashes: { ...MANIFEST.codehashes, timelockController: '0x' + '26'.repeat(32) }, absent: ['timelockController'] }, /an address and also declared absent/],
        ['neither an address nor n/a', { timelockController: 'none' }, /neither an address nor "n\/a:none"/],
    ])('refused: %s', (_n, patch, msg) => expect(() => parseManifestPins({ ...MANIFEST, ...patch }, 'upgrade')).toThrow(msg));
});

describe('"n/a:none" survives into validation: a fresh deploy without a timelock passes (Codex r12)', async () => {
    const { sp550FreshPinProblems, SP550_FRESH_REQUIRED_ADDRESS_KEYS, SP550_FRESH_OPTIONAL_ADDRESS_KEYS } = await import('../packages/core/src/sp550Deployments.js');
    it('parser -> validator: no timelock declared absent, no "unpinned" problem', () => {
        expect(SP550_FRESH_OPTIONAL_ADDRESS_KEYS).toContain('timelockController');
        expect(SP550_FRESH_REQUIRED_ADDRESS_KEYS).not.toContain('timelockController');
        const book = Object.fromEntries(SP550_FRESH_REQUIRED_ADDRESS_KEYS.map((k, i) => [k, A(0x400 + i)]));
        const absent = SP550_FRESH_OPTIONAL_ADDRESS_KEYS.filter((k) => k !== 'timelockController');
        const raw: any = { ...MANIFEST, superPaymaster: book.superPaymaster, aPNTsCapped: book.aPNTs, addresses: book, absent, timelockController: 'n/a:none', _aliases: { staking: 'contracts.gTokenStaking' } };
        raw.codehashes = { ...MANIFEST.codehashes, ...Object.fromEntries(Object.keys(book).map((k, i) => [`addresses.${k}`, '0x' + (0x80 + i).toString(16).padStart(2, '0').repeat(32)])) };
        raw.codehashes['addresses.superPaymaster'] = raw.codehashes.superPaymaster;
        raw.codehashes['addresses.aPNTs'] = raw.codehashes.aPNTsCapped;
        const pins = parseManifestPins(raw, 'fresh');
        expect(pins.absent).toContain('timelockController');
        expect(sp550FreshPinProblems(pins, { allowRc: true }).filter((x) => /timelockController/.test(x))).toEqual([]);
    });
});

describe('every manifest declares the timelock (Codex r13)', () => {
    it('silence is refused in both modes', () => {
        const { timelockController: _t, ...silent } = MANIFEST;
        expect(() => parseManifestPins(silent, 'upgrade')).toThrow(/timelockController is not declared/);
        expect(() => parseManifestPins({ ...silent, addresses: {}, absent: [] }, 'fresh')).toThrow(/timelockController is not declared/);
    });
});

describe('the replaced timelock is kept only as history (DSR 2026-11-11)', () => {
    const OLD = '0x86C86c789EDc099801cc6a5F48334F1D67dC9564', NEW = '0xCCdF8e0D29Fb2c3061910D79484a2b653757C34B';
    it('switching timelockController writes the old value as timelockControllerLegacy', () => {
        expect(withTimelockLegacy({ timelockController: NEW }, { timelockController: OLD })).toEqual({ timelockController: NEW, timelockControllerLegacy: OLD });
    });
    it('an upgrade declaring no timelock removes the live entry and keeps the old one as history (Grok r15)', () => {
        const pins = parseManifestPins(MANIFEST, 'upgrade'); // MANIFEST declares timelockController: "n/a:none"
        const sw = bookSwitch('upgrade', pins);
        expect(sw.timelockController).toBe(A(0)); // zeroed: every chain keeps every key
        expect(withTimelockLegacy(changedEntries(sw, { timelockController: OLD }), { timelockController: OLD })).toMatchObject({ timelockController: A(0), timelockControllerLegacy: OLD });
    });
    it('a second replacement never overwrites an existing history entry', () => {
        expect(() => withTimelockLegacy({ timelockController: NEW }, { timelockController: A(0x55), timelockControllerLegacy: OLD })).toThrow(/already holds/);
        expect(withTimelockLegacy({ timelockController: NEW }, { timelockController: OLD, timelockControllerLegacy: A(0) })).toMatchObject({ timelockControllerLegacy: OLD });
    });
    it('bookSwitch refuses a pinned and absent timelock even when called directly (Grok r16)', () => {
        const pins: any = { ...parseManifestPins(MANIFEST, 'upgrade') };
        pins.addresses = { ...pins.addresses, timelockController: A(0x26) };
        expect(() => bookSwitch('upgrade', pins)).toThrow(/both pinned and declared absent/);
    });
    it('a zero book entry (not deployed) is not kept as history (Grok r15)', () => {
        expect(withTimelockLegacy({ timelockController: NEW }, { timelockController: '0x' + '0'.repeat(40) })).toEqual({ timelockController: NEW });
    });
    it('no switch, the same address, or no old entry: nothing extra', () => {
        expect(withTimelockLegacy({ aPNTs: A(1) }, { timelockController: OLD })).toEqual({ aPNTs: A(1) });
        expect(withTimelockLegacy({ timelockController: OLD.toLowerCase() }, { timelockController: OLD })).toEqual({ timelockController: OLD.toLowerCase() });
        expect(withTimelockLegacy({ timelockController: NEW }, {})).toEqual({ timelockController: NEW });
    });
    it('the switched source has both entries and still names the new one live', async () => {
        const src = fs.readFileSync(path.join(SRC, 'addresses.ts'), 'utf8');
        const m = await load('tl', switchBook(src, 11155111, withTimelockLegacy({ timelockController: NEW }, { timelockController: OLD }), 'n'));
        expect(m.CANONICAL_ADDRESSES[11155111].timelockController).toBe(NEW);
        expect(m.CANONICAL_ADDRESSES[11155111].timelockControllerLegacy).toBe(OLD);
    });
});

describe('a final tag names no rc directory: the path must be explicit (Grok)', () => {
    const C = 'a'.repeat(40);
    it('v5.5.0 with the default path is refused; with an explicit path it is accepted', () => {
        expect(() => spReadbackApiPath('deployments/release/rc8/sepolia.readback.live.json', C, 'sepolia', 'v5.5.0', false)).toThrow(/names no rc: pass --sp-readback-path explicitly/);
        expect(() => spReadbackApiPath('', C, 'sepolia', 'v5.5.0', false)).toThrow(/names no rc: pass --sp-readback-path explicitly/);
        expect(() => spReadbackApiPath('', C, 'sepolia', 'v5.5.0-rc.8', true)).toThrow(/--sp-readback-path is empty/);
        expect(spReadbackApiPath('deployments/release/rc8/sepolia.readback.live.json', C, 'sepolia', 'v5.5.0', true)).toContain('/rc8/');
    });
});

describe('PR-Daemon B1: an upgrade cannot move the proxy or a non-switchable book entry', () => {
    const pins = parseManifestPins(MANIFEST, 'upgrade');
    const shipped = CANONICAL_ADDRESSES[11155111] as unknown as Record<string, unknown>;
    it('the manifest proxy equal to the shipped one, only switchable entries changing: no problem', () => {
        expect(upgradeBookProblems(pins, bookSwitch('upgrade', pins), shipped)).toEqual([]);
    });
    it('a manifest that moves the proxy is refused against the SHIPPED book', () => {
        const moved = { ...pins, superPaymaster: A(0x778) };
        expect(upgradeBookProblems(moved as any, bookSwitch('upgrade', moved as any), shipped)).toEqual([expect.stringMatching(/pins\.superPaymaster 0x0+778 != the shipped book's superPaymaster .*keeps the proxy address/)]);
    });
    it('a switched entry outside the switchable set is refused', () => {
        expect(upgradeBookProblems(pins, { ...bookSwitch('upgrade', pins), superPaymaster: A(0x778) }, shipped)).toEqual([expect.stringMatching(/book superPaymaster: .* -> 0x0+778 — an upgrade does not move superPaymaster/)]);
        expect(upgradeBookProblems(pins, { ...bookSwitch('upgrade', pins), gToken: A(0x779) }, shipped)).toEqual([expect.stringMatching(/book gToken: .*an upgrade does not move gToken/)]);
        expect(UPGRADE_SWITCHABLE_KEYS).toEqual(['registry', 'policyRegistry', 'blsAggregator', 'dvtValidator', 'reputationSystem', 'aPNTs', 'xPNTsFactory', 'timelockController']);
    });
});

describe('PR-Daemon F2: the SP read-back commit must be on SP main', () => {
    it.each([['identical', true], ['behind', true], ['ahead', false], ['diverged', false], ['', false], [undefined, false]])('compare status %s -> %s', (s, ok) => expect(spCommitOnMain(s)).toBe(ok));
    it('the repository is SP', () => expect(SP_REPO).toBe('AAStarCommunity/SuperPaymaster'));
});

describe('PR-Daemon F4: the dotted IPv4-mapped loopback (what dns.lookup returns) is loopback', () => {
    it.each(['::ffff:127.0.0.1', '[::ffff:127.0.0.53]', '::ffff:0.0.0.0'])('%s', (h) => expect(isLoopbackHost(h)).toBe(true));
    it.each(['::ffff:128.0.0.1', '::ffff:10.0.0.1'])('%s is not', (h) => expect(isLoopbackHost(h)).toBe(false));
});
