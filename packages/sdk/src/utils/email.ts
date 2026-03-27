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
   * - Without domain verification, use `onboarding@resend.dev` (test only, sends to
   *   the account's own email address).
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
  scheduledAt?: string;
  /**
   * Idempotency key for agent retry scenarios.
   * When set, duplicate requests with the same key will not send the email again.
   * Note: only supported by `send()`, not `sendBatch()`.
   */
  idempotencyKey?: string;
}

/**
 * ResendMailer — email utility built on the Resend API.
 *
 * Exported from `@aastar/sdk` utils so agents can send emails without extra installs.
 *
 * ---
 *
 * ## Quick start
 *
 * ```ts
 * import { ResendMailer } from '@aastar/sdk';
 *
 * const mailer = new ResendMailer('re_your_api_key');
 *
 * await mailer.send({
 *   from: 'onboarding@resend.dev', // no domain verification needed for testing
 *   to: 'user@example.com',
 *   subject: 'Hello from AAstar',
 *   html: '<h1>Welcome!</h1>',
 * });
 * ```
 *
 * ---
 *
 * ## Custom sender domain (recommended for production)
 *
 * Example: send as `hi@aastar.io`
 *
 * **Step 1** — Add and verify the domain in Resend
 * 1. Go to https://resend.com → Domains → Add Domain → enter `aastar.io`
 * 2. Add the DNS records shown (SPF, DKIM, optional DMARC)
 * 3. Click Verify in the Resend dashboard; status becomes Verified once DNS propagates
 *
 * **Step 2** — Use the verified address in code
 *
 * ```ts
 * await mailer.send({
 *   from: 'hi@aastar.io',
 *   to: 'user@example.com',
 *   subject: 'Welcome to AAstar',
 *   html: '<h1>Hello!</h1>',
 * });
 * ```
 *
 * ---
 *
 * ## Batch sending
 *
 * ```ts
 * const results = await mailer.sendBatch([
 *   { from: 'hi@aastar.io', to: 'a@example.com', subject: 'Hi A', text: 'Hello A' },
 *   { from: 'hi@aastar.io', to: 'b@example.com', subject: 'Hi B', text: 'Hello B' },
 * ]);
 * // results: [{ id: '...' }, { id: '...' }]
 * ```
 *
 * ---
 *
 * ## Load API key from environment (recommended for servers/CI)
 *
 * ```ts
 * // Set RESEND_API_KEY=re_xxx in environment
 * const mailer = ResendMailer.fromEnv();
 * ```
 *
 * ---
 *
 * ## Use as an AI agent tool
 *
 * `ResendMailer` is exported from `@aastar/sdk` — no extra dependencies needed.
 * Set `RESEND_API_KEY` in the environment and call directly.
 *
 * ```ts
 * import { ResendMailer } from '@aastar/sdk';
 *
 * const sendEmailTool = {
 *   name: 'send_email',
 *   description: 'Send an email via Resend',
 *   parameters: { from, to, subject, html },
 *   execute: (params) => ResendMailer.fromEnv().send(params),
 * };
 * ```
 *
 * **Idempotency key (recommended for agent retry scenarios):**
 *
 * ```ts
 * await mailer.send({
 *   from: 'hi@aastar.io',
 *   to: 'user@example.com',
 *   subject: 'Your transaction receipt',
 *   html: '...',
 *   idempotencyKey: `tx-receipt-${txHash}`,
 * });
 * ```
 */
export class ResendMailer {
  private client: Resend;

  /**
   * @param apiKey - Resend API key. Obtain from https://resend.com/api-keys
   */
  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error(
        'Resend API key is required. Get yours at https://resend.com/api-keys',
      );
    }
    this.client = new Resend(apiKey);
  }

  /**
   * Send a single email.
   * @returns `{ id }` — Resend email ID, usable for delivery status queries
   */
  async send(options: MailOptions): Promise<{ id: string }> {
    const { idempotencyKey, ...emailOptions } = options;
    const { data, error } = await this.client.emails.send(
      emailOptions as CreateEmailOptions,
      idempotencyKey ? { idempotencyKey } : undefined,
    );
    if (error) {
      throw new Error(`Failed to send email: ${error.message}`);
    }
    if (!data?.id) {
      throw new Error('Resend returned no email ID');
    }
    return { id: data.id };
  }

  /**
   * Send a batch of emails (max 100 per request).
   * Note: `idempotencyKey` is not supported by the Resend batch API and will be ignored.
   * @returns List of `{ id }` objects in the same order as the input
   */
  async sendBatch(emails: MailOptions[]): Promise<Array<{ id: string }>> {
    if (emails.length === 0) return [];
    if (emails.length > 100) {
      throw new Error('Batch send supports at most 100 emails per request.');
    }
    // Strip idempotencyKey — not supported by the Resend batch endpoint
    const payload = emails.map(({ idempotencyKey: _, ...rest }) => rest) as CreateEmailOptions[];
    const { data, error } = await this.client.emails.sendBatch(payload);
    if (error) {
      throw new Error(`Failed to send batch emails: ${error.message}`);
    }
    return (data ?? []).map((item) => ({ id: item.id }));
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
