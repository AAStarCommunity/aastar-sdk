import { describe, it, expect } from 'vitest';
import {
    SP550_READBACK_POLICY_RULE, SP550_TOOLING_DATA, SP550_TOOLING_FILES, SP550_TOOLING_PIN, SP550_TOOLING_RELEASE_VERSIONS,
    sp550ToolingProblems, sp550ToolingReleaseConfigKeys, type Sp550ToolingData,
} from './sp550Tooling.js';

const clone = (): Sp550ToolingData => JSON.parse(JSON.stringify(SP550_TOOLING_DATA));

describe('SP DeployLive read-back tooling data (Part B1)', () => {
    it('the vendored data is sound', () => {
        expect(sp550ToolingProblems()).toEqual([]);
    });

    it('pins the tooling commit (the #657 merge) and keeps the contracts on the tag', () => {
        expect(SP550_TOOLING_PIN.toolingCommit).toBe('12b5ef80d21a3191c62b69003e49ab06ef1c02b7');
        expect(SP550_TOOLING_PIN.contractsCommit).toBe('5a150f6ad43a6c6a57ccccea427c1dba0d797d06');
        // The intermediate commits of the read-back chain must not be pinned.
        expect(SP550_TOOLING_PIN.toolingCommit).not.toMatch(/^(fc33cfd3|698eeff1)/);
    });

    it('the derived release mapping equals the one SP stated (two independent sources)', () => {
        // SP, 2026-11-19 (21 keys -> deployed config key; GToken -> nothing). Registry / SuperPaymaster also via their proxy.
        const stated: Record<string, string[]> = {
            AOAProtocolRegistry: ['aoaProtocolRegistry'], APNTsCapped: ['aPNTs'], BLSAggregator: ['blsAggregator'],
            DVTValidator: ['dvtValidator'], GToken: [], GTokenAuthorization: ['gToken'], GTokenStaking: ['staking'],
            GlobalTierSource: ['globalTierSource'], MicroPaymentChannel: ['microPaymentChannel'], MySBT: ['sbt'],
            Paymaster: ['paymasterV4Impl'], PaymasterFactory: ['paymasterFactory'], PolicyRegistry: ['policyRegistry'],
            Registry: ['registry', 'registryImpl'], ReputationSystem: ['reputationSystem'],
            SuperPaymaster: ['spImpl', 'superPaymaster'], SuperPaymasterLens: ['superPaymasterLens'],
            X402Facilitator: ['x402Facilitator'], xPNTsFactory: ['xPNTsFactory'], xPNTsFactoryV2: ['xPNTsFactoryV2'],
            xPNTsToken: ['xPNTsTokenV1Impl'], xPNTsTokenV2: ['xPNTsTokenV2Impl'],
        };
        expect(sp550ToolingReleaseConfigKeys()).toEqual(stated);
        expect(Object.keys(SP550_TOOLING_RELEASE_VERSIONS)).toHaveLength(22);
    });

    it('every vendored file is listed with a 40-hex blob id and an upstream path at the tooling commit', () => {
        expect(Object.keys(SP550_TOOLING_FILES)).toHaveLength(15);
        for (const [f, v] of Object.entries(SP550_TOOLING_FILES)) {
            expect(v.gitBlob, f).toMatch(/^[0-9a-f]{40}$/);
            expect(v.upstream.endsWith(f), f).toBe(true);
        }
    });

    // Each check has a case only it catches.
    it.each<[string, (d: Sp550ToolingData) => void, RegExp]>([
        ['a changed policy rule (one character)', (d) => { d.policy.rule = SP550_READBACK_POLICY_RULE.replace('∩', '∪'); }, /rule is .* not the agreed text/],
        ['a changed policy schema', (d) => { d.policy.schema = 'readback-policy/2'; }, /readback-policy schema/],
        ['a runtime-pins file for one chain with another schema', (d) => { (d.runtimePins['31337'] as any).schema = 'runtime-pins/2'; }, /runtime-pins\.31337 schema/],
        ['a chain without external deps', (d) => { delete (d.externalDeps as any)['10']; }, /external-deps\.10 is not an object/],
        ['an artifact without a runtime pin on one chain', (d) => { delete (d.runtimePins['11155111'] as any).artifacts.MySBT; }, /maps sbt to MySBT, which has no runtime pin on chain 11155111/],
        ['an artifact without a policy getters section', (d) => { delete (d.policy.getters as any).MySBT; }, /no getters section for MySBT/],
        ['an artifact without an immutableBindings section', (d) => { delete (d.policy.immutableBindings as any).MySBT; }, /no immutableBindings section for MySBT/],
        ["a tag release value the tooling table disagrees with", (d) => { (d.toolingRelease as any).Registry = 'Registry-5.10.2'; }, /the tag's Registry="Registry-5\.10\.1" is "Registry-5\.10\.2"/],
        ['a tag release key the tooling table dropped', (d) => { delete (d.toolingRelease as any).APNTsCapped; }, /the tag's APNTsCapped/],
        ['a malformed release version', (d) => { (d.toolingRelease as any).MySBT = ''; }, /MySBT has a malformed version/],
        ['a release version with no number', (d) => { (d.toolingRelease as any).MySBT = 'MySBT-latest'; }, /MySBT has a malformed version/],
        ['a release version with a leading space', (d) => { (d.toolingRelease as any).MySBT = ' MySBT-3.2.0'; }, /MySBT has a malformed version/],
        ['a release key that maps nowhere and is not absent', (d) => { (d.toolingRelease as any).NewThing = 'NewThing-1.0.0'; }, /NewThing maps to no config key and is not listed absent/],
        ['an absent key that does map', (d) => { (d.releaseAbsent as any).MySBT = 'x'; }, /MySBT maps to sbt but is listed absent/],
        ['a stale absent entry', (d) => { delete (d.toolingRelease as any).GToken; }, /lists GToken, which the tooling release table no longer has/],
        ['a release key whose only config key is removed', (d) => { delete (d.artifacts as any).sbt; }, /MySBT maps to no config key/],
        ['a provider with a bare (non-dot-prefixed) suffix', (d) => { (d.providers as any).alchemy = ['alchemy.com']; }, /alchemy has a malformed suffix list/],
        ['a provider with no suffix', (d) => { (d.providers as any).infura = []; }, /infura has a malformed suffix list/],
        // Codex B1 r1 M3: proxy rows must really be proxies; a config key belongs to one release key.
        ['a proxy row whose proxy key is missing', (d) => { delete (d.artifacts as any).registry; }, /registry is undefined, not ERC1967Proxy/],
        ['a proxy key mapped to another artifact', (d) => { (d.artifacts as any).registry = 'MySBT'; }, /registry is "MySBT", not ERC1967Proxy/],
        ['an implementation key mapped to the proxy artifact', (d) => { (d.artifacts as any).spImpl = 'ERC1967Proxy'; }, /spImpl \(the implementation behind superPaymaster\) is "ERC1967Proxy"/],
        // A proxy key mapped straight to a release artifact is that artifact's row AND (through the proxy rule) its impl's.
        ['one config key versioned by two release keys', (d) => { (d.artifacts as any).registry = 'MySBT'; }, /config key registry is versioned by both (MySBT and Registry|Registry and MySBT)/],
        // Codex B1 r1 L2
        ['an absent key with an empty reason', (d) => { (d.releaseAbsent as any).GToken = ' '; }, /GToken has no reason/],
        // Codex B1 r1 M4: the fields B2 compares, and complete policy sections.
        ['a runtime pin replaced by {}', (d) => { (d.runtimePins['10'] as any).artifacts.MySBT = {}; }, /runtime-pins\.10 MySBT\.optimizerRuns is not a decimal string/],
        ['a runtime pin with a short masked keccak', (d) => { (d.runtimePins['10'] as any).artifacts.MySBT.maskedRuntimeKeccak = '0x12'; }, /MySBT\.maskedRuntimeKeccak is not a 32-byte hash/],
        ['hasImmutables disagreeing with the ranges', (d) => { (d.runtimePins['10'] as any).artifacts.SuperPaymaster.hasImmutables = false; }, /SuperPaymaster\.hasImmutables disagrees/],
        ['an immutable range with another length', (d) => { (d.runtimePins['10'] as any).artifacts.SuperPaymaster.immutableRanges[0].length = '20'; }, /SuperPaymaster\.immutableRanges\[0\] is malformed/],
        ['an immutable without a policy binding', (d) => { const r = (d.runtimePins['10'] as any).artifacts.SuperPaymaster.immutableRanges[0].name; delete (d.policy.immutableBindings as any).SuperPaymaster[r]; }, /immutableBindings\.SuperPaymaster has no entry for immutable/],
        ['a policy binding for no immutable (stale)', (d) => { (d.policy.immutableBindings as any).SuperPaymaster.NOT_AN_IMMUTABLE = { allowed: ['zero'], why: 'x' }; }, /NOT_AN_IMMUTABLE names no immutable of SuperPaymaster on chain 10 \(stale\)/],
        ['a binding with two kinds', (d) => { const b = (d.policy.immutableBindings as any).GTokenAuthorization._cap; b.allowed = ['zero']; }, /_cap has expectedUint \+ allowed binding kind|_cap has allowed \+ expectedUint binding kind/],
        ['an unbound with extra fields', (d) => { const bs = (d.policy.immutableBindings as any).APNTsCapped; const k = Object.keys(bs).find((n) => 'unbound' in bs[n])!; bs[k].why = 'x'; }, /must be exactly \{"unbound": "<reason>"\}/],
        ['a getter entry with an unknown label', (d) => { const gs = (d.policy.getters as any).MySBT; const g = Object.keys(gs)[0]; gs[g].allowed = ['config:*']; }, /getters\.MySBT\..*\.allowed is not a list of/],
        ['a getter entry with an unknown field', (d) => { const gs = (d.policy.getters as any).MySBT; const g = Object.keys(gs)[0]; gs[g].allowAll = true; }, /has unknown field\(s\) allowAll/],
        ['a getter entry without why', (d) => { const gs = (d.policy.getters as any).MySBT; const g = Object.keys(gs)[0]; delete gs[g].why; }, /getters\.MySBT\..* has no why/],
        ['a policy without zeroAllowedConfigKeys', (d) => { delete (d.policy as any).zeroAllowedConfigKeys; }, /readback-policy has no zeroAllowedConfigKeys object/],
        ['a policy without unreadableAllowed', (d) => { delete (d.policy as any).unreadableAllowed; }, /readback-policy has no unreadableAllowed object/],
        // Codex B1 r2 M1: coverage on every chain's pins, not only chain 10.
        ...(['11155111', '31337'] as const).map((c): [string, (d: Sp550ToolingData) => void, RegExp] => [`an immutable renamed only in chain ${c}'s pins`,
            (d) => { (d.runtimePins[c] as any).artifacts.SuperPaymaster.immutableRanges[0].name = 'RENAMED'; }, new RegExp(`has no entry for immutable RENAMED \\(chain ${c}\\)`)]),
        // Codex B1 r2 M2: ranges inside the code, sorted, not overlapping; empty code fails.
        ['a range past the end of the code', (d) => { (d.runtimePins['10'] as any).artifacts.SuperPaymaster.immutableRanges[0].start = '999999999'; }, /past runtimeLength/],
        ['a range ending one byte past the code', (d) => { const a = (d.runtimePins['10'] as any).artifacts.SuperPaymaster; const last = a.immutableRanges[a.immutableRanges.length - 1]; last.start = String(Number(a.runtimeLength) - 31); }, /past runtimeLength/],
        ['overlapping ranges', (d) => { const rs = (d.runtimePins['10'] as any).artifacts.SuperPaymaster.immutableRanges; rs[1].start = String(Number(rs[0].start) + 16); }, /before the previous range ends.*unsorted or overlapping/],
        ['a zero runtime length', (d) => { (d.runtimePins['10'] as any).artifacts.MySBT.runtimeLength = '0'; }, /MySBT\.runtimeLength is 0/],
        // Codex B1 r2 L1: emptyAllowed is a boolean (false is valid; only true grants).
        // Codex B1 r3 M2: compiler provenance and per-artifact optimizer runs.
        ['a runtime-pins file with no compiler', (d) => { delete (d.runtimePins['10'] as any).compiler; }, /runtime-pins\.10 compiler is undefined, not the release build/],
        ['another solc', (d) => { (d.runtimePins['11155111'] as any).compiler.solc = '0.4.0'; }, /runtime-pins\.11155111 compiler is .*0\.4\.0/],
        ['viaIR off', (d) => { (d.runtimePins['31337'] as any).compiler.viaIR = false; }, /runtime-pins\.31337 compiler is/],
        ['an extra compiler field', (d) => { (d.runtimePins['10'] as any).compiler.optimizer = true; }, /runtime-pins\.10 compiler is/],
        ['Registry at 500 runs', (d) => { (d.runtimePins['10'] as any).artifacts.Registry.optimizerRuns = '500'; }, /Registry\.optimizerRuns is "500", not the release build's 200/],
        ['SuperPaymaster at 200 runs', (d) => { (d.runtimePins['10'] as any).artifacts.SuperPaymaster.optimizerRuns = '200'; }, /SuperPaymaster\.optimizerRuns is "200", not the release build's 500/],
        // Codex B1 r3 L2: unreadableAllowed entries.
        ['an unreadableAllowed entry with a non-string reason', (d) => { (d.policy as any).unreadableAllowed = { MySBT: { owner: 42 } }; }, /unreadableAllowed\.MySBT\.owner has no reason/],
        ['an unreadableAllowed artifact that is not an object', (d) => { (d.policy as any).unreadableAllowed = { MySBT: 'x' }; }, /unreadableAllowed\.MySBT is not an object/],
        ['a non-boolean emptyAllowed', (d) => { (d.policy.getters as any).Paymaster.getSupportedTokens.emptyAllowed = 'yes'; }, /emptyAllowed is present but not a boolean/],
    ])('%s fails', (_l, mutate, why) => {
        const d = clone();
        mutate(d);
        expect(sp550ToolingProblems(d)).toEqual(expect.arrayContaining([expect.stringMatching(why)]));
    });

    it('a range exactly at the end of the code passes; emptyAllowed: false is a valid policy entry (Codex B1 r2 M2 / L1)', () => {
        const d = clone();
        const a = (d.runtimePins['10'] as any).artifacts.SuperPaymaster;
        const last = a.immutableRanges[a.immutableRanges.length - 1];
        // Moving the last range to end exactly at runtimeLength is in bounds (it may now collide with nothing before it).
        last.start = String(Number(a.runtimeLength) - 32);
        expect(sp550ToolingProblems(d).filter((x) => /past runtimeLength/.test(x))).toEqual([]);
        const e = clone();
        (e.policy.getters as any).Paymaster.getSupportedTokens.emptyAllowed = false;
        expect(sp550ToolingProblems(e)).toEqual([]);
    });
    it('malformed structures are reported, not thrown (Codex B1 r2 L2)', () => {
        const d = clone(); (d.policy as any).getters = null;
        expect(() => sp550ToolingProblems(d)).not.toThrow();
        expect(sp550ToolingProblems(d)).toEqual(expect.arrayContaining([expect.stringMatching(/readback-policy has no getters object/)]));
        const e = clone(); (e.runtimePins['10'] as any).artifacts.SuperPaymaster.immutableRanges[0] = null;
        expect(() => sp550ToolingProblems(e)).not.toThrow();
        expect(sp550ToolingProblems(e)).toEqual(expect.arrayContaining([expect.stringMatching(/SuperPaymaster\.immutableRanges\[0\] is malformed/)]));
        const f = clone(); (f.runtimePins['31337'] as any).artifacts = null;
        expect(() => sp550ToolingProblems(f)).not.toThrow();
    });
});
