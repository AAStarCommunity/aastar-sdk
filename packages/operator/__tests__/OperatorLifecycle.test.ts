
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OperatorLifecycle, OperatorStatus } from '../src/OperatorLifecycle';
import { createMockPublicClient, createMockWalletClient, resetMocks } from './mocks/client';
import { parseEther } from 'viem';

// Define mocks using vi.hoisted
const mocks = vi.hoisted(() => {
  const mockToken = { transfer: vi.fn(), balanceOf: vi.fn(), allowance: vi.fn(), approve: vi.fn() };
  // Mock implementations for PaymasterOperatorClient methods that are not strictly actions but usage of actions
  // Actually, OperatorLifecycle EXTENDS PaymasterOperatorClient.
  // We need to verify OperatorLifecycle methods call super methods or added logic.
  // Since we are mocking modules, we can mock the actions that super class uses.
  
  // PaymasterOperatorClient uses:
  // - paymasterActions
  // - stakingActions
  // - registryActions
  // - tokenActions
  const mockStaking = { lockStake: vi.fn(), unlockAndTransfer: vi.fn(), getLockedStake: vi.fn(), withdrawStake: vi.fn() };
  const mockPaymaster = { 
      registerPaymaster: vi.fn(),
      addStake: vi.fn(), 
      deposit: vi.fn(),
      setSigner: vi.fn(),
      withdrawTo: vi.fn()
  };
  const mockRegistry = { registerRoleSelf: vi.fn(), hasRole: vi.fn(), isOperator: vi.fn() };
  
  const mockSuperPaymaster = {
      unlockStake: vi.fn().mockResolvedValue('0xUnstakeHash'),
      withdrawStake: vi.fn().mockResolvedValue('0xWithdrawHash'),
      operators: vi.fn().mockResolvedValue({ isConfigured: true })
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
      superPaymasterAddress: '0x8888888888888888888888888888888888888888' as `0x${string}`, // Added required field
      
      // Required by PaymasterOperatorClient base
      ownerAddress: '0x1234567890123456789012345678901234567890' as `0x${string}`,
  };

  beforeEach(() => {
    resetMocks();
    vi.clearAllMocks();

    // Default Resolves
    mocks.mockToken.balanceOf.mockResolvedValue(parseEther('1000'));
    mocks.mockToken.allowance.mockResolvedValue(parseEther('1000'));
    mocks.mockToken.approve.mockResolvedValue('0xTxHash');
    
    mocks.mockStaking.lockStake.mockResolvedValue('0xTxHash');
    mocks.mockStaking.unlockAndTransfer.mockResolvedValue('0xTxHash');
    mocks.mockStaking.withdrawStake.mockResolvedValue('0xTxHash'); // Base client might use this?
    
    mocks.mockPaymaster.addStake.mockResolvedValue('0xTxHash');
    mocks.mockPaymaster.deposit.mockResolvedValue('0xTxHash');
    
    // Registry mocks
    mocks.mockRegistry.isOperator.mockResolvedValue(false);
    
    // SuperPaymaster mocks reset (since stable object)
    mocks.mockSuperPaymaster.unlockStake.mockResolvedValue('0xUnstakeHash');

    lifecycle = new OperatorLifecycle(config);
    // Inject mock public client
    (lifecycle as any).publicClient = mockPublicClient;
    // Inject token address usually fetched or config
    (lifecycle as any).tokenAddress = '0x5555555555555555555555555555555555555555';
  });

  describe('Check Readiness', () => {
      it('checkReadiness should return correct status', async () => {
          mocks.mockRegistry.isOperator.mockResolvedValue(true);
          mocks.mockToken.balanceOf.mockResolvedValue(parseEther('500'));

          const status = await lifecycle.checkReadiness();

          expect(status.isConfigured).toBe(true);
          expect(status.isActive).toBe(true);
          expect(status.balance).toBe(parseEther('500'));
      });
  });

  describe('Setup Phase', () => {
      it('setupNode (V4) should deploy and register', async () => {
          // PaymasterOperatorClient.deployAndRegisterPaymasterV4 is complex. 
          // It calls `deployPaymasterV4` and then `registerPaymaster`.
          // We need to mock the SUPER calls or the underlying actions.
          
          // Since we are mocking the module actions, verify those are called.
          // BUT `deployAndRegisterPaymasterV4` might be implemented in `PaymasterOperatorClient`
          // which is the parent. If we didn't mock the parent class explicitly, 
          // `setupNode` calls `this.deployAndRegisterPaymasterV4`.
          
          // Let's spy on the parent method if we want to confirm `setupNode` delegates correctly,
          // OR let the parent method run and verify mock actions.
          
          // Option A: Spy on parent method.
          // Verify delegation to parent method
          const spyDeploy = vi.spyOn(lifecycle, 'deployAndRegisterPaymasterV4')
              .mockResolvedValue({ 
                  deployHash: '0xDeploy', 
                  registerHash: '0xRegister',
                  paymasterAddress: '0xPaymaster' // Added required field
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
          // We can spy on the parent's initiateExit if we want to avoid testing parent logic again, 
          // but `super` calls in JS are hard to spy on independently of `this`.
          // Instead, we verify the underlying action `staking.unlockAndTransfer` or similar is called.
          
          // PaymasterOperatorClient.initiateExit likely calls `paymasterActions().withdrawStake` or similar? 
          // Or calls `unlockStake`. 
          // Let's assume it calls `stakingActions().unlockStake` or `paymasterActions().withdrawStake`.
          
          // NOTE: OperatorLifecycle.ts comment says:
          // "// 1. Unlock Stake from SuperPaymaster (if applicable) -> super.initiateExit(options)"
          
          // If we assume super.initiateExit calls stakingActions unlock, we test that.
          // Let's spy on the prototype to be sure we are calling it? No, just check effects.
          
          // Mock PaymasterClient implementations often use `withdrawStake` on the Paymaster contract itself (EP logic).
          mocks.mockPaymaster.withdrawTo.mockResolvedValue('0xTxHash'); // Might be used.
          // Or `stakingActions` unlock.
          
          // Actually, let's spy on the `withdrawStake` method of the instance, assuming it exists on parent.
          const spyWithdrawStake = vi.spyOn(lifecycle, 'withdrawStake').mockResolvedValue('0xUnstakeHash');

          // We expect superPaymasterActions().unlockStake to be called because parent calls it.
          // Since we return a stable mock object from the factory, we can check it.
          
          const hash = await lifecycle.initiateExit();

           expect(hash).toBe('0xUnstakeHash');
           expect(mocks.mockSuperPaymaster.unlockStake).toHaveBeenCalled();
      });

      it('withdrawAllFunds should withdraw stake and potentially clean up', async () => {
           const spyWithdrawStake = vi.spyOn(lifecycle, 'withdrawStake').mockResolvedValue('0xWithdrawHash');
           
           const hashes = await lifecycle.withdrawAllFunds('0xRecipient');

           expect(hashes).toContain('0xWithdrawHash');
           expect(spyWithdrawStake).toHaveBeenCalledWith('0xRecipient', undefined);
      });
  });

});
