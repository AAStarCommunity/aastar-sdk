# Spore Protocol — 去中心化 Agent 通信协议设计

> 分支: `feat/xmtp-agent-messaging`
> 日期: 2026-03-27
> 定位: 基于 Nostr 传输、AirAccount 身份、SuperPaymaster 激励的 Agent 通信协议

---

## 一、为什么要自建？

XMTP 是目前工程体验最好的 Web3 消息协议，但有一个结构性缺陷：**节点完全由 Ephemera 公司许可制控制（当前 7 个节点，Phase 3 开放时间未定）**。对于需要数据主权的 AAStar / Mycelium 生态，深度绑定 XMTP = 把通信命脉交给第三方公司。

**目标**：照搬 XMTP SDK 的开发体验，重建底层为真正去中心、无许可、有激励的通信网络。

---

## 二、XMTP SDK 架构解析（决定我们怎么借鉴）

```
@xmtp/agent-sdk (TS, ~560行 Agent.ts)
    └── @xmtp/node-sdk (TS)
            └── @xmtp/node-bindings (.node 原生扩展, napi-rs)
                    └── libxmtp (Rust)
                            ├── xmtp_api_grpc  ← gRPC 传输，连接 XMTP 节点
                            ├── xmtp_mls       ← MLS 加密实现
                            └── SQLite         ← 本地消息持久化
```

**关键结论**：
- 传输层是 **gRPC，非 REST**，因此不能直接照搬底层，必须重写
- **Agent SDK 公共 API 层（TypeScript）是我们完整复制的目标**
- MLS 加密实现在 Rust（libxmtp），MIT 许可，可独立使用，但需要 napi-rs 绑定
- agent-sdk 的核心价值在 EventEmitter 架构、中间件管道、错误恢复逻辑，约 560 行

**我们复制什么、重写什么：**

| 组件 | 策略 | 工作量 |
|------|------|--------|
| Agent 公共 API（事件系统、中间件、错误处理） | **完整复制**接口，重写实现 | 1周 |
| MessageContext / ConversationContext API | **完整复制** | 3天 |
| gRPC 传输层 | **替换**为 Nostr WebSocket | 1周 |
| MLS 加密 (libxmtp Rust) | **先用 NIP-44**，后期集成 libxmtp MLS | 3天 → 3周 |
| SQLite 本地持久化 | **保留**（better-sqlite3，与 XMTP 同方案） | 1天 |
| 身份注册（XMTP 节点签名） | **替换**为 Nostr pubkey（EOA 零转换） | 1天 |

---

## 三、核心技术洞见

### 3.1 身份层：同一条曲线，零成本对齐

```
secp256k1 私钥 (32 bytes) — 一把钥匙，三种用途
        │
        ├─→ ETH 地址 = keccak256(pubkey)[12:]    → 链上身份、AirAccount、资产
        ├─→ Nostr pubkey = secp256k1.compress()  → 消息路由、Relay 订阅
        └─→ AirAccount Inbox = 合约地址           → 多设备、社交恢复（长期）
```

Nostr 和 Ethereum 使用**完全相同的椭圆曲线（secp256k1）**，私钥格式相同，签名算法相同（Schnorr vs ECDSA 有差异，但 secp256k1-schnorr 库已有 JS 实现）。AirAccount 的 EOA owner/session key **直接就是 Nostr 身份**，无需额外密钥管理。

### 3.2 加密层：NIP-44 → MLS 升级路径

```
Phase 1: NIP-44 (ChaCha20-Poly1305 + HKDF-SHA256)
  - nostr-tools 内置，开箱即用
  - 提供基础 E2E 加密
  - 无群组前向保密

Phase 2: 集成 libxmtp MLS (Rust, MIT)
  - 真正的前向保密 + 后妥协安全
  - 后量子 XWING KEM（XMTP 已实现）
  - 通过 napi-rs 编译为 Node.js .node 文件
  - 接口不变，底层升级
```

### 3.3 传输层：Nostr Relay 替换 gRPC

