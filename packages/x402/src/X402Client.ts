import { type Address, type Hex, type Hash, type PublicClient, type WalletClient } from 'viem';
import { x402Actions } from '@aastar/core';
import type {
    X402PaymentParams, PaymentRequired, PaymentPayload,
    PaymentRequirements, SettleResponse, FacilitatorConfig,
} from './types.js';
import { signTransferWithAuthorization, generateNonce } from './eip3009.js';
import {
    encodePaymentPayload,
    extractPaymentRequired,
    extractSettleResponse,
    HEADER_PAYMENT_SIGNATURE,
} from './payment-header.js';
import { FacilitatorClient } from './facilitator.js';

// ============================================================
// x402 Client — aligned with @x402/fetch + @x402/core patterns
// Ref: coinbase/x402, Cloudflare Workers x402, MPP mppx
// ============================================================

export type X402ClientConfig = {
    publicClient: PublicClient;
    walletClient: WalletClient;
    superPaymasterAddress: Address;
    chainId: number;
    /** Facilitator endpoint (default: self-facilitated via SuperPaymaster) */
    facilitator?: FacilitatorConfig;
    /** EIP-712 domain for asset token (defaults: USDC / version "2") */
    tokenName?: string;
    tokenVersion?: string;
    /** Payment policy: max amount per request (in atomic units) */
    maxAmountPerRequest?: bigint;
};

/** CAIP-2 network identifier from chainId */
function toNetworkId(chainId: number): `eip155:${number}` {
    return `eip155:${chainId}`;
}

export class X402Client {
    private readonly actions;
    private readonly writeActions;
    private readonly config: X402ClientConfig;
    private readonly facilitatorClient?: FacilitatorClient;

    constructor(config: X402ClientConfig) {
        this.config = config;
        this.actions = x402Actions(config.superPaymasterAddress)(config.publicClient);
        this.writeActions = x402Actions(config.superPaymasterAddress)(config.walletClient);
        if (config.facilitator) {
            this.facilitatorClient = new FacilitatorClient(config.facilitator);
        }
    }

    /**
     * Create a signed payment payload (EIP-3009 TransferWithAuthorization).
     * Returns a base64-encoded PaymentPayload ready for PAYMENT-SIGNATURE header.
     */
    async createPayment(params: X402PaymentParams): Promise<{
        payload: PaymentPayload;
        encoded: string;
        nonce: Hex;
    }> {
        const nonce = params.nonce || generateNonce();
        const now = BigInt(Math.floor(Date.now() / 1000));
        const validAfter = params.validAfter ?? (now - 600n); // 10 min grace (per x402 spec)
        const validBefore = params.validBefore ?? (now + 3600n);
        const tokenName = this.config.tokenName || 'USDC';
        const tokenVersion = this.config.tokenVersion || '2';

        const signature = await signTransferWithAuthorization(this.config.walletClient, {
            from: params.from,
            to: params.to,
            value: params.amount,
            validAfter,
            validBefore,
            nonce,
            tokenName,
            tokenVersion,
            chainId: this.config.chainId,
            verifyingContract: params.asset,
        });

        const payload: PaymentPayload = {
            x402Version: 2,
            accepted: {
                scheme: 'exact',
                network: toNetworkId(this.config.chainId),
                asset: params.asset,
                amount: params.amount.toString(),
                payTo: params.to,
                maxTimeoutSeconds: 3600,
                extra: { name: tokenName, version: tokenVersion },
            },
            payload: {
                signature,
                authorization: {
                    from: params.from,
                    to: params.to,
                    value: params.amount.toString(),
                    validAfter: validAfter.toString(),
                    validBefore: validBefore.toString(),
                    nonce,
                },
            },
        };

        return {
            payload,
            encoded: encodePaymentPayload(payload),
            nonce,
        };
    }

