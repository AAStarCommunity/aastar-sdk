import { describe, expect, it } from 'vitest';
import { getAddress, toFunctionSelector, type Address, type Hex } from 'viem';
import { canonicalJson } from '../../src/guardianAudit/canonical';
import {
    buildEvidenceBundle, evidenceFileSha256, parseEvidenceFile, serializeEvidenceFile, verifyEvidenceBundle, verifyEvidenceFile,
    type EvidenceBundle, type RunMetadata,
} from '../../src/guardianAudit/bundle';
import { DEFAULT_RULESET, rulesetId, type RuleRecord, type Ruleset } from '../../src/guardianAudit/rules';
import type { DecodedAction, FoundAction, ScanResult } from '../../src/guardianAudit/scan';
import type { RawLog } from '../../src/guardianAudit/rpc';

const SP = '0x2222222222222222222222222222222222222222' as Address;
const SCOPE = `0x${'ab'.repeat(32)}` as Hex;
const priceCall = `${toFunctionSelector('updatePriceDVT(int256,uint256,bytes,uint8)')}${'cd'.repeat(16)}`;

function word(ch: string): Hex {
    return `0x${ch.repeat(64)}` as Hex;
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
        attribution: over.attribution,
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
        expect(first.bundle.actions[0]?.attribution).toBeNull();
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
        expect(() => parseEvidenceFile(JSON.stringify(extraTop) + '\n')).toThrow(/unknown key note/);
        const extraMeta = JSON.parse(text) as { runMetadata: Record<string, unknown> };
        extraMeta.runMetadata.endpoint = 'https://rpc.example';
        expect(() => parseEvidenceFile(JSON.stringify(extraMeta) + '\n')).toThrow(/runMetadata: unknown key endpoint/);
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
});
