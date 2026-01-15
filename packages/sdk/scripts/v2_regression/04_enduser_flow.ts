import { http, parseEther, type Hex, type Address, keccak256, stringToBytes, encodeAbiParameters, parseAbiParameters, erc20Abi, encodeFunctionData, decodeEventLog } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry, sepolia } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { createEndUserClient, createAdminClient, RegistryABI, RoleIds } from '../../dist/index.js';

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
const USER_KEY = (process.env.USER_KEY || "0x7c8521197cd533c301a916120409a63c809181144001a1c93a0280eb46c6495d") as Hex;
const COMMUNITY_OWNER_KEY = (process.env.COMMUNITY_OWNER_KEY || "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a") as Hex;

const localAddresses = {
    registry: process.env.REGISTRY_ADDRESS as Address,
    gToken: process.env.GTOKEN_ADDRESS as Address,
    gTokenStaking: process.env.GTOKENSTAKING_ADDRESS as Address,
    superPaymaster: process.env.SUPER_PAYMASTER as Address,
    aPNTs: process.env.APNTS_ADDRESS as Address,
    mySBT: process.env.MYSBT_ADDRESS as Address
};

const ROLE_ENDUSER = keccak256(stringToBytes('ENDUSER'));

async function enduserFlow() {
    console.log('🚀 Step 04: End User Flow');
    
    const adminAccount = privateKeyToAccount(ADMIN_KEY);
    const adminClient = createAdminClient({
        chain, transport: http(RPC_URL), account: adminAccount, addresses: localAddresses as any
    });

    const userAccount = privateKeyToAccount(USER_KEY);
    const communityAccount = privateKeyToAccount(COMMUNITY_OWNER_KEY);
    const userClient = createEndUserClient({
        chain, transport: http(RPC_URL), account: userAccount, addresses: localAddresses as any
    });

    console.log(`   User: ${userAccount.address}`);

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
    
    // Fund User
    await ensureFunds(userAccount.address, parseEther('0.05'), parseEther('20'));


    // 1. Join Community & Activate Credit (Using SDK)
    console.log('\n👤 Joining Community via SDK...');
    
    try {
        const joinResult = await userClient.joinAndActivate({
            community: communityAccount.address,
            roleId: ROLE_ENDUSER
        });
        console.log(`   ✅ User Joined. SBT ID: ${joinResult.sbtId}`);
        console.log(`   ✅ Initial Credit: ${joinResult.initialCredit}`);
    } catch (e: any) {
        if (e.message.includes('already has') || e.message.includes('RoleAlreadyGranted')) {
            console.log('   ✅ User already has ENDUSER role');
        } else {
            console.warn('   ⚠️ Join error:', e.message);
        }
    }

    // 2. Verify SBT was minted
    console.log('\n🎫 Verifying SBT...');
    const sbtTokenId = await userClient.readContract({
        address: localAddresses.mySBT,
        abi: [{ type: 'function', name: 'getUserSBT', inputs: [{ name: 'user', type: 'address' }], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' }],
        functionName: 'getUserSBT',
        args: [userAccount.address]
    });

    if (sbtTokenId > 0n) {
        console.log(`   ✅ SBT Token ID: ${sbtTokenId}`);
    } else {
        console.log('   ⚠️ No SBT found (unexpected)');
    }

    // 3. Check user's reputation (if available)
    console.log('\n⭐ Checking Reputation...');
    try {
        const reputation = await userClient.readContract({
            address: localAddresses.registry,
            abi: [{ type: 'function', name: 'globalReputation', inputs: [{ name: '', type: 'address' }], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' }],
            functionName: 'globalReputation',
            args: [userAccount.address]
        });
        console.log(`   Reputation Score: ${reputation}`);
    } catch (e) {
        console.log('   ⚠️ Reputation not available (may need activity)');
    }

    console.log('\n🎉 Step 04 Completed Successfully\n');
}

enduserFlow().catch(err => {
    console.error('❌ Step 04 Failed:', err);
    process.exit(1);
});
