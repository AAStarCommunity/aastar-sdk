import { describe, expect, it } from 'vitest';
import { keccak256, stringToBytes, toFunctionSelector, type Address, type Hex } from 'viem';
import {
    buildEvidenceBundle, parseEvidenceFile, serializeEvidenceFile, verifyEvidenceFile,
} from '../../src/guardianAudit/bundle';
import { canonicalDigest } from '../../src/guardianAudit/canonical';
import { EVENT_MISMATCH, REFERENCE_CLASSIFIER, eventMatchesLog } from '../../src/guardianAudit/reference';
import {
    DEFAULT_CLASSIFIER_RULESET_SHA256, DEFAULT_RULESET, SINGLE_TRACE_INTERNAL_REASON, classifierRulesetSha256,
} from '../../src/guardianAudit/rules';
import type { DecodedAction, FoundAction, ScanResult } from '../../src/guardianAudit/scan';

const SP = '0x2222222222222222222222222222222222222222' as Address;
const IMPL = '0x3333333333333333333333333333333333333333' as Address;
const EOA = '0x5555555555555555555555555555555555555555' as Address;
const ROUTER = '0x6666666666666666666666666666666666666666' as Address;
const SCOPE = `0x${'ab'.repeat(32)}` as Hex;
const ROLES = { superPaymaster: SP, entryPoint: '0x1111111111111111111111111111111111111111' };
const DUAL = 'dual:alchemy+quicknode';

const UPDATE_PRICE = toFunctionSelector('updatePrice()');
const SET_GUARDIAN = toFunctionSelector('setGuardian(address)');
const PRICE_UPDATED = 'PriceUpdated(int256,uint256)';
const PRICE_MODE = 'PriceModeChanged(uint8)';
const GUARDIAN_SET = 'GuardianSet(address)';

function word(ch: string): Hex {
    return `0x${ch.repeat(64 / ch.length)}` as Hex;
}

function eventOf(signature: string): DecodedAction {
    return { kind: 'event', event: signature.slice(0, signature.indexOf('(')), signature };
}

interface Hop { type: string; from: Address; to: Address; selector: Hex | null }

/** EOA → SP proxy (CALL) → implementation (DELEGATECALL), both with `selector`. */
function direct(selector: Hex | null): Hop[] {
    return [
        { type: 'CALL', from: EOA, to: SP, selector },
        { type: 'DELEGATECALL', from: SP, to: IMPL, selector },
    ];
}

function attributed(path: Hop[], source: string = DUAL) {
    return {
        transactionSender: path[0]!.from,
        immediateCaller: path[path.length - 1]!.from,
        forwardingPath: path,
        emitter: SP,
        attributionSource: source,
    };
}

function act(
    logIndex: number, decoded: DecodedAction, attribution: unknown,
    over: { txHash?: Hex; blockNumber?: number; address?: Address; topic0?: Hex } = {},
): FoundAction {
    const blockNumber = over.blockNumber ?? 5;
    const txHash = over.txHash ?? word('aa');
    const address = over.address ?? SP;
    const signature = (decoded as { signature?: unknown }).signature;
    const topic0 = over.topic0 ?? (typeof signature === 'string' ? keccak256(stringToBytes(signature)) : word('11'));
    return {
        blockNumber,
        blockHash: word('a1'),
        txHash,
        logIndex,
        address,
        kind: decoded.kind,
        decoded,
        log: {
            address,
            topics: [topic0],
            data: '0x',
            blockNumber: `0x${blockNumber.toString(16)}` as Hex,
            blockHash: word('a1'),
            transactionHash: txHash,
            logIndex: `0x${logIndex.toString(16)}` as Hex,
        },
        attribution,
    };
}

function result(actions: FoundAction[]): ScanResult {
    return {
        state: 'COMPLETE', count: actions.length, from: 4, to: 9, actions, resolvedPrior: [],
        bloomRecovered: 0, bloomFalsePositives: 0, ignored: 0,
    };
}

function build(actions: FoundAction[], over: Partial<Parameters<typeof buildEvidenceBundle>[0]> = {}) {
    return buildEvidenceBundle({
        result: result(actions),
        scope: SCOPE,
        chainId: 11155111,
        ruleset: DEFAULT_RULESET,
        roles: ROLES,
        providers: ['primary', 'secondary'],
        sdkVersion: '0.46.0-rc.2',
        generatedAt: '2026-11-15T00:00:00.000Z',
        ...over,
    });
}