| 维度 | XMTP gRPC | Nostr WebSocket |
|------|-----------|-----------------|
| 协议 | HTTP/2 + Protobuf | WebSocket + JSON |
| 节点准入 | 许可制（Ephemera） | **完全无许可** |
| 实现语言 | Rust（libxmtp） | JS/TS（nostr-tools） |
| 节点成本 | 无法自建 | $5–20/月/节点 |
| 延迟 | ~50-200ms | **~50-200ms（相近）** |
| 持久化 | 节点保证 | Relay 策略 + **激励机制** |

---

## 四、Spore Protocol 完整架构

```
┌─────────────────────────────────────────────────────────────────────┐
│  应用层：Agent AI 逻辑（与 XMTP 完全相同的使用方式）                   │
│                                                                      │
│  const agent = await SporeAgent.createFromEnv();                    │
│  agent.on('text', async (ctx) => {                                   │
│    await ctx.conversation.sendText(await think(ctx.message.content));│
│  });                                                                 │
│  await agent.start();                                                │
├─────────────────────────────────────────────────────────────────────┤
│  SDK 层：@aastar/messaging（我们构建，复制 XMTP agent-sdk 接口）        │
│                                                                      │
│  SporeAgent ←→ EventEmitter 架构（text/markdown/reaction/dm/group）  │
│  SporeMessageContext ←→ sendText / sendReply / sendReaction          │
│  SporeConversationContext ←→ conversation.id / members / isGroup     │
│  中间件管道：CommandRouter / ActionWizard（与 XMTP 相同）              │
├──────────────────┬──────────────────┬───────────────────────────────┤
│  加密层          │  身份层           │  链上执行层                     │
│                  │                  │                                │
│  Phase 1: NIP-44 │  AirAccount EOA  │  SuperPaymaster（gas 代付）    │
│  Phase 2: MLS    │  = Nostr pubkey  │  X402Client（x402 结算）       │
│  (libxmtp MIT)   │  (零转换)         │  ChannelClient（流式微支付）   │
├──────────────────┴──────────────────┴───────────────────────────────┤
│  传输层：Nostr Relay 网络                                             │
│                                                                      │
│  nostr-tools WebSocket client → 多 Relay 并发发送/订阅               │
│  自建 Relay (strfry/nostr-rs-relay) + 公共 Relay 冗余                │
│  激励层：每条消息存储/投递 → 向 Relay 运营商支付微支付                  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 五、激励机制：让 Relay 愿意存储

这是 Spore Protocol 相较 Nostr 原生最重要的创新点。

### 5.1 问题

原生 Nostr Relay 靠自愿运营，消息存储无保证，Agent 通信需要**保证投递**。

### 5.2 设计：Pay-per-Store 模型（基于 SuperPaymaster + x402）

```
消息生命周期：

1. Sender Agent 发送消息
   └─→ 打包为 Nostr Event (kind:1059 或自定义 kind)
   └─→ 附带 x402 支付承诺 (tags: ["payment", amount, asset, chain])

2. Relay 收到消息
   └─→ 验证支付承诺有效性（链上 nonce 未用，签名有效）
   └─→ 存储消息

3. Relay 兑现支付
   └─→ 定期（每小时/每天）向 SuperPaymaster 提交存储证明
   └─→ SuperPaymaster 验证并结算（gasless，用户不感知）
   └─→ Relay 收到 USDC/GToken 收益

4. 接收方 Agent 上线
   └─→ 订阅自己的 Nostr pubkey
   └─→ Relay 推送存储的消息（已激励，不会丢弃）
```

### 5.3 支付参数设计

```typescript
// 消息附带的支付元数据（Nostr Event tag）
const paymentTag = [
  "payment",
  "0.001",          // 0.001 USDC 每条消息
  "USDC",
  "0xUSDCAddress",
  "10",             // Optimism chainId
  "ttl:86400",      // 存储 24 小时
];
```

**经济可行性**：
- 每条消息 0.001 USDC = $0.001
- Relay 每天处理 10万条消息 → 每天 $100 收入
- 服务器成本：$20/月
- **Relay 运营商净利润正向**，自然激励更多人部署 Relay

### 5.4 存储证明机制

Relay 运营商通过提交 Merkle 证明批量结算：

```
存储证明 = MerkleRoot(message_ids[]) + Relay签名
SuperPaymaster 验证 → 结算 USDC 给 Relay 地址
```

这套机制复用 SuperPaymaster 现有的 `facilitatorEarnings` 和 `x402SettlementNonces` 逻辑，**不需要新合约**。

---

## 六、Nostr Event Kind 设计

```typescript
// 普通加密 DM（复用 NIP-17 Gift Wrap）
kind: 1059   // Sealed Sender DM，NIP-17

