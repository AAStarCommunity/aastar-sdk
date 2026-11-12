#!/usr/bin/env tsx
/**
 * SP 5.5.0 post-read-back E2E (DSR item 4): one sponsored op through the SDK, then an on-chain
 * INLINE allowance renewal (SUPER_PAYMASTER_FLAGS.SP_RENEW), each recorded with what it cost the
 * user's signer.
 *
 *   pnpm exec tsx scripts/sp550-live-e2e.ts --config <run.json> [--live-go <network>] [--preflight]
 *
 * --fork-setup (mode fork only, anvil only) first puts the user into the step-3 state by anvil
 * impersonation: deploys the account, grants ENDUSER, mints xPNTs, sets renewalMode SP_K
 * (scripts/sp550-e2e-fork-setup.ts). Step 3 still re-checks all of it afterwards.
 *
 * --preflight runs steps 1-3 (usage, read-back gate, preconditions) and exits without sending an op;
 * in live mode it still needs --live-go and the keystore, because step 3 checks the signer owns the
 * account.
 *
 * Everything chain-specific comes from the config file and the SDK pins — nothing here names a
 * chain, an RPC, or an address:
 *   {
 *     "network": "sepolia" | "op-sepolia" | "op-mainnet",
 *     "mode": "fork" | "live",
 *     "rpcUrls": ["<rpc>", "<rpc2>"],     // the read-back gate's RPCs; the first one sends
 *     "bundlerUrl": "<bundler>",
 *     "gate": { "pinsFile"?: "<pins.json>", "block"?: "finalized" | "latest" | <n>, "allowRc"?: bool,
 *               "switchBook"?: true },   // mode fork only, with pinsFile: the book the pin-fill PR would write
 *     "operator": "0x…",                    // the community operator whose xPNTs v2 token pays
 *     "account": "0x…",                     // the user's deployed AA account (SimpleAccount)
 *     "userKey": { "keystore": "<encrypted JSON keystore>" } | { "anvilIndex": <n> },   // live | fork
 *     "maxOps"?: 8,                          // ops to spend before giving up on reaching renewal
 *     "forkSetup"?: { "simpleAccountFactory": "0x…", "salt"?: 0 },  // --fork-setup, when the account has no code yet
 *     "expectMinPostOpGas": "500000",       // gasParams().minPostOpGas must equal the release tuple's value
 *     "requireFreshAccount"?: true          // mode fork (A7): the account must not exist before the run, and S1
 *                                            // (its first sponsored op: fresh lock / allowance slots) must succeed
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
 *     bySP=true) in the same receipt, and autoRenewUsed 0 -> 1.
 *
 * Every op prints one RESULT line: success, S_user (signMessage calls), estimates / sends, the flags
 * byte, allowance and autoRenewUsed changes, AllowanceRenewed(bySP), the bundled postOpGasLimit, tx hash.
 * Every op is also held to three checks (scripts/sp550-e2e-checks.ts), read from what the SDK sent
 * to the bundler and what the chain did, and the run fails on any of them:
 *   - placeholder-signature estimation: each eth_estimateUserOperationGas carries
 *     PaymasterClient.dummySignature() and leaves before the signer is asked;
 *   - one signature per op: one eth_sendUserOperation, a real signature, signMessage called once
 *     (a fee/PVG retry re-signs, so a retried op fails this rather than being counted as one);
 *   - SP_RENEW chosen by the SDK (superPaymasterFlags is never passed here): the flags byte sent
 *     equals the bundled one; SP_RENEW => AllowanceRenewed(bySP=true) and autoRenewUsed +1; no SP_RENEW
 *     => neither.
 * Exit 2 = refused before sending; 1 = something sent or read back wrong; 0 = all assertions held.
 */
