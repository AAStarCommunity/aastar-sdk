// Unit tests for M11 hardening modules: RateLimiter and MainnetChecklist.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RateLimiter, InMemoryRateLimitStore } from '../hardening/RateLimiter.js';
import { runMainnetChecklist } from '../hardening/MainnetChecklist.js';
import type { MainnetChecklistInput } from '../hardening/MainnetChecklist.js';
import type { SporeAgent } from '../SporeAgent.js';

// ─── RateLimiter tests ────────────────────────────────────────────────────────

describe('RateLimiter', () => {
  describe('basic allow / deny', () => {
    it('allows messages within burst limit', async () => {
      const limiter = new RateLimiter({ ratePerSecond: 1, burstLimit: 5 });
      for (let i = 0; i < 5; i++) {
        expect(await limiter.allow('sender-a')).toBe(true);
      }
    });

    it('denies when bucket is exhausted', async () => {
      const limiter = new RateLimiter({ ratePerSecond: 0.001, burstLimit: 3 });
      await limiter.allow('sender-b');
      await limiter.allow('sender-b');
      await limiter.allow('sender-b');
      // Bucket exhausted — next message should be denied
      expect(await limiter.allow('sender-b')).toBe(false);
    });

    it('allows different senders independently', async () => {
      const limiter = new RateLimiter({ ratePerSecond: 0.001, burstLimit: 2 });
      // Exhaust sender-c
      await limiter.allow('sender-c');
      await limiter.allow('sender-c');
      expect(await limiter.allow('sender-c')).toBe(false);
      // sender-d is unaffected
      expect(await limiter.allow('sender-d')).toBe(true);
    });
  });

  describe('token refill', () => {
    it('refills tokens over time', async () => {
      // Use a custom store to control the clock
      const store = new InMemoryRateLimitStore();
      const limiter = new RateLimiter({ ratePerSecond: 10, burstLimit: 5, store });
      const key = 'sender-e';

      // Exhaust the bucket
      for (let i = 0; i < 5; i++) await limiter.allow(key);
      expect(await limiter.allow(key)).toBe(false);

      // Simulate 2 seconds passing — manually set lastRefill to 2s ago
      store.setLastRefill(key, Date.now() - 2000);

      // Should have refilled ~20 tokens (capped at burstLimit=5)
      expect(await limiter.allow(key)).toBe(true);
    });

    it('does not exceed burstLimit on refill', async () => {
      const store = new InMemoryRateLimitStore();
      const limiter = new RateLimiter({ ratePerSecond: 100, burstLimit: 3, store });
      const key = 'sender-f';

      // Trigger initial bucket creation
      await limiter.allow(key);
      // Set lastRefill to 10s ago — would add 1000 tokens but capped at burstLimit
      store.setLastRefill(key, Date.now() - 10_000);
      store.setTokens(key, 0); // empty bucket

      // After refill, should have exactly burstLimit tokens
      expect(await limiter.remaining(key)).toBe(0); // before refill (no time passing)
      expect(await limiter.allow(key)).toBe(true); // this triggers refill
      // After consuming 1, remaining should be burstLimit - 1 = 2
      const rem = await limiter.remaining(key);
      expect(rem).toBe(2);
    });
  });

  describe('remaining()', () => {
    it('returns burstLimit for new keys', async () => {
      const limiter = new RateLimiter({ burstLimit: 7 });
      expect(await limiter.remaining('new-key')).toBe(7);
    });

    it('decreases as messages are sent', async () => {
      const limiter = new RateLimiter({ ratePerSecond: 0.001, burstLimit: 10 });
      await limiter.allow('key-g');
      await limiter.allow('key-g');
      const rem = await limiter.remaining('key-g');
      expect(rem).toBe(8);
    });
  });

  describe('reset()', () => {
    it('resets bucket to full', async () => {
      const limiter = new RateLimiter({ ratePerSecond: 0.001, burstLimit: 3 });
      await limiter.allow('key-h');
      await limiter.allow('key-h');
      await limiter.allow('key-h');
      expect(await limiter.allow('key-h')).toBe(false);

      await limiter.reset('key-h');
      expect(await limiter.allow('key-h')).toBe(true);
    });
  });

  describe('maxKeys eviction', () => {
    it('evicts oldest key when maxKeys is exceeded', async () => {
      const limiter = new RateLimiter({ ratePerSecond: 0.001, burstLimit: 2, maxKeys: 3 });
      // Fill to capacity
      await limiter.allow('k1');
      await limiter.allow('k2');
      await limiter.allow('k3');
      // k1 exhausted
      await limiter.allow('k1');
      await limiter.allow('k1');

      // Adding k4 evicts k1 (oldest)
      await limiter.allow('k4');

      // k1 bucket is reset by eviction, so it now has a fresh full bucket
      expect(await limiter.remaining('k1')).toBe(2);
    });
  });

  describe('injectable store', () => {
    it('uses provided store instead of default', async () => {
      const store = new InMemoryRateLimitStore();
      const setSpy = vi.spyOn(store, 'setTokens');
      const limiter = new RateLimiter({ store, burstLimit: 5 });
      await limiter.allow('x');
      expect(setSpy).toHaveBeenCalled();
    });
  });
});

// ─── MainnetChecklist tests ───────────────────────────────────────────────────

