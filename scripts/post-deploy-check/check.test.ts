/**
 * Post-deploy check: driven end to end through fake EIP-1193 providers (fakeChain.ts).
 * Nothing in the checker is mocked; each provider answers raw JSON-RPC from its own state.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pad, toEventSelector, type Abi, type AbiEvent, type Address } from 'viem';
import { ABI_REGISTRY } from './abis.js';
import { ExpectationsError, parseExpectations, validateExpectations, type Expectations } from './expectations.js';
import { REPLAY_CAVEAT, REPUTATION_SOURCE_EVENT, formatReport, runChecks, type Report, type Result } from './run.js';
import { blockHash, fakeProvider, ownershipLog, reputationLog, type FakeChain } from './fakeChain.js';
import type { NamedProvider } from './rpc.js';
import { main } from './check.js';

const HERE = dirname(fileURLToPath(import.meta.url));

const REGISTRY = '0x2000000000000000000000000000000000000001' as Address;
const SP = '0x2000000000000000000000000000000000000002' as Address;
const STAKING = '0x2000000000000000000000000000000000000003' as Address;
const AGG = '0x2000000000000000000000000000000000000004' as Address;
const DEPLOYER = '0x2000000000000000000000000000000000000009' as Address;
const SRC1 = '0x3000000000000000000000000000000000000001' as Address;
const SRC2 = '0x3000000000000000000000000000000000000002' as Address;
const SRC3 = '0x3000000000000000000000000000000000000003' as Address;
const SRC4 = '0x3000000000000000000000000000000000000004' as Address;
const TL = '0x2000000000000000000000000000000000000005' as Address;
const SAFE = '0x2000000000000000000000000000000000000006' as Address;
const PROPOSER = `0x${'b0'.repeat(32)}` as const;
const ROLE_A = `0x${'a1'.repeat(32)}` as const;
const ROLE_B = `0x${'a2'.repeat(32)}` as const;

const repEvent = (ABI_REGISTRY.Registry as Abi).find(x => x.type === 'event' && x.name === REPUTATION_SOURCE_EVENT) as AbiEvent;
const ownEvent = (ABI_REGISTRY.Registry as Abi).find(x => x.type === 'event' && x.name === 'OwnershipTransferred') as AbiEvent;
const ZERO = '0x0000000000000000000000000000000000000000' as Address;

interface WorldOpts {
    seed?: string;
    finalized?: bigint;
    spVersion?: string;
    aggBalance?: bigint;
    spOwner?: Address;
    aggIsSlasher?: boolean;
    /** Owner of every Registry role config. */
    roleOwner?: Address;
    /** Addresses holding every TimelockController role on TL. */
    tlHolders?: Address[];
    /** Replay events: [source, active, block]. */
    events?: [Address, boolean, bigint][];
    /** Storage answers for isReputationSource; defaults to the replay result. */
    sourceState?: Record<string, boolean>;
    /** Owner set by Registry.initialize (OwnershipTransferred 0x0 -> owner at block 6); null = no such log. Default: DEPLOYER. */
    initOwner?: Address | null;
    /** Registry.initialize sets isReputationSource[owner] = true WITHOUT an event; default false (as if revoked). */
    initOwnerIsSource?: boolean;
    chainId?: number;
}

function world(o: WorldOpts = {}): FakeChain {
    const events = o.events ?? [[SRC1, true, 10n], [SRC2, true, 20n], [SRC3, true, 30n], [SRC3, false, 40n]];
    const replay = new Map<string, boolean>();
    for (const [a, on] of events) replay.set(a.toLowerCase(), on);
    const sourceState: Record<string, boolean> = o.sourceState ?? Object.fromEntries(replay);
    const initOwner = o.initOwner === undefined ? DEPLOYER : o.initOwner;
    if (initOwner && o.initOwnerIsSource) sourceState[initOwner.toLowerCase()] = true;
    const chain: FakeChain = {
        chainId: o.chainId ?? 11155111,
        finalized: o.finalized ?? 100n,
        hashSeed: o.seed ?? 'canonical',
        contracts: {},
        balances: { [AGG.toLowerCase()]: o.aggBalance ?? 0n },
        logs: [],
    };
    chain.contracts[REGISTRY.toLowerCase()] = {
        abi: ABI_REGISTRY.Registry,
        fns: {
            version: () => 'Registry-5.10.1',
            owner: () => DEPLOYER,
            isReputationSource: ([a]) => sourceState[(a as string).toLowerCase()] ?? false,
            getRoleConfig: () => ({
                minStake: 0n, ticketPrice: 0n, slashThreshold: 0, slashBase: 0, slashInc: 0, slashMax: 0, exitFeePercent: 0,
                isActive: true, minExitFee: 0n, description: 'x', owner: o.roleOwner ?? TL, roleLockDuration: 0n,
            }),
        },
    };
    chain.contracts[SP.toLowerCase()] = {
        abi: ABI_REGISTRY.SuperPaymaster,
        fns: { version: () => o.spVersion ?? 'SuperPaymaster-5.5.2', owner: () => o.spOwner ?? DEPLOYER },
    };
    chain.contracts[STAKING.toLowerCase()] = {
        abi: ABI_REGISTRY.GTokenStaking,
        fns: {
            version: () => 'GTokenStaking-3.3.0',
            owner: () => DEPLOYER,
            authorizedSlashers: ([a]) => (a as string).toLowerCase() === AGG.toLowerCase() ? (o.aggIsSlasher ?? false) : false,
            REGISTRY: () => REGISTRY,
        },
    };
    chain.contracts[TL.toLowerCase()] = {
        abi: ABI_REGISTRY.TimelockController,
        fns: {
            PROPOSER_ROLE: () => PROPOSER,
            hasRole: ([role, who]) => role === PROPOSER && (o.tlHolders ?? [SAFE]).some(h => h.toLowerCase() === (who as string).toLowerCase()),
        },
    };
    chain.logs = events.map(([a, on, b], i) => reputationLog(chain, REGISTRY, repEvent, a, on, b, i));
    if (initOwner) chain.logs.push(ownershipLog(REGISTRY, ownEvent, ZERO, initOwner, 6n, 0));
    return chain;
}

