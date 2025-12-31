/**
 * Setup Complete Test Environment for PhD Experiments
 * 
 * This script demonstrates the full TestAccountManager API capabilities:
 * - Generate random EOA keys
 * - Deploy SimpleAccounts
 * - Fund with ETH
 * - Transfer test tokens (GToken, aPNTs, bPNTs)
 * - Save to .env for reuse
 */
import { createPublicClient, createWalletClient, http, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { getNetworkConfig } from './00_utils.js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env.sepolia') });

async function main() {
    console.log('🧪 Setting up Complete PhD Experiment Test Environment...\n');

    const { chain, rpc } = getNetworkConfig('sepolia');
    const supplierKey = process.env.PRIVATE_KEY_SUPPLIER as `0x${string}`;
    
    if (!supplierKey) {
        throw new Error('Missing PRIVATE_KEY_SUPPLIER in .env.sepolia');
    }

    const supplierAccount = privateKeyToAccount(supplierKey);
    const publicClient = createPublicClient({ chain, transport: http(rpc) });
    const supplierWallet = createWalletClient({ account: supplierAccount, chain, transport: http(rpc) });
    
    // Use SDK API (dynamic import)
    const { TestAccountManager } = await import('../packages/enduser/src/index.js');
    const toolkit = new TestAccountManager(publicClient, supplierWallet);
    
    // Prepare complete test environment
    const env = await toolkit.prepareTestEnvironment({
        accountCount: 3,
        fundEachEOAWithETH: parseEther("0.01"),
        fundEachAAWithETH: parseEther("0.02"),
        tokens: {
            GToken: {
                address: (process.env.GTOKEN_ADDRESS || '0x0') as `0x${string}`,
                amount: parseEther("100"),
                fundEOA: true,
                fundAA: true
            },
            aPNTs: {
                address: (process.env.APNTS_ADDRESS || '0x0') as `0x${string}`,
                amount: parseEther("50"),
                fundEOA: true,
                fundAA: true
            },
            // Add more tokens as needed
        }
    });
    
    // Export to .env format
    const envContent = toolkit.exportToEnv(env.accounts);
    
    console.log('\n📋 Generated .env entries:\n');
    console.log(envContent);
    
    // Append to .env.sepolia
    const envPath = path.resolve(__dirname, '../.env.sepolia');
    fs.appendFileSync(envPath, '\n' + envContent);
    console.log(`\n✅ Appended to ${envPath}`);
    
    // Summary
    console.log('\n📊 Test Environment Summary:');
    console.log(`   Accounts: ${env.accounts.length}`);
    console.log(`   Token Distributions: ${env.tokenFunding.length}`);
    
    env.accounts.forEach(acc => {
        console.log(`\n${acc.label}:`);
        console.log(`  EOA: ${acc.ownerAddress}`);
        console.log(`  AA:  ${acc.aaAddress}`);
        console.log(`  Tx:  https://sepolia.etherscan.io/tx/${acc.deployTxHash}`);
    });
}

main().catch(console.error);
