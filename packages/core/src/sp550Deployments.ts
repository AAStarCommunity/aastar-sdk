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
import type { CanonicalAddresses } from './addresses.js';
import { SP550_CERTIFIED_ADDRESS_KEYS, SP550_CUTOVER_PINS, sp550PinProblems, sp550PinnedAddressEntries, sp550UpgradeAddressProblems, type Sp550CutoverPins } from './sp550Cutover.js';

export type Sp550DeployMode = 'upgrade' | 'fresh';

export const SP550_NETWORKS = {
    sepolia: { chainId: sepolia.id, mode: 'upgrade' },
    'op-sepolia': { chainId: optimismSepolia.id, mode: 'fresh' },
    'op-mainnet': { chainId: optimism.id, mode: 'fresh' },
} as const satisfies Record<string, { chainId: number; mode: Sp550DeployMode }>;

export type Sp550Network = keyof typeof SP550_NETWORKS;

/** The network entry for a name, or throw listing the accepted names. */
export function resolveSp550Network(name: string | undefined): { network: Sp550Network; chainId: number; mode: Sp550DeployMode } {
    if (!name || !Object.prototype.hasOwnProperty.call(SP550_NETWORKS, name)) {
        throw new Error(`unknown SP 5.5.0 network ${JSON.stringify(name)}; expected one of ${Object.keys(SP550_NETWORKS).join(', ')}`);
    }
    const n = name as Sp550Network;
    return { network: n, ...SP550_NETWORKS[n] };
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
export const SP550_ADDRESS_OWNER: Record<AddressBookKey, 'sp' | 'sp-optional' | 'external'> = {
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
};

const keysOwnedAs = (o: 'sp' | 'sp-optional') =>
    (Object.keys(SP550_ADDRESS_OWNER) as AddressBookKey[]).filter((k) => SP550_ADDRESS_OWNER[k] === o);
export const SP550_FRESH_REQUIRED_ADDRESS_KEYS = keysOwnedAs('sp');
export const SP550_FRESH_OPTIONAL_ADDRESS_KEYS = keysOwnedAs('sp-optional');

/** A fresh-deploy pin set: the 5.5.0 pieces (as for an upgrade) plus the SP-owned address book. */
export interface Sp550FreshDeployPins extends Sp550CutoverPins {
    addresses?: Partial<Record<AddressBookKey, Address>>;
    /** `sp-optional` keys SP's manifest declares NOT deployed on this chain. */
    absent?: AddressBookKey[];
}

/**
 * Fresh-deploy pins per chain. Empty until the post-deploy two-RPC read-back; SP's OP manifest
 * track is not built yet, so there is nothing to pre-wire.
 */
export const SP550_FRESH_DEPLOY_PINS: Record<number, Sp550FreshDeployPins> = {
    [optimismSepolia.id]: {},
    [optimism.id]: {},
};

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
        if (SP550_ADDRESS_OWNER[k as AddressBookKey] !== 'sp-optional') problems.push(`absent: ${k} is not an sp-optional key`);
    }
    problems.push(...sp550BookOwnershipProblems(pins));
    if (pins?.superPaymaster && book.superPaymaster && pins.superPaymaster.toLowerCase() !== book.superPaymaster.toLowerCase()) {
        problems.push(`superPaymaster ${pins.superPaymaster} != addresses.superPaymaster ${book.superPaymaster}`);
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
 * Upgrade pins for a chain, or throw naming every problem — the full upgrade rule set (fields,
 * codehashes, book ownership, aliases) and any release hold. Consumers use this, not the field-level
 * requireSp550CutoverPins.
 */
export function requireSp550UpgradePins(
    chainId: number,
    pins = SP550_CUTOVER_PINS[chainId],
    opts: { allowRc?: boolean } = {},
): Required<Sp550CutoverPins> {
    const problems = sp550UpgradePinProblems(pins, opts);
    const hold = SP550_RELEASE_HOLDS[chainId];
    if (hold) problems.push(`release hold: ${hold}`);
    if (problems.length) {
        throw new Error(
            `SuperPaymaster 5.5.0 cutover pins for chain ${chainId} are not usable (${problems.join('; ')}). ` +
                `They are read back from the chain after the upgrade; until then the SDK must not use 5.5.0 addresses.`,
        );
    }
    return pins as Required<Sp550CutoverPins>;
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
): Required<Sp550FreshDeployPins> {
    const problems = sp550FreshPinProblems(pins, opts);
    const hold = SP550_RELEASE_HOLDS[chainId];
    if (hold) problems.push(`release hold: ${hold}`);
    if (problems.length) {
        throw new Error(
            `SuperPaymaster 5.5.0 fresh-deploy pins for chain ${chainId} are not usable (${problems.join('; ')}). ` +
                `They are read back from two RPCs after the deploy; until then the SDK must not use 5.5.0 addresses there.`,
        );
    }
    return pins as Required<Sp550FreshDeployPins>;
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
