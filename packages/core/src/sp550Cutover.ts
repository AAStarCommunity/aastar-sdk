/**
 * SuperPaymaster 5.5.0 cutover pins (DRAFT — merged only after 5.5.0 is live).
 *
 * 5.5.0 is an IN-PLACE upgrade: the SuperPaymaster proxy address does not change. What a cutover
 * adds is (a) the contracts 5.5.0 introduces and (b) the values that prove which code is behind
 * the proxy. Every field is left UNSET until it has been read back from the chain (DSR's cutover
 * work order); nothing here is guessed from a release note or a config file.
 *
 * Nothing in the SDK reads these addresses until `requireSp550CutoverPins()` passes, and
 * `scripts/check-sp550-cutover.ts` compares every field against the chain before a release.
 * Key names match what SuperPaymaster's UpgradeToV5_5_0 / V55Bootstrap write to
 * deployments/config.<env>.json (V55_OUT_CONFIG).
 */
import { isAddress, type Address, type Hex } from 'viem';

export interface Sp550CutoverPins {
    /** SuperPaymaster release tag the deployment was built from (e.g. "v5.5.0"). */
    tag?: string;
    /**
     * The exact `SuperPaymaster.version()` string the read-back must return (release 5.5.0 ships
     * contract "SuperPaymaster-5.5.1"). A reviewed per-chain pin, not a constant in the gate: the
     * Lens check (`EXPECTED_SP_VERSION == keccak256(spVersion)`) is derived from it too.
     */
    spVersion?: string;
    /** The proxy (unchanged by the upgrade) — present only so the check script is self-contained. */
    superPaymaster?: Address;
    /** ERC-1967 implementation behind the proxy after the upgrade. */
    spImpl?: Address;
    /** keccak256 of spImpl's runtime code, as read back from the chain. */
    spImplCodehash?: Hex;
    /**
     * SuperPaymasterAdmin, the extension SP's fallback DELEGATECALLs for every selector the core does
     * not define (most admin functions, all permissionless ones such as expireWithdraw). It has no
     * version(): its codehash is its only identity. The gate holds SP.EXTENSION() to this pin.
     */
    spAdminExtension?: Address;
    superPaymasterLens?: Address;
    /** The exact `SuperPaymasterLens.version()` string (e.g. "SuperPaymasterLens-1.2.2"). */
    lensVersion?: string;
    xPNTsFactoryV2?: Address;
    xPNTsTokenV2Impl?: Address;
    xPNTsTokenV2Ext?: Address;
    aoaProtocolRegistry?: Address;
    globalTierSource?: Address;
    /** The aPNTs token SP points at after the manifest's APNTS switch (SP.APNTS_TOKEN()). */
    aPNTsCapped?: Address;
    /** ERC-1967 implementation behind the Registry proxy (`addresses.registry`). */
    registryImpl?: Address;
    /** The DisclosureRegistry 5.5.0 deploys; not in the SDK book, pinned by codehash. */
    disclosureRegistry?: Address;
    /**
     * SP-owned SDK address-book entries the read-back certifies, keyed by book key. An upgrade
     * pins at least SP550_CERTIFIED_ADDRESS_KEYS and every key whose address the deploy changes;
     * aPNTs / xPNTsFactory are NOT listed here (they follow aPNTsCapped / xPNTsFactoryV2). A fresh
     * deploy pins the whole SP-owned book (sp550Deployments.ts).
     */
    addresses?: Partial<Record<string, Address>>;
    /**
     * Keys declared NOT deployed. A fresh deploy lists sp-optional book keys; an upgrade only ever
     * lists timelockController (a manifest's timelockController: "n/a:none").
     */
    absent?: string[];
    /** Block the readback was taken at. */
    readbackBlock?: bigint;
    /**
     * keccak256 of the runtime code of EVERY pinned address, as read back, keyed by pin name
     * (`superPaymaster`, `spImpl`, …, and `addresses.<key>` for a fresh deploy's book). version()
     * alone does not identify a build: two SP-a builds both answer "SuperPaymaster-5.5.1" with
     * different withdrawal semantics. On a fork they come from the deploy; live, from the read-back.
     * `codehashes.spImpl` must equal `spImplCodehash`.
     */
    codehashes?: Partial<Record<string, Hex>>;
}

