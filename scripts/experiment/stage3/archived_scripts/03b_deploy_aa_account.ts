
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { createPublicClient, createWalletClient, http, type Hex, parseAbi, type Address, getContractAddress, encodeFunctionData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env.sepolia') });

async function main() {
    console.log('🚀 Stage 3 Scenario 03b: AA Account Deployment');
    
    // CONFIG
    const RPC_URL = process.env.SEPOLIA_RPC_URL;
    const USER_KEY = '0x0a7108e34f0d05eddc6e80ee380f5d81dcae2030263f75e42a4c015f59ccd8a4' as Hex;
    const FACTORY = '0x91E60e0613810449d098b0b5Ec8b51A0FE8c8985' as Address;
    
    if (!RPC_URL) throw new Error('Missing RPC_URL');

    const client = createPublicClient({ chain: foundry, transport: http(RPC_URL) });
    const owner = privateKeyToAccount(USER_KEY);
    const wallet = createWalletClient({ account: owner, chain: foundry, transport: http(RPC_URL) });

    const factoryAbi = parseAbi([
        'function createAccount(address owner, uint256 salt) external returns (address)',
        'function getAddress(address owner, uint256 salt) view returns (address)'
    ]);

    // 1. Predict Address
    const salt = 0n;
    const aaAddr = await client.readContract({
        address: FACTORY, abi: factoryAbi, functionName: 'getAddress', args: [owner.address, salt]
    });
    console.log(`👤 Owner: ${owner.address}`);
    console.log(`🤖 Predicted AA: ${aaAddr}`);

    // Check if deployed
    const code = await client.getBytecode({ address: aaAddr });
    if (code && code !== '0x') {
        console.log('   ✅ AA already deployed.');
    } else {
        console.log('   Deploying AA Account...');
        const tx = await wallet.writeContract({
            address: FACTORY, abi: factoryAbi, functionName: 'createAccount', args: [owner.address, salt]
        });
        console.log(`   ⏳ Transaction: ${tx}`);
        const receipt = await client.waitForTransactionReceipt({ hash: tx });
        if (receipt.status === 'success') {
            console.log('   ✅ AA Deployed successfully.');
        } else {
            console.error('   ❌ Deployment reverted.');
        }
    }

    console.log('\n🏁 Scenario 03b Complete.');
}

main().catch(console.error);
