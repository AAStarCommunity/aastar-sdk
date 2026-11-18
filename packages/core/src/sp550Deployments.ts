/**
 * SuperPaymaster 5.5.0 per-network deployment selection (DRAFT — merged only after read-back).
 *
 * Two deployment modes exist, and the network decides which one applies:
 *  - `upgrade` (Sepolia): an in-place UUPS upgrade 5.4.2 -> 5.5.0. The proxy and the rest of the
 *    V5 stack keep their addresses; only the 5.5.0 additions are pinned (sp550Cutover.ts).
 *  - `fresh` (OP Sepolia, OP Mainnet): those chains run SuperPaymaster-3.2.2 deployed WITHOUT a
 *    proxy (ERC-1967 impl slot = 0), so 5.5.0 there is a fresh full V5 stack and every
 *    SP-owned entry of the address book changes. Those pins cover the whole SP-owned book.
 *
 * Selection is by network name only (`--network`); the chainId each name stands for comes from
 * viem's chain definitions, and callers assert the RPC's chainId against it before any read.
 * Every fresh entry is empty until the post-deploy two-RPC read-back fills it, so every
 * consumer fails closed. A release hold additionally blocks a chain even when its pins are
 * complete (OP Mainnet: the 3.2.2 migrate/sunset decision is the author's).
 */
import { isAddress, type Address } from 'viem';
import { optimism, optimismSepolia, sepolia } from 'viem/chains';
import { CANONICAL_ADDRESSES, type CanonicalAddresses } from './addresses.js';
import { SP550_CERTIFIED_ADDRESS_KEYS, SP550_CUTOVER_PINS, sp550PinProblems, sp550PinnedAddressEntries, sp550UpgradeAddressProblems, type Sp550CutoverPins } from './sp550Cutover.js';

export type Sp550DeployMode = 'upgrade' | 'fresh';

/**
 * `coexist`: a fresh full stack deployed NEXT TO the chain's existing one (DSR 2026-11-19: rc.8 on Sepolia via
 * DeployLive, the 5.4.2 stack untouched). Its pins live in SP550_COEXIST_PINS under the network name, it never
 * switches CANONICAL_ADDRESSES, and callers select it explicitly (sp550AddressSet), so the default book stays
 * the existing stack.
 */
/**
 * `allowRc`: the network's release-tag policy, applied alike by the writer, the gate and the consumers. Only the rc.8
 * stack accepts `v5.5.0-rc.N` without the operator's --allow-rc (it IS the release candidate).
 */
export const SP550_NETWORKS = {
    sepolia: { chainId: sepolia.id, mode: 'upgrade', coexist: false, allowRc: false },
    'sepolia-rc8': { chainId: sepolia.id, mode: 'fresh', coexist: true, allowRc: true },
    'op-sepolia': { chainId: optimismSepolia.id, mode: 'fresh', coexist: false, allowRc: false },
    'op-mainnet': { chainId: optimism.id, mode: 'fresh', coexist: false, allowRc: false },
} as const satisfies Record<string, { chainId: number; mode: Sp550DeployMode; coexist: boolean; allowRc: boolean }>;

export type Sp550Network = keyof typeof SP550_NETWORKS;
export type Sp550CoexistNetwork = { [K in Sp550Network]: (typeof SP550_NETWORKS)[K]['coexist'] extends true ? K : never }[Sp550Network];

/** One network's entry with its name; a union over the networks, so `if (net.coexist)` narrows `net.network`. */
export type Sp550NetworkEntry = { [K in Sp550Network]: { network: K } & (typeof SP550_NETWORKS)[K] }[Sp550Network];

/** The network entry for a name, or throw listing the accepted names. */
export function resolveSp550Network(name: string | undefined): Sp550NetworkEntry {
    if (!name || !Object.prototype.hasOwnProperty.call(SP550_NETWORKS, name)) {
        throw new Error(`unknown SP 5.5.0 network ${JSON.stringify(name)}; expected one of ${Object.keys(SP550_NETWORKS).join(', ')}`);
    }
    const n = name as Sp550Network;
    return { network: n, ...SP550_NETWORKS[n] } as Sp550NetworkEntry;
}

