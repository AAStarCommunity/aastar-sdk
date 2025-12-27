import { createPublicClient, http, parseEther, type Hex, type Address, erc20Abi, keccak256, stringToBytes } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { createAdminClient } from '../../packages/sdk/src/index.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.v3'), override: true });

const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545';
const ADMIN_KEY = (process.env.ADMIN_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80') as Hex;

// Test Data
const OPERATOR_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as Hex;
const COMMUNITY_OWNER_KEY = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a" as Hex;
const USER_KEY = "0x7c8521197cd533c301a916120409a63c809181144001a1c93a0280eb46c6495d" as Hex;

const localAddresses = {
    registry: (process.env.REGISTRY_ADDRESS || '').trim() as Address,
    gToken: (process.env.GTOKEN_ADDRESS || '').trim() as Address,
    gTokenStaking: (process.env.GTOKENSTAKING_ADDRESS || '').trim() as Address,
    superPaymaster: (process.env.SUPER_PAYMASTER || '').trim() as Address,
    aPNTs: (process.env.APNTS_ADDRESS || '').trim() as Address,
    mySBT: (process.env.MYSBT_ADDRESS || '').trim() as Address
};

console.log('   Loaded Addresses:', JSON.stringify(localAddresses, null, 2));


const erc20AbiWithMint = [
    ...erc20Abi,
    {
        type: 'function',
        name: 'mint',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'to', type: 'address' },
            { name: 'amount', type: 'uint256' }
        ],
        outputs: []
    }
] as const;

async function setup() {
    console.log('🚀 Step 01: Setup and Fund Accounts');
    
    const adminAccount = privateKeyToAccount(ADMIN_KEY);
    const adminClient = createAdminClient({
        chain: foundry,
        transport: http(RPC_URL),
        account: adminAccount,
        addresses: localAddresses as any
    });

    const operator = privateKeyToAccount(OPERATOR_KEY).address;
    const community = privateKeyToAccount(COMMUNITY_OWNER_KEY).address;
    const user = privateKeyToAccount(USER_KEY).address;

    console.log(`   Admin: ${adminAccount.address}`);
    console.log(`   Operator: ${operator}`);
    console.log(`   Community: ${community}`);
    console.log(`   User: ${user}`);

    // 1. Ensure ETH balance
    console.log('\n💰 Funding ETH...');
    const targets = [adminAccount.address, operator, community, user];
    for (const target of targets) {
        await adminClient.request({ 
            method: 'anvil_setBalance' as any, 
            params: [target, '0x56BC75E2D63100000'] // 100 ETH
        });
    }
    console.log('   ✅ ETH Funded for all accounts');

    // 2. Mint GTokens and aPNTs
    console.log('\n💎 Minting Tokens...');
    
    // Operator need funds for:
    // - Staking (30-50 GToken)
    // - Entry Burn (3-5 GToken)
    // - Paymaster Deposit (50 aPNTs)
    
    // Community need funds for:
    // - Staking (30 GToken)
    // - Entry Burn (3 GToken)
    
    const mints = [
        { token: localAddresses.gToken, to: operator, amount: parseEther('300') },
        { token: localAddresses.aPNTs, to: operator, amount: parseEther('200') },
        { token: localAddresses.gToken, to: community, amount: parseEther('300') },
        { token: localAddresses.gToken, to: user, amount: parseEther('100') }
    ];

    for (const m of mints) {
        if (!m.token) {
            console.warn('   ⚠️ Skipping mint: token address missing');
            continue;
        }
        console.log(`   Attempting mint: ${m.amount.toString()} to ${m.to} on token ${m.token} (len: ${m.token.length})`);
        const tx = await adminClient.writeContract({
            address: m.token,
            abi: erc20AbiWithMint,
            functionName: 'mint',
            args: [m.to, m.amount],
            account: adminAccount,
            chain: foundry
        });
        await adminClient.waitForTransactionReceipt({ hash: tx });
        console.log(`   ✅ Minted ${m.amount.toString()} to ${m.to} (${m.token})`);
    }


    console.log('\n🎉 Step 01 Completed Successfully\n');
}

setup().catch(err => {
    console.error('❌ Step 01 Failed:', err);
    process.exit(1);
});
