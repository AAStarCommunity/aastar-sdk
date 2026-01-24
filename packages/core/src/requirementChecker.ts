/**
 * Unified requirement checker for role registration
 * Provides centralized validation for GToken, aPNTs, MySBT, and role permissions
 */
import { Address, parseAbi } from 'viem';
import { type PublicClient } from './clients/doc-types.js';
import type { RoleRequirement } from './roles.js';

const ERC20_ABI = parseAbi([
    'function balanceOf(address) view returns (uint256)'
]);

const REGISTRY_ABI = parseAbi([
    'function hasRole(bytes32, address) view returns (bool)',
    'function roleStakes(bytes32, address) view returns (uint256)'
]);

const MYSBT_ABI = parseAbi([
    'function balanceOf(address) view returns (uint256)'
]);

/**
 * Requirement Checker Utility
 * @description Centralized validation for all role requirements
 * 
 * @example
 * ```typescript
 * const checker = new RequirementChecker(publicClient);
 * 
 * // Check community launch requirements
 * const result = await checker.checkRequirements({
 *     address: userAddress,
 *     roleId: ROLE_COMMUNITY,
 *     requiredGToken: parseEther("33"),
 *     requireSBT: false
 * });
 * 
 * if (!result.hasEnoughGToken) {
 *     console.error(result.missingRequirements.join('\n'));
 * }
 * ```
 */
export class RequirementChecker {
    constructor(
        /** @internal */
        private publicClient: PublicClient,
        /** @internal */
        private addresses?: {
            registry?: Address;
            gtoken?: Address;
            apnts?: Address;
            mysbt?: Address;
        }
    ) {}

    /**
     * Check all requirements for a user
     * 
     * @param params Check parameters
     * @returns Detailed requirement status
     */
    async checkRequirements(params: {
        address: Address;
        roleId?: `0x${string}`;
        requiredGToken?: bigint;
        requiredAPNTs?: bigint;
        requireSBT?: boolean;
    }): Promise<RoleRequirement> {
        const {
            address,
            roleId,
            requiredGToken = 0n,
            requiredAPNTs = 0n,
            requireSBT = false
        } = params;

        const missingRequirements: string[] = [];

        // Check role (if specified)
        let hasRole = false;
        if (roleId) {
            const { CORE_ADDRESSES } = await import('./contract-addresses.js');
            hasRole = await this.publicClient.readContract({
               address: this.addresses?.registry || CORE_ADDRESSES.registry,
                abi: REGISTRY_ABI,
                functionName: 'hasRole',
                args: [roleId, address]
            }) as boolean;

            if (!hasRole && params.roleId) {
                missingRequirements.push(`Does not have required role`);
            }
        }

        // Check GToken balance
        let hasEnoughGToken = true;
        if (requiredGToken > 0n) {
            const { CORE_ADDRESSES } = await import('./contract-addresses.js');
            const gtokenBalance = await this.publicClient.readContract({
                address: this.addresses?.gtoken || CORE_ADDRESSES.gToken,
                abi: ERC20_ABI,
                functionName: 'balanceOf',
                args: [address]
            }) as bigint;

            hasEnoughGToken = gtokenBalance >= requiredGToken;
            if (!hasEnoughGToken) {
                missingRequirements.push(
                    `Need ${requiredGToken.toString()} GToken, have ${gtokenBalance.toString()}`
                );
            }
        }

        // Check aPNTs balance
        let hasEnoughAPNTs = true;
        if (requiredAPNTs > 0n) {
            const { CORE_ADDRESSES } = await import('./contract-addresses.js');
            const apntsBalance = await this.publicClient.readContract({
                address: this.addresses?.apnts || CORE_ADDRESSES.aPNTs,
                abi: ERC20_ABI,
                functionName: 'balanceOf',
                args: [address]
            }) as bigint;

            hasEnoughAPNTs = apntsBalance >= requiredAPNTs;
            if (!hasEnoughAPNTs) {
                missingRequirements.push(
                    `Need ${requiredAPNTs.toString()} aPNTs, have ${apntsBalance.toString()}`
                );
            }
        }

        // Check MySBT
        let hasSBT = false;
        if (requireSBT) {
            const { CORE_ADDRESSES } = await import('./contract-addresses.js');
            const sbtBalance = await this.publicClient.readContract({
                address: this.addresses?.mysbt || CORE_ADDRESSES.mySBT,
                abi: MYSBT_ABI,
                functionName: 'balanceOf',
                args: [address]
            }) as bigint;

            hasSBT = sbtBalance > 0n;
            if (!hasSBT) {
                missingRequirements.push('Must hold at least one MySBT');
            }
        }

        return {
            hasRole,
            hasEnoughGToken,
            hasEnoughAPNTs,
            hasSBT,
            missingRequirements
        };
    }

    /**
     * Check GToken balance only (shortcut)
     */
    async checkGTokenBalance(address: Address, required: bigint): Promise<{
        balance: bigint;
        hasEnough: boolean;
    }> {
        const { CORE_ADDRESSES } = await import('./contract-addresses.js');
        const balance = await this.publicClient.readContract({
            address: this.addresses?.gtoken || CORE_ADDRESSES.gToken,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [address]
        }) as bigint;

        return {
            balance,
            hasEnough: balance >= required
        };
    }

    /**
     * Check aPNTs balance only (shortcut)
     */
    async checkAPNTsBalance(address: Address, required: bigint): Promise<{
        balance: bigint;
        hasEnough: boolean;
    }> {
        const { CORE_ADDRESSES } = await import('./contract-addresses.js');
        const balance = await this.publicClient.readContract({
            address: this.addresses?.apnts || CORE_ADDRESSES.aPNTs,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [address]
        }) as bigint;

        return {
            balance,
            hasEnough: balance >= required
        };
    }

    /**
     * Check if user has MySBT (shortcut)
     */
    async checkHasSBT(address: Address): Promise<boolean> {
        const { CORE_ADDRESSES } = await import('./contract-addresses.js');
        const balance = await this.publicClient.readContract({
            address: this.addresses?.mysbt || CORE_ADDRESSES.mySBT,
            abi: MYSBT_ABI,
            functionName: 'balanceOf',
            args: [address]
        }) as bigint;

        return balance > 0n;
    }

    /**
     * Check if user has specific role (shortcut)
     */
    async checkHasRole(roleId: `0x${string}`, address: Address): Promise<boolean> {
        const { CORE_ADDRESSES } = await import('./contract-addresses.js');
        return await this.publicClient.readContract({
            address: this.addresses?.registry || CORE_ADDRESSES.registry,
            abi: REGISTRY_ABI,
            functionName: 'hasRole',
            args: [roleId, address]
        }) as boolean;
    }
}
