import { createPublicClient, http, createClient } from 'viem';
import { sepolia } from 'viem/chains';
import { bundlerActions } from 'viem/account-abstraction';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../.env.sepolia');
dotenv.config({ path: envPath });

async function main() {
    const rpcUrl = process.env.RPC_URL || process.env.RPC_URL_SEPOLIA || (process.env.ALCHEMY_API_KEY ? `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}` : undefined);
    
    if (!rpcUrl) {
        console.error('Available Envs:', Object.keys(process.env).filter(k => k.includes('RPC') || k.includes('ALCHEMY')));
        throw new Error('RPC_URL_SEPOLIA or ALCHEMY_API_KEY not set');
    }

    console.log(`Connecting to Sepolia...`);

    const client = createPublicClient({
        chain: sepolia,
        transport: http(rpcUrl)
    });
    
    const bundlerClient = createClient({
        chain: sepolia,
        transport: http(rpcUrl)
    }).extend(bundlerActions);

    const userOpHash = '0x985c9c39caf63fbd116859bb4ed408f61469fb9811fb8a0e02f59ae4bf38b98f';
    const potentialTxHash = '0x21273027ec78731353fd43ca97caa06d428036e7897e530b3b77460b24c09ea6'; 

    console.log(`\n🔍 Deep Check UserOp: ${userOpHash}`);
    try {
        // @ts-ignore
        const userOp = await bundlerClient.getUserOperation({ hash: userOpHash as `0x${string}` });
        if (userOp) {
             console.log('✅ UserOperation Found in Bundler!');
             console.log(`   Entry Point: ${userOp.entryPoint}`);
             // @ts-ignore
             console.log(`   Transaction Hash: ${userOp.transactionHash}`);
        } else {
             console.log('❌ UserOperation NOT FOUND in Bundler (Status: Unknown/Dropped).');
        }
    } catch (e: any) { console.log(`   Check Error: ${e.message}`); }

    console.log(`\n🔍 Checking Receipt for UserOp...`);
    try {
        const receipt = await bundlerClient.getUserOperationReceipt({ hash: userOpHash as `0x${string}` });
        if (receipt) {
            console.log('✅ UserOperation Receipt Found!');
            console.log(`   Success: ${receipt.success}`);
            console.log(`   Tx Hash: ${receipt.receipt.transactionHash}`);
            if (!receipt.success) console.log(`   Revert Reason: ${receipt.reason}`);
        } else {
            console.log('❌ UserOperation Receipt NOT FOUND.');
        }
    } catch (e: any) {
        console.log(`⚠️ Error check UserOp Receipt: ${e.message}`);
    }

    console.log(`\n🔍 Deep Check Transaction: ${potentialTxHash}`);
    try {
        const tx = await client.getTransaction({ hash: potentialTxHash as `0x${string}` });
        if (tx) {
            console.log('✅ Transaction Found!');
            console.log(`   Block Number: ${tx.blockNumber} (null means Pending)`);
            console.log(`   Gas Price: ${tx.gasPrice}`);
            console.log(`   Nonce: ${tx.nonce}`);
        } else {
            console.log('❌ Transaction NOT FOUND in Node Mempool or Chain.');
        }
    } catch (e: any) {
        console.log(`⚠️ Transaction Check Failed: ${e.message}`);
    }
}

main().catch(console.error);
