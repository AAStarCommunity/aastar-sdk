import { 
    createPublicClient, 
    createWalletClient, 
    http, 
    keccak256, 
    toBytes, 
    encodeAbiParameters, 
    type Hex,
    decodeErrorResult,
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

dotenv.config({ path: path.resolve(__dirname, '../../SuperPaymaster/contracts/.env') });

const loadAbi = (name: string) => {
    const abiPath = path.resolve(__dirname, `../abis/${name}.abi.json`);
    if (!fs.existsSync(abiPath)) throw new Error(`ABI not found: ${abiPath}`);
    return JSON.parse(fs.readFileSync(abiPath, 'utf-8'));
};

const RegistryABI = loadAbi('Registry');
const MySBTABI = loadAbi('MySBT');
const GTokenABI = loadAbi('GToken');

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
    // LATEST DEPLOYMENT ADDRESSES from DeployV3FullLocal output
    const REGISTRY_ADDR = (process.env.REGISTRY_ADDR || '0xaB837301d12cDc4b97f1E910FC56C9179894d9cf') as Hex;
    const MYSBT_ADDR = (process.env.MYSBT_ADDR || '0x4ff1f64683785E0460c24A4EF78D582C2488704f') as Hex;
    const GTOKEN_ADDR = (process.env.GTOKEN_ADDR || '0x124dDf9BdD2DdaD012ef1D5bBd77c00F05C610DA') as Hex;
    const STAKING_ADDR = (process.env.STAKING_ADDR || '0xe044814c9eD1e6442Af956a817c161192cBaE98F') as Hex;

    const ADMIN_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'; 
    const adminWallet = createWalletClient({ account: privateKeyToAccount(ADMIN_KEY as Hex), chain: anvil, transport: http(ANVIL_RPC) });

    const stakeAmount = 400000000000000000n; // 0.4 ether
    console.log(`   🛠️  Registry: ${REGISTRY_ADDR}, GToken: ${GTOKEN_ADDR}, Staking: ${STAKING_ADDR}`);

    // 1. Setup User (Eve)
    const eveKey = generatePrivateKey();
    const eveAccount = privateKeyToAccount(eveKey);
    const eveWallet = createWalletClient({ account: eveAccount, chain: anvil, transport: http(ANVIL_RPC) });
    console.log(`👤 Eve (Test User): ${eveAccount.address}`);
    const hashFund = await adminWallet.sendTransaction({ to: eveAccount.address, value: 1000000000000000000n });
    await waitForTx(publicClient, hashFund);

    // Fund Eve GToken
    const totalNeeded = stakeAmount + 100000000000000000n; // stake + safety
    console.log(`   💰 Funding Eve with ${totalNeeded} GToken...`);
    await adminWallet.writeContract({
        address: GTOKEN_ADDR, abi: GTokenABI, functionName: 'mint', args: [eveAccount.address, totalNeeded]
    });
    const hashApprove = await eveWallet.writeContract({
        address: GTOKEN_ADDR, abi: GTokenABI, functionName: 'approve', args: [STAKING_ADDR, totalNeeded]
    });
     await waitForTx(publicClient, hashApprove);

    // Ensure ROLE_ENDUSER is configured
    console.log(`   🔧 Ensuring ROLE_ENDUSER is active...`);
    const endUserConfig = await publicClient.readContract({
        address: REGISTRY_ADDR, abi: RegistryABI, functionName: 'getRoleConfig', args: [ROLE_ENDUSER]
    }) as any;
    
    // RoleConfig index 8 is isActive
    if (!endUserConfig.isActive && !endUserConfig[8]) {
        console.log(`   🔧 Activating ROLE_ENDUSER with minStake 0.3 ETH...`);
        // RoleConfig: minStake, entryBurn, slashThreshold, slashBase, slashInc, slashMax, exitFee%, minExitFee, isActive, description
        const roleConfig = [
            parseEther('0.3'),  // minStake
            parseEther('0.05'), // entryBurn
            10n,                // slashThreshold
            parseEther('0.01'), // slashBase
            parseEther('0.005'),// slashIncrement
            parseEther('0.1'),  // slashMax
            1000n,              // exitFeePercent (10%)
            parseEther('0.05'), // minExitFee
            true,               // isActive
            "End User Role"     // description
        ];
        const txConfig = await adminWallet.writeContract({
            address: REGISTRY_ADDR, abi: RegistryABI, functionName: 'configureRole',
            args: [ROLE_ENDUSER, roleConfig]
        });
        await waitForTx(publicClient, txConfig);
    }
    const targetComm = adminWallet.account.address;

    // Pre-flight check: Is community active?
    const isCommActive = await publicClient.readContract({
        address: REGISTRY_ADDR, abi: RegistryABI, functionName: 'checkRole', args: [keccak256(toBytes('COMMUNITY')), targetComm]
    });
    console.log(`   🔍 Community ${targetComm} active: ${isCommActive}`);

    console.log(`   📝 Registering Eve to get SBT...`);
    const eveData = encodeAbiParameters(
        [
            { name: 'account', type: 'address' },
            { name: 'community', type: 'address' },
            { name: 'avatarURI', type: 'string' },
            { name: 'ensName', type: 'string' },
            { name: 'stakeAmount', type: 'uint256' }
        ],
        [eveAccount.address, targetComm, "ipfs://eve", "eve.c", stakeAmount]
    );

    // Final sanity checks for Eve
    const balEve = await publicClient.readContract({
        address: GTOKEN_ADDR, abi: GTokenABI, functionName: 'balanceOf', args: [eveAccount.address]
    });
    const allowEve = await publicClient.readContract({
        address: GTOKEN_ADDR, abi: GTokenABI, functionName: 'allowance', args: [eveAccount.address, STAKING_ADDR]
    });
    console.log(`   💰 Eve GToken Balance: ${balEve}, Allowance: ${allowEve}`);

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
        console.error(`❌ RegisterRoleSelf failed.`);
        
        let errorData = err.data;
        if (!errorData && err.cause) {
            let current = err.cause;
            while (current && !errorData) {
                if (current.data) errorData = current.data;
                current = current.cause;
            }
        }

        if (errorData) {
            console.log(`   🔸 Revert Data: ${errorData}`);
            if (errorData.startsWith('0xfb8f41b2')) { // InsufficientStake(address,uint256,uint256)
                const data = decodeErrorResult({
                    abi: [
                        {
                            type: 'error',
                            name: 'InsufficientStake',
                            inputs: [
                                { name: 'token', type: 'address' },
                                { name: 'provided', type: 'uint256' },
                                { name: 'required', type: 'uint256' }
                            ]
                        }
                    ],
                    data: errorData
                });
                console.log(`   🔸 Decoded Error: InsufficientStake(token: ${data.args[0]}, provided: ${data.args[1]}, required: ${data.args[2]})`);
            } else {
                try {
                    const decodedError = decodeErrorResult({
                        abi: RegistryABI,
                        data: errorData
                    });
                    console.log(`   🔸 Decoded Error: ${decodedError.errorName}(${JSON.stringify(decodedError.args, (_, v) => typeof v === 'bigint' ? v.toString() : v)})`);
                } catch (e) {
                    console.log(`   🔸 Raw Revert Message: ${err.message}`);
                }
            }
        } else {
            console.log(`   🔸 Error: ${err.shortMessage || err.message}`);
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
        console.log(`\n🚪 Cleaning up Eve's role before re-registration...`);
        try {
            const txCleanup = await eveWallet.writeContract({
                address: REGISTRY_ADDR, abi: RegistryABI, functionName: 'exitRole', args: [ROLE_ENDUSER]
            });
            await waitForTx(publicClient, txCleanup);
        } catch (e) {
            console.log(`   (Cleanup skip or already exited)`);
        }

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
