/**
 * Read-only post-deploy check engine.
 *
 * Every read is made on BOTH providers against the SAME block (bound by hash via EIP-1898 for
 * eth_call / eth_getBalance). A read that fails on either side, or whose two values differ, is a
 * FAIL that names both values. Nothing here signs or sends a transaction.
 */
import {
    decodeEventLog,
    decodeFunctionResult,
    encodeFunctionData,
    getAddress,
    isAddress,
    toEventSelector,
    type Abi,
    type AbiEvent,
    type AbiFunction,
    type AbiParameter,
    type Address,
    type Hex,
} from 'viem';
import { ABI_REGISTRY } from './abis.js';
import { isRef } from './expectations.js';
import type {
    Assertion,
    DeployerException,
    PrivilegeAssertion,
    RoleOwnersAssertion,
    AuthorizedSlasherAssertion,
    BalanceZeroAssertion,
    CallAssertion,
    Expectations,
    JsonValue,
    NotOwnerOfAssertion,
    ReputationSourceSetAssertion,
    VersionAssertion,
} from './expectations.js';
import type { Eip1193Provider, NamedProvider } from './rpc.js';

export type Status = 'PASS' | 'FAIL' | 'INCOMPLETE';
export interface Reading { what: string; a: string; b: string }
export interface Result { id: string; kind: string; status: Status; detail: string; readings: Reading[] }
export interface PinnedBlock { number: bigint; hash: Hex }
export interface Report {
    placeholder: boolean;
    chainId: number;
    pinned?: PinnedBlock;
    preflight: Result[];
    results: Result[];
    exitCode: number;
}

/** Registry event whose replay rebuilds the reputation-source set. */
export const REPUTATION_SOURCE_EVENT = 'ReputationSourceUpdated';
const DEFAULT_LOG_CHUNK = 5_000;

class Fail extends Error {}
const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);
/** `$NAME` stays readable in output; a literal prints as itself. */
const show = (ref: string) => ref;
const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Stable, comparable text for any decoded value: bigint/number as decimal, hex lower-cased, keys sorted. */
export function canon(v: unknown): string {
    const norm = (x: unknown): unknown => {
        if (typeof x === 'bigint') return x.toString();
        if (typeof x === 'number') return Number.isInteger(x) ? BigInt(x).toString() : String(x);
        if (typeof x === 'string') return /^0x[0-9a-fA-F]*$/.test(x) ? x.toLowerCase() : x;
        if (Array.isArray(x)) return x.map(norm);
        if (x && typeof x === 'object') {
            return Object.fromEntries(Object.keys(x).sort().map(k => [k, norm((x as Record<string, unknown>)[k])]));
        }
        return x;
    };
    return JSON.stringify(norm(v));
}

class Ctx {
    readings: Reading[] = [];
    constructor(
        readonly ps: readonly [NamedProvider, NamedProvider],
        readonly pinned: PinnedBlock,
        readonly abis: Readonly<Record<string, Abi>>,
        readonly table: Expectations,
    ) {}

    /** Resolve a literal address or `$NAME`; an undeclared or unresolved (null) name is a FAIL. */
    addr(ref: string): Address {
        if (!isRef(ref)) return getAddress(ref);
        const n = ref.slice(1);
        const t = this.table;
        const e = own(t.principals, n) ? t.principals[n] : own(t.contracts, n) ? t.contracts[n] : undefined;
        if (!e) throw new Fail(`reference ${ref} is not declared`);
        if (!e.address) throw new Fail(`UNRESOLVED ${ref}: ${e.source ?? 'no address in table'}`);
        return e.address;
    }

    tryAddr(ref: string): { address: Address } | { problem: string } {
        try {
            return { address: this.addr(ref) };
        } catch (e) {
            if (e instanceof Fail) return { problem: e.message };
            throw e;
        }
    }

    get deployer(): Address { return this.addr(`$${this.table.deployer}`); }

    /** Read on both providers; record both values; FAIL if either errors or the values differ. */
    async both<T>(what: string, fn: (p: Eip1193Provider) => Promise<T>, show: (v: T) => string = canon): Promise<T> {
        const [ra, rb] = await Promise.allSettled([fn(this.ps[0].provider), fn(this.ps[1].provider)]);
        const txt = (r: PromiseSettledResult<T>) => (r.status === 'fulfilled' ? show(r.value) : `ERROR: ${errText(r.reason)}`);
        const a = txt(ra);
        const b = txt(rb);
        this.readings.push({ what, a, b });
        if (ra.status === 'rejected' || rb.status === 'rejected') {
            throw new Fail(`read failed for ${what} (A: ${a}; B: ${b})`);
        }
        if (a !== b) throw new Fail(`providers disagree on ${what}: A=${a}, B=${b}`);
        return ra.value;
    }
}

