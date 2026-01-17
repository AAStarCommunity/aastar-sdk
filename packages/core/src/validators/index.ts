/**
 * Validation utilities for SDK parameters
 * Provides early error detection before contract calls
 */

import { isAddress } from 'viem';
import type { Address } from 'viem';

export class ValidationError extends Error {
  constructor(
    public field: string,
    message: string,
    public code: string = 'VALIDATION_ERROR'
  ) {
    super(`Validation failed for ${field}: ${message}`);
    this.name = 'ValidationError';
  }
}

/**
 * Validates Ethereum address format
 * @throws {ValidationError} if address is invalid
 */
export function validateAddress(addr: unknown, fieldName: string): asserts addr is Address {
  if (typeof addr !== 'string' || !isAddress(addr)) {
    throw new ValidationError(
      fieldName,
      `Invalid Ethereum address format. Got: ${addr}`,
      'INVALID_ADDRESS'
    );
  }
}

/**
 * Validates bigint amount is non-negative
 * @throws {ValidationError} if amount is negative
 */
export function validateAmount(amount: bigint, fieldName: string): void {
  if (amount < 0n) {
    throw new ValidationError(
      fieldName,
      `Amount cannot be negative. Got: ${amount}`,
      'INVALID_AMOUNT'
    );
  }
}

/**
 * Validates bigint is positive (> 0)
 * @throws {ValidationError} if value is zero or negative
 */
export function validatePositive(value: bigint, fieldName: string): void {
  if (value <= 0n) {
    throw new ValidationError(
      fieldName,
      `Value must be positive. Got: ${value}`,
      'INVALID_VALUE'
    );
  }
}

/**
 * Validates hex string format
 * @throws {ValidationError} if not valid hex
 */
export function validateHex(data: unknown, fieldName: string): asserts data is `0x${string}` {
  if (typeof data !== 'string' || !data.startsWith('0x')) {
    throw new ValidationError(
      fieldName,
      `Must be a hex string starting with 0x. Got: ${data}`,
      'INVALID_HEX'
    );
  }
}

/**
 * Validates required parameter is present
 * @throws {ValidationError} if value is null or undefined
 */
export function validateRequired<T>(value: T | null | undefined, fieldName: string): asserts value is T {
  if (value === null || value === undefined) {
    throw new ValidationError(
      fieldName,
      'Required parameter is missing',
      'REQUIRED_PARAMETER'
    );
  }
}
