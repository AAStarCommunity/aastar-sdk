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
 *     "c12Caps": { "maxGas": "1500000", "maxFeePerGasWei": "5000000000" },  // required: C12's handleOps tx bounds (EOA spend <= product)
 *     "forkSetup"?: { "simpleAccountFactory": "0x…", "salt"?: 0 },  // --fork-setup, when the account has no code yet
 *     "expectGasParams": { "minPostOpGas": "500000", "settleGasBound": "450000", "cWrap": "5000", "cPostop": "450000" },
 *                                            // required: SP.gasParams() must equal the release tuple, field by field
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
 * Threat model (DSR 2026-11-19; the reviews hold the script to it):
 *   defended — the author's / operator's honest misconfiguration (network, key, RPC, bundler, fork / live mixed up);
 *   chain state changing between the read-back gate and a signature (upgrade, rewiring, operator / account / floor
 *   changes: re-read at one block right before every signature); the SDK's own retries and estimate drift (one
 *   signature per op, no direct-send fallback, no local-default gas); assertions that must fail the run when the
 *   behaviour is wrong. A public / anvil-derived key never signs on a real chain.
 *   not defended — an adversary controlling this process, a local RPC proxy or the local bundler.
 *   Run precondition (not a code property): an upgrade between the last check and inclusion is covered by the
 *   deployment's upgrade freeze — SuperPaymaster's 48 h timelock gives that window; every live row records its check
 *   block and its inclusion block, so the interval can be read back afterwards for upgrade events.
 *
 * Exit 2 = refused before sending; 1 = something sent or read back wrong; 0 = all assertions held.
 */
import * as fs from 'fs';
import { createServer } from 'http';
import { spawn, type ChildProcess } from 'child_process';
import {
    type Abi, type Address, type Hex, createPublicClient, createWalletClient, decodeFunctionData,
    decodeEventLog, encodeFunctionData, extractChain, getAddress, http, isAddress, keccak256, toHex,
} from 'viem';
import { optimism, optimismSepolia, sepolia } from 'viem/chains';
import { mnemonicToAccount } from 'viem/accounts';
import {
    CANONICAL_ADDRESSES, ERC20ABI, EntryPointABI, MySBTABI, RegistryABI, SimpleAccountABI, SuperPaymasterV550ABI, xPNTsTokenV2ABI, resolveSp550Network,
    SUPER_PAYMASTER_FLAGS, SUPER_PAYMASTER_PMD_OFFSETS, requireDeployedAddress, sp550PinsFor,
} from '@aastar/core';
import { PaymasterClient, SuperPaymasterInflightGuard, UserOperationNotYetValidError, type GasDecision } from '@aastar/paymaster';
import { runSp550CutoverGate, type GateRpc } from '../packages/core/src/sp550CutoverGate.js';
import { isPublicTestAccount, liveKeySourceProblem, loadLiveSigner } from './sp550-live-signer.js';
import { liveSignerApprovalProblem } from './sp550-live-approved-signers.js';
import { forkSetup } from './sp550-e2e-fork-setup.js';
import { applyBookSwitch, bookSwitch, parseManifestPins, upgradeBookProblems } from './sp550-pin-fill-core.js';
import { forkAddressSetFromDeployLive, forkAddressSetProblems, isAnvilClient } from './sp550-deploylive-fork.js';
import { createHash } from 'crypto';
import { gasSourceClient, redactUrls, signC12Transaction, type C12SignState, isSpRelayedRenewal, opSigningProblems, renewalConsistencyProblems, tapBundler, type BundlerCall } from './sp550-e2e-checks.js';

const ZERO = '0x0000000000000000000000000000000000000000' as Address;
const ANVIL_MNEMONIC = 'test test test test test test test test test test test junk';
const ROLE_ENDUSER = keccak256(toHex('ENDUSER'));
const MODE_SP_K = 0;

