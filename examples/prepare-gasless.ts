import { createPublicClient, createWalletClient, http, parseEther, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { PaymasterClient, PaymasterOperator } from '../packages/paymaster/src/V4/index.js';
import { loadNetworkConfig } from '../tests/regression/config.js';
import * as dotenv from 'dotenv';

// Environment and network config handled by loadNetworkConfig

async function main() {
    console.log('🛠️  Preparing Gasless Environment...');
    
    const args = process.argv.slice(2);
    const networkArgIndex = args.indexOf('--network');
    const networkName = (networkArgIndex >= 0 ? args[networkArgIndex + 1] : 'sepolia') as any;
    
    // 0. Load Config & Operator Account (Anni)
    const config = await loadNetworkConfig(networkName);
    const rpcUrl = config.rpcUrl;
    const anniAccount = privateKeyToAccount(process.env.PRIVATE_KEY_ANNI as `0x${string}`);
    const client = createPublicClient({ chain: config.chain, transport: http(rpcUrl) });
    const operatorWallet = createWalletClient({ account: anniAccount, chain: config.chain, transport: http(rpcUrl) });

    // Load state
    const statePath = path.resolve(process.cwd(), `scripts/l4-state.${networkName}.json`);
    if (!fs.existsSync(statePath)) throw new Error(`State file not found: ${statePath}. Please run l4-setup first.`);
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));

    const APP_CONFIG = {
        paymaster: state.operators?.anni?.paymasterV4 || state.operators?.anni?.superPaymaster as Address,
        gasToken: config.contracts.aPNTs as Address,
        aaAccount: state.aaAccounts.find((a: any) => a.label.includes('Anni'))?.address as Address,
        entryPoint: config.contracts.entryPoint as Address
    };
    
    if (!APP_CONFIG.paymaster) throw new Error("Anni Paymaster not found in state.");
    if (!APP_CONFIG.aaAccount) throw new Error("Anni AA account not found in state.");

    console.log(`Operator: ${anniAccount.address}`);
    console.log(`Paymaster: ${APP_CONFIG.paymaster}`);
    console.log(`Target App User: ${APP_CONFIG.aaAccount}`);

    // 1. Diagnose
    console.log('\n🔍 Check 1: Diagnosing SDK Readiness...');
    const report = await PaymasterOperator.checkGaslessReadiness(
        client,
        APP_CONFIG.entryPoint,
        APP_CONFIG.paymaster,
        APP_CONFIG.aaAccount,
        APP_CONFIG.gasToken
    );

    if (report.isReady) {
        console.log('✅ Environment is READY. You can run the simple demo now!');
        return;
    }

    // 2. Auto-Heal
    console.log('⚠️  Environment Not Ready. Fixing...');
    console.log('Issues:', report.issues);

    const steps = await PaymasterOperator.prepareGaslessEnvironment(
        operatorWallet,
        client,
        APP_CONFIG.entryPoint,
        APP_CONFIG.paymaster,
        APP_CONFIG.gasToken,
        { tokenPriceUSD: 100000000n } // $1.00 USD
    );

    for (const s of steps) {
        console.log(`   🚀 Executing: ${s.step}...`);
        console.log(`      Hash: ${s.hash}`);
        await client.waitForTransactionReceipt({ hash: s.hash as `0x${string}` });
        console.log('      ✅ Confirmed.');
    }

    // 3. User Deposit Check (Optional Seeding)
    const userDeposit = await PaymasterClient.getDepositedBalance(client, APP_CONFIG.paymaster, APP_CONFIG.aaAccount, APP_CONFIG.gasToken);
    if (userDeposit < parseEther('50')) {
        console.log(`\n🏦 Seeding User Deposit (Current: ${userDeposit})...`);
        
        // Approve
        const hashApprove = await PaymasterClient.approveGasToken(
            operatorWallet,
            APP_CONFIG.gasToken,
            APP_CONFIG.paymaster,
            parseEther('100')
        );
        await client.waitForTransactionReceipt({ hash: hashApprove });

        // Deposit
        const hashDep = await PaymasterClient.depositFor(operatorWallet, APP_CONFIG.paymaster, APP_CONFIG.aaAccount, APP_CONFIG.gasToken, parseEther('50'));
        await client.waitForTransactionReceipt({ hash: hashDep as `0x${string}` });
        console.log('   ✅ Seeded 50 dPNTs.');
    }

    console.log('\n🎉 ALL SET! Run `npx tsx examples/simple-gasless-demo.ts` now.');
}

main().catch(console.error);
