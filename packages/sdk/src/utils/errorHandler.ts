/**
 * SDK Error Handling Utilities
 * 
 * 提供统一的错误处理和上下文化错误消息
 */

import type { Hex } from 'viem';

/**
 * 合约错误类型
 */
export interface ContractError extends Error {
    data?: {
        errorName?: string;
        args?: any[];
    };
    cause?: any;
    shortMessage?: string;
    details?: string;
}

/**
 * SDK 错误上下文
 */
export interface ErrorContext {
    operation: string;      // 操作名称，如 "launch community", "setup operator"
    account?: string;       // 相关账户地址
    contract?: string;      // 相关合约地址
    roleId?: Hex;          // 相关角色 ID
    additionalInfo?: Record<string, any>;  // 其他上下文信息
}

/**
 * 已知的合约错误及其友好消息
 */
const KNOWN_CONTRACT_ERRORS: Record<string, (context: ErrorContext, args?: any[]) => string> = {
    'RoleAlreadyGranted': (ctx, args) => {
        const roleId = args?.[0] || ctx.roleId || 'unknown';
        const user = args?.[1] || ctx.account || 'unknown';
        return `Account ${user} already has this role (${roleId}). Please use a different account or exit the role first.`;
    },
    
    'RoleNotConfigured': (ctx, args) => {
        const roleId = args?.[0] || ctx.roleId || 'unknown';
        return `Role ${roleId} is not configured in the Registry contract. Please configure the role first.`;
    },
    
    'RoleNotGranted': (ctx, args) => {
        const roleId = args?.[0] || ctx.roleId || 'unknown';
        const user = args?.[1] || ctx.account || 'unknown';
        return `Account ${user} does not have role ${roleId}. Please register for this role first.`;
    },
    
    'InsufficientStake': (ctx, args) => {
        const required = args?.[0] ? `Required: ${args[0]}` : '';
        const actual = args?.[1] ? `Actual: ${args[1]}` : '';
        return `Insufficient stake for this operation. ${required} ${actual}`.trim();
    },
    
    'InsufficientBalance': (ctx, args) => {
        return `Insufficient balance. Please ensure you have enough tokens.`;
    },
    
    'InvalidParameter': (ctx, args) => {
        const param = args?.[0] || 'unknown';
        return `Invalid parameter: ${param}. Please check your input.`;
    },
    
    'Unauthorized': (ctx) => {
        return `Unauthorized operation. Account ${ctx.account || 'unknown'} does not have permission.`;
    },
    
    'OwnableUnauthorizedAccount': (ctx, args) => {
        const account = args?.[0] || ctx.account || 'unknown';
        return `Account ${account} is not authorized to perform this operation. Only the contract owner can do this.`;
    }
};

/**
 * 从错误对象中提取错误名称
 */
function extractErrorName(error: ContractError): string | null {
    // 检查 error.data.errorName
    if (error.data?.errorName) {
        return error.data.errorName;
    }
    
    // 检查 error.message 中的错误名称
    const message = error.message || '';
    const errorMatch = message.match(/Error: (\w+)\(/);
    if (errorMatch) {
        return errorMatch[1];
    }
    
    // 检查序列化后的错误
    try {
        const errorString = JSON.stringify(error);
        for (const knownError of Object.keys(KNOWN_CONTRACT_ERRORS)) {
            if (errorString.includes(knownError)) {
                return knownError;
            }
        }
    } catch {
        // Ignore serialization errors
    }
    
    return null;
}

/**
 * 处理合约错误并返回友好的错误消息
 * 
 * @param error - 原始错误对象
 * @param context - 错误上下文
 * @returns 友好的错误消息
 */
export function handleContractError(error: any, context: ErrorContext): Error {
    const contractError = error as ContractError;
    
    // 提取错误名称
    const errorName = extractErrorName(contractError);
    
    // 如果是已知错误，返回友好消息
    if (errorName && KNOWN_CONTRACT_ERRORS[errorName]) {
        const args = contractError.data?.args;
        const friendlyMessage = KNOWN_CONTRACT_ERRORS[errorName](context, args);
        
        // 创建新错误，保留原始错误作为 cause
        const enhancedError = new Error(
            `Failed to ${context.operation}: ${friendlyMessage}`
        );
        (enhancedError as any).cause = error;
        (enhancedError as any).originalError = error;
        (enhancedError as any).errorName = errorName;
        (enhancedError as any).context = context;
        
        return enhancedError;
    }
    
    // 未知错误，返回带上下文的原始错误消息
    const originalMessage = contractError.message || 
                           contractError.shortMessage || 
                           contractError.details || 
                           'Unknown error';
    
    const enhancedError = new Error(
        `Failed to ${context.operation}: ${originalMessage}`
    );
    (enhancedError as any).cause = error;
    (enhancedError as any).originalError = error;
    (enhancedError as any).context = context;
    
    return enhancedError;
}

/**
 * 创建错误上下文的辅助函数
 */
export function createErrorContext(
    operation: string,
    options?: Partial<ErrorContext>
): ErrorContext {
    return {
        operation,
        ...options
    };
}
