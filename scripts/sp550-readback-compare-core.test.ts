import { describe, expect, it } from 'vitest';
import { sp550PinnedAddressEntries } from '../packages/core/src/sp550Cutover.js';
import { READBACK_CONTRACT_FIELDS, READBACK_HEADER_FIELDS, READBACK_SCHEMA, readbackProblems, type ChainReader, type Observed } from './sp550-readback-compare-core.js';

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
const CTX = { chainId: 11155111, forkBlock: 400n, dumpSha256: 'ab'.repeat(32), hardfork: 'amsterdam', spCommit: 'c0ffee' };

/** The chain as the SDK reads it: versions where the contract has one, owners for SP and the Registry. */
const CHAIN: Record<string, Partial<Record<'version' | 'owner' | 'pendingOwner', Observed>>> = {
    [A(0x10)]: { version: { kind: 'value', value: 'SuperPaymaster-5.5.1' }, owner: { kind: 'value', value: A(0xb0) }, pendingOwner: { kind: 'value', value: A(0) } },
    [A(0x13)]: { version: { kind: 'value', value: 'SuperPaymasterLens-1.2.2' } },
    [A(0x19)]: { version: { kind: 'value', value: 'APNTsCapped-1.0.0' } },
    [A(0x21)]: { version: { kind: 'value', value: 'Registry-5.8.0' }, owner: { kind: 'value', value: A(0xb0) }, pendingOwner: { kind: 'reverted' } },
};
const reader = (chain = CHAIN): ChainReader => async (address, fn) => chain[address]?.[fn] ?? { kind: 'reverted' };

/** A read-back that agrees with PINS and CHAIN. */
function good(): any {
    const contracts = Object.fromEntries(sp550PinnedAddressEntries(PINS).map(([k, a]) => {
        const c: Record<string, unknown> = Object.fromEntries(READBACK_CONTRACT_FIELDS.map((f) => [f, 'n/a:not a proxy']));
        const onChain = CHAIN[a as string] ?? {};
        Object.assign(c, {
            address: (a as string).toUpperCase().replace('0X', '0x'), codehash: PINS.codehashes[k],
            version: onChain.version?.kind === 'value' ? onChain.version.value : null,
            owner: 'n/a:not compared', pendingOwner: 'n/a:not compared', guardian: null, roles: [],
        });
        return [k, c];
    }));
    Object.assign(contracts.superPaymaster, { erc1967Impl: PINS.spImpl, implCodehash: PINS.spImplCodehash, extension: PINS.spAdminExtension, extensionCodehash: PINS.codehashes.spAdminExtension, owner: A(0xb0), pendingOwner: A(0) });
    Object.assign(contracts['addresses.registry'], { erc1967Impl: PINS.registryImpl, implCodehash: PINS.codehashes.registryImpl, owner: A(0xb0), pendingOwner: null });
    return {
        schema: READBACK_SCHEMA,
        header: { spCommit: 'C0FFEE', tag: 'v5.5.0-rc.8', chainId: 11155111, hardfork: 'amsterdam', forkBlock: '400', readbackBlock: 500, anvilVersion: '1.7.1', dumpSha256: '0x' + 'AB'.repeat(32) },
        contracts, checks: {},
    };
}
const run = (rb: any, chain = CHAIN, ctx: any = CTX) => readbackProblems(rb, PINS, ctx, reader(chain));

describe('readbackProblems: a read-back that agrees with the pins and the chain passes', () => {
    it('A7 fork: every fact checked', async () => expect(await run(good())).toEqual([]));
    it('live: no fork facts, the header fields need only be present', async () => {
        const rb = good();
        Object.assign(rb.header, { forkBlock: 'n/a:live', dumpSha256: 'n/a:live', anvilVersion: 'n/a:live' });
        expect(await run(rb, CHAIN, { chainId: 11155111 })).toEqual([]);
    });
});

