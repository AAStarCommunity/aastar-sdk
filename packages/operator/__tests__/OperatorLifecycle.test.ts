import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OperatorLifecycle } from '../src/OperatorLifecycle';
import { createMockPublicClient, createMockWalletClient, resetMocks } from './mocks/client';
import { parseEther } from 'viem';

// Define mocks using vi.hoisted
const mocks = vi.hoisted(() => {
  const mockToken = { transfer: vi.fn(), balanceOf: vi.fn(), allowance: vi.fn(), approve: vi.fn() };
  
  const mockStaking = { lockStake: vi.fn(), unlockAndTransfer: vi.fn(), getLockedStake: vi.fn(), withdrawStake: vi.fn() };
  const mockPaymaster = { 
      registerPaymaster: vi.fn(),
      addStake: vi.fn(), 
      deposit: vi.fn(),
      setSigner: vi.fn(),
      withdrawTo: vi.fn()
  };
  const mockRegistry = { 
    registerRoleSelf: vi.fn(), 
    hasRole: vi.fn(), 
    isOperator: vi.fn(), 
    ROLE_PAYMASTER_SUPER: vi.fn().mockResolvedValue('0xRoleSuper'),
    exitRole: vi.fn().mockResolvedValue('0xExitHash')
  };
  
  const mockSuperPaymaster = {
      unlockStake: vi.fn().mockResolvedValue('0xUnstakeHash'),
      withdrawStake: vi.fn().mockResolvedValue('0xWithdrawHash'),
      operators: vi.fn().mockResolvedValue({ isConfigured: true, aPNTsBalance: 100n })
  };

  return {
    mockToken,
    mockStaking,
    mockPaymaster,
    mockSuperPaymaster,
    mockRegistry,
    // Factory functions
    mockTokenActions: vi.fn(() => () => mockToken),
    mockStakingActions: vi.fn(() => () => mockStaking),
    mockPaymasterActions: vi.fn(() => () => mockPaymaster),
    mockSuperPaymasterActions: vi.fn(() => () => mockSuperPaymaster),
    mockRegistryActions: vi.fn(() => () => mockRegistry),
  };
});

vi.mock('@aastar/core', async () => {
  const actual = await vi.importActual('@aastar/core');
  return {
    ...actual,
    tokenActions: mocks.mockTokenActions,
    stakingActions: mocks.mockStakingActions,
    paymasterActions: mocks.mockPaymasterActions,
    superPaymasterActions: mocks.mockSuperPaymasterActions,
    registryActions: mocks.mockRegistryActions,
  };
});

describe('OperatorLifecycle', () => {
  let lifecycle: OperatorLifecycle;
  const mockPublicClient = createMockPublicClient();
  const mockWalletClient = createMockWalletClient();

  const config = {
      // OperatorClientConfig
      params: {
          chainId: 11155111,
          rpcUrl: 'https://rpc.sepolia.org',
      },
      client: mockWalletClient as any,
      
      // Paymaster specifics
      paymasterAddress: '0x9999999999999999999999999999999999999999' as `0x${string}`,
      paymasterType: 'V4' as const,
      entryPointAddress: '0x2222222222222222222222222222222222222222' as `0x${string}`,
      superPaymasterAddress: '0x8888888888888888888888888888888888888888' as `0x${string}`,
      ownerAddress: '0x1234567890123456789012345678901234567890' as `0x${string}`,
  };

  beforeEach(() => {
    resetMocks();
    vi.clearAllMocks();

    mocks.mockToken.balanceOf.mockResolvedValue(parseEther('1000'));
    mocks.mockToken.allowance.mockResolvedValue(parseEther('1000'));
    mocks.mockToken.approve.mockResolvedValue('0xTxHash');
    
    mocks.mockStaking.lockStake.mockResolvedValue('0xTxHash');
    mocks.mockStaking.unlockAndTransfer.mockResolvedValue('0xTxHash');
    
    mocks.mockPaymaster.addStake.mockResolvedValue('0xTxHash');
    mocks.mockPaymaster.deposit.mockResolvedValue('0xTxHash');
    
    mocks.mockRegistry.isOperator.mockResolvedValue(false);
    mocks.mockSuperPaymaster.unlockStake.mockResolvedValue('0xUnstakeHash');

    lifecycle = new OperatorLifecycle(config);
    (lifecycle as any).publicClient = mockPublicClient;
    (lifecycle as any).tokenAddress = '0x5555555555555555555555555555555555555555';
  });

  describe('Check Readiness', () => {
      it('checkReadiness should return correct status', async () => {
          mocks.mockRegistry.isOperator.mockResolvedValue(true);
          mocks.mockSuperPaymaster.operators.mockResolvedValue({ isConfigured: true, aPNTsBalance: parseEther('500') });
          mocks.mockToken.balanceOf.mockResolvedValue(parseEther('500')); // Keeps it but irrelevant for result

          const status = await lifecycle.checkReadiness();

          expect(status.isConfigured).toBe(true);
          expect(status.isActive).toBe(true);
          expect(status.balance).toBe(parseEther('500'));
      });
  });

  describe('Setup Phase', () => {
      it('setupNode (V4) should deploy and register', async () => {
          const spyDeploy = vi.spyOn(lifecycle, 'deployAndRegisterPaymasterV4')
              .mockResolvedValue({ 
                  deployHash: '0xDeploy', 
                  registerHash: '0xRegister',
                  paymasterAddress: '0xPaymaster' 
              });

          const hashes = await lifecycle.setupNode({ type: 'V4', stakeAmount: 100n });

          expect(hashes).toEqual(['0xDeploy', '0xRegister']);
          expect(spyDeploy).toHaveBeenCalledWith({ stakeAmount: 100n }, undefined);
      });

      it('setupNode (SUPER) should register as super operator', async () => {
          const spyRegisterSuper = vi.spyOn(lifecycle, 'registerAsSuperPaymasterOperator')
              .mockResolvedValue('0xSuperTx');

          const hashes = await lifecycle.setupNode({ 
              type: 'SUPER', 
              stakeAmount: 100n, 
              depositAmount: 50n 
          });

          expect(hashes).toEqual(['0xSuperTx']);
          expect(spyRegisterSuper).toHaveBeenCalledWith({
              stakeAmount: 100n,
              depositAmount: 50n
          }, undefined);
      });
  });

  describe('Exit Phase', () => {
      it('initiateExit should call super.initiateExit (unlockStake)', async () => {
          const spyWithdrawStake = vi.spyOn(lifecycle, 'withdrawStake').mockResolvedValue('0xUnstakeHash');
          
          const hash = await lifecycle.initiateExit();

           expect(hash).toBe('0xUnstakeHash');
           expect(mocks.mockSuperPaymaster.unlockStake).toHaveBeenCalled();
      });

      it('withdrawAllFunds should withdraw collateral and exit role', async () => {
           mocks.mockRegistry.hasRole.mockResolvedValue(true);
           mocks.mockSuperPaymaster.operators.mockResolvedValue({ isConfigured: true, aPNTsBalance: 50n });
           
           const spyWithdrawCollateral = vi.spyOn(lifecycle, 'withdrawCollateral' as any).mockResolvedValue('0xCollateralHash');
           
           const hashes = await lifecycle.withdrawAllFunds('0xRecipient');

           expect(hashes).toContain('0xCollateralHash');
           expect(hashes).toContain('0xExitHash');
           expect(mocks.mockRegistry.exitRole).toHaveBeenCalled();
      });
  });

});
