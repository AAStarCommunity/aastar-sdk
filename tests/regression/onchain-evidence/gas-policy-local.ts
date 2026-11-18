/**
 * Evidence: PaymasterClient.submitGaslessUserOperation's gas limits (bundler estimate × coefficient, contract floors from
 * the chain) and fees (eth_feeHistory) against a fresh SuperPaymaster DeployLive stack on a LOCAL anvil, through a real
 * bundler. Three SuperPaymaster ops from one account: the credit branch, the balance branch, and the balance branch again
 * with the second op's limits frozen. callData is the three-arm task shape execute(T, 0, transfer(0x…dEaD, 1)).
 *
 *   LOCAL_ANVIL_CONFIG=<SP DeployLive config.json> LOCAL_ANVIL_RPC=http://127.0.0.1:8545 BUNDLER_URL=http://127.0.0.1:4337 \
 *   SENDER_AA=<SimpleAccount of mnemonic index 0> TASK_TOKEN=<plain ERC-20 the account holds> pnpm exec tsx tests/regression/onchain-evidence/gas-policy-local.ts
 *
 * Sends transactions on a DISPOSABLE local chain only: the RPC and the bundler must be loopback URLs and both must report
 * chain id 31337. Part 1 changes that chain's state (price, balances, debt, nonces) and is not undone; Part 2 runs in
 * snapshots that are reverted. Accounts come from anvil's public default mnemonic. The account needs ENDUSER on the operator's community, and the operator's token needs credit open for it.
 * Output: docs/onchain-evidence/gas-policy-local.md.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createPublicClient, createWalletClient, decodeEventLog, encodeFunctionData, erc20Abi, http, parseEther, type Address, type Hex } from 'viem';
import { EntryPointABI } from '../../../packages/core/src/abis/index.js';
import { mnemonicToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import { PaymasterClient } from '../../../packages/paymaster/src/V4/PaymasterClient.js';
import type { GasDecision } from '../../../packages/paymaster/src/V4/gasPolicy.js';
import { SuperPaymasterInflightGuard } from '../../../packages/paymaster/src/SuperPaymaster/v550.js';

const OUT = 'docs/onchain-evidence/gas-policy-local.md';
const EP = '0x0000000071727De22E5E9d8BAf0edAc6f37da032' as Address;
const DEAD = '0x000000000000000000000000000000000000dEaD' as Address;
const MNEMONIC = 'test test test test test test test test test test test junk'; // anvil's public default mnemonic
const DEBTS = [{ type: 'function', name: 'debts', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] }] as const;
const EXECUTE = [{ type: 'function', name: 'execute', stateMutability: 'nonpayable', inputs: [{ type: 'address' }, { type: 'uint256' }, { type: 'bytes' }], outputs: [] }] as const;
const OPERATORS = [{ type: 'function', name: 'operators', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint128' }, { type: 'bool' }, { type: 'bool' }, { type: 'address' }, { type: 'uint32' }, { type: 'uint48' }, { type: 'address' }, { type: 'uint256' }, { type: 'uint256' }] }] as const;

const need = (k: string) => { const v = process.env[k]; if (!v) throw new Error(`${k} is required`); return v; };

async function main() {
    const cfg = JSON.parse(readFileSync(need('LOCAL_ANVIL_CONFIG'), 'utf8'));
    const t = http(process.env.LOCAL_ANVIL_RPC ?? 'http://127.0.0.1:8545');
    const bundlerUrl = need('BUNDLER_URL');
    const aa = need('SENDER_AA') as Address, taskToken = need('TASK_TOKEN') as Address;
    const owner = mnemonicToAccount(MNEMONIC, { addressIndex: 0 }), operator = mnemonicToAccount(MNEMONIC, { addressIndex: 1 });
    const loopback = (u: string) => ['127.0.0.1', 'localhost', '[::1]'].includes(new URL(u).hostname);
    const rpcUrl = process.env.LOCAL_ANVIL_RPC ?? 'http://127.0.0.1:8545';
    if (!loopback(rpcUrl) || !loopback(bundlerUrl)) throw new Error('LOCAL_ANVIL_RPC and BUNDLER_URL must be loopback URLs (a disposable local chain)');
    const pub: any = createPublicClient({ chain: foundry, transport: t });
    if ((await pub.getChainId()) !== 31337) throw new Error('not a local anvil (chain 31337)');
    const bundlerChain = await (await fetch(bundlerUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }) })).json();
    if (BigInt(bundlerChain.result ?? 0) !== 31337n) throw new Error('the bundler is not on chain 31337');
    const wallet: any = createWalletClient({ account: owner, chain: foundry, transport: t });
    const opWallet: any = createWalletClient({ account: operator, chain: foundry, transport: t });
    const gasToken = (await pub.readContract({ address: cfg.superPaymaster, abi: OPERATORS, functionName: 'operators', args: [operator.address] }))[3] as Address;
    const wait = async (hash: Hex) => { if ((await pub.waitForTransactionReceipt({ hash })).status !== 'success') throw new Error(`local tx ${hash} reverted`); };
    const balance = () => pub.readContract({ address: gasToken, abi: erc20Abi, functionName: 'balanceOf', args: [aa] }) as Promise<bigint>;
    const debt = () => pub.readContract({ address: gasToken, abi: DEBTS, functionName: 'debts', args: [aa] }) as Promise<bigint>;
    const callData = PaymasterClient.encodeExecution(taskToken, 0n, PaymasterClient.encodeTokenTransfer(DEAD, 1n));
    const receiptOf = async (userOpHash: Hex) => {
        for (let i = 0; i < 120; i++) {
            const res = await fetch(bundlerUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getUserOperationReceipt', params: [userOpHash] }) });
            const r = (await res.json()).result;
            if (r) return r;
            await new Promise((ok) => setTimeout(ok, 1000));
        }
        return undefined;
    };

    // The cached price goes stale on an idle local chain; updatePrice is permissionless (the keeper's job).
    await wait(await wallet.writeContract({ address: cfg.superPaymaster, abi: [{ type: 'function', name: 'updatePrice', stateMutability: 'nonpayable', inputs: [], outputs: [] }], functionName: 'updatePrice' }));
    const rows: string[] = [];
    let ok = true;
    const s = (x?: bigint) => (x === undefined ? '—' : x.toString());
    async function op(label: string, extra: Record<string, unknown>, expect: (d: GasDecision, debtBefore: bigint, debtAfter: bigint) => string | undefined) {
        let decision: GasDecision | undefined;
        const debtBefore = await debt();
        const hash = await PaymasterClient.submitGaslessUserOperation(pub, wallet, aa, EP, cfg.superPaymaster, gasToken, bundlerUrl, callData,
            { operator: operator.address, autoEstimate: true, onGasDecided: (d: GasDecision) => { decision = d; }, ...extra })
            .catch((e: Error) => { throw new Error(`${label}: ${e.message}`); });
        const r: any = await receiptOf(hash);
        const debtAfter = await debt();
        const problem = !r?.success ? 'op did not succeed' : !decision ? 'no gas decision reported' : expect(decision, debtBefore, debtAfter);
        if (problem) ok = false;
        const d = decision!, l = d?.limits, e = d?.estimate;
        rows.push(`| ${label} | ${hash} | ${r?.success} | ${s(r?.actualGasUsed !== undefined ? BigInt(r.actualGasUsed) : undefined)} | ${d?.limitsSource}${d?.coefficientBps ? ` ×${Number(d.coefficientBps) / 10_000}` : ''} | ${e ? `${e.verificationGasLimit}/${e.callGasLimit}/${e.preVerificationGas}/${e.paymasterVerificationGasLimit}/${e.paymasterPostOpGasLimit}` : '—'} | ${l ? `${l.verificationGasLimit}/${l.callGasLimit}/${l.preVerificationGas}/${l.paymasterVerificationGasLimit}/${l.paymasterPostOpGasLimit}` : '—'} | ${s(d?.floors.paymasterPostOpGasLimit)} | ${d ? `${d.fees.source}: priority ${d.fees.maxPriorityFeePerGas}, maxFee ${d.fees.maxFeePerGas}, base ${s(d.fees.baseFeePerGas)}` : '—'} | ${debtAfter - debtBefore} | ${problem ? `**NO** (${problem})` : 'yes'} |`);
        lastGas = r?.actualGasUsed !== undefined ? BigInt(r.actualGasUsed) : undefined;
        return d;
    }
    let lastGas: bigint | undefined;
    const scaledOk = (d: GasDecision) => {
        const e = d.estimate!;
        const want = (x: bigint) => (x * d.coefficientBps! + 9_999n) / 10_000n;
        const pmPost = want(e.paymasterPostOpGasLimit) > d.floors.paymasterPostOpGasLimit! ? want(e.paymasterPostOpGasLimit) : d.floors.paymasterPostOpGasLimit!;
        const l = d.limits;
        return l.verificationGasLimit === want(e.verificationGasLimit) && l.callGasLimit === want(e.callGasLimit) && l.preVerificationGas === want(e.preVerificationGas)
            && l.paymasterVerificationGasLimit === want(e.paymasterVerificationGasLimit) && l.paymasterPostOpGasLimit === pmPost ? undefined : 'limits are not estimate × coefficient with the floor';
    };

    // A: no gas-token balance, so the lock fails and the op takes the credit branch.
    const b0 = await balance();
    if (b0 > 0n) await wait(await wallet.writeContract({ address: aa, abi: EXECUTE, functionName: 'execute', args: [gasToken, 0n, encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [operator.address, b0] })] }));
    // Anvil reports a 1 gwei priority fee, so its feeHistory fees reserve more than the credit cap; this op passes
    // OP-like fees explicitly (they win over the chain's), B and C take theirs from eth_feeHistory.
    await op('A: credit branch, estimate, caller fees', { maxPriorityFeePerGas: 1_000_000n, maxFeePerGas: 2_000_000n }, (d, before, after) =>
        scaledOk(d) ?? (d.fees.source !== 'caller' || d.feesRaisedByBundler || d.fees.maxPriorityFeePerGas !== 1_000_000n || d.fees.maxFeePerGas !== 2_000_000n
            ? 'caller fees not sent as given' : after > before ? undefined : 'no debt recorded (not the credit branch)'));
    // B: enough balance for the reservation at anvil's fees, so the balance branch.
    // Minted by the operator (the community that owns the token), so a rerun does not run the operator's balance out.
    await wait(await opWallet.writeContract({ address: gasToken, abi: [{ type: 'function', name: 'mint', stateMutability: 'nonpayable', inputs: [{ type: 'address' }, { type: 'uint256' }], outputs: [] }], functionName: 'mint', args: [aa, parseEther('300')] }));
    const dB = await op('B: balance branch, estimate, feeHistory fees', {}, (d, before, after) =>
        scaledOk(d) ?? (d.fees.source !== 'feeHistory' ? 'fees not from eth_feeHistory' : after === before ? undefined : 'debt changed (not the balance branch)'));
    const gasB = lastGas;
    // C: B's limits frozen: sent exactly, no estimate.
    await op('C: balance branch, B\'s limits frozen', { frozenGas: dB.limits }, (d) =>
        d.limitsSource === 'frozen' && d.estimate === undefined && JSON.stringify(d.limits, (_k, v) => typeof v === 'bigint' ? v.toString() : v) === JSON.stringify(dB.limits, (_k, v) => typeof v === 'bigint' ? v.toString() : v) ? undefined : 'frozen limits were not sent as given');
    if (gasB === undefined || lastGas !== gasB) {
        ok = false;
        rows.push(`| C vs B: actualGasUsed with the same frozen limits | B ${gasB}, C ${lastGas} | — | — | — | — | — | — | — | — | **NO** (not identical) |`);
    } else {
        rows.push(`| C vs B: actualGasUsed with the same frozen limits | identical: ${gasB} | — | — | — | — | — | — | — | — | yes |`);
    }

    // Part 2 — does a limit change actualGas? From one snapshot, the same op with exactly one limit raised by 200k, each
    // sent and then reverted, so every variant starts from identical state. EntryPoint v0.7 charges 10% of the unused
    // EXECUTION gas (callGasLimit + paymasterPostOpGasLimit) when it exceeds 40,000; verification gas is not penalised.
    const STEP = 200_000n;
    const variants: Array<[string, Partial<GasDecision['limits']>, bigint]> = [
        ['baseline (B\'s limits)', {}, 0n],
        ['paymasterVerificationGasLimit + 200k', { paymasterVerificationGasLimit: dB.limits.paymasterVerificationGasLimit + STEP }, 0n],
        ['callGasLimit + 200k', { callGasLimit: dB.limits.callGasLimit + STEP }, STEP / 10n],
        ['paymasterPostOpGasLimit + 200k', { paymasterPostOpGasLimit: dB.limits.paymasterPostOpGasLimit + STEP }, STEP / 10n],
        ['verificationGasLimit + 200k', { verificationGasLimit: dB.limits.verificationGasLimit + STEP }, 0n],
    ];
    // Fees do not enter actualGasUsed; fixed explicit fees keep the reservation (and so the branch) the same in every variant.
    const FIXED_FEES = { maxPriorityFeePerGas: 1_000_000n, maxFeePerGas: 2_000_000n };
    const measured: Array<[string, Hex, bigint, bigint, string, GasDecision['limits']]> = [];
    // A bundler remembers sender+nonce across evm_revert, so these variants go straight to EntryPoint.handleOps
    // (PaymasterClient's own fallback when the endpoint has no eth_sendUserOperation): same EntryPoint accounting.
    const stub = createServer((_req, res) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ jsonrpc: '2.0', id: 1, error: { code: -32601, message: 'Method not found' } })); });
    await new Promise<void>((ok) => stub.listen(0, '127.0.0.1', ok));
    const stubUrl = `http://127.0.0.1:${(stub.address() as AddressInfo).port}`;
    for (const [label, change] of variants) {
        const snap = await pub.request({ method: 'evm_snapshot', params: [] }) as Hex;
        try {
            const txHash = await PaymasterClient.submitGaslessUserOperation(pub, wallet, aa, EP, cfg.superPaymaster, gasToken, stubUrl, callData,
                { operator: operator.address, frozenGas: { ...dB.limits, ...change }, ...FIXED_FEES });
            const receipt = await pub.waitForTransactionReceipt({ hash: txHash });
            const evLog = receipt.logs.find((l: any) => l.address.toLowerCase() === EP.toLowerCase() && l.topics[0] === '0x49628fd1471006c1482da88028e9ce4dbb080b815c9b0344d39e5a8e6ec1419f');
            if (!evLog) throw new Error(`${label}: no UserOperationEvent`);
            const ev: any = decodeEventLog({ abi: EntryPointABI as any, data: evLog.data, topics: evLog.topics as any });
            if (!ev.args.success) throw new Error(`${label}: op did not succeed`);
            measured.push([label, ev.args.userOpHash, ev.args.actualGasUsed, ev.args.actualGasCost, `UserOperationEvent(success true, nonce ${ev.args.nonce}) in tx ${txHash}`, { ...dB.limits, ...change } as GasDecision['limits']]);
        } finally {
            if ((await pub.request({ method: 'evm_revert', params: [snap] })) !== true) throw new Error('evm_revert failed');
            SuperPaymasterInflightGuard.clearAll(); // the reverted op's nonce is free again
        }
    }

    stub.close();
    const base = measured[0][2];
    const part2 = measured.map(([label, hash, gas, cost, ev, l], i) => {
        const delta = gas - base, want = variants[i][2];
        const okRow = delta === want;
        if (!okRow) ok = false;
        return `| ${label} | ${hash} | ${l.verificationGasLimit}/${l.callGasLimit}/${l.preVerificationGas}/${l.paymasterVerificationGasLimit}/${l.paymasterPostOpGasLimit} | ${gas} | ${cost} | ${ev} | ${delta >= 0n ? '+' : ''}${delta} | +${want} | ${okRow ? 'yes' : '**NO**'} |`;
    });

    const version = await pub.readContract({ address: cfg.superPaymaster, abi: [{ type: 'function', name: 'version', stateMutability: 'pure', inputs: [], outputs: [{ type: 'string' }] }], functionName: 'version' });
    const lines = [
        '# Gas limits and fees from the chain: local SuperPaymaster DeployLive stack',
        '',
        `Generated by \`tests/regression/onchain-evidence/gas-policy-local.ts\` on ${new Date().toISOString()}: local anvil (chain 31337), SuperPaymaster ${cfg.superPaymaster} (\`${version}\`), sender ${aa}, operator ${operator.address}, gas token ${gasToken}, task token ${taskToken}. Limits are verificationGasLimit / callGasLimit / preVerificationGas / paymasterVerificationGasLimit / paymasterPostOpGasLimit.`,
        '',
        '| Op | UserOp hash | success | actualGasUsed | limits | bundler estimate | sent limits | minPostOpGas (chain) | fees | debt change | OK |',
        '|---|---|---|---|---|---|---|---|---|---|---|',
        ...rows,
        '',
        '## Part 2 — one limit at a time, from the same state',
        '',
        'Each row is the balance-branch op above with B\'s frozen limits and exactly one of them raised by 200,000, sent from one `evm_snapshot` and reverted afterwards. Expected change from EntryPoint v0.7: 10% of the extra unused execution gas (callGasLimit, paymasterPostOpGasLimit) once unused execution gas exceeds 40,000; none for verification gas.',
        '',
        `Fees fixed for every variant (priority ${FIXED_FEES.maxPriorityFeePerGas}, maxFee ${FIXED_FEES.maxFeePerGas}). Note: SuperPaymaster's minPostOpGas (500,000 here) is far above what postOp uses, so unused execution gas is always above the 40,000 threshold on this path and the penalty always applies; the threshold itself is EntryPoint v0.7's PENALTY_GAS_THRESHOLD constant (not measured here).`,
        '',
        '| Variant | UserOp hash (reverted) | limits | actualGasUsed | actualGasCost (wei) | EntryPoint event | change vs baseline | expected | OK |',
        '|---|---|---|---|---|---|---|---|---|',
        ...part2,
        '',
        'The 40,000 unused-execution-gas threshold is EntryPoint v0.7\'s `PENALTY_GAS_THRESHOLD`; it is not measured here (on this SuperPaymaster path the 500,000 minPostOpGas keeps unused execution gas above it).',
        '',
        `Verdict: ${ok ? 'PASS' : 'FAIL'}`,
        '',
    ];
    writeFileSync(OUT, lines.join('\n'));
    console.log(lines.join('\n'));
    if (!ok) process.exitCode = 1;
}

// A run that stops making progress must not sit silent: a heartbeat every 30 s, and a hard deadline that fails the run.
const started = Date.now();
const heartbeat = setInterval(() => console.error(`gas-policy-local: still running (${Math.round((Date.now() - started) / 1000)} s)`), 30_000);
const deadline = setTimeout(() => { console.error('gas-policy-local: failed (deadline exceeded)'); process.exit(1); }, Number(process.env.EVIDENCE_TIMEOUT_MS ?? 15 * 60_000));
main()
    .catch((e) => { console.error('gas-policy-local: failed', process.env.DEBUG_EVIDENCE ? e : ''); process.exitCode = 1; })
    .finally(() => { clearInterval(heartbeat); clearTimeout(deadline); });
