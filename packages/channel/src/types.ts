import type { Hex } from 'viem';

// Re-export ChannelState from core to avoid duplication
export type { ChannelState } from '@aastar/core';

export type VoucherParams = {
    channelId: Hex;
    cumulativeAmount: bigint;
};

export type SignedVoucher = VoucherParams & {
    signature: Hex;
};

export type ChannelConfig = {
    payee: `0x${string}`;
    token: `0x${string}`;
    deposit: bigint;
    salt: Hex;
    authorizedSigner: `0x${string}`;
};
