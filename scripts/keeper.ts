import { createPublicClient, encodeFunctionData, formatGwei, http, isAddress, parseAbi, type Address, type Hex } from 'viem';
import { anvil, mainnet, optimism, optimismSepolia, sepolia } from 'viem/chains';
import { loadNetworkConfig, type NetworkName } from '../tests/regression/config.js';
import { CANONICAL_ADDRESSES } from '../packages/core/src/addresses.js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PaymasterTracker, describeUnresolved, paymasterTickStep } from './keeper/paymasterResolver.js';
import { noteBalance, type BalanceClock } from './keeper/balanceAlert.js';
import { createCastSigner } from './keeper/castSigner.js';
import { acquireKeeperLock, Journal, resyncJournal } from './keeper/journal.js';
import { Sender, type SendResult } from './keeper/sender.js';
import { checkSignerIdentity, DEPLOYER_ADDRESS, type IdentityResult } from './keeper/signerGuard.js';
import { assertRegistryStart, assertStartBlock, loadPauseConfigFile, pauseRoundAlert, runPauseRound, verifySpDeployment, type PauseDutyConfig } from './keeper/pauseDuty.js';
import { adaptChainIO, adaptPauseChain, asIdentityChain } from './keeper/viemAdapter.js';
import { identityDue, scheduledIdentityAt } from './keeper/identitySchedule.js';
import { decideIdentityGate } from './keeper/identityGate.js';
import { cacheConfirms, describePriceSend, loopErrorReport, noteRefusal } from './keeper/priceConfirm.js';
import { decideRoleCatchUp, syncRoleLogs, type RoleCatchUpMarks } from './keeper/roleLogs.js';
import { ignoredSecretWarning, pinScrubbedSecrets, scrubSecretEnv } from './keeper/secretEnv.js';
import { runKeeperStep } from './keeper/keeperStep.js';

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

const PAYMASTER_FACTORY_ABI = parseAbi([
    'function paymasterByOperator(address operator) view returns (address)',
    'function getOperatorByPaymaster(address paymaster) view returns (address)'
]);

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

function nowSec(): bigint {
    return BigInt(Math.floor(Date.now() / 1000));
}

function formatTs(ts: bigint): string {
    if (ts <= 0n) return '0';
    return new Date(Number(ts) * 1000).toISOString();
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
            `Telegram config invalid: TELEGRAM_CHAT_ID must be a numeric chat id (e.g. 123456789 or -100123...) or start with @ (e.g. @MyChannel). Got: ${chatId}`
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
        '   --once                      run one tick then exit; a pause round runs immediately',
        '   --resync-journal            realign the journal to the chain nonce, then exit',
        '   --role-sync-slice-calls <n> getLogs calls per tick while role inventory catches up (default 8)',
        '   --keystore <path>           encrypted keystore (required unless --dry-run)',
        '   --password-file <path>      keystore password file, mode 0600 (required unless --dry-run)',
        '   --signer <address>          address cast must recover (required unless --dry-run)',
        '   --cast-bin <path>           cast binary (default: cast)',
        '   --journal <path>            nonce journal (default: ~/.aastar-keeper/<network>.journal.json)',
        '   --registry <address>        registry used for signer identity',
        '   --pause-config <path>       v5.5.0-rc.8 pause-duty config; omit to disable',
        '   --pause-interval-sec <n>    pause round interval, minimum 600 (default 3600)',
        '   --pause-offset-sec <n>      delay before the first pause round (default 1800, ignored with --once)',
        '   --low-balance-wei <n>       signer balance alert threshold',
        '   --no-superpaymaster         disable SuperPaymaster updates',
        '   --no-paymaster              disable PaymasterV4 updates',
        '   --max-updates-per-day <n>   per-target limit (default 24)',
        '   --max-base-fee-gwei <n>     skip updates if base fee too high',
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
        `example: pnpm exec tsx scripts/keeper.ts --network op-mainnet --poll-interval 180 --safety-margin 600`,
        `telegram: set TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID (bot ${TELEGRAM_BOT_USERNAME})`,
        `health: --health-interval 1800 (telegram periodic ok status)`,
        `anomaly: --external-ethusd-url <url> --volatility-threshold-bps 150 (1.50%)`
    ].join('\n');
}

