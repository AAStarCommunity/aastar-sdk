/**
 * SP's DeployLive read-back tooling data, vendored for Part B (DSR 2026-11-20).
 *
 * Two pins: the contracts (and the paper citation) stay on tag v5.5.0-rc.8 = 5a150f6a; the tooling data —
 * readback policy / artifacts / non-contracts / providers, runtime pins, external deps, the 22-key release table and
 * the spec — is pinned to SP main 12b5ef80 (the merge of #657; #653 fc33cfd3 and #655 698eeff1 are intermediate and
 * must not be pinned). Each file under ./sp550-tooling is the git blob at that commit, byte for byte:
 * scripts/check-sp550-tooling.ts holds the bytes (blob ids, sha256) and, with the upstream checkout, the two-pin
 * relation (`contracts/src` is the same tree at both commits). This module holds the structure, and is browser-safe.
 *
 * Nothing here reads a chain or changes what the pin-fill gate does: --write stays refused until B4.
 */
import POLICY from './sp550-tooling/readback-policy.json' with { type: 'json' };
import ARTIFACTS from './sp550-tooling/readback-artifacts.json' with { type: 'json' };
import NONCONTRACTS from './sp550-tooling/readback-noncontracts.json' with { type: 'json' };
import PROVIDERS from './sp550-tooling/readback-providers.json' with { type: 'json' };
import RUNTIME_PINS_10 from './sp550-tooling/runtime-pins.10.json' with { type: 'json' };
import RUNTIME_PINS_11155111 from './sp550-tooling/runtime-pins.11155111.json' with { type: 'json' };
import RUNTIME_PINS_31337 from './sp550-tooling/runtime-pins.31337.json' with { type: 'json' };
import EXTERNAL_DEPS_10 from './sp550-tooling/external-deps.10.json' with { type: 'json' };
import EXTERNAL_DEPS_11155111 from './sp550-tooling/external-deps.11155111.json' with { type: 'json' };
import EXTERNAL_DEPS_31337 from './sp550-tooling/external-deps.31337.json' with { type: 'json' };
import TOOLING_RELEASE_VERSIONS from './sp550-tooling/release-versions.rc8.json' with { type: 'json' };
import TAG_RELEASE_VERSIONS from './sp550-release-versions.rc8.json' with { type: 'json' };

export const SP550_TOOLING_PIN = {
    repo: 'AAStarCommunity/SuperPaymaster',
    /** SP main after #657 merged: the tooling data. */
    toolingCommit: '12b5ef80d21a3191c62b69003e49ab06ef1c02b7',
    /** The contracts and the paper citation. */
    contractsTag: 'v5.5.0-rc.8',
    contractsCommit: '5a150f6ad43a6c6a57ccccea427c1dba0d797d06',
} as const;

/** Each vendored file: its upstream path at the tooling commit and that blob's git object id. */
export const SP550_TOOLING_FILES: Readonly<Record<string, { upstream: string; gitBlob: string }>> = {
    'readback-policy.json': { upstream: 'deployments/readback-policy.json', gitBlob: '1337641e0ddf638a5947c6810e84775239db748d' },
    'readback-artifacts.json': { upstream: 'deployments/readback-artifacts.json', gitBlob: '5caf65fb7b0f6b4f8590864973eda68e48494e13' },
    'readback-noncontracts.json': { upstream: 'deployments/readback-noncontracts.json', gitBlob: '87168ae7da51844ccdf094eeaccd48e73403e456' },
    'readback-providers.json': { upstream: 'deployments/readback-providers.json', gitBlob: '0fa74e4081b63cf24a158d553635b90ef618f36c' },
    'runtime-pins.10.json': { upstream: 'deployments/runtime-pins.10.json', gitBlob: '2d6764e5a6ff31799716b190b5b2f28d600278de' },
    'runtime-pins.11155111.json': { upstream: 'deployments/runtime-pins.11155111.json', gitBlob: '2d6764e5a6ff31799716b190b5b2f28d600278de' },
    'runtime-pins.31337.json': { upstream: 'deployments/runtime-pins.31337.json', gitBlob: '2d6764e5a6ff31799716b190b5b2f28d600278de' },
    'creation-pins.10.json': { upstream: 'deployments/creation-pins.10.json', gitBlob: '1e05215db3a6cbd1ae24b709a491710eab54e298' },
    'creation-pins.11155111.json': { upstream: 'deployments/creation-pins.11155111.json', gitBlob: '1e05215db3a6cbd1ae24b709a491710eab54e298' },
    'creation-pins.31337.json': { upstream: 'deployments/creation-pins.31337.json', gitBlob: '1e05215db3a6cbd1ae24b709a491710eab54e298' },
    'external-deps.10.json': { upstream: 'deployments/external-deps.10.json', gitBlob: '6523ce09c03a4cca055f207f515ded7098b57e18' },
    'external-deps.11155111.json': { upstream: 'deployments/external-deps.11155111.json', gitBlob: '65a953ead3d77cc4c98e9a140451fa8089843826' },
    'external-deps.31337.json': { upstream: 'deployments/external-deps.31337.json', gitBlob: '2b9110b9323f793b4506cb1346a94b9c9d751dfc' },
    'release-versions.rc8.json': { upstream: 'deployments/release-versions.rc8.json', gitBlob: '2a545d2eee5fa67b72eabb51d6b5cd7c2de76850' },
    'deploylive-readback-runtime-pins.md': { upstream: 'docs/spec/deploylive-readback-runtime-pins.md', gitBlob: 'ae90e1055c7aecadde5089c9634f83dcbb0a9d72' },
};

