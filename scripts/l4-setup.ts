
import * as fs from 'fs';
import * as path from 'path';
import { 
    http, 
    parseEther, 
    formatEther, 
    type Address, 
    type Hex,
    type Hash
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
    // 1. Parse Command Line Arguments
    const args = process.argv.slice(2);
    const networkArg = args.find(arg => arg.startsWith('--network='))?.split('=')[1] || 'anvil';
    const slowMode = args.includes('--slow');
    const resumeMode = args.includes('--resume');
    const skipAA = args.includes('--skip-aa');
    const skipJoin = args.includes('--skip-join');
    
    // Help message
    if (args.includes('--help') || args.includes('-h')) {
        console.log(`
🚀 L4 Setup Script - Usage

Usage: pnpm tsx scripts/l4-setup.ts [options]

Options:
  --network=<name>    Network to use (anvil, sepolia) [default: anvil]
  --slow              Slow mode: 5s delay between transactions (避免限流)
  --resume            Resume from saved state (跳过已完成的操作员)
  --skip-aa           Skip AA account deployment
  --skip-join         Skip cross-community joining
  --help, -h          Show this help message

Examples:
  pnpm tsx scripts/l4-setup.ts --network=sepolia --slow
  pnpm tsx scripts/l4-setup.ts --network=sepolia --resume
  ./l4-setup.sh sepolia --slow --resume
        `);
        return;
    }

    console.log(`\n🚀 Starting L4 Assessment & Setup (Network: ${networkArg})...`);
    if (slowMode) console.log(`  🐌 Slow mode enabled: 5s delay per transaction`);
    if (resumeMode) console.log(`  ♻️  Resume mode: will skip completed operators`);
    
    // Load .env
    const envPath = path.resolve(process.cwd(), `.env.${networkArg}`);
    console.log(`  📂 Loading ENV from: ${envPath}`);
    dotenv.config({ path: envPath, override: true });
    
    // 显式设置 NETWORK 环境变量，确保 SDK 加载正确的配置文件
    process.env.NETWORK = networkArg;
    console.log(`  🌐 Network set to: ${networkArg}`);

    // 多 RPC 端点支持（避免单点限流）
    // 兼容带下划线和不带下划线的环境变量名
    const rpcUrls = networkArg === 'sepolia' 
        ? [
            process.env.SEPOLIA_RPC_URL || process.env.RPC_URL,
            process.env.SEPOLIA_RPC_URL_2 || process.env.SEPOLIA_RPC_URL2,
            process.env.SEPOLIA_RPC_URL_3 || process.env.SEPOLIA_RPC_URL3
          ].filter(Boolean) as string[]
        : ["http://127.0.0.1:8545"];
    
    if (rpcUrls.length === 0) throw new Error(`Missing RPC URL for ${networkArg}`);
    console.log(`  🔗 Available RPC endpoints: ${rpcUrls.length}`);
    
    let currentRpcIndex = 0;
    const getRpcUrl = () => rpcUrls[currentRpcIndex % rpcUrls.length];
    const rotateRpc = () => {
        currentRpcIndex = (currentRpcIndex + 1) % rpcUrls.length;
        console.log(`  🔄 Switched to RPC endpoint ${currentRpcIndex + 1}/${rpcUrls.length}`);
    };

    // 交易延迟辅助函数（避免限流）
    const delayMs = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    const TX_DELAY = slowMode ? 5000 : 1500; // 慢速模式 5 秒，正常 1.5 秒
    console.log(`  ⏱️  Transaction delay: ${TX_DELAY / 1000}s`);

    // Accounts
    const ANVIL_ADMIN = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    const supplierKey = process.env.PRIVATE_KEY_SUPPLIER || process.env.ADMIN_KEY || (networkArg === 'anvil' ? ANVIL_ADMIN : undefined);
    if (!supplierKey) throw new Error('PRIVATE_KEY_SUPPLIER required');
    const supplierAccount = privateKeyToAccount(parseKey(supplierKey));

    const admin = createAdminClient({ transport: http(getRpcUrl()), account: supplierAccount });

    // Load existing state for resume mode
    let existingState: any = {};
    if (resumeMode && fs.existsSync(STATE_FILE)) {
        existingState = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
        console.log(`  📖 Loaded existing state: ${Object.keys(existingState.operators || {}).length} operators found`);
    }

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
        
        // Resume mode: Skip if already completed
        if (resumeMode && existingState.operators?.[op.name]) {
            console.log(`\n--- Operator: ${op.name} (${acc.address}) ---`);
            console.log(`   ⏭️  Skipping (already completed in previous run)`);
            communityData[op.name] = existingState.operators[op.name];
            operatorStatus.push({
                Name: op.name,
                Address: acc.address,
                ETH: 'Resumed',
                Token: existingState.operators[op.name].token,
                PM: existingState.operators[op.name].pmV4 || 'None'
            });
            continue;
        }
        
        const opClient = createOperatorClient({ transport: http(getRpcUrl()), account: acc });
        const commClient = createCommunityClient({ transport: http(getRpcUrl()), account: acc });

        console.log(`\n--- Operator: ${op.name} (${acc.address}) ---`);

        // 2a. Ensure Funds (≥0.1 ETH, 100k GToken)
        const ethBal = await admin.getBalance({ address: acc.address });
        if (ethBal < parseEther('0.1')) {
            console.log(`   ⛽ Funding ETH...`);
            const hash = await admin.sendTransaction({ to: acc.address, value: parseEther('0.2') });
            await admin.waitForTransactionReceipt({ hash });
            await delayMs(TX_DELAY);
        }

        const gtBal = await admin.balanceOf({ token: TEST_TOKEN_ADDRESSES.gToken, account: acc.address });

        const reqGToken = op.name.includes('Anni') ? parseEther('200000') : parseEther('100000');
        if (gtBal < reqGToken) {
            console.log(`   🪙 Minting GToken...`);
            const hash = await admin.mint({
                token: TEST_TOKEN_ADDRESSES.gToken,
                to: acc.address,
                amount: reqGToken,
                account: supplierAccount
            });
            await admin.waitForTransactionReceipt({ hash });
            await delayMs(TX_DELAY);
        }

        // 2b. Launch Community & Token (只在需要时执行)
        console.log(`   🚀 Verifying Community & Token...`);
        let tokenAddr: Address;
        
        if (op.name.includes('Jason')) {
            tokenAddr = TEST_TOKEN_ADDRESSES.apnts; // Global aPNTs
        } else {
            // 直接从 Registry 查询 community token（更可靠）
            try {
                const existingToken = await admin.getAccountCommunity({ account: acc.address });
                
                if (existingToken && existingToken !== '0x0000000000000000000000000000000000000000') {
                    console.log(`   ✅ Found existing community token: ${existingToken}`);
                    tokenAddr = existingToken;
                } else {
                    // 只有没有 token 时才 launch
                    console.log(`   🆕 Launching new community...`);
                    const launchResult = await commClient.launch({
                        name: op.name.split(' ')[0],
                        symbol: op.name.split(' ')[0].toUpperCase().slice(0, 4) + 'P',
                        governance: { initialReputationRule: false } // 跳过 reputation rule 设置（避免 ABI 错误）
                    });
                    tokenAddr = launchResult.tokenAddress;
                }
            } catch (e: any) {
                console.warn(`   ⚠️  Failed to check Registry, attempting launch...`);
                const launchResult = await commClient.launch({
                    name: op.name.split(' ')[0],
                    symbol: op.name.split(' ')[0].toUpperCase().slice(0, 4) + 'P',
                    governance: { initialReputationRule: false }
                });
                tokenAddr = launchResult.tokenAddress;
            }
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
    let aaAccounts: any[] = [];
    
    if (skipAA) {
        console.log(`\n🏭 3. Skipping AA account setup (--skip-aa)...`);
        // Load from existing state if available
        if (resumeMode && existingState.aaAccounts) {
            aaAccounts = existingState.aaAccounts;
            console.log(`   📖 Loaded ${aaAccounts.length} AA accounts from previous run`);
        }
    } else {
        console.log(`\n🏭 3. Setting up AA accounts...`);
    
    for (const op of operators) {
        const owner = privateKeyToAccount(parseKey(op.key!));
        const user = createEndUserClient({ transport: http(getRpcUrl()), account: owner });

        for (let i = 0; i < 2; i++) {
            const salt = BigInt(i);
            const label = `${op.name}_AA${i+1}`;
            
            const { accountAddress, isDeployed } = await user.deploySmartAccount({
                owner: owner.address,
                salt,
                fundWithETH: parseEther('0.05')
            });

            // Fund with some GTokens
            const hash = await admin.mint({
                token: TEST_TOKEN_ADDRESSES.gToken,
                to: accountAddress,
                amount: parseEther('1000'),
                account: supplierAccount
            });
            await admin.waitForTransactionReceipt({ hash });
            await delayMs(TX_DELAY);

            aaAccounts.push({ label, address: accountAddress, owner: owner.address, salt, opName: op.name });
            console.log(`   ✅ ${label} ready: ${accountAddress}`);
        }

        console.log(`   🏁 Finished setup for operator: ${op.name}. Waiting 10s...`);
        rotateRpc(); // Force RPC rotation for next operator
        await delayMs(10000);
    }
    }

    // 4. Cross-Join Cross-Operator
    if (skipJoin) {
        console.log(`\n🤝 4. Skipping cross-community joining (--skip-join)...`);
    } else {
        console.log(`\n🤝 4. Cross-Joining AAs to Communities...`);
        for (const aa of aaAccounts) {
        const owner = privateKeyToAccount(parseKey(operators.find(o => o.name === aa.opName)!.key!));
        const user = createEndUserClient({ transport: http(getRpcUrl()), account: owner });
        
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
