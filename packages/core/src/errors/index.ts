/**
 * Error handling utilities for SDK
 * Provides consistent error types and error transformation from viem
 */

export enum ErrorCode {
  // Validation Errors (1xxx)
  INVALID_ADDRESS = 'E1001',
  INVALID_AMOUNT = 'E1002',
  INVALID_PARAMETER = 'E1003',
  REQUIRED_PARAMETER = 'E1004',
  INVALID_HEX = 'E1005',
  
  // Contract Errors (2xxx)
  CONTRACT_REVERT = 'E2001',
  INSUFFICIENT_BALANCE = 'E2002',
  UNAUTHORIZED = 'E2003',
  PAUSED = 'E2004',
  ROLE_NOT_CONFIGURED = 'E2005',
  TOKEN_NOT_FOUND = 'E2006',
  
  // Network Errors (3xxx)
  NETWORK_TIMEOUT = 'E3001',
  RPC_ERROR = 'E3002',
  CONNECTION_REFUSED = 'E3003',
  
  // SDK Errors (4xxx)
  NOT_IMPLEMENTED = 'E4001',
  INTERNAL_ERROR = 'E4002',
  INVALID_CONFIGURATION = 'E4003',
  
  // Bundler & AA Errors (5xxx)
  BUNDLER_ERROR = 'E5001',
  BUNDLER_USER_OP_REVERTED = 'E5002',
  BUNDLER_SIGNATURE_INVALID = 'E5003',
  BUNDLER_INSUFFICIENT_FUNDS = 'E5004',
  BUNDLER_NONCE_TOO_LOW = 'E5005',
  BUNDLER_RATE_LIMIT = 'E5006',
}

/**
 * Base SDK error class with structured error information
 */
export class AAStarError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public cause?: Error,
    public data?: unknown
  ) {
    super(message);
    this.name = 'AAStarError';
    
    // Maintains proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AAStarError);
    }
  }
  
  /**
   * Convert viem error to AAStarError with appropriate error code
   */
  static fromViemError(error: Error, context?: string): AAStarError {
    const msg = error.message.toLowerCase();
    
    // Contract revert patterns
    if (msg.includes('insufficient balance') || msg.includes('insufficient funds')) {
      return new AAStarError(
        ErrorCode.INSUFFICIENT_BALANCE,
        'Insufficient token balance for this operation',
        error
      );
    }
    
    if (msg.includes('paused')) {
      return new AAStarError(
        ErrorCode.PAUSED,
        'Contract is currently paused',
        error
      );
    }
    
    if (msg.includes('unauthorized') || msg.includes('not authorized')) {
      return new AAStarError(
        ErrorCode.UNAUTHORIZED,
        'Unauthorized to perform this action',
        error
      );
    }
    
    if (msg.includes('role not configured')) {
      return new AAStarError(
        ErrorCode.ROLE_NOT_CONFIGURED,
        'Role has not been configured in registry',
        error
      );
    }
    
    // Network errors
    if (msg.includes('timeout') || msg.includes('etimedout')) {
      return new AAStarError(
        ErrorCode.NETWORK_TIMEOUT,
        'Network request timed out',
        error
      );
    }
    
    if (msg.includes('econnrefused') || msg.includes('connection refused')) {
      return new AAStarError(
        ErrorCode.CONNECTION_REFUSED,
        'Could not connect to RPC endpoint',
        error
      );
    }
    
    if (msg.includes('rpc')) {
      return new AAStarError(
        ErrorCode.RPC_ERROR,
        'RPC request failed',
        error
      );
    }
    
    // Default to contract revert
    return new AAStarError(
      ErrorCode.CONTRACT_REVERT,
      context ? `Contract call failed: ${context}` : error.message,
      error
    );
  }

  /**
   * Parse bundler error strings into structured AAStarError
   */
  static fromBundlerError(error: any): AAStarError {
    const message = typeof error === 'string' ? error : (error.message || JSON.stringify(error));
    const code = error.code;
    const msgLower = message.toLowerCase();

    // Mapping ERC-4337 Error Codes (AAxx)
    if (msgLower.includes('aa10') || msgLower.includes('invalid signature')) {
        return new AAStarError(ErrorCode.BUNDLER_SIGNATURE_INVALID, `AA10: Invalid UserOperation signature`, error);
    }
    if (msgLower.includes('aa21') || msgLower.includes('aa25') || msgLower.includes('reverted')) {
        return new AAStarError(ErrorCode.BUNDLER_USER_OP_REVERTED, `AA2x: UserOperation execution reverted`, error);
    }
    if (msgLower.includes('aa31') || msgLower.includes('aa33') || msgLower.includes('paymaster deposit too low')) {
        return new AAStarError(ErrorCode.BUNDLER_INSUFFICIENT_FUNDS, `AA3x: Paymaster or account insufficient funds`, error);
    }
    if (msgLower.includes('aa24') || msgLower.includes('nonce too low')) {
        return new AAStarError(ErrorCode.BUNDLER_NONCE_TOO_LOW, `AA24: Nonce too low or already used`, error);
    }
    if (code === -32604 || msgLower.includes('rate limit')) {
        return new AAStarError(ErrorCode.BUNDLER_RATE_LIMIT, `Bundler rate limit exceeded (429)`, error);
    }

    return new AAStarError(ErrorCode.BUNDLER_ERROR, `Bundler error: ${message}`, error);
  }
  
  /**
   * Convert to JSON for logging/reporting
   */
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      data: this.data,
      cause: this.cause?.message,
      stack: this.stack,
    };
  }
}
