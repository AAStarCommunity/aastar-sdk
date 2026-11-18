import { type Address, type Hex, type TypedDataDomain, type WalletClient, keccak256, toHex } from 'viem';

export const VOUCHER_TYPES = {
    Voucher: [
        { name: 'channelId', type: 'bytes32' },
        { name: 'cumulativeAmount', type: 'uint128' },
    ],
} as const;

/** keccak256 of the Voucher type string the SDK signs; MicroPaymentChannel's VOUCHER_TYPEHASH must equal it. */
export const VOUCHER_TYPE_STRING = `Voucher(${VOUCHER_TYPES.Voucher.map((f) => `${f.type} ${f.name}`).join(',')})`;
export const VOUCHER_TYPEHASH = keccak256(toHex(VOUCHER_TYPE_STRING));

/**
 * @deprecated Hard-coded { name: "MicroPaymentChannel", version: "1.0.0" }. `ChannelClient.signVoucherOffline` reads
 * the domain from the contract (`eip712Domain()`); pass that `domain` to {@link signVoucher}.
 */
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
        /** The domain read from the contract. Without it, the deprecated hard-coded domain is used. */
        domain?: TypedDataDomain;
    }
): Promise<Hex> {
    const domain = params.domain ?? getVoucherDomain(params.chainId, params.verifyingContract);

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
