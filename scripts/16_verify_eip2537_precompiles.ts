import { createPublicClient, encodeAbiParameters, http, parseAbi, type Address, type Hex } from 'viem';
import { optimismSepolia, sepolia } from 'viem/chains';
import * as bls from '@noble/bls12-381';
import * as dotenv from 'dotenv';
import { appendFile, writeFile } from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

type NetworkName = 'op-sepolia' | 'sepolia';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BLS_PRECOMPILES = {
    g1Add: '0x000000000000000000000000000000000000000b',
    g1Msm: '0x000000000000000000000000000000000000000c',
    g2Add: '0x000000000000000000000000000000000000000d',
    g2Msm: '0x000000000000000000000000000000000000000e',
    pairing: '0x000000000000000000000000000000000000000f',
    mapFpToG1: '0x0000000000000000000000000000000000000010',
    mapFp2ToG2: '0x0000000000000000000000000000000000000011'
} as const satisfies Record<string, Address>;

const BLSValidatorAbi = parseAbi(['function verifyProof(bytes proof, bytes message) view returns (bool)']);

function parseNetworkArg(argv: string[]): NetworkName {
    const idx = argv.indexOf('--network');
    const raw = idx >= 0 ? argv[idx + 1] : undefined;
    if (raw === 'sepolia' || raw === 'op-sepolia') return raw;
    return 'op-sepolia';
}

function parseOutArg(argv: string[]): string | undefined {
    const idx = argv.indexOf('--out');
    const raw = idx >= 0 ? argv[idx + 1] : undefined;
    if (!raw) return undefined;
    return raw;
}

function hasFlag(argv: string[], flag: string): boolean {
    return argv.includes(flag);
}

function getChain(network: NetworkName) {
    return network === 'sepolia' ? sepolia : optimismSepolia;
}

function bytesToHex(bytes: Uint8Array): Hex {
    return (`0x${Buffer.from(bytes).toString('hex')}`) as Hex;
}

function redactRpcUrl(rpcUrl: string): string {
    try {
        const u = new URL(rpcUrl);
        return `${u.protocol}//${u.host}`;
    } catch {
        return '<redacted>';
    }
}

function sanitizeErrorMessage(message: string): string {
    return message
        .replaceAll(/https?:\/\/\S+/g, '<redacted-url>')
        .replaceAll(/URL:\s.*(\r?\n)?/g, '')
        .replaceAll(/Request body:\s.*(\r?\n)?/g, '')
        .replaceAll(/Raw Call Arguments:[\s\S]*/g, '')
        .trim();
}

function safeErrorMessage(e: unknown): string {
    if (!e) return 'Unknown error';
    if (typeof e === 'string') return sanitizeErrorMessage(e);
    if (typeof e === 'object') {
        const anyErr = e as any;
        const preferred =
            (typeof anyErr.shortMessage === 'string' && anyErr.shortMessage) ||
            (typeof anyErr.name === 'string' && anyErr.name) ||
            (typeof anyErr.message === 'string' && anyErr.message) ||
            undefined;
        if (preferred) return sanitizeErrorMessage(preferred);
        return sanitizeErrorMessage(String(e));
    }
    return sanitizeErrorMessage(String(e));
}

function leftPadTo(bytes: Uint8Array, length: number): Uint8Array {
    if (bytes.length > length) throw new Error(`Cannot pad: ${bytes.length} > ${length}`);
    if (bytes.length === length) return bytes;
    const out = new Uint8Array(length);
    out.set(bytes, length - bytes.length);
    return out;
}

function splitBytes32Pair(fp48: Uint8Array): { hi: Hex; lo: Hex } {
    const fp64 = leftPadTo(fp48, 64);
    const hi = fp64.slice(0, 32);
    const lo = fp64.slice(32, 64);
    return { hi: bytesToHex(hi), lo: bytesToHex(lo) };
}

function g1UncompressedToStruct(uncompressed96: Uint8Array) {
    if (uncompressed96.length !== 96) {
        throw new Error(`Expected 96 bytes for G1 uncompressed, got ${uncompressed96.length}`);
    }
    const x48 = uncompressed96.slice(0, 48);
    const y48 = uncompressed96.slice(48, 96);
    const x = splitBytes32Pair(x48);
    const y = splitBytes32Pair(y48);
    return { x_a: x.hi, x_b: x.lo, y_a: y.hi, y_b: y.lo } as const;
}

