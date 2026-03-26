import type { PaymentRequired, PaymentPayload, SettleResponse } from './types.js';

// ============================================================
// x402 v2 HTTP Header Names
// Ref: github.com/coinbase/x402/blob/main/specs/x402-specification-v2.md
// ============================================================

/** v2 header names (standard) */
export const HEADER_PAYMENT_REQUIRED = 'PAYMENT-REQUIRED';
export const HEADER_PAYMENT_SIGNATURE = 'PAYMENT-SIGNATURE';
export const HEADER_PAYMENT_RESPONSE = 'PAYMENT-RESPONSE';

/** v1 header names (backward compat) */
export const HEADER_V1_PAYMENT = 'X-PAYMENT';
export const HEADER_V1_PAYMENT_RESPONSE = 'X-PAYMENT-RESPONSE';

// ============================================================
// Encoding / Decoding (Base64 JSON — per x402 spec)
// ============================================================

function toBase64(data: unknown): string {
    const json = JSON.stringify(data);
    if (typeof Buffer !== 'undefined') {
        return Buffer.from(json).toString('base64');
    }
    return btoa(json);
}

function fromBase64<T>(encoded: string): T {
    let json: string;
    if (typeof Buffer !== 'undefined') {
        json = Buffer.from(encoded, 'base64').toString('utf-8');
    } else {
        json = atob(encoded);
    }
    return JSON.parse(json) as T;
}

// --- PaymentRequired (402 response) ---

export function encodePaymentRequired(req: PaymentRequired): string {
    return toBase64(req);
}

export function decodePaymentRequired(encoded: string): PaymentRequired {
    return fromBase64<PaymentRequired>(encoded);
}

// --- PaymentPayload (client → server) ---

export function encodePaymentPayload(payload: PaymentPayload): string {
    return toBase64(payload);
}

export function decodePaymentPayload(encoded: string): PaymentPayload {
    return fromBase64<PaymentPayload>(encoded);
}

// --- SettleResponse (server → client) ---

export function encodeSettleResponse(resp: SettleResponse): string {
    return toBase64(resp);
}

export function decodeSettleResponse(encoded: string): SettleResponse {
    return fromBase64<SettleResponse>(encoded);
}

// ============================================================
// Header Extraction Helpers
// ============================================================

/**
 * Extract PaymentRequired from a 402 Response.
 * Tries v2 header first, falls back to v1.
 */
export function extractPaymentRequired(response: Response): PaymentRequired | null {
    const v2 = response.headers.get(HEADER_PAYMENT_REQUIRED);
    if (v2) return decodePaymentRequired(v2);

    // v1 fallback: check body or X-PAYMENT-REQUIRED
    const v1 = response.headers.get('X-PAYMENT-REQUIRED');
    if (v1) return decodePaymentRequired(v1);

    return null;
}

/**
 * Extract SettleResponse from a successful response.
 */
export function extractSettleResponse(response: Response): SettleResponse | null {
    const v2 = response.headers.get(HEADER_PAYMENT_RESPONSE);
    if (v2) return decodeSettleResponse(v2);

    const v1 = response.headers.get(HEADER_V1_PAYMENT_RESPONSE);
    if (v1) return decodeSettleResponse(v1);

    return null;
}