// AirAccount 身份声明
kind: 10050  // Relay list（NIP-65，用于声明首选 Relay）

// Spore 专属：x402 支付请求
kind: 23402  {
  tags: [["p", recipientPubkey], ["asset","0xUSDC"], ["amount","1000000"], ["chain","10"]],
  content: nip44.encrypt({ memo: "service fee" })
}

// Spore 专属：Channel voucher（流式微支付）
kind: 23403  {
  tags: [["p", payeePubkey], ["channel","0xId"], ["cumulative","500000"]],
  content: nip44.encrypt({ signature: "0x...voucher_sig" })
}

// Spore 专属：Gasless UserOp 触发
kind: 23404  {
  tags: [["p", agentPubkey], ["chain","10"], ["ep","0xEntryPoint"]],
  content: nip44.encrypt({ userOpJson: "..." })
}

// Spore 专属：存储支付承诺
kind: 23405  {
  tags: [["payment","0.001","USDC","0x...","10"], ["ttl","86400"]],
  content: ""  // 附在其他事件的 tags 中
}
```

---

## 七、工程实施路径（最小可行原则）

### Phase 0：验证（1周）

**目标**：证明技术路径可行，不写正式代码

```bash
# 1. 用 nostr-tools 在 dev 环境收发消息
# 2. 验证 EOA 私钥 → Nostr pubkey 的转换
# 3. 验证 NIP-44 加密在 AirAccount EOA 之间工作
# 4. 跑通：发 Nostr 消息 → 触发 X402Client 结算
```

产出：一个 100 行以内的验证脚本 `scripts/spore_poc.ts`

### Phase 1：SporeAgent MVP（2-3周）

**目标**：完整复制 XMTP agent-sdk 接口，底层用 Nostr

```
packages/messaging/
├── src/
│   ├── SporeAgent.ts        # 复制 Agent.ts 接口，替换底层
│   ├── SporeMessageContext.ts
│   ├── SporeConversationContext.ts
│   ├── transport/
│   │   └── NostrTransport.ts  # 替换 gRPC，用 nostr-tools WebSocket
│   ├── crypto/
│   │   └── Nip44Crypto.ts     # NIP-44 加密，替换 libxmtp MLS
│   ├── identity/
│   │   └── AirAccountIdentity.ts  # EOA → Nostr pubkey
│   └── relay/
│       └── RelayPool.ts       # 多 Relay 连接管理
└── package.json  (@aastar/messaging)
```

**关键代码量**：
- `SporeAgent.ts`：~400行（参考 Agent.ts 560行，删去 XMTP 特有逻辑）
- `NostrTransport.ts`：~150行（nostr-tools 封装）
- `Nip44Crypto.ts`：~80行（nostr-tools 内置）
- `AirAccountIdentity.ts`：~50行（secp256k1 转换）

**总计约 700-800 行 TypeScript**，无 Rust 依赖。

### Phase 2：激励 Relay（3-4周）

**目标**：实现 Pay-per-Store 激励机制

- 消息发送时附加 x402 支付承诺 tag
- 实现 `SporeRelayOperator` 类（Relay 运营商工具）
- 存储证明生成与 SuperPaymaster 结算对接
- 自建 strfry Relay + 支付插件（strfry 支持 plugin hook）

### Phase 3：MLS 升级（可选，4-6周）

**目标**：群组消息前向保密，对齐 XMTP 加密强度

- 集成 libxmtp MLS（Rust, MIT）via napi-rs
- 替换 Nip44Crypto，接口不变
- 实现 XWING KEM 后量子保护

---

## 八、与 XMTP SDK 的迁移兼容性

```typescript
// XMTP 原版
import { Agent } from '@xmtp/agent-sdk';
const agent = await Agent.createFromEnv();
agent.on('text', async (ctx) => { ... });

