
import { 
    createPublicClient, 
    createWalletClient, 
    http, 
    keccak256, 
    toBytes, 
    encodeAbiParameters, 
    type Hex,
    toHex,
    parseEther
} from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { anvil } from 'viem/chains';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

(BigInt.prototype as any).toJSON = function () { return this.toString(); };

dotenv.config({ path: path.resolve(process.cwd(), '.env.v3') });

const loadAbi = (name: string) => {
    const abiPath = path.resolve(__dirname, `../abis/${name}.json`);
    if (!fs.existsSync(abiPath)) throw new Error(`ABI not found: ${abiPath}`);
    return JSON.parse(fs.readFileSync(abiPath, 'utf-8'));
};

const RegistryABI = loadAbi('Registry');
const GTokenABI = loadAbi('GToken');
const GTokenStakingABI = loadAbi('GTokenStaking');
const SuperPaymasterABI = loadAbi('SuperPaymaster');

const ROLE_ENDUSER = keccak256(toBytes('ENDUSER'));
const ANVIL_RPC = 'http://127.0.0.1:8545';

const waitForTx = async (client: any, hash: Hex) => {
    const receipt = await client.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') throw new Error(`Tx Failed: ${hash}`);
    return receipt;
};

async function main() {
    console.log('\n⚔️  Starting Phase 5: Slash Mechanism Test (Tier 1 & 2) ⚔️\n');

    const publicClient = createPublicClient({ chain: anvil, transport: http(ANVIL_RPC) });
    const REGISTRY_ADDR = process.env.REGISTRY_ADDRESS as Hex;
    const GTOKEN_ADDR = process.env.GTOKEN_ADDRESS as Hex;
    const STAKING_ADDR = process.env.GTOKEN_STAKING as Hex;
    const PAYMASTER_ADDR = process.env.PAYMASTER_ADDRESS as Hex;

    const ADMIN_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'; 
    const adminWallet = createWalletClient({ account: privateKeyToAccount(ADMIN_KEY as Hex), chain: anvil, transport: http(ANVIL_RPC) });
    const adminAddr = adminWallet.account.address;

    // --- TIER 1: SuperPaymaster Slash (aPNTs) ---
    console.log(`\n🛡️  Tier 1: aPNTs Slashing...`);
    
    // Admin is already the owner.
    // Set Admin as BLS Aggregator to trigger slashing tests.
    console.log(`   🔧 Setting Admin as BLS Aggregator...`);
    await waitForTx(publicClient, await adminWallet.writeContract({
        address: PAYMASTER_ADDR, abi: SuperPaymasterABI, functionName: 'setBLSAggregator', args: [adminAddr]
    }));

    // Test Operator (Admin itself for simplicity, or we can use another)
    const operator = adminAddr;

    console.log("   🔍 Checking Roles for Operator...");
    // 0. Ensure Prerequisite Roles
    const ROLE_PAYMASTER_SUPER = keccak256(toBytes('PAYMASTER_SUPER'));
    const hasSuper = await publicClient.readContract({
        address: REGISTRY_ADDR, abi: RegistryABI, functionName: 'hasRole',
        args: [ROLE_PAYMASTER_SUPER, operator]
    });

    if (!hasSuper) {
        console.log("   ⚠️ Missing PAYMASTER_SUPER role. Registering...");
        
        // Fetch Config for Stake
        const config = await publicClient.readContract({
            address: REGISTRY_ADDR, abi: RegistryABI, functionName: 'roleConfigs', args: [ROLE_PAYMASTER_SUPER]
        }) as unknown as any[];
        const stakeNeeded = (config[1] as bigint) + (config[3] as bigint);

        // Mint & Approve GTokens
        console.log(`   💰 Minting & Approving ${Number(stakeNeeded)} GTokens...`);
        await waitForTx(publicClient, await adminWallet.writeContract({
            address: GTOKEN_ADDR, abi: GTokenABI, functionName: 'mint', args: [operator, stakeNeeded]
        }));
        await waitForTx(publicClient, await adminWallet.writeContract({
            address: GTOKEN_ADDR, abi: GTokenABI, functionName: 'approve', args: [STAKING_ADDR, stakeNeeded]
        }));

        // Register
        await waitForTx(publicClient, await adminWallet.writeContract({
            address: REGISTRY_ADDR, abi: RegistryABI, functionName: 'registerRoleSelf', 
            args: [ROLE_PAYMASTER_SUPER, "0x"]
        }));
        console.log("   ✅ Registered PAYMASTER_SUPER.");
    } else {
        console.log("   ✅ Operator already has PAYMASTER_SUPER role.");
    }
    
    // Increase balance first
    console.log(`   💰 Depositing aPNTs...`);
    await waitForTx(publicClient, await adminWallet.writeContract({
        address: PAYMASTER_ADDR, abi: SuperPaymasterABI, functionName: 'deposit', args: [], value: 100000000000000000n // 0.1 ETH
    }));

    const opInfoBefore = await publicClient.readContract({
        address: PAYMASTER_ADDR, abi: SuperPaymasterABI, functionName: 'operators', args: [operator]
    }) as any[];
    const balBefore = opInfoBefore[0]; // aPNTsBalance is at index 0 in V3.2
    console.log(`   📊 Operator Balance Before: ${balBefore}`);

    // Slash MINOR (10%)
    console.log(`   ⚔️  Executing MINOR Slash (10%)...`);
    await waitForTx(publicClient, await adminWallet.writeContract({
        address: PAYMASTER_ADDR, abi: SuperPaymasterABI, functionName: 'executeSlashWithBLS', args: [operator, 1, keccak256(toBytes("Minor violation"))] // Using hash as proof
    }));

    const opInfoAfter = await publicClient.readContract({
        address: PAYMASTER_ADDR, abi: SuperPaymasterABI, functionName: 'operators', args: [operator]
    }) as any[];
    const balAfter = opInfoAfter[0];
    console.log(`   📊 Operator Balance After: ${balAfter}`);

    if (balAfter === (balBefore * 90n) / 100n) {
        console.log(`   ✅ Tier 1 MINOR Slash correctly applied (10%).`);
    } else {
        console.warn(`   ⚠️ Tier 1 Slash unexpected result. Bal: ${balAfter}`);
    }

    // --- TIER 2: GTokenStaking Slash (Stake) ---
    console.log(`\n🛡️  Tier 2: GToken Stake Slashing...`);

    // Setup Dave for Stake Slashing
    const daveKey = generatePrivateKey();
    const daveAccount = privateKeyToAccount(daveKey);
    const daveWallet = createWalletClient({ account: daveAccount, chain: anvil, transport: http(ANVIL_RPC) });
    console.log(`👤 Dave (Operator): ${daveAccount.address}`);
    // Fund Dave via setBalance for absolute reliability
    await (adminWallet as any).request({ method: 'anvil_setBalance', params: [daveAccount.address, toHex(parseEther("100.0"))] });
    console.log(`   ✅ Dave funded with 100 ETH via setBalance`);
    
    const stakeAmount = 400000000000000000n; // 0.4 ether
    await waitForTx(publicClient, await adminWallet.writeContract({
        address: GTOKEN_ADDR, abi: GTokenABI, functionName: 'mint', args: [daveAccount.address, stakeAmount + 100000000000000000n]
    }));
    await waitForTx(publicClient, await daveWallet.writeContract({
        address: GTOKEN_ADDR, abi: GTokenABI, functionName: 'approve', args: [STAKING_ADDR, stakeAmount + 100000000000000000n]
    }));

    const commAddr = adminAddr;
    const daveData = encodeAbiParameters(
        [{ type: 'tuple', components: [
            { name: 'account', type: 'address' },
            { name: 'community', type: 'address' },
            { name: 'avatarURI', type: 'string' },
            { name: 'ensName', type: 'string' },
            { name: 'stakeAmount', type: 'uint256' }
        ]}],
        [{ account: daveAccount.address, community: commAddr, avatarURI: "ipfs://dave", ensName: "dave.c", stakeAmount: stakeAmount }]
    );

    console.log(`   📝 Registering Dave...`);
    await waitForTx(publicClient, await daveWallet.writeContract({
        address: REGISTRY_ADDR, abi: RegistryABI, functionName: 'registerRoleSelf', args: [ROLE_ENDUSER, daveData]
    }));

    // Authorize Admin as Slasher
    console.log(`   🔧 Authorizing Admin as DVT Slasher...`);
    await waitForTx(publicClient, await adminWallet.writeContract({
        address: STAKING_ADDR, abi: GTokenStakingABI, functionName: 'setAuthorizedSlasher', args: [adminAddr, true]
    }));

    const slashPenalty = 100000000000000000n; // 0.1 ether
    console.log(`   ⚔️  Slashing Dave for ${slashPenalty}...`);
    await waitForTx(publicClient, await adminWallet.writeContract({
        address: STAKING_ADDR, abi: GTokenStakingABI, functionName: 'slashByDVT', args: [daveAccount.address, ROLE_ENDUSER, slashPenalty, "Critical misbehavior"]
    }));

    const info = await publicClient.readContract({
        address: STAKING_ADDR, abi: GTokenStakingABI, functionName: 'getStakeInfo', args: [daveAccount.address, ROLE_ENDUSER]
    }) as any;
    console.log(`   📊 Dave Stake Info: Amount=${info.amount}, Slashed=${info.slashedAmount}`);

    if (info.amount === stakeAmount - slashPenalty) {
        console.log(`   ✅ Tier 2 Stake Slash correctly applied.`);
    } else {
        console.error(`   ❌ Tier 2 Slash verification failed! Amount=${info.amount}, Expected=${stakeAmount - slashPenalty}`);
    }

    console.log(`\n🎉 Slash Mechanism Test Complete.`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
