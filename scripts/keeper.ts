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

async function runCastSend(params: {
    rpcUrl: string;
    target: `0x${string}`;
    keystorePath?: string;
    accountName?: string;
    passwordFilePath: string;
}): Promise<string> {
    const cmd = 'cast';
    const castArgs = ['send', '--rpc-url', params.rpcUrl];

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
    const args = process.argv.slice(2).filter((a) => a !== '--');
    const network = (getArgValue(args, '--network') || 'op-sepolia') as NetworkName;
    const mode = ((getArgValue(args, '--mode') || '').toLowerCase() as KeeperMode) || (getArgValue(args, '--keystore') ? 'cast' : 'privateKey');
    const pollIntervalSec = BigInt(getArgValue(args, '--poll-interval') || '30');
    const safetyMarginSec = BigInt(getArgValue(args, '--safety-margin') || '600');
    const maxUpdatesPerDay = Number(getArgValue(args, '--max-updates-per-day') || '24');
    const maxBaseFeeGwei = getArgValue(args, '--max-base-fee-gwei');
    const dryRun = hasFlag(args, '--dry-run');
    const once = hasFlag(args, '--once');
    const printLogo = hasFlag(args, '--logo') || !hasFlag(args, '--no-logo');
    const disableSuperPaymaster = hasFlag(args, '--no-superpaymaster') || hasFlag(args, '--disable-superpaymaster');
    const disablePaymaster = hasFlag(args, '--no-paymaster') || hasFlag(args, '--disable-paymaster');

    const envFiles: string[] =
        network === 'op-mainnet' ? ['.env.optimism', '.env.op-mainnet'] : [`.env.${network}`];
    for (const envFile of envFiles) {
        const fullPath = path.resolve(process.cwd(), envFile);
        if (fs.existsSync(fullPath)) {
            dotenv.config({ path: fullPath });
        }
    }
    assertTelegramConfigValid();

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
    const paymasterOperatorFromArgs = getArgValue(args, '--paymaster-operator') as `0x${string}` | undefined;
    const paymasterOperator =
        (paymasterOperatorFromArgs ||
            (process.env.OFFICIAL_OPERATOR as `0x${string}` | undefined) ||
            (process.env.TEST_ACCOUNT_ADDRESS as `0x${string}` | undefined) ||
            ('0xb5600060e6de5E11D3636731964218E53caadf0E' as `0x${string}`)) as `0x${string}`;

    let paymaster = (paymasterFromArgs || paymasterFromCanonical || null) as `0x${string}` | null;
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
        } catch {
            paymaster = null;
        }
    }

    if (printLogo) console.log(`${logo()}\n`);

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
    console.log(`maxUpdatesPerDay=${maxUpdatesPerDay}`);
    console.log(`dryRun=${dryRun}`);

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
    let lastHeartbeatSec = 0n;
    let lastSuperUpdateTx: string | null = null;
    let lastPaymasterUpdateTx: string | null = null;
    let lastSuperError: string | null = null;
    let lastPaymasterError: string | null = null;

    const cleanup = async () => {
        try {
            if (passwordFilePath) {
                await fs.promises.rm(path.dirname(passwordFilePath), { recursive: true, force: true });
            }
        } catch {}
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

    const tick = async () => {
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
        const cacheAge = cachedUpdatedAt > 0n ? currentSec - cachedUpdatedAt : 0n;
        const chainlinkAge = chainlinkUpdatedAt > 0n ? currentSec - chainlinkUpdatedAt : 0n;

        const baseFeeInfo = baseFeePerGas !== undefined ? `${formatGwei(baseFeePerGas)} gwei` : 'n/a';

        if (currentSec - lastHeartbeatSec >= 3600n) {
            lastHeartbeatSec = currentSec;
            const msg = (() => {
                const parts = [
                    `[keeper] heartbeat`,
                    `network=${network}`,
                    `baseFee=${baseFeeInfo}`
                ];

                if (!disableSuperPaymaster) {
                    parts.push(
                        `superPaymaster=${superPaymaster}`,
                        `super.cacheUpdatedAt=${formatTs(cachedUpdatedAt)}`,
                        `super.cacheAgeSec=${cacheAge.toString()}`,
                        `super.chainlinkUpdatedAt=${formatTs(chainlinkUpdatedAt)}`,
                        `super.chainlinkAgeSec=${chainlinkAge.toString()}`,
                        `super.validUntil=${formatTs(validUntil)}`,
                        `super.lastUpdateTx=${lastSuperUpdateTx || 'n/a'}`,
                        `super.lastError=${lastSuperError || 'n/a'}`
                    );
                }

                if (!disablePaymaster) {
                    parts.push(
                        `paymaster=${paymaster || 'not-found'}`,
                        `paymaster.lastUpdateTx=${lastPaymasterUpdateTx || 'n/a'}`,
                        `paymaster.lastError=${lastPaymasterError || 'n/a'}`
                    );
                }

                return parts.join('\n');
            })();
            await sendTelegramMessage(msg);
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

            console.log(
                `[${new Date().toISOString()}] superPaymaster=${superPaymaster} cache.updatedAt=${formatTs(cachedUpdatedAt)} (age=${cacheAge}s) ` +
                    `chainlink.updatedAt=${formatTs(chainlinkUpdatedAt)} (age=${chainlinkAge}s) ` +
                    `validUntil=${formatTs(validUntil)} baseFee=${baseFeeInfo} updatesToday=${updatesTodayByPaymaster.get(superPaymaster) || 0}`
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
                console.log(`dry-run: would send superPaymaster updatePrice() target=${superPaymaster}`);
                return;
            }

            const txHash = await sendUpdate(superPaymaster, 'super');
            lastSuperUpdateTx = txHash || null;
            updatesTodayByPaymaster.set(superPaymaster, updatesToday + 1);
            lastSuperError = null;

            if (txHash) {
                await publicClient.waitForTransactionReceipt({ hash: txHash as `0x${string}` });
                console.log(`updated: superPaymaster tx=${txHash}`);
                await sendTelegramMessage(`[keeper] superPaymaster updatePrice success\nnetwork=${network}\ntarget=${superPaymaster}\ntx=${txHash}`);
            } else {
                console.log(`updated: tx hash not detected (cast output parse) target=${superPaymaster}`);
            }
        };

        const refreshPaymaster = async () => {
            if (disablePaymaster) return;
            if (!paymaster) {
                console.log(`[${new Date().toISOString()}] paymaster=not-found`);
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
            const pmCacheAge = BigInt(pmCachedUpdatedAt) > 0n ? currentSec - BigInt(pmCachedUpdatedAt) : 0n;
            const pmChainlinkAge = pmChainlinkUpdatedAt > 0n ? currentSec - pmChainlinkUpdatedAt : 0n;

            const shouldUpdate =
                BigInt(pmCachedUpdatedAt) === 0n ||
                (currentSec >= pmDeadline && pmChainlinkUpdatedAt > BigInt(pmCachedUpdatedAt) && pmChainlinkUpdatedAt + pmThresholdSec >= currentSec);

            console.log(
                `[${new Date().toISOString()}] paymaster=${paymaster} cache.updatedAt=${formatTs(BigInt(pmCachedUpdatedAt))} (age=${pmCacheAge}s) ` +
                    `chainlink.updatedAt=${formatTs(pmChainlinkUpdatedAt)} (age=${pmChainlinkAge}s) ` +
                    `validUntil=${formatTs(pmValidUntil)} baseFee=${baseFeeInfo} updatesToday=${updatesTodayByPaymaster.get(paymaster) || 0}`
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
                console.log(`dry-run: would send paymaster updatePrice() target=${paymaster}`);
                return;
            }

            const txHash = await sendUpdate(paymaster, 'paymaster');
            lastPaymasterUpdateTx = txHash || null;
            updatesTodayByPaymaster.set(paymaster, updatesToday + 1);
            lastPaymasterError = null;

            if (txHash) {
                await publicClient.waitForTransactionReceipt({ hash: txHash as `0x${string}` });
                console.log(`updated: paymaster tx=${txHash}`);
                await sendTelegramMessage(`[keeper] paymaster updatePrice success\nnetwork=${network}\ntarget=${paymaster}\ntx=${txHash}`);
            } else {
                console.log(`updated: tx hash not detected (cast output parse) target=${paymaster}`);
            }
        };

        await refreshSuper();
        await refreshPaymaster();
    };

    for (;;) {
        try {
            await tick();
        } catch (e: any) {
            const msg = e?.message || String(e);
            console.error(`[${new Date().toISOString()}] error: ${msg}`);
            lastSuperError = msg;
            lastPaymasterError = msg;
            try {
                await sendTelegramMessage(`[keeper] error\nnetwork=${network}\nmsg=${msg}`);
            } catch {}
        }

        if (once) break;
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
