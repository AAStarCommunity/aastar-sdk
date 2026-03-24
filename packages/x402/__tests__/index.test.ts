import { describe, it, expect } from 'vitest';
import {
    generateNonce,
    encodePaymentRequired,
    decodePaymentRequired,
    encodePaymentPayload,
    decodePaymentPayload,
    encodeSettleResponse,
    decodeSettleResponse,
    EIP3009_TYPES,
    HEADER_PAYMENT_REQUIRED,
    HEADER_PAYMENT_SIGNATURE,
    HEADER_PAYMENT_RESPONSE,
    FacilitatorClient,
    type PaymentRequired,
    type PaymentPayload,
    type SettleResponse,
} from '../src/index.js';

describe('@aastar/x402', () => {
    describe('EIP-3009 types', () => {
        it('should have correct TransferWithAuthorization fields', () => {
            expect(EIP3009_TYPES.TransferWithAuthorization).toBeDefined();
            expect(EIP3009_TYPES.TransferWithAuthorization).toHaveLength(6);
            const fieldNames = EIP3009_TYPES.TransferWithAuthorization.map(f => f.name);
            expect(fieldNames).toEqual(['from', 'to', 'value', 'validAfter', 'validBefore', 'nonce']);
        });
    });

    describe('nonce generation', () => {
        it('should generate unique 32-byte hex nonces', () => {
            const nonce1 = generateNonce();
            const nonce2 = generateNonce();
            expect(nonce1).not.toBe(nonce2);
            expect(nonce1).toMatch(/^0x[0-9a-f]{64}$/);
        });
    });

    describe('v2 header constants', () => {
        it('should use standard x402 v2 header names', () => {
            expect(HEADER_PAYMENT_REQUIRED).toBe('PAYMENT-REQUIRED');
            expect(HEADER_PAYMENT_SIGNATURE).toBe('PAYMENT-SIGNATURE');
            expect(HEADER_PAYMENT_RESPONSE).toBe('PAYMENT-RESPONSE');
        });
    });

    describe('PaymentRequired encoding', () => {
        const paymentRequired: PaymentRequired = {
            x402Version: 2,
            resource: { url: 'https://api.example.com/data', description: 'Premium data' },
            accepts: [{
                scheme: 'exact',
                network: 'eip155:11155111',
                asset: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as `0x${string}`,
                amount: '1000000',
                payTo: '0x2222222222222222222222222222222222222222' as `0x${string}`,
                maxTimeoutSeconds: 3600,
                extra: { name: 'USDC', version: '2' },
            }],
        };

        it('should encode and decode PaymentRequired', () => {
            const encoded = encodePaymentRequired(paymentRequired);
            expect(typeof encoded).toBe('string');
            const decoded = decodePaymentRequired(encoded);
            expect(decoded.x402Version).toBe(2);
            expect(decoded.accepts).toHaveLength(1);
            expect(decoded.accepts[0].network).toBe('eip155:11155111');
            expect(decoded.accepts[0].extra.name).toBe('USDC');
        });
    });

    describe('PaymentPayload encoding', () => {
        const payload: PaymentPayload = {
            x402Version: 2,
            accepted: {
                scheme: 'exact',
                network: 'eip155:11155111',
                asset: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as `0x${string}`,
                amount: '1000000',
                payTo: '0x2222222222222222222222222222222222222222' as `0x${string}`,
                maxTimeoutSeconds: 3600,
                extra: { name: 'USDC', version: '2' },
            },
            payload: {
                signature: '0xabcdef1234' as `0x${string}`,
                authorization: {
                    from: '0x1111111111111111111111111111111111111111' as `0x${string}`,
                    to: '0x2222222222222222222222222222222222222222' as `0x${string}`,
                    value: '1000000',
                    validAfter: '0',
                    validBefore: '9999999999',
                    nonce: '0x0000000000000000000000000000000000000000000000000000000000000001' as `0x${string}`,
                },
            },
        };

        it('should encode and decode PaymentPayload', () => {
            const encoded = encodePaymentPayload(payload);
            const decoded = decodePaymentPayload(encoded);
            expect(decoded.x402Version).toBe(2);
            expect(decoded.accepted.scheme).toBe('exact');
            expect(decoded.payload.authorization.from).toBe('0x1111111111111111111111111111111111111111');
        });
    });

    describe('SettleResponse encoding', () => {
        it('should encode and decode SettleResponse', () => {
            const response: SettleResponse = {
                success: true,
                transaction: '0xabc123',
                network: 'eip155:11155111',
                payer: '0x1111111111111111111111111111111111111111' as `0x${string}`,
            };
            const encoded = encodeSettleResponse(response);
            const decoded = decodeSettleResponse(encoded);
            expect(decoded.success).toBe(true);
            expect(decoded.transaction).toBe('0xabc123');
            expect(decoded.network).toBe('eip155:11155111');
        });
    });

    describe('FacilitatorClient', () => {
        it('should be constructable with config', () => {
            const client = new FacilitatorClient({ url: 'https://x402.org/facilitator' });
            expect(client).toBeDefined();
        });
    });
});
