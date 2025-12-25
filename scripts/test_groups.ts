import { Hex, Address, parseEther, formatEther, createPublicClient, createWalletClient, http, encodeFunctionData, parseAbi, concat, keccak256 } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { packUserOpLimits, getUserOpHash } from '../packages/account/src/index.js';
import { CORE_ADDRESSES } from '../packages/core/src/index.js';
import { ENTRY_POINT_V07, waitForUserOp } from './00_utils.js';

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
    const { chain, rpc, privateKey } = config;
    const account = privateKeyToAccount(privateKey);
    const client = createWalletClient({ account, chain, transport: http(rpc) });
    const publicClient = createPublicClient({ chain, transport: http(rpc) });

    const start = Date.now();
    const hash = await client.sendTransaction({
        chain,
        to: RECEIVER,
        value: parseEther("0.0001")
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
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

// --- Group 2: Pimlico Standard AA ---
export async function runPimlicoExperiment(config: any): Promise<TestMetrics> {
    const { chain, rpc, bundlerRpc, pimlicoRpc, privateKey, accountAddress, pimToken } = config;
    const publicClient = createPublicClient({ chain, transport: http(rpc) });
    const pimlicoClient = createPublicClient({ chain, transport: http(pimlicoRpc) });
    const bundlerClient = createPublicClient({ chain, transport: http(bundlerRpc) });
    const signer = privateKeyToAccount(privateKey);

    const erc20Abi = parseAbi(['function transfer(address, uint256) returns (bool)']);
    const executeAbi = parseAbi(['function execute(address, uint256, bytes)']);
    
    const apnts = process.env.APNTS_ADDRESS as Address;
    const transferData = encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [RECEIVER, parseEther("0.1")] });
    const userOpCallData = encodeFunctionData({ abi: executeAbi, functionName: 'execute', args: [apnts, 0n, transferData] });

    const nonce = await publicClient.readContract({
        address: ENTRY_POINT_V07, abi: parseAbi(['function getNonce(address, uint192) view returns (uint256)']),
        functionName: 'getNonce', args: [accountAddress, 0n]
    });

    const start = Date.now();
    const sponsorship: any = await (pimlicoClient as any).request({
        method: 'pm_sponsorUserOperation' as any,
        params: [
            { sender: accountAddress, nonce: toHex(nonce), callData: userOpCallData, callGasLimit: "0x1", verificationGasLimit: "0x1", preVerificationGas: "0x1", maxFeePerGas: "0x1", maxPriorityFeePerGas: "0x1", signature: "0x" },
            { entryPoint: ENTRY_POINT_V07, sponsorshipPolicyId: "erc20-token", token: pimToken }
        ] as any
    });

    const { paymaster, paymasterData, preVerificationGas, verificationGasLimit, callGasLimit, paymasterVerificationGasLimit, paymasterPostOpGasLimit, maxFeePerGas, maxPriorityFeePerGas } = sponsorship;
    
    const accountGasLimits = packUserOpLimits(BigInt(verificationGasLimit), BigInt(callGasLimit));
    const gasFees = packUserOpLimits(BigInt(maxFeePerGas), BigInt(maxPriorityFeePerGas));
    const paymasterGasLimits = packUserOpLimits(BigInt(paymasterVerificationGasLimit), BigInt(paymasterPostOpGasLimit));
    const paymasterAndData = concat([paymaster, paymasterGasLimits, paymasterData]);

    const packedUserOp = {
        sender: accountAddress, nonce, initCode: "0x" as Hex, callData: userOpCallData,
        accountGasLimits, preVerificationGas: BigInt(preVerificationGas), gasFees, paymasterAndData, signature: "0x" as Hex
    };

    const hash = await getUserOpHash(packedUserOp, ENTRY_POINT_V07, chain.id);
    const sig = await signer.signMessage({ message: { raw: hash } });

    const msg = {
        sender: accountAddress, nonce: toHex(nonce), callData: userOpCallData,
        callGasLimit: toHex(BigInt(callGasLimit)), verificationGasLimit: toHex(BigInt(verificationGasLimit)), preVerificationGas: toHex(BigInt(preVerificationGas)),
        maxFeePerGas: toHex(BigInt(maxFeePerGas)), maxPriorityFeePerGas: toHex(BigInt(maxPriorityFeePerGas)),
        paymaster, paymasterVerificationGasLimit: toHex(BigInt(paymasterVerificationGasLimit)), paymasterPostOpGasLimit: toHex(BigInt(paymasterPostOpGasLimit)),
        paymasterData, signature: sig
    };

    const uoHash = await (bundlerClient as any).request({ method: 'eth_sendUserOperation' as any, params: [msg, ENTRY_POINT_V07] as any });
    const receipt = await waitForUserOp(bundlerClient, uoHash as Hex);
    const latency = Date.now() - start;

    return {
        group: 'Pimlico',
        gasUsed: receipt.receipt.gasUsed.toString(),
        effectiveGasPrice: receipt.receipt.effectiveGasPrice.toString(),
        totalCostWei: (BigInt(receipt.receipt.gasUsed) * BigInt(receipt.receipt.effectiveGasPrice)).toString(),
        latencyMs: latency,
        status: 'Success',
        txHash: receipt.receipt.transactionHash
    };
}

