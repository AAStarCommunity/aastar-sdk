import { keccak256, stringToBytes, encodeAbiParameters, decodeAbiParameters, parseAbiParameters, type Hex, type Address, zeroAddress } from 'viem';

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
     * Data for EndUser (matches Registry.sol EndUserRoleData)
     */
    endUser: (params?: { account?: Address, community?: Address, avatarURI?: string, ensName?: string, stakeAmount?: bigint }): Hex => {
        return encodeAbiParameters(
            [{
                type: 'tuple',
                components: [
                    { name: 'account', type: 'address' },
                    { name: 'community', type: 'address' },
                    { name: 'avatarURI', type: 'string' },
                    { name: 'ensName', type: 'string' },
                    { name: 'stakeAmount', type: 'uint256' }
                ]
            }],
            [[
                params?.account || zeroAddress,
                params?.community || zeroAddress,
                params?.avatarURI || '',
                params?.ensName || '',
                params?.stakeAmount || 0n
            ] as any]
        );
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

    decodeEndUser: (data: Hex) => {
        const decoded = decodeAbiParameters(
            [{
                type: 'tuple',
                components: [
                    { name: 'account', type: 'address' },
                    { name: 'community', type: 'address' },
                    { name: 'avatarURI', type: 'string' },
                    { name: 'ensName', type: 'string' },
                    { name: 'stakeAmount', type: 'uint256' }
                ]
            }],
            data
        );
        const result = decoded[0] as any;
        if (Array.isArray(result)) {
            const [a, c, av, en, s] = result;
            return { account: a, community: c, avatarURI: av, ensName: en, stakeAmount: s };
        } else {
            return {
                account: result.account,
                community: result.community,
                avatarURI: result.avatarURI,
                ensName: result.ensName,
                stakeAmount: result.stakeAmount
            };
        }
    }
};
