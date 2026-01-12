import { createPublicClient, http, parseEther, formatEther } from 'viem';
import { sepolia } from 'viem/chains';
import * as dotenv from 'dotenv';

// 1. Load Env FIRST
dotenv.config({ path: '.env.sepolia' });

const RPC_URL = process.env.SEPOLIA_RPC_URL!;
if (!RPC_URL) throw new Error('SEPOLIA_RPC_URL not found in .env.sepolia');

console.log('🧪 Simple Sepolia Test');
console.log(`RPC: ${RPC_URL.substring(0, 50)}...\n`);

async function run() {
    // 2. Dynamic Import SDK AFTER env is loaded
    const { RequirementChecker } = await import('../packages/core/src/index.js');

    const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC_URL) });

    console.log('📋 Test: RequirementChecker');
    const checker = new RequirementChecker(publicClient);
    
    // Check balance of a known address (e.g. one of the deployers or community owners)
    const targetAddr = '0x411BD567E46C0781248dbB6a9211891C032885e5' as const; 
    
    try {
        const result = await checker.checkGTokenBalance(
            targetAddr,
            parseEther("1.0")
        );
        console.log(`  Target: ${targetAddr}`);
        console.log(`  Balance: ${formatEther(result.balance)} GT`);
        console.log(`  Enough: ${result.hasEnough}`);
        console.log('\n✅ RequirementChecker Test Passed');
    } catch (error) {
        console.error('❌ Check Failed:', error);
        process.exit(1);
    }
}

run().catch(e => {
    console.error(e);
    process.exit(1);
});
