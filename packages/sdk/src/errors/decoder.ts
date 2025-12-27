import { decodeErrorResult, type Hex, type ContractFunctionExecutionError } from 'viem';
import { RegistryABI } from '../index.js'; // Assuming RegistryABI is exported

export const CustomErrors = {
    RoleNotConfigured: 'RoleNotConfigured(bytes32,bool)',
    RoleAlreadyGranted: 'RoleAlreadyGranted(bytes32,address)',
    InsufficientStake: 'InsufficientStake(uint256,uint256)',
} as const;

export function decodeContractError(error: any): string | null {
    if (!error || typeof error !== 'object') return null;

    // Check if it's a viem ContractFunctionExecutionError
    if (error.name === 'ContractFunctionExecutionError' || error.walk) {
        // Try to extract internal error data
        const internalError = error.walk ? error.walk((e: any) => e.data) : error;
        const data = internalError?.data;

        if (data) {
             try {
                const decoded = decodeErrorResult({
                    abi: RegistryABI,
                    data: data as Hex
                });
                
                if (decoded.errorName === 'RoleNotConfigured') {
                    const [roleId, isActive] = decoded.args as [Hex, boolean];
                    return `RoleNotConfigured: Role ${roleId} is ${isActive ? 'ACTIVE' : 'INACTIVE'} in Registry.`;
                }
                if (decoded.errorName === 'RoleAlreadyGranted') {
                    const [roleId, user] = decoded.args as [Hex, string];
                    return `RoleAlreadyGranted: User ${user} already has role ${roleId}.`;
                }
                if (decoded.errorName === 'InsufficientStake') {
                     const [stake, minStake] = decoded.args as [bigint, bigint];
                     // Viem returns bigints, format them?
                     return `InsufficientStake: Provided ${stake}, Required ${minStake}.`;
                }
                
                return `${decoded.errorName}: ${decoded.args}`;
            } catch (e) {
                // ABI mismatch or unknown error
                return null;
            }
        }
    }
    return null;
}