describe('MainnetChecklist', () => {
  const goodInput: MainnetChecklistInput = {
    agent: {} as SporeAgent,
    relayUrls: ['wss://relay.damus.io', 'wss://nos.lol'],
    hasRateLimiter: true,
    hasPersistentNonceStore: true,
    hasVoucherSigVerifier: true,
    gatewayHasAuthToken: true,
    gatewayTimeoutMs: 30_000,
    x402MaxValidBeforeWindowSeconds: 86400,
    userOpAuthModeIsNotOpen: true,
  };

  it('passes when all settings are correct', () => {
    const report = runMainnetChecklist(goodInput);
    expect(report.passed).toBe(true);
    expect(report.criticalFailures).toBe(0);
    expect(report.highFailures).toBe(0);
  });

  it('fails CRITICAL on insecure ws:// relay', () => {
    const report = runMainnetChecklist({
      ...goodInput,
      relayUrls: ['ws://insecure.relay.example'],
    });
    const check = report.checks.find((c) => c.id === 'SEC-1');
    expect(check?.passed).toBe(false);
    expect(check?.severity).toBe('CRITICAL');
    expect(report.passed).toBe(false);
    expect(report.criticalFailures).toBeGreaterThan(0);
  });

  it('fails HIGH when rate limiter is missing', () => {
    const report = runMainnetChecklist({ ...goodInput, hasRateLimiter: false });
    const check = report.checks.find((c) => c.id === 'SEC-2');
    expect(check?.passed).toBe(false);
    expect(check?.severity).toBe('HIGH');
    expect(report.passed).toBe(false);
  });

  it('fails CRITICAL when using InMemoryNonceStore', () => {
    const report = runMainnetChecklist({ ...goodInput, hasPersistentNonceStore: false });
    const check = report.checks.find((c) => c.id === 'SEC-3');
    expect(check?.passed).toBe(false);
    expect(check?.severity).toBe('CRITICAL');
  });

  it('fails HIGH when ChannelBridge skips voucher verification', () => {
    const report = runMainnetChecklist({ ...goodInput, hasVoucherSigVerifier: false });
    const check = report.checks.find((c) => c.id === 'SEC-4');
    expect(check?.passed).toBe(false);
    expect(check?.severity).toBe('HIGH');
  });

  it('fails HIGH when gateway has no auth token', () => {
    const report = runMainnetChecklist({ ...goodInput, gatewayHasAuthToken: false });
    const check = report.checks.find((c) => c.id === 'SEC-5');
    expect(check?.passed).toBe(false);
    expect(check?.severity).toBe('HIGH');
  });

  it('fails MEDIUM when gateway timeout exceeds 30s', () => {
    const report = runMainnetChecklist({ ...goodInput, gatewayTimeoutMs: 60_000 });
    const check = report.checks.find((c) => c.id === 'SEC-6');
    expect(check?.passed).toBe(false);
    expect(check?.severity).toBe('MEDIUM');
    // MEDIUM doesn't block mainnet readiness (only CRITICAL and HIGH do)
    expect(report.passed).toBe(true);
  });

  it('fails HIGH when X402 validBefore window exceeds 24h', () => {
    const report = runMainnetChecklist({ ...goodInput, x402MaxValidBeforeWindowSeconds: 86401 });
    const check = report.checks.find((c) => c.id === 'SEC-7');
    expect(check?.passed).toBe(false);
    expect(check?.severity).toBe('HIGH');
    expect(report.passed).toBe(false);
  });

  it('fails CRITICAL when UserOpBridge is in open mode', () => {
    const report = runMainnetChecklist({ ...goodInput, userOpAuthModeIsNotOpen: false });
    const check = report.checks.find((c) => c.id === 'SEC-8');
    expect(check?.passed).toBe(false);
    expect(check?.severity).toBe('CRITICAL');
    expect(report.passed).toBe(false);
  });

  it('fails CRITICAL when no relays are configured', () => {
    const report = runMainnetChecklist({ ...goodInput, relayUrls: [] });
    const check = report.checks.find((c) => c.id === 'SEC-9');
    expect(check?.passed).toBe(false);
    expect(check?.severity).toBe('CRITICAL');
  });

  it('skips optional checks when input fields are undefined', () => {
    const minimal: MainnetChecklistInput = {
      agent: {} as SporeAgent,
      relayUrls: ['wss://relay.damus.io'],
      hasRateLimiter: true,
      hasPersistentNonceStore: true,
      hasVoucherSigVerifier: true,
    };
    const report = runMainnetChecklist(minimal);
    // SEC-5 (gateway auth), SEC-6 (gateway timeout), SEC-7 (x402), SEC-8 (userop) skipped
    const ids = report.checks.map((c) => c.id);
    expect(ids).not.toContain('SEC-5');
    expect(ids).not.toContain('SEC-6');
    expect(ids).not.toContain('SEC-7');
    expect(ids).not.toContain('SEC-8');
    expect(report.passed).toBe(true);
  });

  describe('summary()', () => {
    it('returns all-pass summary when no failures', () => {
      const report = runMainnetChecklist(goodInput);
      expect(report.summary()).toContain('Ready for mainnet');
    });

    it('includes failure details in summary', () => {
      const report = runMainnetChecklist({ ...goodInput, hasRateLimiter: false });
      const summary = report.summary();
      expect(summary).toContain('NOT ready for mainnet');
      expect(summary).toContain('SEC-2');
    });
  });
});