function table(over: Partial<Expectations> = {}, assertions?: unknown[]): Expectations {
    return validateExpectations({
        schema: 'aastar-post-deploy-check/1',
        placeholder: false,
        chainId: 11155111,
        block: 'finalized',
        deployer: 'D',
        principals: { D: { address: DEPLOYER }, SAFE: { address: SAFE } },
        aggregators: ['$AGG'],
        contracts: {
            AGG: { abi: 'BLSAggregatorV414Dev', address: AGG },
            TL: { abi: 'TimelockController', address: TL },
            Registry: { abi: 'Registry', address: REGISTRY },
            SuperPaymaster: { abi: 'SuperPaymaster', address: SP },
            GTokenStaking: { abi: 'GTokenStaking', address: STAKING },
        },
        assertions: assertions ?? [
            { id: 'sp-version', kind: 'version', contract: 'SuperPaymaster', expected: 'SuperPaymaster-5.5.2' },
            { id: 'agg-balance', kind: 'balanceZero', address: AGG },
            { id: 'agg-owner', kind: 'notOwnerOf', address: AGG, contracts: ['Registry', 'SuperPaymaster', 'GTokenStaking'] },
            { id: 'rep-set', kind: 'reputationSourceSet', registry: 'Registry', expected: [SRC1, SRC2], mustNotBe: ['$D'], fromBlock: 5, logChunkSize: 7 },
            { id: 'agg-slasher', kind: 'authorizedSlasher', staking: 'GTokenStaking', address: AGG, expected: false },
            { id: 'staking-registry', kind: 'call', contract: 'GTokenStaking', function: 'REGISTRY', args: [], compare: 'eq', expected: REGISTRY },
        ],
        ...over,
    });
}

const pair = (a: FakeChain, b: FakeChain = a): [NamedProvider, NamedProvider] => [
    { label: 'A', provider: fakeProvider(a) },
    { label: 'B', provider: fakeProvider(b) },
];
const row = (r: Report, id: string): Result => {
    const x = [...r.preflight, ...r.results].find(y => y.id === id);
    if (!x) throw new Error(`no row ${id}`);
    return x;
};

describe('post-deploy-check: all kinds PASS on a consistent pair', () => {
    it('every row PASS and exit 0', async () => {
        const r = await runChecks(table(), pair(world(), world()));
        expect([...r.preflight, ...r.results].map(x => `${x.id}:${x.status}`)).toEqual([
            'preflight:chainId:PASS', 'preflight:block:PASS',
            'sp-version:PASS', 'agg-balance:PASS', 'agg-owner:PASS', 'rep-set:PASS', 'agg-slasher:PASS', 'staking-registry:PASS',
        ]);
        expect(r.exitCode).toBe(0);
        expect(r.pinned?.number).toBe(100n);
        // Readings carry both providers' values.
        expect(row(r, 'sp-version').readings[0]).toEqual({ what: 'SuperPaymaster.version()', a: '"SuperPaymaster-5.5.2"', b: '"SuperPaymaster-5.5.2"' });
    });

    it('binds every eth_call / eth_getBalance to the pinned block hash, and sends no transaction', async () => {
        const a = world();
        const ps = pair(a, world());
        await runChecks(table(), ps);
        const calls = (ps[0].provider as ReturnType<typeof fakeProvider>).calls;
        const pinnedHash = blockHash(a, 100n);
        for (const c of calls.filter(x => x.method === 'eth_call' || x.method === 'eth_getBalance')) {
            expect(c.params[1]).toEqual({ blockHash: pinnedHash });
        }
        expect(calls.some(c => /send|sign/i.test(c.method))).toBe(false);
    });
});

