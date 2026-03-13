import { ethers } from "ethers";
import type { PackedUserOperation, UserOperation } from "../types";

export class UserOpBuilder {
  // Basic defaults
  private static DEFAULT_VERIFICATION_GAS_LIMIT = 100000n;
  private static DEFAULT_PRE_VERIFICATION_GAS = 21000n;
  private static DEFAULT_MAX_FEE_PER_GAS = 1000000000n; // 1 gwei
  private static DEFAULT_MAX_PRIORITY_FEE_PER_GAS = 1000000000n; // 1 gwei

  constructor() {}

  /**
   * Build specific parts of a UserOperation
   * Note: Full construction often requires chain interaction (nonce, gas price),
   * which typically happens in the application layer or via a Provider wrapper.
   * This builder focuses on formatting and structure.
   */
  async buildUserOp(params: {
    sender: string;
    callData: string;
    nonce?: bigint;
    initCode?: string;
    callGasLimit?: bigint;
    verificationGasLimit?: bigint;
    preVerificationGas?: bigint;
    maxFeePerGas?: bigint;
    maxPriorityFeePerGas?: bigint;
    paymasterAndData?: string;
    signature?: string;
  }): Promise<UserOperation> {
    return {
      sender: params.sender,
      nonce: params.nonce || 0n,
      initCode: params.initCode || "0x",
      callData: params.callData,
      callGasLimit: params.callGasLimit || 0n, // Should be estimated
      verificationGasLimit:
        params.verificationGasLimit || UserOpBuilder.DEFAULT_VERIFICATION_GAS_LIMIT,
      preVerificationGas: params.preVerificationGas || UserOpBuilder.DEFAULT_PRE_VERIFICATION_GAS,
      maxFeePerGas: params.maxFeePerGas || UserOpBuilder.DEFAULT_MAX_FEE_PER_GAS,
      maxPriorityFeePerGas:
        params.maxPriorityFeePerGas || UserOpBuilder.DEFAULT_MAX_PRIORITY_FEE_PER_GAS,
      paymasterAndData: params.paymasterAndData || "0x",
      signature: params.signature || "0x",
    };
  }

  /**
   * Hash the UserOperation for signing (ERC-4337 v0.7)
   */
  getUserOpHash(userOp: PackedUserOperation, entryPoint: string, chainId: number): string {
    const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "uint256", "bytes32", "bytes32", "bytes32", "uint256", "bytes32", "bytes32"],
      [
        userOp.sender,
        userOp.nonce,
        ethers.keccak256(userOp.initCode),
        ethers.keccak256(userOp.callData),
        userOp.accountGasLimits,
        userOp.preVerificationGas,
        userOp.gasFees,
        ethers.keccak256(userOp.paymasterAndData),
      ]
    );

    return ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "address", "uint256"],
        [ethers.keccak256(encoded), entryPoint, chainId]
      )
    );
  }

  // Legacy v0.6 hashing support could be added here if needed
}
