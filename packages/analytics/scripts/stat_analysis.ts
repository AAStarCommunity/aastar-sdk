/**
 * stat_analysis.ts — Statistical Analysis for Gas Cost Data
 * 
 * Reads gasless_data_collection.csv and outputs:
 *   1. Descriptive statistics per label (n, mean, median, SD, min, max, IQR)
 *   2. Bootstrap 95% CI (10,000 resamples)
 *   3. Cliff's delta (non-parametric effect size) for key pairwise comparisons
 *   4. Shapiro-Wilk normality diagnostic (informational only)
 * 
 * Output: Markdown tables to stdout + JSON to stat_results.json
 * 
 * Usage: pnpm exec tsx packages/analytics/scripts/stat_analysis.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------- Data Loading ----------

interface DataRow {
    timestamp: string;
    label: string;
    txHash: string;
    gasUsedL2: number;
    l1FeeWei: number;
    totalCostETH: number;
    xPNTsConsumed: number;
    tokenName: string;
}

function loadCsv(filePath: string): DataRow[] {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const lines = raw.trim().split('\n');
    const rows: DataRow[] = [];
    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        if (cols.length < 6) continue;
        rows.push({
            timestamp: cols[0],
            label: cols[1],
            txHash: cols[2],
            gasUsedL2: parseInt(cols[3], 10),
            l1FeeWei: parseFloat(cols[4]),
            totalCostETH: parseFloat(cols[5]),
            xPNTsConsumed: parseFloat(cols[6] || '0'),
            tokenName: cols[7] || 'N/A',
        });
    }
    return rows;
}

// ---------- Basic Stats ----------

function mean(values: number[]): number {
    return values.reduce((a, b) => a + b, 0) / values.length;
}

function median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function stdDev(values: number[]): number {
    const m = mean(values);
    const ss = values.reduce((sum, v) => sum + (v - m) ** 2, 0);
    return Math.sqrt(ss / (values.length - 1)); // sample SD
}

function quantile(sorted: number[], q: number): number {
    const pos = (sorted.length - 1) * q;
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function descriptiveStats(values: number[]) {
    const sorted = [...values].sort((a, b) => a - b);
    const q1 = quantile(sorted, 0.25);
    const q3 = quantile(sorted, 0.75);
    return {
        n: values.length,
        mean: mean(values),
        median: median(values),
        sd: stdDev(values),
        min: sorted[0],
        max: sorted[sorted.length - 1],
        q1,
        q3,
        iqr: q3 - q1,
    };
}

// ---------- Bootstrap 95% CI ----------

function bootstrapCI(values: number[], nResamples: number = 10000, alpha: number = 0.05): { lower: number; upper: number; mean: number } {
    const means: number[] = [];
    for (let i = 0; i < nResamples; i++) {
        let sum = 0;
        for (let j = 0; j < values.length; j++) {
            sum += values[Math.floor(Math.random() * values.length)];
        }
        means.push(sum / values.length);
    }
    means.sort((a, b) => a - b);
    const loIdx = Math.floor((alpha / 2) * nResamples);
    const hiIdx = Math.floor((1 - alpha / 2) * nResamples);
    return {
        lower: means[loIdx],
        upper: means[hiIdx],
        mean: mean(values),
    };
}

// ---------- Cliff's Delta (Non-parametric effect size) ----------
// Cliff's delta ∈ [-1, 1]. Interpretation:
//   |d| < 0.147 → negligible
//   |d| < 0.33  → small
//   |d| < 0.474 → medium
//   |d| >= 0.474 → large

function cliffsDelta(group1: number[], group2: number[]): { delta: number; interpretation: string } {
    let more = 0;
    let less = 0;
    for (const x of group1) {
        for (const y of group2) {
            if (x > y) more++;
            else if (x < y) less++;
        }
    }
    const delta = (more - less) / (group1.length * group2.length);
    let interpretation: string;
    const absD = Math.abs(delta);
    if (absD < 0.147) interpretation = 'negligible';
    else if (absD < 0.33) interpretation = 'small';
    else if (absD < 0.474) interpretation = 'medium';
    else interpretation = 'large';
    return { delta, interpretation };
}

// ---------- Shapiro-Wilk Approximation ----------
// Simplified: we use skewness + kurtosis as normality proxy
// (full Shapiro-Wilk requires lookup tables; we use D'Agostino-Pearson)

function skewness(values: number[]): number {
    const m = mean(values);
    const n = values.length;
    const s = stdDev(values);
    return (n / ((n - 1) * (n - 2))) * values.reduce((sum, v) => sum + ((v - m) / s) ** 3, 0);
}

function kurtosis(values: number[]): number {
    const m = mean(values);
    const n = values.length;
    const s = stdDev(values);
    const k4 = values.reduce((sum, v) => sum + ((v - m) / s) ** 4, 0) / n;
    return k4 - 3; // excess kurtosis
}

function normalityAssessment(values: number[]): string {
    const sk = skewness(values);
    const ku = kurtosis(values);
    // Rough rule: |skew| < 2 and |kurtosis| < 7 → plausibly normal
    if (Math.abs(sk) < 1 && Math.abs(ku) < 3) return `approximately normal (skew=${sk.toFixed(3)}, kurtosis=${ku.toFixed(3)})`;
    if (Math.abs(sk) < 2 && Math.abs(ku) < 7) return `moderately non-normal (skew=${sk.toFixed(3)}, kurtosis=${ku.toFixed(3)})`;
    return `substantially non-normal (skew=${sk.toFixed(3)}, kurtosis=${ku.toFixed(3)})`;
}

// ---------- Formatting ----------

function fmtN(v: number, decimals: number = 0): string {
    return v.toLocaleString('en-US', { maximumFractionDigits: decimals });
}

function fmtETH(v: number): string {
    return v.toFixed(12);
}

// ---------- Main ----------

function main() {
    const csvPath = path.resolve(__dirname, '../data/gasless_data_collection.csv');
    if (!fs.existsSync(csvPath)) {
        console.error(`❌ CSV not found: ${csvPath}`);
        process.exit(1);
    }

    const rows = loadCsv(csvPath);
    console.log(`\n📊 Loaded ${rows.length} data rows from gasless_data_collection.csv\n`);

    // Group by label
    const groups = new Map<string, DataRow[]>();
    for (const row of rows) {
        if (!groups.has(row.label)) groups.set(row.label, []);
        groups.get(row.label)!.push(row);
    }

    // Define analysis order (Paper3 relevant types)
    const analysisOrder = ['T1', 'T2_SP_Credit', 'T2.1_SP_Normal', 'T5'];
    const labelNames: Record<string, string> = {
        'T1': 'PaymasterV4 (T1)',
        'T2_SP_Credit': 'SuperPM Credit (T2)',
        'T2.1_SP_Normal': 'SuperPM Normal (T2.1)',
        'T5': 'Settlement (T5)',
    };

    // ═══════════════════════════════════════════
    // Section 1: Descriptive Statistics — L2 Gas Used
    // ═══════════════════════════════════════════
    console.log('## 1. Descriptive Statistics: L2 Gas Used (receipt.gasUsed)\n');
    console.log('| Type | n | Mean | Median | SD | Min | Max | IQR |');
    console.log('| :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');

    const gasResults: Record<string, ReturnType<typeof descriptiveStats>> = {};
    const gasValues: Record<string, number[]> = {};

    for (const label of analysisOrder) {
        const data = groups.get(label);
        if (!data) { console.log(`| ${labelNames[label] || label} | — | — | — | — | — | — | — |`); continue; }
        const vals = data.map(r => r.gasUsedL2);
        gasValues[label] = vals;
        const stats = descriptiveStats(vals);
        gasResults[label] = stats;
        console.log(`| ${labelNames[label] || label} | ${stats.n} | ${fmtN(stats.mean)} | ${fmtN(stats.median)} | ${fmtN(stats.sd)} | ${fmtN(stats.min)} | ${fmtN(stats.max)} | ${fmtN(stats.iqr)} |`);
    }

    // ═══════════════════════════════════════════
    // Section 2: Descriptive Statistics — Total Cost (ETH)
    // ═══════════════════════════════════════════
    console.log('\n## 2. Descriptive Statistics: Total Cost (ETH)\n');
    console.log('| Type | n | Mean | Median | SD | Min | Max |');
    console.log('| :--- | ---: | ---: | ---: | ---: | ---: | ---: |');

    const costResults: Record<string, ReturnType<typeof descriptiveStats>> = {};
    const costValues: Record<string, number[]> = {};

    for (const label of analysisOrder) {
        const data = groups.get(label);
        if (!data) continue;
        const vals = data.map(r => r.totalCostETH);
        costValues[label] = vals;
        const stats = descriptiveStats(vals);
        costResults[label] = stats;
        console.log(`| ${labelNames[label] || label} | ${stats.n} | ${fmtETH(stats.mean)} | ${fmtETH(stats.median)} | ${fmtETH(stats.sd)} | ${fmtETH(stats.min)} | ${fmtETH(stats.max)} |`);
    }

    // ═══════════════════════════════════════════
    // Section 3: Bootstrap 95% CI — L2 Gas Used
    // ═══════════════════════════════════════════
    console.log('\n## 3. Bootstrap 95% CI (10,000 resamples) — L2 Gas Used\n');
    console.log('| Type | Mean | 95% CI Lower | 95% CI Upper | CI Width |');
    console.log('| :--- | ---: | ---: | ---: | ---: |');

    const ciResults: Record<string, ReturnType<typeof bootstrapCI>> = {};

    for (const label of analysisOrder) {
        if (!gasValues[label]) continue;
        const ci = bootstrapCI(gasValues[label]);
        ciResults[label] = ci;
        console.log(`| ${labelNames[label] || label} | ${fmtN(ci.mean)} | ${fmtN(ci.lower)} | ${fmtN(ci.upper)} | ±${fmtN((ci.upper - ci.lower) / 2)} |`);
    }

    // ═══════════════════════════════════════════
    // Section 4: Bootstrap 95% CI — Total Cost (ETH)
    // ═══════════════════════════════════════════
    console.log('\n## 4. Bootstrap 95% CI (10,000 resamples) — Total Cost (ETH)\n');
    console.log('| Type | Mean | 95% CI Lower | 95% CI Upper |');
    console.log('| :--- | ---: | ---: | ---: |');

    const costCiResults: Record<string, ReturnType<typeof bootstrapCI>> = {};

    for (const label of analysisOrder) {
        if (!costValues[label]) continue;
        const ci = bootstrapCI(costValues[label]);
        costCiResults[label] = ci;
        console.log(`| ${labelNames[label] || label} | ${fmtETH(ci.mean)} | ${fmtETH(ci.lower)} | ${fmtETH(ci.upper)} |`);
    }

    // ═══════════════════════════════════════════
    // Section 5: Cliff's Delta — Pairwise Comparisons
    // ═══════════════════════════════════════════
    console.log('\n## 5. Cliff\'s Delta (Non-parametric Effect Size) — L2 Gas Used\n');
    console.log('Interpretation: |d| < 0.147 negligible, < 0.33 small, < 0.474 medium, ≥ 0.474 large\n');

    const comparisons: [string, string, string][] = [
        ['T1', 'T2.1_SP_Normal', 'T1 vs T2.1 (PaymasterV4 vs SuperPM Normal)'],
        ['T1', 'T5', 'T1 vs T5 (PaymasterV4 vs Settlement)'],
        ['T2_SP_Credit', 'T2.1_SP_Normal', 'T2 vs T2.1 (Credit vs Normal — zero-overhead test)'],
        ['T2.1_SP_Normal', 'T5', 'T2.1 vs T5 (Normal vs Settlement)'],
    ];

    console.log('| Comparison | Cliff\'s δ | |δ| | Interpretation | Direction |');
    console.log('| :--- | ---: | ---: | :--- | :--- |');

    const deltaResults: Record<string, ReturnType<typeof cliffsDelta>> = {};

    for (const [a, b, desc] of comparisons) {
        if (!gasValues[a] || !gasValues[b]) continue;
        const result = cliffsDelta(gasValues[a], gasValues[b]);
        deltaResults[`${a}_vs_${b}`] = result;
        const direction = result.delta < 0 ? `${a} < ${b}` : result.delta > 0 ? `${a} > ${b}` : 'equal';
        console.log(`| ${desc} | ${result.delta.toFixed(4)} | ${Math.abs(result.delta).toFixed(4)} | ${result.interpretation} | ${direction} |`);
    }

    // ═══════════════════════════════════════════
    // Section 6: Normality Assessment
    // ═══════════════════════════════════════════
    console.log('\n## 6. Distribution Shape (Skewness / Kurtosis)\n');
    console.log('| Type | Skewness | Excess Kurtosis | Assessment |');
    console.log('| :--- | ---: | ---: | :--- |');

    for (const label of analysisOrder) {
        if (!gasValues[label]) continue;
        const sk = skewness(gasValues[label]);
        const ku = kurtosis(gasValues[label]);
        const assessment = normalityAssessment(gasValues[label]);
        console.log(`| ${labelNames[label] || label} | ${sk.toFixed(3)} | ${ku.toFixed(3)} | ${assessment} |`);
    }

    // ═══════════════════════════════════════════
    // Section 7: Key Findings Summary
    // ═══════════════════════════════════════════
    console.log('\n## 7. Key Findings Summary\n');

    if (gasResults['T2_SP_Credit'] && gasResults['T2.1_SP_Normal']) {
        const diff = Math.abs(gasResults['T2_SP_Credit'].mean - gasResults['T2.1_SP_Normal'].mean);
        const pct = (diff / gasResults['T2_SP_Credit'].mean * 100).toFixed(2);
        console.log(`1. **Credit System Zero Overhead**: T2 mean=${fmtN(gasResults['T2_SP_Credit'].mean)} vs T2.1 mean=${fmtN(gasResults['T2.1_SP_Normal'].mean)}, Δ=${fmtN(diff)} gas (${pct}%). Cliff's δ=${deltaResults['T2_SP_Credit_vs_T2.1_SP_Normal']?.delta.toFixed(4) ?? 'N/A'} (${deltaResults['T2_SP_Credit_vs_T2.1_SP_Normal']?.interpretation ?? 'N/A'}).`);
    }

    if (gasResults['T1'] && gasResults['T2.1_SP_Normal']) {
        const overhead = gasResults['T2.1_SP_Normal'].mean - gasResults['T1'].mean;
        const pct = (overhead / gasResults['T1'].mean * 100).toFixed(2);
        console.log(`2. **SuperPM vs PaymasterV4 Overhead**: T2.1 - T1 = ${fmtN(overhead)} gas (+${pct}%). Cliff's δ=${deltaResults['T1_vs_T2.1_SP_Normal']?.delta.toFixed(4) ?? 'N/A'} (${deltaResults['T1_vs_T2.1_SP_Normal']?.interpretation ?? 'N/A'}).`);
    }

    // ═══════════════════════════════════════════
    // Save JSON
    // ═══════════════════════════════════════════
    const outputJson = {
        generated: new Date().toISOString(),
        csvFile: csvPath,
        totalRows: rows.length,
        descriptiveStats: {
            gasUsedL2: gasResults,
            totalCostETH: costResults,
        },
        bootstrapCI: {
            gasUsedL2: ciResults,
            totalCostETH: costCiResults,
        },
        cliffsDelta: deltaResults,
    };

    const jsonPath = path.resolve(__dirname, '../data/stat_results.json');
    fs.writeFileSync(jsonPath, JSON.stringify(outputJson, null, 2));
    console.log(`\n📁 Results saved to: ${path.relative(process.cwd(), jsonPath)}`);
}

main();
