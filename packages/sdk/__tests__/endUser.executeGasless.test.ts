import { describe, expect, it, vi } from 'vitest';
import {
    custom,
    decodeFunctionData,
    encodeFunctionResult,
    keccak256,
    parseAbi,
    parseTransaction,
    toFunctionSelector,
    type Address,
    type Hex,
} from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { SuperPaymasterV550ABI } from '@aastar/core';
import { createEndUserClient } from '../src/clients/endUser';

// DSR C12: createEndUserClient().executeGasless hand-rolled a 72-byte paymasterAndData (no token)
// with a 50k postOp — sigFailed by SuperPaymaster 5.5.0 (token REQUIRED, postOp below minPostOpGas)
// and below 5.4.2's MIN_POST_OP_GAS too. Offline: a custom transport answers every RPC and captures
// the signed handleOps; nothing reaches a network. The key is anvil's public test key #0.
const KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const SP = '0x1111111111111111111111111111111111111111' as Address;
const EP = '0x0000000071727De22E5E9d8BAf0edAc6f37da032' as Address;
const OPERATOR = '0x4444444444444444444444444444444444444444' as Address;
const TOKEN = '0x3333333333333333333333333333333333333333' as Address;
const AA = '0x5555555555555555555555555555555555555555' as Address;

const reads = parseAbi([
    'function version() view returns (string)',
    'function operators(address) view returns (uint128,bool,bool,address,uint32,uint48,address,uint256,uint256)',
    'function getNonce(address,uint192) view returns (uint256)',
]);
const handleOpsAbi = parseAbi([
    'function handleOps((address sender,uint256 nonce,bytes initCode,bytes callData,bytes32 accountGasLimits,uint256 preVerificationGas,bytes32 gasFees,bytes paymasterAndData,bytes signature)[] ops, address beneficiary)',
]);

function harness(version: string, opts: { minPostOpGas?: bigint; configured?: boolean } = {}) {
    let sentRaw: Hex | undefined;
    const sel = (sig: string) => toFunctionSelector(sig);
    const request = vi.fn(async ({ method, params }: { method: string; params?: any[] }) => {
        switch (method) {
            case 'eth_chainId': return '0xaa36a7';
            case 'eth_getTransactionCount': return '0x0';
            case 'eth_estimateGas': return '0x30d40';
            case 'eth_maxPriorityFeePerGas': return '0x3b9aca00';
            case 'eth_gasPrice': return '0x3b9aca00';
            case 'eth_blockNumber': return '0x10';
            case 'eth_getBlockByNumber': return { number: '0x10', baseFeePerGas: '0x3b9aca00', timestamp: '0x1', hash: '0x' + '11'.repeat(32), transactions: [] };
            case 'eth_sendRawTransaction': sentRaw = params![0]; return keccak256(params![0]);
            case 'eth_getTransactionReceipt':
                return { transactionHash: keccak256(sentRaw!), status: '0x1', blockNumber: '0x10', blockHash: '0x' + '11'.repeat(32), logs: [], cumulativeGasUsed: '0x1', gasUsed: '0x1', effectiveGasPrice: '0x1', from: '0x' + '00'.repeat(20), to: EP, transactionIndex: '0x0', type: '0x2', logsBloom: '0x' + '00'.repeat(256), contractAddress: null };
            case 'eth_call': {
                const data = String(params![0].data ?? params![0].input).slice(0, 10);
                if (data === sel('function version()')) return encodeFunctionResult({ abi: reads, functionName: 'version', result: version });
                if (data === sel('function operators(address)'))
                    return encodeFunctionResult({ abi: reads, functionName: 'operators', result: [10n ** 21n, opts.configured ?? true, false, TOKEN, 0, 0, OPERATOR, 0n, 0n] });
                if (data === sel('function gasParams()')) {
                    // Encoded with the vendored 5.5.0 ABI, so the shape is the contract's, not a guess.
                    const g = { minPostOpGas: Number(opts.minPostOpGas ?? 200_000n), settleGasBound: 0, cWrap: 0, cPostop: 0 };
                    return encodeFunctionResult({ abi: SuperPaymasterV550ABI as any, functionName: 'gasParams', result: [g, { ...g, eta: 0n }] as any });
                }
                if (data === sel('function getNonce(address,uint192)')) return encodeFunctionResult({ abi: reads, functionName: 'getNonce', result: 7n });
                if (data === toFunctionSelector('function getUserOpHash((address,uint256,bytes,bytes,bytes32,uint256,bytes32,bytes,bytes))')) return '0x' + 'ab'.repeat(32);
                throw Object.assign(new Error(`unexpected eth_call ${data}`), { code: -32000 });
            }
            default: throw Object.assign(new Error(`unexpected ${method}`), { code: -32601 });
        }
    });
    const c: any = createEndUserClient({
        chain: sepolia,
        transport: custom({ request }, { retryCount: 0 }),
        account: privateKeyToAccount(KEY),
        addresses: { superPaymaster: SP, entryPoint: EP },
    });
    c.createSmartAccount = async () => ({ accountAddress: AA, initCode: '0x', isDeployed: true });
    const paymasterAndData = (): Hex => {
        const tx = parseTransaction(sentRaw!);
        const { args } = decodeFunctionData({ abi: handleOpsAbi, data: tx.data! });
        return (args[0] as any)[0].paymasterAndData as Hex;
    };
    return { c, paymasterAndData };
}

const at = (hex: Hex, a: number, b: number) => '0x' + hex.slice(2 + a * 2, 2 + b * 2);

describe('createEndUserClient().executeGasless builds a paymasterAndData the deployed SP accepts', () => {
    it.each([
        ['SuperPaymaster-5.5.0', 350_000n, 350_000n],
        ['SuperPaymaster-5.4.2', undefined, 300_000n],
    ])('%s: 125-byte layout with the operator token, postOp at the contract floor', async (version, minPostOpGas, expectedPostOp) => {
        const { c, paymasterAndData } = harness(version, { minPostOpGas });
        await c.executeGasless({ target: TOKEN, data: '0x1234', operator: OPERATOR });
        const pmd = paymasterAndData();
        expect((pmd.length - 2) / 2).toBe(125);
        expect(at(pmd, 0, 20)).toBe(SP.toLowerCase());
        expect(BigInt(at(pmd, 20, 36))).toBe(250_000n);
        expect(BigInt(at(pmd, 36, 52))).toBe(expectedPostOp);
        expect(at(pmd, 52, 72)).toBe(OPERATOR.toLowerCase());
        expect(at(pmd, 104, 124)).toBe(TOKEN.toLowerCase());
        expect(at(pmd, 124, 125)).toBe('0x00');
    });

    it('an unconfigured operator fails before anything is signed or sent', async () => {
        const { c } = harness('SuperPaymaster-5.5.0', { configured: false });
        await expect(c.executeGasless({ target: TOKEN, data: '0x1234', operator: OPERATOR })).rejects.toThrow(/not configured/);
    });
});
