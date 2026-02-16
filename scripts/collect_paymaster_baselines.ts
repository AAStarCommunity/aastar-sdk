import { createPublicClient, decodeFunctionData, http, toFunctionSelector } from 'viem';
import { optimism } from 'viem/chains';
import * as fs from 'fs';
import * as path from 'path';
import { createObjectCsvWriter } from 'csv-writer';

const USER_OP_EVENT = '0x49628fd1471006c1482da88028e9ce4dbb080b815c9b0344d39e5a8e6ec1419f';
const TRANSFER_SELECTOR = '0xa9059cbb';
const APPROVE_SELECTOR = '0x095ea7b3';
const TRANSFER_FROM_SELECTOR = '0x23b872dd';
const EXECUTE_SELECTOR = toFunctionSelector('execute(address,uint256,bytes)');
const EXECUTE_BATCH_SELECTOR = toFunctionSelector('executeBatch(address[],uint256[],bytes[])');

const ENTRYPOINT_ABI = [
    {
        type: 'function',
        name: 'handleOps',
        stateMutability: 'nonpayable',
        inputs: [
            {
                name: 'ops',
                type: 'tuple[]',
                components: [
                    { name: 'sender', type: 'address' },
                    { name: 'nonce', type: 'uint256' },
                    { name: 'initCode', type: 'bytes' },
                    { name: 'callData', type: 'bytes' },
                    { name: 'callGasLimit', type: 'uint256' },
                    { name: 'verificationGasLimit', type: 'uint256' },
                    { name: 'preVerificationGas', type: 'uint256' },
                    { name: 'maxFeePerGas', type: 'uint256' },
                    { name: 'maxPriorityFeePerGas', type: 'uint256' },
                    { name: 'paymasterAndData', type: 'bytes' },
                    { name: 'signature', type: 'bytes' }
                ]
            },
            { name: 'beneficiary', type: 'address' }
        ],
        outputs: []
    }
] as const;

const ENTRYPOINT_PACKED_ABI = [
    {
        type: 'function',
        name: 'handleOps',
        stateMutability: 'nonpayable',
        inputs: [
            {
                name: 'ops',
                type: 'tuple[]',
                components: [
                    { name: 'sender', type: 'address' },
                    { name: 'nonce', type: 'uint256' },
                    { name: 'initCode', type: 'bytes' },
                    { name: 'callData', type: 'bytes' },
                    { name: 'accountGasLimits', type: 'bytes32' },
                    { name: 'preVerificationGas', type: 'uint256' },
                    { name: 'gasFees', type: 'bytes32' },
                    { name: 'paymasterAndData', type: 'bytes' },
                    { name: 'signature', type: 'bytes' }
                ]
            },
            { name: 'beneficiary', type: 'address' }
        ],
        outputs: []
    }
] as const;

const SIMPLE_ACCOUNT_ABI = [
    {
        type: 'function',
        name: 'execute',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'dest', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'func', type: 'bytes' }
        ],
        outputs: []
    }
] as const;

type Row = {
    Label: string;
    PaymasterName: string;
    PaymasterAddress: string;
    EntryPoint: string;
    Chain: string;
    FromBlock: number;
    ToBlock: number;
    BlockNumber: number;
    TxHash: string;
    UserOpHash: string;
    ActualGasUsed: string;
    FilterNotes: string;
};

function getArgValue(args: string[], key: string): string | undefined {
    const idx = args.indexOf(key);
    if (idx < 0) return undefined;
    return args[idx + 1];
}

function toBool(value: string | undefined, fallback: boolean): boolean {
    if (!value) return fallback;
    return value === 'true' || value === '1' || value === 'yes';
}

function normalizeAddress(addr: string): `0x${string}` {
    if (!addr || !addr.startsWith('0x') || addr.length !== 42) {
        throw new Error(`Invalid address: ${addr}`);
    }
    return addr as `0x${string}`;
}

function parseActualGasUsed(data: string): bigint | null {
    if (!data || data.length < 2 + 64 * 4) return null;
    const hex = data.startsWith('0x') ? data.slice(2) : data;
    const gasHex = hex.slice(96 * 2, 128 * 2);
    if (!gasHex) return null;
    return BigInt(`0x${gasHex}`);
}

function isSimpleErc20TransferCallData(callData: string): boolean {
    if (!callData || !callData.startsWith('0x')) return false;
    const normalized = callData.toLowerCase();
    const expectedLength = 2 + 8 + 64 + 64;
    return normalized.startsWith(TRANSFER_SELECTOR) && normalized.length === expectedLength;
}

