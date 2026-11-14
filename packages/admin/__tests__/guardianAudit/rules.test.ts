import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getAddress, keccak256, sha256, stringToBytes, toFunctionSelector, type Hex } from 'viem';
import { canonicalJson } from '../../src/guardianAudit/canonical';
import {
    DEFAULT_FACT_KINDS, DEFAULT_RULESET, FACT_KINDS, RULESET_SCHEMA, SYMBOL_RE, ambiguousEvents,
    classifierRulesetSha256, evaluate, matchGeneric, rulesetId, rulesetRuleIds, validateRuleset, wantsPrice,
    type FactKind, type FactKindMap, type RuleRecord, type Ruleset,
} from '../../src/guardianAudit/rules';

const SP = '0x2222222222222222222222222222222222222222';
const OTHER = '0x3333333333333333333333333333333333333333';
const roles = { superPaymaster: getAddress(SP) };
const priceSig = 'updatePriceDVT(int256,uint256,bytes,uint8)';
const priceSel = toFunctionSelector(priceSig);
const priceCall = `${priceSel}${'ab'.repeat(16)}`;

function bls(kind: string | undefined, fields?: RuleRecord['fields']): RuleRecord {
    return fields ? { route: 'bls', kind, fields } : { route: 'bls', kind };
}

describe('guardian-audit ruleset (unit, not acceptance)', () => {
    it('uses the same 4-byte selector as keccak256 of the signature', () => {
        expect(priceSel).toBe(keccak256(stringToBytes(priceSig)).slice(0, 10));
        expect(toFunctionSelector('updatePrice()')).toBe(keccak256(stringToBytes('updatePrice()')).slice(0, 10));
    });

    it('flags SLASH, REPUTATION, and QUEUE', () => {
        expect(evaluate(DEFAULT_RULESET, roles, bls('SLASH'))).toEqual({
            flagged: true,
            reasons: ['BLS operator slash executed (impossible through DVTValidator in 5.5.0: empty evidence allowlist; so this came by the owner route)'],
            rule: 'bls.SLASH',
        });
        expect(evaluate(DEFAULT_RULESET, roles, bls('REPUTATION'))).toEqual({
            flagged: true,
            reasons: ['BLS reputation batch (5.5.0 does no reputation scoring)'],
            rule: 'bls.REPUTATION',
        });
        expect(evaluate(DEFAULT_RULESET, roles, bls('QUEUE'))).toEqual({
            flagged: true,
            reasons: ['operator frozen by a guardian quorum (queueSlashWithConsensus)'],
            rule: 'bls.QUEUE',
        });
    });

    it('flags an expected GENERIC price update and an unexpected GENERIC call', () => {
        const expected = evaluate(DEFAULT_RULESET, { superPaymaster: `0x${SP.slice(2).toUpperCase()}` }, bls('GENERIC', {
            target: getAddress(SP),
            callData: `0x${priceCall.slice(2).toUpperCase()}`,
        }));
        expect(expected).toEqual({
            flagged: true,
            reasons: ['BLS price update: threshold is caller-chosen (>= minThreshold); SP caps each update but not a chain of updates'],
            rule: `bls.GENERIC.expected:superPaymaster.${priceSig}`,
        });
        expect(wantsPrice(DEFAULT_RULESET, roles, bls('GENERIC', { target: SP, callData: priceCall }))).toBe(true);

        const wrongTarget = evaluate(DEFAULT_RULESET, roles, bls('GENERIC', { target: OTHER, callData: priceCall }));
        expect(wrongTarget).toEqual({
            flagged: true,
            reasons: ['generic BLS call outside the expected target/selector set'],
            rule: 'bls.GENERIC.unexpected',
        });
        const wrongSel = evaluate(DEFAULT_RULESET, roles, bls('GENERIC', { target: SP, callData: '0xdeadbeef' }));
        expect(wrongSel.rule).toBe('bls.GENERIC.unexpected');
        const shortData = evaluate(DEFAULT_RULESET, roles, bls('GENERIC', { target: SP, callData: '0x1234' }));
        expect(shortData.rule).toBe('bls.GENERIC.unexpected');
        expect(wantsPrice(DEFAULT_RULESET, roles, bls('GENERIC', { target: OTHER, callData: priceCall }))).toBe(false);
    });

    it('flags UNRECOVERED when the BLS kind is missing', () => {
        expect(evaluate(DEFAULT_RULESET, roles, { route: 'bls' })).toEqual({
            flagged: true,
            reasons: ['BLS-executed action whose message could not be authenticated from the transaction'],
            rule: 'bls.UNRECOVERED',
        });
    });

    it('flags a listed owner event and an unlisted owner event', () => {
        expect(evaluate(DEFAULT_RULESET, roles, { route: 'owner', event: 'PriceUpdated' })).toEqual({
            flagged: true,
            reasons: ['owner/guardian route: not BLS, no on-chain signer verification: PriceUpdated'],
            rule: 'ownerRoute.events.PriceUpdated',
        });
        expect(evaluate(DEFAULT_RULESET, roles, { route: 'owner', event: 'NotAnEvent' })).toEqual({
            flagged: true,
            reasons: ['unlisted SuperPaymaster event NotAnEvent'],
            rule: 'ownerRoute.unlisted',
        });
        expect(wantsPrice(DEFAULT_RULESET, roles, { route: 'owner', event: 'PriceUpdated' })).toBe(true);
        expect(wantsPrice(DEFAULT_RULESET, roles, { route: 'owner', event: 'GuardianSet' })).toBe(false);
    });

    it('records a listed permissionless call and flags flagIfCallAlsoEmits', () => {
        const update = toFunctionSelector('updatePrice()');
        const quiet = evaluate(DEFAULT_RULESET, roles, {
            route: 'public',
            selector: update.toUpperCase() as Hex,
            event: 'PriceUpdated',
            callEvents: ['PriceUpdated'],
        });
        expect(quiet).toEqual({
            flagged: false,
            reasons: ['permissionless call: caller recorded, not accused: updatePrice(): routine permissionless price refresh (Chainlink)'],
            rule: 'publicRoute.functions.updatePrice()',
        });
        const also = evaluate(DEFAULT_RULESET, roles, {
            route: 'public',
            selector: update,
            event: 'PriceUpdated',
            callEvents: ['EmergencyPriceCancelled', 'PriceModeChanged'],
        });
        expect(also).toEqual({
            flagged: true,
            reasons: ['price mode changed via permissionless refresh (caller not accused): PriceModeChanged, EmergencyPriceCancelled'],
            rule: 'publicRoute.functions.updatePrice().also',
        });
        const emergency = evaluate(DEFAULT_RULESET, roles, {
            route: 'public',
            selector: toFunctionSelector('executeEmergencyPrice()'),
            event: 'EmergencyPriceExecuted',
            callEvents: ['EmergencyPriceExecuted'],
        });
        expect(emergency).toEqual({
            flagged: true,
            reasons: ['permissionless call: caller recorded, not accused: executeEmergencyPrice(): permissionless execution of an owner-queued emergency price (caller not accused)'],
            rule: 'publicRoute.functions.executeEmergencyPrice()',
        });
        const pause = evaluate(DEFAULT_RULESET, roles, {
            route: 'public',
            selector: toFunctionSelector('pauseUnderstakedOperator(address)'),
            event: 'OperatorPaused',
            callEvents: ['OperatorPaused'],
        });
        expect(pause).toEqual({
            flagged: false,
            reasons: ['permissionless call: caller recorded, not accused: pauseUnderstakedOperator(address): permissionless pause of an understaked operator (routine; W3)'],
            rule: 'publicRoute.functions.pauseUnderstakedOperator(address)',
        });
        expect(wantsPrice(DEFAULT_RULESET, roles, { route: 'public', selector: update })).toBe(true);
        expect(() => wantsPrice(DEFAULT_RULESET, null as unknown as Record<string, string>, { route: 'invalid' } as RuleRecord)).toThrow(/^record: unknown route$/);
        expect(() => evaluate(DEFAULT_RULESET, null as unknown as Record<string, string>, { route: 'invalid' } as RuleRecord)).toThrow(/^record: unknown route$/);
        expect(wantsPrice(DEFAULT_RULESET, roles, { route: 'public', selector: toFunctionSelector('pauseUnderstakedOperator(address)') })).toBe(false);
    });

    it('flags updatePrice PriceModeChanged when callEvents omits that event', () => {
        const update = toFunctionSelector('updatePrice()');
        const base = { route: 'public' as const, selector: update, event: 'PriceModeChanged' };
        const cases: Array<RuleRecord> = [
            base,
            { ...base, callEvents: [] },
            { ...base, callEvents: ['OperatorSlashed'] },
            { route: 'public', selector: update },
        ];
        const verdicts = cases.map((record) => evaluate(DEFAULT_RULESET, roles, record));
        expect(verdicts.map((verdict) => verdict.flagged)).toEqual([true, true, true, true]);
        expect(verdicts[0]).toEqual({
            flagged: true,
            reasons: ['price mode changed via permissionless refresh (caller not accused): PriceModeChanged'],
            rule: 'publicRoute.functions.updatePrice().also',
        });
        expect(verdicts[1]).toEqual(verdicts[0]);
        expect(verdicts[2]).toEqual(verdicts[0]);
        expect(verdicts[3]).toEqual({
            flagged: true,
            reasons: ['public route event is not listed for this function'],
            rule: 'publicRoute.event',
        });
    });

    it('flags a public event the function does not emit', () => {
        expect(evaluate(DEFAULT_RULESET, roles, {
            route: 'public',
            selector: toFunctionSelector('updatePrice()'),
            event: 'OperatorSlashed',
            callEvents: [],
        })).toEqual({
            flagged: true,
            reasons: ['public route event is not listed for this function'],
            rule: 'publicRoute.event',
        });
    });

    it('replaces an over-long synthesized also-reason with a fixed reason', () => {
        const rs = structuredClone(DEFAULT_RULESET);
        const fn = rs.publicRoute.functions['updatePrice()']!;
        const names = Array.from({ length: 64 }, (_, i) => `E${String(i).padStart(63, '0')}`);
        fn.events = names;
        fn.flag = false;
        fn.flagIfCallAlsoEmits = names;
        fn.alsoReason = 'A'.repeat(1024);
        const verdict = evaluate(rs, roles, {
            route: 'public',
            selector: toFunctionSelector('updatePrice()'),
            event: names[0],
            callEvents: names,
        });
        expect(verdict).toEqual({
            flagged: true,
            reasons: ['verdict reason too long'],
            rule: 'publicRoute.functions.updatePrice().also',
        });
        expect(verdict.reasons[0]).not.toContain('A'.repeat(32));
    });

    it('flags an unlisted public selector and an unattributed event', () => {
        expect(evaluate(DEFAULT_RULESET, roles, { route: 'public', selector: '0xdeadbeef' })).toEqual({
            flagged: true,
            reasons: ['public route without a listed function'],
            rule: 'publicRoute.unlisted',
        });
        expect(evaluate(DEFAULT_RULESET, roles, { route: 'unattributed', event: 'PriceUpdated' })).toEqual({
            flagged: true,
            reasons: ['SuperPaymaster event that a permissionless function can also emit, whose emitting call could not be determined after every retry (not attributed to anyone): PriceUpdated'],
            rule: 'publicRoute.unattributed',
        });
        const ambiguous = ambiguousEvents(DEFAULT_RULESET);
        expect(ambiguous.has('PriceUpdated')).toBe(true);
        expect(ambiguous.has('OperatorPaused')).toBe(true);
        expect(ambiguous.has('SlashQueued')).toBe(false);
        expect(wantsPrice(DEFAULT_RULESET, roles, { route: 'unattributed', event: 'PriceUpdated' })).toBe(true);
    });

    it('rejects the DVT schema id, unknown keys, and a missing section', () => {
        expect(() => validateRuleset({ ...DEFAULT_RULESET, schema: 'dvt.guardian-watcher.ruleset.v1' })).toThrow(/unknown schema/);
        try {
            validateRuleset({ ...DEFAULT_RULESET, extra: true });
            throw new Error('accepted an extra key');
        } catch (e) {
            expect((e as Error).message).toBe('ruleset: unknown key');
            expect((e as Error).message).not.toContain('extra');
        }
        const missing = JSON.parse(JSON.stringify(DEFAULT_RULESET)) as typeof DEFAULT_RULESET;
        delete (missing.bls as { QUEUE?: unknown }).QUEUE;
        expect(() => validateRuleset(missing)).toThrow(/bls\.QUEUE missing/);
        const noPublic = JSON.parse(JSON.stringify(DEFAULT_RULESET)) as { publicRoute?: unknown };
        delete noPublic.publicRoute;
        expect(() => validateRuleset(noPublic)).toThrow(/publicRoute missing/);
        const badFn = JSON.parse(JSON.stringify(DEFAULT_RULESET));
        delete badFn.publicRoute.functions['updatePrice()'].reason;
        expect(() => validateRuleset(badFn)).toThrow(/^ruleset: publicRoute\.functions\.reason invalid$/);
        const noAlso = JSON.parse(JSON.stringify(DEFAULT_RULESET));
        delete noAlso.publicRoute.functions['updatePrice()'].alsoReason;
        expect(() => validateRuleset(noAlso)).toThrow(/^ruleset: alsoReason missing$/);
    });

    it('rejects unknown keys in every section and requires the source object', () => {
        const clone = () => JSON.parse(JSON.stringify(DEFAULT_RULESET));
        const reject = (body: () => void, message: string, absent: string[]): void => {
            try {
                body();
                throw new Error(`accepted ${message}`);
            } catch (e) {
                expect((e as Error).message).toBe(message);
                for (const word of absent) expect((e as Error).message).not.toContain(word);
            }
        };
        const slash = clone();
        slash.bls.SLASH.note = true;
        reject(() => validateRuleset(slash), 'ruleset: unknown key in bls.SLASH', ['note']);
        const expected = clone();
        expected.bls.GENERIC.expected[0].note = true;
        reject(() => validateRuleset(expected), 'ruleset: unknown key in bls.GENERIC.expected', ['note']);
        const unexpected = clone();
        unexpected.bls.GENERIC.unexpected.note = true;
        reject(() => validateRuleset(unexpected), 'ruleset: unknown key in bls.GENERIC.unexpected', ['note']);
        const generic = clone();
        generic.bls.GENERIC.note = true;
        reject(() => validateRuleset(generic), 'ruleset: unknown key in bls.GENERIC', ['note']);
        const event = clone();
        event.ownerRoute.events.PriceUpdated.note = true;
        reject(() => validateRuleset(event), 'ruleset: unknown key in ownerRoute.events', ['note', 'PriceUpdated']);
        const owner = clone();
        owner.ownerRoute.note = true;
        reject(() => validateRuleset(owner), 'ruleset: unknown key in ownerRoute', ['note']);
        const fn = clone();
        fn.publicRoute.functions['updatePrice()'].note = true;
        reject(() => validateRuleset(fn), 'ruleset: unknown key in publicRoute.functions', ['note', 'updatePrice']);
        const pub = clone();
        pub.publicRoute.note = true;
        reject(() => validateRuleset(pub), 'ruleset: unknown key in publicRoute', ['note']);
        const unattributed = clone();
        unattributed.publicRoute.unattributed.note = true;
        reject(() => validateRuleset(unattributed), 'ruleset: unknown key in publicRoute.unattributed', ['note']);
        const noSource = clone();
        delete noSource.source;
        expect(() => validateRuleset(noSource)).toThrow(/source missing/);
        const stringSource = clone();
        stringSource.source = 'ported from somewhere';
        expect(() => validateRuleset(stringSource)).toThrow(/source missing/);
        const shortSource = clone();
        delete shortSource.source.sha256;
        expect(() => validateRuleset(shortSource)).toThrow(/source\.sha256 missing/);
        const extraSource = clone();
        extraSource.source.extra = 'no';
        reject(() => validateRuleset(extraSource), 'ruleset: unknown key in source', ['extra']);
    });

    it('pins the default ruleset digest as a regression detector', () => {
        const validated = validateRuleset(DEFAULT_RULESET);
        expect(validated).not.toBe(DEFAULT_RULESET);
        expect(validated).toEqual(DEFAULT_RULESET);
        expect(Object.getPrototypeOf(validated)).toBe(null);
        expect(Object.getPrototypeOf(validated.bls)).toBe(null);
        expect(Object.isFrozen(validated)).toBe(true);
        expect(Object.isFrozen(validated.source)).toBe(true);
        expect(Object.isFrozen(DEFAULT_RULESET)).toBe(true);
        expect(Object.isFrozen(DEFAULT_RULESET.source)).toBe(true);
        expect(Object.isFrozen(DEFAULT_RULESET.bls)).toBe(true);
        expect(() => { DEFAULT_RULESET.comment = 'mutated'; }).toThrow();
        expect(DEFAULT_RULESET.schema).toBe('aastar.guardian-audit.ruleset.v1');
        expect(DEFAULT_RULESET.source).toEqual({
            repo: 'AAStarCommunity/YetAnotherAA-Validator',
            tag: 'archive/guardian-watcher-w2-2026-11-12',
            commit: '8a7cda74d99097b3f5c4337f31bd3225d6cd02e1',
            path: 'services/guardian-watcher/ruleset.json',
            sha256: '0x18593eb0b9d6603cbd0f59669cafb49cf5c7359e67025583d34b80cce497227b',
        });
        const id = rulesetId(DEFAULT_RULESET);
        expect(id.schema).toBe('aastar.guardian-audit.ruleset.v1');
        // Changing any rule text, comment, or source field changes this digest.
        expect(id.digest).toBe('0x955722cbb9d0467aef9bdebc2880dd3d97af87c824978cff4a9498367eb429a4');
    });

    it('rejects a non-boolean flag, an oversized section, a bad signature, and a leaked address', () => {
        const flagged = structuredClone(DEFAULT_RULESET);
        (flagged.publicRoute.functions['updatePrice()'] as { flag: unknown }).flag = 'false';
        expect(() => validateRuleset(flagged)).toThrow(/flag must be boolean/);

        const noReason = structuredClone(DEFAULT_RULESET);
        delete (noReason.bls.SLASH as { reason?: string }).reason;
        expect(() => validateRuleset(noReason)).toThrow(/bls\.SLASH\.reason invalid/);

        const wide = structuredClone(DEFAULT_RULESET);
        for (let i = 0; i < 50; i++) wide.ownerRoute.events[`E${i}`] = { flag: true };
        expect(() => validateRuleset(wide)).toThrow(/too large/);
        const many = structuredClone(DEFAULT_RULESET);
        const one = many.bls.GENERIC.expected[0]!;
        many.bls.GENERIC.expected = Array.from({ length: 65 }, () => ({ ...one }));
        expect(() => validateRuleset(many)).toThrow(/too large/);

        const badSig = structuredClone(DEFAULT_RULESET);
        badSig.bls.GENERIC.expected[0]!.signature = 'not a signature';
        expect(() => validateRuleset(badSig)).toThrow(/^ruleset: bad signature$/);

        const leaked = structuredClone(DEFAULT_RULESET) as unknown as Record<string, unknown>;
        leaked['https://evil.example/key'] = true;
        expect(() => validateRuleset(leaked)).toThrow(/^ruleset: invalid key$/);
        const sourced = structuredClone(DEFAULT_RULESET);
        sourced.source.repo = 'https://evil.example/repo';
        expect(() => validateRuleset(sourced)).toThrow(/source\.repo invalid/);

        expect(() => evaluate(DEFAULT_RULESET, roles, { route: 'PUBLIC' as 'bls' })).toThrow(/unknown route/);
        expect(() => evaluate(DEFAULT_RULESET, { superPaymaster: 'https://rpc.example/v3/secret' }, bls('GENERIC', {
            target: SP, callData: priceCall,
        }))).toThrow(/^role address is invalid$/);
        const badRole = `0x${'z'.repeat(40)}`;
        try {
            evaluate(DEFAULT_RULESET, { superPaymaster: badRole }, bls('GENERIC', { target: SP, callData: priceCall }));
            throw new Error('accepted a bad role address');
        } catch (e) {
            expect((e as Error).message).toBe('role address is invalid');
            expect((e as Error).message).not.toContain(badRole);
        }
        expect(evaluate(DEFAULT_RULESET, roles, bls('GENERIC', {
            target: 'https://rpc.example/v3/secret', callData: priceCall,
        })).rule).toBe('bls.GENERIC.unexpected');
        expect(() => evaluate(DEFAULT_RULESET, roles, {
            route: 'owner', event: `https://evil.example/${'a'.repeat(40)}`,
        })).toThrow(/^record: event is not a short string$/);
        expect(() => evaluate(DEFAULT_RULESET, roles, {
            route: 'public',
            selector: toFunctionSelector('updatePrice()'),
            callEvents: Array.from({ length: 65 }, () => 'PriceUpdated'),
        })).toThrow(/callEvents too large/);
    });

    it('treats prototype names as unlisted or unknown', () => {
        for (const name of ['constructor', 'toString']) {
            const owner = evaluate(DEFAULT_RULESET, roles, { route: 'owner', event: name });
            expect(owner.flagged).toBe(true);
            expect(owner.rule).toBe('ownerRoute.unlisted');
            const kind = evaluate(DEFAULT_RULESET, roles, { route: 'bls', kind: name });
            expect(kind.flagged).toBe(true);
            expect(kind.rule).toBe('bls.unknown');
            const custom = structuredClone(DEFAULT_RULESET);
            custom.bls.GENERIC.expected[0]!.target = name;
            expect(matchGeneric(custom, roles, SP, priceCall)).toBeNull();
            expect(evaluate(custom, roles, bls('GENERIC', { target: SP, callData: priceCall })).rule).toBe('bls.GENERIC.unexpected');
        }
        expect(() => evaluate(DEFAULT_RULESET, roles, { route: 'owner', event: '__proto__' })).toThrow(/^record: event is not a short string$/);
        expect(() => evaluate(DEFAULT_RULESET, roles, { route: 'bls', kind: '__proto__' })).toThrow(/^record: kind is not a short string$/);
        const proto = structuredClone(DEFAULT_RULESET);
        proto.bls.GENERIC.expected[0]!.target = '__proto__';
        expect(() => validateRuleset(proto)).toThrow(/^ruleset: bls\.GENERIC\.expected\.target invalid$/);
    });

    it('requires an event on the unattributed route and rejects a duplicate selector', () => {
        expect(() => evaluate(DEFAULT_RULESET, roles, { route: 'unattributed' })).toThrow(/^record: event is not a short string$/);
        try {
            evaluate(DEFAULT_RULESET, roles, { route: 'unattributed' });
        } catch (e) {
            expect((e as Error).message).not.toContain('undefined');
        }
        const dup = structuredClone(DEFAULT_RULESET);
        dup.publicRoute.functions['updatePrice( )'] = structuredClone(dup.publicRoute.functions['updatePrice()']!);
        expect(() => validateRuleset(dup)).toThrow(/^ruleset: duplicate selector$/);
        const missingRole = structuredClone(DEFAULT_RULESET);
        missingRole.bls.GENERIC.expected[0]!.target = 'noSuchRole';
        expect(matchGeneric(missingRole, roles, SP, priceCall)).toBeNull();
        expect(evaluate(missingRole, roles, bls('GENERIC', { target: SP, callData: priceCall })).rule).toBe('bls.GENERIC.unexpected');
    });

    it('matches the pinned DVT ruleset bytes, with only schema replaced and source added', () => {
        const raw = readFileSync(new URL('./fixtures/dvt-ruleset-8a7cda74.json', import.meta.url));
        expect(sha256(new Uint8Array(raw))).toBe(DEFAULT_RULESET.source.sha256);
        const parsed = JSON.parse(raw.toString('utf8')) as { schema: string; source?: unknown };
        parsed.schema = RULESET_SCHEMA;
        parsed.source = {
            repo: DEFAULT_RULESET.source.repo,
            tag: DEFAULT_RULESET.source.tag,
            commit: DEFAULT_RULESET.source.commit,
            path: DEFAULT_RULESET.source.path,
            sha256: DEFAULT_RULESET.source.sha256,
        };
        expect(parsed).toEqual(DEFAULT_RULESET);
    });

    it('snapshots a ruleset before a later getter can clear a boolean flag', () => {
        const rs = structuredClone(DEFAULT_RULESET);
        const events: string[] = [];
        Object.defineProperty(events, '0', {
            enumerable: true,
            configurable: true,
            get() {
                (rs.bls.SLASH as { flag: unknown }).flag = 0;
                return 'OperatorPaused';
            },
        });
        events.length = 1;
        rs.publicRoute.functions['pauseUnderstakedOperator(address)']!.events = events;
        const verdict = evaluate(rs, roles, { route: 'bls', kind: 'SLASH' });
        expect(verdict.flagged).toBe(true);
        expect(verdict.rule).toBe('bls.SLASH');
        const numeric = structuredClone(DEFAULT_RULESET);
        (numeric.bls.SLASH as { flag: unknown }).flag = 0;
        expect(() => evaluate(numeric, roles, { route: 'bls', kind: 'SLASH' })).toThrow(/^ruleset: bls\.SLASH\.flag must be boolean$/);
    });

    it('requires alsoReason to be a bounded string and rejects a deep subtree', () => {
        const wide = structuredClone(DEFAULT_RULESET);
        (wide.publicRoute.functions['pauseUnderstakedOperator(address)'] as { alsoReason?: unknown }).alsoReason = Array.from({ length: 65 }, () => 'x');
        expect(() => validateRuleset(wide)).toThrow(/^ruleset: publicRoute\.functions\.alsoReason invalid$/);
        const deep = structuredClone(DEFAULT_RULESET);
        let nested: unknown = 'x';
        for (let i = 0; i < 12_000; i++) nested = [nested];
        (deep.publicRoute.functions['pauseUnderstakedOperator(address)'] as { alsoReason?: unknown }).alsoReason = nested;
        expect(() => validateRuleset(deep)).toThrow(/^input rejected$/);
    });

    it('rejects a non-string callEvents element and a bad role on the public route', () => {
        const update = toFunctionSelector('updatePrice()');
        expect(() => evaluate(DEFAULT_RULESET, roles, {
            route: 'public',
            selector: update,
            callEvents: [null as unknown as string],
        })).toThrow(/^record: callEvents invalid$/);
        expect(() => evaluate(DEFAULT_RULESET, { superPaymaster: 'invalid' }, {
            route: 'public',
            selector: update,
        })).toThrow(/^role address is invalid$/);
        expect(() => wantsPrice(DEFAULT_RULESET, null as unknown as Record<string, string>, {
            route: 'public',
            selector: update,
        })).toThrow(/^roles missing$/);
        expect(() => wantsPrice(DEFAULT_RULESET, { superPaymaster: null as unknown as string }, {
            route: 'public',
            selector: update,
        })).toThrow(/^role address is invalid$/);
    });

    it('rejects hex-shaped role names so one digest cannot name two verdicts', () => {
        const withTarget = (name: string) => {
            const rs = structuredClone(DEFAULT_RULESET);
            rs.bls.GENERIC.expected[0]!.target = name;
            return rs;
        };
        expect(() => validateRuleset(withTarget('0xAB'))).toThrow(/^ruleset: bls\.GENERIC\.expected\.target invalid$/);
        expect(() => validateRuleset(withTarget('0xab'))).toThrow(/^ruleset: bls\.GENERIC\.expected\.target invalid$/);
        expect(() => rulesetId(withTarget('0xAB'))).toThrow(/^ruleset: bls\.GENERIC\.expected\.target invalid$/);
        expect(() => evaluate(DEFAULT_RULESET, { '0xAB': SP, '0xab': OTHER }, bls('GENERIC', {
            target: SP, callData: priceCall,
        }))).toThrow(/^role name is invalid$/);
        expect(rulesetId(DEFAULT_RULESET).digest).toBe('0x955722cbb9d0467aef9bdebc2880dd3d97af87c824978cff4a9498367eb429a4');
    });

    it('rejects hex-shaped event names that would share a digest and disagree on flagged', () => {
        const withEvent = (name: string) => {
            const rs = structuredClone(DEFAULT_RULESET);
            const fn = rs.publicRoute.functions['updatePrice()']!;
            fn.events = [name];
            fn.flag = false;
            fn.flagIfCallAlsoEmits = [name];
            fn.alsoReason = 'also';
            return rs;
        };
        expect(() => validateRuleset(withEvent('0xAB'))).toThrow(/^ruleset: publicRoute\.functions\.events invalid$/);
        expect(() => validateRuleset(withEvent('0xab'))).toThrow(/^ruleset: publicRoute\.functions\.events invalid$/);
        const owner = structuredClone(DEFAULT_RULESET);
        owner.ownerRoute.events = { '0xAB': { flag: false } };
        expect(() => validateRuleset(owner)).toThrow(/^ruleset: ownerRoute\.events invalid$/);
        expect(() => evaluate(DEFAULT_RULESET, roles, {
            route: 'public', selector: priceSel, callEvents: ['0xAB'],
        })).toThrow(/^record: callEvents invalid$/);
        expect(() => evaluate(DEFAULT_RULESET, roles, { route: 'owner', event: '0xab' })).toThrow(/^record: event is not a short string$/);
        expect(() => evaluate(DEFAULT_RULESET, roles, { route: 'bls', kind: '0xAB' })).toThrow(/^record: kind is not a short string$/);
    });

    it('accepts no equality-compared name that canonical lower-casing would change', () => {
        const hexValue = /^0x[0-9a-fA-F]*$/;
        const samples = [
            '0xAB', '0xab', '0x', '0xA', '0XAB', 'Ab', 'A', 'a', 'a_b', 'A0', '_A', '0A',
            'constructor', 'toString', 'PriceUpdated', 'SLASH', 'a'.repeat(64), 'a'.repeat(65),
            '', 'has space', 'a-b', 'updatePrice()', 'foo(0xAB)',
        ];
        const priceSelector = toFunctionSelector('updatePrice()');
        const probes: Array<[string, (sample: string) => void]> = [
            ['role target', (sample) => {
                const rs = structuredClone(DEFAULT_RULESET);
                rs.bls.GENERIC.expected[0]!.target = sample;
                validateRuleset(rs);
            }],
            ['role map key', (sample) => {
                evaluate(DEFAULT_RULESET, { [sample]: SP }, bls('SLASH'));
            }],
            ['owner event', (sample) => {
                const rs = structuredClone(DEFAULT_RULESET);
                rs.ownerRoute.events = { [sample]: { flag: false } };
                validateRuleset(rs);
            }],
            ['function event', (sample) => {
                const rs = structuredClone(DEFAULT_RULESET);
                const fn = rs.publicRoute.functions['updatePrice()']!;
                fn.events = [sample];
                delete fn.flagIfCallAlsoEmits;
                delete fn.alsoReason;
                validateRuleset(rs);
            }],
            ['flagIfCallAlsoEmits', (sample) => {
                const rs = structuredClone(DEFAULT_RULESET);
                const fn = rs.publicRoute.functions['updatePrice()']!;
                fn.flagIfCallAlsoEmits = [sample];
                fn.alsoReason = 'also';
                validateRuleset(rs);
            }],
            ['record.event', (sample) => {
                evaluate(DEFAULT_RULESET, roles, { route: 'owner', event: sample });
            }],
            ['record.kind', (sample) => {
                evaluate(DEFAULT_RULESET, roles, { route: 'bls', kind: sample });
            }],
            ['record.callEvents', (sample) => {
                evaluate(DEFAULT_RULESET, roles, { route: 'public', selector: priceSelector, callEvents: [sample] });
            }],
        ];
        for (const [name, probe] of probes) {
            for (const sample of samples) {
                let accepted = true;
                try {
                    probe(sample);
                } catch {
                    accepted = false;
                }
                if (!accepted) continue;
                expect(SYMBOL_RE.test(sample), name).toBe(true);
                expect(hexValue.test(sample), `${name} ${sample}`).toBe(false);
                expect(canonicalJson(sample), name).toBe(JSON.stringify(sample));
            }
            expect(() => probe('0xAB'), name).toThrow();
            expect(() => probe('0xab'), name).toThrow();
        }
        const signed = structuredClone(DEFAULT_RULESET);
        signed.publicRoute.functions['0xAB()'] = structuredClone(signed.publicRoute.functions['updatePrice()']!);
        expect(() => validateRuleset(signed)).toThrow(/^ruleset: bad signature$/);
        const generic = structuredClone(DEFAULT_RULESET);
        generic.bls.GENERIC.expected[0]!.signature = '0xAB()';
        expect(() => validateRuleset(generic)).toThrow(/^ruleset: bad signature$/);
    });
});

