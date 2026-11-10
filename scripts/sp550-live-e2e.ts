#!/usr/bin/env tsx
/**
 * SP 5.5.0 post-read-back E2E (DSR item 4): one sponsored op through the SDK, then an on-chain
 * INLINE allowance renewal (SUPER_PAYMASTER_FLAGS.SP_RENEW), each recorded with what it cost the
 * user's signer.
 *
 *   pnpm exec tsx scripts/sp550-live-e2e.ts --config <run.json> [--live-go <network>]
 *
 * Everything chain-specific comes from the config file and the SDK pins — nothing here names a
 * chain, an RPC, or an address:
 *   {
 *     "network": "sepolia" | "op-sepolia" | "op-mainnet",
 *     "mode": "fork" | "live",
 *     "rpcUrls": ["<rpc>", "<rpc2>"],     // the read-back gate's RPCs; the first one sends
 *     "bundlerUrl": "<bundler>",
 *     "gate": { "pinsFile"?: "<pins.json>", "block"?: "finalized" | "latest" | <n>, "allowRc"?: bool },
 *     "operator": "0x…",                    // the community operator whose xPNTs v2 token pays
 *     "account": "0x…",                     // the user's deployed AA account (SimpleAccount)
 *     "userKey": { "keystore": "<encrypted JSON keystore>" } | { "anvilIndex": <n> },   // live | fork
 *     "maxOps"?: 8                           // ops to spend before giving up on reaching renewal
 *   }
 *
 * Order, each step refusing before the next:
 *  1. usage: mode fork => every URL loopback and the key is anvil's public mnemonic; mode live =>
 *     `--live-go <network>` must repeat the config's network (the author's go, DSR rule), and the
 *     signer comes ONLY from an encrypted keystore whose password the author types at a hidden
 *     prompt (scripts/sp550-live-signer.ts) — never from an env var, argument or file;
 *  2. the SP 5.5.0 read-back gate (sp550CutoverGate) on the config's RPCs must exit 0 — this E2E
 *     only runs AFTER a passing read-back, against the addresses that read-back pinned;
 *  3. preconditions the SDK cannot create for a user (no community key is used here): account
 *     deployed, ENDUSER role, xPNTs balance, renewalMode == MODE_SP_K, no live lock / credit;
 *  4. S1: one PaymasterClient.submitGaslessUserOperation op;
 *  5. S3b: lower the SP auto allowance to SP_CAP_FLOOR (a sponsored op of its own) if needed, then
 *     send ops until one carries SP_RENEW. For that op it asserts, from the chain: the flags byte
 *     in the bundled handleOps calldata, UserOperationEvent.success, AllowanceRenewed(user, SP,
 *     inline=true) in the same receipt, and autoRenewUsed 0 -> 1.
 *
 * Every op prints one RESULT line: S_user (signMessage calls), the flags byte, success, tx hash.
 * Exit 2 = refused before sending; 1 = something sent or read back wrong; 0 = all assertions held.
 */
import * as fs from 'fs';
import {
    type Address, type Hex, createPublicClient, createWalletClient, decodeEventLog, decodeFunctionData,
    encodeFunctionData, getAddress, http, keccak256, toHex,
} from 'viem';
import { mnemonicToAccount } from 'viem/accounts';
import {
    EntryPointABI, RegistryABI, SimpleAccountABI, SuperPaymasterV550ABI, xPNTsTokenV2ABI, resolveSp550Network,
    SP550_CUTOVER_PINS, SP550_FRESH_DEPLOY_PINS, SUPER_PAYMASTER_FLAGS, SUPER_PAYMASTER_PMD_OFFSETS,
} from '@aastar/core';
import { PaymasterClient, SuperPaymasterInflightGuard } from '@aastar/paymaster';
import { runSp550CutoverGate, type GateRpc } from '../packages/core/src/sp550CutoverGate.js';
import { liveKeySourceProblem, loadLiveSigner } from './sp550-live-signer.js';

const ZERO = '0x0000000000000000000000000000000000000000' as Address;
const ANVIL_MNEMONIC = 'test test test test test test test test test test test junk';
const ROLE_ENDUSER = keccak256(toHex('ENDUSER'));
const MODE_SP_K = 0;

