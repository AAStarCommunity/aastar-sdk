import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getAddress, keccak256, sha256, stringToBytes, toFunctionSelector, type Hex } from 'viem';
import {
    DEFAULT_RULESET, RULESET_SCHEMA, ambiguousEvents, evaluate, matchGeneric, rulesetId, validateRuleset, wantsPrice,
    type RuleRecord,
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
        const ownerProto = evaluate(DEFAULT_RULESET, roles, { route: 'owner', event: '__proto__' });
        expect(ownerProto.flagged).toBe(true);
        expect(ownerProto.rule).toBe('ownerRoute.unlisted');
        const kindProto = evaluate(DEFAULT_RULESET, roles, { route: 'bls', kind: '__proto__' });
        expect(kindProto.flagged).toBe(true);
        expect(kindProto.rule).toBe('bls.unknown');
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
});