/** The spec's sha256 (SP, DSR and the SDK each computed it from the blob at the tooling commit). */
export const SP550_READBACK_SPEC_SHA256 = '2d516270e1b01e5655705f1e634321cf044c8f3639df0e2ec7c3a6b189315b9a';

/**
 * The policy's `rule`, byte for byte as agreed with SP (cc DSR, 2026-11-19). A changed text fails, so a change of
 * semantics cannot arrive as an edit to the string. The full rule is this string together with `emptyAllowed`,
 * `zeroAllowedConfigKeys` and a getter-level `zeroAllowed` (spec §3).
 */
export const SP550_READBACK_POLICY_RULE = 'resolved ∩ allowed ≠ ∅; resolved = [] fails; array outputs: each element independently';

export const SP550_READBACK_SCHEMAS = {
    readback: 'deploylive-readback/1',
    runtimePins: 'runtime-pins/1',
    policy: 'readback-policy/1',
} as const;

/** The chains the tooling covers. */
export const SP550_TOOLING_CHAINS = ['10', '11155111', '31337'] as const;
export type Sp550ToolingChain = typeof SP550_TOOLING_CHAINS[number];

export const SP550_READBACK_POLICY = POLICY;
/** config key -> release artifact (`null`: the key is a deployed address with no release artifact, e.g. a clone). */
export const SP550_READBACK_ARTIFACTS: Readonly<Record<string, string | null>> = ARTIFACTS;
export const SP550_READBACK_NONCONTRACTS = NONCONTRACTS;
/** Approved RPC providers (name -> dot-prefixed hostname suffixes). B4's two-provider rule reads this, not a second list. */
export const SP550_READBACK_PROVIDERS: Readonly<Record<string, readonly string[]>> = PROVIDERS;
export const SP550_RUNTIME_PINS: Readonly<Record<Sp550ToolingChain, typeof RUNTIME_PINS_10>> = {
    '10': RUNTIME_PINS_10, '11155111': RUNTIME_PINS_11155111, '31337': RUNTIME_PINS_31337,
};
/** Per chain: external addresses (EntryPoint, feeds, …) plus metadata fields (`source`, a nested record); B2 reads the addresses. */
export const SP550_EXTERNAL_DEPS: Readonly<Record<Sp550ToolingChain, Readonly<Record<string, unknown>>>> = {
    '10': EXTERNAL_DEPS_10, '11155111': EXTERNAL_DEPS_11155111, '31337': EXTERNAL_DEPS_31337,
};
/** The 22-key release table at the tooling commit (the tag's 6-key table stays what the current gate uses). */
export const SP550_TOOLING_RELEASE_VERSIONS: Readonly<Record<string, string>> = TOOLING_RELEASE_VERSIONS;

/**
 * Release keys no config key maps to, each with why. Everything else maps through readback-artifacts.json; a key
 * that maps nowhere and is not listed here fails, and so does a stale entry.
 */