const SINGLE_TRACE_REASON = 'single-trace attribution (unverified internal frame)';
const TIMELOCK = '0x4444444444444444444444444444444444444444';
const TIMELOCK_SIG = 'execute(address,uint256,bytes)';
const TIMELOCK_RULE = `bls.GENERIC.expected:timelock.${TIMELOCK_SIG}`;
const RELAY_SIG = 'relay(bytes)';
const RELAY_RULE = `publicRoute.functions.${RELAY_SIG}`;
const BOUNCE_SIG = 'bounce(bytes)';
const BOUNCE_RULE = `publicRoute.functions.${BOUNCE_SIG}`;

function withFactKinds(extra: FactKindMap): FactKindMap {
    return { ...DEFAULT_FACT_KINDS, ...extra };
}

function timelockRuleset(): Ruleset {
    const rs = structuredClone(DEFAULT_RULESET);
    rs.bls.GENERIC.expected.push({
        target: 'timelock',
        signature: TIMELOCK_SIG,
        flag: false,
        reason: 'timelock executed a scheduled call',
    });
    return rs;
}

function publicRuleset(sig: string, reason: string): Ruleset {
    const rs = structuredClone(DEFAULT_RULESET);
    const event = sig === RELAY_SIG ? 'Relayed' : 'Bounced';
    rs.publicRoute.functions[sig] = { events: [event], flag: false, reason };
    return rs;
}

