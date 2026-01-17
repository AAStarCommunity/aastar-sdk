import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserClient } from '../src/UserClient';
import { createMockPublicClient, createMockWalletClient, resetMocks } from './mocks/client';
import { parseEther } from 'viem';

// Define mocks using vi.hoisted
const mocks = vi.hoisted(() => {
  const mockAccount = { owner: vi.fn(), execute: vi.fn(), executeBatch: vi.fn() };
  const mockSBT = { balanceOf: vi.fn(), mintForRole: vi.fn(), leaveCommunity: vi.fn() };
  const mockToken = { transfer: vi.fn(), balanceOf: vi.fn(), allowance: vi.fn() };
  const mockStaking = { lockStake: vi.fn(), unlockAndTransfer: vi.fn(), getLockedStake: vi.fn() };
  const mockRegistry = { exitRole: vi.fn(), registerRoleSelf: vi.fn() }; // registerRoleSelf calls execute in implementation logic but mocked here just in case? No, registerAsEndUser constructs tx data and calls execute/executeBatch.
  // Wait, registerAsEndUser calls this.execute or this.executeBatch, so we don't mock registryActions for that call directly if we test logic flow, 
  // BUT registerAsEndUser calls registryActions(this.registryAddress) effectively to get address? No, it uses this.registryAddress. 
  // It calls registryActions to get ABI maybe? In the code: 
  // const registry = registryActions(this.registryAddress);
  // ... encodeFunctionData ...
  // registerAsEndUser MANUALLY constructs tx data using encodeFunctionData. It DOES NOT use registryActions returned object methods for the transaction itself to send via execute.
  // EXCEPT: It initializes registry = registryActions(...) which might be unused in logic?
  // Let's look at source: 
  // const registry = registryActions(this.registryAddress);
  // ...
  // It effectively uses it for nothing if it builds manually? 
  // Line 293: const registry = registryActions(this.registryAddress);
  // Then lines 315-337: const roleData = ... encodeFunctionData ... 
  // So registryActions might be just for show? Or maybe strict mode requires it.
  
  const mockEntryPoint = { getNonce: vi.fn() };
  
  return {
    mockAccount,
    mockSBT,
    mockToken,
    mockStaking,
    mockRegistry,
    mockEntryPoint,
    // Factory functions
    mockAccountActions: vi.fn(() => () => mockAccount),
    mockSBTActions: vi.fn(() => () => mockSBT),
    mockTokenActions: vi.fn(() => () => mockToken),
    mockStakingActions: vi.fn(() => () => mockStaking),
    mockRegistryActions: vi.fn(() => () => mockRegistry),
    mockEntryPointActions: vi.fn(() => () => mockEntryPoint),
    // Bundler actions (mock extend)
    mockBundlerActions: {},
  };
});

vi.mock('@aastar/core', async () => {
  const actual = await vi.importActual('@aastar/core');
  return {
    ...actual,
    accountActions: mocks.mockAccountActions,
    sbtActions: mocks.mockSBTActions,
    tokenActions: mocks.mockTokenActions,
    stakingActions: mocks.mockStakingActions,
    registryActions: mocks.mockRegistryActions,
    entryPointActions: mocks.mockEntryPointActions,
  };
});

vi.mock('viem/account-abstraction', async () => {
  const actual = await vi.importActual('viem/account-abstraction');
  return {
    ...actual,
    bundlerActions: () => ({
        estimateUserOperationGas: vi.fn().mockResolvedValue({
            callGasLimit: 1000n,
            verificationGasLimit: 1000n,
            preVerificationGas: 1000n
        }),
        sendUserOperation: vi.fn().mockResolvedValue('0xUserOpHash')
    }),
    getUserOperationHash: vi.fn().mockReturnValue('0xHash'),
  };
});

