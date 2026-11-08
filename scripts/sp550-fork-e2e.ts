#!/usr/bin/env tsx
/**
 * SP 5.5.0 — the SDK's sponsored-op paths on a LOCAL anvil FORK of Sepolia, through a LOCAL
 * bundler (DSR item 2). Result label: "fork rc result" — NOT a live result.
 *
 * Preconditions (see the DSR item-2 run notes): anvil --fork-url <sepolia> --auto-impersonate on
 * 127.0.0.1, the SP proxy upgraded to v5.5.0-rc.4 by SuperPaymaster's UpgradeToV5_5_0 entry points,
 * AAStar's v2 token issued and its operator (the SP owner) configured + unpaused, and an
 * ERC-4337 bundler (UltraRelay / Alto) on 127.0.0.1 pointed at the fork.
 *
 * Refuses to run unless both RPC and bundler URLs are loopback and the chain is the Sepolia fork.
 * The only keys are anvil's PUBLIC test mnemonic; community / operator actions are sent as
 * impersonated addresses (anvil --auto-impersonate), so no real key is involved.
 *
 *   SP550_FORK_RPC=http://127.0.0.1:28546 SP550_FORK_BUNDLER=http://127.0.0.1:3046 \
 *   SP550_FORK_CONFIG=<config.sepolia-fork.json from the SP script> pnpm exec tsx scripts/sp550-fork-e2e.ts
 *
 * Every scenario prints one RESULT line: signer calls (S_user), on-chain waits (W_chain), and the
 * state it read back. Counts describe SDK / protocol task structure, not user experience.
 */
