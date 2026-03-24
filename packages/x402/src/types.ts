import type { Address, Hex, Hash } from 'viem';

// ============================================================
// x402 v2 Protocol Types
// Aligned with: coinbase/x402 spec v2 (Dec 2025)
// Ref: github.com/coinbase/x402/blob/main/specs/x402-specification-v2.md
// ============================================================

/** CAIP-2 network identifier (e.g. "eip155:11155111" for Sepolia) */
export type NetworkId = `eip155:${number}` | `solana:${string}`;

/** Resource description in 402 response */
export type ResourceInfo = {
    url: string;
    description?: string;
    mimeType?: string;
};

/**
 * Payment requirements — one option in the `accepts` array.
 * Matches @x402/core PaymentRequirements.
 */
export type PaymentRequirements = {
    scheme: 'exact' | 'upto';
    network: NetworkId;
    asset: Address;
    amount: string;
    payTo: Address;
    maxTimeoutSeconds: number;
    extra: {
        name: string;       // Token name for EIP-712 domain (e.g. "USDC")
        version: string;    // Token version for EIP-712 domain (e.g. "2")
    };
};

/**
 * 402 response body / PAYMENT-REQUIRED header.
 * Server sends this to indicate payment is needed.
 */
export type PaymentRequired = {
    x402Version: 2;
    error?: string;
    resource: ResourceInfo;
    accepts: PaymentRequirements[];
    extensions?: Record<string, unknown>;
};

/**
 * EIP-3009 TransferWithAuthorization parameters.
 */
export type EIP3009Authorization = {
    from: Address;
    to: Address;
    value: string;
    validAfter: string;
    validBefore: string;
    nonce: Hex;
};

/**
 * Client payment payload — PAYMENT-SIGNATURE header.
 * Client sends this on retry request.
 */
export type PaymentPayload = {
    x402Version: 2;
    resource?: ResourceInfo;
    accepted: PaymentRequirements;
    payload: {
        signature: Hex;
        authorization: EIP3009Authorization;
    };
    extensions?: Record<string, unknown>;
};

/**
 * Settlement response — PAYMENT-RESPONSE header.
 * Server returns after facilitator settles.
 */
export type SettleResponse = {
    success: boolean;
    transaction?: string;
    network?: NetworkId;
    payer?: Address;
    errorReason?: string;
    extensions?: Record<string, unknown>;
};

/**
 * Facilitator verify response.
 */
export type VerifyResponse = {
    isValid: boolean;
    invalidReason?: string;
    payer?: Address;
};

/**
 * Facilitator supported kinds response.
 */
export type FacilitatorSupported = {
    kinds: Array<{
        x402Version: number;
        scheme: string;
        network: string;
        extra?: Record<string, unknown>;
    }>;
    extensions: string[];
};

// ============================================================
// SuperPaymaster-specific extensions (additive to x402 v2)
// ============================================================

/** Direct settlement (for xPNTs and pre-approved tokens, bypasses EIP-3009) */
export type DirectPaymentPayload = {
    x402Version: 2;
    scheme: 'direct';
    from: Address;
    to: Address;
    asset: Address;
    amount: string;
    nonce: Hex;
};

/** Payment creation parameters (high-level SDK input) */
export type X402PaymentParams = {
    from: Address;
    to: Address;
    asset: Address;
    amount: bigint;
    validAfter?: bigint;
    validBefore?: bigint;
    nonce?: Hex;
};

/** Facilitator client configuration */
export type FacilitatorConfig = {
    url: string;
    createAuthHeaders?: () => Promise<{
        verify?: Record<string, string>;
        settle?: Record<string, string>;
        supported?: Record<string, string>;
    }>;
};
