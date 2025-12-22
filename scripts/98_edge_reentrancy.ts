import { createPublicClient, createWalletClient, http, parseEther, keccak256, toBytes, parseAbi, encodeAbiParameters, type Hex, type Address } from 'viem';
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

    // 2.5 Register as Community to satisfy SuperPaymaster check
    console.log('📝 Registering Attacker as Community...');
    const REGISTRY_ADDR = process.env.REGISTRY_ADDR as Hex;
    const ROLE_COMMUNITY = keccak256(toBytes('COMMUNITY'));
    const roleData = encodeAbiParameters(
        [{ type: 'tuple', components: [
            { type: 'string', name: 'name' },
            { type: 'string', name: 'ensName' },
            { type: 'string', name: 'website' },
            { type: 'string', name: 'description' },
            { type: 'string', name: 'logoURI' },
            { type: 'uint256', name: 'stakeAmount' }
        ]}],
        [{ name: 'AttackerCommunity', ensName: '', website: '', description: '', logoURI: '', stakeAmount: parseEther('30') }]
    );
    
    // Fund Admin with GToken for registration
    const GTOKEN_ADDR = process.env.GTOKEN_ADDR as Hex;
    const GTokenABI = [{"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"mint","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"}];
    await walletClient.writeContract({ address: GTOKEN_ADDR, abi: GTokenABI, functionName: 'mint', args: [admin.address, parseEther('100')] });
    await walletClient.writeContract({ address: GTOKEN_ADDR, abi: GTokenABI, functionName: 'approve', args: [process.env.STAKING_ADDR as Hex, parseEther('100')] });

    // Check if already registered
    const isRegistered = await publicClient.readContract({
        address: REGISTRY_ADDR,
        abi: parseAbi(['function hasRole(bytes32, address) view returns (bool)']),
        functionName: 'hasRole',
        args: [ROLE_COMMUNITY, admin.address]
    });

    if (isRegistered) {
        console.log('   ⚠️ Attacker already registered. Skipping registration tx.');
    } else {
        try {
            await walletClient.writeContract({
                address: REGISTRY_ADDR,
                abi: parseAbi(['function registerRoleSelf(bytes32, bytes) external']),
                functionName: 'registerRoleSelf',
                args: [ROLE_COMMUNITY, roleData]
            });
            console.log('   ✅ Attacker Registered.');
    } else {
        try {
            const { request } = await publicClient.simulateContract({
                account: admin,
                address: REGISTRY_ADDR,
                abi: parseAbi(['function registerRoleSelf(bytes32, bytes) external']),
                functionName: 'registerRoleSelf',
                args: [ROLE_COMMUNITY, roleData]
            });
            await walletClient.writeContract(request);
            console.log('   ✅ Attacker Registered.');
        } catch (e: any) {
             if (e.message.includes('RoleAlreadyGranted') || (e.cause && (e.cause as any).data && (e.cause as any).data.errorName === 'RoleAlreadyGranted')) {
                 console.log('   ⚠️ Attacker already registered (caught simulation error).');
             } else {
                 console.log(`   ❌ Attacker Registration simulation/write failed: ${e.message}`);
                 throw e;
             }
        }
    }

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

    try {
        await walletClient.writeContract({
            address: SUPER_PAYMASTER,
            abi: SuperPaymasterABI,
            functionName: 'notifyDeposit',
            args: [parseEther('10')],
            account: admin
        });
    } catch (e: any) {
        console.log(`   ⚠️ notifyDeposit failed: ${e.message}`);
        // Proceed if this is just accounting or SAFE ERC20 noise from Malicious Token
    }

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
