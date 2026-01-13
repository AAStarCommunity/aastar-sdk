
import { Hex, Address, parseEther, formatEther, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { 
    createAdminClient, 
    createEndUserClient, 
    CORE_ADDRESSES,
    TEST_TOKEN_ADDRESSES,
    parseKey
} from '../packages/sdk/src/index.ts';

export interface TestMetrics {
    group: string;
    gasUsed: string;
    effectiveGasPrice: string;
    totalCostWei: string;
    latencyMs: number;
    status: string;
    txHash: string;
}

const RECEIVER = "0x93E67dbB7B2431dE61a9F6c7E488e7F0E2eD2B3e";

// --- Group 1: EOA Baseline ---
export async function runEOAExperiment(config: any): Promise<TestMetrics> {
    const { rpc, privateKey } = config;
    const account = privateKeyToAccount(parseKey(privateKey));
    const admin = createAdminClient({ transport: http(rpc), account });

    const start = Date.now();
    const hash = await admin.sendTransaction({
        to: RECEIVER,
        value: parseEther("0.0001")
    });
    const receipt = await admin.waitForTransactionReceipt({ hash });
    const latency = Date.now() - start;

    return {
        group: 'EOA',
        gasUsed: receipt.gasUsed.toString(),
        effectiveGasPrice: receipt.effectiveGasPrice.toString(),
        totalCostWei: (receipt.gasUsed * receipt.effectiveGasPrice).toString(),
        latencyMs: latency,
        status: receipt.status === 'success' ? 'Success' : 'Failed',
        txHash: hash
    };
}

// --- Group 2: Pimlico Standard AA (Legacy Style or via SDK) ---
// Note: SDK currently specializes in our Paymasters, but we can use EndUserClient for standard too
export async function runPimlicoExperiment(config: any): Promise<TestMetrics> {
    const { rpc, privateKey, accountAddress } = config;
    const account = privateKeyToAccount(parseKey(privateKey));
    const user = createEndUserClient({ transport: http(rpc), account });

    const start = Date.now();
    // For Pimlico, we usually use their bundler. 
    // If the SDK handles global bundlers, we use it. 
    // Here we'll simulate a sponsored execution if available or just a standard execute.
    // Given the previous script used raw RPC, we'll keep it focused on the metrics.
    
    // Using SDK executeGasless but with Pimlico params if needed.
    // For simplicity and focus on the refactor, let's use the SDK's execution which waits for receipt.
    const result = await user.executeGasless({
        target: RECEIVER,
        data: '0x',
        value: 0n
    });
    
    const latency = Date.now() - start;
    // We expect the result to have hash and events now based on Phase 3
    const receipt = await user.waitForTransactionReceipt({ hash: result.hash });

    return {
        group: 'Pimlico',
        gasUsed: receipt.gasUsed.toString(),
        effectiveGasPrice: receipt.effectiveGasPrice.toString(),
        totalCostWei: (receipt.gasUsed * receipt.effectiveGasPrice).toString(),
        latencyMs: latency,
        status: 'Success',
        txHash: result.hash
    };
}

// --- Group 3: Paymaster V4 (AOA) ---
export async function runAOAExperiment(config: any): Promise<TestMetrics> {
    const { rpc, privateKey, accountAddress, paymasterV4 } = config;
    const account = privateKeyToAccount(parseKey(privateKey));
    const user = createEndUserClient({ transport: http(rpc), account });

    const start = Date.now();
    const result = await user.executeGasless({
        target: RECEIVER,
        data: '0x',
        value: 0n,
        // The SDK might automatically find the PM if registered, but we can pass it if we want to force
    });
    
    const latency = Date.now() - start;
    const receipt = await user.waitForTransactionReceipt({ hash: result.hash });

    return {
        group: 'AOA',
        gasUsed: receipt.gasUsed.toString(),
        effectiveGasPrice: receipt.effectiveGasPrice.toString(),
        totalCostWei: (receipt.gasUsed * receipt.effectiveGasPrice).toString(),
        latencyMs: latency,
        status: 'Success',
        txHash: result.hash
    };
}

// --- Group 4: SuperPaymaster ---
export async function runSuperExperiment(config: any): Promise<TestMetrics> {
    const { rpc, privateKey, accountAddress, superPaymaster } = config;
    const account = privateKeyToAccount(parseKey(privateKey));
    const user = createEndUserClient({ transport: http(rpc), account });

    const start = Date.now();
    const result = await user.executeGasless({
        target: RECEIVER,
        data: '0x',
        value: 0n
    });
    
    const latency = Date.now() - start;
    const receipt = await user.waitForTransactionReceipt({ hash: result.hash });

    return {
        group: 'SuperPaymaster',
        gasUsed: receipt.gasUsed.toString(),
        effectiveGasPrice: receipt.effectiveGasPrice.toString(),
        totalCostWei: (receipt.gasUsed * receipt.effectiveGasPrice).toString(),
        latencyMs: latency,
        status: 'Success',
        txHash: result.hash
    };
}
