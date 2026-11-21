import { describe, expect, it } from 'vitest';
import { optimism, optimismSepolia, sepolia } from 'viem/chains';
import { CANONICAL_ADDRESSES } from './addresses.js';
import {
    sp550PinsFor, sp550NetworkPinProblems,
    SP550_ADDRESS_OWNER, SP550_FRESH_DEPLOY_PINS, SP550_FRESH_OPTIONAL_ADDRESS_KEYS, SP550_FRESH_REQUIRED_ADDRESS_KEYS, SP550_NETWORKS, SP550_RELEASE_HOLDS,
    assertSp550ChainId, requireSp550FreshDeployPins, resolveSp550Network, sp550FreshPinProblems,
} from './sp550Deployments.js';
import { sp550PinnedAddressEntries } from './sp550Cutover.js';

const A = (n: number) => ('0x' + n.toString(16).padStart(40, '0')) as `0x${string}`;
const BOOK = Object.fromEntries(SP550_FRESH_REQUIRED_ADDRESS_KEYS.map((k, i) => [k, A(100 + i)]));
const FULL = {
    tag: 'v5.5.0', spVersion: 'SuperPaymaster-5.5.1', superPaymaster: BOOK.superPaymaster, spImpl: A(1), spImplCodehash: ('0x' + 'ab'.repeat(32)) as `0x${string}`,
    superPaymasterLens: A(3), xPNTsFactoryV2: A(4), xPNTsTokenV2Impl: A(5), xPNTsTokenV2Ext: A(6),
    aoaProtocolRegistry: A(7), globalTierSource: A(8), aPNTsCapped: BOOK.aPNTs, readbackBlock: 12_000_000n,
    spAdminExtension: A(0xa), lensVersion: 'SuperPaymasterLens-1.2.2', registryImpl: A(0xb), disclosureRegistry: A(0xc),
    xPNTsFactoryV1: A(0xd), // the 3.x factory a fresh deploy keeps (X402Facilitator / GTokenAuthorization)
    // The book's aPNTs / xPNTsFactory are the aPNTsCapped / xPNTsFactoryV2 contracts (sp550FreshPinProblems).
    addresses: { ...BOOK, xPNTsFactory: A(4) } as Record<string, `0x${string}`>,
    absent: SP550_FRESH_OPTIONAL_ADDRESS_KEYS.filter((k) => k !== 'xPNTsFactory'),
};
// A codehash for every name that can be pinned: the top-level pieces and every SP-owned book key, so
// a test that adds an optional entry does not also have to add its hash.
Object.assign(FULL as any, { codehashes: Object.fromEntries([
    ...sp550PinnedAddressEntries({ ...FULL, addresses: {} } as any).map(([k]) => k),
    ...[...SP550_FRESH_REQUIRED_ADDRESS_KEYS, ...SP550_FRESH_OPTIONAL_ADDRESS_KEYS].map((k) => `addresses.${k}`),
].map((k, i) => [k, k === 'spImpl' ? FULL.spImplCodehash : '0x' + (i + 1).toString(16).padStart(2, '0').repeat(32)])) });
// A declared alias is one contract with one code: its book entry shares the top-level hash.
(FULL as any).codehashes['addresses.superPaymaster'] = (FULL as any).codehashes.superPaymaster;
(FULL as any).codehashes['addresses.aPNTs'] = (FULL as any).codehashes.aPNTsCapped;
(FULL as any).codehashes['addresses.xPNTsFactory'] = (FULL as any).codehashes.xPNTsFactoryV2;