/** Throw unless the chainId an RPC reports is the one the selected network stands for. */
export function assertSp550ChainId(network: Sp550Network, observedChainId: number): void {
    const expected = SP550_NETWORKS[network].chainId;
    if (observedChainId !== expected) {
        throw new Error(`--network ${network} expects chainId ${expected}, but the RPC reports ${observedChainId}; refusing to read`);
    }
}

type KeysOfUnion<T> = T extends unknown ? keyof T : never;
export type AddressBookKey = KeysOfUnion<CanonicalAddresses>;

/**
 * Who deploys each address-book entry on a fresh 5.5.0 chain. Typed as a Record over every key
 * of the SDK address book, so adding a key to CANONICAL_ADDRESSES without classifying it here is
 * a compile error rather than a silently unpinned address.
 *  - `sp`: written by SP's fresh deploy; required.
 *  - `sp-optional`: SP's, but a given chain may legitimately not have it. A fresh pin set must
 *    still account for every one of them: pinned, or listed in `absent` (SP's manifest says it
 *    was not deployed). Leaving one out is a problem, so nothing disappears silently.
 *  - `external`: not SP's deploy (EntryPoint, Chainlink, AirAccount / YAAA); checked
 *    through SP's own wiring where SP exposes it, never pinned from SP's manifest.
 */
/**
 * History keys the cutover writes (never live, never pinned): the replaced value of a switched entry.
 * DSR 2026-11-11: the orphaned v5.4 TimelockController stays only as timelockControllerLegacy.
 */
export type Sp550HistoryKey = 'timelockControllerLegacy';

export const SP550_ADDRESS_OWNER: Record<AddressBookKey | Sp550HistoryKey, 'sp' | 'sp-optional' | 'external'> = {
    registry: 'sp',
    gToken: 'sp',
    staking: 'sp',
    sbt: 'sp',
    reputationSystem: 'sp',
    superPaymaster: 'sp',
    paymasterFactory: 'sp',
    paymasterV4Impl: 'sp',
    blsAggregator: 'sp',
    dvtValidator: 'sp',
    aPNTs: 'sp',
    agentIdentityRegistry: 'sp',
    agentReputationRegistry: 'sp',
    agentValidationRegistry: 'sp',
    policyRegistry: 'sp',
    x402Facilitator: 'sp',
    timelockController: 'sp-optional', // SP schema 543f3498: a deployment may have none (pins declare it)
    paymasterV4: 'sp-optional',
    aPNTsPaymasterV4: 'sp-optional',
    PNTsPaymasterV4: 'sp-optional',
    pnts: 'sp-optional',
    xPNTsFactory: 'sp-optional',
    microPaymentChannel: 'sp-optional',
    blsValidator: 'sp-optional',
    entryPoint: 'external',
    priceFeed: 'external',
    simpleAccountFactory: 'external',
    aaStarBLSAlgorithm: 'external',
    aaStarValidator: 'external',
    aaStarBLSAggregator: 'external',
    sessionKeyValidator: 'external',
    forceExitModule: 'external',
    airAccountDelegate: 'external',
    calldataParserRegistry: 'external',
    airAccountFactoryV7: 'external',
    airAccountV7Impl: 'external',
    airAccountExtension: 'external',
    agentRegistry: 'external', // AirAccount's agent registry, not SP's agentIdentityRegistry
    timelockControllerLegacy: 'external', // history only: the replaced timelock, never a live entry
};

const keysOwnedAs = (o: 'sp' | 'sp-optional') =>
    (Object.keys(SP550_ADDRESS_OWNER) as AddressBookKey[]).filter((k) => SP550_ADDRESS_OWNER[k as keyof typeof SP550_ADDRESS_OWNER] === o);
