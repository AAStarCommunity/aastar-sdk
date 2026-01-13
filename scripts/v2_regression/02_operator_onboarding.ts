import { http, parseEther, type Hex, type Address, keccak256, stringToBytes, erc20Abi, encodeAbiParameters, parseAbiParameters } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry, sepolia } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { createOperatorClient, createAdminClient, RegistryABI, RoleIds } from '../../packages/sdk/dist/index.js';

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
const OPERATOR_KEY = (process.env.OPERATOR_KEY || "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d") as Hex;

const localAddresses = {
    registry: process.env.REGISTRY_ADDRESS as Address,
    gToken: process.env.GTOKEN_ADDRESS as Address,
    gTokenStaking: process.env.GTOKENSTAKING_ADDRESS as Address,
    superPaymaster: process.env.SUPER_PAYMASTER as Address,
    aPNTs: process.env.APNTS_ADDRESS as Address,
    mySBT: process.env.MYSBT_ADDRESS as Address
};

// ROLE_PAYMASTER_SUPER is imported from RoleIds

async function onboarding() {

    console.log('🚀 Step 02: Operator Onboarding');
    
    const adminAccount = privateKeyToAccount(ADMIN_KEY);
    const adminClient = createAdminClient({
        chain, transport: http(RPC_URL), account: adminAccount, addresses: localAddresses as any
    });

    const operatorAccount = privateKeyToAccount(OPERATOR_KEY);
    const operatorClient = createOperatorClient({
        chain, transport: http(RPC_URL), account: operatorAccount, addresses: localAddresses as any
    });

    console.log(`   Operator: ${operatorAccount.address}`);

    // ROLE_PAYMASTER_SUPER is now built-in and active in Registry.sol
    
    // FUNDING HELPER
    const publicClient = adminClient.extend(c => c); // Admin client is already a WalletClient + PublicActions? No, createAdminClient returns specific type.
    // Use createPublicClient instead
    const { createPublicClient } = await import('viem');
    const publicClientViem = createPublicClient({ chain, transport: http(RPC_URL) });

    async function ensureFunds(target: Address, ethNeeded: bigint, gTokenNeeded: bigint, aPNTsNeeded: bigint) {
        // ETH
        const ethBal = await publicClientViem.getBalance({ address: target });
        console.log(`   💰 Operator ETH Balance: ${ethBal} wei`);
        if (ethBal < ethNeeded) {
            console.log(`   ⚠️ Low ETH. Admin funding...`);
            try {
                const tx = await adminClient.sendTransaction({ to: target, value: ethNeeded - ethBal });
                await adminClient.waitForTransactionReceipt({ hash: tx });
                console.log(`   ✅ Funded ETH`);
            } catch (e) {
                console.log(`   ❌ Failed to fund ETH (Admin might be poor):`, e);
            }
        }

        // GToken
        const gTokenBal = await publicClientViem.readContract({
            address: localAddresses.gToken, abi: erc20Abi, functionName: 'balanceOf', args: [target]
        });
        console.log(`   💰 Operator GToken Balance: ${gTokenBal}`);
        if (gTokenBal < gTokenNeeded) {
            console.log(`   ⚠️ Low GTokens. Admin funding...`);
            try {
                const tx = await adminClient.writeContract({
                    address: localAddresses.gToken, abi: erc20Abi, functionName: 'transfer', args: [target, gTokenNeeded - gTokenBal]
                });
                await adminClient.waitForTransactionReceipt({ hash: tx });
                console.log(`   ✅ Funded GTokens`);
            } catch (e: any) {
                console.log(`   ❌ Failed to fund GTokens:`, e.message?.split('\n')[0]);
            }
        }

        // aPNTs
        const aPNTsBal = await publicClientViem.readContract({
            address: localAddresses.aPNTs, abi: erc20Abi, functionName: 'balanceOf', args: [target]
        });
        console.log(`   💰 Operator aPNTs Balance: ${aPNTsBal}`);
        if (aPNTsBal < aPNTsNeeded) {
            console.log(`   ⚠️ Low aPNTs. Admin funding...`);
            try {
                const tx = await adminClient.writeContract({
                    address: localAddresses.aPNTs, abi: erc20Abi, functionName: 'transfer', args: [target, aPNTsNeeded - aPNTsBal]
                });
                await adminClient.waitForTransactionReceipt({ hash: tx });
                console.log(`   ✅ Funded aPNTs`);
            } catch (e: any) {
                console.log(`   ❌ Failed to fund aPNTs:`, e.message?.split('\n')[0]);
            }
        }
    }

    // Ensure Operator has enough for 2 stakes (30 + 50 = 80 GTokens) + Gas + aPNTs for deposit
    await ensureFunds(operatorAccount.address, parseEther('0.05'), parseEther('100'), parseEther('100'));


    // 2. Operator Onboarding (Using Thin SDK fully)
    console.log('\n📦 Executing SDK onboardFully...');
    
    try {
        const onboardResult = await operatorClient.onboardFully({
            roleId: RoleIds.PAYMASTER_SUPER,
            stakeAmount: parseEther('50'),
            depositAmount: parseEther('50')
        });
        console.log(`   ✅ Onboarding Transaction: ${onboardResult.hash}`);
    } catch (e: any) {
        if (e.message.includes('already has') || e.message.includes('RoleAlreadyGranted')) {
            console.log('   ℹ️ Operator already has PAYMASTER_SUPER role. Skipping.');
        } else {
            console.warn('   ⚠️ Onboarding error (may be partially registered):', e.message);
        }
    }

    // 3. Configure Operator in SuperPaymaster (Billing settings)
    console.log('\n💳 Configuring Operator Billing Settings...');
    const opConfig = await adminClient.readContract({
        address: localAddresses.superPaymaster,
        abi: [{
            type: 'function', name: 'operators', inputs: [{type:'address'}],
            outputs: [
                {name:'balance', type:'uint128'}, {name:'exRate', type:'uint96'},
                {name:'isConfigured', type:'bool'}, {name:'isPaused', type:'bool'},
                {name:'xPNTsToken', type:'address'}, {name:'reputation', type:'uint32'},
                {name:'treasury', type:'address'}, {name:'spent', type:'uint256'},
                {name:'txSponsored', type:'uint256'}
            ],
            stateMutability: 'view'
        }],
        functionName: 'operators',
        args: [operatorAccount.address]
    }) as any[];

    if (!opConfig[2]) { // isConfigured at index 2 in V3.2 Packed
        const configTx = await operatorClient.configureOperator({
            xPNTsToken: localAddresses.aPNTs,
            treasury: operatorAccount.address,
            exchangeRate: 1000000000000000000n // 1 ETH (1:1)
        });
        await adminClient.waitForTransactionReceipt({ hash: configTx });
        console.log('   ✅ Operator Billing Configured');
    } else {
        console.log('   ✅ Operator already configured in SuperPaymaster');
    }

    console.log('\n🎉 Step 02 Completed Successfully\n');
}

onboarding().catch(err => {
    if (err.data && err.data.name === 'RoleNotConfigured') {
        console.error('❌ Step 02 Failed: RoleNotConfigured detected!');
        console.error('   Args:', err.data.args);
    } else {
        console.error('❌ Step 02 Failed:', err);
    }
    process.exit(1);
});

