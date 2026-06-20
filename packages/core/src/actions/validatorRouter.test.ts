import { describe, it, expect } from 'vitest';
import { INLINE_ALG_IDS, needsValidatorRouter } from './validatorRouter.js';

describe('needsValidatorRouter', () => {
  it('exposes the inline algIds (ECDSA 0x02, P256 0x03, COMBINED_T1 0x06)', () => {
    expect(INLINE_ALG_IDS).toEqual([0x02, 0x03, 0x06]);
  });

  it('[0x01] (BLS) -> true (router-delegated)', () => {
    expect(needsValidatorRouter([0x01])).toBe(true);
  });

  it('[0x02] (ECDSA) -> false (inline)', () => {
    expect(needsValidatorRouter([0x02])).toBe(false);
  });

  it('[0x02, 0x03, 0x06] (all inline) -> false', () => {
    expect(needsValidatorRouter([0x02, 0x03, 0x06])).toBe(false);
  });

  it('[0x02, 0x01] (one router-delegated mixed in) -> true', () => {
    expect(needsValidatorRouter([0x02, 0x01])).toBe(true);
  });

  it('[0x08] (session) -> true (router-delegated)', () => {
    expect(needsValidatorRouter([0x08])).toBe(true);
  });

  it('[] (empty) -> false', () => {
    expect(needsValidatorRouter([])).toBe(false);
  });
});
