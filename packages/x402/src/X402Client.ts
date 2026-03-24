import { type Address, type Hex, type Hash, type PublicClient, type WalletClient } from 'viem';
import { x402Actions } from '@aastar/core';
import type { X402PaymentParams, X402Quote, X402Settlement, X402PaymentHeader } from './types.js';
import { signTransferWithAuthorization, generateNonce } from './eip3009.js';
import { buildPaymentHeaderString, parsePaymentHeaderString } from './payment-header.js';

export type X402ClientConfig = {
    publicClient: PublicClient;
    walletClient: WalletClient;
    superPaymasterAddress: Address;
    facilitatorUrl?: string;
    defaultAsset?: Address;
    chainId: number;
    tokenName?: string;
    tokenVersion?: string;
};

export class X402Client {
    private readonly actions;
    private readonly config: X402ClientConfig;

    constructor(config: X402ClientConfig) {
        this.config = config;
        this.actions = x402Actions(config.superPaymasterAddress)(config.publicClient);
    }

    async createPayment(params: X402PaymentParams): Promise<{ header: string; nonce: Hex }> {
        const nonce = params.nonce || generateNonce();
        const now = BigInt(Math.floor(Date.now() / 1000));
        const validAfter = params.validAfter ?? 0n;
        const validBefore = params.validBefore ?? (now + 3600n);

        const signature = await signTransferWithAuthorization(this.config.walletClient, {
            from: params.from,
            to: params.to,
            value: params.amount,
            validAfter,
            validBefore,
            nonce,
            tokenName: this.config.tokenName || 'USDC',
            tokenVersion: this.config.tokenVersion || '2',
            chainId: this.config.chainId,
            verifyingContract: params.asset,
        });

        const paymentHeader: X402PaymentHeader = {
            scheme: 'eip3009',
            from: params.from,
            to: params.to,
            asset: params.asset,
            amount: params.amount.toString(),
            nonce,
            validAfter: validAfter.toString(),
            validBefore: validBefore.toString(),
            signature,
            chainId: this.config.chainId,
            facilitator: this.config.superPaymasterAddress,
        };

        return {
            header: buildPaymentHeaderString(paymentHeader),
            nonce,
        };
    }

    async settleOnChain(params: {
        from: Address; to: Address; asset: Address; amount: bigint;
        validAfter: bigint; validBefore: bigint; nonce: Hex; signature: Hex;
    }): Promise<Hex> {
        const writeActions = x402Actions(this.config.superPaymasterAddress)(this.config.walletClient);
        return writeActions.settleX402Payment({
            ...params,
            account: this.config.walletClient.account!,
        });
    }

    async settleDirectOnChain(params: {
        from: Address; to: Address; asset: Address; amount: bigint; nonce: Hex;
    }): Promise<Hex> {
        const writeActions = x402Actions(this.config.superPaymasterAddress)(this.config.walletClient);
        return writeActions.settleX402PaymentDirect({
            ...params,
            account: this.config.walletClient.account!,
        });
    }

    async getQuote(): Promise<{ feeBPS: bigint }> {
        const feeBPS = await this.actions.facilitatorFeeBPS();
        return { feeBPS };
    }

    async checkNonce(nonce: Hex): Promise<boolean> {
        return this.actions.x402SettlementNonces({ nonce });
    }

    async x402Fetch(url: string, init?: RequestInit): Promise<Response> {
        const firstResponse = await fetch(url, init);

        if (firstResponse.status !== 402) {
            return firstResponse;
        }

        const requiresPayment = firstResponse.headers.get('X-Payment-Required');
        if (!requiresPayment) {
            return firstResponse;
        }

        let paymentInfo: { to: Address; asset: Address; amount: bigint };
        try {
            paymentInfo = JSON.parse(requiresPayment);
        } catch {
            throw new Error('Invalid X-Payment-Required header');
        }

        const account = this.config.walletClient.account;
        if (!account) {
            throw new Error('WalletClient must have an account for automatic payment');
        }

        const { header } = await this.createPayment({
            from: account.address,
            to: paymentInfo.to,
            asset: paymentInfo.asset,
            amount: paymentInfo.amount,
        });

        const retryHeaders = new Headers(init?.headers);
        retryHeaders.set('X-PAYMENT', header);

        return fetch(url, {
            ...init,
            headers: retryHeaders,
        });
    }
}
