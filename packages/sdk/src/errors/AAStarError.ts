
export enum AAStarErrorCode {
    VALIDATION_ERROR = 'VALIDATION_ERROR',
    CONTRACT_ERROR = 'CONTRACT_ERROR',
    NETWORK_ERROR = 'NETWORK_ERROR',
    CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
    INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
    PERMISSION_DENIED = 'PERMISSION_DENIED',
    OPERATION_FAILED = 'OPERATION_FAILED',
    UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export class AAStarError extends Error {
    public readonly code: AAStarErrorCode;
    public readonly details?: any;

    constructor(message: string, code: AAStarErrorCode = AAStarErrorCode.UNKNOWN_ERROR, details?: any) {
        super(message);
        this.name = 'AAStarError';
        this.code = code;
        this.details = details;
    }
}

/**
 * Error factory functions for consistent error creation
 */
export const createError = {
    validation: (field: string, reason: string): AAStarError =>
        new AAStarError(
            `Validation failed for ${field}: ${reason}`,
            AAStarErrorCode.VALIDATION_ERROR,
            { field, reason }
        ),

    contract: (contract: string, reason: string): AAStarError =>
        new AAStarError(
            `Contract ${contract} error: ${reason}`,
            AAStarErrorCode.CONTRACT_ERROR,
            { contract, reason }
        ),

    network: (operation: string, reason: string): AAStarError =>
        new AAStarError(
            `Network error during ${operation}: ${reason}`,
            AAStarErrorCode.NETWORK_ERROR,
            { operation, reason }
        ),

    insufficientFunds: (required: string, available: string): AAStarError =>
        new AAStarError(
            `Insufficient funds: required ${required}, available ${available}`,
            AAStarErrorCode.INSUFFICIENT_FUNDS,
            { required, available }
        ),

    permissionDenied: (operation: string, reason: string): AAStarError =>
        new AAStarError(
            `Permission denied for ${operation}: ${reason}`,
            AAStarErrorCode.PERMISSION_DENIED,
            { operation, reason }
        ),

    operationFailed: (operation: string, reason: string): AAStarError =>
        new AAStarError(
            `Operation ${operation} failed: ${reason}`,
            AAStarErrorCode.OPERATION_FAILED,
            { operation, reason }
        ),
};