const args = process.argv.slice(2);
const arg = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const refuse = (m: string): never => { console.error(`refused: ${m}`); process.exit(2); };
const fail = (m: string): never => { console.error(`❌ ${m}`); process.exit(1); };
const result = (line: string) => console.log(`RESULT ${line}`);
const isLoopback = (u: string) => { try { return ['127.0.0.1', 'localhost', '[::1]'].includes(new URL(u).hostname); } catch { return false; } };

async function main() {
    // ---- 1. usage ----
    const file = arg('--config') ?? refuse('--config <run.json> is required');
    const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
    let net: ReturnType<typeof resolveSp550Network>;
    try { net = resolveSp550Network(cfg.network); } catch (e: any) { return refuse(e.message); }
    const rpcUrls: string[] = Array.isArray(cfg.rpcUrls) ? cfg.rpcUrls : [];
    if (rpcUrls.length === 0 || typeof cfg.bundlerUrl !== 'string') refuse('config needs rpcUrls[] and bundlerUrl');
    if (cfg.mode === 'fork') {
        if (![...rpcUrls, cfg.bundlerUrl].every(isLoopback)) refuse('mode fork: every RPC and the bundler must be loopback');
        if (cfg.userKey?.anvilIndex === undefined) refuse('mode fork: userKey must be { anvilIndex } (anvil\'s public mnemonic)');
    } else if (cfg.mode === 'live') {
        if (arg('--live-go') !== net.network) refuse(`mode live sends real ops: pass --live-go ${net.network} (the author's go for this network)`);
        const problem = liveKeySourceProblem(cfg.userKey);
        if (problem) refuse(problem);
    } else refuse('config.mode must be "fork" or "live"');
    const operator = getAddress(cfg.operator ?? refuse('config.operator is required'));
    const account = getAddress(cfg.account ?? refuse('config.account is required'));
    const maxOps = Number(cfg.maxOps ?? 8);

    // ---- 2. the read-back gate must pass on these RPCs ----
    const gateRpcs: GateRpc[] = rpcUrls.map((url, i) => ({
        label: i === 0 ? '--rpc' : `--rpc${i + 1}`, url, client: createPublicClient({ transport: http(url) }) as unknown as GateRpc['client'],
    }));
    let pins;
    if (cfg.gate?.pinsFile) {
        const j = JSON.parse(fs.readFileSync(cfg.gate.pinsFile, 'utf8'));
        pins = { ...j, readbackBlock: j.readbackBlock !== undefined ? BigInt(j.readbackBlock) : undefined };
    }
    const block = cfg.gate?.block;
    const gate = await runSp550CutoverGate({
        network: net.network, rpcs: gateRpcs, pins, pinsSource: cfg.gate?.pinsFile, allowRc: !!cfg.gate?.allowRc,
        block: block === undefined || block === 'finalized' || block === 'latest' ? block : BigInt(block),
    });
    if (gate.exitCode !== 0) {
        for (const c of gate.results.filter((c) => !c.ok)) console.error(`  gate ❌ ${c.check} — ${c.detail}`);
        refuse(`the SP 5.5.0 read-back gate did not pass (exit ${gate.exitCode}${gate.error ? `: ${gate.error}` : ''}); this E2E runs only after it does`);
    }
    console.log(gate.header);
    // The SuperPaymaster the gate just passed: the --pins file, else the network's pin table — the
    // same source the gate read, so the E2E cannot drift onto an address the read-back did not check.
    const pinned = pins ?? (net.mode === 'fresh' ? SP550_FRESH_DEPLOY_PINS : SP550_CUTOVER_PINS)[net.chainId];
    const sp = getAddress(pinned?.superPaymaster ?? fail('no pinned superPaymaster (the gate should have refused)'));
    const pub = createPublicClient({ transport: http(rpcUrls[0]) });
    const ep = (await pub.readContract({ address: sp, abi: SuperPaymasterV550ABI, functionName: 'entryPoint' })) as Address;
    const registry = (await pub.readContract({ address: sp, abi: SuperPaymasterV550ABI, functionName: 'REGISTRY' })) as Address;
    // operators(): (aPNTsBalance, isConfigured, isPaused, xPNTsToken, reputation, minTxInterval, …)
    const opCfg = (await pub.readContract({ address: sp, abi: SuperPaymasterV550ABI, functionName: 'operators', args: [operator] })) as readonly any[];
    if (!opCfg[1] || opCfg[2]) refuse(`operator ${operator} is not configured or is paused on ${sp}`);
    const token = getAddress(opCfg[3]) as Address;
    const minTxInterval = BigInt(opCfg[5]);
    console.log(`SP ${sp} · EntryPoint ${ep} · operator ${operator} · token ${token} · minTxInterval ${minTxInterval}s · bundler ${new URL(cfg.bundlerUrl).host}`);

    // ---- the user's signer, counted ----
    // Prompted only now, after the gate passed, so a failing read-back never asks for the password.
    let base;
    try {
        base = cfg.mode === 'fork'
            ? mnemonicToAccount(ANVIL_MNEMONIC, { addressIndex: Number(cfg.userKey.anvilIndex) })
            : await loadLiveSigner(cfg.userKey);
    } catch (e: any) { return refuse(String(e?.message ?? e)); }
    let signs = 0;
    const user = { ...base, signMessage: async (a: any) => { signs++; return base.signMessage(a); } };
    const userWallet = createWalletClient({ account: user as any, transport: http(rpcUrls[0]) });
    const owner = (await pub.readContract({ address: account, abi: SimpleAccountABI, functionName: 'owner' }).catch(() => undefined)) as Address | undefined;
    if (!owner || getAddress(owner) !== getAddress(base.address)) refuse(`account ${account} is not deployed or not owned by the configured key`);

    // ---- 3. preconditions (no community key here: missing setup is reported, not performed) ----
    const tok = (functionName: string, a: unknown[] = []) => pub.readContract({ address: token, abi: xPNTsTokenV2ABI, functionName, args: a }) as Promise<any>;
    const state = async () => {
        const [allow, renewUsed, locked, credit, bal] = await Promise.all([
            tok('autoAllowance', [account, sp]), tok('autoRenewUsed', [account]), tok('lockedOf', [account]), tok('creditReservedOf', [account]), tok('balanceOf', [account]),
        ]);
        return { cap: BigInt(allow[0]), used: BigInt(allow[1]), renewUsed: BigInt(renewUsed), locked: BigInt(locked), credit: BigInt(credit), bal: BigInt(bal) };
    };
    const missing: string[] = [];
    if (!(await pub.readContract({ address: registry, abi: RegistryABI, functionName: 'hasRole', args: [ROLE_ENDUSER, account] }))) missing.push('ENDUSER role');
    const s0 = await state();
    if (s0.bal === 0n) missing.push('xPNTs balance');
    if (Number(await tok('renewalMode', [account])) !== MODE_SP_K) missing.push('renewalMode == MODE_SP_K');
    if (s0.locked !== 0n || s0.credit !== 0n) missing.push('no live lock / credit reservation');
    const K = BigInt(await tok('K'));
    if (s0.renewUsed >= K) missing.push(`autoRenewUsed < K (${s0.renewUsed}/${K}; the user can renewForSelf first)`);
    if (missing.length) refuse(`preconditions not met for ${account}: ${missing.join(', ')}`);

    // ---- helpers ----
    const receipt = async (opHash: Hex) => {
        for (let i = 0; i < 120; i++) {
            const r = await (await fetch(cfg.bundlerUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getUserOperationReceipt', params: [opHash] }) })).json();
            if (r.result) return r.result;
            await new Promise((res) => setTimeout(res, 1000));
        }
        return fail(`no receipt for ${opHash}`);
    };
    /** The flags byte of THIS op, read from the bundle transaction's handleOps calldata. */
    const flagsOnChain = async (txHash: Hex, nonce: bigint): Promise<number> => {
        const tx = await pub.getTransaction({ hash: txHash });
        const { functionName, args: a } = decodeFunctionData({ abi: EntryPointABI, data: tx.input });
        if (functionName !== 'handleOps') return fail(`bundle tx ${txHash} is ${functionName}, not handleOps; cannot read the op's paymasterAndData`);
        const ops = (a![0] as any[]).filter((o) => getAddress(o.sender) === account && BigInt(o.nonce) === nonce);
        if (ops.length !== 1) return fail(`bundle tx ${txHash} carries ${ops.length} ops for ${account} nonce ${nonce}`);
        const pmd = ops[0].paymasterAndData as Hex;
        if ((pmd.length - 2) / 2 <= SUPER_PAYMASTER_PMD_OFFSETS.FLAGS) return 0; // 124-byte layout: flags omitted = 0
        return parseInt(pmd.slice(2 + SUPER_PAYMASTER_PMD_OFFSETS.FLAGS * 2, 4 + SUPER_PAYMASTER_PMD_OFFSETS.FLAGS * 2), 16);
    };
    let lastSent = 0;
    const spaced = async () => {
        const wait = lastSent + (Number(minTxInterval) + 2) * 1000 - Date.now();
        if (lastSent && wait > 0) await new Promise((r) => setTimeout(r, wait));
    };
    const op = async (label: string, callData: Hex) => {
        await spaced();
        SuperPaymasterInflightGuard.clearAll();
        signs = 0;
        const before = await state();
        const opHash = (await PaymasterClient.submitGaslessUserOperation(pub as any, userWallet as any, account, ep, sp, ZERO, cfg.bundlerUrl, callData, { operator })) as Hex;
        lastSent = Date.now();
        const rc = await receipt(opHash);
        const txHash = rc.receipt?.transactionHash as Hex;
        const flags = await flagsOnChain(txHash, BigInt(rc.nonce));
        const logs = (rc.receipt?.logs ?? []) as any[];
        const renewedInline = logs.some((l) => {
            if (getAddress(l.address) !== token) return false;
            try {
                const ev = decodeEventLog({ abi: xPNTsTokenV2ABI, data: l.data, topics: l.topics }) as any;
                return ev.eventName === 'AllowanceRenewed' && getAddress(ev.args.user) === account && getAddress(ev.args.spender) === sp && ev.args.inline === true;
            } catch { return false; }
        });
        const after = await state();
        result(`${label}: success=${rc.success} S_user signMessage=${signs} flags=0x${flags.toString(16).padStart(2, '0')} ` +
            `allowance used ${before.used}->${after.used}/${after.cap} autoRenewUsed ${before.renewUsed}->${after.renewUsed} ` +
            `AllowanceRenewed(inline)=${renewedInline} · tx ${txHash}`);
        if (rc.success !== true) fail(`${label}: UserOperationEvent.success=${rc.success}`);
        return { flags, renewedInline, before, after, txHash };
    };
    const noop = encodeFunctionData({ abi: SimpleAccountABI, functionName: 'execute', args: [operator, 0n, '0x'] });

    // ---- 4. S1 ----
    const s1 = await op('S1 PaymasterClient.submitGaslessUserOperation', noop);
    if (s1.flags & SUPER_PAYMASTER_FLAGS.SP_RENEW && !s1.renewedInline) fail('S1 carried SP_RENEW but no inline AllowanceRenewed was emitted');

    // ---- 5. S3b inline renewal ----
    let renewal = s1.flags & SUPER_PAYMASTER_FLAGS.SP_RENEW ? s1 : undefined;
    if (!renewal) {
        const floor = BigInt(await tok('SP_CAP_FLOOR'));
        if ((await state()).cap > floor) {
            await op(`S3b setup: setAutoAllowance(SP, SP_CAP_FLOOR=${floor})`, encodeFunctionData({
                abi: SimpleAccountABI, functionName: 'execute',
                args: [token, 0n, encodeFunctionData({ abi: xPNTsTokenV2ABI, functionName: 'setAutoAllowance', args: [sp, floor] })],
            }));
        }
        for (let i = 1; i <= maxOps && !renewal; i++) {
            const r = await op(`S3b spend ${i}/${maxOps}`, noop);
            if (r.flags & SUPER_PAYMASTER_FLAGS.SP_RENEW) renewal = r;
        }
    }
    if (!renewal) fail(`S3b: no op needed SP_RENEW within ${maxOps} ops (raise maxOps; the allowance used is ${(await state()).used})`);
    if (!renewal!.renewedInline) fail('S3b: the op carried SP_RENEW but the receipt has no AllowanceRenewed(user, SP, inline=true)');
    if (renewal!.after.renewUsed !== renewal!.before.renewUsed + 1n) fail(`S3b: autoRenewUsed ${renewal!.before.renewUsed} -> ${renewal!.after.renewUsed}, expected +1`);
    result(`S3b inline renewal: SP_RENEW in paymasterAndData[${SUPER_PAYMASTER_PMD_OFFSETS.FLAGS}] of tx ${renewal!.txHash}; success=true; AllowanceRenewed inline; autoRenewUsed +1; extra user signatures for the renewal: 0 beyond the op's own`);
    console.log('\nPASS');
}

main().catch((e) => fail(String(e?.shortMessage ?? e?.message ?? e)));
