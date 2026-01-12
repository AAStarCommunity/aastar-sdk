
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { http, type Hex, parseEther, keccak256, stringToBytes, type Address, encodeAbiParameters, createPublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import { createCommunityClient } from '../../../packages/sdk/src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env.sepolia') });

async function main() {
    console.log('🚀 Stage 3 Scenario 1: DAO Launch (SDK Pattern)');

    // CONFIG
    const RPC_URL = process.env.SEPOLIA_RPC_URL;
    let ADMIN_KEY = (process.env.ADMIN_PRIVATE_KEY || process.env.PRIVATE_KEY_SUPPLIER) as Hex;
    
    // Check balance of Admin A, if 0 and siphoned, fallback to Supplier temporarily for experiment
    const checkAcc = privateKeyToAccount(ADMIN_KEY);
    const publicClient = createPublicClient({ chain: foundry, transport: http(RPC_URL) });
    const bal = await publicClient.getBalance({ address: checkAcc.address });
    if (bal === 0n && process.env.PRIVATE_KEY_SUPPLIER) {
        console.log(`⚠️  Admin Account ${checkAcc.address} has 0 ETH. Falling back to Supplier for experiment.`);
        ADMIN_KEY = process.env.PRIVATE_KEY_SUPPLIER as Hex;
    }

    const account = privateKeyToAccount(ADMIN_KEY);
    
    // Initialize Community Client
    const client = createCommunityClient({
        chain: foundry,
        transport: http(RPC_URL),
        account,
        addresses: {
            registry: process.env.REGISTRY_ADDR as Address,
            gToken: process.env.GTOKEN_ADDR as Address,
            gTokenStaking: process.env.STAKING_ADDR as Address,
            xPNTsFactory: process.env.XPNTS_FACTORY_ADDR as Address,
            mySBT: process.env.MYSBT_ADDR as Address
        }
    });

    console.log(`👤 DAO Admin: ${account.address}`);
    const balance = await client.getBalance({ address: account.address });
    console.log(`💰 Balance: ${Number(balance) / 1e18} ETH`);

    const ROLE_COMMUNITY = keccak256(stringToBytes('COMMUNITY'));
    
    // Check if already registered
    const isRegistered = await client.hasRole({
        roleId: ROLE_COMMUNITY,
        user: account.address
    });

    if (isRegistered) {
        console.log("   ✅ Already registered.");
    } else {
        console.log("   --- Community Registration & Token Launch ---");
        
        const uniqueName = `S3DAO_${Date.now()}`;
        const roleData = encodeAbiParameters(
            [{
                type: 'tuple',
                components: [
                    { name: 'name', type: 'string' },
                    { name: 'ensName', type: 'string' },
                    { name: 'website', type: 'string' },
                    { name: 'description', type: 'string' },
                    { name: 'logoURI', type: 'string' },
                    { name: 'stakeAmount', type: 'uint256' }
                ]
            }],
            [[uniqueName, '', '', '', '', 0n]] as any
        );

        // Use SDK Orchestration Pattern
        const { tokenAddress } = await client.onboardCommunity({
            roleId: ROLE_COMMUNITY,
            roleData,
            stakeAmount: 0n, // Min stake handled by SDK internally if registry requires it
            tokenName: "Stage3 Token",
            tokenSymbol: "S3PNT",
            hub: uniqueName,
            domain: "dao.eth"
        });

        console.log(`   ✅ Community onboarded. Token Address: ${tokenAddress}`);
    }

    console.log('\n🏁 Scenario 1 Complete.');
}

main().catch(console.error);
