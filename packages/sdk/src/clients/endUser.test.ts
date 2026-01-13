import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createEndUserClient } from './endUser.js';
import { mainnet } from 'viem/chains';
import { http, type Address, type Hex, parseEther } from 'viem';

vi.mock('@aastar/core', async () => {
    const actual = await vi.importActual('@aastar/core');
    return {
        ...actual,
        registryActions: vi.fn(() => vi.fn(() => ({
            registerRoleSelf: vi.fn().mockResolvedValue('0xhash')
        }))),
        sbtActions: vi.fn(() => vi.fn(() => ({
            getUserSBT: vi.fn().mockResolvedValue(123n)
        }))),
        superPaymasterActions: vi.fn(() => vi.fn(() => ({
            getAvailableCredit: vi.fn().mockResolvedValue(1000n)
        }))),
        paymasterV4Actions: vi.fn(() => vi.fn(() => ({
            // pmv4
        }))),
    };
});

describe('EndUserClient', () => {
    const MOCK_ADDR = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as Address;
    const MOCK_COMMUNITY = '0x1111111111111111111111111111111111111111' as Address;

    it('should create end user client', () => {
        const client = createEndUserClient({ chain: mainnet, transport: http() });
        expect(client.joinAndActivate).toBeDefined();
    });

    describe('joinAndActivate', () => {
        it('should join community and fetch SBT', async () => {
            const client = createEndUserClient({ 
                chain: mainnet, 
                transport: http(), 
                account: { address: MOCK_ADDR } as any 
            });

            (client as any).readContract = vi.fn().mockResolvedValue('0x0000000000000000000000000000000000000000');
            (client as any).writeContract = vi.fn().mockResolvedValue('0xhash');
            (client as any).waitForTransactionReceipt = vi.fn().mockResolvedValue({ logs: [] });

            const result = await client.joinAndActivate({ community: MOCK_COMMUNITY, roleId: '0x1' });
            expect(result.sbtId).toBe(123n);
        });
    });

    describe('executeGasless', () => {
        it('should execute gasless transaction', async () => {
            const client = createEndUserClient({ 
                chain: mainnet, 
                transport: http(), 
                account: { address: MOCK_ADDR, signMessage: vi.fn().mockResolvedValue('0xsignature') } as any 
            });

            (client as any).createSmartAccount = vi.fn().mockResolvedValue({ accountAddress: '0xaa', isDeployed: true });
            (client as any).readContract = vi.fn().mockResolvedValue(0n); // nonce or userOpHash
            (client as any).getBytecode = vi.fn().mockResolvedValue('0x123');
            (client as any).writeContract = vi.fn().mockResolvedValue('0xhash');
            (client as any).waitForTransactionReceipt = vi.fn().mockResolvedValue({ logs: [] });

            const result = await client.executeGasless({
                target: MOCK_COMMUNITY,
                data: '0x',
                operator: MOCK_COMMUNITY
            });

            expect(result.hash).toBe('0xhash');
        });
    });
    describe('executeGaslessBatch', () => {
        it('should execute gasless batch', async () => {
            const client = createEndUserClient({ 
                chain: mainnet, 
                transport: http(), 
                account: { address: MOCK_ADDR, signMessage: vi.fn().mockResolvedValue('0xsignature') } as any 
            });

            (client as any).createSmartAccount = vi.fn().mockResolvedValue({ accountAddress: '0xaa', isDeployed: true });
            (client as any).readContract = vi.fn().mockResolvedValue(0n);
            (client as any).getBytecode = vi.fn().mockResolvedValue('0x123');
            (client as any).writeContract = vi.fn().mockResolvedValue('0xhash');
            (client as any).waitForTransactionReceipt = vi.fn().mockResolvedValue({ logs: [] });

            const result = await client.executeGaslessBatch({
                targets: [MOCK_COMMUNITY],
                datas: ['0x'],
                operator: MOCK_COMMUNITY
            });

            expect(result.hash).toBe('0xhash');
        });
    });

    describe('Requirements and Credits', () => {
        it('should call onboard (alias for joinAndActivate)', async () => {
            const client = createEndUserClient({ 
                chain: mainnet, 
                transport: http(), 
                account: { address: MOCK_ADDR } as any 
            });
            client.joinAndActivate = vi.fn().mockResolvedValue({ hash: '0xhash', events: [], sbtId: 1n });
            
            const result = await client.onboard({ community: MOCK_COMMUNITY, roleId: '0x1', roleData: '0x' });
            expect(result.sbtId).toBe(1n);
        });

        it('should check join requirements', async () => {
             const client = createEndUserClient({ chain: mainnet, transport: http() });
             // Mock balance return for GToken balance check >= 0.44 GT
             (client as any).readContract = vi.fn().mockResolvedValue(1000000000000000000n);
             
             const result = await client.checkJoinRequirements(MOCK_ADDR);
             expect(result.hasEnoughGToken).toBe(true);
        });

        it('should get available credit', async () => {
             const client = createEndUserClient({ chain: mainnet, transport: http() });
             // getAvailableCredit is part of SuperPaymasterActions which is extended in client
             const result = await client.getAvailableCredit({ user: MOCK_ADDR, operator: MOCK_COMMUNITY });
             expect(result).toBe(1000n);
        });
    });

    describe('Smart Account Management', () => {
        it('should create smart account with prediction', async () => {
            const client = createEndUserClient({ chain: mainnet, transport: http() });
            (client as any).readContract = vi.fn().mockResolvedValue('0xAccountAddress');
            (client as any).getBytecode = vi.fn().mockResolvedValue(undefined);
            
            const result = await client.createSmartAccount({ owner: MOCK_ADDR, salt: 123n });
            expect(result.accountAddress).toBe('0xAccountAddress');
            expect(result.isDeployed).toBe(false);
            expect(result.initCode).toBeDefined();
        });

        it('should detect already deployed smart account', async () => {
            const client = createEndUserClient({ chain: mainnet, transport: http() });
            (client as any).readContract = vi.fn().mockResolvedValue('0xDeployedAccount');
            (client as any).getBytecode = vi.fn().mockResolvedValue('0x123456');
            
            const result = await client.createSmartAccount({ owner: MOCK_ADDR });
            expect(result.isDeployed).toBe(true);
        });

        it('should throw error if factory not configured', async () => {
            const client = createEndUserClient({ chain: mainnet, transport: http(), addresses: { simpleAccountFactory: '0x0000000000000000000000000000000000000000' } });
            
            await expect(client.createSmartAccount({ owner: MOCK_ADDR }))
                .rejects.toThrow('SimpleAccountFactory not found');
        });

        it('should deploy new smart account', async () => {
            const client = createEndUserClient({ 
                chain: mainnet, 
                transport: http(),
                account: { address: MOCK_ADDR } as any
            });
            (client as any).createSmartAccount = vi.fn().mockResolvedValue({ accountAddress: '0xNewAccount', isDeployed: false });
            (client as any).writeContract = vi.fn().mockResolvedValue('0xdeployhash');
            (client as any).waitForTransactionReceipt = vi.fn().mockResolvedValue({ logs: [] });
            (client as any).getBalance = vi.fn().mockResolvedValue(0n);
            (client as any).sendTransaction = vi.fn().mockResolvedValue('0xfundhash');
            
            const result = await client.deploySmartAccount({ owner: MOCK_ADDR, fundWithETH: parseEther('0.1') });
            expect(result.accountAddress).toBe('0xNewAccount');
            expect(result.deployTxHash).toBe('0xdeployhash');
        });

        it('should skip deploy if already deployed', async () => {
            const client = createEndUserClient({ 
                chain: mainnet, 
                transport: http(),
                account: { address: MOCK_ADDR } as any
            });
            (client as any).createSmartAccount = vi.fn().mockResolvedValue({ accountAddress: '0xExisting', isDeployed: true });
            (client as any).getBalance = vi.fn().mockResolvedValue(parseEther('1'));
            
            const result = await client.deploySmartAccount({ owner: MOCK_ADDR });
            expect(result.accountAddress).toBe('0xExisting');
            expect(result.deployTxHash).toBe('0x0');
        });

        it('should handle logic when smart account not deployed during batch', async () => {
             const mockAccount = { address: MOCK_ADDR, signMessage: vi.fn().mockResolvedValue('0xsig') };
             const client = createEndUserClient({ chain: mainnet, transport: http(), account: mockAccount as any });
             // Mock getBytecode to return undefined/0x
             (client as any).getBytecode = vi.fn().mockResolvedValue('0x'); // Not deployed
             
             (client as any).createSmartAccount = vi.fn().mockResolvedValue({ initCode: '0x123' });
             (client as any).readContract = vi.fn().mockResolvedValue('0xhash');
             (client as any).writeContract = vi.fn().mockResolvedValue('0xhash');
             (client as any).waitForTransactionReceipt = vi.fn().mockResolvedValue({ logs: [] });

             const results = await client.executeGaslessBatch({
                 targets: [MOCK_ADDR],
                 datas: ['0x'],
                 operator: MOCK_ADDR
             });
             expect((client as any).createSmartAccount).toHaveBeenCalled();
             expect(results.hash).toBe('0xhash');
        });

        it('should handle execution errors in gasless batch', async () => {
             const mockAccount = { address: MOCK_ADDR, signMessage: vi.fn().mockResolvedValue('0xsig') };
             const client = createEndUserClient({ chain: mainnet, transport: http(), account: mockAccount as any });
             (client as any).getBytecode = vi.fn().mockResolvedValue('0xcode'); // deployed
             (client as any).readContract = vi.fn().mockResolvedValue('0xhash');
             (client as any).writeContract = vi.fn().mockRejectedValue(new Error('Contract Reverted'));
             
             await expect(client.executeGaslessBatch({
                 targets: [MOCK_ADDR],
                 datas: ['0x'],
                 operator: MOCK_ADDR
             })).rejects.toThrow('Contract Reverted');
        });
    });
});
