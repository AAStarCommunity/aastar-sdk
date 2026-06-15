import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    encodeEventTopics,
    encodeAbiParameters,
    parseEther,
    type Address,
} from 'viem';
import { CORE_ADDRESSES, xPNTsFactoryABI } from '@aastar/core';
import { CommunityClient, type XPNTsIssuanceParams } from '../src/index';

// Deterministic fixtures
const FACTORY_ADDRESS = '0x1111111111111111111111111111111111111111' as Address;
const ACCOUNT_ADDRESS = '0x2222222222222222222222222222222222222222' as Address;
const PAYMASTER_AOA = '0x3333333333333333333333333333333333333333' as Address;
const COMMUNITY_ADDRESS = ACCOUNT_ADDRESS; // factory ties token to the caller community
const DEPLOYED_TOKEN = '0x4444444444444444444444444444444444444444' as Address;
const TX_HASH = '0xabc0000000000000000000000000000000000000000000000000000000000abc';

/**
 * Build a realistic `xPNTsTokenDeployed` log entry using the real factory ABI,
 * so decodeEventLog inside issueXPNTs resolves the deployed token address.
 */
function buildDeployedLog(community: Address, tokenAddress: Address, name: string, symbol: string) {
    const topics = encodeEventTopics({
        abi: xPNTsFactoryABI,
        eventName: 'xPNTsTokenDeployed',
        args: { community, tokenAddress },
    });
    const data = encodeAbiParameters(
        [
            { name: 'name', type: 'string' },
            { name: 'symbol', type: 'string' },
        ],
        [name, symbol],
    );
    return {
        address: FACTORY_ADDRESS,
        topics,
        data,
    };
}

const PARAMS: XPNTsIssuanceParams = {
    name: 'MyDAO Points',
    symbol: 'MDP',
    communityName: 'MyDAO',
    communityENS: 'mydao.eth',
    exchangeRate: parseEther('1'),
    paymasterAOA: PAYMASTER_AOA,
};

describe('CommunityClient.issueXPNTs', () => {
    let writeContract: ReturnType<typeof vi.fn>;
    let waitForTransactionReceipt: ReturnType<typeof vi.fn>;
    let walletClient: any;
    let publicClient: any;
    let client: CommunityClient;
    const originalFactory = (CORE_ADDRESSES as any).xPNTsFactory;

    beforeEach(() => {
        // Ensure the factory address is resolvable regardless of test env.
        (CORE_ADDRESSES as any).xPNTsFactory = FACTORY_ADDRESS;

        writeContract = vi.fn().mockResolvedValue(TX_HASH);
        waitForTransactionReceipt = vi.fn().mockResolvedValue({
            logs: [
                // An unrelated log first, to prove the decoder skips non-matching events.
                {
                    address: '0x9999999999999999999999999999999999999999',
                    topics: ['0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef'],
                    data: '0x',
                },
                buildDeployedLog(COMMUNITY_ADDRESS, DEPLOYED_TOKEN, PARAMS.name, PARAMS.symbol),
            ],
        });

        walletClient = {
            account: { address: ACCOUNT_ADDRESS },
            chain: { id: 31337 },
            writeContract,
        };
        publicClient = { waitForTransactionReceipt };

        client = new CommunityClient(publicClient, walletClient);
        // Bypass the on-chain ROLE_COMMUNITY precheck.
        (client as any).requirementChecker.checkHasRole = vi.fn().mockResolvedValue(true);
    });

    afterEach(() => {
        (CORE_ADDRESSES as any).xPNTsFactory = originalFactory;
    });

    it('returns the real decoded token address (not zero) and the tx hash', async () => {
        const result = await client.issueXPNTs(PARAMS);

        expect(result.txHash).toBe(TX_HASH);
        expect(result.xpntsAddress.toLowerCase()).toBe(DEPLOYED_TOKEN.toLowerCase());
        expect(result.xpntsAddress).not.toBe('0x0000000000000000000000000000000000000000');
    });

    it('calls deployxPNTsToken with the correct args via the core factory action', async () => {
        await client.issueXPNTs(PARAMS);

        expect(writeContract).toHaveBeenCalledTimes(1);
        const call = writeContract.mock.calls[0][0];
        expect(call.functionName).toBe('deployxPNTsToken');
        expect(call.address).toBe(FACTORY_ADDRESS);
        expect(call.args).toEqual([
            PARAMS.name,
            PARAMS.symbol,
            PARAMS.communityName,
            PARAMS.communityENS,
            PARAMS.exchangeRate,
            PARAMS.paymasterAOA,
        ]);
        // Must use the centralized core ABI, not an inline parseAbi fragment.
        expect(call.abi).toBe(xPNTsFactoryABI);
    });

    it('throws (does not return zero address) when no deploy event is present', async () => {
        waitForTransactionReceipt.mockResolvedValueOnce({
            logs: [
                {
                    address: '0x9999999999999999999999999999999999999999',
                    topics: ['0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef'],
                    data: '0x',
                },
            ],
        });

        await expect(client.issueXPNTs(PARAMS)).rejects.toThrow(/xPNTsTokenDeployed/);
    });

    it('throws when the COMMUNITY role precheck fails', async () => {
        (client as any).requirementChecker.checkHasRole = vi.fn().mockResolvedValue(false);
        await expect(client.issueXPNTs(PARAMS)).rejects.toThrow(/ROLE_COMMUNITY/);
        expect(writeContract).not.toHaveBeenCalled();
    });

    it('ignores a same-shaped event from a NON-factory address (anti-spoof) and uses the real factory log', async () => {
        const ATTACKER_TOKEN = '0x8888888888888888888888888888888888888888' as Address;
        // A valid-shaped xPNTsTokenDeployed, but emitted by a non-factory contract,
        // placed FIRST so it would win the loop without the address filter.
        const spoof = {
            ...buildDeployedLog(COMMUNITY_ADDRESS, ATTACKER_TOKEN, 'Spoof', 'SPF'),
            address: '0x7777777777777777777777777777777777777777' as Address,
        };
        const real = buildDeployedLog(COMMUNITY_ADDRESS, DEPLOYED_TOKEN, PARAMS.name, PARAMS.symbol);
        waitForTransactionReceipt.mockResolvedValueOnce({ logs: [spoof, real] });

        const result = await client.issueXPNTs(PARAMS);
        expect(result.xpntsAddress.toLowerCase()).toBe(DEPLOYED_TOKEN.toLowerCase());
        expect(result.xpntsAddress.toLowerCase()).not.toBe(ATTACKER_TOKEN.toLowerCase());
    });
});

describe('CommunityClient.launchCommunity — zero-value guard', () => {
    it('fast-fails a zero stake+burn launch before any on-chain call', async () => {
        const walletClient: any = {
            account: { address: ACCOUNT_ADDRESS },
            chain: { id: 31337 },
            writeContract: vi.fn(),
        };
        const publicClient: any = { waitForTransactionReceipt: vi.fn() };
        const client = new CommunityClient(publicClient, walletClient);

        await expect(
            client.launchCommunity({ name: 'ZeroDAO', stakeAmount: 0n, entryBurn: 0n })
        ).rejects.toThrow(/must be > 0/);
        // No approve/stake/register was submitted.
        expect(walletClient.writeContract).not.toHaveBeenCalled();
    });
});
