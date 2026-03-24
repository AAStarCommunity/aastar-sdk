import type { Address, Hex } from 'viem';

export type ChannelState = {
    payer: Address;
    payee: Address;
    token: Address;
    authorizedSigner: Address;
    deposit: bigint;
    settled: bigint;
    closeRequestedAt: bigint;
    finalized: boolean;
};

export type VoucherParams = {
    channelId: Hex;
    cumulativeAmount: bigint;
};

export type SignedVoucher = VoucherParams & {
    signature: Hex;
};

export type ChannelConfig = {
    payee: Address;
    token: Address;
    deposit: bigint;
    salt: Hex;
    authorizedSigner: Address;
};
