import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { formatEther, parseEther } from 'viem';

/**
 * Schema contract for the gasless data collector (`scripts/l4-gasless-op-mainnet.ts`).
 *
 * The collector is a mainnet script that cannot be imported here (top-level side effects), so this
 * mirrors its row/header construction and locks the invariants a reader of the CSV depends on.
 * The reason it exists: the v3 schema shipped UNREACHABLE — a CLI gate coerced `--csv-format v3`
 * down to `v1`, and nothing failed, because no test ever selected v3. A test that has to name the
 * format to exercise the branch makes that class of bug impossible to ship silently.
 */

const HEADERS = {
    v1: 'Timestamp,Label,TxHash,GasUsed(L2),L1Fee(Wei),TotalCost(ETH),xPNTsConsumed,TokenName',
    v2: 'Timestamp,Label,TxHash,GasUsed(L2),L2ExecutionFee(Wei),L1DataFee(Wei),TotalCost(Wei),TotalCost(ETH),xPNTsConsumed,TokenName',
    v3: 'Timestamp,Label,TxHash,GasUsed(L2),TxGasUsed,ActualGasUsed,EffectiveGasPriceWei,L2ExecutionFee(Wei),L1DataFee(Wei),TotalCost(Wei),TotalCost(ETH),SettlementRate,xPNTsConsumed,TokenName',
} as const;

/** Mirror of the collector's settlement-rate computation (bigint wei, 4 dp, no float round-trip). */
function settlementRate(measuredXpnts: string | undefined, totalCostWei: bigint): string {
    if (measuredXpnts === undefined || totalCostWei <= 0n) return '';
    const xpntsWei = parseEther(measuredXpnts);
    const SCALE = 10_000n;
    const scaled = (xpntsWei * SCALE) / totalCostWei;
    return `${scaled / SCALE}.${(scaled % SCALE).toString().padStart(4, '0')}`;
}

function v3Row(p: {
    gasUsed: bigint; actualGasUsed?: bigint; effectiveGasPriceWei?: bigint;
    l2ExecutionFeeWei: bigint; l1FeeWei: bigint; totalCostWei: bigint;
    xpntsConsumed?: string; tokenName?: string;
}): string {
    const totalCostEth = formatEther(p.totalCostWei);
    return [
        '2026-08-18T00:00:00.000Z', 'label', '0xtx',
        p.gasUsed.toString(), p.gasUsed.toString(),
        p.actualGasUsed?.toString() ?? '', p.effectiveGasPriceWei?.toString() ?? '',
        p.l2ExecutionFeeWei.toString(), p.l1FeeWei.toString(), p.totalCostWei.toString(),
        totalCostEth, settlementRate(p.xpntsConsumed, p.totalCostWei),
        p.xpntsConsumed ?? '', p.tokenName ?? 'N/A',
    ].join(',');
}

const base = {
    gasUsed: 167_830n, actualGasUsed: 184_000n, effectiveGasPriceWei: 852_000_000n,
    l2ExecutionFeeWei: 143_000_000_000_000n, l1FeeWei: 0n, totalCostWei: 143_000_000_000_000n,
    tokenName: 'aPNTs',
};

describe('CSV schema versions', () => {
    it('every format keeps header and row field counts in lockstep', () => {
        expect(HEADERS.v1.split(',')).toHaveLength(8);
        expect(HEADERS.v2.split(',')).toHaveLength(10);
        expect(HEADERS.v3.split(',')).toHaveLength(14);
        expect(v3Row({ ...base, xpntsConsumed: '11.2676' }).split(',')).toHaveLength(HEADERS.v3.split(',').length);
    });

    it('v3 is a strict superset of v2 — existing readers map by column NAME, so inserts are safe', () => {
        for (const col of HEADERS.v2.split(',')) expect(HEADERS.v3.split(',')).toContain(col);
    });

    it('v1/v2 headers are frozen — archived CSVs are pinned by published papers', () => {
        expect(HEADERS.v1).toBe('Timestamp,Label,TxHash,GasUsed(L2),L1Fee(Wei),TotalCost(ETH),xPNTsConsumed,TokenName');
        expect(HEADERS.v2).toContain('GasUsed(L2)');
        expect(HEADERS.v2).not.toContain('TxGasUsed');
    });
});

