import { describe, expect, it } from 'vitest';
import { getAddress, keccak256, stringToBytes, toFunctionSelector, type Hex } from 'viem';
import {
    DEFAULT_RULESET, ambiguousEvents, evaluate, rulesetId, validateRuleset, wantsPrice, type RuleRecord,
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
        expect(() => validateRuleset({ ...DEFAULT_RULESET, extra: true })).toThrow(/unknown key extra/);
        const missing = JSON.parse(JSON.stringify(DEFAULT_RULESET)) as typeof DEFAULT_RULESET;
        delete (missing.bls as { QUEUE?: unknown }).QUEUE;
        expect(() => validateRuleset(missing)).toThrow(/bls\.QUEUE missing/);
        const noPublic = JSON.parse(JSON.stringify(DEFAULT_RULESET)) as { publicRoute?: unknown };
        delete noPublic.publicRoute;
        expect(() => validateRuleset(noPublic)).toThrow(/publicRoute missing/);
        const badFn = JSON.parse(JSON.stringify(DEFAULT_RULESET));
        delete badFn.publicRoute.functions['updatePrice()'].reason;
        expect(() => validateRuleset(badFn)).toThrow(/publicRoute\.functions\.updatePrice\(\) needs events and reason/);
        const noAlso = JSON.parse(JSON.stringify(DEFAULT_RULESET));
        delete noAlso.publicRoute.functions['updatePrice()'].alsoReason;
        expect(() => validateRuleset(noAlso)).toThrow(/alsoReason missing/);
    });

    it('pins the default ruleset digest', () => {
        expect(validateRuleset(DEFAULT_RULESET)).toBe(DEFAULT_RULESET);
        expect(DEFAULT_RULESET.schema).toBe('aastar.guardian-audit.ruleset.v1');
        expect(DEFAULT_RULESET.source).toContain('archive/guardian-watcher-w2-2026-11-12 (8a7cda74)');
        const id = rulesetId(DEFAULT_RULESET);
        expect(id.schema).toBe('aastar.guardian-audit.ruleset.v1');
        // Changing any rule text, comment, or the source line changes this digest.
        expect(id.digest).toBe('0x9b96808e4db04f56e7333d4d2e38c37eb13fe3a7da7ae2451dffce126260464b');
    });
});
