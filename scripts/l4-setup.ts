
import * as fs from 'fs';
import * as path from 'path';
import { 
    http, 
    parseEther, 
    formatEther, 
    type Address, 
    type Hex,
    parseAbi,
    type Hash,
    stringToBytes
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';
import { 
    createAdminClient, 
    createEndUserClient, 
    createOperatorClient,
    createCommunityClient,
    RoleIds,
    CORE_ADDRESSES,
    TEST_TOKEN_ADDRESSES,
    parseKey
} from '../packages/sdk/src/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATE_FILE = path.resolve(__dirname, 'l4-state.json');

// --- Helper: Console Table ---
function printTable(title: string, data: any[]) {
    console.log(`\n📋 ${title}`);
    console.table(data);
}

async function main() {
    // 1. Identify Network
    const networkArg = process.argv.find(arg => arg.startsWith('--network='))?.split('=')[1] || 'anvil';
    console.log(`\n🚀 Starting L4 Assessment & Setup (Network: ${networkArg})...`);
    
    // Load .env
    const envPath = path.resolve(process.cwd(), `.env.${networkArg}`);
    console.log(`  📂 Loading ENV from: ${envPath}`);
    dotenv.config({ path: envPath, override: true });

    const rpcUrl = networkArg === 'sepolia' 
        ? (process.env.SEPOLIA_RPC_URL || process.env.RPC_URL) 
        : "http://127.0.0.1:8545";
    if (!rpcUrl) throw new Error(`Missing RPC URL for ${networkArg}`);

    // Accounts
    const ANVIL_ADMIN = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    const supplierKey = process.env.PRIVATE_KEY_SUPPLIER || process.env.ADMIN_KEY || (networkArg === 'anvil' ? ANVIL_ADMIN : undefined);
    if (!supplierKey) throw new Error('PRIVATE_KEY_SUPPLIER required');
    const supplierAccount = privateKeyToAccount(parseKey(supplierKey));

    const admin = createAdminClient({ transport: http(rpcUrl), account: supplierAccount });

    // 2. Define Operators & Scenarios
    const operators = [
        { name: 'Jason (AAStar)', key: process.env.PRIVATE_KEY_JASON, pmType: 'V4' },
        { name: 'Bob (Bread)', key: process.env.PRIVATE_KEY_BOB, pmType: 'V4' },
        { name: 'Anni (Demo)', key: process.env.PRIVATE_KEY_ANNI, pmType: 'Super' },
        { name: 'Charlie (Test)', key: process.env.PRIVATE_KEY_CHARLIE, pmType: 'V4' },
    ].filter(op => op.key && op.key.startsWith('0x'));

    console.log(`\n🔍 Checking & Repairing Operators (${operators.length})...`);
    const operatorStatus: any[] = [];
    const communityData: Record<string, { token: Address, pmV4?: Address, client: any }> = {};

    for (const op of operators) {
        const acc = privateKeyToAccount(parseKey(op.key!));
        const opClient = createOperatorClient({ transport: http(rpcUrl), account: acc });
        const commClient = createCommunityClient({ transport: http(rpcUrl), account: acc });

        console.log(`\n--- Operator: ${op.name} (${acc.address}) ---`);

        // 2a. Ensure Funds (≥0.1 ETH, 100k GToken)
        const ethBal = await admin.getBalance({ address: acc.address });
        if (ethBal < parseEther('0.1')) {
            console.log(`   ⛽ Funding ETH...`);
            await admin.sendTransaction({ to: acc.address, value: parseEther('0.2') });
        }

        const gtBal = await admin.readContract({
            address: TEST_TOKEN_ADDRESSES.gToken,
            abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
            functionName: 'balanceOf',
            args: [acc.address]
        }) as bigint;

        const reqGToken = op.name.includes('Anni') ? parseEther('200000') : parseEther('100000');
        if (gtBal < reqGToken) {
            console.log(`   🪙 Minting GToken...`);
            await admin.writeContract({
                address: TEST_TOKEN_ADDRESSES.gToken,
                abi: parseAbi(['function mint(address, uint256)']),
                functionName: 'mint',
                args: [acc.address, reqGToken],
                account: supplierAccount
            });
        }

        // 2b. Launch Community & Token
        console.log(`   🚀 Verifying Community & Token...`);
        let tokenAddr: Address;
        
        if (op.name.includes('Jason')) {
            tokenAddr = TEST_TOKEN_ADDRESSES.apnts; // Global aPNTs
        } else {
            const launchResult = await commClient.launch({
                name: op.name.split(' ')[0],
                symbol: op.name.split(' ')[0].toUpperCase().slice(0, 4) + 'P',
                governance: { initialReputationRule: true }
            });
            tokenAddr = launchResult.tokenAddress;
        }
        
        // 2c. Setup Paymaster
        let pmAddr: Address | undefined;
        if (op.pmType === 'V4') {
            const status = await opClient.getOperatorStatus(acc.address);
            if (!status.paymasterV4) {
                console.log(`   🏭 Deploying Paymaster V4...`);
                await opClient.deployPaymasterV4();
            }
            const updated = await opClient.getOperatorStatus(acc.address);
            pmAddr = updated.paymasterV4?.address;
        } else {
            // SuperPaymaster Logic (Anni)
            console.log(`   🛡️  Registering as SuperPaymaster Operator...`);
            await opClient.onboardFully({
                stakeAmount: parseEther('50'),
                depositAmount: parseEther('10000'),
                roleId: RoleIds.PAYMASTER_SUPER
            });
            pmAddr = CORE_ADDRESSES.superPaymaster;
        }

        communityData[op.name] = { token: tokenAddr, pmV4: pmAddr, client: commClient };

        operatorStatus.push({
            Name: op.name,
            Address: acc.address,
            ETH: formatEther(await admin.getBalance({ address: acc.address })),
            Token: tokenAddr,
            PM: pmAddr || 'None'
        });
    }
    printTable("Operator Setup", operatorStatus);

    // 3. AA Accounts Setup (2 per operator)
    console.log(`\n🏭 3. Setting up AA accounts...`);
    const aaAccounts: any[] = [];
    
    for (const op of operators) {
        const owner = privateKeyToAccount(parseKey(op.key!));
        const user = createEndUserClient({ transport: http(rpcUrl), account: owner });

        for (let i = 0; i < 2; i++) {
            const salt = BigInt(i);
            const label = `${op.name}_AA${i+1}`;
            
            const { accountAddress, isDeployed } = await user.deploySmartAccount({
                owner: owner.address,
                salt,
                fundWithETH: parseEther('0.05')
            });

            // Fund with some GTokens
            await admin.writeContract({
                address: TEST_TOKEN_ADDRESSES.gToken,
                abi: parseAbi(['function mint(address, uint256)']),
                functionName: 'mint',
                args: [accountAddress, parseEther('1000')],
                account: supplierAccount
            });

            aaAccounts.push({ label, address: accountAddress, owner: owner.address, salt, opName: op.name });
            console.log(`   ✅ ${label} ready: ${accountAddress}`);
        }
    }

    // 4. Cross-Join Cross-Operator
    console.log(`\n🤝 4. Cross-Joining AAs to Communities...`);
    for (const aa of aaAccounts) {
        const owner = privateKeyToAccount(parseKey(operators.find(o => o.name === aa.opName)!.key!));
        const user = createEndUserClient({ transport: http(rpcUrl), account: owner });
        
        // Find community to join (e.g., join the "next" operator's community for cross-testing)
        const opIdx = operators.findIndex(o => o.name === aa.opName);
        const targetOp = operators[(opIdx + 1) % operators.length];
        const targetComm = communityData[targetOp.name].token;

        console.log(`   🔗 ${aa.label} joining ${targetOp.name}'s community...`);
        try {
            await user.onboard({
                community: targetComm,
                roleId: RoleIds.ENDUSER,
                roleData: '0x' as Hex // Minimal data
            });
            console.log(`      ✅ Joined`);
        } catch (e: any) {
            console.warn(`      ⚠️  Join failed: ${e.message.split('\n')[0]}`);
        }
    }

    // 5. Final State Save
    console.log(`\n💾 Saving State to ${STATE_FILE}...`);
    const state = {
        network: networkArg,
        timestamp: new Date().toISOString(),
        operators: communityData,
        aaAccounts
    };
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');

    console.log(`\n✅ L4 Setup Complete.`);
}

main().catch(console.error);