export const SP550_TOOLING_RELEASE_ABSENT: Readonly<Record<string, string>> = {
    GToken: 'not deployed by DeployLive rc.8: config.gToken is GTokenAuthorization (SP, 2026-11-19)',
};

/**
 * Release key -> the config keys whose contract it versions, derived from readback-artifacts.json (artifact name ==
 * release key), not written by hand. A proxy key reaches its implementation's version through the proxy, so
 * `registry` / `superPaymaster` (artifact ERC1967Proxy) are added to the Registry / SuperPaymaster rows by their
 * `*Impl` key.
 */
export const SP550_TOOLING_PROXY_OF: Readonly<Record<string, string>> = { registry: 'registryImpl', superPaymaster: 'spImpl' };
export function sp550ToolingReleaseConfigKeys(release: Readonly<Record<string, string>> = SP550_TOOLING_RELEASE_VERSIONS, artifacts: Readonly<Record<string, string | null>> = SP550_READBACK_ARTIFACTS): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    for (const key of Object.keys(release)) {
        const direct = Object.entries(artifacts).filter(([, a]) => a === key).map(([k]) => k);
        const viaProxy = Object.entries(SP550_TOOLING_PROXY_OF).filter(([, impl]) => direct.includes(impl)).map(([proxy]) => proxy);
        out[key] = [...direct, ...viaProxy].sort();
    }
    return out;
}

/**
 * A release version: a name of one or more hyphen-joined segments (`PMV4-Deposit`), a dash, major.minor[.patch], then
 * optional `.x` / `-x` suffixes (`xPNTsFactory-2.3.0-clone-optimized`).
 */
export const SP550_TOOLING_VERSION_FORM = /^[A-Za-z][A-Za-z0-9]*(-[A-Za-z][A-Za-z0-9]*)*-\d+\.\d+(\.\d+)?([.-][0-9A-Za-z]+)*$/;

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/** The data sp550ToolingProblems checks; the vendored files by default (tests pass altered copies). */
export type Sp550ToolingData = {
    policy: { schema: unknown; rule: unknown; getters: unknown; immutableBindings: unknown };
    artifacts: Readonly<Record<string, string | null>>;
    runtimePins: Readonly<Record<string, { schema: unknown; artifacts: Record<string, unknown> }>>;
    externalDeps: Readonly<Record<string, unknown>>;
    toolingRelease: Readonly<Record<string, string>>;
    tagRelease: Readonly<Record<string, string>>;
    releaseAbsent: Readonly<Record<string, string>>;
    providers: Readonly<Record<string, unknown>>;
};
export const SP550_TOOLING_DATA: Sp550ToolingData = {
    policy: POLICY, artifacts: SP550_READBACK_ARTIFACTS, runtimePins: SP550_RUNTIME_PINS, externalDeps: SP550_EXTERNAL_DEPS,
    toolingRelease: SP550_TOOLING_RELEASE_VERSIONS, tagRelease: TAG_RELEASE_VERSIONS, releaseAbsent: SP550_TOOLING_RELEASE_ABSENT,
    providers: SP550_READBACK_PROVIDERS,
};

const HEX32 = /^0x[0-9a-f]{64}$/;
const DEC = /^(0|[1-9][0-9]*)$/;
const LABEL = /^(config:[A-Za-z0-9_]+|external:[A-Za-z0-9_]+|zero)$/;
const strArr = (x: unknown): x is string[] => Array.isArray(x) && x.every((y) => typeof y === 'string');

