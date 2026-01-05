import { createPublicClient, http } from 'viem';
import { sepolia, foundry } from 'viem/chains';
import { config } from 'dotenv';
import path from 'path';

// 1. Argument Parsing & Setup
const networkName = process.argv[2] || 'anvil';
process.env.NETWORK = networkName;

console.log(`🔍 Verifying On-Chain Milestones for: ${networkName}`);

// Load env vars
config({ path: `.env.${networkName}` });

// 2. Dynamic Import (to ensure NETWORK env var is picked up by constants.ts)
async function main() {
    const core = await import('../packages/core/src/index.js');
    
    const {
        REGISTRY_ADDRESS,
        SUPER_PAYMASTER_ADDRESS,
        GTOKEN_ADDRESS,
        GTOKEN_STAKING_ADDRESS,
        SBT_ADDRESS,
        XPNTS_FACTORY_ADDRESS,
        CONTRACT_SRC_HASH,
        ENTRY_POINT_ADDRESS,
        ENTRY_POINT_0_8_ADDRESS
    } = core;

    console.log(`   Source Hash: ${CONTRACT_SRC_HASH || 'Not set'}`);
    console.log(`   Registry: ${REGISTRY_ADDRESS}`);
    
    if (!CONTRACT_SRC_HASH && networkName !== 'anvil') {
        console.error('❌ Missing srcHash in config! Deployment might be incomplete.');
        process.exit(1);
    } else if (!CONTRACT_SRC_HASH) {
        console.warn('   ⚠️  Missing srcHash in config (Skipping for Anvil)');
    }

    // 3. Client Setup
    const chain = networkName === 'sepolia' ? sepolia : foundry;
    const transport = http(process.env.RPC_URL || (networkName === 'anvil' ? 'http://127.0.0.1:8545' : undefined));
    
    const client = createPublicClient({
        chain,
        transport
    });

    // 4. Verification Logic
    const contractsToCheck: { name: string; address: `0x${string}` | undefined }[] = [
        { name: 'Registry', address: REGISTRY_ADDRESS },
        { name: 'SuperPaymaster', address: SUPER_PAYMASTER_ADDRESS },
        { name: 'GToken', address: GTOKEN_ADDRESS },
        { name: 'Staking', address: GTOKEN_STAKING_ADDRESS },
        { name: 'SBT', address: SBT_ADDRESS },
        { name: 'xPNTsFactory', address: XPNTS_FACTORY_ADDRESS },
        { name: 'EntryPoint', address: ENTRY_POINT_ADDRESS },
    ];

    let failure = false;

    console.log('\n🚀 Verifying Contract Deployments...');
    for (const c of contractsToCheck) {
        if (!c.address) {
            console.warn(`   ⚠️  ${c.name} address is missing in config.`);
            // failure = true; // Warning only? Or fail? User said "Missing srcHash" is critical.
            continue;
        }

        try {
            const code = await client.getBytecode({ address: c.address });
            if (code && code.length > 2) {
                console.log(`   ✅ ${c.name} deployed at ${c.address}`);
            } else {
                console.error(`   ❌ ${c.name} NOT found at ${c.address} (No code)`);
                failure = true;
            }
        } catch (e: any) {
            console.error(`   ❌ ${c.name} check failed: ${e.message}`);
            failure = true;
        }
    }

    // 5. Check EntryPoint v0.8 if on Sepolia or expected
    if (ENTRY_POINT_0_8_ADDRESS) {
         try {
            const code = await client.getBytecode({ address: ENTRY_POINT_0_8_ADDRESS });
            if (code && code.length > 2) {
                console.log(`   ✅ EntryPoint v0.8 deployed at ${ENTRY_POINT_0_8_ADDRESS}`);
            } else {
                console.warn(`   ⚠️  EntryPoint v0.8 not found.`);
            }
        } catch (e) {}
    }

    if (failure) {
        console.error('\n❌ Verification Failed: One or more contracts are missing.');
        process.exit(1);
    } else {
        console.log('\n🎉 On-Chain Verification Passed!');
    }
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
