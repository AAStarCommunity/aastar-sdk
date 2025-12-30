#!/usr/bin/env node
/**
 * Simple deployment of SimpleAccounts to local Anvil
 */

import { createPublicClient, createWalletClient, http, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env.anvil') });

const RPC_URL = 'http://localhost:8545';
const FACTORY = process.env.SIMPLE_ACCOUNT_FACTORY;
const OWNER_KEY = process.env.OWNER_PRIVATE_KEY;
const OWNER2_KEY = process.env.OWNER2_PRIVATE_KEY;

const chain = {
    id: 31337,
    name: 'Anvil',
    network: 'anvil',
    nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' },
    rpcUrls: { default: { http: [RPC_URL] }, public: { http: [RPC_URL] } }
};

const factoryAbi = parseAbi([
    'function createAccount(address owner, uint256 salt) returns (address)',
    'function getAddress(address owner, uint256 salt) view returns (address)'
]);

async function main() {
    console.log('🚀 Deploying SimpleAccounts to Anvil\n');
    
    const publicClient = createPublicClient({ chain, transport: http(RPC_URL) });
    const owner = privateKeyToAccount(OWNER_KEY);
    const owner2 = privateKeyToAccount(OWNER2_KEY);
    const walletClient = createWalletClient({ account: owner, chain, transport: http(RPC_URL) });
    
    console.log(`Factory: ${FACTORY}`);
    console.log(`Owner (A/B): ${owner.address}`);
    console.log(`Owner (C): ${owner2.address}\n`);
    
    // Deploy Account A (salt=0, owner1)
    console.log('📦 Account A...');
    const addrA = await publicClient.readContract({
        address: FACTORY,
        abi: factoryAbi,
        functionName: 'getAddress',
        args: [owner.address, 0n]
    });
    console.log(`   Address: ${addrA}`);
    
    const codeA = await publicClient.getBytecode({ address: addrA });
    if (!codeA || codeA === '0x') {
        console.log('   Deploying...');
        const hash = await walletClient.writeContract({
            address: FACTORY,
            abi: factoryAbi,
            functionName: 'createAccount',
            args: [owner.address, 0n]
        });
        await publicClient.waitForTransactionReceipt({ hash });
        console.log('   ✅ Deployed');
    } else {
        console.log('   ✅ Already deployed');
    }
    
    // Deploy Account B (salt=1, owner1)
    console.log('\n📦 Account B...');
    const addrB = await publicClient.readContract({
        address: FACTORY,
        abi: factoryAbi,
        functionName: 'getAddress',
        args: [owner.address, 1n]
    });
    console.log(`   Address: ${addrB}`);
    
    const codeB = await publicClient.getBytecode({ address: addrB });
    if (!codeB || codeB === '0x') {
        console.log('   Deploying...');
        const hash = await walletClient.writeContract({
            address: FACTORY,
            abi: factoryAbi,
            functionName: 'createAccount',
            args: [owner.address, 1n]
        });
        await publicClient.waitForTransactionReceipt({ hash });
        console.log('   ✅ Deployed');
    } else {
        console.log('   ✅ Already deployed');
    }
    
    // Deploy Account C (salt=0, owner2)
    console.log('\n📦 Account C...');
    const walletClient2 = createWalletClient({ account: owner2, chain, transport: http(RPC_URL) });
    const addrC = await publicClient.readContract({
        address: FACTORY,
        abi: factoryAbi,
        functionName: 'getAddress',
        args: [owner2.address, 0n]
    });
    console.log(`   Address: ${addrC}`);
    
    const codeC = await publicClient.getBytecode({ address: addrC });
    if (!codeC || codeC === '0x') {
        console.log('   Deploying...');
        const hash = await walletClient2.writeContract({
            address: FACTORY,
            abi: factoryAbi,
            functionName: 'createAccount',
            args: [owner2.address, 0n]
        });
        await publicClient.waitForTransactionReceipt({ hash });
        console.log('   ✅ Deployed');
    } else {
        console.log('   ✅ Already deployed');
    }
    
    // Update .env.anvil
    console.log('\n📝 Updating .env.anvil...');
    const envPath = path.resolve(__dirname, '../.env.anvil');
    let envContent = fs.readFileSync(envPath, 'utf-8');
    
    envContent = envContent.replace(/TEST_SIMPLE_ACCOUNT_A=.*/, `TEST_SIMPLE_ACCOUNT_A=${addrA}`);
    envContent = envContent.replace(/TEST_SIMPLE_ACCOUNT_B=.*/, `TEST_SIMPLE_ACCOUNT_B=${addrB}`);
    envContent = envContent.replace(/TEST_SIMPLE_ACCOUNT_C=.*/, `TEST_SIMPLE_ACCOUNT_C=${addrC}`);
    envContent = envContent.replace(/EXPERIMENT_NETWORK=.*/, 'EXPERIMENT_NETWORK=local');
    
    fs.writeFileSync(envPath, envContent);
    
    console.log('\n✅ Complete!');
    console.log(`\n📊 Accounts:`);
    console.log(`   A: ${addrA}`);
    console.log(`   B: ${addrB}`);
    console.log(`   C: ${addrC}`);
    console.log('\n🎯 Ready: EXPERIMENT_RUNS=5 ./scripts/run_automated_experiment.sh local');
}

main().catch(console.error);
