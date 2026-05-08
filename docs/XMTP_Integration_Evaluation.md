# XMTP × AAStar SDK 集成评估

> 分支: `feat/xmtp-agent-messaging`
> 日期: 2026-03-27
> 参考: https://docs.xmtp.org/agents/get-started/connect-to-xmtp

---

## 一、XMTP 是否真正去中心化？

### 结论：**协议去中心化，网络仍在早期阶段**

| 维度 | 现状 | 评分 |
|------|------|------|
| 消息加密 | MLS (IETF 标准) + E2E，节点**无法读取**消息内容 | ✅ 真去中心化 |
| 抗量子 | XWING KEM（ML-KEM + 传统密码学混合） | ✅ 领先 |
| 节点网络 | 当前**仅 7 个节点运营商**，有准入门槛（需申请 XIP-54） | ⚠️ 早期阶段 |
| 审查抗性 | 节点要求分布于"抗审查司法管辖区"，有地理多元化要求 | 🟡 有设计但未成熟 |
| 身份主权 | Inbox ID 由钱包签名派生，支持 EOA / SCW / Passkey | ✅ 用户自主 |
| 协议治理 | XIP 流程（类 EIP），社区提案 | ✅ 开放 |

**核心判断**：加密和身份层是真正去中心化的，消息不可被任何中间方读取或篡改。但节点层目前仍集中（7 个受控运营商），预计 2026 Q2+ 逐步开放主网节点准入。整体与以太坊早期（少数矿池控制算力）的阶段类似——**方向正确，尚未完成**。

---

## 二、AAStar/Mycelium 在此扮演的角色

### 2.1 角色定位图

```
用户 / 其他 Agent
      │
      │  XMTP 消息 (E2E 加密，去中心化传输)
      ▼
┌─────────────────────────────────────┐
│        AAStar Agent                 │  ← 我们构建的这层
│  @xmtp/agent-sdk (消息收发)          │
│  AirAccount / EOA (XMTP 身份)       │
│  @aastar/sdk (链上执行)              │
└──────────────┬──────────────────────┘
               │  gasless UserOp / x402 pay / channel settle
               ▼
       SuperPaymaster / EntryPoint
       (Optimism / Sepolia)
```

### 2.2 我们是**消息驱动的链上执行层**

XMTP 解决的是：**安全的去中心化消息传输**
AAStar SDK 解决的是：**无 gas 的链上操作执行**

两者组合 = **"接收消息 → 执行链上动作 → 回复结果"** 的完整 Agent 循环

### 2.3 具体场景

| 场景 | XMTP 负责 | AAStar SDK 负责 |
|------|-----------|-----------------|
| **AI Agent 支付执行** | 接收用户的自然语言支付指令 | 构建并提交 gasless UserOp，通过 SuperPaymaster 代付 gas |
| **x402 微支付触发** | Agent 间互相发送服务请求 | X402Client 处理链上结算 |
| **Channel 流式支付** | 持续的服务计量消息 | ChannelClient 定期 settle voucher |
| **跨 Agent 协作** | Agent A 委托 Agent B 执行任务（消息协议） | Agent B 用自己的 AirAccount 执行链上动作 |
| **用户通知回调** | 链上事件触发后，Agent 主动推送消息给用户 | 监听合约事件（viem watchEvent） |

---

## 三、技术集成方案

### 3.1 身份方案选择

```
方案 A：EOA 作为 XMTP 身份（推荐，最快路径）
  - Agent 持有一个 EOA 私钥
  - 同一私钥用于 XMTP 注册（消息）和 AAStar 链上操作（可选）
  - 优点：直接，无需额外配置
  - 缺点：私钥泄露同时影响消息和资产

方案 B：AirAccount (ERC-4337 SCW) 作为 XMTP 身份（长期目标）
  - AirAccount 已支持多种签名方式（guardian、session key）
  - XMTP 支持智能合约钱包作为身份（只要能产生可验证签名）
  - 优点：社交恢复、多 guardian、与 Mycelium 协议深度集成
  - 缺点：XMTP 对 ERC-4337 SCW 的支持需要验证（签名格式）

方案 C：分离密钥（推荐生产方案）
  - XMTP 用独立 EOA（只管消息，无资产）
  - 链上操作用 AirAccount（由 XMTP Agent 触发）
  - 优点：安全隔离，最小权限
```

**推荐实施顺序：A → C → B**

### 3.2 新包设计：`@aastar/messaging`

```typescript
// packages/messaging/src/index.ts

import { Agent } from '@xmtp/agent-sdk';
import type { X402Client } from '@aastar/x402';
import type { ChannelClient } from '@aastar/channel';

export type MessagingConfig = {
  walletKey: Hex;           // EOA 私钥，用于 XMTP 身份
  dbEncryptionKey: Hex;     // 本地数据库加密
  env: 'dev' | 'production' | 'local';
  x402Client?: X402Client;  // 可选：绑定 x402 支付
  channelClient?: ChannelClient; // 可选：绑定 channel
};

export class AastarMessagingAgent {
  private agent: Agent;

  static async create(config: MessagingConfig): Promise<AastarMessagingAgent> { ... }

  // 注册消息处理器：收到文本消息时执行
  onText(handler: (ctx: MessageContext) => Promise<void>): void { ... }

  // 发送 x402 支付请求消息
  async sendPaymentRequest(to: string, amount: bigint, asset: Address): Promise<void> { ... }

  // 获取本 Agent 的 XMTP 地址
  get address(): string { ... }

  start(): Promise<void> { ... }
}
```

