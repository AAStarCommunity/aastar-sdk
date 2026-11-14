import { describe, expect, it } from 'vitest';
import { getAddress, toFunctionSelector, type Address, type Hex } from 'viem';
import * as canonicalMod from '../../src/guardianAudit/canonical';
import { canonicalDigest, canonicalJson } from '../../src/guardianAudit/canonical';
import * as bundleMod from '../../src/guardianAudit/bundle';
import {
    MAX_EVIDENCE_FILE_BYTES, buildEvidenceBundle, evidenceFileSha256, parseEvidenceFile, serializeEvidenceFile,
    verifyEvidenceBundle, verifyEvidenceFile, type EvidenceBundle, type RunMetadata,
} from '../../src/guardianAudit/bundle';
import * as rulesMod from '../../src/guardianAudit/rules';
import {
    DEFAULT_FACT_KINDS, DEFAULT_RULESET, classifierRulesetSha256, validateRuleset, rulesetId,
    type FactKindMap, type RuleRecord, type Ruleset,
} from '../../src/guardianAudit/rules';
import type { DecodedAction, FoundAction, ScanResult } from '../../src/guardianAudit/scan';
import type { RawLog } from '../../src/guardianAudit/rpc';
import { isProviderName } from '../../src/guardianAudit';
import * as guardianAudit from '../../src/guardianAudit';
import * as rpcMod from '../../src/guardianAudit/rpc';

const SP = '0x2222222222222222222222222222222222222222' as Address;
const SCOPE = `0x${'ab'.repeat(32)}` as Hex;
const priceCall = `${toFunctionSelector('updatePriceDVT(int256,uint256,bytes,uint8)')}${'cd'.repeat(16)}`;

function word(ch: string): Hex {
    return `0x${ch.repeat(64 / ch.length)}` as Hex;
}

function logOf(block: number, txHash: Hex, index: number, address: Address, blockHash: Hex = word('a1')): RawLog {
    return {
        address,
        topics: [word('11')],
        data: '0x',
        blockNumber: `0x${block.toString(16)}` as Hex,
        blockHash,
        transactionHash: txHash,
        logIndex: `0x${index.toString(16)}` as Hex,
    };
}

function action(over: Partial<FoundAction> & Pick<FoundAction, 'blockNumber' | 'txHash' | 'logIndex' | 'kind'>): FoundAction {
    const address = over.address ?? SP;
    const blockHash = over.blockHash ?? word('a1');
    const decoded: DecodedAction = over.decoded ?? { kind: over.kind, callData: priceCall };
    return {
        blockNumber: over.blockNumber,
        blockHash,
        txHash: over.txHash,
        logIndex: over.logIndex,
        address,
        kind: over.kind,
        decoded,
        log: over.log ?? logOf(over.blockNumber, over.txHash, over.logIndex, address, blockHash),
        attribution: 'attribution' in over ? over.attribution : { tag: 'test' },
    };
}

function classify(found: FoundAction): RuleRecord {
    if (found.kind === 'GENERIC') {
        const callData = (found.decoded as { callData?: unknown }).callData;
        return { route: 'bls', kind: 'GENERIC', fields: { target: found.address, callData } };
    }
    return { route: 'owner', event: 'GuardianSet', fields: { who: found.address } };
}

function complete(actions: FoundAction[], resolvedPrior: FoundAction[]): ScanResult {
    return {
        state: 'COMPLETE',
        count: actions.length,
        from: 4,
        to: 9,
        actions,
        resolvedPrior,
        bloomRecovered: 0,
        bloomFalsePositives: 0,
        ignored: 0,
    };
}

function reorder(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(reorder);
    if (value !== null && typeof value === 'object') {
        const src = value as Record<string, unknown>;
        const out: Record<string, unknown> = {};
        for (const key of Object.keys(src).reverse()) out[key] = reorder(src[key]);
        return out;
    }
    if (typeof value === 'string' && /^0x[0-9a-fA-F]+$/.test(value) && value.length > 2) {
        return `0x${value.slice(2).toUpperCase()}`;
    }
    return value;
}

function flipByte(hex: string): Hex {
    const last = Number.parseInt(hex.slice(-2), 16) ^ 0xff;
    return `${hex.slice(0, -2)}${last.toString(16).padStart(2, '0')}` as Hex;
}

const baseActions = [
    action({ blockNumber: 5, logIndex: 1, txHash: word('bb'), blockHash: word('a2'), kind: 'GENERIC', attribution: { who: SP, tag: 'bls' } }),
    action({ blockNumber: 5, logIndex: 2, txHash: word('aa'), blockHash: word('a2'), kind: 'owner' }),
    action({ blockNumber: 4, logIndex: 3, txHash: word('cc'), kind: 'owner', address: getAddress(SP) }),
];
const basePrior = [
    action({ blockNumber: 8, logIndex: 0, txHash: word('dd'), kind: 'GENERIC' }),
    action({ blockNumber: 1, logIndex: 2, txHash: word('ee'), kind: 'owner' }),
];

function build(over: Partial<Parameters<typeof buildEvidenceBundle>[0]> = {}) {
    return buildEvidenceBundle({
        result: complete(baseActions, basePrior),
        scope: SCOPE,
        chainId: 11155111,
        ruleset: DEFAULT_RULESET,
        roles: { superPaymaster: SP, entryPoint: '0x1111111111111111111111111111111111111111' },
        classify,
        providers: ['primary', 'secondary'],
        sdkVersion: '0.46.0-rc.2',
        generatedAt: '2026-11-12T00:00:00.000Z',
        classifier: { name: 'auditClassifier', version: '1.0.0' },
        ...over,
    });
}

