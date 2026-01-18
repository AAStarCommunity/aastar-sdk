import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProtocolClient } from '../src/ProtocolClient';
import { createMockPublicClient, createMockWalletClient, resetMocks } from './mocks/client';

// Define mocks using vi.hoisted
const mocks = vi.hoisted(() => {
  const mockDVT = { createSlashProposal: vi.fn(), signSlashProposal: vi.fn(), executeSlashWithProof: vi.fn() };
  const mockAggregator = { registerBLSPublicKey: vi.fn() };
  const mockSuperPaymaster = { setProtocolFee: vi.fn(), setTreasury: vi.fn() };
  
  return {
    mockDVT,
    mockAggregator,
    mockSuperPaymaster,
    // Factory functions
    mockDVTActions: vi.fn(() => () => mockDVT),
    mockAggregatorActions: vi.fn(() => () => mockAggregator),
    mockSuperPaymasterActions: vi.fn(() => () => mockSuperPaymaster),
  };
});

vi.mock('@aastar/core', async () => {
  const actual = await vi.importActual('@aastar/core');
  return {
    ...actual,
    dvtActions: mocks.mockDVTActions,
    aggregatorActions: mocks.mockAggregatorActions,
    superPaymasterActions: mocks.mockSuperPaymasterActions,
  };
});

describe('ProtocolClient', () => {
  let client: ProtocolClient;
  const mockPublicClient = createMockPublicClient();
  const mockWalletClient = createMockWalletClient();

  const config = {
    params: {
        chainId: 11155111,
        rpcUrl: 'https://rpc.sepolia.org',
    },
    services: {
        paymasterUrl: 'https://paymaster.example.com',
    },
    client: mockWalletClient as any,
    dvtValidatorAddress: '0x1111111111111111111111111111111111111111' as `0x${string}`,
    blsAggregatorAddress: '0x2222222222222222222222222222222222222222' as `0x${string}`,
    superPaymasterAddress: '0x3333333333333333333333333333333333333333' as `0x${string}`
  };

  beforeEach(() => {
    resetMocks();
    vi.clearAllMocks();

    // Default Resolves
    mocks.mockDVT.createSlashProposal.mockResolvedValue('0xTxHash');
    mocks.mockDVT.signSlashProposal.mockResolvedValue('0xTxHash');
    mocks.mockDVT.executeSlashWithProof.mockResolvedValue('0xTxHash');
    mocks.mockAggregator.registerBLSPublicKey.mockResolvedValue('0xTxHash');
    mocks.mockSuperPaymaster.setProtocolFee.mockResolvedValue('0xTxHash');
    mocks.mockSuperPaymaster.setTreasury.mockResolvedValue('0xTxHash');

    client = new ProtocolClient(config);
    (client as any).client = mockWalletClient;
    (client as any).publicClient = mockPublicClient;
  });

  describe('DVT Proposals', () => {
    it('createProposal should call createSlashProposal', async () => {
      const result = await client.createProposal('0x4444444444444444444444444444444444444444', '0x1234', 'Description');
      
      expect(mocks.mockDVTActions).toHaveBeenCalledWith(config.dvtValidatorAddress);
      expect(mocks.mockDVT.createSlashProposal).toHaveBeenCalledWith(expect.objectContaining({
          operator: '0x4444444444444444444444444444444444444444',
          level: 1,
          reason: 'Description'
      }));
      expect(result).toBe('0xTxHash');
    });

    it('signProposal should call signSlashProposal', async () => {
        await client.signProposal(1n, '0x5555');
        expect(mocks.mockDVT.signSlashProposal).toHaveBeenCalledWith(expect.objectContaining({
            proposalId: 1n,
            signature: '0x5555'
        }));
    });

    it('executeWithProof should call executeSlashWithProof', async () => {
        await client.executeWithProof(1n, ['0x5555']);
        expect(mocks.mockDVT.executeSlashWithProof).toHaveBeenCalledWith(expect.objectContaining({
            proposalId: 1n,
            // proof is mocked inside implementation
        }));
    });
  });

  describe('BLS Management', () => {
      it('registerBLSKey should call registerBLSPublicKey', async () => {
          await client.registerBLSKey('0x123456');
          expect(mocks.mockAggregatorActions).toHaveBeenCalledWith(config.blsAggregatorAddress);
          expect(mocks.mockAggregator.registerBLSPublicKey).toHaveBeenCalledWith(expect.objectContaining({
              publicKey: '0x123456'
          }));
      });

      it('should throw if blsAggregatorAddress missing', async () => {
          client.blsAggregatorAddress = undefined;
          await expect(client.registerBLSKey('0x12')).rejects.toThrow('BLS Aggregator address required');
      });
  });

  describe('Global Params', () => {
      it('setProtocolFee should call superPaymaster', async () => {
          await client.setProtocolFee(100n);
          expect(mocks.mockSuperPaymasterActions).toHaveBeenCalledWith(config.superPaymasterAddress);
          expect(mocks.mockSuperPaymaster.setProtocolFee).toHaveBeenCalledWith(expect.objectContaining({
              newFeeBPS: 100n
          }));
      });

      it('setTreasury should call superPaymaster', async () => {
          await client.setTreasury('0x7777777777777777777777777777777777777777');
          expect(mocks.mockSuperPaymaster.setTreasury).toHaveBeenCalledWith(expect.objectContaining({
              treasury: '0x7777777777777777777777777777777777777777'
          }));
      });

      it('should throw if superPaymasterAddress missing', async () => {
          client.superPaymasterAddress = undefined;
          await expect(client.setTreasury('0x1111111111111111111111111111111111111111')).rejects.toThrow('SuperPaymaster address required');
      });
  });

});