/** Fields that MUST be filled before the cutover can ship. */
export const SP550_REQUIRED_PIN_FIELDS = [
    'tag',
    'spVersion',
    'superPaymaster',
    'spImpl',
    'spImplCodehash',
    'spAdminExtension',
    'superPaymasterLens',
    'lensVersion',
    'xPNTsFactoryV2',
    'xPNTsTokenV2Impl',
    'xPNTsTokenV2Ext',
    'aoaProtocolRegistry',
    'globalTierSource',
    'aPNTsCapped',
    'registryImpl',
    'disclosureRegistry',
    'readbackBlock',
    'codehashes',
] as const satisfies readonly (keyof Sp550CutoverPins)[];

/**
 * Per-chain pins. Sepolia stays empty until SP 5.5.0 is live there and DSR has read the values
 * back; an empty entry makes every consumer fail closed.
 */
export const SP550_CUTOVER_PINS: Record<number, Sp550CutoverPins> = {
    11155111: {},
};

const ZERO = '0x0000000000000000000000000000000000000000';
const ADDRESS_FIELDS = [
    'superPaymaster', 'spImpl', 'spAdminExtension', 'superPaymasterLens', 'xPNTsFactoryV2', 'xPNTsTokenV2Impl',
    'xPNTsTokenV2Ext', 'aoaProtocolRegistry', 'globalTierSource', 'aPNTsCapped', 'registryImpl', 'disclosureRegistry',
] as const;

/** Book entries every 5.5.0 read-back certifies by address and codehash, in either deploy mode. */
export const SP550_CERTIFIED_ADDRESS_KEYS = ['registry', 'policyRegistry', 'blsAggregator', 'dvtValidator', 'reputationSystem'] as const;

const HASH = /^0x[0-9a-fA-F]{64}$/;

/**
 * Every pinned address with its pin name: the top-level 5.5.0 contracts, then `addresses.<key>` for
 * the certified book entries. The gate checks the code of exactly these, so `codehashes` is keyed the same.
 */
export function sp550PinnedAddressEntries(pins: Sp550CutoverPins | undefined): [string, unknown][] {
    if (!pins) return [];
    const book = pins.addresses ?? {};
    return [
        ...ADDRESS_FIELDS.map((k) => [k, pins[k]] as [string, unknown]),
        ...Object.entries(book).map(([k, a]) => [`addresses.${k}`, a] as [string, unknown]),
    ];
}

/**
 * `codehashes` problems: every name in `required` (a pinned address) has a 32-byte hash, and no
 * entry names something that can never be pinned. `addresses.<key>` names are left to the fresh
 * deploy check, which knows the address book (sp550FreshPinProblems).
 */
export function sp550CodehashProblems(pins: Sp550CutoverPins | undefined, required: string[], isPinnable: (name: string) => boolean): string[] {
    if (!pins || pins.codehashes === undefined || pins.codehashes === null) return [];
    const hashes = pins.codehashes;
    if (typeof hashes !== 'object' || Array.isArray(hashes)) return ['codehashes: not an object of pin name -> 32-byte hash'];
    const problems: string[] = [];
    for (const k of required) {
        if (hashes[k] === undefined) problems.push(`codehashes.${k}: unpinned (every pinned address needs its runtime codehash)`);
    }
    for (const [k, h] of Object.entries(hashes)) {
        if (!isPinnable(k)) problems.push(`codehashes.${k}: no pinned address of that name`);
        else if (!HASH.test(String(h))) problems.push(`codehashes.${k}: not a 32-byte hash (${String(h)})`);
    }
    return problems;
}

/** Release tags the 5.5.0 cutover accepts: exactly v5.5.0, or v5.5.0-rc.N only when allowed. */
export function isSp550ReleaseTag(tag: unknown, opts: { allowRc?: boolean } = {}): boolean {
    if (typeof tag !== 'string') return false;
    return tag === 'v5.5.0' || (!!opts.allowRc && /^v5\.5\.0-rc\.\d+$/.test(tag));
}

/** The missing required fields for a pin set (empty array = complete). */
export function missingSp550Pins(pins: Sp550CutoverPins | undefined): string[] {
    return SP550_REQUIRED_PIN_FIELDS.filter((k) => pins?.[k] === undefined || pins?.[k] === null || pins?.[k] === '');
}