/** Each runtime pin has the fields B2 compares, and its immutable ranges are well-formed. */
function runtimePinShapeProblems(d: Sp550ToolingData): string[] {
    const p: string[] = [];
    for (const c of SP550_TOOLING_CHAINS) {
        const arts = d.runtimePins[c]?.artifacts;
        if (!isObj(arts)) { p.push(`runtime-pins.${c} has no artifacts object`); continue; }
        for (const [art, raw] of Object.entries(arts)) {
            const a = raw as Record<string, unknown>;
            const at = `runtime-pins.${c} ${art}`;
            if (!isObj(a)) { p.push(`${at} is not an object`); continue; }
            for (const f of ['optimizerRuns', 'runtimeLength'] as const) if (typeof a[f] !== 'string' || !DEC.test(a[f] as string)) p.push(`${at}.${f} is not a decimal string`);
            const codeLen = typeof a.runtimeLength === 'string' && DEC.test(a.runtimeLength) ? BigInt(a.runtimeLength) : undefined;
            if (codeLen === 0n) p.push(`${at}.runtimeLength is 0 (empty code fails closed)`);
            for (const f of ['maskedRuntimeKeccak', 'rawRuntimeKeccak'] as const) if (typeof a[f] !== 'string' || !HEX32.test(a[f] as string)) p.push(`${at}.${f} is not a 32-byte hash`);
            if (typeof a.hasImmutables !== 'boolean') p.push(`${at}.hasImmutables is not a boolean`);
            if (!Array.isArray(a.immutableRanges)) { p.push(`${at}.immutableRanges is not an array`); continue; }
            if (a.hasImmutables !== (a.immutableRanges.length > 0)) p.push(`${at}.hasImmutables disagrees with its ${a.immutableRanges.length} immutable range(s)`);
            if (!a.immutableRanges.length && a.maskedRuntimeKeccak !== a.rawRuntimeKeccak) p.push(`${at} has no immutables but its masked and raw keccaks differ`);
            let prevEnd = -1n;
            for (const [i, rg] of (a.immutableRanges as unknown[]).entries()) {
                const q = rg as Record<string, unknown>;
                if (!isObj(q) || typeof q.start !== 'string' || !DEC.test(q.start) || q.length !== '32' || typeof q.name !== 'string' || !q.name || typeof q.type !== 'string' || typeof q.id !== 'string') { p.push(`${at}.immutableRanges[${i}] is malformed (start / length 32 / name / type / id)`); continue; }
                // Inside the code, sorted by start, not overlapping (spec §1: a range outside the code fails closed).
                const start = BigInt(q.start), end = start + 32n;
                if (codeLen !== undefined && end > codeLen) p.push(`${at}.immutableRanges[${i}] (${q.name}) ends at ${end}, past runtimeLength ${codeLen}`);
                if (start < prevEnd) p.push(`${at}.immutableRanges[${i}] (${q.name}) starts at ${start}, before the previous range ends (${prevEnd}): unsorted or overlapping`);
                prevEnd = end;
            }
        }
    }
    return p;
}

