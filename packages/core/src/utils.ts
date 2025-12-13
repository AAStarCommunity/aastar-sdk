import { type Hex, type Address, toHex } from 'viem';

// Simplified interface matching Viem's v0.7 PackedUserOperation
export interface PackedUserOperation {
    sender: Address;
    nonce: bigint;
    initCode: Hex;
    callData: Hex;
    accountGasLimits: Hex; // bytes32
    preVerificationGas: bigint;
    gasFees: Hex; // bytes32
    paymasterAndData: Hex;
    signature: Hex;
}

/**
 * Formats a PackedUserOperation (v0.7) into the specific JSON-RPC format 
 * expected by some Bundlers (e.g. Alchemy) which require:
 * 1. UNPACKED gas limits (verificationGasLimit, callGasLimit, etc.)
 * 2. SPLIT initCode (factory + factoryData)
 * 3. Hex strings for all values
 * 
 * @param userOp The valid packed UserOperation v0.7
 * @returns An object compatible with 'eth_sendUserOperation' params for Alchemy V0.7
 */
export function formatUserOpToBundlerV07(userOp: PackedUserOperation) {
    // 1. Unpack accountGasLimits (bytes32) -> verificationGasLimit (16 bytes) + callGasLimit (16 bytes)
    // Note: stored as [verif (high), call (low)] ?? 
    // Wait, create was: concat([pad(verif), pad(call)])
    // so: verif is first 16 bytes (0-32 chars of data), call is last 16 bytes (32-64 chars)
    // Hex string is 0x + 64 chars.
    
    const accountGasLimits = userOp.accountGasLimits;
    // ensure 0x prefix removal for slicing
    const limitsPayload = accountGasLimits.slice(2); 
    const verifHex = "0x" + limitsPayload.slice(0, 32);
    const callHex = "0x" + limitsPayload.slice(32, 64);
    
    // 2. Unpack gasFees (bytes32) -> maxPriorityFeePerGas (16 bytes) + maxFeePerGas (16 bytes)
    const feesPayload = userOp.gasFees.slice(2);
    const priorityHex = "0x" + feesPayload.slice(0, 32);
    const maxFeeHex = "0x" + feesPayload.slice(32, 64);

    // 3. Split initCode -> factory (20 bytes) + factoryData (rest)
    // initCode is [20 bytes addr][bytes data]
    let factory: Hex | undefined;
    let factoryData: Hex | undefined;
    
    if (userOp.initCode && userOp.initCode !== "0x" && userOp.initCode.length > 2) {
        // 20 bytes = 40 chars
        factory = userOp.initCode.slice(0, 42) as Hex;
        factoryData = ("0x" + userOp.initCode.slice(42)) as Hex;
    }

    // 4. Construct Result
    return {
        sender: userOp.sender,
        nonce: toHex(userOp.nonce),
        // SPLIT INITCODE
        factory,
        factoryData,
        // REMOVED: initCode
        
        callData: userOp.callData,
        
        // UNPACKED GAS LIMITS
        callGasLimit: callHex as Hex, // Ensure strictly as hex
        verificationGasLimit: verifHex as Hex,
        preVerificationGas: toHex(userOp.preVerificationGas),
        
        // UNPACKED FEES
        maxFeePerGas: maxFeeHex as Hex,
        maxPriorityFeePerGas: priorityHex as Hex,
        
        paymasterAndData: userOp.paymasterAndData,
        signature: userOp.signature
    };
}