function g2UncompressedToStruct(uncompressed192: Uint8Array) {
    if (uncompressed192.length !== 192) {
        throw new Error(`Expected 192 bytes for G2 uncompressed, got ${uncompressed192.length}`);
    }
    const x = uncompressed192.slice(0, 96);
    const y = uncompressed192.slice(96, 192);
    const x_c1 = splitBytes32Pair(x.slice(0, 48));
    const x_c0 = splitBytes32Pair(x.slice(48, 96));
    const y_c1 = splitBytes32Pair(y.slice(0, 48));
    const y_c0 = splitBytes32Pair(y.slice(48, 96));
    return {
        x_c0_a: x_c0.hi,
        x_c0_b: x_c0.lo,
        x_c1_a: x_c1.hi,
        x_c1_b: x_c1.lo,
        y_c0_a: y_c0.hi,
        y_c0_b: y_c0.lo,
        y_c1_a: y_c1.hi,
        y_c1_b: y_c1.lo
    } as const;
}

async function verifyRawPrecompileCalls(publicClient: any) {
    const fp64Zeros = (`0x${'00'.repeat(64)}`) as Hex;
    const fp2_128Zeros = (`0x${'00'.repeat(128)}`) as Hex;
    const g1_256Zeros = (`0x${'00'.repeat(256)}`) as Hex;
    const g2_512Zeros = (`0x${'00'.repeat(512)}`) as Hex;
    const pairing_384Zeros = (`0x${'00'.repeat(384)}`) as Hex;

    const calls: Array<{ name: string; to: Address; data: Hex; expectedMinBytes: number }> = [
        { name: 'mapFpToG1 (0x10)', to: BLS_PRECOMPILES.mapFpToG1, data: fp64Zeros, expectedMinBytes: 128 },
        { name: 'mapFp2ToG2 (0x11)', to: BLS_PRECOMPILES.mapFp2ToG2, data: fp2_128Zeros, expectedMinBytes: 256 },
        { name: 'g1Add (0x0b)', to: BLS_PRECOMPILES.g1Add, data: g1_256Zeros, expectedMinBytes: 128 },
        { name: 'g2Add (0x0d)', to: BLS_PRECOMPILES.g2Add, data: g2_512Zeros, expectedMinBytes: 256 },
        { name: 'pairing (0x0f)', to: BLS_PRECOMPILES.pairing, data: pairing_384Zeros, expectedMinBytes: 32 }
    ];

    const results: Record<string, { ok: boolean; returnBytes: number; returnHexPrefix?: string; error?: string }> = {};
    for (const c of calls) {
        try {
            const res = await publicClient.call({ to: c.to, data: c.data });
            const data = (res?.data ?? '0x') as Hex;
            const returnBytes = (data.length - 2) / 2;
            const ok = returnBytes >= c.expectedMinBytes;
            results[c.name] = {
                ok,
                returnBytes,
                returnHexPrefix: data.slice(0, 18)
            };
        } catch (e: any) {
            results[c.name] = { ok: false, returnBytes: 0, error: safeErrorMessage(e) };
        }
    }
    return results;
}