    /**
     * Settle payment on-chain via SuperPaymaster (self-facilitated).
     * Uses EIP-3009 transferWithAuthorization path.
     */
    async settleOnChain(params: {
        from: Address; to: Address; asset: Address; amount: bigint;
        validAfter: bigint; validBefore: bigint; nonce: Hex; signature: Hex;
    }): Promise<Hex> {
        return this.writeActions.settleX402Payment({
            ...params,
            account: this.config.walletClient.account!,
        });
    }

    /**
     * Settle payment on-chain via direct transfer (for xPNTs and pre-approved tokens).
     */
    async settleDirectOnChain(params: {
        from: Address; to: Address; asset: Address; amount: bigint; nonce: Hex;
    }): Promise<Hex> {
        return this.writeActions.settleX402PaymentDirect({
            ...params,
            account: this.config.walletClient.account!,
        });
    }

    /**
     * Get facilitator fee quote from on-chain contract.
     */
    async getQuote(): Promise<{ feeBPS: bigint }> {
        const feeBPS = await this.actions.facilitatorFeeBPS();
        return { feeBPS };
    }

    /**
     * Check if a nonce has been used.
     */
    async checkNonce(nonce: Hex): Promise<boolean> {
        return this.actions.x402SettlementNonces({ nonce });
    }

    /**
     * Settle via external facilitator (Coinbase, self-hosted, etc.).
     * Requires facilitator config in constructor.
     */
    async settleViaFacilitator(payload: PaymentPayload, requirements: PaymentRequirements): Promise<SettleResponse> {
        if (!this.facilitatorClient) {
            throw new Error('No facilitator configured. Pass facilitator config to X402Client constructor.');
        }
        return this.facilitatorClient.settle(payload, requirements);
    }

    /**
     * x402-aware fetch wrapper.
     * Automatically handles 402 → sign → retry flow per x402 v2 spec.
     *
     * Pattern from: @x402/fetch wrapFetchWithPayment
     *
     * Flow:
     * 1. Make initial request
     * 2. If 402, extract PaymentRequired from PAYMENT-REQUIRED header
     * 3. Select best payment option (applies policy: max amount check)
     * 4. Sign EIP-3009 authorization
     * 5. Retry with PAYMENT-SIGNATURE header
     */
    async x402Fetch(url: string, init?: RequestInit): Promise<Response> {
        const firstResponse = await fetch(url, init);

        if (firstResponse.status !== 402) {
            return firstResponse;
        }

        // Step 2: Extract payment requirements
        // TODO: some server implementations put PaymentRequired in the response body instead of headers
        const paymentRequired = extractPaymentRequired(firstResponse);
        if (!paymentRequired || !paymentRequired.accepts?.length) {
            throw new Error('402 response missing PAYMENT-REQUIRED header or empty accepts');
        }

        // Step 3: Select payment option (filter by network + policy)
        const myNetwork = toNetworkId(this.config.chainId);
        let selected = paymentRequired.accepts.find(
            (a) => a.network === myNetwork && a.scheme === 'exact'
        );
        if (!selected) {
            // Fallback: any EVM option
            selected = paymentRequired.accepts.find((a) => a.network.startsWith('eip155:'));
        }
        if (!selected) {
            throw new Error(`No compatible payment option for network ${myNetwork}`);
        }

        // Policy check: max amount
        if (this.config.maxAmountPerRequest && BigInt(selected.amount) > this.config.maxAmountPerRequest) {
            throw new Error(
                `Payment amount ${selected.amount} exceeds max ${this.config.maxAmountPerRequest}`
            );
        }

        const account = this.config.walletClient.account;
        if (!account) {
            throw new Error('WalletClient must have an account for automatic payment');
        }

        // Step 4: Sign
        const { encoded } = await this.createPayment({
            from: account.address,
            to: selected.payTo,
            asset: selected.asset as Address,
            amount: BigInt(selected.amount),
        });

        // Step 5: Retry with payment signature
        const retryHeaders = new Headers(init?.headers);
        retryHeaders.set(HEADER_PAYMENT_SIGNATURE, encoded);

        return fetch(url, { ...init, headers: retryHeaders });
    }
}