describe('post-deploy-check: each kind FAILs on a wrong value', () => {
    it('version', async () => {
        const r = await runChecks(table(), pair(world({ spVersion: 'SuperPaymaster-5.5.1' }), world({ spVersion: 'SuperPaymaster-5.5.1' })));
        expect(row(r, 'sp-version').status).toBe('FAIL');
        expect(row(r, 'sp-version').detail).toContain('"SuperPaymaster-5.5.1"');
        expect(r.exitCode).toBe(1);
    });
    it('balanceZero', async () => {
        const r = await runChecks(table(), pair(world({ aggBalance: 1n }), world({ aggBalance: 1n })));
        expect(row(r, 'agg-balance').status).toBe('FAIL');
        expect(row(r, 'agg-balance').detail).toContain('1 wei');
    });
    it('notOwnerOf', async () => {
        const r = await runChecks(table(), pair(world({ spOwner: AGG }), world({ spOwner: AGG })));
        expect(row(r, 'agg-owner').status).toBe('FAIL');
        expect(row(r, 'agg-owner').detail).toContain('owner() of SuperPaymaster');
    });
    it('authorizedSlasher', async () => {
        const r = await runChecks(table(), pair(world({ aggIsSlasher: true }), world({ aggIsSlasher: true })));
        expect(row(r, 'agg-slasher').status).toBe('FAIL');
    });
    it('call eq / neq', async () => {
        const t = table({}, [
            { id: 'eq-wrong', kind: 'call', contract: 'GTokenStaking', function: 'REGISTRY', args: [], compare: 'eq', expected: SP },
            { id: 'neq-ok', kind: 'call', contract: 'GTokenStaking', function: 'REGISTRY', args: [], compare: 'neq', expected: SP },
            { id: 'neq-wrong', kind: 'call', contract: 'GTokenStaking', function: 'REGISTRY', args: [], compare: 'neq', expected: REGISTRY.toLowerCase() },
            { id: 'args', kind: 'call', contract: 'GTokenStaking', function: 'authorizedSlashers(address)', args: [AGG], compare: 'eq', expected: false },
        ]);
        const r = await runChecks(t, pair(world(), world()));
        expect(row(r, 'eq-wrong').status).toBe('FAIL');
        expect(row(r, 'neq-ok').status).toBe('PASS');
        expect(row(r, 'neq-wrong').status).toBe('FAIL');
        expect(row(r, 'args').status).toBe('PASS');
    });
    it('unknown contract key, unknown ABI and unknown function each FAIL with the reason', async () => {
        const t = table({ contracts: {
            AGG: { abi: 'BLSAggregatorV414Dev', address: AGG },
            Registry: { abi: 'Registry', address: REGISTRY },
            GTokenStaking: { abi: 'GTokenStaking', address: STAKING },
            Weird: { abi: 'NoSuchAbi', address: SP },
        } }, [
            { id: 'no-key', kind: 'version', contract: 'Nope', expected: 'x' },
            { id: 'no-abi', kind: 'version', contract: 'Weird', expected: 'x' },
            { id: 'no-fn', kind: 'call', contract: 'GTokenStaking', function: 'doesNotExist', args: [], compare: 'eq', expected: 1 },
            { id: 'toString', kind: 'version', contract: 'toString', expected: 'x' },
        ]);
        const r = await runChecks(t, pair(world(), world()));
        expect(row(r, 'no-key')).toMatchObject({ status: 'FAIL', detail: expect.stringContaining('not defined in table.contracts') });
        expect(row(r, 'no-abi')).toMatchObject({ status: 'FAIL', detail: expect.stringContaining('ABI "NoSuchAbi"') });
        expect(row(r, 'no-fn')).toMatchObject({ status: 'FAIL', detail: expect.stringContaining('doesNotExist not found') });
        expect(row(r, 'toString').status).toBe('FAIL');
    });
});

describe('post-deploy-check: dual-provider guards', () => {
    it('FAILs when the two providers return different values, naming both', async () => {
        const r = await runChecks(table(), pair(world(), world({ spVersion: 'SuperPaymaster-5.5.1' })));
        const x = row(r, 'sp-version');
        expect(x.status).toBe('FAIL');
        expect(x.detail).toContain('providers disagree');
        expect(x.detail).toContain('A="SuperPaymaster-5.5.2"');
        expect(x.detail).toContain('B="SuperPaymaster-5.5.1"');
        expect(r.exitCode).toBe(1);
    });
    it('FAILs when only one provider reports a non-zero balance', async () => {
        const r = await runChecks(table(), pair(world(), world({ aggBalance: 5n })));
        expect(row(r, 'agg-balance').status).toBe('FAIL');
        expect(row(r, 'agg-balance').detail).toContain('A="0", B="5"');
    });
    it('FAILs when the providers return different logs for the replay', async () => {
        const r = await runChecks(table(), pair(world(), world({ events: [[SRC1, true, 10n], [SRC2, true, 20n]] })));
        expect(row(r, 'rep-set').status).toBe('FAIL');
        expect(row(r, 'rep-set').detail).toContain('providers disagree');
    });
    it('FAILs preflight and runs nothing when the block hashes differ', async () => {
        const r = await runChecks(table(), pair(world(), world({ seed: 'fork' })));
        expect(row(r, 'preflight:block').status).toBe('FAIL');
        expect(row(r, 'preflight:block').detail).toContain('hash differs');
        expect(r.results).toEqual([]);
        expect(r.exitCode).toBe(1);
    });
    it('FAILs when the hashes differ at an explicitly pinned block', async () => {
        const b = world();
        b.hashOverrides = { '50': `0x${'ee'.repeat(32)}` };
        const r = await runChecks(table({ block: 50 }), pair(world(), b));
        expect(row(r, 'preflight:block').status).toBe('FAIL');
        expect(r.exitCode).toBe(1);
    });
    it('pins the lower finalized head when the two heads differ, and checks hashes there', async () => {
        const r = await runChecks(table(), pair(world({ finalized: 100n }), world({ finalized: 103n })));
        expect(r.pinned?.number).toBe(100n);
        expect(r.exitCode).toBe(0);
    });
    it('FAILs preflight on a chain id mismatch', async () => {
        const r = await runChecks(table(), pair(world(), world({ chainId: 10 })));
        expect(row(r, 'preflight:chainId').status).toBe('FAIL');
        expect(r.exitCode).toBe(1);
    });
});

