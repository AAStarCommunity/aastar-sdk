/**
 * Expectations table: format and strict validation.
 *
 * The table is data handed over by the SP owner (via DSR). It is validated before any RPC call:
 * a missing field, a wrong type, an unknown key, an unknown assertion kind or a reference to an
 * undeclared name rejects the whole table. Whether a referenced ABI / function exists, and whether
 * a declared address is still unresolved (null), is NOT checked here; those are assertion-level
 * FAILs at run time, so one bad row does not hide the others.
 *
 * Address references: wherever an address is expected, a table may write either a literal address
 * or `$NAME`, where NAME is a key of `principals` or `contracts`. A name whose address is `null`
 * (not given by the source table) makes every row that needs it FAIL as UNRESOLVED.
 */
import { getAddress, isAddress, type Address } from 'viem';

export const SCHEMA_ID = 'aastar-post-deploy-check/1';

export type BlockSpec = 'finalized' | number;
/** A literal checksummed address, or `$NAME` referring to `principals` / `contracts`. */
export type AddrRef = string;

export interface NamedAddress { address: Address | null; source?: string }
export interface ContractRef extends NamedAddress { abi: string }
export interface Origin { repo: string; ref: string; path: string; version: string }
export interface DeployerException { reason: string }

interface Base { id: string; note?: string }
export interface VersionAssertion extends Base { kind: 'version'; contract: string; expected: string }
export interface BalanceZeroAssertion extends Base { kind: 'balanceZero'; address: AddrRef }
export interface NotOwnerOfAssertion extends Base { kind: 'notOwnerOf'; address: AddrRef; contracts: string[] }
export interface ReputationSourceSetAssertion extends Base {
    kind: 'reputationSourceSet';
    registry: string;
    /** Must each read isReputationSource == true at the pinned block. */
    expected: AddrRef[];
    /** Must each read isReputationSource == false (e.g. the deployer). Required, may be empty: an omission is not "no requirement". */
    mustNotBe: AddrRef[];
    /** Extra discovery candidates, e.g. the initialize owner when no OwnershipTransferred(0x0 -> owner) log is reachable. */
    seeds?: { address: AddrRef; source: string }[];
    /** First block of the event replay (the Registry deployment block). Inclusive. */
    fromBlock: number;
    /** Max blocks per eth_getLogs request. */
    logChunkSize?: number;
}
export interface AuthorizedSlasherAssertion extends Base { kind: 'authorizedSlasher'; staking: string; address: AddrRef; expected: boolean }
export type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
export interface CallAssertion extends Base {
    kind: 'call';
    contract: string;
    /** Function name, or a full signature such as `foo(address,uint256)` to pick an overload. */
    function: string;
    /** JSON args; `"$NAME"` is an address reference, `{"$call":"GETTER"}` is the value of a zero-arg getter on the same contract. */
    args: JsonValue[];
    /** Optional struct field of the (single) return value to compare. */
    field?: string;
    compare: 'eq' | 'neq';
    expected: JsonValue;
}
/**
 * A privileged getter. Address-valued: FAIL if it equals the deployer (unless `deployerException`)
 * or any aggregator, and, if `expected` is given, unless it equals it. Boolean-valued (e.g.
 * `isReputationSource($D)`): `expected` is required; a `true` whose subject argument is the
 * deployer FAILs unless `deployerException`.
 */
export interface PrivilegeAssertion extends Base {
    kind: 'privilege';
    contract: string;
    function: string;
    args: JsonValue[];
    field?: string;
    expected?: AddrRef | boolean;
    deployerException?: DeployerException;
}
export interface RoleRef { name: string; id: `0x${string}` | null; source?: string }
/** Registry.getRoleConfig(id).owner for each role must equal `expected`, and is subject to the deployer/aggregator rules. */
export interface RoleOwnersAssertion extends Base {
    kind: 'roleOwners';
    registry: string;
    roles: RoleRef[];
    expected: AddrRef;
    deployerException?: DeployerException;
}

export type Assertion =
    | VersionAssertion
    | BalanceZeroAssertion
    | NotOwnerOfAssertion
    | ReputationSourceSetAssertion
    | AuthorizedSlasherAssertion
    | CallAssertion
    | PrivilegeAssertion
    | RoleOwnersAssertion;

