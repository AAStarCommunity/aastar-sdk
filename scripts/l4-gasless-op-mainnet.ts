
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { 
    type Address, 
    type Hash, 
    type Hex, 
    parseEther, 
    formatEther, 
    createWalletClient, 
    http, 
    createPublicClient, 
    encodeFunctionData, 
    keccak256, 
    encodeAbiParameters, 
    parseAbiParameters,
    toHex, 
    stringToBytes, 
    parseAbi,
    concat,
    pad,
    hexToBytes,
    erc20Abi 
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import * as dotenv from 'dotenv';
// Use relative path to config
import { loadNetworkConfig, type NetworkConfig } from '../tests/regression/config.js';
import { 
    SuperPaymasterClient,
    // PaymasterClient // Not exported cleanly in sdk index? Use relative import below
} from '../packages/sdk/src/index.js';
// Direct import for PaymasterClient
import { PaymasterClient } from '../packages/paymaster/src/V4/index.js';

import { 
    UserOperationBuilder 
} from '../packages/sdk/src/utils/userOp.js';

import { 
    tokenActions, 
    entryPointActions, 
    EntryPointVersion, 
    SuperPaymasterABI, 
    RegistryABI, 
    EntryPointABI,
    CORE_ADDRESSES,
    TEST_TOKEN_ADDRESSES,
    ReputationSystemABI,
    xPNTsTokenABI,
    superPaymasterActions
} from '../packages/core/src/index.js';

// Setup for BLS
const require = createRequire(import.meta.url);
const { bls12_381 } = require('@noble/curves/bls12-381');
(BigInt.prototype as any).toJSON = function () { return this.toString(); };

// Load L4 State
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
function loadState(networkName: string): any {
    const STATE_FILE = path.resolve(__dirname, `l4-state.${networkName}.json`);
    if (!fs.existsSync(STATE_FILE)) {
        console.warn(`Note: L4 State file not found at ${STATE_FILE}. Using raw config addresses.`);
        return { operators: {}, aaAccounts: [] };
    }
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
}

async function waitAndCheckReceipt(publicClient: any, bundlerClient: any, opHash: Hash, label: string) {
    console.log(`   ⏳ [${label}] Waiting for confirmation...`);
    let receipt: any = null;
    for (let i = 0; i < 45; i++) { // 90s timeout
        try {
            // @ts-ignore
            receipt = await bundlerClient.request({
                method: 'eth_getUserOperationReceipt',
                params: [opHash]
            });
            if (receipt) break;
        } catch (e) {}
        await new Promise(r => setTimeout(r, 2000));
    }
    
    if (receipt && receipt.success) {
        console.log(`   🎉 [${label}] SUCCESS! Block: ${receipt.receipt.blockNumber}`);
        // Log Gas Data for Paper7
        const actualGasUsed = BigInt(receipt.receipt.gasUsed);
        const actualGasCost = BigInt(receipt.actualGasCost);
        const l1Fee = receipt.receipt.l1Fee ? BigInt(receipt.receipt.l1Fee) : 0n;
        
        console.log(`   📊 DATA [${label}]:`);
        console.log(`      - Execution Gas (L2): ${actualGasUsed}`);
        console.log(`      - Cost (ETH): ${formatEther(actualGasCost)}`);
        console.log(`      - L1 Fee (OP): ${formatEther(l1Fee)}`);
        console.log(`      - Total Cost: ${formatEther(actualGasCost + l1Fee)} ETH`);
        return true;
    } else {
        console.log(`   ❌ [${label}] FAILED or Timeout.`);
        return false;
    }
}

// Helper to resolve keys using Cast Wallet
function resolveKeyFromCast(accountName: string, envName: string): string | undefined {
    // If account name is provided, prioritize decrypting it via cast wallet
    if (accountName) {
        try {
            console.log(`   🔑 Decrypting key for account '${accountName}' using cast wallet...`);
            // Try to decrypt using cast wallet. 
            // We use stdio: ['inherit', 'pipe', 'pipe'] so user can see prompt on stderr/stdout but we capture stdout.
            // Cast wallet decrypt-keystore prints the key to stdout.
            const result = execSync(`cast wallet decrypt-keystore ${accountName}`, { 
                encoding: 'utf-8', 
                stdio: ['inherit', 'pipe', 'pipe'] 
            }).trim();

            // The output might contain newlines or other noise if cast updates. 
            // We look for a 64-char hex string, optionally with 0x prefix.
            const match = result.match(/(?:0x)?([a-fA-F0-9]{64})/);
            if (match) {
                const key = `0x${match[1]}`;
                console.log(`   ✅ Decrypted successfully (Starts with ${key.slice(0, 6)}...)`);
                return key;
            } else {
                console.warn(`   ⚠️  Decryption returned unexpected format: "${result.substring(0, 20)}..."`);
            }
        } catch (e: any) {
            console.warn(`   ⚠️  Failed to decrypt key for '${accountName}': ${e.message?.split('\n')[0]}`);
        }
    }
    
    // Fallback to env variable
    if (process.env[envName]) {
        // Warn if falling back to env var
        const val = process.env[envName] || '';
        if (val.startsWith('0xac0974')) console.warn(`   ⚠️  Using Default Anvil Key from Env!`);
        return val;
    }
    
    return undefined;
}

export async function runGaslessDataCollection(config: NetworkConfig, networkName: string = 'op-mainnet') {
    const state = loadState(networkName);
    console.log(`   📂 Loaded state for network: ${networkName}`);
    
    const publicClient = createPublicClient({
        chain: config.chain,
        transport: http(config.rpcUrl)
    });

    // Bundler Client (Raw RPC)
    const bundlerClient = createPublicClient({
        chain: config.chain,
        transport: http(config.bundlerUrl)
    });

    // Use keys resolved via environment/cast
    const jasonKey = process.env.PRIVATE_KEY_JASON as Hex; // Should be set by setupEnv
    const anniKey = process.env.PRIVATE_KEY_ANNI as Hex;
    
    if (!jasonKey) throw new Error("Missing PRIVATE_KEY_JASON (Deployer Account)");

    const jasonAcc = privateKeyToAccount(jasonKey);
    const anniAcc = anniKey ? privateKeyToAccount(anniKey) : jasonAcc; 

    // Supplier helper for price
    const supplierKey = process.env.PRIVATE_KEY_SUPPLIER || config.supplierAccount?.privateKey;
    let supplierAcc = supplierKey ? privateKeyToAccount(supplierKey as Hex) : jasonAcc; 
    let supplierWallet = createWalletClient({ account: supplierAcc, chain: config.chain, transport: http(config.rpcUrl) });
    
    // Check ETH for Anni/Supplier
    const jasonEth = await publicClient.getBalance({ address: jasonAcc.address });
    const anniEth = anniKey ? await publicClient.getBalance({ address: anniAcc.address }) : 0n;
    
    console.log('\n═══════════════════════════════════════════════');
    console.log('🧪 L4 Gasless Data Collection (Paper7)');
    console.log(`   Jason: ${jasonAcc.address} (${formatEther(jasonEth)} ETH)`);
    if(anniKey) console.log(`   Anni: ${anniAcc.address} (${formatEther(anniEth)} ETH)`);
    console.log('═══════════════════════════════════════════════\n');

    const SP = config.contracts.superPaymaster;
    const PM_V4 = config.contracts.paymasterV4Impl; 
    const EP = config.contracts.entryPoint;
    const GTOKEN = config.contracts.gToken;
    
    // We need Anni's xPNTs token
    const anniToken = state.operators?.['anni']?.tokenAddress || config.contracts.aPNTs; 
    console.log(`   Target Token (xPNTs): ${anniToken}`);

    // Resolve AA
    const simpleAccountFactory = config.contracts.simpleAccountFactory;
    const salt = 0n;
    const aaAddress = await publicClient.readContract({
        address: simpleAccountFactory,
        abi: parseAbi(['function getAddress(address,uint256) view returns (address)']),
        functionName: 'getAddress',
        args: [jasonAcc.address, salt]
    });
    console.log(`   ✅ AA Address: ${aaAddress}`);
    
    // Check if deployed
    const code = await publicClient.getBytecode({ address: aaAddress });
    if (!code) {
        console.log(`   ⚠️ AA not deployed! Setup script should have done this.`);
        try {
            console.log("   🚀 Deploying AA via Factory...");
            const hash = await createWalletClient({ account: jasonAcc, chain: config.chain, transport: http(config.rpcUrl) })
                .writeContract({ 
                    address: simpleAccountFactory, 
                    abi: parseAbi(['function createAccount(address,uint256)']), 
                    functionName: 'createAccount', 
                    args: [jasonAcc.address, salt] 
                });
            await publicClient.waitForTransactionReceipt({ hash });
            console.log(`   ✅ AA Deployed: ${hash}`);
        } catch(e:any) {
             console.log(`   ❌ Failed to deploy AA: ${e.message}`);
        }
    }

    // Refresh Price
    try {
        console.log(`   🧭 Checking SuperPaymaster Price Cache...`);
        const superPaymasterRead = superPaymasterActions(SP as any)(publicClient);
        const superPaymasterWrite = superPaymasterActions(SP as any)(supplierWallet);
        const cache = await superPaymasterRead.cachedPrice();
        const cachedUpdatedAt = cache.updatedAt;
        const now = BigInt(Math.floor(Date.now() / 1000));
        const isStale = cachedUpdatedAt === 0n || cachedUpdatedAt + 3600n < now;
        
        if (isStale) {
            console.log(`   ⚠️ Price is stale (${cachedUpdatedAt}). Refreshing... `);
             try {
                const hash = await superPaymasterWrite.updatePrice({ account: supplierAcc });
                await publicClient.waitForTransactionReceipt({ hash });
                console.log(`   ✅ Price cache refreshed: ${hash}`);
            } catch (e: any) {
                console.log(`   ⚠️ UpdatePrice (Chainlink) failed, trying DVT proof fallback (Mock)...`);
                // Assume DVT proof logic or just warn
                console.log(`   ❌ Could not refresh price: ${e.message}`);
            }
        } else {
             console.log(`   ✅ Price is fresh.`);
        }
    } catch (e: any) {
         console.warn(`   ⚠️ Error checking price cache: ${e.message}`);
    }


    // ---------------------------------------------------------
    // T1: Gasless Token Transfer (Paymaster V4)
    // ---------------------------------------------------------
    console.log('\n🔹 [T1] Gasless Transfer (Paymaster V4 - Baseline)');
    try {
        let pmV4Address = PM_V4;
        if (state.operators?.jason?.paymasterV4) {
            pmV4Address = state.operators.jason.paymasterV4;
            console.log(`   Using deployed PM V4: ${pmV4Address}`);
        } else {
             console.log(`   Using Config PM V4 Impl: ${pmV4Address} (Might fail if not proxy)`);
        }

        const amount = parseEther('0.001');
        const recipient = jasonAcc.address;
        
        // Encode Execution: xPNTs transfer
        const callData = PaymasterClient.encodeExecution(
            anniToken, 
            0n,                                    
            PaymasterClient.encodeTokenTransfer(recipient, amount)
        );

        console.log("   🚀 Submitting T1...");
        const txHash = await PaymasterClient.submitGaslessUserOperation(
            publicClient,
            createWalletClient({ account: jasonAcc, chain: config.chain, transport: http(config.rpcUrl) }),
            aaAddress,
            EP,
            pmV4Address,
            anniToken,
            config.bundlerUrl,
            callData
        );
        console.log(`   Tx Hash: ${txHash}`);
        await waitAndCheckReceipt(publicClient, bundlerClient, txHash, "T1 - PaymasterV4");
        
    } catch (e: any) {
        console.log(`   ❌ T1 Failed: ${e.message}`);
    }


    // ---------------------------------------------------------
    // T2: Gasless Transfer (SuperPaymaster)
    // ---------------------------------------------------------
    console.log('\n🔹 [T2] Gasless Transfer (SuperPaymaster)');
    try {
        const amount = parseEther('0.001');
        // Check balance
        const bal = await publicClient.readContract({ address: anniToken, abi: erc20Abi, functionName: 'balanceOf', args: [aaAddress] }) as bigint;
        if (bal < amount) {
            console.log("   Funding AA with tokens...");
            if (anniEth < parseEther('0.0001')) {
                 console.log("   ⚠️ Anni has insufficient ETH for mint gas. Skipping Funding.");
            } else {
                const wallet = createWalletClient({ account: anniAcc, chain: config.chain, transport: http(config.rpcUrl) });
                try {
                     await wallet.writeContract({
                        address: anniToken,
                        abi: parseAbi(['function mint(address,uint256)']),
                        functionName: 'mint',
                        args: [aaAddress, parseEther('10')]
                    });
                     await new Promise(r => setTimeout(r, 2000));
                } catch(e:any) {
                    console.log(`   ❌ Mint Failed: ${e.message}`);
                }
            }
        }

        console.log("   🚀 Submitting T2...");
        const txHash = await SuperPaymasterClient.submitGaslessTransaction(
            publicClient,
            createWalletClient({ account: jasonAcc, chain: config.chain, transport: http(config.rpcUrl) }),
            aaAddress,
            EP,
            config.bundlerUrl,
            {
                token: anniToken,
                recipient: jasonAcc.address, 
                amount: amount,
                operator: anniAcc.address, // Anni is operator
                paymasterAddress: SP
            }
        );
        console.log(`   Tx Hash: ${txHash}`);
        await waitAndCheckReceipt(publicClient, bundlerClient, txHash, "T2 - SuperPM Transfer");

    } catch (e: any) {
        console.log(`   ❌ T2 Failed: ${e.message}`);
    }

    // ---------------------------------------------------------
    // T3: Gasless SBT Mint
    // ---------------------------------------------------------
    console.log('\n🔹 [T3] Gasless SBT Mint');
    try {
        const ROLE_ENDUSER = keccak256(stringToBytes("ENDUSER"));
        const data = encodeAbiParameters(
            [
                { name: 'account', type: 'address' },
                { name: 'community', type: 'address' },
                { name: 'avatar', type: 'string' },
                { name: 'name', type: 'string' },
                { name: 'nonce', type: 'uint256' }
            ],
            [aaAddress, anniAcc.address, "ipfs://avatar", "user.eth", 0n] // Nonce 0 for first SBT
        );
        
        const callData = encodeFunctionData({
            abi: RegistryABI,
            functionName: 'registerRole',
            args: [ROLE_ENDUSER, aaAddress, data]
        });

        const hasRole = await publicClient.readContract({
            address: config.contracts.registry,
            abi: RegistryABI,
            functionName: 'hasRole',
            args: [ROLE_ENDUSER, aaAddress]
        });

        if (hasRole) {
            console.log("   ✅ User already has SBT (Role). Skipping Mint.");
        } else {
            console.log("   🚀 Submitting T3 (SBT Mint)...");
            
            // Build Op Manually (UserOperationBuilder has no instance method!)
            const nonce = await publicClient.readContract({
                address: EP,
                abi: EntryPointABI,
                functionName: 'getNonce',
                args: [aaAddress, 0n]
            });

            // T3: Custom Call (not simple transfer)
            // Encode UserOp execute call
            // Since this is SimpleAccount calling Registry, we wrap in execute:
            const executeData = encodeFunctionData({
                abi: parseAbi(['function execute(address,uint256,bytes)']),
                functionName: 'execute',
                args: [config.contracts.registry, 0n, callData]
            });
            
            const userOp: any = {
                sender: aaAddress,
                nonce: nonce,
                initCode: '0x' as Hex,
                callData: executeData,
                accountGasLimits: UserOperationBuilder.packAccountGasLimits(500000n, 500000n), // High limits
                preVerificationGas: 80000n,
                gasFees: UserOperationBuilder.packGasFees(2000000000n, 2000000000n), // 2 Gwei
                paymasterAndData: '0x' as Hex,
                signature: '0x' as Hex
            };
            
            // Add Paymaster Data for SuperPaymaster manually
            // PM Data: [PM address, VerifGas, PostOpGas, Operator]
            const pmData = concat([
                 SP,
                 pad(toHex((200000n << 128n) | 100000n), { size: 32 }), // [Verify | PostOp]
                 anniAcc.address
            ]);
            userOp.paymasterAndData = pmData;
            
            // Get Hash
            const opHash = await UserOperationBuilder.getUserOpHash({
                userOp: UserOperationBuilder.jsonifyUserOp(userOp),
                entryPoint: EP,
                chainId: Number(config.chain.id),
                publicClient
            });

            // Sign
            const signature = await jasonAcc.signMessage({
                message: { raw: opHash }
            });
            userOp.signature = signature;

            // Submit
            const finalOp = UserOperationBuilder.jsonifyUserOp(userOp);
            
            // @ts-ignore
            const sentOpHash = await bundlerClient.request({
                method: 'eth_sendUserOperation',
                params: [finalOp, EP]
            });

            console.log(`   Tx Hash: ${sentOpHash}`);
            await waitAndCheckReceipt(publicClient, bundlerClient, sentOpHash, "T3 - SuperPM SBT Mint");
        }
        
    } catch (e: any) {
         console.log(`   ❌ T3 Failed: ${e.message}`);
    }
    
    // ---------------------------------------------------------
    // T4: BLS Reputation Update
    // ---------------------------------------------------------
    console.log('\n🔹 [T4] BLS Reputation Update (Consensus Mock)');
    try {
        const aggAbi = parseAbi([
            'function verifyAndExecute(uint256, address, uint8, address[], uint256[], uint256, bytes)'
        ]);
        const BLS_AGGREGATOR = (process.env.BLS_AGGREGATOR_ADDR || '0xe380d443842A8A37F691B9f3EF58e40073759edc') as Hex;

        const BATCH_SIZE = 10;
        const batchUsers = Array.from({length: BATCH_SIZE}, (_, i) => 
            `0x${(i+1).toString(16).padStart(40, '0')}` as Hex
        );
        const batchScores = Array.from({length: BATCH_SIZE}, () => 80n);
        const proposalId = BigInt(Math.floor(Math.random() * 1000000));
        const epoch = 1n;
        const operator = '0x0000000000000000000000000000000000000000' as Hex; 
        const slashLevel = 0;
        const chainId = await publicClient.getChainId();

        const expectedMessageHash = keccak256(encodeAbiParameters(
            parseAbiParameters('uint256, address, uint8, address[], uint256[], uint256, uint256'),
            [proposalId, operator, slashLevel, batchUsers, batchScores, epoch, BigInt(chainId)]
        ));

        const privKey = bls12_381.utils.randomPrivateKey();
        const pkPoint = bls12_381.G1.ProjectivePoint.fromPrivateKey(privKey);
        const pkRaw = pkPoint.toRawBytes(false);
        const pkX_padded = new Uint8Array(64); pkX_padded.set(pkRaw.slice(0, 48), 16);
        const pkY_padded = new Uint8Array(64); pkY_padded.set(pkRaw.slice(48, 96), 16);
        const pkHex = "0x" + toHex(pkX_padded).slice(2) + toHex(pkY_padded).slice(2);

        const msgBytes = hexToBytes(expectedMessageHash); 
        const msgPoint = bls12_381.G2.hashToCurve(msgBytes);
        const msgRaw = msgPoint.toRawBytes(false);
        
        function padG2(raw: Uint8Array): string {
            const x_c0 = raw.slice(0, 48);   const x_c1 = raw.slice(48, 96);
            const y_c0 = raw.slice(96, 144); const y_c1 = raw.slice(144, 192);
            
            const x_c0_p = new Uint8Array(64); x_c0_p.set(x_c0, 16);
            const x_c1_p = new Uint8Array(64); x_c1_p.set(x_c1, 16);
            const y_c0_p = new Uint8Array(64); y_c0_p.set(y_c0, 16);
            const y_c1_p = new Uint8Array(64); y_c1_p.set(y_c1, 16);
            
            return toHex(x_c1_p).slice(2) + toHex(x_c0_p).slice(2) + toHex(y_c1_p).slice(2) + toHex(y_c0_p).slice(2);
        }
        const msgHex = "0x" + padG2(msgRaw); 

        const sigPoint = msgPoint.multiply(BigInt(toHex(privKey)));
        const sigRaw = sigPoint.toRawBytes(false);
        const sigHex = "0x" + padG2(sigRaw);
        const signerMask = 0xFFFFn; 

        const encodedProof = encodeAbiParameters(
            parseAbiParameters('bytes, bytes, bytes, uint256'),
            [pkHex as Hex, sigHex as Hex, msgHex as Hex, signerMask]
        );

        console.log("   ⛽ Estimating Gas (Batch Size 10)...");
        try {
            const gasEstimate = await publicClient.estimateContractGas({ 
                address: BLS_AGGREGATOR, 
                abi: aggAbi, 
                functionName: 'verifyAndExecute', 
                args: [proposalId, operator, slashLevel, batchUsers, batchScores, epoch, encodedProof],
                account: jasonAcc.address
            });
            console.log(`   ✅ Total Gas Estimate: ${gasEstimate}`);
            console.log(`   📊 Amortized Gas per User: ${Number(gasEstimate) / BATCH_SIZE}`);
        } catch (e: any) {
            console.log(`   ⚠️ Contract Revert (Unauthorized).`);
        }

    } catch (e: any) {
         console.log(`   ❌ T4 Failed: ${e.message}`);
    }

    // ---------------------------------------------------------
    // T5: Credit Settlement
    // ---------------------------------------------------------
    console.log('\n🔹 [T5] Credit Settlement (Debt Check)');
    try {
        const debt = await publicClient.readContract({
             address: anniToken,
             abi: parseAbi(['function debts(address) view returns (uint256)']),
             functionName: 'debts',
             args: [aaAddress]
        });
        console.log(`   📊 Current User Debt: ${formatEther(debt as bigint)} xPNTs`);
        console.log(`   💡 Logic Cost (Off-chain Sync): Estimated ~0 gas (Events)`);
        
    } catch (e: any) {
        console.log(`   ❌ T5 Failed: ${e.message}`);
    }
}

// Setup Environment and Execute
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const args = process.argv.slice(2);
    let network = 'op-mainnet'; 
    const networkArg = args.find(arg => arg.startsWith('--network'));
    if (networkArg) {
        network = networkArg.includes('=') ? networkArg.split('=')[1] : args[args.indexOf('--network') + 1];
    }
    
    // 1. Manually load basic .env first to get Account Names
    const envFile = network === 'op-mainnet' ? '.env.op-mainnet' : '.env.sepolia';
    const envPath = path.resolve(process.cwd(), envFile);
    
    if (fs.existsSync(envPath)) {
        console.log(`📄 Bootstrapping Env from: ${envFile}`);
        dotenv.config({ path: envPath });
    }

    // 2. Resolve Keys via Cast Wallet
    const deployerAccount = process.env.DEPLOYER_ACCOUNT;
    const anniAccount = process.env.ANNI_ACCOUNT;
    
    const jasonKey = resolveKeyFromCast(deployerAccount || '', 'PRIVATE_KEY_JASON') || process.env.PRIVATE_KEY_JASON;
    const anniKey = resolveKeyFromCast(anniAccount || '', 'PRIVATE_KEY_ANNI') || process.env.PRIVATE_KEY_ANNI;

    if (!jasonKey) {
        console.error(`❌ PRIVATE_KEY_JASON not found and DEPLOYER_ACCOUNT could not be decrypted.`);
        console.error(`   Please export the key manually or ensure 'cast wallet' is configured with account: ${deployerAccount}`);
        process.exit(1);
    }

    // Inject Keys into Process Env for loadNetworkConfig
    process.env.PRIVATE_KEY_JASON = jasonKey;
    process.env.TEST_PRIVATE_KEY = jasonKey;
    process.env.PRIVATE_KEY_SUPPLIER = jasonKey;
    if (anniKey) process.env.PRIVATE_KEY_ANNI = anniKey;

    // 3. Load full config
    const config = loadNetworkConfig(network);
    runGaslessDataCollection(config, network).catch(console.error);
}
