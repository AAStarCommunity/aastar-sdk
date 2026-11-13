import { createPublicClient, encodeFunctionData, formatGwei, http, isAddress, parseAbi, type Address, type Chain, type Hex, type PublicClient } from 'viem';
import { anvil, mainnet, optimism, optimismSepolia, sepolia } from 'viem/chains';
import { CANONICAL_ADDRESSES } from '../packages/core/src/addresses.js';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { fileURLToPath } from 'node:url';
import { noteBalance, type BalanceClock } from './keeper/balanceAlert.js';
import { absoluteKeeperPath } from './keeper/cliPaths.js';
import { createCastSigner, killCastChildren } from './keeper/castSigner.js';
import { readDeploymentAddresses, type DeploymentAddresses } from './keeper/deploymentConfig.js';
import { acquireKeeperLock, Journal, pinJournalDirectory, setJournalDeadlineAlert } from './keeper/journal.js';
import { aclAllowsOthers } from './keeper/acl.js';
import { criticalEventForGate, deliverCritical, exitAfterDrain, isCriticalEvent, resolveCritical, retryCritical, retryHeldCritical, trackAlert, type CriticalEvent } from './keeper/exitAlerts.js';
import { rollupHealth } from './keeper/healthRollup.js';
import { freshReadAlerts, noteTargetRead } from './keeper/readAlert.js';
import { manualStallCommand, Sender, type MaintainResult, type SendResult, type SettlementEvent } from './keeper/sender.js';
import { envFileRefusal, type ModeStat } from './keeper/startupGuards.js';
import { pinCastBin } from './keeper/trustedExecutable.js';
import { checkSignerIdentity, DEPLOYER_ADDRESS, type IdentityResult } from './keeper/signerGuard.js';
import { adaptChainIO, adaptHeadChain, asIdentityChain } from './keeper/viemAdapter.js';
import { identityDue, scheduledIdentityAt } from './keeper/identitySchedule.js';
import { decideIdentityGate, gateAfterIdentityRead, identityTargetKey, priceClosedByTargetDrift } from './keeper/identityGate.js';
import { cacheConfirms, describePriceSend, loopErrorReport, noteRefusal } from './keeper/priceConfirm.js';
import { KEEPER_ENV_ALLOW, parseKeeperEnv, secretEnvNames } from './keeper/secretEnv.js';
import { runKeeperStep } from './keeper/keeperStep.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

type NetworkName = 'anvil' | 'sepolia' | 'op-sepolia' | 'op-mainnet' | 'mainnet';

let activeNetwork = 'unknown';

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

/** viem decodes uint48 as a number. Both shapes are the on-chain updatedAt. */
function cachedUpdatedAtSec(cache: unknown): bigint | null {
    const raw = Array.isArray(cache) ? cache[1] : (cache as { updatedAt?: unknown } | null)?.updatedAt;
    if (typeof raw === 'bigint' && raw >= 0n) return raw;
    if (typeof raw === 'number' && Number.isSafeInteger(raw) && raw >= 0) return BigInt(raw);
    return null;
}

const CHAINLINK_ABI = parseAbi([
    'function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
    'function decimals() view returns (uint8)'
]);

function getArgValue(args: string[], key: string): string | undefined {
    const idx = args.indexOf(key);
    if (idx < 0) return undefined;
    return args[idx + 1];
}

function requireArgValue(args: string[], key: string): string | undefined {
    const idx = args.indexOf(key);
    if (idx < 0) return undefined;
    const next = args[idx + 1];
    if (next === undefined || next.startsWith('--')) throw new Error(`keeper: ${key} requires a value`);
    return next;
}

function hasFlag(args: string[], key: string): boolean {
    return args.includes(key);
}

const BOOLEAN_FLAGS = new Set([
    '--help', '-h', '--dry-run', '--once', '--logo', '--no-logo', '--probe-env',
    '--clear-stall',
    '--no-superpaymaster', '--disable-superpaymaster', '--no-paymaster', '--disable-paymaster',
    '--mode', '--cast-account',
    '--pause-config', '--pause-interval-sec', '--pause-offset-sec', '--role-sync-budget-sec', '--resync-journal',
]);

const VALUE_FLAGS = new Set([
    '--network', '--keystore', '--password-file', '--signer', '--cast-bin', '--journal', '--env-file', '--registry',
    '--low-balance-wei', '--superpaymaster', '--paymaster', '--price-feed', '--max-fee-gwei', '--max-tip-gwei',
    '--stall-sec', '--max-gas',
    '--poll-interval', '--safety-margin', '--max-updates-per-day', '--min-update-interval',
    '--max-base-fee-gwei', '--health-interval', '--volatility-threshold-bps', '--volatility-cooldown',
    '--chainlink-stale-sec', '--external-ethusd-url',
]);

/** Reject unknown tokens and `--name=value`. The message names the option and never prints a value. */
function rejectUnknownArgs(args: string[]): void {
    for (let i = 0; i < args.length; i++) {
        const token = args[i] ?? '';
        if (!token.startsWith('-')) throw new Error('keeper: unrecognized argument');
        const eq = token.indexOf('=');
        const name = (eq >= 0 ? token.slice(0, eq) : token).slice(0, 80);
        if (eq >= 0 || name.length === 0) throw new Error(`keeper: unrecognized option ${name}`);
        if (VALUE_FLAGS.has(name)) {
            const next = args[i + 1];
            if (next === undefined || next.startsWith('--')) throw new Error(`keeper: ${name} requires a value`);
            i += 1;
            continue;
        }
        if (!BOOLEAN_FLAGS.has(name)) throw new Error(`keeper: unrecognized option ${name}`);
    }
}

function flagPath(args: string[], key: string): string | undefined {
    const raw = getArgValue(args, key);
    if (raw === undefined) return undefined;
    return absoluteKeeperPath(process.cwd(), raw);
}

function modeStat(st: fs.Stats): ModeStat {
    return {
        isFile: st.isFile(),
        isDirectory: st.isDirectory(),
        isSymbolicLink: st.isSymbolicLink(),
        uid: st.uid,
        mode: st.mode,
    };
}

async function readKeeperEnvFile(filePath: string): Promise<Record<string, string>> {
    let fh: fs.promises.FileHandle;
    try {
        fh = await fs.promises.open(filePath, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
    } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === 'ELOOP') throw new Error('keeper: env file refused: not a regular file');
        throw new Error('keeper: env file refused');
    }
    try {
        const st = await fh.stat();
        let parent: fs.Stats;
        try {
            parent = await fs.promises.lstat(path.dirname(filePath));
        } catch {
            throw new Error('keeper: env file refused: parent');
        }
        const reason = envFileRefusal(modeStat(st), modeStat(parent), process.getuid?.());
        if (reason) throw new Error(reason);
        if (aclAllowsOthers(filePath) || aclAllowsOthers(path.dirname(filePath))) {
            throw new Error('keeper: env file refused: acl');
        }
        if (st.size > 65_536) throw new Error('keeper: env file refused');
        const text = await fh.readFile({ encoding: 'utf8' });
        const parsed = parseKeeperEnv(text);
        if (!parsed.ok) throw new Error(`keeper: env file key refused: ${parsed.key}`);
        return parsed.values;
    } finally {
        await fh.close();
    }
}

/**
 * Pin an absolute cast path. PATH is not searched. The pin is mix-up protection
 * (device and inode), not a trust boundary. Ownership and mode belong to preflight.
 */
