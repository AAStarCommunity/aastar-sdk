import { describe, expect, it } from 'vitest';
import { optimism, optimismSepolia, sepolia } from 'viem/chains';
import { CANONICAL_ADDRESSES } from './addresses.js';
import {
    SP550_ADDRESS_OWNER, SP550_FRESH_DEPLOY_PINS, SP550_FRESH_OPTIONAL_ADDRESS_KEYS, SP550_FRESH_REQUIRED_ADDRESS_KEYS, SP550_NETWORKS, SP550_RELEASE_HOLDS,
    assertSp550ChainId, requireSp550FreshDeployPins, resolveSp550Network, sp550FreshPinProblems,
} from './sp550Deployments.js';

const A = (n: number) => ('0x' + n.toString(16).padStart(40, '0')) as `0x${string}`;
const BOOK = Object.fromEntries(SP550_FRESH_REQUIRED_ADDRESS_KEYS.map((k, i) => [k, A(100 + i)]));
const FULL = {
    tag: 'v5.5.0', superPaymaster: BOOK.superPaymaster, spImpl: A(1), spImplCodehash: ('0x' + 'ab'.repeat(32)) as `0x${string}`,
    superPaymasterLens: A(3), xPNTsFactoryV2: A(4), xPNTsTokenV2Impl: A(5), xPNTsTokenV2Ext: A(6),
    aoaProtocolRegistry: A(7), globalTierSource: A(8), aPNTsCapped: A(9), readbackBlock: 12_000_000n,
    addresses: BOOK,
    absent: [...SP550_FRESH_OPTIONAL_ADDRESS_KEYS],
};

describe('SP 5.5.0 network selection', () => {
    it('maps each network name to its viem chainId and deploy mode', () => {
        expect(resolveSp550Network('sepolia')).toEqual({ network: 'sepolia', chainId: sepolia.id, mode: 'upgrade' });
        expect(resolveSp550Network('op-sepolia')).toEqual({ network: 'op-sepolia', chainId: optimismSepolia.id, mode: 'fresh' });
        expect(resolveSp550Network('op-mainnet')).toEqual({ network: 'op-mainnet', chainId: optimism.id, mode: 'fresh' });
    });
    it.each([undefined, '', 'optimism', 'mainnet', 'toString', '__proto__'])('refuses an unknown network name: %s', (n) => {
        expect(() => resolveSp550Network(n as any)).toThrow(/unknown SP 5.5.0 network/);
    });
    it('refuses an RPC whose chainId is not the selected network', () => {
        expect(() => assertSp550ChainId('op-mainnet', optimismSepolia.id)).toThrow(/expects chainId 10, but the RPC reports 11155420/);
        expect(() => assertSp550ChainId('op-sepolia', sepolia.id)).toThrow(/expects chainId 11155420/);
        expect(() => assertSp550ChainId('op-mainnet', optimism.id)).not.toThrow();
    });
    it('every fresh network has a (fail-closed) pin entry, and none is pre-wired', () => {
        for (const n of Object.values(SP550_NETWORKS)) {
            if (n.mode !== 'fresh') continue;
            expect(SP550_FRESH_DEPLOY_PINS[n.chainId]).toEqual({});
            expect(() => requireSp550FreshDeployPins(n.chainId)).toThrow(/addresses\.registry: unpinned/);
        }
    });
});