// Spore Protocol（替换 import，其余不变）
import { SporeAgent as Agent } from '@aastar/messaging';
const agent = await Agent.createFromEnv();
agent.on('text', async (ctx) => { ... });  // ← 完全相同
```

通过 re-export 别名，可以做到**零改动迁移**：

```typescript
// @aastar/messaging/xmtp-compat.ts
export { SporeAgent as Agent } from './SporeAgent';
export { SporeMessageContext as MessageContext } from './SporeMessageContext';
// ... 其余类型别名
```

---

## 九、成本与去中心化对比

| 维度 | XMTP 官方 | Spore Protocol |
|------|----------|---------------|
| 节点控制 | Ephemera 公司 | **任何人可运行** |
| 节点数量 | 7（Phase 1） | **无上限** |
| 月运营成本 | 无法控制 | $15–60（3个自建 Relay） |
| 启动成本 | 申请等待，无法自建 | **$0–500**（用公共 Relay 或自建） |
| 数据主权 | 在 XMTP 节点 | **完全在我们的 Relay** |
| 作恶风险 | 高（单点控制） | **无**（协议开放，Relay 自由迁移） |
| 加密强度 | MLS（最强） | NIP-44（Phase 1）→ MLS（Phase 2） |
| SDK 开发体验 | ✅ 最好（3行代码） | ✅ **与 XMTP 完全相同接口** |

---

## 十、总结：最核心的工程路径

```
Week 1: 跑通验证脚本（EOA→Nostr，NIP-44，nostr-tools收发）
Week 2-4: 实现 @aastar/messaging Phase 1（700行TS，无Rust依赖）
Week 5-8: 激励Relay机制（x402 Pay-per-Store + strfry插件）
Month 3+: MLS升级（可选，libxmtp集成）
```

**核心优势**：
1. **借鉴 XMTP**：SDK 接口完全照搬，开发者 0 学习成本迁移
2. **重建底层**：Nostr WebSocket 替换 gRPC，无许可，无审批
3. **完全去中心**：任何人可运行 Relay，数据不依赖任何单一公司
4. **经济可行**：Pay-per-Store 激励让 Relay 愿意长期存储，保证投递
5. **工程量最小**：Phase 1 约 700 行 TypeScript，无 Rust，无新合约

这是 Mycelium Protocol 通信层的自然延伸——**孢子（Spore）通过菌丝（Relay）网络传播，无需中心节点，经济激励驱动生长**。

---

## 十一、Nostr vs Waku 选型分析

### 11.1 直接对比

| 维度 | Nostr | Waku |
|------|-------|------|
| **协议模型** | JSON 事件 + WebSocket Relay | libp2p（P2P，GossipSub + DHT） |
| **复杂度** | **极低**（协议文档一页纸） | 高（PeerID、GossipSub、Lightpush、Store、Filter 多子协议） |
| **EVM 身份** | ✅ secp256k1，与 ETH 完全相同 | ❌ PeerID，与 EVM 体系脱节 |
| **Relay/节点运行** | 一个二进制，$5/月，5 分钟上线 | bootstrap peer、DHT 配置、协议协商 |
| **TS/JS SDK** | `nostr-tools`（5k+ stars，成熟） | `@waku/sdk`（可用，配置项多易出错） |
| **消息持久化** | Relay 存，逻辑简单 | Waku Store 协议，节点自愿存 |
| **NAT 穿越** | ✅ 不需要（Relay 中继） | 需要（P2P 直连） |
| **Rust SDK** | `rust-nostr`（活跃，高质量） | 维护优先级低于 Go/JS |
| **生产案例** | 社交（Damus）、AI Agents | Status App（Go 实现） |
| **Fork 新网络** | 跑 `strfry` 二进制，10 分钟 | bootstrap 节点 + DHT 初始化 + 多服务协调 |

### 11.2 选 Nostr 不选 Waku 的核心理由

**一句话：Waku 是 P2P 网络层，Nostr 是消息应用层。我们要的是后者。**

Waku 解决"如何在完全去中心 P2P 网络中路由消息"，本质是 libp2p 上层封装，适合构建底层基础设施。它的复杂度来自真正的 P2P 设计——节点发现、NAT 穿越、GossipSub 广播树，这些对 Agent 没有收益，只有成本。

Nostr 故意用 Relay 作中继，牺牲"纯 P2P"理论美感，换来：
- Agent 离线不丢消息（Relay 缓存）
- 不需要公网 IP
- 身份天然 secp256k1（= ETH 私钥）
- SDK 三行代码上线

**对于 Spore Protocol，Nostr 让 Phase 1 工作量缩减 3 倍，同等场景下无任何收益损失。**

### 11.3 SDK 策略：TypeScript 先行，Rust 后补

**Phase 1：TypeScript SDK（@aastar/messaging）**

`nostr-tools` 是 Nostr 生态最成熟 TS 库，包含 WebSocket relay 连接池、NIP-44 加密、事件签名/验证、订阅过滤器。我们在其上包一层，复制 XMTP agent-sdk 接口，约 700 行 TS，无 Rust 依赖，无新合约。

**Phase 2（可选）：Rust SDK**

`rust-nostr` 质量高，活跃维护。适用场景：高性能 Relay 服务端、嵌入式 IoT Agent、与 libxmtp MLS 集成。但 Phase 1 不需要，先验证协议设计。

---

## 十二、里程碑规划（M1–M4）

### M1：TypeScript SDK MVP（目标：可运行的最小系统）

**时间**：4 周
**交付**：`@aastar/messaging` 包，开发者可一行 import 替换 XMTP

**产品目标**：
- 完整复刻 XMTP agent-sdk 公共 API（`SporeAgent`、`MessageContext`、`ConversationContext`）
- Agent 可收发加密 DM，基于 AirAccount EOA 身份
- 支持 `agent.on('text' | 'dm' | 'group' | 'start' | 'unhandledError'...)` 全部事件
- XMTP 兼容 shim：`import { SporeAgent as Agent } from '@aastar/messaging'`

**工程范围**：
```
packages/messaging/src/
├── SporeAgent.ts            # 主类，复制 Agent.ts 接口（~400行）
├── MessageContext.ts        # 复制 MessageContext API
├── ConversationContext.ts   # 复制 ConversationContext API
├── transport/
│   └── NostrTransport.ts    # nostr-tools WebSocket 封装（~150行）
├── crypto/
│   └── Nip44Crypto.ts       # NIP-44 加密层（~80行）
├── identity/
│   └── AirAccountIdentity.ts # EOA→Nostr pubkey 转换（~50行）
└── relay/
    └── RelayPool.ts         # 多 Relay 连接管理（~100行）