describe('readbackProblems refuses', () => {
    it.each(READBACK_HEADER_FIELDS)('an omitted header field: %s', async (k) => {
        const rb = good(); delete rb.header[k];
        expect(await run(rb)).toContain(`header.${k}: omitted`);
    });
    it.each(READBACK_CONTRACT_FIELDS)('an omitted contract field: %s', async (f) => {
        const rb = good(); delete rb.contracts.xPNTsTokenV2Ext[f];
        expect(await run(rb)).toContain(`contracts.xPNTsTokenV2Ext.${f}: omitted`);
    });
    it.each([
        ['another schema', (rb: any) => { rb.schema = 'aoa-a7-readback/2'; }, /^schema:/],
        ['another chain', (rb: any) => { rb.header.chainId = 1; }, /header\.chainId 1 != 11155111/],
        ['another dump', (rb: any) => { rb.header.dumpSha256 = 'cd'.repeat(32); }, /header\.dumpSha256 .* != the loaded dump/],
        ['another fork block', (rb: any) => { rb.header.forkBlock = 401; }, /header\.forkBlock 401 != 400/],
        ['another hardfork', (rb: any) => { rb.header.hardfork = 'prague'; }, /header\.hardfork "prague" != amsterdam/],
        ['another SP commit', (rb: any) => { rb.header.spCommit = 'deadbeef'; }, /header\.spCommit "deadbeef" != the SP checkout/],
        ['another tag', (rb: any) => { rb.header.tag = 'v5.5.0-rc.7'; }, /header\.tag "v5\.5\.0-rc\.7" != pins\.tag/],
        ['another readback block', (rb: any) => { rb.header.readbackBlock = 499; }, /header\.readbackBlock 499 != pins\.readbackBlock 500/],
        ['no checks block', (rb: any) => { delete rb.checks; }, /^checks: omitted$/],
        ['a contract that is not pinned', (rb: any) => { rb.contracts.mystery = rb.contracts.xPNTsTokenV2Ext; }, /contracts\.mystery: not a pinned name/],
        ['a pinned contract left out', (rb: any) => { delete rb.contracts['addresses.dvtValidator']; }, /contracts\.addresses\.dvtValidator: omitted/],
        ['another address', (rb: any) => { rb.contracts.superPaymasterLens.address = A(0x99); }, /contracts\.superPaymasterLens\.address .* != pinned/],
        ['another codehash', (rb: any) => { rb.contracts.spAdminExtension.codehash = H(0x99); }, /contracts\.spAdminExtension\.codehash .* != pins\.codehashes\.spAdminExtension/],
        ['a null version on a contract that has version()', (rb: any) => { rb.contracts['addresses.registry'].version = null; }, /contracts\.addresses\.registry\.version null != version\(\) on chain "Registry-5\.8\.0"/],
        ['"unreadable" where the SDK reads a version', (rb: any) => { rb.contracts.aPNTsCapped.version = 'unreadable:timeout'; }, /contracts\.aPNTsCapped\.version "unreadable:timeout" != version\(\) on chain/],
        ['a version on a contract without version()', (rb: any) => { rb.contracts.spAdminExtension.version = 'Admin-1'; }, /contracts\.spAdminExtension\.version "Admin-1", but version\(\) reverts on chain/],
        ['another SP implementation', (rb: any) => { rb.contracts.superPaymaster.erc1967Impl = A(0x99); }, /contracts\.superPaymaster\.erc1967Impl .* != pinned/],
        ['another Registry implementation hash', (rb: any) => { rb.contracts['addresses.registry'].implCodehash = H(0x99); }, /contracts\.addresses\.registry\.implCodehash .* != pinned/],
        ['another extension', (rb: any) => { rb.contracts.superPaymaster.extension = A(0x99); }, /contracts\.superPaymaster\.extension .* != pinned/],
        ['an implementation on a non-proxy', (rb: any) => { rb.contracts.superPaymasterLens.erc1967Impl = A(0x99); }, /superPaymasterLens\.erc1967Impl .* not a proxy here/],
        ['another SP owner', (rb: any) => { rb.contracts.superPaymaster.owner = A(0x99); }, /contracts\.superPaymaster\.owner .* != owner\(\) on chain/],
        ['a Registry pendingOwner although it has none', (rb: any) => { rb.contracts['addresses.registry'].pendingOwner = A(0); }, /addresses\.registry\.pendingOwner .*, but pendingOwner\(\) reverts on chain/],
    ])('%s', async (_n, mutate, msg) => {
        const rb = good(); mutate(rb);
        const p = await run(rb);
        expect(p).toEqual(expect.arrayContaining([expect.stringMatching(msg)]));
        expect(p).toHaveLength(1);
    });
    it('the chain disagreeing with a version pin is reported even when the file matches the chain', async () => {
        const chain = { ...CHAIN, [A(0x13)]: { version: { kind: 'value', value: 'SuperPaymasterLens-1.2.0' } as Observed } };
        const rb = good(); rb.contracts.superPaymasterLens.version = 'SuperPaymasterLens-1.2.0';
        expect(await run(rb, chain)).toEqual(['contracts.superPaymasterLens: version() "SuperPaymasterLens-1.2.0" != its pin "SuperPaymasterLens-1.2.2"']);
    });
    it('a read the SDK could not make is a problem, not a pass', async () => {
        const chain = { ...CHAIN, [A(0x21)]: { ...CHAIN[A(0x21)], owner: { kind: 'error', detail: 'timeout' } as Observed } };
        expect(await run(good(), chain)).toEqual(['contracts.addresses.registry.owner: the SDK could not read owner() (timeout)']);
    });
});