/** The policy has every section B2 consumes, entries of the agreed shapes, and immutable bindings that cover exactly each artifact's immutables. */
function policyShapeProblems(d: Sp550ToolingData): string[] {
    const p: string[] = [];
    const pol = d.policy as Record<string, unknown>;
    for (const sec of ['getters', 'immutableBindings', 'unreadableAllowed', 'zeroAllowedConfigKeys'] as const) if (!isObj(pol[sec])) p.push(`readback-policy has no ${sec} object`);
    if (isObj(pol.zeroAllowedConfigKeys)) for (const [k, why] of Object.entries(pol.zeroAllowedConfigKeys)) if (typeof why !== 'string' || !why.trim()) p.push(`readback-policy zeroAllowedConfigKeys.${k} has no reason`);
    if (isObj(pol.getters)) for (const [art, gs] of Object.entries(pol.getters)) {
        if (!isObj(gs)) { p.push(`readback-policy getters.${art} is not an object`); continue; }
        for (const [g, e] of Object.entries(gs)) {
            const at = `readback-policy getters.${art}.${g}`;
            if (!isObj(e)) { p.push(`${at} is not an object`); continue; }
            if (!strArr(e.allowed) || e.allowed.some((l) => !LABEL.test(l))) p.push(`${at}.allowed is not a list of config: / external: / zero labels`);
            if (typeof e.why !== 'string' || !e.why.trim()) p.push(`${at} has no why`);
            if ('emptyAllowed' in e && typeof e.emptyAllowed !== 'boolean') p.push(`${at}.emptyAllowed is present but not a boolean`);
            if ('zeroAllowed' in e && (typeof e.zeroAllowed !== 'string' || !e.zeroAllowed.trim())) p.push(`${at}.zeroAllowed is present but not a reason`);
            const extra = Object.keys(e).filter((k) => !['allowed', 'why', 'emptyAllowed', 'zeroAllowed'].includes(k));
            if (extra.length) p.push(`${at} has unknown field(s) ${extra.join(', ')}`);
        }
    }
    if (isObj(pol.immutableBindings)) for (const chain of SP550_TOOLING_CHAINS) {
        const pins = isObj(d.runtimePins[chain]?.artifacts) ? d.runtimePins[chain].artifacts : {};
        for (const [art, bs] of Object.entries(pol.immutableBindings)) {
            if (!isObj(bs)) { if (chain === '10') p.push(`readback-policy immutableBindings.${art} is not an object`); continue; }
            const pin = pins[art];
            const ranges = isObj(pin) ? pin.immutableRanges : undefined;
            if (!Array.isArray(ranges)) { p.push(`readback-policy immutableBindings.${art} names an artifact with no runtime pin on chain ${chain}`); continue; }
            // Coverage is by immutable NAME (spec §4), on every chain's pins (Codex B1 r2 M1).
            const names = new Set(ranges.filter((x): x is { name: string } => isObj(x) && typeof x.name === 'string').map((x) => x.name));
            for (const n of names) if (!Object.prototype.hasOwnProperty.call(bs, n)) p.push(`readback-policy immutableBindings.${art} has no entry for immutable ${n} (chain ${chain})`);
            for (const [n, e] of Object.entries(bs)) {
                const at = `readback-policy immutableBindings.${art}.${n}`;
                if (!names.has(n)) { p.push(`${at} names no immutable of ${art} on chain ${chain} (stale)`); continue; }
                if (chain !== '10') continue; // the entry's own shape is checked once
                if (!isObj(e)) { p.push(`${at} is not an object`); continue; }
                const kinds = ['allowed', 'expectedUint', 'codehashOf', 'chainId', 'unbound'].filter((k) => k in e);
                if (kinds.length !== 1) p.push(`${at} has ${kinds.length ? kinds.join(' + ') : 'no'} binding kind (exactly one of allowed / expectedUint / codehashOf / chainId / unbound)`);
                else if (kinds[0] === 'unbound') { if (typeof e.unbound !== 'string' || !e.unbound.trim() || Object.keys(e).length !== 1) p.push(`${at} must be exactly {"unbound": "<reason>"}`); }
                else if (typeof e.why !== 'string' || !e.why.trim()) p.push(`${at} has no why`);
                if (kinds[0] === 'allowed' && (!strArr(e.allowed) || !e.allowed.length || e.allowed.some((l) => !LABEL.test(l)))) p.push(`${at}.allowed is not a non-empty list of labels`);
                if (kinds[0] === 'expectedUint' && (typeof e.expectedUint !== 'string' || !DEC.test(e.expectedUint))) p.push(`${at}.expectedUint is not a decimal string`);
                if (kinds[0] === 'codehashOf' && (typeof e.codehashOf !== 'string' || !/^config:[A-Za-z0-9_]+$/.test(e.codehashOf))) p.push(`${at}.codehashOf is not a config: label`);
                if (kinds[0] === 'chainId' && e.chainId !== true) p.push(`${at}.chainId is not true`);
            }
        }
        for (const art of Object.keys(pins)) if (!isObj(pol.immutableBindings[art])) p.push(`readback-policy immutableBindings has no section for pinned artifact ${art} (chain ${chain})`);
    }
    return p;
}

/**
 * Structural problems with the vendored tooling data (empty = sound). Bytes are scripts/check-sp550-tooling.ts's job;
 * this checks what the data must say for B to use it.
 */
