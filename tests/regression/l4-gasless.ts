import * as fs from 'fs';
import * as path from 'path';
import { createPublicClient, createWalletClient, http, type Hex, parseEther, formatEther, type Address, type Hash, type Account } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { loadNetworkConfig, type NetworkConfig } from './config';
import { 
    tokenActions, 
    paymasterFactoryActions, 
    xPNTsFactoryActions,
    communityActions,
    registryActions
} from '../../packages/core/dist/index.js';
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
    const publicClient = createPublicClient({ chain: config.chain, transport: http(config.rpcUrl) });

    // --- Scenario A: Jason (AAStar) - PaymasterV4 ---
    await runPaymasterV4Scenario('Jason (AAStar)', 'jason', state.jason, config, publicClient);

    // --- Scenario B: Bob (Bread) - PaymasterV4 ---
    await runPaymasterV4Scenario('Bob (Bread)', 'bob', state.bob, config, publicClient);

    // --- Scenario C: Anni (Demo) - SuperPaymasterV3 ---
    await runSuperPaymasterScenario('Anni (Demo)', 'anni', state.anni, config, publicClient);
}

async function runPaymasterV4Scenario(
    name: string, 
    keyName: string, 
    opState: OperatorState, 
    config: NetworkConfig,
    publicClient: any
) {
    console.log(`\n👤 === Scenario: ${name} with PaymasterV4 ===`);
    
    // Logging Helpers
    const logStep = (msg: string) => console.log(`  ➡️  ${msg}`);
    const logSuccess = (msg: string) => console.log(`  ✅ ${msg}`);
    const logInfo = (msg: string) => console.log(`  ℹ️  ${msg}`);
    const logTx = (hash: Hash) => {
        const baseUrl = config.name === 'sepolia' ? 'https://sepolia.etherscan.io/tx/' : 'https://etherscan.io/tx/';
        console.log(`     #️⃣  Hash: ${hash}`);
        console.log(`     🔗 Link: ${baseUrl}${hash}`);
    };

    // 1. Setup Client
    const keyEnv = `PRIVATE_KEY_${keyName.toUpperCase()}`;
    const key = process.env[keyEnv] as Hex;
    if (!key) {
        console.log(`  ⚠️  Skipping ${name}: Missing ${keyEnv}`);
        return;
    }
    const account = privateKeyToAccount(key);
    const client = createWalletClient({ account, chain: config.chain, transport: http(config.rpcUrl) });
    
    const tokenAddr = opState.tokenAddress;
    const pmAddr = opState.paymasterAddress;

    if (!tokenAddr || !pmAddr) {
        console.log(`  ⚠️  Skipping: Missing Token or Paymaster in state.`);
        return; 
    }

    logInfo(`Token: ${tokenAddr}`);
    logInfo(`Paymaster: ${pmAddr}`);

    // Mint Token to self
    logStep(`Minting xPNTs to self...`);
    try {
        const hash = await client.writeContract({
            address: tokenAddr,
            abi: [{ type: 'function', name: 'mint', inputs: [{name: 'to', type: 'address'}, {name: 'amount', type: 'uint256'}], outputs: [], stateMutability: 'nonpayable' }],
            functionName: 'mint',
            args: [account.address, parseEther('10')],
            account
        });
        logTx(hash);
        await publicClient.waitForTransactionReceipt({ hash });
        logSuccess(`Minted 10 xPNTs to self`);
    } catch (e: any) {
        console.log(`  ❌ Mint Failed: ${e.message.split('\n')[0]}`);
    }

    // Check Paymaster Deposit on EntryPoint
    const entryPoint = '0x0000000071727De22E5E9d8BAf0edAc6f37da032';
    logStep(`Checking Paymaster Deposit on EntryPoint...`);
    try {
        const deposit = await publicClient.readContract({
            address: entryPoint,
            abi: [{ type: 'function', name: 'balanceOf', inputs: [{name: 'account', type: 'address'}], outputs: [{type: 'uint256'}], stateMutability: 'view' }],
            functionName: 'balanceOf',
            args: [pmAddr]
        }) as bigint;
        
        logInfo(`Deposit: ${formatEther(deposit)} ETH`);
        
        if (deposit < parseEther('0.01')) {
            logStep(`Depositing ETH to EntryPoint for Paymaster...`);
            try {
                const hash = await client.writeContract({
                    address: entryPoint,
                    abi: [{ type: 'function', name: 'depositTo', inputs: [{name: 'account', type: 'address'}], outputs: [], stateMutability: 'payable' }],
                    functionName: 'depositTo',
                    args: [pmAddr],
                    value: parseEther('0.02'),
                    account
                });
                logTx(hash);
                await publicClient.waitForTransactionReceipt({ hash });
                logSuccess(`Deposited 0.02 ETH`);
            } catch (e: any) {
                 console.log(`  ❌ Deposit Trx Failed: ${e.message.split('\n')[0]}`);
            }
        }
    } catch (e: any) {
         console.log(`  ⚠️  EP Deposit Check Failed: ${e.message.split('\n')[0]}`);
    }
}

