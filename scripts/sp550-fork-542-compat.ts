#!/usr/bin/env tsx
/**
 * CC-122 R2 — backward-compatibility evidence: the SDK's NEW 125-byte paymasterAndData (5.5.0
 * layout, token + flags appended) against the DEPLOYED SuperPaymaster 5.4.2, on a LOCAL anvil FORK
 * of Sepolia. Nothing is broadcast to Sepolia: every write below lands on the local fork only
 * (impersonated accounts, anvil_* RPCs). The script refuses to run unless the node answers
 * `anvil_nodeInfo` with a fork configuration.
 *
 * Why it exists: the SDK now always appends the operator's token (REQUIRED by 5.5.0) also when the
 * proxy still runs 5.4.2, on the strength of the 5.4.2 source reading only `length >= 104`
 * (SuperPaymaster.sol:1200 @ v5.4.2). This runs the real 5.4.2 bytecode instead of trusting that
 * reading:
 *   1. eth_call validatePaymasterUserOp FROM the EntryPoint with 104-byte vs 125-byte data → the
 *      SAME validationData (and sigFail bit 0) for the same op;
 *   2. one full sponsored op through PaymasterClient.submitGaslessUserOperation (the SDK path),
 *      included with UserOperationEvent.success == true.
 *
 * Run:
 *   anvil --fork-url "$SEPOLIA_RPC_URL" --port 28546
 *   SP542_FORK_RPC=http://127.0.0.1:28546 pnpm exec tsx scripts/sp550-fork-542-compat.ts
 */
