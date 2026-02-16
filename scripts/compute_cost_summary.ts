import * as fs from 'fs';
import { createPublicClient, http } from 'viem';
import { optimism } from 'viem/chains';

type IndustryRow = {
    Label: string;
    TxHash: string;
    ActualGasUsed: string;
};

type EoaRow = {
    Label: string;
    GasUsed: string;
    L2FeeWei: string;
    L1FeeWei: string;
    BlobFeeWei: string;
    TotalFeeWei: string;
};

type GaslessRow = {
    Label: string;
    GasUsed: string;
    L1FeeWei: string;
    TotalFeeEth: string;
};

function getArgValue(args: string[], key: string): string | undefined {
    const idx = args.indexOf(key);
    if (idx < 0) return undefined;
    return args[idx + 1];
}

function parseCsv(filePath: string): string[][] {
    const raw = fs.readFileSync(filePath, 'utf8').trim();
    const lines = raw.split('\n').filter(Boolean);
    return lines.map((l) => l.split(','));
}

function toWeiFromEthString(value: string): bigint {
    if (!value) return 0n;
    const [i, f = ''] = value.split('.');
    const frac = (f + '0'.repeat(18)).slice(0, 18);
    return BigInt(i) * 10n ** 18n + BigInt(frac);
}

function avgBigint(values: bigint[]): bigint {
    if (!values.length) return 0n;
    return values.reduce((a, b) => a + b, 0n) / BigInt(values.length);
}

function avgNumber(values: number[]): number {
    if (!values.length) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
}

function ci95(values: number[]): number {
    if (values.length <= 1) return 0;
    const mean = avgNumber(values);
    const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (values.length - 1);
    const std = Math.sqrt(variance);
    return 1.96 * std / Math.sqrt(values.length);
}

function formatEth(wei: bigint): string {
    const sign = wei < 0n ? '-' : '';
    const v = wei < 0n ? -wei : wei;
    const i = v / 10n ** 18n;
    const f = (v % 10n ** 18n).toString().padStart(18, '0').slice(0, 9);
    return `${sign}${i.toString()}.${f}`;
}

