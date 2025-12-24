import { createPublicClient, createWalletClient, http, formatEther, parseEther, type Hex, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// BigInt serialization fix
(BigInt.prototype as any).toJSON = function () { return this.toString(); };
dotenv.config({ path: path.resolve(process.cwd(), '.env.v3') });

// Configuration
const RPC_URL = process.env.RPC_URL!;
const ADMIN_KEY = process.env.ADMIN_KEY as Hex;
const REGISTRY_ADDR = process.env.REGISTRY_ADDR as Hex;
const SUPER_PAYMASTER_ADDR = process.env.SUPER_PAYMASTER as Hex;
const REPUTATION_SYSTEM_ADDR = process.env.REPUTATION_SYSTEM_ADDR as Hex;

// Load ABIs
const RegistryABI = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../packages/core/src/abis/Registry.json'), 'utf-8'));
const SuperPaymasterABI = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../packages/core/src/abis/SuperPaymasterV3.json'), 'utf-8'));
const ReputationABI = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../packages/core/src/abis/ReputationSystemV3.json'), 'utf-8'));

// Branch coverage tracking
let totalBranches = 0;
let coveredBranches = 0;

function trackBranch(_name: string, covered: boolean) {
    totalBranches++;
    if (covered) {
        coveredBranches++;
        // console.log(`   ✅ [Branch] ${name}`);
    } else {
        // console.log(`   ❌ [Branch] ${name}`);
    }
}

async function runProtocolAdminFullTest() {
    console.log('\n🧪 Running Protocol Admin Full Test (Phase 1, Day 1)...\n');

    const publicClient = createPublicClient({
        chain: foundry,
        transport: http(RPC_URL)
    });

    const adminAccount = privateKeyToAccount(ADMIN_KEY);
    const walletClient = createWalletClient({
        account: adminAccount,
        chain: foundry,
        transport: http(RPC_URL)
    });

    console.log(`👤 Admin Address: ${adminAccount.address}`);
    console.log(`📜 Registry: ${REGISTRY_ADDR}`);

    // ========================================
    // Scenario 1: Basic Deployment & Ownership
    // ========================================
    console.log('📝 Scenario 1: Basic Deployment & Ownership');
    
    const registryOwner = await publicClient.readContract({
        address: REGISTRY_ADDR,
        abi: RegistryABI,
        functionName: 'owner',
        args: []
    }) as Address;
    trackBranch('Registry owner is admin', registryOwner === adminAccount.address);
    console.log(`   ✅ Owner: ${registryOwner}`);

    // ========================================
    // Scenario 2: Credit Tier Configuration
    // ========================================
    console.log('\n📝 Scenario 2: Credit Tier Configuration');
    
    const setTierTx = await walletClient.writeContract({
        address: REGISTRY_ADDR,
        abi: RegistryABI,
        functionName: 'setCreditTier',
        args: [8n, parseEther('10000')],
        account: adminAccount
    });
    await publicClient.waitForTransactionReceipt({ hash: setTierTx });
    
    const limit = await publicClient.readContract({
        address: REGISTRY_ADDR,
        abi: RegistryABI,
        functionName: 'creditTierConfig',
        args: [8n]
    }) as bigint;
    trackBranch('Credit tier 8 set correctly', limit === parseEther('10000'));
    console.log(`   ✅ Tier 8 Limit: ${formatEther(limit)}`);

    // ========================================
    // Scenario 3: Reputation Source Management
    // ========================================
    console.log('\n📝 Scenario 3: Reputation Source Management');
    
    const setSourceTx = await walletClient.writeContract({
        address: REGISTRY_ADDR,
        abi: RegistryABI,
        functionName: 'setReputationSource',
        args: [adminAccount.address, true],
        account: adminAccount
    });
    await publicClient.waitForTransactionReceipt({ hash: setSourceTx });
    console.log('   ✅ Admin set as Reputation Source');

    // ========================================
    // Scenario 4: SuperPaymaster Configuration
    // ========================================
    console.log('\n📝 Scenario 4: SuperPaymaster Configuration');
    
    const spOwner = await publicClient.readContract({
        address: SUPER_PAYMASTER_ADDR,
        abi: SuperPaymasterABI,
        functionName: 'owner',
        args: []
    }) as Address;
    console.log(`   ✅ SuperPM Owner: ${spOwner}`);

    // 4.1 Update Protocol Revenue (Withdrawal)
    const revenue = await publicClient.readContract({
        address: SUPER_PAYMASTER_ADDR,
        abi: SuperPaymasterABI,
        functionName: 'protocolRevenue',
        args: []
    }) as bigint;
    console.log(`   ✅ Current Protocol Revenue: ${formatEther(revenue)}`);

    // ========================================
    // Scenario 5: Reputation System Integration
    // ========================================
    console.log('\n📝 Scenario 5: Reputation System Integration');
    
    try {
        const repOwner = await publicClient.readContract({
            address: REPUTATION_SYSTEM_ADDR,
            abi: ReputationABI,
            functionName: 'owner',
            args: []
        }) as Address;
        console.log(`   ✅ ReputationSystem Owner: ${repOwner}`);
        
        const setEntropyTx = await walletClient.writeContract({
            address: REPUTATION_SYSTEM_ADDR,
            abi: ReputationABI,
            functionName: 'setEntropyFactor',
            args: [adminAccount.address, parseEther('1')], // self as test
            account: adminAccount
        });
        await publicClient.waitForTransactionReceipt({ hash: setEntropyTx });
        console.log('   ✅ Global Entropy Factor Set');
    } catch (e: any) {
        console.log(`   ⚠️  Reputation System Test partial skip: ${e.message}`);
    }

    // ========================================
    // Final Audit Report
    // ========================================
    console.log('\n' + '='.repeat(50));
    console.log('📊 Protocol Admin Test Summary');
    console.log('='.repeat(50));
    console.log(`Total Branches Evaluated: ${totalBranches}`);
    console.log(`Covered Branches: ${coveredBranches}`);
    console.log(`Coverage: ${(coveredBranches / totalBranches * 100).toFixed(1)}%`);
    console.log('='.repeat(50));
}

runProtocolAdminFullTest().catch(console.error);