// ---------- ABI helpers ----------

function paramType(p: AbiParameter): string {
    if (p.type.startsWith('tuple')) {
        const comps = (p as { components?: readonly AbiParameter[] }).components ?? [];
        return `(${comps.map(paramType).join(',')})${p.type.slice('tuple'.length)}`;
    }
    return p.type;
}
const signatureOf = (f: AbiFunction) => `${f.name}(${f.inputs.map(paramType).join(',')})`;

interface Resolved { key: string; address: Address; abiName: string; abi: Abi }

function resolveContract(ctx: Ctx, table: Expectations, key: string): Resolved {
    const ref = own(table.contracts, key) ? table.contracts[key] : undefined;
    if (!ref) throw new Fail(`contract "${key}" is not defined in table.contracts`);
    const abi = own(ctx.abis, ref.abi) ? ctx.abis[ref.abi] : undefined;
    if (!abi) throw new Fail(`contract "${key}": ABI "${ref.abi}" is not a vendored @aastar/core ABI known to this script`);
    if (!ref.address) throw new Fail(`UNRESOLVED contract ${key}: ${ref.source ?? 'no address in table'}`);
    return { key, address: ref.address, abiName: ref.abi, abi };
}

function findFunction(c: Resolved, spec: string): AbiFunction {
    const fns = c.abi.filter((x): x is AbiFunction => x.type === 'function');
    if (spec.includes('(')) {
        const want = spec.replace(/\s+/g, '');
        const hit = fns.find(f => signatureOf(f) === want);
        if (!hit) throw new Fail(`function ${want} not found in ABI ${c.abiName}`);
        return hit;
    }
    const hits = fns.filter(f => f.name === spec);
    if (hits.length === 0) throw new Fail(`function ${spec} not found in ABI ${c.abiName}`);
    if (hits.length > 1) throw new Fail(`function ${spec} is overloaded in ABI ${c.abiName} (${hits.map(signatureOf).join(', ')}); give the full signature`);
    return hits[0];
}

function toArg(p: AbiParameter, v: JsonValue, where: string): unknown {
    const t = p.type;
    const arr = /^(.*)\[(\d*)\]$/.exec(t);
    if (arr) {
        if (!Array.isArray(v)) throw new Fail(`${where}: expected an array for ${t}`);
        if (arr[2] !== '' && v.length !== Number(arr[2])) throw new Fail(`${where}: expected ${arr[2]} elements for ${t}`);
        const inner = { ...p, type: arr[1] } as AbiParameter;
        return v.map((x, i) => toArg(inner, x, `${where}[${i}]`));
    }
    if (t === 'tuple') {
        const comps = (p as { components?: readonly AbiParameter[] }).components ?? [];
        if (Array.isArray(v)) {
            if (v.length !== comps.length) throw new Fail(`${where}: expected ${comps.length} tuple fields`);
            return comps.map((c, i) => toArg(c, v[i], `${where}.${c.name ?? i}`));
        }
        if (v && typeof v === 'object') {
            return Object.fromEntries(comps.map((c, i) => {
                const name = c.name ?? String(i);
                if (!(name in v)) throw new Fail(`${where}: missing tuple field ${name}`);
                return [name, toArg(c, (v as Record<string, JsonValue>)[name], `${where}.${name}`)];
            }));
        }
        throw new Fail(`${where}: expected an array or object for tuple`);
    }
    if (/^u?int\d*$/.test(t)) {
        if (typeof v === 'number' && Number.isSafeInteger(v)) return BigInt(v);
        if (typeof v === 'string' && /^(-?\d+|0x[0-9a-fA-F]+)$/.test(v)) return BigInt(v);
        throw new Fail(`${where}: expected an integer (number or decimal string) for ${t}`);
    }
    if (t === 'address') {
        if (typeof v !== 'string' || !isAddress(v, { strict: true })) throw new Fail(`${where}: expected an address`);
        return getAddress(v);
    }
    if (t === 'bool') {
        if (typeof v !== 'boolean') throw new Fail(`${where}: expected a boolean`);
        return v;
    }
    if (t === 'string') {
        if (typeof v !== 'string') throw new Fail(`${where}: expected a string`);
        return v;
    }
    if (/^bytes\d*$/.test(t)) {
        if (typeof v !== 'string' || !/^0x([0-9a-fA-F]{2})*$/.test(v)) throw new Fail(`${where}: expected hex bytes`);
        return v;
    }
    throw new Fail(`${where}: unsupported ABI type ${t}`);
}

