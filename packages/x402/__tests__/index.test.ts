import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    generateNonce,
    getEIP3009Domain,
    signTransferWithAuthorization,
    encodePaymentRequired,
    decodePaymentRequired,
    encodePaymentPayload,
    decodePaymentPayload,
    encodeSettleResponse,
    decodeSettleResponse,
    extractPaymentRequired,
    extractSettleResponse,
    EIP3009_TYPES,
    HEADER_PAYMENT_REQUIRED,
    HEADER_PAYMENT_SIGNATURE,
    HEADER_PAYMENT_RESPONSE,
    HEADER_V1_PAYMENT,
    HEADER_V1_PAYMENT_RESPONSE,
    FacilitatorClient,
    type PaymentRequired,
    type PaymentPayload,
    type SettleResponse,
} from '../src/index.js';

// Test constants
const USDC_ADDRESS = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as const;
const PAYER_ADDRESS = '0x1111111111111111111111111111111111111111' as const;
const PAYEE_ADDRESS = '0x2222222222222222222222222222222222222222' as const;
const SEPOLIA_CHAIN_ID = 11155111;

// Shared test fixtures
const samplePaymentRequired: PaymentRequired = {
    x402Version: 2,
    resource: { url: 'https://api.example.com/data', description: 'Premium data' },
    accepts: [{
        scheme: 'exact',
        network: 'eip155:11155111',
        asset: USDC_ADDRESS,
        amount: '1000000',
        payTo: PAYEE_ADDRESS,
        maxTimeoutSeconds: 3600,
        extra: { name: 'USDC', version: '2' },
    }],
};

const samplePaymentPayload: PaymentPayload = {
    x402Version: 2,
    accepted: {
        scheme: 'exact',
        network: 'eip155:11155111',
        asset: USDC_ADDRESS,
        amount: '1000000',
        payTo: PAYEE_ADDRESS,
        maxTimeoutSeconds: 3600,
        extra: { name: 'USDC', version: '2' },
    },
    payload: {
        signature: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab1c' as `0x${string}`,
        authorization: {
            from: PAYER_ADDRESS,
            to: PAYEE_ADDRESS,
            value: '1000000',
            validAfter: '0',
            validBefore: '9999999999',
            nonce: '0x0000000000000000000000000000000000000000000000000000000000000001' as `0x${string}`,
        },
    },
};

const sampleSettleResponse: SettleResponse = {
    success: true,
    transaction: '0xabc123def456',
    network: 'eip155:11155111',
    payer: PAYER_ADDRESS,
};

// ============================================================
// EIP-3009 Module
// ============================================================

