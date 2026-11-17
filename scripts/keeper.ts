import { createPublicClient, createWalletClient, formatGwei, http, parseAbi } from 'viem';
import { anvil, mainnet, optimism, optimismSepolia, sepolia } from 'viem/chains';
import { loadNetworkConfig, type NetworkName } from '../tests/regression/config.js';
import { CANONICAL_ADDRESSES } from '../packages/core/src/addresses.js';
import {
    KeeperStartupRefusal, castSignerArgs, keeperAccountFor, parseKeeperArgs, parseKeeperMode, resolveKeeperSigner,
    type KeeperArgs, type KeeperMode,
} from './keeper/keeperKey.js';

/** True until the signer is resolved. Any error before then is a configuration refusal: no Telegram, no network. */
let startupPhase = true;
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawn } from 'child_process';
import readline from 'readline';
import { Writable } from 'stream';
import { PaymasterTracker, describeUnresolved, paymasterTickStep } from './keeper/paymasterResolver.js';
import {
    MAINNET_NETWORKS, assertChainId, castChildEnv, castSendArgs, envFileConflicts, feeDecision, parseAddressOption,
    parseGweiOption, parseIntOption, parseNetwork, receiptOutcome, redactRpcUrl, redactSecrets, safeChildError, secretValues,
} from './keeper/keeperGuards.js';

/** Filled once the configuration is loaded: the values `scrub` removes from any log line or alert (Codex R4). */
let knownSecrets: string[] = [];
/** Diagnostic text for a log or Telegram: known secrets redacted, URLs reduced, length bounded. */
function scrub(text: string, max = 300): string {
    return safeChildError(redactSecrets(text, knownSecrets), max);
}


const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;
const TELEGRAM_BOT_USERNAME = '@AAstarMonitorBot' as const;

function installPipeSafety(): void {
    const handle = (e: any) => {
        if (e?.code === 'EPIPE') process.exit(0);
    };
    (process.stdout as any)?.on?.('error', handle);
    (process.stderr as any)?.on?.('error', handle);
}

const SUPERPAYMASTER_ABI = parseAbi([
    'function cachedPrice() view returns (int256 price, uint256 updatedAt, uint80 roundId, uint8 decimals)',
    'function priceStalenessThreshold() view returns (uint256)',
    'function updatePrice()'
]);

const PAYMASTER_V4_ABI = parseAbi([
    'function cachedPrice() view returns (uint208 price, uint48 updatedAt)',
    'function priceStalenessThreshold() view returns (uint256)',
    'function updatePrice()',
    'function ethUsdPriceFeed() view returns (address)'
]);

const PAYMASTER_FACTORY_ABI = parseAbi([
    'function paymasterByOperator(address operator) view returns (address)',
    'function getOperatorByPaymaster(address paymaster) view returns (address)'
]);

const CHAINLINK_ABI = parseAbi([
    'function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
    'function decimals() view returns (uint8)'
]);

// Both read the strict parse (keeperKey.ts parseKeeperArgs): unknown, `--flag=value`, repeated and missing-value
// arguments were refused before either is called.
function getArgValue(args: KeeperArgs, key: string): string | undefined {
    return args.value(key);
}

function hasFlag(args: KeeperArgs, key: string): boolean {
    return args.flag(key);
}

function nowSec(): bigint {
    return BigInt(Math.floor(Date.now() / 1000));
}

function formatTs(ts: bigint): string {
    if (ts <= 0n) return '0';
    return new Date(Number(ts) * 1000).toISOString();
}

/**
 * Read the keystore password from the terminal without echoing it (Codex R2). readline is given an output stream that
 * is muted while the user types, so no typed or pasted byte is ever written; only the prompt and a newline are.
 * End of input or Ctrl-C before Enter rejects (a refusal), instead of continuing with an empty or partial password.
 */
async function promptHidden(prompt: string): Promise<string> {
    let muted = false;
    const output = new Writable({
        write(chunk, _enc, cb) {
            if (!muted) process.stdout.write(chunk);
            cb();
        },
    });
    return await new Promise((resolve, reject) => {
        const rl = readline.createInterface({ input: process.stdin, output, terminal: true });
        let answered = false;
        const refuse = (why: string) => {
            if (answered) return;
            answered = true;
            muted = false;
            process.stdout.write('\n');
            rl.close();
            reject(new KeeperStartupRefusal(`keystore password not entered (${why})`));
        };
        rl.on('SIGINT', () => refuse('Ctrl-C'));
        rl.on('close', () => refuse('end of input'));
        process.stdout.write(prompt);
        muted = true;
        rl.question('', (value) => {
            if (value === '') return refuse('empty');
            answered = true;
            muted = false;
            process.stdout.write('\n');
            rl.close();
            resolve(value);
        });
    });
}

async function sendTelegramMessage(text: string): Promise<void> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return;
    const axios = (await import('axios')).default;
    try {
        // Bounded: a Telegram request that never answers must not stall the price loop.
        await axios.post(
            `https://api.telegram.org/bot${token}/sendMessage`,
            { chat_id: chatId, text, disable_web_page_preview: true },
            { timeout: 10_000 }
        );
    } catch (e: any) {
        const msg = e?.response?.data?.description || e?.message || String(e);
        console.warn(`[telegram] sendMessage failed: ${msg}`);
    }
}

async function sleepMs(ms: number): Promise<void> {
    await new Promise((r) => setTimeout(r, ms));
}

function assertTelegramConfigValid(): void {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token && !chatId) return;
    if (!token || !chatId) {
        throw new Error('Telegram config invalid: TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must both be set');
    }

    const ok = /^-?\d+$/.test(chatId) || chatId.startsWith('@');
    if (!ok) {
        throw new Error(
            'Telegram config invalid: TELEGRAM_CHAT_ID must be a numeric chat id (e.g. 123456789 or -100123...) or start with @ (e.g. @MyChannel); the value is not shown'
        );
    }
}

function logo(): string {
    return [
        '    _   ___   _____ _________    ____  ______________ ',
        '   / | / / | / / _ /_  __/ _ \\  / __ \\/  _/ ___/ ___/ ',
        '  /  |/ /  |/ / __ |/ / / , _/ / /_/ // // /__/ /__   ',
        ' /_/|_/_/|_/_/_/ |_/_/ /_/|_|  \\____/___/\\___/\\___/   ',
        '                 AAStar Keeper (SuperPaymaster)        '
    ].join('\n');
}

function section(title: string): string {
    const line = '='.repeat(78);
    const t = title.trim();
    if (!t) return line;
    return `${line}\n${t}\n${line}`;
}

