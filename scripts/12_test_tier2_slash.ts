import { 
    createPublicClient, 
    createWalletClient, 
    http, 
    parseEther, 
    encodeAbiParameters,
    type Hex,
    keccak256,
    toBytes
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import { anvil } from 'viem/chains';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.anvil') });

const loadAbi = (name: string) => {
    const abiPath = path.resolve(__dirname, `../abis/${name}.abi.json`);
    if (!fs.existsSync(abiPath)) throw new Error(`ABI not found: ${abiPath}`);
    return JSON.parse(fs.readFileSync(abiPath, 'utf-8'));
};

const RegistryABI = loadAbi('Registry');
const StakingABI = loadAbi('GTokenStaking');
const GTokenABI = loadAbi('GToken');

// Configuration
const ANVIL_RPC = process.env.RPC_URL || 'http://127.0.0.1:8545';
const REGISTRY_ADDR = (process.env.REGISTRY_ADDR || '0xf2cb3cfa36bfb95e0fd855c1b41ab19c517fcdb9') as Hex;
const STAKING_ADDR = (process.env.STAKING_ADDR || '0x5147c5c1cb5b5d3f56186c37a4bcfbb3cd0bd5a7') as Hex;
const GTOKEN_ADDR = (process.env.GTOKEN_ADDR || '0x364c7188028348566e38d762f6095741c49f492b') as Hex;
const ADMIN_KEY = process.env.DEPLOYER_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'; // Anvil Account #0

const ROLE_COMMUNITY = keccak256(toBytes("COMMUNITY"));

async function main() {
    console.log(`\n🛡️  Starting Phase 5: Tier 2 (GToken Stake) Slashing Test 🛡️\n`);

    const publicClient = createPublicClient({ chain: anvil, transport: http(ANVIL_RPC) });
    const adminAccount = privateKeyToAccount(ADMIN_KEY as Hex);
    const adminWallet = createWalletClient({ account: adminAccount, chain: anvil, transport: http(ANVIL_RPC) });

    // Test User "Frank"
    const FRANK_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'; // Anvil Account #5
    const frankAccount = privateKeyToAccount(FRANK_KEY);
    const frankWallet = createWalletClient({ account: frankAccount, chain: anvil, transport: http(ANVIL_RPC) });

    console.log(`👤 Frank (Operator -> Community): ${frankAccount.address}`);
    
    // 1. Mint GToken & Register
    const stakeAmount = parseEther("10"); // Community min stake usually higher? Deployment uses 10. Let's send enough.
    const funding = parseEther("100");
    
    console.log(`   💰 Minting GToken to Frank...`);
    await adminWallet.writeContract({
        address: GTOKEN_ADDR, abi: GTokenABI, functionName: 'mint',
        args: [frankAccount.address, funding]
    });

    console.log(`   📝 Registering Frank as Community...`);
    await frankWallet.writeContract({
        address: GTOKEN_ADDR, abi: GTokenABI, functionName: 'approve',
        args: [STAKING_ADDR, funding] // Approve all
    });
    
    // Encode CommunityRoleData
    // struct CommunityRoleData { string name; string ensName; string website; string description; string logoURI; uint256 stakeAmount; }
    // Randomize name to avoid "Name taken" errors in persistent env
    const randId = Math.floor(Math.random() * 10000);
    const commName = `Frank Community ${randId}`;
    const commEns = `frank${randId}.eth`;

    const roleData = encodeAbiParameters(
        [
            { type: 'string' },
            { type: 'string' },
            { type: 'string' },
            { type: 'string' },
            { type: 'string' },
            { type: 'uint256' }
        ],
        [commName, commEns, "https://frank.com", "Test Community", "", stakeAmount]
    );

    await frankWallet.writeContract({
        address: REGISTRY_ADDR, abi: RegistryABI, functionName: 'registerRole',
        args: [ROLE_COMMUNITY, frankAccount.address, roleData]
    });
    console.log(`   ✅ Registered.`);

    // 2. Authorize Admin as DVT Slasher (if not already)
    const isSlasher = await publicClient.readContract({
        address: STAKING_ADDR, abi: StakingABI, functionName: 'authorizedSlashers', args: [adminAccount.address]
    });
    if (!isSlasher) {
        console.log(`   🔧 Authorizing Admin as DVT Slasher...`);
        await adminWallet.writeContract({
            address: STAKING_ADDR, abi: StakingABI, functionName: 'setSlasher',
            args: [adminAccount.address, true]
        });
    }

    // 3. Execute Slash via GTokenStaking.slashByDVT
    const slashAmount = parseEther("1");
    console.log(`   ⚔️  Executing slashByDVT (Tier 2) on Frank for ${slashAmount}...`);
    
    const tx = await adminWallet.writeContract({
        address: STAKING_ADDR, abi: StakingABI, functionName: 'slashByDVT',
        args: [frankAccount.address, ROLE_COMMUNITY, slashAmount, "0x"] // 0x proof
    });
    await publicClient.waitForTransactionReceipt({ hash: tx });
    console.log(`   ✅ Slash Transaction Confirmed.`);

    // 4. Verify Balance
    const stakeInfo = await publicClient.readContract({
        address: STAKING_ADDR, abi: StakingABI, functionName: 'getStakeInfo',
        args: [frankAccount.address, ROLE_COMMUNITY]
    }) as [bigint, bigint, bigint, bigint, string];
    // [amount, slashedAmount, lockedAt, lockDuration, metadata]

    console.log(`   📊 Stake Info: Amount=${stakeInfo[0]}, Slashed=${stakeInfo[1]}`);

    if (stakeInfo[1] === slashAmount) {
        console.log(`   ✅ Verification Passed: Slashed amount matches.`);
    } else {
        console.error(`   ❌ Verification Failed! Expected ${slashAmount}, got ${stakeInfo[1]}`);
        process.exit(1);
    }
    
    console.log(`\n🎉 Tier 2 Slash Test Complete.`);
}

main().catch(console.error);
