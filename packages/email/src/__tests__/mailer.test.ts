import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResendMailer, BatchSendError } from '../mailer.js';

const makeMockResend = (overrides: Record<string, unknown> = {}) => ({
  emails: {
    send: vi.fn().mockResolvedValue({ data: { id: 'email-123' }, error: null }),
    sendBatch: vi.fn().mockResolvedValue({
      data: [{ id: 'batch-1' }, { id: 'batch-2' }],
      error: null,
    }),
    ...overrides,
  },
});

// Patch Resend constructor to inject mock
vi.mock('resend', () => {
  let mockInstance: ReturnType<typeof makeMockResend>;
  return {
    Resend: vi.fn().mockImplementation(() => {
      mockInstance = makeMockResend();
      return mockInstance;
    }),
    __getMockInstance: () => mockInstance,
  };
});

import { Resend } from 'resend';

function getMock(): ReturnType<typeof makeMockResend> {
  return (Resend as unknown as { __getMockInstance: () => ReturnType<typeof makeMockResend> }).__getMockInstance();
}

describe('ResendMailer constructor', () => {
  it('throws on empty API key', () => {
    expect(() => new ResendMailer('')).toThrow('Resend API key is required');
  });

  it('constructs successfully with a key', () => {
    expect(() => new ResendMailer('re_test_key')).not.toThrow();
  });
});

describe('ResendMailer.fromEnv', () => {
  it('throws when RESEND_API_KEY is not set', () => {
    const orig = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;
    expect(() => ResendMailer.fromEnv()).toThrow('RESEND_API_KEY environment variable is not set');
    if (orig !== undefined) process.env.RESEND_API_KEY = orig;
  });

  it('constructs from env variable', () => {
    process.env.RESEND_API_KEY = 're_env_key';
    expect(() => ResendMailer.fromEnv()).not.toThrow();
    delete process.env.RESEND_API_KEY;
  });
});

describe('ResendMailer.send', () => {
  let mailer: ResendMailer;
  beforeEach(() => { mailer = new ResendMailer('re_test'); });

  it('returns { id } on success', async () => {
    const result = await mailer.send({ from: 'a@x.io', to: 'b@y.io', subject: 'Hi' });
    expect(result).toEqual({ id: 'email-123' });
  });

  it('strips idempotencyKey from email payload', async () => {
    await mailer.send({ from: 'a@x.io', to: 'b@y.io', subject: 'Hi', idempotencyKey: 'key-1' });
    const call = getMock().emails.send.mock.calls[0];
    expect(call[0]).not.toHaveProperty('idempotencyKey');
    expect(call[1]).toEqual({ idempotencyKey: 'key-1' });
  });

  it('passes idempotencyKey as second arg', async () => {
    await mailer.send({ from: 'a@x.io', to: 'b@y.io', subject: 'Hi', idempotencyKey: 'idem-42' });
    expect(getMock().emails.send.mock.calls[0][1]).toEqual({ idempotencyKey: 'idem-42' });
  });

  it('omits idempotencyKey arg when not set', async () => {
    await mailer.send({ from: 'a@x.io', to: 'b@y.io', subject: 'Hi' });
    expect(getMock().emails.send.mock.calls[0][1]).toBeUndefined();
  });

  it('throws on Resend error', async () => {
    getMock().emails.send.mockResolvedValueOnce({ data: null, error: { message: 'Auth failed' } });
    await expect(mailer.send({ from: 'a@x.io', to: 'b@y.io', subject: 'Hi' }))
      .rejects.toThrow('Failed to send email: Auth failed');
  });

  it('throws when no ID returned', async () => {
    getMock().emails.send.mockResolvedValueOnce({ data: {}, error: null });
    await expect(mailer.send({ from: 'a@x.io', to: 'b@y.io', subject: 'Hi' }))
      .rejects.toThrow('Resend returned no email ID');
  });
});

describe('ResendMailer.sendBatch', () => {
  let mailer: ResendMailer;
  beforeEach(() => { mailer = new ResendMailer('re_test'); });

  it('returns empty array for empty input', async () => {
    const result = await mailer.sendBatch([]);
    expect(result).toEqual([]);
    expect(getMock().emails.sendBatch).not.toHaveBeenCalled();
  });

  it('throws for > 100 emails', async () => {
    const emails = Array.from({ length: 101 }, (_, i) => ({
      from: 'a@x.io', to: `u${i}@y.io`, subject: 'Hi',
    }));
    await expect(mailer.sendBatch(emails)).rejects.toThrow('at most 100 emails');
  });

  it('returns ordered results on success', async () => {
    const result = await mailer.sendBatch([
      { from: 'a@x.io', to: 'b@y.io', subject: 'S1' },
      { from: 'a@x.io', to: 'c@y.io', subject: 'S2' },
    ]);
    expect(result).toEqual([{ index: 0, id: 'batch-1' }, { index: 1, id: 'batch-2' }]);
  });

  it('strips idempotencyKey from all batch items', async () => {
    await mailer.sendBatch([
      { from: 'a@x.io', to: 'b@y.io', subject: 'Hi', idempotencyKey: 'k1' },
    ]);
    const payload = getMock().emails.sendBatch.mock.calls[0][0];
    expect(payload[0]).not.toHaveProperty('idempotencyKey');
  });

  it('throws BatchSendError when any item has no ID', async () => {
    getMock().emails.sendBatch.mockResolvedValueOnce({
      data: [{ id: 'ok-1' }, { id: null }, { id: 'ok-3' }],
      error: null,
    });
    const emails = [
      { from: 'a@x.io', to: 'b@y.io', subject: 'S1' },
      { from: 'a@x.io', to: 'c@y.io', subject: 'S2' },
      { from: 'a@x.io', to: 'd@y.io', subject: 'S3' },
    ];
    await expect(mailer.sendBatch(emails)).rejects.toThrow(BatchSendError);
    try {
      await mailer.sendBatch(emails);
    } catch (e) {
      const err = e as BatchSendError;
      expect(err.failures).toEqual([{ index: 1, reason: 'No email ID returned for this item' }]);
    }
  });

  it('throws on top-level Resend error', async () => {
    getMock().emails.sendBatch.mockResolvedValueOnce({ data: null, error: { message: 'Rate limit' } });
    await expect(mailer.sendBatch([{ from: 'a@x.io', to: 'b@y.io', subject: 'Hi' }]))
      .rejects.toThrow('Failed to send batch emails: Rate limit');
  });
});
