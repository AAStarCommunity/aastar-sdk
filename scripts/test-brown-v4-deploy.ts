import { createPublicClient, createWalletClient, http, parseEther, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { loadNetworkConfig } from '../tests/regression/config.js';
import { PaymasterOperatorClient } from '../packages/operator/src/index.js';
import { registryActions } from '../packages/core/src/index.js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env.sepolia' });

const STATE_FILE = path.resolve(process.cwd(), 'scripts/l4-state.json');

async function testBrownV4Deploy() {
    const config = loadNetworkConfig('sepolia');
    const publicClient = createPublicClient({
        chain: config.chain,
        transport: http(config.rpcUrl)
    });

    // Brown's account
    const keyBrown = process.env.PRIVATE_KEY_BROWN as Hex;
    if (!keyBrown) throw new Error('PRIVATE_KEY_BROWN not found');
    
    const brown = privateKeyToAccount(keyBrown);
    const clientBrown = createWalletClient({
        chain: config.chain,
        transport: http(config.rpcUrl),
        account: brown
    });

    console.log('\n🏗️  Testing deployAndRegisterPaymasterV4() with Brown\n');
    console.log(`Brown: ${brown.address}`);
    
    // Config must include paymasterFactoryAddress now!
    const paymasterClient = new PaymasterOperatorClient({
        client: clientBrown,
        publicClient: publicClient,
        registryAddress: config.contracts.registry,
        gTokenAddress: config.contracts.gToken,
        gTokenStakingAddress: config.contracts.gTokenStaking,
        superPaymasterAddress: config.contracts.superPaymaster,
        paymasterFactoryAddress: config.contracts.paymasterFactory // NEW REQUIREMENT
    });

    console.log(`PaymasterFactory: ${config.contracts.paymasterFactory}`);

    try {
        console.log('\n🚀 Deploying V4 Paymaster and Registering AOA Role...');
        const result = await paymasterClient.deployAndRegisterPaymasterV4({
            stakeAmount: parseEther('30'),
            salt: 1n
        });
        
        console.log(`\n✅ Success!`);
        console.log(`  Paymaster V4 Address: ${result.paymasterAddress}`);
        console.log(`  Deploy Hash: ${result.deployHash}`);
        console.log(`  Register Hash: ${result.registerHash}`);
        
        // Save to state
        const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
        const operator = state.operators.find((o: any) => o.address === brown.address);
        if (operator) {
            operator.roles.push('ROLE_PAYMASTER_AOA');
            operator.paymasterV4 = result.paymasterAddress;
            fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
            console.log('  💾 Saved to state file');
        }

    } catch (e: any) {
        console.log(`\n❌ Error: ${e.message}`);
        if (e.message.includes('Already has ROLE_PAYMASTER_AOA')) {
             console.log('  (Idempotency test passed)');
        }
    }

    // Verify Roles
    console.log('\n🔍 Verifying Roles...');
    const registry = registryActions(config.contracts.registry);
    const ROLE_PAYMASTER_AOA = await registry(publicClient).ROLE_PAYMASTER_AOA();
    
    const hasAOA = await registry(publicClient).hasRole({
        user: brown.address,
        roleId: ROLE_PAYMASTER_AOA
    });
    
    console.log(`  ROLE_PAYMASTER_AOA: ${hasAOA ? '✅' : '❌'}`);
}

testBrownV4Deploy().catch(console.error);
