import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { http, parseEther, formatEther, type Hex, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dynamic Env Loading - MUST BE SET BEFORE SDK IMPORT (which happens dynamically)
const NETWORK = 'sepolia';
process.env.NETWORK = NETWORK; 
process.env.EXPERIMENT_NETWORK = NETWORK; 
// Force re-evaluation if possible, but mostly ensure it's set before import
dotenv.config({ path: path.resolve(process.cwd(), `.env.${NETWORK}`) });

const RPC_URL = process.env.SEPOLIA_RPC_URL || process.env.RPC_URL;
const ANNI_KEY = (process.env.PRIVATE_KEY_ANNI || process.env.OPERATOR_KEY) as Hex;
// Correct address for Anni (Check if this matches the resume status)
const ANNI_AA = (process.env.TEST_SIMPLE_ACCOUNT_A || '0x975961302a83090B1eb94676E1430B5baCa43F9E') as Address;
const BOB_EOA = (process.env.BOB_EOA || '0x70997970C51812dc3A010C7d01b50e0d17dc79C8') as Address;

async function main() {
    console.log('🚀 ANNI Gasless Transaction Test (SDK Edition)');

    // Dynamically import SDK to ensure ENV vars are picked up
    const { 
        createOperatorClient, 
        createEndUserClient, 
        CORE_ADDRESSES,
        parseKey 
    } = await import('../packages/sdk/src/index.ts');
    
    if (!ANNI_KEY) throw new Error('PRIVATE_KEY_ANNI missing');
    const account = privateKeyToAccount(parseKey(ANNI_KEY));
    
    // Config object with Chain
    const clientConfig = { 
        chain: sepolia, 
        transport: http(RPC_URL), 
        account,
        addresses: {
            simpleAccountFactory: (process.env.SIMPLE_ACCOUNT_FACTORY || process.env["SimpleAccountFactoryv0.7"] || '0x9406Cc6185a346906296840746125a0E44976454') as Address
        }
    };

    const operator = createOperatorClient(clientConfig);
    const user = createEndUserClient(clientConfig);

    // Verify AA Address
    const { accountAddress: derivedAddress } = await user.createSmartAccount({ owner: account.address });
    
    console.log(`Derived SDK AA: ${derivedAddress}`);
    if (derivedAddress.toLowerCase() !== ANNI_AA.toLowerCase()) {
        console.warn(`⚠️ Warning: SDK Derived AA (${derivedAddress}) does not match ENV ANNI_AA (${ANNI_AA}). Funds/SBT might be on ENV address.`);
        console.warn(`To fix, ensure SIMPLE_ACCOUNT_FACTORY in .env matches the one used to deploy ${ANNI_AA} (0x9406Cc6185a346906296840746125a0E44976454 is default v0.7).`);
    }

    console.log(`Sender (AA): ${ANNI_AA}`);
    console.log(`Operator (EOA): ${account.address}`);

    // 1. Diagnostic Checks via SDK
    console.log('\n🔍 Diagnostic Status...');
    const opStatus = await operator.getOperatorStatus(account.address);
    const isReady = opStatus.superPaymaster?.isConfigured;
    const balance = opStatus.superPaymaster?.balance || 0n;
    
    console.log(`   Operator Configured: ${isReady ? '✅ Yes' : '❌ No'}`);
    console.log(`   aPNTs Credit: ${formatEther(balance)} aPNTs`);

    // 2. Ensure Readiness
    if (!isReady || balance < parseEther('10')) {
        console.log('   🔧 Auto-fixing Operator Status...');
        // onboardFully handles stake and deposit
        await operator.onboardFully({
            roleId: '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex, // PAYMASTER_SUPER
            stakeAmount: parseEther('50'),
            depositAmount: parseEther('100')
        });
        console.log('   ✅ Operator Onboarded/Refilled.');
    }

    // 3. Execute Gasless Transaction
    console.log('\n⚡ Submitting Gasless UserOperation...');
    try {
        const result = await user.executeGasless({
            target: BOB_EOA,
            data: '0x',
            value: parseEther('0.001'),
            operator: account.address
        });

        console.log(`   ✅ UserOp Hash: ${result.hash}`);
        console.log(`   ⏳ Waiting for execution...`);

        const receipt = await user.waitForTransactionReceipt({ hash: result.hash });
        console.log(`   🎉 Transaction Confirmed: ${receipt.transactionHash}`);
    } catch (e: any) {
        console.error(`   ❌ Execution Failed:`, e.message.split('\n')[0]);
        if (e.data) console.log(`   Error Data:`, e.data);
    }
}

main().catch(console.error);
