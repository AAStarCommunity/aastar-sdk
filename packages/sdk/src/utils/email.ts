import { Resend } from 'resend';
import type { CreateEmailOptions } from 'resend';

/**
 * 邮件发送选项
 */
export interface MailOptions {
  /** 发件人地址。
   *  - 使用自定义域名（如 `hi@aastar.io`）前，需在 Resend 后台完成域名验证（添加 SPF/DKIM/DMARC DNS 记录）。
   *  - 未验证域名时只能使用 Resend 测试地址 `onboarding@resend.dev`，且只能发往账号绑定邮箱。
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
  /** agent 重试场景：设置后相同 key 的重复请求不会重复发送 */
  idempotencyKey?: string;
}

/**
 * ResendMailer — 基于 Resend API 的邮件工具类
 *
 * 集成在 `@aastar/sdk` 的 utils 模块下，开发者填入 API Key 后即可直接发送邮件，无需额外配置。
 *
 * ---
 *
 * ## 快速开始
 *
 * ```ts
 * import { ResendMailer } from '@aastar/sdk';
 *
 * const mailer = new ResendMailer('re_your_api_key');
 *
 * await mailer.send({
 *   from: 'onboarding@resend.dev', // 测试用，无需域名验证
 *   to: 'user@example.com',
 *   subject: 'Hello from AAstar',
 *   html: '<h1>Welcome!</h1>',
 * });
 * ```
 *
 * ---
 *
 * ## 使用自定义域名发件（推荐生产环境）
 *
 * 例如用 `hi@aastar.io` 作为发件人：
 *
 * **Step 1** — 在 Resend 后台添加并验证域名
 * 1. 登录 https://resend.com → Domains → Add Domain → 填入 `aastar.io`
 * 2. 按提示在 DNS 服务商处添加以下记录：
 *    - SPF：`TXT @ "v=spf1 include:amazonses.com ~all"`
 *    - DKIM：`TXT resend._domainkey.<你的 DKIM 值>`
 *    - DMARC（可选但推荐）：`TXT _dmarc "v=DMARC1; p=none;"`
 * 3. 回到 Resend 控制台点击 Verify，DNS 生效后状态变为 Verified ✓
 *
 * **Step 2** — 代码中直接使用
 *
 * ```ts
 * await mailer.send({
 *   from: 'hi@aastar.io',          // ✅ 验证后可用任意该域名下的地址
 *   to: 'user@example.com',
 *   subject: 'Welcome to AAstar',
 *   html: '<h1>Hello!</h1>',
 * });
 * ```
 *
 * ---
 *
 * ## 批量发送
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
 * ## 从环境变量读取 Key（服务端/CI 推荐）
 *
 * ```ts
 * // 设置环境变量 RESEND_API_KEY=re_xxx
 * const mailer = ResendMailer.fromEnv();
 * ```
 *
 * ---
 *
 * ## 作为 AI Agent Tool 使用
 *
 * `ResendMailer` 已随 `@aastar/sdk` 导出，agent 无需额外安装依赖。
 * 设置 `RESEND_API_KEY` 环境变量后直接调用即可。
 *
 * **Claude / LangChain 等框架包成 tool 的最简写法：**
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
 * **幂等 Key（agent 重试场景必备）：**
 * 设置 `idempotencyKey` 后，agent 重试时不会重复发送同一封邮件。
 *
 * ```ts
 * await mailer.send({
 *   from: 'hi@aastar.io',
 *   to: 'user@example.com',
 *   subject: 'Your transaction receipt',
 *   html: '...',
 *   idempotencyKey: `tx-receipt-${txHash}`, // 用 txHash 或任意唯一 ID
 * });
 * ```
 */
export class ResendMailer {
  private client: Resend;

  /**
   * @param apiKey - Resend API Key（以 `re_` 开头），从 https://resend.com/api-keys 获取
   */
  constructor(apiKey: string) {
    if (!apiKey || !apiKey.startsWith('re_')) {
      throw new Error(
        'Invalid Resend API key. Keys should start with "re_". Get yours at https://resend.com/api-keys',
      );
    }
    this.client = new Resend(apiKey);
  }

  /**
   * 发送单封邮件
   * @returns `{ id }` — Resend 返回的邮件 ID，可用于查询发送状态
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
    return { id: data!.id };
  }

  /**
   * 批量发送邮件（最多 100 封/次）
   * @returns 每封邮件的 `{ id }` 列表，顺序与入参一致
   */
  async sendBatch(emails: MailOptions[]): Promise<Array<{ id: string }>> {
    if (emails.length === 0) return [];
    if (emails.length > 100) {
      throw new Error('Batch send supports at most 100 emails per request.');
    }
    const { data, error } = await this.client.emails.sendBatch(
      emails as CreateEmailOptions[],
    );
    if (error) {
      throw new Error(`Failed to send batch emails: ${error.message}`);
    }
    return (data ?? []).map((item) => ({ id: item.id }));
  }

  /**
   * 从环境变量 `RESEND_API_KEY` 创建实例（适合服务端 / CI 场景）
   * @throws 若环境变量未设置则抛出错误
   */
  static fromEnv(): ResendMailer {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      throw new Error(
        'RESEND_API_KEY environment variable is not set. Set it or pass the key directly: new ResendMailer("re_...")',
      );
    }
    return new ResendMailer(key);
  }
}
