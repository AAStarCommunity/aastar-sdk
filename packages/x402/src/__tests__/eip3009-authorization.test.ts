import { describe, it, expect, vi } from 'vitest';
import { type Address, type Hex } from 'viem';
import {
    EIP3009_TYPES,
    GTOKEN_EIP712_DOMAIN,
    signGTokenTransferWithAuthorization,
    signReceiveWithAuthorization,
    signCancelAuthorization,
    generateNonce,
} from '../eip3009.js';

const TOKEN = '0xbC17B6C319561bcA805981fC2846e4678f9114Cb' as Address;
const ALICE = '0x1111111111111111111111111111111111111111' as Address;
const BOB = '0x2222222222222222222222222222222222222222' as Address;

const makeWalletClient = (account: Address) => ({
    account: { address: account },
    signTypedData: vi.fn().mockResolvedValue('0xsignature'),
});

describe('EIP3009_TYPES', () => {
    it('ReceiveWithAuthorization has the same 6 fields as TransferWithAuthorization', () => {
        const transfer = EIP3009_TYPES.TransferWithAuthorization;
        const receive = EIP3009_TYPES.ReceiveWithAuthorization;
        expect(receive).toHaveLength(transfer.length);
        const fieldNames = (arr: readonly { name: string; type: string }[]) => arr.map(f => f.name);
        expect(fieldNames(receive)).toEqual(fieldNames(transfer));
    });

    it('CancelAuthorization has authorizer + nonce fields', () => {
        const cancel = EIP3009_TYPES.CancelAuthorization;
        expect(cancel).toHaveLength(2);
        expect(cancel[0].name).toBe('authorizer');
        expect(cancel[0].type).toBe('address');
        expect(cancel[1].name).toBe('nonce');
        expect(cancel[1].type).toBe('bytes32');
    });
});

describe('GTOKEN_EIP712_DOMAIN', () => {
    it('has correct name and version for GTokenAuthorization', () => {
        expect(GTOKEN_EIP712_DOMAIN.name).toBe('GToken');
        expect(GTOKEN_EIP712_DOMAIN.version).toBe('1');
    });
});

describe('signGTokenTransferWithAuthorization', () => {
    const BASE_PARAMS = {
        from: ALICE, to: BOB, value: 100n,
        tokenName: 'GToken', tokenVersion: '1',
        chainId: 11155111, verifyingContract: TOKEN,
    };

    it('calls signTypedData with TransferWithAuthorization primaryType for valid window', async () => {
        const wallet = makeWalletClient(ALICE);
        await signGTokenTransferWithAuthorization(wallet as any, {
            ...BASE_PARAMS, validAfter: 0n, validBefore: 299n, nonce: generateNonce(),
        });
        expect(wallet.signTypedData).toHaveBeenCalledWith(expect.objectContaining({
            primaryType: 'TransferWithAuthorization',
            message: expect.objectContaining({ from: ALICE, to: BOB, value: 100n }),
        }));
    });

    it('throws if walletClient has no account', async () => {
        const wallet = { account: undefined, signTypedData: vi.fn() };
        await expect(signGTokenTransferWithAuthorization(wallet as any, {
            ...BASE_PARAMS, validAfter: 0n, validBefore: 299n, nonce: generateNonce(),
        })).rejects.toThrow('WalletClient must have an account');
    });

    it('throws when signer does not match from', async () => {
        const wallet = makeWalletClient(BOB);
        await expect(signGTokenTransferWithAuthorization(wallet as any, {
            ...BASE_PARAMS, validAfter: 0n, validBefore: 299n, nonce: generateNonce(),
        })).rejects.toThrow('does not match from');
    });

    it('throws when validBefore <= validAfter', async () => {
        const wallet = makeWalletClient(ALICE);
        await expect(signGTokenTransferWithAuthorization(wallet as any, {
            ...BASE_PARAMS, validAfter: 100n, validBefore: 100n, nonce: generateNonce(),
        })).rejects.toThrow('validBefore must be greater than validAfter');
    });

    it('throws when authorization window exceeds 300s', async () => {
        const wallet = makeWalletClient(ALICE);
        await expect(signGTokenTransferWithAuthorization(wallet as any, {
            ...BASE_PARAMS, validAfter: 0n, validBefore: 301n, nonce: generateNonce(),
        })).rejects.toThrow('exceeds MAX_AUTH_VALIDITY (300s)');
    });
});

