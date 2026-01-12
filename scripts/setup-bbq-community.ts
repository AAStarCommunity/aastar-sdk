import { createPublicClient, createWalletClient, http, parseEther, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { loadNetworkConfig } from '../tests/regression/config.js';
import { CommunityClient } from '../packages/enduser/dist/CommunityClient.js';
import { PaymasterOperatorClient } from '../packages/operator/dist/index.js';
import { tokenActions, registryActions } from '../packages/core/dist/index.js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env.sepolia' });

const STATE_FILE = path.resolve(process.cwd(), 'scripts/l4-state.json');

async function setupBBQCommunity() {
    const config = loadNetworkConfig('sepolia');
    const publicClient = createPublicClient({
        chain: config.chain,
        transport: http(config.rpcUrl)
    });

    // Brown's account
    const keyBrown = process.env.PRIVATE_KEY_BROWN as Hex;
    if (!keyBrown) {
        throw new Error('PRIVATE_KEY_BROWN not found in .env.sepolia');
    }
    
    const brown = privateKeyToAccount(keyBrown);
    const clientBrown = createWalletClient({
        chain: config.chain,
        transport: http(config.rpcUrl),
        account: brown
    });

    console.log('\n🍖 Setting up BBQ Community with Brown\n');
    console.log(`Brown Address: ${brown.address}\n`);

    // Step 0: Fund Brown with ETH and GToken
    console.log('💰 Step 0: Funding Brown...');
    const ethBalance = await publicClient.getBalance({ address: brown.address });
    console.log(`  ETH: ${Number(ethBalance) / 1e18} ETH`);
    
    if (ethBalance === BigInt(0)) {
        console.log('  📤 Sending ETH from supplier...');
        const supplier = privateKeyToAccount(process.env.PRIVATE_KEY_SUPPLIER as Hex);
        const clientSupplier = createWalletClient({
            chain: config.chain,
            transport: http(config.rpcUrl),
            account: supplier
        });
        
        const ethHash = await clientSupplier.sendTransaction({
            to: brown.address,
            value: parseEther('0.05')
        });
        await publicClient.waitForTransactionReceipt({ hash: ethHash });
        console.log('  ✅ Sent 0.05 ETH');
    }
    
    const gToken = tokenActions();
    let gTokenBalance = await gToken(publicClient).balanceOf({
        token: config.contracts.gToken,
        account: brown.address
    });
    
    console.log(`  GToken: ${Number(gTokenBalance) / 1e18} tokens`);
    
    if (gTokenBalance < parseEther('100')) {
        console.log('  📤 Minting GToken from supplier...');
        const supplier = privateKeyToAccount(process.env.PRIVATE_KEY_SUPPLIER as Hex);
        const clientSupplier = createWalletClient({
            chain: config.chain,
            transport: http(config.rpcUrl),
            account: supplier
        });
        
        const mintHash = await gToken(clientSupplier).mint({
            token: config.contracts.gToken,
            to: brown.address,
            amount: parseEther('150'), // 30 for community, 50 for super, 70 extra
            account: supplier
        });
        await publicClient.waitForTransactionReceipt({ hash: mintHash });
        console.log('  ✅ Minted 150 GToken');
    }

    // Step 1: Register Community using CommunityClient API
    console.log('\n🏘️  Step 1: Registering BBQ Community (using CommunityClient API)...');
    const communityClient = new CommunityClient({
        client: clientBrown,
        publicClient: publicClient,
        registryAddress: config.contracts.registry,
        gTokenAddress: config.contracts.gToken,
        gTokenStakingAddress: config.contracts.gTokenStaking
    });

    try {
        const communityHash = await communityClient.registerAsCommunity({
            name: 'BBQ',
            description: 'BBQ Community - Bringing people together over great food',
            website: 'https://bbq.community',
            logoURI: 'https://bbq.community/logo.png'
        });
        
        console.log(`  Transaction: ${communityHash}`);
        await publicClient.waitForTransactionReceipt({ hash: communityHash });
        console.log('  ✅ ROLE_COMMUNITY registered!');
    } catch (e: any) {
        console.log(`  ⚠️  ${e.message.split('\n')[0]}`);
    }

    // Step 2: Register SuperPaymaster Operator using PaymasterOperatorClient API
    console.log('\n🦸 Step 2: Registering as SuperPaymaster Operator (using PaymasterOperatorClient API)...');
    const paymasterClient = new PaymasterOperatorClient({
        client: clientBrown,
        publicClient: publicClient,
        registryAddress: config.contracts.registry,
        gTokenAddress: config.contracts.gToken,
        gTokenStakingAddress: config.contracts.gTokenStaking,
        superPaymasterAddress: config.contracts.superPaymaster
    });

    try {
        const superHash = await paymasterClient.registerAsSuperPaymasterOperator({
            stakeAmount: parseEther('50'),
            depositAmount: parseEther('20') // Initial deposit
        });
        
        console.log(`  Transaction: ${superHash}`);
        await publicClient.waitForTransactionReceipt({ hash: superHash });
        console.log('  ✅ ROLE_PAYMASTER_SUPER registered!');
    } catch (e: any) {
        console.log(`  ⚠️  ${e.message.split('\n')[0]}`);
    }

    // Step 3: Verify roles
    console.log('\n🔍 Step 3: Verifying roles...');
    const registry = registryActions(config.contracts.registry);
    const ROLE_COMMUNITY = await registry(publicClient).ROLE_COMMUNITY();
    const ROLE_PAYMASTER_SUPER = await registry(publicClient).ROLE_PAYMASTER_SUPER();
    
    const hasCommunity = await registry(publicClient).hasRole({
        user: brown.address,
        roleId: ROLE_COMMUNITY
    });
    
    const hasSuper = await registry(publicClient).hasRole({
        user: brown.address,
        roleId: ROLE_PAYMASTER_SUPER
    });
    
    console.log(`  ROLE_COMMUNITY: ${hasCommunity ? '✅' : '❌'}`);
    console.log(`  ROLE_PAYMASTER_SUPER: ${hasSuper ? '✅' : '❌'}`);

    // Save to state
    console.log('\n💾 Saving to state...');
    const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    if (!state.operators) state.operators = [];
    
    state.operators.push({
        name: 'Brown',
        address: brown.address,
        privateKeyEnv: 'PRIVATE_KEY_BROWN',
        community: 'BBQ',
        tokenSymbol: 'bbqPNTs',
        roles: ['ROLE_COMMUNITY', 'ROLE_PAYMASTER_SUPER'],
        registeredAt: new Date().toISOString()
    });
    
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));

    if (hasCommunity && hasSuper) {
        console.log('\n🎉 SUCCESS! BBQ Community Setup Complete!\n');
        console.log('Summary:');
        console.log(`  Owner: Brown (${brown.address})`);
        console.log(`  Community: BBQ`);
        console.log(`  Roles: ROLE_COMMUNITY ✅, ROLE_PAYMASTER_SUPER ✅`);
        console.log(`  SuperPaymaster: ${config.contracts.superPaymaster}`);
        console.log('\n✨ Both one-stop APIs worked perfectly!');
        console.log('   - CommunityClient.registerAsCommunity() ✅');
        console.log('   - PaymasterOperatorClient.registerAsSuperPaymasterOperator() ✅');
    } else {
        console.log('\n❌ Setup incomplete. Please check errors above.');
    }
}

setupBBQCommunity().catch(console.error);
