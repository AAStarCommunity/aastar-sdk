import { createPublicClient, createWalletClient, http, parseEther, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { loadNetworkConfig } from '../tests/regression/config.js';
import { PaymasterOperatorClient } from '../packages/operator/src/index.js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.sepolia' });

async function testJackSuperPaymasterAPI() {
    const config = loadNetworkConfig('sepolia');
    const publicClient = createPublicClient({
        chain: config.chain,
        transport: http(config.rpcUrl)
    });

    const keyJack = process.env.PRIVATE_KEY_JACK as Hex;
    const jack = privateKeyToAccount(keyJack);
    const clientJack = createWalletClient({
        chain: config.chain,
        transport: http(config.rpcUrl),
        account: jack
    });

    console.log('\n🧪 Testing PaymasterOperatorClient.registerAsSuperPaymasterOperator()\n');
    console.log(`Jack: ${jack.address}\n`);

    // Create PaymasterOperatorClient
    const paymasterClient = new PaymasterOperatorClient({
        client: clientJack,
        publicClient: publicClient,
        registryAddress: config.contracts.registry,
        gTokenAddress: config.contracts.gToken,
        gTokenStakingAddress: config.contracts.gTokenStaking,
        superPaymasterAddress: config.contracts.superPaymaster
    });

    console.log('📝 Testing one-stop API: registerAsSuperPaymasterOperator()...\n');
    
    try {
        // Test with deposit
        const hash = await paymasterClient.registerAsSuperPaymasterOperator({
            stakeAmount: parseEther('50'), // Default, but explicit for clarity
            depositAmount: parseEther('10') // Deposit 10 GToken to SuperPaymaster
        });
        
        console.log(`✅ API call successful!`);
        console.log(`Transaction: ${hash}`);
        
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        console.log(`Block: ${receipt.blockNumber}`);
        
    } catch (e: any) {
        const errorMsg = e.message;
        
        if (errorMsg.includes('Already registered as SuperPaymaster operator')) {
            console.log('✅ Idempotency check passed: Already has ROLE_PAYMASTER_SUPER');
            console.log('\n📝 Testing deposit-only functionality...');
            
            try {
                // Since Jack already has the role, test just the deposit
                const depositHash = await paymasterClient.depositCollateral(
                    parseEther('10'),
                    { account: jack }
                );
                
                console.log(`Deposit transaction: ${depositHash}`);
                await publicClient.waitForTransactionReceipt({ hash: depositHash });
                console.log(`✅ Deposit successful!`);
                
            } catch (depositError: any) {
                console.log(`❌ Deposit error: ${depositError.message.split('\n')[0]}`);
            }
        } else {
            console.log(`❌ Error: ${errorMsg.split('\n')[0]}`);
        }
    }

    // Verify final state
    console.log('\n🔍 Verifying final state...');
    const { registryActions } = await import('../packages/core/src/index.js');
    const registry = registryActions(config.contracts.registry);
    
    const ROLE_COMMUNITY = await registry(publicClient).ROLE_COMMUNITY();
    const ROLE_PAYMASTER_SUPER = await registry(publicClient).ROLE_PAYMASTER_SUPER();
    
    const hasCommunity = await registry(publicClient).hasRole({
        user: jack.address,
        roleId: ROLE_COMMUNITY
    });
    
    const hasSuper = await registry(publicClient).hasRole({
        user: jack.address,
        roleId: ROLE_PAYMASTER_SUPER
    });
    
    console.log(`\nJack's Roles:`);
    console.log(`  ROLE_COMMUNITY: ${hasCommunity ? '✅' : '❌'}`);
    console.log(`  ROLE_PAYMASTER_SUPER: ${hasSuper ? '✅' : '❌'}`);
    
    if (hasCommunity && hasSuper) {
        console.log('\n🎉 SUCCESS! Jack is fully registered as SuperPaymaster operator!');
        console.log('\nDancing Community Setup Complete:');
        console.log(`  Owner: Jack (${jack.address})`);
        console.log(`  Community: Dancing`);
        console.log(`  Token (dPNTs): 0x1a52d5bcEC54468AbAE4904745880576737b7343`);
        console.log(`  Roles: ROLE_COMMUNITY ✅, ROLE_PAYMASTER_SUPER ✅`);
        console.log(`  SuperPaymaster: ${config.contracts.superPaymaster}`);
        console.log('\n✨ Ready to sponsor gasless transactions!');
    }
}

testJackSuperPaymasterAPI().catch(console.error);