describe('signReceiveWithAuthorization', () => {
    const BASE_PARAMS = {
        from: ALICE, to: BOB, value: 100n,
        tokenName: 'GToken', tokenVersion: '1',
        chainId: 11155111, verifyingContract: TOKEN,
    };

    it('calls signTypedData with ReceiveWithAuthorization primaryType', async () => {
        const wallet = makeWalletClient(ALICE);
        await signReceiveWithAuthorization(wallet as any, {
            ...BASE_PARAMS, validAfter: 0n, validBefore: 299n, nonce: generateNonce(),
        });
        expect(wallet.signTypedData).toHaveBeenCalledWith(expect.objectContaining({
            primaryType: 'ReceiveWithAuthorization',
            message: expect.objectContaining({ from: ALICE, to: BOB, value: 100n }),
        }));
    });

    it('throws if walletClient has no account', async () => {
        const wallet = { account: undefined, signTypedData: vi.fn() };
        await expect(signReceiveWithAuthorization(wallet as any, {
            ...BASE_PARAMS, validAfter: 0n, validBefore: 299n, nonce: generateNonce(),
        })).rejects.toThrow('WalletClient must have an account');
    });

    it('throws when signer does not match from', async () => {
        const wallet = makeWalletClient(ALICE);
        await expect(signReceiveWithAuthorization(wallet as any, {
            ...BASE_PARAMS, from: BOB, validAfter: 0n, validBefore: 299n, nonce: generateNonce(),
        })).rejects.toThrow('does not match from');
    });

    it('throws when validBefore <= validAfter', async () => {
        const wallet = makeWalletClient(BOB);
        await expect(signReceiveWithAuthorization(wallet as any, {
            ...BASE_PARAMS, from: BOB, validAfter: 100n, validBefore: 100n, nonce: generateNonce(),
        })).rejects.toThrow('validBefore must be greater than validAfter');
    });

    it('throws when authorization window exceeds 300s', async () => {
        const wallet = makeWalletClient(BOB);
        await expect(signReceiveWithAuthorization(wallet as any, {
            ...BASE_PARAMS, from: BOB, validAfter: 0n, validBefore: 301n, nonce: generateNonce(),
        })).rejects.toThrow('exceeds MAX_AUTH_VALIDITY (300s)');
    });
});

describe('signCancelAuthorization', () => {
    const BASE_PARAMS = {
        tokenName: 'GToken', tokenVersion: '1',
        chainId: 11155111, verifyingContract: TOKEN,
    };

    it('calls signTypedData with CancelAuthorization primaryType', async () => {
        const wallet = makeWalletClient(ALICE);
        const nonce = generateNonce();
        await signCancelAuthorization(wallet as any, { authorizer: ALICE, nonce, ...BASE_PARAMS });
        expect(wallet.signTypedData).toHaveBeenCalledWith(expect.objectContaining({
            primaryType: 'CancelAuthorization',
            message: { authorizer: ALICE, nonce },
        }));
    });

    it('throws if walletClient has no account', async () => {
        const wallet = { account: undefined, signTypedData: vi.fn() };
        await expect(signCancelAuthorization(wallet as any, {
            authorizer: ALICE, nonce: generateNonce(), ...BASE_PARAMS,
        })).rejects.toThrow('WalletClient must have an account');
    });

    it('throws when signer does not match authorizer', async () => {
        const wallet = makeWalletClient(BOB);
        await expect(signCancelAuthorization(wallet as any, {
            authorizer: ALICE, nonce: generateNonce(), ...BASE_PARAMS,
        })).rejects.toThrow('does not match authorizer');
    });
});