```

**Nostr Event 映射**：
- DM → NIP-17 Gift Wrap（kind:1059，密封发件人）
- Group → kind:11（公开群）/ kind:14（加密群，NIP-24）
- 身份声明 → kind:0（元数据）+ kind:10050（首选 Relay 列表）

**验收标准**：
- [ ] `pnpm --filter @aastar/messaging test` 全绿
- [ ] 示例：两个 AirAccount EOA 之间完成加密 DM 收发
- [ ] XMTP agent-sdk 迁移指南，换 import 零代码改动

---

### M2：协议完整性 + AAStar 链上集成（目标：消息→链上动作闭环）

**时间**：M1 后 4 周
**交付**：完整的 Agent 工作循环，收消息→执行链上操作→回复结果

**产品目标**：
- 新增 Spore 专属事件类型（x402 支付请求、Channel voucher、UserOp 触发）
- 多 Relay 容错（3+ Relay 并发，任一 Relay 宕机不影响投递）
- 消息去重（同一消息多 Relay 推送只处理一次）
- Group 消息支持（多 Agent 协作群组）

**工程范围**：
```
新增 event kinds：
  kind:23402  x402 支付请求
  kind:23403  Channel voucher
  kind:23404  gasless UserOp 触发
  kind:23405  存储支付承诺（为 M3 准备）

新增模块：
  src/events/SporeEventTypes.ts   # 专属 kind 定义
  src/payment/X402Bridge.ts       # kind:23402 → X402Client
  src/payment/ChannelBridge.ts    # kind:23403 → ChannelClient
  src/payment/UserOpBridge.ts     # kind:23404 → AirAccount UserOp
  src/relay/RelayPool.ts          # 升级：多 Relay 并发 + 去重
