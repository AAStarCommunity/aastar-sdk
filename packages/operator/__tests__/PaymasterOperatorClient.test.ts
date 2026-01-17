import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaymasterOperatorClient } from '../src/PaymasterOperatorClient';
import { createMockPublicClient, createMockWalletClient, resetMocks } from './mocks/client';
import { parseEther } from 'viem';

// Define mocks
const mocks = vi.hoisted(() => {
  const mockRegistry = { ROLE_COMMUNITY: vi.fn(), ROLE_PAYMASTER_SUPER: vi.fn(), ROLE_PAYMASTER_AOA: vi.fn(), hasRole: vi.fn(), registerRoleSelf: vi.fn() };
  const mockToken = { allowance: vi.fn(), approve: vi.fn() };
  const mockSuperPaymaster = { APNTS_TOKEN: vi.fn(), deposit: vi.fn(), configureOperator: vi.fn(), operators: vi.fn() };
  const mockPaymasterFactory = { deployPaymaster: vi.fn(), getPaymaster: vi.fn() };
  const mockPaymaster = { setTokenPrice: vi.fn(), tokenPrices: vi.fn(), depositFor: vi.fn() };

  return {
    mockRegistry,
    mockToken,
    mockSuperPaymaster,
    mockPaymasterFactory,
    mockPaymaster,
    // Factory Functions
    mockRegistryActions: vi.fn(() => () => mockRegistry),
    mockTokenActions: vi.fn(() => () => mockToken),
    mockSuperPaymasterActions: vi.fn(() => () => mockSuperPaymaster),
    mockPaymasterFactoryActions: vi.fn(() => () => mockPaymasterFactory),
    mockPaymasterActions: vi.fn(() => () => mockPaymaster),
  };
});

vi.mock('@aastar/core', async () => {
  const actual = await vi.importActual('@aastar/core');
  return {
    ...actual,
    registryActions: mocks.mockRegistryActions,
    tokenActions: mocks.mockTokenActions,
    superPaymasterActions: mocks.mockSuperPaymasterActions,
    paymasterFactoryActions: mocks.mockPaymasterFactoryActions,
    paymasterActions: mocks.mockPaymasterActions,
  };
});

vi.mock('viem', async () => {
    const actual = await vi.importActual('viem');
    return {
        ...actual,
        encodeFunctionData: vi.fn().mockReturnValue('0xInitData'),
        // encodeAbiParameters: vi.fn().mockReturnValue('0xAbiData') // Use real implementation if possible, or mock carefully
    };
});

