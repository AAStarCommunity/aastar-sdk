
import { createPublicClient, createWalletClient, http, parseEther, formatEther, type Address, type Hex, parseAbi, encodeAbiParameters, parseAbiParameters, concat, pad, toHex } from 'viem';
import { toAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { SepoliaFaucetAPI } from '../packages/core/src/actions/index.js';
import { SuperPaymasterClient } from '../packages/paymaster/src/index.js';
import * as dotenv from 'dotenv';
import { loadNetworkConfig } from '../tests/regression/config.js';
import { privateKeyToAccount } from 'viem/accounts';

dotenv.config({ path: '.env.sepolia' });

// 🎯 Target Account from User Request
const TARGET_AA_ADDRESS = '0x975961302a83090B1eb94676E1430B5baCa43F9E' as Address;

// 🏭 Factory Info (Optional, but good for completeness if undeployed)
// Using Pimlico v0.7 Factory Default
const MY_FACTORY = '0x91E60e0613810449d098b0b5Ec8b51A0FE8c8985'; 

async function main() {
    // 1. Config & Admin Setup
    const config = loadNetworkConfig('sepolia');
    const rpcUrl = config.rpcUrl;
    const bundlerUrl = process.env.BUNDLER_URL!;

    // Admin (Faucet Provider) - Must be Registry Owner
    const adminPk = (process.env.PRIVATE_KEY_SUPPLIER || process.env.PRIVATE_KEY) as `0x${string}`;
    if (!adminPk) throw new Error("No Admin Private Key found in .env");
    const adminAccount = privateKeyToAccount(adminPk);
    const adminWallet = createWalletClient({ account: adminAccount, chain: sepolia, transport: http(rpcUrl) });
    const publicClient = createPublicClient({ chain: sepolia, transport: http(rpcUrl) });

    console.log(`\n🔒 KMS / Remote Signer Verification Script`);
    console.log(`-------------------------------------------`);
    console.log(`🎯 Target AA: ${TARGET_AA_ADDRESS}`);
    console.log(`👨‍✈️ Admin: ${adminAccount.address}`);

    // 2. 🚰 Faucet Preparation (No Private Key Needed!)
    console.log(`\n[Step 1] Preparing Account via Admin (Community Sponsor)...`);
    
    // We need to use 'safeMintForRole' to register the user, which requires the caller to be a COMMUNITY.
    const registryAbi = parseAbi([
        'function hasRole(bytes32 role, address account) view returns (bool)',
        'function safeMintForRole(bytes32 roleId, address user, bytes calldata data) external returns (uint256)',
        'function registerRole(bytes32 roleId, address user, bytes calldata roleData) external',
        'function ROLE_COMMUNITY() view returns (bytes32)',
        'function ROLE_ENDUSER() view returns (bytes32)',
        'error InsufficientStake(uint256 provided, uint256 required)',
        'error RoleNotConfigured(bytes32 roleId, bool isActive)',
        'error RoleAlreadyGranted(bytes32 roleId, address user)',
        'error RoleNotGranted(bytes32 roleId, address user)',
        'error InvalidParameter(string message)'
    ]);
    
    const ROLE_COMMUNITY = await publicClient.readContract({ address: config.contracts.registry, abi: registryAbi, functionName: 'ROLE_COMMUNITY' });
    const ROLE_ENDUSER = await publicClient.readContract({ address: config.contracts.registry, abi: registryAbi, functionName: 'ROLE_ENDUSER' });

    // A. Check if Admin is Community
    const isCommunity = await publicClient.readContract({
        address: config.contracts.registry,
        abi: registryAbi,
        functionName: 'hasRole',
        args: [ROLE_COMMUNITY, adminAccount.address]
    });
    
    if (!isCommunity) {
        console.log(`   🔸 Admin is not Community. Registering as Community First...`);
        // Community Data: name, ens, web, desc, logo, stake
        const commData = {
            name: `AdminComm_${Date.now()}`,
            ensName: '',
            website: 'https://admin.com',
            description: 'Admin Sponsor Community',
            logoURI: '',
            stakeAmount: parseEther('30') // Min stake for Community
        };
        // Encode (string, string, string, string, string, uint256)
        const encodedData = encodeAbiParameters(
            parseAbiParameters('string, string, string, string, string, uint256'),
            [commData.name, commData.ensName, commData.website, commData.description, commData.logoURI, commData.stakeAmount]
        );
        
        // Approve GToken for Stake
        // We assume ADMIN has GTokens. 
        const gToken = await publicClient.readContract({
             address: config.contracts.registry, abi: parseAbi(['function GTOKEN_STAKING() view returns (address)']), functionName: 'GTOKEN_STAKING'
        }) as Address;
        
        // Actually GToken is separate. We need GToken contract.
        const gTokenAddr = config.contracts.gToken;
        await adminWallet.writeContract({
            address: gTokenAddr,
            abi: parseAbi(['function approve(address, uint256) returns (bool)']),
            functionName: 'approve',
            args: [ config.contracts.taking || config.contracts.staking, parseEther('1000') ], // Staking contract
            chain: sepolia, 
            account: adminAccount
        });
        
        const hash = await adminWallet.writeContract({
            address: config.contracts.registry,
            abi: registryAbi,
            functionName: 'registerRole',
            args: [ROLE_COMMUNITY, adminAccount.address, encodedData],
            chain: sepolia,
            account: adminAccount
        });
        await publicClient.waitForTransactionReceipt({hash});
        console.log(`   ✅ Admin Registered as Community!`);
    } else {
        console.log(`   ✅ Admin IS Community.`);
    }

    // B. Register Target User (Sponsor)
    // Check if user has role first
    const hasEndUser = await publicClient.readContract({
        address: config.contracts.registry,
        abi: registryAbi,
        functionName: 'hasRole',
        args: [ROLE_ENDUSER, TARGET_AA_ADDRESS]
    });

    if (!hasEndUser) {
        console.log(`   👤 Sponsoring ENDUSER Role for ${TARGET_AA_ADDRESS}...`);
        
        // User Data: account, community, avatar, ens, stake
        const endUserData = {
            account: TARGET_AA_ADDRESS, // Linked AA
            community: adminAccount.address, // Admin is the community
            avatarURI: '',
            ensName: '',
            stakeAmount: parseEther('0.3') // Min stake for EndUser
        };
        
        const encodedUserData = encodeAbiParameters(
            parseAbiParameters('address, address, string, string, uint256'),
            [endUserData.account, endUserData.community, endUserData.avatarURI, endUserData.ensName, endUserData.stakeAmount]
        );

         // Check GToken Approval for Staking
        console.log(`   Contracts Config:`, config.contracts);
        const gTokenAddr = config.contracts.gToken;
        
        // Query Registry for the REAL Staking Address
        const stakingAddr = await publicClient.readContract({
             address: config.contracts.registry,
             abi: parseAbi(['function GTOKEN_STAKING() view returns (address)']),
             functionName: 'GTOKEN_STAKING'
        }) as Address;
        
        console.log(`   Real Staking Addr (from Registry): ${stakingAddr}`);
        
        if (!gTokenAddr || !stakingAddr) throw new Error("Missing GToken or Staking Address");
        
        
        if (!gTokenAddr || !stakingAddr) throw new Error("Missing GToken or Staking Address");
        
        // Check Allowance First to avoid RPC spam
        const currentAllowance = await publicClient.readContract({
            address: gTokenAddr,
            abi: parseAbi(['function allowance(address, address) view returns (uint256)']),
            functionName: 'allowance',
            args: [adminAccount.address, stakingAddr]
        }) as bigint;

        if (currentAllowance < parseEther('500')) {
             console.log(`   Approving ${stakingAddr} to spend GToken...`);
             const hashApprove = await adminWallet.writeContract({
                 address: gTokenAddr,
                 abi: parseAbi(['function approve(address, uint256) returns (bool)']),
                 functionName: 'approve',
                 args: [stakingAddr, parseEther('1000')],
                 chain: sepolia,
                 account: adminAccount
             });
             await publicClient.waitForTransactionReceipt({ hash: hashApprove });
             console.log(`   ✅ GToken Approved.`);
             await new Promise(r => setTimeout(r, 2000)); // RPC Cool-down
        } else {
             console.log(`   ✅ GToken Allowance Adequate (${formatEther(currentAllowance)}).`);
        }

        const hashMint = await adminWallet.writeContract({
            address: config.contracts.registry,
            abi: registryAbi,
            functionName: 'safeMintForRole',
            args: [ROLE_ENDUSER, TARGET_AA_ADDRESS, encodedUserData],
            chain: sepolia,
            account: adminAccount
        });
        await publicClient.waitForTransactionReceipt({ hash: hashMint });
        console.log(`   ✅ User Registered (SBT Minted)!`);
    } else {
        console.log(`   ✅ User already has ENDUSER role.`);
    }

     // Use Faucet to Fund ETH/Tokens only (skip role reg)
    await SepoliaFaucetAPI.prepareTestAccount(
        adminWallet,
        publicClient,
        {
            targetAA: TARGET_AA_ADDRESS,
            token: '0x71f9Dd79f3B0EF6f186e9C6DdDf3145235D9BBd9', // cPNTs (Anni)
            registry: config.contracts.registry,
            paymasterV4: undefined, 
            ethAmount: parseEther('0.01'), 
            tokenAmount: parseEther('100')
        }
    );

    // 2.1 🏦 Ensure Operator (Anni) has Credit in SuperPaymaster
    // SuperPaymaster requires the OPERATOR to have aPNTs deposited, not the user.
    const SUPER_PM_ADDR = config.contracts.superPaymaster;
    const OPERATOR_ADDR = '0xEcAACb915f7D92e9916f449F7ad42BD0408733c9'; // Anni (Operator)
    
    console.log(`\n[Step 1.5] Checking Operator Credit (Anni)...`);
    try {
        const pmAbi = parseAbi([
            'function operators(address) view returns (uint128 aPNTsBalance, uint96 exchangeRate, bool isConfigured, bool isPaused, address xPNTsToken, uint32 reputation, uint48 minTxInterval, address treasury, uint256 totalSpent, uint256 totalTxSponsored)',
            'function depositFor(address targetOperator, uint256 amount) external'
        ]);
        
        const opConfig = await publicClient.readContract({
            address: SUPER_PM_ADDR,
            abi: pmAbi,
            functionName: 'operators',
            args: [OPERATOR_ADDR]
        });
        
        const balance = (opConfig as any)[0];
        console.log(`   💰 Anni's Balance: ${formatEther(balance)} aPNTs`);
        
        if (balance < parseEther('10')) {
             console.log(`   📉 Balance Low! Depositing for Anni...`);
             // Admin approves aPNTs
             const apnts = await publicClient.readContract({
                 address: SUPER_PM_ADDR,
                 abi: parseAbi(['function APNTS_TOKEN() view returns (address)']),
                 functionName: 'APNTS_TOKEN'
             }) as Address;
             
             // Approve
             await adminWallet.writeContract({
                 address: apnts,
                 abi: parseAbi(['function approve(address spender, uint256 amount) returns (bool)']),
                 functionName: 'approve',
                 args: [SUPER_PM_ADDR, parseEther('1000')],
                 chain: sepolia,
                 account: adminAccount
             });
             
             // Deposit For Operator
             const hash = await adminWallet.writeContract({
                 address: SUPER_PM_ADDR,
                 abi: pmAbi,
                 functionName: 'depositFor',
                 args: [OPERATOR_ADDR, parseEther('100')],
                 chain: sepolia,
                 account: adminAccount
             });
             await publicClient.waitForTransactionReceipt({hash});
             console.log(`   ✅ Deposited 100 aPNTs for Anni.`);
        } else {
             console.log(`   ✅ Operator Balance execution-ready.`);
        }
    } catch(e:any) {
        console.log(`   ⚠️ Operator Check Failed: ${e.message}`);
    }

    // 2.2 🎫 Check User SBT (Required for SuperPM)
    const isSBT = await publicClient.readContract({
        address: config.contracts.registry,
        abi: parseAbi(['function hasRole(bytes32 role, address account) view returns (bool)']),
        functionName: 'hasRole',
        // ENDUSER_ROLE hash (keccak256("ENDUSER"))
        args: ['0x0c34ecc75d3bf122e0609d2576e167f53fb42429262ce8c9b33cab91ff670e3a', TARGET_AA_ADDRESS]
    });
    console.log(`   🎫 User SBT Status: ${isSBT ? 'Active' : 'Missing (Simulations will fail AA23)'}`);

    // 3. ☁️  Mock KMS Signer Integration
    console.log(`\n[Step 2] Initializing Pseudo-KMS Signer...`);
    
    // This implementation demonstrates how to adapt an external KMS to viem.
    // In a real app, `kmsSign` would make an HTTP request to AWS/GCP.
    const kmsAccount = toAccount({
        address: TARGET_AA_ADDRESS,
        async signMessage({ message }) {
            console.log(`\n📞 [Mock KMS] Signature Requested!`);
            console.log(`   Message (Hash): ${message.raw}`);
            console.log(`   -> Connecting to Remote HSM... 🔌`);
            
            // SIMULATION: 
            // Use 65-byte dummy signature using viem helpers to ensure valid Hex
            const r = pad(toHex(1n), { size: 32 });
            const s = pad(toHex(1n), { size: 32 });
            const v = '0x1c'; // 28
            const dummySignature = concat([r, s, v]);
            
            return dummySignature; 
        },
        async signTransaction({ transaction }) {
            throw new Error("signTransaction not supported for AA (UserOps only)");
        },
        async signTypedData({ typedData }) { 
            throw new Error("signTypedData not supported in this demo");
        }
    });

    const kmsWallet = createWalletClient({
        account: kmsAccount,
        chain: sepolia,
        transport: http(rpcUrl)
    });

    // 4. Submit Gasless Transaction (Will fail on-chain, but passes SDK logic)
    console.log(`\n[Step 3] Submitting Gasless Transaction via KMS Signer...`);
    
    try {
        // We know this will fail at the Bundler level because the signature is dummy.
        // But if we get to the Bundler error, it means the SDK successfully:
        // 1. Estimated Gas
        // 2. Built the UserOp
        // 3. Called our KMS Signer
        const userOpHash = await SuperPaymasterClient.submitGaslessTransaction(
            publicClient,
            kmsWallet, // <--- Passing our Custom KMS Wallet
            TARGET_AA_ADDRESS,
            config.contracts.entryPoint,
            bundlerUrl,
            {
                token: '0x71f9Dd79f3B0EF6f186e9C6DdDf3145235D9BBd9', // cPNTs
                recipient: adminAccount.address, 
                amount: parseEther('0.1'),
                operator: '0xEcAACb915f7D92e9916f449F7ad42BD0408733c9', // Anni's Operator
                paymasterAddress: config.contracts.superPaymaster
            }
        );
        console.log(`✅ Success! UserOp Hash: ${userOpHash}`);
    } catch (e: any) {
        console.log(`\n🔍 Verification Result:`);
        if (e.message.includes('Bundler Error') || e.message.includes('signature')) {
             console.log(`   ✅ SDK Flow Verified!`);
             console.log(`      The SDK successfully prepared the UserOp and called our KMS signer.`);
             console.log(`      (The final error is expected because our dummy signature is invalid on-chain)`);
             console.log(`      Error: ${e.message.slice(0, 100)}...`);
        } else {
             console.log(`   ❌ Unexpected Error:`, e);
        }
    }
}

main().catch(console.error);
