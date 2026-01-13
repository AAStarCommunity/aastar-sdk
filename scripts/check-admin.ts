
import { createPublicClient, http, parseAbi, type Address } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import * as dotenv from 'dotenv';
import { loadNetworkConfig } from '../tests/regression/config.js';

dotenv.config({ path: '.env.sepolia' });

async function main() {
    const config = loadNetworkConfig('sepolia');
    const publicClient = createPublicClient({ chain: sepolia, transport: http(config.rpcUrl) });
    const registryAddr = config.contracts.registry;

    console.log(`\n🔍 Checking Permissions for Registry: ${registryAddr}`);

    // --- 1. Identify Candidate Keys ---
    const keysToCheck: { name: string, account: any }[] = [];
    
    // Add explicitly named keys first for clarity
    if (process.env.PRIVATE_KEY) keysToCheck.push({ name: 'PRIVATE_KEY', account: privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`) });
    
    for (const [key, value] of Object.entries(process.env)) {
        if (key.startsWith('PRIVATE_KEY') && value && value.startsWith('0x')) {
            try {
                const acct = privateKeyToAccount(value as `0x${string}`);
                // Avoid duplicates
                if (!keysToCheck.find(k => k.account.address === acct.address)) {
                    keysToCheck.push({ name: key, account: acct });
                }
            } catch (e) {
                // Ignore parsing errors for non-keys
            }
        }
    }
    console.log(`   Found ${keysToCheck.length} candidate keys in .env.sepolia`);
    keysToCheck.forEach(k => console.log(`   - ${k.name.padEnd(20)}: ${k.account.address}`));

    const registryAbi = parseAbi([
        'function hasRole(bytes32 role, address account) view returns (bool)',
        'function DEFAULT_ADMIN_ROLE() view returns (bytes32)',
        'function owner() view returns (address)'
    ]);

    // --- 2. Check DEFAULT_ADMIN_ROLE (0x00...00) ---
    const DEFAULT_ADMIN = '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`;
    console.log(`\n👑 Checking DEFAULT_ADMIN_ROLE (0x00...00):`);
    
    let adminFound = false;

    for (const k of keysToCheck) {
        try {
            const isAdmin = await publicClient.readContract({
                address: registryAddr, abi: registryAbi, functionName: 'hasRole', args: [DEFAULT_ADMIN, k.account.address]
            });
            
            if (isAdmin) {
                console.log(`   ✅ MATCH! ${k.name} IS AN ADMIN!`);
                adminFound = true;
            } else {
                console.log(`     ${k.name.padEnd(20)}: ❌ NO`);
            }
        } catch (e: any) {
             console.log(`     ${k.name.padEnd(20)}: ⚠️ Error (Revert?) - ${e.shortMessage || e.message}`);
        }
    }

    // --- 3. Check Owner (Fallback) ---
    console.log(`\n🏠 Checking Contract Owner:`);
    try {
        const owner = await publicClient.readContract({
            address: registryAddr, abi: registryAbi, functionName: 'owner'
        });
        console.log(`   Registry Owner Address: ${owner}`);
        
        const keyOwner = keysToCheck.find(k => k.account.address === owner);
        if (keyOwner) {
            console.log(`   ✅ MATCH! ${keyOwner.name} IS THE OWNER!`);
            adminFound = true;
        } else {
             console.log(`   ❌ No match in provided keys.`);
        }
    } catch (e: any) {
        console.log(`   ⚠️ 'owner()' function not supported or reverted.`);
    }

    if (!adminFound) {
        console.log(`\n🚨 DIAGNOSTIC RESULT: NO ADMIN KEYS FOUND.`);
        console.log(`   The Registry at ${registryAddr} is not controlled by any key in .env.sepolia.`);
    } else {
        console.log(`\n✅ DIAGNOSTIC RESULT: ADMIN KEY FOUND!`);
    }
}

main().catch(console.error);
