import { 
    createPublicClient, 
    http, 
    type Address,
    type Hex
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { 
    registryActions,
    gTokenActions
} from '@aastar/sdk';

// Load .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') }); 

async function main() {
    console.log("🚀 Starting Scenario 3: Information Query");

    const RPC_URL = process.env.RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY';
    const CONTRACTS = {
        registry: process.env.REGISTRY_ADDRESS as `0x${string}`,
        gToken: process.env.GTOKEN_ADDRESS as `0x${string}`
    };

    const publicClient = createPublicClient({ transport: http(RPC_URL) });

    // Target Address to Query
    let targetAddress: Address;
    if (process.argv[2]) {
        targetAddress = process.argv[2] as Address;
    } else if (process.env.PRIVATE_KEY_OPERATOR) {
        targetAddress = privateKeyToAccount(process.env.PRIVATE_KEY_OPERATOR as Hex).address;
    } else {
        console.warn("⚠️  No Operator Key in .env, using Zero Address for query demo.");
        targetAddress = '0x0000000000000000000000000000000000000000';
    }
    
    console.log(`\n🔍 Querying Address: ${targetAddress}`);

    // 1. Check Roles
    const registry = registryActions(CONTRACTS.registry)(publicClient);
    
    const ROLE_COMMUNITY = await registry.ROLE_COMMUNITY();
    const ROLE_OPERATOR = await registry.ROLE_OPERATOR(); 
    const ROLE_SUPER = await registry.ROLE_PAYMASTER_SUPER(); 

    const isCommunity = await registry.hasRole({ roleId: ROLE_COMMUNITY, user: targetAddress });
    const isOperator = await registry.hasRole({ roleId: ROLE_OPERATOR, user: targetAddress });
    const isSuper = await registry.hasRole({ roleId: ROLE_SUPER, user: targetAddress });

    console.log(`   User Roles:`);
    console.log(`   - Community Leader: ${isCommunity}`);
    console.log(`   - Operator:         ${isOperator}`);
    console.log(`   - Super Paymaster:  ${isSuper}`);

    // 2. Check Balances
    const gToken = gTokenActions()(publicClient);
    const balance = await gToken.balanceOf({ token: CONTRACTS.gToken, account: targetAddress });
    console.log(`   💰 GToken Balance: ${balance.toString()} (wei)`);

    console.log("\n🎉 Query Complete!");
}

main().catch(console.error);
