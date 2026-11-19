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
 *     "network": "sepolia" | "sepolia-rc8" | "op-sepolia" | "op-mainnet",   // sepolia-rc8: the coexisting rc.8 stack
 *     "mode": "fork" | "live",
 *     "rpcUrls": ["<rpc>", "<rpc2>"],     // the read-back gate's RPCs; the first one sends
 *     "bundlerUrl": "<bundler>",
 *     "gate": { "pinsFile"?: "<pins.json>", "block"?: "finalized" | "latest" | <n>, "allowRc"?: bool,
 *               "switchBook"?: true,     // mode fork only, with pinsFile: the book the pin-fill PR would write
 *               "deployLiveConfig"?: "<DeployLive config.json>" },  // mode fork only: the joint rehearsal on SP's
 *                                        // acceptance fork — addresses read from the config, held to fork checks
 *                                        // (anvil, code, SP wiring) instead of the read-back gate
 *     "taskPlan"?: { "file": "<rq3-three-arm.<chainId>.json>", "sha256": "<hex>" },  // SP's three-arm plan: its T
 *                                        // and taskCallData are used (and must match); not with taskToken
 *     "operator": "0x…",                    // the community operator whose xPNTs v2 token pays
 *     "account": "0x…",                     // the user's deployed AA account (SimpleAccount)
 *     "userKey": { "keystore": "<encrypted JSON keystore>" } | { "anvilIndex": <n> },   // live | fork
 *     "maxOps"?: 8,                          // ops to spend before giving up on reaching renewal
 *     "forkSetup"?: { "simpleAccountFactory": "0x…", "salt"?: 0 },  // --fork-setup, when the account has no code yet
 *     "expectMinPostOpGas": "500000",       // gasParams().minPostOpGas must equal the release tuple's value
 *     "expectMinTxInterval": "60",          // operators(operator).minTxInterval must equal it (S1r needs it; SP's setup sets it)
 *     "taskToken"?: "0x…",                  // T: each op calls execute(T, 0, transfer(0x…dEaD, 1)); its balance is a precondition
 *     "frozenGas"?: { "verificationGasLimit": "…", … all five },  // a data collection: limits used verbatim, recorded per row
 *     "gasLimitCoefficientBps"?: 15000,     // the SDK's default when omitted; recorded per row
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
    decodeEventLog, encodeFunctionData, extractChain, getAddress, http, isAddress, keccak256, toHex,
} from 'viem';
import { optimism, optimismSepolia, sepolia } from 'viem/chains';
import { mnemonicToAccount } from 'viem/accounts';
import {
    CANONICAL_ADDRESSES, ERC20ABI, EntryPointABI, MySBTABI, RegistryABI, SimpleAccountABI, SuperPaymasterV550ABI, xPNTsTokenV2ABI, resolveSp550Network,
    SUPER_PAYMASTER_FLAGS, SUPER_PAYMASTER_PMD_OFFSETS, getSuperPaymasterGasParams, requireDeployedAddress, sp550PinsFor,
} from '@aastar/core';
import { PaymasterClient, SuperPaymasterInflightGuard, UserOperationNotYetValidError, type GasDecision } from '@aastar/paymaster';
import { runSp550CutoverGate, type GateRpc } from '../packages/core/src/sp550CutoverGate.js';
import { liveKeySourceProblem, loadLiveSigner } from './sp550-live-signer.js';
import { forkSetup } from './sp550-e2e-fork-setup.js';
import { applyBookSwitch, bookSwitch, parseManifestPins, upgradeBookProblems } from './sp550-pin-fill-core.js';
import { forkAddressSetFromDeployLive, forkAddressSetProblems, isAnvilClient } from './sp550-deploylive-fork.js';
import { createHash } from 'crypto';
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
        // The bundler is always this machine's; a fork RPC elsewhere (SP's acceptance fork) must prove it is anvil, below.
        if (!isLoopback(cfg.bundlerUrl)) refuse('mode fork: the bundler must be loopback');
        if (!rpcUrls.every(isLoopback) && cfg.gate?.deployLiveConfig === undefined) refuse('mode fork: every RPC must be loopback (a non-loopback anvil fork is accepted only with gate.deployLiveConfig)');
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
    if (cfg.mode !== 'fork' && cfg.gate?.deployLiveConfig !== undefined) refuse('gate.deployLiveConfig is fork-only: a live run is held to the read-back gate and the SDK pins');
    if (cfg.gate?.deployLiveConfig !== undefined && (cfg.gate?.pinsFile !== undefined || cfg.gate?.switchBook !== undefined)) refuse('gate.deployLiveConfig replaces gate.pinsFile / gate.switchBook: give one input');
    if (cfg.taskPlan !== undefined && cfg.taskToken !== undefined) refuse('taskPlan and taskToken: T comes from one of them, never both');
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
    let forkSet: ReturnType<typeof forkAddressSetFromDeployLive> | undefined;
    if (cfg.gate?.deployLiveConfig !== undefined) {
        // Joint fork rehearsal (DSR): SP's acceptance fork. Every RPC must be an anvil fork of the network's chain.
        for (const url of rpcUrls) {
            const c = createPublicClient({ transport: http(url) });
            const cv = await c.request({ method: 'web3_clientVersion' } as never).catch(() => undefined);
            if (!isLoopback(url) && !isAnvilClient(cv)) refuse(`mode fork: ${new URL(url).host} is not loopback and does not report an anvil client (${String(cv)})`);
            const id = await c.getChainId();
            if (id !== net.chainId) refuse(`mode fork: ${new URL(url).host} reports chain ${id}, not ${net.network} (${net.chainId})`);
        }
        let dl: Record<string, unknown>;
        try { dl = JSON.parse(fs.readFileSync(cfg.gate.deployLiveConfig, 'utf8')); } catch (e) { return refuse(`gate.deployLiveConfig: ${(e as Error).message}`); }
        forkSet = forkAddressSetFromDeployLive(dl, (CANONICAL_ADDRESSES as Record<number, any>)[net.chainId] ?? {});
        const problems = await forkAddressSetProblems(createPublicClient({ transport: http(rpcUrls[0]) }) as any, forkSet);
        if (problems.length) {
            for (const x of problems) console.error(`  fork ❌ ${x}`);
            refuse('the DeployLive config does not hold on this fork');
        }
        console.log(`=== FORK REHEARSAL: addresses from the DeployLive config (commit ${forkSet.provenance.commit ?? '(none)'}, srcHash ${forkSet.provenance.srcHash || '(none)'}), held to the fork checks — NOT the read-back gate; not live data ===`);
        if (forkSet.notDeployed.length) console.log(`  not deployed (zero in the set): ${forkSet.notDeployed.join(', ')}`);
    } else {
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
    }
    // The SuperPaymaster the gate just passed: the --pins file, else the network's pin table — the
    // same source the gate read, so the E2E cannot drift onto an address the read-back did not check.
    // By network (sp550PinsFor), so sepolia-rc8 reads its own coexisting entry, never the chain's other stack.
    const pinned = forkSet ? { superPaymaster: forkSet.addresses.superPaymaster } : pins ?? sp550PinsFor(net.network).pins;
    const deployment = net.network;
    const sp = getAddress(requireDeployedAddress(pinned as Record<string, unknown> | undefined, 'superPaymaster', deployment));
    // The SDK hashes the op with client.chain.id, so the clients carry the network's chain, and the
    // sending RPC must report that chain id (an anvil fork keeps the forked chain's id).
    const chain = extractChain({ chains: [sepolia, optimismSepolia, optimism], id: net.chainId as 11155111 | 11155420 | 10 });
    if (!chain) fail(`no viem chain for chain id ${net.chainId}`);
    const pub = createPublicClient({ chain, transport: http(rpcUrls[0]) });
    const rpcChainId = await pub.getChainId();
    if (rpcChainId !== net.chainId) refuse(`${rpcUrls[0]} reports chain ${rpcChainId}, not ${net.network} (${net.chainId})`);
    // Every address this run signs, sends or encodes goes through requireDeployedAddress (zero / missing -> refused).
    const ep = requireDeployedAddress({ entryPoint: await pub.readContract({ address: sp, abi: SuperPaymasterV550ABI, functionName: 'entryPoint' }) }, 'entryPoint', `${deployment} SP.entryPoint()`);
    const registry = requireDeployedAddress({ registry: await pub.readContract({ address: sp, abi: SuperPaymasterV550ABI, functionName: 'REGISTRY' }) }, 'registry', `${deployment} SP.REGISTRY()`);
    // operators(): (aPNTsBalance, isConfigured, isPaused, xPNTsToken, reputation, minTxInterval, …)
    const opCfg = (await pub.readContract({ address: sp, abi: SuperPaymasterV550ABI, functionName: 'operators', args: [operator] })) as readonly any[];
    if (!opCfg[1] || opCfg[2]) refuse(`operator ${operator} is not configured or is paused on ${sp}`);
    const token = getAddress(requireDeployedAddress({ xPNTsToken: opCfg[3] }, 'xPNTsToken', `${deployment} operators(${operator})`));
    const minTxInterval = BigInt(opCfg[5]);
    console.log(`SP ${sp} · EntryPoint ${ep} · operator ${operator} · token ${token} · minTxInterval ${minTxInterval}s · bundler ${new URL(cfg.bundlerUrl).host}`);
    // The postOp floor the SDK applies is read live (gasParams().minPostOpGas); the release tuple sets it
    // (rc.8: 500,000 — DSR). expectMinPostOpGas holds the chain to that value; it is required, since an
    // optional expectation is a check a config can silently drop.
    if (typeof cfg.expectMinPostOpGas !== 'string' || !/^[1-9][0-9]*$/.test(cfg.expectMinPostOpGas)) {
        refuse('expectMinPostOpGas must be set to the release tuple\'s minPostOpGas as a positive decimal string (rc.8: "500000")');
    }
    const expectMinPostOpGas = BigInt(cfg.expectMinPostOpGas);
    if (typeof cfg.expectMinTxInterval !== 'string' || !/^[0-9]+$/.test(cfg.expectMinTxInterval)) {
        refuse('expectMinTxInterval must be the operator\'s minTxInterval in seconds as a decimal string (the paper cells: "60")');
    }
    // SP's three-arm plan (DSR): pinned by its sha256; its chain and SuperPaymaster must be this run's, its T is used,
    // and the call this run sends must be byte-equal to its taskCallData (checked once the call is built).
    let plan: { T: Address; taskCallData: Hex; commit?: string } | undefined;
    if (cfg.taskPlan !== undefined) {
        const { file: planFile, sha256 } = cfg.taskPlan ?? {};
        if (typeof planFile !== 'string' || typeof sha256 !== 'string' || !/^[0-9a-f]{64}$/i.test(sha256)) refuse('taskPlan needs { file, sha256 (64 hex) }');
        const raw = fs.readFileSync(planFile, 'utf8');
        const got = createHash('sha256').update(raw).digest('hex');
        if (got.toLowerCase() !== sha256.toLowerCase()) refuse(`taskPlan ${planFile}: sha256 ${got} != the given ${sha256}`);
        const sh = JSON.parse(raw)?.shared ?? {};
        if (Number(sh.chainId) !== net.chainId) refuse(`taskPlan: shared.chainId ${sh.chainId} != ${net.network} (${net.chainId})`);
        if (!isAddress(String(sh.T)) || !/^0x[0-9a-fA-F]*$/.test(String(sh.taskCallData))) refuse('taskPlan: shared.T / shared.taskCallData missing or malformed');
        plan = { T: getAddress(sh.T), taskCallData: sh.taskCallData as Hex, commit: sh.commit, SP: sh.SP } as any;
    }
    const taskToken = plan ? plan.T : cfg.taskToken === undefined ? undefined : getAddress(requireDeployedAddress({ taskToken: cfg.taskToken }, 'taskToken', 'config'));
    const FIELDS = ['verificationGasLimit', 'callGasLimit', 'preVerificationGas', 'paymasterVerificationGasLimit', 'paymasterPostOpGasLimit'] as const;
    let frozenGas: Record<(typeof FIELDS)[number], bigint> | undefined;
    if (cfg.frozenGas !== undefined) {
        const f = cfg.frozenGas ?? {};
        const bad = FIELDS.filter((k) => typeof f[k] !== 'string' || !/^[1-9][0-9]*$/.test(f[k]));
        if (bad.length || Object.keys(f).some((k) => !(FIELDS as readonly string[]).includes(k))) refuse(`frozenGas needs exactly the five limits as positive decimal strings (bad or missing: ${bad.join(', ') || 'unknown keys'})`);
        frozenGas = Object.fromEntries(FIELDS.map((k) => [k, BigInt(f[k])])) as any;
    }
    const gasLimitCoefficientBps = cfg.gasLimitCoefficientBps === undefined ? undefined : BigInt(cfg.gasLimitCoefficientBps);
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
    // C7 (DSR): SP's three-arm setup provides these (SBT via safeMintForRole, X and T minted, minTxInterval 60); the
    // SDK only checks and reports what is missing — it sends no operator- or community-side transaction.
    const sbt = requireDeployedAddress({ MYSBT: await pub.readContract({ address: registry, abi: RegistryABI, functionName: 'MYSBT' }) }, 'MYSBT', `${deployment} Registry.MYSBT()`);
    if (BigInt(await pub.readContract({ address: sbt, abi: MySBTABI, functionName: 'balanceOf', args: [account] }) as bigint) === 0n) missing.push('SBT (Registry.MYSBT().balanceOf(account) > 0)');
    if (taskToken && BigInt(await pub.readContract({ address: taskToken, abi: ERC20ABI, functionName: 'balanceOf', args: [account] }) as bigint) === 0n) missing.push(`task token T ${taskToken} balance`);
    if (minTxInterval !== BigInt(cfg.expectMinTxInterval)) missing.push(`operators(${operator}).minTxInterval == ${cfg.expectMinTxInterval} (is ${minTxInterval})`);
    if ((await pub.getBalance({ address: base.address })) === 0n) missing.push(`ETH on the user's EOA ${base.address} (C12 sends its own handleOps)`);
    {
        const { createEndUserClient } = await import('@aastar/sdk');
        const eu: any = createEndUserClient({ chain, transport: http(rpcUrls[0]), account: base as any, addresses: { superPaymaster: sp, entryPoint: ep } as any });
        const predicted = (await eu.createSmartAccount({ owner: base.address })).accountAddress as Address;
        if (getAddress(predicted) !== account) missing.push(`C12's account (createSmartAccount(owner) = ${predicted}) == config.account ${account}`);
    }
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
    /** One row's gas record (B5/B6): the limits sent with their per-field source, the fees and their source. */
    const gasRow = (d: GasDecision | undefined) => d === undefined ? 'gas=(no decision reported)'
        : `gas=${FIELDS.map((k) => `${k}:${d.limits[k]}(${d.limitSources[k]})`).join(',')} limitsSource=${d.limitsSource}` +
          `${d.coefficientBps !== undefined ? ` coefficientBps=${d.coefficientBps}` : ''} maxFee=${d.fees.maxFeePerGas} priority=${d.fees.maxPriorityFeePerGas} feeSource=${d.fees.source}` +
          `${d.feesRaisedByBundler ? ' feesRaisedByBundler' : ''}`;
    const submitOpts = (onGasDecided: (d: GasDecision) => void) => ({ operator, onGasDecided, ...(frozenGas ? { frozenGas } : {}), ...(gasLimitCoefficientBps !== undefined ? { gasLimitCoefficientBps } : {}) });
    const op = async (label: string, callData: Hex, o: { spaced?: boolean } = {}) => {
        if (o.spaced !== false) await spaced();
        SuperPaymasterInflightGuard.clearAll();
        signs = 0;
        const before = await state();
        const first = bundlerCalls.length;
        let decision: GasDecision | undefined;
        // No superPaymasterFlags: SP_RENEW is the SDK's per-op decision, which is what is under test.
        let opHash: Hex;
        try {
            opHash = (await PaymasterClient.submitGaslessUserOperation(pub as any, userWallet as any, account, ep, sp, ZERO, cfg.bundlerUrl, callData, submitOpts((d) => { decision = d; }))) as Hex;
        } catch (e: any) {
            // B5 (DSR): a bundler rejection (e.g. an efficiency check) is reported with its reason and the numbers.
            result(`${label}: REJECTED before inclusion — ${String(e?.shortMessage ?? e?.message ?? e).slice(0, 300)} · ${gasRow(decision)}`);
            throw e;
        }
        lastSent = Date.now();
        const submitted = bundlerCalls.slice(first);
        const signsForOp = signs;
        const rc = await receipt(opHash);
        const txHash = rc.receipt?.transactionHash as Hex;
        const { flags, postOpGasLimit } = await onChainOp(txHash, BigInt(rc.nonce));
        const logs = (rc.receipt?.logs ?? []) as any[];
        // Efficiency (B5): the bundler's own check compares actual use with the limits it was given.
        const actualGasUsed = BigInt(rc.actualGasUsed ?? 0);
        const limitSum = decision ? FIELDS.reduce((t, k) => t + decision!.limits[k], 0n) : 0n;
        const efficiency = limitSum > 0n ? Number((actualGasUsed * 10_000n) / limitSum) / 10_000 : NaN;
        const renewedInline = logs.some((l) => isSpRelayedRenewal(l, xPNTsTokenV2ABI as Abi, { token, user: account, sp }));
        const after = await state();
        const estimates = submitted.filter((c) => c.method === 'eth_estimateUserOperationGas').length;
        const sends = submitted.filter((c) => c.method === 'eth_sendUserOperation');
        result(`${label}: success=${rc.success} S_user signMessage=${signsForOp} estimates=${estimates} (placeholder sig) sends=${sends.length} ` +
            `flags=0x${flags.toString(16).padStart(2, '0')} (SDK-selected) ` +
            `allowance used ${before.used}->${after.used}/${after.cap} autoRenewUsed ${before.renewUsed}->${after.renewUsed} ` +
            `AllowanceRenewed(bySP)=${renewedInline} postOpGasLimit=${postOpGasLimit} actualGasUsed=${actualGasUsed} efficiency=${efficiency} · ${gasRow(decision)} · tx ${txHash}`);
        if (decision === undefined) fail(`${label}: the SDK reported no gas decision (onGasDecided) for a sent op`);
        if (frozenGas && FIELDS.some((k) => decision!.limits[k] !== frozenGas![k])) fail(`${label}: frozenGas was not used verbatim (${gasRow(decision)})`);
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
        return { flags, renewedInline, before, after, txHash, decision };
    };
    // The task call: SP's three-arm execute(T, 0, transfer(0x…dEaD, 1)) when T is configured, else a no-op call.
    const DEAD = '0x000000000000000000000000000000000000dEaD' as Address;
    const noop = taskToken
        ? encodeFunctionData({ abi: SimpleAccountABI, functionName: 'execute', args: [taskToken, 0n, encodeFunctionData({ abi: ERC20ABI, functionName: 'transfer', args: [DEAD, 1n] })] })
        : encodeFunctionData({ abi: SimpleAccountABI, functionName: 'execute', args: [operator, 0n, '0x'] });
    if (plan) {
        if (!(plan as any).SP || getAddress((plan as any).SP) !== sp) refuse(`taskPlan: shared.SP ${(plan as any).SP} is not this run's SuperPaymaster ${sp}`);
        if (noop.toLowerCase() !== plan.taskCallData.toLowerCase()) refuse('taskPlan: this run\'s call is not byte-equal to shared.taskCallData');
        console.log(`task plan: T ${plan.T}, taskCallData byte-equal, plan commit ${plan.commit ?? '(none)'}`);
    }

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

        // ---- 4r. S1r (D9): a second op straight after S1, inside minTxInterval ----
        // The bundler must refuse it as not yet valid (-32503); the SDK neither waits nor retries: one send.
        {
            const first = bundlerCalls.length;
            SuperPaymasterInflightGuard.clearAll();
            signs = 0;
            let rejected: unknown;
            try { await PaymasterClient.submitGaslessUserOperation(pub as any, userWallet as any, account, ep, sp, ZERO, cfg.bundlerUrl, noop, submitOpts(() => {})); }
            catch (e) { rejected = e; }
            const sends = bundlerCalls.slice(first).filter((c) => c.method === 'eth_sendUserOperation').length;
            const elapsed = Math.round((Date.now() - lastSent) / 1000);
            result(`S1r second op ${elapsed}s after S1 (minTxInterval ${minTxInterval}s): ${rejected instanceof UserOperationNotYetValidError ? `rejected -32503 not valid yet${(rejected as UserOperationNotYetValidError).secondsToWait !== undefined ? ` (wait ${(rejected as UserOperationNotYetValidError).secondsToWait}s)` : ''}` : rejected ? `rejected otherwise: ${String((rejected as any)?.message ?? rejected).slice(0, 200)}` : 'ACCEPTED'} · sends=${sends} S_user signMessage=${signs}`);
            if (!(rejected instanceof UserOperationNotYetValidError)) fail('S1r: the second op inside minTxInterval was not refused as not yet valid (-32503)');
            if (sends !== 1) fail(`S1r: ${sends} eth_sendUserOperation calls; the SDK must not retry a not-yet-valid op`);
            if (signs !== 1) fail(`S1r: signMessage ${signs} times; one signature for the one send`);
            lastSent = Date.now(); // the next op waits a full interval
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

        // ---- 6. C12: createEndUserClient().executeGasless, self-bundled handleOps from the user's EOA (paid in ETH) ----
        await spaced();
        SuperPaymasterInflightGuard.clearAll();
        signs = 0;
        {
            const { createEndUserClient } = await import('@aastar/sdk');
            const c0 = await state();
            const eth0 = await pub.getBalance({ address: base.address });
            const eu: any = createEndUserClient({ chain, transport: http(rpcUrls[0]), account: user as any, addresses: { superPaymaster: sp, entryPoint: ep } as any });
            // D14 (DSR): the limits are this bundler's estimate x the coefficient (or frozenGas, explicit), the EOA sends
            // handleOps with the node's eth_estimateGas x the coefficient; the decision is recorded like every other row.
            let c12: any;
            const tx = (await eu.executeGasless({
                target: taskToken ?? operator, data: taskToken ? encodeFunctionData({ abi: ERC20ABI, functionName: 'transfer', args: [DEAD, 1n] }) : '0x', operator,
                estimateBundlerUrl: cfg.bundlerUrl, ...(frozenGas ? { gas: frozenGas } : {}), ...(gasLimitCoefficientBps !== undefined ? { gasLimitCoefficientBps } : {}),
                onGasDecided: (d: any) => { c12 = d; },
            })) as Hex;
            const rc = await pub.waitForTransactionReceipt({ hash: tx });
            let ev: any;
            for (const l of rc.logs as any[]) { try { const d: any = decodeEventLog({ abi: EntryPointABI as Abi, data: l.data, topics: l.topics }); if (d.eventName === 'UserOperationEvent' && getAddress(d.args.sender) === account) ev = d.args; } catch { /* other logs */ } }
            const c1 = await state();
            const eth1 = await pub.getBalance({ address: base.address });
            const c12Gas = c12 === undefined ? 'gas=(no decision reported)'
                : `gas=${FIELDS.map((k) => `${k}:${c12.limits[k]}(${c12.limitSources[k]})`).join(',')} coefficientBps=${c12.coefficientBps} maxFee=${c12.fees.maxFeePerGas} priority=${c12.fees.maxPriorityFeePerGas} feeSource=${c12.fees.source} handleOpsGas:${c12.handleOps.gasLimit}(estimate ${c12.handleOps.estimate})`;
            result(`C12 createEndUserClient().executeGasless: tx ${rc.status} from ${rc.from} UserOperationEvent.success=${ev?.success} actualGasUsed=${ev?.actualGasUsed} · user xPNTs -${c0.bal - c1.bal} · EOA ETH -${eth0 - eth1} · S_user signMessage=${signs} · handleOps gasUsed=${rc.gasUsed} · ${c12Gas} · tx ${tx}`);
            if (c12 === undefined) fail('C12: executeGasless reported no gas decision');
            if (rc.status !== 'success' || ev?.success !== true) fail('C12: the self-bundled op did not succeed');
            if (getAddress(rc.from) !== getAddress(base.address)) fail(`C12: handleOps was sent by ${rc.from}, not the user's EOA`);
            if (signs !== 1) fail(`C12: signMessage ${signs} times; one signature for the op`);
            if (!(c1.bal < c0.bal)) fail('C12: the user was not charged in xPNTs (not sponsored)');
            lastSent = Date.now();
        }
    } finally {
        // fail() exits the process; this covers the normal path and a thrown error.
        untapBundler();
    }
    console.log('\nPASS');
}

main().catch((e) => fail(String(e?.shortMessage ?? e?.message ?? e)));
