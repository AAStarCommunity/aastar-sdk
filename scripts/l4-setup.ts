
import * as fs from 'fs';
import * as path from 'path';
import { 
    createPublicClient, 
    createWalletClient, 
    http, 
    parseEther, 
    formatEther, 
    type Address, 
    type Hex,
    parseAbi,
    type Hash,
    getContract,
    keccak256,
    toBytes,
    encodeFunctionData,
    encodeAbiParameters
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { loadNetworkConfig } from '../tests/regression/config';
import { 
    tokenActions, 
    gTokenActions,
    registryActions, 
    xPNTsFactoryActions,
    paymasterFactoryActions,
    accountFactoryActions,
    paymasterActions,
    superPaymasterActions,
    entryPointActions,
    accountActions,
    EntryPointVersion,
    RegistryABI
} from '../packages/core/src/index.js';
import { CommunityClient, UserClient } from '../packages/enduser/src/index.js';
import { PaymasterOperatorClient } from '../packages/operator/src/PaymasterOperatorClient.js';
import {
    UserOperationBuilder,
    UserOpScenarioBuilder,
    UserOpScenarioType
} from '../packages/sdk/src/index.js';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';
// import { loadContract } from './00_utils.js'; 

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATE_FILE = path.resolve(__dirname, 'l4-state.json');

// --- Helper: Console Table ---
function printTable(title: string, data: any[]) {
    console.log(`\n📋 ${title}`);
    console.table(data);
}

// Network Defaults: simpleAccountFactory (Pimlico 0.7) and priceFeed (Chainlink ETH/USD)
const NETWORK_DEFAULTS: Record<string, { simpleAccountFactory: Address, priceFeed: Address }> = {
    'sepolia': {
        simpleAccountFactory: '0x91E60e0613810449d098b0b5Ec8b51A0FE8c8985',
        priceFeed: '0x694AA1769357215DE4FAC081bf1f309aDC325306'
    },
    'mainnet': {
        simpleAccountFactory: '0x91E60e0613810449d098b0b5Ec8b51A0FE8c8985',
        priceFeed: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419'
    },
    'optimism': {
        simpleAccountFactory: '0x91E60e0613810449d098b0b5Ec8b51A0FE8c8985',
        priceFeed: '0x13e3Ee699D1909E989722E753853AE30b17e08c5'
    }
};

/**
 * Ensures the network config JSON is up-to-date with essential addresses
 */
async function syncConfig(network: string, config: any) {
    const defaults = NETWORK_DEFAULTS[network];
    if (!defaults) return;

    let changed = false;
    // Load fresh JSON to avoid mixing with env fallback from loadNetworkConfig
    const configPath = path.resolve(process.cwd(), `config.${network}.json`);
    let rawConfig: any = {};
    if (fs.existsSync(configPath)) {
        rawConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }

    if (!rawConfig.simpleAccountFactory || rawConfig.simpleAccountFactory === '0x0000000000000000000000000000000000000000') {
        rawConfig.simpleAccountFactory = defaults.simpleAccountFactory;
        config.contracts.simpleAccountFactory = defaults.simpleAccountFactory;
        changed = true;
    }
    if (!rawConfig.priceFeed || rawConfig.priceFeed === '0x0000000000000000000000000000000000000000') {
        rawConfig.priceFeed = defaults.priceFeed;
        config.contracts.priceFeed = defaults.priceFeed;
        changed = true;
    }

    if (changed) {
        console.log(`  📝 Updating ${configPath} with default addresses...`);
        fs.writeFileSync(configPath, JSON.stringify(rawConfig, null, 2));
    }
}

async function main() {
    // Helper to check and fund ETH
    const checkAndFund = async (target: Address, minEth: string) => {
        let bal = await publicClient.getBalance({ address: target });
        if (bal < parseEther(minEth)) {
            console.log(`   ⛽ Funding ${target} with ${minEth} ETH...`);
            const hash = await supplierClient.sendTransaction({
                to: target,
                value: parseEther(minEth),
                account: supplier
            });
            await publicClient.waitForTransactionReceipt({ hash });
            
            // Latency Resilience: Wait and retry check
            console.log(`      ⏳ Waiting for balance update (latency check)...`);
            for (let i = 0; i < 5; i++) {
                await new Promise(r => setTimeout(r, 2000));
                bal = await publicClient.getBalance({ address: target });
                if (bal >= parseEther(minEth)) {
                    console.log(`      ✅ Balance updated: ${formatEther(bal)} ETH`);
                    return;
                }
                console.log(`      ... still waiting (${i+1}/5)`);
            }
            throw new Error(`Funding Failed: Balance mismatch for ${target} after 10s`);
        }
    };
    
    // 1. Load Config & ENV
    const networkArg = process.argv.find(arg => arg.startsWith('--network='))?.split('=')[1];
    if (!networkArg) {
        console.error("❌ Please provide --network argument (e.g., --network=sepolia)");
        process.exit(1);
    }
    
    const config = loadNetworkConfig(networkArg as any);
    await syncConfig(networkArg, config);
    console.log(`\n🚀 Starting L4 Assessment & Setup on ${config.name}...`);
    
    // Load .env
    const envPath = path.resolve(__dirname, `../.env.${networkArg}`);
    console.log(`  📂 Loading ENV from: ${envPath}`);
    dotenv.config({ path: envPath, override: true });

    const publicClient = createPublicClient({
        chain: config.chain,
        transport: http(config.rpcUrl)
    });

    if (!config.supplierAccount) throw new Error('PRIVATE_KEY_SUPPLIER required');
    const supplier = privateKeyToAccount(config.supplierAccount.privateKey);
    const supplierClient = createWalletClient({ account: supplier, chain: config.chain, transport: http(config.rpcUrl) });
    
    // 2. Output Core Addresses & EOA Status
    printTable("Core Contracts", Object.entries(config.contracts).map(([k, v]) => ({ Contract: k, Address: v })));
    
    const operators = [
        { name: 'Jason (AAStar)', key: (process.env.PRIVATE_KEY_JASON || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80') as Hex, role: 'Operator', symbol: 'aPNTs', pmType: 'V4' },
        { name: 'Bob (Bread)', key: (process.env.PRIVATE_KEY_BOB || '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d') as Hex, role: 'Operator', symbol: 'bPNTs', pmType: 'V4' },
        { name: 'Anni (Demo)', key: (process.env.PRIVATE_KEY_ANNI || '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a') as Hex, role: 'Operator', symbol: 'cPNTs', pmType: 'Super' },
        { name: 'Charlie (Test)', key: (process.env.PRIVATE_KEY_CHARLIE || '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6') as Hex, role: 'Operator', symbol: 'dPNTs', pmType: 'V4' },
    ].filter(op => op.key && op.key.startsWith('0x'));

    const registry = registryActions(config.contracts.registry);
    const gToken = gTokenActions();
    const xPNTsToken = tokenActions();
    const xpntsFactory = xPNTsFactoryActions(config.contracts.xPNTsFactory);
    const pmFactory = paymasterFactoryActions(config.contracts.paymasterFactory);

    console.log(`\n🔍 Checking & Repairing Operators...`);
    const operatorStatus: any[] = [];
    const communityMap: Record<string, { token: Address, pmV4?: Address }> = {};

    for (const op of operators) {
        const acc = privateKeyToAccount(op.key);
        const opClient = createWalletClient({ account: acc, chain: config.chain, transport: http(config.rpcUrl) });
        
        // 2a. Ensure Funds - 按文档要求: ≥0.1 ETH
        let ethBal = await publicClient.getBalance({ address: acc.address });
        if(ethBal < parseEther('0.1')) {
            console.log(`   ⛽ Funding ETH to ${op.name}...`);
            const h = await supplierClient.sendTransaction({ to: acc.address, value: parseEther('0.2') });
            await publicClient.waitForTransactionReceipt({hash:h});
            ethBal = await publicClient.getBalance({ address: acc.address });
        }
        
        // 2b. GToken - 按文档要求: Jason/Bob 100,000, Anni 200,000
        const requiredGToken = op.name.includes('Anni') ? parseEther('200000') : parseEther('100000');
        let gTokenBal = await gToken(publicClient).balanceOf({ token: config.contracts.gToken, account: acc.address });
        if(gTokenBal < requiredGToken) {
             const tokenOwner = await gToken(publicClient).owner({ token: config.contracts.gToken });
             console.log(`   🪙 Minting ${op.name.includes('Anni') ? '200,000' : '100,000'} GToken to ${op.name}...`);
             console.log(`      Address: ${acc.address}`);
             console.log(`      Supplier (Owner?): ${supplier.address}`);
             console.log(`      Actual Owner: ${tokenOwner}`);
             
             const mintAmount = requiredGToken - gTokenBal + parseEther('1000'); // 补足+额外buffer
             const h = await gToken(supplierClient).mint({ token: config.contracts.gToken, to: acc.address, amount: mintAmount, account: supplier });
             await publicClient.waitForTransactionReceipt({hash:h});
             gTokenBal = await gToken(publicClient).balanceOf({ token: config.contracts.gToken, account: acc.address });
        }

        // 2b. Check/Register Community
        let community = "None";
        const ROLE_COMMUNITY_ID = await registry(publicClient).ROLE_COMMUNITY();
        const isComm = await registry(publicClient).hasRole({ user: acc.address, roleId: ROLE_COMMUNITY_ID });
        if (isComm) {
            community = "Registered (Upstream)";
            console.log(`   ✓ ${op.name} already registered as Community (Upstream)`);
        } else {
             console.log(`   📝 Registering Community for ${op.name}...`);
             const commClient = new CommunityClient({
                 client: opClient, publicClient, 
                 registryAddress: config.contracts.registry,
                 gTokenAddress: config.contracts.gToken,
                 gTokenStakingAddress: config.contracts.gTokenStaking
             });
             try {
                 const h = await commClient.registerAsCommunity({ name: op.name.split(' ')[0] });
                 await publicClient.waitForTransactionReceipt({hash:h});
                 community = "Registered (New)";
             } catch(e:any) { community = `Error: ${e.message.split('\n')[0]}`; }
        }

        // 2c. Check/Deploy Token
        // Jason(AAStar)使用已部署的config.contracts.aPNTs,不需要通过xPNTsFactory部署新代币
        let token: string = "None";
        let tAddr: Address | null = null;
        
        if (op.name.includes('Jason')) {
            // Jason's aPNTs is the global aPNTs already deployed and configured in SuperPaymaster
            tAddr = config.contracts.aPNTs;
            token = tAddr;
            console.log(`   ✓ ${op.name} using pre-deployed aPNTs: ${tAddr}`);
        } else {
            // Bob and Anni deploy their own community tokens via xPNTsFactory
            // Pre-check: Ensure Community role is granted (required by factory contract)
            const hasCommRole = await registry(publicClient).hasRole({ 
                user: acc.address, 
                roleId: ROLE_COMMUNITY_ID 
            });
            
            if (!hasCommRole) {
                console.error(`   ❌ CRITICAL: ${op.name} NOT registered as Community! Skipping token deployment.`);
                token = "Community Role Missing";
                tAddr = null;
            } else {
                tAddr = await xpntsFactory(publicClient).getTokenAddress({ community: acc.address });
                if (!tAddr || tAddr === '0x0000000000000000000000000000000000000000') {
                     console.log(`   🏭 Deploying ${op.symbol} for ${op.name}...`);
                     try {
                         const h = await xpntsFactory(opClient).createToken({
                            name: `${op.symbol} Token`, symbol: op.symbol, community: acc.address, account: acc
                         });
                         console.log(`      📝 Deploy Tx: ${h}`);
                         await publicClient.waitForTransactionReceipt({hash:h});
                         
                         // Verify deployment
                         tAddr = await xpntsFactory(publicClient).getTokenAddress({ community: acc.address });
                         if (!tAddr || tAddr === '0x0000000000000000000000000000000000000000') {
                             throw new Error(`Token address still null after deployment`);
                         }
                         
                         console.log(`      ✅ Token Deployed: ${tAddr}`);
                         token = tAddr;
                     } catch(e:any) { 
                         console.error(`      ❌ Deployment FAILED: ${e.message}`);
                         if (e.data) console.error(`         Revert Data: ${e.data}`);
                         token = `Error: ${e.message.substring(0, 50)}...`;
                     }
                } else {
                    token = tAddr;
                    console.log(`   ✓ ${op.name} already has token: ${tAddr}`);
                }

                // Ensure operator has some tokens to deposit (Mint 1M tokens)
                try {
                    const balance = await publicClient.readContract({
                        address: tAddr,
                        abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
                        functionName: 'balanceOf',
                        args: [acc.address]
                    }) as bigint;
                    
                    if (balance < parseEther('10000')) {
                        console.log(`   🪙  Minting 1M ${op.symbol} to ${op.name}...`);
                        try {
                            const h = await opClient.writeContract({
                                address: tAddr,
                                abi: parseAbi(['function mint(address to, uint256 amount) external']),
                                functionName: 'mint',
                                args: [acc.address, parseEther('1000000')],
                                account: acc
                            });
                            await publicClient.waitForTransactionReceipt({ hash: h });
                            console.log(`      ✅ Minted 1M ${op.symbol}`);
                        } catch (mintErr: any) {
                            console.error(`      ❌ Mint Failed: ${mintErr.message}`);
                        }
                    }
                } catch (e: any) {
                    console.error(`      ⚠️  Balance Check Failed: ${e.message}`);
                }
            }
        }
        if(tAddr && token !== 'Error' && token !== 'None') communityMap[op.name] = { token: tAddr };

        // 2d. Check/Deploy Paymaster V4
        let pmV4 = "None";
        const operatorSdk = new PaymasterOperatorClient({
            client: opClient, publicClient,
            superPaymasterAddress: config.contracts.superPaymaster,
            tokenAddress: token as Address,
            xpntsFactoryAddress: config.contracts.xPNTsFactory,
            registryAddress: config.contracts.registry,
            entryPointAddress: config.contracts.entryPoint,
            gTokenAddress: config.contracts.gToken,
            gTokenStakingAddress: config.contracts.gTokenStaking,
            paymasterFactoryAddress: config.contracts.paymasterFactory,
            ethUsdPriceFeedAddress: config.contracts.priceFeed
        });

        if (op.pmType === 'V4') {
            let pAddr: Address | undefined;
            try {
                console.log(`   🔎 Checking Paymaster for ${op.name}...`);
                pAddr = await pmFactory(publicClient).getPaymaster({ owner: acc.address });
            } catch (e: any) {
                console.log(`   ⚠️ Error checking Paymaster: ${e.message}`);
                pAddr = undefined;
            }
            if (!pAddr || pAddr === '0x0000000000000000000000000000000000000000') {
                 console.log(`   ⛽ Deploying Paymaster V4 for ${op.name}...`);
                 try {
                     const res = await operatorSdk.deployAndRegisterPaymasterV4({ 
                         stakeAmount: parseEther('30'),
                         version: 'v4.2' 
                     });
                     pAddr = res.paymasterAddress;
                     pmV4 = pAddr;
                 } catch(e:any) { 
                     console.log(`      ⚠️ PM Deploy Failed: ${e.message}`);
                 }
            } else {
                pmV4 = pAddr;
                // 即使已部署，也检查是否在Registry注册过角色
                try {
                    const ROLE_AOA = await registry(publicClient).ROLE_PAYMASTER_AOA();
                    const hasRole = await registry(publicClient).hasRole({ user: acc.address, roleId: ROLE_AOA });
                    if (!hasRole) {
                        console.log(`   📝 Registering Paymaster V4 Role for ${op.name}...`);
                        await operatorSdk.deployAndRegisterPaymasterV4({
                            stakeAmount: parseEther('30'),
                            version: 'v4.2'
                        });
                    }
                } catch(e:any) { console.log(`      ⚠️ PM Role Check/Reg Failed: ${e.message}`); }
            }
            
            // ✅ Verify Paymaster Owner
            if(pmV4 && pmV4 !== 'None' && pmV4 !== 'N/A (Super)') {
                try {
                    const pmOwner = await publicClient.readContract({
                        address: pmV4 as Address,
                        abi: [{ name: 'owner', type: 'function', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' }],
                        functionName: 'owner'
                    }) as Address;
                    
                    if (pmOwner === acc.address) {
                        console.log(`   ✅ Paymaster Owner Verified: ${pmOwner}`);
                    } else if (pmOwner === '0x0000000000000000000000000000000000000000') {
                        console.log(`   ❌ Paymaster Owner is ZERO! Needs manual initialization.`);
                    } else {
                        console.log(`   ⚠️  Paymaster Owner Mismatch! Expected: ${acc.address}, Got: ${pmOwner}`);
                    }
                } catch(e:any) { 
                    console.log(`      ⚠️ Owner Check Failed: ${e.message}`); 
                }
            }
            
            // ✅ Ensure GToken support (V4 price set)
            if (pmV4 && pmV4 !== 'None' && pmV4 !== 'N/A (Super)') {
                const pmData = paymasterActions(pmV4 as Address);
                try {
                    const gTokenAddr = config.contracts.gToken;
                    const gPrice = await pmData(publicClient).tokenPrices({ token: gTokenAddr });
                    if (gPrice === 0n) {
                        console.log(`   🔧 Supporting GToken ($1.00) in ${op.name}'s Paymaster...`);
                        const h = await pmData(opClient).setTokenPrice({ 
                            token: gTokenAddr, 
                            price: 100000000n, // $1.00
                            account: acc 
                        });
                        await publicClient.waitForTransactionReceipt({ hash: h });
                    }

                    // Also set community token price
                    if (tAddr) {
                        const tPrice = await pmData(publicClient).tokenPrices({ token: tAddr as Address });
                        if (tPrice === 0n) {
                            console.log(`   🔧 Supporting ${op.name}'s Token ($1.00) in Paymaster...`);
                            const h = await pmData(opClient).setTokenPrice({
                                token: tAddr as Address,
                                price: 100000000n, // $1.00
                                account: acc
                            });
                            await publicClient.waitForTransactionReceipt({ hash: h });
                        }
                    }
                } catch (e) {
                    // console.log(`      ⚠️  Price Check skip: ${op.name}`);
                }
            }
            
            if(pmV4 && pmV4 !== 'None' && pmV4 !== 'N/A (Super)') {
                if (!communityMap[op.name]) {
                    communityMap[op.name] = { token: tAddr as Address };
                }
                communityMap[op.name].pmV4 = pmV4 as Address;
                console.log(`   📝 Registered ${op.name}'s Paymaster in map: ${pmV4}`);
            }
        } else {
            pmV4 = "N/A (Super)";
            try {
                const ROLE_SUPER = await registry(publicClient).ROLE_PAYMASTER_SUPER();
                const registered = await registry(publicClient).hasRole({ user: acc.address, roleId: ROLE_SUPER });
                if(!registered) {
                    console.log(`   📝 Registering SuperPM Role for Anni...`);
                    // Skip initial deposit during registration. 
                    // Refill Section 5c handles this when Anni has aPNTs.
                    await operatorSdk.registerAsSuperPaymasterOperator({
                        stakeAmount: parseEther('50'),
                        depositAmount: 0n 
                    });
                } else {
                    console.log(`   ✓ Anni already registered as SuperPaymaster Operator`);
                }
                
                // Verify operator config in SuperPaymaster
                // Verify operator config in SuperPaymaster
                const spActions = superPaymasterActions(config.contracts.superPaymaster);
                const opConfig = await spActions(publicClient).operators({ operator: acc.address });
                const opBalance = opConfig.aPNTsBalance;
                const isConfigured = opConfig.isConfigured;
                const xPNTsToken = opConfig.xPNTsToken;

                console.log(`      💰 aPNTs Balance: ${formatEther(opBalance || 0n)}`);
                console.log(`      ⚙️  Configured: ${isConfigured}`);

                // Fix if not configured (Anni case)
                if (!isConfigured || xPNTsToken === '0x0000000000000000000000000000000000000000') {
                    const anniToken = communityMap[op.name]?.token;
                    if (anniToken) {
                        console.log(`      🔧 Configuring SuperPM Operator Anni with token ${anniToken}...`);
                        const h = await operatorSdk.configureOperator(anniToken, acc.address, parseEther('1'));
                        await publicClient.waitForTransactionReceipt({ hash: h });
                        console.log(`      ✅ Operator Configured.`);
                    }
                }
            } catch(e:any) { console.log(`      ⚠️ SuperPM Role Check/Reg Failed: ${e.message}`); }
        }

        operatorStatus.push({
            Name: op.name,
            Address: acc.address,
            ETH: parseFloat(formatEther(ethBal)).toFixed(4),
            GToken: parseFloat(formatEther(gTokenBal)).toFixed(2),
            Community: community,
            Token: token,
            PM_V4: pmV4
        });
    }
    printTable("Operator Status", operatorStatus);

    // 2e. Jason mint aPNTs给Anni (用于SuperPaymaster存款) - 按文档要求: 100,000 aPNTs
    console.log(`\n🔄 Checking aPNTs for Anni's SuperPaymaster deposit...`);
    const jasonOp = operators.find(o => o.name.includes('Jason'));
    const anniOpData = operators.find(o => o.name.includes('Anni'));
    if (jasonOp && anniOpData && communityMap[jasonOp.name]?.token) {
        const jasonAcc = privateKeyToAccount(jasonOp.key);
        const anniAddr = privateKeyToAccount(anniOpData.key).address;
        const aPNTsToken = communityMap[jasonOp.name].token; // Jason's aPNTs
        
        const anniAPNTsBal = await gToken(publicClient).balanceOf({ token: aPNTsToken, account: anniAddr });
        const requiredAPNTs = parseEther('100000');
        
        if (anniAPNTsBal < requiredAPNTs) {
            console.log(`   💸 Jason minting 100,000 aPNTs to Anni...`);
            const jasonClient = createWalletClient({ account: jasonAcc, chain: config.chain, transport: http(config.rpcUrl) });
            const mintAmount = requiredAPNTs - anniAPNTsBal;
            const h = await tokenActions()(jasonClient).mint({
                token: aPNTsToken, to: anniAddr, amount: mintAmount, account: jasonAcc
            });
            await publicClient.waitForTransactionReceipt({ hash: h });
            console.log(`   ✅ Anni now has 100,000 aPNTs for SuperPaymaster deposit`);
        } else {
            console.log(`   ✓ Anni already has ${formatEther(anniAPNTsBal)} aPNTs`);
        }
    }

    // 3. AA Setup (6 Accounts)
    console.log(`\n🏭 3. Checking & Deploying 6 Test AA Accounts (Pimlico v0.7)...`);
    
    // Use configured Factory Address
    let factoryAddr = config.contracts.simpleAccountFactory;
    if (!factoryAddr || factoryAddr === '0x0000000000000000000000000000000000000000') {
        throw new Error('simpleAccountFactory address missing in config after sync!');
    }
    const factoryCode = await publicClient.getBytecode({ address: factoryAddr });
    if (!factoryCode || factoryCode.length <= 2) {
        console.log(`   🏗️  SimpleAccountFactory missing at ${factoryAddr}. Deploying...`);
        
        // Check EntryPoint first (CRITICAL dependency)
        const epCode = await publicClient.getBytecode({ address: config.contracts.entryPoint });
        console.log(`      🔍 EntryPoint (${config.contracts.entryPoint}) Bytecode Length: ${epCode?.length || 0}`);
        if (!epCode || epCode.length <= 2) {
            console.error(`      ❌ ERROR: EntryPoint code missing! Factory deployment will FAIL.`);
        }

        const { SimpleAccountFactoryArtifact, SimpleAccountArtifact } = await import('../packages/core/src/index');
        
        // 1. Deploy Implementation
        try {
            console.log(`      🚀 Deploying SimpleAccount Impl...`);
            const implHash = await supplierClient.deployContract({
                abi: SimpleAccountArtifact.abi,
                bytecode: SimpleAccountArtifact.bytecode as Hex,
                args: [config.contracts.entryPoint],
                account: supplier
            });
            const implReceipt = await publicClient.waitForTransactionReceipt({ hash: implHash });
            const implAddr = implReceipt.contractAddress!;
            console.log(`      ✅ SimpleAccount Impl Deployed: ${implAddr}`);

            // 2. Deploy Factory
            console.log(`      🚀 Deploying SimpleAccountFactory with EntryPoint: ${config.contracts.entryPoint}...`);
            const factHash = await supplierClient.deployContract({
                abi: SimpleAccountFactoryArtifact.abi,
                bytecode: SimpleAccountFactoryArtifact.bytecode as Hex,
                args: [config.contracts.entryPoint],
                account: supplier
            });
            const factReceipt = await publicClient.waitForTransactionReceipt({ hash: factHash });
            factoryAddr = factReceipt.contractAddress!;
            console.log(`      ✅ SimpleAccountFactory Deployed: ${factoryAddr}`);
            
            // Update config in memory for this run
            (config.contracts as any).simpleAccountFactory = factoryAddr;
        } catch (err: any) {
            console.error(`      ❌ DEPLOYMENT REVERTED:`);
            console.error(`         Message: ${err.message}`);
            if (err.data) console.error(`         Data: ${err.data}`);
            if (err.cause) console.error(`         Cause: ${err.cause}`);
            throw err;
        }
    }

    const testAccounts: any[] = [];
    const accountFactory = accountFactoryActions(factoryAddr);
    const ROLE_ENDUSER_ID = await registry(publicClient).ROLE_ENDUSER();

    // Salts
    for (const op of operators) {
        const owner = privateKeyToAccount(op.key);
        for (let i = 0; i < 2; i++) {
            const salt = BigInt(i);
            const label = `${op.name}_AA${i+1}`;
            const aaAddr = await accountFactory(publicClient).getAddress({ owner: owner.address, salt });
            const code = await publicClient.getBytecode({ address: aaAddr });
            const isDeployed = code && code.length > 2;

            testAccounts.push({
                label, owner, salt, address: aaAddr, isDeployed,
                opName: op.name 
            });
            
            if (!isDeployed) {
                console.log(`   Deploying ${label} (${aaAddr})...`);
                const client = createWalletClient({ account: owner, chain: config.chain, transport: http(config.rpcUrl) });
                try {
                    const hash = await accountFactory(client).createAccount({ owner: owner.address, salt, account: owner });
                    await publicClient.waitForTransactionReceipt({ hash });
                } catch(e:any) { console.error(`   ❌ Failed to deploy ${label}: ${e.message}`); }
            }
        }
    }

    // 3b. Fund AA Accounts
    console.log(`\n💰 Checking AA Resources...`);
    const aaStatus: any[] = [];
    const allTokens = Object.values(communityMap).map(c => c.token);

    for (const aa of testAccounts) {
        // ETH
        let ethBal = await publicClient.getBalance({ address: aa.address });
        if (ethBal < parseEther('0.01')) {
            console.log(`   ⛽ Funding ETH to ${aa.label}...`);
            const hash = await supplierClient.sendTransaction({ to: aa.address, value: parseEther('0.02') });
            await publicClient.waitForTransactionReceipt({ hash });
            ethBal = await publicClient.getBalance({ address: aa.address });
        }

        // GToken
        let gtBal = await gToken(publicClient).balanceOf({ token: config.contracts.gToken, account: aa.address });
        if (gtBal < parseEther('100')) {
             console.log(`   🪙 Funding GToken to ${aa.label}...`);
             const hash = await gToken(supplierClient).mint({ token: config.contracts.gToken, to: aa.address, amount: parseEther('1000'), account: supplier });
             await publicClient.waitForTransactionReceipt({ hash });
             gtBal = await gToken(publicClient).balanceOf({ token: config.contracts.gToken, account: aa.address });
        }

        // xPNTs Tokens - 按文档要求: 各10,000 a/b/cPNTs
        for (const tAddr of allTokens) {
            const issuerName = Object.keys(communityMap).find(k => communityMap[k].token === tAddr);
            if (!issuerName) continue;
            const issuerOp = operators.find(o => o.name === issuerName);
            if (!issuerOp) continue;
            const issuerClient = createWalletClient({ account: privateKeyToAccount(issuerOp.key), chain: config.chain, transport: http(config.rpcUrl) });
            
            const xpBal = await gToken(publicClient).balanceOf({ token: tAddr, account: aa.address });
            if (xpBal < parseEther('10000')) {  // 按文档要求: 10,000
                console.log(`   🎫 Funding ${issuerName} Token (10,000) to ${aa.label}...`);
                try {
                    const mintAmount = parseEther('10000') - xpBal;
                    const h = await tokenActions()(issuerClient).mint({
                        token: tAddr, to: aa.address, amount: mintAmount, account: privateKeyToAccount(issuerOp.key)
                    });
                    
                    await publicClient.waitForTransactionReceipt({ hash:h });
                } catch(e:any) { console.log(`      ⚠️ Mint Failed: ${e.message}`); }
            }
        }
        
        aaStatus.push({ 
            Label: aa.label, 
            Addr: aa.address, 
            ETH: parseFloat(formatEther(ethBal)).toFixed(4), 
            GToken: parseFloat(formatEther(gtBal)).toFixed(2),
            Explorer: `https://sepolia.etherscan.io/address/${aa.address}`
        });
    }
    printTable("AA Accounts Ready", aaStatus);


    // 4. Register Multi - Cross Join (Idempotent)
    console.log(`\n🤝 4. Registering AAs into Communities...`);
    
    for (const aa of testAccounts) {
        const client = createWalletClient({ account: aa.owner, chain: config.chain, transport: http(config.rpcUrl) });
        
        const userClient = new UserClient({
            client, 
            publicClient,
            accountAddress: aa.address,
            registryAddress: config.contracts.registry,
            gTokenStakingAddress: config.contracts.gTokenStaking,
            gTokenAddress: config.contracts.gToken,
            sbtAddress: config.contracts.sbt,
            entryPointAddress: config.contracts.entryPoint
        });

        // Check if AA is already a community member (ENDUSER)
        // Note: UserClient doesn't expose hasRole directly, using Registry Action
        const isMember = await registry(publicClient).hasRole({ 
            user: aa.address,
            roleId: ROLE_ENDUSER_ID
        });
        
        if (!isMember) {
            console.log(`   📝 ${aa.label} joining as ENDUSER...`);
            
            // Find operator to join (Jason or Bob)
            const op = operators.find(o => o.name === aa.opName);
            if (!op) {
                console.log(`      ⚠️ Operator not found for ${aa.label}`);
                continue;
            }
            const opAddress = privateKeyToAccount(op.key).address;

            try {
                // Step 0: Check if already registered (Idempotency)
                const hasRole = await registry(publicClient).hasRole({
                    roleId: ROLE_ENDUSER_ID,
                    user: aa.address,
                    community: opAddress
                });

                if (hasRole) {
                    console.log(`      ⏭️  Already registered as ENDUSER, skipping...`);
                    continue;
                }

                // Step 1: Fund AA with GToken
                const gtBal = await gToken(publicClient).balanceOf({ 
                    token: config.contracts.gToken, 
                    account: aa.address 
                });
                
                if (gtBal < parseEther('0.5')) {
                    console.log(`      🪙 Funding GToken to AA...`);
                    const h = await gToken(supplierClient).mint({ 
                        token: config.contracts.gToken, 
                        to: aa.address, 
                        amount: parseEther('1'), 
                        account: supplier 
                    });
                    await publicClient.waitForTransactionReceipt({hash:h});
                }

                // Step 2: Approve GToken from AA to GTokenStaking
                const ownerClient = createWalletClient({ 
                    account: aa.owner, 
                    chain: config.chain, 
                    transport: http(config.rpcUrl) 
                });

                const allowance = await gToken(publicClient).allowance({
                    token: config.contracts.gToken,
                    owner: aa.address,
                    spender: config.contracts.gTokenStaking
                });

                if (allowance < parseEther('0.5')) {
                    console.log(`      ✅ Approving GToken from AA...`);
                    // AA account approves GToken to GTokenStaking via owner-signed execute
                    const accountClient = accountActions(aa.address);
                    const approveData = encodeFunctionData({
                        abi: parseAbi(['function approve(address spender, uint256 amount) returns (bool)']),
                        functionName: 'approve',
                        args: [config.contracts.gTokenStaking, parseEther('1000')]
                    });
                    
                    const approveHash = await accountClient(ownerClient).execute({
                        dest: config.contracts.gToken,
                        value: 0n,
                        func: approveData,
                        account: aa.owner
                    });
                    await publicClient.waitForTransactionReceipt({ hash: approveHash });
                }

                // Step 3: Register as EndUser using L1 Core Action
                const roleData = encodeAbiParameters(
                    [
                        { type: 'address', name: 'account' },
                        { type: 'address', name: 'community' },
                        { type: 'string', name: 'avatarURI' },
                        { type: 'string', name: 'ensName' },
                        { type: 'uint256', name: 'stakeAmount' }
                    ],
                    [
                        aa.address,      // AA account address
                        opAddress,       // community
                        '',              // avatarURI
                        '',              // ensName
                        parseEther('0.3') // stakeAmount
                    ]
                );

                console.log(`      📝 Registering ${aa.address} as ENDUSER via owner...`);
                // Use L1 Core Action: registry.registerRole from owner
                // This will transfer GToken from AA address (payer = user in Registry.sol:204)
                const registerHash = await registry(ownerClient).registerRole({
                    roleId: ROLE_ENDUSER_ID,
                    user: aa.address,
                    data: roleData,
                    account: aa.owner
                });
                await publicClient.waitForTransactionReceipt({ hash: registerHash });
                console.log(`      ✅ Registered via L1 Core Action!`);
            } catch(e:any) { 
                console.log(`      ❌ Register Failed: ${e.message}`);
                continue;
            }

            // Verify again
            const isMemberNow = await registry(publicClient).hasRole({ user: aa.address, roleId: ROLE_ENDUSER_ID });
            if (isMemberNow) {
                 console.log(`      ✅ Verification Passed: ${aa.label} is ENDUSER`);
            } else {
                 console.log(`      ❌ Verification Failed: Role not granted`);
            }
        } else {
            // Check SBT balance anyway to ensure it's not missing despite having role
            const sbtBal = await publicClient.readContract({
                address: config.contracts.sbt,
                abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
                functionName: 'balanceOf',
                args: [aa.address]
            }) as bigint;
            
            if (sbtBal === 0n) {
                console.log(`   🎫 ${aa.label} has ROLE_ENDUSER but missing SBT. Repairing...`);
                try {
                    const hash = await userClient.mintSBT(ROLE_ENDUSER_ID, { account: aa.owner });
                    await publicClient.waitForTransactionReceipt({ hash });
                    console.log(`      ✅ SBT Repaired.`);
                } catch(e:any) { console.log(`      ❌ SBT Repair Failed: ${e.message}`); }
            }
        }
    }

    // Summary output for step 4
    console.log('\n   ✅ Registration Summary:');
    let registeredCount = 0;
    let skippedCount = 0;
    for (const aa of testAccounts) {
        const hasRole = await registry(publicClient).hasRole({
            roleId: ROLE_ENDUSER_ID,
            user: aa.address
        });
        if (hasRole) {
            registeredCount++;
            console.log(`      ✅ ${aa.label}: ENDUSER (SBT minted to AA)`);
        } else {
            skippedCount++;
            console.log(`      ⏭️  ${aa.label}: Skipped`);
        }
    }
    console.log(`\n   📊 Total: ${registeredCount} registered, ${skippedCount} skipped`);

    // 4b. Ensure AA Deposits in Paymasters
    console.log('\n🤝 4b. Ensuring AA Deposits in Paymasters (V4 Only)...');
    for (const aa of testAccounts) {
        const pmAddr = communityMap[aa.opName]?.pmV4;
        if (pmAddr && pmAddr !== 'None' as any) {
            const pmData = paymasterActions(pmAddr);
            const gTokenAddr = config.contracts.gToken;
            const deposit = await pmData(publicClient).balances({ user: aa.address, token: gTokenAddr });
            if (deposit < parseEther('1000')) {
                console.log(`   💰 Topping up GToken deposit for ${aa.label} in ${aa.opName}'s Paymaster...`);
                // Use operator owner as refiller
                const opMatch = operators.find(o => o.name === aa.opName);
                if (!opMatch) continue;
                
                const ownerAcc = privateKeyToAccount(opMatch.key);
                const ownerClient = createWalletClient({ account: ownerAcc, chain: config.chain, transport: http(config.rpcUrl) });
                
                const gTokenActions = tokenActions();
                
                const allowance = await gTokenActions(publicClient).allowance({ 
                    token: gTokenAddr, 
                    owner: ownerAcc.address, 
                    spender: pmAddr 
                });
                
                if (allowance < parseEther('2000')) {
                    const h = await gTokenActions(ownerClient).approve({ 
                        token: gTokenAddr, 
                        spender: pmAddr, 
                        amount: parseEther('1000000'), 
                        account: ownerAcc 
                    });
                    await publicClient.waitForTransactionReceipt({ hash: h });
                }
                
                const h = await pmData(ownerClient).depositFor({ 
                    user: aa.address, 
                    token: gTokenAddr,
                    amount: parseEther('2000'), 
                    account: ownerAcc 
                });
                await publicClient.waitForTransactionReceipt({ hash: h });
                console.log(`      ✅ Deposited 2000 GTokens for ${aa.label}`);
            } else {
                console.log(`   ✓ ${aa.label} already has ${formatEther(deposit)} GToken deposit`);
            }

            // Also deposit community token if it exists and different from GToken
            const commToken = communityMap[aa.opName]?.token;
            if (commToken && commToken.toLowerCase() !== gTokenAddr.toLowerCase()) {
                const commDeposit = await pmData(publicClient).balances({ user: aa.address, token: commToken });
                if (commDeposit < parseEther('1000')) {
                    console.log(`   💰 Topping up Community Token (${aa.opName}) deposit for ${aa.label}...`);
                    const opMatch = operators.find(o => o.name === aa.opName);
                    if (opMatch) {
                        const ownerAcc = privateKeyToAccount(opMatch.key);
                        const ownerClient = createWalletClient({ account: ownerAcc, chain: config.chain, transport: http(config.rpcUrl) });
                        
                        // Check owner's balance first
                        const ownerBal = await tokenActions()(publicClient).balanceOf({ token: commToken, account: ownerAcc.address });
                        if (ownerBal < parseEther('2000')) {
                            console.log(`      ⚠️  Owner balance low (${formatEther(ownerBal)}). Skipping community token topup.`);
                        } else {
                            const allowance = await tokenActions()(publicClient).allowance({ token: commToken, owner: ownerAcc.address, spender: pmAddr });
                            if (allowance < parseEther('2000')) {
                                const h = await tokenActions()(ownerClient).approve({ token: commToken, spender: pmAddr, amount: parseEther('1000000'), account: ownerAcc });
                                await publicClient.waitForTransactionReceipt({ hash: h });
                            }
                            const h = await pmData(ownerClient).depositFor({ user: aa.address, token: commToken, amount: parseEther('2000'), account: ownerAcc });
                            await publicClient.waitForTransactionReceipt({ hash: h });
                            console.log(`      ✅ Deposited 2000 ${aa.opName} tokens for ${aa.label}`);
                        }
                    }
                }
            }
        }
    }

    // 5. Paymaster & Chainlink Setup
    console.log(`\n💳 5. Checking Paymaster Configuration...`);
    const pmStatus: any[] = [];
    const pmV4s = Object.values(communityMap).map(c => c.pmV4).filter(Boolean) as Address[];
    const superPM = config.contracts.superPaymaster;
    const epAddr = config.contracts.entryPoint;
    const regAddr = config.contracts.registry;

    // Ensure Anni has ETH (SuperPaymaster owner)
    const anniOp = operators.find(o => o.name.includes('Anni'));
    if (anniOp) {
        const balance = await publicClient.getBalance({ address: privateKeyToAccount(anniOp.key).address });
        if (balance < parseEther('0.5')) {
             console.log(`   ⛽ Funding ETH to Anni (SuperPM)...`);
             await checkAndFund(privateKeyToAccount(anniOp.key).address, '0.5');
        }
    }
    
    // Default to v0.7
    const ep = entryPointActions(epAddr, EntryPointVersion.V07);

    // Get Role IDs
    const ROLE_PAYMASTER_AOA = await registry(publicClient).ROLE_PAYMASTER_AOA();
    const ROLE_PAYMASTER_SUPER = await registry(publicClient).ROLE_PAYMASTER_SUPER();

    // Map PMs to their owners for stake check
    const pmToOwner = new Map<Address, { addr: Address, name: string }>();
    for (const op of operators) {
        const addr = privateKeyToAccount(op.key).address;
        if (communityMap[op.name]?.pmV4) {
            pmToOwner.set(communityMap[op.name].pmV4 as Address, { addr, name: op.name.split(' ')[0] });
        }
    }

    // All Paymasters to check in EntryPoint
    const allPMs = [
        ...pmV4s.map(addr => ({ addr, owner: pmToOwner.get(addr)?.addr, operatorName: pmToOwner.get(addr)?.name, type: 'V4', role: ROLE_PAYMASTER_AOA })),
        { addr: superPM, owner: privateKeyToAccount(operators.find(o => o.name.includes('Anni'))?.key!).address, operatorName: 'Anni', type: 'SuperPM', role: ROLE_PAYMASTER_SUPER }
    ];

    // ========== CRITICAL CHECK: SuperPaymaster Cache Price ==========
    console.log('\n🔍 Verifying SuperPaymaster Configuration...');
    
    // 1. Cache Price Check (CRITICAL - Prevents "price not set" failures)
    console.log('   📊 Cache Price Status:');
    try {
        const cacheData = await superPaymasterActions(superPM)(publicClient).cachedPrice() as any;
        const cacheAgeSeconds = Date.now() / 1000 - Number(cacheData.updatedAt || cacheData[1]);
        const cacheAgeMin = Math.floor(cacheAgeSeconds / 60);
        const price = cacheData.price || cacheData[0];
        
        if (cacheAgeSeconds > 3600 || Number(price) === 0) {
            console.log(`   ⚠️  Stale or uninitialized (age: ${cacheAgeMin}min, price: ${price})`);
            console.log('   🔄 Refreshing cache price...');
            
            const refreshHash = await superPaymasterActions(superPM)(supplierClient).updatePrice({
                account: supplier
            });
            await publicClient.waitForTransactionReceipt({ hash: refreshHash });
            
            const newCache = await superPaymasterActions(superPM)(publicClient).cachedPrice() as any;
            const newPrice = newCache.price || newCache[0];
            console.log(`   ✅ Cache Updated: Price=$${Number(newPrice) / 1e8}`);
        } else {
            console.log(`   ✅ Fresh (${cacheAgeMin}min old, price: $${Number(price) / 1e8})`);
        }
    } catch(e: any) {
        console.error(`   ❌ Cache check failed: ${e.message}`);
        console.log('   ⚠️  WARNING: Gasless transactions may fail without valid cache price!');
    }

    // 2. Token Exchange Rate Check
    console.log('   💱 aPNTs Exchange Rate:');
    const globalAPNTs = config.contracts.aPNTs;
    try {
        const rate = await publicClient.readContract({
            address: globalAPNTs,
            abi: [{ name: 'exchangeRate', type: 'function', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' }],
            functionName: 'exchangeRate'
        }) as bigint;
        
        if (rate === 0n) {
            console.log('   ❌ CRITICAL: Rate is ZERO! Gasless txs will fail!');
        } else if (rate !== parseEther('1')) {
            console.log(`   ⚠️  Non-standard: ${formatEther(rate)} (expected 1.0)`);
        } else {
            console.log('   ✅ 1:1 (Standard)');
        }
    } catch(e: any) {
        console.log(`   ℹ️  Could not verify exchange rate: ${e.message}`);
    }

    console.log('\\n💰 Funding Paymasters (EntryPoint Deposits)...');
    for (const pmInfo of allPMs) {
        const pm = pmInfo.addr;
        
        // 5a. EntryPoint Deposit Check - Use SDK Action
        const epBal = await ep(publicClient).balanceOf({ account: pm });
        
        const MIN_EP_DEPOSIT = parseEther('0.1');
        const REFILL_EP_AMOUNT = parseEther('0.2');

        if (epBal < MIN_EP_DEPOSIT) {
             console.log(`   💵 Refilling EntryPoint Deposit for ${pmInfo.type} at ${pm}...`);
             const hash = await ep(supplierClient).depositTo({ 
                 account: pm, 
                 amount: REFILL_EP_AMOUNT, 
                 txAccount: supplier 
             });
             await publicClient.waitForTransactionReceipt({ hash });
             console.log(`      ✅ Refilled to ${formatEther(REFILL_EP_AMOUNT)} ETH`);
        }

        // 5b. Stake Info from Registry (Query Operator's stake) - Use SDK Action
        let stakeVal = '0.00';
        if (pmInfo.owner) {
            try {
                const stake = await registry(publicClient).roleStakes({ 
                    roleId: pmInfo.role, 
                    user: pmInfo.owner 
                });
                stakeVal = parseFloat(formatEther(stake)).toFixed(2);
                
                // 5b-2. Paymaster EntryPoint Stake Check (Critical for Storage Access)
                // Use SDK getDepositInfo
                const depositInfo = await ep(publicClient).getDepositInfo({ account: pm });
                console.log(`      💰 Deposit: ${formatEther(depositInfo.deposit)} ETH | 🧱 Stake: ${formatEther(depositInfo.stake)} ETH (Staked: ${depositInfo.staked})`);

            } catch(e) { }
        }

        // Special handling for SuperPM status display (we update it later with Internal Credit)
        if (pmInfo.type === 'V4') {
            pmStatus.push({
                Type: 'V4',
                Address: pm,
                EP_Deposit: parseFloat(formatEther(epBal < MIN_EP_DEPOSIT ? REFILL_EP_AMOUNT : epBal)).toFixed(4),
                Stake: stakeVal,
                Operator: pmInfo.operatorName
            });
        } else {
            // SuperPM basic info (will add Internal_Credit later)
            (pmInfo as any).epDeposit = parseFloat(formatEther(epBal < MIN_EP_DEPOSIT ? REFILL_EP_AMOUNT : epBal)).toFixed(4);
            (pmInfo as any).stake = stakeVal;
        }
    }

    // 5c. SuperPM Internal Credit (Anni's stake in SuperPM)
    const anniOpForCredit = operators.find(o => o.name.includes('Anni'));
    if (anniOpForCredit) {
        const anniAddr = privateKeyToAccount(anniOpForCredit.key).address;
        const opConfig = await superPaymasterActions(superPM)(publicClient).operators({ operator: anniAddr });
        let internalBal = opConfig.aPNTsBalance;
        
        if (internalBal < parseEther('50000')) {
            console.log(`   🔄 Refilling SuperPaymaster Credit for Anni...`);
            const globalAPNTs = config.contracts.aPNTs;
            const anniAcc = privateKeyToAccount(anniOpForCredit.key);
            const anniClient = createWalletClient({ account: anniAcc, chain: config.chain, transport: http(config.rpcUrl) });
            
            try {
                // Verify SuperPaymaster's expected APNTs token
                const spExpectedToken = await superPaymasterActions(superPM)(publicClient).APNTS_TOKEN();
                console.log(`      ℹ️ SuperPM expects Token: ${spExpectedToken}, Using: ${globalAPNTs}`);
                
                if (spExpectedToken.toLowerCase() !== globalAPNTs.toLowerCase()) {
                    console.log(`      ⚠️ Token Mismatch! Switching to use ${spExpectedToken}...`);
                     // If mismatch, we must use what SP expects, but we might not have balance there?
                     // Assuming globalAPNTs (from config) should be correct. If not, config is wrong.
                }

                const checkToken = spExpectedToken;
                const anniApntsBal = await tokenActions()(publicClient).balanceOf({ token: checkToken, account: anniAddr });
                const requiredForDeposit = parseEther('60000');
                
                if (anniApntsBal < requiredForDeposit) {
                    console.log(`      💸 Minting ${formatEther(requiredForDeposit - anniApntsBal)} of ${checkToken} to Anni...`);
                    const mintAmount = requiredForDeposit - anniApntsBal;
                    const mintHash = await tokenActions()(supplierClient).mint({
                        token: checkToken, to: anniAddr, amount: mintAmount, account: supplier
                    });
                    await publicClient.waitForTransactionReceipt({ hash: mintHash });
                }
                
                
                // Check and set spending limit for SuperPaymaster
                // xPNTsToken has a default limit of 5000 aPNTs, we need to increase it
                console.log(`      🔧 Setting spending limit for SuperPM to 100,000...`);
                const setLimitHash = await (anniClient as any).writeContract({
                    address: checkToken,
                    abi: [{
                        "type": "function",
                        "name": "setPaymasterLimit",
                        "inputs": [
                            {"name": "spender", "type": "address"},
                            {"name": "limit", "type": "uint256"}
                        ],
                        "outputs": [],
                        "stateMutability": "nonpayable"
                    }],
                    functionName: 'setPaymasterLimit',
                    args: [superPM, parseEther('100000')],
                    account: anniAcc,
                    chain: config.chain
                });
                await publicClient.waitForTransactionReceipt({ hash: setLimitHash });
                
                const currentAllowance = await tokenActions()(publicClient).allowance({ token: checkToken, owner: anniAddr, spender: superPM });
                const depositAmount = parseEther('50000');

                if (currentAllowance < depositAmount) {
                    console.log(`      📝 Approving SuperPM to spend ${formatEther(depositAmount)}...`);
                    const approveHash = await tokenActions()(anniClient).approve({ token: checkToken, spender: superPM, amount: parseEther('100000'), account: anniAcc });
                    await publicClient.waitForTransactionReceipt({ hash: approveHash });
                    
                    // Double check allowance
                    const newAllowance = await tokenActions()(publicClient).allowance({ token: checkToken, owner: anniAddr, spender: superPM });
                    console.log(`      ✅ New Allowance: ${formatEther(newAllowance)}`);
                }
                
                console.log(`      🔄 Depositing 50,000 into SuperPM...`);
                // Use explicit depositAPNTs which maps to deposit(uint256)
                const tx = await superPaymasterActions(superPM)(anniClient).deposit({
            amount: depositAmount,
            account: anniAcc
        });
        console.log(`      ✅ SuperPM Refill Success: ${tx}`);
        await publicClient.waitForTransactionReceipt({ hash: tx });
                
                const opConfig = await superPaymasterActions(superPM)(publicClient).operators({ operator: anniAddr });
                internalBal = opConfig.aPNTsBalance;
            } catch(e: any) {
                console.error(`      ❌ SuperPM Refill Failed: ${e.message}`);
            }
        }
        
        const superPMInfo = allPMs.find(p => p.type === 'SuperPM') as any;
        pmStatus.push({
            Type: 'SuperPM',
            Address: superPM,
            EP_Deposit: superPMInfo.epDeposit,
            Stake: superPMInfo.stake,
            Internal_Credit: parseFloat(formatEther(internalBal)).toFixed(2),
            Operator: 'Anni'
        });
    }

    // 5d. SuperPaymaster EntryPoint Stake Check (Critical for Bundler Acceptance)
    console.log(`\n🔐 5d. Verifying SuperPaymaster EntryPoint Stake...`);
    const spDepositInfo = await ep(publicClient).getDepositInfo({ account: superPM });
    
    console.log(`   📊 Current Stake Status:`);
    console.log(`      Deposit: ${formatEther(spDepositInfo.deposit)} ETH`);
    console.log(`      Staked: ${spDepositInfo.staked ? '✅ Yes' : '❌ No'}`);
    console.log(`      Stake Amount: ${formatEther(spDepositInfo.stake)} ETH`);
    console.log(`      Unstake Delay: ${spDepositInfo.unstakeDelaySec} seconds`);
    
    // Bundler Requirements (from error message)
    const REQUIRED_STAKE = parseEther('0.1');
    const REQUIRED_DELAY = 86400; // 1 day in seconds
    
    const needsStake = !spDepositInfo.staked || 
                      spDepositInfo.stake < REQUIRED_STAKE || 
                      spDepositInfo.unstakeDelaySec < REQUIRED_DELAY;
    
    if (needsStake) {
        console.log(`\n   ⚠️  Stake requirements NOT met. Bundler requires:`);
        console.log(`      - Minimum Stake: 0.1 ETH`);
        console.log(`      - Minimum Unstake Delay: 86400 seconds (1 day)`);
        console.log(`\n   🔧 Adding stake to SuperPaymaster...`);
        
        try {
            // Use supplier as the one paying for the stake (owner of SuperPaymaster should be supplier)
            const spOwner = await publicClient.readContract({
                address: superPM,
                abi: [{ name: 'owner', type: 'function', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' }],
                functionName: 'owner'
            }) as Address;
            
            console.log(`      ℹ️  SuperPaymaster Owner: ${spOwner}`);
            console.log(`      ℹ️  Supplier Address: ${supplier.address}`);
            
            if (spOwner.toLowerCase() !== supplier.address.toLowerCase()) {
                console.log(`      ⚠️  WARNING: Supplier is not the owner! Stake operation may fail.`);
                console.log(`      Please ensure the owner account has sufficient ETH and permissions.`);
            }
            
            const stakeHash = await superPaymasterActions(superPM)(supplierClient).addStake({
                unstakeDelaySec: REQUIRED_DELAY,
                value: REQUIRED_STAKE,
                account: supplier
            });
            
            console.log(`      📝 Stake Transaction: ${stakeHash}`);
            await publicClient.waitForTransactionReceipt({ hash: stakeHash });
            
            // Verify stake was added
            const newDepositInfo = await ep(publicClient).getDepositInfo({ account: superPM });
            console.log(`      ✅ Stake Added Successfully!`);
            console.log(`         New Stake: ${formatEther(newDepositInfo.stake)} ETH`);
            console.log(`         Unstake Delay: ${newDepositInfo.unstakeDelaySec} seconds`);
        } catch (e: any) {
            console.error(`      ❌ Failed to add stake: ${e.message}`);
            console.error(`      ⚠️  Anni Gasless test may FAIL without proper stake!`);
        }
    } else {
        console.log(`   ✅ Stake requirements MET. Bundler will accept SuperPaymaster.`);
    }

    printTable("Paymaster Status", pmStatus);

    // 6. UserOperation Generation Demo (5 Scenarios)
    console.log(`\n📦 6. Constructing 5 Different UserOperation Scenarios (v0.7)...`);
    
    const targetAA = testAccounts[0]; // Jason (AAStar)_AA1
    const jasonAcc = privateKeyToAccount(operators[0].key);
    
    // Scenarios setup
    const bobOp = operators.find(o => o.name.includes('Bob'));
    const bobEOA = bobOp ? privateKeyToAccount(bobOp.key).address : null;
    const bPNTsToken = communityMap['Bob (Bread)']?.token;
    const cPNTsToken = communityMap['Jason (AAStar)']?.token; // Assumption: using native community token as cPNTs for demo
    
    if (targetAA && bobEOA && bPNTsToken && cPNTsToken) {
        const scenarios = [
            { type: UserOpScenarioType.NATIVE, label: '1. Standard ERC-4337 (User pays ETH)' },
            { type: UserOpScenarioType.GASLESS_V4, label: '2. Gasless via PaymasterV4 (Jason Community)', paymaster: communityMap['Jason (AAStar)']?.pmV4 },
            { type: UserOpScenarioType.GASLESS_V4, label: '3. Gasless via PaymasterV4 (Bob Community)', paymaster: communityMap['Bob (Bread)']?.pmV4 },
            { type: UserOpScenarioType.SUPER_BPNT, label: '4. SuperPaymaster via bPNT (Internal Settlement)', paymaster: superPM, operator: jasonAcc.address, token: bPNTsToken },
            { type: UserOpScenarioType.SUPER_CPNT, label: '5. SuperPaymaster via cPNT (Internal Settlement)', paymaster: superPM, operator: jasonAcc.address, token: cPNTsToken }
        ];

        for (const scene of scenarios) {
            console.log(`\n--- ${scene.label} ---`);
            const { userOp, opHash } = await UserOpScenarioBuilder.buildTransferScenario(scene.type, {
                sender: targetAA.address,
                ownerAccount: jasonAcc,
                recipient: bobEOA,
                tokenAddress: bPNTsToken, // Transfer bPNTs in all cases
                amount: parseEther('2'),
                entryPoint: epAddr,
                chainId: config.chain.id,
                publicClient,
                paymaster: scene.paymaster,
                operator: scene.operator
            });
            
            console.log(`   UserOp Hash: ${opHash}`);
            console.log(`   Internal Payer Token: ${scene.token || 'N/A'}`);
            console.log(`   Paymaster: ${scene.paymaster || 'None'}`);
            console.log(`   Signature (First 32 bytes): ${userOp.signature.slice(0, 66)}...`);
        }

        console.log(`\n================================================================`);
        console.log(`📖 SDK UserOperation Construction Guide`);
        console.log(`================================================================`);
        console.log(`API: UserOpScenarioBuilder.buildTransferScenario(type, params)`);
        console.log(`Context: Transferring 2 bPNTs from Jason (AA1) to Bob (EOA)`);
        console.log(`\nAvailable Scenarios:`);
        console.log(`1. NATIVE       : Standard 4337, AA pays gas in ETH`);
        console.log(`2. GASLESS_V4   : Gasless via PaymasterV4 (Community sponsored)`);
        console.log(`3. SUPER_BPNT   : SuperPaymaster (Internal bPNT settlement)`);
        console.log(`4. SUPER_CPNT   : SuperPaymaster (Internal cPNT settlement)`);
        console.log(`5. SUPER_CUSTOM : SuperPaymaster (Custom operator/token)`);
        console.log(`\nUsage Example:`);
        console.log(`const { userOp } = await UserOpScenarioBuilder.buildTransferScenario(`);
        console.log(`    UserOpScenarioType.SUPER_BPNT, { ...params }`);
        console.log(`);`);
        console.log(`// userOp is now ready for eth_sendUserOperation (Hex-compliant)`);
        console.log(`================================================================`);
    }

    // 7. Save State
    console.log(`\n💾 Saving State to ${STATE_FILE}...`);
    const stateToSave = {
        network: config.name,
        timestamp: new Date().toISOString(),
        operators: {
            jason: {
                address: privateKeyToAccount(operators[0].key).address,
                tokenAddress: communityMap['Jason (AAStar)']?.token,
                symbol: 'aPNTs',
                paymasterV4: communityMap['Jason (AAStar)']?.pmV4
            },
            bob: {
                address: privateKeyToAccount(operators[1].key).address,
                tokenAddress: communityMap['Bob (Bread)']?.token,
                symbol: 'bPNTs',
                paymasterV4: communityMap['Bob (Bread)']?.pmV4
            },
            anni: {
                address: privateKeyToAccount(operators[2].key).address,
                tokenAddress: communityMap['Anni (Demo)']?.token,
                symbol: 'cPNTs',
                superPaymaster: superPM
            }
        },
        aaAccounts: testAccounts.map(aa => ({
            label: aa.label,
            address: aa.address,
            owner: aa.owner.address,
            salt: aa.salt.toString(), // Convert BigInt to string
            opName: aa.opName
        }))
    };
    // 7. Success
    console.log(`   ✅ State Saved!`);
    fs.writeFileSync(STATE_FILE, JSON.stringify(stateToSave, null, 2));

    console.log(`   ✅ State Saved!`);
    fs.writeFileSync(STATE_FILE, JSON.stringify(stateToSave, null, 2));
    console.log(`\n✅ L4 Setup Verified Complete.\n`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});

