
import { createPublicClient, createWalletClient, http, type Hex, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Import from local packages (Simulating SDK usage)
import { getSuperPaymasterMiddleware } from '../packages/paymaster/src/index.js';
// import { createAAStarPublicClient } from '../packages/core/src/index.js'; 
// (We use direct imports for now as TS alias might not be set in ts-node context without tsconfig paths)

dotenv.config({ path: path.resolve(process.cwd(), '.env.v3') });

const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545';
const ADMIN_KEY = process.env.ADMIN_KEY as Hex;
const SUPER_PAYMASTER = process.env.SUPERPAYMASTER_ADDR as Hex; // V3 address (used for V3 middleware)
// For V3 middleware, we need an operator address. We use Admin as operator for test.
const OPERATOR = privateKeyToAccount(ADMIN_KEY).address;

async function runSDKVerification() {
    console.log("📦 Verifying AAStar SDK (Phase 1)...");
    
    // 1. Initialize Middleware
    console.log("   🔌 Initializing Middleware...");
    const middleware = getSuperPaymasterMiddleware({
        paymasterAddress: SUPER_PAYMASTER,
        operator: OPERATOR,
        verificationGasLimit: 150000n,
        postOpGasLimit: 20000n
    });

    // 2. Mock UserOp
    const mockUserOp = {
        sender: "0x1234567890123456789012345678901234567890" as Hex,
        nonce: 0n,
        initCode: "0x" as Hex,
        callData: "0x" as Hex,
        preVerificationGas: 50000n,
        verificationGasLimit: 100000n,
        callGasLimit: 20000n,
        maxFeePerGas: parseEther("0.000000010"),
        maxPriorityFeePerGas: parseEther("0.000000001"),
        signature: "0x" as Hex
    };

    // 3. Generate Paymaster Data
    console.log("   🛠️ Generatign PaymasterAndData...");
    const result = await middleware.sponsorUserOperation({ userOperation: mockUserOp });
    
    console.log(`   ✅ Result: ${result.paymasterAndData}`);
    
    // 4. Verify PaymasterAndData Layout (V3)
    // [Paymaster(20)] [VerGas(16)] [PostOpGas(16)] [Operator(20)] = 72 bytes = 144 chars + 0x = 146
    if (result.paymasterAndData.length !== 146) {
        throw new Error(`Invalid Length: ${result.paymasterAndData.length}, expected 146`);
    }

    const pmAddr = result.paymasterAndData.slice(0, 42); // 0x + 40 chars
    if (pmAddr.toLowerCase() !== SUPER_PAYMASTER.toLowerCase()) {
        throw new Error(`Paymaster Mismatch: ${pmAddr} != ${SUPER_PAYMASTER}`);
    }

    console.log("   ✨ SDK Verified Successfully!");
}

runSDKVerification().catch(console.error);