describe('post-deploy-check: reputationSourceSet verdict is state readback', () => {
    const rs = (extra: Record<string, unknown> = {}) => ({ id: 'rep-set', kind: 'reputationSourceSet', registry: 'Registry', expected: [SRC1, SRC2], mustNotBe: ['$D'], fromBlock: 5, ...extra });
    it('always prints the replay caveat', async () => {
        const r = await runChecks(table(), pair(world(), world()));
        expect(row(r, 'rep-set').status).toBe('PASS');
        expect(row(r, 'rep-set').detail).toContain(REPLAY_CAVEAT);
        expect(REPLAY_CAVEAT).toContain('事件重放不完整，结论以状态读回为准');
    });
    it('deployer made a source by initialize, with NO ReputationSourceUpdated event, is caught via mustNotBe', async () => {
        const w = () => world({ initOwnerIsSource: true });
        const r = await runChecks(table(), pair(w(), w()));
        expect(row(r, 'rep-set').status).toBe('FAIL');
        expect(row(r, 'rep-set').detail).toContain(`$D (${DEPLOYER}) must not be a source but reads isReputationSource == true`);
        // No ReputationSourceUpdated log names the deployer: the replay alone could not have seen it.
        expect(w().logs.some(l => l.topics[0] === toEventSelector(repEvent) && l.topics[1] === pad(DEPLOYER.toLowerCase() as `0x${string}`, { size: 32 }))).toBe(false);
    });
    it('the initialize owner, not named anywhere in the table, is found only through the seed and FAILs as extra', async () => {
        const w = () => world({ initOwner: SRC4, initOwnerIsSource: true });
        const r = await runChecks(table({}, [rs({ mustNotBe: [] })]), pair(w(), w()));
        expect(row(r, 'rep-set').status).toBe('FAIL');
        expect(row(r, 'rep-set').detail).toContain(`extra source not in expected set: ${SRC4} (found via initialize owner (OwnershipTransferred from 0x0 at block 6)`);
    });
    it('a table seed stands in for the initialize owner when no OwnershipTransferred log is reachable', async () => {
        const w = () => world({ initOwner: null, sourceState: { [SRC1.toLowerCase()]: true, [SRC2.toLowerCase()]: true, [SRC4.toLowerCase()]: true } });
        let r = await runChecks(table({}, [rs({ mustNotBe: [], seeds: [{ address: SRC4, source: 'initialize owner per deploy log' }] })]), pair(w(), w()));
        expect(row(r, 'rep-set').status).toBe('FAIL');
        expect(row(r, 'rep-set').detail).toContain(`extra source not in expected set: ${SRC4} (found via table seed`);
        // Without the seed and without the log, discovery has a known hole: INCOMPLETE, never PASS.
        const ok = () => world({ initOwner: null });
        r = await runChecks(table({}, [rs({ mustNotBe: [] })]), pair(ok(), ok()));
        expect(row(r, 'rep-set').status).toBe('INCOMPLETE');
        expect(row(r, 'rep-set').detail).toContain('initialize owner not found');
    });
    it('FAILs on one extra source found in the replay', async () => {
        const ev: [Address, boolean, bigint][] = [[SRC1, true, 10n], [SRC2, true, 20n], [SRC3, true, 30n]];
        const r = await runChecks(table(), pair(world({ events: ev }), world({ events: ev })));
        expect(row(r, 'rep-set').status).toBe('FAIL');
        expect(row(r, 'rep-set').detail).toContain(`extra source not in expected set: ${SRC3}`);
    });
    it('FAILs on one missing source (direct read, whatever the replay says)', async () => {
        const st = { [SRC1.toLowerCase()]: true, [SRC2.toLowerCase()]: false };
        const ev: [Address, boolean, bigint][] = [[SRC1, true, 10n], [SRC2, true, 20n]];
        const r = await runChecks(table(), pair(world({ events: ev, sourceState: st }), world({ events: ev, sourceState: st })));
        expect(row(r, 'rep-set').status).toBe('FAIL');
        expect(row(r, 'rep-set').detail).toContain(`expected source ${SRC2} (${SRC2}) reads isReputationSource == false`);
    });
    it('a fromBlock after the deployment misses the initialize owner and reports INCOMPLETE', async () => {
        const r = await runChecks(table({}, [rs({ fromBlock: 15 })]), pair(world(), world()));
        expect(row(r, 'rep-set').status).toBe('INCOMPLETE');
    });
    it('reports INCOMPLETE (never PASS) when the ABI has no ReputationSourceUpdated event', async () => {
        const noEvent = (ABI_REGISTRY.Registry as Abi).filter(x => !(x.type === 'event' && x.name === REPUTATION_SOURCE_EVENT));
        const t = table({ contracts: { AGG: { abi: 'BLSAggregatorV414Dev', address: AGG }, Registry: { abi: 'RegistryNoEvent', address: REGISTRY } } }, [rs({ fromBlock: 0 })]);
        const r = await runChecks(t, pair(world(), world()), { abis: { RegistryNoEvent: noEvent } });
        expect(row(r, 'rep-set').status).toBe('INCOMPLETE');
        expect(r.exitCode).toBe(2);
        expect(formatReport(r).join('\n')).toContain('[INCOMPLETE] rep-set');
    });
});