import * as fs from 'fs';
import {
    type Abi, type Address, type Hex, createPublicClient, createWalletClient, decodeFunctionData,
    encodeFunctionData, extractChain, getAddress, http, isAddress, keccak256, toHex,
} from 'viem';
import { optimism, optimismSepolia, sepolia } from 'viem/chains';
import { mnemonicToAccount } from 'viem/accounts';
import {
    CANONICAL_ADDRESSES, EntryPointABI, RegistryABI, SimpleAccountABI, SuperPaymasterV550ABI, xPNTsTokenV2ABI, resolveSp550Network,
    SP550_CUTOVER_PINS, SP550_FRESH_DEPLOY_PINS, SUPER_PAYMASTER_FLAGS, SUPER_PAYMASTER_PMD_OFFSETS, getSuperPaymasterGasParams,
} from '@aastar/core';
import { PaymasterClient, SuperPaymasterInflightGuard } from '@aastar/paymaster';
import { runSp550CutoverGate, type GateRpc } from '../packages/core/src/sp550CutoverGate.js';
import { liveKeySourceProblem, loadLiveSigner } from './sp550-live-signer.js';
import { forkSetup } from './sp550-e2e-fork-setup.js';
import { applyBookSwitch, bookSwitch, parseManifestPins, upgradeBookProblems } from './sp550-pin-fill-core.js';
import { gasSourceClient, isSpRelayedRenewal, opSigningProblems, renewalConsistencyProblems, tapBundler, type BundlerCall } from './sp550-e2e-checks.js';

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
    // Fork-only switches are refused here, before anything is read from a network.
    if (cfg.mode !== 'fork' && args.includes('--fork-setup')) refuse('--fork-setup impersonates accounts: mode fork only');
    if (cfg.mode !== 'fork' && cfg.gate?.pinsFile !== undefined) refuse('gate.pinsFile is fork-only: a live run is held against the pins the SDK ships with');
    if (cfg.mode !== 'fork' && cfg.gate?.switchBook !== undefined) refuse('gate.switchBook is fork-only: a live run is held against the SDK book it ships with');
    if (cfg.gate?.bookOverrides !== undefined) refuse('gate.bookOverrides is gone: use gate.switchBook, which derives the book from the pins exactly as pin-fill does');
    const operator = getAddress(cfg.operator ?? refuse('config.operator is required'));
    const account = getAddress(cfg.account ?? refuse('config.account is required'));
    const maxOps = Number(cfg.maxOps ?? 8);

    // ---- 2. the read-back gate must pass on these RPCs ----
    const gateRpcs: GateRpc[] = rpcUrls.map((url, i) => ({
        label: i === 0 ? '--rpc' : `--rpc${i + 1}`, url, client: createPublicClient({ transport: http(url) }) as unknown as GateRpc['client'],
    }));
    // A pins file is SP's manifest pins JSON: parsed exactly as pin-fill parses it (the timelock declaration
    // becomes addresses.timelockController or absent[], `_aliases` is checked), so every stage reads one shape.
    let pins;
    if (cfg.gate?.pinsFile) {
        try { pins = parseManifestPins(JSON.parse(fs.readFileSync(cfg.gate.pinsFile, 'utf8')), net.mode); } catch (e) { return refuse((e as Error).message); }
    }
    const block = cfg.gate?.block;
    // The gate holds the pins against the SDK's own address book. Before the pin-fill PR that book still
    // names the pre-cutover entries, so a fork rehearsal derives the book the pin-fill PR would write:
    // pin-fill's own upgradeBookProblems (against the SHIPPED book) and bookSwitch, so the fork run and the
    // gate preview hold the same book. Live mode reads the shipped book and nothing else.
    let book: Record<string, unknown> | undefined;
    if (cfg.gate?.switchBook !== undefined) {
        if (cfg.gate.switchBook !== true) refuse('gate.switchBook must be true when given');
        const fromPins = pins ?? refuse('gate.switchBook needs gate.pinsFile (the book is derived from the pins)');
        const shipped: Record<string, unknown> = { ...((CANONICAL_ADDRESSES as Record<number, any>)[net.chainId] ?? {}) };
        let switched: Record<string, string | null>;
        try { switched = bookSwitch(net.mode, fromPins); } catch (e) { return refuse((e as Error).message); }
        if (net.mode === 'upgrade') {
            const moved = upgradeBookProblems(fromPins, switched, shipped);
            if (moved.length) refuse(`gate.switchBook: the pins move book entries an upgrade keeps: ${moved.join('; ')}`);
        }
        for (const [k, a] of Object.entries(switched)) console.log(`fork-only SDK book switch: ${k} ${String(shipped[k] ?? '(absent)')} -> ${a ?? '(removed)'}`);
        book = applyBookSwitch(shipped, switched);
    }
    const gate = await runSp550CutoverGate({
        network: net.network, rpcs: gateRpcs, pins, pinsSource: cfg.gate?.pinsFile, allowRc: !!cfg.gate?.allowRc, book,
        block: block === undefined || block === 'finalized' || block === 'latest' ? block : BigInt(block),
    });
    if (gate.exitCode !== 0) {
        for (const c of gate.results.filter((c) => !c.ok)) console.error(`  gate ❌ ${c.check} — ${c.detail}`);
        refuse(`the SP 5.5.0 read-back gate did not pass (exit ${gate.exitCode}${gate.error ? `: ${gate.error}` : ''}); this E2E runs only after it does`);
    }
    console.log(gate.header);
    for (const c of gate.results) console.log(`  gate ✅ ${c.check} — ${c.detail}`);
    // The SuperPaymaster the gate just passed: the --pins file, else the network's pin table — the
    // same source the gate read, so the E2E cannot drift onto an address the read-back did not check.
    const pinned = pins ?? (net.mode === 'fresh' ? SP550_FRESH_DEPLOY_PINS : SP550_CUTOVER_PINS)[net.chainId];
    const sp = getAddress(pinned?.superPaymaster ?? fail('no pinned superPaymaster (the gate should have refused)'));
    // The SDK hashes the op with client.chain.id, so the clients carry the network's chain, and the
    // sending RPC must report that chain id (an anvil fork keeps the forked chain's id).
    const chain = extractChain({ chains: [sepolia, optimismSepolia, optimism], id: net.chainId as 11155111 | 11155420 | 10 });
    if (!chain) fail(`no viem chain for chain id ${net.chainId}`);
    const pub = createPublicClient({ chain, transport: http(rpcUrls[0]) });
    const rpcChainId = await pub.getChainId();
    if (rpcChainId !== net.chainId) refuse(`${rpcUrls[0]} reports chain ${rpcChainId}, not ${net.network} (${net.chainId})`);
    const ep = (await pub.readContract({ address: sp, abi: SuperPaymasterV550ABI, functionName: 'entryPoint' })) as Address;
    const registry = (await pub.readContract({ address: sp, abi: SuperPaymasterV550ABI, functionName: 'REGISTRY' })) as Address;
    // operators(): (aPNTsBalance, isConfigured, isPaused, xPNTsToken, reputation, minTxInterval, …)
    const opCfg = (await pub.readContract({ address: sp, abi: SuperPaymasterV550ABI, functionName: 'operators', args: [operator] })) as readonly any[];
    if (!opCfg[1] || opCfg[2]) refuse(`operator ${operator} is not configured or is paused on ${sp}`);
    const token = getAddress(opCfg[3]) as Address;
    const minTxInterval = BigInt(opCfg[5]);
    console.log(`SP ${sp} · EntryPoint ${ep} · operator ${operator} · token ${token} · minTxInterval ${minTxInterval}s · bundler ${new URL(cfg.bundlerUrl).host}`);
    // The postOp floor the SDK applies is read live (gasParams().minPostOpGas); the release tuple sets it
    // (rc.8: 500,000 — DSR). expectMinPostOpGas holds the chain to that value; it is required, since an
    // optional expectation is a check a config can silently drop.
    if (typeof cfg.expectMinPostOpGas !== 'string' || !/^[1-9][0-9]*$/.test(cfg.expectMinPostOpGas)) {
        refuse('expectMinPostOpGas must be set to the release tuple\'s minPostOpGas as a positive decimal string (rc.8: "500000")');
    }
    const expectMinPostOpGas = BigInt(cfg.expectMinPostOpGas);
    const gp = await getSuperPaymasterGasParams(pub as any, sp);
    console.log(`SP gasParams: minPostOpGas ${gp.minPostOpGas} (${gp.source}) · settleGasBound ${gp.settleGasBound ?? '-'} · cPostop ${gp.cPostop ?? '-'}`);
    if (gp.minPostOpGas !== expectMinPostOpGas) {
        fail(`gasParams().minPostOpGas ${gp.minPostOpGas} != expected ${cfg.expectMinPostOpGas} (the release tuple)`);
    }
    // Gas source (DSR): every op's gas comes from this bundler's eth_estimateUserOperationGas against its
    // own node — never from a local forge simulation. Recorded as the host and the client it reports
    // (the full URL usually embeds a key and is never printed).
    // An unreachable bundler, a non-2xx answer, a non-JSON-RPC body, or any JSON-RPC error other than
    // method-not-found (-32601: the method is optional) fails here — an auth / rate-limit / internal error
    // is not a usable gas source (Codex r4).
    const bundlerHost = new URL(cfg.bundlerUrl).host;
    let bundlerReply: any;
    try {
        const res = await fetch(cfg.bundlerUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'web3_clientVersion', params: [] }), signal: AbortSignal.timeout(15_000) });
        if (!res.ok) return fail(`GAS SOURCE: bundler ${bundlerHost} answered HTTP ${res.status}`);
        bundlerReply = await res.json();
    } catch (e: any) { return fail(`GAS SOURCE: bundler ${bundlerHost} did not answer JSON-RPC (${e?.name ?? 'error'})`); }
    const bundlerClient = gasSourceClient(bundlerReply);
    if (bundlerClient === undefined) fail(`GAS SOURCE: bundler ${bundlerHost} did not give a client version or method-not-found (error ${JSON.stringify(bundlerReply?.error?.code ?? null)})`);
    console.log(`GAS SOURCE: eth_estimateUserOperationGas on bundler ${bundlerHost} (client ${bundlerClient}); the SDK estimates nothing locally`);

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
    const userWallet = createWalletClient({ account: user as any, chain, transport: http(rpcUrls[0]) });
    // Whether the account exists before this run: A7 must prove the FIRST sponsored op of a brand-new
    // account (fresh lock / allowance slots: the Amsterdam state-gas case, DSR) succeeds.
    const codeBefore = await pub.getCode({ address: account });
    const freshAccount = !codeBefore || codeBefore === '0x';
    if (cfg.requireFreshAccount === true && cfg.mode !== 'fork') refuse('requireFreshAccount is a fork (A7) check: a live account is the user\'s own');
    if (cfg.requireFreshAccount === true && !freshAccount) refuse(`requireFreshAccount: account ${account} already has code; A7 needs a brand-new account`);
    if (args.includes('--fork-setup')) {
        try {
            await forkSetup({
                pub: pub as any, rpcUrl: rpcUrls[0], registry, token, account, owner: base.address, roleEnduser: ROLE_ENDUSER, modeSpK: MODE_SP_K,
                simpleAccountFactory: cfg.forkSetup?.simpleAccountFactory ? getAddress(cfg.forkSetup.simpleAccountFactory) : undefined,
                salt: cfg.forkSetup?.salt !== undefined ? BigInt(cfg.forkSetup.salt) : undefined,
                log: console.log,
            });
        } catch (e: any) { return fail(String(e?.shortMessage ?? e?.message ?? e)); }
    }
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
    if (args.includes('--preflight')) {
        result(`preflight: gate passed, preconditions met for ${account} (allowance ${s0.used}/${s0.cap}, autoRenewUsed ${s0.renewUsed}/${K}); no op sent`);
        return;
    }

    // ---- helpers ----
    const receipt = async (opHash: Hex) => {
        for (let i = 0; i < 120; i++) {
            const r = await (await fetch(cfg.bundlerUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getUserOperationReceipt', params: [opHash] }) })).json();
            if (r.result) return r.result;
            await new Promise((res) => setTimeout(res, 1000));
        }
        return fail(`no receipt for ${opHash}`);
    };
    /** The flags byte and paymasterPostOpGasLimit of THIS op, read from the bundle transaction's handleOps calldata. */
    const onChainOp = async (txHash: Hex, nonce: bigint): Promise<{ flags: number; postOpGasLimit: bigint }> => {
        const tx = await pub.getTransaction({ hash: txHash });
        const { functionName, args: a } = decodeFunctionData({ abi: EntryPointABI, data: tx.input });
        if (functionName !== 'handleOps') return fail(`bundle tx ${txHash} is ${functionName}, not handleOps; cannot read the op's paymasterAndData`);
        const ops = (a![0] as any[]).filter((o) => getAddress(o.sender) === account && BigInt(o.nonce) === nonce);
        if (ops.length !== 1) return fail(`bundle tx ${txHash} carries ${ops.length} ops for ${account} nonce ${nonce}`);
        const pmd = ops[0].paymasterAndData as Hex;
        const O = SUPER_PAYMASTER_PMD_OFFSETS;
        if ((pmd.length - 2) / 2 < O.OPERATOR) return fail(`bundle tx ${txHash}: paymasterAndData is ${(pmd.length - 2) / 2} bytes, shorter than the v0.7 header`);
        const postOpGasLimit = BigInt(`0x${pmd.slice(2 + O.POSTOP_GAS * 2, 2 + O.OPERATOR * 2)}`);
        // 124-byte layout: flags omitted = 0
        const flags = (pmd.length - 2) / 2 <= O.FLAGS ? 0 : parseInt(pmd.slice(2 + O.FLAGS * 2, 4 + O.FLAGS * 2), 16);
        return { flags, postOpGasLimit };
    };
    const bundlerCalls: BundlerCall[] = [];
    const untapBundler = tapBundler(cfg.bundlerUrl, () => signs, bundlerCalls);
    const DUMMY_SIGNATURE = PaymasterClient.dummySignature();
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
        const first = bundlerCalls.length;
        // No superPaymasterFlags: SP_RENEW is the SDK's per-op decision, which is what is under test.
        const opHash = (await PaymasterClient.submitGaslessUserOperation(pub as any, userWallet as any, account, ep, sp, ZERO, cfg.bundlerUrl, callData, { operator })) as Hex;
        lastSent = Date.now();
        const submitted = bundlerCalls.slice(first);
        const signsForOp = signs;
        const rc = await receipt(opHash);
        const txHash = rc.receipt?.transactionHash as Hex;
        const { flags, postOpGasLimit } = await onChainOp(txHash, BigInt(rc.nonce));
        const logs = (rc.receipt?.logs ?? []) as any[];
        const renewedInline = logs.some((l) => isSpRelayedRenewal(l, xPNTsTokenV2ABI as Abi, { token, user: account, sp }));
        const after = await state();
        const estimates = submitted.filter((c) => c.method === 'eth_estimateUserOperationGas').length;
        const sends = submitted.filter((c) => c.method === 'eth_sendUserOperation');
        result(`${label}: success=${rc.success} S_user signMessage=${signsForOp} estimates=${estimates} (placeholder sig) sends=${sends.length} ` +
            `flags=0x${flags.toString(16).padStart(2, '0')} (SDK-selected) ` +
            `allowance used ${before.used}->${after.used}/${after.cap} autoRenewUsed ${before.renewUsed}->${after.renewUsed} ` +
            `AllowanceRenewed(bySP)=${renewedInline} postOpGasLimit=${postOpGasLimit} · tx ${txHash}`);
        if (rc.success !== true) fail(`${label}: UserOperationEvent.success=${rc.success}`);
        // The floor the SDK applies, held on what was actually bundled (not on the getter alone).
        if (postOpGasLimit < expectMinPostOpGas) fail(`${label}: bundled paymasterPostOpGasLimit ${postOpGasLimit} < minPostOpGas ${expectMinPostOpGas}`);
        const problems = [
            ...opSigningProblems(submitted, signsForOp, DUMMY_SIGNATURE),
            ...renewalConsistencyProblems({
                onChainFlags: flags, sentFlags: sends.at(-1)?.flags, renewedInline,
                renewUsedBefore: before.renewUsed, renewUsedAfter: after.renewUsed,
            }),
        ];
        if (problems.length) fail(`${label}: ${problems.join('; ')}`);
        return { flags, renewedInline, before, after, txHash };
    };
    const noop = encodeFunctionData({ abi: SimpleAccountABI, functionName: 'execute', args: [operator, 0n, '0x'] });

    try {
        // ---- 4. S1 ----
        const s1 = await op('S1 PaymasterClient.submitGaslessUserOperation', noop);
        if (cfg.requireFreshAccount === true) {
            // op() already failed the run unless UserOperationEvent.success; these make "first op of a new account" checkable.
            if (s1.before.used !== 0n || s1.before.locked !== 0n || s1.before.renewUsed !== 0n) {
                fail(`requireFreshAccount: S1 was not the account's first sponsored op (allowance used ${s1.before.used}, lockedOf ${s1.before.locked}, autoRenewUsed ${s1.before.renewUsed})`);
            }
            result(`A7 FRESH ACCOUNT: account ${account} created in this run (no code before it), S1 is its first sponsored op (allowance used 0, lockedOf 0, autoRenewUsed 0) and succeeded · tx ${s1.txHash}`);
        }

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
        // renewalConsistencyProblems already held this op to: AllowanceRenewed(bySP=true), autoRenewUsed +1.
        result(`S3b inline renewal: SP_RENEW chosen by the SDK, in paymasterAndData[${SUPER_PAYMASTER_PMD_OFFSETS.FLAGS}] of tx ${renewal!.txHash}; success=true; AllowanceRenewed(bySP=true); autoRenewUsed +1; user signatures for the op incl. the renewal: 1`);
    } finally {
        // fail() exits the process; this covers the normal path and a thrown error.
        untapBundler();
    }
    console.log('\nPASS');
}

main().catch((e) => fail(String(e?.shortMessage ?? e?.message ?? e)));
