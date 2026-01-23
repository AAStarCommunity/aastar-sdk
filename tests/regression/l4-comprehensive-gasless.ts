// dotenv loaded by loadNetworkConfig
import * as fs from 'fs';
import * as path from 'path';
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
    toHex, 
    stringToBytes, 
    parseAbi,
    concat,
    pad,
    erc20Abi 
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { fileURLToPath } from 'url';
import { loadNetworkConfig, type NetworkConfig } from './config';
import { 
    createEndUserClient,
    createAdminClient,
    RoleIds,
    RoleDataFactory,
    SuperPaymasterClient,
    PaymasterClient
} from '../../packages/sdk/dist/index.js';
import { 
    UserOpScenarioBuilder, 
    UserOpScenarioType 
} from '../../packages/sdk/dist/utils/testScenarios.js';
import { 
    UserOperationBuilder 
} from '../../packages/sdk/dist/utils/userOp.js';
import { 
    type ScenarioParams 
} from '../../packages/sdk/dist/utils/testScenarios.js';
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
    xPNTsTokenABI
} from '../../packages/core/dist/index.js';

// Load L4 State
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
function loadState(networkName: string): any {
    const STATE_FILE = path.resolve(__dirname, `../../scripts/l4-state.${networkName}.json`);
    if (!fs.existsSync(STATE_FILE)) {
        throw new Error(`L4 State file not found at ${STATE_FILE}. Please run 'pnpm tsx scripts/l4-setup.ts --network=${networkName}' first.`);
    }
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
}

async function waitAndCheckReceipt(bundlerClient: any, opHash: Hash, label: string) {
    console.log(`   ⏳ [${label}] Waiting for confirmation...`);
    let receipt: any = null;
    for (let i = 0; i < 30; i++) {
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
        return true;
    } else {
        console.log(`   ❌ [${label}] FAILED or Timeout.`);
        if (receipt) console.log(`      Reason: ${receipt.reason || 'Unknown'}`);
        return false;
    }
}

