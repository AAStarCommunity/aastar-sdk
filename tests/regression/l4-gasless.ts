import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.sepolia' });
import * as fs from 'fs';
import * as path from 'path';
import { type Address, type Hash, type Hex, parseEther, formatEther, createWalletClient, http, createPublicClient, encodeFunctionData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { loadNetworkConfig, type NetworkConfig } from './config';
import { 
    UserOpScenarioBuilder, 
    UserOpScenarioType, 
    type ScenarioParams,
    UserOperationBuilder // Ensure this is imported
} from '../../packages/sdk/dist/index.js'; // Correct import source
import { tokenActions } from '../../packages/core/dist/index.js';
import { fileURLToPath } from 'url';

// Load L4 State
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATE_FILE = path.resolve(__dirname, '../../scripts/l4-state.json');

function loadState(): any {
    if (!fs.existsSync(STATE_FILE)) {
        throw new Error(`L4 State file not found at ${STATE_FILE}. Please run 'pnpm tsx scripts/l4-setup.ts' first.`);
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
  }
] as const;

const SUPER_PAYMASTER_ABI = [
  {
    "inputs": [
      { "name": "token", "type": "address" },
      { "name": "account", "type": "address" }
    ],
    "name": "deposits",
    "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

export async function runGaslessTests(config: NetworkConfig) {
    console.log('\n═══════════════════════════════════════════════');
    console.log('⛽ Running L4 Gasless Verification Tests (Stage 3)');
    console.log('═══════════════════════════════════════════════\n');

    const state = loadState();
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
        { 
            type: UserOpScenarioType.NATIVE, 
            label: '1. Standard ERC-4337 (User pays ETH)',
            expectedPayer: 'Account (ETH)',
            params: { tokenAddress: bobState.tokenAddress } // Paying native, moving bPNTs
        }
        /*
        ,{ 
            type: UserOpScenarioType.GASLESS_V4, 
            label: '2. Gasless V4 (Jason Community - aPNTs)',
            expectedPayer: 'PaymasterV4 (Jason)',
            params: { 
                tokenAddress: bobState.tokenAddress, 
                paymaster: jasonState.paymasterV4 
            }
        },
        { 
            type: UserOpScenarioType.GASLESS_V4, 
            label: '3. Gasless V4 (Bob Community - bPNTs)',
            expectedPayer: 'PaymasterV4 (Bob)',
            params: { 
                tokenAddress: bobState.tokenAddress, 
                paymaster: bobState.paymasterV4 
            }
        },
        { 
            type: UserOpScenarioType.SUPER_BPNT, 
            label: '4. SuperPaymaster (bPNT Internal)',
            expectedPayer: 'SuperPM (Anni Credit)',
            params: { 
                tokenAddress: bobState.tokenAddress, 
                paymaster: anniState.superPaymaster, 
                operator: jasonAcc.address, // Jason operator paying via SuperPM
                // Note: SuperPM logic deduction depends on internal token config
            }
        },
        { 
            type: UserOpScenarioType.SUPER_CPNT, 
            label: '5. SuperPaymaster (cPNT Internal)',
            expectedPayer: 'SuperPM (Anni Credit)',
            params: { 
                tokenAddress: bobState.tokenAddress, 
                paymaster: anniState.superPaymaster, 
                operator: jasonAcc.address,
            }
        }
        */
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
        
        try {
            // A. Construction
            console.log(`   🛠️  Constructing UserOp...`);
            
            // DEBUG: Check SuperPaymaster Credit Balance if applicable
            if (scene.type === UserOpScenarioType.SUPER_BPNT || scene.type === UserOpScenarioType.SUPER_CPNT) {
                try {
                    const token = scene.params.tokenAddress; // The token being paid (or related to credit)
                    // Note: SuperPaymaster might use a DIFFERENT token for calculating credit (e.g. Protocol Token)
                    // But typically 'deposits' tracks the 'token' balance.
                    // Let's assume Anni Credit is tracked under Anni Token Address? 
                    // Or is it tracking "Sender's Credit"?
                    // Actually, for SuperPaymaster, we check `deposits(token, account)`.
                    const operator = scene.params.operator || targetAA.address; 
                    // Who is paying? The Operator (Jason).
                    
                    // Actually, wait. SuperPaymaster logic:
                    // PaymasterData signature is form Operator.
                    // The Operator must have credit.
                    // Credit is stored in `deposits(token, operator)`.
                    
                    const balance = await publicClient.readContract({
                         address: scene.params.paymaster!,
                         abi: SUPER_PAYMASTER_ABI,
                         functionName: 'deposits',
                         args: [token!, operator!]
                    });
                    console.log(`   💰 SuperPaymaster Credit: ${formatEther(balance as bigint)} (Token: ${token}, Operator: ${operator})`);
                } catch (e: any) {
                    console.log(`   ⚠️  Failed to check SuperPM balance: ${e.message}`);
                }
            }

            const { userOp, opHash } = await UserOpScenarioBuilder.buildTransferScenario(scene.type, {
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
            if (scene.type === UserOpScenarioType.NATIVE) {
                // Lower verification gas to avoid efficiency error
                // 250000 -> 100000 (0x186a0)
                // Packed: [verification][call]
                // 0x000000000000000000000000000186a0...
                // existing callGas was 0x249f0 (150000).
                const newVerification = BigInt(100000);
                const newCall = BigInt(150000);
                adjustedOp.accountGasLimits = '0x' + newVerification.toString(16).padStart(32, '0') + newCall.toString(16).padStart(32, '0');
                
                // Re-calculate Hash
                const newHash = await UserOperationBuilder.getUserOpHash({
                    userOp: adjustedOp, 
                    entryPoint: config.contracts.entryPoint, 
                    chainId: config.chain.id,
                    publicClient
                });
                // Re-sign
                const newSig = await jasonAcc.signMessage({ message: { raw: newHash } }); // ECDSA sign
                adjustedOp.signature = newSig;
                console.log(`   ⚠️  Adjusted Gas Limits & Re-signed for Alchemy Efficiency.`);
                
                // Update local var for submission
                userOp.accountGasLimits = adjustedOp.accountGasLimits;
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
