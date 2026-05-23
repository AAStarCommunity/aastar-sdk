import { Resend } from 'resend';
import type { CreateEmailOptions } from 'resend';

/**
 * Options for sending a single email or one item in a batch.
 */
export interface MailOptions {
  /**
   * Sender address.
   * - Custom domains (e.g. `hi@aastar.io`) must be verified in the Resend dashboard
   *   (SPF/DKIM/DMARC DNS records) before use.
   * - Without domain verification, use `onboarding@resend.dev` (test only).
   */
  from: string;
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  attachments?: Array<{ filename: string; content: Buffer | string }>;
  headers?: Record<string, string>;
  tags?: Array<{ name: string; value: string }>;
  /**
   * ISO 8601 datetime with timezone offset for scheduled delivery.
   * Example: `"2026-06-01T09:00:00+07:00"` or `"2026-06-01T02:00:00Z"`.
   * Must be a future timestamp; Resend rejects past or timezone-ambiguous values.
   */
  scheduledAt?: string;
  /**
   * Idempotency key for agent retry scenarios.
   * Duplicate calls with the same key will not send the email again.
   * Only supported by `send()` — ignored by `sendBatch()`.
   */
  idempotencyKey?: string;
}

/** Result of a successful single send or one item in a batch result. */
export interface SendResult {
  id: string;
}

/** Per-item result for sendBatch — includes index for error attribution. */
export interface BatchSendResult {
  index: number;
  id: string;
}

/** Error thrown when one or more batch items fail. */
export class BatchSendError extends Error {
  constructor(
    message: string,
    public readonly failures: Array<{ index: number; reason: string }>,
  ) {
    super(message);
    this.name = 'BatchSendError';
  }
}

function toResendPayload(options: Omit<MailOptions, 'idempotencyKey'>): CreateEmailOptions {
  return options as unknown as CreateEmailOptions;
}

/**
 * ResendMailer — server-side email utility built on the Resend API.
 *
 * Install: `pnpm add @aastar/email`
 *
 * @example
 * ```ts
 * import { ResendMailer } from '@aastar/email';
 *
 * const mailer = ResendMailer.fromEnv(); // reads RESEND_API_KEY
 * await mailer.send({
 *   from: 'hi@aastar.io',
 *   to: 'user@example.com',
 *   subject: 'Welcome',
 *   html: '<h1>Hello!</h1>',
 * });
 * ```
 *
 * @example Agent tool with idempotency
 * ```ts
 * await mailer.send({
 *   from: 'hi@aastar.io',
 *   to: 'user@example.com',
 *   subject: 'Your receipt',
 *   html: '...',
 *   idempotencyKey: `receipt-${txHash}`,
 * });
 * ```
 */
export class ResendMailer {
  private client: Resend;

  /** @param apiKey - Resend API key from https://resend.com/api-keys */
  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('Resend API key is required. Get yours at https://resend.com/api-keys');
    }
    this.client = new Resend(apiKey);
  }

  /**
   * Send a single email.
   * @returns `{ id }` — Resend email ID for delivery status queries
   */
  async send(options: MailOptions): Promise<SendResult> {
    const { idempotencyKey, ...emailOptions } = options;
    const { data, error } = await this.client.emails.send(
      toResendPayload(emailOptions),
      idempotencyKey ? { idempotencyKey } : undefined,
    );
    if (error) throw new Error(`Failed to send email: ${error.message}`);
    if (!data?.id) throw new Error('Resend returned no email ID');
    return { id: data.id };
  }

  /**
   * Send a batch of emails (max 100 per request).
   * `idempotencyKey` is stripped per item — not supported by the batch endpoint.
   *
   * @throws {BatchSendError} if any item is missing an ID in the response
   * @returns Results in the same order as the input
   */
  async sendBatch(emails: MailOptions[]): Promise<BatchSendResult[]> {
    if (emails.length === 0) return [];
    if (emails.length > 100) {
      throw new Error('sendBatch supports at most 100 emails per request');
    }

    const payload = emails.map(({ idempotencyKey: _, ...rest }) => toResendPayload(rest));
    const { data, error } = await this.client.emails.sendBatch(payload);

    if (error) throw new Error(`Failed to send batch emails: ${error.message}`);

    const results = data ?? [];
    const failures: Array<{ index: number; reason: string }> = [];
    const successes: BatchSendResult[] = [];

    results.forEach((item, index) => {
      if (!item?.id) {
        failures.push({ index, reason: 'No email ID returned for this item' });
      } else {
        successes.push({ index, id: item.id });
      }
    });

    if (failures.length > 0) {
      throw new BatchSendError(
        `sendBatch: ${failures.length} of ${emails.length} emails failed`,
        failures,
      );
    }

    return successes;
  }

  /**
   * Create a ResendMailer from the `RESEND_API_KEY` environment variable.
   * Recommended for server-side and CI usage.
   * @throws if the environment variable is not set
   */
  static fromEnv(): ResendMailer {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      throw new Error(
        'RESEND_API_KEY environment variable is not set. Pass the key directly: new ResendMailer("re_...")',
      );
    }
    return new ResendMailer(key);
  }
}