### 3.3 集成到现有 SDK 的最小路径

不新建包的最小可行方案——在 `@aastar/sdk` 的 umbrella 中添加：

```typescript
// packages/sdk/src/clients/AgentMessagingClient.ts
import { Agent } from '@xmtp/agent-sdk';

export function createAgentMessagingClient(config: {
  walletKey: Hex;
  dbEncryptionKey: Hex;
  env?: 'dev' | 'production';
}) {
  return Agent.createFromEnv(); // XMTP Agent SDK 包装
}
```

### 3.4 端到端消息流示例

```typescript
// Agent 收到 XMTP 消息 → 执行 x402 链上支付 → 回复结果

const agent = await Agent.createFromEnv();
const x402 = new X402Client({ walletClient, superPaymasterAddress });

agent.on('text', async (ctx) => {
  const msg = ctx.message.content;

  // 解析意图（可接入 LLM）
  if (msg.startsWith('/pay')) {
    const [_, to, amount] = msg.split(' ');
    const txHash = await x402.settlePayment({ ... });
    await ctx.conversation.sendText(`✅ Payment sent: ${txHash}`);
    return;
  }

  if (msg.startsWith('/channel')) {
    const voucher = await channelClient.signVoucherOffline(channelId, BigInt(amount));
    await ctx.conversation.sendText(`📄 Voucher: ${JSON.stringify(voucher)}`);
    return;
  }

  // 默认转发给 LLM
  const reply = await think(msg);
  await ctx.conversation.sendText(reply);
});

await agent.start();
```

---

## 四、依赖与兼容性分析

### 4.1 新增依赖

```json
{
  "@xmtp/agent-sdk": "^0.x",   // XMTP Agent SDK (Node.js 22+)
  "tsx": "^4.x"                 // 已有
}
```

**注意**：
- `@xmtp/agent-sdk` 要求 **Node.js 22+**（项目当前 CI 用 Node 24 ✅）
- 需要安装 `ca-certificates`（Docker 部署时，否则 gRPC/TLS 失败）
- 本地 SQLite 数据库（`xmtp-*.db3`）需要持久化存储，**不能用无状态 Lambda**

### 4.2 与现有架构的契合度

| 现有能力 | XMTP 集成后新增能力 |
|----------|---------------------|
| AirAccount + gasless UserOp | 接收 XMTP 消息作为触发器 |
| X402Client (x402 支付) | Agent 间 x402 支付协商通道 |
| ChannelClient (微支付通道) | 持续服务消费的消息计量 |
| SessionKeyService (会话密钥) | Agent 可授权子 session key，委托 XMTP 执行 |
| SuperPaymaster | 为 XMTP triggered 的 UserOp 代付 gas |

---

## 五、实施建议

### 阶段一（POC，1-2 周）
- [ ] 安装 `@xmtp/agent-sdk`，在 `scripts/` 下写一个独立演示脚本
- [ ] 用 EOA 私钥（方案 A）注册 XMTP dev 环境
- [ ] 实现：收到消息 → 触发 x402 settlement → 回复 tx hash
- [ ] 测试地址：`http://xmtp.chat/dm/<agent-address>`

### 阶段二（包集成，2-3 周）
- [ ] 新建 `packages/messaging/` 包（`@aastar/messaging`）
- [ ] 封装 `AastarMessagingAgent` 类
- [ ] 加入 `@aastar/sdk` umbrella 的 re-export
- [ ] 补充单元测试（mock XMTP client）

### 阶段三（AirAccount 身份，长期）
- [ ] 验证 AirAccount（ERC-4337 SCW）作为 XMTP 身份的签名兼容性
- [ ] 实现 guardian-backed XMTP inbox（消息也受 social recovery 保护）

---

## 六、风险与注意事项

| 风险 | 程度 | 缓解 |
|------|------|------|
| XMTP 节点网络尚未主网开放（Q1 2026 测试网） | 🟡 中 | 先用 dev 环境，production 等待主网就绪 |
| 本地数据库持久化要求（非无状态） | 🟡 中 | 部署时使用挂载卷（Railway / k8s PVC） |
| Node.js 22+ 要求 | 🟢 低 | CI 已用 Node 24，兼容 |
| ERC-4337 SCW 作为 XMTP 身份未经验证 | 🟡 中 | 阶段一先用 EOA，后续测试 SCW |
| 每 inbox 最多 10 installations 限制 | 🟢 低 | 合理管理数据库文件，避免重复注册 |

---

## 七、总结

**XMTP 是 AAStar Agent 通信层的理想选择**：
1. 真正的 E2E 加密，节点无法读消息
2. 支持 EOA 和智能合约钱包身份，与 AirAccount 天然兼容
3. Agent SDK 设计极简（三层：Brain / Glue / Rails），与 AAStar 的 L1-L4 分层架构哲学一致

**我们的角色**：不是 XMTP 节点运营商，也不是重新造消息轮子——而是**将 XMTP 消息轨道与 AAStar 链上执行能力对接**，构建"一条消息触发一笔链上操作"的 Agent 闭环。这是 Mycelium Protocol 中 Agent Economy 的通信基础设施层。
