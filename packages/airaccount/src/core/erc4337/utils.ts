import type { PackedUserOperation } from "../types";

export class ERC4337Utils {
  static packAccountGasLimits(
    verificationGasLimit: bigint | string,
    callGasLimit: bigint | string
  ): string {
    const vgl = BigInt(verificationGasLimit);
    const cgl = BigInt(callGasLimit);
    const packed = (vgl << 128n) | cgl;
    return "0x" + packed.toString(16).padStart(64, "0");
  }

  static unpackAccountGasLimits(accountGasLimits: string): {
    verificationGasLimit: bigint;
    callGasLimit: bigint;
  } {
    const packed = BigInt(accountGasLimits);
    return {
      verificationGasLimit: packed >> 128n,
      callGasLimit: packed & ((1n << 128n) - 1n),
    };
  }

  static packGasFees(maxPriorityFeePerGas: bigint | string, maxFeePerGas: bigint | string): string {
    const priority = BigInt(maxPriorityFeePerGas);
    const max = BigInt(maxFeePerGas);
    const packed = (priority << 128n) | max;
    return "0x" + packed.toString(16).padStart(64, "0");
  }

  static unpackGasFees(gasFees: string): {
    maxPriorityFeePerGas: bigint;
    maxFeePerGas: bigint;
  } {
    const packed = BigInt(gasFees);
    return {
      maxPriorityFeePerGas: packed >> 128n,
      maxFeePerGas: packed & ((1n << 128n) - 1n),
    };
  }

  static packUserOperation(userOp: any): PackedUserOperation {
    return {
      sender: userOp.sender,
      nonce: userOp.nonce,
      initCode: userOp.initCode || "0x",
      callData: userOp.callData,
      accountGasLimits: ERC4337Utils.packAccountGasLimits(
        userOp.verificationGasLimit,
        userOp.callGasLimit
      ),
      preVerificationGas: userOp.preVerificationGas,
      gasFees: ERC4337Utils.packGasFees(userOp.maxPriorityFeePerGas, userOp.maxFeePerGas),
      paymasterAndData: userOp.paymasterAndData || "0x",
      signature: userOp.signature || "0x",
    };
  }

  static unpackUserOperation(packedOp: PackedUserOperation): any {
    const gasLimits = ERC4337Utils.unpackAccountGasLimits(packedOp.accountGasLimits);
    const gasFees = ERC4337Utils.unpackGasFees(packedOp.gasFees);

    return {
      sender: packedOp.sender,
      nonce: packedOp.nonce,
      initCode: packedOp.initCode,
      callData: packedOp.callData,
      callGasLimit: "0x" + gasLimits.callGasLimit.toString(16),
      verificationGasLimit: "0x" + gasLimits.verificationGasLimit.toString(16),
      preVerificationGas: packedOp.preVerificationGas,
      maxFeePerGas: "0x" + gasFees.maxFeePerGas.toString(16),
      maxPriorityFeePerGas: "0x" + gasFees.maxPriorityFeePerGas.toString(16),
      paymasterAndData: packedOp.paymasterAndData,
      signature: packedOp.signature,
    };
  }
}