export async function runComprehensiveGaslessTests(config: NetworkConfig, networkName: string = 'sepolia') {
    const state = loadState(networkName);
    console.log(`   📂 Loaded state for network: ${networkName}`);
    
    const publicClient = createPublicClient({
        chain: config.chain,
        transport: http(config.rpcUrl)
    });

    const bundlerClient = createWalletClient({
        chain: config.chain,
        transport: http(config.bundlerUrl)
    });

    console.log('\n═══════════════════════════════════════════════');
    console.log('🧪 L4 Comprehensive Gasless Verification');
    console.log('═══════════════════════════════════════════════\n');

    // 1. Setup Test Actors
    const jasonKey = process.env.PRIVATE_KEY_JASON as Hex;
    const supplierKey = config.supplierAccount?.privateKey;
    if (!jasonKey || !supplierKey) throw new Error(`Missing keys in environment for network: ${networkName}`);
    
    const jasonAcc = privateKeyToAccount(jasonKey);
    const supplierAcc = privateKeyToAccount(supplierKey);

    const jasonState = state.operators['jason'];
    const anniState = state.operators['anni'];

    // Safe access to operator structures
    const jasonOp = jasonState; 
    const anniOp = anniState;
    const zeroAddress = '0x0000000000000000000000000000000000000000';

    const jasonAddr = (jasonOp?.owner || jasonOp?.address || zeroAddress) as Address;
    const anniAddr = (anniOp?.owner || anniOp?.address || zeroAddress) as Address;
    // Use Anni as recipient for transfers (Bob removed per user request)
    const recipientAddr = anniAddr;

    // Fix: Select correct AA from aaAccounts
    const targetAA = state.aaAccounts.find((aa: any) => aa.opName.includes('Jason') || aa.label.includes('Jason'));
    
    if (!targetAA || !targetAA.address) throw new Error('Target AA account or address not found in state (Jason)');

    const adminClient = createAdminClient({ chain: config.chain, transport: http(config.rpcUrl), account: supplierAcc });
    const userClient = createEndUserClient({ chain: config.chain, transport: http(config.rpcUrl), account: jasonAcc });

    // --- Helper for Alchemy Gas Fixes ---
    const packAccount = (verif: bigint, call: bigint): Hex => {
        return pad(toHex((verif << 128n) | call), { size: 32 });
    };
    const packGasFees = (prio: bigint, max: bigint): Hex => {
        return pad(toHex((prio << 128n) | max), { size: 32 });
    };
    const packPM = (pm: Address, verif: bigint, post: bigint, data: Hex): Hex => {
        return concat([
            pm,
            pad(toHex((verif << 128n) | post), { size: 32 }),
            data
        ]);
    };

    const toAlchemyManual = (op: any) => {
        const agl = BigInt(op.accountGasLimits);
        const vGL = agl >> 128n;
        const cGL = agl & ((1n << 128n) - 1n);

        const gf = BigInt(op.gasFees);
        const prio = gf >> 128n;
        const max = gf & ((1n << 128n) - 1n);

        const res: any = {
            sender: op.sender,
            nonce: `0x${BigInt(op.nonce).toString(16)}`,
            callData: op.callData,
            signature: op.signature,
            verificationGasLimit: `0x${vGL.toString(16)}`,
            callGasLimit: `0x${cGL.toString(16)}`,
            maxPriorityFeePerGas: `0x${prio.toString(16)}`,
            maxFeePerGas: `0x${max.toString(16)}`,
            preVerificationGas: `0x${BigInt(op.preVerificationGas).toString(16)}`
        };

        if (op.initCode && op.initCode !== '0x') {
            const ic = op.initCode.slice(2);
            res.factory = '0x' + ic.slice(0, 40);
            res.factoryData = '0x' + ic.slice(40);
        }

        if (op.paymasterAndData && op.paymasterAndData !== '0x') {
            const pmd = op.paymasterAndData.slice(2);
            res.paymaster = '0x' + pmd.slice(0, 40);
            const pGas = BigInt('0x' + pmd.slice(40, 104));
            res.paymasterVerificationGasLimit = `0x${(pGas >> 128n).toString(16)}`;
            res.paymasterPostOpGasLimit = `0x${(pGas & ((1n << 128n) - 1n)).toString(16)}`;
            res.paymasterData = '0x' + pmd.slice(104);
        }
        return res;
    };

    const submitAlchemyOp = async (rawOp: any, label: string) => {
        // Alchemy Balance: 
        // 1. preVerificationGas >= ~45k
        // 2. Used / Limit >= 0.4 
        // 110k was ~0.43. 100k should be ~0.47 (PASS)
        const verificationGasLimit = 100000n;
        const callGasLimit = 200000n;
        const preVerificationGas = 60000n;
        const maxPriorityFeePerGas = BigInt(3000000000); // 3 gwei
        const maxFeePerGas = BigInt(5000000000); // 5 gwei

        const op: any = {
            ...rawOp,
            accountGasLimits: packAccount(verificationGasLimit, callGasLimit),
            preVerificationGas: preVerificationGas,
            gasFees: packGasFees(maxPriorityFeePerGas, maxFeePerGas),
            signature: '0x' as Hex
        };

        if (rawOp.paymasterAndData && rawOp.paymasterAndData !== '0x') {
             const pmd = rawOp.paymasterAndData.slice(2);
             const pm = ('0x' + pmd.slice(0, 40)) as Address;
             const dataPart = pmd.length >= 104 ? ('0x' + pmd.slice(104)) as Hex : ('0x' + pmd.slice(40)) as Hex;
             op.paymasterAndData = packPM(pm, 100000n, 60000n, dataPart);
        }

        const opHash = await UserOperationBuilder.getUserOpHash({
            userOp: op,
            entryPoint: config.contracts.entryPoint,
            chainId: config.chain.id,
            publicClient
        });
        op.signature = await jasonAcc.signMessage({ message: { raw: opHash } });

        const alchemyOp = toAlchemyManual(op);
        const ratio = Number(callGasLimit) / (Number(verificationGasLimit) + Number(callGasLimit) + Number(preVerificationGas) + 200000 + 50000);
        console.log(`   ⛽ [${label}] Gas Efficiency Ratio: ${ratio.toFixed(4)} (V:200k C:1M PMV:200k)`);
        
        try {
            // @ts-ignore
            const uHash = await bundlerClient.request({ method: 'eth_sendUserOperation', params: [alchemyOp, config.contracts.entryPoint] });
            return await waitAndCheckReceipt(bundlerClient, opHash, label);
        } catch (e: any) {
            if (e.message.includes('Method not found') || e.code === -32601) {
                console.log('   ⚠️ Bundler missing (Method not found). Fallback to handleOps...');
                const tuple = [
                    op.sender,
                    op.nonce,
                    op.initCode,
                    op.callData,
                    op.accountGasLimits,
                    op.preVerificationGas,
                    op.gasFees,
                    op.paymasterAndData,
                    op.signature
                ];
                const tx = await userClient.writeContract({
                    address: config.contracts.entryPoint,
                    abi: parseAbi(['function handleOps((address,uint256,bytes,bytes,bytes32,uint256,bytes32,bytes,bytes)[], address) external']),
                    functionName: 'handleOps',
                    args: [[tuple], jasonAcc.address]
                });
                console.log(`   🚀 Submitted via handleOps: ${tx}`);
                const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
                if (receipt.status !== 'success') {
                    console.log(`   ❌ handleOps Reverted!`);
                    return false;
                }
                console.log(`   ✅ handleOps Success! Block: ${receipt.blockNumber}`);
                return true;
            }
            throw e;
        }
    };

    // --- CASE 3.2: Community Registration via AA ---
    console.log('\n--- Case 3.2: Community Registration via AA ---');

    // Setup: Ensure AA has some ETH for native reg
    const ethBal = await publicClient.getBalance({ address: targetAA.address });
    if (ethBal < parseEther('0.05')) {
        console.log(`   ⛽ Funding AA with ETH for native test...`);
        const fundTx = await adminClient.sendTransaction({ account: supplierAcc, to: targetAA.address, value: parseEther('0.1') });
        await publicClient.waitForTransactionReceipt({ hash: fundTx });
    }

    const MEMBER_ROLE = RoleIds.ENDUSER;
    const bobCommunity = recipientAddr; 
    const anniCommunity = anniAddr;
    // Case 1: With ETH
    console.log('🔹 Case 1: Registration with ETH (Native)');
    try {
        const { userOp: nativeRegOp, opHash: nativeRegHash } = await UserOpScenarioBuilder.buildTransferScenario(UserOpScenarioType.NATIVE, {
            sender: targetAA.address,
            recipient: config.contracts.registry,
            tokenAddress: config.contracts.gToken, 
            amount: 0n,
            callData: encodeFunctionData({
                abi: RegistryABI,
                functionName: 'registerRole',
                args: [MEMBER_ROLE, targetAA.address, RoleDataFactory.endUser({ account: targetAA.address, community: bobCommunity })]
            }),
            entryPoint: config.contracts.entryPoint,
            chainId: config.chain.id,
            publicClient,
            ownerAccount: jasonAcc,
            nonceKey: BigInt(Date.now())
        } as unknown as ScenarioParams);

        await submitAlchemyOp(nativeRegOp, "Native Registration");
    } catch (e: any) {
        console.log(`   ⚠️ Native Reg failed or skip: ${e.message}`);
    }

    // Case 2: Gasless
    console.log('\n🔹 Case 2: Registration Gasless (via PMv4)');
    // We register to a different community (Demo) gaslessly via Jason's PM or Demo's PM
    try {
        const { userOp: gaslessRegOp, opHash: gaslessRegHash } = await UserOpScenarioBuilder.buildTransferScenario(UserOpScenarioType.GASLESS_V4, {
            sender: targetAA.address,
            paymaster: jasonState.paymasterV4,
            recipient: config.contracts.registry,
            tokenAddress: config.contracts.gToken,
            amount: 0n,
            callData: encodeFunctionData({
                abi: RegistryABI,
                functionName: 'registerRole',
                args: [MEMBER_ROLE, targetAA.address, RoleDataFactory.endUser({ account: targetAA.address, community: anniCommunity })]
            }),
            entryPoint: config.contracts.entryPoint,
            chainId: config.chain.id,
            publicClient,
            ownerAccount: jasonAcc,
            nonceKey: BigInt(Date.now())
        } as unknown as ScenarioParams);

        await submitAlchemyOp(gaslessRegOp, "Gasless Registration");
    } catch (e: any) {
        console.log(`   ⚠️ Gasless Reg failed: ${e.message}`);
    }

    // --- CASE 3.4: SuperPaymaster Credit System ---
    console.log('\n--- Case 3.4: SuperPaymaster Credit System ---');
    
    // --- Case 3.4: SuperPaymaster Credit System ---
    console.log('\n--- Case 3.4: SuperPaymaster Credit System ---');

    console.log('🔹 Elevating Reputation for Credit Tier 2...');
    try {
        const setRepTx = await adminClient.writeContract({
            account: supplierAcc,
            address: config.contracts.reputation,
            abi: ReputationSystemABI,
            functionName: 'setCommunityReputation',
            args: [anniAddr, targetAA.address, 20n] // Set to 20 (> 13 for Level 2)
        });
        await publicClient.waitForTransactionReceipt({ hash: setRepTx });
        console.log(`   ✅ Reputation set to 20 (Level 2)`);
    } catch (e: any) {
        console.log(`   ❌ Failed to set reputation: ${e.message}`);
    }

    const anniToken = (anniState.tokenAddress || zeroAddress) as Address;
    
    // Tx 1: SuperPM Normal Tx
    console.log('\n🔹 Tx 1: SuperPM cPNTs Payment (Normal)');
    try {
        const cpntBal = await publicClient.readContract({ address: anniToken, abi: erc20Abi, functionName: 'balanceOf', args: [targetAA.address] }) as bigint;
        if (cpntBal < parseEther('50')) {
            console.log(`   🪙 Minting cPNTs to AA...`);
            const flowKey = process.env.PRIVATE_KEY_ANNI as Hex || supplierKey;
            const flowAcc = privateKeyToAccount(flowKey);
            const flowClient = createWalletClient({ account: flowAcc, chain: config.chain, transport: http(config.rpcUrl) });
            const mintHash = await flowClient.writeContract({
                address: anniToken,
                abi: parseAbi(['function mint(address,uint256)']),
                functionName: 'mint',
                args: [targetAA.address, parseEther('100')]
            });
            await publicClient.waitForTransactionReceipt({ hash: mintHash });
        }

        console.log(`   🚀 Sending via SuperPaymasterClient...`);
        const txHash = await SuperPaymasterClient.submitGaslessTransaction(
            publicClient,
            createWalletClient({ account: jasonAcc, chain: config.chain, transport: http(config.rpcUrl) }),
            targetAA.address,
            config.contracts.entryPoint,
            config.bundlerUrl,
            {
                token: anniToken,
                recipient: recipientAddr,
                amount: parseEther('0.1'),
                operator: anniAddr,
                paymasterAddress: config.contracts.superPaymaster
            }
        );
        console.log(`   ✅ Sent! Hash: ${txHash}`);
        await waitAndCheckReceipt(bundlerClient, txHash, "SuperPM Normal Tx");

    } catch (e: any) {
         console.log(`   ⚠️ SuperPM Tx 1 failed: ${e.message}`);
    }

    // Tx 2: Insufficient cPNTs (Debt Test)
    console.log('\n🔹 Tx 2: SuperPM Credit/Debt Test (Insufficient Balance)');
    // Burn or transfer away all cPNTs
    const freshBal = await publicClient.readContract({ address: anniToken, abi: erc20Abi, functionName: 'balanceOf', args: [targetAA.address] }) as bigint;
    if (freshBal > 0n) {
        console.log(`   🔥 Clearing AA cPNTs balance...`);
        // We use sdk submit for burn too if simpler, using Paymaster V4 (since simple transfer)
        // Or just SuperPaymasterClient with 0 amount (no, wait, we need to burn tokens)
        // Let's stick to manual burn for now or use the previous working manual logic just for this native/setup op
        // Actually, let's just use SuperPaymasterClient to send it to DEAD address with full balance
        try {
            const burnHash = await SuperPaymasterClient.submitGaslessTransaction(
                publicClient,
                createWalletClient({ account: jasonAcc, chain: config.chain, transport: http(config.rpcUrl) }),
                targetAA.address,
                config.contracts.entryPoint,
                config.bundlerUrl,
                {
                    token: anniToken,
                    recipient: '0x000000000000000000000000000000000000dead',
                    amount: freshBal,
                    operator: anniAddr,
                    paymasterAddress: config.contracts.superPaymaster
                }
            );
            await waitAndCheckReceipt(bundlerClient, burnHash, "Clear Balance");
        } catch (e: any) {
             console.log(`   ⚠️ Clear Balance failed: ${e.message}`);
        }
    }

    // Now try Tx without balance -> Should trigger Credit -> Debt
    try {
        console.log(`   🚀 Attempting Tx without cPNTs balance (Expect Credit usage)...`);
        
        const debtHash = await SuperPaymasterClient.submitGaslessTransaction(
            publicClient,
            createWalletClient({ account: jasonAcc, chain: config.chain, transport: http(config.rpcUrl) }),
            targetAA.address,
            config.contracts.entryPoint,
            config.bundlerUrl,
            {
                token: anniToken,
                recipient: recipientAddr,
                amount: 0n, // Minimal transfer
                operator: anniAddr,
                paymasterAddress: config.contracts.superPaymaster
            }
        );
        
        const success = await waitAndCheckReceipt(bundlerClient, debtHash, "SuperPM Debt Tx");
        
        if (success) {
            const debt = await publicClient.readContract({ address: anniToken, abi: xPNTsTokenABI, functionName: 'debts', args: [targetAA.address] }) as bigint;
            console.log(`   📊 RECORDED DEBT: ${formatEther(debt)} cPNTs`);
        }
    } catch (e: any) {
        console.log(`   ⚠️ Debt test failed: ${e.message}`);
    }

    // Tx 4: Repayment
    console.log('\n🔹 Tx 4: Repayment (Deposit/Mint cPNTs)');
    console.log(`   🚀 Minting 50 cPNTs to AA (Should auto-repay debt)...`);
    const anniAcc = privateKeyToAccount(process.env.PRIVATE_KEY_ANNI as Hex);
    const anniChainClient = createWalletClient({ account: anniAcc, chain: config.chain, transport: http(config.rpcUrl) });
    const repayMintHash = await anniChainClient.writeContract({
        address: anniToken,
        abi: parseAbi(['function mint(address,uint256)']),
        functionName: 'mint',
        args: [targetAA.address, parseEther('50')]
    });
    await publicClient.waitForTransactionReceipt({ hash: repayMintHash });
    
    const finalBal = await publicClient.readContract({ address: anniToken, abi: erc20Abi, functionName: 'balanceOf', args: [targetAA.address] }) as bigint;
    const finalDebt = await publicClient.readContract({ address: anniToken, abi: xPNTsTokenABI, functionName: 'debts', args: [targetAA.address] }) as bigint;
    console.log(`   📊 Final Balance: ${formatEther(finalBal)} cPNTs`);
    console.log(`   📊 Final Debt: ${formatEther(finalDebt)} cPNTs`);
}

// Execute if main
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const args = process.argv.slice(2);
    let network = 'sepolia';
    const networkArg = args.find(arg => arg.startsWith('--network'));
    if (networkArg) {
        if (networkArg.includes('=')) {
            network = networkArg.split('=')[1];
        } else {
            const index = args.indexOf('--network');
            if (index >= 0 && args[index + 1]) {
                network = args[index + 1];
            }
        }
    }
    
    // @ts-ignore
    const config = loadNetworkConfig(network);
    runComprehensiveGaslessTests(config, network).catch(error => {
        console.error('❌ Fatal Error:', error);
        process.exit(1);
    });
}