async function ethCall(p: Eip1193Provider, to: Address, data: Hex, blockHash: Hex): Promise<Hex> {
    const r = await p.request({ method: 'eth_call', params: [{ to, data }, { blockHash }] });
    if (typeof r !== 'string' || !/^0x([0-9a-fA-F]{2})*$/.test(r)) throw new Error('eth_call returned a non-hex result');
    if (r === '0x') throw new Error('eth_call returned empty data (no code at address, or no such function)');
    return r as Hex;
}

async function readFn(ctx: Ctx, c: Resolved, fn: AbiFunction, args: readonly unknown[], what: string): Promise<unknown> {
    let data: Hex;
    try {
        data = encodeFunctionData({ abi: [fn], functionName: fn.name, args } as Parameters<typeof encodeFunctionData>[0]);
    } catch (e) {
        throw new Fail(`cannot encode ${signatureOf(fn)}: ${errText(e)}`);
    }
    return ctx.both(what, async p => {
        const raw = await ethCall(p, c.address, data, ctx.pinned.hash);
        return decodeFunctionResult({ abi: [fn], functionName: fn.name, data: raw } as Parameters<typeof decodeFunctionResult>[0]);
    });
}

// ---------- assertion kinds ----------

type Outcome = { status: Status; detail: string };

async function checkVersion(ctx: Ctx, table: Expectations, a: VersionAssertion): Promise<Outcome> {
    const c = resolveContract(ctx, table, a.contract);
    const fn = findFunction(c, 'version()');
    const v = await readFn(ctx, c, fn, [], `${a.contract}.version()`);
    if (typeof v !== 'string') throw new Fail(`version() did not decode to a string`);
    return v === a.expected
        ? { status: 'PASS', detail: `${a.contract}.version() == ${JSON.stringify(a.expected)}` }
        : { status: 'FAIL', detail: `${a.contract}.version() is ${JSON.stringify(v)}, expected ${JSON.stringify(a.expected)}` };
}

async function checkBalanceZero(ctx: Ctx, a: BalanceZeroAssertion): Promise<Outcome> {
    const target = ctx.addr(a.address);
    const bal = await ctx.both(`balance(${show(a.address)})`, async p => {
        const r = await p.request({ method: 'eth_getBalance', params: [target, { blockHash: ctx.pinned.hash }] });
        if (typeof r !== 'string' || !/^0x[0-9a-fA-F]+$/.test(r)) throw new Error('eth_getBalance returned a non-quantity');
        return BigInt(r);
    });
    return bal === 0n
        ? { status: 'PASS', detail: `balance of ${show(a.address)} (${target}) is 0` }
        : { status: 'FAIL', detail: `balance of ${show(a.address)} (${target}) is ${bal} wei, expected 0` };
}

async function checkNotOwnerOf(ctx: Ctx, table: Expectations, a: NotOwnerOfAssertion): Promise<Outcome> {
    const owned: string[] = [];
    const problems: string[] = [];
    const who = ctx.addr(a.address);
    for (const key of a.contracts) {
        try {
            const c = resolveContract(ctx, table, key);
            const fn = findFunction(c, 'owner()');
            const owner = await readFn(ctx, c, fn, [], `${key}.owner()`);
            if (typeof owner !== 'string' || !isAddress(owner, { strict: false })) throw new Fail(`${key}.owner() did not decode to an address`);
            if (getAddress(owner) === who) owned.push(key);
        } catch (e) {
            if (!(e instanceof Fail)) throw e;
            problems.push(e.message);
        }
    }
    if (problems.length > 0 || owned.length > 0) {
        const parts = [...(owned.length ? [`${show(a.address)} IS owner() of ${owned.join(', ')}`] : []), ...problems];
        return { status: 'FAIL', detail: parts.join('; ') };
    }
    return { status: 'PASS', detail: `${show(a.address)} is owner() of none of ${a.contracts.join(', ')}` };
}

