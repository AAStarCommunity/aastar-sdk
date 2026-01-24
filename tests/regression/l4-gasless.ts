// Environment loading handled by loadNetworkConfig
import * as fs from 'fs';
import * as path from 'path';
import { type Address, type Hash, type Hex, parseEther, formatEther, createWalletClient, http, createPublicClient, encodeFunctionData, keccak256, encodeAbiParameters, toHex, stringToBytes, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { loadNetworkConfig, type NetworkConfig } from './config';
import { 
    UserOpScenarioBuilder, 
    UserOpScenarioType, 
    type ScenarioParams,
    UserOperationBuilder // Ensure this is imported
} from '../../packages/sdk/src/index.js'; // Correct import source
import { tokenActions, entryPointActions, EntryPointVersion } from '../../packages/core/src/index.js';
import { fileURLToPath } from 'url';

function loadState(networkName: string): any {
    const STATE_FILE = path.resolve(process.cwd(), `scripts/l4-state.${networkName}.json`);
    if (!fs.existsSync(STATE_FILE)) {
        throw new Error(`L4 State file not found at ${STATE_FILE}. Please run 'pnpm tsx scripts/l4-setup.ts --network=${networkName}' first.`);
    }
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
}

const ENTRYPOINT_ABI = [
  {
    "inputs": [
      {
        "components": [
          { "name": "sender", "type": "address" },
          { "name": "nonce", "type": "uint256" },
          { "name": "initCode", "type": "bytes" },
          { "name": "callData", "type": "bytes" },
          { "name": "accountGasLimits", "type": "bytes32" },
          { "name": "preVerificationGas", "type": "uint256" },
          { "name": "gasFees", "type": "bytes32" },
          { "name": "paymasterAndData", "type": "bytes" },
          { "name": "signature", "type": "bytes" }
        ],
        "name": "op",
        "type": "tuple"
      },
      { "name": "target", "type": "address" },
      { "name": "targetCallData", "type": "bytes" }
    ],
    "name": "simulateHandleOp",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "name": "opIndex", "type": "uint256" },
      { "name": "reason", "type": "string" }
    ],
    "name": "FailedOp",
    "type": "error"
  },
  {
      "inputs": [
        { "name": "preOpGas", "type": "uint256" },
        { "name": "paid", "type": "uint256" },
        { "name": "validAfter", "type": "uint48" },
        { "name": "validUntil", "type": "uint48" },
        { "name": "targetSuccess", "type": "bool" },
        { "name": "targetResult", "type": "bytes" }
      ],
      "name": "ExecutionResult",
      "type": "error"
  },
  {
    "inputs": [{ "name": "account", "type": "address" }],
    "name": "balanceOf",
    "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
      "inputs": [{ "name": "sender", "type": "address" }, { "name": "key", "type": "uint192" }],
      "name": "getNonce",
      "outputs": [{ "name": "nonce", "type": "uint256" }],
      "stateMutability": "view",
      "type": "function"
  }
] as const;

const ERC20_ABI = [
  {
    "inputs": [{ "name": "account", "type": "address" }],
    "name": "balanceOf",
    "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
      "inputs": [{ "name": "spender", "type": "address" }, { "name": "amount", "type": "uint256" }],
      "name": "approve",
      "outputs": [{ "name": "", "type": "bool" }],
      "stateMutability": "nonpayable",
      "type": "function"
  },
  {
      "inputs": [{ "name": "owner", "type": "address" }, { "name": "spender", "type": "address" }],
      "name": "allowance",
      "outputs": [{ "name": "", "type": "uint256" }],
      "stateMutability": "view",
      "type": "function"
  }
] as const;