describe('post-deploy-check: expectations table validation', () => {
    const good = () => JSON.parse(JSON.stringify({
        schema: 'aastar-post-deploy-check/1', placeholder: false, chainId: 1, block: 'finalized',
        deployer: 'D', principals: { D: { address: DEPLOYER } },
        contracts: { R: { abi: 'Registry', address: REGISTRY } },
        assertions: [{ id: 'a', kind: 'version', contract: 'R', expected: 'x' }],
    }));
    const rejects = (mut: (t: any) => void, msg: string) => {
        const t = good();
        mut(t);
        expect(() => validateExpectations(t)).toThrow(ExpectationsError);
        expect(() => validateExpectations(t)).toThrow(msg);
    };
    it('accepts the minimal table', () => expect(() => validateExpectations(good())).not.toThrow());
    it('rejects a missing top-level field', () => rejects(t => delete t.chainId, 'missing field "chainId"'));
    it('rejects a wrong type', () => rejects(t => { t.placeholder = 'no'; }, 'placeholder: must be a boolean'));
    it('rejects a bad block spec', () => rejects(t => { t.block = 'latest'; }, 'table.block'));
    it('rejects an unknown assertion kind', () => rejects(t => { t.assertions[0].kind = 'exists'; }, 'unknown assertion kind'));
    it('rejects an unknown field in an assertion', () => rejects(t => { t.assertions[0].expect = 'x'; }, 'unknown field "expect"'));
    it('rejects an unknown top-level field', () => rejects(t => { t.extra = 1; }, 'unknown field "extra"'));
    it('rejects a missing assertion field', () => rejects(t => { delete t.assertions[0].expected; }, 'missing field "expected"'));
    it('rejects a bad address and a bad checksum', () => {
        rejects(t => { t.contracts.R.address = '0x1234'; }, 'not a valid address');
        rejects(t => { t.contracts.R.address = '0xAbCdEf0000000000000000000000000000000000'; }, 'not a valid address');
    });
    it('rejects duplicate ids, empty assertions, bad compare and wrong expected types', () => {
        rejects(t => { t.assertions.push({ ...t.assertions[0] }); }, 'duplicate id');
        rejects(t => { t.assertions = []; }, 'non-empty array');
        rejects(t => { t.assertions[0] = { id: 'c', kind: 'call', contract: 'R', function: 'f', args: [], compare: 'gt', expected: 1 }; }, 'compare');
        rejects(t => { t.assertions[0] = { id: 's', kind: 'authorizedSlasher', staking: 'R', address: AGG, expected: 'false' }; }, 'must be a boolean');
        rejects(t => { t.assertions[0] = { id: 'r', kind: 'reputationSourceSet', registry: 'R', expected: [SRC1, SRC1], mustNotBe: [], fromBlock: 0 }; }, 'duplicate address');
        rejects(t => { t.assertions[0] = { id: 'r', kind: 'reputationSourceSet', registry: 'R', expected: [SRC1], mustNotBe: [] }; }, 'missing field "fromBlock"');
        rejects(t => { t.assertions[0] = { id: 'r', kind: 'reputationSourceSet', registry: 'R', expected: [SRC1], fromBlock: 0 }; }, 'missing field "mustNotBe"');
        rejects(t => { t.assertions[0] = { id: 'r', kind: 'reputationSourceSet', registry: 'R', expected: [SRC1], mustNotBe: [SRC1], fromBlock: 0 }; }, 'also listed in expected');
        rejects(t => { t.assertions[0] = { id: 'r', kind: 'reputationSourceSet', registry: 'R', expected: [], mustNotBe: [], fromBlock: 0, seeds: [{ address: SRC1 }] }; }, 'missing field "source"');
    });
    it('rejects bad references, an unresolved deployer and unresolved names without a reason', () => {
        rejects(t => { t.assertions[0] = { id: 'b', kind: 'balanceZero', address: '$NOPE' }; }, 'names nothing');
        rejects(t => { t.principals.D = { address: null, source: 'not given' }; }, 'deployer principal must have a resolved address');
        rejects(t => { t.deployer = 'X'; }, 'table.deployer');
        rejects(t => { delete t.deployer; }, 'missing field "deployer"');
        rejects(t => { t.principals.X = { address: null }; }, 'must carry a "source"');
        rejects(t => { t.contracts.R = { abi: 'Registry', address: null }; }, 'must carry a "source"');
        rejects(t => { t.principals.R = { address: DEPLOYER }; }, 'also declared in principals');
        rejects(t => { t.assertions[0] = { id: 'p', kind: 'privilege', contract: 'R', function: 'owner', args: [], deployerException: {} }; }, 'missing field "reason"');
        rejects(t => { t.assertions[0] = { id: 'p', kind: 'privilege', contract: 'R', function: 'owner', args: [{ $call: 'X', y: 1 }] }; }, '$call');
        rejects(t => { t.assertions[0] = { id: 'r', kind: 'roleOwners', registry: 'R', roles: [{ name: 'A', id: null }], expected: '$D' }; }, 'must carry a "source"');
        rejects(t => { t.assertions[0] = { id: 'r', kind: 'roleOwners', registry: 'R', roles: [{ name: 'A', id: '0x12' }], expected: '$D' }; }, 'bytes32');
    });
    it('rejects non-JSON text', () => expect(() => parseExpectations('{')).toThrow('not valid JSON'));
    it('the shipped example parses, is marked placeholder, and a placeholder run never exits 0', async () => {
        const ex = parseExpectations(readFileSync(join(HERE, 'expectations.example.json'), 'utf8'));
        expect(ex.placeholder).toBe(true);
        expect(ex.note).toMatch(/PLACEHOLDER/);
        expect(new Set(ex.assertions.map(a => a.kind))).toEqual(new Set(['version', 'balanceZero', 'notOwnerOf', 'reputationSourceSet', 'authorizedSlasher', 'call', 'privilege', 'roleOwners']));
        const r = await runChecks({ ...table(), placeholder: true }, pair(world(), world()));
        expect(r.exitCode).toBe(2);
    });
});

