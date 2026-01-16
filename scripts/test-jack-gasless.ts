import { createPublicClient, createWalletClient, http, parseEther, type Hex, encodeFunctionData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { loadNetworkConfig } from '../tests/regression/config.js';
import { tokenActions } from '../packages/core/src/index.js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.sepolia' });

/**
 * Test gasless transaction for Jack using Dancing Community
 * 
 * Scenario: Jack wants to transfer some GToken to Bob without paying gas
 * This would typically require:
 * 1. Jack creates a UserOperation
 * 2. A Paymaster (PaymasterV4 or SuperPaymaster) sponsors the gas
 * 3. The transaction executes without Jack needing ETH
 * 
 * For now, we'll verify the setup is correct and Jack can interact with contracts
 */
async function testJackGaslessSetup() {
    const config = loadNetworkConfig('sepolia');
    const publicClient = createPublicClient({
        chain: config.chain,
        transport: http(config.rpcUrl)
    });

    // Jack's account
    const keyJack = process.env.PRIVATE_KEY_JACK as Hex;
    const jack = privateKeyToAccount(keyJack);
    const clientJack = createWalletClient({
        chain: config.chain,
        transport: http(config.rpcUrl),
        account: jack
    });

    // Bob's account (recipient)
    const keyBob = process.env.PRIVATE_KEY_BOB as Hex;
    const bob = privateKeyToAccount(keyBob);

    console.log('\n🧪 Testing Gasless Transaction Setup for Jack\n');
    console.log(`Jack Address: ${jack.address}`);
    console.log(`Bob Address: ${bob.address}`);
    console.log(`Community: Dancing Community\n`);

    // Step 1: Check Jack's balances
    const gToken = tokenActions();
    
    const jackEthBalance = await publicClient.getBalance({ address: jack.address });
    const jackGTokenBalance = await gToken(publicClient).balanceOf({
        token: config.contracts.gToken,
        account: jack.address
    });
    
    console.log('📊 Jack\'s Balances:');
    console.log(`  ETH: ${Number(jackEthBalance) / 1e18} ETH`);
    console.log(`  GToken: ${Number(jackGTokenBalance) / 1e18} tokens`);

    // Step 2: Check Bob's GToken balance (before)
    const bobGTokenBalanceBefore = await gToken(publicClient).balanceOf({
        token: config.contracts.gToken,
        account: bob.address
    });
    console.log(`\n📊 Bob's GToken Balance (before): ${Number(bobGTokenBalanceBefore) / 1e18} tokens`);

    // Step 3: Perform a regular (non-gasless) transfer as baseline
    console.log('\n💸 Testing Regular Transfer (Jack → Bob: 1 GToken)...');
    
    try {
        const transferAmount = parseEther('1');
        const transferHash = await gToken(clientJack).transfer({
            token: config.contracts.gToken,
            to: bob.address,
            amount: transferAmount,
            account: jack
        });
        
        console.log(`  Transaction: ${transferHash}`);
        console.log('  ⏳ Waiting for confirmation...');
        
        const receipt = await publicClient.waitForTransactionReceipt({ hash: transferHash });
        console.log(`  ✅ Transfer confirmed! Block: ${receipt.blockNumber}`);
        console.log(`  ⛽ Gas used: ${receipt.gasUsed} (paid by Jack)`);
        
        // Check Bob's balance after
        const bobGTokenBalanceAfter = await gToken(publicClient).balanceOf({
            token: config.contracts.gToken,
            account: bob.address
        });
        console.log(`\n📊 Bob's GToken Balance (after): ${Number(bobGTokenBalanceAfter) / 1e18} tokens`);
        console.log(`  ✅ Bob received: ${Number(bobGTokenBalanceAfter - bobGTokenBalanceBefore) / 1e18} tokens`);
        
        // Check Jack's ETH balance after (should be reduced by gas cost)
        const jackEthBalanceAfter = await publicClient.getBalance({ address: jack.address });
        const gasCost = jackEthBalance - jackEthBalanceAfter;
        console.log(`\n⛽ Gas Cost Analysis:`);
        console.log(`  Jack's ETH before: ${Number(jackEthBalance) / 1e18} ETH`);
        console.log(`  Jack's ETH after: ${Number(jackEthBalanceAfter) / 1e18} ETH`);
        console.log(`  Gas cost: ${Number(gasCost) / 1e18} ETH`);
        
        console.log('\n✅ Regular transfer successful!');
        console.log('\n📝 Next Steps for Gasless Transactions:');
        console.log('  1. Deploy a PaymasterV4 or use SuperPaymaster for Dancing Community');
        console.log('  2. Deposit funds to the Paymaster');
        console.log('  3. Create UserOperation with Paymaster signature');
        console.log('  4. Submit to Bundler (e.g., Alchemy, Pimlico)');
        console.log('  5. Transaction executes without Jack paying gas!');
        
    } catch (e: any) {
        console.log(`\n❌ Transfer failed:`);
        console.log(`Error: ${e.message}`);
        
        if (e.message.includes('insufficient funds')) {
            console.log('\n⚠️  Jack needs more ETH for gas. This is expected for regular transactions.');
            console.log('   For gasless transactions, a Paymaster would cover this cost.');
        }
    }
}

testJackGaslessSetup().catch(console.error);
