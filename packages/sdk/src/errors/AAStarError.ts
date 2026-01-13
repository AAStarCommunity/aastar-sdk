
export enum AAStarErrorCode {
    VALIDATION_ERROR = 'VALIDATION_ERROR',
    CONTRACT_ERROR = 'CONTRACT_ERROR',
    NETWORK_ERROR = 'NETWORK_ERROR',
    CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
    UNKNOWN_ERROR = 'UNKNOWN_ERROR',
    // ... add more as needed
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
