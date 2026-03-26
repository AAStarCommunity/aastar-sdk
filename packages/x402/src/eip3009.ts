import { type Address, type Hex, type WalletClient, toHex } from 'viem';

export const EIP3009_TYPES = {
    TransferWithAuthorization: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' },
    ],
} as const;

export function getEIP3009Domain(tokenName: string, tokenVersion: string, chainId: number, verifyingContract: Address) {
    return {
        name: tokenName,
        version: tokenVersion,
        chainId,
        verifyingContract,
    };
}

export function generateNonce(): Hex {
    const bytes = new Uint8Array(32);
    globalThis.crypto.getRandomValues(bytes);
    return toHex(bytes);
}

export async function signTransferWithAuthorization(
    walletClient: WalletClient,
    params: {
        from: Address;
        to: Address;
        value: bigint;
        validAfter: bigint;
        validBefore: bigint;
        nonce: Hex;
        tokenName: string;
        tokenVersion: string;
        chainId: number;
        verifyingContract: Address;
    }
): Promise<Hex> {
    const domain = getEIP3009Domain(
        params.tokenName,
        params.tokenVersion,
        params.chainId,
        params.verifyingContract
    );

    const account = walletClient.account;
    if (!account) {
        throw new Error('WalletClient must have an account');
    }

    return walletClient.signTypedData({
        account,
        domain,
        types: EIP3009_TYPES,
        primaryType: 'TransferWithAuthorization',
        message: {
            from: params.from,
            to: params.to,
            value: params.value,
            validAfter: params.validAfter,
            validBefore: params.validBefore,
            nonce: params.nonce,
        },
    });
}