describe('SP 5.5.0 network selection', () => {
    it('maps each network name to its viem chainId and deploy mode', () => {
        expect(resolveSp550Network('sepolia')).toEqual({ network: 'sepolia', chainId: sepolia.id, mode: 'upgrade', coexist: false, allowRc: false });
        expect(resolveSp550Network('sepolia-rc8')).toEqual({ network: 'sepolia-rc8', chainId: sepolia.id, mode: 'fresh', coexist: true, allowRc: true });
        expect(resolveSp550Network('op-sepolia')).toEqual({ network: 'op-sepolia', chainId: optimismSepolia.id, mode: 'fresh', coexist: false, allowRc: false });
        expect(resolveSp550Network('op-sepolia-rc8')).toEqual({ network: 'op-sepolia-rc8', chainId: optimismSepolia.id, mode: 'fresh', coexist: true, allowRc: true });
        expect(resolveSp550Network('op-mainnet')).toEqual({ network: 'op-mainnet', chainId: optimism.id, mode: 'fresh', coexist: false, allowRc: false });
    });
    it.each([undefined, '', 'optimism', 'mainnet', 'toString', '__proto__'])('refuses an unknown network name: %s', (n) => {
        expect(() => resolveSp550Network(n as any)).toThrow(/unknown SP 5.5.0 network/);
    });
    it('refuses an RPC whose chainId is not the selected network', () => {
        expect(() => assertSp550ChainId('op-mainnet', optimismSepolia.id)).toThrow(/expects chainId 10, but the RPC reports 11155420/);
        expect(() => assertSp550ChainId('op-sepolia', sepolia.id)).toThrow(/expects chainId 11155420/);
        expect(() => assertSp550ChainId('op-mainnet', optimism.id)).not.toThrow();
    });
    it('every fresh network has a (fail-closed) pin entry, and none is pre-wired but op-sepolia-rc8 (its read-back, 2026-11-21)', () => {
        for (const [name, n] of Object.entries(SP550_NETWORKS)) {
            if (n.mode !== 'fresh') continue;
            // A coexisting stack's entry is by network name (SP550_COEXIST_PINS), a chain's by chainId.
            const { pins } = sp550PinsFor(name as keyof typeof SP550_NETWORKS);
            if (name === 'op-sepolia-rc8') { expect(sp550NetworkPinProblems(name, pins).problems).toEqual([]); continue; }
            expect(pins).toEqual({});
            if (!n.coexist) expect(pins).toBe(SP550_FRESH_DEPLOY_PINS[n.chainId]);
            if (n.coexist) expect(sp550NetworkPinProblems(name as keyof typeof SP550_NETWORKS, pins).problems).toContain('addresses.registry: unpinned');
            // OP Sepolia also hosts op-sepolia-rc8, so its chain-keyed validator refuses the chain itself (FU-136).
            else if (n.chainId === optimismSepolia.id) expect(() => requireSp550FreshDeployPins(n.chainId, pins)).toThrow(/no chain-keyed fresh SP 5\.5\.0 stack/);
            else expect(() => requireSp550FreshDeployPins(n.chainId, pins)).toThrow(/addresses\.registry: unpinned/);
        }
    });
});

