import { createPublicClient, createWalletClient, http, parseEther, keccak256, toHex, type Hex, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load ABIs
const RegistryABI = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../packages/core/src/abis/Registry.json'), 'utf-8'));
const SuperPaymasterABI = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../packages/core/src/abis/SuperPaymaster.json'), 'utf-8'));
const PaymasterFactoryABI = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../packages/core/src/abis/PaymasterFactory.json'), 'utf-8'));

// BigInt serialization
(BigInt.prototype as any).toJSON = function () { return this.toString(); };
dotenv.config({ path: path.resolve(process.cwd(), '.env.anvil') });

const RPC_URL = process.env.RPC_URL!;
const ADMIN_KEY = (process.env.ADMIN_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80') as Hex;
const REGISTRY_ADDR = process.env.REGISTRY_ADDR as Hex;
const SUPER_PAYMASTER = process.env.SUPER_PAYMASTER as Hex;
const PAYMASTER_FACTORY_ADDR = process.env.PAYMASTER_FACTORY_ADDR as Address;
const MOCK_CONTRACT_ADMIN = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC' as Address;

let bugs: string[] = [];
let totalTests = 0;
let passedTests = 0;

function test(name: string, fn: () => Promise<void>) {
    totalTests++;
    return fn()
        .then(() => {
            passedTests++;
            console.log(`   ✅ ${name}`);
        })
        .catch((error) => {
            console.log(`   ❌ ${name}: ${error.message}`);
            if (error.message.includes('Bug') || error.message.includes('SECURITY')) {
                bugs.push(`${name}: ${error.message}`);
            }
        });
}

async function runBugHuntingTests() {
    console.log('\n🐛 Bug Hunting Test Suite - Fast & Comprehensive\n');

    const publicClient = createPublicClient({ chain: foundry, transport: http(RPC_URL) });
    const admin = privateKeyToAccount(ADMIN_KEY);
    const attacker = privateKeyToAccount('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' as Hex);
    
    const walletClient = createWalletClient({ account: admin, chain: foundry, transport: http(RPC_URL) });
    const attackerClient = createWalletClient({ account: attacker, chain: foundry, transport: http(RPC_URL) });

    console.log(`👤 Admin: ${admin.address}`);
    console.log(`👤 Attacker: ${attacker.address}\n`);

    // ========================================
    // Bug Hunt 1: Permission Checks
    // ========================================
    console.log('🔍 Bug Hunt 1: Permission Checks');
    console.log('=================================');

    await test('Attacker cannot set credit tier', async () => {
        try {
            await attackerClient.writeContract({
                address: REGISTRY_ADDR,
                abi: RegistryABI,
                functionName: 'setCreditTier',
                args: [10n, parseEther('99999')],
                account: attacker
            });
            throw new Error('🐛 SECURITY BUG: Attacker can set credit tier!');
        } catch (error: any) {
            if (error.message.includes('Ownable') || error.message.includes('Unauthorized')) { /* OK */ } else throw error;
        }
    });

    await test('Attacker cannot set aPNTs token', async () => {
        try {
            await attackerClient.writeContract({
                address: SUPER_PAYMASTER,
                abi: SuperPaymasterABI,
                functionName: 'setAPNTsToken',
                args: [attacker.address],
                account: attacker
            });
            throw new Error('🐛 SECURITY BUG: Attacker can set aPNTs token!');
        } catch (error: any) {
            if (error.message.includes('Ownable') || error.message.includes('Unauthorized')) { /* OK */ } else throw error;
        }
    });

    // ========================================
    // Bug Hunt 2: State Consistency
    // ========================================
    console.log('\n🔍 Bug Hunt 2: State Consistency');
    console.log('==================================');

    await test('Owner is correctly set', async () => {
        const owner = await publicClient.readContract({ address: REGISTRY_ADDR, abi: RegistryABI, functionName: 'owner', args: [] });
        if (owner !== admin.address) throw new Error(`🐛 BUG: Owner mismatch!`);
    });

    // ========================================
    // Bug Hunt 3: Zero Address Validation
    // ========================================
    console.log('\n🔍 Bug Hunt 3: Zero Address Validation');
    console.log('========================================');

    await test('Cannot set zero address as aPNTs', async () => {
        try {
            await walletClient.writeContract({
                address: SUPER_PAYMASTER,
                abi: SuperPaymasterABI,
                functionName: 'setAPNTsToken',
                args: ['0x0000000000000000000000000000000000000000' as Address],
                account: admin
            });
            throw new Error('🐛 BUG: Zero address accepted!');
        } catch (error: any) {
            if (error.message.includes('InvalidAddress') || error.message.includes('zero')) { /* OK */ } else throw error;
        }
    });

    // ========================================
    // Bug Hunt 4: Ownership Transfer to Contract (AA Account)
    // ========================================
    console.log('\n🔍 Bug Hunt 4: Ownership Transfer to Contract (AA Account)');
    console.log('===========================================================');

    await test('Can transfer ownership to a contract and act as admin', async () => {
        // 1. Transfer to Mock Contract
        const tx1 = await walletClient.writeContract({
            address: REGISTRY_ADDR,
            abi: RegistryABI,
            functionName: 'transferOwnership',
            args: [MOCK_CONTRACT_ADMIN],
            account: admin
        });
        await publicClient.waitForTransactionReceipt({ hash: tx1 });
        process.stdout.write('   -> Transferred to contract... ');

        // 2. Impersonate and Act
        await publicClient.request({ method: 'anvil_impersonateAccount' as any, params: [MOCK_CONTRACT_ADMIN] });
        const contractClient = createWalletClient({ account: MOCK_CONTRACT_ADMIN, chain: foundry, transport: http(RPC_URL) });
        
        const tx2 = await contractClient.writeContract({
            address: REGISTRY_ADDR,
            abi: RegistryABI,
            functionName: 'setCreditTier',
            args: [5n, parseEther('5000')],
            account: MOCK_CONTRACT_ADMIN
        });
        await publicClient.waitForTransactionReceipt({ hash: tx2 });
        process.stdout.write('Acted as contract... ');

        // 3. Transfer back
        const tx3 = await contractClient.writeContract({
            address: REGISTRY_ADDR,
            abi: RegistryABI,
            functionName: 'transferOwnership',
            args: [admin.address],
            account: MOCK_CONTRACT_ADMIN
        });
        await publicClient.waitForTransactionReceipt({ hash: tx3 });
        await publicClient.request({ method: 'anvil_stopImpersonatingAccount' as any, params: [MOCK_CONTRACT_ADMIN] });
        process.stdout.write('Transferred back.\n');
    });

    // ========================================
    // Bug Hunt 5: Community-led Deployment (Scenario 34)
    // ========================================
    console.log('\n🔍 Bug Hunt 5: Community-led Deployment');
    console.log('========================================');

    await test('Community can deploy their own PaymasterV4 via Factory', async () => {
        try {
            const randomSalt = keccak256(toHex(`salt_${Math.random()}`, { size: 32 }));
            const tx = await attackerClient.writeContract({
                address: PAYMASTER_FACTORY_ADDR,
                abi: PaymasterFactoryABI,
                functionName: 'deployPaymasterDeterministic',
                args: ['v4.1i', randomSalt, '0x'],
                account: attacker
            });
            await publicClient.waitForTransactionReceipt({ hash: tx });
        } catch (error: any) {
            if (error.message.includes('OperatorAlreadyHasPaymaster')) {
                // console.log('   ⚠️  Operator already has a paymaster, skipping new deployment.');
            } else throw error;
        }
    });

    // ========================================
    // Summary
    // ========================================
    console.log('\n' + '='.repeat(50));
    console.log('📊 Bug Hunting Summary');
    console.log('='.repeat(50));
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${totalTests - passedTests}`);
    console.log(`Bugs Found: ${bugs.length}`);
    
    if (bugs.length > 0) {
        console.log('\n🐛 Bugs Discovered:');
        bugs.forEach((bug, i) => console.log(`${i + 1}. ${bug}`));
    } else {
        console.log('\n✅ System appears stable for high-priority scenarios');
    }
}

runBugHuntingTests().catch(console.error);