const args = process.argv.slice(2);
const arg = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
// L1 (Daybreak): no configured RPC / bundler URL reaches stdout, stderr or the tee'd log (redactUrls, checks module).
function installUrlRedaction(urls: readonly string[]) {
    const scrub = (v: unknown): unknown => typeof v === 'string' ? redactUrls(v, urls)
        : v instanceof Error ? redactUrls(String(v.stack ?? v.message), urls) : v;
    for (const k of ['log', 'error', 'warn', 'info'] as const) {
        const orig = console[k].bind(console);
        console[k] = (...a: unknown[]) => orig(...a.map(scrub));
    }
}
/** M3 (Daybreak): a child's environment without the fork source (SP550_FORK_URL usually carries a provider key). */
const childEnv = (env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv => {
    const { SP550_FORK_URL: _drop, ...rest } = env;
    return rest;
};
const refuse = (m: string): never => { console.error(`refused: ${m}`); process.exit(2); };
const fail = (m: string): never => { console.error(`❌ ${m}`); process.exit(1); };
const result = (line: string) => console.log(`RESULT ${line}`);
const isLoopback = (u: string) => { try { return ['127.0.0.1', 'localhost', '[::1]'].includes(new URL(u).hostname); } catch { return false; } };

let forkBundler: ChildProcess | undefined;
const stopForkBundler = () => { try { forkBundler?.kill('SIGTERM'); } catch { /* gone */ } forkBundler = undefined; };
process.on('exit', stopForkBundler);
/** Mode fork: a fresh Alto bound to the verified fork RPC on a free loopback port (executor / utility: anvil keys 2 and 3, funded on the fork). */
async function startForkBundler(rpc: string, entryPoint: Address, pub: any): Promise<string> {
    const port = await new Promise<number>((ok) => { const srv = createServer(); srv.listen(0, '127.0.0.1', () => { const p = (srv.address() as any).port; srv.close(() => ok(p)); }); });
    const acct = (i: number) => mnemonicToAccount(ANVIL_MNEMONIC, { addressIndex: i });
    for (const i of [2, 3]) await pub.request({ method: 'anvil_setBalance', params: [acct(i).address, '0x56BC75E2D63100000'] });
    const key = (i: number) => toHex(acct(i).getHdKey().privateKey!);
    forkBundler = spawn('pnpm', ['dlx', '@pimlico/alto', '--entrypoints', entryPoint, '--rpc-url', rpc, '--port', String(port),
        '--executor-private-keys', key(2), '--utility-private-key', key(3), '--safe-mode', 'false',
        '--min-entity-stake', '0', '--min-entity-unstake-delay', '86400'], { stdio: 'ignore', env: childEnv() });
    const url = `http://127.0.0.1:${port}`;
    for (let i = 0; i < 180; i++) {
        try {
            const r = await (await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_supportedEntryPoints', params: [] }), signal: AbortSignal.timeout(5_000) })).json();
            if (JSON.stringify(r.result ?? []).toLowerCase().includes(entryPoint.toLowerCase())) { console.log(`fork bundler: this run's own Alto on ${url}, bound to the verified fork RPC`); return url; }
        } catch { /* not up yet */ }
        await new Promise((ok) => setTimeout(ok, 1000));
    }
    stopForkBundler();
    return fail('fork bundler: Alto did not start');
}

async function main() {
    // ---- 1. usage ----
    const file = arg('--config') ?? refuse('--config <run.json> is required');
    const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
    let net: ReturnType<typeof resolveSp550Network>;
    try { net = resolveSp550Network(cfg.network); } catch (e: any) { return refuse(e.message); }
    const rpcUrls: string[] = Array.isArray(cfg.rpcUrls) ? cfg.rpcUrls : [];
    if (rpcUrls.length === 0 || typeof cfg.bundlerUrl !== 'string') refuse('config needs rpcUrls[] and bundlerUrl');
    installUrlRedaction([...rpcUrls, cfg.bundlerUrl, ...(process.env.SP550_FORK_URL ? [process.env.SP550_FORK_URL] : [])].filter((u) => typeof u === 'string'));
    if (cfg.mode === 'fork') {
        // The run starts its own bundler, bound to the verified fork RPC (a configured bundler could point at a real chain,
        // where a public-key signature over the same chain id / EntryPoint / account would be valid).
        if (cfg.bundlerUrl !== 'self') refuse('mode fork: bundlerUrl must be "self" (the run starts its own bundler on the verified fork)');
        if (!rpcUrls.every(isLoopback) && cfg.gate?.deployLiveConfig === undefined) refuse('mode fork: every RPC must be loopback (a non-loopback anvil fork is accepted only with gate.deployLiveConfig)');
        // A loopback URL is not proof of a fork (a local proxy can front a real chain): every RPC must ALSO prove it is anvil, below.
        if (cfg.userKey?.anvilIndex === undefined) refuse('mode fork: userKey must be { anvilIndex } (anvil\'s public mnemonic)');
    } else if (cfg.mode === 'live') {
        if (arg('--live-go') !== net.network) refuse(`mode live sends real ops: pass --live-go ${net.network} (the author's go for this network)`);
        const problem = liveKeySourceProblem(cfg.userKey);
        if (problem) refuse(problem);
        // The author's signer address, typed on the command line and repeated in the config: two sources, one address.
        const ls = arg('--live-signer');
        if (!ls || !isAddress(ls)) refuse('mode live: pass --live-signer <the author\'s signer address> (it must equal config.expectSigner)');
    } else refuse('config.mode must be "fork" or "live"');
    // Fork-only switches are refused here, before anything is read from a network.
    if (cfg.mode !== 'fork' && args.includes('--fork-setup')) refuse('--fork-setup impersonates accounts: mode fork only');
    // Preflight reads and reports only; --fork-setup writes (impersonated community transactions): never together.
    if (args.includes('--preflight') && args.includes('--fork-setup')) refuse('--preflight reads only; run --fork-setup as its own step');
    if (cfg.mode !== 'fork' && cfg.gate?.pinsFile !== undefined) refuse('gate.pinsFile is fork-only: a live run is held against the pins the SDK ships with');
    if (cfg.mode !== 'fork' && cfg.gate?.switchBook !== undefined) refuse('gate.switchBook is fork-only: a live run is held against the SDK book it ships with');
    if (cfg.mode !== 'fork' && cfg.gate?.deployLiveConfig !== undefined) refuse('gate.deployLiveConfig is fork-only: a live run is held to the read-back gate and the SDK pins');
    if (cfg.gate?.deployLiveConfig !== undefined && (cfg.gate?.pinsFile !== undefined || cfg.gate?.switchBook !== undefined)) refuse('gate.deployLiveConfig replaces gate.pinsFile / gate.switchBook: give one input');
    if (cfg.taskPlan !== undefined && cfg.taskToken !== undefined) refuse('taskPlan and taskToken: T comes from one of them, never both');
    if (cfg.gate?.bookOverrides !== undefined) refuse('gate.bookOverrides is gone: use gate.switchBook, which derives the book from the pins exactly as pin-fill does');
    // H4: a live run is bound to the author's signer address (a blacklist cannot prove a key is private).
    if (cfg.mode === 'live' && (typeof cfg.expectSigner !== 'string' || !isAddress(cfg.expectSigner))) refuse('mode live: config.expectSigner (the author\'s signer address) is required');
    if (cfg.mode === 'live' && getAddress(arg('--live-signer')!) !== getAddress(cfg.expectSigner)) refuse('mode live: --live-signer and config.expectSigner name different addresses');
    // H3: a live run is gated at the finalized block only (a historical snapshot is not today's state).
    if (cfg.mode === 'live' && cfg.gate?.block !== undefined && cfg.gate.block !== 'finalized') refuse('mode live: gate.block must be "finalized" (or omitted)');
    // Daybreak H1: the guarantee is the committed, reviewed table of approved signers for this chain, not a key scan.
    if (cfg.mode === 'live') { const p = liveSignerApprovalProblem(net.chainId, cfg.expectSigner); if (p) refuse(p); }
    const operator = getAddress(cfg.operator ?? refuse('config.operator is required'));
    const account = getAddress(cfg.account ?? refuse('config.account is required'));
    // A spending bound: a finite integer 1..32, validated before anything is read or signed.
    const maxOps = cfg.maxOps === undefined ? 8 : Number(cfg.maxOps);
    if (!Number.isSafeInteger(maxOps) || maxOps < 1 || maxOps > 32) refuse(`maxOps must be an integer from 1 to 32 (got ${JSON.stringify(cfg.maxOps)})`);
    // M1: the release gasParams tuple, shape-checked before anything is read (compared with the snapshot below).
    if (cfg.expectMinPostOpGas !== undefined) refuse('expectMinPostOpGas is replaced by expectGasParams { minPostOpGas, settleGasBound, cWrap, cPostop }');
    const GP_KEYS = ['minPostOpGas', 'settleGasBound', 'cWrap', 'cPostop'] as const;
    const eg = cfg.expectGasParams ?? {};
    if (GP_KEYS.some((k) => typeof eg[k] !== 'string' || !/^[1-9][0-9]*$/.test(eg[k])) || Object.keys(eg).some((k) => !(GP_KEYS as readonly string[]).includes(k))) {
        refuse('expectGasParams must give exactly minPostOpGas, settleGasBound, cWrap, cPostop as positive decimal strings (rc.8: "500000", "450000", "5000", "450000")');
    }
    // M2: C12's own transaction is bounded by explicit caps, validated before anything is read or signed.
    const capOf = (v: unknown, name: string): bigint => (typeof v === 'string' && /^[1-9][0-9]{0,30}$/.test(v) ? BigInt(v) : refuse(`c12Caps.${name} must be a positive decimal string (got ${JSON.stringify(v)})`));
    const c12Caps = { maxGas: capOf(cfg.c12Caps?.maxGas, 'maxGas'), maxFeePerGas: capOf(cfg.c12Caps?.maxFeePerGasWei, 'maxFeePerGasWei') };

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
    if (cfg.mode === 'fork') {
        // Mode fork signs with a public key and needs no --live-go: every RPC, loopback or not, must answer as anvil
        // (client version AND anvil_nodeInfo, which a real node does not serve) on the network's chain id. Residual: a
        // local bundler pointed at a real chain is not detected here; the bundler is this machine's own (loopback).
        for (const url of rpcUrls) {
            const c = createPublicClient({ transport: http(url) });
            const cv = await c.request({ method: 'web3_clientVersion' } as never).catch(() => undefined);
            const info = await c.request({ method: 'anvil_nodeInfo' } as never).catch(() => undefined);
            if (!isAnvilClient(cv) || info === null || typeof info !== 'object') refuse(`mode fork: ${new URL(url).host} does not prove it is anvil (client ${String(cv)}, anvil_nodeInfo ${info && typeof info === 'object' ? 'ok' : 'unavailable'})`);
            const id = await c.getChainId();
            if (id !== net.chainId) refuse(`mode fork: ${new URL(url).host} reports chain ${id}, not ${net.network} (${net.chainId})`);
        }
    }
    let forkSet: ReturnType<typeof forkAddressSetFromDeployLive> | undefined;
    if (cfg.gate?.deployLiveConfig !== undefined) {
        // Joint fork rehearsal (DSR): SP's acceptance fork (anvil proven above for every RPC).
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
    if (rpcChainId !== net.chainId) refuse(`RPC ${new URL(rpcUrls[0]).host} reports chain ${rpcChainId}, not ${net.network} (${net.chainId})`);
    // Every address this run signs, sends or encodes goes through requireDeployedAddress (zero / missing -> refused).
    const ep = requireDeployedAddress({ entryPoint: await pub.readContract({ address: sp, abi: SuperPaymasterV550ABI, functionName: 'entryPoint' }) }, 'entryPoint', `${deployment} SP.entryPoint()`);
    const registry = requireDeployedAddress({ registry: await pub.readContract({ address: sp, abi: SuperPaymasterV550ABI, functionName: 'REGISTRY' }) }, 'registry', `${deployment} SP.REGISTRY()`);
    // operators(): (aPNTsBalance, isConfigured, isPaused, xPNTsToken, reputation, minTxInterval, …)
    const opCfg = (await pub.readContract({ address: sp, abi: SuperPaymasterV550ABI, functionName: 'operators', args: [operator] })) as readonly any[];
    if (!opCfg[1] || opCfg[2]) refuse(`operator ${operator} is not configured or is paused on ${sp}`);
    const token = getAddress(requireDeployedAddress({ xPNTsToken: opCfg[3] }, 'xPNTsToken', `${deployment} operators(${operator})`));
    const minTxInterval = BigInt(opCfg[5]);
    // H3: what the gate certified, taken now and re-read before every signature: SuperPaymaster's implementation (ERC-1967
    // slot + its code hash), its EntryPoint / Registry wiring and the operator's token. Any change aborts before signing.
    // (An upgrade between the last check and inclusion is not closable off-chain: an operational upgrade freeze covers it.)
    const IMPL_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc' as const;
    // One block for every read of a snapshot (a change between two reads cannot mix two states).
    const wiring = async () => {
        const blockNumber = await pub.getBlockNumber();
        const at = { blockNumber } as const;
        const implOf = async (proxy: Address) => {
            const slot = await pub.getStorageAt({ address: proxy, slot: IMPL_SLOT, ...at });
            return slot && /^0x0{24}[0-9a-fA-F]{40}$/.test(slot) ? getAddress('0x' + slot.slice(-40)) : String(slot);
        };
        const codehash = async (a: string) => {
            if (!(a.startsWith('0x') && a.length === 42)) return '(no address)';
            const code = await pub.getCode({ address: a as Address, ...at });
            return code && code !== '0x' ? keccak256(code) : '(no code)';
        };
        const read = (address: Address, abi: any, functionName: string, args?: unknown[]) => pub.readContract({ address, abi, functionName, args, ...at } as any) as Promise<any>;
        const impl = await implOf(sp);
        const reg = getAddress(await read(sp, SuperPaymasterV550ABI, 'REGISTRY'));
        const regImpl = await implOf(reg);
        const o = (await read(sp, SuperPaymasterV550ABI, 'operators', [operator])) as readonly any[];
        const tkn = getAddress(o[3]);
        // M1 (Daybreak): gasParams at the same block, current tuple and the pending proposal, so a queued or executed
        // change between the gate and any signature aborts like any other wiring change.
        const [gpCur, gpPend] = (await read(sp, SuperPaymasterV550ABI, 'gasParams')) as readonly [any, any];
        const pick = (x: any, k: string, i: number) => String(x?.[k] ?? x?.[i]);
        return {
            blockNumber,
            operatorConfigured: Boolean(o[1]), operatorPaused: Boolean(o[2]), minTxInterval: BigInt(o[5]),
            accountOwner: String(await read(account, SimpleAccountABI, 'owner').catch(() => '(no account yet)')).toLowerCase(),
            renewalMode: Number(await read(tkn, xPNTsTokenV2ABI, 'renewalMode', [account]).catch(() => -1)),
            impl, implCodehash: await codehash(impl),
            extension: getAddress(await read(sp, SuperPaymasterV550ABI, 'EXTENSION')),
            entryPoint: getAddress(await read(sp, SuperPaymasterV550ABI, 'entryPoint')),
            registry: reg, registryImpl: regImpl, registryImplCodehash: await codehash(regImpl),
            token: getAddress(o[3]),
            gpMinPostOpGas: BigInt(pick(gpCur, 'minPostOpGas', 0)), gpSettleGasBound: BigInt(pick(gpCur, 'settleGasBound', 1)),
            gpCWrap: BigInt(pick(gpCur, 'cWrap', 2)), gpCPostop: BigInt(pick(gpCur, 'cPostop', 3)),
            gpPending: JSON.stringify(gpPend, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)),
        };
    };
    const gated = await wiring();
    // Held to what the read-back certified, directly (not only to the first read): implementation + code hash, the
    // extension, the Registry and its implementation, the EntryPoint.
    const P = (pinned ?? {}) as any;
    const certified: [keyof typeof gated, unknown][] = [
        ['impl', P.spImpl], ['implCodehash', P.spImplCodehash], ['extension', P.spAdminExtension],
        ['registry', P.addresses?.registry], ['registryImpl', P.registryImpl], ['entryPoint', ep],
    ];
    for (const [k, want] of certified) {
        if (want !== undefined && String(gated[k]).toLowerCase() !== String(want).toLowerCase()) refuse(`SP ${k} ${gated[k]} is not what the gate certified (${want})`);
    }
    // The token every encoded call and every precondition uses is the snapshot's (one read, not two).
    if (gated.token !== getAddress(token)) refuse(`the operator's token changed while it was being read (${token} -> ${gated.token})`);
    if (gated.registry !== getAddress(registry)) refuse('SP.REGISTRY() changed while it was being read');
    if (!gated.operatorConfigured || gated.operatorPaused) refuse(`operator ${operator} is not configured or is paused on ${sp}`);
    if (gated.minTxInterval !== minTxInterval) refuse('operators().minTxInterval changed while it was being read');
    let lastCheckBlock = gated.blockNumber;
    // M1: after inclusion, SP's gasParams in the inclusion block must equal the snapshot taken at signing.
    const settledUnderSnapshot = async (label: string, blockNumber: bigint) => {
        const [cur] = (await pub.readContract({ address: sp, abi: SuperPaymasterV550ABI, functionName: 'gasParams', blockNumber } as any)) as readonly [any, any];
        const pick = (k: string, i: number) => BigInt(String(cur?.[k] ?? cur?.[i]));
        const now = { gpMinPostOpGas: pick('minPostOpGas', 0), gpSettleGasBound: pick('settleGasBound', 1), gpCWrap: pick('cWrap', 2), gpCPostop: pick('cPostop', 3) };
        const off = (Object.keys(now) as (keyof typeof now)[]).filter((k) => now[k] !== gated[k]);
        if (off.length) fail(`${label}: SP.gasParams() in inclusion block ${blockNumber} differs from the snapshot taken at signing (${off.map((k) => `${k} ${gated[k]} -> ${now[k]}`).join('; ')})`);
    };
    const recheck = async (label: string) => {
        const now = await wiring();
        lastCheckBlock = now.blockNumber;
        const changed = (Object.keys(gated) as (keyof typeof gated)[]).filter((k) => k !== 'blockNumber' && String(now[k]).toLowerCase() !== String(gated[k]).toLowerCase());
        if (changed.length) fail(`${label}: refused before signing — SuperPaymaster changed since the gate (${changed.map((k) => `${k} ${gated[k]} -> ${now[k]}`).join('; ')})`);
    };
    console.log(`SP ${sp} · EntryPoint ${ep} · operator ${operator} · token ${token} · minTxInterval ${minTxInterval}s · bundler ${cfg.mode === 'fork' ? '(this run\'s own, on the fork)' : new URL(cfg.bundlerUrl).host}`);
    // M1 (Daybreak): SP's whole gasParams() tuple is held to the release tuple (rc.8: 500k / 450k / 5k / 450k,
    // SuperPaymasterStorage.sol:232), required field by field (an optional expectation is a check a config can drop).
    const snapGp = { minPostOpGas: gated.gpMinPostOpGas, settleGasBound: gated.gpSettleGasBound, cWrap: gated.gpCWrap, cPostop: gated.gpCPostop };
    const offGp = GP_KEYS.filter((k) => snapGp[k] !== BigInt(eg[k]));
    if (offGp.length) refuse(`SP.gasParams() is not the release tuple at block ${gated.blockNumber} (${offGp.map((k) => `${k} ${snapGp[k]} != ${eg[k]}`).join('; ')})`);
    // The floor every check below uses is the snapshot's (equal to the release tuple, re-checked before every signature).
    const expectMinPostOpGas = snapGp.minPostOpGas;
    if (typeof cfg.expectMinTxInterval !== 'string' || !/^[1-9][0-9]*$/.test(cfg.expectMinTxInterval)) {
        refuse('expectMinTxInterval must be the operator\'s minTxInterval in seconds as a positive decimal string (S1r needs one; the paper cells: "60")');
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
    console.log(`SP gasParams @ block ${gated.blockNumber}: ${GP_KEYS.map((k) => `${k} ${snapGp[k]}`).join(' · ')} (= expectGasParams) · pending ${gated.gpPending}`);
    // Gas source (DSR): every op's gas comes from this bundler's eth_estimateUserOperationGas against its
    // own node — never from a local forge simulation. Recorded as the host and the client it reports
    // (the full URL usually embeds a key and is never printed).
    // An unreachable bundler, a non-2xx answer, a non-JSON-RPC body, or any JSON-RPC error other than
    // method-not-found (-32601: the method is optional) fails here — an auth / rate-limit / internal error
    // is not a usable gas source (Codex r4).
    const checkGasSource = async (url: string) => {
        const bundlerHost = new URL(url).host;
        let bundlerReply: any;
        try {
            const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'web3_clientVersion', params: [] }), signal: AbortSignal.timeout(15_000) });
            if (!res.ok) return fail(`GAS SOURCE: bundler ${bundlerHost} answered HTTP ${res.status}`);
            bundlerReply = await res.json();
        } catch (e: any) { return fail(`GAS SOURCE: bundler ${bundlerHost} did not answer JSON-RPC (${e?.name ?? 'error'})`); }
        const bundlerClient = gasSourceClient(bundlerReply);
        if (bundlerClient === undefined) fail(`GAS SOURCE: bundler ${bundlerHost} did not give a client version or method-not-found (error ${JSON.stringify(bundlerReply?.error?.code ?? null)})`);
        console.log(`GAS SOURCE: eth_estimateUserOperationGas on bundler ${bundlerHost} (client ${bundlerClient}); the SDK estimates nothing locally`);
    };
    // Mode fork starts its own bundler only for a real run (after preflight): preflight neither spawns nor funds anything.
    let bundlerUrl = cfg.mode === 'fork' ? '' : cfg.bundlerUrl as string;
    if (cfg.mode !== 'fork') await checkGasSource(bundlerUrl);

    // ---- the user's signer, counted ----
    // Prompted only now, after the gate passed, so a failing read-back never asks for the password.
    let base;
    try {
        base = cfg.mode === 'fork'
            ? mnemonicToAccount(ANVIL_MNEMONIC, { addressIndex: Number(cfg.userKey.anvilIndex) })
            : await loadLiveSigner(cfg.userKey);
    } catch (e: any) { return refuse(String(e?.message ?? e)); }
    // A live run never signs with a public development key (the fork rehearsal's test owner, anvil / hardhat defaults).
    if (cfg.mode === 'live' && getAddress(base.address) !== getAddress(cfg.expectSigner)) refuse(`mode live: the keystore signer ${base.address} is not config.expectSigner ${cfg.expectSigner}`);
    if (cfg.mode === 'live') { const p = liveSignerApprovalProblem(net.chainId, base.address); if (p) refuse(p); }
    // A second line, not the guarantee (expectSigner is): known public development keys are refused even if configured.
    if (cfg.mode === 'live' && await isPublicTestAccount(base.address)) refuse(`mode live: the signer ${base.address} is a public development key (anvil / hardhat mnemonic or a repo fixture); never on a real chain`);
    let signs = 0;
    // The signing boundary (M4): every signature passes these, right before the key is used — a per-op budget (an SDK
    // retry cannot sign twice), a fresh SuperPaymaster check, and a chain-time deadline when a cell sets one.
    let signBudget = Infinity;
    let signDeadline: bigint | undefined;
    let beforeSign: (() => Promise<void>) | undefined;
    // H1: the user's key signs UserOps only; a transaction (the SDK's direct-send fallback, or anything else) is refused
    // except in C12, whose cell IS the EOA's own handleOps.
    let allowTx = false;
    // M2 (Daybreak): C12's transaction is checked field by field BEFORE the key signs it, exactly once, inside the budget
    // (signC12Transaction, checks module). The wrapper copies allowTx / signs / signBudget / beforeSign into st per call.
    const st: C12SignState = { allowTx: false, signs: 0, txSigns: 0, signBudget: Infinity };
    const user = { ...base, signTransaction: async (t: any, o?: any) => {
        st.allowTx = allowTx; st.signs = signs; st.signBudget = signBudget; st.beforeSign = beforeSign;
        return signC12Transaction(() => (base as any).signTransaction(t, o), t, st);
    }, signMessage: async (a: any) => {
        if (signs + st.txSigns >= signBudget) throw new Error(`signature budget exhausted (${signBudget}) — a retry would sign again; refused`);
        if (beforeSign) await beforeSign();
        if (signDeadline !== undefined) {
            const now = (await pub.getBlock({ blockTag: 'latest' })).timestamp;
            if (now >= signDeadline) throw new Error(`chain time ${now} reached the cell's signing deadline ${signDeadline}; refused`);
        }
        signs++;
        st.lastSignedHash = typeof a?.message === 'object' && typeof a.message?.raw === 'string' ? a.message.raw as Hex : undefined;
        return base.signMessage(a);
    } };
    const userWallet = createWalletClient({ account: user as any, chain, transport: http(rpcUrls[0]) });
    // Whether the account exists before this run: A7 must prove the FIRST sponsored op of a brand-new
    // account (fresh lock / allowance slots: the Amsterdam state-gas case, DSR) succeeds.
    const codeBefore = await pub.getCode({ address: account });
    const freshAccount = !codeBefore || codeBefore === '0x';
    if (cfg.requireFreshAccount === true && cfg.mode !== 'fork') refuse('requireFreshAccount is a fork (A7) check: a live account is the user\'s own');
    if (cfg.requireFreshAccount === true && !freshAccount) refuse(`requireFreshAccount: account ${account} already has code; A7 needs a brand-new account`);
    // M11: one account factory for setup, prediction and C12: the DeployLive config's (fork rehearsal) or the book's.
    const accountFactory = getAddress(requireDeployedAddress((forkSet?.addresses ?? (CANONICAL_ADDRESSES as Record<number, any>)[net.chainId]) as any, 'simpleAccountFactory', deployment));
    if (cfg.forkSetup?.simpleAccountFactory !== undefined && getAddress(cfg.forkSetup.simpleAccountFactory) !== accountFactory) {
        refuse(`forkSetup.simpleAccountFactory ${cfg.forkSetup.simpleAccountFactory} != the run's account factory ${accountFactory}`);
    }
    if (args.includes('--fork-setup')) {
        try {
            await forkSetup({
                pub: pub as any, rpcUrl: rpcUrls[0], registry, token, account, owner: base.address, roleEnduser: ROLE_ENDUSER, modeSpK: MODE_SP_K,
                simpleAccountFactory: accountFactory,
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
        const eu: any = createEndUserClient({ chain, transport: http(rpcUrls[0]), account: base as any, addresses: { superPaymaster: sp, entryPoint: ep, simpleAccountFactory: accountFactory } as any });
        const predicted = (await eu.createSmartAccount({ owner: base.address })).accountAddress as Address;
        if (getAddress(predicted) !== account) missing.push(`C12's account (createSmartAccount(owner) = ${predicted}) == config.account ${account}`);
    }
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
    if (missing.length) refuse(`preconditions not met for ${account}: ${missing.join(', ')}`);
    if (args.includes('--preflight')) {
        result(`preflight: gate passed, preconditions met for ${account} (allowance ${s0.used}/${s0.cap}, autoRenewUsed ${s0.renewUsed}/${K}); no op sent`);
        return;
    }
    // The account's own fields are taken once the preconditions hold (fork setup may have just created / configured it);
    // from here every signature re-checks them like the SuperPaymaster fields.
    { const fresh = await wiring(); gated.accountOwner = fresh.accountOwner; gated.renewalMode = fresh.renewalMode; }
    if (cfg.mode === 'fork') {
        // Mode fork: this run's own Alto, bound to the verified fork RPC, on a free loopback port, stopped on exit.
        bundlerUrl = await startForkBundler(rpcUrls[0], ep, pub);
        await checkGasSource(bundlerUrl);
    }

    // ---- helpers ----
    // Bounded: each request 15 s, the whole wait 180 s; an HTTP or JSON-RPC error is reported, not taken as "pending".
    const receipt = async (opHash: Hex) => {
        const until = Date.now() + 180_000;
        while (Date.now() < until) {
            let r: any;
            try {
                const res = await fetch(bundlerUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getUserOperationReceipt', params: [opHash] }), signal: AbortSignal.timeout(15_000) });
                if (!res.ok) return fail(`receipt for ${opHash} (submitted): bundler answered HTTP ${res.status}`);
                r = await res.json();
            } catch (e: any) { return fail(`receipt for ${opHash} (submitted): bundler did not answer (${e?.name ?? 'error'})`); }
            if (r?.error) return fail(`receipt for ${opHash} (submitted): bundler error ${JSON.stringify(r.error).slice(0, 200)}`);
            if (r?.result) return r.result;
            await new Promise((res) => setTimeout(res, 1000));
        }
        return fail(`no receipt for ${opHash} (submitted) within 180 s`);
    };
    /** THIS op as bundled, read from the bundle transaction's handleOps calldata: flags, all five limits and the fees. */
    const onChainOp = async (txHash: Hex, nonce: bigint): Promise<{ flags: number; postOpGasLimit: bigint; limits: Record<(typeof FIELDS)[number], bigint>; maxFeePerGas: bigint; maxPriorityFeePerGas: bigint; paymaster: Address }> => {
        const tx = await pub.getTransaction({ hash: txHash });
        if (!tx.to || getAddress(tx.to) !== getAddress(ep)) return fail(`bundle tx ${txHash} is sent to ${tx.to}, not the EntryPoint ${ep}`);
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
        const u = ops[0];
        const agl = (u.accountGasLimits as Hex).slice(2), gf = (u.gasFees as Hex).slice(2);
        const limits = {
            verificationGasLimit: BigInt('0x' + agl.slice(0, 32)), callGasLimit: BigInt('0x' + agl.slice(32)), preVerificationGas: BigInt(u.preVerificationGas),
            paymasterVerificationGasLimit: BigInt(`0x${pmd.slice(2 + 20 * 2, 2 + O.POSTOP_GAS * 2)}`), paymasterPostOpGasLimit: postOpGasLimit,
        };
        return { flags, postOpGasLimit, limits, maxPriorityFeePerGas: BigInt('0x' + gf.slice(0, 32)), maxFeePerGas: BigInt('0x' + gf.slice(32)), paymaster: getAddress(pmd.slice(0, 42)) };
    };
    const bundlerCalls: BundlerCall[] = [];
    const untapBundler = tapBundler(bundlerUrl, () => signs, bundlerCalls);
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
    // No direct-send fallback (it pays from the user's EOA) and no local-default gas: a bundler that cannot estimate or
    // cannot accept a UserOp is refused before anything is signed or spent.
    const submitOpts = (onGasDecided: (d: GasDecision) => void) => ({ operator, onGasDecided, requireEstimate: true, noDirectSendFallback: true,
        ...(frozenGas ? { frozenGas } : {}), ...(gasLimitCoefficientBps !== undefined ? { gasLimitCoefficientBps } : {}) });
    const op = async (label: string, callData: Hex, o: { spaced?: boolean } = {}) => {
        if (o.spaced !== false) await spaced();
        SuperPaymasterInflightGuard.clearAll();
        signs = 0;
        const before = await state();
        const first = bundlerCalls.length;
        let decision: GasDecision | undefined;
        await recheck(label);
        signBudget = 1; beforeSign = () => recheck(label);
        // No superPaymasterFlags: SP_RENEW is the SDK's per-op decision, which is what is under test.
        let opHash: Hex;
        try {
            opHash = (await PaymasterClient.submitGaslessUserOperation(pub as any, userWallet as any, account, ep, sp, ZERO, bundlerUrl, callData, submitOpts((d) => { decision = d; }))) as Hex;
        } catch (e: any) {
            // B5 (DSR): a bundler rejection (e.g. an efficiency check) is reported with its reason and the numbers — the
            // numbers from the op that was actually sent (onGasDecided only runs after acceptance).
            const sent = bundlerCalls.slice(first).filter((c) => c.method === 'eth_sendUserOperation').at(-1);
            const msg = String(e?.shortMessage ?? e?.message ?? e).slice(0, 300);
            // Three outcomes, not one: nothing left this process; the bundler answered with a JSON-RPC error; or an op was
            // sent and the outcome is unknown (a lost / malformed answer) — then it may be pending: read the nonce first.
            const outcome = !sent ? 'NOT SENT' : /Bundler Error|"code"|-32\d{3}/.test(msg) ? 'REJECTED by the bundler' : 'OUTCOME UNKNOWN (sent; check the EntryPoint nonce before rerunning)';
            const nonceNow = await pub.readContract({ address: ep, abi: EntryPointABI, functionName: 'getNonce', args: [account, 0n] }).catch(() => undefined);
            result(`${label}: ${outcome} — ${msg} · ${sent?.gas ? `sent gas=${FIELDS.map((k) => `${k}:${sent.gas![k]}`).join(',')} maxFee=${sent.gas.maxFeePerGas} priority=${sent.gas.maxPriorityFeePerGas}` : 'nothing sent'} · EntryPoint nonce now ${nonceNow ?? '?'} · checked at block ${lastCheckBlock}`);
            throw e;
        } finally { signBudget = Infinity; beforeSign = undefined; }
        lastSent = Date.now();
        const submitted = bundlerCalls.slice(first);
        const signsForOp = signs;
        const brc = await receipt(opHash);
        const txHash = brc.receipt?.transactionHash as Hex;
        // The outcome from the chain, not the bundler: the transaction's own receipt, and EntryPoint's UserOperationEvent
        // for exactly this op hash and sender.
        const chainRc = await pub.getTransactionReceipt({ hash: txHash });
        let ev: any;
        for (const l of chainRc.logs as any[]) {
            if (getAddress(l.address) !== getAddress(ep)) continue;
            try { const d: any = decodeEventLog({ abi: EntryPointABI as Abi, data: l.data, topics: l.topics }); if (d.eventName === 'UserOperationEvent' && d.args.userOpHash.toLowerCase() === opHash.toLowerCase() && getAddress(d.args.sender) === account) ev = d.args; } catch { /* other events */ }
        }
        if (!ev) fail(`${label}: no EntryPoint UserOperationEvent for ${opHash} in tx ${txHash}`);
        const rc = { success: ev.success as boolean, nonce: BigInt(ev.nonce), actualGasUsed: BigInt(ev.actualGasUsed) };
        const bundled = await onChainOp(txHash, rc.nonce);
        const { flags, postOpGasLimit } = bundled;
        const logs = chainRc.logs as any[];
        // Efficiency (B5): the bundler's own check compares actual use with the limits it was given.
        const actualGasUsed = rc.actualGasUsed;
        const limitSum = decision ? FIELDS.reduce((t, k) => t + decision!.limits[k], 0n) : 0n;
        const efficiency = limitSum > 0n ? Number((actualGasUsed * 10_000n) / limitSum) / 10_000 : NaN;
        const renewedInline = logs.some((l) => isSpRelayedRenewal(l, xPNTsTokenV2ABI as Abi, { token, user: account, sp }));
        const after = await state();
        const estimates = submitted.filter((c) => c.method === 'eth_estimateUserOperationGas').length;
        const sends = submitted.filter((c) => c.method === 'eth_sendUserOperation');
        result(`${label}: success=${rc.success} S_user signMessage=${signsForOp} estimates=${estimates} (placeholder sig) sends=${sends.length} ` +
            `flags=0x${flags.toString(16).padStart(2, '0')} (SDK-selected) ` +
            `allowance used ${before.used}->${after.used}/${after.cap} autoRenewUsed ${before.renewUsed}->${after.renewUsed} ` +
            `AllowanceRenewed(bySP)=${renewedInline} postOpGasLimit=${postOpGasLimit} actualGasUsed=${actualGasUsed} efficiency=${efficiency} · ${gasRow(decision)} · ` +
            `checked at block ${lastCheckBlock}, included in block ${chainRc.blockNumber} · tx ${txHash}`);
        if (decision === undefined) fail(`${label}: the SDK reported no gas decision (onGasDecided) for a sent op`);
        // What was bundled must be what the decision says (not only what the callback reported), and frozen = verbatim.
        const offLimits = FIELDS.filter((k) => bundled.limits[k] !== decision!.limits[k]);
        if (offLimits.length) fail(`${label}: bundled limits differ from the reported decision (${offLimits.map((k) => `${k} ${bundled.limits[k]} vs ${decision!.limits[k]}`).join('; ')})`);
        if (bundled.maxFeePerGas !== decision!.fees.maxFeePerGas || bundled.maxPriorityFeePerGas !== decision!.fees.maxPriorityFeePerGas) fail(`${label}: bundled fees differ from the reported decision`);
        if (bundled.paymaster !== getAddress(sp)) fail(`${label}: bundled paymaster ${bundled.paymaster} is not ${sp}`);
        if (frozenGas && FIELDS.some((k) => bundled.limits[k] !== frozenGas![k])) fail(`${label}: frozenGas was not used verbatim (${gasRow(decision)})`);
        if (rc.success !== true) fail(`${label}: UserOperationEvent.success=${rc.success}`);
        // The floor the SDK applies, held on what was actually bundled (not on the getter alone).
        if (postOpGasLimit < expectMinPostOpGas) fail(`${label}: bundled paymasterPostOpGasLimit ${postOpGasLimit} < minPostOpGas ${expectMinPostOpGas}`);
        await settledUnderSnapshot(label, chainRc.blockNumber);
        const problems = [
            ...opSigningProblems(submitted, signsForOp, DUMMY_SIGNATURE, { expectEstimate: !frozenGas }),
            ...renewalConsistencyProblems({
                onChainFlags: flags, sentFlags: sends.at(-1)?.flags, renewedInline,
                renewUsedBefore: before.renewUsed, renewUsedAfter: after.renewUsed,
            }),
        ];
        if (problems.length) fail(`${label}: ${problems.join('; ')}`);
        return { flags, renewedInline, before, after, txHash, decision };
    };

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
        // Sent with S1's own limits (frozen, so no estimate that could refuse it first), it must be refused AT SEND as not
        // yet valid with a structured validAfter in the future: exactly one send and one signature, no wait, no retry. The
        // signature is refused by the signer itself once chain time reaches S1 + minTxInterval - 5 s.
        {
            const s1Block = await pub.getBlock({ blockHash: (await pub.getTransactionReceipt({ hash: s1.txHash })).blockHash });
            const head = await pub.getBlock({ blockTag: 'latest' });
            const elapsedChain = head.timestamp - s1Block.timestamp;
            if (elapsedChain + 5n >= minTxInterval) fail(`S1r: ${elapsedChain}s of chain time have passed since S1 (minTxInterval ${minTxInterval}s); the window is closed, S1r not exercised (nothing signed)`);
            await recheck('S1r');
            // M4 (Daybreak, FU-126): the nonce this op is built with, so a signed op that might later become valid is named.
            const s1rNonce = (await pub.readContract({ address: ep, abi: EntryPointABI, functionName: 'getNonce', args: [account, 0n] })) as bigint;
            st.lastSignedHash = undefined;
            const first = bundlerCalls.length;
            SuperPaymasterInflightGuard.clearAll();
            signs = 0;
            let rejected: unknown;
            signBudget = 1; beforeSign = () => recheck('S1r'); signDeadline = s1Block.timestamp + minTxInterval - 5n;
            try { await PaymasterClient.submitGaslessUserOperation(pub as any, userWallet as any, account, ep, sp, ZERO, bundlerUrl, noop, { ...submitOpts(() => {}), frozenGas: s1.decision!.limits }); }
            catch (e) { rejected = e; }
            finally { signBudget = Infinity; beforeSign = undefined; signDeadline = undefined; }
            const calls = bundlerCalls.slice(first);
            const sends = calls.filter((c) => c.method === 'eth_sendUserOperation');
            const nyv = rejected instanceof UserOperationNotYetValidError ? rejected : undefined;
            // M4: printed before any check can stop the run, on every outcome once a signature exists. Unless S1r ends as
            // REJECTED (not yet valid), this op may still be valid after validAfter: the runbook's next step is to spend
            // the same nonce with a normal op before anything else.
            const s1rVA = nyv?.validAfter !== undefined ? `${nyv.validAfter}` : `${s1Block.timestamp + minTxInterval} (expected: S1 block time + minTxInterval)`;
            const s1rSigned = signs > 0 ? `opHash ${st.lastSignedHash ?? '(not captured)'} sender ${account} nonce ${s1rNonce} validAfter ${s1rVA}` : '';
            if (s1rSigned) console.log(`S1r SIGNED OP: ${s1rSigned} · sends=${sends.length}${nyv ? '' : ' — NOT refused as not-yet-valid: before any other cell, spend nonce ' + s1rNonce + ' with a normal op (A7-runbook §S1r)'}`);
            const validAfterFuture = nyv?.validAfter !== undefined && nyv.now !== undefined && nyv.validAfter > nyv.now;
            const sentGas = sends.at(-1)?.gas;
            result(`S1r second op ${elapsedChain}s (chain time) after S1 (minTxInterval ${minTxInterval}s): ${nyv ? `rejected not yet valid at send (validAfter ${nyv.validAfter ?? '?'}, now ${nyv.now ?? '?'})` : rejected ? `rejected otherwise: ${String((rejected as any)?.message ?? rejected).slice(0, 200)}` : 'ACCEPTED'} · sends=${sends.length} S_user signMessage=${signs}${s1rSigned ? ` · ${s1rSigned}` : ''} · ${sentGas ? `sent gas=${FIELDS.map((k) => `${k}:${sentGas[k]}`).join(',')} (S1's limits, frozen)` : 'nothing sent'}`);
            if (!nyv) fail('S1r: the second op inside minTxInterval was not refused as UserOperationNotYetValidError (-32503)');
            if (!validAfterFuture) fail('S1r: the refusal carries no validAfter in the future (not attributable to the operator\'s interval)');
            // validAfter is S1's inclusion time + the operator's interval (SP stamps the postOp timestamp; ±2 s for block time).
            const expectVA = s1Block.timestamp + minTxInterval;
            if (nyv!.validAfter! < expectVA - 2n || nyv!.validAfter! > expectVA + 2n) fail(`S1r: validAfter ${nyv!.validAfter} is not S1's block time ${s1Block.timestamp} + minTxInterval ${minTxInterval} (±2 s): another validity window, not the operator's interval`);
            if (calls.some((c) => c.method === 'eth_estimateUserOperationGas')) fail('S1r: an estimate was requested; the cell sends S1\'s limits frozen');
            const sentLimits = sends.at(-1)?.gas;
            const offS1 = FIELDS.filter((k) => sentLimits?.[k] !== s1.decision!.limits[k]);
            if (offS1.length) fail(`S1r: sent limits are not S1's (${offS1.map((k) => `${k} ${sentLimits?.[k]} vs ${s1.decision!.limits[k]}`).join('; ')})`);
            if (!sends.at(-1)?.signature || sends.at(-1)!.signature === '0x' || sends.at(-1)!.signature!.toLowerCase() === DUMMY_SIGNATURE.toLowerCase()) fail('S1r: the send carried the placeholder or no signature');
            if (sends.length !== 1) fail(`S1r: ${sends.length} eth_sendUserOperation calls; the cell is one send, refused`);
            if (signs !== 1) fail(`S1r: signMessage ${signs} times; the cell is one signature`);
            lastSent = Date.now(); // the next op waits a full interval
        }

        // ---- 5. S3b inline renewal ----
        let renewal = s1.flags & SUPER_PAYMASTER_FLAGS.SP_RENEW ? s1 : undefined;
        if (!renewal) {
            const floor = BigInt(await tok('SP_CAP_FLOOR'));
            if ((await state()).cap > floor) {
                // The setup op is itself sponsored: if the SDK chose SP_RENEW for it, op() already verified the renewal
                // (AllowanceRenewed bySP, autoRenewUsed +1) and that IS the behaviour under test — counted, no more spending.
                const setup = await op(`S3b setup: setAutoAllowance(SP, SP_CAP_FLOOR=${floor})`, encodeFunctionData({
                    abi: SimpleAccountABI, functionName: 'execute',
                    args: [token, 0n, encodeFunctionData({ abi: xPNTsTokenV2ABI, functionName: 'setAutoAllowance', args: [sp, floor] })],
                }));
                if (setup.flags & SUPER_PAYMASTER_FLAGS.SP_RENEW) renewal = setup;
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
            const eu: any = createEndUserClient({ chain, transport: http(rpcUrls[0]), account: user as any, addresses: { superPaymaster: sp, entryPoint: ep, simpleAccountFactory: accountFactory } as any });
            // D14 (DSR): the limits are this bundler's estimate x the coefficient (or frozenGas, explicit), the EOA sends
            // handleOps with the node's eth_estimateGas x the coefficient; the decision is recorded like every other row.
            let c12: any;
            // M6: frozen limits are used as given: one below today's floor is refused before C12 signs.
            if (frozenGas && frozenGas.paymasterPostOpGasLimit < expectMinPostOpGas) {
                fail(`C12: frozenGas.paymasterPostOpGasLimit ${frozenGas.paymasterPostOpGasLimit} < minPostOpGas ${expectMinPostOpGas}; refused before signing`);
            }
            await recheck('C12');
            const epNonce = (await pub.readContract({ address: ep, abi: EntryPointABI, functionName: 'getNonce', args: [account, 0n] })) as bigint;
            // Two signatures: the op, then its one handleOps transaction (checked against this op before signing).
            st.expect = { chainId: net.chainId, entryPoint: getAddress(ep), sender: account, nonce: epNonce, paymaster: getAddress(sp), beneficiary: getAddress(base.address), ...c12Caps };
            st.lastSignedHash = undefined; st.txSigns = 0;
            signBudget = 2; beforeSign = () => recheck('C12'); allowTx = true;
            const tx = (await eu.executeGasless({
                target: taskToken ?? operator, data: taskToken ? encodeFunctionData({ abi: ERC20ABI, functionName: 'transfer', args: [DEAD, 1n] }) : '0x', operator,
                estimateBundlerUrl: bundlerUrl, ...(frozenGas ? { gas: frozenGas } : {}), ...(gasLimitCoefficientBps !== undefined ? { gasLimitCoefficientBps } : {}),
                onGasDecided: (d: any) => { c12 = d; },
            }).finally(() => { signBudget = Infinity; beforeSign = undefined; allowTx = false; st.expect = undefined; })) as Hex;
            const rc = await pub.waitForTransactionReceipt({ hash: tx });
            let ev: any;
            // The event from the EntryPoint, for this account and the nonce the op was built with.
            for (const l of rc.logs as any[]) {
                if (getAddress(l.address) !== getAddress(ep)) continue;
                try { const d: any = decodeEventLog({ abi: EntryPointABI as Abi, data: l.data, topics: l.topics }); if (d.eventName === 'UserOperationEvent' && getAddress(d.args.sender) === account && BigInt(d.args.nonce) === epNonce) ev = d.args; } catch { /* other logs */ }
            }
            if (rc.to && getAddress(rc.to) !== getAddress(ep)) fail(`C12: handleOps went to ${rc.to}, not the EntryPoint ${ep}`);
            const c1 = await state();
            const eth1 = await pub.getBalance({ address: base.address });
            const c12Gas = c12 === undefined ? 'gas=(no decision reported)'
                : `gas=${FIELDS.map((k) => `${k}:${c12.limits[k]}(${c12.limitSources[k]})`).join(',')} coefficientBps=${c12.coefficientBps} maxFee=${c12.fees.maxFeePerGas} priority=${c12.fees.maxPriorityFeePerGas} feeSource=${c12.fees.source} handleOpsGas:${c12.handleOps.gasLimit}(estimate ${c12.handleOps.estimate})`;
            result(`C12 createEndUserClient().executeGasless: tx ${rc.status} from ${rc.from} UserOperationEvent.success=${ev?.success} actualGasUsed=${ev?.actualGasUsed} · user xPNTs -${c0.bal - c1.bal} · EOA ETH -${eth0 - eth1} · S_user signMessage=${signs} · handleOps gasUsed=${rc.gasUsed} · ${c12Gas} · checked at block ${lastCheckBlock}, included in block ${rc.blockNumber} · tx ${tx}`);
            if (c12 === undefined) fail('C12: executeGasless reported no gas decision');
            if (frozenGas && FIELDS.some((k) => c12.limits[k] !== frozenGas![k])) fail(`C12: frozenGas was not used verbatim (${c12Gas})`);
            // What was mined must be what the SDK reported: the op's five limits, fees and paymaster, and the outer gas.
            const mined = await onChainOp(tx, epNonce);
            const off = FIELDS.filter((k) => mined.limits[k] !== c12.limits[k]);
            if (off.length) fail(`C12: mined limits differ from the reported decision (${off.map((k) => `${k} ${mined.limits[k]} vs ${c12.limits[k]}`).join('; ')})`);
            if (mined.maxFeePerGas !== c12.fees.maxFeePerGas || mined.maxPriorityFeePerGas !== c12.fees.maxPriorityFeePerGas) fail('C12: mined fees differ from the reported decision');
            if (mined.paymaster !== getAddress(sp)) fail(`C12: mined paymaster ${mined.paymaster} is not ${sp}`);
            const outer = await pub.getTransaction({ hash: tx });
            if (outer.gas !== c12.handleOps.gasLimit) fail(`C12: handleOps gas ${outer.gas} is not the reported ${c12.handleOps.gasLimit}`);
            if (rc.status !== 'success' || ev?.success !== true) fail('C12: the self-bundled op did not succeed');
            await settledUnderSnapshot('C12', rc.blockNumber);
            if (getAddress(rc.from) !== getAddress(base.address)) fail(`C12: handleOps was sent by ${rc.from}, not the user's EOA`);
            if (signs !== 1) fail(`C12: signMessage ${signs} times; one signature for the op`);
            if (st.txSigns !== 1) fail(`C12: signTransaction ${st.txSigns} times; one handleOps transaction`);
            if (!(c1.bal < c0.bal)) fail('C12: the user was not charged in xPNTs (not sponsored)');
            lastSent = Date.now();
        }
    } finally {
        // fail() exits the process (the exit hook stops a self-started bundler); this covers the normal path and a throw.
        untapBundler();
        stopForkBundler();
    }
    console.log('\nPASS');
}

main().catch((e) => fail(String(e?.shortMessage ?? e?.message ?? e)));
