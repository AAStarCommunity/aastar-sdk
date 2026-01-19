import { BundlerClient } from '../packages/sdk/src/index.js';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.sepolia') });

async function main() {
    const bundlerUrl = process.env.SEPOLIA_RPC_URL || '';
    const entryPoint = '0x0000000071727De22E5E9d8BAf0edAc6f37da032'; // Sepolia v0.7
    
    // 1. Initialize Parallel Client
    const client = new BundlerClient(bundlerUrl, entryPoint as `0x${string}`);
    console.log('🚀 BundlerClient Canary Started');

    // 2. Test getUserOperationByHash
    // Use the hash from the previous milestone run
    const hash = '0x97ca3690efb759218325e46aa8d48e1b3ff97bcb8adb2770ca2ce1a36ad00651' as `0x${string}`;
    console.log(`\n🔍 Querying UserOp: ${hash}`);
    
    try {
        const userOp = await client.getUserOperationByHash(hash);
        console.log('✅ UserOp Found:', JSON.stringify(userOp, null, 2).slice(0, 200) + '...');
        
        const receipt = await client.getUserOperationReceipt(hash);
        console.log('✅ Receipt Found:', receipt ? 'Yes' : 'No');
        if (receipt) {
            console.log(`   Transaction Hash: ${receipt.receipt?.transactionHash || 'N/A'}`);
        }
    } catch (e: any) {
        console.error('❌ Query failed:', e.message);
    }

    // 3. Test Retry Logic (Using a bad URL)
    console.log('\n🔄 Testing Retry Logic with invalid URL...');
    const badClient = new BundlerClient('https://invalid-bundler-url.abc', entryPoint as `0x${string}`);
    
    try {
        await badClient.getUserOperationByHash(hash);
    } catch (e: any) {
        console.log('✅ Retry Logic caught failure (Check console for retry logs above this line)');
    }
}

main().catch(console.error);
