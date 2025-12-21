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
 * Asserts that a hex string has the expected byte length.
 * 
 * @param hex The hex string to validate (e.g. 0x...)
 * @param expectedBytes Expected number of bytes
 * @param name Name of the field for error message
 */
function assertHexLength(hex: Hex, expectedBytes: number, name: string) {
    // 0x + (bytes * 2)
    const expectedLength = 2 + expectedBytes * 2;
    if (hex.length !== expectedLength) {
        throw new Error(`SuperPaymaster Core: Invalid length for ${name}. Expected ${expectedBytes} bytes (${expectedLength} chars), got ${hex.length} chars.`);
    }
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
    const accountGasLimits = userOp.accountGasLimits;
    assertHexLength(accountGasLimits, 32, 'accountGasLimits');

    const limitsPayload = accountGasLimits.slice(2); 
    const verifHex = "0x" + limitsPayload.slice(0, 32);
    const callHex = "0x" + limitsPayload.slice(32, 64);
    
    // 2. Unpack gasFees (bytes32) -> maxPriorityFeePerGas (16 bytes) + maxFeePerGas (16 bytes)
    const gasFees = userOp.gasFees;
    assertHexLength(gasFees, 32, 'gasFees');

    const feesPayload = gasFees.slice(2);
    const priorityHex = "0x" + feesPayload.slice(0, 32);
    const maxFeeHex = "0x" + feesPayload.slice(32, 64);

    // 3. Split initCode -> factory (20 bytes) + factoryData (rest)
    let factory: Hex | undefined;
    let factoryData: Hex | undefined;
    
    if (userOp.initCode && userOp.initCode !== "0x" && userOp.initCode.length > 2) {
        // initCode must be at least 20 bytes (42 chars) for the factory address
        if (userOp.initCode.length < 42) {
            throw new Error(`SuperPaymaster Core: Invalid initCode length. Must be at least 20 bytes for factory address. Got ${userOp.initCode.length} chars.`);
        }
        factory = userOp.initCode.slice(0, 42) as Hex;
        factoryData = ("0x" + userOp.initCode.slice(42)) as Hex;
    }

    // 4. Construct Result
    return {
        sender: userOp.sender,
        nonce: toHex(userOp.nonce),
        factory,
        factoryData,
        callData: userOp.callData,
        callGasLimit: callHex as Hex,
        verificationGasLimit: verifHex as Hex,
        preVerificationGas: toHex(userOp.preVerificationGas),
        maxFeePerGas: maxFeeHex as Hex,
        maxPriorityFeePerGas: priorityHex as Hex,
        paymasterAndData: userOp.paymasterAndData,
        signature: userOp.signature
    };
}