async function verifyOnChainBlsValidator(publicClient: any, blsValidator: Address) {
    bls.utils.setDSTLabel('BLS12381G2_XMD:SHA-256_SSWU_RO_NUL_');

    const privateKey = ('7f'.repeat(32)) as string;
    const message = new TextEncoder().encode('aastar-eip2537-precompile-check-v1');

    const pkCompressed = bls.getPublicKey(privateKey);
    const sigCompressed = await bls.sign(message, privateKey);

    const pkPoint = bls.PointG1.fromHex(pkCompressed);
    const sigPoint = bls.PointG2.fromSignature(sigCompressed);
    const msgPoint = await bls.PointG2.hashToCurve(message);

    const pkUncompressed = pkPoint.toRawBytes(false);
    const sigUncompressed = sigPoint.toRawBytes(false);
    const msgUncompressed = msgPoint.toRawBytes(false);

    const g1 = g1UncompressedToStruct(pkUncompressed);
    const g2Sig = g2UncompressedToStruct(sigUncompressed);
    const g2Msg = g2UncompressedToStruct(msgUncompressed);

    const g1Bytes = encodeAbiParameters(
        [
            {
                type: 'tuple',
                components: [
                    { name: 'x_a', type: 'bytes32' },
                    { name: 'x_b', type: 'bytes32' },
                    { name: 'y_a', type: 'bytes32' },
                    { name: 'y_b', type: 'bytes32' }
                ]
            }
        ],
        [g1]
    );

    const g2Bytes = (p: typeof g2Sig) =>
        encodeAbiParameters(
            [
                {
                    type: 'tuple',
                    components: [
                        { name: 'x_c0_a', type: 'bytes32' },
                        { name: 'x_c0_b', type: 'bytes32' },
                        { name: 'x_c1_a', type: 'bytes32' },
                        { name: 'x_c1_b', type: 'bytes32' },
                        { name: 'y_c0_a', type: 'bytes32' },
                        { name: 'y_c0_b', type: 'bytes32' },
                        { name: 'y_c1_a', type: 'bytes32' },
                        { name: 'y_c1_b', type: 'bytes32' }
                    ]
                }
            ],
            [p]
        );

    const proof = encodeAbiParameters(
        [{ type: 'bytes' }, { type: 'bytes' }, { type: 'bytes' }, { type: 'uint256' }],
        [g1Bytes, g2Bytes(g2Sig), g2Bytes(g2Msg), 1n]
    );

    const isValid = await publicClient.readContract({
        address: blsValidator,
        abi: BLSValidatorAbi,
        functionName: 'verifyProof',
        args: [proof, bytesToHex(message)]
    });

    const gasEstimate = await publicClient.estimateContractGas({
        address: blsValidator,
        abi: BLSValidatorAbi,
        functionName: 'verifyProof',
        args: [proof, bytesToHex(message)]
    });

    return { isValid, gasEstimate: gasEstimate.toString() };
}

async function main() {
    const argv = process.argv.slice(2);
    const network = parseNetworkArg(argv);
    const outPath = parseOutArg(argv);
    const jsonOnly = hasFlag(argv, '--json');
    dotenv.config({ path: path.resolve(__dirname, `../.env.${network}`) });

    const chain = getChain(network);
    const rpcUrl = process.env.RPC_URL;
    if (!rpcUrl) {
        throw new Error(`Missing RPC_URL in .env.${network}`);
    }

    const configPath = path.resolve(__dirname, `../config.${network}.json`);
    const config = (await import(configPath, { with: { type: 'json' } } as any)).default as Record<string, string>;
    const blsValidator = config.blsValidator as Address;

    const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });

    const blockNumber = await publicClient.getBlockNumber();

    const raw = await verifyRawPrecompileCalls(publicClient);
    const onchain = await verifyOnChainBlsValidator(publicClient, blsValidator);

    const summary = {
        type: 'eip2537_precompile_check',
        at: new Date().toISOString(),
        network,
        chainId: chain.id,
        rpc: redactRpcUrl(rpcUrl),
        blockNumber: blockNumber.toString(),
        blsValidator,
        raw,
        verifyProof: { isValid: Boolean(onchain.isValid), gasEstimate: onchain.gasEstimate }
    };

    if (outPath) {
        const resolved = path.resolve(process.cwd(), outPath);
        if (resolved.endsWith('.jsonl')) {
            await appendFile(resolved, `${JSON.stringify(summary)}\n`, 'utf8');
        } else {
            await writeFile(resolved, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
        }
    }

    if (jsonOnly) {
        process.stdout.write(`${JSON.stringify(summary)}\n`);
        return;
    }

    console.log(`\n🔬 EIP-2537 Precompile Verification`);
    console.log(`   Network: ${network}`);
    console.log(`   RPC: ${redactRpcUrl(rpcUrl)}`);
    console.log(`   Block: ${blockNumber}`);
    console.log(`   BLSValidator: ${blsValidator}\n`);

    console.log(`1) Raw precompile calls (existence + expected returndata sizes)`);
    for (const [name, r] of Object.entries(raw)) {
        if (r.ok) {
            console.log(`   ✅ ${name}: ${r.returnBytes} bytes (prefix ${r.returnHexPrefix})`);
        } else {
            console.log(`   ❌ ${name}: ${r.error || 'unexpected returndata'} (${r.returnBytes} bytes)`);
        }
    }

    console.log(`\n2) On-chain BLSValidator.verifyProof (pairing + map-to-curve)`);
    console.log(`   ✅ verifyProof result: ${onchain.isValid}`);
    console.log(`   ⛽️ estimateGas: ${onchain.gasEstimate}`);
    console.log(`\n3) Structured summary (for log extraction)`);
    console.log(`   ${JSON.stringify(summary)}`);
    console.log(`\n✅ Done.\n`);
}

main().catch((e) => {
    console.error(safeErrorMessage(e));
    process.exitCode = 1;
});