import { type Address, type Hex, createPublicClient, createWalletClient, encodeFunctionData, http, decodeFunctionData, decodeEventLog, concat, pad, toHex, parseEther, decodeFunctionResult } from 'viem';
import { mnemonicToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import {
    CANONICAL_ADDRESSES,
    EntryPointABI,
    SimpleAccountABI,
    SimpleAccountFactoryABI,
    SuperPaymasterABI,
    decodeSuperPaymasterData,
    encodeSuperPaymasterData,
    getSuperPaymasterGeneration,
    superPaymasterActions,
    decodeLensReasonCode,
} from '@aastar/core';
import { PaymasterClient } from '@aastar/paymaster';

const RPC = process.env.SP542_FORK_RPC ?? 'http://127.0.0.1:28546';
// Throwaway owner, only ever used on the local fork: anvil's public default mnemonic, index 5.
const ANVIL_MNEMONIC = 'test test test test test test test test test test test junk';

function fail(msg: string): never {
    console.error(`❌ ${msg}`);
    process.exit(1);
}

async function main() {
    const a = CANONICAL_ADDRESSES[11155111] as any;
    const sp = a.superPaymaster as Address, ep = a.entryPoint as Address, factory = a.simpleAccountFactory as Address;
    const pub = createPublicClient({ chain: sepolia, transport: http(RPC) });

    // Hard guard: must be a LOCAL anvil fork of Sepolia.
    const info = (await pub.request({ method: 'anvil_nodeInfo' as any })) as any;
    if (!info?.forkConfig?.forkUrl) fail('not an anvil fork — refusing (this script must never run against a live node)');
    if ((await pub.getChainId()) !== 11155111) fail('fork is not of Sepolia');
    console.log(`anvil fork of Sepolia at block ${info.forkConfig.forkBlockNumber}`);

    const gen = await getSuperPaymasterGeneration(pub as any, sp);
    console.log(`SP ${sp} version()=${gen.version} → ${gen.generation}`);
    if (gen.generation !== 'v5.4') fail('expected the deployed 5.4.x SP');

    const anvilCall = (method: string, params: unknown[]) => pub.request({ method: method as any, params: params as any });
    const impersonated = async (addr: Address, req: any) => {
        await anvilCall('anvil_impersonateAccount', [addr]);
        await anvilCall('anvil_setBalance', [addr, toHex(parseEther('10'))]);
        const wc = createWalletClient({ chain: sepolia, transport: http(RPC) });
        const hash = await wc.writeContract({ ...req, account: addr, chain: sepolia });
        const rc = await pub.waitForTransactionReceipt({ hash });
        await anvilCall('anvil_stopImpersonatingAccount', [addr]);
        if (rc.status !== 'success') fail(`fork setup ${req.functionName} reverted`);
    };

    // Pick a configured, unpaused operator with aPNTs: prefer the SP owner, then Anni (Mycelium).
    const owner = (await pub.readContract({ address: sp, abi: SuperPaymasterABI, functionName: 'owner' })) as Address;
    const candidates = [owner, '0xEcAACb915f7D92e9916f449F7ad42BD0408733c9' as Address];
    let operator: Address | undefined; let opToken: Address | undefined;
    for (const c of candidates) {
        const op = (await pub.readContract({ address: sp, abi: SuperPaymasterABI, functionName: 'operators', args: [c] })) as readonly any[];
        console.log(`  operator ${c}: aPNTs=${op[0]} configured=${op[1]} paused=${op[2]} token=${op[3]}`);
        if (op[1] && !op[2] && BigInt(op[0]) > parseEther('10')) { operator = c; opToken = op[3]; break; }
    }
    if (!operator || !opToken) fail('no configured operator with aPNTs balance on the fork');

    // Fresh SimpleAccount, made sponsorship-eligible ON THE FORK: the SP lets only its Registry set
    // sbtHolders (SuperPaymaster.sol:626-629 @ v5.4.2) — impersonate it.
    const ownerAcct = mnemonicToAccount(ANVIL_MNEMONIC, { addressIndex: 5 });
    await anvilCall('anvil_setBalance', [ownerAcct.address, toHex(parseEther('10'))]);
    const account = (await pub.readContract({ address: factory, abi: SimpleAccountFactoryABI, functionName: 'getAddress', args: [ownerAcct.address, 0n] })) as Address;
    const wOwner = createWalletClient({ account: ownerAcct, chain: sepolia, transport: http(RPC) });
    if (((await pub.getCode({ address: account })) ?? '0x') === '0x') {
        const h = await wOwner.writeContract({ address: factory, abi: SimpleAccountFactoryABI, functionName: 'createAccount', args: [ownerAcct.address, 0n], chain: sepolia, account: ownerAcct });
        await pub.waitForTransactionReceipt({ hash: h });
    }
    const registry = (await pub.readContract({ address: sp, abi: SuperPaymasterABI, functionName: 'REGISTRY' })) as Address;
    await impersonated(registry, { address: sp, abi: SuperPaymasterABI, functionName: 'updateSBTStatus', args: [account, true] });
    // The live cache is stale (M-11 addendum A); refresh it on the fork (permissionless on 5.4.2).
    {
        const h = await wOwner.writeContract({ address: sp, abi: SuperPaymasterABI, functionName: 'updatePrice', args: [], chain: sepolia, account: ownerAcct });
        await pub.waitForTransactionReceipt({ hash: h });
    }
    console.log(`AA account ${account} (fork-only SBT), operator ${operator}, operator token ${opToken}`);

    // ---- 1. same op, 104 vs 125 bytes, eth_call validatePaymasterUserOp from the EntryPoint ----
    const nonce = (await pub.readContract({ address: ep, abi: EntryPointABI, functionName: 'getNonce', args: [account, 0n] })) as bigint;
    const callData = encodeFunctionData({ abi: SimpleAccountABI, functionName: 'execute', args: [operator, 0n, '0x'] });
    const common = { paymaster: sp, operator, verificationGasLimit: 300_000n, postOpGasLimit: 300_000n };
    const op = (pmd: Hex) => ({
        sender: account, nonce, initCode: '0x' as Hex, callData,
        accountGasLimits: concat([pad(toHex(300_000n), { size: 16 }), pad(toHex(100_000n), { size: 16 })]),
        preVerificationGas: 60_000n,
        gasFees: concat([pad(toHex(100_000_000n), { size: 16 }), pad(toHex(1_000_000_000n), { size: 16 })]),
        paymasterAndData: pmd, signature: '0x' as Hex,
    });
    // 1 gwei: keeps the aPNTs reservation under a fresh user's level-1 credit limit (300 aPNTs) —
    // 5.4.2 refuses a charge above getCreditLimit(user) (SuperPaymaster.sol:832-835 @ v5.4.2).
    const maxCost = 1_060_000n * 1_000_000_000n;
    const validate = async (pmd: Hex) => {
        const userOp = op(pmd);
        const hash = (await pub.readContract({ address: ep, abi: EntryPointABI, functionName: 'getUserOpHash', args: [userOp] })) as Hex;
        const data = encodeFunctionData({ abi: SuperPaymasterABI, functionName: 'validatePaymasterUserOp', args: [userOp, hash, maxCost] });
        const r = await pub.call({ account: ep, to: sp, data });
        const [, validationData] = decodeFunctionResult({ abi: SuperPaymasterABI, functionName: 'validatePaymasterUserOp', data: r.data! }) as readonly [Hex, bigint];
        return validationData;
    };
    const vdLegacy = await validate(encodeSuperPaymasterData(common));
    const vdNew = await validate(encodeSuperPaymasterData({ ...common, token: opToken }));
    const sigFail = (v: bigint) => (v & ((1n << 160n) - 1n)) === 1n;
    console.log(`validatePaymasterUserOp on 5.4.2 — 104 B: validationData=0x${vdLegacy.toString(16)} sigFail=${sigFail(vdLegacy)} | 125 B: validationData=0x${vdNew.toString(16)} sigFail=${sigFail(vdNew)}`);
    // 5.4.2 still has dryRunValidation on the SP — its reason code explains a sigFail.
    for (const [label, pmd] of [['104 B', encodeSuperPaymasterData(common)], ['125 B', encodeSuperPaymasterData({ ...common, token: opToken })]] as const) {
        const r = await superPaymasterActions(sp)(pub as any).dryRunValidation({ userOp: op(pmd), maxCost });
        console.log(`  5.4.2 dryRunValidation ${label}: ok=${r.ok} reason=${decodeLensReasonCode(r.reasonCode).code}`);
    }
    if (vdLegacy !== vdNew) fail('5.4.2 treats the 125-byte layout differently from the 104-byte one');
    if (sigFail(vdNew)) fail('5.4.2 sigFailed this op even with the legacy layout — the fork setup is not eligible, so (1) proves nothing');

    // ---- 2. the full SDK path on 5.4.2 ----
    const txHash = (await PaymasterClient.submitGaslessUserOperation(
        pub, wOwner, account, ep, sp, '0x0000000000000000000000000000000000000000', RPC, callData,
        { operator, callGasLimit: 100_000n, verificationGasLimit: 300_000n, preVerificationGas: 60_000n },
    )) as Hex;
    const rc = await pub.waitForTransactionReceipt({ hash: txHash });
    const tx = await pub.getTransaction({ hash: txHash });
    const sentOp = (decodeFunctionData({ abi: EntryPointABI, data: tx.input }).args as any)[0][0];
    const d = decodeSuperPaymasterData(sentOp.paymasterAndData);
    let success: boolean | undefined;
    for (const l of rc.logs.filter((x) => x.address.toLowerCase() === ep.toLowerCase())) {
        try { const ev = decodeEventLog({ abi: EntryPointABI, data: l.data, topics: l.topics }) as any; if (ev.eventName === 'UserOperationEvent') success = ev.args.success; } catch { /* other */ }
    }
    console.log(`SDK op on 5.4.2 fork: tx status=${rc.status}, paymasterAndData ${(sentOp.paymasterAndData.length - 2) / 2} B (layout ${d.layout}, token ${d.token}), UserOperationEvent.success=${success}`);
    if (rc.status !== 'success' || success !== true) fail('sponsored op did not succeed on 5.4.2');
    if (d.layout !== 'v5.5') fail('SDK did not send the 125-byte layout');
    console.log('\n✅ 5.4.2 compatibility PASS — the 5.5.0 superset layout is accepted by the deployed 5.4.2 bytecode (fork).');
}

main().catch((e) => { console.error(e); process.exit(1); });
