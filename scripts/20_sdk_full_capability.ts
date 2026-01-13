
import { http, type Hex, parseEther, Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { 
    createAdminClient, 
    createOperatorClient,
    createCommunityClient,
    createEndUserClient,
    CORE_ADDRESSES,
    TEST_TOKEN_ADDRESSES,
    parseKey
} from '../packages/sdk/src/index.ts';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env
const NETWORK = process.env.EXPERIMENT_NETWORK || 'anvil';
const envFile = NETWORK === 'sepolia' ? '.env.sepolia' : '.env.anvil';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

const ADMIN_KEY = (process.env.ADMIN_KEY || process.env.PRIVATE_KEY_JASON) as Hex;
const RPC_URL = process.env.RPC_URL || (NETWORK === 'sepolia' ? process.env.SEPOLIA_RPC_URL : "http://127.0.0.1:8545");

async function runFullCapabilityTest() {
    console.log(`🚀 Running Full Capability SDK Test (Network: ${NETWORK})`);

    if (!ADMIN_KEY) throw new Error("Missing ADMIN_KEY");
    const account = privateKeyToAccount(parseKey(ADMIN_KEY));

    // 1. Admin Capabilities
    console.log("\n--- 🔧 Admin Client ---");
    const admin = createAdminClient({ transport: http(RPC_URL), account });
    const registryOwner = await admin.readContract({
        address: CORE_ADDRESSES.registry,
        abi: [{ name: 'owner', type: 'function', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' }],
        functionName: 'owner'
    });
    console.log(`   Registry Owner: ${registryOwner}`);

    // 2. Operator Capabilities
    console.log("\n--- 🏭 Operator Client ---");
    const operator = createOperatorClient({ transport: http(RPC_URL), account });
    const status = await operator.getOperatorStatus(account.address);
    console.log(`   Is Simple Operator: ${status.isOperator}`);
    console.log(`   Is Super Operator: ${status.isSuperPaymaster}`);
    if (status.paymasterV4) {
        console.log(`   Paymaster V4: ${status.paymasterV4.address}`);
    }

    // 3. Community Capabilities
    console.log("\n--- 🤝 Community Client ---");
    const community = createCommunityClient({ transport: http(RPC_URL), account }); // Note: reuse account for simplicity in this demo
    // Checking a community status (can be self or another)
    const isComm = await admin.readContract({
         address: CORE_ADDRESSES.registry,
         abi: [{ name: 'hasRole', type: 'function', inputs: [{type:'bytes32'}, {type:'address'}], outputs: [{type:'bool'}], stateMutability: 'view' }],
         functionName: 'hasRole',
         args: ['0x0000000000000000000000000000000000000000000000000000000000000001' as Hex, account.address] // ROLE_COMMUNITY
    });
    console.log(`   Is Community: ${isComm}`);

    // 4. End User Capabilities
    console.log("\n--- 👤 End User Client ---");
    const user = createEndUserClient({ transport: http(RPC_URL), account });
    const { accountAddress } = await user.createSmartAccount({
        owner: account.address,
        salt: 1337n
    });
    console.log(`   SA Address (Salt 1337): ${accountAddress}`);

    // 5. Gasless Execution Demo (Dry Run style)
    console.log("\n--- ⚡ Gasless Execution (Simulation) ---");
    try {
        console.log(`   Simulating gasless transfer...`);
        // This will attempt to build and estimate. If PMs aren't setup it might fail, which is okay for full capability test to show error reporting.
        const result = await user.executeGasless({
            target: account.address,
            data: '0x',
            value: 0n
        });
        console.log(`   ✅ Execution Hash: ${result.hash}`);
    } catch (e: any) {
        console.log(`   ℹ️ Gasless demo skipped/failed (expected if PM not ready): ${e.message.split('\n')[0]}`);
    }

    console.log("\n✅ Full Capability Test Complete.");
}

main().catch(console.error);
