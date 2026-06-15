import { describe, it, expect } from 'vitest';
import { decodeAbiParameters, parseAbiParameters } from 'viem';
import { BLSHelpers } from '../../src/crypto/blsSigner';

/**
 * DVT co-sign helpers — frozen DVT program spec (hub YetAnotherAA-Validator#42).
 * signerMask bit i (LSB=0) → slot i+1 (1-indexed); proof = (uint256 signerMask, bytes sigG2).
 * Canonical golden-vector input userOpHash = 0x1111…11 (32 bytes).
 */
const CANONICAL_USEROP_HASH = ('0x' + '11'.repeat(32)) as `0x${string}`;

describe('BLSHelpers.slotsToSignerMask', () => {
  it('maps slot s → bit (s-1): slot 1 → 0b1', () => {
    expect(BLSHelpers.slotsToSignerMask([1])).toBe(1n);
  });

  it('slot 3 → bit 2 → 0b100 = 4n', () => {
    expect(BLSHelpers.slotsToSignerMask([3])).toBe(4n);
  });

  it('combines slots 1 + 3 → 0b101 = 5n (order-independent)', () => {
    expect(BLSHelpers.slotsToSignerMask([1, 3])).toBe(5n);
    expect(BLSHelpers.slotsToSignerMask([3, 1])).toBe(5n);
  });

  it('handles a high slot (255 → bit 254)', () => {
    expect(BLSHelpers.slotsToSignerMask([255])).toBe(1n << 254n);
  });

  it('rejects slot 0 (slots are 1-indexed)', () => {
    expect(() => BLSHelpers.slotsToSignerMask([0])).toThrow(/1-indexed/);
  });

  it('rejects a negative / non-integer slot', () => {
    expect(() => BLSHelpers.slotsToSignerMask([-1])).toThrow(/1-indexed/);
    expect(() => BLSHelpers.slotsToSignerMask([1.5])).toThrow(/1-indexed/);
  });

  it('rejects a slot above the uint8 range (256 / 257)', () => {
    expect(() => BLSHelpers.slotsToSignerMask([256])).toThrow(/\[1, 255\]/);
    expect(() => BLSHelpers.slotsToSignerMask([257])).toThrow(/\[1, 255\]/);
  });
});

describe('BLSHelpers.encodeDVTProof', () => {
  it('encodes (signerMask, sigG2) as a 2-tuple that round-trips', () => {
    const sigG2 = ('0x' + 'ab'.repeat(96)) as `0x${string}`;
    const proof = BLSHelpers.encodeDVTProof(5n, sigG2);

    const [mask, sig] = decodeAbiParameters(
      parseAbiParameters('uint256 signerMask, bytes sigG2'),
      proof
    );
    expect(mask).toBe(5n);
    expect(sig).toBe(sigG2);
  });

  it('does NOT include pkG1 / msgG2 (narrower than the v3 encodeBLSProof)', () => {
    const v3 = BLSHelpers.encodeBLSProof('0x01', '0x02', '0x03', 5n);
    const dvt = BLSHelpers.encodeDVTProof(5n, '0x02');
    // The 2-tuple proof is strictly shorter than the 4-field v3 proof.
    expect(dvt.length).toBeLessThan(v3.length);
  });

  it('integrates with slotsToSignerMask over the canonical input', () => {
    // Signers at slots 1 and 2 → mask 0b11 = 3.
    const mask = BLSHelpers.slotsToSignerMask([1, 2]);
    expect(mask).toBe(3n);
    const proof = BLSHelpers.encodeDVTProof(mask, CANONICAL_USEROP_HASH);
    const [decodedMask] = decodeAbiParameters(
      parseAbiParameters('uint256 signerMask, bytes sigG2'),
      proof
    );
    expect(decodedMask).toBe(3n);
  });
});