describe('SettlementRate', () => {
    it('reproduces the mechanism constant from CC-93 real data', () => {
        // High-gas-price cluster: 11.2676 xPNTs over 0.000143 ETH.
        expect(settlementRate('11.2676', parseEther('0.000143'))).toBe('78794.4055');
    });

    it('is the SAME order of magnitude across the two gas-price clusters', () => {
        // This is the whole point: xPNTsConsumed differs 539x, the rate does not.
        const hi = Number(settlementRate('11.2676', parseEther('0.000143')));
        const lo = Number(settlementRate('0.0209', parseEther('0.00000029')));
        expect(Math.abs(hi - lo) / hi).toBeLessThan(0.15);
    });

    it('is EMPTY, not zero, when xPNTs was never measured', () => {
        // A fabricated 0.0000 is byte-indistinguishable from a genuine zero-consumption row and
        // would contaminate the CV statistic this schema exists to protect.
        const row = v3Row({ ...base, xpntsConsumed: undefined }).split(',');
        const cols = HEADERS.v3.split(',');
        expect(row[cols.indexOf('SettlementRate')]).toBe('');
        expect(row[cols.indexOf('xPNTsConsumed')]).toBe('');
    });

    it('is EMPTY on a zero-cost row rather than Infinity/NaN', () => {
        expect(settlementRate('1.0', 0n)).toBe('');
    });

    it('distinguishes a MEASURED zero from an unmeasured one', () => {
        expect(settlementRate('0', parseEther('0.0001'))).toBe('0.0000');
        expect(settlementRate(undefined, parseEther('0.0001'))).toBe('');
    });

    it('avoids the float round-trip — exact at 18-decimal precision', () => {
        // Number(formatEther(wei)) loses precision on large/awkward values; bigint math does not.
        expect(settlementRate('1', 1n)).toBe(`${10n ** 18n}.0000`);
    });
});

describe('unmeasured columns use one sentinel', () => {
    it('absent ActualGasUsed / EffectiveGasPriceWei are empty, never 0', () => {
        const cols = HEADERS.v3.split(',');
        const row = v3Row({ ...base, actualGasUsed: undefined, effectiveGasPriceWei: undefined, xpntsConsumed: '1' }).split(',');
        expect(row[cols.indexOf('ActualGasUsed')]).toBe('');
        expect(row[cols.indexOf('EffectiveGasPriceWei')]).toBe('');
        // …while an operation-intrinsic column that IS always measured stays populated.
        expect(row[cols.indexOf('TxGasUsed')]).toBe('167830');
    });
});

describe('the collector wires v3 through (regression for the unreachable-schema bug)', () => {
    const src = fs.readFileSync(
        path.resolve(import.meta.dirname, '../../../scripts/l4-gasless-op-mainnet.ts'),
        'utf8',
    );

    it('does not silently coerce an unknown --csv-format down to v1', () => {
        // The shipped bug: `csvFormatArg === 'v2' ? 'v2' : 'v1'` made v3 unreachable everywhere.
        expect(src).not.toMatch(/csvFormatArg === 'v2' \? 'v2' : 'v1'/);
        expect(src).toMatch(/--csv-format must be one of v1 \| v2 \| v3/);
    });

    it('infers v3 from a _v3.csv filename', () => {
        expect(src).toMatch(/endsWith\('_v3\.csv'\)/);
    });

    it('declares v3 in the format union and emits a v3 header', () => {
        expect(src).toMatch(/type CsvFormat = 'v1' \| 'v2' \| 'v3'/);
        expect(src).toContain('SettlementRate');
    });

    it('temp-file smoke: header and row agree in field count', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'csv-schema-'));
        const f = path.join(dir, 'out_v3.csv');
        fs.writeFileSync(f, HEADERS.v3 + '\n');
        fs.appendFileSync(f, v3Row({ ...base, xpntsConsumed: '11.2676' }) + '\n');
        const [h, r] = fs.readFileSync(f, 'utf8').trim().split('\n');
        expect(r.split(',')).toHaveLength(h.split(',').length);
        fs.rmSync(dir, { recursive: true, force: true });
    });
});
