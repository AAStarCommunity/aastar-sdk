import { describe, expect, it } from 'vitest';
import { SP550_CUTOVER_PINS, SP550_REQUIRED_PIN_FIELDS, missingSp550Pins, requireSp550CutoverPins } from './sp550Cutover.js';

const FULL = {
    tag: 'v5.5.0', superPaymaster: '0x09DF0d2e3722EC0e401fE3819E64278a42ae4DE9', spImpl: '0x1', spImplCodehash: '0x2',
    superPaymasterLens: '0x3', xPNTsFactoryV2: '0x4', xPNTsTokenV2Impl: '0x5', xPNTsTokenV2Ext: '0x6',
    aoaProtocolRegistry: '0x7', globalTierSource: '0x8', aPNTsCapped: '0x9', readbackBlock: 1n,
} as any;

describe('SP 5.5.0 cutover pins fail closed', () => {
    it('Sepolia is unpinned until the post-upgrade readback, so requiring it throws and names every field', () => {
        expect(missingSp550Pins(SP550_CUTOVER_PINS[11155111])).toEqual([...SP550_REQUIRED_PIN_FIELDS]);
        expect(() => requireSp550CutoverPins(11155111)).toThrow(/not filled \(tag, superPaymaster, spImpl/);
    });
    it('a chain with no entry at all also fails closed', () => {
        expect(() => requireSp550CutoverPins(10)).toThrow(/chain 10/);
    });
    it('one missing field is enough to refuse', () => {
        const { aPNTsCapped: _drop, ...rest } = FULL;
        expect(missingSp550Pins(rest)).toEqual(['aPNTsCapped']);
        expect(() => requireSp550CutoverPins(1, rest)).toThrow(/aPNTsCapped/);
    });
    it('a complete set is returned as is', () => {
        expect(requireSp550CutoverPins(1, FULL)).toBe(FULL);
    });
});
