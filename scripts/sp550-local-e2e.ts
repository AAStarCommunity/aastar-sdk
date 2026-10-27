#!/usr/bin/env tsx
/**
 * CC-122 R2 — one sponsored gasless UserOp THROUGH THE SDK against a LOCAL SuperPaymaster 5.5.0.
 *
 * LOCAL ANVIL ONLY. Refuses any chain id other than 31337. Nothing here touches a shared network
 * or the SDK's canonical addresses: every address is read from the SP repo's own
 * `deployments/config.anvil.json`, written by its `./deploy-core anvil --force` (tag v5.5.0-rc.4).
 *
 * What it proves (each is read back from chain state, not inferred from a return value):
 *   1. the SDK detects the generation from on-chain version() (`SuperPaymaster-5.5.0` → v5.5);
 *   2. PaymasterClient.submitGaslessUserOperation — the same entry point UserClient and
 *      SuperPaymasterClient use — builds the 125-byte paymasterAndData with the operator's token
 *      read from operators(operator).xPNTsToken, and applies the 5.5.0 gas floors;
 *   3. the op is included and SPONSORED: the user's xPNTs fell by the settlement burn, lockedOf
 *      returned to 0, the operator's aPNTs balance fell by exactly the protocol-revenue increase,
 *      and the SP in-flight record for the op hash is cleared;
 *   4. negative control: the LEGACY 104-byte layout (what the SDK produced before this change) is
 *      rejected by SuperPaymasterLens with TOKEN_MISMATCH against the same SP.
 *
 * Mirrors the SP repo's own contracts/script/v3/L4GaslessTest.s.sol setup (anvil #1 = operator
 * "Anni" + community, anvil #3 = AA owner), but sends the op through the SDK instead of forge.
 *
 * Run (after `ANVIL_RPC_URL=http://127.0.0.1:28545 ./deploy-core anvil --force` in an SP v5.5.0-rc.4 checkout):
 *   SP550_CONFIG=/path/to/sp/deployments/config.anvil.json SP550_RPC=http://127.0.0.1:28545 \
 *     pnpm exec tsx scripts/sp550-local-e2e.ts
 */
