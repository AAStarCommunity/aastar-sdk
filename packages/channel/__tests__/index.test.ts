import { describe, it, expect, vi } from 'vitest';
import { VOUCHER_TYPES, getVoucherDomain, signVoucher } from '../src/index.js';
import type { VoucherParams, SignedVoucher, ChannelConfig } from '../src/types.js';

// Test constants
const CHANNEL_ADDRESS = '0x5753e9675f68221cA901e495C1696e33F552ea36' as const;
const PAYER_ADDRESS = '0x1111111111111111111111111111111111111111' as const;
const PAYEE_ADDRESS = '0x2222222222222222222222222222222222222222' as const;
const TOKEN_ADDRESS = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as const;
const SEPOLIA_CHAIN_ID = 11155111;
const SAMPLE_CHANNEL_ID = '0x0000000000000000000000000000000000000000000000000000000000000abc' as `0x${string}`;

describe('@aastar/channel', () => {
    // ============================================================
    // Voucher Types
    // ============================================================

    describe('VOUCHER_TYPES', () => {
        it('should have correct Voucher field structure', () => {
            expect(VOUCHER_TYPES.Voucher).toBeDefined();
            expect(VOUCHER_TYPES.Voucher).toHaveLength(2);
            expect(VOUCHER_TYPES.Voucher[0].name).toBe('channelId');
            expect(VOUCHER_TYPES.Voucher[0].type).toBe('bytes32');
            expect(VOUCHER_TYPES.Voucher[1].name).toBe('cumulativeAmount');
            expect(VOUCHER_TYPES.Voucher[1].type).toBe('uint128');
        });

        it('should be declared as const with single key', () => {
            expect(Object.keys(VOUCHER_TYPES)).toEqual(['Voucher']);
        });
    });

    // ============================================================
    // Domain Generation
    // ============================================================

    describe('getVoucherDomain', () => {
        it('should generate correct EIP-712 domain for Sepolia', () => {
            const domain = getVoucherDomain(SEPOLIA_CHAIN_ID, CHANNEL_ADDRESS);
            expect(domain.name).toBe('MicroPaymentChannel');
            expect(domain.version).toBe('1.0.0');
            expect(domain.chainId).toBe(SEPOLIA_CHAIN_ID);
            expect(domain.verifyingContract).toBe(CHANNEL_ADDRESS);
        });

        it('should generate domain for different chains', () => {
            const mainnetDomain = getVoucherDomain(1, CHANNEL_ADDRESS);
            expect(mainnetDomain.chainId).toBe(1);

            const baseDomain = getVoucherDomain(8453, CHANNEL_ADDRESS);
            expect(baseDomain.chainId).toBe(8453);
        });

        it('should use consistent name and version across chains', () => {
            const d1 = getVoucherDomain(1, CHANNEL_ADDRESS);
            const d2 = getVoucherDomain(SEPOLIA_CHAIN_ID, CHANNEL_ADDRESS);
            expect(d1.name).toBe(d2.name);
            expect(d1.version).toBe(d2.version);
        });
    });

    // ============================================================
    // Voucher Signing
    // ============================================================

    describe('signVoucher', () => {
        it('should throw when wallet has no account', async () => {
            const mockWallet = { account: undefined } as any;
            await expect(signVoucher(mockWallet, {
                channelId: SAMPLE_CHANNEL_ID,
                cumulativeAmount: 1000000n,
                chainId: SEPOLIA_CHAIN_ID,
                verifyingContract: CHANNEL_ADDRESS,
            })).rejects.toThrow('WalletClient must have an account');
        });

        it('should call signTypedData with correct EIP-712 parameters', async () => {
            const mockSignature = '0xmockvouchersig' as `0x${string}`;
            const mockWallet = {
                account: { address: PAYER_ADDRESS },
                signTypedData: vi.fn().mockResolvedValue(mockSignature),
            } as any;

            const result = await signVoucher(mockWallet, {
                channelId: SAMPLE_CHANNEL_ID,
                cumulativeAmount: 5000000n,
                chainId: SEPOLIA_CHAIN_ID,
                verifyingContract: CHANNEL_ADDRESS,
            });

            expect(result).toBe(mockSignature);
            expect(mockWallet.signTypedData).toHaveBeenCalledOnce();

            const callArgs = mockWallet.signTypedData.mock.calls[0][0];
            expect(callArgs.domain.name).toBe('MicroPaymentChannel');
            expect(callArgs.domain.version).toBe('1.0.0');
            expect(callArgs.domain.chainId).toBe(SEPOLIA_CHAIN_ID);
            expect(callArgs.domain.verifyingContract).toBe(CHANNEL_ADDRESS);
            expect(callArgs.primaryType).toBe('Voucher');
            expect(callArgs.message.channelId).toBe(SAMPLE_CHANNEL_ID);
            expect(callArgs.message.cumulativeAmount).toBe(5000000n);
        });

        it('should handle cumulative amounts correctly (voucher is cumulative, not incremental)', async () => {
            const mockWallet = {
                account: { address: PAYER_ADDRESS },
                signTypedData: vi.fn().mockResolvedValue('0xsig' as `0x${string}`),
            } as any;

            // First voucher: 1 USDC
            await signVoucher(mockWallet, {
                channelId: SAMPLE_CHANNEL_ID,
                cumulativeAmount: 1000000n, // 1 USDC
                chainId: SEPOLIA_CHAIN_ID,
                verifyingContract: CHANNEL_ADDRESS,
            });

            // Second voucher: 2 USDC cumulative (not 1 USDC incremental)
            await signVoucher(mockWallet, {
                channelId: SAMPLE_CHANNEL_ID,
                cumulativeAmount: 2000000n, // 2 USDC total
                chainId: SEPOLIA_CHAIN_ID,
                verifyingContract: CHANNEL_ADDRESS,
            });

            expect(mockWallet.signTypedData).toHaveBeenCalledTimes(2);
            const msg1 = mockWallet.signTypedData.mock.calls[0][0].message;
            const msg2 = mockWallet.signTypedData.mock.calls[1][0].message;
            expect(msg1.cumulativeAmount).toBe(1000000n);
            expect(msg2.cumulativeAmount).toBe(2000000n);
        });
    });

    // ============================================================
    // Type Exports
    // ============================================================

    describe('type exports', () => {
        it('should export VoucherParams type correctly', () => {
            const params: VoucherParams = {
                channelId: SAMPLE_CHANNEL_ID,
                cumulativeAmount: 1000000n,
            };
            expect(params.channelId).toBe(SAMPLE_CHANNEL_ID);
            expect(params.cumulativeAmount).toBe(1000000n);
        });

        it('should export SignedVoucher type correctly', () => {
            const voucher: SignedVoucher = {
                channelId: SAMPLE_CHANNEL_ID,
                cumulativeAmount: 1000000n,
                signature: '0xabcdef' as `0x${string}`,
            };
            expect(voucher.signature).toBe('0xabcdef');
        });

        it('should export ChannelConfig type correctly', () => {
            const config: ChannelConfig = {
                payee: PAYEE_ADDRESS,
                token: TOKEN_ADDRESS,
                deposit: 10000000n, // 10 USDC
                salt: '0x0000000000000000000000000000000000000000000000000000000000000001' as `0x${string}`,
                authorizedSigner: PAYER_ADDRESS,
            };
            expect(config.deposit).toBe(10000000n);
            expect(config.payee).toBe(PAYEE_ADDRESS);
        });
    });
});