export const SP550_FRESH_REQUIRED_ADDRESS_KEYS = keysOwnedAs('sp');
export const SP550_FRESH_OPTIONAL_ADDRESS_KEYS = keysOwnedAs('sp-optional');

/** A fresh-deploy pin set: the 5.5.0 pieces (as for an upgrade) plus the SP-owned address book. */
export interface Sp550FreshDeployPins extends Sp550CutoverPins {
    addresses?: Partial<Record<AddressBookKey, Address>>;
    // `absent` (sp-optional keys declared NOT deployed) is inherited from Sp550CutoverPins.
}

/**
 * Fresh-deploy pins per chain. Empty until the post-deploy two-RPC read-back; SP's OP manifest
 * track is not built yet, so there is nothing to pre-wire.
 */
export const SP550_FRESH_DEPLOY_PINS: Record<number, Sp550FreshDeployPins> = {
    [optimismSepolia.id]: {},
    [optimism.id]: {},
};

/**
 * Coexisting fresh stacks, by network name (a chain may carry one next to its existing stack). Empty until the
 * post-deploy two-RPC read-back fills it (scripts/sp550-pin-fill.ts), so every consumer fails closed.
 */
export const SP550_COEXIST_PINS: Record<Sp550CoexistNetwork, Sp550FreshDeployPins> = {
    'sepolia-rc8': {},
};

/** The pin table entry the gate and the consumers read for a network: by name for a coexisting stack, else by chain. */
export function sp550PinsFor(network: Sp550Network): { table: string; key: string; pins: Sp550FreshDeployPins | undefined } {
    const n = SP550_NETWORKS[network];
    if (n.coexist) return { table: 'SP550_COEXIST_PINS', key: network, pins: SP550_COEXIST_PINS[network as Sp550CoexistNetwork] };
    if (n.mode === 'fresh') return { table: 'SP550_FRESH_DEPLOY_PINS', key: String(n.chainId), pins: SP550_FRESH_DEPLOY_PINS[n.chainId] };
    return { table: 'SP550_CUTOVER_PINS', key: String(n.chainId), pins: SP550_CUTOVER_PINS[n.chainId] };
}

/**
 * The address book a fresh pin set stands for: the chain's shipped book with every SP-owned entry taken from the
 * pins and each key the pins declare absent set to the zero address (the book's "not deployed", so it overrides a
 * chain default in a `{ ...defaults, ...addresses }` merge instead of letting the old stack's entry through), and
 * the client-factory aliases (gTokenStaking = staking, mySBT = sbt) taken from the same set. External entries
 * (EntryPoint, price feed, AirAccount) stay the shipped ones; the gate checks SP's wiring against them.
 */
export function sp550OverlayBook(shipped: Record<string, unknown>, pins: Sp550FreshDeployPins): Record<string, unknown> {
    const out: Record<string, unknown> = { ...shipped };
    for (const [k, owner] of Object.entries(SP550_ADDRESS_OWNER)) {
        if (owner !== 'external') delete out[k];
    }
    // The shipped stack's history is not this stack's: zeroed, so a merge into chain defaults does not inherit it.
    out.timelockControllerLegacy = ZERO;
    for (const k of pins.absent ?? []) if (k !== 'disclosureRegistry') out[k] = ZERO;
    Object.assign(out, pins.addresses ?? {});
    out.gTokenStaking = out.staking;
    out.mySBT = out.sbt;
    return out;
}

/**
 * A coexisting stack's complete address set: every book key (zero address = not deployed; the history key
 * timelockControllerLegacy is always zero, it belongs to the shipped stack) plus the client aliases.
 */
export type Sp550AddressSet = Record<AddressBookKey | 'gTokenStaking' | 'mySBT', Address>;