export function sp550ToolingProblems(d: Sp550ToolingData = SP550_TOOLING_DATA): string[] {
    const p: string[] = [];
    const POLICY = d.policy;
    if (POLICY.schema !== SP550_READBACK_SCHEMAS.policy) p.push(`readback-policy schema is ${JSON.stringify(POLICY.schema)}, not ${SP550_READBACK_SCHEMAS.policy}`);
    if (POLICY.rule !== SP550_READBACK_POLICY_RULE) p.push(`readback-policy rule is ${JSON.stringify(POLICY.rule)}, not the agreed text`);
    for (const c of SP550_TOOLING_CHAINS) {
        const rp = d.runtimePins[c];
        if (!rp || rp.schema !== SP550_READBACK_SCHEMAS.runtimePins) p.push(`runtime-pins.${c} schema is ${JSON.stringify(rp?.schema)}, not ${SP550_READBACK_SCHEMAS.runtimePins}`);
        if (!isObj(d.externalDeps[c])) p.push(`external-deps.${c} is not an object`);
    }
    // Every artifact readback-artifacts names has a runtime pin (on every chain) and a policy section.
    for (const [key, art] of Object.entries(d.artifacts)) {
        if (art === null) continue;
        for (const c of SP550_TOOLING_CHAINS) if (!isObj(d.runtimePins[c]?.artifacts) || !isObj(d.runtimePins[c].artifacts[art])) p.push(`readback-artifacts maps ${key} to ${art}, which has no runtime pin on chain ${c}`);
        if (!isObj(POLICY.getters) || !isObj(POLICY.getters[art])) p.push(`readback-policy has no getters section for ${art} (${key})`);
        if (!isObj(POLICY.immutableBindings) || !isObj(POLICY.immutableBindings[art])) p.push(`readback-policy has no immutableBindings section for ${art} (${key})`);
    }
    // A proxy key adds its implementation's release row only if it really is that proxy (Codex B1 r1 M3).
    for (const [proxy, impl] of Object.entries(SP550_TOOLING_PROXY_OF)) {
        if (d.artifacts[proxy] !== 'ERC1967Proxy') p.push(`readback-artifacts: ${proxy} is ${JSON.stringify(d.artifacts[proxy])}, not ERC1967Proxy, so it cannot inherit ${impl}'s release row`);
        if (typeof d.artifacts[impl] !== 'string' || d.artifacts[impl] === 'ERC1967Proxy') p.push(`readback-artifacts: ${impl} (the implementation behind ${proxy}) is ${JSON.stringify(d.artifacts[impl])}`);
    }
    // The tag's 6-key table (what the current gate uses) is a subset of the tooling table, value for value.
    for (const [k, v] of Object.entries(d.tagRelease)) {
        if (d.toolingRelease[k] !== v) p.push(`release-versions: the tag's ${k}=${JSON.stringify(v)} is ${JSON.stringify(d.toolingRelease[k])} in the tooling table`);
    }
    // Every release key either versions at least one config key, or is absent with a reason — exactly.
    const map = sp550ToolingReleaseConfigKeys(d.toolingRelease, d.artifacts);
    for (const [k, v] of Object.entries(d.toolingRelease)) {
        if (typeof v !== 'string' || !SP550_TOOLING_VERSION_FORM.test(v)) p.push(`release-versions: ${k} has a malformed version ${JSON.stringify(v)}`);
        const absent = Object.prototype.hasOwnProperty.call(d.releaseAbsent, k);
        if (map[k].length && absent) p.push(`release-versions: ${k} maps to ${map[k].join(', ')} but is listed absent`);
        if (!map[k].length && !absent) p.push(`release-versions: ${k} maps to no config key and is not listed absent`);
    }
    for (const [k, why] of Object.entries(d.releaseAbsent)) {
        if (!Object.prototype.hasOwnProperty.call(d.toolingRelease, k)) p.push(`SP550_TOOLING_RELEASE_ABSENT lists ${k}, which the tooling release table no longer has`);
        if (typeof why !== 'string' || !why.trim()) p.push(`SP550_TOOLING_RELEASE_ABSENT: ${k} has no reason`);
    }
    // One config key is versioned by one release key.
    const owner = new Map<string, string>();
    for (const [k, keys] of Object.entries(map)) for (const ck of keys) {
        if (owner.has(ck)) p.push(`release-versions: config key ${ck} is versioned by both ${owner.get(ck)} and ${k}`);
        else owner.set(ck, k);
    }
    p.push(...runtimePinShapeProblems(d), ...policyShapeProblems(d));
    for (const [name, sfx] of Object.entries(d.providers)) {
        if (!Array.isArray(sfx) || !sfx.length || sfx.some((x) => typeof x !== 'string' || !/^\.[a-z0-9.-]+$/.test(x))) p.push(`readback-providers: ${name} has a malformed suffix list`);
    }
    return p;
}