async function checkAuthorizedSlasher(ctx: Ctx, table: Expectations, a: AuthorizedSlasherAssertion): Promise<Outcome> {
    const c = resolveContract(ctx, table, a.staking);
    const fn = findFunction(c, 'authorizedSlashers(address)');
    const v = await readFn(ctx, c, fn, [ctx.addr(a.address)], `${a.staking}.authorizedSlashers(${show(a.address)})`);
    if (typeof v !== 'boolean') throw new Fail('authorizedSlashers did not decode to a boolean');
    return v === a.expected
        ? { status: 'PASS', detail: `${a.staking}.authorizedSlashers(${show(a.address)}) == ${a.expected}` }
        : { status: 'FAIL', detail: `${a.staking}.authorizedSlashers(${show(a.address)}) is ${v}, expected ${a.expected}` };
}

/** Replace `$NAME` with its address and `{"$call": g}` with the value of zero-arg getter g on `c`. */
async function resolveJson(ctx: Ctx, c: Resolved, v: JsonValue): Promise<JsonValue> {
    if (typeof v === 'string') return isRef(v) ? ctx.addr(v) : v;
    if (Array.isArray(v)) {
        const out: JsonValue[] = [];
        for (const x of v) out.push(await resolveJson(ctx, c, x));
        return out;
    }
    if (v && typeof v === 'object') {
        if (typeof v.$call === 'string') {
            const g = findFunction(c, `${v.$call}()`);
            const r = await readFn(ctx, c, g, [], `${c.key}.${v.$call}()`);
            if (typeof r === 'bigint') return r.toString();
            if (typeof r === 'string' || typeof r === 'boolean' || typeof r === 'number') return r;
            throw new Fail(`${c.key}.${v.$call}() is not a scalar and cannot be used as an argument`);
        }
        const out: Record<string, JsonValue> = {};
        for (const [k, x] of Object.entries(v)) out[k] = await resolveJson(ctx, c, x);
        return out;
    }
    return v;
}

function pickField(v: unknown, field: string | undefined, what: string): unknown {
    if (field === undefined) return v;
    if (v && typeof v === 'object' && !Array.isArray(v) && own(v, field)) return (v as Record<string, unknown>)[field];
    throw new Fail(`${what} has no field "${field}"`);
}

async function readWithArgs(ctx: Ctx, table: Expectations, contract: string, fnSpec: string, rawArgs: JsonValue[], field?: string) {
    const c = resolveContract(ctx, table, contract);
    const fn = findFunction(c, fnSpec);
    if (rawArgs.length !== fn.inputs.length) throw new Fail(`${signatureOf(fn)} takes ${fn.inputs.length} args, table gives ${rawArgs.length}`);
    const resolved = (await resolveJson(ctx, c, rawArgs)) as JsonValue[];
    const args = fn.inputs.map((p, i) => toArg(p, resolved[i], `args[${i}]`));
    const shownArgs = rawArgs.map(x => (typeof x === 'string' ? x : JSON.stringify(x))).join(', ');
    const what = `${contract}.${fn.name}(${shownArgs})${field ? `.${field}` : ''}`;
    const v = pickField(await readFn(ctx, c, fn, args, what), field, what);
    return { c, v, what, args, fn };
}

async function checkCall(ctx: Ctx, table: Expectations, a: CallAssertion): Promise<Outcome> {
    const { c, v, what } = await readWithArgs(ctx, table, a.contract, a.function, a.args, a.field);
    const got = canon(v);
    const want = canon(await resolveJson(ctx, c, a.expected));
    const equal = got === want;
    const ok = a.compare === 'eq' ? equal : !equal;
    return {
        status: ok ? 'PASS' : 'FAIL',
        detail: `${what} = ${got}; ${a.compare} ${want}`,
    };
}

/**
 * The two readback rules every privileged address must pass: it is not the deployer (unless the
 * row records an exception with its reason) and it is no aggregator. Unresolved aggregators are
 * reported as problems, so the rule can never pass silently on a half-filled table.
 */
