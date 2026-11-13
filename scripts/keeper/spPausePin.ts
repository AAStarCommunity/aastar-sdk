/**
 * Pause-duty ABI and role ids, selected from the vendored SuperPaymaster pin.
 * Fragments are copied out of the JSON by name at load; nothing here is a hand-written ABI.
 * Role ids are parsed from upstream/IRegistry.sol (file-level `bytes32 constant ROLE_X = keccak256("X")`).
 */
import { readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { keccak256, toBytes, type Abi, type Hex } from 'viem';

const PIN_DIR = join(dirname(fileURLToPath(import.meta.url)), 'sp-pause-pin');
const SOL_MAX_BYTES = 1_000_000;
const ABI_MAX_BYTES = 8_000_000;
const ABI_MAX_ENTRIES = 5_000;

const SP_FRAGMENTS: { type: string; name: string }[] = [
    { type: 'function', name: 'pauseUnderstakedOperator' },
    { type: 'function', name: 'operators' },
    { type: 'function', name: 'REGISTRY' },
    { type: 'function', name: 'owner' },
    { type: 'function', name: 'pendingOwner' },
    { type: 'function', name: 'guardian' },
    { type: 'function', name: 'BLS_AGGREGATOR' },
    { type: 'event', name: 'OperatorConfigured' },
    { type: 'error', name: 'OperatorNotConfigured' },
    { type: 'error', name: 'OperatorMeetsMinimumStake' },
];

const REGISTRY_FRAGMENTS: { type: string; name: string }[] = [
    { type: 'function', name: 'hasRole' },
    { type: 'function', name: 'getRoleConfig' },
    { type: 'function', name: 'getEffectiveStake' },
    { type: 'function', name: 'owner' },
    { type: 'function', name: 'pendingOwner' },
    { type: 'function', name: 'blsAggregator' },
    { type: 'function', name: 'isReputationSource' },
    { type: 'event', name: 'RoleConfigured' },
];

export function stripSolidityComments(source: string): string {
    if (source.length > SOL_MAX_BYTES) throw new Error('spPausePin: role source too large');
    let out = '';
    let i = 0;
    while (i < source.length) {
        const c = source[i];
        if (c === '/' && source[i + 1] === '/') {
            i += 2;
            while (i < source.length && source[i] !== '\n') i++;
            continue;
        }
        if (c === '/' && source[i + 1] === '*') {
            i += 2;
            const end = source.indexOf('*/', i);
            if (end < 0) throw new Error('spPausePin: unterminated block comment');
            i = end + 2;
            continue;
        }
        if (c === '"') {
            out += c;
            i++;
            while (i < source.length) {
                const s = source[i];
                out += s;
                if (s === '\\') {
                    if (i + 1 >= source.length) throw new Error('spPausePin: bad string escape');
                    out += source[i + 1];
                    i += 2;
                    continue;
                }
                i++;
                if (s === '"') break;
            }
            continue;
        }
        out += c;
        i++;
    }
    return out;
}

const ROLE_DECL = /\bbytes32\s+constant\s+(ROLE_[A-Z0-9_]+)\s*=\s*keccak256\(\s*"([A-Z0-9_]*)"\s*\)\s*;/g;

/** Parse file-level ROLE_* constants. Any other ROLE_* shape throws. Empty set throws. */
export function parsePinnedRoles(source: string): Readonly<Record<string, Hex>> {
    const stripped = stripSolidityComments(source);
    const roles: Record<string, Hex> = {};
    const consumed: { start: number; end: number }[] = [];
    for (const match of stripped.matchAll(ROLE_DECL)) {
        const name = match[1];
        const literal = match[2];
        if (!name || literal === undefined || match.index === undefined) {
            throw new Error('spPausePin: role declaration rejected');
        }
        if (name !== `ROLE_${literal}`) throw new Error('spPausePin: role name is not ROLE_ plus the hashed literal');
        if (Object.prototype.hasOwnProperty.call(roles, name)) throw new Error('spPausePin: duplicate role');
        roles[name] = keccak256(toBytes(literal));
        consumed.push({ start: match.index, end: match.index + match[0].length });
    }
    let rest = stripped;
    for (let i = consumed.length - 1; i >= 0; i--) {
        const span = consumed[i];
        if (!span) continue;
        rest = rest.slice(0, span.start) + rest.slice(span.end);
    }
    if (/\bROLE_[A-Z0-9_]+\b/.test(rest)) throw new Error('spPausePin: unparsed ROLE_* declaration');
    if (Object.keys(roles).length === 0) throw new Error('spPausePin: no pinned roles');
    return Object.freeze(roles);
}

function readBounded(rel: string, max: number): string {
    const path = join(PIN_DIR, rel);
    const st = statSync(path);
    if (!st.isFile() || st.size > max || st.size <= 0) throw new Error(`spPausePin: rejected ${rel}`);
    return readFileSync(path, 'utf8');
}

function abiArray(rel: string): unknown[] {
    const text = readBounded(rel, ABI_MAX_BYTES);
    const parsed: unknown = JSON.parse(text);
    const abi = Array.isArray(parsed) ? parsed : (parsed && typeof parsed === 'object' ? (parsed as { abi?: unknown }).abi : undefined);
    if (!Array.isArray(abi) || abi.length === 0 || abi.length > ABI_MAX_ENTRIES) {
        throw new Error(`spPausePin: abi rejected ${rel}`);
    }
    return abi;
}

function outputNames(entry: { outputs?: unknown }): string[] {
    if (!Array.isArray(entry.outputs)) return [];
    const names: string[] = [];
    for (const out of entry.outputs) {
        if (!out || typeof out !== 'object') continue;
        const named = out as { name?: unknown; components?: unknown };
        if (typeof named.name === 'string' && named.name.length > 0) names.push(named.name);
        if (Array.isArray(named.components)) {
            for (const c of named.components) {
                if (c && typeof c === 'object' && typeof (c as { name?: unknown }).name === 'string') {
                    names.push((c as { name: string }).name);
                }
            }
        }
    }
    return names;
}

function pick(abi: unknown[], type: string, name: string, needOutputs: string[]): unknown {
    const hits: unknown[] = [];
    for (const entry of abi) {
        if (!entry || typeof entry !== 'object') continue;
        const e = entry as { type?: unknown; name?: unknown };
        if (e.type === type && e.name === name) hits.push(entry);
        if (hits.length > 1) break;
    }
    if (hits.length !== 1) throw new Error(`spPausePin: fragment ${type} ${name} count ${hits.length}`);
    const one = hits[0] as { outputs?: unknown };
    for (const required of needOutputs) {
        if (!outputNames(one).includes(required)) throw new Error(`spPausePin: fragment ${name} missing ${required}`);
    }
    return one;
}

function select(abi: unknown[], spec: { type: string; name: string }[], outputs: Record<string, string[]>): Abi {
    const out: unknown[] = [];
    for (const item of spec) out.push(pick(abi, item.type, item.name, outputs[item.name] ?? []));
    return out as Abi;
}

const spOutputs: Record<string, string[]> = { operators: ['isConfigured', 'isPaused'] };
const registryOutputs: Record<string, string[]> = { getRoleConfig: ['minStake', 'owner'] };

export const SUPER_PAYMASTER_PAUSE_ABI: Abi = select(abiArray('upstream/SuperPaymaster.full.json'), SP_FRAGMENTS, spOutputs);
export const REGISTRY_PAUSE_ABI: Abi = select(abiArray('upstream/Registry.json'), REGISTRY_FRAGMENTS, registryOutputs);
export const PINNED_ROLES: Readonly<Record<string, Hex>> = parsePinnedRoles(readBounded('upstream/IRegistry.sol', SOL_MAX_BYTES));

export const ROLE_PAYMASTER_SUPER: Hex = (() => {
    const id = PINNED_ROLES.ROLE_PAYMASTER_SUPER;
    if (!id) throw new Error('spPausePin: ROLE_PAYMASTER_SUPER missing');
    return id;
})();

export const IMPL_SLOT: Hex = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';

function outputIndex(abi: Abi, fn: string, output: string): number {
    const item = abi.find((entry) => entry.type === 'function' && entry.name === fn);
    if (!item || item.type !== 'function') throw new Error(`spPausePin: ${fn} missing ${output}`);
    const outputs = item.outputs ?? [];
    const index = outputs.findIndex((row) => row.name === output);
    if (index < 0) throw new Error(`spPausePin: ${fn} missing ${output}`);
    return index;
}

/** operators() fields, by output name from the vendored ABI. */
export const OPERATOR_IS_CONFIGURED_INDEX = outputIndex(SUPER_PAYMASTER_PAUSE_ABI, 'operators', 'isConfigured');
export const OPERATOR_IS_PAUSED_INDEX = outputIndex(SUPER_PAYMASTER_PAUSE_ABI, 'operators', 'isPaused');