export interface Expectations {
    schema: typeof SCHEMA_ID;
    /** true = not final; a run against it is never acceptance and never exits 0. */
    placeholder: boolean;
    note?: string;
    origin?: Origin;
    chainId: number;
    block: BlockSpec;
    /** Name in `principals` of the deployer EOA. Any privilege equal to it FAILs unless the row records an exception. */
    deployer: string;
    principals: Record<string, NamedAddress>;
    /** Every aggregator generation; no privilege holder may equal any of them. */
    aggregators: AddrRef[];
    contracts: Record<string, ContractRef>;
    assertions: Assertion[];
}

export class ExpectationsError extends Error {
    constructor(readonly problems: string[]) {
        super(`invalid expectations table:\n  - ${problems.join('\n  - ')}`);
        this.name = 'ExpectationsError';
    }
}

const KINDS = ['version', 'balanceZero', 'notOwnerOf', 'reputationSourceSet', 'authorizedSlasher', 'call', 'privilege', 'roleOwners'] as const;
type Kind = (typeof KINDS)[number];
const KIND_KEYS: Record<Kind, { required: string[]; optional: string[] }> = {
    version: { required: ['contract', 'expected'], optional: [] },
    balanceZero: { required: ['address'], optional: [] },
    notOwnerOf: { required: ['address', 'contracts'], optional: [] },
    reputationSourceSet: { required: ['registry', 'expected', 'mustNotBe', 'fromBlock'], optional: ['logChunkSize', 'seeds'] },
    authorizedSlasher: { required: ['staking', 'address', 'expected'], optional: [] },
    call: { required: ['contract', 'function', 'args', 'compare', 'expected'], optional: ['field'] },
    privilege: { required: ['contract', 'function', 'args'], optional: ['field', 'expected', 'deployerException'] },
    roleOwners: { required: ['registry', 'roles', 'expected'], optional: ['deployerException'] },
};
const TOP_REQUIRED = ['schema', 'placeholder', 'chainId', 'block', 'deployer', 'principals', 'contracts', 'assertions'];
const TOP_OPTIONAL = ['note', 'origin', 'aggregators'];

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const isBlockInt = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

function checkKeys(where: string, o: Record<string, unknown>, required: string[], optional: string[], problems: string[]) {
    for (const k of required) if (!(k in o)) problems.push(`${where}: missing field "${k}"`);
    for (const k of Object.keys(o)) if (!required.includes(k) && !optional.includes(k)) problems.push(`${where}: unknown field "${k}"`);
}

/** Strict 20-byte hex; a mixed-case address must carry a valid EIP-55 checksum. */
function checkLiteral(where: string, v: unknown, problems: string[]): Address | undefined {
    if (typeof v !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(v) || !isAddress(v, { strict: true })) {
        problems.push(`${where}: not a valid address`);
        return undefined;
    }
    return getAddress(v);
}

export const isRef = (v: unknown): v is string => typeof v === 'string' && v.startsWith('$') && !v.startsWith('$$');

function checkRef(where: string, v: unknown, names: Set<string>, problems: string[]): AddrRef | undefined {
    if (isRef(v)) {
        const n = v.slice(1);
        if (!names.has(n)) { problems.push(`${where}: reference ${v} names nothing in principals or contracts`); return undefined; }
        return v;
    }
    return checkLiteral(where, v, problems);
}

function isJsonValue(v: unknown): v is JsonValue {
    if (v === null || typeof v === 'string' || typeof v === 'boolean') return true;
    if (typeof v === 'number') return Number.isFinite(v);
    if (Array.isArray(v)) return v.every(isJsonValue);
    if (isObj(v)) return Object.values(v).every(isJsonValue);
    return false;
}

/** Walk JSON args: every `$NAME` string must be declared; every `{"$call": ...}` must be exactly that one key with a non-empty string. */
function checkJsonRefs(where: string, v: JsonValue, names: Set<string>, problems: string[]) {
    if (typeof v === 'string' && isRef(v)) checkRef(where, v, names, problems);
    else if (Array.isArray(v)) v.forEach((x, i) => checkJsonRefs(`${where}[${i}]`, x, names, problems));
    else if (isObj(v)) {
        if ('$call' in v) {
            if (Object.keys(v).length !== 1 || !isNonEmptyString(v.$call)) problems.push(`${where}: {"$call": "<getter>"} must have exactly one non-empty string key`);
            return;
        }
        for (const [k, x] of Object.entries(v)) checkJsonRefs(`${where}.${k}`, x as JsonValue, names, problems);
    }
}