function holderRules(ctx: Ctx, holder: Address, exc: DeployerException | undefined, label: string): { problems: string[]; notes: string[] } {
    const problems: string[] = [];
    const notes: string[] = [];
    if (holder === ctx.deployer) {
        if (exc) notes.push(`${label} is the deployer; table exception: ${exc.reason}`);
        else problems.push(`${label} is the deployer ${ctx.deployer} ($${ctx.table.deployer})`);
    }
    for (const ref of ctx.table.aggregators) {
        const r = ctx.tryAddr(ref);
        if ('problem' in r) problems.push(`aggregator rule incomplete: ${r.problem}`);
        else if (r.address === holder) problems.push(`${label} is aggregator ${show(ref)}`);
    }
    return { problems, notes };
}

function outcome(problems: string[], notes: string[], okDetail: string): Outcome {
    if (problems.length) return { status: 'FAIL', detail: [...problems, ...notes].join('; ') };
    return { status: 'PASS', detail: [okDetail, ...notes].join('; ') };
}

async function checkPrivilege(ctx: Ctx, table: Expectations, a: PrivilegeAssertion): Promise<Outcome> {
    const { v, what, args, fn } = await readWithArgs(ctx, table, a.contract, a.function, a.args, a.field);
    const problems: string[] = [];
    const notes: string[] = [];
    if (typeof v === 'boolean') {
        if (typeof a.expected !== 'boolean') throw new Fail(`${what} is a flag; the row must give a boolean "expected"`);
        if (v !== a.expected) problems.push(`${what} is ${v}, expected ${a.expected}`);
        const subjectIsDeployer = fn.inputs.some((p, i) => p.type === 'address' && args[i] === ctx.deployer);
        if (v && subjectIsDeployer) {
            if (a.deployerException) notes.push(`deployer holds ${what}; table exception: ${a.deployerException.reason}`);
            else problems.push(`deployer holds ${what}`);
        }
        return outcome(problems, notes, `${what} == ${v}`);
    }
    if (typeof v !== 'string' || !isAddress(v, { strict: false })) throw new Fail(`${what} is neither an address nor a flag`);
    const holder = getAddress(v);
    if (typeof a.expected === 'boolean') throw new Fail(`${what} is an address; "expected" must be an address reference`);
    if (a.expected !== undefined) {
        const w = ctx.tryAddr(a.expected);
        if ('problem' in w) problems.push(`cannot compare with expected: ${w.problem}`);
        else if (w.address !== holder) problems.push(`${what} is ${holder}, expected ${show(a.expected)} (${w.address})`);
    }
    const r = holderRules(ctx, holder, a.deployerException, what);
    problems.push(...r.problems);
    notes.push(...r.notes);
    return outcome(problems, notes, `${what} = ${holder}${a.expected ? ` == ${show(a.expected)}` : ' (no expected holder in table; deployer/aggregator rules only)'}`);
}

async function checkRoleOwners(ctx: Ctx, table: Expectations, a: RoleOwnersAssertion): Promise<Outcome> {
    const c = resolveContract(ctx, table, a.registry);
    const fn = findFunction(c, 'getRoleConfig(bytes32)');
    const problems: string[] = [];
    const notes: string[] = [];
    const w = ctx.tryAddr(a.expected);
    if ('problem' in w) problems.push(`cannot compare with expected: ${w.problem}`);
    for (const role of a.roles) {
        if (role.id === null) { problems.push(`role ${role.name}: id UNRESOLVED (${role.source ?? 'not in table'})`); continue; }
        const what = `${a.registry}.getRoleConfig(${role.name}).owner`;
        try {
            const owner = pickField(await readFn(ctx, c, fn, [role.id], what), 'owner', what);
            if (typeof owner !== 'string' || !isAddress(owner, { strict: false })) throw new Fail(`${what} is not an address`);
            const holder = getAddress(owner);
            if ('address' in w && holder !== w.address) problems.push(`${what} is ${holder}, expected ${show(a.expected)} (${w.address})`);
            const r = holderRules(ctx, holder, a.deployerException, what);
            problems.push(...r.problems);
            notes.push(...r.notes);
        } catch (e) {
            if (!(e instanceof Fail)) throw e;
            problems.push(e.message);
        }
    }
    return outcome(problems, notes, `all ${a.roles.length} role owners == ${show(a.expected)}`);
}

