import { concat, pad, toHex } from 'viem';
/**
 * Format PaymasterAndData for SuperPaymaster V3
 * Layout: [Paymaster(20)] [VerGas(16)] [PostOpGas(16)] [Operator(20)]
 */
export function encodePaymasterData(params) {
    // strict length checks can be added here
    return concat([
        params.paymaster,
        pad(toHex(params.verificationGasLimit), { size: 16 }),
        pad(toHex(params.postOpGasLimit), { size: 16 }),
        params.operator
    ]);
}
