import { createPublicClient, createWalletClient, formatGwei, http, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { anvil, mainnet, optimism, optimismSepolia, sepolia } from 'viem/chains';
import { loadNetworkConfig, type NetworkName } from '../tests/regression/config.js';
import { CANONICAL_ADDRESSES } from '../packages/core/src/addresses.js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawn } from 'child_process';
import readline from 'readline';

type KeeperMode = 'cast' | 'privateKey';

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

async function promptHidden(prompt: string): Promise<string> {
    return await new Promise((resolve) => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
        const onData = (char: Buffer) => {
            const c = char.toString();
            if (c === '\n' || c === '\r' || c === '\u0004') return;
            readline.cursorTo(process.stdout, 0);
            process.stdout.write(prompt);
            process.stdout.write('*'.repeat((rl as any).line?.length || 0));
        };
        process.stdin.on('data', onData);
        rl.question(prompt, (value) => {
            process.stdin.off('data', onData);
            rl.close();
            process.stdout.write('\n');
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
        await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
            chat_id: chatId,
            text,
            disable_web_page_preview: true
        });
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
        '1) Private key mode (simplest):',
        '   - Set env: KEEPER_PRIVATE_KEY=0x... (or PRIVATE_KEY_SUPPLIER=0x...)',
        '   - Run: pnpm exec tsx scripts/keeper.ts --network op-mainnet',
        '',
        '2) Cast mode (use Foundry keystore/account):',
        '   - Run with keystore: pnpm exec tsx scripts/keeper.ts --network op-mainnet --mode cast --keystore <path>',
        '   - Or use cast account: pnpm exec tsx scripts/keeper.ts --network op-mainnet --mode cast --cast-account <name>',
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

async function runCastSend(params: {
    rpcUrl: string;
    target: `0x${string}`;
    keystorePath?: string;
    accountName?: string;
    passwordFilePath: string;
}): Promise<string> {
    const cmd = 'cast';
    const castArgs = ['send', '--rpc-url', params.rpcUrl, '--async', '--timeout', '60'];

    if (params.keystorePath) {
        castArgs.push('--keystore', params.keystorePath);
    } else if (params.accountName) {
        castArgs.push('--account', params.accountName);
    } else {
        throw new Error('cast mode requires --keystore or --cast-account/DEPLOYER_ACCOUNT');
    }

    castArgs.push('--password-file', params.passwordFilePath, params.target, 'updatePrice()');

    return await new Promise((resolve, reject) => {
        const child = spawn(cmd, castArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
        let out = '';
        let err = '';
        child.stdout.on('data', (d) => {
            out += d.toString();
        });
        child.stderr.on('data', (d) => {
            err += d.toString();
        });
        child.on('error', reject);
        child.on('close', (code) => {
            const merged = `${out}\n${err}`.trim();
            if (code !== 0) return reject(new Error(merged || `cast exited with code ${code}`));
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
    const args = process.argv.slice(2).filter((a) => a !== '--');
    const network = (getArgValue(args, '--network') || 'op-sepolia') as NetworkName;
    const mode = ((getArgValue(args, '--mode') || '').toLowerCase() as KeeperMode) || (getArgValue(args, '--keystore') ? 'cast' : 'privateKey');
    const pollIntervalSec = BigInt(getArgValue(args, '--poll-interval') || '30');
    const safetyMarginSec = BigInt(getArgValue(args, '--safety-margin') || '600');
    const maxUpdatesPerDay = Number(getArgValue(args, '--max-updates-per-day') || '24');
    const maxBaseFeeGwei = getArgValue(args, '--max-base-fee-gwei');
    const healthIntervalSec = BigInt(getArgValue(args, '--health-interval') || process.env.KEEPER_HEALTH_INTERVAL_SEC || '1800');
    const volatilityThresholdBps = BigInt(getArgValue(args, '--volatility-threshold-bps') || process.env.KEEPER_VOLATILITY_THRESHOLD_BPS || '0');
    const volatilityCooldownSec = BigInt(getArgValue(args, '--volatility-cooldown') || process.env.KEEPER_VOLATILITY_COOLDOWN_SEC || '600');
    const chainlinkStaleSec = BigInt(getArgValue(args, '--chainlink-stale-sec') || process.env.KEEPER_CHAINLINK_STALE_SEC || '600');
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
    for (const envFile of envFiles) {
        const fullPath = path.resolve(process.cwd(), envFile);
        if (fs.existsSync(fullPath)) {
            dotenv.config({ path: fullPath });
        }
    }
    assertTelegramConfigValid();
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
    const publicClient = createPublicClient({ chain: config.chain, transport: http(config.rpcUrl) });

    const canonical = (CANONICAL_ADDRESSES as Record<number, any>)[config.chain.id];
    const superPaymasterDefault = (canonical?.superPaymaster || config.contracts.superPaymaster) as `0x${string}`;
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

    let paymaster = (paymasterFromArgs || paymasterFromCanonical || paymasterFromConfig || null) as `0x${string}` | null;
    const paymasterWasExplicit = Boolean(paymasterFromArgs || paymasterFromCanonical || paymasterFromConfig);
    if (!disablePaymaster && !paymaster) {
        try {
            const derived = (await publicClient.readContract({
                address: paymasterFactory,
                abi: PAYMASTER_FACTORY_ABI,
                functionName: 'paymasterByOperator',
                args: [paymasterOperator]
            })) as `0x${string}`;
            if (derived && derived.toLowerCase() !== ZERO_ADDRESS) {
                paymaster = derived;
            }
        } catch {}
    }

    if (!disablePaymaster && paymaster && paymaster.toLowerCase() !== ZERO_ADDRESS) {
        try {
            const bytecode = await publicClient.getBytecode({ address: paymaster });
            if (!bytecode || bytecode === '0x') {
                paymaster = null;
            } else {
                const shouldVerifyOperatorMapping = Boolean(paymasterOperatorFromArgs) || !paymasterWasExplicit;
                if (shouldVerifyOperatorMapping) {
                    const mappedOperator = (await publicClient.readContract({
                        address: paymasterFactory,
                        abi: PAYMASTER_FACTORY_ABI,
                        functionName: 'getOperatorByPaymaster',
                        args: [paymaster]
                    })) as `0x${string}`;
                    if (mappedOperator.toLowerCase() !== paymasterOperator.toLowerCase()) {
                        paymaster = null;
                    }
                }
            }
        } catch {
            paymaster = null;
        }
    }

    if (printLogo) console.log(`${logo()}\n`);
    console.log(section('USAGE'));
    console.log(`${shortUsage()}\n`);

    console.log(section('INIT'));

    console.log(`network=${network}`);
    console.log(`rpcUrl=${config.rpcUrl}`);
    console.log(`superPaymaster=${disableSuperPaymaster ? 'disabled' : superPaymaster}`);
    console.log(`paymaster=${disablePaymaster ? 'disabled' : paymaster || 'not-found'}`);
    console.log(`paymasterFactory=${paymasterFactory}`);
    console.log(`paymasterOperator=${paymasterOperator}`);
    console.log(`priceFeed=${priceFeed}`);
    console.log(`mode=${mode}`);
    console.log(`pollIntervalSec=${pollIntervalSec.toString()}`);
    console.log(`safetyMarginSec=${safetyMarginSec.toString()}`);
    console.log(`healthIntervalSec=${healthIntervalSec.toString()}`);
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
    const keystorePath = getArgValue(args, '--keystore');
    const castAccount = getArgValue(args, '--cast-account') || process.env.DEPLOYER_ACCOUNT;
    const passwordFromEnv = process.env.CAST_KEYSTORE_PASSWORD;

    if (mode === 'cast') {
        if (!keystorePath && castAccount?.startsWith('0x')) {
            throw new Error('cast mode: when providing an address, use --keystore <path> instead of --cast-account');
        }
        if (!keystorePath && !castAccount) {
            throw new Error('cast mode requires --keystore or --cast-account (or DEPLOYER_ACCOUNT in env)');
        }
        if (!dryRun) {
            const pw = passwordFromEnv || (await promptHidden('Keystore password: '));
            const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'aastar-keeper-'));
            passwordFilePath = path.join(dir, 'pw');
            await fs.promises.writeFile(passwordFilePath, pw, { mode: 0o600 });
        }
    }

    const keeperKey = (process.env.KEEPER_PRIVATE_KEY || process.env.PRIVATE_KEY_SUPPLIER) as `0x${string}` | undefined;
    const keeperAccount = keeperKey ? privateKeyToAccount(keeperKey) : null;
    const walletClient = keeperAccount
        ? createWalletClient({ account: keeperAccount, chain: config.chain, transport: http(config.rpcUrl) })
        : null;

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
    }): Promise<'receipt' | 'state' | 'pending'> => {
        const hash = params.txHash as `0x${string}`;
        try {
            await publicClient.waitForTransactionReceipt({
                hash,
                timeout: 10 * 60 * 1000,
                pollingInterval: 2000
            });
            return 'receipt';
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
        await sendTelegramMessage(
            `[keeper] stopped (${signal})\nnetwork=${network}\n` +
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

        if (currentSec - dayStartSec >= 86400n) {
            updatesTodayByPaymaster.clear();
            dayStartSec = currentSec;
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

        const sendUpdate = async (target: `0x${string}`, kind: 'super' | 'paymaster'): Promise<string> => {
            if (mode === 'cast') {
                if (!passwordFilePath) throw new Error('cast mode requires password file (should have been created at startup)');
                return await runCastSend({
                    rpcUrl: config.rpcUrl,
                    target,
                    keystorePath: keystorePath || undefined,
                    accountName: !keystorePath ? castAccount || undefined : undefined,
                    passwordFilePath
                });
            }
            if (!walletClient || !keeperAccount) throw new Error('privateKey mode requires KEEPER_PRIVATE_KEY or PRIVATE_KEY_SUPPLIER');
            const abi = kind === 'super' ? SUPERPAYMASTER_ABI : PAYMASTER_V4_ABI;
            return await walletClient.writeContract({
                address: target,
                abi,
                functionName: 'updatePrice',
                account: keeperAccount
            });
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
                console.log(`action=sendTx kind=super method=updatePrice() target=${superPaymaster} (dry-run)`);
                return;
            }

            console.log(`action=sendTx kind=super method=updatePrice() target=${superPaymaster}`);
            const txHash = await sendUpdate(superPaymaster, 'super');
            updatesTodayByPaymaster.set(superPaymaster, updatesToday + 1);

            if (txHash) {
                const confirmedBy = await waitForReceiptOrState({
                    kind: 'super',
                    target: superPaymaster,
                    txHash,
                    beforeUpdatedAt: cachedUpdatedAt,
                    expectedUpdatedAt: chainlinkUpdatedAt
                });
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
            if (!paymaster) {
                console.log(`paymaster decision=skip reason=not-found`);
                return;
            }

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
                console.log(`action=sendTx kind=paymaster method=updatePrice() target=${paymaster} (dry-run)`);
                return;
            }

            console.log(`action=sendTx kind=paymaster method=updatePrice() target=${paymaster}`);
            const txHash = await sendUpdate(paymaster, 'paymaster');
            updatesTodayByPaymaster.set(paymaster, updatesToday + 1);

            if (txHash) {
                const confirmedBy = await waitForReceiptOrState({
                    kind: 'paymaster',
                    target: paymaster,
                    txHash,
                    beforeUpdatedAt: BigInt(pmCachedUpdatedAt),
                    expectedUpdatedAt: pmChainlinkUpdatedAt
                });
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

    for (;;) {
        try {
            await tick();
        } catch (e: any) {
            const msg = e?.message || String(e);
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
}

main().catch(async (e) => {
    try {
        await sendTelegramMessage(`[keeper] fatal\nmsg=${e?.message || String(e)}`);
    } catch {}
    console.error(e);
    process.exit(1);
});
