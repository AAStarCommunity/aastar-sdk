import * as fs from 'fs';
import * as path from 'path';
import { type Address, type Hash, parseEther, formatEther, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { loadNetworkConfig, type NetworkConfig } from './config';
import { PaymasterOperatorClient } from '../../packages/operator/dist/index.js';
import { UserClient } from '../../packages/enduser/dist/index.js';
import { tokenActions, superPaymasterActions } from '../../packages/core/dist/index.js';
import { fileURLToPath } from 'url';

// Load L4 State
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATE_FILE = path.resolve(__dirname, '../../scripts/l4-state.json');

interface OperatorState {
    tokenAddress?: Address;
    paymasterAddress?: Address;
    superPaymasterAddress?: Address;
}

interface L4State {
    jason: OperatorState;
    bob: OperatorState;
    anni: OperatorState;
}

function loadState(): L4State {
    if (!fs.existsSync(STATE_FILE)) {
        throw new Error(`L4 State file not found at ${STATE_FILE}. Please run 'pnpm tsx scripts/l4-setup.ts' first.`);
    }
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
}

export async function runGaslessTests(config: NetworkConfig) {
    console.log('\n═══════════════════════════════════════════════');
    console.log('⛽ Running L4 Gasless Verification Tests');
    console.log('═══════════════════════════════════════════════\n');

    const state = loadState();

    // --- Scenario A: Jason (AAStar) - PaymasterV4 ---
    await runPaymasterV4Scenario('Jason (AAStar)', 'jason', state.jason, config);

    // --- Scenario B: Bob (Bread) - PaymasterV4 ---
    await runPaymasterV4Scenario('Bob (Bread)', 'bob', state.bob, config);

    // --- Scenario C: Anni (Demo) - SuperPaymasterV3 ---
    await runSuperPaymasterScenario('Anni (Demo)', 'anni', state.anni, config);

    // --- Scenario D: Gasless Registration (New User) ---
    await runGaslessRegistrationScenario('NewUser', state.jason, config);
}

async function runPaymasterV4Scenario(
    name: string, 
    keyName: string, 
    opState: OperatorState, 
    config: NetworkConfig
) {
    console.log(`\n👤 === Scenario: ${name} with PaymasterV4 ===`);
    
    const keyEnv = `PRIVATE_KEY_${keyName.toUpperCase()}`;
    const key = process.env[keyEnv] as `0x${string}`;
    if (!key) {
        console.log(`  ⚠️  Skipping ${name}: Missing ${keyEnv}`);
        return;
    }

    const account = privateKeyToAccount(key);
    const tokenAddr = opState.tokenAddress;
    const pmAddr = opState.paymasterAddress;

    if (!tokenAddr || !pmAddr) {
        console.log(`  ⚠️  Skipping: Missing Token or Paymaster in state.`);
        return; 
    }

    console.log(`  ℹ️  Token: ${tokenAddr}`);
    console.log(`  ℹ️  Paymaster: ${pmAddr}`);

    try {
        // Create proper UserClient
        const client = new UserClient({
            client: createWalletClient({
                chain: config.chain,
                transport: http(config.rpcUrl),
                account
            }),
            publicClient: undefined, // Will be derived
            accountAddress: account.address,
            entryPointAddress: config.contracts.entryPoint,
            registryAddress: config.contracts.registry, // Required for BaseClient but maybe not used for simple gasless?
        });

        // Step 1: Mint xPNTs using SDK tokenActions
        console.log(`  ➡️  Minting xPNTs...`);
        const token = tokenActions();

        // Original: const token = tokenActions(); const mintHash = await token(client).mint(...)
        // where client was WalletClient.
        // So passing `client.client` is correct.
        
        // Fix: Use client.client
        const mintHash = await token(client.client as any).mint({
             token: tokenAddr,
             to: account.address,
             amount: parseEther('10'),
             account
        });

        console.log(`     #️⃣  Hash: ${mintHash}`);
        console.log(`  ✅ Minted 10 xPNTs`);

        // Step 2: Execute Gasless Check
        // Send 0 ETH to self as a test
        console.log(`  ➡️  Executing Gasless Transfer (Self)...`);
        const userOpHash = await client.executeGasless({
            target: account.address,
            value: 0n,
            data: '0x',
            paymaster: pmAddr,
            paymasterType: 'V4'
        });
        
        console.log(`     #️⃣  UserOp Hash: ${userOpHash}`);
        console.log(`  ✅ Gasless Execution Submitted`);
        
        // Wait for receipt?
        // Bundler client doesn't wait automatically.
        // We can use bundlerActions to waitForUserOperationReceipt if we had the client exposed.
        // Or just assume submission success.

    } catch (e: any) {
        console.log(`  ❌ Scenario Failed: ${e.message.split('\n')[0]}`);
    }


}

async function runSuperPaymasterScenario(
    name: string, 
    keyName: string, 
    opState: OperatorState, 
    config: NetworkConfig
) {
    console.log(`\n👤 === Scenario: ${name} with SuperPaymasterV3 ===`);
    
    const keyEnv = `PRIVATE_KEY_${keyName.toUpperCase()}`;
    const key = process.env[keyEnv] as `0x${string}`;
    if (!key) {
        console.log(`  ⚠️  Skipping ${name}: Missing ${keyEnv}`);
        return;
    }

    const account = privateKeyToAccount(key);
    const tokenAddr = opState.tokenAddress;
    const spmAddr = opState.superPaymasterAddress || config.contracts.superPaymaster;

    console.log(`  ℹ️  Token (cPNTs): ${tokenAddr}`);
    console.log(`  ℹ️  SuperPaymaster: ${spmAddr}`);

    if (!tokenAddr) {
        console.log(`  ⚠️  Skipping: Missing Token in state.`);
        return;
    }

    try {
        // Create proper UserClient
        const client = new UserClient({
            client: createWalletClient({
                chain: config.chain,
                transport: http(config.rpcUrl),
                account
            }),
            publicClient: undefined,
            accountAddress: account.address,
            entryPointAddress: config.contracts.entryPoint,
            registryAddress: config.contracts.registry,
            sbtAddress: config.contracts.sbt
        });

        // Step 1: Mint cPNTs using SDK tokenActions
        console.log(`  ➡️  Minting cPNTs...`);
        const token = tokenActions();
        
        const mintHash = await token(client.client as any).mint({
            token: tokenAddr,
            to: account.address,
            amount: parseEther('50'),
            account
        });
        console.log(`     #️⃣  Hash: ${mintHash}`);
        console.log(`  ✅ Minted 50 cPNTs`);

        // Step 2: Approve cPNTs for SuperPaymaster (传统模式)
        console.log(`  ➡️  Approving cPNTs for SuperPaymaster...`);
        const approveHash = await token(client.client as any).approve({
            token: tokenAddr,
            spender: spmAddr,
            amount: parseEther('50'),
            account
        });
        console.log(`  ✅ Approved 50 cPNTs`);

        // Step 3: Deposit using Legacy Pull mode
        console.log(`  ➡️  Depositing cPNTs to SuperPaymaster (Legacy mode)...`);
        const spm = superPaymasterActions(spmAddr);
        const depositHash = await spm(client.client as any).deposit({ // Use inner client
            amount: parseEther('10'),
            account
        });
        console.log(`     #️⃣  Hash: ${depositHash}`);
        console.log(`  ✅ Deposited 10 cPNTs to SuperPaymaster`);

        // Step 4: Gasless Execution
        console.log(`  ➡️  Executing Gasless (SuperPaymaster)...`);
        const userOpHash = await client.executeGasless({
            target: account.address,
            value: 0n,
            data: '0x',
            paymaster: spmAddr,
            paymasterType: 'Super'
        });
        console.log(`     #️⃣  UserOp Hash: ${userOpHash}`);

    } catch (e: any) {
        console.log(`  ❌ Scenario Failed: ${e.message.split('\n')[0]}`);
    }
}

async function runGaslessRegistrationScenario(
    name: string,
    opState: OperatorState,
    config: NetworkConfig
) {
    console.log(`\n👤 === Scenario: Gasless Community Registration (New User) ===`);
    
    // 1. Generate Random User
    const randomKey = privateKeyToAccount(require('crypto').randomBytes(32).toString('hex') as `0x${string}`); 
    const account = randomKey;
    const pmAddr = opState.paymasterAddress;
    const tokenAddr = opState.tokenAddress; // aPNTs

    if (!tokenAddr || !pmAddr) {
        console.log(`  ⚠️  Skipping: Missing Token or Paymaster (Jason) for scenario.`);
        return;
    }

    console.log(`  ℹ️  User: ${account.address}`);
    console.log(`  ℹ️  Paymaster: ${pmAddr} (V4)`);

    try {
        const client = new UserClient({
            client: createWalletClient({
                chain: config.chain,
                transport: http(config.rpcUrl),
                account
            }),
            publicClient: undefined,
            accountAddress: account.address,
            entryPointAddress: config.contracts.entryPoint,
            registryAddress: config.contracts.registry,
            gTokenStakingAddress: config.contracts.gTokenStaking,
            gTokenAddress: config.contracts.gToken
        });

        // 2. Fund User with GasToken (aPNTs) - Needs Supplier/Operator to mint
        // We use "Jason" key to mint aPNTs to New User.
        const jasonKey = process.env.PRIVATE_KEY_JASON as `0x${string}`;
        if (!jasonKey) throw new Error('Missing Jason key for funding');
        const jason = privateKeyToAccount(jasonKey);
        
        console.log(`  ➡️  Funding User with aPNTs (via Jason)...`);
        const token = tokenActions();
        const jasonClient = createWalletClient({ chain: config.chain, transport: http(config.rpcUrl), account: jason });
        
        const mintHash = await token(jasonClient).mint({
            token: tokenAddr,
            to: account.address,
            amount: parseEther('100'),
            account: jason
        });
        await (client.getStartPublicClient() as any).waitForTransactionReceipt({ hash: mintHash });
        console.log(`  ✅ Funded 100 aPNTs`);

        // 3. Fund User with GToken (for Staking) - Needs Supplier
        console.log(`  ➡️  Funding User with GToken (via Supplier)...`);
        const supplierKey = process.env.PRIVATE_KEY_SUPPLIER as `0x${string}` || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'; // Anvil default
        const supplier = privateKeyToAccount(supplierKey);
        const supplierClient = createWalletClient({ chain: config.chain, transport: http(config.rpcUrl), account: supplier });
        
        const gMintHash = await token(supplierClient).mint({
             token: config.contracts.gToken,
             to: account.address,
             amount: parseEther('100'),
             account: supplier
        });
        await (client.getStartPublicClient() as any).waitForTransactionReceipt({ hash: gMintHash });
        console.log(`  ✅ Funded 100 GToken`);

        // 4. Approve Paymaster to spend aPNTs (Gas)
        console.log(`  ➡️  Approving aPNTs to Paymaster...`);
        // Fund ETH for approvals
        await supplierClient.sendTransaction({ to: account.address, value: parseEther('0.05') });
        console.log(`  💰 Funded 0.05 ETH for approvals`);

        const approveHash = await token(client.client as any).approve({
            token: tokenAddr,
            spender: pmAddr,
            amount: parseEther('100'),
            account
        });
        await (client.getStartPublicClient() as any).waitForTransactionReceipt({ hash: approveHash });
        console.log(`  ✅ Approved aPNTs`);
        
        // Approve GToken for Staking
         const stakeApproveHash = await token(client.client as any).approve({
            token: config.contracts.gToken,
            spender: config.contracts.gTokenStaking,
            amount: parseEther('100'),
            account
        });
        await (client.getStartPublicClient() as any).waitForTransactionReceipt({ hash: stakeApproveHash });
        console.log(`  ✅ Approved GToken`);


        // 5. Execute Gasless Registration
        console.log(`  ➡️  Executing Gasless Registration...`);
        
        // Prepare Call Data: registerRoleSelf(ROLE_COMMUNITY, "0x")
        const { registryActions } = await import('../../packages/core/dist/index.js');
        const { RegistryABI } = await import('../../packages/core/dist/abis/index.js');
        const roleComm = await registryActions(config.contracts.registry)(client.getStartPublicClient()).ROLE_COMMUNITY();
        
        const { encodeFunctionData } = await import('viem');
        const data = encodeFunctionData({
            abi: RegistryABI,
            functionName: 'registerRoleSelf',
            args: [roleComm, '0x']
        });

        const userOpHash = await client.executeGasless({
            target: config.contracts.registry,
            value: 0n,
            data: data,
            paymaster: pmAddr,
            paymasterType: 'V4'
        });
        
        console.log(`     #️⃣  UserOp Hash: ${userOpHash}`);
        console.log(`  ✅ Gasless Registration Submitted`);
        
        // Wait? 
        await new Promise(r => setTimeout(r, 5000));
        
        const hasRole = await registryActions(config.contracts.registry)(client.getStartPublicClient()).hasRole({
            user: account.address,
            roleId: roleComm
        });
        
        if (hasRole) {
             console.log(`  🎉 SUCCESS: User has ROLE_COMMUNITY`);
        } else {
             console.log(`  ❌ FAILURE: User does NOT have ROLE_COMMUNITY`);
        }

    } catch (e: any) {
        console.log(`  ❌ Scenario Failed: ${e.message}`);
    }
}
