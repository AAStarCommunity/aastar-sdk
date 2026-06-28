import { type Address, type Hex, type Hash, type PublicClient, type WalletClient } from 'viem';
import { x402Actions } from '@aastar/core';
import type {
    X402PaymentParams, PaymentRequired, PaymentPayload,
    PaymentRequirements, SettleResponse, FacilitatorConfig,
} from './types.js';
import { EIP3009_TYPES, getEIP3009Domain, generateNonce } from './eip3009.js';
import { signX402PaymentAuthorization, deriveEip3009Nonce } from './x402auth.js';
import { getX402FacilitatorContract } from './facilitators.js';
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
    /**
     * The deployed `X402Facilitator` contract — the EIP-712 `verifyingContract` for the direct-path
     * `X402PaymentAuthorization` AND the on-chain recipient for the eip-3009 path. Defaults to
     * `DEFAULT_X402_FACILITATORS[chainId].contract`.
     */
    facilitatorContract?: Address;
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
    private readonly config: X402ClientConfig;
    private readonly facilitatorClient?: FacilitatorClient;

    constructor(config: X402ClientConfig) {
        if (!config.walletClient.account) {
            throw new Error('WalletClient must have an account configured');
        }
        this.config = config;
        // walletClient supports both readContract and writeContract — single instance suffices
        this.actions = x402Actions(config.superPaymasterAddress)(config.walletClient);
        if (config.facilitator) {
            this.facilitatorClient = new FacilitatorClient(config.facilitator);
        }
    }

    /** Resolve the deployed X402Facilitator contract (config override → DEFAULT_X402_FACILITATORS). */
    private facilitatorContract(): Address {
        return this.config.facilitatorContract ?? getX402FacilitatorContract(this.config.chainId);
    }

    /**
     * Create a signed payment payload, aligned with the deployed `X402Facilitator` (DVT#130).
     * Two settlement paths:
     *  - `"direct"`   (xPNTs): payer signs an `X402PaymentAuthorization` (EIP-712 over the facilitator),
     *                 settled via `settleX402PaymentDirect(..., signature)`.
     *  - `"eip-3009"` (USDC, default): payer signs a `ReceiveWithAuthorization` over the TOKEN, with
     *                 recipient = the facilitator and a DERIVED nonce `keccak256(abi.encode(payTo,maxFee,salt))`
     *                 that binds the final recipient (C-03). The facilitator submits `settleX402Payment`.
     * Returns a base64-encoded PaymentPayload ready for the PAYMENT-SIGNATURE header.
     */
    async createPayment(params: X402PaymentParams): Promise<{
        payload: PaymentPayload;
        encoded: string;
        nonce: Hex;
    }> {
        const wallet = this.config.walletClient;
        const account = wallet.account!;
        const chainId = this.config.chainId;
        const now = BigInt(Math.floor(Date.now() / 1000));
        const validAfter = params.validAfter ?? (now - 600n); // 10 min grace (per x402 spec)
        const validBefore = params.validBefore ?? (now + 3600n);
        const tokenName = this.config.tokenName || 'USDC';
        const tokenVersion = this.config.tokenVersion || '2';
        const maxFee = params.maxFee ?? params.amount;
        const settlement = params.settlement ?? 'eip-3009';
        const facilitator = this.facilitatorContract();

        const acceptedBase = {
            scheme: 'exact' as const,
            network: toNetworkId(chainId),
            asset: params.asset,
            amount: params.amount.toString(),
            payTo: params.to,
            maxTimeoutSeconds: 3600,
        };

        if (settlement === 'direct') {
            // xPNTs path — X402PaymentAuthorization over the facilitator (EIP-712).
            const nonce = params.nonce || generateNonce();
            const signature = await signX402PaymentAuthorization(wallet, {
                from: params.from, to: params.to, asset: params.asset, amount: params.amount,
                maxFee, validBefore, nonce, chainId, facilitator,
            });
            const payload: PaymentPayload = {
                x402Version: 2,
                accepted: { ...acceptedBase, extra: { name: tokenName, version: tokenVersion, settlement: 'direct', maxFee: maxFee.toString() } },
                payload: {
                    signature,
                    authorization: {
                        from: params.from, to: params.to, value: params.amount.toString(),
                        validAfter: '0', validBefore: validBefore.toString(), nonce,
                    },
                },
            };
            return { payload, encoded: encodePaymentPayload(payload), nonce };
        }

        // eip-3009 path (USDC) — ReceiveWithAuthorization, recipient = facilitator, recipient-bound nonce.
        const salt = params.salt || generateNonce();
        const derivedNonce = deriveEip3009Nonce(params.to, maxFee, salt);
        const signature = await wallet.signTypedData({
            account,
            domain: getEIP3009Domain(tokenName, tokenVersion, chainId, params.asset),
            types: EIP3009_TYPES,
            primaryType: 'ReceiveWithAuthorization',
            message: {
                from: params.from, to: facilitator, value: params.amount,
                validAfter, validBefore, nonce: derivedNonce,
            },
        });
        const payload: PaymentPayload = {
            x402Version: 2,
            accepted: { ...acceptedBase, extra: { name: tokenName, version: tokenVersion, settlement: 'eip-3009', maxFee: maxFee.toString(), salt } },
            payload: {
                signature,
                authorization: {
                    from: params.from, to: facilitator, value: params.amount.toString(),
                    validAfter: validAfter.toString(), validBefore: validBefore.toString(), nonce: derivedNonce,
                },
            },
        };
        return { payload, encoded: encodePaymentPayload(payload), nonce: derivedNonce };
    }

    /**
     * Settle payment on-chain via SuperPaymaster (self-facilitated).
     * Uses EIP-3009 transferWithAuthorization path.
     */
    async settleOnChain(params: {
        from: Address; to: Address; asset: Address; amount: bigint;
        validAfter: bigint; validBefore: bigint; nonce: Hex; signature: Hex;
    }): Promise<Hex> {
        return this.actions.settleX402Payment({
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
        return this.actions.settleX402PaymentDirect({
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
     * Merge the settlement `extra` (`settlement`/`maxFee`/`salt`) from the signed payload into the
     * requirements the facilitator actually reads. In the `x402Fetch` path the server's 402 is a bare
     * requirements object (no settlement fields), so the facilitator can't pick the path/fee/salt unless
     * we carry them across from `payload.accepted.extra`. Defaults the whole requirements to
     * `payload.accepted` when none is supplied.
     */
    private requirementsForFacilitator(payload: PaymentPayload, requirements?: PaymentRequirements): PaymentRequirements {
        if (!requirements) return payload.accepted;
        return { ...requirements, extra: { ...requirements.extra, ...payload.accepted.extra } };
    }

    /**
     * Verify a payment via the external facilitator (`POST /x402/verify`). `requirements` defaults to
     * the signed `payload.accepted` (which carries the settlement `extra`).
     */
    async verifyViaFacilitator(payload: PaymentPayload, requirements?: PaymentRequirements) {
        if (!this.facilitatorClient) {
            throw new Error('No facilitator configured. Pass facilitator config to X402Client constructor.');
        }
        return this.facilitatorClient.verify(payload, this.requirementsForFacilitator(payload, requirements));
    }

    /**
     * Settle via external facilitator (`POST /x402/settle`). `requirements` defaults to the signed
     * `payload.accepted`, so the settlement `extra` (settlement/maxFee/salt) always reaches the facilitator.
     */
    async settleViaFacilitator(payload: PaymentPayload, requirements?: PaymentRequirements): Promise<SettleResponse> {
        if (!this.facilitatorClient) {
            throw new Error('No facilitator configured. Pass facilitator config to X402Client constructor.');
        }
        return this.facilitatorClient.settle(payload, this.requirementsForFacilitator(payload, requirements));
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
