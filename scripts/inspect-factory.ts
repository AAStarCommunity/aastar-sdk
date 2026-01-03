import { createPublicClient, http, parseAbi, type Address } from 'viem';
import { sepolia } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.sepolia') });

async function main() {
    console.log('\n🏭 Inspecting Paymaster Factory State (Sepolia)...\n');

    const factoryAddress = process.env.PAYMASTER_FACTORY_ADDRESS as Address;
    if (!factoryAddress) {
        console.error('❌ PAYMASTER_FACTORY_ADDRESS not set in .env.sepolia');
        process.exit(1);
    }
    console.log(`📍 Factory Address: ${factoryAddress}`);

    const client = createPublicClient({
        chain: sepolia,
        transport: http(process.env.RPC_URL)
    });

    try {
        // 1. Check Default Version
        const defaultVersion = await client.readContract({
            address: factoryAddress,
            abi: parseAbi(['function defaultVersion() external view returns (string)']),
            functionName: 'defaultVersion',
        }) as string;
        console.log(`ℹ️  Default Version: "${defaultVersion}"`);

        // 2. Check Specific Implementations
        const versionsToCheck = ['v4.0', 'v4.1', 'v4.1i', 'v4.2', 'V4.2', 'v4.2.0'];
        console.log(`\n🔍 Checking Implementations:`);
        
        for (const v of versionsToCheck) {
            try {
                const impl = await client.readContract({
                    address: factoryAddress,
                    abi: parseAbi(['function implementations(string) external view returns (address)']),
                    functionName: 'implementations',
                    args: [v]
                }) as Address;
                
                const exists = impl !== '0x0000000000000000000000000000000000000000';
                console.log(`   - "${v}": ${exists ? impl : 'Not Registered'}`);
                
                // If exists, try to get version() from implementation
                if (exists) {
                    try {
                        const ver = await client.readContract({
                            address: impl,
                            abi: parseAbi(['function version() external view returns (string)']),
                            functionName: 'version',
                        });
                        console.log(`     ↳ Impl.version(): "${ver}"`);
                    } catch (e) {
                        console.log(`     ↳ Impl.version(): [Read Failed]`);
                    }
                }

            } catch (e) {
                console.log(`   - "${v}": Error querying`);
            }
        }

        // 3. Count Deployed Paymasters
        const count = await client.readContract({
            address: factoryAddress,
            abi: parseAbi(['function getPaymasterCount() external view returns (uint256)']),
            functionName: 'getPaymasterCount',
        }) as bigint;
        console.log(`\n📈 Total Deployed Paymasters: ${count}`);

    } catch (e: any) {
        console.error('❌ Error inspecting factory:', e.message);
    }
}

main();
