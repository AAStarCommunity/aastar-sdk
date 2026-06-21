# @aastar/email

服务端发邮件工具,基于 [Resend](https://resend.com) API 的轻量封装。适用于**后端服务**和 **AI agent** 场景(需要 API key,**不要在前端/浏览器使用**,会泄露密钥)。

> 这是 AAStar SDK monorepo 的一个独立子包,只依赖 `resend`,不碰链上、不依赖 viem。

---

## 新手指引(5 分钟跑通)

### 1. 注册 Resend、拿到 API Key

1. 打开 https://resend.com 注册账号
2. 进入 https://resend.com/api-keys → **Create API Key**
3. 复制形如 `re_xxxxxxxxxxxx` 的密钥

### 2. 配置环境变量

在项目根目录的 `.env` 里加一行(参考 `env.template`):

```bash
RESEND_API_KEY=re_xxxxxxxxxxxx
```

> ⚠️ 绝不要把真实 key 提交到 git。`.env` 应在 `.gitignore` 里。

### 3. 配置发信域名(决定 `from` 能填什么)

| 场景 | `from` 可填 | 是否需配 DNS |
|------|------------|-------------|
| **快速测试** | `onboarding@resend.dev` | 否,开箱即用 |
| **生产 / 自定义域名** | `hi@aastar.io` 等 | 是,必须先验证域名 |

自定义域名要在 Resend 后台 **Domains → Add Domain**,按提示在你的 DNS 服务商处添加 **SPF / DKIM / DMARC** 记录并等待验证通过,否则发信会被拒。

### 4. 安装

```bash
# monorepo 内部已通过 workspace 链接,无需单独装
# 外部项目:
pnpm add @aastar/email
# 或从 umbrella 包的子路径引入(需自行安装 resend 这个可选 peer 依赖):
pnpm add @aastar/sdk resend
```

### 5. 发第一封邮件

```ts
import { ResendMailer } from '@aastar/email';
// 或:import { ResendMailer } from '@aastar/sdk/email';

const mailer = ResendMailer.fromEnv(); // 读取 RESEND_API_KEY

const { id } = await mailer.send({
  from: 'onboarding@resend.dev', // 测试地址;生产换成已验证的自有域名
  to: 'you@example.com',
  subject: 'Hello from AAStar',
  html: '<h1>It works! 🎉</h1>',
});

console.log('sent:', id); // Resend 邮件 ID,可用于查投递状态
```

---

## API

### `new ResendMailer(apiKey)` / `ResendMailer.fromEnv()`

- 构造方式二选一。`fromEnv()` 从 `RESEND_API_KEY` 读取,推荐在服务端/CI 使用。
- 空 key 会抛错。

### `send(options): Promise<{ id }>`

发单封邮件。

| 字段 | 类型 | 说明 |
|------|------|------|
| `from` | `string` | 发件地址(测试用 `onboarding@resend.dev`,生产用已验证域名) |
| `to` | `string \| string[]` | 收件人 |
| `subject` | `string` | 主题 |
| `html` / `text` | `string` | 正文(至少给一个) |
| `cc` / `bcc` / `replyTo` | `string \| string[]` | 抄送 / 密送 / 回复地址 |
| `attachments` | `{ filename, content }[]` | 附件(`Buffer` 或字符串) |
| `headers` / `tags` | — | 自定义头 / 标签 |
| `scheduledAt` | `string` | ISO 8601 带时区的未来时间,定时发送,如 `"2026-07-01T09:00:00+08:00"` |
| `idempotencyKey` | `string` | **幂等键**:agent 重试时,相同 key 不会重复发送 |

失败抛 `Error`,返回无 ID 也抛错。

### `sendBatch(emails[]): Promise<{ index, id }[]>`

批量发送,**单次最多 100 封**,结果按输入顺序返回。

- 空数组直接返回 `[]`,不发请求。
- `idempotencyKey` 在批量端点不支持,会被自动剥离。
- 任一条目无返回 ID → 抛 `BatchSendError`,其 `.failures` 字段含 `{ index, reason }` 便于定位。

```ts
import { ResendMailer, BatchSendError } from '@aastar/email';

try {
  const results = await mailer.sendBatch([
    { from: 'hi@aastar.io', to: 'a@x.io', subject: 'S1', html: '...' },
    { from: 'hi@aastar.io', to: 'b@x.io', subject: 'S2', html: '...' },
  ]);
} catch (e) {
  if (e instanceof BatchSendError) console.error(e.failures);
}
```

---

## Agent 场景:用幂等键防重发

```ts
await mailer.send({
  from: 'hi@aastar.io',
  to: user.email,
  subject: 'Your receipt',
  html: render(tx),
  idempotencyKey: `receipt-${txHash}`, // 同一笔交易重试只发一次
});
```

---

## 测试

```bash
pnpm --filter @aastar/email test   # 16 个单测,全部 mock,不发真实邮件
```
