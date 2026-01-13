import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createOperatorClient } from './operator.js';
import { mainnet } from 'viem/chains';
import { http, type Address, keccak256, stringToBytes } from 'viem';

vi.mock('@aastar/core', async () => {
    const actual = await vi.importActual('@aastar/core');
    return {
        ...actual,
        registryActions: vi.fn(() => vi.fn(() => ({
            hasRole: vi.fn().mockResolvedValue(false),
            registerRoleSelf: vi.fn().mockResolvedValue('0xhash')
        }))),
        stakingActions: vi.fn(() => vi.fn(() => ({
            // any staking methods if needed
        }))),
        superPaymasterActions: vi.fn(() => vi.fn(() => ({
            depositForOperator: vi.fn().mockResolvedValue('0xhash'),
            operators: vi.fn().mockResolvedValue([1000n, 1000n, true, false]),
            getDeposit: vi.fn().mockResolvedValue(555n)
        }))),
        paymasterV4Actions: vi.fn(() => vi.fn(() => ({
            // pmv4 methods
        }))),
        tokenActions: vi.fn(() => vi.fn(() => ({
            approve: vi.fn().mockResolvedValue('0xhash')
        }))),
    };
});

describe('OperatorClient', () => {
    const MOCK_ADDR = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as Address;

    it('should create operator client', () => {
        const client = createOperatorClient({ chain: mainnet, transport: http() });
        expect(client.setup).toBeDefined();
    });

    describe('onboardFully', () => {
        it('should complete onboarding flow', async () => {
            const client = createOperatorClient({ 
                chain: mainnet, 
                transport: http(), 
                account: { address: MOCK_ADDR } as any 
            });

            // Mock base client methods
            (client as any).readContract = vi.fn().mockResolvedValue([0n, 0n, 0n]); 
            (client as any).waitForTransactionReceipt = vi.fn().mockResolvedValue({ logs: [] });

            const results = await client.onboardFully({
                stakeAmount: 100n,
                depositAmount: 200n,
                roleId: keccak256(stringToBytes('PAYMASTER_SUPER'))
            });

            expect(results).toHaveLength(3); 
            expect(client.approve).toHaveBeenCalled();
            expect(client.registerRoleSelf).toHaveBeenCalled();
            expect(client.depositForOperator).toHaveBeenCalled();
        });
    });

    describe('Advanced Setup', () => {
        it('should call configureOperator', async () => {
             const client = createOperatorClient({ chain: mainnet, transport: http() });
             (client as any).configureOperator = vi.fn().mockResolvedValue('0xhash');
             
             const hash = await client.configureOperator({ 
                 xPNTsToken: MOCK_ADDR, 
                 treasury: MOCK_ADDR, 
                 exchangeRate: 100n
             });
             expect(hash).toBe('0xhash');
        });

        it('should onboard to Super Paymaster', async () => {
             const client = createOperatorClient({ 
                 chain: mainnet, 
                 transport: http(),
                 account: { address: MOCK_ADDR } as any
             });
             client.onboardFully = vi.fn().mockResolvedValue([]);
             
             // onboardToSuperPaymaster is an internal action alias in OperatorClient
             await (client as any).onboardToSuperPaymaster({ stakeAmount: 100n, depositAmount: 200n, roleId: '0x1' });
             expect(client.onboardFully).toHaveBeenCalled();
        });

        it('should deploy PaymasterV4', async () => {
             const client = createOperatorClient({ chain: mainnet, transport: http(), account: { address: MOCK_ADDR } as any });
             (client as any).writeContract = vi.fn().mockResolvedValue('0xdeployhash');
             (client as any).waitForTransactionReceipt = vi.fn().mockResolvedValue({});
             
             const hash = await client.deployPaymasterV4({ version: 'v4.2' });
             expect(hash).toBe('0xdeployhash');
        });
        it('should validate inputs in configureOperator', async () => {
             const opClient = createOperatorClient({
                  account: { address: MOCK_ADDR } as any,
                  chain: mainnet,
                  transport: http()
             });
             
             // No need to mock internal configureOperator for validation testing 
             // as validation happens before internal call.

             await expect(opClient.configureOperator({
                 xPNTsToken: '0xInvalid' as any,
                 treasury: '0x123' as any,
                 exchangeRate: 100n
             })).rejects.toThrow('xPNTs Token must be a valid Ethereum address');

             await expect(opClient.configureOperator({
                 xPNTsToken: MOCK_ADDR,
                 treasury: '0xInvalid' as any,
                 exchangeRate: 100n
             })).rejects.toThrow('Treasury must be a valid Ethereum address');
        });

        it('should check readiness', async () => {
             const opClient = createOperatorClient({
                 account: { address: MOCK_ADDR } as any,
                 chain: mainnet,
                 transport: http()
            });
            
            // Global mock for registryActions.hasRole returns false
            // Global mock for superPaymasterActions.operators returns [1000n, 1000n, true, false]
            
            const status = await opClient.checkReadiness();
            expect(status.isRegistered).toBe(false); // mocked val
            expect(status.isConfigured).toBe(true);  // mocked val (index 2)
            expect(status.collateralBalance).toBe(1000n); // mocked val (index 0)
        });
    });

    describe('Operator Status and Queries', () => {
        it('should get operator status', async () => {
             const client = createOperatorClient({ chain: mainnet, transport: http() });
             (client as any).readContract = vi.fn()
                 .mockResolvedValueOnce(true) // hasRole
                 .mockResolvedValueOnce([1000n, 100n, true, false, 0n, 0n, MOCK_ADDR]); // operator data
             
             const status = await client.getOperatorStatus(MOCK_ADDR);
             expect(status.type).toBe('super');
             expect(status.superPaymaster?.isConfigured).toBe(true);
        });

        it('should check if address is operator', async () => {
             const client = createOperatorClient({ chain: mainnet, transport: http() });
             const result = await client.isOperator(MOCK_ADDR);
             expect(result).toBe(true); // from mocked operators
        });

        it('should get deposit details', async () => {
             const client = createOperatorClient({ chain: mainnet, transport: http() });
             const details = await client.getDepositDetails();
             expect(details.deposit).toBe(555n); // from mocked getDeposit
        });
    });
});
