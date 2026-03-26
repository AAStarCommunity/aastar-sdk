import { type Address, type Hex, type Hash, type PublicClient, type WalletClient } from 'viem';
import { channelActions, type ChannelState } from '@aastar/core';
import type { SignedVoucher, ChannelConfig } from './types.js';
import { signVoucher } from './voucher.js';

export type ChannelClientConfig = {
    publicClient: PublicClient;
    walletClient: WalletClient;
    channelAddress: Address;
    chainId: number;
};

export class ChannelClient {
    private readonly readActions;
    private readonly writeActions;
    private readonly config: ChannelClientConfig;

    constructor(config: ChannelClientConfig) {
        this.config = config;
        // Separate clients: publicClient for reads (no account required),
        // walletClient for writes. Unlike X402Client which is always write-first,
        // ChannelClient exposes read-heavy helpers (getChannel, verifyVoucher) that
        // callers may invoke without a wallet configured.
        this.readActions = channelActions(config.channelAddress)(config.publicClient);
        this.writeActions = channelActions(config.channelAddress)(config.walletClient);
    }

    async openChannel(channelConfig: ChannelConfig): Promise<Hash> {
        return this.writeActions.openChannel({
            payee: channelConfig.payee,
            token: channelConfig.token,
            deposit: channelConfig.deposit,
            salt: channelConfig.salt,
            authorizedSigner: channelConfig.authorizedSigner,
            account: this.config.walletClient.account!,
        });
    }

    async signVoucherOffline(channelId: Hex, cumulativeAmount: bigint): Promise<SignedVoucher> {
        const signature = await signVoucher(this.config.walletClient, {
            channelId,
            cumulativeAmount,
            chainId: this.config.chainId,
            verifyingContract: this.config.channelAddress,
        });

        return { channelId, cumulativeAmount, signature };
    }

    async settleChannel(voucher: SignedVoucher): Promise<Hash> {
        return this.writeActions.settleChannel({
            channelId: voucher.channelId,
            cumulativeAmount: voucher.cumulativeAmount,
            signature: voucher.signature,
            account: this.config.walletClient.account!,
        });
    }

    async closeChannel(voucher: SignedVoucher): Promise<Hash> {
        return this.writeActions.closeChannel({
            channelId: voucher.channelId,
            cumulativeAmount: voucher.cumulativeAmount,
            signature: voucher.signature,
            account: this.config.walletClient.account!,
        });
    }

    async topUpChannel(channelId: Hex, amount: bigint): Promise<Hash> {
        return this.writeActions.topUpChannel({
            channelId,
            amount,
            account: this.config.walletClient.account!,
        });
    }

    async requestClose(channelId: Hex): Promise<Hash> {
        return this.writeActions.requestCloseChannel({
            channelId,
            account: this.config.walletClient.account!,
        });
    }

    async withdraw(channelId: Hex): Promise<Hash> {
        return this.writeActions.withdrawChannel({
            channelId,
            account: this.config.walletClient.account!,
        });
    }

    async getChannelState(channelId: Hex): Promise<ChannelState> {
        return this.readActions.getChannel({ channelId });
    }

    async getCloseTimeout(): Promise<bigint> {
        return this.readActions.CLOSE_TIMEOUT();
    }

    async getVersion(): Promise<string> {
        return this.readActions.version();
    }
}