/**
 * The full address set of a coexisting stack, after the complete fresh-deploy validation (with the network's tag
 * policy) and any release hold: what a caller passes as a client's `addresses` to select it (e.g. `--network
 * sepolia-rc8`). Every key is present, so nothing falls back to the chain's default stack. Throws until its pins
 * are read back.
 */
export function sp550AddressSet(network: Sp550CoexistNetwork, pins: Sp550FreshDeployPins | undefined = SP550_COEXIST_PINS[network]): { chainId: number; pins: Sp550ValidatedPins<Sp550FreshDeployPins>; absent: string[]; addresses: Sp550AddressSet } {
    const n = SP550_NETWORKS[network] as { chainId: number; coexist: boolean; allowRc: boolean } | undefined;
    if (!n?.coexist) throw new Error(`${JSON.stringify(network)} is not a coexisting SP 5.5.0 network`);
    const valid = freshPinsOrThrow(n.chainId, pins, { allowRc: n.allowRc }, sp550HoldFor(network), sp550CoexistOverlapProblems(network, pins));
    const book = sp550OverlayBook((CANONICAL_ADDRESSES as Record<number, Record<string, unknown>>)[n.chainId] ?? {}, valid);
    const keys = [...Object.keys(SP550_ADDRESS_OWNER), 'gTokenStaking', 'mySBT'];
    const missing = keys.filter((k) => typeof book[k] !== 'string' || !isAddress(book[k] as string, { strict: false }));
    if (missing.length) throw new Error(`${network}: address set incomplete (${missing.join(', ')}); refusing a partial set`);
    const addresses = Object.fromEntries(keys.map((k) => [k, book[k]])) as Sp550AddressSet;
    return { chainId: n.chainId, pins: valid, absent: [...(valid.absent ?? [])].filter((k) => k !== 'disclosureRegistry'), addresses };
}

/** A deployment does not include a contract the caller is about to use (zero / missing / malformed address). */
export class Sp550NotDeployedError extends Error {
    constructor(readonly deployment: string, readonly key: string, readonly value: unknown) {
        super(`the ${deployment} deployment does not include ${key} (${value === undefined ? 'no entry' : String(value)}); refusing before anything is signed or sent`);
        this.name = 'Sp550NotDeployedError';
    }
}

/**
 * The address of `key` in a deployment's address set, or throw Sp550NotDeployedError. The zero address is the book's
 * "not deployed": a transaction, transfer or calldata built with it would go to (or burn at) address zero, so every
 * path that signs, sends or encodes an address takes it through here (DSR 2026-11-19). Also for addresses read from
 * the chain (e.g. SP.REGISTRY(), an operator's xPNTs token): pass them as `{ [label]: value }`.
 */
export function requireDeployedAddress(set: Record<string, unknown> | undefined, key: string, deployment: string): Address {
    const v = set?.[key];
    if (typeof v !== 'string' || !isAddress(v, { strict: false }) || /^0x0{40}$/i.test(v)) throw new Sp550NotDeployedError(deployment, key, v);
    return v as Address;
}

/**
 * SP-owned addresses of a coexisting stack's pins that are also SP-owned addresses of the chain's shipped stack
 * (the shipped book, including its history). A coexisting stack is a separate deployment: a pin naming the old
 * stack's token, staking or SBT would make a hybrid that the gate's wiring reads do not all reach. Sharing an entry
 * on purpose is a reviewed entry in SP550_COEXIST_SHARED_KEYS, none today.
 */