describe('SP 5.5.0 fresh-deploy pins fail closed', () => {
    it('every address-book key on the OP chains is classified (no key is silently left out)', () => {
        for (const id of [optimism.id, optimismSepolia.id]) {
            for (const k of Object.keys(CANONICAL_ADDRESSES[id])) expect(SP550_ADDRESS_OWNER).toHaveProperty(k);
        }
    });
    it('a complete set is returned when the chain has no hold', () => {
        expect(requireSp550FreshDeployPins(optimismSepolia.id, FULL)).toBe(FULL);
    });
    it('OP Mainnet stays held even with complete pins, and no option lifts the hold', () => {
        expect(SP550_RELEASE_HOLDS[optimism.id]).toMatch(/3\.2\.2/);
        expect(() => requireSp550FreshDeployPins(optimism.id, FULL)).toThrow(/release hold: .*migrate\/sunset/);
        expect(() => requireSp550FreshDeployPins(optimism.id, FULL, { holds: {} } as any)).toThrow(/release hold/);
        expect(() => requireSp550FreshDeployPins(optimism.id, FULL, { allowRc: true })).toThrow(/release hold/);
    });
    it('the required/optional split is pinned here, not derived from the table it checks', () => {
        // A hand-kept expectation on purpose: flipping a key between sp and sp-optional (or to
        // external) must be a visible change to this test, reviewed with SP's manifest.
        expect([...SP550_FRESH_REQUIRED_ADDRESS_KEYS].sort()).toEqual([
            'aPNTs', 'agentIdentityRegistry', 'agentReputationRegistry', 'agentValidationRegistry', 'blsAggregator', 'dvtValidator',
            'gToken', 'paymasterFactory', 'paymasterV4Impl', 'policyRegistry', 'registry', 'reputationSystem', 'sbt', 'staking',
            'superPaymaster', 'timelockController', 'x402Facilitator',
        ]);
        expect([...SP550_FRESH_OPTIONAL_ADDRESS_KEYS].sort()).toEqual([
            'PNTsPaymasterV4', 'aPNTsPaymasterV4', 'blsValidator', 'microPaymentChannel', 'paymasterV4', 'pnts', 'xPNTsFactory',
        ]);
        expect(SP550_ADDRESS_OWNER.agentRegistry).toBe('external');
    });
    it('every optional SP entry must be pinned or declared absent — none may just be left out', () => {
        const { absent: _a, ...noAbsent } = FULL;
        expect(sp550FreshPinProblems(noAbsent)).toEqual(
            SP550_FRESH_OPTIONAL_ADDRESS_KEYS.map((k) => `addresses.${k}: neither pinned nor declared absent`));
        const absent = SP550_FRESH_OPTIONAL_ADDRESS_KEYS.filter((k) => k !== 'xPNTsFactory');
        expect(sp550FreshPinProblems({ ...FULL, absent })).toEqual(['addresses.xPNTsFactory: neither pinned nor declared absent']);
        expect(sp550FreshPinProblems({ ...FULL, absent, addresses: { ...BOOK, xPNTsFactory: A(55) } })).toEqual([]);
    });
    it.each([
        ['pinned and absent', { addresses: { ...BOOK, pnts: A(56) } }, /addresses\.pnts: pinned and declared absent/],
        ['absent required key', { absent: [...SP550_FRESH_OPTIONAL_ADDRESS_KEYS, 'registry'] }, /absent: registry is not an sp-optional key/],
        ['absent external key', { absent: [...SP550_FRESH_OPTIONAL_ADDRESS_KEYS, 'entryPoint'] }, /absent: entryPoint is not an sp-optional key/],
    ])('a bad absent declaration is refused: %s', (_n, patch, msg) => {
        expect(sp550FreshPinProblems({ ...FULL, ...(patch as any) })).toEqual([expect.stringMatching(msg)]);
    });
    it('one missing SP-owned address is enough to refuse', () => {
        const { registry: _drop, ...rest } = BOOK;
        expect(sp550FreshPinProblems({ ...FULL, addresses: rest })).toEqual(['addresses.registry: unpinned']);
    });
    it('a missing 5.5.0 piece is refused as for an upgrade', () => {
        const { superPaymasterLens: _drop, ...rest } = FULL;
        expect(sp550FreshPinProblems(rest)).toEqual(['superPaymasterLens: unpinned']);
    });
    it.each([
        ['zero address', { registry: '0x0000000000000000000000000000000000000000' }, /addresses\.registry: not a non-zero address/],
        ['short address', { staking: '0x12' }, /addresses\.staking: not a non-zero address/],
        ['external key pinned from SP', { entryPoint: A(5) }, /addresses\.entryPoint: external/],
        ['unknown key', { notAKey: A(5) }, /addresses\.notAKey: not an address-book key/],
    ])('a bad book entry is refused: %s', (_n, patch, msg) => {
        expect(sp550FreshPinProblems({ ...FULL, addresses: { ...BOOK, ...(patch as any) } })).toEqual([expect.stringMatching(msg)]);
    });
    it('an optional SP entry, when pinned, must be a real address', () => {
        expect(sp550FreshPinProblems(FULL)).toEqual([]);
        const absent = SP550_FRESH_OPTIONAL_ADDRESS_KEYS.filter((k) => k !== 'pnts');
        expect(sp550FreshPinProblems({ ...FULL, absent, addresses: { ...BOOK, pnts: '0x0000000000000000000000000000000000000000' } }))
            .toEqual([expect.stringMatching(/addresses\.pnts: not a non-zero/)]);
    });
    it('the top-level proxy and the book must name the same SuperPaymaster', () => {
        expect(sp550FreshPinProblems({ ...FULL, superPaymaster: A(77) })).toEqual([expect.stringMatching(/!= addresses\.superPaymaster/)]);
    });
});