function parseWhole(raw: string | undefined, fallback: bigint, label: string, min: bigint): bigint {
    const text = raw ?? '';
    const body = text.length === 0 ? fallback.toString() : text;
    if (body.length === 0 || body.length > 18) throw new Error(`keeper: ${label} invalid`);
    for (let i = 0; i < body.length; i++) {
        const c = body.charCodeAt(i);
        if (c < 48 || c > 57) throw new Error(`keeper: ${label} invalid`);
    }
    const n = BigInt(body);
    if (n < min) throw new Error(`keeper: ${label} invalid`);
    return n;
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
    if (hasFlag(args, '--help') || hasFlag(args, '-h')) {
        console.log(section('HELP'));
        console.log(usage());
        return;
    }
    const network = (getArgValue(args, '--network') || 'op-sepolia') as NetworkName;
    activeNetwork = network;
    if (hasFlag(args, '--mode') || hasFlag(args, '--cast-account')) {
        throw new Error('keeper: --mode and --cast-account were removed; use --keystore --password-file --signer');
    }
    const dryRun = hasFlag(args, '--dry-run');
    const keystorePath = getArgValue(args, '--keystore');
    const passwordFilePath = getArgValue(args, '--password-file');
    const signerAddress = parseSignerFlag(getArgValue(args, '--signer'), !dryRun);
    const castBin = getArgValue(args, '--cast-bin') || 'cast';
    const resync = hasFlag(args, '--resync-journal');
    if (resync && !signerAddress) throw new Error('keeper: --resync-journal requires --signer');
    if (!dryRun && !resync && (!keystorePath || !passwordFilePath || !signerAddress)) {
        throw new Error('keeper: live runs require --keystore, --password-file and --signer');
    }
    const journalPath = getArgValue(args, '--journal')
        || path.join(os.homedir(), '.aastar-keeper', `${network}.journal.json`);
    const pauseConfigPath = getArgValue(args, '--pause-config');
    const pauseIntervalSec = parseWhole(requireArgValue(args, '--pause-interval-sec'), 3600n, '--pause-interval-sec', 600n);
    const pauseOffsetSec = parseWhole(requireArgValue(args, '--pause-offset-sec'), 1800n, '--pause-offset-sec', 0n);
    const registryFlagRaw = requireArgValue(args, '--registry');
    const registryFlag = registryFlagRaw
        ? (isAddress(registryFlagRaw) ? registryFlagRaw as Address : null)
        : null;
    if (registryFlagRaw && !registryFlag) throw new Error('keeper: --registry invalid');
    const lowBalanceWei = parseWeiFlag(
        getArgValue(args, '--low-balance-wei'),
        network === 'sepolia' ? LOW_BALANCE_SEPOLIA : LOW_BALANCE_OTHER,
    );
    let pauseConfig: PauseDutyConfig | null = null;
    let pauseDisabledReason = 'no --pause-config';
    if (pauseConfigPath) pauseConfig = loadPauseConfigFile(pauseConfigPath);
    const pollIntervalSec = BigInt(getArgValue(args, '--poll-interval') || '30');
    const safetyMarginSec = BigInt(getArgValue(args, '--safety-margin') || '600');
    const maxUpdatesPerDay = Number(getArgValue(args, '--max-updates-per-day') || '24');
    const maxBaseFeeGwei = getArgValue(args, '--max-base-fee-gwei');
    const healthIntervalSec = BigInt(getArgValue(args, '--health-interval') || process.env.KEEPER_HEALTH_INTERVAL_SEC || '1800');
    const volatilityThresholdBps = BigInt(getArgValue(args, '--volatility-threshold-bps') || process.env.KEEPER_VOLATILITY_THRESHOLD_BPS || '0');
    const volatilityCooldownSec = BigInt(getArgValue(args, '--volatility-cooldown') || process.env.KEEPER_VOLATILITY_COOLDOWN_SEC || '600');
    const chainlinkStaleSec = BigInt(getArgValue(args, '--chainlink-stale-sec') || process.env.KEEPER_CHAINLINK_STALE_SEC || '600');
    const externalEthUsdUrl = getArgValue(args, '--external-ethusd-url') || process.env.EXTERNAL_ETHUSD_URL || '';
    const once = hasFlag(args, '--once');
    const roleSyncSliceCalls = parseWhole(requireArgValue(args, '--role-sync-slice-calls'), 8n, '--role-sync-slice-calls', 1n);
    if (roleSyncSliceCalls > 100n) throw new Error('keeper: --role-sync-slice-calls invalid');
    const printLogo = hasFlag(args, '--logo') || !hasFlag(args, '--no-logo');
    const disableSuperPaymaster = hasFlag(args, '--no-superpaymaster') || hasFlag(args, '--disable-superpaymaster');
    const disablePaymaster = hasFlag(args, '--no-paymaster') || hasFlag(args, '--disable-paymaster');

    const scrubbedSecrets = new Set<string>();
    const envFiles: string[] =
        network === 'op-mainnet' ? ['.env.optimism', '.env.op-mainnet'] : [`.env.${network}`];
    for (const envFile of envFiles) {
        const fullPath = path.resolve(process.cwd(), envFile);
        if (fs.existsSync(fullPath)) {
            dotenv.config({ path: fullPath });
        }
    }
    const scrubbedFirst = scrubSecretEnv(process.env);
    for (const name of scrubbedFirst) scrubbedSecrets.add(name);
    pinScrubbedSecrets(process.env, scrubbedFirst);
    assertTelegramConfigValid();
    // Read AFTER the .env.<network> files above, so the network file can set it (CLI still wins).
    // Alert when PaymasterV4 stays unresolved this long (then at most once per interval). 0 disables.
    const paymasterMissingAlertSec = BigInt(
        getArgValue(args, '--paymaster-missing-alert') || process.env.KEEPER_PAYMASTER_MISSING_ALERT_SEC || '1800'
    );
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
        const canonicalFallback = (CANONICAL_ADDRESSES as Record<number, any>)[chain.id] ?? {};
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
    for (const name of scrubSecretEnv(process.env)) scrubbedSecrets.add(name);
    const secretWarning = ignoredSecretWarning([...scrubbedSecrets]);
    if (secretWarning) console.log(secretWarning);
    if (hasFlag(args, '--probe-env')) {
        const leaked = Object.keys(process.env).filter((key) => /PRIVATE_KEY|MNEMONIC|KEYSTORE_PASSWORD/i.test(key));
        console.log(`probe secrets=${leaked.length === 0 ? 'absent' : 'present'}`);
        console.log(`probe KEEPER_CAST_BIN=${process.env.KEEPER_CAST_BIN === undefined ? 'absent' : 'present'}`);
        console.log(`probe KEYSTORE_PATH=${process.env.KEYSTORE_PATH === undefined ? 'absent' : 'present'}`);
        return;
    }
    const publicClient = createPublicClient({ chain: config.chain, transport: http(config.rpcUrl) });

    if (resync) {
        if (!signerAddress) throw new Error('keeper: --resync-journal requires --signer');
        let releaseResync: (() => Promise<void>) | null = null;
        try {
            releaseResync = await acquireKeeperLock({ journalPath, chainId: config.chain.id, signer: signerAddress });
            const journal = new Journal(journalPath, { chainId: config.chain.id, signer: signerAddress });
            const latestRaw = await publicClient.getTransactionCount({ address: signerAddress, blockTag: 'latest' });
            const pendingRaw = await publicClient.getTransactionCount({ address: signerAddress, blockTag: 'pending' });
            const asNonce = (value: unknown): bigint => {
                if (typeof value === 'bigint') return value;
                if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return BigInt(value);
                return -1n;
            };
            const result = await resyncJournal(journal, asNonce(latestRaw), asNonce(pendingRaw));
            if (!result.ok) {
                console.error(result.reason);
                await sendTelegramMessage(`[keeper] ${result.reason}`);
                throw new Error(result.reason);
            }
            const line = `journal resynced base ${result.from} -> ${result.to} dropped ${result.dropped}`;
            console.log(line);
            await sendTelegramMessage(`[keeper] ${line}`);
        } finally {
            if (releaseResync) await releaseResync();
        }
        return;
    }

    const canonical = (CANONICAL_ADDRESSES as Record<number, any>)[config.chain.id];
    const registryForIdentity = pauseConfig?.registry ?? registryFlag ?? (canonical?.registry as Address | undefined);
    if (!dryRun && signerAddress && (!registryForIdentity || !isAddress(registryForIdentity))) {
        throw new Error(`signer identity: ${network} has no registry address; pass --registry <address>`);
    }
    const superPaymasterDefault = (canonical?.superPaymaster || config.contracts?.superPaymaster) as `0x${string}`;
    const priceFeed = (canonical?.priceFeed || config.contracts.priceFeed) as `0x${string}`;
    const superPaymaster = (getArgValue(args, '--superpaymaster') || superPaymasterDefault) as `0x${string}`;

    const paymasterFactory = (canonical?.paymasterFactory || config.contracts.paymasterFactory) as `0x${string}`;
    const paymasterFromArgs = getArgValue(args, '--paymaster') as `0x${string}` | undefined;
    const paymasterFromCanonical = canonical?.paymasterV4 as `0x${string}` | undefined;
    const paymasterFromConfig = config.contracts.paymasterV4 as `0x${string}` | undefined;
    const paymasterOperatorFromArgs = getArgValue(args, '--paymaster-operator') as `0x${string}` | undefined;
    const paymasterOperator =
        (paymasterOperatorFromArgs ||
            (process.env.OFFICIAL_OPERATOR as `0x${string}` | undefined) ||
            (process.env.TEST_ACCOUNT_ADDRESS as `0x${string}` | undefined) ||
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
    console.log('rpcUrl=<set>');
    console.log(`superPaymaster=${disableSuperPaymaster ? 'disabled' : superPaymaster}`);
    console.log(`paymaster=${paymasterInit}`);
    console.log(`paymasterFactory=${paymasterFactory}`);
    console.log(`paymasterOperator=${paymasterOperator}`);
    console.log(`priceFeed=${priceFeed}`);
    console.log(`signing=${dryRun ? 'dry-run' : 'keystore'}`);
    console.log(`signer=${signerAddress ?? 'none'}`);
    console.log(`pauseDuty=${pauseConfig ? `enabled ${pauseConfig.spRelease}` : `disabled (${pauseDisabledReason})`}`);
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

    const pauseChain = adaptPauseChain(publicClient);
    const pauseStatePath = `${journalPath}.pause-state.json`;
    let sender: Sender | null = null;

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
    const pauseReasonAlert = { key: '' };
    let nextPauseAt = once && pauseConfig ? Date.now() : Date.now() + Number(pauseOffsetSec) * 1000;
    let nextIdentityAt = 0;
    let lastIdentityOkAt = 0;
    let identityGateKey = '';
    let priceOpen = true;
    let pauseOpen = true;
    /** Pause send uses the gate from the start of the tick, before this tick's role slice. */
    let pauseAtTickStart = true;
    /** RoleConfigured inventory is behind. Pause stays closed; this is not an identity read failure. */
    let inventoryCatchingUp = false;
    let roleCatchUpArmed = false;
    let identityBlocksPause = false;
    let roleCatchUpStartedAt = 0;
    let roleMarks: RoleCatchUpMarks = { started: false, completed: false, overdue: false, failAlerted: false };
    /** Set once a slice has reached the head. Later identity checks include these ids. */
    let settledRoleIds: Hex[] | null = null;
    let balanceClock: BalanceClock = { nextCheckAt: 0, lastLowAt: 0, lastFailAt: 0 };

    const alertLine = (msg: string) => {
        console.error(msg);
        void sendTelegramMessage(`[keeper] ${msg}`);
    };

    function readFailed(problems: string[]): IdentityResult {
        return { ok: false, kind: 'read-failed', problems };
    }

    function applyScopes(price: boolean, pause: boolean, reason: string): void {
        priceOpen = price;
        pauseOpen = pause;
        if (sender) sender.setGate({ price, pause, reason });
    }

    async function emitGate(text: string): Promise<void> {
        console.error(text);
        await sendTelegramMessage(`[keeper] ${text}`);
    }

    /** Pinned-role privilege only. RoleConfigured logs are not read here. */
    async function evaluateIdentity(): Promise<IdentityResult> {
        if (!signerAddress) return readFailed(['signer missing']);
        const head = await pauseChain.latestHeader();
        if (!head) return readFailed(['latest block unavailable']);
        const sp = (pauseConfig?.superPaymaster ?? superPaymaster) as Address;
        const registryAddr = (pauseConfig?.registry ?? registryFlag ?? (canonical?.registry as Address | undefined));
        if (!isAddress(sp) || !registryAddr || !isAddress(registryAddr)) {
            return readFailed([`signer identity: ${network} has no registry address; pass --registry <address>`]);
        }
        let deploymentProblem: string | undefined;
        if (pauseConfig) {
            const deployment = await verifySpDeployment(pauseChain, pauseConfig, head.hash);
            if (deployment) deploymentProblem = deployment;
        }
        return checkSignerIdentity({
            chain: asIdentityChain(pauseChain),
            blockHash: head.hash,
            signer: signerAddress,
            sp,
            registry: registryAddr,
            deployers: [DEPLOYER_ADDRESS],
            pauseDutyEnabled: Boolean(pauseConfig),
            roleLogs: settledRoleIds === null ? null : settledRoleIds.map((roleId) => ({ roleId })),
            deploymentProblem,
        });
    }

    /**
     * One bounded RoleConfigured slice. Incomplete inventory keeps pause closed and price open.
     * Returns 'privileged' when a finished scan finds a role the direct reads did not cover.
     */
    async function advanceRoleCatchUp(nowMs: number): Promise<'ok' | 'privileged'> {
        if (!pauseConfig || !signerAddress || !roleCatchUpArmed || identityBlocksPause) return 'ok';
        const head = await pauseChain.latestHeader();
        const finalized = head ? await pauseChain.finalizedBlock() : null;
        let slice: 'incomplete' | 'complete' | 'failed' = 'failed';
        let unpinnedPrivilege = false;
        let privilege: IdentityResult | null = null;
        if (!head || finalized === null) {
            slice = 'failed';
        } else {
            const synced = await syncRoleLogs({
                chain: pauseChain,
                statePath: `${journalPath}.role-state.json`,
                chainId: config.chain.id,
                registry: pauseConfig.registry,
                registryStartBlock: pauseConfig.registryStartBlock,
                head: head.number,
                finalized,
                maxCalls: Number(roleSyncSliceCalls),
            });
            if (synced.ok) {
                slice = 'complete';
                settledRoleIds = synced.roleIds;
                const again = await checkSignerIdentity({
                    chain: asIdentityChain(pauseChain),
                    blockHash: head.hash,
                    signer: signerAddress,
                    sp: pauseConfig.superPaymaster,
                    registry: pauseConfig.registry,
                    deployers: [DEPLOYER_ADDRESS],
                    pauseDutyEnabled: true,
                    roleLogs: synced.roleIds.map((roleId) => ({ roleId })),
                });
                if (!again.ok && again.kind === 'privileged') {
                    unpinnedPrivilege = true;
                    privilege = again;
                } else if (!again.ok) {
                    const decision = decideIdentityGate({
                        nowMs,
                        lastOkAt: lastIdentityOkAt,
                        previousKey: identityGateKey,
                        verdict: again,
                    });
                    lastIdentityOkAt = decision.lastOkAt;
                    identityGateKey = decision.key;
                    applyScopes(decision.price, decision.pause, decision.reason);
                    identityBlocksPause = !decision.pause;
                    inventoryCatchingUp = false;
                    for (const problem of again.problems) console.error(`signer-identity: ${problem}`);
                    if (decision.alert) await emitGate(decision.alert);
                    return 'ok';
                }
            } else if (synced.reason === 'role logs incomplete') {
                slice = 'incomplete';
            }
        }
        const decided = decideRoleCatchUp({
            nowMs,
            startedAt: roleCatchUpStartedAt,
            slice,
            unpinnedPrivilege,
            previous: roleMarks,
        });
        roleMarks = decided.marks;
        if (decided.alert) await emitGate(decided.alert);
        if (decided.closeAll && privilege && !privilege.ok) {
            const decision = decideIdentityGate({
                nowMs,
                lastOkAt: lastIdentityOkAt,
                previousKey: identityGateKey,
                verdict: privilege,
            });
            lastIdentityOkAt = decision.lastOkAt;
            identityGateKey = decision.key;
            applyScopes(decision.price, decision.pause, decision.reason);
            identityBlocksPause = true;
            inventoryCatchingUp = false;
            for (const problem of privilege.problems) console.error(`signer-identity: ${problem}`);
            if (decision.alert) await emitGate(decision.alert);
            return 'privileged';
        }
        applyScopes(decided.price, decided.pause, decided.reason);
        inventoryCatchingUp = decided.price && !decided.pause;
        return 'ok';
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

    let releaseLock: (() => Promise<void>) | null = null;
    const refreshAlerted = new Set<string>();
    try {
    if (!dryRun && signerAddress && keystorePath && passwordFilePath) {
        if (pauseConfig) {
            const head = await pauseChain.latestHeader();
            if (!head) {
                console.error('pause-config: head unavailable');
                process.exit(1);
            }
            assertStartBlock(pauseConfig, head.number);
            assertRegistryStart(pauseConfig, head.number);
        }
        releaseLock = await acquireKeeperLock({ journalPath, chainId: config.chain.id, signer: signerAddress });
        const journal = new Journal(journalPath, { chainId: config.chain.id, signer: signerAddress });
        const opened = await journal.load();
        if (opened === 'corrupt' || opened === 'mismatch') {
            const reason = opened === 'mismatch' ? 'sender: journal belongs to another signer' : 'sender: journal corrupt';
            console.error(reason);
            await sendTelegramMessage(`[keeper] ${reason}`);
            await releaseLock();
            process.exit(1);
        }
        sender = new Sender({
            chain: adaptChainIO(publicClient),
            signer: createCastSigner({ castBin, keystorePath, passwordFilePath, signerAddress }),
            journal,
            signerAddress,
            chainId: config.chain.id,
            alert: alertLine,
        });
    }
    if (signerAddress) {
        const identity = await evaluateIdentity();
        if (!identity.ok) {
            for (const problem of identity.problems) console.error(`signer-identity: ${problem}`);
            await sendTelegramMessage(`[keeper] signer identity refused\n${identity.problems.join('\n')}`);
            if (releaseLock) await releaseLock();
            process.exit(1);
        }
        console.log('signer-identity=ok');
        const openedAt = Date.now();
        nextIdentityAt = scheduledIdentityAt(openedAt);
        lastIdentityOkAt = openedAt;
        identityGateKey = 'open';
        if (pauseConfig) {
            roleCatchUpArmed = true;
            roleCatchUpStartedAt = openedAt;
            const boot = decideRoleCatchUp({
                nowMs: openedAt,
                startedAt: openedAt,
                slice: 'pending',
                unpinnedPrivilege: false,
                previous: roleMarks,
            });
            roleMarks = boot.marks;
            inventoryCatchingUp = true;
            applyScopes(boot.price, boot.pause, boot.reason);
            if (boot.alert) await emitGate(boot.alert);
        } else if (sender) {
            applyScopes(true, true, '');
        }
    }

    const onExit = async (signal: string) => {
        if (releaseLock) await releaseLock();
        await sendTelegramMessage(
            `[keeper] stopped (${signal})\nnetwork=${network}\n` +
                `superPaymaster=${disableSuperPaymaster ? 'disabled' : superPaymaster}\n` +
                `paymaster=${disablePaymaster ? 'disabled' : paymaster || 'not-found'}`
        );
        process.exit(0);
    };

    process.on('SIGINT', () => void onExit('SIGINT'));
    process.on('SIGTERM', () => void onExit('SIGTERM'));

    await sendTelegramMessage(
        `[keeper] started\nnetwork=${network}\n` +
            `superPaymaster=${disableSuperPaymaster ? 'disabled' : superPaymaster}\n` +
            `paymaster=${disablePaymaster ? 'disabled' : paymaster || 'not-found'}\n` +
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
        try {
            const ctrl = new AbortController();
            const t = setTimeout(() => ctrl.abort(), 5000);
            const res = await fetch(externalEthUsdUrl, { signal: ctrl.signal });
            clearTimeout(t);
            if (!res.ok) return null;
            const json = await res.json();
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
        await maybeAlertLowBalance();

        if (currentSec - dayStartSec >= 86400n) {
            updatesTodayByPaymaster.clear();
            countedTx.clear();
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
        const baseFeeOk =
            !maxBaseFeeGwei ||
            (baseFeePerGas !== undefined && baseFeePerGas <= BigInt(Math.floor(Number(maxBaseFeeGwei) * 1e9)));

        const chainlink = await publicClient.readContract({
            address: priceFeed,
            abi: CHAINLINK_ABI,
            functionName: 'latestRoundData'
        });
        const chainlinkUpdatedAt = chainlink[3] as bigint;

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

        const cachedUpdatedAt = cache[1] as bigint;
        const thresholdSec = threshold as bigint;

        const validUntil = cachedUpdatedAt + thresholdSec;
        const deadline = validUntil > safetyMarginSec ? validUntil - safetyMarginSec : 0n;
        const chainlinkAge = chainlinkUpdatedAt > 0n ? currentSec - chainlinkUpdatedAt : 0n;

        const baseFeeInfo = baseFeePerGas !== undefined ? `${formatGwei(baseFeePerGas)} gwei` : 'n/a';

        const superCacheOk = cachedUpdatedAt > 0n && validUntil > currentSec;
        let paymasterCacheOk: boolean | null = null;
        const superAnswer = chainlink[1] as bigint;

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
                console.error('sender: send failed');
                await sendTelegramMessage(`[keeper] send failed\nnetwork=${network}\nkind=${kind}`);
                return;
            }
            const report = describePriceSend(result);
            if (report.kind === 'refused') {
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
                    const updated = (cache as { updatedAt?: bigint })?.updatedAt ?? (cache as unknown as readonly unknown[])[1];
                    if (typeof updated === 'bigint' && cacheConfirms(confirm.before, confirm.expected, updated)) confirmed = 'state-change';
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
            if (disableSuperPaymaster) return;
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
                console.log(`skip superPaymaster update: base fee above threshold (maxBaseFeeGwei=${maxBaseFeeGwei})`);
                return;
            }

            const updatesToday = updatesTodayByPaymaster.get(superPaymaster) || 0;
            if (updatesToday >= maxUpdatesPerDay) {
                console.log(`skip superPaymaster update: reached maxUpdatesPerDay=${maxUpdatesPerDay}`);
                return;
            }

            if (dryRun) {
                if (!priceOpen) return;
                console.log(`action=sendTx kind=super method=updatePrice() target=${superPaymaster} (dry-run)`);
                return;
            }

            console.log(`action=sendTx kind=super method=updatePrice() target=${superPaymaster}`);
            await broadcastUpdate(superPaymaster, 'super', SUPERPAYMASTER_ABI, { before: cachedUpdatedAt, expected: chainlinkUpdatedAt });
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
            if (!baseFeeOk && currentSec + 180n < pmValidUntil) {
                console.log(`skip paymaster update: base fee above threshold (maxBaseFeeGwei=${maxBaseFeeGwei})`);
                return;
            }

            const updatesToday = updatesTodayByPaymaster.get(paymaster) || 0;
            if (updatesToday >= maxUpdatesPerDay) {
                console.log(`skip paymaster update: reached maxUpdatesPerDay=${maxUpdatesPerDay}`);
                return;
            }

            if (dryRun) {
                if (!priceOpen) return;
                console.log(`action=sendTx kind=paymaster method=updatePrice() target=${paymaster} (dry-run)`);
                return;
            }

            console.log(`action=sendTx kind=paymaster method=updatePrice() target=${paymaster}`);
            await broadcastUpdate(paymaster, 'paymaster', PAYMASTER_V4_ABI, { before: BigInt(pmCachedUpdatedAt), expected: pmChainlinkUpdatedAt });
        };

        await refreshSuper();
        await refreshPaymaster();

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
    };

    async function refreshIdentity(): Promise<boolean> {
        pauseAtTickStart = pauseOpen;
        const nowMs = Date.now();
        if (sender && identityDue(nowMs, nextIdentityAt, inventoryCatchingUp || sender.gateOpen())) {
            const identity = await evaluateIdentity();
            const decision = decideIdentityGate({
                nowMs,
                lastOkAt: lastIdentityOkAt,
                previousKey: identityGateKey,
                verdict: identity,
            });
            lastIdentityOkAt = decision.lastOkAt;
            identityGateKey = decision.key;
            applyScopes(decision.price, decision.pause, decision.reason);
            identityBlocksPause = !identity.ok;
            if (!identity.ok) inventoryCatchingUp = false;
            if (!identity.ok) {
                for (const problem of identity.problems) console.error(`signer-identity: ${problem}`);
            }
            if (decision.alert) await emitGate(decision.alert);
            if (identity.ok) nextIdentityAt = scheduledIdentityAt(nowMs);
        }
        const caught = await advanceRoleCatchUp(nowMs);
        if (caught === 'privileged') return false;
        // Catch-up closes the pause gate without counting as "signer identity refused".
        if (inventoryCatchingUp) return true;
        return pauseOpen;
    }

    const pauseIntervalMs = Number(pauseIntervalSec) * 1000;

    async function runDuePause(): Promise<void> {
        if (!pauseConfig) return;
        if (!pauseAtTickStart) return;
        try {
            const result = await runPauseRound({
                chain: pauseChain,
                config: pauseConfig,
                chainId: config.chain.id,
                signer: signerAddress ?? undefined,
                sender: sender ?? undefined,
                dryRun,
                statePath: pauseStatePath,
                nowMs: Date.now(),
                alert: alertLine,
                log: (line) => console.log(line),
            });
            if (result.kind === 'sp-mismatch') {
                if (sender) {
                    const decision = decideIdentityGate({
                        nowMs: Date.now(),
                        lastOkAt: lastIdentityOkAt,
                        previousKey: identityGateKey,
                        verdict: { ok: false, kind: 'sp-mismatch', problems: [result.problem] },
                    });
                    lastIdentityOkAt = decision.lastOkAt;
                    identityGateKey = decision.key;
                    sender.setGate({ price: decision.price, pause: decision.pause, reason: decision.reason });
                    if (decision.alert) await sendTelegramMessage(`[keeper] ${decision.alert}`);
                }
                console.log(`pause-round=FAILED reasons=${result.problem} notes=${result.notes.join('; ')}`);
                const reported = pauseRoundAlert(pauseReasonAlert.key, { reasons: [result.problem] });
                pauseReasonAlert.key = reported.key;
                if (reported.alert) await sendTelegramMessage(`[keeper] ${reported.alert}`);
            } else if (result.kind === 'failed') {
                console.log(`pause-round=FAILED reasons=${result.reasons.join('; ')} notes=${result.notes.join('; ')}`);
                const reported = pauseRoundAlert(pauseReasonAlert.key, { reasons: result.reasons });
                pauseReasonAlert.key = reported.key;
                if (reported.alert) await sendTelegramMessage(`[keeper] ${reported.alert}`);
            } else {
                const reported = pauseRoundAlert(pauseReasonAlert.key, 'ok');
                pauseReasonAlert.key = reported.key;
                if (reported.alert) await sendTelegramMessage(`[keeper] ${reported.alert}`);
                console.log(
                    `pause-round=ok checked=${result.checked} understaked=${result.understaked.length} sent=${result.sent.length} notes=${result.notes.join('; ')}`
                );
            }
        } catch {
            console.log('pause-round=FAILED reasons=pause round rejected');
            const reported = pauseRoundAlert(pauseReasonAlert.key, { reasons: ['pause round rejected'] });
            pauseReasonAlert.key = reported.key;
            if (reported.alert) await sendTelegramMessage(`[keeper] ${reported.alert}`);
        }
        nextPauseAt = Date.now() + pauseIntervalMs;
    }

    for (;;) {
        try {
            const pauseDue = Boolean(pauseConfig) && Date.now() >= nextPauseAt;
            await runKeeperStep({
                refreshIdentity,
                tick,
                pauseDue,
                network,
                alerted: refreshAlerted,
                alert: async (msg) => {
                    console.error(msg);
                    await sendTelegramMessage(`[keeper] ${msg}`);
                },
                onPause: runDuePause,
                onPauseSkipped: async (reason) => {
                    console.log(`pause-round=FAILED reasons=${reason}`);
                    const reported = pauseRoundAlert(pauseReasonAlert.key, { reasons: [reason] });
                    pauseReasonAlert.key = reported.key;
                    if (reported.alert) await sendTelegramMessage(`[keeper] ${reported.alert}`);
                    nextPauseAt = Date.now() + pauseIntervalMs;
                },
            });
        } catch (e: unknown) {
            const report = loopErrorReport(network, e, 'error');
            console.error(`[${new Date().toISOString()}] error: ${report.stderr}`);
            try {
                await sendTelegramMessage(report.telegram);
            } catch {}
        }

        if (once) break;
        console.log('');
        console.log(section(`SLEEP ${pollIntervalSec.toString()}s`));
        await new Promise((r) => setTimeout(r, Number(pollIntervalSec) * 1000));
    }
    } finally {
        if (releaseLock) await releaseLock();
    }
}

main().catch(async (e) => {
    const report = loopErrorReport(activeNetwork, e, 'fatal');
    try {
        await sendTelegramMessage(report.telegram);
    } catch {}
    console.error(report.stderr);
    process.exit(1);
});