describe('guardian-audit published classifier hash', () => {
    it('publishes the default ruleset and fact-kind hash', () => {
        expect(classifierRulesetSha256(DEFAULT_RULESET)).toBe(DEFAULT_CLASSIFIER_RULESET_SHA256);
    });
});

describe('guardian-audit event check', () => {
    it('accepts an owner record whose event, decoded name, signature, and topic0 agree', () => {
        const a = act(0, eventOf(GUARDIAN_SET), attributed(direct(SET_GUARDIAN)));
        expect(eventMatchesLog(a.decoded, a.log.topics, { route: 'owner', event: 'GuardianSet' })).toBe(true);
    });

    it('refuses a record that names another event than the logged one', () => {
        const a = act(0, eventOf(GUARDIAN_SET), attributed(direct(SET_GUARDIAN)));
        expect(() => build([a], {
            classify: () => ({ route: 'owner', event: 'PriceUpdated' }),
            classifier: { name: 'custom', version: '1.0.0' },
        })).toThrow(new RegExp(`^${EVENT_MISMATCH}$`));
    });

    it('refuses a decoded signature that does not hash to topic0, a renamed decoded event, and a missing signature', () => {
        const forgedTopic = act(0, eventOf(GUARDIAN_SET), attributed(direct(SET_GUARDIAN)), { topic0: word('11') });
        expect(() => build([forgedTopic])).toThrow(new RegExp(`^${EVENT_MISMATCH}$`));
        const renamed = act(0, { ...eventOf(PRICE_UPDATED), event: 'GuardianSet' }, attributed(direct(SET_GUARDIAN)));
        expect(() => build([renamed], {
            classify: () => ({ route: 'owner', event: 'GuardianSet' }),
            classifier: { name: 'custom', version: '1.0.0' },
        })).toThrow(new RegExp(`^${EVENT_MISMATCH}$`));
        const unsigned = act(0, { kind: 'event', event: 'GuardianSet' }, attributed(direct(SET_GUARDIAN)), {
            topic0: keccak256(stringToBytes(GUARDIAN_SET)),
        });
        expect(() => build([unsigned])).toThrow(new RegExp(`^${EVENT_MISMATCH}$`));
    });

    it('refuses an unattributed record whose event is not the logged one', () => {
        const a = act(0, eventOf(PRICE_UPDATED), null);
        expect(() => build([a], {
            classify: () => ({ route: 'unattributed', event: 'PriceModeChanged' }),
            classifier: { name: 'custom', version: '1.0.0' },
        })).toThrow(new RegExp(`^${EVENT_MISMATCH}$`));
    });

    it('does not apply the event check to the BLS route', () => {
        const a = act(0, { kind: 'bls' }, attributed(direct(null)));
        expect(build([a]).bundle.actions[0]!.record).toEqual({ route: 'bls' });
    });

    it('rejects a parsed file whose record event was swapped and digest recomputed', () => {
        const built = build([act(0, eventOf(GUARDIAN_SET), attributed(direct(SET_GUARDIAN)))]);
        const forged = structuredClone(built.bundle);
        forged.actions[0]!.record = { route: 'owner', event: 'GlobalPauseSet' };
        forged.actions[0]!.verdict = {
            flagged: true,
            reasons: ['owner/guardian route: not BLS, no on-chain signer verification: GlobalPauseSet'],
            rule: 'ownerRoute.events.GlobalPauseSet',
        };
        const text = `${JSON.stringify({
            schema: 'aastar.guardian-audit.evidence-file.v1',
            bundle: forged,
            digest: canonicalDigest(forged),
            runMetadata: built.runMetadata,
        })}`;
        expect(() => parseEvidenceFile(text)).toThrow();
        const file = serializeEvidenceFile(built);
        const swapped = file.replace('"record":{"event":"GuardianSet","route":"owner"}', '"record":{"event":"GlobalPauseSet","route":"owner"}');
        expect(swapped).not.toBe(file);
        expect(verifyEvidenceFile(swapped, built).ok).toBe(false);
    });
});