function checkNamed(where: string, v: unknown, extraRequired: string[], problems: string[]): boolean {
    if (!isObj(v)) { problems.push(`${where}: must be an object`); return false; }
    checkKeys(where, v, ['address', ...extraRequired], ['source'], problems);
    if ('source' in v && !isNonEmptyString(v.source)) problems.push(`${where}.source: must be a non-empty string`);
    if (v.address === null) {
        if (!isNonEmptyString(v.source)) problems.push(`${where}: an unresolved (null) address must carry a "source" saying why`);
    } else if ('address' in v) checkLiteral(`${where}.address`, v.address, problems);
    return true;
}

export function parseExpectations(text: string): Expectations {
    let raw: unknown;
    try {
        raw = JSON.parse(text);
    } catch (e) {
        throw new ExpectationsError([`not valid JSON (${(e as Error).message})`]);
    }
    return validateExpectations(raw);
}

export function validateExpectations(raw: unknown): Expectations {
    const problems: string[] = [];
    if (!isObj(raw)) throw new ExpectationsError(['top level must be a JSON object']);
    checkKeys('table', raw, TOP_REQUIRED, TOP_OPTIONAL, problems);

    if ('schema' in raw && raw.schema !== SCHEMA_ID) problems.push(`table.schema: must be "${SCHEMA_ID}"`);
    if ('placeholder' in raw && typeof raw.placeholder !== 'boolean') problems.push('table.placeholder: must be a boolean');
    if ('note' in raw && typeof raw.note !== 'string') problems.push('table.note: must be a string');
    if ('origin' in raw) {
        if (!isObj(raw.origin)) problems.push('table.origin: must be an object');
        else {
            checkKeys('table.origin', raw.origin, ['repo', 'ref', 'path', 'version'], [], problems);
            for (const k of ['repo', 'ref', 'path', 'version']) if (k in raw.origin && !isNonEmptyString(raw.origin[k])) problems.push(`table.origin.${k}: must be a non-empty string`);
        }
    }
    if ('chainId' in raw && !(typeof raw.chainId === 'number' && Number.isSafeInteger(raw.chainId) && raw.chainId > 0)) {
        problems.push('table.chainId: must be a positive integer');
    }
    if ('block' in raw && raw.block !== 'finalized' && !isBlockInt(raw.block)) {
        problems.push('table.block: must be "finalized" or a non-negative integer block number');
    }

    const names = new Set<string>();
    const principals: Record<string, NamedAddress> = {};
    if ('principals' in raw) {
        if (!isObj(raw.principals)) problems.push('table.principals: must be an object');
        else for (const [key, v] of Object.entries(raw.principals)) {
            const where = `principals.${key}`;
            if (!NAME_RE.test(key)) problems.push(`${where}: name must match ${NAME_RE}`);
            if (!checkNamed(where, v, [], problems)) continue;
            const o = v as Record<string, unknown>;
            principals[key] = { address: o.address === null ? null : (typeof o.address === 'string' && isAddress(o.address, { strict: true }) ? getAddress(o.address) : null), ...(typeof o.source === 'string' ? { source: o.source } : {}) };
            names.add(key);
        }
    }

    const contracts: Record<string, ContractRef> = {};
    if ('contracts' in raw) {
        if (!isObj(raw.contracts)) problems.push('table.contracts: must be an object');
        else for (const [key, ref] of Object.entries(raw.contracts)) {
            const where = `contracts.${key}`;
            if (!NAME_RE.test(key)) problems.push(`${where}: name must match ${NAME_RE}`);
            if (names.has(key)) problems.push(`${where}: name is also declared in principals`);
            if (!checkNamed(where, ref, ['abi'], problems)) continue;
            const o = ref as Record<string, unknown>;
            if ('abi' in o && !isNonEmptyString(o.abi)) problems.push(`${where}.abi: must be a non-empty string`);
            contracts[key] = {
                abi: String(o.abi),
                address: o.address === null ? null : (typeof o.address === 'string' && isAddress(o.address, { strict: true }) ? getAddress(o.address) : null),
                ...(typeof o.source === 'string' ? { source: o.source } : {}),
            };
            names.add(key);
        }
    }

    if ('deployer' in raw) {
        if (!isNonEmptyString(raw.deployer) || !(raw.deployer in principals)) problems.push('table.deployer: must name an entry of principals');
        else if (principals[raw.deployer].address === null) problems.push('table.deployer: the deployer principal must have a resolved address');
    }

    let aggregators: AddrRef[] = [];
    if ('aggregators' in raw) {
        if (!Array.isArray(raw.aggregators)) problems.push('table.aggregators: must be an array of address references');
        else aggregators = raw.aggregators.map((x, i) => checkRef(`table.aggregators[${i}]`, x, names, problems)).filter((x): x is string => !!x);
    }

    const assertions: Assertion[] = [];
    if ('assertions' in raw) {
        if (!Array.isArray(raw.assertions) || raw.assertions.length === 0) problems.push('table.assertions: must be a non-empty array');
        else {
            const ids = new Set<string>();
            raw.assertions.forEach((a, i) => {
                const parsed = validateAssertion(a, i, names, problems);
                if (!parsed) return;
                if (ids.has(parsed.id)) problems.push(`assertions[${i}].id: duplicate id "${parsed.id}"`);
                ids.add(parsed.id);
                assertions.push(parsed);
            });
        }
    }

    if (problems.length > 0) throw new ExpectationsError(problems);
    return {
        schema: SCHEMA_ID,
        placeholder: raw.placeholder as boolean,
        ...(typeof raw.note === 'string' ? { note: raw.note } : {}),
        ...(isObj(raw.origin) ? { origin: raw.origin as unknown as Origin } : {}),
        chainId: raw.chainId as number,
        block: raw.block as BlockSpec,
        deployer: raw.deployer as string,
        principals,
        aggregators,
        contracts,
        assertions,
    };
}

