import { createPublicClient, createWalletClient, http, parseEther, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { loadNetworkConfig } from '../tests/regression/config.js';
import { tokenActions, registryActions, superPaymasterActions } from '../packages/core/dist/index.js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env.sepolia' });

const STATE_FILE = path.resolve(process.cwd(), 'scripts/l4-state.json');

async function completeJackSuperPaymasterSetup() {
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

    console.log('\n🦸 Completing Jack\'s SuperPaymaster Setup\n');
    console.log(`Jack: ${jack.address}\n`);

    const registry = registryActions(config.contracts.registry);
    const gToken = tokenActions();

    // Step 1: Register ROLE_PAYMASTER_SUPER
    console.log('📝 Step 1: Registering ROLE_PAYMASTER_SUPER...');
    const ROLE_PAYMASTER_SUPER = await registry(publicClient).ROLE_PAYMASTER_SUPER();
    
    const hasSuper = await registry(publicClient).hasRole({
        user: jack.address,
        roleId: ROLE_PAYMASTER_SUPER
    });
    
    if (!hasSuper) {
        try {
            // Check GToken balance
            const balance = await gToken(publicClient).balanceOf({
                token: config.contracts.gToken,
                account: jack.address
            });
            console.log(`  Jack's GToken: ${Number(balance) / 1e18} tokens`);
            
            const requiredStake = parseEther('50'); // SuperPaymaster requires 50 GToken
            if (balance < requiredStake) {
                console.log(`  ⚠️  Insufficient GToken! Need ${Number(requiredStake) / 1e18}, have ${Number(balance) / 1e18}`);
                
                // Mint more GToken
                const supplier = privateKeyToAccount(process.env.PRIVATE_KEY_SUPPLIER as Hex);
                const clientSupplier = createWalletClient({
                    chain: config.chain,
                    transport: http(config.rpcUrl),
                    account: supplier
                });
                
                const mintAmount = requiredStake - balance + parseEther('20'); // Extra 20 for deposit
                console.log(`  💰 Minting ${Number(mintAmount) / 1e18} GToken to Jack...`);
                const mintHash = await gToken(clientSupplier).mint({
                    token: config.contracts.gToken,
                    to: jack.address,
                    amount: mintAmount,
                    account: supplier
                });
                await publicClient.waitForTransactionReceipt({ hash: mintHash });
                console.log(`  ✅ Minted`);
            }
            
            // Approve GToken to GTokenStaking
            const allowance = await gToken(publicClient).allowance({
                token: config.contracts.gToken,
                owner: jack.address,
                spender: config.contracts.gTokenStaking
            });
            
            if (allowance < requiredStake) {
                console.log(`  📝 Approving GToken to GTokenStaking...`);
                const approveHash = await gToken(clientJack).approve({
                    token: config.contracts.gToken,
                    spender: config.contracts.gTokenStaking,
                    amount: requiredStake * BigInt(2),
                    account: jack
                });
                await publicClient.waitForTransactionReceipt({ hash: approveHash });
                console.log(`  ✅ Approved`);
            }
            
            // Register role
            console.log(`  📝 Calling registerRoleSelf...`);
            const registerHash = await registry(clientJack).registerRoleSelf({
                roleId: ROLE_PAYMASTER_SUPER,
                data: '0x',
                account: jack
            });
            await publicClient.waitForTransactionReceipt({ hash: registerHash });
            console.log(`  ✅ ROLE_PAYMASTER_SUPER granted!`);
        } catch (e: any) {
            console.log(`  ❌ Error: ${e.message.split('\n')[0]}`);
            throw e;
        }
    } else {
        console.log(`  ✅ Already has ROLE_PAYMASTER_SUPER`);
    }

    // Step 2: Deposit to SuperPaymaster
    console.log('\n💰 Step 2: Depositing to SuperPaymaster...');
    const superPaymaster = superPaymasterActions(config.contracts.superPaymaster);
    
    try {
        const currentDeposit = await superPaymaster(publicClient).getOperatorDeposit({ operator: jack.address });
        console.log(`  Current deposit: ${Number(currentDeposit) / 1e18} GToken`);
        
        const depositAmount = parseEther('20');
        console.log(`  Depositing ${Number(depositAmount) / 1e18} GToken...`);
        
        // Approve SuperPaymaster to spend GToken
        const allowance = await gToken(publicClient).allowance({
            token: config.contracts.gToken,
            owner: jack.address,
            spender: config.contracts.superPaymaster
        });
        
        if (allowance < depositAmount) {
            const approveHash = await gToken(clientJack).approve({
                token: config.contracts.gToken,
                spender: config.contracts.superPaymaster,
                amount: depositAmount,
                account: jack
            });
            await publicClient.waitForTransactionReceipt({ hash: approveHash });
        }
        
        // Deposit
        const depositHash = await superPaymaster(clientJack).depositCollateral({
            amount: depositAmount,
            account: jack
        });
        await publicClient.waitForTransactionReceipt({ hash: depositHash });
        
        const newDeposit = await superPaymaster(publicClient).getOperatorDeposit({ operator: jack.address });
        console.log(`  ✅ Deposited! New balance: ${Number(newDeposit) / 1e18} GToken`);
    } catch (e: any) {
        console.log(`  ❌ Deposit error: ${e.message.split('\n')[0]}`);
    }

    // Update state
    console.log('\n💾 Updating state...');
    const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    if (!state.jack) state.jack = {};
    state.jack.superPaymasterAddress = config.contracts.superPaymaster;
    state.jack.roles = ['ROLE_COMMUNITY', 'ROLE_PAYMASTER_SUPER'];
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    
    console.log('\n🎉 Jack\'s SuperPaymaster Setup Complete!\n');
    console.log('Summary:');
    console.log(`  Owner: Jack (${jack.address})`);
    console.log(`  Community: Dancing`);
    console.log(`  Token (dPNTs): ${state.jack.tokenAddress}`);
    console.log(`  Roles: ROLE_COMMUNITY ✅, ROLE_PAYMASTER_SUPER ✅`);
    console.log(`  SuperPaymaster: ${config.contracts.superPaymaster} ✅`);
    console.log('\n✨ Jack can now sponsor gasless transactions for Dancing Community users!');
}

completeJackSuperPaymasterSetup().catch(console.error);
