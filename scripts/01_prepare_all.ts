import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { http, parseEther, formatEther, Hex, Address, keccak256, stringToBytes } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { 
    createAdminClient, 
    createEndUserClient, 
    createOperatorClient,
    RoleIds,
    CORE_ADDRESSES,
    TEST_TOKEN_ADDRESSES,
    parseKey
} from '../packages/sdk/src/index.ts'; // Correct index path for tsx
import { getNetworkConfig } from './00_utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env based on EXPERIMENT_NETWORK
const network = process.env.EXPERIMENT_NETWORK || 'anvil';
const envFile = network === 'sepolia' ? '.env.sepolia' : '.env.anvil';
const envPath = path.resolve(process.cwd(), envFile);
dotenv.config({ path: envPath, override: true });

async function main() {
    const { chain, rpc } = getNetworkConfig(network);
    
    console.log(`🚀 Starting Phase 1 Preparation: The Ammo (Network: ${network})`);
    console.log(`🔌 Connecting to RPC: ${rpc}`);
    
    if (!rpc) throw new Error(`Missing RPC URL for ${network}`);

    // Accounts
    const ANVIL_ADMIN = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    const ANVIL_OP = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';

    const supplierKey = process.env.PRIVATE_KEY_SUPPLIER || process.env.ADMIN_KEY || (network === 'anvil' ? ANVIL_ADMIN : undefined);
    const operatorKey = process.env.PRIVATE_KEY_JASON || process.env.OPERATOR_KEY || (network === 'anvil' ? ANVIL_OP : undefined);
    
    if (!supplierKey || !operatorKey) throw new Error("Missing Keys (PRIVATE_KEY_SUPPLIER, PRIVATE_KEY_JASON)");

    const supplierAccount = privateKeyToAccount(parseKey(supplierKey));
    const operatorAccount = privateKeyToAccount(parseKey(operatorKey));

    // Clients
    const admin = createAdminClient({ chain, transport: http(rpc), account: supplierAccount });
    const operator = createOperatorClient({ chain, transport: http(rpc), account: operatorAccount });

    console.log(`\n📋 SDK Configuration:`);
    console.log(`   Registry: ${CORE_ADDRESSES.registry}`);
    console.log(`   GToken:   ${TEST_TOKEN_ADDRESSES.gToken}`);
    console.log(`   aPNTs:    ${TEST_TOKEN_ADDRESSES.apnts}`);
    console.log(`   PIM:      ${TEST_TOKEN_ADDRESSES.pimToken}`);

    const targets = [
        { 
            label: 'Baseline (A - Pimlico)', 
            address: process.env.TEST_SIMPLE_ACCOUNT_A as Address,
            salt: 0n, 
            requireMySBT: false, 
            token: TEST_TOKEN_ADDRESSES.pimToken,
            amount: parseEther("1.0")
        },
        { 
            label: 'Standard (B - Paymaster V4/AOA)', 
            address: process.env.TEST_SIMPLE_ACCOUNT_B as Address,
            salt: 1n, 
            requireMySBT: true, 
            token: TEST_TOKEN_ADDRESSES.bpnts,
            amount: parseEther("50")
        },
        { 
            label: 'SuperPaymaster (C)', 
            address: process.env.TEST_SIMPLE_ACCOUNT_C as Address,
            salt: 2n, 
            requireMySBT: true, 
            token: TEST_TOKEN_ADDRESSES.apnts,
            amount: parseEther("50")
        }
    ];

    console.log(`\n🔄 Processing ${targets.length} Accounts...`);

    for (const target of targets) {
        console.log(`\n--------------------------------------------`);
        console.log(`👤 Target: ${target.label}`);

        let senderAddress = target.address;
        
        // Use EndUserClient for each target to handle their specific needs
        const userClient = createEndUserClient({ chain, transport: http(rpc), account: supplierAccount }); // Supplier acting for them

        if (!senderAddress) {
            console.warn(`   ⚠️  Address missing. Calculating via SDK...`);
            const { accountAddress } = await userClient.createSmartAccount({
                owner: supplierAccount.address, // Assuming supplier is owner for prep
                salt: target.salt
            });
            senderAddress = accountAddress;
        }
        
        console.log(`   📍 Address: ${senderAddress}`);

        // 1. ETH Check & Fund
        const balance = await admin.getBalance({ address: senderAddress });
        if (balance < parseEther("0.05")) {
             console.log(`   📉 Low ETH (${formatEther(balance)}). Funding 0.1 ETH...`);
             const hash = await admin.sendTransaction({ to: senderAddress, value: parseEther("0.1") });
             await admin.waitForTransactionReceipt({ hash });
             console.log(`      ✅ Funded ETH`);
        } else {
             console.log(`      ✅ ETH Sufficient: ${formatEther(balance)}`);
        }

        // 2. MySBT (Join Community)
        if (target.requireMySBT) {
            console.log(`   🆔 Checking MySBT (ENDUSER role)...`);
            const hasRole = await userClient.hasRole({ 
                user: senderAddress, 
                roleId: RoleIds.ENDUSER 
            });

            if (!hasRole) {
                console.log(`   🏗️  Joining community for ${senderAddress}...`);
                // Note: In a real scenario, the user signs. For prep, Admin/Supplier might grant it or we use registerRole for them if we have permission.
                // Since this is prep, we'll try to grant it via Admin if it fails via self-registration (which requires signatures we might not have here without private keys for A/B/C)
                try {
                    // For prep, let's use Admin to grant the role directly to the AA address
                    const data = stringToBytes("0x"); // Placeholder
                    const hash = await admin.system.grantRole({
                        roleId: RoleIds.ENDUSER,
                        user: senderAddress,
                        data: '0x' as Hex
                    });
                    console.log(`      ✅ SBT Role Granted via Admin: ${hash}`);
                } catch (e: any) {
                    console.warn(`      ⚠️  SBT Grant Failed: ${e.message}`);
                }
            } else {
                console.log(`      ✅ Already member`);
            }
        }

        // 3. Tokens Check & Fund
        if (target.token && target.token !== '0x' && target.token !== '0x0000000000000000000000000000000000000000') {
            const tokenBal = await admin.readContract({
                address: target.token,
                abi: [parseAbi(['function balanceOf(address) view returns (uint256)'])[0]],
                functionName: 'balanceOf',
                args: [senderAddress]
            }) as bigint;

            if (tokenBal < target.amount / 2n) {
                console.log(`   📉 Low Token Balance (${formatEther(tokenBal)}). Funding...`);
                // We don't have a direct 'transfer' in AdminClient Finance, but we can use base writeContract
                const hash = await admin.writeContract({
                    address: target.token,
                    abi: parseAbi(['function transfer(address, uint256) returns (bool)']),
                    functionName: 'transfer',
                    args: [senderAddress, target.amount],
                    account: supplierAccount
                });
                await admin.waitForTransactionReceipt({ hash });
                console.log(`      ✅ Token Sent`);
            } else {
                console.log(`      ✅ Token Sufficient: ${formatEther(tokenBal)}`);
            }
        }
    }

    // 4. Paymaster V4.1 Setup (AOA Mode)
    console.log(`\n--------------------------------------------`);
    console.log(`🏭 Verifying Paymaster V4.1 (AOA)...`);
    
    const pmV4Status = await operator.getOperatorStatus(operatorAccount.address);
    if (!pmV4Status.paymasterV4) {
        console.log(`   🏗️  Deploying Paymaster V4 for operator...`);
        const deployTx = await operator.deployPaymasterV4();
        console.log(`      ✅ Deployed: ${deployTx}`);
        
        // Wait for it to be indexed/available
        await new Promise(r => setTimeout(r, 2000));
        const updatedStatus = await operator.getOperatorStatus(operatorAccount.address);
        if (updatedStatus.paymasterV4) {
            console.log(`      📍 Address: ${updatedStatus.paymasterV4.address}`);
        }
    } else {
        console.log(`      ✅ Paymaster V4 already exists: ${pmV4Status.paymasterV4.address}`);
    }

    // 5. EntryPoint Deposit for PM V4
    const pmStatus = await operator.getOperatorStatus(operatorAccount.address);
    if (pmStatus.paymasterV4) {
        const pmAddr = pmStatus.paymasterV4.address;
        const deposit = await admin.readContract({
            address: CORE_ADDRESSES.entryPoint,
            abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
            functionName: 'balanceOf',
            args: [pmAddr]
        }) as bigint;

        console.log(`   💰 Paymaster V4 EntryPoint Deposit: ${formatEther(deposit)} ETH`);
        if (deposit < parseEther("0.1")) {
            console.log(`   📉 Low Deposit. Adding 0.2 ETH...`);
            const hash = await admin.writeContract({
                address: CORE_ADDRESSES.entryPoint,
                abi: parseAbi(['function depositTo(address) payable']),
                functionName: 'depositTo',
                args: [pmAddr],
                value: parseEther("0.2"),
                account: supplierAccount
            });
            await admin.waitForTransactionReceipt({ hash });
            console.log(`      ✅ Deposit Added`);
        }
    }

    console.log(`\n✅ Phase 1 Preparation Complete!`);
}

main().catch(console.error);