describe('SP 5.5.0 fresh-deploy pins fail closed', () => {
    it('every address-book key on the OP chains is classified (no key is silently left out)', () => {
        for (const id of [optimism.id, optimismSepolia.id]) {
            for (const k of Object.keys(CANONICAL_ADDRESSES[id])) expect(SP550_ADDRESS_OWNER).toHaveProperty(k);
        }
    });
    // OP Mainnet is the only chain-keyed fresh stack left (OP Sepolia hosts op-sepolia-rc8), so the unheld path is
    // exercised there with its hold lifted for the test.
    const withoutOpMainnetHold = <T>(fn: () => T): T => {
        const saved = SP550_RELEASE_HOLDS[optimism.id];
        delete SP550_RELEASE_HOLDS[optimism.id];
        try { return fn(); } finally { SP550_RELEASE_HOLDS[optimism.id] = saved; }
    };
    it('a complete set is returned when the chain has no hold', () => {
        expect(withoutOpMainnetHold(() => requireSp550FreshDeployPins(optimism.id, FULL))).toBe(FULL);
    });
    it('a chain that hosts a coexisting stack has no chain-keyed fresh stack: OP Sepolia (op-sepolia-rc8, FU-136)', () => {
        expect(() => requireSp550FreshDeployPins(optimismSepolia.id, FULL)).toThrow(/chain 11155420 has no chain-keyed fresh SP 5\.5\.0 stack/);
        expect(() => requireSp550FreshDeployPins(optimismSepolia.id, FULL, { allowRc: true })).toThrow(/no chain-keyed fresh SP 5\.5\.0 stack/);
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
            'aPNTs', 'blsAggregator', 'dvtValidator',
            'gToken', 'paymasterFactory', 'paymasterV4Impl', 'policyRegistry', 'registry', 'reputationSystem', 'sbt', 'staking',
            'superPaymaster', 'x402Facilitator',
        ]);
        // timelockController moved to optional with SP schema 543f3498 (a deployment may have none); the three ERC-8004
        // registries with DSR 2026-11-20 (the Sepolia rc.8 release deploys none: ENABLE_AGENT_REGISTRIES=0).
        expect([...SP550_FRESH_OPTIONAL_ADDRESS_KEYS].sort()).toEqual([
            'PNTsPaymasterV4', 'aPNTsPaymasterV4', 'agentIdentityRegistry', 'agentReputationRegistry', 'agentValidationRegistry',
            'blsValidator', 'microPaymentChannel', 'paymasterV4', 'pnts', 'timelockController', 'xPNTsFactory',
        ]);
        expect(SP550_ADDRESS_OWNER.agentRegistry).toBe('external');
    });
    it('the ERC-8004 registries validate both ways: pinned (with codehashes) or declared absent, never both', () => {
        const AGENT = ['agentIdentityRegistry', 'agentReputationRegistry', 'agentValidationRegistry'];
        expect(AGENT.every((k) => FULL.absent.includes(k as any))).toBe(true); // FULL declares them absent
        expect(sp550FreshPinProblems(FULL)).toEqual([]);
        const pinned = { ...FULL, addresses: { ...FULL.addresses, ...Object.fromEntries(AGENT.map((k, i) => [k, A(0x800 + i)])) },
            absent: FULL.absent.filter((k) => !AGENT.includes(k)) };
        expect(sp550FreshPinProblems(pinned)).toEqual([]);
        expect(sp550FreshPinProblems({ ...pinned, absent: [...pinned.absent, 'agentIdentityRegistry'] }))
            .toEqual(['addresses.agentIdentityRegistry: pinned and declared absent']);
    });
    it('every optional SP entry must be pinned or declared absent — none may just be left out', () => {
        const { absent: _a, ...noAbsent } = FULL;
        expect(sp550FreshPinProblems(noAbsent)).toEqual(
            SP550_FRESH_OPTIONAL_ADDRESS_KEYS.filter((k) => k !== 'xPNTsFactory').map((k) => `addresses.${k}: neither pinned nor declared absent`));
        const absent = FULL.absent.filter((k) => k !== 'pnts');
        expect(sp550FreshPinProblems({ ...FULL, absent })).toEqual(['addresses.pnts: neither pinned nor declared absent']);
        expect(sp550FreshPinProblems({ ...FULL, absent, addresses: { ...FULL.addresses, pnts: A(55) } })).toEqual([]);
    });
    it.each([
        ['pinned and absent', { addresses: { ...FULL.addresses, pnts: A(56) } }, /addresses\.pnts: pinned and declared absent/],
        ['absent required key', { absent: [...FULL.absent, 'registry'] }, /absent: registry is not an sp-optional key/],
        ['absent external key', { absent: [...FULL.absent, 'entryPoint'] }, /absent: entryPoint is not an sp-optional key/],
    ])('a bad absent declaration is refused: %s', (_n, patch, msg) => {
        expect(sp550FreshPinProblems({ ...FULL, ...(patch as any) })).toEqual([expect.stringMatching(msg)]);
    });
    it('one missing SP-owned address is enough to refuse', () => {
        const { registry: _drop, ...rest } = FULL.addresses;
        expect(sp550FreshPinProblems({ ...FULL, addresses: rest })).toEqual(['addresses.registry: unpinned']);
    });
    it('a missing 5.5.0 piece is refused as for an upgrade', () => {
        const { superPaymasterLens: _drop, ...rest } = FULL;
        expect(sp550FreshPinProblems(rest)).toEqual(['superPaymasterLens: unpinned']);
    });
    it.each([
        ['zero address', { registry: '0x0000000000000000000000000000000000000000' }, /addresses\.registry: not a non-zero address/],
        ['short address', { staking: '0x12' }, /addresses\.staking: not a non-zero address/],
        ['external key pinned from SP', { entryPoint: A(500) }, /addresses\.entryPoint: external/],
        ['unknown key', { notAKey: A(501) }, /addresses\.notAKey: not an address-book key/],
    ])('a bad book entry is refused: %s', (_n, patch, msg) => {
        expect(sp550FreshPinProblems({ ...FULL, addresses: { ...FULL.addresses, ...(patch as any) } })).toEqual([expect.stringMatching(msg)]);
    });
    it('an optional SP entry, when pinned, must be a real address', () => {
        expect(sp550FreshPinProblems(FULL)).toEqual([]);
        const absent = FULL.absent.filter((k) => k !== 'pnts');
        expect(sp550FreshPinProblems({ ...FULL, absent, addresses: { ...FULL.addresses, pnts: '0x0000000000000000000000000000000000000000' } }))
            .toEqual([expect.stringMatching(/addresses\.pnts: not a non-zero/)]);
    });
    it('the top-level proxy and the book must name the same SuperPaymaster', () => {
        expect(sp550FreshPinProblems({ ...FULL, superPaymaster: A(77) })).toEqual([expect.stringMatching(/!= addresses\.superPaymaster/)]);
    });
});

describe('declared aliases are one contract: one codehash (Grok on #433)', () => {
    it('superPaymaster / addresses.superPaymaster with two different codehash pins are refused', () => {
        expect(sp550FreshPinProblems(FULL)).toEqual([]);
        const pins: any = { ...FULL, codehashes: { ...(FULL as any).codehashes, 'addresses.superPaymaster': '0x' + '77'.repeat(32) } };
        expect(sp550FreshPinProblems(pins)).toEqual([expect.stringMatching(/codehashes\.superPaymaster .* != codehashes\.addresses\.superPaymaster .*one contract/)]);
    });
});