describe('fact kinds and single-trace attribution', () => {
    const timelockRoles = { superPaymaster: getAddress(SP), timelock: getAddress(TIMELOCK) };
    const timelockRecord: RuleRecord = {
        route: 'bls',
        kind: 'GENERIC',
        fields: { target: TIMELOCK, callData: toFunctionSelector(TIMELOCK_SIG) },
    };
    const timelockKinds = withFactKinds({ [TIMELOCK_RULE]: ['topLevel', 'receiptLogs'] });

    it('declares fact kinds for every default rule id and leaves the ruleset bytes unchanged', () => {
        expect(JSON.stringify(DEFAULT_RULESET)).not.toContain('factKinds');
        expect(JSON.stringify(DEFAULT_RULESET)).not.toContain('internalFrames');
        expect(Object.keys(DEFAULT_FACT_KINDS).sort()).toEqual([...rulesetRuleIds(DEFAULT_RULESET)].sort());
        for (const kinds of Object.values(DEFAULT_FACT_KINDS)) {
            expect(kinds.length).toBeGreaterThan(0);
            const ordered = FACT_KINDS.filter((kind) => kinds.includes(kind));
            expect(kinds).toEqual(ordered);
        }
        expect(Object.isFrozen(DEFAULT_FACT_KINDS)).toBe(true);
    });

    it('does not flag a direct top-level timelock call under single-trace attribution', () => {
        const rs = timelockRuleset();
        let hops = 0;
        const attribution: Record<string, unknown> = { attributionSource: 'single' };
        Object.defineProperty(attribution, 'forwardingPath', {
            enumerable: true,
            get() {
                hops += 1;
                return ['0x1111111111111111111111111111111111111111', TIMELOCK];
            },
        });
        Object.defineProperty(attribution, 'immediateCaller', {
            enumerable: true,
            get() {
                hops += 1;
                return TIMELOCK;
            },
        });
        const plain = evaluate(rs, timelockRoles, timelockRecord, { factKinds: timelockKinds });
        const single = evaluate(rs, timelockRoles, timelockRecord, { attribution, factKinds: timelockKinds });
        expect(hops).toBe(0);
        expect(plain.flagged).toBe(false);
        expect(plain.rule).toBe(TIMELOCK_RULE);
        expect(plain.reasons).toEqual(['timelock executed a scheduled call']);
        expect(single).toEqual(plain);
        const mixed = evaluate(rs, timelockRoles, timelockRecord, {
            attribution: { attributionSource: 'single:alchemy' },
            factKinds: withFactKinds({ [TIMELOCK_RULE]: ['receiptLogs', 'topLevel'] }),
        });
        expect(mixed).toEqual(plain);
    });

    it('flags a forwarded-route rule under single-trace attribution and lifts it under dual', () => {
        const rs = publicRuleset(RELAY_SIG, 'forwarded public call');
        const kinds = withFactKinds({ [RELAY_RULE]: ['internalFrames'] });
        const record: RuleRecord = {
            route: 'public',
            selector: toFunctionSelector(RELAY_SIG),
            event: 'Relayed',
        };
        const plain = evaluate(rs, roles, record, { factKinds: kinds });
        const single = evaluate(rs, roles, record, {
            attribution: { attributionSource: 'single' },
            factKinds: kinds,
        });
        const dual = evaluate(rs, roles, record, {
            attribution: { attributionSource: 'dual:alchemy+quicknode' },
            factKinds: kinds,
        });
        expect(plain.flagged).toBe(false);
        expect(plain.rule).toBe(RELAY_RULE);
        expect(single).toEqual({ flagged: true, reasons: [SINGLE_TRACE_REASON], rule: RELAY_RULE });
        expect(dual).toEqual(plain);
        const mixed = evaluate(rs, roles, record, {
            attribution: { attributionSource: 'single' },
            factKinds: withFactKinds({ [RELAY_RULE]: ['topLevel', 'internalFrames'] }),
        });
        expect(mixed.reasons).toEqual([SINGLE_TRACE_REASON]);
    });

    it('flags a forged intermediate frame under single-trace attribution when the rule id is undeclared', () => {
        const rs = publicRuleset(BOUNCE_SIG, 'bounce');
        const record: RuleRecord = {
            route: 'public',
            selector: toFunctionSelector(BOUNCE_SIG),
            event: 'Bounced',
        };
        let hops = 0;
        const attribution: Record<string, unknown> = { attributionSource: 'single:alchemy' };
        Object.defineProperty(attribution, 'forwardingPath', {
            enumerable: true,
            get() {
                hops += 1;
                return [{ depth: 1, who: 'forged' }];
            },
        });
        const single = evaluate(rs, roles, record, { attribution, factKinds: DEFAULT_FACT_KINDS });
        const dual = evaluate(rs, roles, record, {
            attribution: { attributionSource: 'dual' },
            factKinds: DEFAULT_FACT_KINDS,
        });
        expect(hops).toBe(0);
        expect(single).toEqual({ flagged: true, reasons: [SINGLE_TRACE_REASON], rule: BOUNCE_RULE });
        expect(dual.flagged).toBe(false);
        expect(dual.rule).toBe(BOUNCE_RULE);
        expect(dual.reasons).toEqual([
            'permissionless call: caller recorded, not accused: bounce(bytes): bounce',
        ]);
    });

    it('rejects an invalid fact-kind map before it reads values past the cap', () => {
        let reads = 0;
        const map: Record<string, unknown> = {};
        for (let i = 0; i < 257; i++) {
            Object.defineProperty(map, `k${i}`, {
                enumerable: true,
                get() {
                    reads += 1;
                    return ['topLevel'];
                },
            });
        }
        expect(() => evaluate(DEFAULT_RULESET, roles, bls('SLASH'), { factKinds: map as FactKindMap })).toThrow(/^fact kind map is too large$/);
        expect(reads).toBe(0);
        const url = 'https://secret.example/fact';
        expect(() => evaluate(DEFAULT_RULESET, roles, bls('SLASH'), {
            factKinds: { [url]: ['topLevel'] },
        })).toThrow(/^fact kind is invalid$/);
        expect(() => classifierRulesetSha256(DEFAULT_RULESET, { 'bls.SLASH': [] as unknown as readonly FactKind[] })).toThrow(/^fact kind is invalid$/);
        expect(() => classifierRulesetSha256(DEFAULT_RULESET, { 'bls.SLASH': ['nope'] as unknown as readonly FactKind[] })).toThrow(/^fact kind is invalid$/);
        const long = `single:${'https://secret.example/'}${'a'.repeat(120)}`;
        expect(long.length).toBeGreaterThan(133);
        try {
            evaluate(DEFAULT_RULESET, roles, bls('SLASH'), { attribution: { attributionSource: long } });
            throw new Error('accepted a long attribution source');
        } catch (error) {
            expect((error as Error).message).toBe('attribution source is invalid');
            expect((error as Error).message).not.toContain('secret');
        }
    });

    it('hashes the ruleset together with the resolved fact-kind map', () => {
        const full = classifierRulesetSha256(DEFAULT_RULESET);
        expect(full).toBe(classifierRulesetSha256(DEFAULT_RULESET, DEFAULT_FACT_KINDS));
        expect(full).toMatch(/^0x[0-9a-f]{64}$/);
        const commented = structuredClone(DEFAULT_RULESET);
        commented.comment = 'different ruleset text';
        expect(classifierRulesetSha256(commented)).not.toBe(full);
        const swapped: FactKindMap = { ...DEFAULT_FACT_KINDS, 'bls.SLASH': ['internalFrames'] };
        expect(classifierRulesetSha256(DEFAULT_RULESET, swapped)).not.toBe(full);
        const reordered = classifierRulesetSha256(DEFAULT_RULESET, {
            ...DEFAULT_FACT_KINDS,
            'bls.SLASH': ['receiptLogs', 'topLevel'],
        });
        expect(reordered).toBe(full);
        const dropped: FactKindMap = { ...DEFAULT_FACT_KINDS };
        delete (dropped as { 'bls.SLASH'?: readonly FactKind[] })['bls.SLASH'];
        expect(classifierRulesetSha256(DEFAULT_RULESET, dropped)).not.toBe(full);
    });
});
