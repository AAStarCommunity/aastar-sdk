import { createPublicClient, createWalletClient, http, parseEther, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { PaymasterV4Client } from '../packages/paymaster/src/V4/index.js';
import { loadNetworkConfig } from '../tests/regression/config.js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.sepolia' });

async function main() {
    console.log('🛠️  Preparing Gasless Environment...');
    
    // 0. Load Config & Operator Account (Anni)
    const config = await loadNetworkConfig('sepolia');
    const rpcUrl = process.env.RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/your-key';
    const anniAccount = privateKeyToAccount(process.env.PRIVATE_KEY_ANNI as `0x${string}`);
    const client = createPublicClient({ chain: sepolia, transport: http(rpcUrl) });
    const operatorWallet = createWalletClient({ account: anniAccount, chain: sepolia, transport: http(rpcUrl) });

    const APP_CONFIG = {
        paymaster: '0x82862b7c3586372DF1c80Ac60adA57e530b0eB82' as Address, // Anni PM
        gasToken: '0x424DA26B172994f98D761a999fa2FD744CaF812b' as Address,   // dPNTs
        aaAccount: '0xECD9C07f648B09CFb78906302822Ec52Ab87dd70' as Address,  // Jason AA1
        entryPoint: config.contracts.entryPoint as Address
    };

    console.log(`Operator: ${anniAccount.address}`);
    console.log(`Paymaster: ${APP_CONFIG.paymaster}`);
    console.log(`Target App User: ${APP_CONFIG.aaAccount}`);

    // 1. Diagnose
    console.log('\n🔍 Check 1: Diagnosing SDK Readiness...');
    const report = await PaymasterV4Client.checkGaslessReadiness(
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

    const steps = await PaymasterV4Client.prepareGaslessEnvironment(
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
    const userDeposit = await PaymasterV4Client.getDepositedBalance(client, APP_CONFIG.paymaster, APP_CONFIG.aaAccount, APP_CONFIG.gasToken);
    if (userDeposit < parseEther('50')) {
        console.log(`\n🏦 Seeding User Deposit (Current: ${userDeposit})...`);
        
        // Approve
        const hashApprove = await PaymasterV4Client.approveGasToken(
            operatorWallet,
            APP_CONFIG.gasToken,
            APP_CONFIG.paymaster,
            parseEther('100')
        );
        await client.waitForTransactionReceipt({ hash: hashApprove });

        // Deposit
        const hashDep = await PaymasterV4Client.depositFor(operatorWallet, APP_CONFIG.paymaster, APP_CONFIG.aaAccount, APP_CONFIG.gasToken, parseEther('50'));
        await client.waitForTransactionReceipt({ hash: hashDep as `0x${string}` });
        console.log('   ✅ Seeded 50 dPNTs.');
    }

    console.log('\n🎉 ALL SET! Run `npx tsx examples/simple-gasless-demo.ts` now.');
}

main().catch(console.error);
