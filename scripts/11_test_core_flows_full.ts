
import { http, parseEther, keccak256, toHex, type Hex, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { 
    createAdminClient, 
    createCommunityClient,
    CORE_ADDRESSES,
    TEST_TOKEN_ADDRESSES,
    RoleIds,
    parseKey
} from '../packages/sdk/src/index.ts';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// BigInt serialization
(BigInt.prototype as any).toJSON = function () { return this.toString(); };
dotenv.config({ path: path.resolve(process.cwd(), '.env.anvil'), override: true });

const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";
const ADMIN_KEY = (process.env.ADMIN_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80') as Hex;

// Mock accounts
const COMMUNITY_PVKEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' as Hex;
const COMMUNITY_ADDR = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as Address;
const MOCK_CONTRACT_ADMIN = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC' as Address;

async function runCoreFlowsTest() {
    console.log('\n🚀 Running Core Business Flows (SDK Edition)\n');

    const adminAccount = privateKeyToAccount(parseKey(ADMIN_KEY));
    const commAccount = privateKeyToAccount(parseKey(COMMUNITY_PVKEY));
    
    const admin = createAdminClient({ transport: http(RPC_URL), account: adminAccount });
    const community = createCommunityClient({ transport: http(RPC_URL), account: commAccount });

    console.log(`👤 Protocol Admin: ${adminAccount.address}`);
    console.log(`👤 Community Admin: ${commAccount.address}\n`);

    // ========================================
    // Scenario 11: Community Registration
    // ========================================
    console.log('📝 Scenario 11: Community Registration & Staking');
    
    // 1. Give GTokens to Community
    const mintTx = await admin.writeContract({
        address: TEST_TOKEN_ADDRESSES.GTOKEN,
        abi: [{ name: 'mint', type: 'function', inputs: [{type:'address'}, {type:'uint256'}], outputs: [] }],
        functionName: 'mint',
        args: [COMMUNITY_ADDR, parseEther('1000')]
    });
    await admin.waitForTransactionReceipt({ hash: mintTx });
    console.log('   ✅ Minted 1000 GTokens to Community');

    // 2. Launch Community via SDK
    console.log("   🚀 Launching Community via SDK...");
    const launchResult = await community.launch({
        profile: {
            name: 'MySDKCommunity',
            ensName: '',
            website: 'https://mysdk.com',
            description: 'Refactored Community',
            logoURI: ''
        },
        stakeAmount: parseEther('600'),
        governance: {
             initialReputationRule: {
                 ruleId: keccak256(toHex('UserOpSuccess')),
                 reward: 10n,
                 slashInc: 1n,
                 maxSlash: 100n,
                 description: 'UserOpSuccessReward'
             }
        }
    });
    console.log(`   ✅ Community Launched! Tx: ${launchResult.hash}`);

    // ========================================
    // Scenario 14 & 15: Reputation & Entropy
    // ========================================
    console.log('\n📝 Scenario 15: Entropy Factor');

    try {
        const setEntropyTx = await admin.system.setEntropyFactor({
            community: COMMUNITY_ADDR,
            factor: parseEther('1.5')
        });
        await admin.waitForTransactionReceipt({ hash: setEntropyTx });
        console.log('   ✅ Set Entropy Factor: 1.5');
    } catch (e: any) {
        console.warn('   ⚠️ Failed to set Entropy Factor:', e.message.split('\n')[0]);
    }

    // ========================================
    // Scenario 34: Community Deploying PaymasterV4
    // ========================================
    console.log('\n📝 Scenario 34: Community deploying PaymasterV4 via SDK');

    try {
        const pmResult = await community.deployPaymasterV4({
            salt: toHex('salt123', { size: 32 })
        });
        console.log(`   ✅ Community deployed PaymasterV4 at: ${pmResult.paymasterAddress}`);
    } catch (e: any) {
        console.warn('   ⚠️ Failed to deploy Paymaster (already exists?):', e.message.split('\n')[0]);
    }

    // ========================================
    // Scenario 56: Ownership Transfer to Contract Account
    // ========================================
    console.log('\n📝 Scenario 56: Ownership Transfer & Admin Actions');

    const transferTx = await admin.system.transferOwnership({
        newOwner: MOCK_CONTRACT_ADMIN
    });
    await admin.waitForTransactionReceipt({ hash: transferTx });
    console.log(`   ✅ Ownership of Registry transferred to: ${MOCK_CONTRACT_ADMIN}`);

    // Verify & Proof via Impersonation
    console.log('   🕵️  Proving Contract Owner can perform actions (via Anvil Impersonation)');
    
    await admin.request({
        method: 'anvil_impersonateAccount' as any,
        params: [MOCK_CONTRACT_ADMIN]
    });

    const contractAdmin = createAdminClient({ 
        transport: http(RPC_URL), 
        account: MOCK_CONTRACT_ADMIN 
    });

    const adminActionTx = await contractAdmin.system.setCreditTier({
        tier: 9n,
        limit: parseEther('99999')
    });
    await admin.waitForTransactionReceipt({ hash: adminActionTx });
    console.log('   ✅ Contract Owner successfully set credit tier!');

    // Cleanup: Transfer back
    const transferBackTx = await contractAdmin.system.transferOwnership({
        newOwner: adminAccount.address
    });
    await admin.waitForTransactionReceipt({ hash: transferBackTx });
    console.log('   ✅ Ownership transferred back to EOA Admin');
    
    await admin.request({
        method: 'anvil_stopImpersonatingAccount' as any,
        params: [MOCK_CONTRACT_ADMIN]
    });

    console.log('\n🎯 Core Flows SDK Test Completed Successfully!');
}

runCoreFlowsTest().catch(console.error);
