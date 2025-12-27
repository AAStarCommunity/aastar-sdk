import { createPublicClient, http, parseAbi } from 'viem';
import { foundry } from 'viem/chains';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.v3' });

const client = createPublicClient({ chain: foundry, transport: http() });

async function main() {
    console.log('🔍 Environment Configuration Validation\n');
    
    const REGISTRY = process.env.REGISTRY_ADDRESS as `0x${string}`;
    const GTOKEN = process.env.GTOKEN_ADDRESS as `0x${string}`;
    const GTOKEN_STAKING = process.env.GTOKENSTAKING_ADDRESS as `0x${string}`;
    const SUPER_PAYMASTER = process.env.SUPER_PAYMASTER as `0x${string}`;
    const APNTS = process.env.APNTS_ADDRESS as `0x${string}`;
    const MYSBT = process.env.MYSBT_ADDRESS as `0x${string}`;

    let hasError = false;

    // 1. Registry → GTokenStaking
    console.log('1️⃣  Checking Registry → GTokenStaking...');
    try {
        const registryStaking = await client.readContract({
            address: REGISTRY,
            abi: parseAbi(['function GTOKEN_STAKING() view returns (address)']),
            functionName: 'GTOKEN_STAKING'
        });
        if ((registryStaking as string).toLowerCase() !== (GTOKEN_STAKING || "").toLowerCase()) {
            console.error(`   ❌ MISMATCH!`);
            console.error(`      .env: ${GTOKEN_STAKING}`);
            console.error(`      Registry: ${registryStaking}`);
            hasError = true;
        } else {
            console.log(`   ✅ Match: ${GTOKEN_STAKING}`);
        }
    } catch (e) {
        console.error(`   ❌ Failed to read GTOKEN_STAKING from Registry: ${e instanceof Error ? e.message : String(e)}`);
        hasError = true;
    }

    // 2. GTokenStaking → GToken
    console.log('\n2️⃣  Checking GTokenStaking → GToken...');
    try {
        const stakingGToken = await client.readContract({
            address: GTOKEN_STAKING,
            abi: parseAbi(['function GTOKEN() view returns (address)']),
            functionName: 'GTOKEN'
        });
        if ((stakingGToken as string).toLowerCase() !== (GTOKEN || "").toLowerCase()) {
            console.error(`   ❌ MISMATCH!`);
            console.error(`      .env: ${GTOKEN}`);
            console.error(`      GTokenStaking: ${stakingGToken}`);
            hasError = true;
        } else {
            console.log(`   ✅ Match: ${GTOKEN}`);
        }
    } catch (e) {
        console.error(`   ❌ Failed to read GTOKEN from Staking: ${e instanceof Error ? e.message : String(e)}`);
        hasError = true;
    }

    // 3. Registry → MySBT
    console.log('\n3️⃣  Checking Registry → MySBT...');
    try {
        const registryMySBT = await client.readContract({
            address: REGISTRY,
            abi: parseAbi(['function MYSBT() view returns (address)']),
            functionName: 'MYSBT'
        });
        if ((registryMySBT as string).toLowerCase() !== (MYSBT || "").toLowerCase()) {
            console.error(`   ❌ MISMATCH!`);
            console.error(`      .env: ${MYSBT}`);
            console.error(`      Registry: ${registryMySBT}`);
            hasError = true;
        } else {
            console.log(`   ✅ Match: ${MYSBT}`);
        }
    } catch (e) {
        console.error(`   ❌ Failed to read MYSBT from Registry: ${e instanceof Error ? e.message : String(e)}`);
        hasError = true;
    }

    // 4. SuperPaymaster → aPNTs
    console.log('\n4️⃣  Checking SuperPaymaster → aPNTs...');
    try {
        const paymasterAPNTs = await client.readContract({
            address: SUPER_PAYMASTER,
            abi: parseAbi(['function APNTS_TOKEN() view returns (address)']),
            functionName: 'APNTS_TOKEN'
        });
        if ((paymasterAPNTs as string).toLowerCase() !== (APNTS || "").toLowerCase()) {
            console.error(`   ❌ MISMATCH!`);
            console.error(`      .env: ${APNTS}`);
            console.error(`      SuperPaymaster: ${paymasterAPNTs}`);
            hasError = true;
        } else {
            console.log(`   ✅ Match: ${APNTS}`);
        }
    } catch (e) {
        console.error(`   ❌ Failed to read APNTS_TOKEN from Paymaster: ${e instanceof Error ? e.message : String(e)}`);
        hasError = true;
    }

    // 5. SuperPaymaster → Registry
    console.log('\n5️⃣  Checking SuperPaymaster → Registry...');
    try {
        const paymasterRegistry = await client.readContract({
            address: SUPER_PAYMASTER,
            abi: parseAbi(['function REGISTRY() view returns (address)']),
            functionName: 'REGISTRY'
        });
        if ((paymasterRegistry as string).toLowerCase() !== (REGISTRY || "").toLowerCase()) {
            console.error(`   ❌ MISMATCH!`);
            console.error(`      .env: ${REGISTRY}`);
            console.error(`      SuperPaymaster: ${paymasterRegistry}`);
            hasError = true;
        } else {
            console.log(`   ✅ Match: ${REGISTRY}`);
        }
    } catch (e) {
        console.error(`   ❌ Failed to read REGISTRY from Paymaster: ${e instanceof Error ? e.message : String(e)}`);
        hasError = true;
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    if (hasError) {
        console.error('❌ Environment validation FAILED!');
        console.error('   Please update .env.v3 with correct addresses.');
        process.exit(1);
    } else {
        console.log('✅ All addresses validated successfully!');
    }
}

main().catch(console.error);
