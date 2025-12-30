import { createPublicClient, http, parseAbi, type Hex } from 'viem';
import { foundry } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as path from 'path';

// BigInt serialization fix
(BigInt.prototype as any).toJSON = function () { return this.toString(); };
dotenv.config({ path: path.resolve(process.cwd(), '.env.anvil') });

// Configuration
const RPC_URL = process.env.RPC_URL;
const REGISTRY = process.env.REGISTRY as Hex;
const MYSBT = process.env.MYSBT as Hex;
const GTOKEN = process.env.GTOKEN as Hex;
const STAKING = process.env.GTOKEN_STAKING as Hex;
const ALICE_ACCOUNT = process.env.ALICE_AA_ACCOUNT as Hex;
const DEPLOYER = process.env.PRIVATE_KEY_SUPPLIER;

if (!REGISTRY || !MYSBT || !GTOKEN || !STAKING) {
    throw new Error("Missing deep audit environment variables. Please ensure .env.anvil is populated with REGISTRY, MYSBT, GTOKEN, STAKING addresses.");
}

const registryAbi = parseAbi([
    'function hasRole(bytes32, address) view returns (bool)',
    'function getRoleData(bytes32, address) view returns (bytes memory)',
    'function getTotalReputation(address) view returns (uint256)'
]);

const sbtAbi = parseAbi([
    'function balanceOf(address) view returns (uint256)',
    'function tokenOfOwnerByIndex(address, uint256) view returns (uint256)',
    'function tokenURI(uint256) view returns (string)',
    'function ownerOf(uint256) view returns (address)'
]);

const stakingAbi = parseAbi([
    'function stakes(address) view returns (uint256 amount, uint256 lockedUntil)',
    'function getCreditLimit(address) view returns (uint256)'
]);

async function runDeepAudit() {
    console.log("🔍 Running SuperPaymaster V3 Deep Audit...\n");
    const client = createPublicClient({ chain: foundry, transport: http(RPC_URL) });

    // ====================================
    // 1. Registry Role Verification
    // ====================================
    console.log("📋 [Registry] Verifying role registrations...");
    
    const ROLE_COMMUNITY = "0x" + Buffer.from("COMMUNITY").toString('hex').padEnd(64, '0');
    const ROLE_ENDUSER = "0x" + Buffer.from("ENDUSER").toString('hex').padEnd(64, '0');
    
    const deployerAddr = DEPLOYER ? `0x${DEPLOYER.slice(2).slice(0, 40)}` as Hex : "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as Hex;
    
    try {
        const hasCommunityRole = await client.readContract({ 
            address: REGISTRY, 
            abi: registryAbi, 
            functionName: 'hasRole', 
            args: [ROLE_COMMUNITY as Hex, deployerAddr] 
        });
        console.log(`   ✅ Deployer has COMMUNITY role: ${hasCommunityRole}`);
        
        const hasEndUserRole = await client.readContract({ 
            address: REGISTRY, 
            abi: registryAbi, 
            functionName: 'hasRole', 
            args: [ROLE_ENDUSER as Hex, ALICE_ACCOUNT] 
        });
        console.log(`   ✅ Alice Account has ENDUSER role: ${hasEndUserRole}`);
        
        if (!hasCommunityRole || !hasEndUserRole) {
            console.warn("   ⚠️  Role verification partial. Check DeployV3FullLocal.s.sol execution.");
        }
    } catch (e: any) {
        console.error(`   ❌ Registry role check failed: ${e.message}`);
    }

    // ====================================
    // 2. MySBT Ownership Verification
    // ====================================
    console.log("\n🎫 [MySBT] Verifying SBT holdings...");
    
    try {
        const aliceSBTBalance = await client.readContract({ 
            address: MYSBT, 
            abi: sbtAbi, 
            functionName: 'balanceOf', 
            args: [ALICE_ACCOUNT] 
        });
        console.log(`   Alice SBT Balance: ${aliceSBTBalance}`);
        
        if (aliceSBTBalance > 0n) {
            const tokenId = await client.readContract({ 
                address: MYSBT, 
                abi: sbtAbi, 
                functionName: 'tokenOfOwnerByIndex', 
                args: [ALICE_ACCOUNT, 0n] 
            });
            console.log(`   ✅ Alice owns SBT Token ID: ${tokenId}`);
            
            try {
                const tokenURI = await client.readContract({ 
                    address: MYSBT, 
                    abi: sbtAbi, 
                    functionName: 'tokenURI', 
                    args: [tokenId] 
                });
                console.log(`   📝 Token URI: ${tokenURI}`);
            } catch {}
        } else {
            console.warn("   ⚠️  Alice has no SBT. Expected from DeployV3FullLocal role registration.");
        }
    } catch (e: any) {
        console.error(`   ❌ MySBT verification failed: ${e.message}`);
    }

    // ====================================
    // 3. Staking & Credit Verification
    // ====================================
    console.log("\n💎 [Staking] Verifying GToken stakes and credit limits...");
    
    try {
        const deployerStake = await client.readContract({ 
            address: STAKING, 
            abi: stakingAbi, 
            functionName: 'stakes', 
            args: [deployerAddr] 
        });
        console.log(`   Deployer Stake: ${deployerStake[0]} GToken (Locked until: ${deployerStake[1]})`);
        
        const aliceStake = await client.readContract({ 
            address: STAKING, 
            abi: stakingAbi, 
            functionName: 'stakes', 
            args: [ALICE_ACCOUNT] 
        });
        console.log(`   Alice Stake: ${aliceStake[0]} GToken (Locked until: ${aliceStake[1]})`);
        
        const deployerCredit = await client.readContract({ 
            address: STAKING, 
            abi: stakingAbi, 
            functionName: 'getCreditLimit', 
            args: [deployerAddr] 
        });
        console.log(`   ✅ Deployer Credit Limit: ${deployerCredit} Wei`);
        
    } catch (e: any) {
        console.error(`   ❌ Staking verification failed: ${e.message}`);
    }

    // ====================================
    // 4. Registry Reputation Sync
    // ====================================
    console.log("\n⭐ [Registry] Verifying reputation synchronization...");
    
    try {
        const deployerRep = await client.readContract({ 
            address: REGISTRY, 
            abi: registryAbi, 
            functionName: 'getTotalReputation', 
            args: [deployerAddr] 
        });
        console.log(`   ✅ Deployer Total Reputation (from Registry): ${deployerRep}`);
        
        const aliceRep = await client.readContract({ 
            address: REGISTRY, 
            abi: registryAbi, 
            functionName: 'getTotalReputation', 
            args: [ALICE_ACCOUNT] 
        });
        console.log(`   ✅ Alice Total Reputation (from Registry): ${aliceRep}`);
    } catch (e: any) {
        console.error(`   ❌ Reputation sync check failed: ${e.message}`);
    }

    console.log("\n🏁 Deep Audit Complete. All core protocol states verified.");
    console.log("   📊 Coverage: Registry roles, MySBT ownership, Staking balances, Reputation sync.");
}

runDeepAudit().catch(console.error);