async function runSuperPaymasterScenario(
    name: string, 
    keyName: string, 
    opState: OperatorState, 
    config: NetworkConfig,
    publicClient: any
) {
    console.log(`\n👤 === Scenario: ${name} with SuperPaymasterV3 ===`);
    
    // Logging Helpers
    const logStep = (msg: string) => console.log(`  ➡️  ${msg}`);
    const logSuccess = (msg: string) => console.log(`  ✅ ${msg}`);
    const logInfo = (msg: string) => console.log(`  ℹ️  ${msg}`);
    const logTx = (hash: Hash) => {
        const baseUrl = config.name === 'sepolia' ? 'https://sepolia.etherscan.io/tx/' : 'https://etherscan.io/tx/';
        console.log(`     #️⃣  Hash: ${hash}`);
        console.log(`     🔗 Link: ${baseUrl}${hash}`);
    };

    const keyEnv = `PRIVATE_KEY_${keyName.toUpperCase()}`;
    const key = process.env[keyEnv] as Hex;
    if (!key) {
        console.log(`  ⚠️  Skipping ${name}: Missing ${keyEnv}`);
        return;
    }
    const account = privateKeyToAccount(key);
    const client = createWalletClient({ account, chain: config.chain, transport: http(config.rpcUrl) });
    
    const tokenAddr = opState.tokenAddress;
    const spmAddr = opState.superPaymasterAddress || config.contracts.superPaymaster;

    logInfo(`Token: ${tokenAddr}`);
    logInfo(`SuperPaymaster: ${spmAddr}`);

    // 1. Mint Token (cPNTs) to self
    logStep(`Minting cPNTs to self...`);
    try {
        const hash = await client.writeContract({
            address: tokenAddr!,
            abi: [{ type: 'function', name: 'mint', inputs: [{name: 'to', type: 'address'}, {name: 'amount', type: 'uint256'}], outputs: [], stateMutability: 'nonpayable' }],
            functionName: 'mint',
            args: [account.address, parseEther('50')],
            account
        });
        logTx(hash);
        await publicClient.waitForTransactionReceipt({ hash });
        logSuccess(`Minted 50 cPNTs`);
    } catch (e: any) {
        console.log(`  ❌ Mint Failed: ${e.message.split('\n')[0]}`);
    }

    // 2. Deposit (No Approve Needed for Gasless Tokens)
    // logStep(`Approving cPNTs for SuperPaymaster...`);
    // ... removed ... 
        
        logStep(`Depositing cPNTs to SuperPaymaster...`);
        try {
             // Try depositFor via generic write
             const hashDep = await client.writeContract({
                address: spmAddr!,
                abi: [{ 
                    type: 'function', 
                    name: 'depositFor', 
                    inputs: [
                        {name: 'token', type: 'address'}, 
                        {name: 'account', type: 'address'}, 
                        {name: 'amount', type: 'uint256'}
                    ], 
                    outputs: [], 
                    stateMutability: 'nonpayable' 
                }],
                functionName: 'depositFor',
                args: [tokenAddr!, account.address, parseEther('10')],
                account
            });
            logTx(hashDep);
            await publicClient.waitForTransactionReceipt({ hash: hashDep });
            logSuccess(`Deposited 10 cPNTs Credit`);
        } catch (e: any) {
             console.log(`  ⚠️  Deposit Failed: ${e.message.split('\n')[0]}`);
        }


}
