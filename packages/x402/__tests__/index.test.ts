import { describe, it, expect } from 'vitest';
import {
    generateNonce,
    encodePaymentHeader,
    decodePaymentHeader,
    buildPaymentHeaderString,
    parsePaymentHeaderString,
    EIP3009_TYPES,
} from '../src/index.js';

describe('@aastar/x402', () => {
    it('should export EIP3009_TYPES', () => {
        expect(EIP3009_TYPES.TransferWithAuthorization).toBeDefined();
        expect(EIP3009_TYPES.TransferWithAuthorization).toHaveLength(6);
    });

    it('should generate unique nonces', () => {
        const nonce1 = generateNonce();
        const nonce2 = generateNonce();
        expect(nonce1).not.toBe(nonce2);
        expect(nonce1).toMatch(/^0x[0-9a-f]{64}$/);
    });

    it('should encode and decode payment headers', () => {
        const header = {
            scheme: 'eip3009' as const,
            from: '0x1111111111111111111111111111111111111111' as `0x${string}`,
            to: '0x2222222222222222222222222222222222222222' as `0x${string}`,
            asset: '0x3333333333333333333333333333333333333333' as `0x${string}`,
            amount: '1000000',
            nonce: '0x0000000000000000000000000000000000000000000000000000000000000001' as `0x${string}`,
            validAfter: '0',
            validBefore: '9999999999',
            signature: '0xabcdef' as `0x${string}`,
            chainId: 11155111,
            facilitator: '0x4444444444444444444444444444444444444444' as `0x${string}`,
        };

        const encoded = encodePaymentHeader(header);
        const decoded = decodePaymentHeader(encoded);
        expect(decoded).toEqual(header);
    });

    it('should build and parse payment header strings', () => {
        const header = {
            scheme: 'direct' as const,
            from: '0x1111111111111111111111111111111111111111' as `0x${string}`,
            to: '0x2222222222222222222222222222222222222222' as `0x${string}`,
            asset: '0x3333333333333333333333333333333333333333' as `0x${string}`,
            amount: '500000',
            nonce: '0x0000000000000000000000000000000000000000000000000000000000000002' as `0x${string}`,
            validAfter: '0',
            validBefore: '9999999999',
            signature: '0x' as `0x${string}`,
            chainId: 11155111,
            facilitator: '0x4444444444444444444444444444444444444444' as `0x${string}`,
        };

        const headerString = buildPaymentHeaderString(header);
        expect(headerString).toMatch(/^x402 /);

        const parsed = parsePaymentHeaderString(headerString);
        expect(parsed).toEqual(header);
    });

    it('should throw on invalid header string', () => {
        expect(() => parsePaymentHeaderString('invalid')).toThrow();
        expect(() => parsePaymentHeaderString('bearer abc')).toThrow();
    });
});
