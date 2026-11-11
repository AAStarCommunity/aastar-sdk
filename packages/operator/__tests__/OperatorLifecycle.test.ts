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
  
  const mockWithdrawal = {
      withdrawalStatus: vi.fn(),
      requestWithdraw: vi.fn().mockResolvedValue('0xRequestHash'),
      executeWithdraw: vi.fn().mockResolvedValue('0xWithdrawHash551'),
      cancelWithdraw: vi.fn(),
  };
  const mockSuperPaymaster = {
      withdraw: vi.fn().mockResolvedValue('0xWithdraw542'),
      withdrawTo: vi.fn().mockResolvedValue('0xWRONG_withdrawTo'),
      unlockStake: vi.fn().mockResolvedValue('0xUnstakeHash'),
      withdrawStake: vi.fn().mockResolvedValue('0xWithdrawHash'),
      operators: vi.fn().mockResolvedValue({ isConfigured: true, aPNTsBalance: 100n })
  };

  return {
    mockToken,
    mockStaking,
    mockPaymaster,
    mockSuperPaymaster,
    mockWithdrawal,
    mockRegistry,
    // Factory functions
    mockTokenActions: vi.fn(() => () => mockToken),
    mockStakingActions: vi.fn(() => () => mockStaking),
    mockPaymasterActions: vi.fn(() => () => mockPaymaster),
    mockSuperPaymasterActions: vi.fn(() => () => mockSuperPaymaster),
    mockWithdrawalActions: vi.fn(() => () => mockWithdrawal),
    mockResolveMode: vi.fn(),
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
    superPaymasterWithdrawalActions: mocks.mockWithdrawalActions,
    resolveSuperPaymasterWithdrawalMode: mocks.mockResolveMode,
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

      // The mode comes from the read-back-verified pin (resolveSuperPaymasterWithdrawalMode, tested in core).
      const asVersion = (v: string) => mocks.mockResolveMode.mockResolvedValue(
          v === 'SuperPaymaster-5.4.2' ? { mode: 'one-call', version: v, source: 'pre-cutover' } : { mode: 'two-step', version: v, source: 'pin' });
      // Mirrors core's withdrawalStatus: phase from amount / readyAt / now, window = 24 h.
      const statusOf = (o: Partial<{ amount: bigint; readyAt: bigint; balance: bigint; now: bigint }>) => {
          const v = { amount: 0n, readyAt: 0n, balance: 50n, now: 100n, ...o };
          const expiresAt = v.amount > 0n ? v.readyAt + 86_400n : 0n;
          const phase = v.amount === 0n ? 'none' : v.now < v.readyAt ? 'waiting' : v.now <= expiresAt ? 'open' : 'expired';
          return { ...v, available: v.balance, escrowed: v.amount, expiresAt, phase, matured: phase === 'open', expired: phase === 'expired', slashQueued: false };
      };
      const status = (o: Partial<{ amount: bigint; readyAt: bigint; balance: bigint; now: bigint }>) =>
          mocks.mockWithdrawal.withdrawalStatus.mockResolvedValue(statusOf(o));

      it('the old withdrawCollateral path is gone, and nothing on the exit path calls withdrawTo', async () => {
          // withdrawCollateral(to, amount) called SuperPaymaster.withdrawTo: BasePaymaster's owner-only
          // EntryPoint ETH-deposit withdrawal, not the operator's aPNTs.
          expect((lifecycle as any).withdrawCollateral).toBeUndefined();
          mocks.mockRegistry.hasRole.mockResolvedValue(true);
          mocks.mockSuperPaymaster.operators.mockResolvedValue({ isConfigured: true, aPNTsBalance: 50n });
          for (const v of ['SuperPaymaster-5.4.2', 'SuperPaymaster-5.5.1']) {
              asVersion(v); status({ amount: 50n, readyAt: 90n, balance: 0n });
              await lifecycle.withdrawAllFunds();
          }
          expect(mocks.mockSuperPaymaster.withdrawTo).not.toHaveBeenCalled();
      });

      it('5.4.2: withdraws the collateral in one call (withdraw, not withdrawTo) and exits the role', async () => {
          asVersion('SuperPaymaster-5.4.2');
          mocks.mockRegistry.hasRole.mockResolvedValue(true);
          mocks.mockSuperPaymaster.operators.mockResolvedValue({ isConfigured: true, aPNTsBalance: 50n });
          const hashes = await lifecycle.withdrawAllFunds();
          expect(mocks.mockSuperPaymaster.withdraw).toHaveBeenCalledWith(expect.objectContaining({ amount: 50n }));
          expect(hashes).toEqual(['0xWithdraw542', '0xExitHash']);
      });

      it('5.5.1, no request yet: requests the whole balance and stops; the role exit waits', async () => {
          asVersion('SuperPaymaster-5.5.1'); status({});
          mocks.mockRegistry.hasRole.mockResolvedValue(true);
          mocks.mockSuperPaymaster.operators.mockResolvedValue({ isConfigured: true, aPNTsBalance: 50n });
          const hashes = await lifecycle.withdrawAllFunds();
          expect(mocks.mockWithdrawal.requestWithdraw).toHaveBeenCalledWith(expect.objectContaining({ amount: 50n }));
          expect(hashes).toEqual(['0xRequestHash']);
          expect(mocks.mockRegistry.exitRole).not.toHaveBeenCalled();
      });

      it('5.5.1, request not matured: throws naming the maturity, sends nothing', async () => {
          asVersion('SuperPaymaster-5.5.1'); status({ amount: 50n, readyAt: 200n, now: 100n, balance: 0n });
          mocks.mockSuperPaymaster.operators.mockResolvedValue({ isConfigured: true, aPNTsBalance: 0n });
          await expect(lifecycle.withdrawAllFunds()).rejects.toThrow(/matures at 200 and stays open until 86600 \(now 100\)/);
          expect(mocks.mockWithdrawal.executeWithdraw).not.toHaveBeenCalled();
          expect(mocks.mockRegistry.exitRole).not.toHaveBeenCalled();
      });

      it('5.5.1, the whole collateral in escrow and the window open: withdraws it, then exits the role', async () => {
          // aPNTsBalance is 0: the request moved it all into escrow. A balance-only check would skip the withdraw.
          asVersion('SuperPaymaster-5.5.1'); status({ amount: 50n, readyAt: 90n, now: 100n, balance: 0n });
          mocks.mockRegistry.hasRole.mockResolvedValue(true);
          mocks.mockSuperPaymaster.operators.mockResolvedValue({ isConfigured: true, aPNTsBalance: 0n });
          const hashes = await lifecycle.withdrawAllFunds();
          expect(hashes).toEqual(['0xWithdrawHash551', '0xExitHash']);
      });

      it('5.5.1, escrow withdrawn but balance left over: withdraws the escrow and does not exit yet', async () => {
          asVersion('SuperPaymaster-5.5.1'); status({ amount: 20n, readyAt: 90n, balance: 30n });
          mocks.mockRegistry.hasRole.mockResolvedValue(true);
          mocks.mockSuperPaymaster.operators.mockResolvedValue({ isConfigured: true, aPNTsBalance: 30n });
          expect(await lifecycle.withdrawAllFunds()).toEqual(['0xWithdrawHash551']);
          expect(mocks.mockRegistry.exitRole).not.toHaveBeenCalled();
      });

      it('5.5.1, window closed (WithdrawalExpired): cancels, re-requests the restored balance, does not withdraw or exit', async () => {
          asVersion('SuperPaymaster-5.5.1');
          mocks.mockWithdrawal.cancelWithdraw.mockResolvedValue('0xCancelHash');
          mocks.mockWithdrawal.withdrawalStatus
              .mockResolvedValueOnce(statusOf({ amount: 50n, readyAt: 0n, now: 86_401n, balance: 0n }))
              .mockResolvedValueOnce(statusOf({ amount: 0n, now: 86_402n, balance: 45n })); // slashed by 5 meanwhile
          mocks.mockRegistry.hasRole.mockResolvedValue(true);
          mocks.mockSuperPaymaster.operators.mockResolvedValue({ isConfigured: true, aPNTsBalance: 0n });
          // The cancel's receipt is held back: nothing may be re-read or requested until it resolves (Codex on #433).
          let mine!: (r: { status: string }) => void;
          mockPublicClient.waitForTransactionReceipt.mockReturnValueOnce(new Promise((r) => { mine = r; }));
          const run = lifecycle.withdrawAllFunds();
          await vi.waitFor(() => expect(mockPublicClient.waitForTransactionReceipt).toHaveBeenCalledWith({ hash: '0xCancelHash' }));
          await new Promise((r) => setTimeout(r, 20));
          expect(mocks.mockWithdrawal.withdrawalStatus).toHaveBeenCalledTimes(1);
          expect(mocks.mockWithdrawal.requestWithdraw).not.toHaveBeenCalled();
          mine({ status: 'success' });
          expect(await run).toEqual(['0xCancelHash', '0xRequestHash']);
          expect(mocks.mockWithdrawal.withdrawalStatus).toHaveBeenCalledTimes(2);
          expect(mocks.mockWithdrawal.requestWithdraw).toHaveBeenCalledWith(expect.objectContaining({ amount: 45n }));
          expect(mocks.mockWithdrawal.executeWithdraw).not.toHaveBeenCalled();
          expect(mocks.mockRegistry.exitRole).not.toHaveBeenCalled();
      });

      it('5.5.1, window closed with a reader that cannot wait for receipts: refuses before sending the cancel', async () => {
          asVersion('SuperPaymaster-5.5.1');
          mocks.mockWithdrawal.withdrawalStatus.mockResolvedValue(statusOf({ amount: 50n, readyAt: 0n, now: 86_401n, balance: 0n }));
          mocks.mockSuperPaymaster.operators.mockResolvedValue({ isConfigured: true, aPNTsBalance: 0n });
          const wait = mockPublicClient.waitForTransactionReceipt;
          (mockPublicClient as any).waitForTransactionReceipt = undefined;
          try {
              await expect(lifecycle.withdrawAllFunds()).rejects.toThrow(/needs a client that can wait for the cancel receipt/);
          } finally { (mockPublicClient as any).waitForTransactionReceipt = wait; }
          expect(mocks.mockWithdrawal.cancelWithdraw).not.toHaveBeenCalled();
      });

      it('5.5.1, window closed but the cancel reverts: stops, requests nothing', async () => {
          asVersion('SuperPaymaster-5.5.1');
          mocks.mockWithdrawal.cancelWithdraw.mockResolvedValue('0xCancelHash');
          mocks.mockWithdrawal.withdrawalStatus.mockResolvedValue(statusOf({ amount: 50n, readyAt: 0n, now: 86_401n, balance: 0n }));
          mockPublicClient.waitForTransactionReceipt.mockResolvedValueOnce({ status: 'reverted' });
          mocks.mockSuperPaymaster.operators.mockResolvedValue({ isConfigured: true, aPNTsBalance: 0n });
          await expect(lifecycle.withdrawAllFunds()).rejects.toThrow(/cancelWithdraw 0xCancelHash reverted/);
          expect(mocks.mockWithdrawal.requestWithdraw).not.toHaveBeenCalled();
      });

      it('5.5.1, window closed, cancel mined but the RPC still shows the request: stops rather than request a stale balance', async () => {
          asVersion('SuperPaymaster-5.5.1');
          mocks.mockWithdrawal.cancelWithdraw.mockResolvedValue('0xCancelHash');
          mocks.mockWithdrawal.withdrawalStatus.mockResolvedValue(statusOf({ amount: 50n, readyAt: 0n, now: 86_401n, balance: 0n }));
          mocks.mockSuperPaymaster.operators.mockResolvedValue({ isConfigured: true, aPNTsBalance: 0n });
          await expect(lifecycle.withdrawAllFunds()).rejects.toThrow(/still reads as open/);
          expect(mocks.mockWithdrawal.requestWithdraw).not.toHaveBeenCalled();
      });

      it('5.5.1, no collateral and no request: goes straight to the role exit', async () => {
          asVersion('SuperPaymaster-5.5.1'); status({ amount: 0n, balance: 0n });
          mocks.mockRegistry.hasRole.mockResolvedValue(true);
          mocks.mockSuperPaymaster.operators.mockResolvedValue({ isConfigured: true, aPNTsBalance: 0n });
          expect(await lifecycle.withdrawAllFunds()).toEqual(['0xExitHash']);
      });

      it('a recipient other than the operator is refused: SuperPaymaster has no recipient parameter', async () => {
          await expect(lifecycle.withdrawAllFunds('0x000000000000000000000000000000000000dEaD')).rejects.toThrow(/to the operator itself/);
          expect(mocks.mockSuperPaymaster.withdraw).not.toHaveBeenCalled();
      });

      it('a pin / live version() disagreement stops the flow before anything is sent', async () => {
          mocks.mockResolveMode.mockRejectedValue(new Error('reports "SuperPaymaster-5.4.2" but the read-back pinned "SuperPaymaster-5.5.1"; refusing to guess'));
          mocks.mockRegistry.hasRole.mockResolvedValue(true);
          mocks.mockSuperPaymaster.operators.mockResolvedValue({ isConfigured: true, aPNTsBalance: 50n });
          await expect(lifecycle.withdrawAllFunds()).rejects.toThrow(/refusing to guess/);
          for (const f of [mocks.mockSuperPaymaster.withdraw, mocks.mockSuperPaymaster.withdrawTo, mocks.mockWithdrawal.requestWithdraw, mocks.mockWithdrawal.executeWithdraw, mocks.mockRegistry.exitRole]) {
              expect(f).not.toHaveBeenCalled();
          }
      });

      it('requestCollateralWithdrawal on 5.4.2 is refused (no request step there)', async () => {
          asVersion('SuperPaymaster-5.4.2');
          await expect(lifecycle.requestCollateralWithdrawal(1n)).rejects.toThrow(/withdraws in one call/);
      });
  });

});