import * as fs from 'fs';
import {
    type Address, type Hex, createPublicClient, createWalletClient, custom, decodeEventLog, encodeAbiParameters,
    encodeFunctionData, http, keccak256, parseEther, toHex,
} from 'viem';
import { mnemonicToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import {
    EntryPointABI, GTokenABI, RegistryABI, SimpleAccountABI, SimpleAccountFactoryABI, SuperPaymasterV550ABI,
    xPNTsTokenV2ABI, superPaymasterLensActions, encodeSuperPaymasterData, CANONICAL_ADDRESSES,
} from '@aastar/core';
import { PaymasterClient, SuperPaymasterClient, SuperPaymasterInflightGuard } from '@aastar/paymaster';
import { createEndUserClient } from '@aastar/sdk';

const RPC = process.env.SP550_FORK_RPC ?? 'http://127.0.0.1:28546';
const BUNDLER = process.env.SP550_FORK_BUNDLER ?? 'http://127.0.0.1:3046';
const CONFIG = process.env.SP550_FORK_CONFIG;
const MNEMONIC = 'test test test test test test test test test test test junk'; // anvil's public mnemonic
const OWNER = '0xb5600060e6de5E11D3636731964218E53caadf0E' as Address; // SP owner = AAStar community + operator (impersonated)
const ROLE_ENDUSER = keccak256(toHex('ENDUSER'));
const ROLE_ENDUSER_STAKE = parseEther('0.3');

const results: string[] = [];
const result = (line: string) => { results.push(line); console.log(`RESULT ${line}`); };
// SP 5.5.0 rate limit: validAfter = user's lastTimestamp + operator.minTxInterval (SuperPaymaster.sol:281-287).
// The live AAStar operator has minTxInterval = 60 s, so consecutive ops from one user are spaced.
const spacing = async () => { await new Promise((r) => setTimeout(r, 62_000)); };
const fail = (m: string): never => { console.error(`❌ ${m}`); process.exit(1); };
const isLoopback = (u: string) => /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(u);

async function main() {
    if (!isLoopback(RPC) || !isLoopback(BUNDLER)) fail('RPC and bundler must be loopback (local fork only)');
    if (!CONFIG || !fs.existsSync(CONFIG)) fail('set SP550_FORK_CONFIG to the config written by the SP upgrade script');
    const cfg = JSON.parse(fs.readFileSync(CONFIG!, 'utf8'));
    const pub = createPublicClient({ chain: sepolia, transport: http(RPC) });
    if ((await pub.getChainId()) !== 11155111) fail('not the Sepolia fork');
    const sp = cfg.superPaymaster as Address, lens = cfg.superPaymasterLens as Address, ep = cfg.entryPoint as Address;
    const token = cfg.xPNTsV2Tokens?.[OWNER] as Address;
    if (!token) fail('config has no AAStar v2 token (run issueCommunityToken first)');
    const canon = (CANONICAL_ADDRESSES as any)[11155111];
    const version = await pub.readContract({ address: sp, abi: SuperPaymasterV550ABI, functionName: 'version' });
    if (version !== 'SuperPaymaster-5.5.0') fail(`SP is ${version}`);
    console.log(`fork: SP ${sp} ${version} · token ${token} · lens ${lens} · bundler ${BUNDLER}`);

    // ---- accounts: user = anvil #3 (public), counted signer ----
    const base = mnemonicToAccount(MNEMONIC, { addressIndex: 3 });
    let signs = 0;
    const user = { ...base, signMessage: async (a: any) => { signs++; return base.signMessage(a); } };
    const asAddr = (from: Address) => createWalletClient({ account: from, chain: sepolia, transport: http(RPC) }); // impersonated
    let waits = 0;
    const send = async (from: Address, req: any) => {
        const hash = await asAddr(from).writeContract({ ...req, account: from, chain: sepolia });
        const rc = await pub.waitForTransactionReceipt({ hash }); waits++;
        if (rc.status !== 'success') fail(`${req.functionName} reverted (${hash})`);
        return rc;
    };
    const userWallet = createWalletClient({ account: user as any, chain: sepolia, transport: http(RPC) });
    const factory = canon.simpleAccountFactory as Address;
    const account = (await pub.readContract({ address: factory, abi: SimpleAccountFactoryABI, functionName: 'getAddress', args: [base.address, 0n] })) as Address;

    const bal = () => pub.readContract({ address: token, abi: xPNTsTokenV2ABI, functionName: 'balanceOf', args: [account] }) as Promise<bigint>;
    const locked = () => pub.readContract({ address: token, abi: xPNTsTokenV2ABI, functionName: 'lockedOf', args: [account] }) as Promise<bigint>;
    const opBal = async () => BigInt(((await pub.readContract({ address: sp, abi: SuperPaymasterV550ABI, functionName: 'operators', args: [OWNER] })) as any[])[0]);
    const receipt = async (opHash: Hex) => {
        for (let i = 0; i < 60; i++) {
            const r = await (await fetch(BUNDLER, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getUserOperationReceipt', params: [opHash] }) })).json();
            if (r.result) { waits++; return r.result; }
            await new Promise((res) => setTimeout(res, 1000));
        }
        return fail(`no receipt for ${opHash}`);
    };
    const callNoop = encodeFunctionData({ abi: SimpleAccountABI, functionName: 'execute', args: [OWNER, 0n, '0x'] });

    // ================= S2 cold start (AOA-Comm: the community does every setup step) =================
    signs = 0; waits = 0;
    if (((await pub.getCode({ address: account })) ?? '0x') === '0x') {
        await send(OWNER, { address: factory, abi: SimpleAccountFactoryABI, functionName: 'createAccount', args: [base.address, 0n] });
    }
    if (!(await pub.readContract({ address: cfg.registry, abi: RegistryABI, functionName: 'hasRole', args: [ROLE_ENDUSER, account] }))) {
        await send(OWNER, { address: canon.gToken, abi: GTokenABI, functionName: 'approve', args: [canon.staking, parseEther('1')] });
        const data = encodeAbiParameters([{ type: 'address' }, { type: 'uint256' }], [OWNER, ROLE_ENDUSER_STAKE]);
        await send(OWNER, { address: cfg.registry, abi: RegistryABI, functionName: 'safeMintForRole', args: [ROLE_ENDUSER, account, data] });
    }
    await send(OWNER, { address: token, abi: xPNTsTokenV2ABI, functionName: 'mint', args: [account, parseEther('1000')] });
    result(`S2 cold start (AOA-Comm): user signer calls=${signs}, community txs/waits=${waits}; account ${account} deployed=${((await pub.getCode({ address: account })) ?? '0x') !== '0x'} ENDUSER=${await pub.readContract({ address: cfg.registry, abi: RegistryABI, functionName: 'hasRole', args: [ROLE_ENDUSER, account] })} xPNTs=${await bal()}`);

    // ================= S1 steady state: PaymasterClient through the bundler =================
    const s1 = async (label: string, run: () => Promise<Hex>) => {
        SuperPaymasterInflightGuard.clearAll();
        signs = 0; waits = 0;
        const [b0, o0] = [await bal(), await opBal()];
        const opHash = await run();
        const rc = await receipt(opHash);
        const [b1, l1, o1] = [await bal(), await locked(), await opBal()];
        result(`${label}: success=${rc.success} S_user signMessage=${signs} W_chain=${waits} · user xPNTs -${b0 - b1} lockedOf=${l1} · operator aPNTs -${o0 - o1} · tx ${rc.receipt?.transactionHash}`);
        if (rc.success !== true) fail(`${label}: UserOperationEvent.success=${rc.success}`);
        if (b1 >= b0 || l1 !== 0n || o1 >= o0) fail(`${label}: settlement did not read back as balance-mode sponsorship`);
        return rc;
    };
    await s1('S1 PaymasterClient.submitGaslessUserOperation (auto-estimate)', () =>
        PaymasterClient.submitGaslessUserOperation(pub, userWallet, account, ep, sp, '0x0000000000000000000000000000000000000000', BUNDLER, callNoop, { operator: OWNER }) as Promise<Hex>);
    // Rate limit: a second op from the same user right away.
    SuperPaymasterInflightGuard.clearAll();
    let rateLimited = '';
    try {
        await PaymasterClient.submitGaslessUserOperation(pub, userWallet, account, ep, sp, '0x0000000000000000000000000000000000000000', BUNDLER, callNoop, { operator: OWNER });
        rateLimited = 'ACCEPTED (no rate limit?)';
    } catch (e: any) { rateLimited = `rejected: ${String(e?.message ?? e).slice(0, 160)}`; }
    const interval = ((await pub.readContract({ address: sp, abi: SuperPaymasterV550ABI, functionName: 'operators', args: [OWNER] })) as any[])[5];
    result(`S1 rate limit (operator minTxInterval=${interval}s): a second op right after the first is ${rateLimited} — the SDK does not wait or retry`);
    await spacing();
    await s1('S1 SuperPaymasterClient.submitGaslessTransaction (ERC-20 transfer)', () =>
        SuperPaymasterClient.submitGaslessTransaction(pub, userWallet, account, ep, BUNDLER, { token, recipient: OWNER, amount: 1n, operator: OWNER, paymasterAddress: sp }) as Promise<Hex>);

    // ================= S3a top-up (community mint; user signs nothing) =================
    signs = 0; waits = 0;
    const t0 = await bal();
    await send(OWNER, { address: token, abi: xPNTsTokenV2ABI, functionName: 'mint', args: [account, parseEther('100')] });
    result(`S3a top-up: user signer calls=${signs}, community waits=${waits}, xPNTs +${(await bal()) - t0}`);

    await spacing();
    // ================= S4a inner call reverts: settled anyway, user pays =================
    SuperPaymasterInflightGuard.clearAll();
    signs = 0; waits = 0;
    const tooMuch = encodeFunctionData({ abi: SimpleAccountABI, functionName: 'execute', args: [token, 0n, encodeFunctionData({ abi: xPNTsTokenV2ABI, functionName: 'transfer', args: [OWNER, parseEther('10000000')] })] });
    const f0 = await bal();
    const fh = (await PaymasterClient.submitGaslessUserOperation(pub, userWallet, account, ep, sp, '0x0000000000000000000000000000000000000000', BUNDLER, tooMuch, { operator: OWNER, callGasLimit: 120_000n, verificationGasLimit: 300_000n, preVerificationGas: 80_000n })) as Hex;
    const frc = await receipt(fh);
    result(`S4a inner revert: SDK returned a hash without error; UserOperationEvent.success=${frc.success} · user still paid ${f0 - (await bal())} xPNTs · S_user=${signs} W_chain=${waits}`);
    if (frc.success !== false) fail('S4a: expected success=false');

    // ================= S5a stale price → Lens says STALE_PRICE → anyone refreshes → op goes through =================
    SuperPaymasterInflightGuard.clearAll();
    const threshold = (await pub.readContract({ address: sp, abi: SuperPaymasterV550ABI, functionName: 'priceStalenessThreshold' })) as bigint;
    await pub.request({ method: 'evm_increaseTime' as any, params: [Number(threshold) + 60] as any });
    await pub.request({ method: 'evm_mine' as any, params: [] as any });
    // The local bundler's clock is shifted to the fork's; re-sync it after this warp (fork-only).
    if (process.env.SP550_FORK_AFTER_WARP_CMD) {
        const { execSync } = await import('child_process');
        execSync(process.env.SP550_FORK_AFTER_WARP_CMD, { stdio: 'inherit' });
    }
    const lensA = superPaymasterLensActions(lens)(pub as any);
    const nonce = (await pub.readContract({ address: ep, abi: EntryPointABI, functionName: 'getNonce', args: [account, 0n] })) as bigint;
    const probe = {
        sender: account, nonce, initCode: '0x' as Hex, callData: callNoop,
        accountGasLimits: ('0x' + (300_000n).toString(16).padStart(32, '0') + (100_000n).toString(16).padStart(32, '0')) as Hex,
        preVerificationGas: 80_000n,
        gasFees: ('0x' + (1_000_000_000n).toString(16).padStart(32, '0') + (3_000_000_000n).toString(16).padStart(32, '0')) as Hex,
        paymasterAndData: encodeSuperPaymasterData({ paymaster: sp, operator: OWNER, verificationGasLimit: 300_000n, postOpGasLimit: 300_000n, token }),
        signature: '0x' as Hex,
    };
    const maxCost = 1_400_000n * 3_000_000_000n;
    const stale = await lensA.dryRunValidation({ superPaymaster: sp, userOp: probe, maxCost });
    let staleSubmit = 'not attempted';
    try {
        await PaymasterClient.submitGaslessUserOperation(pub, userWallet, account, ep, sp, '0x0000000000000000000000000000000000000000', BUNDLER, callNoop, { operator: OWNER });
        staleSubmit = 'ACCEPTED (unexpected)';
    } catch (e: any) { staleSubmit = `rejected: ${String(e?.message ?? e).slice(0, 120)}`; }
    // Anyone may refresh (SuperPaymasterAdmin.updatePrice has no modifier). The fork's oracle is
    // frozen, so its latest round would itself be stale — refreshed by the harness (fork-only),
    // exactly as SuperPaymaster's own fork rehearsal does.
    if (process.env.SP550_FORK_REFRESH_ORACLE_CMD) {
        const { execSync } = await import('child_process');
        execSync(process.env.SP550_FORK_REFRESH_ORACLE_CMD, { stdio: 'inherit' });
    }
    SuperPaymasterInflightGuard.clearAll();
    signs = 0; waits = 0;
    const anyone = mnemonicToAccount(MNEMONIC, { addressIndex: 7 }).address;
    await pub.request({ method: 'anvil_setBalance' as any, params: [anyone, '0xDE0B6B3A7640000'] as any });
    await send(anyone, { address: sp, abi: SuperPaymasterV550ABI, functionName: 'updatePrice', args: [] });
    const after = await lensA.dryRunValidation({ superPaymaster: sp, userOp: probe, maxCost });
    result(`S5a price unavailable: Lens before refresh ok=${stale.ok} (${stale.reason.code}); SDK submit before refresh ${staleSubmit}; refresh by an unrelated account (1 tx, ${waits} wait); Lens after ok=${after.ok} (${after.reason.code})`);
    await s1('S5a after refresh: PaymasterClient op', () =>
        PaymasterClient.submitGaslessUserOperation(pub, userWallet, account, ep, sp, '0x0000000000000000000000000000000000000000', BUNDLER, callNoop, { operator: OWNER }) as Promise<Hex>);

    // ================= S5b operator paused → Lens OPERATOR_PAUSED → owner unpauses =================
    await send(OWNER, { address: sp, abi: SuperPaymasterV550ABI, functionName: 'setOperatorPaused', args: [OWNER, true] });
    const nonce2 = (await pub.readContract({ address: ep, abi: EntryPointABI, functionName: 'getNonce', args: [account, 0n] })) as bigint;
    const paused = await lensA.dryRunValidation({ superPaymaster: sp, userOp: { ...probe, nonce: nonce2 }, maxCost });
    let pausedSubmit = '';
    try {
        SuperPaymasterInflightGuard.clearAll();
        await PaymasterClient.submitGaslessUserOperation(pub, userWallet, account, ep, sp, '0x0000000000000000000000000000000000000000', BUNDLER, callNoop, { operator: OWNER });
        pausedSubmit = 'ACCEPTED (unexpected)';
    } catch (e: any) { pausedSubmit = `rejected before signing: ${String(e?.message ?? e).slice(0, 110)}`; }
    await send(OWNER, { address: sp, abi: SuperPaymasterV550ABI, functionName: 'setOperatorPaused', args: [OWNER, false] });
    result(`S5b operator paused: Lens ok=${paused.ok} (${paused.reason.code}); SDK ${pausedSubmit}; unpaused by SP owner`);

    await spacing();
    // ================= C12: createEndUserClient().executeGasless (self-bundled handleOps) =================
    SuperPaymasterInflightGuard.clearAll();
    signs = 0; waits = 0;
    await pub.request({ method: 'anvil_setBalance' as any, params: [base.address, '0xDE0B6B3A7640000'] as any });
    const eu: any = createEndUserClient({ chain: sepolia, transport: http(RPC), account: user as any, addresses: { superPaymaster: sp, entryPoint: ep } });
    const c0 = await bal();
    const tx = (await eu.executeGasless({ target: OWNER, data: '0x', operator: OWNER })) as Hex;
    const rc = await pub.getTransactionReceipt({ hash: tx });
    let ok: boolean | undefined;
    for (const l of rc.logs as any[]) { try { const ev: any = decodeEventLog({ abi: EntryPointABI, data: l.data, topics: l.topics }); if (ev.eventName === 'UserOperationEvent') ok = ev.args.success; } catch { /* */ } }
    result(`C12 createEndUserClient().executeGasless: tx ${rc.status} UserOperationEvent.success=${ok} · user xPNTs -${c0 - (await bal())} · S_user signMessage=${signs} (+ the EOA's own handleOps tx, paid in ETH)`);
    if (ok !== true) fail('C12 path did not sponsor');

    console.log('\nRESULTS (fork rc result — v5.5.0-rc.4 on a local Sepolia fork, local bundler; NOT live):');
    for (const r of results) console.log(`  ${r}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
