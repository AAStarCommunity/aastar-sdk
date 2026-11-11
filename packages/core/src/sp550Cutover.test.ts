import { describe, expect, it } from 'vitest';
import {
    SP550_CUTOVER_PINS, SP550_REQUIRED_PIN_FIELDS, isSp550ReleaseTag, missingSp550Pins, requireSp550CutoverPins, sp550PinProblems,
    sp550PinnedAddressEntries, SP550_CERTIFIED_ADDRESS_KEYS,
} from './sp550Cutover.js';

const A = (n: number) => ('0x' + n.toString(16).padStart(40, '0')) as `0x${string}`;
const FULL = {
    tag: 'v5.5.0', spVersion: 'SuperPaymaster-5.5.1', superPaymaster: '0x09DF0d2e3722EC0e401fE3819E64278a42ae4DE9', spImpl: A(1), spImplCodehash: ('0x' + 'ab'.repeat(32)) as `0x${string}`,
    superPaymasterLens: A(3), xPNTsFactoryV2: A(4), xPNTsTokenV2Impl: A(5), xPNTsTokenV2Ext: A(6),
    aoaProtocolRegistry: A(7), globalTierSource: A(8), aPNTsCapped: A(9), readbackBlock: 12_000_000n,
    spAdminExtension: A(0xa), lensVersion: 'SuperPaymasterLens-1.2.2', registryImpl: A(0xb), disclosureRegistry: A(0xc),
    addresses: Object.fromEntries(SP550_CERTIFIED_ADDRESS_KEYS.map((k, i) => [k, A(0x20 + i)])),
} as const;
/** A distinct hash per pinned address; spImpl's is spImplCodehash. */
const hashesFor = (pins: any) => Object.fromEntries(sp550PinnedAddressEntries(pins).filter(([, a]) => a !== undefined)
    .map(([k], i) => [k, k === 'spImpl' ? pins.spImplCodehash : ('0x' + (i + 1).toString(16).padStart(2, '0').repeat(32)) as `0x${string}`]));
Object.assign(FULL as any, { codehashes: hashesFor(FULL) });

describe('SP 5.5.0 cutover pins fail closed', () => {
    it('Sepolia is unpinned until the post-upgrade readback, so requiring it throws and names every field', () => {
        expect(missingSp550Pins(SP550_CUTOVER_PINS[11155111])).toEqual([...SP550_REQUIRED_PIN_FIELDS]);
        expect(() => requireSp550CutoverPins(11155111)).toThrow(/tag: unpinned; spVersion: unpinned; superPaymaster: unpinned; spImpl/);
    });
    it('a chain with no entry at all also fails closed', () => {
        expect(() => requireSp550CutoverPins(10)).toThrow(/chain 10/);
    });
    it('one missing field is enough to refuse', () => {
        const { aPNTsCapped: _drop, ...rest } = FULL;
        expect(missingSp550Pins(rest)).toEqual(['aPNTsCapped']);
        expect(() => requireSp550CutoverPins(1, rest)).toThrow(/aPNTsCapped: unpinned/);
    });
    it('a complete, well-formed set is returned as is', () => {
        expect(requireSp550CutoverPins(1, FULL)).toBe(FULL);
    });
    it.each([
        ['a hash for a name that is not a pin', { codehashes: { ...(FULL as any).codehashes, notAPin: '0x' + '11'.repeat(32) } }, /codehashes\.notAPin: no pinned address of that name/],
        ['a short hash', { codehashes: { ...(FULL as any).codehashes, superPaymasterLens: '0x12' } }, /codehashes\.superPaymasterLens: not a 32-byte hash/],
        ['codehashes.spImpl disagreeing with spImplCodehash', { codehashes: { ...(FULL as any).codehashes, spImpl: '0x' + 'cd'.repeat(32) } }, /codehashes\.spImpl 0xcdcd.* != spImplCodehash/],
        ['a pinned address with no hash', { codehashes: { ...(FULL as any).codehashes, aPNTsCapped: undefined } }, /codehashes\.aPNTsCapped: unpinned/],
    ])('codehashes are refused when malformed: %s', (_n, patch, msg) => {
        const pins: any = { ...FULL, ...patch };
        if (pins.codehashes.aPNTsCapped === undefined) delete pins.codehashes.aPNTsCapped;
        expect(sp550PinProblems(pins)).toEqual([expect.stringMatching(msg)]);
    });
    it.each([
        ['zero address', { spImpl: '0x0000000000000000000000000000000000000000' }, /spImpl: not a non-zero address/],
        ['short address', { superPaymasterLens: '0x3' }, /superPaymasterLens: not a non-zero address/],
        ['short codehash', { spImplCodehash: '0x2' }, /spImplCodehash: not a 32-byte hash/],
        ['rc tag without --allow-rc', { tag: 'v5.5.0-rc.4' }, /tag: "v5.5.0-rc.4" is not v5.5.0/],
        ['beta tag', { tag: 'v5.5.0-beta.1' }, /tag:/],
        ['other patch version', { tag: 'v5.5.99' }, /tag:/],
        ['trailing garbage', { tag: 'v5.5.0garbage' }, /tag:/],
        ['zero readback block', { readbackBlock: 0n }, /readbackBlock: not a positive/],
    ])('a malformed value is refused: %s', (_n, patch, msg) => {
        expect(sp550PinProblems({ ...FULL, ...(patch as any) })).toEqual([expect.stringMatching(msg)]);
    });
    it('rc tags are accepted only when explicitly allowed', () => {
        expect(isSp550ReleaseTag('v5.5.0-rc.4')).toBe(false);
        expect(isSp550ReleaseTag('v5.5.0-rc.4', { allowRc: true })).toBe(true);
        expect(isSp550ReleaseTag('v5.5.0-rc.x', { allowRc: true })).toBe(false);
    });
});
