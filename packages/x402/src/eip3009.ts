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
    // Distinct typehash from TransferWithAuthorization — prevents replay across variants.
    // msg.sender must equal `to` on-chain (CallerMustBeRecipient error if violated).
    ReceiveWithAuthorization: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' },
    ],
    CancelAuthorization: [
        { name: 'authorizer', type: 'address' },
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

// GToken EIP-712 domain constants (GTokenAuthorization v2.2.0)
export const GTOKEN_EIP712_DOMAIN = { name: 'GToken', version: '1' } as const;

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

/**
 * Sign a ReceiveWithAuthorization for GTokenAuthorization (EIP-3009).
 * The signed `to` address must be the one submitting the transaction on-chain.
 * Note: `xPNTsToken` is NOT included in the signature (it's a relay-supplied hint for RC-2).
 */
export async function signReceiveWithAuthorization(
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
    // GTokenAuthorization enforces MAX_AUTH_VALIDITY = 300s on-chain (RC-1).
    if (params.validBefore <= params.validAfter) {
        throw new Error('validBefore must be greater than validAfter');
    }
    if (params.validBefore - params.validAfter > 300n) {
        throw new Error(
            `Authorization window ${params.validBefore - params.validAfter}s exceeds MAX_AUTH_VALIDITY (300s)`
        );
    }

    const account = walletClient.account;
    if (!account) {
        throw new Error('WalletClient must have an account');
    }

    return walletClient.signTypedData({
        account,
        domain: getEIP3009Domain(params.tokenName, params.tokenVersion, params.chainId, params.verifyingContract),
        types: EIP3009_TYPES,
        primaryType: 'ReceiveWithAuthorization',
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

/**
 * Sign a CancelAuthorization for GTokenAuthorization (EIP-3009).
 * Must be signed by the original `authorizer` address.
 */
export async function signCancelAuthorization(
    walletClient: WalletClient,
    params: {
        authorizer: Address;
        nonce: Hex;
        tokenName: string;
        tokenVersion: string;
        chainId: number;
        verifyingContract: Address;
    }
): Promise<Hex> {
    const account = walletClient.account;
    if (!account) {
        throw new Error('WalletClient must have an account');
    }

    return walletClient.signTypedData({
        account,
        domain: getEIP3009Domain(params.tokenName, params.tokenVersion, params.chainId, params.verifyingContract),
        types: EIP3009_TYPES,
        primaryType: 'CancelAuthorization',
        message: {
            authorizer: params.authorizer,
            nonce: params.nonce,
        },
    });
}