const SUPER_PAYMASTER_ABI = [
  {
    "inputs": [{ "name": "operator", "type": "address" }],
    "name": "operators",
    "outputs": [
        { "name": "aPNTsBalance", "type": "uint128" },
        { "name": "exchangeRate", "type": "uint96" },
        { "name": "isConfigured", "type": "bool" },
        { "name": "isPaused", "type": "bool" },
        { "name": "xPNTsToken", "type": "address" },
        { "name": "reputation", "type": "uint32" },
        { "name": "minTxInterval", "type": "uint48" },
        { "name": "treasury", "type": "address" },
        { "name": "totalSpent", "type": "uint256" },
        { "name": "totalTxSponsored", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

// PaymasterV4 Deposit-Only Model ABI (v4.3.0)
const PAYMASTER_V4_DEPOSIT_ABI = [
  // Token Price Management
  {
    "name": "tokenPrices",
    "inputs": [{ "name": "token", "type": "address" }],
    "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "name": "setTokenPrice",
    "inputs": [{ "name": "token", "type": "address" }, { "name": "price", "type": "uint256" }],
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  // User Balance Management
  {
    "name": "balances",
    "inputs": [{ "name": "user", "type": "address" }, { "name": "token", "type": "address" }],
    "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "name": "depositFor",
    "inputs": [
      { "name": "user", "type": "address" },
      { "name": "token", "type": "address" },
      { "name": "amount", "type": "uint256" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  // Oracle/Price
  {
    "name": "updatePrice",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "name": "cachedPrice",
    "inputs": [],
    "outputs": [
      { "name": "price", "type": "uint208" },
      { "name": "updatedAt", "type": "uint48" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  // Owner/Admin
  {
    "name": "owner",
    "inputs": [],
    "outputs": [{ "name": "", "type": "address" }],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

export async function runGaslessTests(config: NetworkConfig, networkName: string = 'sepolia') {
    console.log('\n═══════════════════════════════════════════════');
    console.log(`⛽ Running L4 Gasless Verification Tests (${networkName})`);
    console.log('═══════════════════════════════════════════════\n');

    const state = loadState(networkName);
    const publicClient = createPublicClient({
        chain: config.chain,
        transport: http(config.rpcUrl)
    });
    const bundlerClient = createWalletClient({
        chain: config.chain,
        transport: http(config.bundlerUrl)
    });

    // 1. Setup Context
    const targetAA = state.aaAccounts.find((a: any) => a.label === 'Jason (AAStar)_AA1');
    if (!targetAA) throw new Error('Jason (AAStar)_AA1 not found in state.');

    // Operators and Tokens from State
    // Using Jason as Owner/Signer
    const jasonKey = process.env.PRIVATE_KEY_JASON as `0x${string}`;
    if (!jasonKey) throw new Error('PRIVATE_KEY_JASON missing');
    const jasonAcc = privateKeyToAccount(jasonKey);
    // Client for Chain Interactions (Owner actions)
    const chainClient = createWalletClient({
        account: jasonAcc,
        chain: config.chain,
        transport: http(config.rpcUrl)
    });

    const bobState = state.operators.bob;
    if (!bobState || !bobState.tokenAddress || !bobState.paymasterV4) throw new Error('Bob operator state incomplete');
    
    const jasonState = state.operators.jason;
    if (!jasonState || !jasonState.tokenAddress || !jasonState.paymasterV4) throw new Error('Jason operator state incomplete');

    const anniState = state.operators.anni;
    if (!anniState || !anniState.tokenAddress || !anniState.superPaymaster) throw new Error('Anni operator state incomplete');

    const recipient = bobState.address; // Bob as recipient
    const amount = parseEther('2');
    
    // 2. Define Scenarios
    const scenarios = [
        /*
        { 
            type: UserOpScenarioType.NATIVE, 
            label: '1. Standard ERC-4337 (User pays ETH)',
            expectedPayer: 'Account (ETH)',
            params: { tokenAddress: bobState.tokenAddress } // Paying native, moving bPNTs
        },
        */
        /*
        { 
            type: UserOpScenarioType.GASLESS_V4, 
            label: '2. Gasless V4 (Jason Community - aPNTs)',
            expectedPayer: 'PaymasterV4 (Jason)',
            params: { 
                tokenAddress: jasonState.tokenAddress, 
                paymaster: jasonState.paymasterV4 
            }
        },
        */
        { 
            type: UserOpScenarioType.SUPER_BPNT, 
            label: '4. SuperPaymaster (bPNT Internal)',
            expectedPayer: 'SuperPM (Anni Credit)',
            params: { 
                tokenAddress: bobState.tokenAddress, 
                paymaster: anniState.superPaymaster, 
                operator: anniState.address,
            }
        }
    ];

    // --- Helper for Bundler Errors ---
    function handleBundlerError(err: any, userOp: any, entryPoint: Address) {
        console.log(`   ❌ BUNDLER ERROR:`);
        const msg = err.message || JSON.stringify(err);
        
        // 1. Analyze Error Code
        if (msg.includes('AA23') || msg.includes('AA33')) {
            console.log(`      🚩 Reverted during simulation (AA23/AA33).`);
            console.log(`         Possible Causes: Paymaster validation failed, excessive gas, or signature invalid.`);
        } else if (msg.includes('AA21')) {
            console.log(`      🚩 Pre-fund too low (AA21). Check AA or Paymaster ETH balance.`);
        } else if (msg.includes('-32602')) {
            console.log(`      🚩 Invalid Params (-32602). Check JSON-RPC formatting (Hex strings).`);
        } else {
            console.log(`      🚩 Raw Error: ${msg}`);
        }

        // 2. Provide Debug Command
        generateDebugCommand(userOp, entryPoint);
    }

    // 3. Execution Loop
    for (const scene of scenarios) {
        console.log(`\n-----------------------------------------------------------`);
        console.log(`🎬 EXEC: ${scene.label}`);
        console.log(`   Context: Jason_AA1 -> Bob (${formatEther(amount)} bPNTs)`);
        console.log(`   Payer: ${scene.expectedPayer}`);

        // SBT Pre-check (AA33 Root Cause) - Added verification
        if (scene.type === UserOpScenarioType.GASLESS_V4) {
            const sbtBal = await publicClient.readContract({
                address: config.contracts.sbt,
                abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
                functionName: 'balanceOf',
                args: [targetAA.address]
            }) as bigint;
            console.log(`   🔍 Member SBT Balance: ${sbtBal.toString()}`);
            if (sbtBal === 0n) {
                console.error(`   ❌ Error: sender missing required SBT membership for gasless tests on ${networkName}.`);
                console.log(`      Please run: pnpm tsx scripts/l4-setup.ts --network=${networkName} first.`);
                throw new Error('Missing SBT');
            }
        }
        
        try {
            // A. Construction
            console.log(`   🛠️  Constructing UserOp...`);
            
            // DEBUG: Check SuperPaymaster Credit Balance if applicable
            if (scene.type === UserOpScenarioType.SUPER_BPNT || scene.type === UserOpScenarioType.SUPER_CPNT) {
                try {
                    const operator = scene.params.operator || targetAA.address; 
                    
                    const result = await publicClient.readContract({
                         address: scene.params.paymaster!,
                         abi: SUPER_PAYMASTER_ABI,
                         functionName: 'operators',
                         args: [operator as `0x${string}`]
                    }) as any;
                    const balance = result[0]; // aPNTsBalance
                    console.log(`   💰 SuperPaymaster Credit: ${formatEther(balance as bigint)} aPNTs (Operator: ${operator})`);
                    if (balance === 0n) {
                         console.error(`   ❌ Critical: Operator ${operator} has NO credit in SuperPaymaster.`);
                    }
                } catch (e: any) {
                    console.log(`   ⚠️  Failed to check SuperPM balance: ${e.message}`);
                }
            }

            let { userOp, opHash } = await UserOpScenarioBuilder.buildTransferScenario(scene.type, {
                sender: targetAA.address,
                ownerAccount: jasonAcc, // Jason signs for his AA
                recipient: recipient,
                tokenAddress: scene.params.tokenAddress, // Token being transferred (bPNTs)
                amount: amount,
                entryPoint: config.contracts.entryPoint,
                chainId: config.chain.id,
                publicClient,
                paymaster: scene.params.paymaster,
                operator: scene.params.operator,
                nonceKey: BigInt(Date.now()) // Use unique nonce key to avoid collisions if executing fast
            } as ScenarioParams); // Explicit cast if needed

            // DEBUG: Check Paymaster Checks (Gasless V4)
            if (scene.type === UserOpScenarioType.GASLESS_V4) {
                try {
                    // 1. Check Paymaster ETH Deposit
                    // 0. Paymaster Health Check & Auto-Fix
                    let currentPM = scene.params.paymaster!;
                    let pmOwner: Address = '0x0000000000000000000000000000000000000000';
                    try {
                        pmOwner = await publicClient.readContract({
                            address: currentPM,
                            abi: [{name: 'owner', type: 'function', inputs: [], outputs: [{type: 'address'}], stateMutability: 'view'}],
                            functionName: 'owner'
                        });
                    } catch {}

                    if (pmOwner.toLowerCase() !== jasonAcc.address.toLowerCase()) {
                        console.log(`   ⚠️  I am NOT owner of Paymaster ${currentPM} (Owner: ${pmOwner}).`);
                        console.log(`   🚨 Deploying NEW Private Paymaster...`);
                        
                        // Deploy New Paymaster
                        const factoryAddr = config.contracts.paymasterFactory;
                        const salt = BigInt(Math.floor(Math.random() * 1000000));
                        const { result: newAddr } = await publicClient.simulateContract({
                             address: factoryAddr,
                             abi: [{name: 'createPaymaster', type: 'function', inputs: [{type:'address'},{type:'uint256'}], outputs: [{type:'address'}], stateMutability:'nonpayable'}],
                             functionName: 'createPaymaster',
                             args: [jasonAcc.address, salt],
                             account: jasonAcc
                        });
                        const hash = await chainClient.writeContract({
                             address: factoryAddr,
                             abi: [{name: 'createPaymaster', type: 'function', inputs: [{type:'address'},{type:'uint256'}], outputs: [{type:'address'}], stateMutability:'nonpayable'}],
                             functionName: 'createPaymaster',
                             args: [jasonAcc.address, salt],
                        });
                        await publicClient.waitForTransactionReceipt({ hash });
                        currentPM = newAddr;
                        scene.params.paymaster = newAddr;
                        console.log(`   ✅ New Paymaster Deployed: ${currentPM}`);

                        // Deposit ETH
                        const depHash = await chainClient.writeContract({
                             address: config.contracts.entryPoint,
                             abi: [{name: 'depositTo', type: 'function', inputs: [{type:'address'}], outputs: [], stateMutability: 'payable'}],
                             functionName: 'depositTo',
                             args: [currentPM],
                             value: parseEther('0.1')
                        });
                        await publicClient.waitForTransactionReceipt({ hash: depHash });
                        console.log(`   💰 Deposited 0.1 ETH to New Paymaster`);
                    }

                    // Ensure Paymaster Stake (Critical for accessing Oracle/Tokens)
                    // Ensure Paymaster Stake (Critical for accessing Oracle/Tokens)
                    try {
                        const ep = entryPointActions(config.contracts.entryPoint, EntryPointVersion.V07)(publicClient);
                        const depositInfo = await ep.getDepositInfo({ account: currentPM });
                        const stakeVal = depositInfo.stake;
                        
                        // Check if stake is low (e.g. < 0.1 ETH)
                        if (stakeVal < parseEther('0.1')) {
                            console.log(`   🔸 Low Stake (${formatEther(stakeVal)}), Staking 0.2 ETH...`);
                            const stakeHash = await chainClient.writeContract({
                                address: currentPM,
                                abi: [{name: 'addStake', type: 'function', inputs: [{type:'uint32'}], outputs: [], stateMutability: 'payable'}],
                                functionName: 'addStake',
                                args: [86400], // 1 day
                                value: parseEther('0.2'),
                                account: jasonAcc
                            });
                            await publicClient.waitForTransactionReceipt({ hash: stakeHash });
                            console.log(`   ✅ Added 0.2 ETH Stake to Paymaster`);
                        } else {
                            console.log(`   ✅ Stake Sufficient: ${formatEther(stakeVal)} ETH (Staked: ${depositInfo.staked})`);
                        }
                    } catch (e: any) {
                        console.log(`   ⚠️ Failed to check/add stake: ${e.message}`);
                    }

                    // =====================================================
                    // PaymasterV4 Deposit-Only Model (v4.3.0) Validation
                    // =====================================================
                    
                    // 1. Check Token Price Support (replaces addGasToken)
                    const tokenPrice = await publicClient.readContract({
                        address: currentPM,
                        abi: PAYMASTER_V4_DEPOSIT_ABI,
                        functionName: 'tokenPrices',
                        args: [scene.params.tokenAddress!]
                    }) as bigint;
                    
                    if (tokenPrice === 0n) {
                        console.log(`   ⚠️  Token ${scene.params.tokenAddress} not supported (price=0). Setting price...`);
                        // Auto-set token price (1e8 = $1 USD per token unit - adjust as needed)
                        const defaultPrice = BigInt(1e8); // $1 per token unit (8 decimals)
                        const setPriceHash = await chainClient.writeContract({
                            address: currentPM,
                            abi: PAYMASTER_V4_DEPOSIT_ABI,
                            functionName: 'setTokenPrice',
                            args: [scene.params.tokenAddress!, defaultPrice],
                            account: jasonAcc
                        });
                        await publicClient.waitForTransactionReceipt({ hash: setPriceHash });
                        console.log(`   ✅ Token Price Set: $1.00 (${defaultPrice})`);
                    } else {
                        console.log(`   ✅ Token Price: $${Number(tokenPrice) / 1e8} USD`);
                    }
                    
                    // 2. Check AA User's Internal Balance in Paymaster (replaces external token allowance)
                    const internalBalance = await publicClient.readContract({
                        address: currentPM,
                        abi: PAYMASTER_V4_DEPOSIT_ABI,
                        functionName: 'balances',
                        args: [targetAA.address, scene.params.tokenAddress!]
                    }) as bigint;
                    console.log(`   💰 AA Internal Balance: ${formatEther(internalBalance)} tokens`);
                    
                    // 3. Auto-deposit if balance is too low
                    const minRequiredBalance = parseEther('100'); // Require at least 100 tokens
                    if (internalBalance < minRequiredBalance) {
                        console.log(`   ⚠️  Low internal balance! Depositing tokens...`);
                        
                        // First approve Paymaster to pull tokens
                        const depositAmount = parseEther('500'); // Deposit 500 tokens
                        const approveHash = await chainClient.writeContract({
                            address: scene.params.tokenAddress!,
                            abi: ERC20_ABI,
                            functionName: 'approve',
                            args: [currentPM, depositAmount],
                            account: jasonAcc
                        });
                        await publicClient.waitForTransactionReceipt({ hash: approveHash });
                        console.log(`   ✅ Approved ${formatEther(depositAmount)} tokens to Paymaster`);
                        
                        // Then call depositFor
                        const depositHash = await chainClient.writeContract({
                            address: currentPM,
                            abi: PAYMASTER_V4_DEPOSIT_ABI,
                            functionName: 'depositFor',
                            args: [targetAA.address, scene.params.tokenAddress!, depositAmount],
                            account: jasonAcc
                        });
                        await publicClient.waitForTransactionReceipt({ hash: depositHash });
                        console.log(`   ✅ Deposited ${formatEther(depositAmount)} tokens for AA: ${targetAA.address}`);
                    }
                    
                    // 4. Update Oracle Price Cache (Optional but recommended)
                    try {
                        const updatePriceHash = await chainClient.writeContract({
                            address: currentPM,
                            abi: PAYMASTER_V4_DEPOSIT_ABI,
                            functionName: 'updatePrice',
                            args: [],
                            account: jasonAcc
                        });
                        await publicClient.waitForTransactionReceipt({ hash: updatePriceHash });
                        console.log(`   ✅ Oracle Price Cache Updated`);
                    } catch (e: any) {
                        console.log(`   ⚠️  Failed to update price cache: ${e.message?.slice(0, 50)}...`);
                    }

                    // Resume checks using currentPM
                    const pmDeposit = await publicClient.readContract({
                        address: config.contracts.entryPoint,
                        abi: ENTRYPOINT_ABI,
                        functionName: 'balanceOf',
                        args: [scene.params.paymaster!]
                    });
                    console.log(`   💰 Paymaster ETH Deposit: ${formatEther(pmDeposit as bigint)} ETH`);

                    // 2. Check Sender Token Balance (if needed)
                    // Assumption: Paymaster checks if Sender has 'tokenAddress' balance?
                    // Depends on Sponsorship Policy. Assuming 'TokenGated' or 'Burn' model.
                    if (scene.params.tokenAddress) {
                         const senderParams = { sender: targetAA.address }; 
                         const tokenBal = await publicClient.readContract({
                             address: scene.params.tokenAddress,
                             abi: ERC20_ABI,
                             functionName: 'balanceOf',
                             args: [senderParams.sender]
                         });
                         console.log(`   💰 Sender Token Balance: ${formatEther(tokenBal as bigint)} (Token: ${scene.params.tokenAddress})`);
                         
                         // Check Allowance
                         const allowance = await publicClient.readContract({
                             address: scene.params.tokenAddress,
                             abi: [{name: 'allowance', type: 'function', inputs: [{type:'address'},{type:'address'}], outputs: [{type:'uint256'}], stateMutability:'view'}],
                             functionName: 'allowance',
                             args: [senderParams.sender, scene.params.paymaster!]
                         });
                         console.log(`   🔓 Sender Token Allowance to PM: ${formatEther(allowance as bigint)}`);
                         
                         if ((allowance as bigint) === 0n) {
                             console.log(`   🚨 Allowance is 0! Submitting Approve Op first...`);
                             
                             const approveData = encodeFunctionData({
                                 abi: ERC20_ABI,
                                 functionName: 'approve',
                                 args: [scene.params.paymaster!, BigInt('115792089237316195423570985008687907853269984665640564039457584007913129639935')] // MaxUint256
                             });

                             // Manually build Approve Op (to avoid Builder issues)
                             const approveOp = {
                                 sender: targetAA.address,
                                 nonce: `0x${(await publicClient.readContract({
                                     address: config.contracts.entryPoint,
                                     abi: ENTRYPOINT_ABI,
                                     functionName: 'getNonce',
                                     args: [targetAA.address, 0n]
                                 })).toString(16)}` as Hex,
                                 initCode: '0x' as Hex,
                                 callData: encodeFunctionData({
                                     abi: [{name:'execute', type:'function', inputs:[{type:'address'},{type:'uint256'},{type:'bytes'}], outputs:[], stateMutability:'nonpayable'}],
                                     functionName: 'execute',
                                     args: [scene.params.tokenAddress, 0n, approveData]
                                 }),
                                 accountGasLimits: '0x0000000000000000000000000000ea60000000000000000000000000000249f0' as Hex, // ~60k verification
                                 preVerificationGas: '0x0c350' as Hex, // ~50k
                                 gasFees: '0x0000000000000000000000007735940000000000000000000000000077359400' as Hex, // ~2 gwei
                                 paymasterAndData: '0x' as Hex, // Self-Pay (Requires ETH)
                                 signature: '0x' as Hex
                             };
                             
                             // Sign
                             const approveHash = await UserOperationBuilder.getUserOpHash({
                                 userOp: approveOp, 
                                 entryPoint: config.contracts.entryPoint, 
                                 chainId: config.chain.id,
                                 publicClient
                             });
                             approveOp.signature = await jasonAcc.signMessage({ message: { raw: approveHash } });
                             
                             
                             // Submit
                             console.log('--- Approve Op Debug ---');
                             console.log('PM Field:', approveOp.paymasterAndData);
                             
                             const alchemyApproveOp = UserOperationBuilder.toAlchemyUserOperation(approveOp);
                             
                             console.log('--- Alchemy Op ---');
                             console.log(JSON.stringify(alchemyApproveOp, null, 2));

                             // FORCE RESET Paymaster Fields (in case Builder added them)
                             (alchemyApproveOp as any).paymasterAndData = '0x';
                             (alchemyApproveOp as any).paymaster = undefined;
                             (alchemyApproveOp as any).paymasterVerificationGasLimit = undefined;
                             (alchemyApproveOp as any).paymasterPostOpGasLimit = undefined;

                             const approveBundle = await bundlerClient.request({
                                 method: 'eth_sendUserOperation',
                                 params: [alchemyApproveOp, config.contracts.entryPoint]
                             });
                             console.log(`   ✅ Approve Op Submitted: ${approveBundle}`);
                             
                             // Wait for receipt
                             let mined = false;
                             for (let k=0; k<15; k++) {
                                 await new Promise(r => setTimeout(r, 2000));
                                 try {
                                     // @ts-ignore
                                     const rcpt = await bundlerClient.request({ method: 'eth_getUserOperationReceipt', params: [approveBundle] });
                                     if (rcpt) { mined = true; break; }
                                 } catch {}
                             }
                             if (!mined) throw new Error("Approve Op timed out!");
                             console.log(`   ✅ Approve Op Mined. Proceeding with Gasless Op...`);
                             console.log(`   ℹ️ Note: Approve used Key 0. Main Op uses Key Time. Nonce update not required.`);
                             // No need to update nonce if keys are different!
                         }
                    }
                    
                    // =====================================================
                    // NOTE: PaymasterV4 Deposit-Only Model (v4.3.0)
                    // SBT/Token whitelist checks are REMOVED.
                    // Token support is controlled via tokenPrices mapping.
                    // Gas payment uses internal balances (depositFor).
                    // =====================================================

                    // 3.1 Check SBT Balance (Again, after potential addSBT)
                    // We need ensure Sender HAS the SBT.
                    const sbtBal = await publicClient.readContract({
                        address: config.contracts.sbt, // Use Config SBT as it is the Supported one
                        abi: [{name: 'balanceOf', type: 'function', inputs: [{type:'address'}], outputs: [{type:'uint256'}], stateMutability:'view'}],
                        functionName: 'balanceOf',
                        args: [targetAA.address]
                    }) as bigint;
                    console.log(`   🎫 Sender SBT Balance: ${sbtBal}`);

                    if (sbtBal === 0n) {
                         console.log(`   🚨 Sender has NO SBT! Minting via Registry (Auto-Join Jason Community)...`);
                         
                         // Prepare RegisterOp (Native)
                         // Role: MEMBER
                         // Data: Jason Community Address
                         const MEMBER_ROLE = keccak256(stringToBytes("MEMBER"));
                         const communityAddr = jasonState.address; // Jason Community
                         if (!communityAddr) throw new Error("Jason Community Address not found");

                         const registerCallData = encodeFunctionData({
                             abi: [{name: 'registerRole', type: 'function', inputs: [{type:'bytes32'}, {type:'bytes'}], outputs: [], stateMutability: 'nonpayable'}],
                             functionName: 'registerRole',
                             args: [MEMBER_ROLE, encodeAbiParameters([{type:'address'}], [communityAddr])]
                         });

                         // Build Native Op
                         const registerOp = await UserOpScenarioBuilder.buildTransferScenario(UserOpScenarioType.NATIVE, {
                             sender: targetAA.address,
                             recipient: config.contracts.registry, // EXECUTE ON REGISTRY
                             amount: 0n,
                             nonce: await publicClient.readContract({
                                 address: config.contracts.entryPoint,
                                 abi: [{name:'getNonce', type:'function', inputs:[{type:'address'},{type:'uint192'}], outputs:[{type:'uint256'}], stateMutability:'view'}],
                                 functionName: 'getNonce',
                                 args: [targetAA.address, 0n]
                             }),
                             callData: encodeFunctionData({
                                 abi: [{name:'execute', type:'function', inputs:[{type:'address'},{type:'uint256'},{type:'bytes'}], outputs:[], stateMutability:'nonpayable'}],
                                 functionName: 'execute',
                                 args: [config.contracts.registry, 0n, registerCallData]
                             }),
                             entryPoint: config.contracts.entryPoint,
                             chainId: config.chain.id,
                             publicClient,
                             ownerAccount: jasonAcc,
                             nonceKey: 0n // Use Key 0 for consistency
                         } as ScenarioParams);

                         const { userOp: regUserOp, opHash: regHash } = registerOp;
                         console.log(`   🚀 Submitting Register (Mint) Op: ${regHash}`);
                         
                         const bClient = createWalletClient({
                            account: jasonAcc,
                            chain: config.chain,
                            transport: http(config.bundlerUrl)
                         });
                         const uHash = await bClient.sendUserOperation({
                            userOperation: regUserOp as any,
                            entryPoint: config.contracts.entryPoint
                         });
                         console.log(`   ✅ Register Op Submitted: ${uHash}. Waiting...`);
                         
                         // Wait for mine
                         let mined = false;
                         for(let i=0; i<30; i++) {
                             const rx = await publicClient.getUserOperationReceipt({ hash: uHash });
                             if (rx) { mined = true; break; }
                             await new Promise(r => setTimeout(r, 1000));
                         }
                         if (!mined) throw new Error("Register Op timed out!");
                         console.log(`   ✅ Register Op Mined. SBT Minted.`);
                         
                         console.log(`   ℹ️ Note: Nonce updated by Register Op (Key 0). Gasless Op uses Key Time. Safe.`);
                    }

                    const pmOracleABI = [{name: 'ethUsdPriceFeed', type: 'function', inputs: [], outputs: [{type:'address'}], stateMutability:'view'}];
                    const oracleAddr = await publicClient.readContract({
                        address: scene.params.paymaster!,
                        abi: pmOracleABI,
                        functionName: 'ethUsdPriceFeed'
                    }) as Address;
                    
                    const oracleABI = [{name: 'latestRoundData', type: 'function', inputs: [], outputs: [{type:'uint80'},{type:'int256'},{type:'uint256'},{type:'uint256'},{type:'uint80'}], stateMutability:'view'}];
                    const [_id, _price, _start, updatedAt, _ans] = await publicClient.readContract({
                        address: oracleAddr,
                        abi: oracleABI,
                        functionName: 'latestRoundData'
                    }) as any[];
                    
                    const now = Math.floor(Date.now() / 1000);
                    const diff = now - Number(updatedAt);
                    console.log(`   🔮 Oracle Staleness: ${diff}s (Threshold: 900s)`);

                } catch (e: any) {
                    console.log(`   ⚠️  Failed to check balances: ${e.message}`);
                }
            }

            console.log(`   🔑 UserOp Hash: ${opHash}`);

            // HACK: Alchemy Error "Verification gas limit efficiency too low" (Expected 0.4, Got 0.19)
            // This means our VerificationGasLimit (250k) is too high for the actual work done (~50k).
            // We lower it manually for now to pass the check without full estimation flow.
            // Note: Changing gas limits requires RESIGNING the UserOp! 
            // Since we don't want to re-implement signing here, we must Ensure UserOpScenarioBuilder uses reasonable defaults?
            // OR checks if strict estimation is needed.
            
            // Actually, if we change gas, Hash changes, Signature becomes invalid.
            // So we CANNOT just change gas here.
            
            // We must update the Builder call or parameters?
            // `buildTransferScenario` receives params. 
            // Does it support custom gas limits?
            // Let's check `ScenarioParams`.
            
            // If not, we are stuck until we implement Estimation -> Sign flow.
            // Let's assume we can simply recreate the UserOp with better limits if `buildTransferScenario` allows it.
            // Inspecting `testScenarios.ts`: it sets constant `accountGasLimits`.
            
            // FASTEST FIX:
            // Since I have the Owner Account (`jasonAcc`), I can re-sign here.
            // 1. Unpack Op
            // 2. Modify Limit
            // 3. Re-pack (conceptually) -> Get Hash -> Sign -> Update Signature.
            
            // Let's try estimation first to see accurate values?
            // No, just try creating a NEW UserOp using `UserOperationBuilder` with explicit limits.
            
            // BETTER: Update `UserOpScenarioBuilder.buildTransferScenario` to accept gas overrides?
            // Or just do estimation.
            
            // Let's implement a quick Re-Sign block.
            // This is messy but effectively solves the "Invalid Params" issue immediately.
           
            // 1. Adjust Gas (using unpacked logic structure for clarity, then pack for hashing)
            const adjustedOp = { ...userOp };
            if (scene.type === UserOpScenarioType.NATIVE || scene.type === UserOpScenarioType.GASLESS_V4) {
                // Lower verification gas to avoid efficiency error
                // 250000 -> 100000 (0x186a0)
                const newVerification = BigInt(100000);
                const newCall = BigInt(150000);
                
                // Correct Local Packing Functions (SDK padStart bug fix)
                const packAccount = (verif: bigint, call: bigint): Hex => {
                    return ('0x' + 
                        verif.toString(16).padStart(32, '0') + 
                        call.toString(16).padStart(32, '0')
                    ) as Hex;
                };
                const packPM = (pm: Address, verif: bigint, post: bigint, data: Hex): Hex => {
                    return (pm + 
                        verif.toString(16).padStart(32, '0') + 
                        post.toString(16).padStart(32, '0') + 
                        data.slice(2)
                    ) as Hex;
                };

                // Pack Account Limits
                adjustedOp.accountGasLimits = packAccount(newVerification, newCall);
                
                // For GASLESS_V4, also adjust Paymaster Limits (curr 300k -> 200k)
                if (scene.type === UserOpScenarioType.GASLESS_V4) {
                    const pm = scene.params.paymaster!;
                    const pmVerif = BigInt(200000); // 200k (Increased to strict rule out OOG)
                    const pmPost = BigInt(50000);   // 50k
                    adjustedOp.paymasterAndData = packPM(pm, pmVerif, pmPost, '0x');
                }

                // --- 2x Gas Boost (User Request) ---
                console.log(`   ⛽ Boosting Gas (2x)...`);
                const currentGasFees = BigInt(adjustedOp.gasFees);
                const maxPriority = currentGasFees & BigInt("0xffffffffffffffffffffffffffffffff");
                const maxFee = currentGasFees >> 128n;

                // Ensure minimums (Sepolia defaults)
                const minPriority = BigInt(2000000000); // 2 gwei min priority
                const targetPriority = (maxPriority * 2n) > minPriority ? (maxPriority * 2n) : minPriority;
                const targetMaxFee = (maxFee * 2n) > (targetPriority + minPriority) ? (maxFee * 2n) : (targetPriority + minPriority + BigInt(2000000000));

                const packGasFees = (prio: bigint, max: bigint): Hex => {
                    return ('0x' + 
                        max.toString(16).padStart(32, '0') + 
                        prio.toString(16).padStart(32, '0')
                    ) as Hex;
                };
                adjustedOp.gasFees = packGasFees(targetPriority, targetMaxFee);
                console.log(`      Old: ${formatEther(maxFee)} / ${formatEther(maxPriority)}`);
                console.log(`      New: ${formatEther(targetMaxFee)} / ${formatEther(targetPriority)}`);

                // Re-calculate Hash
                const newHash = await UserOperationBuilder.getUserOpHash({
                    userOp: adjustedOp, 
                    entryPoint: config.contracts.entryPoint, 
                    chainId: config.chain.id,
                    publicClient
                });
                opHash = newHash; // Correctly update for polling
                console.log(`   🔑 New Hash: ${opHash}`);
                // Re-sign
                const newSig = await jasonAcc.signMessage({ message: { raw: newHash } }); // ECDSA sign
                adjustedOp.signature = newSig;
                console.log(`   ⚠️  Adjusted Gas Limits & Re-signed locally (Fixed Packing).`);
                
                // Update local var for submission
                userOp.accountGasLimits = adjustedOp.accountGasLimits;
                userOp.paymasterAndData = adjustedOp.paymasterAndData;
                userOp.gasFees = adjustedOp.gasFees; // CRITICAL: Must sync gasFees to match signature
                userOp.signature = adjustedOp.signature;
            }

            // B. Submission (Bundler)
            console.log(`   🚀 Submitting to Bundler...`);
            // Bundler wants hex strings
            // AND strict Alchemy v0.7 Schema (Unpacked fields)
            const formattedOp = UserOperationBuilder.jsonifyUserOp(userOp);
            
            // Convert to Alchemy v0.7 JSON format (Unpacked)
            // This is required because Alchemy's RPC anticipates unpacked fields even for v0.7
            const alchemyOp = UserOperationBuilder.toAlchemyUserOperation(formattedOp);

            try {
                // @ts-ignore
                const bundleHash = await bundlerClient.request({
                    method: 'eth_sendUserOperation',
                    params: [alchemyOp, config.contracts.entryPoint]
                });
                console.log(`   ✅ Submitted! Bundle Hash: ${bundleHash}`);

                // C. Wait for Receipt
                console.log(`   ⏳ Waiting for confirmation...`);
                // Simple polling loop
                // Simple polling loop
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

                if (receipt) {
                    if (receipt.success) {
                        console.log(`   🎉 SUCCESS! Receipt found in block ${receipt.receipt.blockNumber}`);
                        console.log(`      ⛽ Actual Gas Cost: ${receipt.actualGasCost}`);
                        
                        // Log to file for easy reference
                        const logDir = path.resolve(__dirname, '../../tests/regression/logs');
                        if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
                        fs.appendFileSync(path.join(logDir, 'l4-transaction.log'), `[${new Date().toISOString()}] SUCCESS | Op: ${opHash} | Tx: ${receipt.receipt.transactionHash} | Gas: ${receipt.actualGasCost}\n`);
                        console.log(`      📝 Logged to tests/regression/logs/l4-transaction.log`);

                    } else {
                        console.log(`   ❌ REVERTED on-chain!`);
                        console.log(`      Reason: ${receipt.reason || 'Unknown'}`);
                        generateDebugCommand(userOp, config.contracts.entryPoint);
                    }
                } else {
                    console.log(`   ⚠️  Timeout waiting for receipt.`);
                }

            } catch (bundlerErr: any) {
                const formattedErr = formatBundlerError(bundlerErr);
                console.log(`   ❌ BUNDLER ERROR:`);
                console.log(`      🚩 ${formattedErr}`);

                // SIMULATION: Verify validity locally before failing
                try {
                    console.log(`\n   🕵️  Running explicit simulation (debug_revert)...`);
                    await publicClient.simulateContract({
                        address: config.contracts.entryPoint,
                        abi: ENTRYPOINT_ABI,
                        functionName: 'simulateHandleOp',
                        args: [userOp, '0x0000000000000000000000000000000000000000', '0x'],
                        account: userOp.sender
                    });
                } catch (simErr: any) {
                    // simulateHandleOp ALWAYS reverts.
                    // Check if it is ExecutionResult (Success) or FailedOp (Failure)
                    const errStr = JSON.stringify(simErr, null, 2);
                    if (errStr.includes('ExecutionResult')) {
                         console.log(`   ✅ Simulation result logic: Valid ExecutionResult (Op is valid!)`);
                         console.log(`      (Bundler rejection is likely due to reputation/throttling/mempool issues)`);
                    } else if (errStr.includes('FailedOp')) {
                         console.log(`   ❌ Simulation result logic: FailedOp!`);
                         // Try to see if message contains the reason
                         // Viem error usually has 'args': [0, "reason"] for FailedOp?
                         console.log(`      Raw Error: ${simErr.shortMessage || simErr.message}`);
                    } else {
                         console.log(`   ❌ Simulation reverted with unknown error:`);
                         console.log(`      ${simErr.shortMessage || simErr.message}`);
                    }
                }
                
                handleBundlerError(bundlerErr, userOp, config.contracts.entryPoint);
            }

        } catch (e: any) {
            console.log(`   ❌ SDK/Construction Error: ${e.message}`);
            // Analyze if it's SDK parameter issue
        }
    }
}

// --- Debugging Utilities ---

function formatBundlerError(err: any): string {
    const msg = err.message || JSON.stringify(err);
    if (msg.includes('AA23')) return 'AA23 reverted (or OOG)';
    if (msg.includes('AA24')) return 'AA24 signature error';
    if (msg.includes('-32602')) return 'Invalid Params (-32602). Check JSON-RPC formatting (Hex strings).';
    if (msg.includes('-32500')) return 'Server Error (-32500). Transaction rejected by bundler.';
    return msg;
}

function handleBundlerError(err: any, userOp: any, entryPoint: Address) {
    // console.log already handled in main loop mostly, but ensure minimal output
    // generateDebugCommand(userOp, entryPoint); // Already called in main loop if needed
}

function generateDebugCommand(userOp: any, entryPoint: Address) {
    console.log(`\n   🛠️  DEBUG COMMAND (Cast):`);
    // Construct handleOps call for manual trace
    // handleOps(UserOp[], address)
    // We need to encode the tuple manually or just tell user to inspect
    console.log(`   -------------------------------------------------------`);
    console.log(`   # 1. Save UserOp to json`);
    
    // Actually write to file for easier debugging
    fs.writeFileSync('debug_op.json', JSON.stringify(userOp, null, 2));
    console.log(`   (Saved to debug_op.json)`);
    
    console.log(`   echo '${JSON.stringify(userOp)}' > debug_op.json`);
    console.log(`   # 2. Simulate validation (Local Foundry/Cast)`);
    // Utilize encodeFunctionData to avoid shell parsing issues with complex tuples
    const calldata = encodeFunctionData({
        abi: ENTRYPOINT_ABI,
        functionName: 'simulateHandleOp',
        args: [userOp, '0x0000000000000000000000000000000000000000', '0x']
    });
    console.log(`   cast call ${entryPoint} ${calldata} --rpc-url $RPC_URL --trace`);
    console.log(`   -------------------------------------------------------`);
}

// Execute if main
// Check if running directly via tsx
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    // Manually parse network arg or default to 'sepolia'
    const networkArg = process.argv.find(arg => arg.startsWith('--network='));
    const network = networkArg ? networkArg.split('=')[1] : 'sepolia';
    
    // @ts-ignore
    const config = loadNetworkConfig(network);
    runGaslessTests(config).catch(error => {
        console.error('❌ Fatal Error:', error);
        process.exit(1);
    });
}
