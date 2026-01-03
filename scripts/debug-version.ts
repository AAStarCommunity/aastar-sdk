import { createPublicClient, http, parseAbi } from 'viem';
import { sepolia } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as path from 'path';

import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.sepolia') });


// Jason's Paymaster from previous run (might change)
const PAYMASTER_FACTORY = process.env.PAYMASTER_FACTORY_ADDRESS as `0x${string}`;
// Jason's Paymaster from previous run (might change)
const PAYMASTER_IMPL = '0x0000000000000000000000000000000000000000' as `0x${string}`;   

async function main() {
    console.log('🔍 Checking Paymaster Versions...');
    const client = createPublicClient({
        chain: sepolia,
        transport: http(process.env.RPC_URL)
    });

    try {
        const defaultVersion = await client.readContract({
            address: PAYMASTER_FACTORY,
            abi: parseAbi(['function defaultVersion() external view returns (string)']),
            functionName: 'defaultVersion',
        });
        console.log(`🏭 Factory defaultVersion(): "${defaultVersion}"`);

        // Check if V4.2 exists
        try {
             const impl42 = await client.readContract({
                address: PAYMASTER_FACTORY,
                abi: parseAbi(['function paymasterImplementation(string) external view returns (address)']),
                functionName: 'paymasterImplementation',
                args: ['v4.2']
             });
             console.log(`🔍 V4.2 Implementation: ${impl42}`);
             
             const impl41 = await client.readContract({
                address: PAYMASTER_FACTORY,
                abi: parseAbi(['function paymasterImplementation(string) external view returns (address)']),
                functionName: 'paymasterImplementation',
                args: ['v4.1i']
             });
             console.log(`🔍 v4.1i Implementation: ${impl41}`);

        } catch (e: any) {
             console.log('⚠️  Could not query paymasterImplementation:', e.message.split('\n')[0]);
        }

        // Check Paymaster Implementation Version
        try {
            const pmVersion = await client.readContract({
                address: PAYMASTER_IMPL,
                abi: parseAbi(['function version() external view returns (string)']),
                functionName: 'version',
            });
            console.log(`🪙  Paymaster version(): "${pmVersion}"`);
        } catch (e: any) {
            console.log(`⚠️  Could not read Paymaster version (skipped impl check):`, e.message.split('\n')[0]);
        }

    } catch (e: any) {
        console.error('❌ Error:', e.message);
    }
}

main();
