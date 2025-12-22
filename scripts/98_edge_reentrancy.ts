import { createPublicClient, createWalletClient, http, parseEther, type Hex, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load ABIs
const SuperPaymasterABI = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../abis/SuperPaymasterV3.abi.json'), 'utf-8'));
const MaliciousABI = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../abis/MaliciousAPNTs.abi.json'), 'utf-8'));

dotenv.config({ path: path.resolve(process.cwd(), '.env.v3') });

const RPC_URL = process.env.RPC_URL!;
const ADMIN_KEY = process.env.ADMIN_KEY as Hex;
const SUPER_PAYMASTER = process.env.SUPER_PAYMASTER as Hex;

async function runReentrancyTest() {
    console.log('\n🔍 Edge Case: Complex Reentrancy Attack Path Simulation\n');

    const publicClient = createPublicClient({ chain: foundry, transport: http(RPC_URL) });
    const admin = privateKeyToAccount(ADMIN_KEY);
    const walletClient = createWalletClient({ account: admin, chain: foundry, transport: http(RPC_URL) });

    // 1. Deploy Malicious aPNTs
    console.log('📦 Deploying Malicious aPNTs...');
    
    // We need the bytecode to deploy
    const bytecode = MaliciousABI.bytecode.object as Hex;

    const deployTx = await walletClient.deployContract({
        abi: MaliciousABI.abi,
        bytecode: bytecode,
        account: admin,
        args: []
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: deployTx });
    const maliciousTokenAddr = receipt.contractAddress!;
    console.log(`   ✅ Malicious Token Deployed at: ${maliciousTokenAddr}`);

    // 2. Setup Malicious Token
    await walletClient.writeContract({
        address: maliciousTokenAddr,
        abi: MaliciousABI.abi,
        functionName: 'setSuperPaymaster',
        args: [SUPER_PAYMASTER],
        account: admin
    });
    
    await walletClient.writeContract({
        address: maliciousTokenAddr,
        abi: MaliciousABI.abi,
        functionName: 'setAttacker',
        args: [admin.address], // Admin acts as attacker for simplicity
        account: admin
    });
    console.log('   ✅ Malicious Token Configured');

    // 3. Switch SuperPaymaster to use Malicious Token (Simulating a hack/mistake)
    console.log('⚙️  Switching SuperPaymaster to Malicious Token...');
    const setTokenTx = await walletClient.writeContract({
        address: SUPER_PAYMASTER,
        abi: SuperPaymasterABI,
        functionName: 'setAPNTsToken',
        args: [maliciousTokenAddr],
        account: admin
    });
    await publicClient.waitForTransactionReceipt({ hash: setTokenTx });

    // 4. Configure Operator (Admin) to have some balance in Malicious Token
    console.log('💰 Setting Up Operator Balance...');
    
    // Transfer tokens to SuperPaymaster first to pass notifyDeposit check
    await walletClient.writeContract({
        address: maliciousTokenAddr,
        abi: MaliciousABI.abi,
        functionName: 'transfer',
        args: [SUPER_PAYMASTER, parseEther('10')],
        account: admin
    });

    await walletClient.writeContract({
        address: SUPER_PAYMASTER,
        abi: SuperPaymasterABI,
        functionName: 'notifyDeposit',
        args: [parseEther('10')],
        account: admin
    });

    // 5. Trigger Reentrancy Attack
    console.log('🔥 Triggering Reentrancy Attack Path (withdraw -> malicious transfer -> withdraw)...');
    try {
        const attackTx = await walletClient.writeContract({
            address: SUPER_PAYMASTER,
            abi: SuperPaymasterABI,
            functionName: 'withdraw',
            args: [parseEther('1')],
            account: admin
        });
        await publicClient.waitForTransactionReceipt({ hash: attackTx });
        console.log('   ❌ ERROR: Withdraw succeeded without blocking reentrancy? (Check internal logs)');
    } catch (error: any) {
        if (error.message.includes('ReentrancyGuardReentrantCall') || error.message.includes('reentrant call')) {
            console.log('   ✅ SUCCESS: Reentrancy properly blocked by ReentrancyGuard!');
        } else {
            console.log(`   ❓ Unexpected Error: ${error.message}`);
        }
    }

    // 6. Restore Original Token (Cleanup)
    console.log('🧹 Cleaning Up...');
    const originalToken = process.env.XPNTS_ADDR as Address;
    await walletClient.writeContract({
        address: SUPER_PAYMASTER,
        abi: SuperPaymasterABI,
        functionName: 'setAPNTsToken',
        args: [originalToken],
        account: admin
    });
    console.log('   ✅ Original aPNTs Token Restored');
}

runReentrancyTest().catch(console.error);