// --- Group 3: Paymaster V4 (AOA) ---
export async function runAOAExperiment(config: any): Promise<TestMetrics> {
    const { chain, rpc, bundlerRpc, privateKey, accountAddress, paymasterV4 } = config;
    const publicClient = createPublicClient({ chain, transport: http(rpc) });
    const bundlerClient = createPublicClient({ chain, transport: http(bundlerRpc) });
    const signer = privateKeyToAccount(privateKey);

    const bpnts = process.env.BPNTS_ADDRESS as Address;
    const erc20Abi = parseAbi(['function transfer(address, uint256) returns (bool)']);
    const executeAbi = parseAbi(['function execute(address, uint256, bytes)']);
    
    const transferData = encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [RECEIVER, parseEther("0.1")] });
    const callData = encodeFunctionData({ abi: executeAbi, functionName: 'execute', args: [bpnts, 0n, transferData] });

    const nonce = await publicClient.readContract({
        address: ENTRY_POINT_V07, abi: parseAbi(['function getNonce(address, uint192) view returns (uint256)']),
        functionName: 'getNonce', args: [accountAddress, 0n]
    });

    const start = Date.now();
    // Estimation
    const pmGasLimitsPlaceholder = packUserOpLimits(300000n, 10000n);
    const pmAndDataForEst = concat([paymasterV4, pmGasLimitsPlaceholder]);
    
    const estRes: any = await (bundlerClient as any).request({
        method: 'eth_estimateUserOperationGas' as any,
        params: [{ sender: accountAddress, nonce: toHex(nonce), callData, paymasterAndData: pmAndDataForEst, signature: "0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c" as Hex }, ENTRY_POINT_V07] as any
    });

    const vGas = BigInt(estRes.verificationGasLimit) + 20000n;
    const cGas = BigInt(estRes.callGasLimit) + 10000n;
    const pvGas = BigInt(estRes.preVerificationGas);
    const pmVGas = BigInt(estRes.paymasterVerificationGasLimit || 300000n) + 20000n;
    const pmPGas = BigInt(estRes.paymasterPostOpGasLimit || 10000n) + 5000n;

    const block = await publicClient.getBlock();
    const priority = parseEther("2", "gwei");
    const maxFee = block.baseFeePerGas! * 2n + priority;

    const accountGasLimits = packUserOpLimits(vGas, cGas);
    const gasFees = packUserOpLimits(maxFee, priority);
    const pmLimits = packUserOpLimits(pmVGas, pmPGas);
    const finalPMAndData = concat([paymasterV4, pmLimits]);

    const packedUserOp = {
        sender: accountAddress, nonce, initCode: "0x" as Hex, callData,
        accountGasLimits, preVerificationGas: pvGas, gasFees, paymasterAndData: finalPMAndData, signature: "0x" as Hex
    };

    const hash = await getUserOpHash(packedUserOp, ENTRY_POINT_V07, chain.id);
    const sig = await signer.signMessage({ message: { raw: hash } });

    const msg = {
        sender: accountAddress, nonce: toHex(nonce), callData,
        callGasLimit: toHex(cGas), verificationGasLimit: toHex(vGas), preVerificationGas: toHex(pvGas),
        maxFeePerGas: toHex(maxFee), maxPriorityFeePerGas: toHex(priority),
        paymaster: paymasterV4, paymasterVerificationGasLimit: toHex(pmVGas), paymasterPostOpGasLimit: toHex(pmPGas),
        paymasterData: "0x" as Hex, signature: sig
    };

    const uoHash = await (bundlerClient as any).request({ method: 'eth_sendUserOperation' as any, params: [msg, ENTRY_POINT_V07] as any });
    const receipt = await waitForUserOp(bundlerClient, uoHash as Hex);
    const latency = Date.now() - start;

    return {
        group: 'AOA',
        gasUsed: receipt.receipt.gasUsed.toString(),
        effectiveGasPrice: receipt.receipt.effectiveGasPrice.toString(),
        totalCostWei: (BigInt(receipt.receipt.gasUsed) * BigInt(receipt.receipt.effectiveGasPrice)).toString(),
        latencyMs: latency,
        status: 'Success',
        txHash: receipt.receipt.transactionHash
    };
}

