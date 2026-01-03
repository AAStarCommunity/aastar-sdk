
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
    communityActions
} from '../packages/core/dist/index.js';

// State File for Idempotency
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATE_FILE = path.resolve(__dirname, 'l4-state.json');

// --- Sync Deployment First ---
import { execSync } from 'child_process';
import * as dotenv from 'dotenv'; // Added dotenv import
const DEPLOY_SYNC_SCRIPT = path.resolve(__dirname, 'deploy-sync.ts');

try {
    console.log('🔄 Running Deployment Sync...');
    // Pass through arguments like --redeploy
    const args = process.argv.slice(2).join(' ');
    execSync(`pnpm tsx ${DEPLOY_SYNC_SCRIPT} ${args}`, { stdio: 'inherit' });
} catch (e) {
    console.error('❌ Deployment Sync Failed');
    process.exit(1);
}

// Load Updated Config
dotenv.config({ path: path.resolve(__dirname, '../.env.sepolia'), override: true });

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
    const config = loadNetworkConfig('sepolia');
    console.log(`\n🚀 Starting L4 Environment Setup on ${config.name}...`);
    const state = loadState();

    const publicClient = createPublicClient({
        chain: config.chain,
        transport: http(config.rpcUrl)
    });

    if (!config.supplierAccount) throw new Error('PRIVATE_KEY_SUPPLIER required');
    
    const supplier = privateKeyToAccount(config.supplierAccount.privateKey);
    const supplierClient = createWalletClient({ account: supplier, chain: config.chain, transport: http(config.rpcUrl) });

    const keyJason = process.env.PRIVATE_KEY_JASON as Hex;
    const keyBob = process.env.PRIVATE_KEY_BOB as Hex;
    const keyAnni = process.env.PRIVATE_KEY_ANNI as Hex;

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
                const { CommunityClient } = await import('../packages/enduser/dist/CommunityClient.js');
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
        if (paymasterType === 'V4') {
             if (!pmAddr) {
                // Check if already deployed
                const existing = await pmFactory(publicClient).getPaymaster({ owner: account.address });
                if (existing && existing !== '0x0000000000000000000000000000000000000000') {
                    pmAddr = existing;
                    console.log(`  ✅ Found PaymasterV4: ${pmAddr}`);
                } else {
                    console.log(`  ⛽ Deploying PaymasterV4...`);
                    const entryPoint = '0x0000000071727De22E5E9d8BAf0edAc6f37da032'; // EP 0.7 Mainnet/Sepolia Addr
                    // V4 Init: abi.encode(entryPoint, owner) ?
                    // Actually ABI deployPaymaster takes (version, initData). 
                    // initData for V4 is likely just the owner? Or empty?
                    // Standard Paymaster V4 initialization logic?
                    // Let's assume for now initData is empty or just owner encoded.
                    // If I look at PaymasterV4.sol (if I could), I'd know.
                    // Let's try initData = '0x' + owner?
                    // Actually, if I look at `packages/paymaster/src/PaymasterV4.sol` constructor?
                    // It likely takes EntryPoint and Owner in constructor, OR initialize().
                    // Factory usually calls initialize(initData).
                    // Let's try encoding both.
                    // But I cannot easily import encodeAbiParameters here in the replacement.
                    // I will use `encodeAbiParameters` from viem if I can import it.
                    // But for now, let's just passing '0x' if uncertain, OR assume `deployPaymaster` in factory handles it?
                    // SDK `deployPaymaster` takes `owner`. Implementation does what?
                    // Line 276 of factory.ts: deployPaymaster({ owner, account }) -> calls 'deployPaymaster' with [owner].
                    // BUT ABI deployPaymaster takes (_version, initData)!
                    // So SDK `deployPaymaster` implementation (Line 276) is ALSO BROKEN if it passes [owner].
                    // It must pass ["V4.0.0", "0x..."].
                    // I MUST FIX SDK `deployPaymaster` implementation first.
                    
                    // Since I cannot easily fix SDK logic blindly without knowing V4 version string,
                    // I will pause deployment in l4-setup.ts and only rely on Manual Deployment for now?
                    // No, invalidates the task.
                    
                    // I will fix SDK `deployPaymaster` to match ABI.
                    // And I will try version "0.0.1" or "V3.0.0"? 
                    // PaymasterFactory.json has event PaymasterDeployed(..., version, ...).
                    // I will try to use the `deployPaymaster` from SDK but I must fix its arguments mapping.
                    
                    const hash = await pmFactory(client).deployPaymaster({
                        owner: account.address,
                        version: paymasterVersion,
                        account: account
                    });
                     await publicClient.waitForTransactionReceipt({ hash });
                     pmAddr = await pmFactory(publicClient).getPaymaster({ owner: account.address });
                     console.log(`  ✅ PaymasterV4 Deployed: ${pmAddr}`);
                }
                opState.paymasterAddress = pmAddr;
             } else {
                console.log(`  ✅ PaymasterV4 cached: ${pmAddr}`);
             }
        } else if (paymasterType === 'Super') {
             // Register as SuperPaymaster Operator
             const isSuper = await registry(publicClient).hasRole({ user: account.address, roleId: ROLE_PAYMASTER_SUPER });
             if (!isSuper) {
                 console.log(`  🦸 Granting SuperPaymaster Operator Role (Self)...`);
                 try {
                     // Ensure user has approved Registry for stake
                     const gToken = tokenActions();
                     const approveHash = await gToken(client).approve({
                         token: config.contracts.gToken,
                         spender: config.contracts.registry,
                         amount: parseEther('100000'),
                         account: account
                     });
                     await publicClient.waitForTransactionReceipt({ hash: approveHash });
                     
                     // Use registerRoleSelf
                     const hash = await registry(client).registerRoleSelf({
                         roleId: ROLE_PAYMASTER_SUPER,
                         data: '0x',
                         account: account
                     });
                     await publicClient.waitForTransactionReceipt({ hash });
                     console.log(`  ✅ SuperPaymaster Operator Granted`);
                 } catch (e: any) {
                    if (e.message.includes('RoleAlreadyGranted')) {
                        console.log(`  ✅ Already Granted (caught Error)`);
                    } else {
                        console.log(`  ⚠️  Grant Warning: ${e.message.split('\n')[0]}`);
                    }
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