function countOccurrences(haystack: string, needle: string): number {
    if (!needle) return 0;
    let count = 0;
    let idx = 0;
    while (true) {
        idx = haystack.indexOf(needle, idx);
        if (idx === -1) break;
        count += 1;
        idx += needle.length;
    }
    return count;
}

function isOpaqueSingleTransfer(callData: string): boolean {
    const normalized = callData.toLowerCase();
    const transferCount = countOccurrences(normalized, TRANSFER_SELECTOR.slice(2));
    if (transferCount !== 1) return false;
    if (normalized.includes(APPROVE_SELECTOR.slice(2))) return false;
    if (normalized.includes(TRANSFER_FROM_SELECTOR.slice(2))) return false;
    return true;
}

function extractUserOpCallData(input: string): string | null {
    if (!input) return null;
    try {
        const decoded = decodeFunctionData({
            abi: ENTRYPOINT_ABI,
            data: input as `0x${string}`
        });
        if (decoded.functionName !== 'handleOps') return null;
        const ops = decoded.args?.[0] as any[];
        if (!ops || ops.length !== 1) return null;
        return (ops[0]?.callData as string) || null;
    } catch {
        try {
            const decoded = decodeFunctionData({
                abi: ENTRYPOINT_PACKED_ABI,
                data: input as `0x${string}`
            });
            if (decoded.functionName !== 'handleOps') return null;
            const ops = decoded.args?.[0] as any[];
            if (!ops || ops.length !== 1) return null;
            return (ops[0]?.callData as string) || null;
        } catch {
            return null;
        }
    }
}

function isSimpleTransferUserOp(input: string): { ok: boolean; reason: string } {
    const callData = extractUserOpCallData(input);
    if (!callData) return { ok: false, reason: 'Unable to decode handleOps or multiple UserOps' };
    const normalized = callData.toLowerCase();
    if (normalized.startsWith(EXECUTE_BATCH_SELECTOR)) {
        return { ok: false, reason: 'executeBatch detected' };
    }
    if (normalized.startsWith(TRANSFER_SELECTOR)) {
        return isSimpleErc20TransferCallData(normalized)
            ? { ok: true, reason: 'Direct ERC20 transfer callData' }
            : { ok: false, reason: 'ERC20 selector found but calldata length mismatch' };
    }
    if (normalized.startsWith(EXECUTE_SELECTOR)) {
        try {
            const decoded = decodeFunctionData({
                abi: SIMPLE_ACCOUNT_ABI,
                data: callData as `0x${string}`
            });
            const value = decoded.args?.[1] as bigint;
            const inner = (decoded.args?.[2] as string) || '';
            if (value !== 0n) return { ok: false, reason: 'execute value not zero' };
            return isSimpleErc20TransferCallData(inner)
                ? { ok: true, reason: 'execute->ERC20 transfer' }
                : { ok: false, reason: 'execute without simple ERC20 transfer' };
        } catch {
            return { ok: false, reason: 'execute decode failed' };
        }
    }
    if (isOpaqueSingleTransfer(normalized)) {
        return { ok: true, reason: 'Opaque callData with single ERC20 transfer selector' };
    }
    return { ok: false, reason: 'Unknown callData selector' };
}

