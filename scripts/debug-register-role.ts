import { createPublicClient, createWalletClient, http, parseEther, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { loadNetworkConfig } from '../tests/regression/config.js';
import { registryActions, tokenActions } from '../packages/core/dist/index.js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.sepolia' });

async function debugRegisterRole() {
    const config = loadNetworkConfig('sepolia');
    const publicClient = createPublicClient({
        chain: config.chain,
        transport: http(config.rpcUrl)
    });

    // Bob's account
    const keyBob = process.env.PRIVATE_KEY_BOB as Hex;
    const bob = privateKeyToAccount(keyBob);
    const clientBob = createWalletClient({
        chain: config.chain,
        transport: http(config.rpcUrl),
        account: bob
    });

    // Jason (admin)
    const keyJason = process.env.PRIVATE_KEY_JASON as Hex;
    const jason = privateKeyToAccount(keyJason);
    const clientJason = createWalletClient({
        chain: config.chain,
        transport: http(config.rpcUrl),
        account: jason
    });

    const registry = registryActions(config.contracts.registry);
    const gToken = tokenActions();

    console.log('\n🔍 Debugging Bob registerRole Failure\n');
    console.log(`Bob Address: ${bob.address}`);
    console.log(`Jason Address: ${jason.address}`);

    // Check Bob's GToken balance
    const balance = await gToken(publicClient).balanceOf({
        token: config.contracts.gToken,
        account: bob.address
    });
    console.log(`Bob GToken Balance: ${balance / BigInt(1e18)} tokens`);

    // Check allowance
    const allowance = await gToken(publicClient).allowance({
        token: config.contracts.gToken,
        owner: bob.address,
        spender: config.contracts.registry
    });
    console.log(`Bob Allowance to Registry: ${allowance / BigInt(1e18)} tokens`);

    // Get ROLE_COMMUNITY
    const ROLE_COMMUNITY = await registry(publicClient).ROLE_COMMUNITY();
    console.log(`ROLE_COMMUNITY: ${ROLE_COMMUNITY}`);

    // Check if Bob already has role
    const hasRole = await registry(publicClient).hasRole({
        user: bob.address,
        roleId: ROLE_COMMUNITY
    });
    console.log(`Bob has ROLE_COMMUNITY: ${hasRole}`);

    if (!hasRole) {
        // Try to approve first
        console.log('\n📝 Approving GToken for Registry...');
        try {
            const approveHash = await gToken(clientBob).approve({
                token: config.contracts.gToken,
                spender: config.contracts.registry,
                amount: parseEther('100000'),
                account: bob
            });
            await publicClient.waitForTransactionReceipt({ hash: approveHash });
            console.log('✅ Approved');
        } catch (e: any) {
            console.log(`❌ Approve failed: ${e.message}`);
        }

        // Try to register
        console.log('\n📝 Attempting registerRole...');
        try {
            const hash = await registry(clientJason).registerRole({
                roleId: ROLE_COMMUNITY,
                user: bob.address,
                data: '0x',
                account: jason
            });
            await publicClient.waitForTransactionReceipt({ hash });
            console.log('✅ Registration successful!');
        } catch (e: any) {
            console.log(`❌ Registration failed:`);
            console.log(e);
        }
    }
}

debugRegisterRole().catch(console.error);
