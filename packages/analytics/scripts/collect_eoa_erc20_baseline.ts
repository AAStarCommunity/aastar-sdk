import { createPublicClient, http } from 'viem';
import { optimism } from 'viem/chains';
import * as fs from 'fs';
import * as path from 'path';
import { createObjectCsvWriter } from 'csv-writer';

const TRANSFER_EVENT = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

type Row = {
    Label: string;
    TokenName: string;
    TokenAddress: string;
    Chain: string;
    FromBlock: number;
    ToBlock: number;
    BlockNumber: number;
    TxHash: string;
    From: string;
    To: string;
    GasUsed: string;
    EffectiveGasPriceWei: string;
    L2FeeWei: string;
    L1FeeWei: string;
    BlobFeeWei: string;
    TotalFeeWei: string;
};

function getArgValue(args: string[], key: string): string | undefined {
    const idx = args.indexOf(key);
    if (idx < 0) return undefined;
    return args[idx + 1];
}

function normalizeAddress(addr: string): `0x${string}` {
    if (!addr || !addr.startsWith('0x') || addr.length !== 42) {
        throw new Error(`Invalid address: ${addr}`);
    }
    return addr as `0x${string}`;
}

async function main() {
    const args = process.argv.slice(2).filter((a) => a !== '--');
    const network = getArgValue(args, '--network') || 'op-mainnet';
    const rpcUrl = getArgValue(args, '--rpc-url') || (network === 'op-mainnet' ? 'https://mainnet.optimism.io' : '');
    const token = normalizeAddress(getArgValue(args, '--token') || '');
    const tokenName = getArgValue(args, '--token-name') || 'ERC20';
    const chain = getArgValue(args, '--chain') || network;
    const fromBlock = Number(getArgValue(args, '--from-block'));
    const toBlock = Number(getArgValue(args, '--to-block'));
    const limit = Number(getArgValue(args, '--n') || '8');
    const windowSize = Number(getArgValue(args, '--window') || '20');
    const progressEvery = Number(getArgValue(args, '--progress-every') || '50');
    const selector = (getArgValue(args, '--selector') || 'a9059cbb').toLowerCase();
    const outPath = getArgValue(args, '--out') || path.resolve(process.cwd(), 'packages/analytics/data/eoa_erc20_baseline.csv');

    if (!rpcUrl) throw new Error('Missing rpc url');
    if (!fromBlock || !toBlock || fromBlock <= 0 || toBlock <= 0 || fromBlock > toBlock) {
        throw new Error('Invalid from/to block');
    }

    const client = createPublicClient({ chain: network === 'op-mainnet' ? optimism : undefined, transport: http(rpcUrl) });

    const rows: Row[] = [];
    const codeCache = new Map<string, string>();

    let scanned = 0;
    for (let end = toBlock; end >= fromBlock && rows.length < limit; end -= windowSize) {
        const start = Math.max(fromBlock, end - windowSize + 1);
        scanned += 1;
        if (scanned % progressEvery === 0) {
            console.log(`scanned_windows=${scanned} current_range=${start}-${end} found=${rows.length}`);
        }
        let logs: any[] = [];
        try {
            logs = await client.request({
                method: 'eth_getLogs',
                params: [
                    {
                        fromBlock: `0x${start.toString(16)}`,
                        toBlock: `0x${end.toString(16)}`,
                        address: token,
                        topics: [TRANSFER_EVENT]
                    }
                ]
            } as any);
        } catch (error) {
            console.log(`skip_range=${start}-${end} error=${(error as Error).message}`);
            continue;
        }

        for (const log of logs) {
            if (rows.length >= limit) break;
            const txHash = log.transactionHash as string;
            const tx: any = await client.request({
                method: 'eth_getTransactionByHash',
                params: [txHash]
            } as any);
            if (!tx?.to || (tx.to as string).toLowerCase() !== token.toLowerCase()) continue;
            const input = (tx.input || '').toLowerCase();
            if (!input.includes(selector)) continue;
            const fromAddr = (tx.from as string).toLowerCase();
            let code = codeCache.get(fromAddr);
            if (!code) {
                code = (await client.request({
                    method: 'eth_getCode',
                    params: [fromAddr, tx.blockNumber]
                } as any)) as string;
                codeCache.set(fromAddr, code);
            }
            if (code !== '0x') continue;

            const receipt: any = await client.request({
                method: 'eth_getTransactionReceipt',
                params: [txHash]
            } as any);

            const gasUsed = BigInt(receipt.gasUsed || '0x0');
            const effectiveGasPrice = BigInt(receipt.effectiveGasPrice || '0x0');
            const l2Fee = gasUsed * effectiveGasPrice;
            const l1Fee = receipt.l1Fee ? BigInt(receipt.l1Fee) : 0n;
            const blobFee =
                receipt.blobGasUsed && receipt.blobGasPrice ? BigInt(receipt.blobGasUsed) * BigInt(receipt.blobGasPrice) : 0n;
            const totalFee = l2Fee + l1Fee + blobFee;

            rows.push({
                Label: 'A_EOA',
                TokenName: tokenName,
                TokenAddress: token,
                Chain: chain,
                FromBlock: fromBlock,
                ToBlock: toBlock,
                BlockNumber: Number(receipt.blockNumber),
                TxHash: txHash,
                From: fromAddr,
                To: (tx.to as string).toLowerCase(),
                GasUsed: gasUsed.toString(),
                EffectiveGasPriceWei: effectiveGasPrice.toString(),
                L2FeeWei: l2Fee.toString(),
                L1FeeWei: l1Fee.toString(),
                BlobFeeWei: blobFee.toString(),
                TotalFeeWei: totalFee.toString()
            });
            console.log(`found_tx=${txHash} block=${receipt.blockNumber}`);
        }
    }

    if (!rows.length) {
        throw new Error('No rows matched filters');
    }

    await fs.promises.mkdir(path.dirname(outPath), { recursive: true });
    const csvWriter = createObjectCsvWriter({
        path: outPath,
        header: [
            { id: 'Label', title: 'Label' },
            { id: 'TokenName', title: 'TokenName' },
            { id: 'TokenAddress', title: 'TokenAddress' },
            { id: 'Chain', title: 'Chain' },
            { id: 'FromBlock', title: 'FromBlock' },
            { id: 'ToBlock', title: 'ToBlock' },
            { id: 'BlockNumber', title: 'BlockNumber' },
            { id: 'TxHash', title: 'TxHash' },
            { id: 'From', title: 'From' },
            { id: 'To', title: 'To' },
            { id: 'GasUsed', title: 'GasUsed' },
            { id: 'EffectiveGasPriceWei', title: 'EffectiveGasPriceWei' },
            { id: 'L2FeeWei', title: 'L2FeeWei' },
            { id: 'L1FeeWei', title: 'L1FeeWei' },
            { id: 'BlobFeeWei', title: 'BlobFeeWei' },
            { id: 'TotalFeeWei', title: 'TotalFeeWei' }
        ]
    });

    await csvWriter.writeRecords(rows);
    console.log(`rows=${rows.length}`);
    console.log(`out=${outPath}`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
