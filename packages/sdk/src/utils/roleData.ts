import { keccak256, stringToBytes, encodeAbiParameters, decodeAbiParameters, parseAbiParameters, type Hex, type Address, zeroAddress } from 'viem';
import { encodeEndUserRoleData, decodeEndUserRoleData } from '@aastar/core';

export const RoleIds = {
    PAYMASTER_SUPER: keccak256(stringToBytes('PAYMASTER_SUPER')),
    DVT: keccak256(stringToBytes('DVT')), // Replaced PAYMASTER
    PAYMASTER_AOA: keccak256(stringToBytes('PAYMASTER_AOA')),

    KMS: keccak256(stringToBytes('KMS')),
    COMMUNITY: keccak256(stringToBytes('COMMUNITY')),
    ENDUSER: keccak256(stringToBytes('ENDUSER')),
    ANODE: keccak256(stringToBytes('ANODE'))
} as const;

export type RoleId = typeof RoleIds[keyof typeof RoleIds];

export const RoleDataFactory = {
    /**
     * Data for SuperPaymaster Operator (Empty)
     */
    paymasterSuper: (): Hex => '0x',


    /**
     * Data for Generic DVT Role (Empty)
     */
    dvt: (): Hex => '0x',



    /**
     * Data for Community Registration (matches Registry.sol CommunityRoleData)
     * NOTE: Solidity's abi.encode(struct) adds a 32-byte offset prefix (0x20)
     * which is required for abi.decode(struct) to work correctly.
     * 
     * @param params.name Community Name (defaults to 'TestCommunity')
     * @param params.ensName ENS name (optional)
     * @param params.website Website URL (optional)
     * @param params.description Community description (optional)
     * @param params.logoURI Logo URI string (optional)
     * @param params.stakeAmount Stake amount (defaults to 0)
     */
    community: (params?: { name?: string, ensName?: string, website?: string, description?: string, logoURI?: string, stakeAmount?: bigint }): Hex => {
        return encodeAbiParameters(
            [{
                type: 'tuple',
                components: [
                    { name: 'name', type: 'string' },
                    { name: 'ensName', type: 'string' },
                    { name: 'website', type: 'string' },
                    { name: 'description', type: 'string' },
                    { name: 'logoURI', type: 'string' },
                    { name: 'stakeAmount', type: 'uint256' }
                ]
            }],
            [[
                params?.name || 'TestCommunity',
                params?.ensName || '',
                params?.website || '',
                params?.description || '',
                params?.logoURI || '',
                params?.stakeAmount || 0n
            ] as any]
        );
    },

    /**
     * Data for EndUser: Registry's `EndUserRoleData { address community; uint256 stakeAmount; }`.
     * `account`, `avatarURI` and `ensName` are not part of it (since SP 5.3.3) and are ignored; encoding
     * them moved the community out of the first word and every registration reverted InvalidParam.
     * A missing community throws here instead of being sent as the zero address.
     */
    endUser: (params: {
        community: Address,
        stakeAmount?: bigint,
        /** @deprecated not in Registry's EndUserRoleData; ignored */ account?: Address,
        /** @deprecated not in Registry's EndUserRoleData; ignored */ avatarURI?: string,
        /** @deprecated not in Registry's EndUserRoleData; ignored */ ensName?: string,
    }): Hex => {
        if (!params?.community) throw new Error('RoleDataFactory.endUser: community is required (Registry reverts InvalidParam without one)');
        return encodeEndUserRoleData({ community: params.community, stakeAmount: params.stakeAmount ?? 0n });
    },

    decodeCommunity: (data: Hex) => {
        const decoded = decodeAbiParameters(
            [{
                type: 'tuple',
                components: [
                    { name: 'name', type: 'string' },
                    { name: 'ensName', type: 'string' },
                    { name: 'website', type: 'string' },
                    { name: 'description', type: 'string' },
                    { name: 'logoURI', type: 'string' },
                    { name: 'stakeAmount', type: 'uint256' }
                ]
            }],
            data
        );
        const result = decoded[0] as any;
        // Check if result is array (iterable) or object
        if (Array.isArray(result)) {
             const [n, e, w, d, l, s] = result;
             return { name: n, ensName: e, website: w, description: d, logoURI: l, stakeAmount: s };
        } else {
             return { 
                name: result.name, 
                ensName: result.ensName, 
                website: result.website, 
                description: result.description, 
                logoURI: result.logoURI, 
                stakeAmount: result.stakeAmount 
            };
        }
    },

    /** Inverse of `endUser`: Registry's `EndUserRoleData { community, stakeAmount }`. */
    decodeEndUser: (data: Hex) => decodeEndUserRoleData(data)
};