describe('post-deploy-check: deployer and aggregator rules on privileges', () => {
    const priv = (extra: Record<string, unknown>) => ({ id: 'p', kind: 'privilege', contract: 'SuperPaymaster', function: 'owner', args: [], ...extra });
    it('owner == expected holder PASSes; owner == deployer FAILs even with no expected holder', async () => {
        let r = await runChecks(table({}, [priv({ expected: '$SAFE' })]), pair(world({ spOwner: SAFE }), world({ spOwner: SAFE })));
        expect(row(r, 'p').status).toBe('PASS');
        r = await runChecks(table({}, [priv({})]), pair(world(), world()));
        expect(row(r, 'p').status).toBe('FAIL');
        expect(row(r, 'p').detail).toContain('is the deployer');
    });
    it('a row-level deployer exception with a reason lets the deployer pass, and the reason is printed', async () => {
        const r = await runChecks(table({}, [priv({ deployerException: { reason: 'kept until L7' } })]), pair(world(), world()));
        expect(row(r, 'p').status).toBe('PASS');
        expect(row(r, 'p').detail).toContain('table exception: kept until L7');
    });
    it('the exception does not waive a wrong expected holder', async () => {
        const r = await runChecks(table({}, [priv({ expected: '$SAFE', deployerException: { reason: 'x' } })]), pair(world(), world()));
        expect(row(r, 'p').status).toBe('FAIL');
    });
    it('a holder equal to an aggregator FAILs, with no exception possible', async () => {
        const r = await runChecks(table({}, [priv({ deployerException: { reason: 'x' } })]), pair(world({ spOwner: AGG }), world({ spOwner: AGG })));
        expect(row(r, 'p').status).toBe('FAIL');
        expect(row(r, 'p').detail).toContain('is aggregator $AGG');
    });
    it('an unresolved aggregator makes the rule FAIL as incomplete instead of passing', async () => {
        const t = table({ principals: { D: { address: DEPLOYER }, SAFE: { address: SAFE }, AGG2: { address: null, source: 'not in owner table' } }, aggregators: ['$AGG', '$AGG2'] }, [priv({ expected: '$SAFE' })]);
        const r = await runChecks(t, pair(world({ spOwner: SAFE }), world({ spOwner: SAFE })));
        expect(row(r, 'p').status).toBe('FAIL');
        expect(row(r, 'p').detail).toContain('UNRESOLVED $AGG2: not in owner table');
    });
    it('flag privileges: deployer holding a flag FAILs, $call args resolve on chain, exceptions apply', async () => {
        const flag = (who: string, expected: boolean, extra = {}) => ({ id: `f-${who}-${expected}`, kind: 'privilege', contract: 'TL', function: 'hasRole', args: [{ $call: 'PROPOSER_ROLE' }, who], expected, ...extra });
        let r = await runChecks(table({}, [flag('$SAFE', true), flag('$D', false)]), pair(world(), world()));
        expect(r.results.map(x => x.status)).toEqual(['PASS', 'PASS']);
        const held = world({ tlHolders: [SAFE, DEPLOYER] });
        r = await runChecks(table({}, [flag('$D', false), flag('$D', true)]), pair(held, world({ tlHolders: [SAFE, DEPLOYER] })));
        expect(r.results.map(x => x.status)).toEqual(['FAIL', 'FAIL']);
        expect(r.results[1].detail).toContain('deployer holds');
        r = await runChecks(table({}, [flag('$D', true, { deployerException: { reason: 'bootstrap' } })]), pair(world({ tlHolders: [DEPLOYER] }), world({ tlHolders: [DEPLOYER] })));
        expect(r.results[0].status).toBe('PASS');
    });
    it('an unresolved expected holder FAILs even when the actual holder looks harmless', async () => {
        const t = table({ principals: { D: { address: DEPLOYER }, SAFE: { address: SAFE }, TL48: { address: null, source: 'truncated in owner table' } } }, [priv({ expected: '$TL48' })]);
        const r = await runChecks(t, pair(world({ spOwner: SAFE }), world({ spOwner: SAFE })));
        expect(row(r, 'p').status).toBe('FAIL');
        expect(row(r, 'p').detail).toContain('UNRESOLVED $TL48: truncated in owner table');
    });
    it('an unresolved contract FAILs with UNRESOLVED and its source', async () => {
        const t = table({ contracts: { AGG: { abi: 'BLSAggregatorV414Dev', address: AGG }, SuperPaymaster: { abi: 'SuperPaymaster', address: null, source: 'owner table gives 0x09DF... only' } } }, [priv({})]);
        const r = await runChecks(t, pair(world(), world()));
        expect(row(r, 'p')).toMatchObject({ status: 'FAIL', detail: expect.stringContaining('UNRESOLVED contract SuperPaymaster: owner table gives 0x09DF... only') });
    });
});

