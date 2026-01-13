import { decodeErrorResult, type Hex } from 'viem';
import { RegistryABI, SuperPaymasterABI, GTokenStakingABI, MySBTABI, xPNTsTokenABI } from '../index.js';

const ABIS_TO_TRY = [
    { name: 'Registry', abi: RegistryABI },
    { name: 'SuperPaymaster', abi: SuperPaymasterABI },
    { name: 'GTokenStaking', abi: GTokenStakingABI },
    { name: 'MySBT', abi: MySBTABI },
    { name: 'xPNTsToken', abi: xPNTsTokenABI }
];

export function decodeContractError(error: any): string | null {
    if (!error) return null;

    // 1. Try to extract data from various error structures (viem, common RPC)
    let data: Hex | undefined;
    
    if (typeof error === 'object') {
        // Walk for internal data (viem pattern)
        if (error.walk) {
            const internalError = error.walk((e: any) => e.data);
            data = internalError?.data;
        }
        
        // Fallback to direct properties
        if (!data) {
            data = error.data || (error.error && error.error.data) || (error.cause && error.cause.data);
        }
    }

    if (!data) {
        // Handle "contract reverted" or similar string errors
        const msg = error.message || String(error);
        if (msg.includes('reverted')) return msg;
        return null;
    }

    // 2. Iterate through known ABIs to decode
    for (const { name, abi } of ABIS_TO_TRY) {
        try {
            const decoded = decodeErrorResult({
                abi: abi as any,
                data: data as Hex
            });

            if (decoded) {
                return formatDecodedError(name, decoded);
            }
        } catch (e) {
            // Mismatch, continue to next ABI
        }
    }

    return `Unknown Error (data: ${data.slice(0, 10)}...)`;
}

function formatDecodedError(contractName: string, decoded: any): string {
    const { errorName, args } = decoded;

    // Specialized formatting for common errors
    switch (errorName) {
        case 'RoleNotConfigured':
            return `[${contractName}] RoleNotConfigured: Role ${args[0]} is ${args[1] ? 'ACTIVE' : 'INACTIVE'}.`;
        case 'RoleAlreadyGranted':
            return `[${contractName}] RoleAlreadyGranted: User ${args[1]} already has role ${args[0]}.`;
        case 'InsufficientStake':
            return `[${contractName}] InsufficientStake: Provided ${args[0].toString()}, Required ${args[1].toString()}.`;
        case 'InsufficientBalance':
            return `[${contractName}] InsufficientBalance: Available ${args[0].toString()}, Required ${args[1].toString()}.`;
        case 'InvalidParameter':
            return `[${contractName}] InvalidParameter: ${args[0]}`;
        case 'Unauthorized':
            return `[${contractName}] Unauthorized: Caller does not have permission.`;
        case 'RoleNotGranted':
            return `[${contractName}] RoleNotGranted: User ${args[1]} does not have role ${args[0]}.`;
        default:
            return `[${contractName}] ${errorName}${args && args.length > 0 ? ': ' + JSON.stringify(args, (_, v) => typeof v === 'bigint' ? v.toString() : v) : ''}`;
    }
}