describe('UserClient', () => {
  let client: UserClient;
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
    accountAddress: '0x1234567890123456789012345678901234567890' as `0x${string}`,
    sbtAddress: '0x1111111111111111111111111111111111111111' as `0x${string}`,
    entryPointAddress: '0x2222222222222222222222222222222222222222' as `0x${string}`,
    gTokenStakingAddress: '0x3333333333333333333333333333333333333333' as `0x${string}`,
    registryAddress: '0x4444444444444444444444444444444444444444' as `0x${string}`,
    gTokenAddress: '0x5555555555555555555555555555555555555555' as `0x${string}`,
  };

  beforeEach(() => {
    resetMocks();
    vi.clearAllMocks();

    // Default Resolves
    mocks.mockAccount.owner.mockResolvedValue('0xOwner');
    mocks.mockAccount.execute.mockResolvedValue('0xTxHash');
    mocks.mockAccount.executeBatch.mockResolvedValue('0xTxHash');
    mocks.mockEntryPoint.getNonce.mockResolvedValue(0n);
    mocks.mockSBT.balanceOf.mockResolvedValue(1n);
    mocks.mockSBT.mintForRole.mockResolvedValue('0xTxHash');
    mocks.mockToken.transfer.mockResolvedValue('0xTxHash');
    mocks.mockToken.balanceOf.mockResolvedValue(100n);
    mocks.mockToken.allowance.mockResolvedValue(parseEther('1000'));
    mocks.mockStaking.lockStake.mockResolvedValue('0xTxHash');
    mocks.mockStaking.unlockAndTransfer.mockResolvedValue('0xTxHash');
    mocks.mockStaking.getLockedStake.mockResolvedValue(50n);
    mocks.mockRegistry.exitRole.mockResolvedValue('0xTxHash');
    mocks.mockSBT.leaveCommunity.mockResolvedValue('0xTxHash');

    // Mock public client methods needed for gasless
    (mockPublicClient as any).estimateFeesPerGas = vi.fn().mockResolvedValue({
        maxFeePerGas: 10n,
        maxPriorityFeePerGas: 1n
    });

    client = new UserClient(config);
    (client as any).client = mockWalletClient;
    (client as any).publicClient = mockPublicClient;
     // Mock extend for gasless
    (client as any).client.extend = vi.fn().mockReturnValue({
        estimateUserOperationGas: vi.fn().mockResolvedValue({
            callGasLimit: 1000n,
            verificationGasLimit: 1000n,
            preVerificationGas: 1000n
        }),
        sendUserOperation: vi.fn().mockResolvedValue('0xUserOpHash'),
        signMessage: vi.fn().mockResolvedValue('0xSig')
    });
    
    // Also mock signMessage on the client itself if used directly
    (client as any).client.signMessage = vi.fn().mockResolvedValue('0xSig');
  });

  describe('Basic Account Operations', () => {
    it('getNonce should call entryPoint', async () => {
      const nonce = await client.getNonce();
      expect(mocks.mockEntryPointActions).toHaveBeenCalledWith(config.entryPointAddress);
      expect(mocks.mockEntryPoint.getNonce).toHaveBeenCalledWith({
          sender: config.accountAddress,
          key: 0n
      });
      expect(nonce).toBe(0n);
    });

    it('getOwner should call account', async () => {
      const owner = await client.getOwner();
      expect(mocks.mockAccountActions).toHaveBeenCalledWith(config.accountAddress);
      expect(mocks.mockAccount.owner).toHaveBeenCalled();
      expect(owner).toBe('0xOwner');
    });

    it('execute should call account execute', async () => {
      await client.execute('0x1111111111111111111111111111111111111111', 0n, '0x1234');
      expect(mocks.mockAccountActions).toHaveBeenCalledWith(config.accountAddress);
      expect(mocks.mockAccount.execute).toHaveBeenCalledWith(expect.objectContaining({
          dest: '0x1111111111111111111111111111111111111111',
          value: 0n,
          func: '0x1234'
      }));
    });
  });

  describe('SBT Operations', () => {
    it('getSBTBalance should call sbt', async () => {
      await client.getSBTBalance();
      expect(mocks.mockSBTActions).toHaveBeenCalledWith(config.sbtAddress);
      expect(mocks.mockSBT.balanceOf).toHaveBeenCalled();
    });

    it('mintSBT should call sbt mintForRole', async () => {
      await client.mintSBT('0x4444444444444444444444444444444444444444444444444444444444444444');
      expect(mocks.mockSBT.mintForRole).toHaveBeenCalledWith(expect.objectContaining({
          roleId: '0x4444444444444444444444444444444444444444444444444444444444444444',
          to: config.accountAddress
      }));
    });
    
    it('should throw if sbtAddress missing', async () => {
        client.sbtAddress = undefined;
        await expect(client.mintSBT('0x4444444444444444444444444444444444444444444444444444444444444444')).rejects.toThrow('SBT address required');
    });
  });

  describe('Asset Operations', () => {
    it('transferToken should call token transfer', async () => {
      await client.transferToken('0x5555555555555555555555555555555555555555', '0x6666666666666666666666666666666666666666', 100n);
      expect(mocks.mockToken.transfer).toHaveBeenCalledWith(expect.objectContaining({
          token: '0x5555555555555555555555555555555555555555',
          to: '0x6666666666666666666666666666666666666666',
          amount: 100n
      }));
    });

    it('getTokenBalance should call token balanceOf', async () => {
        await client.getTokenBalance('0x5555555555555555555555555555555555555555');
        expect(mocks.mockToken.balanceOf).toHaveBeenCalledWith(expect.objectContaining({
            token: '0x5555555555555555555555555555555555555555',
            account: config.accountAddress
        }));
    });
  });

  describe('Staking Operations', () => {
      it('stakeForRole should call lockStake', async () => {
          await client.stakeForRole('0x4444444444444444444444444444444444444444444444444444444444444444', 100n);
          expect(mocks.mockStakingActions).toHaveBeenCalledWith(config.gTokenStakingAddress);
          expect(mocks.mockStaking.lockStake).toHaveBeenCalledWith(expect.objectContaining({
              user: config.accountAddress,
              roleId: '0x4444444444444444444444444444444444444444444444444444444444444444',
              stakeAmount: 100n
          }));
      });
      
      it('unstakeFromRole should call unlockAndTransfer', async () => {
          await client.unstakeFromRole('0x4444444444444444444444444444444444444444444444444444444444444444');
          expect(mocks.mockStaking.unlockAndTransfer).toHaveBeenCalledWith(expect.objectContaining({
              user: config.accountAddress,
              roleId: '0x4444444444444444444444444444444444444444444444444444444444444444'
          }));
      });

      it('getStakedBalance should call getLockedStake', async () => {
          await client.getStakedBalance('0x4444444444444444444444444444444444444444444444444444444444444444');
          expect(mocks.mockStaking.getLockedStake).toHaveBeenCalled();
      });
  });

  describe('Lifecycle', () => {
    it('exitRole should call registry exitRole', async () => {
        await client.exitRole('0x4444444444444444444444444444444444444444444444444444444444444444');
        expect(mocks.mockRegistryActions).toHaveBeenCalledWith(config.registryAddress);
        expect(mocks.mockRegistry.exitRole).toHaveBeenCalledWith(expect.objectContaining({
            roleId: '0x4444444444444444444444444444444444444444444444444444444444444444'
        }));
    });

    it('leaveCommunity should call sbt leaveCommunity', async () => {
        await client.leaveCommunity('0x3333333333333333333333333333333333333333');
        expect(mocks.mockSBT.leaveCommunity).toHaveBeenCalledWith(expect.objectContaining({
            community: '0x3333333333333333333333333333333333333333'
        }));
    });

    it('registerAsEndUser should execute batch (approve + register)', async () => {
        mocks.mockToken.allowance.mockResolvedValue(0n); // Force approve
        
        await client.registerAsEndUser('0x3333333333333333333333333333333333333333', 100n);
        
        // Should verify executeBatch is called because allowance is low
        expect(mocks.mockAccount.executeBatch).toHaveBeenCalled();
        // first arg (targets) should contain [gToken, registry]
        const callArgs = mocks.mockAccount.executeBatch.mock.calls[0][0];
        expect(callArgs.dest).toHaveLength(2);
        expect(callArgs.dest[0]).toBe(config.gTokenAddress);
        expect(callArgs.dest[1]).toBe(config.registryAddress);
    });

    it('registerAsEndUser should execute single if already approved', async () => {
        mocks.mockToken.allowance.mockResolvedValue(parseEther('10000'));
        
        await client.registerAsEndUser('0x3333333333333333333333333333333333333333', 100n);
        
        expect(mocks.mockAccount.execute).toHaveBeenCalled();
        const callArgs = mocks.mockAccount.execute.mock.calls[0][0];
        expect(callArgs.dest).toBe(config.registryAddress);
    });
  });

  describe('Gasless', () => {
      it('executeGasless should construct and send UserOp', async () => {
          const result = await client.executeGasless({
              target: '0x1111111111111111111111111111111111111111',
              value: 0n,
              data: '0x1234',
              paymaster: '0x2222222222222222222222222222222222222222',
              paymasterType: 'V4'
          });
          
          expect(client.client.extend).toHaveBeenCalled();
          expect(result).toBe('0xUserOpHash');
      });
  });

});
