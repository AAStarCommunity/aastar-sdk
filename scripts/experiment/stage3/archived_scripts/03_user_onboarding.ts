
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { http, type Hex, type Address, createPublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { createEndUserClient, RoleIds, RoleDataFactory } from '../../../packages/sdk/src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env.sepolia') });

async function main() {
    console.log('🚀 Stage 3 Scenario 3: User Onboarding (SDK Pattern)');

    // CONFIG
    const RPC_URL = process.env.SEPOLIA_RPC_URL;
    let USER_KEY = (process.env.AA_OWNER_PRIVATE_KEY || process.env.PRIVATE_KEY_SUPPLIER) as Hex;
    if (!RPC_URL) throw new Error('Missing Config (SEPOLIA_RPC_URL)');

    const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC_URL) });
    const checkAcc = privateKeyToAccount(USER_KEY);
    const bal = await publicClient.getBalance({ address: checkAcc.address });
    if (bal === 0n && process.env.PRIVATE_KEY_SUPPLIER) {
        console.log(`⚠️  User Account ${checkAcc.address} has 0 ETH. Falling back to Supplier.`);
        USER_KEY = process.env.PRIVATE_KEY_SUPPLIER as Hex;
    }

    const account = privateKeyToAccount(USER_KEY);
    const SUPPLIER_ADDR = process.env.PRIVATE_KEY_SUPPLIER ? privateKeyToAccount(process.env.PRIVATE_KEY_SUPPLIER as Hex).address : account.address;
    
    // Initialize EndUser Client
    const client = createEndUserClient({
        chain: sepolia,
        transport: http(RPC_URL),
        account,
        addresses: {
            registry: process.env.REGISTRY_ADDR as Address,
            gToken: process.env.GTOKEN_ADDR as Address,
            gTokenStaking: process.env.STAKING_ADDR as Address,
            mySBT: process.env.MYSBT_ADDR as Address,
            superPaymaster: process.env.SUPER_PAYMASTER as Address,
            xPNTsFactory: process.env.XPNTS_FACTORY_ADDR as Address
        }
    });

    console.log(`👤 End User: ${account.address}`);

    const ROLE_ENDUSER = RoleIds.ENDUSER;

    // 1. Check if already registered
    const isRegistered = await client.hasRole({
        roleId: ROLE_ENDUSER,
        user: account.address
    });

    if (isRegistered) {
        console.log("   ✅ Already registered as EndUser.");
    } else {
        console.log("   --- User Onboarding & Activation ---");
        
        // Prepare Role Data using Factory
        const roleData = RoleDataFactory.endUser({
            account: account.address,
            community: SUPPLIER_ADDR // Using Supplier as the community anchor for this experiment
        });

        // Use SDK Orchestration Pattern
        const { sbtId, initialCredit } = await client.joinAndActivate({
            community: SUPPLIER_ADDR,
            roleId: ROLE_ENDUSER,
            roleData
        });

        console.log(`   ✅ Onboarding complete. SBT ID: ${sbtId}`);
        console.log(`   ✅ Gas Credit Activated: ${initialCredit} points.`);
    }

    console.log('\n🏁 Scenario 3 Complete.');
}

main().catch(console.error);
