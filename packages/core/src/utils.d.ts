import { type Hex, type Address } from 'viem';
export type PaymasterAndData = {
    paymaster: Address;
    verificationGasLimit: bigint;
    postOpGasLimit: bigint;
    operator: Address;
};
/**
 * Format PaymasterAndData for SuperPaymaster V3
 * Layout: [Paymaster(20)] [VerGas(16)] [PostOpGas(16)] [Operator(20)]
 */
export declare function encodePaymasterData(params: PaymasterAndData): Hex;
