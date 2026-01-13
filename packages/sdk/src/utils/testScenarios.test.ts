import { describe, it, expect, vi } from 'vitest';
import { UserOpScenarioBuilder, UserOpScenarioType } from './testScenarios.js';
import { type Address, type PublicClient, type Hex, keccak256, encodeAbiParameters, stringToBytes } from 'viem';

describe('UserOpScenarioBuilder', () => {
    it('should build NATIVE transfer scenario', async () => {
        const mockPublicClient = {
            readContract: vi.fn().mockResolvedValue(0n),
            chain: { id: 1 }
        } as any;
        
        const params = {
            sender: '0x0000000000000000000000000000000000000001' as Address,
            ownerAccount: { signMessage: vi.fn().mockResolvedValue('0xsig') },
            recipient: '0x0000000000000000000000000000000000000002' as Address,
            tokenAddress: '0x0000000000000000000000000000000000000003' as Address,
            amount: 100n,
            entryPoint: '0x0000000000000000000000000000000000000004' as Address,
            chainId: 1,
            publicClient: mockPublicClient
        };

        const result = await UserOpScenarioBuilder.buildTransferScenario(UserOpScenarioType.NATIVE, params);
        expect(result.userOp.paymasterAndData).toBe('0x');
        expect(result.userOp.signature).toBe('0xsig');
    });

    it('should build GASLESS_V4 transfer scenario', async () => {
        const mockPublicClient = {
            readContract: vi.fn().mockResolvedValue(0n),
            chain: { id: 1 }
        } as any;
        
        const params = {
            sender: '0x0000000000000000000000000000000000000001' as Address,
            ownerAccount: { signMessage: vi.fn().mockResolvedValue('0xsig') },
            recipient: '0x0000000000000000000000000000000000000002' as Address,
            tokenAddress: '0x0000000000000000000000000000000000000003' as Address,
            amount: 100n,
            entryPoint: '0x0000000000000000000000000000000000000004' as Address,
            chainId: 1,
            publicClient: mockPublicClient,
            paymaster: '0x0000000000000000000000000000000000000005' as Address
        };

        const result = await UserOpScenarioBuilder.buildTransferScenario(UserOpScenarioType.GASLESS_V4, params);
        expect(result.userOp.paymasterAndData).toBeDefined();
        expect(result.userOp.paymasterAndData).not.toBe('0x');
    });

    it('should throw if paymaster missing for v4', async () => {
        const params: any = { publicClient: { readContract: vi.fn() }, sender: '0x0000000000000000000000000000000000000001' };
        await expect(UserOpScenarioBuilder.buildTransferScenario(UserOpScenarioType.GASLESS_V4, params))
            .rejects.toThrow();
    });

    it('should build SUPER_BPNT scenario', async () => {
        const mockPublicClient = {
            readContract: vi.fn().mockResolvedValue(0n),
            chain: { id: 1 }
        } as any;
        
        const params = {
            sender: '0x0000000000000000000000000000000000000001' as Address,
            ownerAccount: { signMessage: vi.fn().mockResolvedValue('0xsig') },
            recipient: '0x0000000000000000000000000000000000000002' as Address,
            tokenAddress: '0x0000000000000000000000000000000000000003' as Address,
            amount: 100n,
            entryPoint: '0x0000000000000000000000000000000000000004' as Address,
            chainId: 1,
            publicClient: mockPublicClient,
            paymaster: '0x0000000000000000000000000000000000000005' as Address,
            operator: '0x0000000000000000000000000000000000000006' as Address
        };

        const result = await UserOpScenarioBuilder.buildTransferScenario(UserOpScenarioType.SUPER_BPNT, params);
        expect(result.userOp.paymasterAndData).toContain('0x');
    });
});