/**
 * Everything wrong with a pin set: missing fields AND malformed values (non-address / zero
 * address, a codehash that is not 32 bytes, a tag that is not the 5.5.0 release, a non-positive
 * block). Empty array = usable.
 */
export function sp550PinProblems(pins: Sp550CutoverPins | undefined, opts: { allowRc?: boolean } = {}): string[] {
    const problems = missingSp550Pins(pins).map((k) => `${k}: unpinned`);
    if (!pins) return problems;
    for (const k of ADDRESS_FIELDS) {
        const v = pins[k];
        if (v === undefined) continue;
        if (typeof v !== 'string' || !isAddress(v, { strict: false }) || v.toLowerCase() === ZERO) problems.push(`${k}: not a non-zero address (${String(v)})`);
    }
    if (pins.spImplCodehash !== undefined && !HASH.test(String(pins.spImplCodehash))) {
        problems.push(`spImplCodehash: not a 32-byte hash (${String(pins.spImplCodehash)})`);
    }
    if (pins.tag !== undefined && !isSp550ReleaseTag(pins.tag, opts)) {
        problems.push(`tag: ${JSON.stringify(pins.tag)} is not ${opts.allowRc ? 'v5.5.0 / v5.5.0-rc.N' : 'v5.5.0'}`);
    }
    if (pins.spVersion !== undefined && !(typeof pins.spVersion === 'string' && /^SuperPaymaster-5\.5\.\d+$/.test(pins.spVersion))) {
        problems.push(`spVersion: ${JSON.stringify(pins.spVersion)} is not a SuperPaymaster-5.5.x version() string`);
    }
    if (pins.lensVersion !== undefined && !(typeof pins.lensVersion === 'string' && /^SuperPaymasterLens-\d+\.\d+\.\d+$/.test(pins.lensVersion))) {
        problems.push(`lensVersion: ${JSON.stringify(pins.lensVersion)} is not a SuperPaymasterLens-x.y.z version() string`);
    }
    const book = pins.addresses;
    if (book !== undefined && (typeof book !== 'object' || book === null || Array.isArray(book))) problems.push('addresses: not an object of book key -> address');
    else {
        for (const k of SP550_CERTIFIED_ADDRESS_KEYS) if (book?.[k] === undefined) problems.push(`addresses.${k}: unpinned`);
        for (const [k, v] of Object.entries(book ?? {})) {
            if (typeof v !== 'string' || !isAddress(v, { strict: false }) || v.toLowerCase() === ZERO) problems.push(`addresses.${k}: not a non-zero address (${String(v)})`);
        }
    }
    if (pins.readbackBlock !== undefined && !(typeof pins.readbackBlock === 'bigint' && pins.readbackBlock > 0n)) {
        problems.push(`readbackBlock: not a positive block number (${String(pins.readbackBlock)})`);
    }
    problems.push(...sp550CodehashProblems(
        pins,
        // `addresses.<key>` hashes are required where the book owner table is known (sp550BookOwnershipProblems).
        ADDRESS_FIELDS.filter((k) => pins[k] !== undefined),
        (name) => (ADDRESS_FIELDS as readonly string[]).includes(name) || name.startsWith('addresses.'),
    ));
    const implHash = pins.codehashes?.spImpl;
    if (implHash !== undefined && HASH.test(String(pins.spImplCodehash)) && String(implHash).toLowerCase() !== String(pins.spImplCodehash).toLowerCase()) {
        problems.push(`codehashes.spImpl ${implHash} != spImplCodehash ${pins.spImplCodehash}`);
    }
    return problems;
}

/**
 * Upgrade-only: the book entries the cutover derives from top-level pins are not ALSO listed in
 * `addresses` (one value, one source).
 */
export function sp550UpgradeAddressProblems(pins: Sp550CutoverPins | undefined): string[] {
    const derived: Record<string, string> = { aPNTs: 'aPNTsCapped', xPNTsFactory: 'xPNTsFactoryV2' };
    return Object.keys(pins?.addresses ?? {}).filter((k) => derived[k]).map((k) => `addresses.${k}: an upgrade derives it from ${derived[k]}; do not list it`);
}

// requireSp550CutoverPins lives in sp550Deployments.ts: it needs the address-book owner table to apply
// the full upgrade rule set (ownership, aliases, holds), and a field-level variant here was a bypass.
