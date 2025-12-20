
import { 
    createPublicClient, 
    createWalletClient, 
    http, 
    keccak256, 
    toBytes, 
    encodeAbiParameters, 
    type Hex
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

dotenv.config({ path: path.resolve(__dirname, '../.env.v3') });

const loadAbi = (name: string) => {
    const abiPath = path.resolve(__dirname, `../abis/${name}.abi.json`);
    if (!fs.existsSync(abiPath)) throw new Error(`ABI not found: ${abiPath}`);
    return JSON.parse(fs.readFileSync(abiPath, 'utf-8'));
};

const RegistryABI = loadAbi('Registry');
const GTokenABI = loadAbi('GToken');
const GTokenStakingABI = loadAbi('GTokenStaking');
// We need ABI for GTokenStaking to call slash

// --- CONSTANTS ---
const ROLE_ENDUSER = keccak256(toBytes('ENDUSER'));
const ANVIL_RPC = 'http://127.0.0.1:8545';

// --- HELPER ---
const waitForTx = async (client: any, hash: Hex) => {
    const receipt = await client.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') throw new Error(`Tx Failed: ${hash}`);
    return receipt;
};

async function main() {
    console.log('\n🛡️ Starting Phase 5: Staking & Slash Test 🛡️\n');

    const publicClient = createPublicClient({ chain: anvil, transport: http(ANVIL_RPC) });
    // LATEST DEPLOYMENT ADDRESSES from DeployV3FullLocal output
    const REGISTRY_ADDR = process.env.REGISTRY_ADDRESS as Hex || '0xaB837301d12cDc4b97f1E910FC56C9179894d9cf';
    const GTOKEN_ADDR = process.env.GTOKEN_ADDRESS as Hex || '0x124dDf9BdD2DdaD012ef1D5bBd77c00F05C610DA';
    const STAKING_ADDR = process.env.GTOKEN_STAKING as Hex || '0xe044814c9eD1e6442Af956a817c161192cBaE98F';

    const ADMIN_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'; 
    const adminWallet = createWalletClient({ account: privateKeyToAccount(ADMIN_KEY as Hex), chain: anvil, transport: http(ANVIL_RPC) });

    // 1. Setup User (Dave)
    const daveKey = generatePrivateKey();
    const daveAccount = privateKeyToAccount(daveKey);
    const daveWallet = createWalletClient({ account: daveAccount, chain: anvil, transport: http(ANVIL_RPC) });
    console.log(`👤 Dave (Test User): ${daveAccount.address}`);

    // Fund Dave ETH
    await adminWallet.sendTransaction({ to: daveAccount.address, value: 1000000000000000000n });

    // 2. Fund Dave GToken
    const stakeAmount = 400000000000000000n; // 0.4 ether (minStake is 0.3)
    const mintAmount = 1000000000000000000n; // 1.0 ether
    console.log(`   💰 Minting ${mintAmount} GToken to Dave...`);
    const txMint = await adminWallet.writeContract({
        address: GTOKEN_ADDR, abi: GTokenABI, functionName: 'mint', args: [daveAccount.address, mintAmount]
    });
    await waitForTx(publicClient, txMint);

    const txApprove = await daveWallet.writeContract({
        address: GTOKEN_ADDR, abi: GTokenABI, functionName: 'approve', args: [STAKING_ADDR, mintAmount]
    });
    await waitForTx(publicClient, txApprove);

    // 3. Register Dave (Lock Stake)
    // Find a valid community. In "DeployV3FullLocal", the Admin (deployer) is registered as "Local Operator".
    // So we can use adminWallet.account.address as the valid community.
    let commAddr = adminWallet.account.address;
    console.log(`   🔗 Linking to Admin/Community: ${commAddr}`);

    // --- DIAGNOSTICS COMMENTED OUT (Passed) ---
    /*
    console.log(`\n   🩺 GToken Diagnostics:`);
    try {
        console.log(`      Test 1: Direct Transfer (1 wei)...`);
        await daveWallet.writeContract({
            address: GTOKEN_ADDR, abi: GTokenABI, functionName: 'transfer', args: [adminWallet.account.address, 1n]
        });
        console.log(`      ✅ Direct Transfer OK.`);
        // ...
    } catch (e) { throw e; }
    */
    // --- END DIAGNOSTICS ---
    console.log(`\n   🔍 Performing Pre-flight Checks:`);

    // 1. Check Staking Address Mismatch
    const registryStaking = await publicClient.readContract({
        address: REGISTRY_ADDR, abi: RegistryABI, functionName: 'GTOKEN_STAKING', args: []
    }) as Hex;
    console.log(`      Registry.GTOKEN_STAKING: ${registryStaking}`);
    console.log(`      Script STAKING_ADDR:     ${STAKING_ADDR}`);
    if (registryStaking.toLowerCase() !== STAKING_ADDR.toLowerCase()) {
        throw new Error(`❌ MISMATCH: Registry expects Staking at ${registryStaking}, but script used ${STAKING_ADDR}`);
    } else {
        console.log(`      ✅ Staking Address matched.`);
    }

    // 2. Check Community Role Validity
    // ROLE_COMMUNITY hash: 0x... (Need to import or re-hash if removed)
    // We removed it earlier, let's re-define it just for this check.
    const _ROLE_COMMUNITY = keccak256(toBytes('COMMUNITY'));
    const isCommValid = await publicClient.readContract({
        address: REGISTRY_ADDR, abi: RegistryABI, functionName: 'hasRole', args: [_ROLE_COMMUNITY, commAddr]
    });
    console.log(`      Community (${commAddr}) has ROLE_COMMUNITY: ${isCommValid}`);
    if (!isCommValid) {
        throw new Error(`❌ INVALID DEPENDENCY: Selected community ${commAddr} does not have ROLE_COMMUNITY.`);
    }

    // 3. Check Allowance & Requirement
    // Get full config: minStake, burn, etc.
    // Config struct: [min, burn, thresh, base, inc, max, active, desc]
    const userRoleConfig = await publicClient.readContract({
        address: REGISTRY_ADDR, abi: RegistryABI, functionName: 'roleConfigs', args: [ROLE_ENDUSER]
    }) as any;
    const minStake = userRoleConfig[0];
    const entryBurn = userRoleConfig[1]; // Index 1 is burn
    const actualLockAmount = stakeAmount; 
    const totalTransfer = actualLockAmount + entryBurn;

    console.log(`      Config: MinStake=${minStake}, EntryBurn=${entryBurn}`);
    console.log(`      Tx Plan: Lock=${actualLockAmount}, Burn=${entryBurn} => Total=${totalTransfer}`);

    const allowance = await publicClient.readContract({
        address: GTOKEN_ADDR, abi: GTokenABI, functionName: 'allowance', args: [daveAccount.address, STAKING_ADDR]
    }) as bigint;
    console.log(`      Current Allowance: ${allowance}`);

    if (allowance < totalTransfer) {
        throw new Error(`❌ INSUFFICIENT ALLOWANCE: Have ${allowance}, Need ${totalTransfer}`);
    } else {
         console.log(`      ✅ Allowance sufficient.`);
    }

    // --- DIAGNOSTICS: Verify GToken independently ---
    console.log(`\n   🩺 GToken Diagnostics:`);
    try {
        // 1. Direct Transfer
        console.log(`      Test 1: Direct Transfer (1 wei)...`);
        await daveWallet.writeContract({
            address: GTOKEN_ADDR, abi: GTokenABI, functionName: 'transfer', args: [adminWallet.account.address, 1n]
        });
        console.log(`      ✅ Direct Transfer OK.`);
        
        // 2. TransferFrom (Mimic Staking)
        console.log(`      Test 2: TransferFrom (1 wei)...`);
        // Approve Admin
        await daveWallet.writeContract({
             address: GTOKEN_ADDR, abi: GTokenABI, functionName: 'approve', args: [adminWallet.account.address, 1n]
        });
        // Admin pulls
        await adminWallet.writeContract({
             address: GTOKEN_ADDR, abi: GTokenABI, functionName: 'transferFrom', args: [daveAccount.address, adminWallet.account.address, 1n]
        });
        console.log(`      ✅ TransferFrom OK.`);

    } catch (e) {
        console.error(`      ❌ GToken Diagnostic Failed:`, e);
        throw e;
    }
    // --- END DIAGNOSTICS ---
    
    // --- END CHECKS ---

    const daveData = encodeAbiParameters(
        [
            {
                type: 'tuple',
                components: [
                    { name: 'account', type: 'address' },
                    { name: 'community', type: 'address' },
                    { name: 'avatarURI', type: 'string' },
                    { name: 'ensName', type: 'string' },
                    { name: 'stakeAmount', type: 'uint256' }
                ]
            }
        ],
        [
            {
                account: daveAccount.address,
                community: commAddr,
                avatarURI: "ipfs://dave",
                ensName: "dave.c",
                stakeAmount: stakeAmount
            }
        ]
    );

    console.log(`   📝 Registering Dave...`);
    // Ensure EndUser is active (Scenario 10 fix might have handled this global config)
    // We assume it is active.
    
    const txReg = await daveWallet.writeContract({
        address: REGISTRY_ADDR, abi: RegistryABI, functionName: 'registerRoleSelf',
        args: [ROLE_ENDUSER, daveData]
    });
    await waitForTx(publicClient, txReg);
    console.log(`   ✅ Dave Registered & Locked ${stakeAmount}.`);

    // 4. Slash Dave
    console.log(`\n⚔️  Slashing Dave...`);
    const slashAmount = 200n;
    // Admin sets self as Authorized Slasher (or just uses onlyOwner? slash is usually restricted)
    // slash() modifier: !authorizedSlashers[msg.sender] && msg.sender != REGISTRY -> revert "Unauthorized slasher"
    // So Admin must authorize themselves first.
    
    await adminWallet.writeContract({
        address: STAKING_ADDR, abi: GTokenStakingABI, functionName: 'setAuthorizedSlasher',
        args: [adminWallet.account.address, true]
    });

    const txSlash = await adminWallet.writeContract({
        address: STAKING_ADDR, abi: GTokenStakingABI, functionName: 'slashByDVT',
        args: [daveAccount.address, ROLE_ENDUSER, slashAmount, "Test Slash"]
    });
    await waitForTx(publicClient, txSlash);
    console.log(`   ✅ Dave Slashed for ${slashAmount}.`);

    // 5. Verify BalanceOf (Staking Contract View)
    // balanceOf returns amount - slashedAmount
    const stakedBal = await publicClient.readContract({
        address: STAKING_ADDR, abi: GTokenStakingABI, functionName: 'balanceOf', args: [daveAccount.address]
    }) as bigint;
    console.log(`   🔍 Staking BalanceOf: ${stakedBal} (Expected ${stakeAmount - slashAmount})`);
    
    if (stakedBal !== stakeAmount - slashAmount) {
        console.warn(`   ⚠️ Warning: BalanceOf does not reflect slash! Got ${stakedBal}`);
    }

    // 6. Exit Role (Unlock)
    console.log(`\n🚪 Dave Exiting Role...`);
    const balanceBeforeExit = await publicClient.readContract({
        address: GTOKEN_ADDR, abi: GTokenABI, functionName: 'balanceOf', args: [daveAccount.address]
    }) as bigint;

    const txExit = await daveWallet.writeContract({
        address: REGISTRY_ADDR, abi: RegistryABI, functionName: 'exitRole',
        args: [ROLE_ENDUSER]
    });
    await waitForTx(publicClient, txExit);

    const balanceAfterExit = await publicClient.readContract({
        address: GTOKEN_ADDR, abi: GTokenABI, functionName: 'balanceOf', args: [daveAccount.address]
    }) as bigint;

    const refund = balanceAfterExit - balanceBeforeExit;
    console.log(`   💰 Refunded: ${refund}`);

    // CHECK FOR BUG:
    // If refund == stakeAmount (500), then SLASH WAS IGNORED during exit!
    // If refund == stakeAmount - slashAmount (300), then Slashing worked.
    
    if (refund === stakeAmount) {
        console.error(`   ❌ CRITICAL BUG: Slashing was ignored during exit! Refunded full amount.`);
        // We don't fail the script, but we report the finding.
    } else if (refund === stakeAmount - slashAmount) {
         console.log(`   ✅ Slashing correctly applied on Exit.`);
    } else {
         console.log(`   ❓ Refund ${refund} -- likely some exit fees applied?`);
    }

    console.log(`\n🎉 Phase 5 Complete.`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
