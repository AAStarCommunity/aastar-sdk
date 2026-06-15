import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseEther, type Address } from 'viem';
import { CommunityClient } from '../src/index';

// Deterministic fixtures
const REGISTRY_ADDRESS = '0x1111111111111111111111111111111111111111' as Address;
const STAKING_ADDRESS = '0x2222222222222222222222222222222222222222' as Address;
const COMMUNITY_ID = '0x3333333333333333333333333333333333333333' as Address;
const XPNTS_TOKEN = '0x4444444444444444444444444444444444444444' as Address;

const ROLE_CONFIG = {
    minStake: parseEther('30'),
    ticketPrice: parseEther('1'),
    slashThreshold: 3,
    slashBase: 1,
    slashInc: 1,
    slashMax: 10,
    exitFeePercent: 5,
    isActive: true,
    minExitFee: parseEther('0.1'),
    description: 'Community role',
    owner: '0x9999999999999999999999999999999999999999' as Address,
    roleLockDuration: 86400n,
};

/**
 * Mock the public client's readContract by routing on functionName, so the
 * registry/staking/xPNTs action factories resolve real, distinct values.
 */
function makeReadContract() {
    return vi.fn(async ({ functionName }: { functionName: string }) => {
        switch (functionName) {
            case 'hasRole':
                return true;
            case 'getLockedStake':
                return parseEther('30');
            case 'getCreditLimit':
                return parseEther('100');
            case 'globalReputation':
                return 4200n;
            case 'getRoleConfig':
                return ROLE_CONFIG; // non-array => returned as-is by the factory
            case 'getRoleUserCount':
                return 7n;
            case 'totalStaked':
                return parseEther('1000');
            case 'totalSupply':
                return parseEther('500');
            default:
                throw new Error(`unexpected read: ${functionName}`);
        }
    });
}

describe('CommunityClient.getCommunityStats', () => {
    let readContract: ReturnType<typeof vi.fn>;
    let publicClient: any;
    let client: CommunityClient;

    beforeEach(() => {
        readContract = makeReadContract();
        publicClient = { readContract };
        const walletClient = { account: { address: COMMUNITY_ID }, chain: { id: 31337 } };
        client = new CommunityClient(publicClient, walletClient as any, {
            registry: REGISTRY_ADDRESS,
            staking: STAKING_ADDRESS,
        });
    });

    it('aggregates only real on-chain getters into a well-typed snapshot', async () => {
        const stats = await client.getCommunityStats(COMMUNITY_ID);

        expect(stats).toEqual({
            community: COMMUNITY_ID,
            isRegistered: true,
            communityStake: parseEther('30'),
            creditLimit: parseEther('100'),
            globalReputation: 4200n,
            roleConfig: ROLE_CONFIG,
            totalCommunities: 7n,
            globalTotalStaked: parseEther('1000'),
            xpntsSupply: undefined, // not requested
        });
    });

    it('routes registry reads to the registry address and staking reads to the staking address', async () => {
        await client.getCommunityStats(COMMUNITY_ID);

        const callFor = (fn: string) =>
            readContract.mock.calls.find((c) => c[0].functionName === fn)?.[0];

        expect(callFor('hasRole').address).toBe(REGISTRY_ADDRESS);
        expect(callFor('getCreditLimit').address).toBe(REGISTRY_ADDRESS);
        expect(callFor('globalReputation').address).toBe(REGISTRY_ADDRESS);
        expect(callFor('getRoleConfig').address).toBe(REGISTRY_ADDRESS);
        expect(callFor('getRoleUserCount').address).toBe(REGISTRY_ADDRESS);
        expect(callFor('getLockedStake').address).toBe(STAKING_ADDRESS);
        expect(callFor('totalStaked').address).toBe(STAKING_ADDRESS);

        // totalSupply is NOT read unless an xPNTs token is supplied.
        expect(callFor('totalSupply')).toBeUndefined();
    });

    it('reads xPNTs totalSupply only when an xpntsToken is supplied', async () => {
        const stats = await client.getCommunityStats(COMMUNITY_ID, { xpntsToken: XPNTS_TOKEN });

        expect(stats.xpntsSupply).toBe(parseEther('500'));

        const supplyCall = readContract.mock.calls.find(
            (c) => c[0].functionName === 'totalSupply'
        )?.[0];
        expect(supplyCall).toBeDefined();
        expect(supplyCall.address).toBe(XPNTS_TOKEN);
    });
});