describe('post-deploy-check: roleOwners', () => {
    const roles = [{ name: 'A', id: ROLE_A }, { name: 'B', id: ROLE_B }];
    const ro = (extra: Record<string, unknown> = {}) => ({ id: 'ro', kind: 'roleOwners', registry: 'Registry', roles, expected: '$TL', ...extra });
    it('PASSes when every role owner is the expected timelock', async () => {
        const r = await runChecks(table({}, [ro()]), pair(world(), world()));
        expect(row(r, 'ro').status).toBe('PASS');
    });
    it('FAILs when a role owner is the deployer, naming the role', async () => {
        const r = await runChecks(table({}, [ro()]), pair(world({ roleOwner: DEPLOYER }), world({ roleOwner: DEPLOYER })));
        expect(row(r, 'ro').status).toBe('FAIL');
        expect(row(r, 'ro').detail).toContain('getRoleConfig(A).owner is the deployer');
    });
    it('FAILs on a role whose id the table does not give, and on an unresolved expected holder', async () => {
        let r = await runChecks(table({}, [ro({ roles: [...roles, { name: 'KMS', id: null, source: 'owner table gives names only' }] })]), pair(world(), world()));
        expect(row(r, 'ro').status).toBe('FAIL');
        expect(row(r, 'ro').detail).toContain('role KMS: id UNRESOLVED (owner table gives names only)');
        const t = table({ principals: { D: { address: DEPLOYER }, SAFE: { address: SAFE }, TL48: { address: null, source: 'truncated' } } }, [ro({ expected: '$TL48' })]);
        r = await runChecks(t, pair(world(), world()));
        expect(row(r, 'ro').status).toBe('FAIL');
        expect(row(r, 'ro').detail).toContain('UNRESOLVED $TL48');
    });
    it('FAILs when a role owner is some other address than expected (neither deployer nor aggregator)', async () => {
        const r = await runChecks(table({}, [ro()]), pair(world({ roleOwner: SAFE }), world({ roleOwner: SAFE })));
        expect(row(r, 'ro').status).toBe('FAIL');
        expect(row(r, 'ro').detail).toContain(`getRoleConfig(A).owner is ${SAFE}, expected $TL`);
    });
    it('FAILs when the providers disagree on one role owner', async () => {
        const r = await runChecks(table({}, [ro()]), pair(world(), world({ roleOwner: SAFE })));
        expect(row(r, 'ro').status).toBe('FAIL');
        expect(row(r, 'ro').detail).toContain('providers disagree');
    });
});

describe('post-deploy-check: rc.8 v0 example table', () => {
    it('parses, is marked v0 / not final with its origin commit, and keeps unresolved names unresolved', () => {
        const v0 = parseExpectations(readFileSync(join(HERE, 'expectations.rc8-v0-835db34c.example.json'), 'utf8'));
        expect(v0.placeholder).toBe(true);
        expect(v0.origin).toMatchObject({ ref: '835db34c', version: 'v0' });
        expect(v0.principals[v0.deployer].address).toBe('0xb5600060e6de5E11D3636731964218E53caadf0E');
        // The owner table gives TL48 only truncated: it must stay null, never be filled by guesswork.
        expect(v0.contracts.TL48.address).toBeNull();
        expect(v0.contracts.Registry.address).toBe('0xf5Bf37ca83AfdAab73691bA7eCcDfA69b8708E71');
        const rsr = v0.assertions.find(a => a.kind === 'reputationSourceSet');
        expect(rsr && rsr.kind === 'reputationSourceSet' && { mustNotBe: rsr.mustNotBe, fromBlock: rsr.fromBlock }).toEqual({ mustNotBe: ['$D'], fromBlock: 11151002 });
        const ro = v0.assertions.find(a => a.kind === 'roleOwners');
        expect(ro && ro.kind === 'roleOwners' && ro.roles.map(r => r.name)).toEqual(['COMMUNITY', 'ENDUSER', 'PAYMASTER_AOA', 'PAYMASTER_SUPER', 'DVT', 'ANODE', 'KMS']);
        expect(ro && ro.kind === 'roleOwners' && ro.roles.every(r => r.id === null)).toBe(true);
    });
});

