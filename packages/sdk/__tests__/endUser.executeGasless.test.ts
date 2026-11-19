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
            case 'eth_feeHistory': return { oldestBlock: '0x10', baseFeePerGas: ['0x3b9aca00', '0x3b9aca00'], gasUsedRatio: [0.5], reward: [['0x77359400']] };
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
    const sentTx = () => parseTransaction(sentRaw!);
    const sentOp = () => (decodeFunctionData({ abi: handleOpsAbi, data: sentTx().data! }).args[0] as any)[0];
    const paymasterAndData = (): Hex => sentOp().paymasterAndData as Hex;
    return { c, paymasterAndData, sentTx, sentOp, request, sent: () => sentRaw };
}

const EXPLICIT = { verificationGasLimit: 90_000n, callGasLimit: 80_000n, preVerificationGas: 60_000n, paymasterVerificationGasLimit: 210_000n, paymasterPostOpGasLimit: 150_000n };
const at = (hex: Hex, a: number, b: number) => '0x' + hex.slice(2 + a * 2, 2 + b * 2);

describe('createEndUserClient().executeGasless builds a paymasterAndData the deployed SP accepts', () => {
    it.each([
        ['SuperPaymaster-5.5.0', 350_000n, 350_000n],
        ['SuperPaymaster-5.4.2', undefined, 200_000n], // the explicit 150k raised to 5.4.2's 200k floor
    ])('%s: 125-byte layout with the operator token, postOp at the contract floor', async (version, minPostOpGas, expectedPostOp) => {
        const { c, paymasterAndData } = harness(version, { minPostOpGas });
        await c.executeGasless({ target: TOKEN, data: '0x1234', operator: OPERATOR, gas: EXPLICIT });
        const pmd = paymasterAndData();
        expect((pmd.length - 2) / 2).toBe(125);
        expect(at(pmd, 0, 20)).toBe(SP.toLowerCase());
        expect(BigInt(at(pmd, 20, 36))).toBe(EXPLICIT.paymasterVerificationGasLimit); // the caller's, no SDK constant
        expect(BigInt(at(pmd, 36, 52))).toBe(expectedPostOp);
        expect(at(pmd, 52, 72)).toBe(OPERATOR.toLowerCase());
        expect(at(pmd, 104, 124)).toBe(TOKEN.toLowerCase());
        expect(at(pmd, 124, 125)).toBe('0x00');
    });

    it('an unconfigured operator fails before anything is signed or sent', async () => {
        const { c } = harness('SuperPaymaster-5.5.0', { configured: false });
        await expect(c.executeGasless({ target: TOKEN, data: '0x1234', operator: OPERATOR, gas: EXPLICIT })).rejects.toThrow(/not configured/);
    });
});

describe('executeGasless gas: explicit or estimate x coefficient, never an SDK constant (DSR D14)', () => {
    it('no gas and no estimateBundlerUrl: refused before anything is signed or sent', async () => {
        const { c, sent } = harness('SuperPaymaster-5.5.0', { minPostOpGas: 350_000n });
        await expect(c.executeGasless({ target: TOKEN, data: '0x1234', operator: OPERATOR })).rejects.toThrow(/no gas source for .*pass gas or estimateBundlerUrl/);
        expect(sent()).toBeUndefined();
    });

    it('estimate x 1.5 per field (labelled estimate), postOp raised to the chain floor (floor), fees from eth_feeHistory, handleOps gas = node estimate x 1.5', async () => {
        const { c, sentTx, sentOp } = harness('SuperPaymaster-5.5.0', { minPostOpGas: 500_000n });
        const est = { preVerificationGas: '0xea60', verificationGasLimit: '0x11170', callGasLimit: '0x9c40', paymasterVerificationGasLimit: '0x30d40', paymasterPostOpGasLimit: '0x186a0' };
        const fetchMock = vi.fn(async (_u: string, init: any) => {
            const body = JSON.parse(init.body);
            if (body.method !== 'eth_estimateUserOperationGas') throw new Error(`unexpected bundler ${body.method}`);
            return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: est }), { status: 200, headers: { 'content-type': 'application/json' } });
        });
        vi.stubGlobal('fetch', fetchMock);
        const decisions: any[] = [];
        try {
            await c.executeGasless({ target: TOKEN, data: '0x1234', operator: OPERATOR, estimateBundlerUrl: 'http://127.0.0.1:4337', onGasDecided: (d: any) => decisions.push(d) });
        } finally { vi.unstubAllGlobals(); }
        const d = decisions[0];
        expect(d.limits).toEqual({ verificationGasLimit: 105_000n, callGasLimit: 60_000n, preVerificationGas: 90_000n, paymasterVerificationGasLimit: 300_000n, paymasterPostOpGasLimit: 500_000n });
        expect(d.limitSources).toEqual({ verificationGasLimit: 'estimate', callGasLimit: 'estimate', preVerificationGas: 'estimate', paymasterVerificationGasLimit: 'estimate', paymasterPostOpGasLimit: 'floor' });
        expect(d.coefficientBps).toBe(15_000n);
        expect(d.fees.source).toBe('feeHistory');
        expect(d.handleOps).toEqual({ estimate: 200_000n, gasLimit: 300_000n, source: 'estimate' });
        // What was signed and sent is exactly the decision.
        const op = sentOp();
        expect(BigInt(op.preVerificationGas)).toBe(90_000n);
        expect(BigInt('0x' + (op.accountGasLimits as string).slice(2, 34))).toBe(105_000n);
        expect(BigInt('0x' + (op.accountGasLimits as string).slice(34))).toBe(60_000n);
        expect(sentTx().gas).toBe(300_000n);
        expect(sentTx().maxFeePerGas).toBe(d.fees.maxFeePerGas);
    });

    it('explicit fields win over the estimate and are labelled explicit', async () => {
        const { c } = harness('SuperPaymaster-5.5.0', { minPostOpGas: 100_000n });
        const decisions: any[] = [];
        await c.executeGasless({ target: TOKEN, data: '0x1234', operator: OPERATOR, gas: EXPLICIT, onGasDecided: (d: any) => decisions.push(d) });
        expect(decisions[0].limits).toEqual(EXPLICIT);
        expect(Object.values(decisions[0].limitSources)).toEqual(['explicit', 'explicit', 'explicit', 'explicit', 'explicit']);
        expect(decisions[0].estimate).toBeUndefined();
    });
});
