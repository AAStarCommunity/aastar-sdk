import { createPublicClient, createWalletClient, http, parseEther, formatEther, createClient, encodeFunctionData, parseAbi, encodeAbiParameters, type Hex, type Address, keccak256, toHex } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { bundlerActions } from 'viem/account-abstraction';
import { sepolia } from 'viem/chains';
import { SepoliaFaucetAPI } from '../packages/core/src/actions/index.js';
import { SuperPaymasterClient } from '../packages/paymaster/src/index.js';
import * as dotenv from 'dotenv';
import { loadNetworkConfig } from '../tests/regression/config.js';

dotenv.config({ path: '.env.sepolia' });

async function main() {
    process.stdout.write('🌟 Starting Faucet + SuperPaymaster Verification (Fresh Write)...\n');

    const config = await loadNetworkConfig('sepolia');
    const rpcUrl = process.env.RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/your-key';
    const bundlerUrl = process.env.BUNDLER_URL!;

    // 1. Setup Admins
    // Supplier (Jason): Has ETH, no mint permission
    const supplierPk = process.env.PRIVATE_KEY_SUPPLIER as `0x${string}`;
    if (!supplierPk) throw new Error("No Supplier Private Key found");
    const supplierAccount = privateKeyToAccount(supplierPk);
    const supplierWallet = createWalletClient({ account: supplierAccount, chain: sepolia, transport: http(rpcUrl) });

    // Faucet Admin (Anni): Has Permission, often low ETH
    const faucetPk = (process.env.PRIVATE_KEY_ANNI || process.env.PRIVATE_KEY) as `0x${string}`;
    if (!faucetPk) throw new Error("No Faucet Admin Private Key found");
    const adminAccount = privateKeyToAccount(faucetPk); // Anni
    const adminWallet = createWalletClient({ account: adminAccount, chain: sepolia, transport: http(rpcUrl) });
    const publicClient = createPublicClient({ chain: sepolia, transport: http(rpcUrl) });
    
    console.log(`👨‍✈️ Supplier (Funds): ${supplierAccount.address}`);
    console.log(`👩‍✈️ Faucet Admin (Perms): ${adminAccount.address}`);

    // Check Faucet Admin Balance and Fund if needed
    const adminBal = await publicClient.getBalance({ address: adminAccount.address });
    if (adminBal < parseEther('0.05')) {
        console.log(`   ⚠️ Faucet Admin low on ETH (${formatEther(adminBal)}). Funding from Supplier...`);
        const hash = await supplierWallet.sendTransaction({
            to: adminAccount.address,
            value: parseEther('0.05'),
            chain: sepolia,
            account: supplierAccount
        });
        await publicClient.waitForTransactionReceipt({ hash });
        console.log(`   ✅ Funded Faucet Admin. Tx: ${hash}`);
    } else {
        console.log(`   ✅ Faucet Admin has sufficient ETH (${formatEther(adminBal)}).`);
    }

    // 2. Generate Brand New Identity (The Test User)
    const newPk = generatePrivateKey();
    const newUser = privateKeyToAccount(newPk);
    const newUserWallet = createWalletClient({ account: newUser, chain: sepolia, transport: http(rpcUrl) });
    
    // AA Factory
    const MY_FACTORY = '0x9406Cc6185a346906296840746125a0E44976454' as `0x${string}`;
    const aaAddress = await publicClient.readContract({
        address: MY_FACTORY,
        abi: [{ name: 'getAddress', type: 'function', inputs: [{ name: 'owner', type: 'address' }, { name: 'salt', type: 'uint256' }], outputs: [{ type: 'address' }], stateMutability: 'view' }],
        functionName: 'getAddress',
        args: [newUser.address, 0n]
    });

    console.log(`👤 New User EOA: ${newUser.address}`);
    console.log(`🤖 Calculated AA Address: ${aaAddress}`);

    // 3. 🚰 Faucet: Prepared Account
    console.log('\n--- 🚰 Running SepoliaFaucetAPI ---');
    
    let communityAddr = await publicClient.readContract({
        address: config.contracts.registry,
        abi: parseAbi(['function communityByName(string) view returns (address)']),
        functionName: 'communityByName',
        args: ['Mycelium']
    });

    const stakingAddr = await publicClient.readContract({
        address: config.contracts.registry,
        abi: parseAbi(['function GTOKEN_STAKING() view returns (address)']),
        functionName: 'GTOKEN_STAKING'
    }) as Address;

    // Use cPNTs (Anni's Token) for Minting
    const tokenToMint = '0x71f9Dd79f3B0EF6f186e9C6DdDf3145235D9BBd9'; 
    console.log(`   🪙 Token to Mint: ${tokenToMint}`);

    if (communityAddr === '0x0000000000000000000000000000000000000000') {
        const ROLE_COMMUNITY = '0xe94d78b6d8fb99b2c21131eb4552924a60f564d8515a3cc90ef300fc9735c074';
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
             // Logic simplified: Use Admin as community
             communityAddr = adminAccount.address;
             // Add registration logic if strictly needed, but for now relying on existing roles
        }
    }
    
    console.log(`   🏙️ Community (Mycelium): ${communityAddr}`);

    await SepoliaFaucetAPI.prepareTestAccount(adminWallet, publicClient, {
        targetAA: aaAddress,
        registry: config.contracts.registry,
        token: tokenToMint, 
        ethAmount: parseEther('0.02'), // Restore funding
        tokenAmount: parseEther('50'),
        community: communityAddr
    });

    // 4. Submit Gasless Transaction
    console.log('\n--- 🚀 Submitting Gasless Transaction ---');

    const factoryData = encodeFunctionData({
        abi: parseAbi(['function createAccount(address owner, uint256 salt) external returns (address ret)']),
        functionName: 'createAccount',
        args: [newUser.address, 0n]
    });
    
    console.log(`   🔎 Submitting with Token: ${tokenToMint}`);
    
    // Validating token presence
    if (!tokenToMint) throw new Error("Token Address is MISSING in script!");

    const userOpHash = await SuperPaymasterClient.submitGaslessTransaction(
        publicClient,
        newUserWallet, 
        aaAddress,
        config.contracts.entryPoint,
        bundlerUrl,
        {
            token: tokenToMint,
            recipient: adminAccount.address,
            amount: parseEther('1'),
            operator: '0xEcAACb915f7D92e9916f449F7ad42BD0408733c9', 
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
}

main().catch(console.error);
