
import { type Hex, type Address, concat, pad, toHex } from 'viem';

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
export function encodePaymasterData(params: PaymasterAndData): Hex {
    // strict length checks can be added here
    return concat([
        params.paymaster,
        pad(toHex(params.verificationGasLimit), { size: 16 }),
        pad(toHex(params.postOpGasLimit), { size: 16 }),
        params.operator
    ]);
}