describe('guardian-audit reference classifier', () => {
    it('uses the reference identity when classify is omitted', () => {
        const built = build([act(0, eventOf(GUARDIAN_SET), attributed(direct(SET_GUARDIAN)))]);
        expect(built.bundle.classifier.name).toBe(REFERENCE_CLASSIFIER.name);
        expect(built.bundle.classifier.version).toBe(REFERENCE_CLASSIFIER.version);
        expect(built.bundle.classifier.rulesetSha256).toBe(DEFAULT_CLASSIFIER_RULESET_SHA256);
        const named = build([act(0, eventOf(GUARDIAN_SET), attributed(direct(SET_GUARDIAN)))], {
            classifier: { ...REFERENCE_CLASSIFIER },
        });
        expect(named.digest).toBe(built.digest);
    });

    it('reserves the reference name and refuses another identity for the reference code', () => {
        const a = act(0, eventOf(GUARDIAN_SET), attributed(direct(SET_GUARDIAN)));
        expect(() => build([a], {
            classify: () => ({ route: 'owner', event: 'GuardianSet' }),
            classifier: { name: REFERENCE_CLASSIFIER.name, version: '9.9.9' },
        })).toThrow(/^classifier name is reserved$/);
        expect(() => build([a], { classifier: { name: 'mine', version: '1.0.0' } })).toThrow(/^classifier is invalid$/);
        expect(() => build([a], { classifier: { name: REFERENCE_CLASSIFIER.name, version: '0.0.1' } }))
            .toThrow(/^classifier is invalid$/);
        expect(() => build([a], { classify: () => ({ route: 'owner', event: 'GuardianSet' }) }))
            .toThrow(/^classifier missing$/);
    });

    it('routes an event no public function emits to the owner route even under a public selector', () => {
        const a = act(0, eventOf(GUARDIAN_SET), attributed(direct(UPDATE_PRICE)));
        const built = build([a]);
        expect(built.bundle.actions[0]!.record).toEqual({ route: 'owner', event: 'GuardianSet' });
        expect(built.bundle.actions[0]!.verdict.flagged).toBe(true);
    });

    it('routes an ambiguous event by the SP call that emitted it', () => {
        const built = build([act(0, eventOf(PRICE_UPDATED), attributed(direct(UPDATE_PRICE)))]);
        expect(built.bundle.actions[0]!.record).toEqual({
            route: 'public', event: 'PriceUpdated', selector: UPDATE_PRICE, callEvents: ['PriceUpdated'],
        });
        expect(built.bundle.actions[0]!.verdict).toEqual({
            flagged: false,
            reasons: ['permissionless call: caller recorded, not accused: updatePrice(): routine permissionless price refresh (Chainlink)'],
            rule: 'publicRoute.functions.updatePrice()',
        });
    });

    it('collects the events of one SP call and flags what the call also emitted', () => {
        const path = direct(UPDATE_PRICE);
        const built = build([
            act(3, eventOf(PRICE_MODE), attributed(path)),
            act(2, eventOf(PRICE_UPDATED), attributed(path)),
        ]);
        for (const action of built.bundle.actions) {
            expect(action.record.callEvents).toEqual(['PriceUpdated', 'PriceModeChanged']);
            expect(action.verdict.rule).toBe('publicRoute.functions.updatePrice().also');
            expect(action.verdict.flagged).toBe(true);
        }
    });

    it('keeps separate SP calls and separate txs apart', () => {
        const viaRouter: Hop[] = [
            { type: 'CALL', from: EOA, to: ROUTER, selector: toFunctionSelector('run()') },
            { type: 'CALL', from: ROUTER, to: SP, selector: UPDATE_PRICE },
        ];
        const built = build([
            act(0, eventOf(PRICE_UPDATED), attributed(direct(UPDATE_PRICE))),
            act(1, eventOf(PRICE_MODE), attributed(viaRouter)),
            act(2, eventOf(PRICE_MODE), attributed(direct(UPDATE_PRICE)), { txHash: word('bb') }),
        ]);
        const [first, routed, other] = built.bundle.actions;
        expect(first!.record.callEvents).toEqual(['PriceUpdated']);
        expect(first!.verdict.flagged).toBe(false);
        expect(routed!.record.callEvents).toEqual(['PriceModeChanged']);
        expect(other!.record.callEvents).toEqual(['PriceModeChanged']);
    });

    it('marks an ambiguous event unattributed without a usable emitting call', () => {
        const none = act(0, eventOf(PRICE_UPDATED), null);
        const elsewhere = act(1, eventOf(PRICE_UPDATED), attributed([{ type: 'CALL', from: EOA, to: ROUTER, selector: UPDATE_PRICE }]));
        const created = act(2, eventOf(PRICE_UPDATED), attributed([{ type: 'CALL', from: EOA, to: SP, selector: null }]));
        const otherEmitter = act(3, eventOf(PRICE_UPDATED), { ...attributed(direct(UPDATE_PRICE)), emitter: ROUTER });
        const built = build([none, elsewhere, created, otherEmitter]);
        for (const action of built.bundle.actions) {
            expect(action.record).toEqual({ route: 'unattributed', event: 'PriceUpdated' });
            expect(action.verdict.flagged).toBe(true);
        }
        expect(built.bundle.state).toBe('UNATTRIBUTED');
    });

    it('routes an ambiguous event from a non-public SP call to the owner route with its selector', () => {
        const built = build([act(0, eventOf(PRICE_UPDATED), attributed(direct(SET_GUARDIAN)))]);
        expect(built.bundle.actions[0]!.record).toEqual({ route: 'owner', event: 'PriceUpdated', selector: SET_GUARDIAN });
    });

    it('flags a single-trace public verdict', () => {
        const built = build([act(0, eventOf(PRICE_UPDATED), attributed(direct(UPDATE_PRICE), 'single:alchemy'))]);
        expect(built.bundle.actions[0]!.record.route).toBe('public');
        expect(built.bundle.actions[0]!.verdict.flagged).toBe(true);
        expect(built.bundle.actions[0]!.verdict.reasons).toEqual([SINGLE_TRACE_INTERNAL_REASON]);
    });

    it('records a BLS action as UNRECOVERED unless the decoder recovered its kind', () => {
        const callData = `${toFunctionSelector('updatePriceDVT(int256,uint256,bytes,uint8)')}${'cd'.repeat(16)}`;
        const built = build([
            act(0, { kind: 'bls' }, attributed(direct(null))),
            act(1, { kind: 'bls', blsKind: 'GENERIC', fields: { target: SP, callData } }, attributed(direct(null))),
        ]);
        expect(built.bundle.actions[0]!.verdict.rule).toBe('bls.UNRECOVERED');
        expect(built.bundle.actions[0]!.verdict.flagged).toBe(true);
        expect(built.bundle.actions[1]!.verdict.rule)
            .toBe('bls.GENERIC.expected:superPaymaster.updatePriceDVT(int256,uint256,bytes,uint8)');
    });

    it('fails on a decoded shape it does not know', () => {
        expect(() => build([act(0, { kind: 'owner' }, attributed(direct(SET_GUARDIAN)))])).toThrow(/^classify failed$/);
        expect(() => build([act(0, { kind: 'event', event: 'bad name', signature: 'x()' }, attributed(direct(SET_GUARDIAN)))]))
            .toThrow(/^classify failed$/);
        expect(() => build([act(0, { kind: 'bls', blsKind: 7 }, attributed(direct(null)))])).toThrow(/^classify failed$/);
    });

    it('does not depend on action order', () => {
        const path = direct(UPDATE_PRICE);
        const a = act(2, eventOf(PRICE_UPDATED), attributed(path));
        const b = act(3, eventOf(PRICE_MODE), attributed(path));
        const c = act(0, eventOf(GUARDIAN_SET), attributed(direct(SET_GUARDIAN)), { txHash: word('cc'), blockNumber: 4 });
        expect(build([a, b, c]).digest).toBe(build([c, b, a]).digest);
    });

    // Golden pin for REFERENCE_CLASSIFIER.version. If this fails because the reference records
    // changed, bump the version in reference.ts and update the digest here, in the same commit.
    it('produces the pinned bundle for the reference fixture at this version', () => {
        const path = direct(UPDATE_PRICE);
        const built = build([
            act(0, eventOf(GUARDIAN_SET), attributed(direct(SET_GUARDIAN)), { txHash: word('cc'), blockNumber: 4 }),
            act(2, eventOf(PRICE_UPDATED), attributed(path)),
            act(3, eventOf(PRICE_MODE), attributed(path)),
            act(4, eventOf(PRICE_UPDATED), null, { txHash: word('dd') }),
            act(5, { kind: 'bls' }, attributed(direct(null)), { txHash: word('ee') }),
            act(6, eventOf(PRICE_UPDATED), attributed(direct(UPDATE_PRICE)), { txHash: word('ff') }),
        ]);
        expect(REFERENCE_CLASSIFIER.version).toBe('1.0.0');
        expect(built.bundle.actions.map((a) => a.verdict.flagged)).toEqual([true, true, true, true, true, false]);
        expect(built.digest).toBe(GOLDEN);
    });
});

const GOLDEN = '0x4956663556ab0be72e266e7f4c00d76a907aeb496e81c9512bc2d50f68ceeccf' as Hex;