async function main() {
    const args = process.argv.slice(2).filter((a) => a !== '--');
    const rpcUrl = getArgValue(args, '--rpc-url') || 'https://mainnet.optimism.io';
    const industryCsv = getArgValue(args, '--industry-csv') || 'packages/analytics/data/industry_paymaster_baselines.csv';
    const eoaCsv = getArgValue(args, '--eoa-csv') || 'packages/analytics/data/eoa_erc20_baseline.csv';
    const gaslessCsv = getArgValue(args, '--gasless-csv') || 'packages/analytics/data/gasless_data_collection.csv';

    const client = createPublicClient({ chain: optimism, transport: http(rpcUrl) });

    const industryRowsRaw = parseCsv(industryCsv);
    const industryHeader = industryRowsRaw[0];
    const industryRows: IndustryRow[] = industryRowsRaw.slice(1).map((cols) => {
        const map: any = {};
        industryHeader.forEach((k, i) => (map[k] = cols[i]));
        return {
            Label: map.Label,
            TxHash: map.TxHash,
            ActualGasUsed: map.ActualGasUsed
        };
    });

    const industryByLabel = new Map<string, IndustryRow[]>();
    for (const row of industryRows) {
        if (!industryByLabel.has(row.Label)) industryByLabel.set(row.Label, []);
        industryByLabel.get(row.Label)?.push(row);
    }

    const industryStats: Record<
        string,
        { n: number; l2Gas: number; l2GasCi: number; l2FeeWei: bigint; l1FeeWei: bigint; totalWei: bigint }
    > = {};

    for (const [label, rows] of industryByLabel.entries()) {
        const l2Gas: number[] = [];
        const l2Fee: bigint[] = [];
        const l1Fee: bigint[] = [];
        const total: bigint[] = [];

        for (const row of rows) {
            const receipt: any = await client.request({
                method: 'eth_getTransactionReceipt',
                params: [row.TxHash as `0x${string}`]
            } as any);
            const gasUsed = BigInt(receipt.gasUsed || '0x0');
            const effectiveGasPrice = BigInt(receipt.effectiveGasPrice || '0x0');
            const l2FeeWei = gasUsed * effectiveGasPrice;
            const l1FeeWei = receipt.l1Fee ? BigInt(receipt.l1Fee) : 0n;
            const blobFeeWei =
                receipt.blobGasUsed && receipt.blobGasPrice ? BigInt(receipt.blobGasUsed) * BigInt(receipt.blobGasPrice) : 0n;
            const totalWei = l2FeeWei + l1FeeWei + blobFeeWei;
            l2Gas.push(Number(row.ActualGasUsed));
            l2Fee.push(l2FeeWei);
            l1Fee.push(l1FeeWei);
            total.push(totalWei);
        }

        industryStats[label] = {
            n: rows.length,
            l2Gas: avgNumber(l2Gas),
            l2GasCi: ci95(l2Gas),
            l2FeeWei: avgBigint(l2Fee),
            l1FeeWei: avgBigint(l1Fee),
            totalWei: avgBigint(total)
        };
    }

    const eoaRowsRaw = parseCsv(eoaCsv);
    const eoaHeader = eoaRowsRaw[0];
    const eoaRows: EoaRow[] = eoaRowsRaw.slice(1).map((cols) => {
        const map: any = {};
        eoaHeader.forEach((k, i) => (map[k] = cols[i]));
        return {
            Label: map.Label,
            GasUsed: map.GasUsed,
            L2FeeWei: map.L2FeeWei,
            L1FeeWei: map.L1FeeWei,
            BlobFeeWei: map.BlobFeeWei,
            TotalFeeWei: map.TotalFeeWei
        };
    });

    const eoaByLabel = new Map<string, EoaRow[]>();
    for (const row of eoaRows) {
        if (!eoaByLabel.has(row.Label)) eoaByLabel.set(row.Label, []);
        eoaByLabel.get(row.Label)?.push(row);
    }

    const eoaStats: Record<string, { n: number; l2Gas: number; l2GasCi: number; l2FeeWei: bigint; l1FeeWei: bigint; totalWei: bigint }> =
        {};

    for (const [label, rows] of eoaByLabel.entries()) {
        const l2Gas: number[] = [];
        const l2Fee: bigint[] = [];
        const l1Fee: bigint[] = [];
        const total: bigint[] = [];

        for (const row of rows) {
            l2Gas.push(Number(row.GasUsed));
            l2Fee.push(BigInt(row.L2FeeWei || '0'));
            l1Fee.push(BigInt(row.L1FeeWei || '0'));
            total.push(BigInt(row.TotalFeeWei || '0'));
        }

        eoaStats[label] = {
            n: rows.length,
            l2Gas: avgNumber(l2Gas),
            l2GasCi: ci95(l2Gas),
            l2FeeWei: avgBigint(l2Fee),
            l1FeeWei: avgBigint(l1Fee),
            totalWei: avgBigint(total)
        };
    }

    const gaslessRowsRaw = parseCsv(gaslessCsv);
    const gaslessHeader = gaslessRowsRaw[0];
    const gaslessRows: GaslessRow[] = gaslessRowsRaw.slice(1).map((cols) => {
        const map: any = {};
        gaslessHeader.forEach((k, i) => (map[k] = cols[i]));
        return {
            Label: map.Label,
            GasUsed: map['GasUsed(L2)'],
            L1FeeWei: map['L1Fee(Wei)'],
            TotalFeeEth: map['TotalCost(ETH)']
        };
    });

    const gaslessByLabel = new Map<string, GaslessRow[]>();
    for (const row of gaslessRows) {
        if (!gaslessByLabel.has(row.Label)) gaslessByLabel.set(row.Label, []);
        gaslessByLabel.get(row.Label)?.push(row);
    }

    const gaslessStats: Record<
        string,
        { n: number; l2Gas: number; l2GasCi: number; l2FeeWei: bigint; l1FeeWei: bigint; totalWei: bigint }
    > = {};

    for (const [label, rows] of gaslessByLabel.entries()) {
        const l2Gas: number[] = [];
        const l2Fee: bigint[] = [];
        const l1Fee: bigint[] = [];
        const total: bigint[] = [];

        for (const row of rows) {
            const l1FeeWei = BigInt(row.L1FeeWei || '0');
            const totalWei = toWeiFromEthString(row.TotalFeeEth || '0');
            const l2FeeWei = totalWei - l1FeeWei;
            l2Gas.push(Number(row.GasUsed));
            l2Fee.push(l2FeeWei);
            l1Fee.push(l1FeeWei);
            total.push(totalWei);
        }

        gaslessStats[label] = {
            n: rows.length,
            l2Gas: avgNumber(l2Gas),
            l2GasCi: ci95(l2Gas),
            l2FeeWei: avgBigint(l2Fee),
            l1FeeWei: avgBigint(l1Fee),
            totalWei: avgBigint(total)
        };
    }

    const rowsOut = [
        ['Operation', 'Label', 'n', 'L2 Gas Used (mean ± 95% CI)', 'L2 Fee (ETH)', 'L1 Fee (ETH)', 'Total Fee (ETH)'],
        [
            'EOA ERC20 Transfer',
            'A_EOA',
            `${eoaStats.A_EOA?.n || 0}`,
            `${Math.round(eoaStats.A_EOA?.l2Gas || 0)} ± ${Math.round(eoaStats.A_EOA?.l2GasCi || 0)}`,
            `${formatEth(eoaStats.A_EOA?.l2FeeWei || 0n)}`,
            `${formatEth(eoaStats.A_EOA?.l1FeeWei || 0n)}`,
            `${formatEth(eoaStats.A_EOA?.totalWei || 0n)}`
        ],
        [
            'Commercial Paymaster (Alchemy, ERC20 transfer)',
            'B1_Alchemy',
            `${industryStats.B1_Alchemy?.n || 0}`,
            `${Math.round(industryStats.B1_Alchemy?.l2Gas || 0)} ± ${Math.round(industryStats.B1_Alchemy?.l2GasCi || 0)}`,
            `${formatEth(industryStats.B1_Alchemy?.l2FeeWei || 0n)}`,
            `${formatEth(industryStats.B1_Alchemy?.l1FeeWei || 0n)}`,
            `${formatEth(industryStats.B1_Alchemy?.totalWei || 0n)}`
        ],
        [
            'Commercial Paymaster (Pimlico ERC-20 Paymaster)',
            'B2_Pimlico',
            `${industryStats.B2_Pimlico?.n || 0}`,
            `${Math.round(industryStats.B2_Pimlico?.l2Gas || 0)} ± ${Math.round(industryStats.B2_Pimlico?.l2GasCi || 0)}`,
            `${formatEth(industryStats.B2_Pimlico?.l2FeeWei || 0n)}`,
            `${formatEth(industryStats.B2_Pimlico?.l1FeeWei || 0n)}`,
            `${formatEth(industryStats.B2_Pimlico?.totalWei || 0n)}`
        ],
        [
            'Gasless Token Transfer (PaymasterV4)',
            'T1',
            `${gaslessStats.T1?.n || 0}`,
            `${Math.round(gaslessStats.T1?.l2Gas || 0)} ± ${Math.round(gaslessStats.T1?.l2GasCi || 0)}`,
            `${formatEth(gaslessStats.T1?.l2FeeWei || 0n)}`,
            `${formatEth(gaslessStats.T1?.l1FeeWei || 0n)}`,
            `${formatEth(gaslessStats.T1?.totalWei || 0n)}`
        ],
        [
            'Gasless Payment (SuperPaymaster, Credit)',
            'T2_SP_Credit',
            `${gaslessStats.T2_SP_Credit?.n || 0}`,
            `${Math.round(gaslessStats.T2_SP_Credit?.l2Gas || 0)} ± ${Math.round(gaslessStats.T2_SP_Credit?.l2GasCi || 0)}`,
            `${formatEth(gaslessStats.T2_SP_Credit?.l2FeeWei || 0n)}`,
            `${formatEth(gaslessStats.T2_SP_Credit?.l1FeeWei || 0n)}`,
            `${formatEth(gaslessStats.T2_SP_Credit?.totalWei || 0n)}`
        ],
        [
            'Gasless Payment (SuperPaymaster, Normal)',
            'T2.1_SP_Normal',
            `${gaslessStats['T2.1_SP_Normal']?.n || 0}`,
            `${Math.round(gaslessStats['T2.1_SP_Normal']?.l2Gas || 0)} ± ${Math.round(gaslessStats['T2.1_SP_Normal']?.l2GasCi || 0)}`,
            `${formatEth(gaslessStats['T2.1_SP_Normal']?.l2FeeWei || 0n)}`,
            `${formatEth(gaslessStats['T2.1_SP_Normal']?.l1FeeWei || 0n)}`,
            `${formatEth(gaslessStats['T2.1_SP_Normal']?.totalWei || 0n)}`
        ],
        [
            'Debt Settlement (SuperPaymaster)',
            'T5',
            `${gaslessStats.T5?.n || 0}`,
            `${Math.round(gaslessStats.T5?.l2Gas || 0)} ± ${Math.round(gaslessStats.T5?.l2GasCi || 0)}`,
            `${formatEth(gaslessStats.T5?.l2FeeWei || 0n)}`,
            `${formatEth(gaslessStats.T5?.l1FeeWei || 0n)}`,
            `${formatEth(gaslessStats.T5?.totalWei || 0n)}`
        ]
    ];

    const table = rowsOut.map((r, idx) => (idx === 0 ? `| ${r.join(' | ')} |` : `| ${r.join(' | ')} |`)).join('\n');
    const divider = `| ${rowsOut[0].map(() => '---').join(' | ')} |`;
    console.log([`| ${rowsOut[0].join(' | ')} |`, divider, ...rowsOut.slice(1).map((r) => `| ${r.join(' | ')} |`)].join('\n'));
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
