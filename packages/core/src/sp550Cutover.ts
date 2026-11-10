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
    superPaymasterLens?: Address;
    xPNTsFactoryV2?: Address;
    xPNTsTokenV2Impl?: Address;
    xPNTsTokenV2Ext?: Address;
    aoaProtocolRegistry?: Address;
    globalTierSource?: Address;
    /** The aPNTs token SP points at after the manifest's APNTS switch (SP.APNTS_TOKEN()). */
    aPNTsCapped?: Address;
    /** Block the readback was taken at. */
    readbackBlock?: bigint;
}

/** Fields that MUST be filled before the cutover can ship. */
export const SP550_REQUIRED_PIN_FIELDS = [
    'tag',
    'spVersion',
    'superPaymaster',
    'spImpl',
    'spImplCodehash',
    'superPaymasterLens',
    'xPNTsFactoryV2',
    'xPNTsTokenV2Impl',
    'xPNTsTokenV2Ext',
    'aoaProtocolRegistry',
    'globalTierSource',
    'aPNTsCapped',
    'readbackBlock',
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
    'superPaymaster', 'spImpl', 'superPaymasterLens', 'xPNTsFactoryV2', 'xPNTsTokenV2Impl',
    'xPNTsTokenV2Ext', 'aoaProtocolRegistry', 'globalTierSource', 'aPNTsCapped',
] as const;

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
    if (pins.spImplCodehash !== undefined && !/^0x[0-9a-fA-F]{64}$/.test(String(pins.spImplCodehash))) {
        problems.push(`spImplCodehash: not a 32-byte hash (${String(pins.spImplCodehash)})`);
    }
    if (pins.tag !== undefined && !isSp550ReleaseTag(pins.tag, opts)) {
        problems.push(`tag: ${JSON.stringify(pins.tag)} is not ${opts.allowRc ? 'v5.5.0 / v5.5.0-rc.N' : 'v5.5.0'}`);
    }
    if (pins.spVersion !== undefined && !(typeof pins.spVersion === 'string' && /^SuperPaymaster-5\.5\.\d+$/.test(pins.spVersion))) {
        problems.push(`spVersion: ${JSON.stringify(pins.spVersion)} is not a SuperPaymaster-5.5.x version() string`);
    }
    if (pins.readbackBlock !== undefined && !(typeof pins.readbackBlock === 'bigint' && pins.readbackBlock > 0n)) {
        problems.push(`readbackBlock: not a positive block number (${String(pins.readbackBlock)})`);
    }
    return problems;
}

/** Pins for a chain, or throw naming every missing or malformed field. */
export function requireSp550CutoverPins(
    chainId: number,
    pins = SP550_CUTOVER_PINS[chainId],
    opts: { allowRc?: boolean } = {},
): Required<Sp550CutoverPins> {
    const problems = sp550PinProblems(pins, opts);
    if (problems.length) {
        throw new Error(
            `SuperPaymaster 5.5.0 cutover pins for chain ${chainId} are not usable (${problems.join('; ')}). ` +
                `They are read back from the chain after the upgrade; until then the SDK must not use 5.5.0 addresses.`,
        );
    }
    return pins as Required<Sp550CutoverPins>;
}
