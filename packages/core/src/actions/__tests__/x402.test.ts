import { describe, it, expect } from 'vitest';
import { x402NonceKey } from '../x402.js';
import { keccak256, encodeAbiParameters, parseAbiParameters } from 'viem';

describe('x402NonceKey', () => {
  const asset = '0x1234567890123456789012345678901234567890' as `0x${string}`;
  const from = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as `0x${string}`;
  const nonce = '0x0000000000000000000000000000000000000000000000000000000000000001' as `0x${string}`;

  it('matches keccak256(abi.encode(asset, from, nonce))', () => {
    const expected = keccak256(encodeAbiParameters(
      parseAbiParameters('address, address, bytes32'),
      [asset, from, nonce]
    ));
    expect(x402NonceKey(asset, from, nonce)).toBe(expected);
  });

  it('different nonces produce different keys', () => {
    const nonce2 = '0x0000000000000000000000000000000000000000000000000000000000000002' as `0x${string}`;
    expect(x402NonceKey(asset, from, nonce)).not.toBe(x402NonceKey(asset, from, nonce2));
  });

  it('different assets produce different keys', () => {
    const asset2 = '0x0987654321098765432109876543210987654321' as `0x${string}`;
    expect(x402NonceKey(asset, from, nonce)).not.toBe(x402NonceKey(asset2, from, nonce));
  });

  it('different from addresses produce different keys', () => {
    const from2 = '0x1111111111111111111111111111111111111111' as `0x${string}`;
    expect(x402NonceKey(asset, from, nonce)).not.toBe(x402NonceKey(asset, from2, nonce));
  });
});
