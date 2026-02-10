
import { createPublicClient, createWalletClient, http, parseEther, formatEther, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { PaymasterClient, SuperPaymasterClient, formatUserOpV07 } from '../packages/paymaster/src/V4/index.js'; 
import { UserOpScenarioBuilder, UserOpScenarioType } from '../packages/sdk/src/utils/testScenarios.js';
import { loadNetworkConfig } from '../tests/regression/config.js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

async function main() {
    console.log(`\n🚀 Starting L4 Regression (Traffic Generation)...`);
    
    // 1. Config
    const args = process.argv.slice(2);
    const networkArgIndex = args.indexOf('--network');
    const networkName = (networkArgIndex >= 0 ? args[networkArgIndex + 1] : 'op-sepolia') as any;
    
    console.log(`   📡 Network: ${networkName}`);
    
    // Load ENV for the specific network
    const envFile = `.env.${networkName}`;
    dotenv.config({ path: path.resolve(process.cwd(), envFile) });

    const config = loadNetworkConfig(networkName);
    const bundlerUrl = config.bundlerUrl;
    const publicClient: any = createPublicClient({ chain: config.chain, transport: http(config.rpcUrl) });
    const supplier = privateKeyToAccount(process.env.PRIVATE_KEY_SUPPLIER as `0x${string}`);
    const supplierWallet: any = createWalletClient({ account: supplier, chain: config.chain, transport: http(config.rpcUrl) });
    const bundlerRpc: any = createPublicClient({ chain: config.chain, transport: http(bundlerUrl) });

    // 2. Load State from l4-setup
    const STATE_FILE = path.resolve(process.cwd(), `scripts/l4-state.${networkName}.json`);
    if (!fs.existsSync(STATE_FILE)) {
        throw new Error(`State file not found: ${STATE_FILE}. Please run l4-setup.ts first.`);
    }
    const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    console.log(`   📂 Loaded State: ${state.operators?.jason?.address}`);

    // 3. Prepare Scenarios
    const jasonAcc = privateKeyToAccount(process.env.PRIVATE_KEY_JASON as `0x${string}`);
    // Check if Anni key is available, else fallback or skip
    const anniKey = process.env.PRIVATE_KEY_ANNI as `0x${string}`;
    const anniAcc = anniKey ? privateKeyToAccount(anniKey) : null;

    // Accounts from State
    const targetAA = state.aaAccounts[0]; // Jason AA1
    const jPNTsToken = state.operators.jason.tokenAddress;
    const jPm = state.operators.jason.paymasterV4;
    const superPM = config.contracts.superPaymaster;

    const recipientEOA = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'; // vitalik.eth

    const scenarios = [
        { type: UserOpScenarioType.NATIVE, label: '1. Standard ERC-4337 (User pays ETH)' },
        { 
            type: UserOpScenarioType.GASLESS_V4, 
            label: '2. Gasless via PaymasterV4 (Jason Community)', 
            paymaster: jPm, 
            token: jPNTsToken 
        },
        { 
            type: UserOpScenarioType.SUPER_BPNT, 
            label: '3. SuperPaymaster (Internal Settlement)', 
            paymaster: superPM, 
            sceneUser: 'anni' // Flag to switch user
        }
    ];

    // 4. Execute Scenarios
    for (const scene of scenarios) {
        console.log(`\n--- ${scene.label} ---`);

        // Determine Actor
        let sceneOwner = jasonAcc;
        let sceneSender = targetAA.address; 
        let sceneToken = scene.token || jPNTsToken;

        if (scene.sceneUser === 'anni') {
            if (!anniAcc) {
                console.log('   ⚠️ Skipping Anni scenario (Key not found)');
                continue;
            }
            sceneOwner = anniAcc;
            // Find Anni's AA from state
            const anniAAState = state.aaAccounts.find((a: any) => a.owner === anniAcc.address);
            if (!anniAAState) {
                console.log('   ⚠️ Skipping Anni scenario (AA not found in state)');
                continue;
            }
            sceneSender = anniAAState.address;
            sceneToken = state.operators.anni.tokenAddress || jPNTsToken;
            console.log(`   🔄 Switched Actor to Anni (Sender: ${sceneSender})`);
        }

        try {
            if (scene.type === UserOpScenarioType.GASLESS_V4) {
               console.log(`   🚀 Sending Gasless UserOperation via SDK...`);
               const paymasterOracleAbi = parseAbi([
                    'function updatePrice()',
                    'function updatePriceDVT(int256 price, uint256 updatedAt, bytes proof)',
                    'function cachedPrice() view returns (int256 price, uint256 updatedAt, uint80 roundId, uint8 decimals)'
               ]);

               const ownerWallet = createWalletClient({ account: sceneOwner, chain: config.chain, transport: http(config.rpcUrl) });

               try {
                    console.log(`   🧭 Refreshing PaymasterV4 price cache...`);
                    try {
                        const hash = await ownerWallet.writeContract({
                            address: scene.paymaster!,
                            abi: paymasterOracleAbi,
                            functionName: 'updatePrice'
                        });
                        await publicClient.waitForTransactionReceipt({ hash });
                        console.log(`   ✅ Price cache refreshed via updatePrice: ${hash}`);
                    } catch {
                        const price = 300000000000n;
                        const updatedAt = BigInt(Math.floor(Date.now() / 1000));
                        const hash = await ownerWallet.writeContract({
                            address: scene.paymaster!,
                            abi: paymasterOracleAbi,
                            functionName: 'updatePriceDVT',
                            args: [price, updatedAt, '0x']
                        });
                        await publicClient.waitForTransactionReceipt({ hash });
                        console.log(`   ✅ Price cache refreshed via updatePriceDVT: ${hash}`);
                    }
               } catch (e: any) {
                    console.log(`   ⚠️ PaymasterV4 price cache refresh skipped: ${e.message}`);
               }

               const callData = PaymasterClient.encodeExecution(
                    sceneToken, 
                    0n,                                    
                    PaymasterClient.encodeTokenTransfer(sceneOwner.address, parseEther('1'))
               );

               const txHash = await PaymasterClient.submitGaslessUserOperation(
                   publicClient,
                   ownerWallet,
                   sceneSender,
                   config.contracts.entryPoint,
                   scene.paymaster!,
                   sceneToken,
                   bundlerUrl,
                   callData
               );
               console.log(`   ✅ UserOp Sent! Hash: ${txHash}`);
               await waitForReceipt(bundlerRpc, txHash);

            } else if (scene.type === UserOpScenarioType.SUPER_BPNT) {
                console.log(`   🚀 Sending SuperPaymaster UserOperation via SDK...`);
                const superPaymasterAbi = parseAbi([
                    'function operators(address operator) view returns (uint128 aPNTsBalance, uint96 exchangeRate, bool isConfigured, bool isPaused, address xPNTsToken, uint32 reputation, uint48 minTxInterval, address treasury, uint256 totalSpent, uint256 totalTxSponsored)',
                    'function getAvailableCredit(address user, address token) view returns (uint256)'
                ]);
                const superPaymasterOracleAbi = parseAbi([
                    'function updatePrice()',
                    'function updatePriceDVT(int256 price, uint256 updatedAt, bytes proof)',
                    'function cachedPrice() view returns (int256 price, uint256 updatedAt, uint80 roundId, uint8 decimals)'
                ]);
                const registryAbi = parseAbi(['function getCreditLimit(address user) view returns (uint256)']);
                const xpntsAbi = parseAbi([
                    'function getDebt(address user) view returns (uint256)',
                    'function exchangeRate() view returns (uint256)'
                ]);

                try {
                    const cache: any = await publicClient.readContract({
                        address: scene.paymaster!,
                        abi: superPaymasterOracleAbi,
                        functionName: 'cachedPrice'
                    });
                    const cachedUpdatedAt = BigInt(cache[1] as bigint);
                    const now = BigInt(Math.floor(Date.now() / 1000));
                    const isStale = cachedUpdatedAt === 0n || cachedUpdatedAt + 3600n < now;
                    if (isStale) {
                        console.log(`   🧭 Refreshing SuperPaymaster price cache...`);
                        try {
                            const hash = await supplierWallet.writeContract({
                                address: scene.paymaster!,
                                abi: superPaymasterOracleAbi,
                                functionName: 'updatePrice'
                            });
                            await publicClient.waitForTransactionReceipt({ hash });
                            console.log(`   ✅ Price cache refreshed via updatePrice: ${hash}`);
                        } catch (e: any) {
                            const price = 300000000000n;
                            const updatedAt = BigInt(Math.floor(Date.now() / 1000));
                            const hash = await supplierWallet.writeContract({
                                address: scene.paymaster!,
                                abi: superPaymasterOracleAbi,
                                functionName: 'updatePriceDVT',
                                args: [price, updatedAt, '0x']
                            });
                            await publicClient.waitForTransactionReceipt({ hash });
                            console.log(`   ✅ Price cache refreshed via updatePriceDVT: ${hash}`);
                        }
                    }
                } catch (e: any) {
                    console.log(`   ⚠️ Price cache refresh skipped: ${e.message}`);
                }

                let xpntsToken = '0x0000000000000000000000000000000000000000';
                try {
                    const opCfg: any = await publicClient.readContract({
                        address: scene.paymaster!,
                        abi: superPaymasterAbi,
                        functionName: 'operators',
                        args: [sceneOwner.address]
                    });
                    xpntsToken = opCfg[4] as string;
                } catch (e: any) {
                    console.log(`   ⚠️ Failed to read operator config: ${e.message}`);
                }

                let debtBefore = 0n;
                let debtAfter = 0n;
                let creditLimit = 0n;
                let creditBefore = 0n;
                let creditAfter = 0n;
                let exchangeRate = 0n;

                if (xpntsToken !== '0x0000000000000000000000000000000000000000') {
                    try {
                        exchangeRate = (await publicClient.readContract({
                            address: xpntsToken as any,
                            abi: xpntsAbi,
                            functionName: 'exchangeRate'
                        })) as bigint;
                    } catch {}

                    try {
                        debtBefore = (await publicClient.readContract({
                            address: xpntsToken as any,
                            abi: xpntsAbi,
                            functionName: 'getDebt',
                            args: [sceneSender]
                        })) as bigint;
                    } catch (e: any) {
                        console.log(`   ⚠️ Failed to read debt (before): ${e.message}`);
                    }

                    try {
                        creditLimit = (await publicClient.readContract({
                            address: config.contracts.registry,
                            abi: registryAbi,
                            functionName: 'getCreditLimit',
                            args: [sceneSender]
                        })) as bigint;
                    } catch {}

                    try {
                        creditBefore = (await publicClient.readContract({
                            address: scene.paymaster!,
                            abi: superPaymasterAbi,
                            functionName: 'getAvailableCredit',
                            args: [sceneSender, xpntsToken as any]
                        })) as bigint;
                    } catch {}

                    console.log(`   📌 xPNTsToken: ${xpntsToken}`);
                    if (exchangeRate > 0n) console.log(`   📌 exchangeRate: ${exchangeRate.toString()}`);
                    console.log(`   📌 debtBefore: ${formatEther(debtBefore)} xPNTs`);
                    console.log(`   📌 creditLimit: ${formatEther(creditLimit)} aPNTs`);
                    console.log(`   📌 availableCreditBefore: ${formatEther(creditBefore)} aPNTs`);
                } else {
                    console.log(`   ⚠️ Operator has no xPNTsToken configured; skipping debt/credit verification.`);
                }

                const txHash = await SuperPaymasterClient.submitGaslessTransaction(
                    publicClient,
                    createWalletClient({ account: sceneOwner, chain: config.chain, transport: http(config.rpcUrl) }),
                    sceneSender,
                    config.contracts.entryPoint,
                    bundlerUrl,
                    {
                        token: sceneToken,
                        recipient: recipientEOA,
                        amount: parseEther('1'),
                        operator: sceneOwner.address, // Owner acts as operator for self in this test
                        paymasterAddress: scene.paymaster!
                    }
                );
                console.log(`   ✅ UserOp Sent! Hash: ${txHash}`);
                await waitForReceipt(bundlerRpc, txHash);

                if (xpntsToken !== '0x0000000000000000000000000000000000000000') {
                    try {
                        debtAfter = (await publicClient.readContract({
                            address: xpntsToken as any,
                            abi: xpntsAbi,
                            functionName: 'getDebt',
                            args: [sceneSender]
                        })) as bigint;
                    } catch (e: any) {
                        console.log(`   ⚠️ Failed to read debt (after): ${e.message}`);
                    }

                    try {
                        creditAfter = (await publicClient.readContract({
                            address: scene.paymaster!,
                            abi: superPaymasterAbi,
                            functionName: 'getAvailableCredit',
                            args: [sceneSender, xpntsToken as any]
                        })) as bigint;
                    } catch {}

                    const deltaDebt = debtAfter - debtBefore;
                    const deltaCredit = creditAfter - creditBefore;

                    console.log(`   📌 debtAfter: ${formatEther(debtAfter)} xPNTs (Δ ${formatEther(deltaDebt)} xPNTs)`);
                    console.log(`   📌 availableCreditAfter: ${formatEther(creditAfter)} aPNTs (Δ ${formatEther(deltaCredit)} aPNTs)`);
                }

            } else {
                // NATIVE
                const { userOp, opHash } = await UserOpScenarioBuilder.buildTransferScenario(scene.type, {
                    sender: sceneSender,
                    ownerAccount: sceneOwner,
                    recipient: recipientEOA,
                    tokenAddress: sceneToken, 
                    amount: parseEther('1'),
                    entryPoint: config.contracts.entryPoint,
                    chainId: config.chain.id,
                    publicClient,
                    paymaster: scene.paymaster,
                    operator: sceneOwner.address
                });

                console.log(`   UserOp Hash (Calculated): ${opHash}`);
                console.log(`   🚀 Sending UserOperation...`);
                
                const formattedUserOp = formatUserOpV07({
                    ...userOp,
                    nonce: BigInt(userOp.nonce),
                    preVerificationGas: BigInt(userOp.preVerificationGas)
                });

                const sentOpHash = await bundlerRpc.request({
                    method: 'eth_sendUserOperation',
                    params: [formattedUserOp, config.contracts.entryPoint]
                });
                console.log(`   ✅ UserOp Sent! Hash: ${sentOpHash}`);
                await waitForReceipt(bundlerRpc, sentOpHash);
            }
        } catch (e: any) {
             console.error(`   ❌ Failed: ${e.message}`);
        }
    }
    console.log(`\n✅ L4 Regression Complete.\n`);
}

async function waitForReceipt(bundlerRpc: any, hash: string) {
    process.stdout.write(`   ⏳ Waiting for receipt...`);
    for (;;) {
        const receipt = await bundlerRpc.request({
            method: 'eth_getUserOperationReceipt',
            params: [hash]
        });
        if (receipt?.receipt?.transactionHash) {
            console.log(`\n   🎉 Mined! TxHash: ${receipt.receipt.transactionHash}`);
            return;
        }
        await new Promise((r) => setTimeout(r, 1500));
    }
}

main().catch(console.error);