describe('post-deploy-check CLI: RPC URLs never reach output', () => {
    const URL_A = 'https://eth-sepolia.example-rpc.io/v2/SECRETKEYAAAA1111';
    const URL_B = 'https://other-node.example.net/rpc?apikey=SECRETKEYBBBB2222';
    const secrets = [URL_A, URL_B, 'SECRETKEYAAAA1111', 'SECRETKEYBBBB2222', 'eth-sepolia.example-rpc.io', 'other-node.example.net'];

    function fetchFor(map: Record<string, ReturnType<typeof fakeProvider>>, opts: { throwFor?: string; httpErrorFor?: string } = {}) {
        return async (url: string, init: { body: string }) => {
            if (url === opts.throwFor) throw new TypeError(`fetch failed`, { cause: new Error(`getaddrinfo ENOTFOUND ${new URL(url).host} while requesting ${url}`) });
            if (url === opts.httpErrorFor) return { ok: false, status: 401, json: async () => ({}) };
            const req = JSON.parse(init.body);
            try {
                const result = await map[url].request(req);
                return { ok: true, status: 200, json: async () => ({ jsonrpc: '2.0', id: req.id, result }) };
            } catch (e) {
                return { ok: true, status: 200, json: async () => ({ jsonrpc: '2.0', id: req.id, error: { code: -32000, message: `${(e as Error).message} at ${url}` } }) };
            }
        };
    }
    async function runCli(argv: string[], env: Record<string, string>, fetchImpl: any, tableText = JSON.stringify(rawTable())) {
        const lines: string[] = [];
        const code = await main(argv, env, { out: s => lines.push(s), err: s => lines.push(s), readFile: () => tableText, fetch: fetchImpl });
        return { code, text: lines.join('\n') };
    }
    const rawTable = () => ({
        schema: 'aastar-post-deploy-check/1', placeholder: false, chainId: 11155111, block: 'finalized',
        deployer: 'D', principals: { D: { address: DEPLOYER } },
        contracts: { SuperPaymaster: { abi: 'SuperPaymaster', address: SP }, Registry: { abi: 'Registry', address: REGISTRY } },
        assertions: [
            { id: 'sp-version', kind: 'version', contract: 'SuperPaymaster', expected: 'SuperPaymaster-5.5.2' },
            // Reverts on the fake -> the RPC error message carries the URL.
            { id: 'reverting', kind: 'call', contract: 'Registry', function: 'isReputationSource', args: [SRC1], compare: 'eq', expected: true },
        ],
    });
    const noSecrets = (text: string) => { for (const s of secrets) expect(text).not.toContain(s); };

    it('happy path via env vars: exit reflects results and no URL fragment is printed', async () => {
        const a = world({ sourceState: {} }); const b = world({ sourceState: {} });
        a.contracts[REGISTRY.toLowerCase()].fns.isReputationSource = () => { throw new Error('boom'); };
        b.contracts[REGISTRY.toLowerCase()].fns.isReputationSource = () => { throw new Error('boom'); };
        const map = { [URL_A]: fakeProvider(a), [URL_B]: fakeProvider(b) };
        const { code, text } = await runCli(['--expect', 't.json'], { POST_DEPLOY_RPC_A: URL_A, POST_DEPLOY_RPC_B: URL_B }, fetchFor(map));
        expect(text).toContain('[PASS] sp-version');
        expect(text).toContain('[FAIL] reverting');
        expect(text).toContain('<rpc-A>');
        expect(code).toBe(1);
        noSecrets(text);
    });
    it('transport failure whose message embeds the URL and host is redacted', async () => {
        const map = { [URL_A]: fakeProvider(world()), [URL_B]: fakeProvider(world()) };
        const { code, text } = await runCli(['--expect', 't.json', '--rpc-a', URL_A, '--rpc-b', URL_B], {}, fetchFor(map, { throwFor: URL_B }));
        expect(code).toBe(1);
        expect(text).toContain('transport error');
        noSecrets(text);
    });
    it('HTTP error, same-endpoint refusal and a bad argument print no URL', async () => {
        const map = { [URL_A]: fakeProvider(world()), [URL_B]: fakeProvider(world()) };
        let r = await runCli(['--expect', 't.json'], { POST_DEPLOY_RPC_A: URL_A, POST_DEPLOY_RPC_B: URL_B }, fetchFor(map, { httpErrorFor: URL_A }));
        expect(r.code).toBe(1); expect(r.text).toContain('HTTP 401'); noSecrets(r.text);
        r = await runCli(['--expect', 't.json'], { POST_DEPLOY_RPC_A: URL_A, POST_DEPLOY_RPC_B: URL_A }, fetchFor(map));
        expect(r.code).toBe(1); expect(r.text).toContain('same endpoint'); noSecrets(r.text);
        r = await runCli(['--expect', 't.json', URL_A], { POST_DEPLOY_RPC_A: URL_A, POST_DEPLOY_RPC_B: URL_B }, fetchFor(map));
        expect(r.code).toBe(1); noSecrets(r.text);
    });
    it('an invalid table is rejected with exit 1 before any RPC call', async () => {
        let called = 0;
        const t = rawTable() as any; t.assertions[0].kind = 'mystery';
        const { code, text } = await runCli(['--expect', 't.json'], { POST_DEPLOY_RPC_A: URL_A, POST_DEPLOY_RPC_B: URL_B },
            async () => { called++; throw new Error('should not be called'); }, JSON.stringify(t));
        expect(code).toBe(1);
        expect(text).toContain('unknown assertion kind');
        expect(called).toBe(0);
    });
    it('missing second endpoint is refused', async () => {
        const { code, text } = await runCli(['--expect', 't.json'], { POST_DEPLOY_RPC_A: URL_A }, async () => { throw new Error('x'); });
        expect(code).toBe(1);
        expect(text).toContain('two RPC endpoints are required');
        noSecrets(text);
    });
});
