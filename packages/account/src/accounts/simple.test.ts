import { describe, it, expect, vi } from 'vitest';
import { toSimpleSmartAccount } from './simple.js';
import { type Address } from 'viem';

describe('SimpleSmartAccount', () => {
    const MOCK_OWNER = {
        address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as Address,
        signMessage: vi.fn().mockResolvedValue('0xsignature'),
        signTypedData: vi.fn(),
    };
    const MOCK_FACTORY = '0x1111111111111111111111111111111111111111' as Address;
    const MOCK_SMART_ACCOUNT = '0x2222222222222222222222222222222222222222' as Address;
    const MOCK_EP = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789' as Address;

    it('should create simple smart account wrapper', async () => {
        const mockClient = {
            readContract: vi.fn().mockResolvedValue(MOCK_SMART_ACCOUNT),
            chain: { id: 31337 }
        };

        const account = await toSimpleSmartAccount({
            client: mockClient,
            owner: MOCK_OWNER as any,
            factoryAddress: MOCK_FACTORY,
            entryPoint: { address: MOCK_EP, version: '0.6' }
        });

        expect(account.address).toBe(MOCK_SMART_ACCOUNT);
        expect(account.entryPoint).toBe(MOCK_EP);
        
        const initCode = await account.getInitCode();
        expect(initCode.startsWith(MOCK_FACTORY)).toBe(true);
        
        const dummy = await account.getDummySignature();
        expect(dummy).toBeDefined();
    });

    it('should sign user operation', async () => {
        const mockClient = {
            readContract: vi.fn().mockResolvedValue(MOCK_SMART_ACCOUNT),
            chain: { id: 31337 }
        };
        const account = await toSimpleSmartAccount({
            client: mockClient,
            owner: MOCK_OWNER as any,
            factoryAddress: MOCK_FACTORY,
            entryPoint: { address: MOCK_EP, version: '0.6' }
        });

        const userOp = {
            sender: MOCK_SMART_ACCOUNT,
            nonce: 0n,
            initCode: '0x',
            callData: '0x',
            accountGasLimits: '0x0000000000000000000000000000000000000000000000000000000000000000',
            preVerificationGas: 0n,
            gasFees: '0x0000000000000000000000000000000000000000000000000000000000000000',
            paymasterAndData: '0x'
        };

        const sig = await account.signUserOperation(userOp);
        expect(sig).toBe('0xsignature');
        expect(MOCK_OWNER.signMessage).toHaveBeenCalled();
    });

    it('should sign message and typed data', async () => {
        const mockClient = { readContract: vi.fn().mockResolvedValue(MOCK_SMART_ACCOUNT) };
        const account = await toSimpleSmartAccount({
            client: mockClient,
            owner: MOCK_OWNER as any,
            factoryAddress: MOCK_FACTORY,
            entryPoint: { address: MOCK_EP, version: '0.6' }
        });

        await account.signMessage({ message: 'hello' });
        expect(MOCK_OWNER.signMessage).toHaveBeenCalled();

        await account.signTypedData({} as any);
        expect(MOCK_OWNER.signTypedData).toHaveBeenCalled();
    });

    it('should throw on signTransaction', async () => {
        const mockClient = { readContract: vi.fn().mockResolvedValue(MOCK_SMART_ACCOUNT) };
        const account = await toSimpleSmartAccount({
            client: mockClient,
            owner: MOCK_OWNER as any,
            factoryAddress: MOCK_FACTORY,
            entryPoint: { address: MOCK_EP, version: '0.6' }
        });

        await expect(account.signTransaction({})).rejects.toThrow('UserOperations');
    });
});
