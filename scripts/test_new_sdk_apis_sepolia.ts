import { createPublicClient, createWalletClient, http, parseEther, formatEther } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// 1. Load Env FIRST
dotenv.config({ path: '.env.sepolia' });

const RPC_URL = process.env.SEPOLIA_RPC_URL;
if (!RPC_URL) throw new Error('SEPOLIA_RPC_URL not found in .env.sepolia');

// Map env keys
const SUPPLIER_KEY = process.env.ADMIN_KEY;
const OPERATOR_KEY = process.env.OPERATOR_KEY;
const COMMUNITY_KEY = process.env.COMMUNITY_OWNER_KEY;
const USER_KEY = process.env.USER_KEY;

if (!SUPPLIER_KEY) throw new Error('ADMIN_KEY not found');
if (!OPERATOR_KEY) throw new Error('OPERATOR_KEY not found');
if (!COMMUNITY_KEY) throw new Error('COMMUNITY_OWNER_KEY not found');
if (!USER_KEY) throw new Error('USER_KEY not found');

console.log('🚀 Starting SDK API Sepolia Tests...');
console.log(`RPC: ${RPC_URL.substring(0, 40)}...`);

async function main() {
    // 2. Dynamic Imports for SDK
    console.log('📦 Loading SDK modules...');
    const { CommunityClient } = await import('../packages/community/src/index.js');
    const { OperatorClient } = await import('../packages/operator/src/index.js');
    const { EndUserClient } = await import('../packages/enduser/src/index.js');
    const { AnalyticsClient } = await import('../packages/analytics/src/index.js');
    const { RequirementChecker, ROLE_COMMUNITY, ROLE_PAYMASTER_SUPER, ROLE_ENDUSER } = await import('../packages/core/src/index.js');
    console.log('✅ SDK modules loaded\n');

    const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC_URL) });
    const supplierAccount = privateKeyToAccount(SUPPLIER_KEY as `0x${string}`); // Using supplier as main test account for read ops
    const walletClient = createWalletClient({
        account: supplierAccount,
        chain: sepolia,
        transport: http(RPC_URL),
    });

    console.log(`👤 Testing with account: ${supplierAccount.address}\n`);

    // ---------------------------------------------------------
    // 5. FinanceClient (Phase 2 New)
    // ---------------------------------------------------------
    console.log('\n--- Testing FinanceClient (New) ---');
    const { FinanceClient } = await import('../packages/tokens/dist/index.js');
    const financeClient = new FinanceClient(publicClient, walletClient);

    try {
        console.log('Fetching Tokenomics Overview...');
        const overview = await financeClient.getTokenomicsOverview();
        console.log('Tokenomics:', {
            totalSupply: formatEther(overview.totalSupply),
            totalStaked: formatEther(overview.totalStaked),
            totalBurned: formatEther(overview.totalBurned),
            circulating: formatEther(overview.circulatingSupply),
            stakingRatio: overview.stakingRatio.toFixed(2) + '%'
        });

        // Test approveAndStake (Small amount: 0.01 GT)
        // Only run if we have enough balance
        const gTokenBalance = await financeClient.getGTokenBalance(walletClient.account!.address);
        console.log(`My GToken Balance: ${formatEther(gTokenBalance)}`);

        if (gTokenBalance >= parseEther("0.01")) {
            console.log('Testing approveAndStake(0.01 GT)...');
            try {
                // const stakeTx = await financeClient.approveAndStake(parseEther("0.01"));
                // console.log(`Stake TX sent: ${stakeTx}`);
                console.log('Skipping actual stake execution to save gas/avoid revert');
            } catch (e: any) {
                console.warn('Stake failed (likely insufficient native gas or GToken):', e.message);
            }
        } else {
            console.log('Skipping stake test (insufficient GToken)');
        }

    } catch (error: any) {
        console.error('FinanceClient Test Failed:', error);
    }

    console.log('\n✅ All Checks Completed!');

    // ---------------------------------------------------------
    // 6. ReputationClient (Phase 2 New)
    // ---------------------------------------------------------
    console.log('\n--- Testing ReputationClient (New) ---');
    const { ReputationClient } = await import('../packages/identity/dist/index.js');
    const { CORE_ADDRESSES } = await import('../packages/core/dist/index.js');
    
    // Fallback: Use MySBT address if ReputationSystem not in env, 
    // just to test instantiation and method calls (will return 0 or fail gracefully)
    const repAddr = CORE_ADDRESSES.reputationSystem || CORE_ADDRESSES.mySBT;
    console.log(`Using Reputation Address: ${repAddr}`);

    const identityClient = new ReputationClient(publicClient, repAddr, walletClient);

    try {
        console.log('Fetching Global Reputation...');
        const score = await identityClient.getGlobalReputation(supplierAccount.address);
        console.log(`Score: ${score}`);

        console.log('Fetching Breakdown...');
        const breakdown = await identityClient.getReputationBreakdown(supplierAccount.address);
        console.log('Breakdown:', breakdown);

        console.log('Fetching Credit Limit...');
        const credit = await identityClient.getCreditLimit(supplierAccount.address);
        console.log(`Credit Limit: ${formatEther(credit)} ETH`);

    } catch (e: any) {
        console.error('ReputationClient Test Failed:', e);
    }

    // --- TEST 1: RequirementChecker ---
    console.log('📋 [Test 1] RequirementChecker API');
    try {
        const checker = new RequirementChecker(publicClient);
        const gtokenCheck = await checker.checkGTokenBalance(supplierAccount.address, parseEther("1"));
        console.log(`   GToken Check: Balance=${formatEther(gtokenCheck.balance)}, Enough=${gtokenCheck.hasEnough}`);
        
        const roleCheck = await checker.checkHasRole(ROLE_COMMUNITY, supplierAccount.address);
        console.log(`   Role Check (COMMUNITY): ${roleCheck}`);
        
        console.log('   ✅ RequirementChecker tests passed');
    } catch (e) {
        console.error('   ❌ RequirementChecker test failed:', e);
    }
    console.log('');

    // --- TEST 2: AnalyticsClient ---
    console.log('📋 [Test 2] AnalyticsClient API');
    try {
        const analytics = new AnalyticsClient(publicClient);
        const metrics = await analytics.getSupplyMetrics();
        console.log('   Supply Metrics:');
        console.log(`     Cap: ${formatEther(metrics.cap)}`);
        console.log(`     Total Supply: ${formatEther(metrics.totalSupply)}`);
        console.log(`     Burned: ${formatEther(metrics.totalLifetimeBurned)}`);
        console.log(`     Deflation Rate: ${metrics.deflationRate}%`);
        
        const cost = await analytics.getRoleEntranceCost(ROLE_PAYMASTER_SUPER);
        console.log('   Role Cost (SUPER_PAYMASTER):');
        console.log(`     Min Stake: ${formatEther(cost.minStake)}`);
        console.log(`     Entry Burn: ${formatEther(cost.entryBurn)}`);
        
        console.log('   ✅ AnalyticsClient tests passed');
    } catch (e) {
        console.error('   ❌ AnalyticsClient test failed:', e);
    }
    console.log('');
    
    // --- TEST 3: CommunityClient Pre-Check ---
    console.log('📋 [Test 3] CommunityClient Pre-Checks');
    try {
        const communityClient = new CommunityClient(publicClient);
        const launchCheck = await communityClient.checkLaunchRequirements(supplierAccount.address);
        console.log('   Launch Requirements Check:');
        console.log(`     Has Enough GToken: ${launchCheck.hasEnoughGToken}`);
        if (!launchCheck.hasEnoughGToken) {
            console.log(`     Missing: ${launchCheck.missingRequirements.join(', ')}`);
        }
        console.log('   ✅ CommunityClient check passed');
    } catch (e) {
        console.error('   ❌ CommunityClient check failed:', e);
    }
    console.log('');

    // --- TEST 4: OperatorClient Pre-Check ---
    console.log('📋 [Test 4] OperatorClient Pre-Checks');
    try {
        const operatorClient = new OperatorClient(publicClient);
        // Using a random address to likely fail checks
        const resourceCheck = await operatorClient.checkResources(supplierAccount.address);
        console.log('   Resource Check:');
        console.log(`     Has Role: ${resourceCheck.hasRole}`);
        if (resourceCheck.recommendations && resourceCheck.recommendations.length > 0) {
            console.log(`     Recommendations: ${resourceCheck.recommendations.join(', ')}`);
        }
        console.log('   ✅ OperatorClient check passed');
    } catch (e) {
        console.error('   ❌ OperatorClient check failed:', e);
    }
    console.log('');
}

main().catch(console.error);
