import { describe, it, expect, vi } from 'vitest';
import { decodeFunctionData } from 'viem';
import { PaymasterABI } from '@aastar/core';
import { PaymasterOperatorClient } from '../src/PaymasterOperatorClient';

// Real viem encoding (unlike PaymasterOperatorClient.test.ts, which mocks encodeFunctionData): the feed that
// actually goes into deployPaymaster's initData is decoded and compared with the one that was checked.
const mocks = vi.hoisted(() => ({
    registry: { ROLE_COMMUNITY: vi.fn(async () => '0x01'), ROLE_PAYMASTER_AOA: vi.fn(async () => '0x03'), hasRole: vi.fn(), registerRoleSelf: vi.fn(async () => '0xreg') },
    factory: { getPaymaster: vi.fn(), deployPaymaster: vi.fn(async () => '0xdeploy') },
    verifyEthUsdFeed: vi.fn(async () => ({})),
}));
vi.mock('@aastar/core', async () => {
    const actual: any = await vi.importActual('@aastar/core');
    return {
        ...actual,
        registryActions: () => () => mocks.registry,
        tokenActions: () => () => ({ allowance: vi.fn(async () => 10n ** 30n), approve: vi.fn() }),
        paymasterFactoryActions: () => () => mocks.factory,
        verifyPaymasterDeployment: vi.fn(async () => '0x7777777777777777777777777777777777777777'),
        verifyEthUsdFeed: mocks.verifyEthUsdFeed,
        // resolveEthUsdFeedAddress and assertSameChain stay real
    };
});

const OP_FEED = '0x13e3Ee699D1909E989722E753853AE30b17e08c5';
const ACCOUNT = '0x1111111111111111111111111111111111111111';

function client(chainId: number) {
    const chain = {
        getChainId: vi.fn(async () => chainId),
        waitForTransactionReceipt: vi.fn(async () => ({ status: 'success', blockNumber: 5n, blockHash: '0x' + '55'.repeat(32) })),
        getBlock: vi.fn(async () => ({ number: 5n, hash: '0x' + '55'.repeat(32) })),
    };
    const c = new PaymasterOperatorClient({
        client: { ...chain, account: { address: ACCOUNT, type: 'local' }, chain: { id: chainId } } as any,
        publicClient: chain as any,
        superPaymasterAddress: '0x2222222222222222222222222222222222222222',
        registryAddress: '0x3333333333333333333333333333333333333333',
        gTokenAddress: '0x4444444444444444444444444444444444444444',
        gTokenStakingAddress: '0x5555555555555555555555555555555555555555',
        paymasterFactoryAddress: '0x6666666666666666666666666666666666666666',
        entryPointAddress: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
    } as any);
    return c;
}

describe('deployAndRegisterPaymasterV4 — the checked feed is the one encoded into initialize()', () => {
    it('on OP Mainnet with no feed configured: the address-book feed is checked and sent, staleness 3600', async () => {
        mocks.registry.hasRole.mockImplementation(async ({ roleId }: any) => roleId === '0x01');
        mocks.factory.getPaymaster.mockResolvedValueOnce('0x0000000000000000000000000000000000000000');
        await client(10).deployAndRegisterPaymasterV4();
        expect(mocks.verifyEthUsdFeed).toHaveBeenCalledWith(expect.anything(), OP_FEED, { maxAgeSeconds: 3600 });
        const { initData } = (mocks.factory.deployPaymaster.mock.calls as any)[0][0];
        const decoded = decodeFunctionData({ abi: PaymasterABI, data: initData });
        expect(decoded.functionName).toBe('initialize');
        expect((decoded.args as any)[3]).toBe(OP_FEED);
        expect((decoded.args as any)[6]).toBe(3600n);
    });
});
