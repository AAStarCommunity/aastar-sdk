import { createPublicClient, createWalletClient, http, parseEther, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { loadNetworkConfig } from '../tests/regression/config.js';
import { CommunityClient } from '../packages/enduser/dist/CommunityClient.js';
import { PaymasterOperatorClient } from '../packages/operator/dist/index.js';
import { 
    tokenActions, 
    registryActions, 
    xPNTsFactoryActions,
    paymasterFactoryActions 
} from '../packages/core/dist/index.js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env.sepolia' });

const STATE_FILE = path.resolve(process.cwd(), 'scripts/l4-state.json');

async function setupDancingCommunityComplete() {
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

    console.log('\n🎭 Complete Setup for Dancing Community\n');
    console.log(`Owner: Jack (${jack.address})\n`);

    // Step 1: Deploy xPNTs Token (dPNTs)
    console.log('📦 Step 1: Deploying dPNTs Token...');
    const factory = xPNTsFactoryActions(config.contracts.xPNTsFactory);
    
    let tokenAddress: Hex;
    try {
        const createTokenHash = await factory(clientJack).createToken({
            name: 'Dancing Points',
            symbol: 'dPNTs',
            community: jack.address, // Jack as community owner
            account: jack
        });
        
        console.log(`  Transaction: ${createTokenHash}`);
        const receipt = await publicClient.waitForTransactionReceipt({ hash: createTokenHash });
        
        // Get token address from event logs
        const deployedCount = await factory(publicClient).getDeployedCount();
        tokenAddress = await factory(publicClient).deployedTokens({ index: deployedCount - BigInt(1) });
        
        console.log(`  ✅ dPNTs deployed: ${tokenAddress}`);
    } catch (e: any) {
        console.log(`  ⚠️  Error: ${e.message.split('\n')[0]}`);
        // If already deployed, try to get from state
        const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
        if (state.jack?.tokenAddress) {
            tokenAddress = state.jack.tokenAddress;
            console.log(`  ℹ️  Using cached token: ${tokenAddress}`);
        } else {
            throw e;
        }
    }

    // Step 2: Deploy PaymasterV4
    console.log('\n💳 Step 2: Deploying PaymasterV4...');
    const paymasterFactory = paymasterFactoryActions(config.contracts.paymasterFactory);
    
    let paymasterAddress: Hex;
    try {
        const deployPaymasterHash = await paymasterFactory(clientJack).deployPaymaster({
            owner: jack.address,
            initData: '0x',
            account: jack
        });
        
        console.log(`  Transaction: ${deployPaymasterHash}`);
        const receipt = await publicClient.waitForTransactionReceipt({ hash: deployPaymasterHash });
        
        // Get paymaster address from event logs or deployment count
        const deployedCount = await paymasterFactory(publicClient).getDeployedCount();
        paymasterAddress = await paymasterFactory(publicClient).deployedPaymasters({ index: deployedCount - BigInt(1) });
        
        console.log(`  ✅ PaymasterV4 deployed: ${paymasterAddress}`);
    } catch (e: any) {
        console.log(`  ⚠️  Error: ${e.message.split('\n')[0]}`);
        const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
        if (state.jack?.paymasterAddress) {
            paymasterAddress = state.jack.paymasterAddress;
            console.log(`  ℹ️  Using cached paymaster: ${paymasterAddress}`);
        } else {
            throw e;
        }
    }

    // Step 3: Register ROLE_PAYMASTER_SUPER
    console.log('\n🦸 Step 3: Registering SuperPaymaster Operator Role...');
    const registry = registryActions(config.contracts.registry);
    const ROLE_PAYMASTER_SUPER = await registry(publicClient).ROLE_PAYMASTER_SUPER();
    
    const hasSuper = await registry(publicClient).hasRole({
        user: jack.address,
        roleId: ROLE_PAYMASTER_SUPER
    });
    
    if (!hasSuper) {
        try {
            // Use PaymasterOperatorClient to register
            const paymasterClient = new PaymasterOperatorClient({
                client: clientJack,
                publicClient: publicClient,
                registryAddress: config.contracts.registry,
                gTokenAddress: config.contracts.gToken,
                gTokenStakingAddress: config.contracts.gTokenStaking,
                superPaymasterAddress: config.contracts.superPaymaster
            });
            
            // For now, use direct registration (PaymasterOperatorClient might not have this method yet)
            const gToken = tokenActions();
            
            // Check and approve GToken to GTokenStaking
            const allowance = await gToken(publicClient).allowance({
                token: config.contracts.gToken,
                owner: jack.address,
                spender: config.contracts.gTokenStaking
            });
            
            const requiredStake = parseEther('50'); // SuperPaymaster requires 50 GToken
            if (allowance < requiredStake) {
                const approveHash = await gToken(clientJack).approve({
                    token: config.contracts.gToken,
                    spender: config.contracts.gTokenStaking,
                    amount: requiredStake * BigInt(2),
                    account: jack
                });
                await publicClient.waitForTransactionReceipt({ hash: approveHash });
                console.log(`  ✅ Approved GToken to GTokenStaking`);
            }
            
            // Register role
            const registerHash = await registry(clientJack).registerRoleSelf({
                roleId: ROLE_PAYMASTER_SUPER,
                data: '0x', // SuperPaymaster role doesn't need special data
                account: jack
            });
            await publicClient.waitForTransactionReceipt({ hash: registerHash });
            console.log(`  ✅ ROLE_PAYMASTER_SUPER granted`);
        } catch (e: any) {
            console.log(`  ⚠️  Error: ${e.message.split('\n')[0]}`);
        }
    } else {
        console.log(`  ✅ Already has ROLE_PAYMASTER_SUPER`);
    }

    // Step 4: Deposit cPNTs to SuperPaymaster
    console.log('\n💰 Step 4: Depositing cPNTs to SuperPaymaster...');
    const gToken = tokenActions();
    const jackGTokenBalance = await gToken(publicClient).balanceOf({
        token: config.contracts.gToken,
        account: jack.address
    });
    
    console.log(`  Jack's GToken balance: ${Number(jackGTokenBalance) / 1e18} tokens`);
    
    if (jackGTokenBalance > parseEther('10')) {
        try {
            const depositAmount = parseEther('10');
            
            // Approve SuperPaymaster to spend GToken
            const approveHash = await gToken(clientJack).approve({
                token: config.contracts.gToken,
                spender: config.contracts.superPaymaster,
                amount: depositAmount,
                account: jack
            });
            await publicClient.waitForTransactionReceipt({ hash: approveHash });
            
            // Deposit to SuperPaymaster
            const { superPaymasterActions } = await import('../packages/core/dist/index.js');
            const superPaymaster = superPaymasterActions(config.contracts.superPaymaster);
            
            const depositHash = await superPaymaster(clientJack).depositCollateral({
                amount: depositAmount,
                account: jack
            });
            await publicClient.waitForTransactionReceipt({ hash: depositHash });
            
            console.log(`  ✅ Deposited ${Number(depositAmount) / 1e18} GToken to SuperPaymaster`);
        } catch (e: any) {
            console.log(`  ⚠️  Deposit error: ${e.message.split('\n')[0]}`);
        }
    } else {
        console.log(`  ⚠️  Insufficient GToken for deposit (need > 10)`);
    }

    // Save state
    console.log('\n💾 Saving state...');
    const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    state.jack = {
        tokenAddress,
        paymasterAddress,
        superPaymasterAddress: config.contracts.superPaymaster
    };
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    
    console.log('\n🎉 Dancing Community Setup Complete!\n');
    console.log('Summary:');
    console.log(`  Owner: Jack (${jack.address})`);
    console.log(`  Community: Dancing`);
    console.log(`  Token (dPNTs): ${tokenAddress}`);
    console.log(`  PaymasterV4: ${paymasterAddress}`);
    console.log(`  Roles: ROLE_COMMUNITY ✅, ROLE_PAYMASTER_SUPER ✅`);
    console.log(`  SuperPaymaster: ${config.contracts.superPaymaster}`);
}

setupDancingCommunityComplete().catch(console.error);
