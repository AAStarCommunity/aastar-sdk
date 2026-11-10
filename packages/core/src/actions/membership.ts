import { type Address, type PublicClient } from 'viem';
import { MySBTABI, RegistryABI } from '../abis/index.js';
import { validateAddress } from '../validators/index.js';
import { AAStarError } from '../errors/index.js';
import { ROLE_ENDUSER } from '../roles.js';

/** Both halves of an end user's community membership, read at one block. */
export type CommunityEndUserStatus = {
    /** true only when BOTH halves below are true. */
    active: boolean;
    /** `Registry.hasRole(ROLE_ENDUSER, user)`. */
    hasEndUserRole: boolean;
    /** `MySBT.verifyCommunityMembership(user, community)`: an active membership record for `community`. */
    sbtMembershipActive: boolean;
    blockNumber: bigint;
};

/**
 * Whether `user` is an active END USER of `community` — the check integrators must make.
 *
 * SuperPaymaster rc.8 ships Registry R-1 as a DOCUMENTED LIMITATION: the SBT membership record and
 * the Registry role are not kept in lock-step, so neither one alone proves membership. A user can
 * hold an active MySBT membership after losing ROLE_ENDUSER (or the reverse, while an exit sync is
 * pending reconciliation). The integration rule is to require BOTH
 * `Registry.hasRole(ROLE_ENDUSER, user)` and `MySBT.verifyCommunityMembership(user, community)`.
 *
 * Both reads are pinned to the same block, so the answer describes one state. `sbtActions`'
 * `verifyCommunityMembership` remains the raw single-contract read; use this for a decision.
 */
export async function getCommunityEndUserStatus(
    client: PublicClient,
    args: { registry: Address; sbt: Address; user: Address; community: Address; blockNumber?: bigint },
): Promise<CommunityEndUserStatus> {
    const { registry, sbt, user, community } = args;
    validateAddress(registry, 'registry');
    validateAddress(sbt, 'sbt');
    validateAddress(user, 'user');
    validateAddress(community, 'community');
    try {
        const blockNumber = args.blockNumber ?? (await client.getBlockNumber());
        const [hasEndUserRole, sbtMembershipActive] = await Promise.all([
            client.readContract({ address: registry, abi: RegistryABI, functionName: 'hasRole', args: [ROLE_ENDUSER, user], blockNumber }) as Promise<boolean>,
            client.readContract({ address: sbt, abi: MySBTABI, functionName: 'verifyCommunityMembership', args: [user, community], blockNumber }) as Promise<boolean>,
        ]);
        return { active: hasEndUserRole === true && sbtMembershipActive === true, hasEndUserRole, sbtMembershipActive, blockNumber };
    } catch (error) {
        throw AAStarError.fromViemError(error as Error, 'getCommunityEndUserStatus');
    }
}

/** {@link getCommunityEndUserStatus}`.active`: true only when the Registry role AND the SBT membership agree. */
export async function isActiveCommunityEndUser(
    client: PublicClient,
    args: { registry: Address; sbt: Address; user: Address; community: Address; blockNumber?: bigint },
): Promise<boolean> {
    return (await getCommunityEndUserStatus(client, args)).active;
}