export const SP550_COEXIST_SHARED_KEYS: Record<Sp550CoexistNetwork, readonly string[]> = { 'sepolia-rc8': [] };
export function sp550CoexistOverlapProblems(network: Sp550CoexistNetwork, pins: Sp550FreshDeployPins | undefined): string[] {
    const n = SP550_NETWORKS[network] as { chainId: number } | undefined;
    if (!n || !pins) return [];
    const shipped = (CANONICAL_ADDRESSES as Record<number, Record<string, unknown>>)[n.chainId] ?? {};
    const old = new Map<string, string>();
    for (const [k, owner] of Object.entries(SP550_ADDRESS_OWNER)) {
        const v = shipped[k];
        if ((owner !== 'external' || k === 'timelockControllerLegacy') && typeof v === 'string' && isAddress(v, { strict: false }) && !/^0x0{40}$/i.test(v)) old.set(v.toLowerCase(), k);
    }
    const shared = new Set(SP550_COEXIST_SHARED_KEYS[network] ?? []);
    return sp550PinnedAddressEntries(pins)
        .filter((e): e is [string, string] => typeof e[1] === 'string' && old.has(e[1].toLowerCase()))
        .filter(([k]) => !shared.has(k.replace(/^addresses\./, '')))
        .map(([k, a]) => `${k} ${a} is the shipped stack's ${old.get(a.toLowerCase())}; a coexisting stack must not reuse it`);
}

/**
 * Release holds of a coexisting stack, by network name: independent of the chain's other stack, so holding one
 * Sepolia deployment never holds (or releases) the other.
 */
export const SP550_COEXIST_HOLDS: Partial<Record<Sp550CoexistNetwork, string>> = {};

/** The release hold that applies to a network: by name for a coexisting stack, by chain (SP550_RELEASE_HOLDS) otherwise. */
export function sp550HoldFor(network: Sp550Network): string | undefined {
    const n = SP550_NETWORKS[network];
    return n.coexist ? SP550_COEXIST_HOLDS[network as Sp550CoexistNetwork] : SP550_RELEASE_HOLDS[n.chainId];
}

/** Chains whose 5.5.0 pins must not ship in a release even when complete, with the reason. */
export const SP550_RELEASE_HOLDS: Record<number, string> = {
    [optimism.id]:
        'OP Mainnet SuperPaymaster-3.2.2 still holds an EntryPoint deposit and stake; repointing chain 10 waits for the author\'s migrate/sunset decision',
};

const ZERO = '0x0000000000000000000000000000000000000000';

/** Everything wrong with a fresh-deploy pin set (empty array = usable, hold aside). */
export function sp550FreshPinProblems(pins: Sp550FreshDeployPins | undefined, opts: { allowRc?: boolean } = {}): string[] {
    const problems = sp550PinProblems(pins, opts);
    const book = pins?.addresses ?? {};
    const absent = new Set<string>(pins?.absent ?? []);
    for (const k of SP550_FRESH_REQUIRED_ADDRESS_KEYS) {
        // The certified keys are already reported by sp550PinProblems.
        if (book[k] === undefined && !(SP550_CERTIFIED_ADDRESS_KEYS as readonly string[]).includes(k)) problems.push(`addresses.${k}: unpinned`);
    }
    for (const k of SP550_FRESH_OPTIONAL_ADDRESS_KEYS) {
        if (book[k] === undefined && !absent.has(k)) problems.push(`addresses.${k}: neither pinned nor declared absent`);
        if (book[k] !== undefined && absent.has(k)) problems.push(`addresses.${k}: pinned and declared absent`);
    }
    for (const k of absent) {
        // disclosureRegistry is a top-level pin, not a book key (sp550PinProblems checks it).
        if (k !== 'disclosureRegistry' && SP550_ADDRESS_OWNER[k as AddressBookKey] !== 'sp-optional') problems.push(`absent: ${k} is not an sp-optional key`);
    }
    problems.push(...sp550BookOwnershipProblems(pins));
    if (pins?.superPaymaster && book.superPaymaster && pins.superPaymaster.toLowerCase() !== book.superPaymaster.toLowerCase()) {
        problems.push(`superPaymaster ${pins.superPaymaster} != addresses.superPaymaster ${book.superPaymaster}`);
    }
    // The book entries an upgrade derives from top-level pins are the same contracts in a fresh set:
    // aPNTs = aPNTsCapped, xPNTsFactory = xPNTsFactoryV2 (the factory the SDK uses is the V2 one).
    for (const [k, top] of [['aPNTs', 'aPNTsCapped'], ['xPNTsFactory', 'xPNTsFactoryV2']] as const) {
        const t = pins?.[top];
        if (t === undefined) continue; // the missing top-level pin is reported by sp550PinProblems
        if (absent.has(k)) problems.push(`addresses.${k}: declared absent, but ${top} is pinned (${t})`);
        else if (book[k] !== undefined && String(book[k]).toLowerCase() !== String(t).toLowerCase()) problems.push(`addresses.${k} ${book[k]} != ${top} ${t} (one contract)`);
    }
    problems.push(...sp550PinAliasProblems(pins));
    return problems;
}

