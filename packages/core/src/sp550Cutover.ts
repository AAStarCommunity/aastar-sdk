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
import type { Address, Hex } from 'viem';

export interface Sp550CutoverPins {
    /** SuperPaymaster release tag the deployment was built from (e.g. "v5.5.0"). */
    tag?: string;
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

/** The missing required fields for a pin set (empty array = complete). */
export function missingSp550Pins(pins: Sp550CutoverPins | undefined): string[] {
    return SP550_REQUIRED_PIN_FIELDS.filter((k) => pins?.[k] === undefined || pins?.[k] === null || pins?.[k] === '');
}

/** Pins for a chain, or throw naming every field that is not pinned yet. */
export function requireSp550CutoverPins(chainId: number, pins = SP550_CUTOVER_PINS[chainId]): Required<Sp550CutoverPins> {
    const missing = missingSp550Pins(pins);
    if (missing.length) {
        throw new Error(
            `SuperPaymaster 5.5.0 cutover pins for chain ${chainId} are not filled (${missing.join(', ')}). ` +
                `They are read back from the chain after the upgrade; until then the SDK must not use 5.5.0 addresses.`,
        );
    }
    return pins as Required<Sp550CutoverPins>;
}