function usage(): string {
    return [
        'Keeper quickstart:',
        '',
        '1) Private key mode (simplest):',
        '   - Set env: KEEPER_PRIVATE_KEY=0x... (required; PRIVATE_KEY_SUPPLIER / PRIVATE_KEY are not read)',
        '   - Run: pnpm exec tsx scripts/keeper.ts --network op-mainnet --hard-max-fee-gwei <gwei>',
        '',
        '2) Cast mode (use Foundry keystore/account):',
        '   - Run with keystore: pnpm exec tsx scripts/keeper.ts --network op-mainnet --mode cast --keystore <path> --hard-max-fee-gwei <gwei>',
        '   - Or use cast account: pnpm exec tsx scripts/keeper.ts --network op-mainnet --mode cast --cast-account <name> --hard-max-fee-gwei <gwei>',
        '',
        'Common flags:',
        '   --poll-interval <sec>       check interval (e.g. 180)',
        '   --safety-margin <sec>       refresh before expiry (e.g. 600)',
        '   --dry-run                   print actions without sending tx',
        '   --once                      run one tick then exit',
        '   --no-superpaymaster         disable SuperPaymaster updates',
        '   --no-paymaster              disable PaymasterV4 updates',
        '   --max-updates-per-day <n>   per-target limit (default 24)',
        '   --max-base-fee-gwei <n>     skip updates if base fee too high',
        '   --hard-max-fee-gwei <n>     absolute fee ceiling, also the tx max fee (required live on op-mainnet / mainnet)',
        '',
        'Telegram notifications (optional):',
        '   - Set env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID',
        `   - Bot: ${TELEGRAM_BOT_USERNAME}`,
        '   - Notes: bot must be able to message the chat (DM: send /start; group/channel: add bot)',
        '   - Sends: start/stop/heartbeat/error/update success',
        '',
        'Anomaly detection (optional, no tx):',
        '   --chainlink-stale-sec <sec>      alert if Chainlink feed is stale (default 600)',
        '   --external-ethusd-url <url>      external ETH/USD JSON endpoint (or env EXTERNAL_ETHUSD_URL)',
        '   --volatility-threshold-bps <n>   alert if external move/deviation >= n bps (default 0=off)',
        '   --volatility-cooldown <sec>      alert rate limit (default 600)',
        '   --paymaster-missing-alert <sec>  alert when PaymasterV4 stays unresolved this long (default 1800, 0=off)',
        '',
        'Networks: anvil | sepolia | op-sepolia | op-mainnet | mainnet',
        'Config: reads .env.<network> (needs RPC_URL). Telegram is optional.'
    ].join('\n');
}

function shortUsage(): string {
    return [
        `help: pnpm exec tsx scripts/keeper.ts --help`,
        `example: pnpm exec tsx scripts/keeper.ts --network op-mainnet --hard-max-fee-gwei <gwei> --poll-interval 180 --safety-margin 600`,
        `telegram: set TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID (bot ${TELEGRAM_BOT_USERNAME})`,
        `health: --health-interval 1800 (telegram periodic ok status)`,
        `anomaly: --external-ethusd-url <url> --volatility-threshold-bps 150 (1.50%)`
    ].join('\n');
}

/** The `cast send` child in flight, if any. Shutdown terminates and awaits it before reporting "stopped". */
let activeCast: { child: ReturnType<typeof spawn>; closed: Promise<void> } | null = null;
/**
 * Set synchronously by the first SIGINT / SIGTERM. Checked immediately before every signature (cast spawn, viem
 * writeContract), after the last await, so nothing new is signed once shutdown has begun (Codex R1).
 */
let stopping = false;
function assertNotStopping(): void {
    if (stopping) throw new Error('shutting down: no new transaction is signed');
}

async function runCastSend(params: {
    rpcUrl: string;
    chainId: number;
    target: `0x${string}`;
    /** From castSignerArgs(signer) at startup: the only source of --keystore / --account. */
    signerArgs: string[];
    passwordFilePath: string;
    gasPriceWei?: bigint;   // explicit gas-price to avoid cast hanging on estimation
    maxFeeWei?: bigint;     // --hard-max-fee-gwei: sent as the max fee per gas
    processTimeoutMs?: number; // hard kill timeout (default 90s)
}): Promise<string> {
    const cmd = 'cast';
    const castArgs = castSendArgs(params);
    const killTimeoutMs = params.processTimeoutMs ?? 90_000;

    return await new Promise((resolve, reject) => {
        assertNotStopping();
        // Only an allowlisted environment: no key, password or Telegram variable reaches the child (castChildEnv).
        const child = spawn(cmd, castArgs, { stdio: ['ignore', 'pipe', 'pipe'], env: castChildEnv(process.env, params.rpcUrl) });
        const closed = new Promise<void>((r) => { child.once('close', () => r()); child.once('error', () => r()); });
        activeCast = { child, closed };
        void closed.then(() => { if (activeCast?.child === child) activeCast = null; });
        let out = '';
        let err = '';
        let settled = false;

        // Hard kill timeout — cast --timeout only controls receipt polling, not the process
        const killTimer = setTimeout(() => {
            if (settled) return;
            settled = true;
            child.kill('SIGKILL');
            reject(new Error(`cast send timed out after ${killTimeoutMs}ms (process killed)`));
        }, killTimeoutMs);

        child.stdout.on('data', (d) => { out += d.toString(); });
        child.stderr.on('data', (d) => { err += d.toString(); });
        child.on('error', (e) => {
            if (settled) return;
            settled = true;
            clearTimeout(killTimer);
            reject(e);
        });
        child.on('close', (code) => {
            if (settled) return;
            settled = true;
            clearTimeout(killTimer);
            const merged = `${out}\n${err}`.trim();
            if (code !== 0) return reject(new Error(merged ? `cast send failed: ${scrub(merged)}` : `cast exited with code ${code}`));
            const txMatch = merged.match(/transactionHash\s+([0x][0-9a-fA-F]{64})/);
            if (txMatch?.[1]) return resolve(txMatch[1]);
            const altMatch = merged.match(/(0x[0-9a-fA-F]{64})/);
            if (altMatch?.[1]) return resolve(altMatch[1]);
            return resolve('');
        });
    });
}