/**
 * `addresses` names only SP-owned book keys, and so does every `codehashes.addresses.<key>` (a
 * hash for each listed entry is required by sp550PinProblems). Only this table knows which keys SP deploys.
 */
export function sp550BookOwnershipProblems(pins: Sp550CutoverPins | undefined): string[] {
    const problems: string[] = [];
    for (const k of Object.keys(pins?.addresses ?? {})) {
        const owner = SP550_ADDRESS_OWNER[k as AddressBookKey];
        if (owner === undefined) problems.push(`addresses.${k}: not an address-book key`);
        else if (owner === 'external') problems.push(`addresses.${k}: external, not pinned from SP's deploy`);
    }
    const spOwned = (k: string) => SP550_ADDRESS_OWNER[k as AddressBookKey] === 'sp' || SP550_ADDRESS_OWNER[k as AddressBookKey] === 'sp-optional';
    if (pins?.codehashes && typeof pins.codehashes === 'object') {
        for (const k of Object.keys(pins.addresses ?? {})) {
            if (spOwned(k) && pins.codehashes[`addresses.${k}`] === undefined) problems.push(`codehashes.addresses.${k}: unpinned (every pinned address needs its runtime codehash)`);
        }
        for (const name of Object.keys(pins.codehashes)) {
            if (name.startsWith('addresses.') && !spOwned(name.slice('addresses.'.length))) problems.push(`codehashes.${name}: not an SP-owned address-book key`);
        }
    }
    return problems;
}

/**
 * A pin set that passed validation: every field is set except the two that may be legitimately empty,
 * `absent` and `disclosureRegistry` (declared absent when 5.5.0 deploys none).
 */
export type Sp550ValidatedPins<T extends Sp550CutoverPins> = Required<Omit<T, 'absent' | 'disclosureRegistry'>> & Pick<T, 'absent' | 'disclosureRegistry'>;

/**
 * Upgrade pins for a chain, or throw naming every problem — the full upgrade rule set (fields,
 * codehashes, book ownership, aliases) and any release hold. Consumers use this, not the field-level
 * requireSp550CutoverPins.
 */
export function requireSp550UpgradePins(
    chainId: number,
    pins = SP550_CUTOVER_PINS[chainId],
    opts: { allowRc?: boolean } = {},
): Sp550ValidatedPins<Sp550CutoverPins> {
    const problems = sp550UpgradePinProblems(pins, opts);
    const hold = SP550_RELEASE_HOLDS[chainId];
    if (hold) problems.push(`release hold: ${hold}`);
    if (problems.length) {
        throw new Error(
            `SuperPaymaster 5.5.0 cutover pins for chain ${chainId} are not usable (${problems.join('; ')}). ` +
                `They are read back from the chain after the upgrade; until then the SDK must not use 5.5.0 addresses.`,
        );
    }
    return pins as Sp550ValidatedPins<Sp550CutoverPins>;
}

/** Pins for a chain, or throw naming every problem: the full upgrade rule set (same as requireSp550UpgradePins). */
export const requireSp550CutoverPins = requireSp550UpgradePins;