```

**验收标准**：
- [ ] Agent 收到 kind:23402 → 自动触发 x402 settlement，回复 txHash
- [ ] Agent 收到 kind:23403 → 提交 channel voucher
- [ ] 3 个 Relay 其中 1 个宕机，消息仍正常投递
- [ ] 示例：AI Agent 通过 XMTP-compatible 接口完成链上支付

---

### M3：激励 Relay 网络（目标：经济可持续的去中心存储）

**时间**：M2 后 5 周
**交付**：Pay-per-Store 激励机制，Relay 运营商工具集

**产品目标**：
- 消息发送时附加 x402 支付承诺，Relay 存储后可结算
- `SporeRelayOperator` 类：Relay 运营商用于收集存储证明并结算
- strfry Relay 支付插件（event write hook）
- SuperPaymaster 批量结算（存储证明 → USDC）
- Relay 注册与发现合约（链上 Relay 目录，无许可注册）

**工程范围**：
```
packages/messaging/src/incentive/
├── PaymentTag.ts              # 消息附加支付承诺 tag
├── StorageProof.ts            # Merkle 证明生成
├── RelaySettlement.ts         # SuperPaymaster 结算调用

packages/relay-operator/       # 新包，Relay 运营商工具
├── SporeRelayOperator.ts      # 结算主逻辑
├── strfry-plugin/             # strfry write hook 插件
└── RelayRegistry.sol          # 无许可 Relay 注册合约（复用 NodeRegistry 模式）

经济参数：
  存储费：0.001 USDC/条/24h
  结算周期：每日批量
  最低存储承诺：Relay 须存储 TTL 内消息，否则丢失结算资格
```

**验收标准**：
- [ ] Relay 运营商工具：`SporeRelayOperator.claimRewards()` 成功结算
- [ ] strfry 插件拒绝无支付承诺的消息（可配置）
- [ ] 端到端：发一条带支付承诺的消息 → Relay 存储 → 24h 后运营商结算到账
- [ ] Relay 注册合约部署到 Sepolia，任何人可无许可注册

---

### M4：MLS 升级 + Rust SDK（目标：对齐 XMTP 加密强度，多语言支持）

**时间**：M3 后 6 周
**交付**：可选 MLS 加密升级 + Rust SDK

**产品目标**：
- MLS 加密替换 NIP-44（前向保密 + 后妥协安全 + XWING 后量子 KEM）
- `@aastar/messaging` 接口不变，加密层透明升级
- Rust SDK：`spore-sdk` crate，基于 `rust-nostr` + `libxmtp-mls`
- Python bindings（via PyO3，供 AI 框架直接使用）

**工程范围**：
```
MLS 集成：
  packages/messaging/src/crypto/MlsCrypto.ts  # 替换 Nip44Crypto
  packages/messaging/src/mls/                 # libxmtp MLS Rust bindings (napi-rs)
  接口签名不变，crypto 层可配置切换

Rust SDK：
  crates/spore-sdk/
  ├── src/agent.rs            # SporeAgent（对应 TS SporeAgent）
  ├── src/transport/nostr.rs  # rust-nostr 封装
  ├── src/crypto/mls.rs       # libxmtp MLS
  └── src/identity/           # EOA → Nostr pubkey

Python bindings：
  crates/spore-py/            # PyO3 bindings
```

**验收标准**：
- [ ] TS SDK：`SporeAgent.create({ crypto: 'mls' })` 使用 MLS 加密，接口不变
- [ ] Rust SDK：`cargo add spore-sdk`，同等 API，基础收发测试通过
- [ ] 跨语言互通：Rust Agent 发的消息，TS Agent 能解密收取

---

## 十三、里程碑总览

```
M1 (Week 1-4)   TS SDK MVP
  └── 可运行的 @aastar/messaging，XMTP 接口兼容，EOA 身份，NIP-44 加密

M2 (Week 5-8)   链上集成
  └── x402/Channel/UserOp 事件桥接，多 Relay 容错，Agent 链上操作闭环

M3 (Week 9-13)  激励网络
  └── Pay-per-Store，strfry 插件，SuperPaymaster 结算，无许可 Relay 注册

M4 (Week 14-20) MLS + Rust
  └── libxmtp MLS 升级，rust-nostr Rust SDK，Python bindings

可并行：M2 的协议设计 与 M1 实现 可同步进行
可跳过：M4 是可选优化，M1-M3 已是完整可用系统
```