describe('requireSp550UpgradePins: the full upgrade rule set for consumers (Grok High)', async () => {
    const { requireSp550UpgradePins } = await import('./sp550Deployments.js');
    const { SP550_CERTIFIED_ADDRESS_KEYS } = await import('./sp550Cutover.js');
    const { requireSp550CutoverPins } = await import('./sp550Deployments.js');
    const book = Object.fromEntries(SP550_CERTIFIED_ADDRESS_KEYS.map((k, i) => [k, A(0x300 + i)]));
    const UP: any = { ...FULL, superPaymaster: A(0x2ff), addresses: book, absent: undefined };
    delete UP.absent;
    delete UP.xPNTsFactoryV1; // a fresh-only pin
    UP.codehashes = { ...Object.fromEntries(Object.entries((FULL as any).codehashes).filter(([k]) => !k.startsWith('addresses.') && k !== 'xPNTsFactoryV1')),
        ...Object.fromEntries(Object.keys(book).map((k, i) => [`addresses.${k}`, '0x' + (0x70 + i).toString(16).repeat(32)])) };
    it('a complete upgrade set passes both', () => {
        expect(requireSp550UpgradePins(11155111, UP, { allowRc: true })).toBe(UP);
        expect(requireSp550CutoverPins(11155111, UP, { allowRc: true })).toBe(UP);
    });
    it('a certified book entry without its codehash is refused by both', () => {
        const pins = { ...UP, codehashes: { ...UP.codehashes, 'addresses.registry': undefined } };
        expect(() => requireSp550CutoverPins(11155111, pins)).toThrow(/codehashes\.addresses\.registry: unpinned/);
        expect(() => requireSp550UpgradePins(11155111, pins)).toThrow(/codehashes\.addresses\.registry: unpinned/);
    });
    it('an external key in addresses is refused — by the public requireSp550CutoverPins too (Codex r7)', () => {
        const pins = { ...UP, addresses: { ...UP.addresses, entryPoint: A(0x77) }, codehashes: { ...UP.codehashes, 'addresses.entryPoint': '0x' + '77'.repeat(32) } };
        expect(() => requireSp550UpgradePins(11155111, pins)).toThrow(/addresses\.entryPoint: external/);
        expect(() => requireSp550CutoverPins(11155111, pins)).toThrow(/addresses\.entryPoint: external/);
    });
    it('an undeclared alias is refused by the public requireSp550CutoverPins', () => {
        const pins = { ...UP, globalTierSource: UP.aoaProtocolRegistry, codehashes: { ...UP.codehashes, globalTierSource: UP.codehashes.aoaProtocolRegistry } };
        expect(() => requireSp550CutoverPins(11155111, pins)).toThrow(/aoaProtocolRegistry and globalTierSource are the same address/);
    });
});

describe('validated getters accept a DisclosureRegistry declared absent (author 2026-11-12: 5.5.0 deploys none)', async () => {
    const { requireSp550UpgradePins } = await import('./sp550Deployments.js');
    const { SP550_CERTIFIED_ADDRESS_KEYS } = await import('./sp550Cutover.js');
    const drop = (p: any) => {
        const { disclosureRegistry: _d, ...rest } = p;
        const { disclosureRegistry: _h, ...codehashes } = p.codehashes;
        return { ...rest, codehashes, absent: [...(p.absent ?? []), 'disclosureRegistry'] };
    };
    it('fresh', () => {
        const pins = drop(FULL);
        const saved = SP550_RELEASE_HOLDS[optimism.id];
        delete SP550_RELEASE_HOLDS[optimism.id];
        let got;
        try { got = requireSp550FreshDeployPins(optimism.id, pins); } finally { SP550_RELEASE_HOLDS[optimism.id] = saved; }
        expect(got.disclosureRegistry).toBeUndefined();
        expect(got.absent).toContain('disclosureRegistry');
    });
    it('upgrade', () => {
        const book = Object.fromEntries(SP550_CERTIFIED_ADDRESS_KEYS.map((k, i) => [k, A(0x300 + i)]));
        const { absent: _a, xPNTsFactoryV1: _v1, ...up } = FULL as any; // xPNTsFactoryV1: a fresh-only pin
        up.superPaymaster = A(0x2ff);
        up.addresses = book;
        up.codehashes = { ...Object.fromEntries(Object.entries((FULL as any).codehashes).filter(([k]) => !k.startsWith('addresses.') && k !== 'xPNTsFactoryV1')),
            ...Object.fromEntries(Object.keys(book).map((k, i) => [`addresses.${k}`, '0x' + (0x70 + i).toString(16).repeat(32)])) };
        const pins = drop(up);
        expect(requireSp550UpgradePins(sepolia.id, pins, { allowRc: true }).disclosureRegistry).toBeUndefined();
    });
});
