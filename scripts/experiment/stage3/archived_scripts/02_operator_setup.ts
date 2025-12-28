
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { http, type Hex, parseEther, type Address, createPublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { createOperatorClient, RoleIds } from '../../../packages/sdk/src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env.sepolia') });

async function main() {
    console.log('🚀 Stage 3 Scenario 2: Operator Setup (SDK Pattern)');

    // CONFIG
    const RPC_URL = process.env.SEPOLIA_RPC_URL;
    let OPERATOR_KEY = (process.env.ADMIN_PRIVATE_KEY || process.env.PRIVATE_KEY_SUPPLIER) as Hex;
    if (!RPC_URL) throw new Error('Missing Config (SEPOLIA_RPC_URL)');

    const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC_URL) });
    const checkAcc = privateKeyToAccount(OPERATOR_KEY);
    const bal = await publicClient.getBalance({ address: checkAcc.address });
    if (bal === 0n && process.env.PRIVATE_KEY_SUPPLIER) {
        console.log(`⚠️  Operator Account ${checkAcc.address} has 0 ETH. Falling back to Supplier.`);
        OPERATOR_KEY = process.env.PRIVATE_KEY_SUPPLIER as Hex;
    }

    const account = privateKeyToAccount(OPERATOR_KEY);
    
    // Initialize Operator Client
    const client = createOperatorClient({
        chain: sepolia,
        transport: http(RPC_URL),
        account,
        addresses: {
            registry: process.env.REGISTRY_ADDR as Address,
            gToken: process.env.GTOKEN_ADDR as Address,
            gTokenStaking: process.env.STAKING_ADDR as Address,
            superPaymaster: process.env.SUPER_PAYMASTER as Address,
            aPNTs: process.env.XPNTS_ADDR as Address // Using xPNTs as aPNTs for this scenario
        }
    });

    console.log(`👤 Operator: ${account.address}`);

    const ROLE_PAYMASTER = RoleIds.PAYMASTER_SUPER;

    // 1. Onboard (Stake + Register + Deposit)
    console.log("   --- Operator Onboarding (Stake & Deposit) ---");
    const isRegistered = await client.hasRole({
        roleId: ROLE_PAYMASTER,
        user: account.address
    });

    if (isRegistered) {
        console.log("   ✅ Already registered as Operator.");
    } else {
        // Use SDK Orchestration Pattern
        const txs = await client.onboardOperator({
            stakeAmount: 0n, // Min stake handled by SDK
            depositAmount: parseEther("10"), // Initial points deposit
            roleId: ROLE_PAYMASTER
        });
        console.log(`   ✅ Onboarding complete. Txs: ${txs.length}`);
    }

    // 2. Configure Operator Settings
    console.log("   --- Configuration ---");
    const XPNTS = process.env.XPNTS_ADDR as Address;
    const rate = parseEther("1"); // 1 ETH = 1 point

    const txConf = await client.configureOperator({
        xPNTs: XPNTS,
        treasury: account.address,
        rate
    });
    console.log(`   ✅ Operator Configured: ${txConf}`);

    console.log('\n🏁 Scenario 2 Complete.');
}

main().catch(console.error);
