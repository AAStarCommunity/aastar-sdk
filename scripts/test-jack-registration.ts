import { createPublicClient, createWalletClient, http, parseEther, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { loadNetworkConfig } from '../tests/regression/config.js';
import { tokenActions } from '../packages/core/dist/index.js';
import { CommunityClient } from '../packages/enduser/dist/CommunityClient.js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.sepolia' });

async function testJackCommunityRegistration() {
    const config = loadNetworkConfig('sepolia');
    const publicClient = createPublicClient({
        chain: config.chain,
        transport: http(config.rpcUrl)
    });

    // Jack's new account
    const keyJack = process.env.PRIVATE_KEY_JACK as Hex;
    if (!keyJack) {
        throw new Error('PRIVATE_KEY_JACK not found in .env.sepolia');
    }
    
    const jack = privateKeyToAccount(keyJack);
    const clientJack = createWalletClient({
        chain: config.chain,
        transport: http(config.rpcUrl),
        account: jack
    });

    console.log('\n🧪 Testing Community Registration API with Jack\n');
    console.log(`Jack Address: ${jack.address}`);

    // Step 1: Check ETH balance
    const ethBalance = await publicClient.getBalance({ address: jack.address });
    console.log(`Jack ETH Balance: ${ethBalance / BigInt(1e18)} ETH`);
    
    if (ethBalance === BigInt(0)) {
        console.log('⚠️  Jack needs ETH for gas. Please send some Sepolia ETH to:', jack.address);
        return;
    }

    // Step 2: Check GToken balance
    const gToken = tokenActions();
    let gTokenBalance = await gToken(publicClient).balanceOf({
        token: config.contracts.gToken,
        account: jack.address
    });
    console.log(`Jack GToken Balance: ${gTokenBalance / BigInt(1e18)} tokens`);

    // Step 3: Mint GToken if needed
    if (gTokenBalance < parseEther('50')) {
        console.log('\n💰 Minting 100 GToken to Jack...');
        const supplierKey = process.env.PRIVATE_KEY_SUPPLIER as Hex;
        const supplier = privateKeyToAccount(supplierKey);
        const clientSupplier = createWalletClient({
            chain: config.chain,
            transport: http(config.rpcUrl),
            account: supplier
        });
        
        const mintHash = await gToken(clientSupplier).mint({
            token: config.contracts.gToken,
            to: jack.address,
            amount: parseEther('100'),
            account: supplier
        });
        await publicClient.waitForTransactionReceipt({ hash: mintHash });
        
        gTokenBalance = await gToken(publicClient).balanceOf({
            token: config.contracts.gToken,
            account: jack.address
        });
        console.log(`✅ Minted! New balance: ${gTokenBalance / BigInt(1e18)} tokens`);
    }

    // Step 4: Register "Dancing Community" using CommunityClient API
    console.log('\n🎭 Registering Dancing Community...');
    
    const communityClient = new CommunityClient({
        client: clientJack,
        publicClient: publicClient,
        registryAddress: config.contracts.registry,
        gTokenAddress: config.contracts.gToken,
        gTokenStakingAddress: config.contracts.gTokenStaking
    });

    try {
        const hash = await communityClient.registerAsCommunity({
            name: 'Dancing',
            description: 'Dancing Community - A vibrant community for dance enthusiasts',
            website: 'https://dancing.community',
            stakeAmount: parseEther('30')
        });
        
        console.log(`📝 Transaction submitted: ${hash}`);
        console.log('⏳ Waiting for confirmation...');
        
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        console.log(`✅ Community registered! Block: ${receipt.blockNumber}`);
        
        // Step 5: Verify registration
        console.log('\n🔍 Verifying registration...');
        const { registryActions } = await import('../packages/core/dist/index.js');
        const registry = registryActions(config.contracts.registry);
        const ROLE_COMMUNITY = await registry(publicClient).ROLE_COMMUNITY();
        const hasRole = await registry(publicClient).hasRole({
            user: jack.address,
            roleId: ROLE_COMMUNITY
        });
        
        console.log(`Jack has ROLE_COMMUNITY: ${hasRole}`);
        
        if (hasRole) {
            console.log('\n🎉 SUCCESS! Community registration API works perfectly!');
            console.log('\nSummary:');
            console.log(`  - Account: Jack (${jack.address})`);
            console.log(`  - Community: Dancing Community`);
            console.log(`  - Stake: 30 GToken`);
            console.log(`  - Role: ROLE_COMMUNITY ✅`);
        } else {
            console.log('\n❌ FAILED: Role not granted');
        }
        
    } catch (e: any) {
        console.log(`\n❌ Registration failed:`);
        console.log(`Error: ${e.message}`);
        if (e.message.includes('RoleAlreadyGranted')) {
            console.log('\n✅ Jack already has ROLE_COMMUNITY!');
        }
    }
}

testJackCommunityRegistration().catch(console.error);
