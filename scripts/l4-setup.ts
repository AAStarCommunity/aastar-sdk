
import * as fs from 'fs';
import * as path from 'path';
import { createPublicClient, createWalletClient, http, type Hex, parseEther, formatEther, type Address, encodeAbiParameters, parseAbiParameters } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { loadNetworkConfig } from '../tests/regression/config';
import { 
    tokenActions, 
    registryActions, 
    xPNTsFactoryActions,
    paymasterFactoryActions,
} from '../packages/core/dist/index.js';
import { CommunityClient } from '../packages/enduser/dist/CommunityClient.js';
import { PaymasterOperatorClient } from '../packages/operator/dist/PaymasterOperatorClient.js';

// State File for Idempotency
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATE_FILE = path.resolve(__dirname, 'l4-state.json');

// --- Sync Deployment First ---
import { execSync } from 'child_process';
import * as dotenv from 'dotenv';
const DEPLOY_SYNC_SCRIPT = path.resolve(__dirname, 'deploy-sync.ts');

/*
try {
    console.log('🔄 Running Deployment Sync...');
    // Pass through arguments like --redeploy
    const args = process.argv.slice(2).join(' ');
    execSync(`pnpm tsx ${DEPLOY_SYNC_SCRIPT} ${args}`, { stdio: 'inherit' });
} catch (e) {
    console.error('❌ Deployment Sync Failed');
    process.exit(1);
}
*/

// Load Updated Config
// dotenv.config loaded in main() based on network

interface OperatorState {
    communityId?: bigint;
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
    if (fs.existsSync(STATE_FILE)) {
        return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    }
    return { jason: {}, bob: {}, anni: {} };
}

