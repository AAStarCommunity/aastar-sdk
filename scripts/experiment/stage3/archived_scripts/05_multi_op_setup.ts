
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { http, type Hex, parseEther, createPublicClient, createWalletClient, erc20Abi } from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { createOperatorClient, RoleIds } from '../../../packages/sdk/src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '.env.sepolia');
const multiOpEnvPath = path.join(__dirname, '.env.multi_op');

dotenv.config({ path: envPath });

async function main() {
    console.log('🚀 Stage 3 Scenario 5: Multi-Operator Setup (Jason & Anni)');

    const RPC_URL = process.env.SEPOLIA_RPC_URL;
    const SUPPLIER_KEY = process.env.PRIVATE_KEY_SUPPLIER as Hex;
    if (!RPC_URL || !SUPPLIER_KEY) throw new Error('Missing Config (RPC_URL or SUPPLIER_KEY)');

    const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC_URL) });
    const supplierAccount = privateKeyToAccount(SUPPLIER_KEY);
    const supplierWallet = createWalletClient({ account: supplierAccount, chain: sepolia, transport: http(RPC_URL) });

    // 1. Generate Keys if not exists
    let jasonKey: Hex;
    let anniKey: Hex;

    if (fs.existsSync(multiOpEnvPath)) {
        console.log('📖 Loading existing keys from .env.multi_op');
        const existing = dotenv.parse(fs.readFileSync(multiOpEnvPath));
        jasonKey = existing.JASON_PRIVATE_KEY as Hex;
        anniKey = existing.ANNI_PRIVATE_KEY as Hex;
    } else {
        console.log('🎲 Generating new keys for Jason and Anni...');
        jasonKey = generatePrivateKey();
        anniKey = generatePrivateKey();
        const content = `JASON_PRIVATE_KEY=${jasonKey}\nANNI_PRIVATE_KEY=${anniKey}\n`;
        fs.writeFileSync(multiOpEnvPath, content);
        console.log('💾 Keys saved to .env.multi_op (Keep this file safe!)');
    }

    const REGISTRY = process.env.REGISTRY_ADDR as Address;
    const STAKING = process.env.STAKING_ADDR as Address;
    const SUPER_PAYMASTER = process.env.SUPER_PAYMASTER as Address;
    const GTOKEN = process.env.GTOKEN_ADDR as Address;

    console.log(`🔍 Registry: ${REGISTRY}`);
    console.log(`🔍 Staking: ${STAKING}`);
    console.log(`🔍 SuperPaymaster: ${SUPER_PAYMASTER}`);
    console.log(`🔍 GToken: ${GTOKEN}`);

    if (!REGISTRY || !STAKING || !SUPER_PAYMASTER || !GTOKEN) {
        console.error('❌ Missing one or more contract addresses in .env.sepolia');
        // Let's try to find them if they are differently named
        console.log('Environment Keys:', Object.keys(process.env).filter(k => k.includes('ADDR') || k.includes('PAYMASTER')));
    }

    const ops = [
        { name: 'Jason', account: privateKeyToAccount(jasonKey) },
        { name: 'Anni', account: privateKeyToAccount(anniKey) }
    ];

    for (const op of ops) {
        console.log(`\n👤 Setting up Operator: ${op.name} (${op.account.address})`);
        
        // 2. Funding (ETH)
        const bal = await publicClient.getBalance({ address: op.account.address });
        if (bal < parseEther('0.05')) {
            console.log(`   💸 Funding ${op.name} with 0.1 ETH...`);
            const hash = await supplierWallet.sendTransaction({
                to: op.account.address,
                value: parseEther('0.1')
            });
            console.log(`   Transaction Sent: ${hash}`);
            await publicClient.waitForTransactionReceipt({ hash });
            console.log(`   ✅ ETH Funded.`);
        } else {
            console.log(`   ✅ Sufficient ETH: ${Number(bal) / 1e18} ETH`);
        }

        // 2.1 Funding (GToken for Staking)
        const gBal = await publicClient.readContract({
            address: GTOKEN,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [op.account.address]
        });

        if (gBal < parseEther('50')) {
            console.log(`   💸 Funding ${op.name} with 50 GToken...`);
            const { request } = await publicClient.simulateContract({
                account: supplierAccount,
                address: GTOKEN,
                abi: erc20Abi,
                functionName: 'transfer',
                args: [op.account.address, parseEther('50')]
            });
            const hash = await supplierWallet.writeContract(request);
            console.log(`   Transaction Sent: ${hash}`);
            await publicClient.waitForTransactionReceipt({ hash });
            console.log(`   ✅ GToken Funded.`);
        } else {
            console.log(`   ✅ Sufficient GToken: ${Number(gBal) / 1e18}`);
        }

        // 3. Onboarding
        const sdkOp = createOperatorClient({
            chain: sepolia,
            transport: http(RPC_URL),
            account: op.account,
            addresses: {
                registry: REGISTRY,
                staking: STAKING,
                superPaymaster: SUPER_PAYMASTER,
                gtoken: GTOKEN
            }
        });

        // We assume they need some GToken for staking. 
        // For this experiment, we might need the supplier to send them GToken first.
        // But for now, let's see if the onboarding script handles it or if they have GToken.
        // Actually, they are new accounts, they have 0 GToken.
        
        console.log(`   SDK: Checking registration status...`);
        const isReg = await sdkOp.hasRole({ roleId: RoleIds.PAYMASTER_SUPER, user: op.account.address });
        
        if (!isReg) {
            console.log(`   SDK: Onboarding as Operator...`);
            await sdkOp.onboardOperator({
                stakeAmount: parseEther('50'),
                depositAmount: parseEther('0'), // No deposit for now, just registry
                roleId: RoleIds.PAYMASTER_SUPER
            });
            console.log(`   ✅ Onboarded ${op.name}.`);
        } else {
            console.log(`   ✅ Already Onboarded.`);
        }
    }

    console.log('\n🏁 Multi-Operator Setup Phase Complete.');
}

import { type Address } from 'viem';
main().catch(console.error);
