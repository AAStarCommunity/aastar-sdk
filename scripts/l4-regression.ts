
import { createPublicClient, createWalletClient, http, parseEther, createClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { createBundlerClient } from 'viem/account-abstraction';
import { PaymasterClient, SuperPaymasterClient } from '../packages/paymaster/src/V4/index.js'; 
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

    const config = await loadNetworkConfig(networkName);
    const publicClient = createPublicClient({ chain: config.chain, transport: http(config.rpcUrl) });
    const supplier = privateKeyToAccount(process.env.PRIVATE_KEY_SUPPLIER as `0x${string}`);

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
               const callData = PaymasterClient.encodeExecution(
                    sceneToken, 
                    0n,                                    
                    PaymasterClient.encodeTokenTransfer(sceneOwner.address, parseEther('1'))
               );

               const txHash = await PaymasterClient.submitGaslessUserOperation(
                   publicClient,
                   createWalletClient({ account: sceneOwner, chain: config.chain, transport: http(config.rpcUrl) }),
                   sceneSender,
                   config.contracts.entryPoint,
                   scene.paymaster!,
                   sceneToken,
                   process.env.BUNDLER_URL || config.rpcUrl,
                   callData
               );
               console.log(`   ✅ UserOp Sent! Hash: ${txHash}`);
               await waitForReceipt(publicClient, txHash);

            } else if (scene.type === UserOpScenarioType.SUPER_BPNT) {
                console.log(`   🚀 Sending SuperPaymaster UserOperation via SDK...`);
                const txHash = await SuperPaymasterClient.submitGaslessTransaction(
                    publicClient,
                    createWalletClient({ account: sceneOwner, chain: config.chain, transport: http(config.rpcUrl) }),
                    sceneSender,
                    config.contracts.entryPoint,
                    process.env.BUNDLER_URL || config.rpcUrl,
                    {
                        token: sceneToken,
                        recipient: recipientEOA,
                        amount: parseEther('1'),
                        operator: sceneOwner.address, // Owner acts as operator for self in this test
                        paymasterAddress: scene.paymaster!
                    }
                );
                console.log(`   ✅ UserOp Sent! Hash: ${txHash}`);
                await waitForReceipt(publicClient, txHash);

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
                
                const bundlerClient = createBundlerClient({
                    client: publicClient,
                    transport: http(process.env.BUNDLER_URL || config.rpcUrl),
                    account: supplier 
                });

                const sentOpHash = await bundlerClient.sendUserOperation({
                     userOperation: userOp,
                     entryPoint: config.contracts.entryPoint
                });
                console.log(`   ✅ UserOp Sent! Hash: ${sentOpHash}`);
                await waitForReceipt(publicClient, sentOpHash);
            }
        } catch (e: any) {
             console.error(`   ❌ Failed: ${e.message}`);
        }
    }
    console.log(`\n✅ L4 Regression Complete.\n`);
}

async function waitForReceipt(publicClient: any, hash: string) {
     const bundlerClient = createBundlerClient({
        client: publicClient,
        transport: http(process.env.BUNDLER_URL)
    });
    process.stdout.write(`   ⏳ Waiting for receipt...`);
    const receipt = await bundlerClient.waitForUserOperationReceipt({ hash: hash as `0x${string}` });
    console.log(`\n   🎉 Mined! TxHash: ${receipt.receipt.transactionHash}`);
}

main().catch(console.error);
