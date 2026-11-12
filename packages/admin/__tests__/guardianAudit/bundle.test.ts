import { describe, expect, it } from 'vitest';
import { getAddress, toFunctionSelector, type Address, type Hex } from 'viem';
import { canonicalDigest, canonicalJson } from '../../src/guardianAudit/canonical';
import {
    MAX_EVIDENCE_FILE_BYTES, buildEvidenceBundle, evidenceFileSha256, parseEvidenceFile, serializeEvidenceFile,
    verifyEvidenceBundle, verifyEvidenceFile, type EvidenceBundle, type RunMetadata,
} from '../../src/guardianAudit/bundle';
import { DEFAULT_RULESET, rulesetId, type RuleRecord, type Ruleset } from '../../src/guardianAudit/rules';
import type { DecodedAction, FoundAction, ScanResult } from '../../src/guardianAudit/scan';
import type { RawLog } from '../../src/guardianAudit/rpc';

const SP = '0x2222222222222222222222222222222222222222' as Address;
const SCOPE = `0x${'ab'.repeat(32)}` as Hex;
const priceCall = `${toFunctionSelector('updatePriceDVT(int256,uint256,bytes,uint8)')}${'cd'.repeat(16)}`;

function word(ch: string): Hex {
    return `0x${ch.repeat(64 / ch.length)}` as Hex;
}

function logOf(block: number, txHash: Hex, index: number, address: Address): RawLog {
    return {
        address,
        topics: [word('11')],
        data: '0x',
        blockNumber: `0x${block.toString(16)}` as Hex,
        blockHash: word('a1'),
        transactionHash: txHash,
        logIndex: `0x${index.toString(16)}` as Hex,
    };
}

