import { createPublicClient, decodeEventLog, decodeFunctionData, http, parseAbiItem, toFunctionSelector } from 'viem';
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
const TRANSACTION_SPONSORED_EVENT = parseAbiItem(
    'event TransactionSponsored(address indexed operator, address indexed user, uint256 aPNTsCost, uint256 xPNTsCost)'
);
const DEBT_RECORDED_EVENT = parseAbiItem('event DebtRecorded(address indexed user, uint256 amount)');

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

const ENTRYPOINT_USEROP_HASH_ABI = [
    {
        type: 'function',
        name: 'getUserOpHash',
        stateMutability: 'view',
        inputs: [
            {
                name: 'userOp',
                type: 'tuple',
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
            }
        ],
        outputs: [{ name: 'userOpHash', type: 'bytes32' }]
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

const ENTRYPOINT_PACKED_USEROP_HASH_ABI = [
    {
        type: 'function',
        name: 'getUserOpHash',
        stateMutability: 'view',
        inputs: [
            {
                name: 'userOp',
                type: 'tuple',
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
            }
        ],
        outputs: [{ name: 'userOpHash', type: 'bytes32' }]
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

const SIMPLE_ACCOUNT_BATCH_ABI = [
    {
        type: 'function',
        name: 'executeBatch',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'dest', type: 'address[]' },
            { name: 'value', type: 'uint256[]' },
            { name: 'func', type: 'bytes[]' }
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
    Sender: string;
    ActualGasUsed: string;
    TxGasUsed: string;
    PreVerificationGas: string;
    APNTS_Cost: string;
    XPNTS_Cost: string;
    CreditType: string;
    FilterNotes: string;
};

function safeSplitCsvLine(line: string): string[] {
    return line
        .split(',')
        .map((v) => v.trim())
        .map((v) => (v.startsWith('"') && v.endsWith('"') ? v.slice(1, -1) : v));
}

async function loadTxHashesFromCsv(
    csvPath: string,
    txHashColumn: string,
    labelColumn: string | undefined,
    labelFilter: string | undefined
): Promise<`0x${string}`[]> {
    const raw = await fs.promises.readFile(csvPath, 'utf-8');
    const lines = raw.split('\n').map((l) => l.trim());
    const nonEmpty = lines.filter((l) => l.length > 0);
    if (nonEmpty.length < 2) return [];

    const header = safeSplitCsvLine(nonEmpty[0]);
    const idxTx = header.findIndex((h) => h === txHashColumn);
    const idxLabel = labelColumn ? header.findIndex((h) => h === labelColumn) : -1;
    if (idxTx < 0) return [];

    const out: `0x${string}`[] = [];
    const seen = new Set<string>();
    for (let i = 1; i < nonEmpty.length; i += 1) {
        const cols = safeSplitCsvLine(nonEmpty[i]);
        const tx = String(cols[idxTx] || '').toLowerCase();
        if (!tx.startsWith('0x') || tx.length !== 66) continue;
        if (labelFilter && idxLabel >= 0) {
            const label = String(cols[idxLabel] || '');
            if (label !== labelFilter) continue;
        }
        if (seen.has(tx)) continue;
        seen.add(tx);
        out.push(tx as `0x${string}`);
    }
    return out;
}

async function loadExistingOutStats(
    outPath: string,
    label: string
): Promise<{ existingKeys: Set<string>; existingLabelCount: number }> {
    if (!fs.existsSync(outPath)) return { existingKeys: new Set(), existingLabelCount: 0 };
    const raw = await fs.promises.readFile(outPath, 'utf-8');
    const lines = raw.split('\n').map((l) => l.trim());
    const nonEmpty = lines.filter((l) => l.length > 0);
    if (nonEmpty.length < 2) return { existingKeys: new Set(), existingLabelCount: 0 };

    const header = safeSplitCsvLine(nonEmpty[0]);
    const idxLabel = header.findIndex((h) => h === 'Label');
    const idxTx = header.findIndex((h) => h === 'TxHash');
    const idxUserOp = header.findIndex((h) => h === 'UserOpHash');
    if (idxTx < 0 || idxUserOp < 0) return { existingKeys: new Set(), existingLabelCount: 0 };

    const keys = new Set<string>();
    let labelCount = 0;
    for (let i = 1; i < nonEmpty.length; i += 1) {
        const cols = safeSplitCsvLine(nonEmpty[i]);
        if (idxLabel >= 0 && String(cols[idxLabel] || '') === label) labelCount += 1;
        const tx = String(cols[idxTx] || '').toLowerCase();
        const userOp = String(cols[idxUserOp] || '').toLowerCase();
        if (!tx || !userOp) continue;
        keys.add(`${tx}:${userOp}`);
    }
    return { existingKeys: keys, existingLabelCount: labelCount };
}

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

function topicToAddress(topic: string | undefined): `0x${string}` {
    const t = String(topic || '').toLowerCase();
    if (!t.startsWith('0x') || t.length !== 66) return '0x0000000000000000000000000000000000000000';
    return `0x${t.slice(26)}` as `0x${string}`;
}

function transactionSponsoredCostsByUser(paymaster: `0x${string}`, logs: any[]): Map<string, { aPNTsCost: bigint; xPNTsCost: bigint }> {
    const out = new Map<string, { aPNTsCost: bigint; xPNTsCost: bigint }>();
    for (const l of logs) {
        if (String(l?.address || '').toLowerCase() !== paymaster.toLowerCase()) continue;
        try {
            const decoded = decodeEventLog({
                abi: [TRANSACTION_SPONSORED_EVENT],
                data: l.data,
                topics: l.topics
            } as any) as any;
            if (decoded?.eventName !== 'TransactionSponsored') continue;
            const user = String(decoded.args?.user || '').toLowerCase();
            if (!user.startsWith('0x') || user.length !== 42) continue;
            out.set(user, {
                aPNTsCost: BigInt(decoded.args?.aPNTsCost ?? 0),
                xPNTsCost: BigInt(decoded.args?.xPNTsCost ?? 0)
            });
        } catch {
            continue;
        }
    }
    return out;
}

function debtRecordedAmountByUser(logs: any[]): Map<string, bigint> {
    const out = new Map<string, bigint>();
    for (const l of logs) {
        try {
            const decoded = decodeEventLog({
                abi: [DEBT_RECORDED_EVENT],
                data: l.data,
                topics: l.topics
            } as any) as any;
            if (decoded?.eventName !== 'DebtRecorded') continue;
            const user = String(decoded.args?.user || '').toLowerCase();
            if (!user.startsWith('0x') || user.length !== 42) continue;
            const amount = BigInt(decoded.args?.amount ?? 0);
            out.set(user, (out.get(user) ?? 0n) + amount);
        } catch {
            continue;
        }
    }
    return out;
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

type DecodedHandleOps = { kind: 'legacy'; ops: any[] } | { kind: 'packed'; ops: any[] };

function decodeHandleOps(input: string): DecodedHandleOps | null {
    if (!input) return null;
    try {
        const decoded = decodeFunctionData({
            abi: ENTRYPOINT_ABI,
            data: input as `0x${string}`
        });
        if (decoded.functionName !== 'handleOps') return null;
        const ops = decoded.args?.[0] as any[];
        if (!ops || !ops.length) return null;
        return { kind: 'legacy', ops };
    } catch {
        try {
            const decoded = decodeFunctionData({
                abi: ENTRYPOINT_PACKED_ABI,
                data: input as `0x${string}`
            });
            if (decoded.functionName !== 'handleOps') return null;
            const ops = decoded.args?.[0] as any[];
            if (!ops || !ops.length) return null;
            return { kind: 'packed', ops };
        } catch {
            return null;
        }
    }
}

async function userOpCallDataByHash(
    client: ReturnType<typeof createPublicClient>,
    entryPoint: `0x${string}`,
    decoded: DecodedHandleOps
): Promise<Map<string, { callData: string; preVerificationGas: bigint }>> {
    const m = new Map<string, { callData: string; preVerificationGas: bigint }>();
    for (const op of decoded.ops) {
        const userOpHash = (await client.readContract({
            address: entryPoint,
            abi: decoded.kind === 'legacy' ? ENTRYPOINT_USEROP_HASH_ABI : ENTRYPOINT_PACKED_USEROP_HASH_ABI,
            functionName: 'getUserOpHash',
            args: [op as any]
        })) as `0x${string}`;
        const callData = String(op?.callData || '');
        if (!callData) continue;
        const preVerificationGas = op?.preVerificationGas as bigint | undefined;
        if (typeof preVerificationGas !== 'bigint') continue;
        m.set(userOpHash.toLowerCase(), { callData: callData.toLowerCase(), preVerificationGas });
    }
    return m;
}

function isSimpleTransferCallData(callData: string): { ok: boolean; reason: string } {
    if (!callData) return { ok: false, reason: 'Missing callData' };
    const normalized = callData.toLowerCase();
    if (normalized.startsWith(EXECUTE_BATCH_SELECTOR)) {
        try {
            const decoded = decodeFunctionData({
                abi: SIMPLE_ACCOUNT_BATCH_ABI,
                data: callData as `0x${string}`
            });
            const values = decoded.args?.[1] as bigint[];
            const funcs = (decoded.args?.[2] as string[]) || [];
            if (!values || values.length !== 1 || funcs.length !== 1) {
                return { ok: false, reason: 'executeBatch not single call' };
            }
            if (values[0] !== 0n) return { ok: false, reason: 'executeBatch value not zero' };
            return isSimpleErc20TransferCallData(funcs[0])
                ? { ok: true, reason: 'executeBatch->ERC20 transfer' }
                : { ok: false, reason: 'executeBatch without simple ERC20 transfer' };
        } catch {
            return { ok: false, reason: 'executeBatch decode failed' };
        }
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
    const preset = getArgValue(args, '--preset') || '';
    const presetDefaults: Partial<{
        paymasterKey: string;
        label: string;
        paymasterName: string;
        chain: string;
        txHashesCsv: string;
        out: string;
        includeSender: boolean;
    }> =
        preset === 'op-mainnet-v4-controlled-senders'
            ? {
                  paymasterKey: 'paymasterV4',
                  label: 'OP_MAINNET_V4_CONTROLLED_T1',
                  paymasterName: 'PaymasterV4',
                  chain: 'optimism',
                  txHashesCsv: 'packages/analytics/data/paper_gas_op_mainnet/2026-02-17/op_mainnet_v4_controlled_simple_erc20.csv',
                  out: 'packages/analytics/data/paper_gas_op_mainnet/2026-02-18/v4_t1_sender.csv',
                  includeSender: true
              }
            : preset === 'op-mainnet-v4-simple-senders'
              ? {
                    paymasterKey: 'paymasterV4',
                    label: 'OP_MAINNET_V4_SIMPLE_ERC20',
                    paymasterName: 'PaymasterV4',
                    chain: 'optimism',
                    txHashesCsv: 'packages/analytics/data/paper_gas_op_mainnet/2026-02-17/op_mainnet_v4_simple_erc20.csv',
                    out: 'packages/analytics/data/paper_gas_op_mainnet/2026-02-18/op_mainnet_v4_simple_erc20_with_sender.csv',
                    includeSender: true
                }
              : preset === 'op-mainnet-super-controlled-senders'
                ? {
                      paymasterKey: 'superPaymaster',
                      label: 'OP_MAINNET_SUPER_CONTROLLED_T2_SP_CREDIT',
                      paymasterName: 'SuperPaymaster',
                      chain: 'optimism',
                      txHashesCsv: 'packages/analytics/data/paper_gas_op_mainnet/2026-02-17/op_mainnet_super_controlled_simple_erc20.csv',
                      out: 'packages/analytics/data/paper_gas_op_mainnet/2026-02-18/super_t2_sender.csv',
                      includeSender: true
                  }
                : preset === 'op-mainnet-super-simple-senders'
                  ? {
                        paymasterKey: 'superPaymaster',
                        label: 'OP_MAINNET_SUPER_SIMPLE_ERC20',
                        paymasterName: 'SuperPaymaster',
                        chain: 'optimism',
                        txHashesCsv: 'packages/analytics/data/paper_gas_op_mainnet/2026-02-17/op_mainnet_super_simple_erc20.csv',
                        out: 'packages/analytics/data/paper_gas_op_mainnet/2026-02-18/op_mainnet_super_simple_erc20_with_sender.csv',
                        includeSender: true
                    }
                  : {};
    const network = getArgValue(args, '--network') || 'op-mainnet';
    const rpcUrl = getArgValue(args, '--rpc-url') || (network === 'op-mainnet' ? 'https://mainnet.optimism.io' : '');
    const entryPointRawArg = getArgValue(args, '--entrypoint');
    const paymasterRawArg = getArgValue(args, '--paymaster');
    const paymasterKey = getArgValue(args, '--paymaster-key') || presetDefaults.paymasterKey;
    const configPath = getArgValue(args, '--contracts-config') || path.resolve(process.cwd(), `config.${network}.json`);
    let cfg: any = null;
    if ((!entryPointRawArg || !paymasterRawArg) && fs.existsSync(configPath)) {
        try {
            cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        } catch {
            cfg = null;
        }
    }
    const entryPointRaw = entryPointRawArg || cfg?.entryPoint || cfg?.entrypoint;
    const paymasterRaw = paymasterRawArg || (paymasterKey ? cfg?.[paymasterKey] : undefined) || cfg?.paymasterV4;
    const entryPoint = normalizeAddress(String(entryPointRaw || ''));
    const paymaster = normalizeAddress(String(paymasterRaw || ''));
    const label = getArgValue(args, '--label') || presetDefaults.label || 'B_Industry';
    const paymasterName = getArgValue(args, '--paymaster-name') || presetDefaults.paymasterName || 'Paymaster';
    const chain = getArgValue(args, '--chain') || presetDefaults.chain || network;
    const senderArg = getArgValue(args, '--sender');
    const sendersArg = getArgValue(args, '--senders');
    const includeSender = toBool(getArgValue(args, '--include-sender'), presetDefaults.includeSender || false);
    const fromBlock = Number(getArgValue(args, '--from-block'));
    const toBlock = Number(getArgValue(args, '--to-block'));
    const limit = Number(getArgValue(args, '--n') || '0');
    const selector = (getArgValue(args, '--selector') || 'a9059cbb').toLowerCase();
    const singleUserOp = toBool(getArgValue(args, '--single-userop'), true);
    const strictTransfer = toBool(getArgValue(args, '--strict-transfer'), true);
    const windowSize = Number(getArgValue(args, '--window') || '2000');
    const creditMode = String(getArgValue(args, '--credit-mode') || 'any').toLowerCase();
    const outPath =
        getArgValue(args, '--out') ||
        presetDefaults.out ||
        path.resolve(process.cwd(), 'packages/analytics/data/industry_paymaster_baselines.csv');
    const appendFlag = toBool(getArgValue(args, '--append'), false);
    const dedupeFlag = toBool(getArgValue(args, '--dedupe'), true);
    const txHashesCsv = getArgValue(args, '--tx-hashes-csv') || presetDefaults.txHashesCsv;
    const txHashColumn = getArgValue(args, '--tx-hash-column') || 'TxHash';
    const txLabelColumn = getArgValue(args, '--tx-label-column') || 'Label';
    const txLabelFilter = getArgValue(args, '--tx-label-filter');
    const txHashesInline = getArgValue(args, '--tx-hashes');

    if (!rpcUrl) throw new Error('Missing rpc url');
    if (creditMode !== 'any' && creditMode !== 'credit' && creditMode !== 'non-credit') {
        throw new Error(`Invalid --credit-mode: ${creditMode}`);
    }
    const useTxHashesMode = Boolean(txHashesCsv || txHashesInline);
    if (!useTxHashesMode) {
        if (!Number.isFinite(fromBlock) || !Number.isFinite(toBlock) || fromBlock < 0 || toBlock < 0 || fromBlock > toBlock) {
            throw new Error('Invalid from/to block');
        }
    }

    const client = createPublicClient({ chain: network === 'op-mainnet' ? optimism : undefined, transport: http(rpcUrl) });
    const payTopic = `0x000000000000000000000000${paymaster.slice(2).toLowerCase()}`;
    const senderList = [
        ...(senderArg ? [senderArg] : []),
        ...(sendersArg ? sendersArg.split(',').map((s) => s.trim()) : [])
    ]
        .filter(Boolean)
        .map((s) => normalizeAddress(s));
    const senderTopics = senderList.map((s) => `0x000000000000000000000000${s.slice(2).toLowerCase()}`);
    const senderTopicForLogs: any =
        senderTopics.length === 0 ? null : senderTopics.length === 1 ? senderTopics[0] : senderTopics;

    const txInputCache = new Map<string, string>();
    const rows: Row[] = [];
    const existing = appendFlag ? await loadExistingOutStats(outPath, label) : { existingKeys: new Set<string>(), existingLabelCount: 0 };
    const existingKeys = appendFlag && dedupeFlag ? existing.existingKeys : new Set<string>();
    const targetNewRows = limit > 0 ? Math.max(0, limit - existing.existingLabelCount) : limit;

    if (appendFlag && limit > 0 && targetNewRows === 0) {
        console.log(`rows=0`);
        console.log(`out=${outPath}`);
        return;
    }

    let windowsScanned = 0;
    const processTx = async (tx: `0x${string}`) => {
        const receipt: any = await client.request({ method: 'eth_getTransactionReceipt', params: [tx] } as any);
        const allLogs: any[] = Array.isArray(receipt?.logs) ? receipt.logs : [];
        const txGasUsed = BigInt(receipt?.gasUsed || 0n);
        const sponsoredCostsByUser = transactionSponsoredCostsByUser(paymaster, allLogs);
        const debtByUser = debtRecordedAmountByUser(allLogs);
        const txLogs = allLogs.filter(
            (l) =>
                String(l?.address || '').toLowerCase() === entryPoint.toLowerCase() &&
                String(l?.topics?.[0] || '').toLowerCase() === USER_OP_EVENT.toLowerCase() &&
                String(l?.topics?.[3] || '').toLowerCase() === payTopic.toLowerCase() &&
                (senderTopics.length === 0 || senderTopics.includes(topicToAddress(l?.topics?.[2])))
        );
        if (!txLogs.length) return;
        if (singleUserOp && txLogs.length !== 1) return;

        let input = txInputCache.get(tx) ?? '';
        if (!input) {
            const txData: any = await client.request({ method: 'eth_getTransactionByHash', params: [tx] } as any);
            input = String(txData?.input || '').toLowerCase();
            txInputCache.set(tx, input);
        }
        const decoded = decodeHandleOps(input);
        if (!decoded) return;
        const callDataMap = await userOpCallDataByHash(client as any, entryPoint, decoded);

        for (const log of txLogs) {
            if (targetNewRows > 0 && rows.length >= targetNewRows) break;
            const gasUsed = parseActualGasUsed(log.data);
            if (gasUsed === null) continue;
            const userOpHash = String(log.topics?.[1] || '').toLowerCase();
            const userOpInfo = callDataMap.get(userOpHash);
            if (!userOpInfo) continue;
            const strictResult = strictTransfer ? isSimpleTransferCallData(userOpInfo.callData) : { ok: true, reason: 'strict disabled' };
            if (!strictTransfer && !userOpInfo.callData.includes(selector)) continue;
            if (!strictResult.ok) continue;
            const sender = topicToAddress(log.topics?.[2]).toLowerCase();
            const sponsored = sponsoredCostsByUser.get(sender);
            const debtAmount = debtByUser.get(sender) ?? 0n;
            const creditType = sponsored
                ? sponsored.xPNTsCost > 0n || debtAmount > 0n
                    ? 'credit'
                    : 'non-credit'
                : debtAmount > 0n
                  ? 'credit'
                  : 'unknown';
            if (creditMode !== 'any' && creditMode !== creditType) continue;
            const rowKey = `${tx.toLowerCase()}:${userOpHash}`;
            if (dedupeFlag && existingKeys.has(rowKey)) continue;
            rows.push({
                Label: label,
                PaymasterName: paymasterName,
                PaymasterAddress: paymaster,
                EntryPoint: entryPoint,
                Chain: chain,
                FromBlock: useTxHashesMode ? 0 : fromBlock,
                ToBlock: useTxHashesMode ? 0 : toBlock,
                BlockNumber: Number(log.blockNumber || receipt?.blockNumber || 0),
                TxHash: tx,
                UserOpHash: String(log.topics?.[1] || ''),
                Sender: sender as `0x${string}`,
                ActualGasUsed: gasUsed.toString(),
                TxGasUsed: txGasUsed.toString(),
                PreVerificationGas: userOpInfo.preVerificationGas.toString(),
                APNTS_Cost: sponsored ? sponsored.aPNTsCost.toString() : '',
                XPNTS_Cost: sponsored ? sponsored.xPNTsCost.toString() : '',
                CreditType: creditType,
                FilterNotes: `${singleUserOp ? 'single-UserOp bundle; ' : ''}${strictResult.reason}`
            });
            existingKeys.add(rowKey);
        }
    };

    if (useTxHashesMode) {
        let txHashes: `0x${string}`[] = [];
        if (txHashesCsv) {
            txHashes = await loadTxHashesFromCsv(txHashesCsv, txHashColumn, txLabelColumn, txLabelFilter);
        } else if (txHashesInline) {
            txHashes = txHashesInline
                .split(',')
                .map((s) => s.trim().toLowerCase())
                .filter((s) => s.startsWith('0x') && s.length === 66) as `0x${string}`[];
        }
        for (const tx of txHashes) {
            if (targetNewRows > 0 && rows.length >= targetNewRows) break;
            await processTx(tx);
        }
    } else {
        for (let end = toBlock; end >= fromBlock && (targetNewRows <= 0 || rows.length < targetNewRows); end -= windowSize) {
            const start = Math.max(fromBlock, end - windowSize + 1);
            windowsScanned += 1;
            if (windowsScanned % 20 === 0) {
                console.log(`scanned_windows=${windowsScanned} blocks=[${start},${end}] rows=${rows.length}`);
            }
            const logs: any[] = await client.request({
                method: 'eth_getLogs',
                params: [
                    {
                        fromBlock: `0x${start.toString(16)}`,
                        toBlock: `0x${end.toString(16)}`,
                        address: entryPoint,
                        topics: [USER_OP_EVENT, null, senderTopicForLogs, payTopic]
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
                if (targetNewRows > 0 && rows.length >= targetNewRows) break;
                if (singleUserOp && txLogs.length !== 1) continue;
                const receipt: any = await client.request({ method: 'eth_getTransactionReceipt', params: [tx as `0x${string}`] } as any);
                const allReceiptLogs: any[] = Array.isArray(receipt?.logs) ? receipt.logs : [];
                const sponsoredCostsByUser = transactionSponsoredCostsByUser(paymaster, allReceiptLogs);
                const debtByUser = debtRecordedAmountByUser(allReceiptLogs);
                let input = txInputCache.get(tx) ?? '';
                if (!input) {
                    const txData: any = await client.request({
                        method: 'eth_getTransactionByHash',
                        params: [tx as `0x${string}`]
                    } as any);
                    input = String(txData?.input || '').toLowerCase();
                    txInputCache.set(tx, input);
                }
                const decoded = decodeHandleOps(input);
                if (!decoded) continue;
                const callDataMap = await userOpCallDataByHash(client as any, entryPoint, decoded);
                for (const log of txLogs) {
                    const gasUsed = parseActualGasUsed(log.data);
                    if (gasUsed === null) continue;
                    const userOpHash = String(log.topics?.[1] || '').toLowerCase();
                    const callData = callDataMap.get(userOpHash) || '';
                    if (!callData) continue;
                    const strictResult = strictTransfer ? isSimpleTransferCallData(callData) : { ok: true, reason: 'strict disabled' };
                    if (!strictTransfer && !callData.includes(selector)) continue;
                    if (!strictResult.ok) continue;
                    const sender = topicToAddress(log.topics?.[2]).toLowerCase();
                    const sponsored = sponsoredCostsByUser.get(sender);
                    const debtAmount = debtByUser.get(sender) ?? 0n;
                    const creditType = sponsored
                        ? sponsored.xPNTsCost > 0n || debtAmount > 0n
                            ? 'credit'
                            : 'non-credit'
                        : debtAmount > 0n
                          ? 'credit'
                          : 'unknown';
                    if (creditMode !== 'any' && creditMode !== creditType) continue;
                    const txHash = String(log.transactionHash || '');
                    const rowKey = `${txHash.toLowerCase()}:${userOpHash}`;
                    if (dedupeFlag && existingKeys.has(rowKey)) continue;
                    rows.push({
                        Label: label,
                        PaymasterName: paymasterName,
                        PaymasterAddress: paymaster,
                        EntryPoint: entryPoint,
                        Chain: chain,
                        FromBlock: fromBlock,
                        ToBlock: toBlock,
                        BlockNumber: Number(log.blockNumber),
                        TxHash: txHash,
                        UserOpHash: log.topics?.[1] || '',
                        Sender: sender as `0x${string}`,
                        ActualGasUsed: gasUsed.toString(),
                        APNTS_Cost: sponsored ? sponsored.aPNTsCost.toString() : '',
                        XPNTS_Cost: sponsored ? sponsored.xPNTsCost.toString() : '',
                        CreditType: creditType,
                        FilterNotes: `${singleUserOp ? 'single-UserOp bundle; ' : ''}${strictResult.reason}`
                    });
                    existingKeys.add(rowKey);
                    if (targetNewRows > 0 && rows.length >= targetNewRows) break;
                }
            }
        }
    }

    if (!rows.length) {
        if (appendFlag && fs.existsSync(outPath)) {
            console.log(`rows=0`);
            console.log(`out=${outPath}`);
            return;
        }
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
            ...(includeSender ? [{ id: 'Sender', title: 'Sender' } as const] : []),
            { id: 'ActualGasUsed', title: 'ActualGasUsed' },
            { id: 'TxGasUsed', title: 'TxGasUsed' },
            { id: 'PreVerificationGas', title: 'PreVerificationGas' },
            { id: 'APNTS_Cost', title: 'APNTS_Cost' },
            { id: 'XPNTS_Cost', title: 'XPNTS_Cost' },
            { id: 'CreditType', title: 'CreditType' },
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