// --- Group 4: SuperPaymaster ---
export async function runSuperExperiment(config: any): Promise<TestMetrics> {
    const { chain, rpc, bundlerRpc, privateKey, accountAddress, superPaymaster } = config;
    const publicClient = createPublicClient({ chain, transport: http(rpc) });
    const bundlerClient = createPublicClient({ chain, transport: http(bundlerRpc) });
    const signer = privateKeyToAccount(privateKey);

    const apnts = process.env.APNTS_ADDRESS as Address;
    const erc20Abi = parseAbi(['function transfer(address, uint256) returns (bool)']);
    const executeAbi = parseAbi(['function execute(address, uint256, bytes)']);
    
    const transferData = encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [RECEIVER, parseEther("0.1")] });
    const callData = encodeFunctionData({ abi: executeAbi, functionName: 'execute', args: [apnts, 0n, transferData] });

    const nonce = await publicClient.readContract({
        address: ENTRY_POINT_V07, abi: parseAbi(['function getNonce(address, uint192) view returns (uint256)']),
        functionName: 'getNonce', args: [accountAddress, 0n]
    });

    const start = Date.now();
    // Estimation with SuperPaymaster Data
    const pmVGasDef = 300000n;
    const pmPGasDef = 10000n;
    const estOp: any = {
        sender: accountAddress, nonce: toHex(nonce), callData,
        paymaster: superPaymaster, paymasterVerificationGasLimit: toHex(pmVGasDef), paymasterPostOpGasLimit: toHex(pmPGasDef), paymasterData: signer.address,
        signature: "0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c" as Hex
    };
    
    const estRes: any = await (bundlerClient as any).request({ method: 'eth_estimateUserOperationGas' as any, params: [estOp, ENTRY_POINT_V07] as any });

    const vGas = BigInt(estRes.verificationGasLimit) + 20000n;
    const cGas = BigInt(estRes.callGasLimit) + 10000n;
    const pvGas = BigInt(estRes.preVerificationGas);
    const pmVGas = BigInt(estRes.paymasterVerificationGasLimit || pmVGasDef) + 20000n;
    const pmPGas = BigInt(estRes.paymasterPostOpGasLimit || pmPGasDef) + 5000n;

    const block = await publicClient.getBlock();
    const priority = parseEther("2", "gwei");
    const maxFee = block.baseFeePerGas! * 2n + priority;

    const accountGasLimits = packUserOpLimits(vGas, cGas);
    const gasFees = packUserOpLimits(maxFee, priority);
    const pmLimits = packUserOpLimits(pmVGas, pmPGas);
    const paymasterAndData = concat([superPaymaster, pmLimits, signer.address]);

    const packedUserOp = {
        sender: accountAddress, nonce, initCode: "0x" as Hex, callData,
        accountGasLimits, preVerificationGas: pvGas, gasFees, paymasterAndData, signature: "0x" as Hex
    };

    const hash = await getUserOpHash(packedUserOp, ENTRY_POINT_V07, chain.id);
    const sig = await signer.signMessage({ message: { raw: hash } });

    const msg = {
        sender: accountAddress, nonce: toHex(nonce), callData,
        callGasLimit: toHex(cGas), verificationGasLimit: toHex(vGas), preVerificationGas: toHex(pvGas),
        maxFeePerGas: toHex(maxFee), maxPriorityFeePerGas: toHex(priority),
        paymaster: superPaymaster, paymasterVerificationGasLimit: toHex(pmVGas), paymasterPostOpGasLimit: toHex(pmPGas),
        paymasterData: signer.address, signature: sig
    };

    const uoHash = await (bundlerClient as any).request({ method: 'eth_sendUserOperation' as any, params: [msg, ENTRY_POINT_V07] as any });
    const receipt = await waitForUserOp(bundlerClient, uoHash as Hex);
    const latency = Date.now() - start;

    return {
        group: 'SuperPaymaster',
        gasUsed: receipt.receipt.gasUsed.toString(),
        effectiveGasPrice: receipt.receipt.effectiveGasPrice.toString(),
        totalCostWei: (BigInt(receipt.receipt.gasUsed) * BigInt(receipt.receipt.effectiveGasPrice)).toString(),
        latencyMs: latency,
        status: 'Success',
        txHash: receipt.receipt.transactionHash
    };
}

function toHex(val: bigint | number | string): Hex {
    return typeof val === 'string' && val.startsWith('0x') ? val as Hex : `0x${BigInt(val).toString(16)}`;
}