function validateAssertion(a: unknown, i: number, names: Set<string>, problems: string[]): Assertion | undefined {
    const where = `assertions[${i}]`;
    if (!isObj(a)) { problems.push(`${where}: must be an object`); return undefined; }
    const kind = a.kind;
    if (typeof kind !== 'string' || !(KINDS as readonly string[]).includes(kind)) {
        problems.push(`${where}.kind: unknown assertion kind ${JSON.stringify(kind)} (allowed: ${KINDS.join(', ')})`);
        return undefined;
    }
    const k = kind as Kind;
    const before = problems.length;
    checkKeys(where, a, ['id', 'kind', ...KIND_KEYS[k].required], ['note', ...KIND_KEYS[k].optional], problems);
    if ('id' in a && !isNonEmptyString(a.id)) problems.push(`${where}.id: must be a non-empty string`);
    if ('note' in a && typeof a.note !== 'string') problems.push(`${where}.note: must be a string`);
    const str = (f: string) => { if (f in a && !isNonEmptyString(a[f])) problems.push(`${where}.${f}: must be a non-empty string`); };
    const ref = (f: string) => { if (f in a) checkRef(`${where}.${f}`, a[f], names, problems); };
    const args = () => {
        if (!('args' in a)) return;
        if (!(Array.isArray(a.args) && a.args.every(isJsonValue))) problems.push(`${where}.args: must be an array of JSON values`);
        else checkJsonRefs(`${where}.args`, a.args as JsonValue[], names, problems);
    };
    const exception = () => {
        if (!('deployerException' in a)) return;
        const e = a.deployerException;
        if (!isObj(e)) { problems.push(`${where}.deployerException: must be an object`); return; }
        checkKeys(`${where}.deployerException`, e, ['reason'], [], problems);
        if ('reason' in e && !isNonEmptyString(e.reason)) problems.push(`${where}.deployerException.reason: must be a non-empty string`);
    };

    switch (k) {
        case 'version':
            str('contract'); str('expected');
            break;
        case 'balanceZero':
            ref('address');
            break;
        case 'notOwnerOf':
            ref('address');
            if ('contracts' in a && !(Array.isArray(a.contracts) && a.contracts.length > 0 && a.contracts.every(isNonEmptyString))) {
                problems.push(`${where}.contracts: must be a non-empty array of contract keys`);
            }
            break;
        case 'reputationSourceSet': {
            str('registry');
            if ('expected' in a) {
                if (!Array.isArray(a.expected)) problems.push(`${where}.expected: must be an array of addresses`);
                else {
                    const seen = new Set<string>();
                    a.expected.forEach((x, j) => {
                        const r = checkRef(`${where}.expected[${j}]`, x, names, problems);
                        if (r && seen.has(r)) problems.push(`${where}.expected[${j}]: duplicate address`);
                        if (r) seen.add(r);
                    });
                }
            }
            const exp = new Set(Array.isArray(a.expected) ? a.expected : []);
            if ('mustNotBe' in a) {
                if (!Array.isArray(a.mustNotBe)) problems.push(`${where}.mustNotBe: must be an array of addresses (may be empty)`);
                else a.mustNotBe.forEach((x, j) => {
                    const r = checkRef(`${where}.mustNotBe[${j}]`, x, names, problems);
                    if (r && exp.has(r)) problems.push(`${where}.mustNotBe[${j}]: also listed in expected`);
                });
            }
            if ('seeds' in a) {
                if (!Array.isArray(a.seeds)) problems.push(`${where}.seeds: must be an array`);
                else a.seeds.forEach((sd, j) => {
                    const w = `${where}.seeds[${j}]`;
                    if (!isObj(sd)) { problems.push(`${w}: must be an object`); return; }
                    checkKeys(w, sd, ['address', 'source'], [], problems);
                    if ('address' in sd) checkRef(`${w}.address`, sd.address, names, problems);
                    if ('source' in sd && !isNonEmptyString(sd.source)) problems.push(`${w}.source: must be a non-empty string`);
                });
            }
            if ('fromBlock' in a && !isBlockInt(a.fromBlock)) problems.push(`${where}.fromBlock: must be a non-negative integer`);
            if ('logChunkSize' in a && !(isBlockInt(a.logChunkSize) && a.logChunkSize >= 1 && a.logChunkSize <= 1_000_000)) {
                problems.push(`${where}.logChunkSize: must be an integer in 1..1000000`);
            }
            break;
        }
        case 'authorizedSlasher':
            str('staking'); ref('address');
            if ('expected' in a && typeof a.expected !== 'boolean') problems.push(`${where}.expected: must be a boolean`);
            break;
        case 'call':
            str('contract'); str('function'); args();
            if ('field' in a) str('field');
            if ('compare' in a && a.compare !== 'eq' && a.compare !== 'neq') problems.push(`${where}.compare: must be "eq" or "neq"`);
            if ('expected' in a) {
                if (!isJsonValue(a.expected)) problems.push(`${where}.expected: must be a JSON value`);
                else checkJsonRefs(`${where}.expected`, a.expected as JsonValue, names, problems);
            }
            break;
        case 'privilege':
            str('contract'); str('function'); args(); exception();
            if ('field' in a) str('field');
            if ('expected' in a && typeof a.expected !== 'boolean') ref('expected');
            break;
        case 'roleOwners':
            str('registry'); ref('expected'); exception();
            if ('roles' in a) {
                if (!Array.isArray(a.roles) || a.roles.length === 0) problems.push(`${where}.roles: must be a non-empty array`);
                else a.roles.forEach((r, j) => {
                    const w = `${where}.roles[${j}]`;
                    if (!isObj(r)) { problems.push(`${w}: must be an object`); return; }
                    checkKeys(w, r, ['name', 'id'], ['source'], problems);
                    if ('name' in r && !isNonEmptyString(r.name)) problems.push(`${w}.name: must be a non-empty string`);
                    if (r.id === null) { if (!isNonEmptyString(r.source)) problems.push(`${w}: an unresolved (null) role id must carry a "source" saying why`); }
                    else if ('id' in r && !(typeof r.id === 'string' && /^0x[0-9a-fA-F]{64}$/.test(r.id))) problems.push(`${w}.id: must be a bytes32 hex string or null`);
                });
            }
            break;
    }
    if (problems.length > before) return undefined;

    // Normalize literal addresses to checksum form so comparisons are case-insensitive by construction.
    const norm = (v: unknown) => (typeof v === 'string' && !isRef(v) && isAddress(v, { strict: true }) ? getAddress(v) : v);
    const out: Record<string, unknown> = { ...a };
    if ('address' in out) out.address = norm(out.address);
    if (k === 'reputationSourceSet') {
        out.expected = (a.expected as string[]).map(norm);
        out.mustNotBe = (a.mustNotBe as string[]).map(norm);
        if (Array.isArray(a.seeds)) out.seeds = (a.seeds as { address: string; source: string }[]).map(sd => ({ ...sd, address: norm(sd.address) }));
    }
    if (k === 'privilege' || k === 'roleOwners') { if (typeof out.expected === 'string') out.expected = norm(out.expected); }
    return out as unknown as Assertion;
}
