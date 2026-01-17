import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CommunityClient } from '../src/CommunityClient';
import { createMockPublicClient, createMockWalletClient, resetMocks } from './mocks/client';
import { parseEther } from 'viem';

// Define mocks using vi.hoisted to ensure they are available for vi.mock
const mocks = vi.hoisted(() => {
  const mockXPNTsFactory = { createToken: vi.fn() };
  const mockRegistry = { ROLE_COMMUNITY: vi.fn(), registerRoleSelf: vi.fn() };
  const mockToken = { allowance: vi.fn(), approve: vi.fn(), transferOwnership: vi.fn() };
  const mockSBT = { airdropMint: vi.fn(), burnSBT: vi.fn() };
  const mockReputation = { setReputationRule: vi.fn() };

  return {
    mockXPNTsFactory,
    mockRegistry,
    mockToken,
    mockSBT,
    mockReputation,
    // The actions typically return a function that accepts the client and returns the methods
    // xPNTsFactoryActions(addr)(client).createToken(...)
    mockXPNTsFactoryActions: vi.fn(() => () => mockXPNTsFactory),
    mockRegistryActions: vi.fn(() => () => mockRegistry),
    mockTokenActions: vi.fn(() => () => mockToken),
    mockSBTActions: vi.fn(() => () => mockSBT),
    mockReputationActions: vi.fn(() => () => mockReputation),
  };
});

vi.mock('@aastar/core', async () => {
  const actual = await vi.importActual('@aastar/core');
  return {
    ...actual,
    xPNTsFactoryActions: mocks.mockXPNTsFactoryActions,
    registryActions: mocks.mockRegistryActions,
    tokenActions: mocks.mockTokenActions,
    sbtActions: mocks.mockSBTActions,
    reputationActions: mocks.mockReputationActions,
  };
});

