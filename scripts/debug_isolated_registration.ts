
import { createPublicClient, createWalletClient, http, defineChain, Hex, toHex, keccak256, stringToBytes, parseEther, Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.v3', override: true });

// --- CONFIG ---
const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545';
const ANVIL_CHAIN = defineChain({
    id: 31337,
    name: 'Anvil Local',
    network: 'anvil',
    nativeCurrency: { decimals: 18, name: 'Ether', symbol: 'ETH' },
    rpcUrls: { default: { http: [RPC_URL] }, public: { http: [RPC_URL] } }
});

const ROLE_PAYMASTER_SUPER = keccak256(stringToBytes('PAYMASTER_SUPER'));

// Addresses from .env.v3
const localAddresses = {
    registry: process.env.REGISTRY_ADDRESS as Address,
    gToken: process.env.GTOKEN_ADDRESS as Address,
    gTokenStaking: process.env.GTOKENSTAKING_ADDRESS as Address,
    superPaymaster: process.env.SUPER_PAYMASTER as Address,
    aPNTs: process.env.APNTS_ADDRESS as Address
};

// Accounts
const adminAccount = privateKeyToAccount(process.env.ADMIN_KEY as Hex);
const operatorAccount = privateKeyToAccount('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'); // Anvil 1

// --- ABIs ---
const RegistryABI = [
    { type: 'function', name: 'hasRole', inputs: [{type:'bytes32'}, {type:'address'}], outputs: [{type:'bool'}], stateMutability: 'view' },
    { type: 'function', name: 'owner', inputs: [], outputs: [{type:'address'}], stateMutability: 'view' },
    { type: 'function', name: 'registerRole', inputs: [{type:'bytes32'}, {type:'address'}, {type:'bytes'}], outputs: [], stateMutability: 'nonpayable' },
    { type: 'function', name: 'GTOKEN_STAKING', inputs: [], outputs: [{type:'address'}], stateMutability: 'view' },
    { type: 'function', name: 'roleConfigs', inputs: [{type:'bytes32'}], outputs: [{type:'uint256'}, {type:'uint256'}, {type:'uint32'}, {type:'uint32'}, {type:'uint32'}, {type:'uint32'}, {type:'uint32'}, {type:'uint256'}, {type:'bool'}, {type:'string'}], stateMutability: 'view' },
    { type: 'error', name: 'ERC20InsufficientAllowance', inputs: [{name:'spender', type:'address'}, {name:'allowance', type:'uint256'}, {name:'needed', type:'uint256'}] }
] as const;

const ERC20ABI = [
    { type: 'function', name: 'balanceOf', inputs: [{type:'address'}], outputs: [{type:'uint256'}], stateMutability: 'view' },
    { type: 'function', name: 'approve', inputs: [{type:'address'}, {type:'uint256'}], outputs: [{type:'bool'}], stateMutability: 'nonpayable' },
    { type: 'function', name: 'allowance', inputs: [{type:'address'}, {type:'address'}], outputs: [{type:'uint256'}], stateMutability: 'view' },
    { type: 'function', name: 'mint', inputs: [{type:'address'}, {type:'uint256'}], outputs: [], stateMutability: 'nonpayable' }
] as const;

const GTokenStakingV3ABI = [
    {
        type: 'function', name: 'getStakeInfo', stateMutability: 'view',
        inputs: [{ name: 'operator', type: 'address' }, { name: 'roleId', type: 'bytes32' }],
        outputs: [{ type: 'tuple', components: [
            { name: 'amount', type: 'uint256' },
            { name: 'slashedAmount', type: 'uint256' },
            { name: 'stakedAt', type: 'uint256' },
            { name: 'unstakeRequestedAt', type: 'uint256' }
        ]}]
    },
    { type: 'function', name: 'GTOKEN', inputs: [], outputs: [{type:'address'}], stateMutability: 'view' }
] as const;

const SuperPaymasterABI = [
    { type: 'function', name: 'notifyDeposit', inputs: [{type:'uint256'}], outputs: [], stateMutability: 'nonpayable' }
] as const;

async function main() {
    console.log('🚀 Starting Isolated Registration Debug');
    console.log('   Registry:', localAddresses.registry);
    console.log('   Admin:', adminAccount.address);
    console.log('   Operator:', operatorAccount.address);

    const client = createPublicClient({ chain: ANVIL_CHAIN, transport: http() });
    const adminClient = createWalletClient({ account: adminAccount, chain: ANVIL_CHAIN, transport: http() });
    const operatorClient = createWalletClient({ account: operatorAccount, chain: ANVIL_CHAIN, transport: http() });

    // 1. Check Owner
    const owner = await client.readContract({ address: localAddresses.registry, abi: RegistryABI, functionName: 'owner' });
    console.log('   Registry Owner:', owner);
    if (owner.toLowerCase() !== adminAccount.address.toLowerCase()) {
        console.error('❌ Admin Mismatch!');
        process.exit(1);
    }

    // 1.1 Check Staking Address in Registry
    const stakingInRegistry = await client.readContract({ address: localAddresses.registry, abi: RegistryABI, functionName: 'GTOKEN_STAKING' });
    console.log('   Registry Staking:', stakingInRegistry);
    console.log('   Env Staking:     ', localAddresses.gTokenStaking);
    if (stakingInRegistry.toLowerCase() !== localAddresses.gTokenStaking.toLowerCase()) {
        console.error('❌ STAKING ADDRESS MISMATCH!');
        console.log('   Fixing approval target...');
    }

    // 1.2 Check GToken Address in Staking - Check if Staking uses the same GToken as us
    const gTokenInStaking = await client.readContract({ address: localAddresses.gTokenStaking, abi: GTokenStakingV3ABI, functionName: 'GTOKEN' });
    console.log('   Staking GToken:  ', gTokenInStaking);
    console.log('   Env GToken:      ', localAddresses.gToken);
    if (gTokenInStaking.toLowerCase() !== localAddresses.gToken.toLowerCase()) {
        console.error('❌ GTOKEN ADDRESS MISMATCH! Staking uses different token!');
        process.exit(1);
    }
    
    // 1.3 Check Role Config Logic
    const roleConf = await client.readContract({ address: localAddresses.registry, abi: RegistryABI, functionName: 'roleConfigs', args: [ROLE_PAYMASTER_SUPER] }) as any;
    console.log('   Role Config:', roleConf);
    const requiredStake = roleConf[0]; // stakeAmount
    const entryBurn = roleConf[1]; // entryBurn
    // In strict array return:
    // [0] uint256 stakeAmount
    // [1] uint256 entryBurn
    console.log(`   Required: Stake=${requiredStake.toString()}, Burn=${entryBurn.toString()}`);
    const totalNeeded = BigInt(requiredStake) + BigInt(entryBurn);
    console.log(`   Total Needed: ${totalNeeded.toString()}`);

    // 2. Check Balances
    const gBal = await client.readContract({ address: localAddresses.gToken, abi: ERC20ABI, functionName: 'balanceOf', args: [adminAccount.address] });
    console.log('   Admin GToken:', gBal.toString());
    
    if (gBal < parseEther('1000')) {
        console.log('   Minting GToken to Admin...');
        const mintTx = await adminClient.writeContract({
            address: localAddresses.gToken,
            abi: ERC20ABI,
            functionName: 'mint',
            args: [adminAccount.address, parseEther('10000')],
            account: adminAccount
        });
        await client.waitForTransactionReceipt({ hash: mintTx });
        console.log('   Minted.');
    }
    
    // 2.1 Mint GToken for Operator
    const opBal = await client.readContract({ address: localAddresses.gToken, abi: ERC20ABI, functionName: 'balanceOf', args: [operatorAccount.address] });
    console.log('   Operator GToken:', opBal.toString());
    
    if (opBal < parseEther('100')) {
        console.log('   Minting GToken to Operator...');
        const mintTx2 = await adminClient.writeContract({
            address: localAddresses.gToken,
            abi: ERC20ABI,
            functionName: 'mint',
            args: [operatorAccount.address, parseEther('1000')],
            account: adminAccount
        });
        await client.waitForTransactionReceipt({ hash: mintTx2 });
        console.log('   Minted.');}
    
    // 3. Approve Staking (Operator must approve since they are the payer)
    const APPROVE_AMOUNT = parseEther('100'); // Stake 50 + Burn 5 + buffer
    console.log('   Approving GToken (Operator)...');
    const txApprove = await operatorClient.writeContract({
        address: localAddresses.gToken, abi: ERC20ABI,
        functionName: 'approve', args: [localAddresses.gTokenStaking, APPROVE_AMOUNT]
    });
    await client.waitForTransactionReceipt({ hash: txApprove });
    await client.waitForTransactionReceipt({ hash: txApprove });
    console.log('   Approved (Operator).');

    // 3.1 Approve Staking (Admin - Critical Fix)
    console.log('   Approving GToken (Admin)...');
    
    // Check allowence for REAL staking address
    const allowance = await client.readContract({
        address: localAddresses.gToken, 
        abi: ERC20ABI,
        functionName: 'allowance',
        args: [adminAccount.address, stakingInRegistry]
    });
    console.log('   Current Allowance:', allowance.toString());

    // FORCE APPROVE (Skip check)
    console.log('   Forcing Approval (5000 ETH)...');
    const appTxAdmin = await adminClient.writeContract({
        address: localAddresses.gToken,
        abi: ERC20ABI,
        functionName: 'approve',
        args: [stakingInRegistry, parseEther('5000')] // Force new high allowance
    });
    await client.waitForTransactionReceipt({ hash: appTxAdmin });
    console.log('   Forced Approved (Admin).');

    // 3.2 Manual Transfer Check (Can Staking pull from Admin?)
    // Note: We cannot easily simulate Staking pulling funds unless we impersonate Staking.
    // But we can check if WE can transfer to Staking? No, that's transfer.
    // We can simulate call to 'transferFrom' via the Staking contract?
    // Using cast usually.
    // Here we just rely on the forced approval.

    // 4. Register Role (Admin)
    console.log('   Registering Role (Admin)...');
    try {
        const regTx = await adminClient.writeContract({
            address: localAddresses.registry,
            abi: RegistryABI,
            functionName: 'registerRole',
            args: [ROLE_PAYMASTER_SUPER, operatorAccount.address, '0x']
        });
        await client.waitForTransactionReceipt({ hash: regTx });
        console.log('   Registered.');
    } catch (e: any) {
        console.error('❌ Registration Failed:', e.shortMessage || e.message);
        if (e.data || (e.walk && e.walk().data)) {
           // Try to decode if possible, or just print raw if viem didn't automatically decode it (it should if ABI has error)
           console.log('   Error Data:', e.data || e.walk().data);
           // Manually printing args if available in the error object from viem
           if (e.args) console.log('   Error Args:', e.args);
        }
    }

    // 5. Verify & Debug
    const hasRole = await client.readContract({
        address: localAddresses.registry,
        abi: RegistryABI,
        functionName: 'hasRole',
        args: [ROLE_PAYMASTER_SUPER, operatorAccount.address]
    });
    console.log('   Has Role:', hasRole);

    const stakeInfo = await client.readContract({
        address: localAddresses.gTokenStaking,
        abi: GTokenStakingV3ABI,
        functionName: 'getStakeInfo',
        args: [operatorAccount.address, ROLE_PAYMASTER_SUPER]
    }) as any;
    console.log('   Stake Info:', stakeInfo);

    if (hasRole) {
        // 6. Notify Deposit
        console.log('   Notify Deposit Step...');
        const DEPOSIT = parseEther('50');
        
        // Approve aPNTs first
        const appTx2 = await operatorClient.writeContract({
            address: localAddresses.aPNTs,
            abi: ERC20ABI,
            functionName: 'approve',
            args: [localAddresses.superPaymaster, DEPOSIT]
        });
        await client.waitForTransactionReceipt({ hash: appTx2 });
        
        try {
            const notTx = await operatorClient.writeContract({
                address: localAddresses.superPaymaster,
                abi: SuperPaymasterABI,
                functionName: 'depositFor',
                args: [operatorAccount.address, DEPOSIT]
            });
            await client.waitForTransactionReceipt({ hash: notTx });
            console.log('✅ Deposit Notified Successfully');
        } catch(e: any) {
            console.error('❌ Notify Failed:', e.shortMessage || e.message);
        }
    }
}

main().catch(console.error);
