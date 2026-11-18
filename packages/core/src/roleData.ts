/**
 * Registry role data for ROLE_ENDUSER.
 *
 * Registry decodes it as `abi.decode(roleData, (EndUserRoleData))` with
 * `struct EndUserRoleData { address community; uint256 stakeAmount; }` — the shape since SP 5.3.3
 * (#165), unchanged in Registry-5.8.0 (Sepolia) and 5.10.x (rc.8).
 *
 * The SDK used to encode a five-field `(account, community, avatarURI, ensName, stakeAmount)`. Registry
 * read its first word (the account, or a tuple offset) as the community, so every such registration
 * reverted `InvalidParam` unless that word happened to be a community. Evidence:
 * docs/onchain-evidence/enduser-roledata-sepolia.md.
 */
import { decodeAbiParameters, encodeAbiParameters, getAddress, size, slice, type Address, type Hex } from 'viem';

const END_USER_ROLE_DATA = [
    { name: 'community', type: 'address' },
    { name: 'stakeAmount', type: 'uint256' },
] as const;

export interface EndUserRoleData {
    /** The community the user joins; Registry requires it to hold ROLE_COMMUNITY. */
    community: Address;
    /** GToken stake. 0 means the role's minStake (Registry `_enforceMinStake`). */
    stakeAmount?: bigint;
}

export function encodeEndUserRoleData({ community, stakeAmount = 0n }: EndUserRoleData): Hex {
    return encodeAbiParameters(END_USER_ROLE_DATA, [getAddress(community), stakeAmount]);
}

/**
 * Inverse of `encodeEndUserRoleData`. Accepts only the canonical two-word payload: anything else (for example the old
 * five-field encoding, which starts with a tuple offset or the account) throws rather than decoding into a plausible
 * but wrong community.
 */
export function decodeEndUserRoleData(data: Hex): Required<EndUserRoleData> {
    if (size(data) !== 64) throw new Error(`decodeEndUserRoleData: expected 64 bytes (community, stakeAmount), got ${size(data)}`);
    const [community, stakeAmount] = decodeAbiParameters(END_USER_ROLE_DATA, data);
    if (BigInt(slice(data, 0, 12)) !== 0n) throw new Error('decodeEndUserRoleData: the first word is not an address');
    return { community, stakeAmount };
}