function action(over: Partial<FoundAction> & Pick<FoundAction, 'blockNumber' | 'txHash' | 'logIndex' | 'kind'>): FoundAction {
    const address = over.address ?? SP;
    const decoded: DecodedAction = over.decoded ?? { kind: over.kind, callData: priceCall };
    return {
        blockNumber: over.blockNumber,
        blockHash: over.blockHash ?? word('a1'),
        txHash: over.txHash,
        logIndex: over.logIndex,
        address,
        kind: over.kind,
        decoded,
        log: over.log ?? logOf(over.blockNumber, over.txHash, over.logIndex, address),
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
    action({ blockNumber: 5, logIndex: 1, txHash: word('bb'), kind: 'GENERIC', attribution: { who: SP, tag: 'bls' } }),
    action({ blockNumber: 5, logIndex: 1, txHash: word('aa'), kind: 'owner' }),
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
            word('cc'), word('aa'), word('bb'),
        ]);
        expect(first.bundle.resolvedPrior.map((item) => item.blockNumber)).toEqual([1, 8]);
        expect(first.bundle.actions[0]?.verdict.rule).toBe('ownerRoute.events.GuardianSet');
        expect(first.bundle.actions[2]?.verdict.rule).toBe('bls.GENERIC.expected:superPaymaster.updatePriceDVT(int256,uint256,bytes,uint8)');
        expect(first.bundle.actions[2]?.attribution).toEqual({ who: SP, tag: 'bls' });
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
        const lyingText = serializeEvidenceFile(lying);
        expect(() => parseEvidenceFile(lyingText)).toThrow(/evidence digest mismatch/);
        const rejected = verifyEvidenceFile(pretty, { bundle: build().bundle, digest: build().digest });
        expect(rejected.ok).toBe(false);
        expect(rejected.sha256).toBe(evidenceFileSha256(pretty));
    });

    it('puts the unattributed count in the digested bundle', () => {
        const result: ScanResult = {
            state: 'UNATTRIBUTED',
            unattributed: 4,
            count: 1,
            from: 4,
            to: 9,
            actions: [baseActions[2]!],
            resolvedPrior: [],
            bloomRecovered: 0,
            bloomFalsePositives: 0,
            ignored: 0,
        };
        const built = build({ result });
        expect(built.bundle.unattributed).toBe(4);
        expect(built.bundle.state).toBe('UNATTRIBUTED');
        const other = build({ result: { ...result, unattributed: 5 } });
        expect(other.digest).not.toBe(built.digest);
    });

    it('verifyEvidenceBundle detects a one-byte change', () => {
        const { bundle, digest } = build();
        expect(verifyEvidenceBundle(bundle, digest)).toBe(true);
        expect(verifyEvidenceBundle(bundle, flipByte(digest))).toBe(false);
        const scoped = { ...bundle, scope: flipByte(bundle.scope) };
        expect(verifyEvidenceBundle(scoped, digest)).toBe(false);
    });

    it('rejects a complete bundle that omits attribution, range, count, or chainId', () => {
        const caughtUp = complete([], []);
        caughtUp.from = 10;
        caughtUp.to = 9;
        const empty = build({ result: caughtUp });
        expect(empty.bundle.state).toBe('COMPLETE');
        expect(empty.bundle.actions).toEqual([]);
        expect(empty.bundle.range).toEqual({ from: 10, to: 9 });

        const bare = action({ blockNumber: 4, logIndex: 0, txHash: word('aa'), kind: 'owner' });
        delete bare.attribution;
        expect(() => build({ result: complete([bare], []) })).toThrow(/complete scan has an unattributed action/);
        const prior = action({ blockNumber: 1, logIndex: 0, txHash: word('bb'), kind: 'owner' });
        delete prior.attribution;
        expect(() => build({ result: complete([], [prior]) })).toThrow(/complete scan has an unattributed action/);

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
        expect(() => build({ result: uncounted })).toThrow(/unattributed count missing/);

        const wide = action({ blockNumber: 4, logIndex: 0, txHash: word('aa'), kind: 'owner' });
        wide.decoded = { kind: 'owner' };
        for (let i = 0; i < 65; i++) wide.decoded[`k${i}`] = i;
        expect(() => build({ result: complete([wide], []) })).toThrow(/too large/);
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
            action({ blockNumber: 1, logIndex: 0, txHash: word('aa'), kind: 'owner' }),
            action({ blockNumber: 2, logIndex: 0, txHash: word('bb'), kind: 'owner' }),
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
                action({ blockNumber: 1, logIndex: 0, txHash: word('aa'), kind: 'GENERIC' }),
                action({ blockNumber: 2, logIndex: 0, txHash: word('bb'), kind: 'GENERIC' }),
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
        const blob = 'a'.repeat(1_000_000);
        const seed = action({ blockNumber: 4, logIndex: 0, txHash: word('aa'), kind: 'owner' });
        const packed = build({ result: complete([seed], []) }).bundle.actions[0]!;
        const actions = [];
        for (let i = 0; i < 70; i++) {
            const copy = structuredClone(packed);
            copy.logIndex = i;
            copy.log.logIndex = i;
            (copy.decoded as { blob?: string }).blob = blob;
            actions.push(copy);
        }
        const bundle = { ...structuredClone(built.bundle), actions, resolvedPrior: [] as typeof actions };
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
        const a = build({ result: complete([left], []) });
        const b = build({ result: complete([right], []) });
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

    it('orders equal positions by blockHash then txHash', () => {
        const laterHash = action({ blockNumber: 5, logIndex: 1, txHash: word('aa'), blockHash: word('a2'), kind: 'owner' });
        const earlierHash = action({ blockNumber: 5, logIndex: 1, txHash: word('ff'), blockHash: word('a1'), kind: 'owner' });
        const byHash = build({ result: complete([laterHash, earlierHash], []) });
        expect(byHash.bundle.actions.map((item) => item.blockHash)).toEqual([word('a1'), word('a2')]);
        const aa = action({ blockNumber: 5, logIndex: 1, txHash: word('aa'), blockHash: word('b2'), kind: 'owner' });
        const cc = action({ blockNumber: 5, logIndex: 1, txHash: word('cc'), blockHash: word('b2'), kind: 'owner' });
        const byTx = build({ result: complete([cc, aa], []) });
        expect(byTx.bundle.actions.map((item) => item.txHash)).toEqual([word('aa'), word('cc')]);
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
        expect(() => build({ result: complete([found], []) })).toThrow(/^evidence value too large$/);
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
});