function findReputationEvent(abi: Abi): AbiEvent | undefined {
    return abi.find((x): x is AbiEvent =>
        x.type === 'event' && x.name === REPUTATION_SOURCE_EVENT && x.inputs.length === 2
        && x.inputs[0].type === 'address' && x.inputs[0].indexed === true
        && x.inputs[1].type === 'bool' && !x.inputs[1].indexed);
}

interface RawLog { address: string; topics: Hex[]; data: Hex; blockNumber: string; blockHash: Hex; transactionHash: Hex; logIndex: string; removed?: boolean }

const logKey = (l: RawLog) => canon([l.address, l.blockNumber, l.blockHash, l.transactionHash, l.logIndex, l.topics, l.data, l.removed ?? false]);

async function checkReputationSourceSet(ctx: Ctx, table: Expectations, a: ReputationSourceSetAssertion): Promise<Outcome> {
    const c = resolveContract(ctx, table, a.registry);
    const isSrc = findFunction(c, 'isReputationSource(address)');
    const ev = findReputationEvent(c.abi);
    const expected = new Set(a.expected.map(x => ctx.addr(x)));

    const stateOf = async (addr: Address): Promise<boolean> => {
        const v = await readFn(ctx, c, isSrc, [addr], `${a.registry}.isReputationSource(${addr})`);
        if (typeof v !== 'boolean') throw new Fail('isReputationSource did not decode to a boolean');
        return v;
    };

    if (!ev) {
        // No way to enumerate: only "every expected address is a source" can be shown. Never PASS.
        const notTrue: string[] = [];
        for (const addr of expected) if (!(await stateOf(addr))) notTrue.push(addr);
        if (notTrue.length) return { status: 'FAIL', detail: `isReputationSource false for expected ${notTrue.join(', ')}` };
        return {
            status: 'INCOMPLETE',
            detail: `all ${a.expected.length} expected addresses are sources, but ABI ${c.abiName} has no enumerable getter and no ${REPUTATION_SOURCE_EVENT}(address indexed,bool) event, so extra sources cannot be ruled out`,
        };
    }

    const to = ctx.pinned.number;
    const from = BigInt(a.fromBlock);
    if (from > to) throw new Fail(`fromBlock ${from} is after the pinned block ${to}`);
    const chunk = BigInt(a.logChunkSize ?? DEFAULT_LOG_CHUNK);
    const topic0 = toEventSelector(ev);
    const logs: RawLog[] = [];
    for (let lo = from; lo <= to; lo += chunk) {
        const hi = lo + chunk - 1n < to ? lo + chunk - 1n : to;
        const part = await ctx.both(
            `logs ${REPUTATION_SOURCE_EVENT} [${lo}..${hi}]`,
            async p => {
                const r = await p.request({
                    method: 'eth_getLogs',
                    params: [{ address: c.address, topics: [topic0], fromBlock: `0x${lo.toString(16)}`, toBlock: `0x${hi.toString(16)}` }],
                });
                if (!Array.isArray(r)) throw new Error('eth_getLogs returned a non-array');
                return r as RawLog[];
            },
            ls => `${ls.length} log(s) ${canon(ls.map(logKey))}`,
        );
        for (const l of part) {
            if (l.removed) throw new Fail(`a log in [${lo}..${hi}] is marked removed (reorg)`);
            const bn = BigInt(l.blockNumber);
            if (bn < lo || bn > hi) throw new Fail(`log at block ${bn} lies outside the requested range [${lo}..${hi}]`);
            if (getAddress(l.address) !== c.address) throw new Fail(`log from unexpected address ${l.address}`);
            if (bn === to && l.blockHash.toLowerCase() !== ctx.pinned.hash.toLowerCase()) throw new Fail(`log in the pinned block carries a different block hash`);
            logs.push(l);
        }
    }
    logs.sort((x, y) => {
        const d = BigInt(x.blockNumber) - BigInt(y.blockNumber);
        return d !== 0n ? (d < 0n ? -1 : 1) : Number(BigInt(x.logIndex) - BigInt(y.logIndex));
    });

    const replay = new Map<Address, boolean>();
    for (const l of logs) {
        const d = decodeEventLog({ abi: [ev], topics: l.topics as [Hex, ...Hex[]], data: l.data }) as { args: readonly unknown[] | Record<string, unknown> };
        const vals = Array.isArray(d.args) ? d.args : Object.values(d.args as Record<string, unknown>);
        replay.set(getAddress(vals[0] as string), vals[1] as boolean);
    }
    const active = new Set([...replay].filter(([, on]) => on).map(([k]) => k));

    const missing = [...expected].filter(x => !active.has(x));
    const extra = [...active].filter(x => !expected.has(x));

    // Cross-check the replay against storage at the pinned block for every address either side knows.
    const mismatches: string[] = [];
    for (const addr of new Set<Address>([...expected, ...replay.keys()])) {
        const onChain = await stateOf(addr);
        const want = expected.has(addr);
        if (onChain !== want) mismatches.push(`isReputationSource(${addr}) is ${onChain}, expected ${want}`);
        const replayed = replay.get(addr) ?? false;
        if (onChain !== replayed) mismatches.push(`isReputationSource(${addr}) is ${onChain} but event replay says ${replayed}`);
    }

    ctx.readings.push({ what: 'replayed active set', a: canon([...active].sort()), b: '(same logs on both)' });
    const problems = [
        ...(missing.length ? [`missing from replayed set: ${missing.join(', ')}`] : []),
        ...(extra.length ? [`extra source(s) not in expected set: ${extra.join(', ')}`] : []),
        ...mismatches,
    ];
    if (problems.length) return { status: 'FAIL', detail: problems.join('; ') };
    return {
        status: 'PASS',
        detail: `reputation-source set == expected (${expected.size}); rebuilt from ${logs.length} ${REPUTATION_SOURCE_EVENT} log(s) in [${from}..${to}]`,
    };
}

