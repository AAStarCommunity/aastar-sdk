import { type Address, type PublicClient, type WalletClient, type Hex, type Hash, type Account } from 'viem';
import { MicroPaymentChannelABI } from '../abis/index.js';
import { validateAddress, validateRequired } from '../validators/index.js';
import { AAStarError } from '../errors/index.js';

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

export type ChannelActions = {
    // Write
    openChannel: (args: {
        payee: Address, token: Address, deposit: bigint, salt: Hex,
        authorizedSigner: Address, account?: Account | Address
    }) => Promise<Hash>;
    settleChannel: (args: {
        channelId: Hex, cumulativeAmount: bigint, signature: Hex,
        account?: Account | Address
    }) => Promise<Hash>;
    closeChannel: (args: {
        channelId: Hex, cumulativeAmount: bigint, signature: Hex,
        account?: Account | Address
    }) => Promise<Hash>;
    topUpChannel: (args: {
        channelId: Hex, amount: bigint, account?: Account | Address
    }) => Promise<Hash>;
    requestCloseChannel: (args: {
        channelId: Hex, account?: Account | Address
    }) => Promise<Hash>;
    withdrawChannel: (args: {
        channelId: Hex, account?: Account | Address
    }) => Promise<Hash>;

    // Read
    getChannel: (args: { channelId: Hex }) => Promise<ChannelState>;
    CLOSE_TIMEOUT: () => Promise<bigint>;
    VOUCHER_TYPEHASH: () => Promise<Hex>;
    version: () => Promise<string>;
};

export const channelActions = (address: Address) => (client: PublicClient | WalletClient): ChannelActions => ({
    // --- Write ---
    async openChannel({ payee, token, deposit, salt, authorizedSigner, account }) {
        try {
            validateAddress(payee, 'payee');
            validateAddress(token, 'token');
            validateRequired(salt, 'salt');
            validateAddress(authorizedSigner, 'authorizedSigner');
            return await (client as any).writeContract({
                address, abi: MicroPaymentChannelABI,
                functionName: 'openChannel',
                args: [payee, token, deposit, salt, authorizedSigner],
                account: account as any, chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'openChannel');
        }
    },

    async settleChannel({ channelId, cumulativeAmount, signature, account }) {
        try {
            validateRequired(channelId, 'channelId');
            validateRequired(signature, 'signature');
            return await (client as any).writeContract({
                address, abi: MicroPaymentChannelABI,
                functionName: 'settleChannel',
                args: [channelId, cumulativeAmount, signature],
                account: account as any, chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'settleChannel');
        }
    },

    async closeChannel({ channelId, cumulativeAmount, signature, account }) {
        try {
            validateRequired(channelId, 'channelId');
            validateRequired(signature, 'signature');
            return await (client as any).writeContract({
                address, abi: MicroPaymentChannelABI,
                functionName: 'closeChannel',
                args: [channelId, cumulativeAmount, signature],
                account: account as any, chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'closeChannel');
        }
    },

    async topUpChannel({ channelId, amount, account }) {
        try {
            validateRequired(channelId, 'channelId');
            return await (client as any).writeContract({
                address, abi: MicroPaymentChannelABI,
                functionName: 'topUpChannel',
                args: [channelId, amount],
                account: account as any, chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'topUpChannel');
        }
    },

    async requestCloseChannel({ channelId, account }) {
        try {
            validateRequired(channelId, 'channelId');
            return await (client as any).writeContract({
                address, abi: MicroPaymentChannelABI,
                functionName: 'requestCloseChannel',
                args: [channelId],
                account: account as any, chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'requestCloseChannel');
        }
    },

    async withdrawChannel({ channelId, account }) {
        try {
            validateRequired(channelId, 'channelId');
            return await (client as any).writeContract({
                address, abi: MicroPaymentChannelABI,
                functionName: 'withdrawChannel',
                args: [channelId],
                account: account as any, chain: (client as any).chain
            });
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'withdrawChannel');
        }
    },

    // --- Read ---
    async getChannel({ channelId }) {
        try {
            validateRequired(channelId, 'channelId');
            const result = await (client as PublicClient).readContract({
                address, abi: MicroPaymentChannelABI,
                functionName: 'getChannel',
                args: [channelId]
            }) as any;
            return {
                payer: result.payer ?? result[0],
                payee: result.payee ?? result[1],
                token: result.token ?? result[2],
                authorizedSigner: result.authorizedSigner ?? result[3],
                deposit: result.deposit ?? result[4],
                settled: result.settled ?? result[5],
                closeRequestedAt: result.closeRequestedAt ?? result[6],
                finalized: result.finalized ?? result[7],
            } as ChannelState;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'getChannel');
        }
    },

    async CLOSE_TIMEOUT() {
        try {
            return await (client as PublicClient).readContract({
                address, abi: MicroPaymentChannelABI,
                functionName: 'CLOSE_TIMEOUT'
            }) as bigint;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'CLOSE_TIMEOUT');
        }
    },

    async VOUCHER_TYPEHASH() {
        try {
            return await (client as PublicClient).readContract({
                address, abi: MicroPaymentChannelABI,
                functionName: 'VOUCHER_TYPEHASH'
            }) as Hex;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'VOUCHER_TYPEHASH');
        }
    },

    async version() {
        try {
            return await (client as PublicClient).readContract({
                address, abi: MicroPaymentChannelABI,
                functionName: 'version'
            }) as string;
        } catch (error) {
            throw AAStarError.fromViemError(error as Error, 'version');
        }
    },
});
