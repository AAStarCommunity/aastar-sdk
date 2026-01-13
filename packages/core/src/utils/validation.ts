import { isAddress, getAddress } from 'viem';

export class AAStarValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AAStarValidationError';
    }
}

/**
 * Validates an Ethereum address.
 * Throws AAStarValidationError if invalid.
 */
export function validateAddress(address: string, fieldName: string = 'Address'): `0x${string}` {
    if (!address) {
        throw new AAStarValidationError(`${fieldName} is required.`);
    }
    if (!isAddress(address)) {
        throw new AAStarValidationError(`${fieldName} must be a valid Ethereum address. Got: ${address}`);
    }
    return getAddress(address); // Returns checksummed address
}

/**
 * Validates a BigInt amount.
 * @param amount The value to check
 * @param fieldName Name for error messages
 * @param min Minimum value (default 0n)
 * @param max Maximum value (optional)
 */
export function validateAmount(
    amount: bigint, 
    fieldName: string = 'Amount', 
    min: bigint = 0n, 
    max?: bigint
): bigint {
    if (amount < min) {
        throw new AAStarValidationError(`${fieldName} must be >= ${min}. Got: ${amount}`);
    }
    if (max !== undefined && amount > max) {
        throw new AAStarValidationError(`${fieldName} must be <= ${max}. Got: ${amount}`);
    }
    return amount;
}

/**
 * Validates a UINT128 value (Common in Paymaster Data).
 */
export function validateUint128(value: bigint, fieldName: string = 'Value'): bigint {
    const MAX_UINT128 = (1n << 128n) - 1n;
    return validateAmount(value, fieldName, 0n, MAX_UINT128);
}

/**
 * Validates a Hex string.
 */
export function validateHex(value: string, fieldName: string = 'Hex'): `0x${string}` {
    if (!value.startsWith('0x')) {
        throw new AAStarValidationError(`${fieldName} must start with 0x. Got: ${value}`);
    }
    const hexRegex = /^0x[0-9a-fA-F]*$/;
    if (!hexRegex.test(value)) {
        throw new AAStarValidationError(`${fieldName} must be a valid hex string.`);
    }
    return value as `0x${string}`;
}