function resolveCastBin(chosen: string | undefined): string {
    if (chosen === undefined || chosen.length === 0 || chosen.length > 4_096 || chosen.includes('\0') || !path.isAbsolute(chosen)) {
        throw new Error('keeper: cast bin refused: not absolute');
    }
    return pinCastBin(chosen).path;
}

/** Flag wins. Otherwise the first present env key. The error names the flag or the key, never the value. */
function parseFlagOrEnv(args: string[], flag: string, envKeys: readonly string[], fallback: number, min: number, max: number): number {
    const fromFlag = getArgValue(args, flag);
    if (fromFlag !== undefined) return parseBoundedInt(fromFlag, fallback, min, max, flag);
    for (let i = 0; i < envKeys.length; i++) {
        const key = envKeys[i] ?? '';
        const value = process.env[key];
        if (value === undefined || value.length === 0) continue;
        return parseBoundedInt(value, fallback, min, max, key);
    }
    return fallback;
}

function parseBoundedInt(raw: string | undefined, fallback: number, min: number, max: number, label: string): number {
    if (raw === undefined) return fallback;
    if (raw.length === 0 || raw.length > 8) throw new Error(`keeper: ${label} invalid`);
    let n = 0;
    for (let i = 0; i < raw.length; i++) {
        const c = raw.charCodeAt(i);
        if (c < 48 || c > 57) throw new Error(`keeper: ${label} invalid`);
        n = n * 10 + (c - 48);
    }
    if (!Number.isInteger(n) || n < min || n > max) throw new Error(`keeper: ${label} invalid`);
    return n;
}

/** Live runs must name a fee ceiling. 1..10000 gwei. */
function parseMaxFeeWei(raw: string | undefined, required: boolean): bigint | null {
    if (raw === undefined) {
        if (required) throw new Error('keeper: --max-fee-gwei is required for a live run');
        return null;
    }
    const gwei = parseBoundedInt(raw, 0, 1, 10_000, '--max-fee-gwei');
    return BigInt(gwei) * 1_000_000_000n;
}

function drainBudgetMs(): number {
    const raw = process.env.KEEPER_DRAIN_MS;
    if (raw === undefined || raw.length === 0) return 120_000;
    return parseBoundedInt(raw, 120_000, 1, 120_000, 'KEEPER_DRAIN_MS');
}

function pickAddr(flag: string | undefined, canonicalValue: unknown, deployedValue: string | undefined): `0x${string}` | undefined {
    const chosen = flag || (typeof canonicalValue === 'string' ? canonicalValue : '') || deployedValue || '';
    if (!chosen || !isAddress(chosen)) return undefined;
    return chosen as `0x${string}`;
}

async function requireMatchingChain(client: PublicClient, expected: number): Promise<void> {
    let raw: unknown;
    try {
        raw = await client.request({ method: 'eth_chainId' });
    } catch {
        throw new Error('keeper: chain id unreadable');
    }
    if (typeof raw !== 'string' || raw.length < 3 || raw.length > 66) throw new Error('keeper: chain id unreadable');
    if (raw.charCodeAt(0) !== 48 || raw.charCodeAt(1) !== 120) throw new Error('keeper: chain id unreadable');
    let id: bigint;
    try {
        id = BigInt(raw);
    } catch {
        throw new Error('keeper: chain id unreadable');
    }
    if (id <= 0n || id > BigInt(Number.MAX_SAFE_INTEGER) || Number(id) !== expected) {
        throw new Error(id <= 0n || id > BigInt(Number.MAX_SAFE_INTEGER) ? 'keeper: chain id unreadable' : 'keeper: chain id mismatch');
    }
}

function nowSec(): bigint {
    return BigInt(Math.floor(Date.now() / 1000));
}

function formatTs(ts: bigint): string {
    if (ts <= 0n) return '0';
    return new Date(Number(ts) * 1000).toISOString();
}

async function postTelegramOnce(text: string): Promise<boolean> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return true;
    const axios = (await import('axios')).default;
    try {
        await axios.post(
            `https://api.telegram.org/bot${token}/sendMessage`,
            { chat_id: chatId, text, disable_web_page_preview: true },
            { timeout: 10_000 }
        );
        return true;
    } catch {
        return false;
    }
}

async function sendTelegramMessage(text: string, event?: CriticalEvent): Promise<boolean> {
    if (event && isCriticalEvent(event)) {
        const work = deliverTelegram(text, event);
        trackAlert(work);
        return work;
    }
    const work = (async () => {
        const ok = await postTelegramOnce(text);
        if (!ok) console.warn('[telegram] sendMessage failed');
        return ok;
    })();
    trackAlert(work);
    return work;
}

async function deliverTelegram(text: string, event: CriticalEvent): Promise<boolean> {
    return deliverCritical({
        event,
        message: text,
        now: Date.now(),
        send: (message) => retryCritical(() => postTelegramOnce(message), true, 10_000),
    });
}

async function finish(code: number): Promise<never> {
    await exitAfterDrain((status) => process.exit(status), code, 10_000);
    throw new Error('keeper: exit failed');
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
            'Telegram config invalid: TELEGRAM_CHAT_ID must be a numeric chat id (e.g. 123456789 or -100123...) or start with @ (e.g. @MyChannel)'
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
        'Live runs sign with cast mktx (the key never enters this process):',
        '   pnpm exec tsx scripts/keeper.ts --network sepolia \\',
        '     --keystore <path> --password-file <path> --signer <address>',
        '',
        'The password file is mode 0600 inside a 0700 directory owned by this user.',
        '--dry-run signs nothing and does not need a keystore.',
        '',
        'Common flags:',
        '   --poll-interval <sec>       check interval (e.g. 180)',
        '   --safety-margin <sec>       refresh before expiry (e.g. 600)',
        '   --dry-run                   print actions without sending tx',
        '   --once                      run one tick then exit',
        '   --keystore <path>           encrypted keystore (required unless --dry-run)',
        '   --password-file <path>      keystore password file, mode 0600 (required unless --dry-run)',
        '   --signer <address>          address cast must recover (required unless --dry-run)',
        '   --cast-bin <path>           absolute cast binary (required for a live run)',
        '   --journal <path>            nonce journal (default: ~/.aastar-keeper/<network>.journal.json)',
        '   --env-file <path>           explicit env file; only allowlisted keys are accepted',
        '   --registry <address>        registry used for signer identity',
        '   --low-balance-wei <n>       signer balance alert threshold',
        '   --no-superpaymaster         disable SuperPaymaster updates',
        '   --no-paymaster              disable PaymasterV4 updates',
        '   --max-updates-per-day <n>   per-target limit (default 24)',
        '   --max-base-fee-gwei <n>     skip updates if base fee too high',
        '   --max-fee-gwei <n>          fee ceiling for a live run (required, 1..10000)',
        '   --max-tip-gwei <n>          priority fee cap (default 2, 0 allowed)',
        '   --stall-sec <n>             in-flight stall window (default 600)',
        '   --clear-stall               one-shot after a human replacement is mined',
        '   --max-gas <n>               gas limit ceiling for updatePrice (default 500000)',
        '   --min-update-interval <sec> minimum cachedPrice age before a price tx is signed',
        '   --price-feed <address>      Chainlink ETH/USD feed override',
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
        '',
        'Networks: anvil | sepolia | op-sepolia | op-mainnet | mainnet',
        'Config: pass RPC_URL in the environment or in --env-file. .env.<network> is not read.'
    ].join('\n');
}

