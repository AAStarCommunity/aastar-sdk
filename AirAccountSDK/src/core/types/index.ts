export interface UserOperation {
  sender: string;
  nonce: bigint | string;
  initCode: string;
  callData: string;
  callGasLimit: bigint | string;
  verificationGasLimit: bigint | string;
  preVerificationGas: bigint | string;
  maxFeePerGas: bigint | string;
  maxPriorityFeePerGas: bigint | string;
  paymasterAndData: string;
  signature: string;
}

export interface PackedUserOperation {
  sender: string;
  nonce: bigint | string;
  initCode: string;
  callData: string;
  accountGasLimits: string; // Packed: verificationGasLimit (16 bytes) + callGasLimit (16 bytes)
  preVerificationGas: bigint | string;
  gasFees: string; // Packed: maxPriorityFeePerGas (16 bytes) + maxFeePerGas (16 bytes)
  paymasterAndData: string;
  signature: string;
}

export interface GasEstimate {
  callGasLimit: string;
  verificationGasLimit: string;
  preVerificationGas: string;
}
