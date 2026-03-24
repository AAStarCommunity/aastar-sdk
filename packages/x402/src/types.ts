import type { Address, Hex, Hash } from 'viem';

export type X402PaymentParams = {
    from: Address;
    to: Address;
    asset: Address;
    amount: bigint;
    validAfter?: bigint;
    validBefore?: bigint;
    nonce?: Hex;
};

export type X402Quote = {
    feeBPS: bigint;
    feePercent: string;
    supportedAssets: Address[];
};

export type X402Settlement = {
    txHash: Hash;
    settlementId: Hex;
    from: Address;
    to: Address;
    amount: bigint;
    asset: Address;
};

export type X402PaymentHeader = {
    scheme: 'eip3009' | 'direct';
    from: Address;
    to: Address;
    asset: Address;
    amount: string;
    nonce: Hex;
    validAfter: string;
    validBefore: string;
    signature: Hex;
    chainId: number;
    facilitator: Address;
};