async function main() {
    const args = process.argv.slice(2).filter((a) => a !== '--');
    const network = getArgValue(args, '--network') || 'op-mainnet';
    const rpcUrl = getArgValue(args, '--rpc-url') || (network === 'op-mainnet' ? 'https://mainnet.optimism.io' : '');
    const entryPoint = normalizeAddress(getArgValue(args, '--entrypoint') || '');
    const paymaster = normalizeAddress(getArgValue(args, '--paymaster') || '');
    const label = getArgValue(args, '--label') || 'B_Industry';
    const paymasterName = getArgValue(args, '--paymaster-name') || 'Paymaster';
    const chain = getArgValue(args, '--chain') || network;
    const fromBlock = Number(getArgValue(args, '--from-block'));
    const toBlock = Number(getArgValue(args, '--to-block'));
    const limit = Number(getArgValue(args, '--n') || '0');
    const selector = (getArgValue(args, '--selector') || 'a9059cbb').toLowerCase();
    const singleUserOp = toBool(getArgValue(args, '--single-userop'), true);
    const strictTransfer = toBool(getArgValue(args, '--strict-transfer'), true);
    const windowSize = Number(getArgValue(args, '--window') || '2000');
    const outPath =
        getArgValue(args, '--out') || path.resolve(process.cwd(), 'packages/analytics/data/industry_paymaster_baselines.csv');
    const appendFlag = toBool(getArgValue(args, '--append'), false);

    if (!rpcUrl) throw new Error('Missing rpc url');
    if (!fromBlock || !toBlock || fromBlock <= 0 || toBlock <= 0 || fromBlock > toBlock) {
        throw new Error('Invalid from/to block');
    }

    const client = createPublicClient({ chain: network === 'op-mainnet' ? optimism : undefined, transport: http(rpcUrl) });
    const payTopic = `0x000000000000000000000000${paymaster.slice(2).toLowerCase()}`;

    const txInputCache = new Map<string, string>();
    const rows: Row[] = [];

    for (let end = toBlock; end >= fromBlock && (limit <= 0 || rows.length < limit); end -= windowSize) {
        const start = Math.max(fromBlock, end - windowSize + 1);
        const logs: any[] = await client.request({
            method: 'eth_getLogs',
            params: [
                {
                    fromBlock: `0x${start.toString(16)}`,
                    toBlock: `0x${end.toString(16)}`,
                    address: entryPoint,
                    topics: [USER_OP_EVENT, null, null, payTopic]
                }
            ] as any
        } as any);

        const byTx = new Map<string, any[]>();
        for (const log of logs) {
            const tx = (log.transactionHash as string).toLowerCase();
            if (!byTx.has(tx)) byTx.set(tx, []);
            byTx.get(tx)?.push(log);
        }

        for (const [tx, txLogs] of byTx.entries()) {
            if (limit > 0 && rows.length >= limit) break;
            if (singleUserOp && txLogs.length !== 1) continue;
            let input = txInputCache.get(tx) ?? '';
            if (!input) {
                const txData: any = await client.request({
                    method: 'eth_getTransactionByHash',
                    params: [tx as `0x${string}`]
                } as any);
                input = String(txData?.input || '').toLowerCase();
                txInputCache.set(tx, input);
            }
            const strictResult = strictTransfer ? isSimpleTransferUserOp(input) : { ok: true, reason: 'strict disabled' };
            if (!strictTransfer && !input.includes(selector)) continue;
            if (!strictResult.ok) continue;
            for (const log of txLogs) {
                const gasUsed = parseActualGasUsed(log.data);
                if (gasUsed === null) continue;
                rows.push({
                    Label: label,
                    PaymasterName: paymasterName,
                    PaymasterAddress: paymaster,
                    EntryPoint: entryPoint,
                    Chain: chain,
                    FromBlock: fromBlock,
                    ToBlock: toBlock,
                    BlockNumber: Number(log.blockNumber),
                    TxHash: log.transactionHash,
                    UserOpHash: log.topics?.[1] || '',
                    ActualGasUsed: gasUsed.toString(),
                    FilterNotes: `${singleUserOp ? 'single-UserOp bundle; ' : ''}${strictResult.reason}`
                });
                if (limit > 0 && rows.length >= limit) break;
            }
        }
    }

    if (!rows.length) {
        throw new Error('No rows matched filters');
    }

    await fs.promises.mkdir(path.dirname(outPath), { recursive: true });
    const shouldAppend = appendFlag && fs.existsSync(outPath);
    const csvWriter = createObjectCsvWriter({
        path: outPath,
        header: [
            { id: 'Label', title: 'Label' },
            { id: 'PaymasterName', title: 'PaymasterName' },
            { id: 'PaymasterAddress', title: 'PaymasterAddress' },
            { id: 'EntryPoint', title: 'EntryPoint' },
            { id: 'Chain', title: 'Chain' },
            { id: 'FromBlock', title: 'FromBlock' },
            { id: 'ToBlock', title: 'ToBlock' },
            { id: 'BlockNumber', title: 'BlockNumber' },
            { id: 'TxHash', title: 'TxHash' },
            { id: 'UserOpHash', title: 'UserOpHash' },
            { id: 'ActualGasUsed', title: 'ActualGasUsed' },
            { id: 'FilterNotes', title: 'FilterNotes' }
        ],
        append: shouldAppend
    });

    await csvWriter.writeRecords(rows);
    console.log(`rows=${rows.length}`);
    console.log(`out=${outPath}`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