function saveState(state: L4State) {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

async function main() {
    // Parse network arg
    const networkArg = process.argv.find(arg => arg.startsWith('--network='))?.split('=')[1] || 'sepolia';
    const config = loadNetworkConfig(networkArg);
    console.log(`\n🚀 Starting L4 Environment Setup on ${config.name}...`);
    
    // Load config relative to network
    dotenv.config({ path: path.resolve(__dirname, `../.env.${networkArg}`), override: true });
    
    const state = loadState();

    const publicClient = createPublicClient({
        chain: config.chain,
        transport: http(config.rpcUrl)
    });

    if (!config.supplierAccount) throw new Error('PRIVATE_KEY_SUPPLIER required');
    
    const supplier = privateKeyToAccount(config.supplierAccount.privateKey);
    const supplierClient = createWalletClient({ account: supplier, chain: config.chain, transport: http(config.rpcUrl) });

    let keyJason = process.env.PRIVATE_KEY_JASON as Hex;
    let keyBob = process.env.PRIVATE_KEY_BOB as Hex;
    let keyAnni = process.env.PRIVATE_KEY_ANNI as Hex;

    if (config.name === 'anvil') {
        if (!keyJason) keyJason = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'; // Account #1
        if (!keyBob) keyBob = '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a';   // Account #2
        if (!keyAnni) keyAnni = '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6';  // Account #3
        console.log(`  ⚠️  Using Anvil Default Keys for Operators`);
    }

    if (!keyJason || !keyBob || !keyAnni) throw new Error('Missing Operator Keys in ENV');

    const opJason = privateKeyToAccount(keyJason);
    const opBob = privateKeyToAccount(keyBob);
    const opAnni = privateKeyToAccount(keyAnni);

    const clientJason = createWalletClient({ account: opJason, chain: config.chain, transport: http(config.rpcUrl) });
    const clientBob = createWalletClient({ account: opBob, chain: config.chain, transport: http(config.rpcUrl) });
    const clientAnni = createWalletClient({ account: opAnni, chain: config.chain, transport: http(config.rpcUrl) });

    // --- Helpers ---
    const ensureETH = async (target: Hex, name: string, minEth: string = '0.05') => {
        const bal = await publicClient.getBalance({ address: target });
        // console.log(`  Checking ${name} ETH: ${formatEther(bal)}`);
        if (bal < parseEther(minEth)) {
            console.log(`  ⛽ Funding ${name} with 0.1 ETH...`);
            const hash = await supplierClient.sendTransaction({
                to: target,
                value: parseEther('0.1')
            });
            await publicClient.waitForTransactionReceipt({ hash });
            console.log(`  ✅ Funded`);
        }
    };

    const gToken = tokenActions();
    const ensureGToken = async (target: Hex, name: string, amount: bigint) => {
        const bal = await gToken(publicClient).balanceOf({ 
            token: config.contracts.gToken, 
            account: target 
        });
        if (bal < amount) {
            console.log(`  🪙 Minting ${formatEther(amount - bal)} GToken to ${name}...`);
            const hash = await gToken(supplierClient).mint({
                token: config.contracts.gToken,
                to: target,
                amount: amount - bal,
                account: supplier
            });
            await publicClient.waitForTransactionReceipt({ hash });
            console.log(`  ✅ Minted`);
        }
    };

    // --- 1. Funding ---
    console.log(`\n💰 1. Ensuring Funds...`);
    await ensureETH(opJason.address, 'Jason');
    await ensureETH(opBob.address, 'Bob');
    await ensureETH(opAnni.address, 'Anni');

    await ensureGToken(opJason.address, 'Jason', parseEther('100000'));
    await ensureGToken(opBob.address, 'Bob', parseEther('100000'));
    await ensureGToken(opAnni.address, 'Anni', parseEther('200000'));

    // --- 2. Community & Token Setup ---
    const factory = xPNTsFactoryActions(config.contracts.xPNTsFactory);
    const registry = registryActions(config.contracts.registry);
    const pmFactory = paymasterFactoryActions(config.contracts.paymasterFactory);
    const ROLE_COMMUNITY = await registry(publicClient).ROLE_COMMUNITY();
    const ROLE_PAYMASTER_SUPER = await registry(publicClient).ROLE_PAYMASTER_SUPER();

    // Check Default Paymaster Version
    let paymasterVersion = 'V4.0.0';
    try {
        const v = await publicClient.readContract({
            address: config.contracts.paymasterFactory,
            abi: paymasterFactoryActions(config.contracts.paymasterFactory).abi || [
                { type: 'function', name: 'defaultVersion', inputs: [], outputs: [{ type: 'string' }], stateMutability: 'view' }
            ],
            functionName: 'defaultVersion',
            args: []
        }) as string;
        paymasterVersion = v;
        console.log(`  ℹ️  Paymaster Default Version: ${paymasterVersion}`);
    } catch (e) {
        console.log(`  ⚠️  Could not fetch default Paymaster version, using fallback: ${paymasterVersion}`);
    }

    // Generic Setup Function
    const setupOperator = async (
        name: string, 
        client: any, 
        account: any, 
        opState: OperatorState,
        tokenSymbol: string,
        tokenName: string,
        paymasterType: 'V4' | 'Super'
    ) => {
        console.log(`\n🏗️  Setting up ${name} (${tokenSymbol})...`);
        
        // A. Register Community Role (using L2 CommunityClient API)
        const isCommunity = await registry(publicClient).hasRole({ user: account.address, roleId: ROLE_COMMUNITY });
        if (!isCommunity) {
            console.log(`  📝 Registering Community Role...`);
            try {
                // Use CommunityClient.registerAsCommunity() - it handles approval and encoding automatically
                const communityClient = new CommunityClient({
                    client: client,
                    publicClient: publicClient,
                    registryAddress: config.contracts.registry,
                    gTokenAddress: config.contracts.gToken,
                    gTokenStakingAddress: config.contracts.gTokenStaking
                });
                
                const hash = await communityClient.registerAsCommunity({
                    name: name,
                    description: `${name} Community for testing`
                });
                await publicClient.waitForTransactionReceipt({ hash });
                console.log(`  ✅ Community Role Granted`);
            } catch (e: any) {
                if (e.message.includes('RoleAlreadyGranted')) {
                    console.log(`  ✅ Already Granted (caught Error)`);
                } else {
                    console.log(`  ⚠️  Registration Warning: ${e.message.split('\n')[0]}`);
                }
            }
        } else {
            // console.log(`  ✅ Already Community`);
        }

        // B. Deploy Token
        let tokenAddr = opState.tokenAddress;
        if (!tokenAddr) {
            // Check if already deployed on-chain
            const existing = await factory(publicClient).getTokenAddress({ community: account.address });
            if (existing && existing !== '0x0000000000000000000000000000000000000000') {
                 tokenAddr = existing;
                 console.log(`  ✅ Found Token: ${tokenAddr}`);
            } else {
                console.log(`  🏭 Deploying ${tokenSymbol}...`);
                try {
                    const hash = await factory(client).createToken({
                        name: tokenName,
                        symbol: tokenSymbol,
                        community: account.address,
                        account: account
                    });
                    await publicClient.waitForTransactionReceipt({ hash });
                    // Fetch address
                    tokenAddr = await factory(publicClient).getTokenAddress({ community: account.address });
                    console.log(`  ✅ Token Deployed: ${tokenAddr}`);
                } catch (e: any) {
                    console.log(`  ⚠️  Deploy warning: ${e.message.split('\n')[0]}`);
                }
            }
            opState.tokenAddress = tokenAddr;
        } else {
             console.log(`  ✅ Token cached: ${tokenAddr}`);
        }

        // C. Paymaster Setup
        let pmAddr = opState.paymasterAddress;
        
        // Init Operator Client
        const opClient = new PaymasterOperatorClient({
            client: client,
            publicClient: publicClient,
            superPaymasterAddress: config.contracts.superPaymaster,
            tokenAddress: tokenAddr,
            xpntsFactoryAddress: config.contracts.xPNTsFactory,
            registryAddress: config.contracts.registry,
            entryPointAddress: config.contracts.entryPoint
        });

        if (paymasterType === 'V4') {
             if (!pmAddr || pmAddr === '0x0000000000000000000000000000000000000000') {
                console.log(`  ⛽ Deploying PaymasterV4 (via SDK)...`);
                try {
                    // Use SDK high-level API
                    // Note: deployAndRegisterPaymasterV4 handles prerequisites and initData encoding
                    const result = await opClient.deployAndRegisterPaymasterV4({
                        version: paymasterVersion,
                        stakeAmount: parseEther('1000') // Stake 1000 GToken
                    });
                    
                    pmAddr = result.paymasterAddress;
                    console.log(`  ✅ PaymasterV4 Deployed: ${pmAddr}`);
                    console.log(`  ✅ Role Registered: AOA`);
                } catch (e: any) {
                    if (e.message.includes('Already has ROLE_PAYMASTER_AOA')) {
                        console.log(`  ✅ Already Registered AOA`);
                        // Try to fetch PM address if we missed it
                         pmAddr = await paymasterFactoryActions(config.contracts.paymasterFactory)(publicClient).getPaymaster({ owner: account.address });
                         console.log(`  ✅ PaymasterV4 Found: ${pmAddr}`);
                    } else {
                        console.log(`  ⚠️  Deploy Error: ${e.message.split('\n')[0]}`);
                    }
                }
                opState.paymasterAddress = pmAddr;
             } else {
                console.log(`  ✅ PaymasterV4 cached: ${pmAddr}`);
             }
        } else if (paymasterType === 'Super') {
             // Register as SuperPaymaster Operator
             console.log(`  🦸 Registering SuperPaymaster Operator...`);
             try {
                 await opClient.registerAsSuperPaymasterOperator({
                     stakeAmount: parseEther('1000'),
                     depositAmount: parseEther('0') // Deposit later or separate step
                 });
                 console.log(`  ✅ SuperPaymaster Operator Registered`);
             } catch (e: any) {
                 if (e.message.includes('Already registered')) {
                     console.log(`  ✅ Already Registered`);
                 } else {
                     console.log(`  ⚠️  Register Error: ${e.message.split('\n')[0]}`);
                 }
             }
             opState.superPaymasterAddress = config.contracts.superPaymaster; // Global instance
        }
    };
    
    // Configs from Plan
    await setupOperator('AAStar', clientJason, opJason, state.jason, 'aPNTs', 'AAStar Token', 'V4');
    await setupOperator('Bread', clientBob, opBob, state.bob, 'bPNTs', 'Bread Token', 'V4');
    await setupOperator('Demo', clientAnni, opAnni, state.anni, 'cPNTs', 'Demo Token', 'Super');
    
    saveState(state);
    console.log(`\n💾 State saved to l4-state.json`);
}

main().catch(console.error);