async function runOne(ctx: Ctx, table: Expectations, a: Assertion): Promise<Outcome> {
    switch (a.kind) {
        case 'version': return checkVersion(ctx, table, a);
        case 'balanceZero': return checkBalanceZero(ctx, a);
        case 'notOwnerOf': return checkNotOwnerOf(ctx, table, a);
        case 'reputationSourceSet': return checkReputationSourceSet(ctx, table, a);
        case 'authorizedSlasher': return checkAuthorizedSlasher(ctx, table, a);
        case 'call': return checkCall(ctx, table, a);
        case 'privilege': return checkPrivilege(ctx, table, a);
        case 'roleOwners': return checkRoleOwners(ctx, table, a);
    }
}

// ---------- preflight: chain id + block pin ----------

interface Header { number: bigint; hash: Hex }
async function header(p: Eip1193Provider, tag: 'finalized' | bigint): Promise<Header> {
    const r = await p.request({ method: 'eth_getBlockByNumber', params: [tag === 'finalized' ? 'finalized' : `0x${tag.toString(16)}`, false] }) as
        { number?: string; hash?: string } | null;
    if (!r || typeof r.number !== 'string' || typeof r.hash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(r.hash)) {
        throw new Error(`block ${tag === 'finalized' ? 'finalized' : tag.toString()} not available`);
    }
    return { number: BigInt(r.number), hash: r.hash.toLowerCase() as Hex };
}

