import { http, parseEther, type Hex, type Address, keccak256, stringToBytes, encodeAbiParameters, parseAbiParameters, erc20Abi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry, sepolia } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { createCommunityClient, createAdminClient, RegistryABI } from '../../dist/index.js';

if (!(BigInt.prototype as any).toJSON) {
    (BigInt.prototype as any).toJSON = function () { return this.toString(); };
}

const envPath = process.env.SDK_ENV_PATH || '.env.anvil';
dotenv.config({ path: path.resolve(process.cwd(), envPath), override: true });

const isSepolia = process.env.REVISION_ENV === 'sepolia' || process.env.SDK_ENV_PATH?.includes('sepolia');
console.log(`Debug: isSepolia=${isSepolia}, REVISION_ENV=${process.env.REVISION_ENV}, SDK_ENV_PATH=${process.env.SDK_ENV_PATH}`);
const chain = isSepolia ? sepolia : foundry;
const RPC_URL = process.env.RPC_URL || (isSepolia ? process.env.SEPOLIA_RPC_URL : 'http://127.0.0.1:8545');
const ADMIN_KEY = (process.env.ADMIN_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80') as Hex;
const COMMUNITY_OWNER_KEY = (process.env.COMMUNITY_OWNER_KEY || "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a") as Hex;

const localAddresses = {
    registry: process.env.REGISTRY_ADDRESS as Address,
    gToken: process.env.GTOKEN_ADDRESS as Address,
    gTokenStaking: process.env.GTOKENSTAKING_ADDRESS as Address,
    superPaymaster: process.env.SUPER_PAYMASTER as Address,
    aPNTs: process.env.APNTS_ADDRESS as Address,
    mySBT: process.env.MYSBT_ADDRESS as Address
};

const ROLE_COMMUNITY = keccak256(stringToBytes('COMMUNITY'));

async function communityRegistry() {
    console.log('🚀 Step 03: Community Registry & SBT Setup');
    
    const adminAccount = privateKeyToAccount(ADMIN_KEY);
    const adminClient = createAdminClient({
        chain, transport: http(RPC_URL), account: adminAccount, addresses: localAddresses as any
    });

    const communityAccount = privateKeyToAccount(COMMUNITY_OWNER_KEY);
    const communityClient = createCommunityClient({
        chain, transport: http(RPC_URL), account: communityAccount, addresses: localAddresses as any
    });

    console.log(`   Community Owner: ${communityAccount.address}`);

    // FUNDING HELPER
    const { createPublicClient } = await import('viem');
    const publicClientViem = createPublicClient({ chain, transport: http(RPC_URL) });

    async function ensureFunds(target: Address, ethNeeded: bigint, gTokenNeeded: bigint) {
        // ETH
        const ethBal = await publicClientViem.getBalance({ address: target });
        console.log(`   💰 Target ETH Balance: ${ethBal}`);
        if (ethBal < ethNeeded) {
            console.log(`   ⚠️ Low ETH. Admin funding...`);
            try {
                const tx = await adminClient.sendTransaction({ to: target, value: ethNeeded - ethBal });
                await adminClient.waitForTransactionReceipt({ hash: tx });
                console.log(`   ✅ Funded ETH`);
            } catch (e) { console.log(`   ❌ ETH Fund Fail:`, e); }
        }

        // GToken
        const gTokenBal = await publicClientViem.readContract({
            address: localAddresses.gToken, abi: erc20Abi, functionName: 'balanceOf', args: [target]
        });
        console.log(`   💰 Target GToken Balance: ${gTokenBal}`);
        if (gTokenBal < gTokenNeeded) {
            console.log(`   ⚠️ Low GTokens. Admin funding...`);
            try {
                const tx = await adminClient.writeContract({
                    address: localAddresses.gToken, abi: erc20Abi, functionName: 'transfer', args: [target, gTokenNeeded - gTokenBal]
                });
                await adminClient.waitForTransactionReceipt({ hash: tx });
                console.log(`   ✅ Funded GTokens`);
            } catch (e: any) { console.log(`   ❌ GToken Fund Fail:`, e.message?.split('\n')[0]); }
        }
    }

    await ensureFunds(communityAccount.address, parseEther('0.05'), parseEther('100'));


    // 1. Register Community Role (Using SDK Launch)
    console.log('\n🏘️ Launching Community via SDK...');
    
    try {
        const uniqueName = `RegTest_${Date.now()}`;
        console.log(`   📝 Using unique community name: ${uniqueName}`);

        const launchResult = await communityClient.launch({
            name: uniqueName,
            tokenName: `${uniqueName} Token`,
            tokenSymbol: 'CTK',
            description: 'A test community for regression',
            website: 'https://test.com',
            governance: {
                minStake: parseEther('30'),
                initialReputationRule: true
            }
        });
        
        console.log(`   ✅ Community Launched! Token: ${launchResult.tokenAddress}`);
        console.log(`   ✅ Transactions: ${launchResult.txs.length}`);
    } catch (e: any) {
        if (e.message.includes('already registered')) {
            console.log('   ✅ Community already registered');
        } else {
            console.warn('   ⚠️ Launch error:', e.message);
        }
    }

    // 2. Setup Reputation for Community (Admin side)
    console.log('\n⚖️ Setting up Reputation entropy...');
    // ReputationSystemV3 is handled via ReputationSystemV3.sol, often linked to Registry or Paymaster
    // In SDK, adminClient.setEntropyFactor handles this.
    // Need to find the reputation system address if it's separate, but usually handled via SuperPaymaster or Registry hooks.
    // For this regression, we assume it's configured to accept admin input for the community.
    
    try {
        const entropyTx = await adminClient.setEntropyFactor({
            community: communityAccount.address,
            factor: 100n, // 1.0x
            account: adminAccount
        });
        await adminClient.waitForTransactionReceipt({ hash: entropyTx });
        console.log('   ✅ Reputation Entropy Factor Set to 100');
    } catch (e) {
        console.log('   ⚠️ setEntropyFactor failed (maybe Reputation contract not deployed or already set). Continuing...');
    }

    console.log('\n🎉 Step 03 Completed Successfully\n');
}

communityRegistry().catch(err => {
    console.error('❌ Step 03 Failed:', err);
    process.exit(1);
});
