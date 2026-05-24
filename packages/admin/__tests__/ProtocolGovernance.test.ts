
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProtocolGovernance } from '../src/ProtocolGovernance';
import { createMockPublicClient, createMockWalletClient, resetMocks } from './mocks/client';
import { type Address } from 'viem';

// Define mocks using vi.hoisted
const mocks = vi.hoisted(() => {
  const mockRegistry = {
      setSuperPaymaster: vi.fn(),
      setStaking: vi.fn(),
      getRoleConfig: vi.fn(),
      configureRole: vi.fn(),
      transferOwnership: vi.fn(),
      SUPER_PAYMASTER: vi.fn(),
      GTOKEN_STAKING: vi.fn(),
      owner: vi.fn()
  };
  
  return {
    mockRegistry,
    // Factory functions
    mockRegistryActions: vi.fn(() => () => mockRegistry),
    mockEntryPointActions: vi.fn(() => () => ({})), // Not used heavily yet
  };
});

vi.mock('@aastar/core', async () => {
  const actual = await vi.importActual('@aastar/core');
  return {
    ...actual,
    registryActions: mocks.mockRegistryActions,
    entryPointActions: mocks.mockEntryPointActions,
  };
});

describe('ProtocolGovernance', () => {
  let governance: ProtocolGovernance;
  const mockPublicClient = createMockPublicClient();
  const mockWalletClient = createMockWalletClient();

  const config = {
      // Base Client Config
      params: {
          chainId: 11155111,
          rpcUrl: 'https://rpc.sepolia.org',
      },
      client: mockWalletClient as any,
      
      // Governance specifics
      registryAddress: '0x4444444444444444444444444444444444444444' as Address,
      entryPointAddress: '0x2222222222222222222222222222222222222222' as Address,
  };

  beforeEach(() => {
    resetMocks();
    vi.clearAllMocks();

    // Default Resolves
    mocks.mockRegistry.setSuperPaymaster.mockResolvedValue('0xSetSPHash');
    mocks.mockRegistry.setStaking.mockResolvedValue('0xSetStakingHash');
    mocks.mockRegistry.getRoleConfig.mockResolvedValue({
        minStake: 0n,
        ticketPrice: 0n,
        slashThreshold: 0n,
        slashBase: 0n,
        slashInc: 0n,
        slashMax: 0n,
        exitFeePercent: 0n,
        isActive: true,
        minExitFee: 0n,
        description: '',
        owner: '0x0000000000000000000000000000000000000000',
        roleLockDuration: 0n,
    });
    mocks.mockRegistry.configureRole.mockResolvedValue('0xConfigRoleHash');
    mocks.mockRegistry.transferOwnership.mockResolvedValue('0xTransferHash');
    
    // Getters
    mocks.mockRegistry.SUPER_PAYMASTER.mockResolvedValue('0xSuperPaymaster');
    mocks.mockRegistry.GTOKEN_STAKING.mockResolvedValue('0xStaking');
    mocks.mockRegistry.owner.mockResolvedValue('0xOwner');

    governance = new ProtocolGovernance(config);
    (governance as any).publicClient = mockPublicClient;
  });

  describe('Module Governance', () => {
      it('setSuperPaymaster should call registry', async () => {
          const result = await governance.setSuperPaymaster('0xNewPaymaster');
          
          expect(result).toBe('0xSetSPHash');
          expect(mocks.mockRegistry.setSuperPaymaster).toHaveBeenCalledWith({
              paymaster: '0xNewPaymaster',
              account: undefined
          });
      });

      it('setStaking should call registry', async () => {
          const result = await governance.setStaking('0xNewStaking');
          
          expect(result).toBe('0xSetStakingHash');
          expect(mocks.mockRegistry.setStaking).toHaveBeenCalledWith(expect.objectContaining({
              staking: '0xNewStaking'
          }));
      });
  });

  describe('Role Governance', () => {
      const ROLE_ID = '0x1234567890123456789012345678901234567890123456789012345678901234' as const;

      it('configureRole should read current config then write merged config', async () => {
          const result = await governance.configureRole({
              roleId: ROLE_ID,
              minStake: 100n,
              ticketPrice: 50n,
          });

          expect(result).toBe('0xConfigRoleHash');
          expect(mocks.mockRegistry.getRoleConfig).toHaveBeenCalledWith({ roleId: ROLE_ID });
          expect(mocks.mockRegistry.configureRole).toHaveBeenCalledWith(expect.objectContaining({
              roleId: ROLE_ID,
              config: expect.objectContaining({
                  minStake: 100n,
                  ticketPrice: 50n,
              }),
          }));
      });

      it('configureRole with no overrides should still call configureRole with unchanged values', async () => {
          const result = await governance.configureRole({ roleId: ROLE_ID });

          expect(result).toBe('0xConfigRoleHash');
          expect(mocks.mockRegistry.getRoleConfig).toHaveBeenCalledWith({ roleId: ROLE_ID });
          expect(mocks.mockRegistry.configureRole).toHaveBeenCalledWith(expect.objectContaining({
              roleId: ROLE_ID,
              config: expect.objectContaining({ minStake: 0n }),
          }));
      });
  });

  describe('DAO / Ownership', () => {
      it('transferToDAO should call transferOwnership', async () => {
          const result = await governance.transferToDAO('0xDAOAddress');
          
          expect(result).toBe('0xTransferHash');
          expect(mocks.mockRegistry.transferOwnership).toHaveBeenCalledWith(expect.objectContaining({
              newOwner: '0xDAOAddress'
          }));
      });
  });

  describe('Global Parameters', () => {
      it('setTreasury should throw (not mapped)', async () => {
          await expect(governance.setTreasury('0xTreasury')).rejects.toThrow('Method not mapped');
      });

      it('updateEntryPoint should throw (not mapped)', async () => {
          await expect(governance.updateEntryPoint('0xEP')).rejects.toThrow('Method not mapped');
      });
  });

  describe('Query', () => {
      it('getProtocolParams should fetch from registry', async () => {
          const params = await governance.getProtocolParams();
          
          expect(params.superPaymaster).toBe('0xSuperPaymaster');
          // expect(params.treasury).toBe('0xOwner'); // Based on current approximation implementation
          expect(params.entryPoint).toBe(config.entryPointAddress);
      });
  });
});
