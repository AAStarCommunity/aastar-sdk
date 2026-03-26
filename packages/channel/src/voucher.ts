import { type Address, type Hex, type WalletClient } from 'viem';

export const VOUCHER_TYPES = {
    Voucher: [
        { name: 'channelId', type: 'bytes32' },
        { name: 'cumulativeAmount', type: 'uint128' },
    ],
} as const;

export function getVoucherDomain(chainId: number, verifyingContract: Address) {
    return {
        name: 'MicroPaymentChannel',
        version: '1.0.0',
        chainId,
        verifyingContract,
    };
}

export async function signVoucher(
    walletClient: WalletClient,
    params: {
        channelId: Hex;
        cumulativeAmount: bigint;
        chainId: number;
        verifyingContract: Address;
    }
): Promise<Hex> {
    const domain = getVoucherDomain(params.chainId, params.verifyingContract);

    const account = walletClient.account;
    if (!account) {
        throw new Error('WalletClient must have an account');
    }

    return walletClient.signTypedData({
        account,
        domain,
        types: VOUCHER_TYPES,
        primaryType: 'Voucher',
        message: {
            channelId: params.channelId,
            cumulativeAmount: params.cumulativeAmount,
        },
    });
}
