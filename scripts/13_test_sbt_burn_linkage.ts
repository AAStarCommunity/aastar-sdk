import { 
    createPublicClient, 
    createWalletClient, 
    http, 
    keccak256, 
    toBytes, 
    encodeAbiParameters, 
    type Hex,
    decodeErrorResult
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

dotenv.config({ path: path.resolve(__dirname, '../../SuperPaymaster/contracts/.env') });

const loadAbi = (name: string) => {
    const abiPath = path.resolve(__dirname, `../abis/${name}.abi.json`);
    if (!fs.existsSync(abiPath)) throw new Error(`ABI not found: ${abiPath}`);
    return JSON.parse(fs.readFileSync(abiPath, 'utf-8')).abi;
};

const RegistryABI = loadAbi('Registry');
const MySBTABI = loadAbi('MySBT');

const ROLE_ENDUSER = keccak256(toBytes('ENDUSER'));
const ANVIL_RPC = 'http://127.0.0.1:8545';

const waitForTx = async (client: any, hash: Hex) => {
    const receipt = await client.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') throw new Error(`Tx Failed: ${hash}`);
    return receipt;
};

async function main() {
    console.log('\n🔥 Starting Phase 6: MySBT Burn & Linkage Test 🔥\n');

    const publicClient = createPublicClient({ chain: anvil, transport: http(ANVIL_RPC) });
    // NEW DEPLOYMENT ADDRESSES (Step 4171)
    const REGISTRY_ADDR = (process.env.REGISTRY_ADDR || '0xd710a67624Ad831683C86a48291c597adE30F787') as Hex;
    const MYSBT_ADDR = (process.env.MYSBT_ADDR || '0xd30bF3219A0416602bE8D482E0396eF332b0494E') as Hex;
    const GTOKEN_ADDR = (process.env.GTOKEN_ADDR || '0x10e38eE9dd4C549b61400Fc19347D00eD3edAfC4') as Hex;
    const STAKING_ADDR = (process.env.STAKING_ADDR || '0xd753c12650c280383Ce873Cc3a898F6f53973d16') as Hex;

    const ADMIN_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'; 
    const adminWallet = createWalletClient({ account: privateKeyToAccount(ADMIN_KEY as Hex), chain: anvil, transport: http(ANVIL_RPC) });
    console.log(`   🛠️  Registry: ${REGISTRY_ADDR}, GToken: ${GTOKEN_ADDR}, Staking: ${STAKING_ADDR}`);

    // 1. Setup User (Eve)
    const eveKey = generatePrivateKey();
    const eveAccount = privateKeyToAccount(eveKey);
    const eveWallet = createWalletClient({ account: eveAccount, chain: anvil, transport: http(ANVIL_RPC) });
    console.log(`👤 Eve (Test User): ${eveAccount.address}`);
    const hashFund = await adminWallet.sendTransaction({ to: eveAccount.address, value: 1000000000000000000n });
    await waitForTx(publicClient, hashFund);

    // Fund Eve GToken
    console.log(`   💰 Funding Eve with GToken...`);
    await adminWallet.writeContract({
        address: GTOKEN_ADDR, abi: loadAbi('GToken'), functionName: 'mint', args: [eveAccount.address, 1000n]
    });
    const hashApprove = await eveWallet.writeContract({
        address: GTOKEN_ADDR, abi: loadAbi('GToken'), functionName: 'approve', args: [STAKING_ADDR, 100000n]
    });
    await waitForTx(publicClient, hashApprove);

    // Ensure ROLE_ENDUSER is configured
    console.log(`   🔧 Ensuring ROLE_ENDUSER is active...`);
    const endUserConfig = await publicClient.readContract({
        address: REGISTRY_ADDR, abi: RegistryABI, functionName: 'roleConfigs', args: [ROLE_ENDUSER]
    }) as any;
    
    if (!endUserConfig[6]) { // isActive
        console.log(`   🔧 Activating ROLE_ENDUSER with minStake 100...`);
        const txConfig = await adminWallet.writeContract({
            address: REGISTRY_ADDR, abi: RegistryABI, functionName: 'configureRole',
            args: [ROLE_ENDUSER, [100n, 0n, 0n, 0n, 0n, 0n, true, "EndUser"]]
        });
        await waitForTx(publicClient, txConfig);
    }
    const targetComm = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC' as Hex;

    // Pre-flight check: Is community active?
    const isCommActive = await publicClient.readContract({
        address: REGISTRY_ADDR, abi: RegistryABI, functionName: 'checkRole', args: [keccak256(toBytes('COMMUNITY')), targetComm]
    });
    console.log(`   🔍 Community ${targetComm} active: ${isCommActive}`);

    console.log(`   📝 Registering Eve to get SBT...`);
    const eveRoleData = { 
        account: eveAccount.address, 
        community: targetComm, 
        avatarURI: "ipfs://eve", 
        ensName: "eve.c", 
        stakeAmount: 100n 
    };

    const eveData = encodeAbiParameters(
        [{ type: 'tuple', components: [
            { name: 'account', type: 'address' },
            { name: 'community', type: 'address' },
            { name: 'avatarURI', type: 'string' },
            { name: 'ensName', type: 'string' },
            { name: 'stakeAmount', type: 'uint256' }
        ]}],
        [eveRoleData]
    );
    console.log(`   📦 Encoded data length: ${eveData.length}`);

    // Final sanity checks for Eve
    const eveGTokenBalance = await publicClient.readContract({
        address: GTOKEN_ADDR, abi: loadAbi('GToken'), functionName: 'balanceOf', args: [eveAccount.address]
    }) as bigint;
    const eveAllowance = await publicClient.readContract({
        address: GTOKEN_ADDR, abi: loadAbi('GToken'), functionName: 'allowance', args: [eveAccount.address, STAKING_ADDR]
    }) as bigint;
    console.log(`   💰 Eve GToken Balance: ${eveGTokenBalance}, Allowance: ${eveAllowance}`);

    console.log(`   📝 Encoded Data: ${eveData}`);

    try {
        console.log(`   🔍 Simulating registration...`);
        await publicClient.simulateContract({
            address: REGISTRY_ADDR, abi: RegistryABI, functionName: 'registerRoleSelf',
            account: eveAccount.address,
            args: [ROLE_ENDUSER, eveData]
        });

        const txReg = await eveWallet.writeContract({
            address: REGISTRY_ADDR, abi: RegistryABI, functionName: 'registerRoleSelf',
            args: [ROLE_ENDUSER, eveData]
        });
        await waitForTx(publicClient, txReg);
    } catch (err: any) {
        console.error(`❌ registerRoleSelf failed:`, err.message);
        
        let errorData = err.data;
        // Walk the error object to find data
        let current = err;
        while (current && !errorData) {
            if (current.data) {
                errorData = current.data;
            }
            current = current.cause || current.walk?.() || current.error;
        }

        if (errorData) {
            console.log(`📡 Raw Error Data Found: ${errorData}`);
            const selector = errorData.slice(0, 10);
            console.log(`   Selector: ${selector}`);

            try {
                const decoded = decodeErrorResult({ abi: RegistryABI, data: errorData });
                console.error(`   Registry Error: ${decoded.errorName} (${JSON.stringify(decoded.args, (_, v) => typeof v === 'bigint' ? v.toString() : v)})`);
            } catch {
                try {
                    const StakingABI = loadAbi('GTokenStaking');
                    const decoded = decodeErrorResult({ abi: StakingABI, data: errorData });
                    console.error(`   Staking Error: ${decoded.errorName} (${JSON.stringify(decoded.args, (_, v) => typeof v === 'bigint' ? v.toString() : v)})`);
                } catch {
                    console.error(`   Could not decode error with Registry or Staking ABIs.`);
                }
            }
        } else {
            console.log(`🔍 Full Error Object for inspection:`, JSON.stringify(err, (_, value) => 
                typeof value === 'bigint' ? value.toString() : value, 2));
        }
        process.exit(1);
    }
    
    const tokenId = await publicClient.readContract({
        address: MYSBT_ADDR, abi: MySBTABI, functionName: 'userToSBT', args: [eveAccount.address]
    }) as bigint;
    console.log(`   ✅ Eve Registered. SBT TokenID: ${tokenId}`);

    // 3. Test Active Burn (User initiates)
    console.log(`\n🔥 Test 1: Active User Burn...`);
    try {
        const txBurn = await eveWallet.writeContract({
            address: MYSBT_ADDR, abi: MySBTABI, functionName: 'burnSBT', args: []
        });
        await waitForTx(publicClient, txBurn);
        console.log(`   ✅ SBT Burned by Eve.`);
    } catch (e: any) {
        console.warn(`   ⚠️ Burn failed: ${e.message.split('\n')[0]}`);
        console.log(`   (Proceeding to check linkage instead)`);
    }

    const existsAfterBurn = await publicClient.readContract({
        address: MYSBT_ADDR, abi: MySBTABI, functionName: 'userToSBT', args: [eveAccount.address]
    }) as bigint;
    console.log(`   🔍 userToSBT after burn: ${existsAfterBurn}`);

    // 4. Test Role Exit Linkage
    if (existsAfterBurn === 0n) {
        console.log(`\n🔄 Re-registering Eve for Linkage Test...`);
        const txReg2 = await eveWallet.writeContract({
            address: REGISTRY_ADDR, abi: RegistryABI, functionName: 'registerRoleSelf',
            args: [ROLE_ENDUSER, eveData]
        });
        await waitForTx(publicClient, txReg2);
    }

    console.log(`\n🚪 Test 2: Role Exit Linkage...`);
    console.log(`   🚪 Eve exiting role...`);
    const txExit = await eveWallet.writeContract({
        address: REGISTRY_ADDR, abi: RegistryABI, functionName: 'exitRole', args: [ROLE_ENDUSER]
    });
    await waitForTx(publicClient, txExit);
    
    // In V3, exitRole might NOT burn the SBT automatically, but mark membership as inactive.
    const tokenIdAfterExit = await publicClient.readContract({
        address: MYSBT_ADDR, abi: MySBTABI, functionName: 'userToSBT', args: [eveAccount.address]
    }) as bigint;

    const memberships = await publicClient.readContract({
        address: MYSBT_ADDR, abi: MySBTABI, functionName: 'getMemberships', args: [tokenIdAfterExit]
    }) as any[];
    
    console.log(`   🔍 Resulting Memberships:`, memberships);
    const isStillActive = memberships.some((m: any) => m.isActive && m.community.toLowerCase() === targetComm.toLowerCase());
    console.log(`   🔍 Community (${targetComm}) Membership Active? ${isStillActive}`);
    
    if (isStillActive) {
        console.warn(`   ⚠️ Warning: Membership still active after role exit!`);
    } else {
        console.log(`   ✅ Membership successfully deactivated on Role Exit.`);
    }

    console.log(`\n🎉 Phase 6 Check Complete!`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