async function preflight(table: Expectations, ps: readonly [NamedProvider, NamedProvider]): Promise<{ results: Result[]; pinned?: PinnedBlock }> {
    const results: Result[] = [];
    const settle = async <T>(f: (p: Eip1193Provider) => Promise<T>) => Promise.allSettled([f(ps[0].provider), f(ps[1].provider)]);
    const show = <T>(r: PromiseSettledResult<T>, s: (v: T) => string) => (r.status === 'fulfilled' ? s(r.value) : `ERROR: ${errText(r.reason)}`);

    // chainId
    const [ca, cb] = await settle(async p => BigInt((await p.request({ method: 'eth_chainId' })) as string));
    const chainReading = { what: 'eth_chainId', a: show(ca, String), b: show(cb, String) };
    const chainOk = ca.status === 'fulfilled' && cb.status === 'fulfilled' && ca.value === BigInt(table.chainId) && cb.value === BigInt(table.chainId);
    results.push({
        id: 'preflight:chainId', kind: 'preflight', status: chainOk ? 'PASS' : 'FAIL',
        detail: chainOk ? `both providers on chain ${table.chainId}` : `expected chain ${table.chainId} on both providers`,
        readings: [chainReading],
    });
    if (!chainOk) return { results };

    // Block pin. With "finalized", each side reports its own finalized head; the lower of the two is
    // finalized on both, so both are then read at that number and must return the same hash.
    const readings: Reading[] = [];
    let target: bigint;
    if (table.block === 'finalized') {
        const [fa, fb] = await settle(p => header(p, 'finalized'));
        readings.push({ what: 'finalized head', a: show(fa, h => `${h.number} ${h.hash}`), b: show(fb, h => `${h.number} ${h.hash}`) });
        if (fa.status !== 'fulfilled' || fb.status !== 'fulfilled') {
            results.push({ id: 'preflight:block', kind: 'preflight', status: 'FAIL', detail: 'cannot read the finalized head on both providers', readings });
            return { results };
        }
        target = fa.value.number < fb.value.number ? fa.value.number : fb.value.number;
    } else {
        target = BigInt(table.block);
    }
    const [ha, hb] = await settle(p => header(p, target));
    readings.push({ what: `block ${target} hash`, a: show(ha, h => h.hash), b: show(hb, h => h.hash) });
    if (ha.status !== 'fulfilled' || hb.status !== 'fulfilled') {
        results.push({ id: 'preflight:block', kind: 'preflight', status: 'FAIL', detail: `cannot read block ${target} on both providers`, readings });
        return { results };
    }
    if (ha.value.number !== target || hb.value.number !== target) {
        results.push({ id: 'preflight:block', kind: 'preflight', status: 'FAIL', detail: `a provider returned a different block than ${target}`, readings });
        return { results };
    }
    if (ha.value.hash !== hb.value.hash) {
        results.push({
            id: 'preflight:block', kind: 'preflight', status: 'FAIL',
            detail: `block ${target} hash differs: A=${ha.value.hash}, B=${hb.value.hash}`, readings,
        });
        return { results };
    }
    results.push({ id: 'preflight:block', kind: 'preflight', status: 'PASS', detail: `both providers pinned to block ${target} ${ha.value.hash}`, readings });
    return { results, pinned: { number: target, hash: ha.value.hash } };
}

export function exitCodeFor(placeholder: boolean, all: Result[]): number {
    if (all.some(r => r.status === 'FAIL')) return 1;
    if (placeholder || all.some(r => r.status === 'INCOMPLETE')) return 2;
    return 0;
}

export interface RunOptions {
    /** ABI name -> ABI. Defaults to the vendored @aastar/core set; tests pass a reduced one. */
    abis?: Readonly<Record<string, Abi>>;
}

export async function runChecks(table: Expectations, ps: readonly [NamedProvider, NamedProvider], opts: RunOptions = {}): Promise<Report> {
    const abis = opts.abis ?? ABI_REGISTRY;
    const pre = await preflight(table, ps);
    const results: Result[] = [];
    if (pre.pinned) {
        for (const a of table.assertions) {
            const ctx = new Ctx(ps, pre.pinned, abis, table);
            let out: Outcome;
            try {
                out = await runOne(ctx, table, a);
            } catch (e) {
                out = { status: 'FAIL', detail: e instanceof Fail ? e.message : `unexpected error: ${errText(e)}` };
            }
            results.push({ id: a.id, kind: a.kind, status: out.status, detail: out.detail, readings: ctx.readings });
        }
    }
    return {
        placeholder: table.placeholder,
        chainId: table.chainId,
        pinned: pre.pinned,
        preflight: pre.results,
        results,
        exitCode: pre.pinned ? exitCodeFor(table.placeholder, [...pre.results, ...results]) : 1,
    };
}

export function formatReport(r: Report): string[] {
    const lines: string[] = [];
    if (r.placeholder) lines.push('!! PLACEHOLDER expectations table: values are NOT real expectations; this run is not acceptance evidence.');
    lines.push(`chain ${r.chainId}; pinned block: ${r.pinned ? `${r.pinned.number} ${r.pinned.hash}` : '(none)'}`);
    for (const x of [...r.preflight, ...r.results]) {
        lines.push(`[${x.status}] ${x.id} (${x.kind}) ${x.detail}`);
        for (const rd of x.readings) lines.push(`    ${rd.what}: A=${rd.a} | B=${rd.b}`);
    }
    if (!r.pinned) lines.push('assertions not run: preflight failed');
    const all = [...r.preflight, ...r.results];
    const n = (s: Status) => all.filter(x => x.status === s).length;
    lines.push(`summary: ${n('PASS')} PASS, ${n('FAIL')} FAIL, ${n('INCOMPLETE')} INCOMPLETE; exit ${r.exitCode}`);
    return lines;
}