import * as fs from 'fs';
import { type Address, type Hex, createPublicClient, createWalletClient, encodeFunctionData, http, keccak256, decodeFunctionData, parseEther, pad, concat, toHex } from 'viem';
import { privateKeyToAccount, mnemonicToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import {
    EntryPointABI,
    GTokenABI,
    RegistryABI,
    SimpleAccountABI,
    SimpleAccountFactoryABI,
    SuperPaymasterV550ABI,
    xPNTsTokenV2ABI,
    decodeSuperPaymasterData,
    encodeSuperPaymasterData,
    getSuperPaymasterGeneration,
    superPaymasterLensActions,
} from '@aastar/core';
import { PaymasterClient, resolveSuperPaymasterSponsorship } from '@aastar/paymaster';

const RPC = process.env.SP550_RPC ?? 'http://127.0.0.1:28545';
const CONFIG = process.env.SP550_CONFIG;
// Public anvil default keys (mnemonic "test test ... junk"); identical to L4GaslessTest.s.sol.
const ANNI_PK = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' as const; // anvil #1
const DEPLOYER_PK = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as const; // anvil #0
const ANVIL_MNEMONIC = 'test test test test test test test test test test test junk';
const ROLE_ENDUSER = keccak256(new TextEncoder().encode('ENDUSER'));

function fail(msg: string): never {
    console.error(`❌ ${msg}`);
    process.exit(1);
}

async function main() {
    if (!CONFIG || !fs.existsSync(CONFIG)) fail('set SP550_CONFIG to the SP repo deployments/config.anvil.json');
    const cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
    const need = ['entryPoint', 'superPaymaster', 'registry', 'gToken', 'staking', 'simpleAccountFactory', 'pnts', 'superPaymasterLens'];
    for (const k of need) if (!cfg[k]) fail(`config is missing ${k}`);
    const ep = cfg.entryPoint as Address, sp = cfg.superPaymaster as Address, lens = cfg.superPaymasterLens as Address;

    const pub = createPublicClient({ chain: foundry, transport: http(RPC) });
    const chainId = await pub.getChainId();
    if (chainId !== 31337) fail(`refusing to run on chainId ${chainId} — this script is local-anvil only`);

    // anvil #3 (L4GaslessTest's default L4_USER_KEY), derived from anvil's public default mnemonic.
    const user = mnemonicToAccount(ANVIL_MNEMONIC, { addressIndex: 3 });
    const anni = privateKeyToAccount(ANNI_PK), deployer = privateKeyToAccount(DEPLOYER_PK);
    const w = (acct: any) => createWalletClient({ account: acct, chain: foundry, transport: http(RPC) });
    const send = async (acct: any, req: any) => {
        const hash = await w(acct).writeContract({ ...req, account: acct, chain: foundry });
        const rc = await pub.waitForTransactionReceipt({ hash });
        if (rc.status !== 'success') fail(`setup tx ${req.functionName} reverted (${hash})`);
        return rc;
    };

    // ---- 1. generation detection (SDK) ----
    const gen = await getSuperPaymasterGeneration(pub as any, sp);
    console.log(`SP ${sp} version()=${gen.version} → generation ${gen.generation}`);
    if (gen.generation !== 'v5.5') fail('expected a 5.5.0 SP');

    // ---- setup (mirrors L4GaslessTest.s.sol run() §1-§2) ----
    const account = (await pub.readContract({ address: cfg.simpleAccountFactory, abi: SimpleAccountFactoryABI, functionName: 'getAddress', args: [user.address, 0n] })) as Address;
    if (((await pub.getCode({ address: account })) ?? '0x') === '0x') {
        await send(deployer, { address: cfg.simpleAccountFactory, abi: SimpleAccountFactoryABI, functionName: 'createAccount', args: [user.address, 0n] });
    }
    if ((await pub.readContract({ address: cfg.gToken, abi: GTokenABI, functionName: 'balanceOf', args: [anni.address] })) as bigint < parseEther('5')) {
        await send(deployer, { address: cfg.gToken, abi: GTokenABI, functionName: 'mint', args: [anni.address, parseEther('10')] });
    }
    await send(deployer, { address: sp, abi: SuperPaymasterV550ABI, functionName: 'updatePrice', args: [] });
    if (!(await pub.readContract({ address: cfg.registry, abi: RegistryABI, functionName: 'hasRole', args: [ROLE_ENDUSER, account] }))) {
        await send(anni, { address: cfg.gToken, abi: GTokenABI, functionName: 'approve', args: [cfg.staking, parseEther('1')] });
        const data = (await import('viem')).encodeAbiParameters([{ type: 'address' }, { type: 'uint256' }], [anni.address, parseEther('0.3')]);
        await send(anni, { address: cfg.registry, abi: RegistryABI, functionName: 'safeMintForRole', args: [ROLE_ENDUSER, account, data] });
    }
    const token = cfg.pnts as Address;
    if ((await pub.readContract({ address: token, abi: xPNTsTokenV2ABI, functionName: 'balanceOf', args: [account] })) as bigint < parseEther('1000')) {
        await send(anni, { address: token, abi: xPNTsTokenV2ABI, functionName: 'mint', args: [account, parseEther('1000')] });
    }
    console.log(`AA account ${account} (owner ${user.address}), operator ${anni.address}, token ${token}`);

    // ---- what the SDK resolves from chain for this op ----
    const ctx = await resolveSuperPaymasterSponsorship(pub as any, sp, anni.address);
    console.log(`SDK context: token=${ctx.token} minPostOpGas=${ctx.minPostOpGas} verificationFloor=${ctx.verificationGasFloor}`);
    if (ctx.token.toLowerCase() !== token.toLowerCase()) fail('operators(anni).xPNTsToken != config.pnts');

    // ---- snapshot ----
    const snap = async () => {
        const op = (await pub.readContract({ address: sp, abi: SuperPaymasterV550ABI, functionName: 'operators', args: [anni.address] })) as readonly any[];
        return {
            userBal: (await pub.readContract({ address: token, abi: xPNTsTokenV2ABI, functionName: 'balanceOf', args: [account] })) as bigint,
            locked: (await pub.readContract({ address: token, abi: xPNTsTokenV2ABI, functionName: 'lockedOf', args: [account] })) as bigint,
            opBal: BigInt(op[0]),
            revenue: (await pub.readContract({ address: sp, abi: SuperPaymasterV550ABI, functionName: 'protocolRevenue' })) as bigint,
            nonce: (await pub.readContract({ address: ep, abi: EntryPointABI, functionName: 'getNonce', args: [account, 0n] })) as bigint,
        };
    };
    const pre = await snap();

    // ---- 2. the op, through the SDK ----
    const callData = encodeFunctionData({ abi: SimpleAccountABI, functionName: 'execute', args: [anni.address, 0n, '0x'] });
    // No bundler on a bare anvil: eth_sendUserOperation → "Method not found" → PaymasterClient's
    // documented fallback submits handleOps from the signer wallet (the user's EOA, as beneficiary).
    const txHash = (await PaymasterClient.submitGaslessUserOperation(
        pub, w(user), account, ep, sp, '0x0000000000000000000000000000000000000000', RPC, callData,
        { operator: anni.address, callGasLimit: 100_000n, verificationGasLimit: 300_000n, preVerificationGas: 60_000n },
    )) as Hex;
    const rc = await pub.waitForTransactionReceipt({ hash: txHash });
    console.log(`handleOps tx ${txHash} status=${rc.status} gasUsed=${rc.gasUsed}`);
    if (rc.status !== 'success') fail('handleOps reverted');

    // Decode what the SDK actually put on chain.
    const tx = await pub.getTransaction({ hash: txHash });
    const decoded = decodeFunctionData({ abi: EntryPointABI, data: tx.input });
    const sentOp = (decoded.args as any)[0][0];
    const pmd = decodeSuperPaymasterData(sentOp.paymasterAndData);
    const pmdLen = (sentOp.paymasterAndData.length - 2) / 2;
    console.log(`on-chain paymasterAndData: ${pmdLen} bytes, layout=${pmd.layout}, token=${pmd.token}, flags=${pmd.flags}, verifGas=${pmd.verificationGasLimit}, postOpGas=${pmd.postOpGasLimit}`);
    if (pmdLen !== 125 || pmd.token?.toLowerCase() !== token.toLowerCase()) fail('SDK did not send the 5.5.0 layout with the operator token');

    // UserOperationEvent.success
    const epEvents = rc.logs.filter((l) => l.address.toLowerCase() === ep.toLowerCase());
    const { decodeEventLog } = await import('viem');
    let opHash: Hex | undefined; let success: boolean | undefined; let actualGasCost: bigint | undefined;
    for (const l of epEvents) {
        try {
            const ev = decodeEventLog({ abi: EntryPointABI, data: l.data, topics: l.topics }) as any;
            if (ev.eventName === 'UserOperationEvent') { opHash = ev.args.userOpHash; success = ev.args.success; actualGasCost = ev.args.actualGasCost; }
        } catch { /* other events */ }
    }
    console.log(`UserOperationEvent: opHash=${opHash} success=${success} actualGasCost=${actualGasCost}`);
    if (!opHash || success !== true) fail('no successful UserOperationEvent');

    // ---- 3. read back the settlement ----
    const post = await snap();
    const burned = pre.userBal - post.userBal;
    const opDelta = pre.opBal - post.opBal;
    const revDelta = post.revenue - pre.revenue;
    const inflight = (await pub.readContract({ address: sp, abi: SuperPaymasterV550ABI, functionName: 'inflightOf', args: [opHash] })) as readonly any[];
    console.log(`user xPNTs burned=${burned} lockedOf ${pre.locked}→${post.locked} | operator aPNTs -${opDelta} | protocolRevenue +${revDelta} | nonce ${pre.nonce}→${post.nonce} | inflightOf=(${inflight[0]}, ${inflight[1]})`);
    if (burned <= 0n) fail('user balance did not fall');
    if (post.locked !== 0n) fail('lockedOf not released');
    if (opDelta <= 0n || opDelta !== revDelta) fail('operator debit != protocol revenue increase');
    if (post.nonce !== pre.nonce + 1n) fail('nonce did not advance');
    if (BigInt(inflight[1]) !== 0n) fail('SP in-flight record not cleared');

    // ---- 4. negative control via the Lens: legacy 104-byte vs 5.5.0 layout, same op otherwise ----
    const lensA = superPaymasterLensActions(lens)(pub as any);
    const base = {
        sender: account, nonce: post.nonce, initCode: '0x' as Hex, callData,
        accountGasLimits: concat([pad(toHex(300_000n), { size: 16 }), pad(toHex(100_000n), { size: 16 })]),
        preVerificationGas: 60_000n,
        gasFees: concat([pad(toHex(1_000_000_000n), { size: 16 }), pad(toHex(3_000_000_000n), { size: 16 })]),
        signature: '0x' as Hex,
    };
    const maxCost = (300_000n + 100_000n + 60_000n + 300_000n + 300_000n) * 3_000_000_000n;
    const common = { paymaster: sp, operator: anni.address, verificationGasLimit: 300_000n, postOpGasLimit: 300_000n };
    const newRes = await lensA.dryRunValidation({ superPaymaster: sp, userOp: { ...base, paymasterAndData: encodeSuperPaymasterData({ ...common, token }) }, maxCost });
    const oldRes = await lensA.dryRunValidation({ superPaymaster: sp, userOp: { ...base, paymasterAndData: encodeSuperPaymasterData(common) }, maxCost });
    console.log(`Lens dryRun next op — 5.5.0 layout: ok=${newRes.ok} (${newRes.reason.code}); legacy 104-byte: ok=${oldRes.ok} (${oldRes.reason.code})`);
    // RATE_LIMITED is the lens's only SOFT code and is returned only after every hard check passed
    // (SuperPaymasterLens.sol:105-106, :172) — the operator may set minTxInterval.
    if (!newRes.ok && newRes.reason.code !== 'RATE_LIMITED') fail(`lens rejected the SDK's 5.5.0 layout: ${newRes.reason.code}`);
    if (oldRes.ok || oldRes.reason.code !== 'TOKEN_MISMATCH') fail('legacy layout was not rejected with TOKEN_MISMATCH');

    console.log('\n✅ SP 5.5.0 local E2E PASS — sponsored op settled in balance mode through the SDK.');
}

main().catch((e) => { console.error(e); process.exit(1); });