describe('PaymasterOperatorClient', () => {
  let client: PaymasterOperatorClient;
  const mockPublicClient = createMockPublicClient();
  const mockWalletClient = createMockWalletClient();

  const config = {
    params: { chainId: 11155111, rpcUrl: 'https://rpc.sepolia.org' },
    services: {},
    client: mockWalletClient as any,
    superPaymasterAddress: '0x1111111111111111111111111111111111111111' as `0x${string}`,
    tokenAddress: '0x2222222222222222222222222222222222222222' as `0x${string}`,
    registryAddress: '0x3333333333333333333333333333333333333333' as `0x${string}`,
    gTokenAddress: '0x4444444444444444444444444444444444444444' as `0x${string}`,
    gTokenStakingAddress: '0x5555555555555555555555555555555555555555' as `0x${string}`,
    paymasterFactoryAddress: '0x6666666666666666666666666666666666666666' as `0x${string}`,
  };

  beforeEach(() => {
    resetMocks();
    vi.clearAllMocks();

    // Default Mocks
    mocks.mockRegistry.ROLE_COMMUNITY.mockResolvedValue('0x1111111111111111111111111111111111111111111111111111111111111111');
    mocks.mockRegistry.ROLE_PAYMASTER_SUPER.mockResolvedValue('0x2222222222222222222222222222222222222222222222222222222222222222');
    mocks.mockRegistry.ROLE_PAYMASTER_AOA.mockResolvedValue('0x3333333333333333333333333333333333333333333333333333333333333333');
    mocks.mockRegistry.hasRole.mockResolvedValue(true); // Default has prerequisite
    mocks.mockRegistry.registerRoleSelf.mockResolvedValue('0xTxHash');
    mocks.mockToken.allowance.mockResolvedValue(parseEther('1000'));
    mocks.mockToken.approve.mockResolvedValue('0xTxHash');
    mocks.mockSuperPaymaster.APNTS_TOKEN.mockResolvedValue('0xAPNTS');
    mocks.mockSuperPaymaster.deposit.mockResolvedValue('0xTxHash');
    mocks.mockSuperPaymaster.configureOperator.mockResolvedValue('0xTxHash');
    mocks.mockSuperPaymaster.operators.mockResolvedValue([0n, '0x0000000000000000000000000000000000000000', '0x0000000000000000000000000000000000000000', 0n]);
    mocks.mockPaymasterFactory.deployPaymaster.mockResolvedValue('0xTxHash');
    mocks.mockPaymasterFactory.getPaymaster.mockResolvedValue('0x7777777777777777777777777777777777777777');
    mocks.mockPaymaster.setTokenPrice.mockResolvedValue('0xTxHash');
    mocks.mockPaymaster.tokenPrices.mockResolvedValue(100n);
    mocks.mockPaymaster.depositFor.mockResolvedValue('0xTxHash');

    client = new PaymasterOperatorClient(config);
    (client as any).client = mockWalletClient;
    (client as any).publicClient = mockPublicClient;
  });

  describe('Registration', () => {
    it('registerAsSuperPaymasterOperator should verify roles and register', async () => {
        mocks.mockRegistry.hasRole
            .mockResolvedValueOnce(true) // Has Community
            .mockResolvedValueOnce(false); // Does not have SuperRole yet

        await client.registerAsSuperPaymasterOperator({ stakeAmount: 100n });

        expect(mocks.mockRegistry.registerRoleSelf).toHaveBeenCalledWith(expect.objectContaining({
            roleId: '0x2222222222222222222222222222222222222222222222222222222222222222'
        }));
    });

    it('registerAsSuperPaymasterOperator should throw if no community role', async () => {
        mocks.mockRegistry.hasRole.mockResolvedValue(false);
        await expect(client.registerAsSuperPaymasterOperator()).rejects.toThrow('Must have ROLE_COMMUNITY');
    });

    it('registerAsSuperPaymasterOperator should approve if needed', async () => {
        mocks.mockRegistry.hasRole
             .mockResolvedValueOnce(true)
             .mockResolvedValueOnce(false);
        mocks.mockToken.allowance.mockResolvedValue(0n);

        await client.registerAsSuperPaymasterOperator({ stakeAmount: 100n });
        
        expect(mocks.mockToken.approve).toHaveBeenCalled();
    });

    it('registerAsSuperPaymasterOperator should handle optional deposit', async () => {
        mocks.mockRegistry.hasRole
             .mockResolvedValueOnce(true)
             .mockResolvedValueOnce(false);
        
        await client.registerAsSuperPaymasterOperator({ depositAmount: 50n });
        
        expect(mocks.mockSuperPaymaster.deposit).toHaveBeenCalled();
    });
  });

  describe('Deployment', () => {
      it('deployAndRegisterPaymasterV4 should deploy and register', async () => {
        mocks.mockRegistry.hasRole
            .mockResolvedValueOnce(true) // Has Community
            .mockResolvedValueOnce(false); // Has AOA? (Checked AFTER deployment in code logic)
            // Wait, logic: 
            // 1. Check Community (mocked true)
            // 2. Deploy -> deployHash
            // 3. getPaymaster
            // 4. Check AOA role (mocked false)
            // 5. Register
        
        // We need to set up sequential mocks for hasRole carefully if called multiple times with different args
        // But logic calls with different role IDs. 
        // Mock implementation:
        mocks.mockRegistry.hasRole.mockImplementation(async ({ roleId }: any) => {
            if (roleId === '0x1111111111111111111111111111111111111111111111111111111111111111') return true;
            if (roleId === '0x3333333333333333333333333333333333333333333333333333333333333333') return false;
            return false;
        });

        const result = await client.deployAndRegisterPaymasterV4();

        expect(mocks.mockPaymasterFactory.deployPaymaster).toHaveBeenCalled();
        expect(mocks.mockPaymasterFactory.getPaymaster).toHaveBeenCalled();
        expect(mocks.mockRegistry.registerRoleSelf).toHaveBeenCalledWith(expect.objectContaining({
            roleId: '0x3333333333333333333333333333333333333333333333333333333333333333'
        }));
        expect(result.paymasterAddress).toBe('0x7777777777777777777777777777777777777777');
      });

      it('deployAndRegisterPaymasterV4 should skip register if already has role', async () => {
        mocks.mockRegistry.hasRole.mockImplementation(async ({ roleId }: any) => {
            if (roleId === '0x1111111111111111111111111111111111111111111111111111111111111111') return true;
            if (roleId === '0x3333333333333333333333333333333333333333333333333333333333333333') return true; // Already registered
            return false;
        });

        const result = await client.deployAndRegisterPaymasterV4();
        
        expect(mocks.mockPaymasterFactory.deployPaymaster).toHaveBeenCalled();
        expect(mocks.mockRegistry.registerRoleSelf).not.toHaveBeenCalled();
        expect(result.registerHash).toBe('0x0000000000000000000000000000000000000000000000000000000000000000');
      });
  });

  describe('Management', () => {
      it('depositCollateral should approve and deposit', async () => {
          mocks.mockToken.allowance.mockResolvedValue(0n);
          await client.depositCollateral(100n);
          
          expect(mocks.mockSuperPaymaster.APNTS_TOKEN).toHaveBeenCalled();
          expect(mocks.mockToken.approve).toHaveBeenCalled();
          expect(mocks.mockSuperPaymaster.deposit).toHaveBeenCalledWith(expect.objectContaining({
              amount: 100n
          }));
      });

      it('updateExchangeRate should fetch config and call configureOperator', async () => {
          // Mock operators return [balance, token, treasury, rate]
          mocks.mockSuperPaymaster.operators.mockResolvedValue([
              1000n,
              '0x2222222222222222222222222222222222222222',
              '0x3333333333333333333333333333333333333333',
              150n
          ]);
          mocks.mockSuperPaymaster.configureOperator.mockResolvedValue('0xTxHash');

          await client.updateExchangeRate(200n);
          
          expect(mocks.mockSuperPaymaster.operators).toHaveBeenCalledWith(expect.objectContaining({
              operator: '0x1234567890123456789012345678901234567890' // Default mock address from client.ts
          }));
          
          expect(mocks.mockSuperPaymaster.configureOperator).toHaveBeenCalledWith(expect.objectContaining({
              xPNTsToken: '0x2222222222222222222222222222222222222222',
              treasury: '0x3333333333333333333333333333333333333333',
              exchangeRate: 200n
          }));
      });
  });

  describe('Token Config', () => {
      it('addGasToken should set token price', async () => {
          await client.addGasToken('0x4444444444444444444444444444444444444444', 100n);
          expect(mocks.mockPaymasterActions).toHaveBeenCalled(); // Should be called with SP address? No, superPaymasterAddress IS the paymaster for addGasToken (based on code reading)
          // Wait, addGasToken uses paymasterActions(this.superPaymasterAddress)
          expect(mocks.mockPaymasterActions).toHaveBeenCalledWith(config.superPaymasterAddress);
          expect(mocks.mockPaymaster.setTokenPrice).toHaveBeenCalled();
      });

      it('getTokenPrice should read price', async () => {
          const price = await client.getTokenPrice('0x4444444444444444444444444444444444444444');
          expect(price).toBe(100n);
      });
  });

  describe('Deposit', () => {
      it('setupPaymasterDeposit should deposit for user', async () => {
          await client.setupPaymasterDeposit({
              paymaster: '0x5555555555555555555555555555555555555555',
              user: '0x6666666666666666666666666666666666666666',
              token: '0x4444444444444444444444444444444444444444',
              amount: 100n
          });
          expect(mocks.mockPaymasterActions).toHaveBeenCalledWith('0x5555555555555555555555555555555555555555');
          expect(mocks.mockPaymaster.depositFor).toHaveBeenCalledWith(expect.objectContaining({
              user: '0x6666666666666666666666666666666666666666',
              amount: 100n
          }));
      });
  });
});
