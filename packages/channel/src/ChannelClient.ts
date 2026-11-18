import { type Address, type Hex, type Hash, type PublicClient, type WalletClient, decodeFunctionResult, encodeFunctionData } from 'viem';
import { channelActions, resolveReportedEip712Domain, MicroPaymentChannelABI, type ChannelState } from '@aastar/core';
import type { SignedVoucher, ChannelConfig } from './types.js';
import { signVoucher, VOUCHER_TYPEHASH, VOUCHER_TYPE_STRING } from './voucher.js';

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

    /**
     * Sign a voucher (the signature itself needs no transaction). The domain is the one the channel contract reports
     * through `eip712Domain()` (EIP-5267) on the configured chain; MicroPaymentChannel has no `DOMAIN_SEPARATOR()`, so
     * that report is not independently confirmed unless the contract adds it. Its `VOUCHER_TYPEHASH` must equal the
     * type the SDK signs. Either mismatch throws instead of producing a voucher the contract would reject.
     */
    async signVoucherOffline(channelId: Hex, cumulativeAmount: bigint): Promise<SignedVoucher> {
        const { domain, blockHash } = await resolveReportedEip712Domain(this.config.publicClient, this.config.channelAddress, { expectedChainId: this.config.chainId });
        // The type hash is read at the same block hash as the domain, so both describe one state of the contract.
        const data = encodeFunctionData({ abi: MicroPaymentChannelABI, functionName: 'VOUCHER_TYPEHASH', args: [] });
        const raw = await this.config.publicClient.request({
            method: 'eth_call', params: [{ to: this.config.channelAddress, data }, { blockHash, requireCanonical: true }],
        } as any) as Hex;
        const onChainTypeHash = decodeFunctionResult({ abi: MicroPaymentChannelABI, functionName: 'VOUCHER_TYPEHASH', data: raw }) as Hex;
        if (onChainTypeHash.toLowerCase() !== VOUCHER_TYPEHASH.toLowerCase()) {
            throw new Error(`signVoucherOffline: the channel's VOUCHER_TYPEHASH ${onChainTypeHash} is not keccak256("${VOUCHER_TYPE_STRING}"); refusing to sign`);
        }
        const signature = await signVoucher(this.config.walletClient, {
            channelId,
            cumulativeAmount,
            chainId: this.config.chainId,
            verifyingContract: this.config.channelAddress,
            domain,
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