describe('CommunityClient', () => {
  let client: CommunityClient;
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
    // Required by BaseClient
    client: mockWalletClient as any,
    registryAddress: '0xRegistryAddress' as `0x${string}`,
    gTokenAddress: '0xGTokenAddress' as `0x${string}`,
    gTokenStakingAddress: '0xStakingAddress' as `0x${string}`,
    // Required by CommunityClient
    sbtAddress: '0xSBTAddress' as `0x${string}`,
    factoryAddress: '0xFactoryAddress' as `0x${string}`,
    reputationAddress: '0xReputationAddress' as `0x${string}`,
  };

  beforeEach(() => {
    resetMocks();
    vi.clearAllMocks();
    
    // Setup default successful mocks
    mocks.mockRegistry.ROLE_COMMUNITY.mockResolvedValue(100n);
    mocks.mockToken.allowance.mockResolvedValue(parseEther('100'));
    mocks.mockXPNTsFactory.createToken.mockResolvedValue('0xTxHash');
    mocks.mockRegistry.registerRoleSelf.mockResolvedValue('0xTxHash');
    mocks.mockSBT.airdropMint.mockResolvedValue('0xTxHash');
    mocks.mockSBT.burnSBT.mockResolvedValue('0xTxHash');
    mocks.mockReputation.setReputationRule.mockResolvedValue('0xTxHash');
    mocks.mockToken.transferOwnership.mockResolvedValue('0xTxHash');

    client = new CommunityClient(config);
    (client as any).client = mockWalletClient;
    (client as any).publicClient = mockPublicClient;
  });

  describe('createCommunityToken', () => {
    it('should successfully create a token', async () => {
      const result = await client.createCommunityToken({
        name: 'Test Token',
        tokenSymbol: 'TEST'
      });
      
      expect(mocks.mockXPNTsFactoryActions).toHaveBeenCalledWith(config.factoryAddress);
      expect(mocks.mockXPNTsFactory.createToken).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Test Token',
        symbol: 'TEST',
        community: expect.stringContaining('0x000') 
      }));
      expect(result).toBe('0xTxHash');
    });

    it('should throw if factoryAddress is missing', async () => {
      client.factoryAddress = undefined;
      await expect(client.createCommunityToken({ name: 'T', tokenSymbol: 'T' }))
        .rejects.toThrow('Factory address required');
    });

    it('should propagate core errors', async () => {
      mocks.mockXPNTsFactory.createToken.mockRejectedValue(new Error('Core Error'));
      await expect(client.createCommunityToken({ name: 'T', tokenSymbol: 'T' }))
        .rejects.toThrow('Core Error');
    });
  });

  describe('registerAsCommunity', () => {
    it('should register successfully with sufficient allowance', async () => {
      mocks.mockToken.allowance.mockResolvedValue(parseEther('100'));
      
      await client.registerAsCommunity({ name: 'My Community' });
      
      expect(mocks.mockToken.approve).not.toHaveBeenCalled();
      expect(mocks.mockRegistry.registerRoleSelf).toHaveBeenCalledWith(expect.objectContaining({
        roleId: 100n
      }));
    });

    it('should approve if allowance is insufficient', async () => {
      mocks.mockToken.allowance.mockResolvedValue(0n); 
      mocks.mockToken.approve.mockResolvedValue('0xApproveHash');
      
      await client.registerAsCommunity({ name: 'My Community' });
      
      expect(mocks.mockToken.approve).toHaveBeenCalled();
      expect(mockPublicClient.waitForTransactionReceipt).toHaveBeenCalledWith({ hash: '0xApproveHash' });
      expect(mocks.mockRegistry.registerRoleSelf).toHaveBeenCalled();
    });
  });

  describe('airdropSBT', () => {
    it('should airdrop to a single user', async () => {
      const user = '0xUser' as `0x${string}`;
      await client.airdropSBT([user], 1n);
      
      expect(mocks.mockSBTActions).toHaveBeenCalledWith(config.sbtAddress);
      expect(mocks.mockSBT.airdropMint).toHaveBeenCalledWith(expect.objectContaining({
        to: user,
        tokenURI: ''
      }));
    });

    it('should throw if sbtAddress is missing', async () => {
      client.sbtAddress = undefined;
      await expect(client.airdropSBT(['0xUser'], 1n))
        .rejects.toThrow('SBT address required');
    });

    it('should throw if multiple users provided (not implemented)', async () => {
      await expect(client.airdropSBT(['0xU1', '0xU2'], 1n))
        .rejects.toThrow('Batch airdrop not fully implemented');
    });
  });

  describe('setReputationRule', () => {
    it('setReputationRule should call reputation setReputationRule', async () => {
        await client.setReputationRule(1n, {});
        expect(mocks.mockReputationActions).toHaveBeenCalledWith(config.reputationAddress);
        // Mock passes ruleId as hex because implementation converts it
        expect(mocks.mockReputation.setReputationRule).toHaveBeenCalledWith(expect.objectContaining({
            ruleId: '0x0000000000000000000000000000000000000000000000000000000000000001'
        }));
    });

    it('should throw if reputationAddress is missing', async () => {
      client.reputationAddress = undefined;
      await expect(client.setReputationRule(1n, {}))
        .rejects.toThrow('Reputation address required');
    });
  });

  describe('revokeMembership', () => {
    it('should burn SBT', async () => {
      await client.revokeMembership(123n);
      expect(mocks.mockSBTActions).toHaveBeenCalledWith(config.sbtAddress);
      expect(mocks.mockSBT.burnSBT).toHaveBeenCalledWith(expect.objectContaining({
        tokenId: 123n
      }));
    });

    it('should throw if sbtAddress is missing', async () => {
      client.sbtAddress = undefined;
      await expect(client.revokeMembership(123n))
        .rejects.toThrow('SBT address required');
    });
  });

  describe('transferCommunityTokenOwnership', () => {
    it('should transfer ownership', async () => {
      await client.transferCommunityTokenOwnership('0xToken', '0x2222222222222222222222222222222222222222');
      expect(mocks.mockTokenActions).toHaveBeenCalled();
      expect(mocks.mockToken.transferOwnership).toHaveBeenCalledWith(expect.objectContaining({
        token: '0xToken',
        newOwner: '0x2222222222222222222222222222222222222222'
      }));
    });
  });
});