function shortUsage(): string {
    return [
        `help: pnpm exec tsx scripts/keeper.ts --help`,
        `example: pnpm exec tsx scripts/keeper.ts --network op-mainnet --poll-interval 180 --safety-margin 600`,
        `telegram: set TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID (bot ${TELEGRAM_BOT_USERNAME})`,
        `health: --health-interval 1800 (telegram periodic ok status)`,
        `anomaly: --external-ethusd-url <url> --volatility-threshold-bps 150 (1.50%)`
    ].join('\n');
}

function parseWeiFlag(raw: string | undefined, fallback: bigint): bigint {
    if (raw === undefined) return fallback;
    if (raw.length === 0 || raw.length > 40) throw new Error('keeper: --low-balance-wei invalid');
    for (let i = 0; i < raw.length; i++) {
        const c = raw.charCodeAt(i);
        if (c < 48 || c > 57) throw new Error('keeper: --low-balance-wei invalid');
    }
    return BigInt(raw);
}

function parseSignerFlag(raw: string | undefined, required: boolean): Address | null {
    if (!raw) {
        if (required) throw new Error('keeper: --signer is required unless --dry-run');
        return null;
    }
    if (raw.length !== 42 || !isAddress(raw)) throw new Error('keeper: --signer invalid');
    if (raw !== raw.toLowerCase() && !isAddress(raw, { strict: true })) throw new Error('keeper: --signer invalid');
    return raw as Address;
}

const LOW_BALANCE_SEPOLIA = 20_000_000_000_000_000n;
const LOW_BALANCE_OTHER = 5_000_000_000_000_000n;