async function main() {
    installPipeSafety();
    const args = parseKeeperArgs(process.argv.slice(2).filter((a) => a !== '--'));
    // Every value is checked here, locally, with a fixed message that never echoes it (KPR-009/012, FU-113 ①).
    const network: NetworkName = parseNetwork(getArgValue(args, '--network'));
    const mode: KeeperMode = parseKeeperMode(
        getArgValue(args, '--mode'), Boolean(getArgValue(args, '--keystore') || getArgValue(args, '--cast-account')),
    );
    // At most a day: a longer setTimeout delay overflows Node's 32-bit timer and fires at once (Codex R9).
    const pollIntervalSec = parseIntOption('--poll-interval', getArgValue(args, '--poll-interval'), 30n, 1n, 86_400n);
    const safetyMarginSec = parseIntOption('--safety-margin', getArgValue(args, '--safety-margin'), 600n, 0n);
    const maxUpdatesPerDay = Number(parseIntOption('--max-updates-per-day', getArgValue(args, '--max-updates-per-day'), 24n, 0n));
    const maxBaseFeeGwei = getArgValue(args, '--max-base-fee-gwei');
    const maxBaseFeeWei = parseGweiOption('--max-base-fee-gwei', maxBaseFeeGwei);
    const hardMaxFeeWei = parseGweiOption('--hard-max-fee-gwei', getArgValue(args, '--hard-max-fee-gwei'));
    const healthIntervalSec = parseIntOption('--health-interval / KEEPER_HEALTH_INTERVAL_SEC',
        getArgValue(args, '--health-interval') || process.env.KEEPER_HEALTH_INTERVAL_SEC, 1800n, 0n);
    const volatilityThresholdBps = parseIntOption('--volatility-threshold-bps / KEEPER_VOLATILITY_THRESHOLD_BPS',
        getArgValue(args, '--volatility-threshold-bps') || process.env.KEEPER_VOLATILITY_THRESHOLD_BPS, 0n, 0n);
    const volatilityCooldownSec = parseIntOption('--volatility-cooldown / KEEPER_VOLATILITY_COOLDOWN_SEC',
        getArgValue(args, '--volatility-cooldown') || process.env.KEEPER_VOLATILITY_COOLDOWN_SEC, 600n, 0n);
    const chainlinkStaleSec = parseIntOption('--chainlink-stale-sec / KEEPER_CHAINLINK_STALE_SEC',
        getArgValue(args, '--chainlink-stale-sec') || process.env.KEEPER_CHAINLINK_STALE_SEC, 600n, 0n);
    const externalEthUsdUrl = getArgValue(args, '--external-ethusd-url') || process.env.EXTERNAL_ETHUSD_URL || '';
    const dryRun = hasFlag(args, '--dry-run');
    const once = hasFlag(args, '--once');
    const printLogo = hasFlag(args, '--logo') || !hasFlag(args, '--no-logo');
    const disableSuperPaymaster = hasFlag(args, '--no-superpaymaster') || hasFlag(args, '--disable-superpaymaster');
    const disablePaymaster = hasFlag(args, '--no-paymaster') || hasFlag(args, '--disable-paymaster');
    const help = hasFlag(args, '--help') || hasFlag(args, '-h');

    if (help) {
        console.log(section('HELP'));
        console.log(usage());
        return;
    }

    const envFiles: string[] =
        network === 'op-mainnet' ? ['.env.optimism', '.env.op-mainnet'] : [`.env.${network}`];
    const present = envFiles.map((f) => path.resolve(process.cwd(), f)).filter((p) => fs.existsSync(p));
    // dotenv keeps the first value it loads: with two files, a variable set differently in both would silently come
    // from the legacy one. Refuse instead, naming the variables only (KPR-003).
    const conflicts = envFileConflicts(present.map((p) => ({ name: path.basename(p), vars: dotenv.parse(fs.readFileSync(p)) })));
    if (conflicts.length > 0) {
        throw new KeeperStartupRefusal(
            `${envFiles.join(' and ')} set ${conflicts.join(', ')} to different values; keep one value (the values are not shown)`,
        );
    }
    for (const fullPath of present) dotenv.config({ path: fullPath });
    // Who signs: decided here, after the env files and before any network read, with no fallback (keeperKey.ts).
    // Resolved once; the wallet and the cast arguments below use these same values.
    const signer = resolveKeeperSigner({
        mode, dryRun, env: process.env,
        keystorePath: getArgValue(args, '--keystore'), castAccount: getArgValue(args, '--cast-account'),
    });
    if (!dryRun && hardMaxFeeWei === undefined && (MAINNET_NETWORKS as readonly string[]).includes(network)) {
        throw new KeeperStartupRefusal(`a live run on ${network} needs --hard-max-fee-gwei (an absolute fee ceiling)`);
    }
    if (signer.mode === 'privateKey') console.log(`signer (privateKey mode): ${signer.address ?? 'none (dry run)'}`);
    else console.log(`signer (cast mode): ${signer.keystorePath ? `keystore ${signer.keystorePath}` : `account ${signer.castAccount}`}`);
    assertTelegramConfigValid();
    // Read AFTER the .env.<network> files above, so the network file can set it (CLI still wins).
    // Alert when PaymasterV4 stays unresolved this long (then at most once per interval). 0 disables.
    const paymasterMissingAlertSec = parseIntOption('--paymaster-missing-alert / KEEPER_PAYMASTER_MISSING_ALERT_SEC',
        getArgValue(args, '--paymaster-missing-alert') || process.env.KEEPER_PAYMASTER_MISSING_ALERT_SEC, 1800n, 0n);
    const telegramEnabled = Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);

    let config: ReturnType<typeof loadNetworkConfig>;
    try {
        config = loadNetworkConfig(network);
    } catch (e: any) {
        const rpcUrl = process.env.RPC_URL;
        if (!rpcUrl) throw e;

        const chains: Record<NetworkName, any> = {
            anvil,
            sepolia,
            'op-sepolia': optimismSepolia,
            'op-mainnet': optimism,
            mainnet
        };
        const chain = chains[network];
        const canonicalFallback = (CANONICAL_ADDRESSES as Record<number, any>)[chain.id];
        config = {
            name: network,
            chain,
            rpcUrl,
            bundlerUrl: process.env.BUNDLER_URL || rpcUrl,
            contracts: canonicalFallback,
            testAccount: {
                privateKey: '0x0000000000000000000000000000000000000000000000000000000000000001',
                address: '0x0000000000000000000000000000000000000000'
            },
            explorerUrl: ''
        } as any;
    }
    knownSecrets = secretValues(process.env, config.rpcUrl);
    const publicClient = createPublicClient({ chain: config.chain, transport: http(config.rpcUrl) });

    const canonical = (CANONICAL_ADDRESSES as Record<number, any>)[config.chain.id];
    const superPaymasterDefault = (canonical?.superPaymaster || config.contracts.superPaymaster) as `0x${string}`;
    const priceFeed = (canonical?.priceFeed || config.contracts.priceFeed) as `0x${string}`;
    const superPaymaster = (parseAddressOption('--superpaymaster', getArgValue(args, '--superpaymaster')) || superPaymasterDefault) as `0x${string}`;

    const paymasterFactory = (canonical?.paymasterFactory || config.contracts.paymasterFactory) as `0x${string}`;
    const paymasterFromArgs = parseAddressOption('--paymaster', getArgValue(args, '--paymaster'));
    const paymasterFromCanonical = canonical?.paymasterV4 as `0x${string}` | undefined;
    const paymasterFromConfig = config.contracts.paymasterV4 as `0x${string}` | undefined;
    const paymasterOperatorFromArgs = parseAddressOption('--paymaster-operator', getArgValue(args, '--paymaster-operator'));
    const paymasterOperator =
        (paymasterOperatorFromArgs ||
            parseAddressOption('OFFICIAL_OPERATOR', process.env.OFFICIAL_OPERATOR) ||
            parseAddressOption('TEST_ACCOUNT_ADDRESS', process.env.TEST_ACCOUNT_ADDRESS) ||
            ('0xb5600060e6de5E11D3636731964218E53caadf0E' as `0x${string}`)) as `0x${string}`;

    const paymasterCandidate = (paymasterFromArgs || paymasterFromCanonical || paymasterFromConfig || null) as `0x${string}` | null;
    const paymasterWasExplicit = Boolean(paymasterFromArgs || paymasterFromCanonical || paymasterFromConfig);
    // Resolved now for the INIT report, and again on every tick while unresolved: a failure here
    // (e.g. RPC not up yet after a reboot) must not disable V4 for the life of the process.
    const paymasterTracker = new PaymasterTracker(
        publicClient,
        {
            candidate: paymasterCandidate,
            factory: paymasterFactory,
            factoryAbi: PAYMASTER_FACTORY_ABI,
            operator: paymasterOperator,
            verifyOperatorMapping: Boolean(paymasterOperatorFromArgs) || !paymasterWasExplicit,
        },
        paymasterMissingAlertSec
    );
    // What this run signs with, built from the resolved signer only, before the first network request, and
    // logged: the wallet below and every `cast send` use exactly these objects (no second lookup anywhere).
    const keeperAccount = keeperAccountFor(signer);
    const walletClient = keeperAccount
        ? createWalletClient({ account: keeperAccount, chain: config.chain, transport: http(config.rpcUrl) })
        : null;
    if (walletClient) console.log(`wallet signer: ${walletClient.account!.address}`);
    const castSigner = signer.mode === 'cast' ? castSignerArgs(signer) : null;
    if (castSigner) console.log(`cast signer args: ${castSigner.join(' ')}`);
    // The keystore password is read from a hidden prompt only. Without a terminal there is nobody to type it, and
    // unattended cast mode is not supported until #446/#447 (FU-114): refuse instead of printing a prompt and exiting.
    if (signer.mode === 'cast' && !dryRun && !process.stdin.isTTY) {
        throw new KeeperStartupRefusal('cast mode needs an interactive terminal for the keystore password; unattended cast mode is not supported (FU-114)');
    }
    // Everything above is local configuration; an error up to here is a refusal (no Telegram). From here on the
    // keeper touches the network.
    startupPhase = false;

    // The RPC must serve the configured chain before anything else is read or a password is asked for (KPR-005).
    // The viem wallet path checks this itself on every send; cast is also given --chain and re-checked before each send.
    assertChainId(await publicClient.getChainId(), config.chain.id, 'startup');

    let paymaster: `0x${string}` | null = null;
    let paymasterInit = 'disabled';
    if (!disablePaymaster) {
        const r = await paymasterTracker.ensure(nowSec());
        paymaster = paymasterTracker.current;
        paymasterInit = r.kind === 'found' ? r.address : `not-found (${describeUnresolved(r)}; retried every tick)`;
    }

    if (printLogo) console.log(`${logo()}\n`);
    console.log(section('USAGE'));
    console.log(`${shortUsage()}\n`);

    console.log(section('INIT'));

    console.log(`network=${network}`);
    console.log(`rpcUrl=${redactRpcUrl(config.rpcUrl)}`);
    console.log(`superPaymaster=${disableSuperPaymaster ? 'disabled' : superPaymaster}`);
    console.log(`paymaster=${paymasterInit}`);
    console.log(`paymasterFactory=${paymasterFactory}`);
    console.log(`paymasterOperator=${paymasterOperator}`);
    console.log(`priceFeed=${priceFeed}`);
    console.log(`mode=${mode}`);
    console.log(`pollIntervalSec=${pollIntervalSec.toString()}`);
    console.log(`safetyMarginSec=${safetyMarginSec.toString()}`);
    console.log(`healthIntervalSec=${healthIntervalSec.toString()}`);
    console.log(`paymasterMissingAlertSec=${paymasterMissingAlertSec.toString()}`);
    console.log(`volatilityThresholdBps=${volatilityThresholdBps.toString()}`);
    console.log(`chainlinkStaleSec=${chainlinkStaleSec.toString()}`);
    console.log(`externalEthUsdUrl=${externalEthUsdUrl ? 'set' : 'not-set'}`);
    console.log(`maxUpdatesPerDay=${maxUpdatesPerDay}`);
    console.log(`dryRun=${dryRun}`);

    if (!disableSuperPaymaster) {
        try {
            const superThreshold = (await publicClient.readContract({
                address: superPaymaster,
                abi: SUPERPAYMASTER_ABI,
                functionName: 'priceStalenessThreshold'
            })) as bigint;
            console.log(`super.thresholdSec=${superThreshold.toString()}`);
        } catch {
            console.log('super.thresholdSec=unknown');
        }
    }

    if (!disablePaymaster && paymaster) {
        try {
            const pmThreshold = (await publicClient.readContract({
                address: paymaster,
                abi: PAYMASTER_V4_ABI,
                functionName: 'priceStalenessThreshold'
            })) as bigint;
            console.log(`paymaster.thresholdSec=${pmThreshold.toString()}`);
        } catch {
            console.log('paymaster.thresholdSec=unknown');
        }
    }

    console.log(section('TELEGRAM'));
    console.log(`telegram=${telegramEnabled ? 'enabled' : 'disabled'}`);
    console.log(`bot=${TELEGRAM_BOT_USERNAME}`);
    console.log(`TELEGRAM_BOT_TOKEN=${process.env.TELEGRAM_BOT_TOKEN ? 'set' : 'not-set'}`);
    console.log(`TELEGRAM_CHAT_ID=${process.env.TELEGRAM_CHAT_ID ? process.env.TELEGRAM_CHAT_ID : 'not-set'}`);
    console.log('dm: message bot /start first');
    console.log('group/channel: add bot and allow posting');

    let passwordFilePath: string | null = null;
    const keystorePath = signer.mode === 'cast' ? signer.keystorePath : undefined;
    const castAccount = signer.mode === 'cast' ? signer.castAccount : undefined;
    if (mode === 'cast') {
        if (!keystorePath && castAccount?.startsWith('0x')) {
            throw new Error('cast mode: when providing an address, use --keystore <path> instead of --cast-account');
        }
        if (!keystorePath && !castAccount) {
            throw new Error('cast mode requires --keystore or --cast-account');
        }
        if (!dryRun) {
            // Hidden prompt only (the author's rule: no password in env, argv or files it did not create). A TTY was
            // required at startup.
            const pw = await promptHidden('Keystore password: ');
            const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'aastar-keeper-'));
            passwordFilePath = path.join(dir, 'pw');
            await fs.promises.writeFile(passwordFilePath, pw, { mode: 0o600 });
        }
    }

    const updatesTodayByPaymaster = new Map<string, number>();
    let dayStartSec = nowSec();
    let lastHealthNotifySec = 0n;
    let tickIndex = 0;
    let lastExternalEthUsd: bigint | null = null;
    let lastExternalVolAlertSec = 0n;
    let lastChainlinkStaleAlertSec = 0n;
    let lastFeeCeilingAlertSec = 0n;
    let failedTicks = 0;
    let currentTick: Promise<void> | null = null;
    let lastSuperHealthOk: boolean | null = null;
    let lastPaymasterHealthOk: boolean | null = null;
    const chainlinkDecimalsCache = new Map<string, number>();

    const cleanup = async () => {
        try {
            if (passwordFilePath) {
                await fs.promises.rm(path.dirname(passwordFilePath), { recursive: true, force: true });
            }
        } catch {}
    };

    const waitForReceiptOrState = async (params: {
        kind: 'super' | 'paymaster';
        target: `0x${string}`;
        txHash: string;
        beforeUpdatedAt: bigint;
        expectedUpdatedAt: bigint;
    }): Promise<'receipt' | 'reverted' | 'state' | 'pending'> => {
        const hash = params.txHash as `0x${string}`;
        try {
            const receipt = await publicClient.waitForTransactionReceipt({
                hash,
                timeout: 10 * 60 * 1000,
                pollingInterval: 2000
            });
            // A reverted transaction is mined but did not update the price (KPR-020).
            return receiptOutcome(receipt);
        } catch (e: any) {
            const msg = e?.message || String(e);
            if (!/Timed out/i.test(msg)) throw e;
        }

        const deadlineMs = Date.now() + 10 * 60 * 1000;
        while (Date.now() < deadlineMs) {
            try {
                if (params.kind === 'super') {
                    const cache = await publicClient.readContract({
                        address: params.target,
                        abi: SUPERPAYMASTER_ABI,
                        functionName: 'cachedPrice'
                    });
                    const updatedAt = cache[1] as bigint;
                    if (updatedAt > params.beforeUpdatedAt && updatedAt >= params.expectedUpdatedAt) return 'state';
                } else {
                    const pmCache = await publicClient.readContract({
                        address: params.target,
                        abi: PAYMASTER_V4_ABI,
                        functionName: 'cachedPrice'
                    });
                    const updatedAt = (pmCache as any)?.updatedAt !== undefined ? (pmCache as any).updatedAt : (pmCache as any)[1];
                    const u = BigInt(updatedAt);
                    if (u > params.beforeUpdatedAt && u >= params.expectedUpdatedAt) return 'state';
                }
            } catch {}
            await sleepMs(3000);
        }
        return 'pending';
    };

    const onExit = async (signal: string) => {
        if (stopping) return;
        // From here no new transaction is signed (assertNotStopping). A `cast send` in flight is terminated and awaited
        // (SIGKILL after 5 s), then the running tick is allowed to finish (at most 15 s), so "stopped" is not reported
        // while anything can still sign or broadcast (KPR-008, Codex R1).
        stopping = true;
        const inFlight = activeCast;
        if (inFlight) {
            inFlight.child.kill('SIGTERM');
            const forced = setTimeout(() => inFlight.child.kill('SIGKILL'), 5_000);
            await inFlight.closed;
            clearTimeout(forced);
        }
        let tickSettled = true;
        if (currentTick) {
            let waited: ReturnType<typeof setTimeout> | undefined;
            tickSettled = await Promise.race([
                currentTick.then(() => true, () => true),
                new Promise<boolean>((r) => { waited = setTimeout(() => r(false), 15_000); }),
            ]);
            clearTimeout(waited);
        }
        // "stopped" only once nothing can still be signing or broadcasting; otherwise say so plainly.
        const status = tickSettled
            ? `stopped (${signal})${inFlight ? ': the cast send in flight was terminated first' : ''}`
            : `exited (${signal}) with a send in an unknown state: the tick did not finish within 15 s`;
        console.log(status);
        await sendTelegramMessage(
            `[keeper] ${status}\nnetwork=${network}\n` +
                `superPaymaster=${disableSuperPaymaster ? 'disabled' : superPaymaster}\n` +
                `paymaster=${disablePaymaster ? 'disabled' : paymaster || 'not-found'}`
        );
        await cleanup();
        process.exit(0);
    };

    process.on('SIGINT', () => void onExit('SIGINT'));
    process.on('SIGTERM', () => void onExit('SIGTERM'));

    await sendTelegramMessage(
        `[keeper] started\nnetwork=${network}\n` +
            `superPaymaster=${disableSuperPaymaster ? 'disabled' : superPaymaster}\n` +
            `paymaster=${disablePaymaster ? 'disabled' : paymaster || 'not-found'}\n` +
            `mode=${mode}\ndryRun=${dryRun}`
    );

    const getChainlinkDecimals = async (feed: `0x${string}`): Promise<number> => {
        const key = feed.toLowerCase();
        const cached = chainlinkDecimalsCache.get(key);
        if (cached !== undefined) return cached;
        const d = (await publicClient.readContract({ address: feed, abi: CHAINLINK_ABI, functionName: 'decimals' })) as number;
        chainlinkDecimalsCache.set(key, d);
        return d;
    };

    const toBpsChange = (prev: bigint, next: bigint): bigint | null => {
        if (prev <= 0n || next <= 0n) return null;
        const diff = prev > next ? prev - next : next - prev;
        return (diff * 10000n) / prev;
    };

    const normalizeDecimals = (value: bigint, fromDecimals: number, toDecimals: number): bigint => {
        if (fromDecimals === toDecimals) return value;
        if (fromDecimals < toDecimals) return value * 10n ** BigInt(toDecimals - fromDecimals);
        return value / 10n ** BigInt(fromDecimals - toDecimals);
    };

    const parseDecimalToFixed = (value: string, decimals: number): bigint | null => {
        const v = value.trim();
        const m = v.match(/^(-?\d+)(?:\.(\d+))?$/);
        if (!m) return null;
        const sign = m[1]?.startsWith('-') ? -1n : 1n;
        const intPart = m[1]?.replace('-', '') || '0';
        const fracRaw = m[2] || '';
        const frac = (fracRaw + '0'.repeat(decimals)).slice(0, decimals);
        const n = BigInt(intPart) * 10n ** BigInt(decimals) + BigInt(frac || '0');
        return sign * n;
    };

    const extractPriceString = (json: any): string | null => {
        if (json === null || json === undefined) return null;
        if (typeof json === 'number') return String(json);
        if (typeof json === 'string') return json;
        if (typeof json !== 'object') return null;
        if (typeof json.price === 'string' || typeof json.price === 'number') return String(json.price);
        if (typeof json.last === 'string' || typeof json.last === 'number') return String(json.last);
        if (typeof json.amount === 'string' || typeof json.amount === 'number') return String(json.amount);
        if (json.data && (typeof json.data.amount === 'string' || typeof json.data.amount === 'number')) return String(json.data.amount);
        return null;
    };

    const fetchExternalEthUsd = async (): Promise<{ price: bigint; decimals: number } | null> => {
        if (!externalEthUsdUrl) return null;
        try {
            // The 5 s deadline covers the body too, and the body is bounded: a slow or endless response cannot hold
            // the tick (Codex R6).
            const ctrl = new AbortController();
            const t = setTimeout(() => ctrl.abort(), 5000);
            let json: unknown;
            try {
                const res = await fetch(externalEthUsdUrl, { signal: ctrl.signal });
                if (!res.ok) return null;
                const text = await res.text();
                if (text.length > 65_536) return null;
                json = JSON.parse(text);
            } finally {
                clearTimeout(t);
            }
            const s = extractPriceString(json);
            if (!s) return null;
            const decimals = 8;
            const price = parseDecimalToFixed(s, decimals);
            if (price === null || price <= 0n) return null;
            return { price, decimals };
        } catch {
            return null;
        }
    };

    const tick = async () => {
        tickIndex += 1;
        console.log('');
        console.log(section(`TICK #${tickIndex} @ ${new Date().toISOString()}`));
        const currentSec = nowSec();

        if (currentSec - dayStartSec >= 86400n) {
            updatesTodayByPaymaster.clear();
            dayStartSec = currentSec;
        }

        // V4 resolution runs FIRST and cannot throw: an RPC outage or a failing SuperPaymaster read
        // below must not stop V4 from being re-resolved, nor its not-found alert from being
        // evaluated (see scripts/keeper/paymasterResolver.ts).
        if (!disablePaymaster) {
            paymaster = await paymasterTickStep(paymasterTracker, currentSec, {
                network,
                candidateLabel: paymasterCandidate || 'derive-from-factory',
                operator: paymasterOperator,
                log: (line) => console.log(line),
                notify: sendTelegramMessage,
            });
        }

        const latestBlock = await publicClient.getBlock({ blockTag: 'latest' });
        const baseFeePerGas = (latestBlock as any).baseFeePerGas as bigint | undefined;

        // SuperPaymaster's reads fail on their own: a failure here is reported, and the PaymasterV4 below is still
        // refreshed (KPR-016). With no read, refreshSuper does nothing (its zero defaults would read as "cache empty").
        const tickErrors: string[] = [];
        let superRead: { chainlinkUpdatedAt: bigint; superAnswer: bigint; cachedUpdatedAt: bigint; thresholdSec: bigint } | null = null;
        // A disabled SuperPaymaster is not read, so its failures cannot fail the tick (Codex R16).
        if (!disableSuperPaymaster) try {
            const chainlink = await publicClient.readContract({
                address: priceFeed,
                abi: CHAINLINK_ABI,
                functionName: 'latestRoundData'
            });
            const [cache, threshold] = await Promise.all([
                publicClient.readContract({
                    address: superPaymaster,
                    abi: SUPERPAYMASTER_ABI,
                    functionName: 'cachedPrice'
                }),
                publicClient.readContract({
                    address: superPaymaster,
                    abi: SUPERPAYMASTER_ABI,
                    functionName: 'priceStalenessThreshold'
                })
            ]);
            superRead = {
                chainlinkUpdatedAt: chainlink[3] as bigint, superAnswer: chainlink[1] as bigint,
                cachedUpdatedAt: cache[1] as bigint, thresholdSec: threshold as bigint,
            };
        } catch (e: any) {
            tickErrors.push(`superPaymaster reads: ${scrub(e?.message || String(e), 2000)}`);
        }
        const chainlinkUpdatedAt = superRead?.chainlinkUpdatedAt ?? 0n;
        const cachedUpdatedAt = superRead?.cachedUpdatedAt ?? 0n;
        const thresholdSec = superRead?.thresholdSec ?? 0n;

        const validUntil = cachedUpdatedAt + thresholdSec;
        const deadline = validUntil > safetyMarginSec ? validUntil - safetyMarginSec : 0n;
        const chainlinkAge = chainlinkUpdatedAt > 0n ? currentSec - chainlinkUpdatedAt : 0n;

        const baseFeeInfo = baseFeePerGas !== undefined ? `${formatGwei(baseFeePerGas)} gwei` : 'n/a';

        const superCacheOk = cachedUpdatedAt > 0n && validUntil > currentSec;
        let paymasterCacheOk: boolean | null = null;
        const superAnswer = superRead?.superAnswer ?? 0n;

        if (chainlinkStaleSec > 0n && chainlinkAge >= chainlinkStaleSec && currentSec - lastChainlinkStaleAlertSec >= volatilityCooldownSec) {
            lastChainlinkStaleAlertSec = currentSec;
            console.log(`alert kind=chainlink reason=stale ageSec=${chainlinkAge.toString()} thresholdSec=${chainlinkStaleSec.toString()}`);
            await sendTelegramMessage(
                `[keeper] chainlink stale\nnetwork=${network}\nfeed=${priceFeed}\nageSec=${chainlinkAge.toString()}\nthresholdSec=${chainlinkStaleSec.toString()}\n` +
                    `note=consider DVT forced update`
            );
        }

        // Market monitoring is advisory: its failure is logged and never stops either refresh (Codex R7).
        if (volatilityThresholdBps > 0n && externalEthUsdUrl) try {
            const ext = await fetchExternalEthUsd();
            if (ext) {
                if (lastExternalEthUsd !== null) {
                    const moveBps = toBpsChange(lastExternalEthUsd, ext.price);
                    if (
                        moveBps !== null &&
                        moveBps >= volatilityThresholdBps &&
                        currentSec - lastExternalVolAlertSec >= volatilityCooldownSec
                    ) {
                        lastExternalVolAlertSec = currentSec;
                        console.log(
                            `alert kind=market reason=move bps=${moveBps.toString()} thresholdBps=${volatilityThresholdBps.toString()}`
                        );
                        await sendTelegramMessage(
                            `[keeper] volatility alert\nnetwork=${network}\nsource=external\nbps=${moveBps.toString()}\nthresholdBps=${volatilityThresholdBps.toString()}\n` +
                                `note=consider DVT forced update`
                        );
                    }
                }

                const clDec = superRead ? await getChainlinkDecimals(priceFeed) : 0;
                const clNorm = normalizeDecimals(superAnswer, clDec, ext.decimals);
                const devBps = superRead ? toBpsChange(clNorm, ext.price) : null;
                if (
                    devBps !== null &&
                    devBps >= volatilityThresholdBps &&
                    currentSec - lastExternalVolAlertSec >= volatilityCooldownSec
                ) {
                    lastExternalVolAlertSec = currentSec;
                    console.log(
                        `alert kind=market reason=external-vs-chainlink bps=${devBps.toString()} thresholdBps=${volatilityThresholdBps.toString()}`
                    );
                    await sendTelegramMessage(
                        `[keeper] price deviation alert\nnetwork=${network}\nsource=external-vs-chainlink\nbps=${devBps.toString()}\nthresholdBps=${volatilityThresholdBps.toString()}\n` +
                            `note=consider DVT forced update`
                    );
                }

                lastExternalEthUsd = ext.price;
            }
        } catch (e: any) {
            console.warn(`market monitoring failed this tick: ${scrub(e?.message || String(e))}`);
        }

        const sendUpdate = async (target: `0x${string}`, kind: 'super' | 'paymaster', gasPriceWei?: bigint): Promise<string> => {
            if (mode === 'cast') {
                if (!passwordFilePath) throw new Error('cast mode requires password file (should have been created at startup)');
                if (!castSigner) throw new Error('cast mode requires --keystore or --cast-account');
                const servedChain = await publicClient.getChainId();
                if (servedChain !== config.chain.id) {
                    throw new Error(`before cast send: the RPC serves chain ${servedChain}, expected ${config.chain.id}; nothing was signed`);
                }
                assertNotStopping();
                return await runCastSend({
                    rpcUrl: config.rpcUrl,
                    chainId: config.chain.id,
                    target,
                    signerArgs: castSigner,
                    passwordFilePath,
                    gasPriceWei,
                    maxFeeWei: hardMaxFeeWei,
                    processTimeoutMs: 90_000
                });
            }
            if (!walletClient || !keeperAccount) throw new Error('privateKey mode requires KEEPER_PRIVATE_KEY');
            const abi = kind === 'super' ? SUPERPAYMASTER_ABI : PAYMASTER_V4_ABI;
            assertNotStopping();
            return await walletClient.writeContract({
                address: target,
                abi,
                functionName: 'updatePrice',
                account: keeperAccount,
                // The chain cannot charge more than the hard ceiling (KPR-006).
                ...(hardMaxFeeWei !== undefined ? { maxFeePerGas: hardMaxFeeWei } : {}),
            });
        };

        const feeCeilingAlert = async (label: string) => {
            console.log(`skip ${label} update: base fee ${baseFeeInfo} is above --hard-max-fee-gwei; nothing is sent`);
            if (currentSec - lastFeeCeilingAlertSec >= volatilityCooldownSec) {
                lastFeeCeilingAlertSec = currentSec;
                await sendTelegramMessage(`[keeper] fee above hard ceiling, ${label} not updated\nnetwork=${network}\nbaseFee=${baseFeeInfo}`);
            }
        };

        const refreshSuper = async () => {
            if (disableSuperPaymaster) return;
            if (!superRead) return; // reads failed this tick: reported below, never treated as an empty cache
            const shouldUpdate =
                cachedUpdatedAt === 0n ||
                (currentSec >= deadline && chainlinkUpdatedAt > cachedUpdatedAt && chainlinkUpdatedAt + thresholdSec >= currentSec);

            const remainingSec = validUntil > currentSec ? validUntil - currentSec : 0n;
            const decision = shouldUpdate ? (dryRun ? 'dry-run:update' : 'update') : 'wait';
            const reason = (() => {
                if (cachedUpdatedAt === 0n) return 'cache-empty';
                if (currentSec < deadline) return 'still-valid';
                if (chainlinkUpdatedAt <= cachedUpdatedAt) return 'no-new-chainlink-round';
                if (chainlinkUpdatedAt + thresholdSec < currentSec) return 'chainlink-round-too-old';
                return 'triggered';
            })();
            console.log(
                `super decision=${decision} reason=${reason} remainingSec=${remainingSec.toString()} thresholdSec=${thresholdSec.toString()} ` +
                    `cache.updatedAt=${formatTs(cachedUpdatedAt)} chainlink.updatedAt=${formatTs(chainlinkUpdatedAt)} baseFee=${baseFeeInfo}`
            );

            if (!shouldUpdate) return;
            const fee = feeDecision({ baseFeeWei: baseFeePerGas, maxBaseFeeWei, hardMaxFeeWei, nearExpiry: currentSec + 180n >= validUntil });
            if (fee === 'skip-soft') {
                console.log(`skip superPaymaster update: base fee above threshold (maxBaseFeeGwei=${maxBaseFeeGwei})`);
                return;
            }
            if (fee === 'skip-hard') {
                await feeCeilingAlert('superPaymaster');
                return;
            }

            const updatesToday = updatesTodayByPaymaster.get(superPaymaster) || 0;
            if (updatesToday >= maxUpdatesPerDay) {
                console.log(`skip superPaymaster update: reached maxUpdatesPerDay=${maxUpdatesPerDay}`);
                return;
            }

            if (dryRun) {
                console.log(`action=sendTx kind=super method=updatePrice() target=${superPaymaster} (dry-run)`);
                return;
            }

            console.log(`action=sendTx kind=super method=updatePrice() target=${superPaymaster}`);
            let sendGasPrice: bigint | undefined;
            try { sendGasPrice = await publicClient.getGasPrice(); } catch {}
            const txHash = await sendUpdate(superPaymaster, 'super', sendGasPrice);
            updatesTodayByPaymaster.set(superPaymaster, updatesToday + 1);

            if (txHash) {
                const confirmedBy = await waitForReceiptOrState({
                    kind: 'super',
                    target: superPaymaster,
                    txHash,
                    beforeUpdatedAt: cachedUpdatedAt,
                    expectedUpdatedAt: chainlinkUpdatedAt
                });
                if (confirmedBy === 'reverted') {
                    console.error(`reverted: kind=super tx=${txHash} (mined, price not updated)`);
                    await sendTelegramMessage(`[keeper] superPaymaster updatePrice REVERTED\nnetwork=${network}\ntarget=${superPaymaster}\ntx=${txHash}`);
                    throw new Error(`superPaymaster updatePrice reverted: tx=${txHash}`);
                }
                if (confirmedBy === 'receipt') {
                    console.log(`confirmed: receipt kind=super tx=${txHash}`);
                } else if (confirmedBy === 'state') {
                    console.log(`confirmed: state-change kind=super tx=${txHash}`);
                } else {
                    console.log(`pending: kind=super tx=${txHash} (receipt timeout; will re-check next tick)`);
                }
                console.log(`updated: superPaymaster tx=${txHash}`);
                await sendTelegramMessage(
                    `[keeper] superPaymaster updatePrice broadcast\nnetwork=${network}\ntarget=${superPaymaster}\ntx=${txHash}\nconfirmed=${confirmedBy}`
                );
            } else {
                console.log(`updated: tx hash not detected (cast output parse) target=${superPaymaster}`);
            }
        };

        const refreshPaymaster = async () => {
            if (disablePaymaster) return;
            if (!paymaster) return; // unresolved this tick — logged / alerted at the top of the tick

            let pmPriceFeed = priceFeed;
            try {
                const f = (await publicClient.readContract({
                    address: paymaster,
                    abi: PAYMASTER_V4_ABI,
                    functionName: 'ethUsdPriceFeed'
                })) as `0x${string}`;
                if (f && f.toLowerCase() !== ZERO_ADDRESS) pmPriceFeed = f;
            } catch {}

            const pmChainlink = await publicClient.readContract({
                address: pmPriceFeed,
                abi: CHAINLINK_ABI,
                functionName: 'latestRoundData'
            });
            const pmChainlinkUpdatedAt = pmChainlink[3] as bigint;
            const pmChainlinkAge = pmChainlinkUpdatedAt > 0n ? currentSec - pmChainlinkUpdatedAt : 0n;
            if (
                chainlinkStaleSec > 0n &&
                pmChainlinkAge >= chainlinkStaleSec &&
                currentSec - lastChainlinkStaleAlertSec >= volatilityCooldownSec
            ) {
                lastChainlinkStaleAlertSec = currentSec;
                console.log(
                    `alert kind=chainlink reason=stale ageSec=${pmChainlinkAge.toString()} thresholdSec=${chainlinkStaleSec.toString()}`
                );
                await sendTelegramMessage(
                    `[keeper] chainlink stale\nnetwork=${network}\nfeed=${pmPriceFeed}\nageSec=${pmChainlinkAge.toString()}\nthresholdSec=${chainlinkStaleSec.toString()}\n` +
                        `note=consider DVT forced update`
                );
            }

            const [pmCache, pmThreshold] = await Promise.all([
                publicClient.readContract({
                    address: paymaster,
                    abi: PAYMASTER_V4_ABI,
                    functionName: 'cachedPrice'
                }),
                publicClient.readContract({
                    address: paymaster,
                    abi: PAYMASTER_V4_ABI,
                    functionName: 'priceStalenessThreshold'
                })
            ]);

            const pmCachedUpdatedAt = (pmCache as any)?.updatedAt !== undefined ? (pmCache as any).updatedAt : (pmCache as any)[1];
            const pmThresholdSec = pmThreshold as bigint;

            const pmValidUntil = BigInt(pmCachedUpdatedAt) + pmThresholdSec;
            const pmDeadline = pmValidUntil > safetyMarginSec ? pmValidUntil - safetyMarginSec : 0n;
            paymasterCacheOk = BigInt(pmCachedUpdatedAt) > 0n && pmValidUntil > currentSec;

            const shouldUpdate =
                BigInt(pmCachedUpdatedAt) === 0n ||
                (currentSec >= pmDeadline && pmChainlinkUpdatedAt > BigInt(pmCachedUpdatedAt) && pmChainlinkUpdatedAt + pmThresholdSec >= currentSec);

            const pmRemainingSec = pmValidUntil > currentSec ? pmValidUntil - currentSec : 0n;
            const decision = shouldUpdate ? (dryRun ? 'dry-run:update' : 'update') : 'wait';
            const reason = (() => {
                const cached = BigInt(pmCachedUpdatedAt);
                if (cached === 0n) return 'cache-empty';
                if (currentSec < pmDeadline) return 'still-valid';
                if (pmChainlinkUpdatedAt <= cached) return 'no-new-chainlink-round';
                if (pmChainlinkUpdatedAt + pmThresholdSec < currentSec) return 'chainlink-round-too-old';
                return 'triggered';
            })();
            console.log(
                `paymaster decision=${decision} reason=${reason} remainingSec=${pmRemainingSec.toString()} thresholdSec=${pmThresholdSec.toString()} ` +
                    `cache.updatedAt=${formatTs(BigInt(pmCachedUpdatedAt))} chainlink.updatedAt=${formatTs(pmChainlinkUpdatedAt)} baseFee=${baseFeeInfo}`
            );

            if (!shouldUpdate) return;
            const fee = feeDecision({ baseFeeWei: baseFeePerGas, maxBaseFeeWei, hardMaxFeeWei, nearExpiry: currentSec + 180n >= pmValidUntil });
            if (fee === 'skip-soft') {
                console.log(`skip paymaster update: base fee above threshold (maxBaseFeeGwei=${maxBaseFeeGwei})`);
                return;
            }
            if (fee === 'skip-hard') {
                await feeCeilingAlert('paymaster');
                return;
            }

            const updatesToday = updatesTodayByPaymaster.get(paymaster) || 0;
            if (updatesToday >= maxUpdatesPerDay) {
                console.log(`skip paymaster update: reached maxUpdatesPerDay=${maxUpdatesPerDay}`);
                return;
            }

            if (dryRun) {
                console.log(`action=sendTx kind=paymaster method=updatePrice() target=${paymaster} (dry-run)`);
                return;
            }

            console.log(`action=sendTx kind=paymaster method=updatePrice() target=${paymaster}`);
            let sendGasPrice: bigint | undefined;
            try { sendGasPrice = await publicClient.getGasPrice(); } catch {}
            const txHash = await sendUpdate(paymaster, 'paymaster', sendGasPrice);
            updatesTodayByPaymaster.set(paymaster, updatesToday + 1);

            if (txHash) {
                const confirmedBy = await waitForReceiptOrState({
                    kind: 'paymaster',
                    target: paymaster,
                    txHash,
                    beforeUpdatedAt: BigInt(pmCachedUpdatedAt),
                    expectedUpdatedAt: pmChainlinkUpdatedAt
                });
                if (confirmedBy === 'reverted') {
                    console.error(`reverted: kind=paymaster tx=${txHash} (mined, price not updated)`);
                    await sendTelegramMessage(`[keeper] paymaster updatePrice REVERTED\nnetwork=${network}\ntarget=${paymaster}\ntx=${txHash}`);
                    throw new Error(`paymaster updatePrice reverted: tx=${txHash}`);
                }
                if (confirmedBy === 'receipt') {
                    console.log(`confirmed: receipt kind=paymaster tx=${txHash}`);
                } else if (confirmedBy === 'state') {
                    console.log(`confirmed: state-change kind=paymaster tx=${txHash}`);
                } else {
                    console.log(`pending: kind=paymaster tx=${txHash} (receipt timeout; will re-check next tick)`);
                }
                console.log(`updated: paymaster tx=${txHash}`);
                await sendTelegramMessage(
                    `[keeper] paymaster updatePrice broadcast\nnetwork=${network}\ntarget=${paymaster}\ntx=${txHash}\nconfirmed=${confirmedBy}`
                );
            } else {
                console.log(`updated: tx hash not detected (cast output parse) target=${paymaster}`);
            }
        };

        // Each target is refreshed even when the other one fails (KPR-016); the failures are reported together.
        try { await refreshSuper(); } catch (e: any) { tickErrors.push(`superPaymaster: ${e?.message || String(e)}`); }
        try { await refreshPaymaster(); } catch (e: any) { tickErrors.push(`paymaster: ${e?.message || String(e)}`); }

        const superHealth = disableSuperPaymaster ? 'disabled' : superCacheOk ? '✅' : 'not-ok';
        const paymasterHealth =
            disablePaymaster ? 'disabled' : !paymaster ? 'not-found' : paymasterCacheOk === null ? 'unknown' : paymasterCacheOk ? '✅' : 'not-ok';
        console.log(`health superCache=${superHealth} paymasterCache=${paymasterHealth}`);

        const superOk = disableSuperPaymaster ? true : superCacheOk;
        const pmOk = disablePaymaster ? true : !paymaster ? false : Boolean(paymasterCacheOk);

        const healthChanged =
            (lastSuperHealthOk !== null && lastSuperHealthOk !== superOk) || (lastPaymasterHealthOk !== null && lastPaymasterHealthOk !== pmOk);
        lastSuperHealthOk = superOk;
        lastPaymasterHealthOk = pmOk;

        if (telegramEnabled && healthChanged) {
            await sendTelegramMessage(
                `[keeper] health change\nnetwork=${network}\n` +
                    `super=${disableSuperPaymaster ? 'disabled' : superOk ? '✅ ok' : 'not-ok'} remainingSec=${(validUntil > currentSec ? validUntil - currentSec : 0n).toString()}\n` +
                    `paymaster=${disablePaymaster ? 'disabled' : !paymaster ? 'not-found' : pmOk ? '✅ ok' : 'not-ok'}\n` +
                    `baseFee=${baseFeeInfo}`
            );
        }

        if (telegramEnabled && currentSec - lastHealthNotifySec >= healthIntervalSec && superOk && pmOk) {
            lastHealthNotifySec = currentSec;
            await sendTelegramMessage(
                `[keeper] ✅ health ok\nnetwork=${network}\n✅ super=ok\n✅ paymaster=ok\nbaseFee=${baseFeeInfo}`
            );
        }
        if (tickErrors.length > 0) throw new Error(tickErrors.join('; '));
    };

    for (;;) {
        if (stopping) break;
        try {
            currentTick = tick();
            await currentTick;
        } catch (e: any) {
            failedTicks += 1;
            const msg = scrub(e?.message || String(e), 1000);
            console.error(`[${new Date().toISOString()}] error: ${msg}`);
            try {
                await sendTelegramMessage(`[keeper] error\nnetwork=${network}\nmsg=${msg}`);
            } catch {}
        }

        if (once) break;
        console.log('');
        console.log(section(`SLEEP ${pollIntervalSec.toString()}s`));
        await new Promise((r) => setTimeout(r, Number(pollIntervalSec) * 1000));
    }

    await cleanup();
    // --once reports the tick's outcome: a scheduler sees a failed run as a failure (KPR-011).
    if (once && failedTicks > 0) process.exitCode = 1;
}

main().catch(async (e) => {
    // A startup refusal is a configuration error: print it and exit, with no outbound request at all.
    if (e instanceof KeeperStartupRefusal || startupPhase) {
        console.error(`refused: ${e.message}`);
        process.exit(1);
    }
    try {
        await sendTelegramMessage(`[keeper] fatal\nmsg=${scrub(e?.message || String(e), 1000)}`);
    } catch {}
    // Never the raw error object: a transport error carries the RPC URL and request context (Codex R4).
    console.error(`fatal: ${scrub(e?.message || String(e), 1000)}`);
    process.exit(1);
});
