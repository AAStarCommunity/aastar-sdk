import { createPublicClient, createWalletClient, http, parseEther, formatEther, createClient, encodeFunctionData, parseAbi, encodeAbiParameters, type Hex, type Address } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { bundlerActions } from 'viem/account-abstraction';
import { sepolia } from 'viem/chains';
import { SepoliaFaucetAPI } from '../packages/core/src/actions/index.js';
import { SuperPaymasterClient, PaymasterClient } from '../packages/paymaster/src/index.js';
import * as dotenv from 'dotenv';
import { loadNetworkConfig } from '../tests/regression/config.js';

dotenv.config({ path: '.env.sepolia' });

async function main() {
    console.log('🌟 Starting Faucet + SuperPaymaster Verification...');

    const config = await loadNetworkConfig('sepolia');
    const rpcUrl = process.env.RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/your-key';
    const bundlerUrl = process.env.BUNDLER_URL!;

    // 1. Setup Admin (The Faucet Provider)
    // Try ANNI first (Likely Admin), then default
    const adminPk = (process.env.PRIVATE_KEY_ANNI || process.env.PRIVATE_KEY_JASON || process.env.PRIVATE_KEY) as `0x${string}`;
    if (!adminPk) throw new Error("No Admin Private Key found in .env");
    
    const adminAccount = privateKeyToAccount(adminPk);
    const adminWallet = createWalletClient({ account: adminAccount, chain: sepolia, transport: http(rpcUrl) });
    const publicClient = createPublicClient({ chain: sepolia, transport: http(rpcUrl) });
    
    console.log(`👨‍✈️ Admin (Faucet): ${adminAccount.address}`);

    // 2. Generate Brand New Identity (The Test User)
    const newPk = generatePrivateKey();
    const newUser = privateKeyToAccount(newPk);
    const newUserWallet = createWalletClient({ account: newUser, chain: sepolia, transport: http(rpcUrl) });
    
    // Calculate AA Address (SimpleAccount v0.7)
    // Note: To calculate AA address deterministically without deployment, we need the factory.
    // For simplicity here, we assume SimpleAccountFactory.getAddress(owner, salt).
    // But SuperPaymasterClient.submitGaslessTransaction handles deployment via initCode if needed?
    // Actually, PaymasterClient.submitGaslessTransaction uses SimpleAccount.execute (assumes deployed or initCode provided).
    // The Faucet funds the *counterfactual* AA address. 
    // We need to calculate it first.
    
    // Let's use getSenderAddress from EntryPoint (by reverting) or standard factory calculation.
    // Address = Client.readContract(Factory, 'getAddress', [owner, salt])
    const SIMPLE_ACCOUNT_FACTORY = '0x91E60e0613810449d098b0b5Ec8b51A0FE8c8985' as `0x${string}`; // v0.7 Official
    // Or our deployed one? config doesn't list SimpleAccountFactory.
    // Let's try official. If fails, we might need our own.
    
    console.log(`👤 New User EOA: ${newUser.address}`);
    console.log(`🔑 New User PK: ${newPk}`);

    // Calculate AA Address (using official v0.7 factory)
    // const factoryAbi = parseAbi(['function getAddress(address owner, uint256 salt) view returns (address)']);
    // const aaAddress = await publicClient.readContract({
    //     address: SIMPLE_ACCOUNT_FACTORY,
    //     abi: factoryAbi,
    //     functionName: 'getAddress',
    //     args: [newUser.address, 0n]
    // });
    
    // SHORTCUT: Just use Jason's AA (Anni's AA) so we know it works, OR use a known Factory.
    // But we want to test Faucet on a NEW account.
    // Let's assume we use the known AA Factory found in our other scripts?
    // scripts/deploy_test_accounts.ts uses "0x9406Cc6185a346906296840746125a0E44976454"
    const MY_FACTORY = '0x9406Cc6185a346906296840746125a0E44976454' as `0x${string}`;
    const aaAddress = await publicClient.readContract({
        address: MY_FACTORY,
        abi: [{ name: 'getAddress', type: 'function', inputs: [{ name: 'owner', type: 'address' }, { name: 'salt', type: 'uint256' }], outputs: [{ type: 'address' }], stateMutability: 'view' }],
        functionName: 'getAddress',
        args: [newUser.address, 0n]
    });

    console.log(`🤖 Calculated AA Address: ${aaAddress}`);

    // 3. 🚰 Faucet: Prepared Account
    console.log('\n--- 🚰 Running SepoliaFaucetAPI ---');
    
    // Fetch Community Address (Mycelium) for EndUser Role
    // Since Registry requires valid community membership
    let communityAddr = await publicClient.readContract({
        address: config.contracts.registry,
        abi: parseAbi(['function communityByName(string) view returns (address)']),
        functionName: 'communityByName',
        args: ['Mycelium']
    });

    // Fetch staking address from registry (needed for community logic and token logic)
    const stakingAddr = await publicClient.readContract({
        address: config.contracts.registry,
        abi: parseAbi(['function GTOKEN_STAKING() view returns (address)']),
        functionName: 'GTOKEN_STAKING'
    }) as Address;

    if (communityAddr === '0x0000000000000000000000000000000000000000') {
        const ROLE_COMMUNITY = '0xe94d78b6d8fb99b2c21131eb4552924a60f564d8515a3cc90ef300fc9735c074';
        
        // Check if Admin already has the role (maybe under different name or lost metadata)
        const hasRole = await publicClient.readContract({
            address: config.contracts.registry,
            abi: parseAbi(['function hasRole(bytes32 role, address account) view returns (bool)']),
            functionName: 'hasRole',
            args: [ROLE_COMMUNITY as `0x${string}`, adminAccount.address]
        });

        if (hasRole) {
            console.log(`   ✅ Admin already has COMMUNITY role. Using Admin as Community.`);
            communityAddr = adminAccount.address;
        } else {
            console.log(`   ⚠️ Community "Mycelium" not found. Registering new Community...`);
            // Register Admin as Community
            const commData = encodeAbiParameters(
                [
                    { name: 'name', type: 'string' },
                    { name: 'ensName', type: 'string' },
                    { name: 'website', type: 'string' },
                    { name: 'description', type: 'string' },
                    { name: 'logoURI', type: 'string' },
                    { name: 'stakeAmount', type: 'uint256' }
                ],
                ['Mycelium', 'mycelium.eth', 'https://aastar.io', 'Default Test Community', '', 0n]
            );

            // Approve Staking First (if needed) - using stakingAddr from outer scope
            // We need gToken address to approve? 
            // Better to fetch GToken here too.
            // But let's assume '0x71f9...' for approval if we are lazy, OR fetch it.
            // Let's fetch GToken using outer stakingAddr.
            
            console.log(`      🔓 Approving Staking (${stakingAddr}) for Community...`);
            const hashApprove = await adminWallet.writeContract({
                address: gtokenAddrForApprove,
                abi: parseAbi(['function approve(address spender, uint256 amount) external returns (bool)']),
                functionName: 'approve',
                args: [stakingAddr, parseEther('1000')],
                chain: sepolia,
                account: adminWallet.account!
            });
            await publicClient.waitForTransactionReceipt({ hash: hashApprove });

            console.log(`      🏙️ Registering Role...`);
            const hashReg = await adminWallet.writeContract({
                address: config.contracts.registry,
                abi: parseAbi(['function registerRole(bytes32 roleId, address user, bytes calldata data) external']),
                functionName: 'registerRole',
                args: [ROLE_COMMUNITY as `0x${string}`, adminAccount.address, commData],
                chain: sepolia,
                account: adminWallet.account!
            });
            await publicClient.waitForTransactionReceipt({ hash: hashReg });
            console.log(`      -> Community Registered. Tx: ${hashReg}`);
            
            communityAddr = adminAccount.address;
        }
    }
    
    console.log(`   🏙️ Community (Mycelium): ${communityAddr}`);

    // Use cPNTs (Anni's Token) for Minting, as Admin owns it.
    // Faucet will handle 0x60d... approval internally for Staking.
    const tokenToMint = '0x71f9Dd79f3B0EF6f186e9C6DdDf3145235D9BBd9'; 

    await SepoliaFaucetAPI.prepareTestAccount(adminWallet, publicClient, {
        targetAA: aaAddress,
        registry: config.contracts.registry,
        token: tokenToMint, 
        // superPaymaster is implied context for token holding
        ethAmount: parseEther('0.02'), // Enough for deployment gas if needed
        tokenAmount: parseEther('50'),
        community: communityAddr
    });

    // 4. Submit Gasless Transaction
    console.log('\n--- 🚀 Submitting Gasless Transaction ---');
    // Note: Since account is UNDEPLOYED, we need `initCode` in the UserOp.
    // SuperPaymasterClient.submitGaslessTransaction currently assumes deployed account?
    // Let's check. It takes `aaAccount` address. It doesn't ask for `initCode`.
    // It relies on `PaymasterClient.submitGaslessUserOperation`, which also doesn't take `initCode` explicitly in args?
    // Wait, `PaymasterClient.submitGaslessUserOperation` builds `callData` via `encodeExecution`.
    // If account is not deployed, the UserOp MUST have `initCode`.
    // Our simplified API might not expose `initCode` param yet.
    // CHECK: Does `submitGaslessUserOperation` verify code?
    const code = await publicClient.getBytecode({ address: aaAddress });
    if (!code) {
        console.warn(`⚠️ AA Account not deployed. Simplified Client might fail if it doesn't support initCode injection.`);
        // For this demo, let's just fund it and try. If fail, we know we need to add initCode support to Client.
        // Update: PaymasterClient V4 `submitGaslessUserOperation` is simplified.
        // If we want to support undeployed, we need to pass `factory` + `factoryData`.
        
        // Let's manually inject `initCode` via options object if supported?
        // Checking PaymasterClient.ts ... it accepts `ClientOptions` but does it accept `initCode`?
        // It seems `submitGaslessUserOperation` builds the op.
    }

    // Need to pass factory info for undeployed account
    const factoryData = encodeFunctionData({
        abi: parseAbi(['function createAccount(address owner, uint256 salt) external returns (address ret)']),
        functionName: 'createAccount',
        args: [newUser.address, 0n]
    });

    // Attempt Submission
    const userOpHash = await SuperPaymasterClient.submitGaslessTransaction(
        publicClient,
        newUserWallet, // Signer
        aaAddress,
        config.contracts.entryPoint,
        bundlerUrl,
        bundlerUrl,
        {
            token: tokenToMint,
            recipient: adminAccount.address, // Send back to Admin
            amount: parseEther('1'),
            operator: '0xEcAACb915f7D92e9916f449F7ad42BD0408733c9', // Anni's Operator
            paymasterAddress: config.contracts.superPaymaster,
            factory: MY_FACTORY,
            factoryData
        }
    );

    console.log(`✅ UserOp Hash: ${userOpHash}`);
    
    const bundlerClient = createClient({
        chain: sepolia,
        transport: http(bundlerUrl)
    }).extend(bundlerActions);

    console.log('⏳ Waiting for execution...');
    const receipt = await bundlerClient.waitForUserOperationReceipt({ hash: userOpHash });
    console.log(`🎉 Success! Tx: https://sepolia.etherscan.io/tx/${receipt.receipt.transactionHash}`);

    // Log the generated key for later use
    console.log('\n🔑 SAVE THIS KEY FOR FUTURE USE:');
    console.log(`   Private Key: ${newPk}`);
    console.log(`   AA Address:  ${aaAddress}`);
}

main().catch(console.error);