async function main() {
    installPipeSafety();
    const args = process.argv.slice(2).filter((a) => a !== '--');
    rejectUnknownArgs(args);
    if (hasFlag(args, '--help') || hasFlag(args, '-h')) {
        console.log(section('HELP'));
        console.log(usage());
        return;
    }
    const network = (getArgValue(args, '--network') || 'op-sepolia') as NetworkName;
    if (!['anvil', 'sepolia', 'op-sepolia', 'op-mainnet', 'mainnet'].includes(network)) {
        throw new Error('keeper: network rejected');
    }
    activeNetwork = network;
    if (hasFlag(args, '--mode') || hasFlag(args, '--cast-account')) {
        throw new Error('keeper: --mode and --cast-account were removed; use --keystore --password-file --signer');
    }
    for (const gone of ['--pause-config', '--pause-interval-sec', '--pause-offset-sec', '--role-sync-budget-sec', '--resync-journal']) {
        if (hasFlag(args, gone)) throw new Error(`keeper: ${gone} is not part of the price keeper`);
    }
    const dryRun = hasFlag(args, '--dry-run');
    const keystorePath = flagPath(args, '--keystore');
    const passwordFilePath = flagPath(args, '--password-file');
    const signerAddress = parseSignerFlag(getArgValue(args, '--signer'), !dryRun ? true : Boolean(getArgValue(args, '--signer')));
    const castBinArg = getArgValue(args, '--cast-bin');
    if (!dryRun && (!keystorePath || !passwordFilePath || !signerAddress)) {
        throw new Error('keeper: live runs require --keystore, --password-file and --signer');
    }
    const maxFeeWei = parseMaxFeeWei(getArgValue(args, '--max-fee-gwei'), !dryRun && Boolean(keystorePath));
    const maxTipWei = BigInt(parseBoundedInt(getArgValue(args, '--max-tip-gwei'), 2, 0, 10_000, '--max-tip-gwei')) * 1_000_000_000n;
    const stallSec = parseBoundedInt(getArgValue(args, '--stall-sec'), 600, 1, 86_400, '--stall-sec');
    const clearStall = hasFlag(args, '--clear-stall');
    const maxGas = BigInt(parseBoundedInt(getArgValue(args, '--max-gas'), 500_000, 21_000, 30_000_000, '--max-gas'));
    const pollIntervalSec = BigInt(parseBoundedInt(getArgValue(args, '--poll-interval'), 30, 1, 86_400, '--poll-interval'));
    const minUpdateFlag = getArgValue(args, '--min-update-interval') === undefined
        ? null
        : parseBoundedInt(getArgValue(args, '--min-update-interval'), 1, 1, 86_400 * 365, '--min-update-interval');
    const journalArg = getArgValue(args, '--journal');
    const journalPath = journalArg === undefined
        ? path.join(os.homedir(), '.aastar-keeper', `${network}.journal.json`)
        : absoluteKeeperPath(process.cwd(), journalArg);
    const envFile = flagPath(args, '--env-file');
    const registryFlagRaw = requireArgValue(args, '--registry');
    const registryFlag = registryFlagRaw
        ? (isAddress(registryFlagRaw) ? registryFlagRaw as Address : null)
        : null;
    if (registryFlagRaw && !registryFlag) throw new Error('keeper: --registry invalid');
    const lowBalanceWei = parseWeiFlag(
        getArgValue(args, '--low-balance-wei'),
        network === 'sepolia' ? LOW_BALANCE_SEPOLIA : LOW_BALANCE_OTHER,
    );
    const safetyMarginSec = BigInt(parseBoundedInt(getArgValue(args, '--safety-margin'), 600, 0, 31_536_000, '--safety-margin'));
    const maxUpdatesPerDay = parseBoundedInt(getArgValue(args, '--max-updates-per-day'), 24, 1, 100_000, '--max-updates-per-day');
    const maxBaseFeeGweiRaw = getArgValue(args, '--max-base-fee-gwei');
    const maxBaseFeeWei = maxBaseFeeGweiRaw === undefined
        ? null
        : BigInt(parseBoundedInt(maxBaseFeeGweiRaw, 0, 0, 1_000_000, '--max-base-fee-gwei')) * 1_000_000_000n;
    const once = hasFlag(args, '--once');
    const printLogo = hasFlag(args, '--logo') || !hasFlag(args, '--no-logo');
    const disableSuperPaymaster = hasFlag(args, '--no-superpaymaster') || hasFlag(args, '--disable-superpaymaster');
    const disablePaymaster = hasFlag(args, '--no-paymaster') || hasFlag(args, '--disable-paymaster');

    const secretNames = secretEnvNames(process.env);
    if (secretNames.length > 0) {
        for (const name of secretNames) console.error(`keeper: secret env refused: ${name}`);
        process.exit(1);
    }
    if (envFile) {
        const loaded = await readKeeperEnvFile(envFile);
        for (const key of KEEPER_ENV_ALLOW) {
            const value = loaded[key];
            if (value !== undefined) process.env[key] = value;
        }
    }
    assertTelegramConfigValid();
    const castFromEnv = process.env.KEEPER_CAST_BIN;
    const castSource: 'cli' | 'env' | 'default' = castBinArg !== undefined
        ? 'cli'
        : typeof castFromEnv === 'string' && castFromEnv.length > 0
            ? 'env'
            : 'default';
    const castChosen = castSource === 'cli' ? castBinArg : castSource === 'env' ? castFromEnv : undefined;
    const castBin = (!dryRun || castSource !== 'default') ? resolveCastBin(castChosen) : 'cast';
    const healthIntervalSec = BigInt(parseFlagOrEnv(args, '--health-interval', ['KEEPER_HEALTH_INTERVAL_SEC'], 1800, 0, 31_536_000));
    const volatilityThresholdBps = BigInt(parseFlagOrEnv(args, '--volatility-threshold-bps', ['KEEPER_VOLATILITY_THRESHOLD_BPS'], 0, 0, 1_000_000));
    const volatilityCooldownSec = BigInt(parseFlagOrEnv(args, '--volatility-cooldown', ['KEEPER_VOLATILITY_COOLDOWN_SEC'], 600, 0, 31_536_000));
    const chainlinkStaleSec = BigInt(parseFlagOrEnv(args, '--chainlink-stale-sec', ['KEEPER_CHAINLINK_STALE_SEC'], 600, 0, 31_536_000));
    const externalEthUsdUrl = getArgValue(args, '--external-ethusd-url')
        || process.env.KEEPER_ETHUSD_URL
        || process.env.EXTERNAL_ETHUSD_URL
        || 'https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT';
    const telegramEnabled = Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
    if (hasFlag(args, '--probe-env')) {
        console.log('probe secrets=absent');
        console.log(`probe KEEPER_CAST_BIN=${process.env.KEEPER_CAST_BIN === undefined ? 'absent' : 'present'}`);
        console.log(`probe cast-source=${castSource}`);
        console.log(`probe KEYSTORE_PATH=${process.env.KEYSTORE_PATH === undefined ? 'absent' : 'present'}`);
        return;
    }

    const chains: Record<NetworkName, Chain> = {
        anvil,
        sepolia,
        'op-sepolia': optimismSepolia,
        'op-mainnet': optimism,
        mainnet,
    };
    const chain = chains[network];
    const rpcUrl = process.env.RPC_URL ?? '';
    if (rpcUrl.length === 0 || rpcUrl.length > 2_048) throw new Error('keeper: RPC_URL missing');
    const canonicalFallback = (CANONICAL_ADDRESSES as Record<number, Record<string, string> | undefined>)[chain.id] ?? {};
    const config = {
        name: network,
        chain,
        rpcUrl,
        bundlerUrl: process.env.BUNDLER_URL || rpcUrl,
        contracts: canonicalFallback,
    };
    const publicClient = createPublicClient({ chain: config.chain, transport: http(config.rpcUrl) });
    const deployed: DeploymentAddresses = await readDeploymentAddresses(path.join(REPO_ROOT, `config.${network}.json`));
    const priceFeedFlag = getArgValue(args, '--price-feed');
    if (priceFeedFlag !== undefined && !isAddress(priceFeedFlag)) throw new Error('keeper: --price-feed invalid');

    const canonical = (CANONICAL_ADDRESSES as Record<number, any>)[config.chain.id];
    const registryForIdentity = pickAddr(registryFlag ?? undefined, canonical?.registry, deployed.registry);
    if (!dryRun && signerAddress && !registryForIdentity) {
        throw new Error(`signer identity: ${network} has no registry address; pass --registry <address>`);
    }
    await requireMatchingChain(publicClient, config.chain.id);
    const superPaymaster = pickAddr(getArgValue(args, '--superpaymaster'), canonical?.superPaymaster, deployed.superPaymaster);
    const priceFeed = pickAddr(priceFeedFlag, canonical?.priceFeed, deployed.priceFeed);
    if (!priceFeed) throw new Error('keeper: priceFeed unresolved');
    if (!superPaymaster) throw new Error('keeper: superPaymaster unresolved');

    const paymasterFromArgs = getArgValue(args, '--paymaster');
    const paymasterFromCanonical = canonical?.paymasterV4 as string | undefined;
    let paymaster: `0x${string}` | null = null;
    if (paymasterFromArgs !== undefined) {
        if (!isAddress(paymasterFromArgs) || paymasterFromArgs === ZERO_ADDRESS) throw new Error('keeper: --paymaster invalid');
        paymaster = paymasterFromArgs;
    } else if (typeof paymasterFromCanonical === 'string' && isAddress(paymasterFromCanonical) && paymasterFromCanonical !== ZERO_ADDRESS) {
        paymaster = paymasterFromCanonical;
    }
    if (!paymaster) console.log('PaymasterV4 not configured; V4 path off');
    if (paymaster) await assertPaymasterBytecode(publicClient, paymaster);
    const journalPin = dryRun ? null : await pinJournalDirectory(journalPath);

    if (printLogo) console.log(`${logo()}\n`);
    console.log(section('USAGE'));
    console.log(`${shortUsage()}\n`);

    console.log(section('INIT'));

    console.log(`network=${network}`);
    console.log('rpcUrl=<set>');
    console.log(`superPaymaster=${disableSuperPaymaster ? 'disabled' : superPaymaster}`);
    console.log(`paymaster=${disablePaymaster ? 'disabled' : paymaster ?? 'off'}`);
    console.log(`priceFeed=${priceFeed}`);
    console.log(`signing=${dryRun ? 'dry-run' : 'keystore'}`);
    console.log(`signer=${signerAddress ?? 'none'}`);
    console.log(`pollIntervalSec=${pollIntervalSec.toString()}`);
    console.log(`safetyMarginSec=${safetyMarginSec.toString()}`);
    console.log(`healthIntervalSec=${healthIntervalSec.toString()}`);
    console.log(`volatilityThresholdBps=${volatilityThresholdBps.toString()}`);
    console.log(`chainlinkStaleSec=${chainlinkStaleSec.toString()}`);
    console.log(`externalEthUsdUrl=${externalEthUsdUrl ? 'set' : 'not-set'}`);
    console.log(`maxUpdatesPerDay=${maxUpdatesPerDay}`);
    console.log(`dryRun=${dryRun}`);

    let stalenessThresholdSec: bigint | null = null;
    const noteThreshold = (value: bigint): void => {
        if (typeof value !== 'bigint' || value <= 0n) return;
        if (stalenessThresholdSec === null || value < stalenessThresholdSec) stalenessThresholdSec = value;
    };
    if (!disableSuperPaymaster) {
        try {
            const superThreshold = (await publicClient.readContract({
                address: superPaymaster,
                abi: SUPERPAYMASTER_ABI,
                functionName: 'priceStalenessThreshold'
            })) as bigint;
            noteThreshold(superThreshold);
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
            noteThreshold(pmThreshold);
            console.log(`paymaster.thresholdSec=${pmThreshold.toString()}`);
        } catch {
            console.log('paymaster.thresholdSec=unknown');
        }
    }

    console.log(section('TELEGRAM'));
    console.log(`telegram=${telegramEnabled ? 'enabled' : 'disabled'}`);
    console.log(`bot=${TELEGRAM_BOT_USERNAME}`);
    console.log(`TELEGRAM_BOT_TOKEN=${process.env.TELEGRAM_BOT_TOKEN ? 'set' : 'not-set'}`);
    console.log(`TELEGRAM_CHAT_ID=${process.env.TELEGRAM_CHAT_ID ? 'set' : 'not-set'}`);
    console.log('dm: message bot /start first');
    console.log('group/channel: add bot and allow posting');

    const headChain = adaptHeadChain(publicClient);
    let sender: Sender | null = null;
    let pendingJournal: Journal | null = null;

    const updatesTodayByPaymaster = new Map<string, number>();
    let dayStartSec = nowSec();
    let lastHealthNotifySec = 0n;
    let tickIndex = 0;
    let lastExternalEthUsd: bigint | null = null;
    let lastExternalVolAlertSec = 0n;
    let lastChainlinkStaleAlertSec = 0n;
    let lastSuperHealthOk: boolean | null = null;
    let lastPaymasterHealthOk: boolean | null = null;
    const chainlinkDecimalsCache = new Map<string, number>();

    const countedTx = new Set<string>();
    const refusedReasons = new Set<string>();
    let nextIdentityAt = 0;
    let lastIdentityOkAt = 0;
    let identityGateKey = '';
    /** Lowercase PaymasterV4 included in the last successful identity check. Null means none. */
    let coveredPaymaster: string | null = null;
    /** Last identity check's {SuperPaymaster, PaymasterV4, Registry}. Empty until one succeeds. */
    let clearedIdentitySet = '';
    let operationalFailure = false;
    let externalSkipAlerted = false;
    let balanceClock: BalanceClock = { nextCheckAt: 0, lastLowAt: 0, lastFailAt: 0 };

    const alertLine = (msg: string): Promise<boolean> => {
        console.error(msg);
        return sendTelegramMessage(`[keeper] ${msg}`);
    };
    const readAlerts = freshReadAlerts();

    function readFailed(problems: string[]): IdentityResult {
        return { ok: false, kind: 'read-failed', problems };
    }

    /** Configured V4 stays in the owner set even when updates are disabled. */
    function adoptedPaymaster(): `0x${string}` | null {
        return paymaster && isAddress(paymaster) ? paymaster : null;
    }

    async function evaluateIdentity(): Promise<IdentityResult> {
        if (!signerAddress) return readFailed(['signer missing']);
        const head = await headChain.latestHeader();
        if (!head) return readFailed(['latest block unavailable']);
        const sp = superPaymaster as Address;
        const registryAddr = registryForIdentity;
        if (!isAddress(sp) || !registryAddr || !isAddress(registryAddr)) {
            return readFailed([`signer identity: ${network} has no registry address; pass --registry <address>`]);
        }
        const paymasterForGuard = adoptedPaymaster();
        return checkSignerIdentity({
            chain: asIdentityChain(headChain),
            blockHash: head.hash,
            signer: signerAddress,
            sp,
            registry: registryAddr,
            paymaster: paymasterForGuard,
            deployers: [DEPLOYER_ADDRESS],
        });
    }

    async function maybeAlertLowBalance(): Promise<void> {
        if (!signerAddress) return;
        const nowMs = Date.now();
        if (nowMs < balanceClock.nextCheckAt) return;
        let balance: bigint | null = null;
        try {
            const raw = await publicClient.getBalance({ address: signerAddress });
            balance = typeof raw === 'bigint' ? raw : null;
        } catch {
            balance = null;
        }
        const noted = noteBalance({ nowMs, clock: balanceClock, balance, thresholdWei: lowBalanceWei });
        balanceClock = noted.clock;
        if (!noted.alert) return;
        if (dryRun) console.log(noted.alert);
        else alertLine(noted.alert);
    }

    let stopping = false;
    let sleepTimer: ReturnType<typeof setTimeout> | null = null;
    const refreshAlerted = new Set<string>();
    const buildSender = (journal: Journal): Sender => {
        if (!keystorePath || !passwordFilePath || !signerAddress) {
            throw new Error('keeper: live runs require --keystore, --password-file and --signer');
        }
        if (maxFeeWei === null) throw new Error('keeper: --max-fee-gwei is required for a live run');
        const priceTargetOn = !disableSuperPaymaster || (!disablePaymaster && paymaster !== null);
        if (stalenessThresholdSec === null && priceTargetOn) throw new Error('keeper: price staleness threshold unreadable');
        if (stalenessThresholdSec === null) stalenessThresholdSec = 2n;
        const half = stalenessThresholdSec / 2n;
        const minUpdateIntervalSec = minUpdateFlag ?? (half <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(half) : 0);
        if (!Number.isInteger(minUpdateIntervalSec) || minUpdateIntervalSec <= 0
            || BigInt(minUpdateIntervalSec) >= stalenessThresholdSec) {
            throw new Error('keeper: --min-update-interval invalid');
        }
        let built: Sender | null = null;
        const signer = createCastSigner({
            castBin,
            keystorePath,
            passwordFilePath,
            signerAddress,
            authorize: () => built?.authorizeSpawn() === true,
        });
        built = new Sender({
            chain: adaptChainIO(publicClient),
            signer,
            journal,
            signerAddress,
            chainId: config.chain.id,
            // --disable-paymaster keeps the configured address so an already-signed raw can be rebroadcast.
            superPaymaster: superPaymaster && isAddress(superPaymaster) ? superPaymaster : null,
            paymaster: () => adoptedPaymaster(),
            enabledKinds: {
                'price-super': !disableSuperPaymaster,
                'price-paymaster': !disablePaymaster && paymaster !== null,
            },
            maxGas,
            maxFeeWei,
            maxTipWei,
            stallSec,
            network,
            minUpdateIntervalSec,
            priceStalenessThresholdSec: stalenessThresholdSec,
            readUpdatedAt: async (to) => {
                const abi = superPaymaster && to.toLowerCase() === superPaymaster.toLowerCase()
                    ? SUPERPAYMASTER_ABI
                    : PAYMASTER_V4_ABI;
                try {
                    const cache = await publicClient.readContract({
                        address: to,
                        abi,
                        functionName: 'cachedPrice',
                    });
                    const updated = cachedUpdatedAtSec(cache);
                    if (updated === null) return 'unreadable';
                    return { to, updatedAtSec: updated };
                } catch {
                    return 'unreadable';
                }
            },
            readStaleness: async () => {
                if (disableSuperPaymaster || !superPaymaster || !isAddress(superPaymaster)) return 'unreadable';
                try {
                    const cache = await publicClient.readContract({
                        address: superPaymaster,
                        abi: SUPERPAYMASTER_ABI,
                        functionName: 'cachedPrice',
                    });
                    const threshold = await publicClient.readContract({
                        address: superPaymaster,
                        abi: SUPERPAYMASTER_ABI,
                        functionName: 'priceStalenessThreshold',
                    });
                    const updatedAt = (cache as readonly unknown[])[1];
                    if (typeof updatedAt !== 'bigint' || typeof threshold !== 'bigint') return 'unreadable';
                    return { updatedAtSec: updatedAt, thresholdSec: threshold };
                } catch {
                    return 'unreadable';
                }
            },
            manualStep: (nonce, fees) => manualStallCommand({
                chainId: config.chain.id,
                nonce,
                maxFeePerGas: fees.maxFeePerGas,
                maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
                keystorePath,
                passwordFilePath,
                signer: signerAddress,
            }),
            alert: alertLine,
        });
        return built;
    };
    if (!dryRun && signerAddress && keystorePath && passwordFilePath) {
        if (!journalPin) throw new Error('keeper: journal refused: unreadable');
        try {
            await acquireKeeperLock({ journalPath, chainId: config.chain.id, signer: signerAddress, pin: journalPin });
        } catch (error) {
            if (error instanceof Error && error.message === 'journal: parent sync failed') {
                console.error('sender: journal barrier incomplete');
                await finish(1);
            }
            throw error;
        }
        setJournalDeadlineAlert(() => {
            console.error('journal: progress deadline');
            void sendTelegramMessage('[keeper] journal: progress deadline');
        });
        const journal = new Journal(journalPath, { chainId: config.chain.id, signer: signerAddress }, journalPin);
        const opened = await journal.load();
        if (opened === 'corrupt' || opened === 'mismatch' || opened === 'unsafe' || opened === 'substituted') {
            const reason = opened === 'mismatch'
                ? 'sender: journal belongs to another signer'
                : opened === 'unsafe' ? 'sender: journal unsafe'
                : opened === 'substituted' ? 'sender: journal path substituted'
                : 'sender: journal corrupt';
            console.error(reason);
            await sendTelegramMessage(`[keeper] ${reason}`);
            await finish(1);
        }
        if (opened === 'barrier') {
            sender = buildSender(journal);
            await sender.boot();
            sender.armFlight(journal.alarmFlight());
            console.error('sender: journal barrier incomplete');
            await sendTelegramMessage('[keeper] sender: journal barrier incomplete');
            await finish(1);
        }
        pendingJournal = journal;
    }
    if (signerAddress) {
        const identity = await evaluateIdentity();
        const openedAt = Date.now();
        const decision = decideIdentityGate({ nowMs: openedAt, lastOkAt: 0, previousKey: '', verdict: identity });
        if (!identity.ok) {
            for (const problem of identity.problems) console.error(`signer-identity: ${problem}`);
            await sendTelegramMessage(`[keeper] signer identity refused\n${identity.problems.join('\n')}`, 'signer-refused');
            await finish(1);
        }
        if (pendingJournal) {
            sender = buildSender(pendingJournal);
            await sender.boot();
            const flight = pendingJournal.inFlight();
            sender.armFlight(flight ? { nonce: flight.nonce, firstSentAt: flight.firstSentAt } : null);
        }
        console.log('signer-identity=ok');
        if (sender) {
            sender.setGate({ price: decision.price, pause: decision.pause, reason: decision.reason, validUntil: decision.validUntil });
            nextIdentityAt = scheduledIdentityAt(openedAt);
            lastIdentityOkAt = decision.lastOkAt;
            identityGateKey = decision.key;
            const checked = adoptedPaymaster();
            if (checked) {
                coveredPaymaster = checked.toLowerCase();
                sender.setPaymasterIdentity(true);
            } else {
                sender.setPaymasterIdentity(false);
            }
            clearedIdentitySet = currentIdentitySetKey();
        }
    }

    if (clearStall) {
        if (!sender) {
            console.error('keeper: --clear-stall requires a live signer');
            await finish(2);
            return;
        }
        const cleared = await sender.clearStall();
        if (cleared.status === 'refused') await finish(2);
        await finish(0);
    }

    const onExit = async (signal: string) => {
        if (stopping) return;
        stopping = true;
        if (sleepTimer) clearTimeout(sleepTimer);
        sender?.stop();
        if (sender) await sender.drain(drainBudgetMs());
        killCastChildren();
        await sendTelegramMessage(
            `[keeper] stopped (${signal})\nnetwork=${network}\n` +
                `superPaymaster=${disableSuperPaymaster ? 'disabled' : superPaymaster}\n` +
                `paymaster=${disablePaymaster ? 'disabled' : paymaster || 'off'}`
        );
        await finish(0);
    };

    process.on('SIGINT', () => void onExit('SIGINT'));
    process.on('SIGTERM', () => void onExit('SIGTERM'));

    await sendTelegramMessage(
        `[keeper] started\nnetwork=${network}\n` +
            `superPaymaster=${disableSuperPaymaster ? 'disabled' : superPaymaster}\n` +
            `paymaster=${disablePaymaster ? 'disabled' : paymaster || 'off'}\n` +
            `signing=${dryRun ? 'dry-run' : 'keystore'}\ndryRun=${dryRun}`
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
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 5_000);
        try {
            const res = await fetch(externalEthUsdUrl, { signal: ctrl.signal });
            if (!res.ok || !res.body) return null;
            const reader = res.body.getReader();
            const chunks: Uint8Array[] = [];
            let total = 0;
            for (;;) {
                const step = await reader.read();
                if (step.done) break;
                const value = step.value;
                if (!value) continue;
                total += value.byteLength;
                if (total > 65_536) {
                    await reader.cancel().catch(() => {});
                    ctrl.abort();
                    return null;
                }
                chunks.push(value);
            }
            let n = 0;
            for (const chunk of chunks) n += chunk.byteLength;
            const body = new Uint8Array(n);
            let offset = 0;
            for (const chunk of chunks) {
                body.set(chunk, offset);
                offset += chunk.byteLength;
            }
            const text = new TextDecoder('utf-8', { fatal: false }).decode(body);
            if (text.length === 0 || text.length > 65_536) return null;
            let json: unknown;
            try {
                json = JSON.parse(text);
            } catch {
                return null;
            }
            const s = extractPriceString(json);
            if (!s || s.length > 64) return null;
            const decimals = 8;
            const price = parseDecimalToFixed(s, decimals);
            if (price === null || price <= 0n) return null;
            return { price, decimals };
        } catch {
            return null;
        } finally {
            clearTimeout(timer);
        }
    };

    function logSettlement(ev: SettlementEvent): void {
        if (ev.outcome === 'unavailable') {
            console.log('nonce consumed, receipt unavailable');
            alertLine('nonce consumed, receipt unavailable');
            return;
        }
        const confirmed = ev.outcome === 'receipt' ? 'receipt' : 'reverted';
        const tx = ev.hash ?? 'unknown';
        console.log(`confirmed: ${confirmed} kind=${ev.kind} tx=${tx}`);
        void sendTelegramMessage(
            `[keeper] in-flight settled\nnetwork=${network}\nkind=${ev.kind}\ntx=${tx}\nconfirmed=${confirmed}`
        );
    }

    function currentIdentitySetKey(): string {
        const v4 = paymaster && isAddress(paymaster) ? paymaster : null;
        const registry = registryForIdentity && isAddress(registryForIdentity) ? registryForIdentity : '';
        const sp = superPaymaster && isAddress(superPaymaster) ? superPaymaster : '';
        return identityTargetKey({ sp, v4, registry });
    }

    /**
     * Backstop: a target set other than the one cleared at startup closes price and stays closed.
     * This does not resolve a new PaymasterV4 and does not adopt the new set.
     */
    function applyStartupTargetSet(): void {
        if (!sender || !signerAddress) return;
        const nextKey = currentIdentitySetKey();
        if (!priceClosedByTargetDrift(clearedIdentitySet, nextKey)) return;
        sender.setGate({ price: false, pause: false, reason: 'sender: paymaster identity pending', validUntil: 0 });
        sender.setPaymasterIdentity(false);
        coveredPaymaster = null;
    }

    const tick = async () => {
        sender?.tick();
        await retryHeldCritical(Date.now(), (message) => postTelegramOnce(message));
        tickIndex += 1;
        console.log('');
        console.log(section(`TICK #${tickIndex} @ ${new Date().toISOString()}`));
        const currentSec = nowSec();
        await maybeAlertLowBalance();
        if (sender && !stopping) {
            let settled: MaintainResult = { status: 'idle' };
            try {
                settled = await sender.maintain();
            } catch {
                settled = { status: 'refused', reason: 'sender: send failed' };
            }
            if (settled.status === 'refused') {
                operationalFailure = true;
                if (settled.reason) console.log(`refused: kind=maintain reason=${settled.reason}`);
            }
        }

        if (currentSec - dayStartSec >= 86400n) {
            updatesTodayByPaymaster.clear();
            countedTx.clear();
            dayStartSec = currentSec;
        }

        let baseFeePerGas: bigint | undefined;
        try {
            const latestBlock = await publicClient.getBlock({ blockTag: 'latest' });
            baseFeePerGas = (latestBlock as { baseFeePerGas?: bigint }).baseFeePerGas;
        } catch {
            operationalFailure = true;
            console.error('keeper: block read failed');
        }
        const baseFeeOk = maxBaseFeeWei === null || (baseFeePerGas !== undefined && baseFeePerGas <= maxBaseFeeWei);
        const baseFeeInfo = baseFeePerGas !== undefined ? `${formatGwei(baseFeePerGas)} gwei` : 'n/a';

        let chainlinkUpdatedAt = 0n;
        let superAnswer = 0n;
        let chainlinkOk = false;
        if (!disableSuperPaymaster || volatilityThresholdBps > 0n) {
            try {
                const chainlink = await publicClient.readContract({
                    address: priceFeed,
                    abi: CHAINLINK_ABI,
                    functionName: 'latestRoundData'
                });
                chainlinkUpdatedAt = chainlink[3] as bigint;
                superAnswer = chainlink[1] as bigint;
                chainlinkOk = true;
            } catch {
                operationalFailure = true;
            }
            noteTargetRead(readAlerts, 'oracle', chainlinkOk, alertLine);
        }

        let cachedUpdatedAt = 0n;
        let thresholdSec = 0n;
        let validUntil = 0n;
        let superCacheOk = false;
        let superLoaded = false;
        if (!disableSuperPaymaster) {
            try {
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
                cachedUpdatedAt = cache[1] as bigint;
                thresholdSec = threshold as bigint;
                validUntil = cachedUpdatedAt + thresholdSec;
                superCacheOk = cachedUpdatedAt > 0n && validUntil > currentSec;
                superLoaded = true;
            } catch {
                operationalFailure = true;
            }
            noteTargetRead(readAlerts, 'superpaymaster', superLoaded, alertLine);
        }

        const deadline = validUntil > safetyMarginSec ? validUntil - safetyMarginSec : 0n;
        const chainlinkAge = chainlinkUpdatedAt > 0n ? currentSec - chainlinkUpdatedAt : 0n;
        let paymasterCacheOk: boolean | null = null;

        if (chainlinkStaleSec > 0n && chainlinkAge >= chainlinkStaleSec && currentSec - lastChainlinkStaleAlertSec >= volatilityCooldownSec) {
            lastChainlinkStaleAlertSec = currentSec;
            console.log(`alert kind=chainlink reason=stale ageSec=${chainlinkAge.toString()} thresholdSec=${chainlinkStaleSec.toString()}`);
            await sendTelegramMessage(
                `[keeper] chainlink stale\nnetwork=${network}\nfeed=${priceFeed}\nageSec=${chainlinkAge.toString()}\nthresholdSec=${chainlinkStaleSec.toString()}\n` +
                    `note=consider DVT forced update`
            );
        }

        if (volatilityThresholdBps > 0n && externalEthUsdUrl) {
            const ext = await fetchExternalEthUsd();
            if (!ext) {
                if (!externalSkipAlerted) {
                    externalSkipAlerted = true;
                    console.warn('keeper: external price skipped');
                }
            } else if (chainlinkOk) {
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

                const clDec = await getChainlinkDecimals(priceFeed);
                const clNorm = normalizeDecimals(superAnswer, clDec, ext.decimals);
                const devBps = toBpsChange(clNorm, ext.price);
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
        }

        const broadcastUpdate = async (
            target: `0x${string}`,
            kind: 'super' | 'paymaster',
            abi: typeof SUPERPAYMASTER_ABI | typeof PAYMASTER_V4_ABI,
            confirm: { before: bigint; expected: bigint }
        ): Promise<void> => {
            if (!sender) {
                console.error('sender: not configured');
                return;
            }
            const data = encodeFunctionData({ abi, functionName: 'updatePrice' });
            const sendKind = kind === 'super' ? 'price-super' : 'price-paymaster';
            let result: SendResult;
            try {
                result = await sender.send({ kind: sendKind, to: target, data });
            } catch {
                operationalFailure = true;
                console.error('sender: sign failed');
                await sendTelegramMessage(`[keeper] send failed\nnetwork=${network}\nkind=${kind}`);
                return;
            }
            const report = describePriceSend(result);
            if (report.kind === 'refused') {
                operationalFailure = true;
                console.log(`refused: kind=${kind} reason=${report.reason}`);
                if (noteRefusal(refusedReasons, report.reason)) {
                    await sendTelegramMessage(`[keeper] send refused\nnetwork=${network}\nkind=${kind}\nreason=${report.reason}`);
                }
                return;
            }
            if (report.kind === 'blocked') {
                console.log(`blocked: kind=${kind} inFlight=${report.hash}`);
                return;
            }
            const txHash = report.hash;
            if (!countedTx.has(txHash)) {
                countedTx.add(txHash);
                const updatesToday = updatesTodayByPaymaster.get(target) || 0;
                updatesTodayByPaymaster.set(target, updatesToday + 1);
            }
            let confirmed = report.kind === 'reverted' ? 'reverted' : report.kind === 'receipt' ? 'receipt' : 'pending';
            if (report.kind === 'pending') {
                try {
                    const cache = await publicClient.readContract({ address: target, abi, functionName: 'cachedPrice' });
                    const updated = cachedUpdatedAtSec(cache);
                    if (updated !== null && cacheConfirms(confirm.before, confirm.expected, updated)) confirmed = 'state-change';
                } catch {
                    confirmed = 'pending';
                }
            }
            if (confirmed === 'receipt' || confirmed === 'state-change') refusedReasons.clear();
            if (confirmed === 'pending') {
                console.log(`pending: kind=${kind} tx=${txHash} (receipt timeout; will re-check next tick)`);
            } else {
                console.log(`confirmed: ${confirmed} kind=${kind} tx=${txHash}`);
            }
            const label = kind === 'super' ? 'superPaymaster' : 'paymaster';
            console.log(`updated: ${label} tx=${txHash}`);
            await sendTelegramMessage(
                `[keeper] ${label} updatePrice broadcast\nnetwork=${network}\ntarget=${target}\ntx=${txHash}\nconfirmed=${confirmed}`
            );
        };

        const refreshSuper = async () => {
            if (disableSuperPaymaster || !superLoaded) return;
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
            if (!baseFeeOk && currentSec + 180n < validUntil) {
                console.log(`skip superPaymaster update: base fee above threshold (maxBaseFeeGwei=${maxBaseFeeWei === null ? '' : (maxBaseFeeWei / 1_000_000_000n).toString()})`);
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
            await broadcastUpdate(superPaymaster, 'super', SUPERPAYMASTER_ABI, { before: cachedUpdatedAt, expected: chainlinkUpdatedAt });
        };

        const refreshPaymaster = async (): Promise<boolean> => {
            if (disablePaymaster) return true;
            if (!paymaster) return true; // V4 not configured; the path stays off until restart

            let pmPriceFeed = priceFeed;
            let pmChainlinkUpdatedAt: bigint;
            let pmCache: unknown;
            let pmThresholdSec: bigint;
            try {
                const f = (await publicClient.readContract({
                    address: paymaster,
                    abi: PAYMASTER_V4_ABI,
                    functionName: 'ethUsdPriceFeed'
                })) as `0x${string}`;
                if (f && f.toLowerCase() !== ZERO_ADDRESS) pmPriceFeed = f;
                const pmChainlink = await publicClient.readContract({
                    address: pmPriceFeed,
                    abi: CHAINLINK_ABI,
                    functionName: 'latestRoundData'
                });
                pmChainlinkUpdatedAt = pmChainlink[3] as bigint;
                const [cache, threshold] = await Promise.all([
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
                pmCache = cache;
                pmThresholdSec = threshold as bigint;
            } catch {
                operationalFailure = true;
                return false;
            }
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

            const pmCachedUpdatedAt = (pmCache as any)?.updatedAt !== undefined ? (pmCache as any).updatedAt : (pmCache as any)[1];

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

            if (!shouldUpdate) return true;
            if (!baseFeeOk && currentSec + 180n < pmValidUntil) {
                console.log(`skip paymaster update: base fee above threshold (maxBaseFeeGwei=${maxBaseFeeWei === null ? '' : (maxBaseFeeWei / 1_000_000_000n).toString()})`);
                return true;
            }

            const updatesToday = updatesTodayByPaymaster.get(paymaster) || 0;
            if (updatesToday >= maxUpdatesPerDay) {
                console.log(`skip paymaster update: reached maxUpdatesPerDay=${maxUpdatesPerDay}`);
                return true;
            }

            if (dryRun) {
                console.log(`action=sendTx kind=paymaster method=updatePrice() target=${paymaster} (dry-run)`);
                return true;
            }

            console.log(`action=sendTx kind=paymaster method=updatePrice() target=${paymaster}`);
            await broadcastUpdate(paymaster, 'paymaster', PAYMASTER_V4_ABI, { before: BigInt(pmCachedUpdatedAt), expected: pmChainlinkUpdatedAt });
            return true;
        };

        applyStartupTargetSet();
        if (superLoaded) {
            try {
                await refreshSuper();
            } catch {
                operationalFailure = true;
                console.error('keeper: superpaymaster read failed');
            }
        }
        let paymasterReadsOk = true;
        try {
            paymasterReadsOk = await refreshPaymaster();
        } catch {
            operationalFailure = true;
            paymasterReadsOk = false;
        }
        if (!disablePaymaster && paymaster) noteTargetRead(readAlerts, 'paymaster', paymasterReadsOk, alertLine);
        if (sender) {
            try {
                await sender.flushReceipt();
            } catch {
                operationalFailure = true;
            }
            for (const ev of sender.drainSettlements()) logSettlement(ev);
        }

        const superHealth = disableSuperPaymaster ? 'disabled' : superCacheOk ? '✅' : 'not-ok';
        const paymasterHealth =
            disablePaymaster ? 'disabled' : !paymaster ? 'off' : paymasterCacheOk === null ? 'unknown' : paymasterCacheOk ? '✅' : 'not-ok';
        console.log(`health superCache=${superHealth} paymasterCache=${paymasterHealth}`);

        const rolled = rollupHealth({
            superDisabled: disableSuperPaymaster,
            superCacheOk,
            paymasterDisabled: disablePaymaster,
            paymasterConfigured: Boolean(paymaster),
            paymasterCacheOk,
        });
        const superOk = rolled.superOk;
        const pmOk = rolled.paymasterOk;
        const paymasterLabel = rolled.paymaster === 'ok' ? '✅ ok' : rolled.paymaster;

        const healthChanged =
            (lastSuperHealthOk !== null && lastSuperHealthOk !== superOk) || (lastPaymasterHealthOk !== null && lastPaymasterHealthOk !== pmOk);
        lastSuperHealthOk = superOk;
        lastPaymasterHealthOk = pmOk;

        if (telegramEnabled && healthChanged) {
            await sendTelegramMessage(
                `[keeper] health change\nnetwork=${network}\n` +
                    `super=${disableSuperPaymaster ? 'disabled' : superOk ? '✅ ok' : 'not-ok'} remainingSec=${(validUntil > currentSec ? validUntil - currentSec : 0n).toString()}\n` +
                    `paymaster=${paymasterLabel}\n` +
                    `baseFee=${baseFeeInfo}`
            );
        }

        if (telegramEnabled && currentSec - lastHealthNotifySec >= healthIntervalSec && rolled.heartbeat) {
            lastHealthNotifySec = currentSec;
            await sendTelegramMessage(
                `[keeper] ✅ health ok\nnetwork=${network}\n✅ super=ok\npaymaster=${paymasterLabel}\nbaseFee=${baseFeeInfo}`
            );
        }
    };

    async function refreshIdentity(): Promise<boolean> {
        if (!sender || stopping) return true;
        const nowMs = Date.now();
        if (!identityDue(nowMs, nextIdentityAt, sender.gateOpen())) return true;
        const decision = await gateAfterIdentityRead({
            read: () => evaluateIdentity(),
            lastOkAt: lastIdentityOkAt,
            previousKey: identityGateKey,
            now: () => Date.now(),
        });
        lastIdentityOkAt = decision.lastOkAt;
        identityGateKey = decision.key;
        sender.setGate({ price: decision.price, pause: decision.pause, reason: decision.reason, validUntil: decision.validUntil });
        if (decision.key !== 'open') console.error(`signer-identity: ${decision.key}`);
        if (!decision.price) sender.setPaymasterIdentity(false);
        const identityEvent = criticalEventForGate(decision.key);
        if (decision.alert && identityEvent) await sendTelegramMessage(`[keeper] ${decision.alert}`, identityEvent);
        else if (decision.alert) await sendTelegramMessage(`[keeper] ${decision.alert}`);
        if (decision.key === 'open') {
            resolveCritical('identity-expiry');
            resolveCritical('signer-refused');
            nextIdentityAt = scheduledIdentityAt(decision.lastOkAt);
            const current = adoptedPaymaster();
            if (current) {
                coveredPaymaster = current.toLowerCase();
                sender.setPaymasterIdentity(true);
            }
        }
        return decision.pause;
    }

    for (;;) {
        if (stopping) break;
        try {
            // Price keeper: no pause round. The step still takes the pause hooks; they never run.
            await runKeeperStep({
                refreshIdentity,
                tick,
                pauseDue: false,
                network,
                alerted: refreshAlerted,
                alert: async (msg) => {
                    console.error(msg);
                    await sendTelegramMessage(`[keeper] ${msg}`);
                },
                onPause: async () => {},
                onPauseSkipped: async () => {},
            });
        } catch (e: unknown) {
            operationalFailure = true;
            const report = loopErrorReport(network, e, 'error');
            console.error(`[${new Date().toISOString()}] error: ${report.stderr}`);
            try {
                await sendTelegramMessage(report.telegram);
            } catch {}
        }

        if (once || stopping) break;
        console.log('');
        console.log(section(`SLEEP ${pollIntervalSec.toString()}s`));
        await new Promise<void>((resolve) => {
            sleepTimer = setTimeout(resolve, Number(pollIntervalSec) * 1000);
        });
        if (stopping) break;
    }
    await finish(once && operationalFailure && !stopping ? 2 : 0);
}

async function assertPaymasterBytecode(client: PublicClient, address: Address): Promise<void> {
    let code: unknown;
    try {
        code = await client.getBytecode({ address });
    } catch {
        throw new Error('keeper: paymaster bytecode unreadable');
    }
    if (typeof code !== 'string' || code.length < 4 || code.length > 100_000 || code === '0x') {
        throw new Error('keeper: paymaster bytecode unreadable');
    }
}

main().catch(async (e) => {
    const report = loopErrorReport(activeNetwork, e, 'fatal');
    try {
        await sendTelegramMessage(report.telegram);
    } catch {}
    console.error(report.stderr);
    await finish(1);
});