describe('guardian-audit evidence bundle (unit, not acceptance)', () => {
    it('throws on an INCOMPLETE scan', () => {
        expect(() => build({
            result: { state: 'INCOMPLETE', reasons: ['providers disagree on block hash at 3'], from: 1 },
        })).toThrow(/incomplete scan has no evidence/);
    });

    it('is byte-reproducible under key shuffle and address case', () => {
        const first = build();
        const shuffled = reorder(complete(baseActions, basePrior)) as ScanResult & { actions: FoundAction[]; resolvedPrior: FoundAction[] };
        shuffled.actions = [...shuffled.actions].reverse();
        shuffled.resolvedPrior = [...shuffled.resolvedPrior].reverse();
        const second = build({
            result: shuffled,
            scope: `0x${SCOPE.slice(2).toUpperCase()}` as Hex,
            ruleset: reorder(DEFAULT_RULESET) as Ruleset,
            roles: {
                entryPoint: '0x1111111111111111111111111111111111111111'.toUpperCase(),
                superPaymaster: getAddress(SP),
            },
        });
        expect(canonicalJson(first.bundle)).toBe(canonicalJson(second.bundle));
        expect(first.digest).toBe(second.digest);
        const parsed = JSON.parse(canonicalJson(first.bundle)) as { schema: string; actions: unknown[]; ruleset: { digest: string } };
        expect(parsed.schema).toBe('aastar.guardian-audit.evidence.v1');
        expect(parsed.actions).toHaveLength(3);
        expect(parsed.ruleset.digest).toBe(rulesetId(DEFAULT_RULESET).digest);
        expect(first.bundle.actions.map((item) => item.txHash.toLowerCase())).toEqual([
            word('cc'), word('bb'), word('aa'),
        ]);
        expect('resolvedPrior' in first.bundle).toBe(false);
        expect(first.bundle.actions[0]?.verdict.rule).toBe('ownerRoute.events.GuardianSet');
        expect(first.bundle.actions[1]?.verdict.rule).toBe('bls.GENERIC.expected:superPaymaster.updatePriceDVT(int256,uint256,bytes,uint8)');
        expect(first.bundle.actions[1]?.attribution).toEqual({ who: SP, tag: 'bls' });
        expect(first.bundle.actions[0]?.attribution).toEqual({ tag: 'test' });
        expect('unattributed' in first.bundle).toBe(false);
    });

    it('keeps run metadata out of the digest', () => {
        const a = build();
        const b = build({
            providers: ['alpha', 'beta'],
            sdkVersion: 'sdk-metadata-B',
            generatedAt: '1999-01-01T00:00:00.000Z',
        });
        expect(a.digest).toBe(b.digest);
        expect(a.runMetadata).toEqual({
            providers: ['primary', 'secondary'],
            sdkVersion: '0.46.0-rc.2',
            generatedAt: '2026-11-12T00:00:00.000Z',
            traceProviders: [],
        });
        expect(b.runMetadata.providers).toEqual(['alpha', 'beta']);
        const text = canonicalJson(a.bundle);
        expect(text).not.toContain('sdk-metadata');
        expect(text).not.toContain('primary');
        expect(text).not.toContain('2026-11-12');
    });

    it('rejects a URL-like provider name and two equal names', () => {
        expect(() => build({ providers: ['https://rpc.example/v3/secret', 'secondary'] })).toThrow(/provider name is not a label/);
        expect(() => build({ providers: ['primary', 'http://127.0.0.1:8545'] })).toThrow(/provider name is not a label/);
        expect(() => build({ providers: ['primary', 'primary'] })).toThrow(/provider names must differ/);
    });

    it('publishes a canonical evidence file whose sha256 moves with run metadata only', () => {
        expect(evidenceFileSha256('abc\n')).toBe('0xedeaaff3f1774ad2888673770c6d64097e391bc362d7d6fb34982ddf0efd18cb');
        const early = build({ generatedAt: '2026-11-12T00:00:00.000Z' });
        const later = build({ generatedAt: '2026-11-13T00:00:00.000Z' });
        const earlyText = serializeEvidenceFile(early);
        const laterText = serializeEvidenceFile(later);
        expect(earlyText.endsWith('\n')).toBe(true);
        expect(earlyText.slice(0, -1)).not.toContain('\n');
        expect(early.digest).toBe(later.digest);
        expect(canonicalJson(early.bundle)).toBe(canonicalJson(later.bundle));
        expect(evidenceFileSha256(earlyText)).not.toBe(evidenceFileSha256(laterText));
        expect(verifyEvidenceFile(earlyText, { bundle: later.bundle, digest: later.digest })).toEqual({
            ok: true, sha256: evidenceFileSha256(earlyText), reasons: [],
        });
        expect(verifyEvidenceFile(laterText, { bundle: early.bundle, digest: early.digest })).toEqual({
            ok: true, sha256: evidenceFileSha256(laterText), reasons: [],
        });
        const parsed = parseEvidenceFile(earlyText);
        expect(parsed.schema).toBe('aastar.guardian-audit.evidence-file.v1');
        expect(serializeEvidenceFile(parsed)).toBe(earlyText);

        const changed = { ...early.bundle, chainId: early.bundle.chainId + 1 };
        const mismatch = verifyEvidenceFile(earlyText, { bundle: changed, digest: early.digest });
        expect(mismatch.ok).toBe(false);
        expect(mismatch.reasons).toContain('rerun bundle differs from the file bundle');
        expect(mismatch.sha256).toBe(evidenceFileSha256(earlyText));
        const other = build({ chainId: 1 });
        expect(verifyEvidenceFile(earlyText, { bundle: other.bundle, digest: other.digest }).ok).toBe(false);
    });

    it('refuses a non-canonical file, a missing newline, and an extra runMetadata field', () => {
        const text = serializeEvidenceFile(build());
        const parsed = JSON.parse(text) as Record<string, unknown>;
        const pretty = JSON.stringify(parsed, null, 2) + '\n';
        expect(() => parseEvidenceFile(pretty)).toThrow(/not canonical/);
        expect(() => parseEvidenceFile(text.slice(0, -1))).toThrow(/not canonical/);
        const reordered = JSON.stringify({
            schema: parsed.schema,
            bundle: parsed.bundle,
            digest: parsed.digest,
            runMetadata: parsed.runMetadata,
        }) + '\n';
        expect(reordered).not.toBe(text);
        expect(() => parseEvidenceFile(reordered)).toThrow(/not canonical/);
        const extraTop = JSON.parse(text) as Record<string, unknown>;
        extraTop.note = true;
        try {
            parseEvidenceFile(JSON.stringify(extraTop) + '\n');
            throw new Error('accepted an extra file key');
        } catch (e) {
            expect((e as Error).message).toBe('evidence file: unknown key');
            expect((e as Error).message).not.toContain('note');
        }
        const extraMeta = JSON.parse(text) as { runMetadata: Record<string, unknown> };
        extraMeta.runMetadata.endpoint = 'https://rpc.example';
        try {
            parseEvidenceFile(JSON.stringify(extraMeta) + '\n');
            throw new Error('accepted an extra runMetadata key');
        } catch (e) {
            expect((e as Error).message).toBe('runMetadata: unknown key');
            expect((e as Error).message).not.toContain('endpoint');
            expect((e as Error).message).not.toContain('http');
        }
        const lying = JSON.parse(text) as { bundle: EvidenceBundle; digest: Hex; runMetadata: RunMetadata };
        lying.digest = flipByte(lying.digest);
        expect(() => serializeEvidenceFile(lying)).toThrow(/^evidence digest mismatch$/);
        const lyingText = `${canonicalJson(lying)}\n`;
        expect(() => parseEvidenceFile(lyingText)).toThrow(/evidence digest mismatch/);
        const rejected = verifyEvidenceFile(pretty, { bundle: build().bundle, digest: build().digest });
        expect(rejected.ok).toBe(false);
        expect(rejected.sha256).toBe(evidenceFileSha256(pretty));
    });

    it('counts unattributed actions in this range and ignores a lying scan count', () => {
        const attributed = baseActions[2]!;
        const bare = action({ blockNumber: 6, logIndex: 0, txHash: word('ab'), kind: 'owner' });
        delete bare.attribution;
        const result: ScanResult = {
            state: 'UNATTRIBUTED',
            unattributed: 4,
            count: 2,
            from: 4,
            to: 9,
            actions: [attributed, bare],
            resolvedPrior: [],
            bloomRecovered: 0,
            bloomFalsePositives: 0,
            ignored: 0,
        };
        const built = build({ result });
        expect(built.bundle.state).toBe('UNATTRIBUTED');
        expect(built.bundle.unattributed).toBe(1);
        const other = build({ result: { ...result, unattributed: 5, state: 'COMPLETE' } });
        expect(other.digest).toBe(built.digest);
        expect(other.bundle.state).toBe('UNATTRIBUTED');
    });

    it('verifyEvidenceBundle detects a one-byte change', () => {
        const { bundle, digest } = build();
        expect(verifyEvidenceBundle(bundle, digest)).toBe(true);
        expect(verifyEvidenceBundle(bundle, flipByte(digest))).toBe(false);
        const scoped = { ...bundle, scope: flipByte(bundle.scope) };
        expect(verifyEvidenceBundle(scoped, digest)).toBe(false);
    });

    it('rejects a complete bundle that omits attribution, range, count, or chainId', () => {
        const caughtUp = complete([action({ blockNumber: 4, logIndex: 0, txHash: word('aa'), kind: 'owner' })], []);
        caughtUp.from = 10;
        caughtUp.to = 9;
        let rangeCalls = 0;
        expect(() => build({
            result: caughtUp,
            classify: () => {
                rangeCalls += 1;
                return { route: 'owner', event: 'GuardianSet' };
            },
        })).toThrow(/^evidence range is invalid$/);
        expect(rangeCalls).toBe(0);
        const swapped = complete([], []);
        swapped.from = 9;
        swapped.to = 4;
        expect(() => build({ result: swapped })).toThrow(/^evidence range is invalid$/);

        const bare = action({ blockNumber: 4, logIndex: 0, txHash: word('aa'), kind: 'owner' });
        delete bare.attribution;
        const open = build({ result: complete([bare], []) });
        expect(open.bundle.state).toBe('UNATTRIBUTED');
        expect(open.bundle.unattributed).toBe(1);
        const prior = action({ blockNumber: 1, logIndex: 0, txHash: word('bb'), kind: 'owner' });
        delete prior.attribution;
        const quiet = build({ result: complete([], []) });
        const ignoredPrior = build({ result: complete([], [prior]) });
        expect(ignoredPrior.bundle.state).toBe('COMPLETE');
        expect(ignoredPrior.digest).toBe(quiet.digest);

        const ranged = complete([], []);
        delete (ranged as { from?: number }).from;
        expect(() => build({ result: ranged })).toThrow(/range is invalid/);
        const counted = complete([], []);
        counted.count = 1;
        expect(() => build({ result: counted })).toThrow(/count does not match/);
        expect(() => build({ chainId: Number.NaN })).toThrow(/chainId is invalid/);
        expect(() => build({ scope: '0xab' as Hex })).toThrow(/scope is invalid/);

        const uncounted = complete([], []);
        (uncounted as { state: 'UNATTRIBUTED' }).state = 'UNATTRIBUTED';
        const recounted = build({ result: uncounted });
        expect(recounted.bundle.state).toBe('COMPLETE');
        expect(recounted.digest).toBe(quiet.digest);

        const wide = action({ blockNumber: 4, logIndex: 0, txHash: word('aa'), kind: 'owner' });
        wide.decoded = { kind: 'owner' };
        for (let i = 0; i < 65; i++) wide.decoded[`k${i}`] = i;
        const builtWide = build({ result: complete([wide], []) });
        expect(Object.keys(builtWide.bundle.actions[0]!.decoded)).toHaveLength(66);
        const logless = action({ blockNumber: 4, logIndex: 0, txHash: word('aa'), kind: 'owner' });
        delete (logless.log as { data?: string }).data;
        expect(() => build({ result: complete([logless], []) })).toThrow(/log is invalid/);
        const addressed = action({ blockNumber: 4, logIndex: 0, txHash: word('aa'), kind: 'owner' });
        (addressed as { address: string }).address = 'https://evil.example/addr';
        expect(() => build({ result: complete([addressed], []) })).toThrow(/^evidence address is invalid$/);

        const published = build();
        const forged = structuredClone(published.bundle);
        forged.actions[0]!.attribution = null;
        const meta = published.runMetadata;
        const text = `${canonicalJson({
            schema: 'aastar.guardian-audit.evidence-file.v1', bundle: forged, digest: canonicalDigest(forged), runMetadata: meta,
        })}\n`;
        expect(() => parseEvidenceFile(text)).toThrow(/unattributed action/);
        const noVerdict = structuredClone(published.bundle);
        delete (noVerdict.actions[0] as { verdict?: unknown }).verdict;
        const bareText = `${canonicalJson({
            schema: 'aastar.guardian-audit.evidence-file.v1',
            bundle: noVerdict,
            digest: canonicalDigest(noVerdict),
            runMetadata: meta,
        })}\n`;
        expect(() => parseEvidenceFile(bareText)).toThrow(/evidence action is invalid/);
        const check = verifyEvidenceFile(text, { bundle: published.bundle, digest: published.digest });
        expect(check.ok).toBe(false);
        expect(check.reasons.join(' ')).not.toContain('://');
        expect(check.sha256).toBe(evidenceFileSha256(text));
    });

    it('does not keep caller aliases or a ruleset mutated during classify', () => {
        const result = complete([
            action({ blockNumber: 4, logIndex: 0, txHash: word('aa'), kind: 'owner' }),
            action({ blockNumber: 5, logIndex: 1, txHash: word('bb'), kind: 'owner' }),
        ], []);
        const ruleset = structuredClone(DEFAULT_RULESET);
        let n = 0;
        const built = build({
            result,
            ruleset,
            classify: () => {
                n += 1;
                if (n === 1) result.actions.push(action({ blockNumber: 3, logIndex: 0, txHash: word('cc'), kind: 'owner' }));
                if (n === 2) ruleset.ownerRoute.events.GuardianSet!.flag = false;
                return { route: 'owner', event: 'GuardianSet' };
            },
        });
        expect(built.bundle.actions).toHaveLength(2);
        expect(built.bundle.actions.every((item) => item.verdict.flagged)).toBe(true);
        const roles = { superPaymaster: SP, entryPoint: '0x1111111111111111111111111111111111111111' };
        let seen = 0;
        const priced = build({
            roles,
            result: complete([
                action({ blockNumber: 4, logIndex: 0, txHash: word('aa'), kind: 'GENERIC' }),
                action({ blockNumber: 5, logIndex: 1, txHash: word('bb'), kind: 'GENERIC' }),
            ], []),
            classify: () => {
                seen += 1;
                if (seen === 2) roles.superPaymaster = '0x3333333333333333333333333333333333333333';
                return { route: 'bls', kind: 'GENERIC', fields: { target: SP, callData: priceCall } };
            },
        });
        expect(priced.bundle.actions.every((item) => item.verdict.rule.startsWith('bls.GENERIC.expected'))).toBe(true);
        result.actions[0]!.log.data = '0xdead';
        expect(built.bundle.actions[0]!.log.data).toBe('0x');
        expect(() => build({
            classify: () => { throw new Error('https://rpc.example/v3/secret'); },
        })).toThrow(/^classify failed$/);

        const loop: Record<string, unknown> = {};
        loop.self = loop;
        const rerun = structuredClone(built.bundle) as EvidenceBundle & { loop?: unknown };
        rerun.loop = loop;
        const file = serializeEvidenceFile(built);
        const compared = verifyEvidenceFile(file, { bundle: rerun, digest: built.digest });
        expect(compared.ok).toBe(false);
        expect(compared.sha256).toBe(evidenceFileSha256(file));
        expect(verifyEvidenceFile(file, null as unknown as { bundle: EvidenceBundle; digest: Hex }).ok).toBe(false);
    });

    it('rejects an oversized evidence file before parsing it', () => {
        expect(evidenceFileSha256(' '.repeat(2_000_001))).toMatch(/^0x[0-9a-f]{64}$/);
        expect(() => parseEvidenceFile(' '.repeat(2_000_001))).toThrow(/not JSON/);
        const wide = 'é'.repeat(Math.floor(MAX_EVIDENCE_FILE_BYTES / 2) + 1);
        expect(wide.length).toBeLessThanOrEqual(MAX_EVIDENCE_FILE_BYTES);
        expect(() => evidenceFileSha256(wide)).toThrow(/^evidence file too large$/);
        const over = 'x'.repeat(MAX_EVIDENCE_FILE_BYTES + 1);
        expect(() => evidenceFileSha256(over)).toThrow(/^evidence file too large$/);
        expect(() => parseEvidenceFile(over)).toThrow(/^evidence file too large$/);
        expect(() => evidenceFileSha256(1 as unknown as string)).toThrow(/not a string/);
        const sample = build();
        expect(verifyEvidenceFile(over, { bundle: sample.bundle, digest: sample.digest })).toEqual({
            ok: false,
            sha256: '0xe3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
            reasons: ['evidence file too large'],
        });
        expect(verifyEvidenceFile(1 as unknown as string, { bundle: sample.bundle, digest: sample.digest })).toEqual({
            ok: false,
            sha256: '0xe3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
            reasons: ['evidence file is not a string'],
        });
        expect(() => build({ generatedAt: 'https://evil.example/when' })).toThrow(/generatedAt must be a string/);
    });

    it('round-trips a 2000-action bundle above the old character cap', () => {
        const data = `0x${'ab'.repeat(800)}` as Hex;
        const actions: FoundAction[] = [];
        for (let i = 0; i < 2000; i++) {
            const tx = `0x${i.toString(16).padStart(64, '0')}` as Hex;
            const item = action({ blockNumber: 4, logIndex: i, txHash: tx, kind: 'owner' });
            item.log = { ...item.log, data };
            actions.push(item);
        }
        const built = build({ result: complete(actions, []) });
        const text = serializeEvidenceFile(built);
        expect(text.length).toBeGreaterThan(2_000_000);
        expect(text.length).toBeLessThan(MAX_EVIDENCE_FILE_BYTES);
        const parsed = parseEvidenceFile(text);
        expect(parsed.bundle.actions).toHaveLength(2000);
        const check = verifyEvidenceFile(text, { bundle: built.bundle, digest: built.digest });
        expect(check).toEqual({ ok: true, sha256: evidenceFileSha256(text), reasons: [] });
    }, 60_000);

    it('serializeEvidenceFile refuses a canonical form over 64 MiB', () => {
        const built = build({ result: complete([], []) });
        const seed = action({ blockNumber: 4, logIndex: 0, txHash: word('aa'), kind: 'owner' });
        const packed = build({ result: complete([seed], []) }).bundle.actions[0]!;
        const actions = [];
        const nul = '\u0000'.repeat(1_000_000);
        for (let i = 0; i < 12; i++) {
            const copy = structuredClone(packed);
            copy.logIndex = i;
            copy.log.logIndex = i;
            (copy.decoded as { blob?: string }).blob = nul;
            actions.push(copy);
        }
        const bundle = { ...structuredClone(built.bundle), actions };
        expect(() => serializeEvidenceFile({
            bundle, digest: word('ab'), runMetadata: built.runMetadata,
        })).toThrow(/^evidence file too large$/);
    }, 120_000);

    it('normalizes two providers logs to one digest', () => {
        const base = action({ blockNumber: 10, logIndex: 10, txHash: word('aa'), kind: 'owner' });
        const left = action({ blockNumber: 10, logIndex: 10, txHash: word('aa'), kind: 'owner' });
        const right = action({ blockNumber: 10, logIndex: 10, txHash: word('aa'), kind: 'owner' });
        left.log = {
            ...base.log,
            address: getAddress(SP),
            topics: [word('11').toUpperCase() as Hex],
            data: '0xAB' as Hex,
            blockNumber: '0x0a' as Hex,
            blockHash: word('a1').toUpperCase() as Hex,
            logIndex: '0x0a' as Hex,
            removed: false,
            transactionIndex: '0x3',
        } as RawLog;
        right.log = {
            ...base.log,
            address: SP,
            topics: [word('11')],
            data: '0xab' as Hex,
            blockNumber: '0xa' as Hex,
            blockHash: word('a1'),
            logIndex: '0xa' as Hex,
            removed: false,
        };
        const leftResult = complete([left], []);
        leftResult.from = 10;
        leftResult.to = 10;
        const rightResult = complete([right], []);
        rightResult.from = 10;
        rightResult.to = 10;
        const a = build({ result: leftResult });
        const b = build({ result: rightResult });
        expect(a.digest).toBe(b.digest);
        expect(Object.keys(a.bundle.actions[0]!.log).sort()).toEqual([
            'address', 'blockHash', 'blockNumber', 'data', 'logIndex', 'topics', 'transactionHash',
        ]);
        expect(a.bundle.actions[0]!.log.blockNumber).toBe(10);
        expect(a.bundle.actions[0]!.log.logIndex).toBe(10);
        expect(a.bundle.actions[0]!.log.data).toBe('0xab');
        expect(a.bundle.actions[0]!.log.address).toBe(SP);
        expect(a.bundle.actions[0]!.log).not.toHaveProperty('removed');
    });

    it('rejects two block hashes at one height and rejects a duplicate log', () => {
        const laterHash = action({ blockNumber: 5, logIndex: 1, txHash: word('aa'), blockHash: word('a2'), kind: 'owner' });
        const earlierHash = action({ blockNumber: 5, logIndex: 1, txHash: word('ff'), blockHash: word('a1'), kind: 'owner' });
        let hashCalls = 0;
        expect(() => build({
            result: complete([laterHash, earlierHash], []),
            classify: () => {
                hashCalls += 1;
                return { route: 'owner', event: 'GuardianSet' };
            },
        })).toThrow(/^evidence block hash disagrees$/);
        expect(hashCalls).toBe(0);
        const sameHash = action({ blockNumber: 5, logIndex: 2, txHash: word('ff'), blockHash: word('a1'), kind: 'owner' });
        const agreed = build({ result: complete([earlierHash, sameHash], []) });
        expect(agreed.bundle.actions.map((item) => item.logIndex)).toEqual([1, 2]);
        expect(agreed.bundle.actions.every((item) => item.blockHash === word('a1'))).toBe(true);
        const aa = action({ blockNumber: 5, logIndex: 1, txHash: word('aa'), blockHash: word('b2'), kind: 'owner' });
        const cc = action({ blockNumber: 5, logIndex: 1, txHash: word('cc'), blockHash: word('b2'), kind: 'owner' });
        let calls = 0;
        const counting = () => {
            calls += 1;
            return { route: 'owner', event: 'GuardianSet' };
        };
        expect(() => build({ result: complete([cc, aa], []), classify: counting })).toThrow(/^evidence action is duplicated$/);
        expect(() => build({ result: complete([aa, cc], []), classify: counting })).toThrow(/^evidence action is duplicated$/);
        expect(calls).toBe(0);
    });

    it('rejects a forged bundle whose digest was recomputed', () => {
        const published = build();
        const fileFor = (bundle: EvidenceBundle): string => `${canonicalJson({
            schema: 'aastar.guardian-audit.evidence-file.v1',
            bundle,
            digest: canonicalDigest(bundle),
            runMetadata: published.runMetadata,
        })}\n`;
        const extra = structuredClone(published.bundle) as EvidenceBundle & { note?: boolean };
        extra.note = true;
        expect(() => parseEvidenceFile(fileFor(extra))).toThrow(/^evidence bundle is invalid$/);
        const junk = structuredClone(published.bundle) as EvidenceBundle & { ruleset: unknown };
        junk.ruleset = 'junk';
        expect(() => parseEvidenceFile(fileFor(junk))).toThrow(/^evidence bundle is invalid$/);
        const bogus = structuredClone(published.bundle);
        (bogus.actions[0] as { bogus?: boolean }).bogus = true;
        expect(() => parseEvidenceFile(fileFor(bogus))).toThrow(/^evidence action is invalid$/);
        const badHash = structuredClone(published.bundle);
        badHash.actions[0]!.txHash = `0x${'g'.repeat(64)}` as Hex;
        expect(() => parseEvidenceFile(fileFor(badHash))).toThrow(/^evidence hash is invalid$/);
        const unsorted = structuredClone(published.bundle);
        unsorted.actions.reverse();
        expect(() => parseEvidenceFile(fileFor(unsorted))).toThrow(/^evidence actions are unsorted$/);
        const verdict = structuredClone(published.bundle);
        (verdict.actions[0]!.verdict as { extra?: boolean }).extra = true;
        expect(() => parseEvidenceFile(fileFor(verdict))).toThrow(/^evidence action is invalid$/);
        const upper = serializeEvidenceFile(published).replace(word('cc'), word('cc').toUpperCase());
        expect(() => parseEvidenceFile(upper)).toThrow(/^evidence hash is invalid$/);
        const fractional = JSON.parse(serializeEvidenceFile(published)) as { bundle: { chainId: number } };
        fractional.bundle.chainId = 1.5;
        const check = verifyEvidenceFile(`${JSON.stringify(fractional)}\n`, {
            bundle: published.bundle, digest: published.digest,
        });
        expect(check.ok).toBe(false);
        expect(check.reasons).toEqual(['evidence file rejected']);
        expect(check.reasons.join(' ')).not.toContain('safe integer');
    });

    it('stops a shared-reference dag on one node budget', () => {
        const leaf = Array.from({ length: 4096 }, () => 1);
        const refs = Array.from({ length: 4096 }, () => leaf);
        const found = action({ blockNumber: 4, logIndex: 0, txHash: word('aa'), kind: 'owner' });
        found.decoded = { kind: 'owner', refs };
        const started = Date.now();
        expect(() => build({ result: complete([found], []) })).toThrow(/^input rejected$/);
        expect(Date.now() - started).toBeLessThan(2_000);
    });

    it('copies an own __proto__ key without polluting Object.prototype', () => {
        const decoded: Record<string, unknown> = { kind: 'owner' };
        Object.defineProperty(decoded, '__proto__', { value: { polluted: true }, enumerable: true, configurable: true });
        const found = action({ blockNumber: 4, logIndex: 0, txHash: word('aa'), kind: 'owner', decoded: decoded as DecodedAction });
        const built = build({ result: complete([found], []) });
        const stored = built.bundle.actions[0]!.decoded as Record<string, unknown>;
        expect(Object.getPrototypeOf(stored)).toBe(null);
        expect(Object.hasOwn(stored, '__proto__')).toBe(true);
        expect(Object.getOwnPropertyDescriptor(stored, '__proto__')?.value).toEqual({ polluted: true });
        expect((Object.prototype as { polluted?: boolean }).polluted).toBeUndefined();
        expect(canonicalJson(stored)).toBe('{"__proto__":{"polluted":true},"kind":"owner"}');
    });

    it('evaluates the stored record, not a later read of the original', () => {
        let reads = 0;
        const record: Record<string, unknown> = {};
        Object.defineProperty(record, 'route', { enumerable: true, get: () => 'owner' });
        Object.defineProperty(record, 'event', {
            enumerable: true,
            get: () => {
                reads += 1;
                return reads === 1 ? 'GuardianSet' : 'NotAnEvent';
            },
        });
        const built = build({
            result: complete([action({ blockNumber: 4, logIndex: 0, txHash: word('aa'), kind: 'owner' })], []),
            classify: () => record as RuleRecord,
        });
        expect(built.bundle.actions[0]!.verdict.rule).toBe('ownerRoute.events.GuardianSet');
        expect(reads).toBe(1);
    });

    it('ignores store history, so two ranges with different priors share a digest', () => {
        const unresolved = action({ blockNumber: 1, logIndex: 0, txHash: word('ee'), kind: 'owner' });
        delete unresolved.attribution;
        const withPrior = build({ result: complete([], [unresolved]) });
        const without = build({ result: complete([], []) });
        expect(withPrior.bundle.state).toBe('COMPLETE');
        expect(without.bundle.state).toBe('COMPLETE');
        expect(withPrior.bundle.actions).toEqual([]);
        expect(canonicalJson(withPrior.bundle)).toBe(canonicalJson(without.bundle));
        expect(withPrior.digest).toBe(without.digest);
        expect('resolvedPrior' in withPrior.bundle).toBe(false);
    });

    it('publishes the snapshotted action when classify mutates its argument or the prior list', () => {
        const found = action({ blockNumber: 4, logIndex: 0, txHash: word('aa'), kind: 'owner' });
        const result = complete([found], [action({ blockNumber: 1, logIndex: 2, txHash: word('ee'), kind: 'owner' })]);
        const before = found.txHash;
        const built = build({
            result,
            classify: (item) => {
                result.resolvedPrior = [];
                item.txHash = word('ff');
                item.log.transactionHash = word('ff');
                return { route: 'owner', event: 'GuardianSet', fields: { who: item.address } };
            },
        });
        expect(found.txHash).toBe(before);
        expect(found.log.transactionHash).toBe(before);
        expect(built.bundle.actions[0]!.txHash).toBe(before);
        expect(built.bundle.actions[0]!.log.transactionHash).toBe(before);
        const plain = build({ result: complete([action({ blockNumber: 4, logIndex: 0, txHash: word('aa'), kind: 'owner' })], []) });
        expect(built.digest).toBe(plain.digest);
    });

    it('rejects contradictory action identity, removed logs, and out-of-range actions', () => {
        const rejectBeforeClassify = (result: ScanResult, message: RegExp) => {
            let calls = 0;
            expect(() => build({
                result,
                classify: () => {
                    calls += 1;
                    return { route: 'owner', event: 'GuardianSet' };
                },
            })).toThrow(message);
            expect(calls).toBe(0);
        };
        const outside = action({ blockNumber: 999, logIndex: 0, txHash: word('aa'), kind: 'owner' });
        outside.log = logOf(999, word('aa'), 0, SP);
        rejectBeforeClassify(complete([outside], []), /^evidence action is outside the range$/);
        const removed = action({ blockNumber: 4, logIndex: 0, txHash: word('aa'), kind: 'owner' });
        removed.log = { ...removed.log, removed: true };
        rejectBeforeClassify(complete([removed], []), /^evidence log is removed$/);
        const mismatched = action({ blockNumber: 4, logIndex: 0, txHash: word('aa'), kind: 'owner' });
        mismatched.log = logOf(4, word('bb'), 0, SP);
        rejectBeforeClassify(complete([mismatched], []), /^evidence action does not match its log$/);
        const codex = action({ blockNumber: 999, logIndex: 0, txHash: word('aa'), kind: 'owner' });
        codex.log = { ...logOf(4, word('aa'), 0, SP), removed: true };
        rejectBeforeClassify(complete([codex], []), /^evidence log is removed$/);

        const published = build();
        const fileFor = (bundle: EvidenceBundle): string => `${canonicalJson({
            schema: 'aastar.guardian-audit.evidence-file.v1',
            bundle,
            digest: canonicalDigest(bundle),
            runMetadata: published.runMetadata,
        })}\n`;
        const shifted = structuredClone(published.bundle);
        shifted.actions[0]!.blockNumber = 999;
        expect(() => parseEvidenceFile(fileFor(shifted))).toThrow(/^evidence action does not match its log$/);
        const check = verifyEvidenceFile(fileFor(shifted), { bundle: published.bundle, digest: published.digest });
        expect(check.ok).toBe(false);
        expect(check.reasons).toContain('evidence action does not match its log');
        const far = structuredClone(published.bundle);
        far.actions[0]!.blockNumber = 999;
        far.actions[0]!.log.blockNumber = 999;
        expect(() => parseEvidenceFile(fileFor(far))).toThrow(/^evidence action is outside the range$/);
        const dup = structuredClone(published.bundle);
        const twin = structuredClone(dup.actions[0]!);
        (twin.decoded as { extra?: number }).extra = 1;
        dup.actions.push(twin);
        expect(() => parseEvidenceFile(fileFor(dup))).toThrow(/^evidence action is duplicated$/);
    });

    it('lowercases a classifier selector before the published record is checked', () => {
        const selector = toFunctionSelector('updatePrice()');
        const built = build({
            result: complete([action({ blockNumber: 4, logIndex: 0, txHash: word('aa'), kind: 'owner' })], []),
            classify: () => ({ route: 'public', selector: selector.toUpperCase(), event: 'PriceUpdated' }),
        });
        expect(built.bundle.actions[0]!.record.selector).toBe(selector);
        expect(built.bundle.actions[0]!.verdict.rule).toBe('publicRoute.functions.updatePrice()');
    });

    it('rejects a missing classifier and a bad role before it needs an action', () => {
        expect(() => build({
            result: complete([], []),
            classify: null as unknown as typeof classify,
        })).toThrow(/^classify is not a function$/);
        const bad = `0x${'z'.repeat(40)}`;
        try {
            build({ result: complete([], []), roles: { superPaymaster: bad } });
            throw new Error('accepted a bad role');
        } catch (e) {
            expect((e as Error).message).toBe('role address is invalid');
            expect((e as Error).message).not.toContain(bad);
        }
    });

    it('does not walk an extra ruleset subtree before rejecting it', () => {
        let reads = 0;
        const ruleset = structuredClone(DEFAULT_RULESET) as Ruleset & { extra?: object };
        const extra: Record<string, unknown> = {};
        for (let i = 0; i < 100; i++) {
            Object.defineProperty(extra, `k${i}`, {
                enumerable: true,
                get() { reads += 1; return i; },
            });
        }
        ruleset.extra = extra;
        expect(() => build({ result: complete([], []), ruleset })).toThrow(/^ruleset: unknown key$/);
        expect(reads).toBe(100);
    });

    it('hides a secret thrown by a classifier getter or a rerun digest getter', () => {
        const secret = 'https://secret.example/token';
        const poisoned = action({ blockNumber: 4, logIndex: 1, txHash: word('bb'), kind: 'owner' });
        Object.defineProperty(poisoned, 'kind', {
            enumerable: true,
            get() { throw new Error(secret); },
        });
        try {
            build({ result: complete([poisoned], []) });
            throw new Error('action getter escaped');
        } catch (e) {
            expect((e as Error).message).toBe('input rejected');
            expect(String(e)).not.toContain('secret.example');
        }
        try {
            build({
                result: complete([action({ blockNumber: 4, logIndex: 0, txHash: word('aa'), kind: 'owner' })], []),
                classify: () => {
                    const record: Record<string, unknown> = {};
                    Object.defineProperty(record, 'route', {
                        enumerable: true,
                        get() { throw new Error(secret); },
                    });
                    return record as RuleRecord;
                },
            });
            throw new Error('classify getter escaped');
        } catch (e) {
            expect((e as Error).message).toBe('input rejected');
            expect((e as Error).message).not.toContain(secret);
            expect(String(e)).not.toContain('secret.example');
        }
        const published = build({ result: complete([], []) });
        const file = serializeEvidenceFile(published);
        const rerun: { bundle: EvidenceBundle; digest: Hex } = { bundle: published.bundle, digest: published.digest };
        Object.defineProperty(rerun, 'digest', { get() { throw new Error(secret); } });
        const check = verifyEvidenceFile(file, rerun);
        expect(check.ok).toBe(false);
        expect(check.reasons.join(' ')).not.toContain(secret);
        expect(check.reasons.join(' ')).not.toContain('secret.example');
    });

    it('does not copy array elements a getter appends', () => {
        const found = action({ blockNumber: 4, logIndex: 0, txHash: word('aa'), kind: 'owner' });
        const items: number[] = [];
        let extra = 0;
        Object.defineProperty(items, '0', {
            enumerable: true,
            configurable: true,
            get() {
                if (items.length === 1) {
                    items.length = 2;
                    Object.defineProperty(items, '1', {
                        enumerable: true,
                        configurable: true,
                        get() { extra += 1; return 2; },
                    });
                }
                return 1;
            },
        });
        items.length = 1;
        found.decoded = { kind: 'owner', items } as DecodedAction;
        const built = build({ result: complete([found], []) });
        expect(extra).toBe(0);
        expect((built.bundle.actions[0]!.decoded as { items: number[] }).items).toEqual([1]);
    });

    it('counts an unpaired surrogate as three bytes and does not swallow the next unit', () => {
        expect(() => evidenceFileSha256('\ud800é'.repeat(13_421_773))).toThrow(/^evidence file too large$/);
    });

    it('rejects a self-consistent file whose unattributed count or route fields are wrong', () => {
        const published = build({ result: complete([], []) });
        const fileFor = (bundle: EvidenceBundle): string => `${canonicalJson({
            schema: 'aastar.guardian-audit.evidence-file.v1',
            bundle,
            digest: canonicalDigest(bundle),
            runMetadata: published.runMetadata,
        })}\n`;
        const counted = structuredClone(published.bundle);
        counted.state = 'UNATTRIBUTED';
        counted.unattributed = 999;
        const text = fileFor(counted);
        expect(() => parseEvidenceFile(text)).toThrow(/^unattributed count does not match$/);
        const check = verifyEvidenceFile(text, { bundle: counted, digest: canonicalDigest(counted) });
        expect(check.ok).toBe(false);
        expect(check.reasons).toContain('unattributed count does not match');

        const seeded = build();
        const fileForSeed = (bundle: EvidenceBundle): string => `${canonicalJson({
            schema: 'aastar.guardian-audit.evidence-file.v1',
            bundle,
            digest: canonicalDigest(bundle),
            runMetadata: seeded.runMetadata,
        })}\n`;
        const noEvent = structuredClone(seeded.bundle);
        noEvent.actions[0]!.record = { route: 'unattributed' };
        expect(() => parseEvidenceFile(fileForSeed(noEvent))).toThrow(/^evidence action is invalid$/);
        const noSelector = structuredClone(seeded.bundle);
        noSelector.actions[0]!.record = { route: 'public' };
        expect(() => parseEvidenceFile(fileForSeed(noSelector))).toThrow(/^evidence action is invalid$/);
        const recovered = structuredClone(seeded.bundle);
        recovered.actions[0]!.record = { route: 'bls' };
        expect(parseEvidenceFile(fileForSeed(recovered)).bundle.actions[0]!.record).toEqual({ route: 'bls' });

        const hexEvent = structuredClone(seeded.bundle);
        hexEvent.actions[0]!.record = { route: 'owner', event: '0xab' };
        expect(() => parseEvidenceFile(fileForSeed(hexEvent))).toThrow(/^evidence action is invalid$/);
        const one = action({ blockNumber: 4, logIndex: 0, txHash: word('aa'), kind: 'owner' });
        expect(() => build({
            result: complete([one], []),
            classify: () => ({ route: 'public', selector: toFunctionSelector('updatePrice()'), callEvents: ['0xAB'] }),
        })).toThrow(/^evidence action is invalid$/);
        expect(() => build({
            result: complete([one], []),
            classify: () => ({ route: 'bls', kind: '0xab' }),
        })).toThrow(/^evidence action is invalid$/);
        expect(() => build({
            result: complete([one], []),
            roles: { '0xAB': SP },
            classify: () => {
                throw new Error('classify reached');
            },
        })).toThrow(/^role name is invalid$/);
    });

    it('hides a secret thrown by a getter on canonical, ruleset, file, and provider inputs', () => {
        const secret = 'https://secret/token';
        const boom = () => { throw new Error(secret); };
        const assertHidden = (run: () => unknown) => {
            try {
                run();
                throw new Error('getter escaped');
            } catch (e) {
                const cause = e instanceof Error && 'cause' in e ? (e as { cause?: unknown }).cause : undefined;
                const text = `${e instanceof Error ? `${e.name} ${e.message} ${e.stack ?? ''}` : String(e)} ${String(cause)}`;
                expect(text).not.toContain('secret');
                expect((e as Error).message).toBe('input rejected');
            }
        };
        const box: Record<string, unknown> = {};
        Object.defineProperty(box, 'a', { enumerable: true, get: boom });
        assertHidden(() => canonicalJson(box));
        const ruleset = structuredClone(DEFAULT_RULESET) as Ruleset & { comment?: unknown };
        Object.defineProperty(ruleset, 'comment', { enumerable: true, configurable: true, get: boom });
        assertHidden(() => validateRuleset(ruleset));
        const published = build({ result: complete([], []) });
        const parts: { bundle: EvidenceBundle; digest: Hex; runMetadata: RunMetadata } = {
            bundle: published.bundle,
            digest: published.digest,
            runMetadata: published.runMetadata,
        };
        Object.defineProperty(parts, 'runMetadata', { enumerable: true, get: boom });
        assertHidden(() => serializeEvidenceFile(parts));
        const input = {
            result: complete([], []),
            scope: SCOPE,
            chainId: 11155111,
            ruleset: DEFAULT_RULESET,
            roles: { superPaymaster: SP },
            classify,
            sdkVersion: '0.46.0-rc.2',
            generatedAt: '2026-11-12T00:00:00.000Z',
        };
        Object.defineProperty(input, 'providers', { enumerable: true, get: boom });
        assertHidden(() => buildEvidenceBundle(input));
    });

    it('never returns a secret from a proxy passed to any exported function', () => {
        const secret = 'https://secret/token';
        const trap = () => { throw new Error(secret); };
        const poison = () => new Proxy({}, {
            get: trap,
            set: trap,
            has: trap,
            ownKeys: trap,
            getOwnPropertyDescriptor: trap,
            defineProperty: trap,
            deleteProperty: trap,
            getPrototypeOf: trap,
            setPrototypeOf: trap,
            isExtensible: trap,
            preventExtensions: trap,
            apply: trap,
            construct: trap,
        });
        const rendered = (value: unknown): string => {
            if (value instanceof Error) {
                const cause = 'cause' in value ? rendered((value as { cause?: unknown }).cause) : '';
                return `${value.name} ${value.message} ${value.stack ?? ''} ${cause}`;
            }
            if (typeof value === 'string') return value;
            try {
                return JSON.stringify(value) ?? '';
            } catch (e) {
                return rendered(e);
            }
        };
        for (const mod of [canonicalMod, rulesMod, bundleMod]) {
            for (const [name, value] of Object.entries(mod)) {
                if (typeof value !== 'function') continue;
                const args = Array.from({ length: Math.max(value.length, 1) }, () => poison());
                let text = '';
                try {
                    text = rendered(name === 'GuardianAuditInputError' ? new (value as new (...a: unknown[]) => unknown)(...args) : (value as (...a: unknown[]) => unknown)(...args));
                } catch (e) {
                    text = rendered(e);
                }
                expect(text, name).not.toContain('secret');
            }
        }
    });

    it('refuses a public route whose attribution is null', () => {
        const bare = action({ blockNumber: 4, logIndex: 0, txHash: word('aa'), kind: 'owner', attribution: null });
        const selector = toFunctionSelector('updatePrice()');
        expect(() => build({
            result: complete([bare], []),
            classify: () => ({ route: 'public', selector, event: 'PriceUpdated' }),
        })).toThrow(/^public route requires attribution$/);
        const open = build({ result: complete([bare], []) });
        expect(open.bundle.state).toBe('UNATTRIBUTED');
        const forged = structuredClone(open.bundle);
        forged.actions[0]!.record = { route: 'public', selector, event: 'PriceUpdated' };
        forged.actions[0]!.verdict = {
            flagged: false,
            reasons: ['permissionless call'],
            rule: 'publicRoute.functions.updatePrice()',
        };
        const text = `${canonicalJson({
            schema: 'aastar.guardian-audit.evidence-file.v1',
            bundle: forged,
            digest: canonicalDigest(forged),
            runMetadata: open.runMetadata,
        })}\n`;
        expect(() => parseEvidenceFile(text)).toThrow(/^public route requires attribution$/);
        const check = verifyEvidenceFile(text, { bundle: forged, digest: canonicalDigest(forged) });
        expect(check.ok).toBe(false);
        expect(check.reasons).toContain('public route requires attribution');
    });

    it('keeps only the trace attribution kind inside the digest', () => {
        const traced = (source: string) => action({
            blockNumber: 4,
            logIndex: 0,
            txHash: word('aa'),
            kind: 'owner',
            attribution: { attributionSource: source, tag: 'kept' },
        });
        const alchemy = build({ result: complete([traced('single:alchemy')], []) });
        const quicknode = build({ result: complete([traced('single:quicknode')], []) });
        expect(alchemy.digest).toBe(quicknode.digest);
        expect(canonicalJson(alchemy.bundle)).toBe(canonicalJson(quicknode.bundle));
        expect(alchemy.bundle.actions[0]!.attribution).toEqual({ attributionSource: 'single', tag: 'kept' });
        expect(alchemy.bundle.actions[0]!.verdict).toEqual({
            flagged: true,
            reasons: ['single-trace attribution (unverified internal frame)'],
            rule: 'ownerRoute.events.GuardianSet',
        });
        expect(canonicalJson(alchemy.bundle)).not.toContain('alchemy');
        expect(canonicalJson(quicknode.bundle)).not.toContain('quicknode');
        expect(alchemy.runMetadata.traceProviders).toEqual(['alchemy']);
        expect(quicknode.runMetadata.traceProviders).toEqual(['quicknode']);
        expect(alchemy.runMetadata.providers).toEqual(quicknode.runMetadata.providers);
        expect(alchemy.runMetadata.sdkVersion).toBe(quicknode.runMetadata.sdkVersion);
        expect(alchemy.runMetadata.generatedAt).toBe(quicknode.runMetadata.generatedAt);
        const fileA = serializeEvidenceFile(alchemy);
        const fileB = serializeEvidenceFile(quicknode);
        expect(fileA).not.toBe(fileB);
        const parsedA = JSON.parse(fileA) as { bundle: unknown; digest: string; runMetadata: RunMetadata };
        const parsedB = JSON.parse(fileB) as { bundle: unknown; digest: string; runMetadata: RunMetadata };
        expect(parsedA.bundle).toEqual(parsedB.bundle);
        expect(parsedA.digest).toBe(parsedB.digest);
        expect(parsedA.runMetadata.traceProviders).toEqual(['alchemy']);
        expect(parsedB.runMetadata.traceProviders).toEqual(['quicknode']);
        expect(verifyEvidenceFile(fileA, { bundle: quicknode.bundle, digest: quicknode.digest }).ok).toBe(true);
        const flipped = build({ result: complete([traced('dual:quicknode+alchemy')], []) });
        const ordered = build({ result: complete([traced('dual:alchemy+quicknode')], []) });
        expect(flipped.digest).toBe(ordered.digest);
        expect(canonicalJson(flipped.bundle)).toBe(canonicalJson(ordered.bundle));
        expect(flipped.runMetadata.traceProviders).toEqual(['alchemy', 'quicknode']);
        expect(ordered.runMetadata.traceProviders).toEqual(['alchemy', 'quicknode']);
        expect(flipped.bundle.actions[0]!.attribution).toEqual({ attributionSource: 'dual', tag: 'kept' });
        expect(flipped.bundle.actions[0]!.verdict.flagged).toBe(true);
        expect(flipped.bundle.actions[0]!.verdict.rule).toBe('ownerRoute.events.GuardianSet');
        expect(flipped.bundle.actions[0]!.verdict.reasons).toEqual([
            'owner/guardian route: not BLS, no on-chain signer verification: GuardianSet',
        ]);
        const caller = { attributionSource: 'single:alchemy', tag: 'kept' };
        const found = action({
            blockNumber: 4, logIndex: 0, txHash: word('aa'), kind: 'owner', attribution: caller,
        });
        const aliased = build({ result: complete([found], []) });
        caller.attributionSource = 'single:quicknode';
        caller.tag = 'mutated';
        expect(aliased.bundle.actions[0]!.attribution).toEqual({ attributionSource: 'single', tag: 'kept' });
        expect(aliased.runMetadata.traceProviders).toEqual(['alchemy']);
        const returned = aliased.runMetadata.traceProviders as string[];
        returned.push('evil');
        const again = build({ result: complete([traced('single:alchemy')], []) });
        expect(again.runMetadata.traceProviders).toEqual(['alchemy']);
        const bad = 'single:https://rpc.example/secret';
        try {
            build({ result: complete([traced(bad)], []) });
            throw new Error('accepted a trace url');
        } catch (e) {
            expect((e as Error).message).toBe('evidence attribution kind is invalid');
            expect((e as Error).message).not.toContain('http');
            expect((e as Error).message).not.toContain('secret');
        }
        const published = alchemy;
        const embedded = structuredClone(published.bundle);
        (embedded.actions[0]!.attribution as { attributionSource: string }).attributionSource = 'single:alchemy';
        const embeddedText = `${canonicalJson({
            schema: 'aastar.guardian-audit.evidence-file.v1',
            bundle: embedded,
            digest: canonicalDigest(embedded),
            runMetadata: published.runMetadata,
        })}\n`;
        expect(() => parseEvidenceFile(embeddedText)).toThrow(/^evidence attribution kind is invalid$/);
        const unsorted = {
            ...published.runMetadata,
            traceProviders: ['quicknode', 'alchemy'],
        };
        expect(() => serializeEvidenceFile({
            bundle: published.bundle,
            digest: published.digest,
            runMetadata: unsorted,
        })).toThrow(/^traceProviders invalid$/);
        const urlMeta = { ...published.runMetadata, traceProviders: ['https://rpc.example/secret'] };
        try {
            serializeEvidenceFile({ bundle: published.bundle, digest: published.digest, runMetadata: urlMeta });
            throw new Error('accepted a trace url in metadata');
        } catch (e) {
            expect((e as Error).message).toBe('provider name is not a label');
            expect((e as Error).message).not.toContain('http');
        }
    });

    it('rejects an inverted range when the file is parsed', () => {
        const published = build({ result: complete([], []) });
        const inverted = structuredClone(published.bundle);
        inverted.range = { from: 9, to: 4 };
        const text = `${canonicalJson({
            schema: 'aastar.guardian-audit.evidence-file.v1',
            bundle: inverted,
            digest: canonicalDigest(inverted),
            runMetadata: published.runMetadata,
        })}\n`;
        expect(() => parseEvidenceFile(text)).toThrow(/^evidence range is invalid$/);
        const check = verifyEvidenceFile(text, { bundle: inverted, digest: canonicalDigest(inverted) });
        expect(check.ok).toBe(false);
        expect(check.reasons).toContain('evidence range is invalid');
    });

    it('rejects a second block hash at the same height when the file is parsed', () => {
        const published = build();
        const forged = structuredClone(published.bundle);
        const twin = structuredClone(forged.actions[0]!);
        twin.blockHash = word('a9');
        twin.log.blockHash = word('a9');
        twin.logIndex += 1;
        twin.log.logIndex = twin.logIndex;
        twin.txHash = word('ee');
        twin.log.transactionHash = word('ee');
        forged.actions.push(twin);
        const text = `${canonicalJson({
            schema: 'aastar.guardian-audit.evidence-file.v1',
            bundle: forged,
            digest: canonicalDigest(forged),
            runMetadata: published.runMetadata,
        })}\n`;
        expect(() => parseEvidenceFile(text)).toThrow(/^evidence block hash disagrees$/);
        const check = verifyEvidenceFile(text, { bundle: forged, digest: canonicalDigest(forged) });
        expect(check.ok).toBe(false);
        expect(check.reasons).toContain('evidence block hash disagrees');
    });

    it('rejects an unattributed count that does not equal the missing actions', () => {
        const bare = action({ blockNumber: 4, logIndex: 0, txHash: word('aa'), kind: 'owner', attribution: null });
        const built = build({ result: complete([bare], []) });
        expect(built.bundle.unattributed).toBe(1);
        const forged = structuredClone(built.bundle);
        forged.unattributed = 2;
        const text = `${canonicalJson({
            schema: 'aastar.guardian-audit.evidence-file.v1',
            bundle: forged,
            digest: canonicalDigest(forged),
            runMetadata: built.runMetadata,
        })}\n`;
        expect(() => parseEvidenceFile(text)).toThrow(/^unattributed count does not match$/);
        const check = verifyEvidenceFile(text, { bundle: forged, digest: canonicalDigest(forged) });
        expect(check.ok).toBe(false);
        expect(check.reasons).toContain('unattributed count does not match');
    });

    it('publishes a fixed reason when a custom ruleset would synthesize one past the cap', () => {
        const rs = structuredClone(DEFAULT_RULESET);
        const fn = rs.publicRoute.functions['updatePrice()']!;
        const names = Array.from({ length: 64 }, (_, i) => `E${String(i).padStart(63, '0')}`);
        fn.events = names;
        fn.flag = false;
        fn.flagIfCallAlsoEmits = names;
        fn.alsoReason = 'A'.repeat(1024);
        const found = action({ blockNumber: 4, logIndex: 0, txHash: word('aa'), kind: 'owner' });
        const record = {
            route: 'public' as const,
            selector: toFunctionSelector('updatePrice()'),
            event: names[0],
            callEvents: names,
        };
        const built = build({
            ruleset: rs,
            result: complete([found], []),
            classify: () => record,
        });
        expect(built.bundle.actions[0]!.verdict).toEqual({
            flagged: true,
            reasons: ['verdict reason too long'],
            rule: 'publicRoute.functions.updatePrice().also',
        });
        expect(() => serializeEvidenceFile(built)).not.toThrow();
    });

    it('enforces declared fact kinds for single-trace attribution inside the bundle', () => {
        const timelock = '0x4444444444444444444444444444444444444444' as Address;
        const timelockSig = 'execute(address,uint256,bytes)';
        const timelockRule = `bls.GENERIC.expected:timelock.${timelockSig}`;
        const relaySig = 'relay(bytes)';
        const relayRule = `publicRoute.functions.${relaySig}`;
        const rs = structuredClone(DEFAULT_RULESET);
        rs.bls.GENERIC.expected.push({
            target: 'timelock',
            signature: timelockSig,
            flag: false,
            reason: 'timelock executed a scheduled call',
        });
        rs.publicRoute.functions[relaySig] = { events: ['Relayed'], flag: false, reason: 'forwarded public call' };
        const factKinds: FactKindMap = {
            ...DEFAULT_FACT_KINDS,
            [timelockRule]: ['topLevel', 'receiptLogs'],
            [relayRule]: ['internalFrames'],
        };
        const roles = { superPaymaster: SP, timelock };
        const timelockAction = action({
            blockNumber: 4,
            logIndex: 0,
            txHash: word('aa'),
            kind: 'GENERIC',
            address: timelock,
            attribution: {
                attributionSource: 'single:alchemy',
                forwardingPath: [SP, timelock],
            },
            decoded: { kind: 'GENERIC', callData: toFunctionSelector(timelockSig) },
        });
        const relayAction = action({
            blockNumber: 4,
            logIndex: 1,
            txHash: word('bb'),
            kind: 'owner',
            attribution: { attributionSource: 'single' },
        });
        const dualRelay = action({
            blockNumber: 4,
            logIndex: 2,
            txHash: word('cc'),
            kind: 'owner',
            attribution: { attributionSource: 'dual:alchemy+quicknode' },
        });
        const built = build({
            result: complete([timelockAction, relayAction, dualRelay], []),
            ruleset: rs,
            roles,
            factKinds,
            classify: (found) => {
                if (found.txHash === word('aa')) {
                    return {
                        route: 'bls',
                        kind: 'GENERIC',
                        fields: { target: timelock, callData: toFunctionSelector(timelockSig) },
                    };
                }
                return { route: 'public', selector: toFunctionSelector(relaySig), event: 'Relayed' };
            },
        });
        const byTx = new Map(built.bundle.actions.map((item) => [item.txHash, item.verdict]));
        expect(byTx.get(word('aa'))).toEqual({
            flagged: false,
            reasons: ['timelock executed a scheduled call'],
            rule: timelockRule,
        });
        expect(byTx.get(word('bb'))).toEqual({
            flagged: true,
            reasons: ['single-trace attribution (unverified internal frame)'],
            rule: relayRule,
        });
        expect(byTx.get(word('cc'))?.flagged).toBe(false);
        expect(byTx.get(word('cc'))?.rule).toBe(relayRule);
    });

    it('puts classifier name, version, and rulesetSha256 inside the digested bundle', () => {
        const built = build({ result: complete([], []) });
        expect(built.bundle.classifier).toEqual({
            name: 'auditClassifier',
            version: '1.0.0',
            rulesetSha256: classifierRulesetSha256(DEFAULT_RULESET, DEFAULT_FACT_KINDS),
        });
        expect(canonicalJson(built.bundle)).toContain(built.bundle.classifier.rulesetSha256);
        expect(canonicalJson(built.bundle)).not.toContain('rulesetSha256 is');
        const named = build({ result: complete([], []), classifier: { name: 'otherClassifier', version: '0.46.0-rc.2' } });
        expect(named.digest).not.toBe(built.digest);
        expect(named.bundle.classifier.version).toBe('0.46.0-rc.2');
        expect(named.bundle.classifier.rulesetSha256).toBe(built.bundle.classifier.rulesetSha256);
        const caller = { name: 'auditClassifier', version: '1.0.0' };
        const aliased = build({ result: complete([], []), classifier: caller });
        caller.name = 'mutatedName';
        caller.version = '9.9.9';
        expect(aliased.bundle.classifier.name).toBe('auditClassifier');
        expect(aliased.bundle.classifier.version).toBe('1.0.0');
        const file = serializeEvidenceFile(built);
        expect(verifyEvidenceFile(file, { bundle: built.bundle, digest: built.digest }).ok).toBe(true);
        const stripped = structuredClone(built.bundle) as unknown as Record<string, unknown>;
        delete stripped.classifier;
        const strippedText = `${canonicalJson({
            schema: 'aastar.guardian-audit.evidence-file.v1',
            bundle: stripped,
            digest: canonicalDigest(stripped),
            runMetadata: built.runMetadata,
        })}\n`;
        expect(() => parseEvidenceFile(strippedText)).toThrow(/^classifier missing$/);
        const missing = verifyEvidenceFile(strippedText, { bundle: built.bundle, digest: built.digest });
        expect(missing.ok).toBe(false);
        expect(missing.reasons).toContain('classifier missing');
    });

    it('changes the bundle digest when the ruleset or the fact-kind map changes', () => {
        const base = build({ result: complete([], []) });
        const rs = structuredClone(DEFAULT_RULESET);
        rs.comment = 'different ruleset text';
        const otherRules = build({ result: complete([], []), ruleset: rs });
        expect(otherRules.bundle.ruleset.digest).not.toBe(base.bundle.ruleset.digest);
        expect(otherRules.bundle.classifier.rulesetSha256).not.toBe(base.bundle.classifier.rulesetSha256);
        expect(otherRules.digest).not.toBe(base.digest);
        const swapped: FactKindMap = { ...DEFAULT_FACT_KINDS, 'bls.SLASH': ['internalFrames'] };
        const otherMap = build({ result: complete([], []), factKinds: swapped });
        expect(otherMap.bundle.ruleset.digest).toBe(base.bundle.ruleset.digest);
        expect(otherMap.bundle.classifier.rulesetSha256).not.toBe(base.bundle.classifier.rulesetSha256);
        expect(otherMap.digest).not.toBe(base.digest);
        const rerun = verifyEvidenceFile(serializeEvidenceFile(base), { bundle: otherMap.bundle, digest: otherMap.digest });
        expect(rerun.ok).toBe(false);
        expect(rerun.reasons).toContain('rerun digest differs from the file digest');
        const map = { ...DEFAULT_FACT_KINDS };
        const snap = build({ result: complete([], []), factKinds: map });
        map['bls.SLASH'] = ['internalFrames'];
        expect(snap.bundle.classifier.rulesetSha256).toBe(base.bundle.classifier.rulesetSha256);
    });

    it('rejects a classifier that is missing, ill-formed, or caller-supplied rulesetSha256', () => {
        let calls = 0;
        const count = () => {
            calls += 1;
            return { route: 'owner' as const, event: 'GuardianSet' };
        };
        const url = 'https://classifier.example/secret';
        try {
            build({
                result: complete([], []),
                classifier: { name: url, version: '1.0.0' },
                classify: count,
            });
            throw new Error('accepted a classifier url');
        } catch (error) {
            expect((error as Error).message).toBe('classifier name is invalid');
            expect((error as Error).message).not.toContain('secret');
            expect((error as Error).message).not.toContain('http');
        }
        expect(calls).toBe(0);
        expect(() => build({
            result: complete([], []),
            classifier: { name: 'auditClassifier', version: 'v1.0.0' },
        })).toThrow(/^classifier version is invalid$/);
        expect(() => build({
            result: complete([], []),
            classifier: { name: 'a'.repeat(65), version: '1.0.0' },
        })).toThrow(/^classifier name is invalid$/);
        const supplied = {
            name: 'auditClassifier',
            version: '1.0.0',
            rulesetSha256: `0x${'ab'.repeat(32)}`,
        };
        expect(() => build({
            result: complete([], []),
            classifier: supplied as unknown as { name: string; version: string },
        })).toThrow(/^classifier is invalid$/);
        const published = build({ result: complete([], []) });
        const badName = structuredClone(published.bundle);
        badName.classifier = { ...badName.classifier, name: url };
        const badNameText = `${canonicalJson({
            schema: 'aastar.guardian-audit.evidence-file.v1',
            bundle: badName,
            digest: canonicalDigest(badName),
            runMetadata: published.runMetadata,
        })}\n`;
        expect(() => parseEvidenceFile(badNameText)).toThrow(/^classifier name is invalid$/);
        const nameCheck = verifyEvidenceFile(badNameText, { bundle: published.bundle, digest: published.digest });
        expect(nameCheck.ok).toBe(false);
        expect(nameCheck.reasons).toContain('classifier name is invalid');
        expect(nameCheck.reasons.join(' ')).not.toContain('secret');
        const badHash = structuredClone(published.bundle);
        badHash.classifier = { ...badHash.classifier, rulesetSha256: 'not-a-hash' as typeof badHash.classifier.rulesetSha256 };
        const badHashText = `${canonicalJson({
            schema: 'aastar.guardian-audit.evidence-file.v1',
            bundle: badHash,
            digest: published.digest,
            runMetadata: published.runMetadata,
        })}\n`;
        expect(() => parseEvidenceFile(badHashText)).toThrow(/^classifier rulesetSha256 is invalid$/);
        const shaped = structuredClone(published.bundle);
        shaped.classifier = { ...shaped.classifier, rulesetSha256: `0x${'cd'.repeat(32)}` };
        const shapedText = `${canonicalJson({
            schema: 'aastar.guardian-audit.evidence-file.v1',
            bundle: shaped,
            digest: canonicalDigest(shaped),
            runMetadata: published.runMetadata,
        })}\n`;
        expect(parseEvidenceFile(shapedText).bundle.classifier.rulesetSha256).toBe(`0x${'cd'.repeat(32)}`);
        const shapedCheck = verifyEvidenceFile(shapedText, { bundle: published.bundle, digest: published.digest });
        expect(shapedCheck.ok).toBe(false);
        expect(shapedCheck.reasons).toContain('rerun digest differs from the file digest');
    });

    it('exports a provider-name predicate and not the pattern', () => {
        expect(guardianAudit).not.toHaveProperty('PROVIDER_NAME_RE');
        expect(rpcMod).not.toHaveProperty('PROVIDER_NAME_RE');
        expect(isProviderName('alchemy')).toBe(true);
        expect(isProviderName('a.b_c-1')).toBe(true);
        expect(isProviderName('https://rpc.example')).toBe(false);
        expect(isProviderName('')).toBe(false);
        expect(isProviderName('a'.repeat(65))).toBe(false);
        expect(isProviderName(1)).toBe(false);
    });
});