/** Everything wrong with an in-place upgrade's pin set (empty array = usable, hold aside). */
export function sp550UpgradePinProblems(pins: Sp550CutoverPins | undefined, opts: { allowRc?: boolean } = {}): string[] {
    return [...sp550PinProblems(pins, opts), ...sp550UpgradeAddressProblems(pins), ...sp550BookOwnershipProblems(pins), ...sp550PinAliasProblems(pins)];
}

/**
 * Fresh-deploy pins for a chain, or throw naming every problem and any release hold. Holds come
 * only from SP550_RELEASE_HOLDS; there is deliberately no override, so lifting one is a reviewed
 * change to that table that records the author's decision.
 */
export function requireSp550FreshDeployPins(
    chainId: number,
    pins = SP550_FRESH_DEPLOY_PINS[chainId],
    opts: { allowRc?: boolean } = {},
): Sp550ValidatedPins<Sp550FreshDeployPins> {
    return freshPinsOrThrow(chainId, pins, opts, SP550_RELEASE_HOLDS[chainId], []);
}

function freshPinsOrThrow(chainId: number, pins: Sp550FreshDeployPins | undefined, opts: { allowRc?: boolean }, hold: string | undefined, extra: string[]): Sp550ValidatedPins<Sp550FreshDeployPins> {
    const problems = [...sp550FreshPinProblems(pins, opts), ...extra];
    if (hold) problems.push(`release hold: ${hold}`);
    if (problems.length) {
        throw new Error(
            `SuperPaymaster 5.5.0 fresh-deploy pins for chain ${chainId} are not usable (${problems.join('; ')}). ` +
                `They are read back from two RPCs after the deploy; until then the SDK must not use 5.5.0 addresses there.`,
        );
    }
    return pins as Sp550ValidatedPins<Sp550FreshDeployPins>;
}

/**
 * The only top-level pin / address-book pairs that legitimately name the same contract. Any other
 * two entries sharing an address is a mis-pin (e.g. addresses.xPNTsFactory = the SP proxy would
 * otherwise only be checked for non-empty code, and pass).
 */
export const SP550_PIN_ALIASES: ReadonlyArray<readonly [string, string]> = [
    ['superPaymaster', 'addresses.superPaymaster'],
    ['aPNTsCapped', 'addresses.aPNTs'],
    ['xPNTsFactoryV2', 'addresses.xPNTsFactory'],
];

/** Every pair of pinned entries that share an address without being a declared alias. */
export function sp550PinAliasProblems(pins: Sp550FreshDeployPins | undefined): string[] {
    if (!pins) return [];
    // Derived from the same list the gate checks code for, so a new pinned field is covered here too.
    const entries: [string, string][] = sp550PinnedAddressEntries(pins).filter((e): e is [string, string] => typeof e[1] === 'string' && isAddress(e[1], { strict: false })).map(([k, a]) => [k, a.toLowerCase()]);
    const allowed = (a: string, b: string) => SP550_PIN_ALIASES.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
    const problems: string[] = [];
    for (let i = 0; i < entries.length; i++) {
        for (let j = i + 1; j < entries.length; j++) {
            if (entries[i][1] !== entries[j][1]) continue;
            if (!allowed(entries[i][0], entries[j][0])) {
                problems.push(`${entries[i][0]} and ${entries[j][0]} are the same address (${entries[i][1]}); only ${SP550_PIN_ALIASES.map((p) => p.join(' = ')).join(', ')} may alias`);
                continue;
            }
            // One contract, one runtime code: a declared alias carrying two different codehash pins cannot both be true.
            const [hi, hj] = [pins.codehashes?.[entries[i][0]], pins.codehashes?.[entries[j][0]]];
            if (hi !== undefined && hj !== undefined && String(hi).toLowerCase() !== String(hj).toLowerCase()) {
                problems.push(`codehashes.${entries[i][0]} ${hi} != codehashes.${entries[j][0]} ${hj}, but they are one contract (declared alias)`);
            }
        }
    }
    return problems;
}