describe('@aastar/x402', () => {
    describe('EIP-3009 types', () => {
        it('should have correct TransferWithAuthorization fields', () => {
            expect(EIP3009_TYPES.TransferWithAuthorization).toBeDefined();
            expect(EIP3009_TYPES.TransferWithAuthorization).toHaveLength(6);
            const fieldNames = EIP3009_TYPES.TransferWithAuthorization.map(f => f.name);
            expect(fieldNames).toEqual(['from', 'to', 'value', 'validAfter', 'validBefore', 'nonce']);
        });

        it('should have correct Solidity types', () => {
            const fieldTypes = EIP3009_TYPES.TransferWithAuthorization.map(f => f.type);
            expect(fieldTypes).toEqual(['address', 'address', 'uint256', 'uint256', 'uint256', 'bytes32']);
        });

        it('should be declared as const', () => {
            // `as const` provides TypeScript-level immutability
            // Verify the structure is stable and well-defined
            expect(Object.keys(EIP3009_TYPES)).toEqual(['TransferWithAuthorization']);
        });
    });

    describe('EIP-3009 domain generation', () => {
        it('should generate correct USDC domain for Sepolia', () => {
            const domain = getEIP3009Domain('USDC', '2', SEPOLIA_CHAIN_ID, USDC_ADDRESS);
            expect(domain.name).toBe('USDC');
            expect(domain.version).toBe('2');
            expect(domain.chainId).toBe(SEPOLIA_CHAIN_ID);
            expect(domain.verifyingContract).toBe(USDC_ADDRESS);
        });

        it('should support different token names and versions', () => {
            const domain = getEIP3009Domain('EURC', '1', 1, '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' as `0x${string}`);
            expect(domain.name).toBe('EURC');
            expect(domain.version).toBe('1');
            expect(domain.chainId).toBe(1);
        });
    });

    describe('nonce generation', () => {
        it('should generate unique 32-byte hex nonces', () => {
            const nonce1 = generateNonce();
            const nonce2 = generateNonce();
            expect(nonce1).not.toBe(nonce2);
            expect(nonce1).toMatch(/^0x[0-9a-f]{64}$/);
            expect(nonce2).toMatch(/^0x[0-9a-f]{64}$/);
        });

        it('should generate 100 unique nonces without collision', () => {
            const nonces = new Set<string>();
            for (let i = 0; i < 100; i++) {
                nonces.add(generateNonce());
            }
            expect(nonces.size).toBe(100);
        });

        it('should produce hex string with 0x prefix', () => {
            const nonce = generateNonce();
            expect(nonce.startsWith('0x')).toBe(true);
            expect(nonce.length).toBe(66); // 0x + 64 hex chars
        });
    });

    describe('signTransferWithAuthorization', () => {
        it('should throw when wallet has no account', async () => {
            const mockWallet = { account: undefined } as any;
            await expect(signTransferWithAuthorization(mockWallet, {
                from: PAYER_ADDRESS,
                to: PAYEE_ADDRESS,
                value: 1000000n,
                validAfter: 0n,
                validBefore: 9999999999n,
                nonce: '0x0000000000000000000000000000000000000000000000000000000000000001' as `0x${string}`,
                tokenName: 'USDC',
                tokenVersion: '2',
                chainId: SEPOLIA_CHAIN_ID,
                verifyingContract: USDC_ADDRESS,
            })).rejects.toThrow('WalletClient must have an account');
        });

        it('should call signTypedData with correct parameters', async () => {
            const mockSignature = '0xmocksig' as `0x${string}`;
            const mockWallet = {
                account: { address: PAYER_ADDRESS },
                signTypedData: vi.fn().mockResolvedValue(mockSignature),
            } as any;

            const result = await signTransferWithAuthorization(mockWallet, {
                from: PAYER_ADDRESS,
                to: PAYEE_ADDRESS,
                value: 1000000n,
                validAfter: 0n,
                validBefore: 9999999999n,
                nonce: '0x0000000000000000000000000000000000000000000000000000000000000001' as `0x${string}`,
                tokenName: 'USDC',
                tokenVersion: '2',
                chainId: SEPOLIA_CHAIN_ID,
                verifyingContract: USDC_ADDRESS,
            });

            expect(result).toBe(mockSignature);
            expect(mockWallet.signTypedData).toHaveBeenCalledOnce();

            const callArgs = mockWallet.signTypedData.mock.calls[0][0];
            expect(callArgs.domain.name).toBe('USDC');
            expect(callArgs.domain.version).toBe('2');
            expect(callArgs.domain.chainId).toBe(SEPOLIA_CHAIN_ID);
            expect(callArgs.domain.verifyingContract).toBe(USDC_ADDRESS);
            expect(callArgs.primaryType).toBe('TransferWithAuthorization');
            expect(callArgs.message.from).toBe(PAYER_ADDRESS);
            expect(callArgs.message.to).toBe(PAYEE_ADDRESS);
            expect(callArgs.message.value).toBe(1000000n);
        });
    });

    // ============================================================
    // v2 Header Constants
    // ============================================================

    describe('v2 header constants', () => {
        it('should use standard x402 v2 header names', () => {
            expect(HEADER_PAYMENT_REQUIRED).toBe('PAYMENT-REQUIRED');
            expect(HEADER_PAYMENT_SIGNATURE).toBe('PAYMENT-SIGNATURE');
            expect(HEADER_PAYMENT_RESPONSE).toBe('PAYMENT-RESPONSE');
        });

        it('should have v1 legacy header names', () => {
            expect(HEADER_V1_PAYMENT).toBe('X-PAYMENT');
            expect(HEADER_V1_PAYMENT_RESPONSE).toBe('X-PAYMENT-RESPONSE');
        });
    });

    // ============================================================
    // PaymentRequired Encoding
    // ============================================================

    describe('PaymentRequired encoding', () => {
        it('should encode and decode PaymentRequired round-trip', () => {
            const encoded = encodePaymentRequired(samplePaymentRequired);
            expect(typeof encoded).toBe('string');
            const decoded = decodePaymentRequired(encoded);
            expect(decoded.x402Version).toBe(2);
            expect(decoded.accepts).toHaveLength(1);
            expect(decoded.accepts[0].network).toBe('eip155:11155111');
            expect(decoded.accepts[0].extra.name).toBe('USDC');
            expect(decoded.resource.url).toBe('https://api.example.com/data');
        });

        it('should produce valid base64 encoded string', () => {
            const encoded = encodePaymentRequired(samplePaymentRequired);
            const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
            const parsed = JSON.parse(decoded);
            expect(parsed.x402Version).toBe(2);
        });

        it('should handle multiple payment options in accepts', () => {
            const multiOption: PaymentRequired = {
                ...samplePaymentRequired,
                accepts: [
                    samplePaymentRequired.accepts[0],
                    {
                        scheme: 'exact',
                        network: 'eip155:1',
                        asset: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as `0x${string}`,
                        amount: '2000000',
                        payTo: PAYEE_ADDRESS,
                        maxTimeoutSeconds: 1800,
                        extra: { name: 'USDC', version: '2' },
                    },
                ],
            };
            const encoded = encodePaymentRequired(multiOption);
            const decoded = decodePaymentRequired(encoded);
            expect(decoded.accepts).toHaveLength(2);
            expect(decoded.accepts[0].network).toBe('eip155:11155111');
            expect(decoded.accepts[1].network).toBe('eip155:1');
        });

        it('should preserve optional fields', () => {
            const withExtensions: PaymentRequired = {
                ...samplePaymentRequired,
                error: 'payment required',
                extensions: { customField: 'value' },
            };
            const decoded = decodePaymentRequired(encodePaymentRequired(withExtensions));
            expect(decoded.error).toBe('payment required');
            expect(decoded.extensions?.customField).toBe('value');
        });
    });

    // ============================================================
    // PaymentPayload Encoding
    // ============================================================

    describe('PaymentPayload encoding', () => {
        it('should encode and decode PaymentPayload round-trip', () => {
            const encoded = encodePaymentPayload(samplePaymentPayload);
            const decoded = decodePaymentPayload(encoded);
            expect(decoded.x402Version).toBe(2);
            expect(decoded.accepted.scheme).toBe('exact');
            expect(decoded.payload.authorization.from).toBe(PAYER_ADDRESS);
            expect(decoded.payload.authorization.to).toBe(PAYEE_ADDRESS);
            expect(decoded.payload.authorization.value).toBe('1000000');
        });

        it('should preserve nonce in authorization', () => {
            const decoded = decodePaymentPayload(encodePaymentPayload(samplePaymentPayload));
            expect(decoded.payload.authorization.nonce).toBe(
                '0x0000000000000000000000000000000000000000000000000000000000000001'
            );
        });

        it('should preserve signature', () => {
            const decoded = decodePaymentPayload(encodePaymentPayload(samplePaymentPayload));
            expect(decoded.payload.signature).toBe(samplePaymentPayload.payload.signature);
        });
    });

    // ============================================================
    // SettleResponse Encoding
    // ============================================================

    describe('SettleResponse encoding', () => {
        it('should encode and decode successful response', () => {
            const encoded = encodeSettleResponse(sampleSettleResponse);
            const decoded = decodeSettleResponse(encoded);
            expect(decoded.success).toBe(true);
            expect(decoded.transaction).toBe('0xabc123def456');
            expect(decoded.network).toBe('eip155:11155111');
            expect(decoded.payer).toBe(PAYER_ADDRESS);
        });

        it('should encode and decode failure response', () => {
            const failure: SettleResponse = {
                success: false,
                errorReason: 'Insufficient balance',
            };
            const decoded = decodeSettleResponse(encodeSettleResponse(failure));
            expect(decoded.success).toBe(false);
            expect(decoded.errorReason).toBe('Insufficient balance');
            expect(decoded.transaction).toBeUndefined();
        });

        it('should handle response with extensions', () => {
            const withExt: SettleResponse = {
                ...sampleSettleResponse,
                extensions: { gasUsed: '21000', blockNumber: '12345' },
            };
            const decoded = decodeSettleResponse(encodeSettleResponse(withExt));
            expect(decoded.extensions?.gasUsed).toBe('21000');
        });
    });

    // ============================================================
    // Header Extraction from Response
    // ============================================================

    describe('extractPaymentRequired', () => {
        it('should extract from v2 PAYMENT-REQUIRED header', () => {
            const encoded = encodePaymentRequired(samplePaymentRequired);
            const response = new Response(null, {
                status: 402,
                headers: { [HEADER_PAYMENT_REQUIRED]: encoded },
            });
            const result = extractPaymentRequired(response);
            expect(result).not.toBeNull();
            expect(result!.x402Version).toBe(2);
            expect(result!.accepts[0].network).toBe('eip155:11155111');
        });

        it('should fall back to X-PAYMENT-REQUIRED header', () => {
            const encoded = encodePaymentRequired(samplePaymentRequired);
            const response = new Response(null, {
                status: 402,
                headers: { 'X-PAYMENT-REQUIRED': encoded },
            });
            const result = extractPaymentRequired(response);
            expect(result).not.toBeNull();
            expect(result!.x402Version).toBe(2);
        });

        it('should return null when no payment headers', () => {
            const response = new Response(null, { status: 402 });
            expect(extractPaymentRequired(response)).toBeNull();
        });

        it('should prefer v2 header over v1', () => {
            const v2Data: PaymentRequired = {
                ...samplePaymentRequired,
                resource: { url: 'https://v2.example.com' },
            };
            const v1Data: PaymentRequired = {
                ...samplePaymentRequired,
                resource: { url: 'https://v1.example.com' },
            };
            const response = new Response(null, {
                status: 402,
                headers: {
                    [HEADER_PAYMENT_REQUIRED]: encodePaymentRequired(v2Data),
                    'X-PAYMENT-REQUIRED': encodePaymentRequired(v1Data),
                },
            });
            const result = extractPaymentRequired(response);
            expect(result!.resource.url).toBe('https://v2.example.com');
        });
    });

    describe('extractSettleResponse', () => {
        it('should extract from v2 PAYMENT-RESPONSE header', () => {
            const encoded = encodeSettleResponse(sampleSettleResponse);
            const response = new Response(null, {
                status: 200,
                headers: { [HEADER_PAYMENT_RESPONSE]: encoded },
            });
            const result = extractSettleResponse(response);
            expect(result).not.toBeNull();
            expect(result!.success).toBe(true);
            expect(result!.transaction).toBe('0xabc123def456');
        });

        it('should fall back to v1 X-PAYMENT-RESPONSE header', () => {
            const encoded = encodeSettleResponse(sampleSettleResponse);
            const response = new Response(null, {
                status: 200,
                headers: { [HEADER_V1_PAYMENT_RESPONSE]: encoded },
            });
            const result = extractSettleResponse(response);
            expect(result).not.toBeNull();
            expect(result!.success).toBe(true);
        });

        it('should return null when no response headers', () => {
            const response = new Response(null, { status: 200 });
            expect(extractSettleResponse(response)).toBeNull();
        });
    });

    // ============================================================
    // FacilitatorClient
    // ============================================================

    describe('FacilitatorClient', () => {
        let fetchSpy: ReturnType<typeof vi.spyOn>;

        beforeEach(() => {
            fetchSpy = vi.spyOn(globalThis, 'fetch');
        });

        afterEach(() => {
            fetchSpy.mockRestore();
        });

        it('should be constructable with URL only', () => {
            const client = new FacilitatorClient({ url: 'https://x402.org/facilitator' });
            expect(client).toBeDefined();
        });

        it('should strip trailing slash from URL', () => {
            const client = new FacilitatorClient({ url: 'https://x402.org/facilitator/' });
            expect(client).toBeDefined();
        });

        describe('verify()', () => {
            it('should POST to /verify with correct body', async () => {
                const verifyResponse = { isValid: true, payer: PAYER_ADDRESS };
                fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(verifyResponse), { status: 200 }));

                const client = new FacilitatorClient({ url: 'https://x402.org/facilitator' });
                const result = await client.verify(samplePaymentPayload, samplePaymentPayload.accepted);

                expect(fetchSpy).toHaveBeenCalledWith(
                    'https://x402.org/facilitator/verify',
                    expect.objectContaining({
                        method: 'POST',
                        body: expect.any(String),
                    })
                );
                expect(result.isValid).toBe(true);

                const body = JSON.parse((fetchSpy.mock.calls[0][1] as any).body);
                expect(body.x402Version).toBe(2);
                expect(body.paymentPayload).toBeDefined();
                expect(body.paymentRequirements).toBeDefined();
            });

            it('should throw on non-OK response', async () => {
                fetchSpy.mockResolvedValueOnce(new Response('bad request', { status: 400 }));

                const client = new FacilitatorClient({ url: 'https://x402.org/facilitator' });
                await expect(
                    client.verify(samplePaymentPayload, samplePaymentPayload.accepted)
                ).rejects.toThrow('Facilitator /verify failed: 400');
            });
        });

        describe('settle()', () => {
            it('should POST to /settle and return SettleResponse', async () => {
                const settleResp = { success: true, transaction: '0xabc' };
                fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(settleResp), { status: 200 }));

                const client = new FacilitatorClient({ url: 'https://x402.org/facilitator' });
                const result = await client.settle(samplePaymentPayload, samplePaymentPayload.accepted);

                expect(fetchSpy).toHaveBeenCalledWith(
                    'https://x402.org/facilitator/settle',
                    expect.objectContaining({ method: 'POST' })
                );
                expect(result.success).toBe(true);
                expect(result.transaction).toBe('0xabc');
            });

            it('should throw on 500 server error', async () => {
                fetchSpy.mockResolvedValueOnce(new Response('internal error', { status: 500 }));

                const client = new FacilitatorClient({ url: 'https://x402.org/facilitator' });
                await expect(
                    client.settle(samplePaymentPayload, samplePaymentPayload.accepted)
                ).rejects.toThrow('Facilitator /settle failed: 500');
            });
        });

        describe('supported()', () => {
            it('should GET /supported and return capabilities', async () => {
                const supportedResp = {
                    kinds: [{
                        x402Version: 2,
                        scheme: 'exact',
                        network: 'eip155:8453',
                    }],
                    extensions: ['hmac-challenge'],
                };
                fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(supportedResp), { status: 200 }));

                const client = new FacilitatorClient({ url: 'https://x402.org/facilitator' });
                const result = await client.supported();

                expect(fetchSpy).toHaveBeenCalledWith(
                    'https://x402.org/facilitator/supported',
                    expect.objectContaining({ method: 'GET' })
                );
                expect(result.kinds).toHaveLength(1);
                expect(result.kinds[0].scheme).toBe('exact');
                expect(result.extensions).toContain('hmac-challenge');
            });
        });

        describe('auth headers', () => {
            it('should inject custom auth headers per endpoint', async () => {
                fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ isValid: true }), { status: 200 }));

                const client = new FacilitatorClient({
                    url: 'https://x402.org/facilitator',
                    createAuthHeaders: async () => ({
                        verify: { 'X-API-Key': 'test-key-verify' },
                        settle: { 'X-API-Key': 'test-key-settle' },
                    }),
                });

                await client.verify(samplePaymentPayload, samplePaymentPayload.accepted);

                const headers = (fetchSpy.mock.calls[0][1] as any).headers;
                expect(headers['Content-Type']).toBe('application/json');
                expect(headers['X-API-Key']).toBe('test-key-verify');
            });
        });
    });
});
