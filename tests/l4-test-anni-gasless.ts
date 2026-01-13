
import { http, parseEther, formatEther, type Hex, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { 
    createOperatorClient, 
    createEndUserClient, 
    CORE_ADDRESSES,
    parseKey 
} from '../packages/sdk/src/index.ts';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dynamic Env Loading
const NETWORK = 'sepolia';
dotenv.config({ path: path.resolve(process.cwd(), `.env.${NETWORK}`) });

const RPC_URL = process.env.SEPOLIA_RPC_URL || process.env.RPC_URL;
const ANNI_KEY = (process.env.PRIVATE_KEY_ANNI || process.env.OPERATOR_KEY) as Hex;
const ANNI_AA = (process.env.TEST_SIMPLE_ACCOUNT_A || '0x975961302a83090B1eb94676E1430B5baCa43F9E') as Address;
const BOB_EOA = (process.env.BOB_EOA || '0x70997970C51812dc3A010C7d01b50e0d17dc79C8') as Address;

async function main() {
    console.log('🚀 ANNI Gasless Transaction Test (SDK Edition)');
    
    if (!ANNI_KEY) throw new Error('PRIVATE_KEY_ANNI missing');
    const account = privateKeyToAccount(parseKey(ANNI_KEY));
    
    const operator = createOperatorClient({ transport: http(RPC_URL), account });
    const user = createEndUserClient({ transport: http(RPC_URL), account });

    console.log(`Sender (AA): ${ANNI_AA}`);
    console.log(`Operator (EOA): ${account.address}`);

    // 1. Diagnostic Checks via SDK
    console.log('\n🔍 Diagnostic Status...');
    const opStatus = await operator.getOperatorStatus(account.address);
    console.log(`   Operator Configured: ${opStatus.isSuperPaymaster ? '✅ Yes' : '❌ No'}`);
    console.log(`   aPNTs Credit: ${formatEther(opStatus.deposit)} aPNTs`);

    // 2. Ensure Readiness
    if (!opStatus.isSuperPaymaster || opStatus.deposit < parseEther('10')) {
        console.log('   🔧 Auto-fixing Operator Status...');
        // onboardFully handles stake and deposit
        await operator.onboardFully({
            roleId: '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex, // Placeholder or actual ROLE_PAYMASTER_SUPER
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
            value: parseEther('0.001') // Send some ETH gaslessly
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
