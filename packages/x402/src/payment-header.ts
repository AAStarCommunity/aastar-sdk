import type { X402PaymentHeader } from './types.js';

export function encodePaymentHeader(header: X402PaymentHeader): string {
    const json = JSON.stringify(header);
    if (typeof Buffer !== 'undefined') {
        return Buffer.from(json).toString('base64');
    }
    return btoa(json);
}

export function decodePaymentHeader(encoded: string): X402PaymentHeader {
    let json: string;
    if (typeof Buffer !== 'undefined') {
        json = Buffer.from(encoded, 'base64').toString('utf-8');
    } else {
        json = atob(encoded);
    }
    return JSON.parse(json) as X402PaymentHeader;
}

export function buildPaymentHeaderString(header: X402PaymentHeader): string {
    return `x402 ${encodePaymentHeader(header)}`;
}

export function parsePaymentHeaderString(headerValue: string): X402PaymentHeader {
    const parts = headerValue.split(' ');
    if (parts.length !== 2 || parts[0] !== 'x402') {
        throw new Error('Invalid X-PAYMENT header format: expected "x402 <base64>"');
    }
    return decodePaymentHeader(parts[1]);
}
