# Spore Protocol M2 — On-Chain Integration Layer Engineering Spec

> 来源: M2 设计 agent 产出
> 日期: 2026-03-27
> 前置条件: M1 完成（`@aastar/messaging` 基础包）

---

## 1. 概述

M2 打通 Nostr 消息与 AAStar 链上执行的闭环。M1 建立了消息主干（Nostr relay pool、NIP-44 加密、XMTP 兼容接口），M2 在其上叠加四个"桥接"模块，将特定 Nostr event kind 转化为链上动作。

**设计原则：零交叉污染** — `SporeAgent` 核心类不直接 import `@aastar/x402` 或 `@aastar/channel`，桥接通过 `SporeEventBridge<K>` 接口注册，按需引入。

---

## 2. 包结构（M2 新增）

```
packages/messaging/src/
├── [M1 文件不变]
├── events/
│   └── SporeEventTypes.ts      ← 全类型系统（kind 23402–23405）
├── payment/
│   ├── X402Bridge.ts           ← kind:23402 → X402Client
│   ├── ChannelBridge.ts        ← kind:23403 → ChannelClient
│   └── UserOpBridge.ts         ← kind:23404 → BundlerClient+Paymaster
└── relay/
    └── RelayPool.ts            ← 升级：去重 + 故障转移 + 退避重连
```

---

## 3. Event 类型系统（`src/events/SporeEventTypes.ts`）

### 3.1 kind:23402 — x402 支付请求

Tags（公开，Relay 可索引）：
```
["p",           <payee-pubkey>]          // 收款方路由
["asset",       <ERC20-address>]         // 如 "0xUSDC..."
["amount",      <uint-string>]           // 原子单位
["chain",       <chainId-string>]        // 如 "10"
["nonce",       <hex-nonce>]             // EIP-3009 nonce（32字节hex）
["from",        <payer-ETH-address>]     // EIP-3009 from
["to",          <payee-ETH-address>]     // EIP-3009 to
["valid_before",<unix-ts-string>]        // EIP-3009 过期时间
["sig",         <eip3009-sig-hex>]       // EIP-3009 签名
["e",           <request-event-id>]      // 可选：回复线程
```

Content（NIP-44 加密给收款方）：`{ memo, refId }`

回复格式：同 kind:23402，带 `["e", requestEventId]` + `{ success, txHash }`

### 3.2 kind:23403 — Channel Voucher

```typescript
Tags: ["p", payeePubkey], ["channel", channelId], ["cumulative", amount], ["chain", chainId]
Content (NIP-44): { voucherSig: Hex }
```

### 3.3 kind:23404 — Gasless UserOp 触发

```typescript
Tags: ["p", agentPubkey], ["chain", chainId], ["ep", entryPoint]
Content (NIP-44): {
  userOp: { sender, nonce, callData, ... },  // 所有 bigint 字段编码为 hex string
  authorizationSig: Hex,   // 对 keccak256(chainId, ep, userOpHash, triggerNonce) 的签名
  triggerNonce: string     // 防重放，使用后消耗
}
```

### 3.4 kind:23405 — 存储支付承诺（为 M3 准备）

```typescript
Tags: ["payment", amount, symbol, tokenAddress, chainId], ["ttl", seconds]
```

---

## 4. X402Bridge

**职责**：收款方 Agent 监听 kind:23402，解码 EIP-3009 授权，调用 `X402Client.settleOnChain()`，回复结果。

**处理流程**：
1. 结构验证（`validateX402Event`）
2. 解码 tags（`decodeX402Tags`）
3. 策略检查（payer 白名单、金额上限、过期时间）
4. nonce 幂等性检查（`checkNonce`）
5. 链上结算（`settleOnChain`）
6. 发布回复 kind:23402 事件

**配置**：
```typescript
type X402BridgeConfig = {
  x402Client: X402Client;
  allowedPayers?: Set<string>;     // 未配置则接受所有
  maxAmountPerRequest?: bigint;
  settlementTimeoutSeconds?: number; // 默认 60
}
```

**拒绝原因**：`amount_exceeds_limit | nonce_already_used | expired | payer_not_allowed | invalid_signature | chain_mismatch`

---

## 5. ChannelBridge

**职责**：收款方 Agent 接收 kind:23403，验证 EIP-712 voucher 签名，可选懒结算（低于阈值时存储，超阈值时链上提交）。

**Voucher 验证链**：
1. 链上状态：`getChannelState` → 必须 `Open`
2. 单调性：`cumulativeAmount` 必须严格大于历史最优
3. 签名恢复：recovered address 必须匹配 `ChannelState.payer`

**懒结算设计**：减少微支付 gas 成本，多个 voucher 积累到阈值后一次性结算。生产环境需将 `pendingVouchers` 持久化到 SQLite。

---

## 6. UserOpBridge

**职责**：接收 kind:23404，验证 `authorizationSig`（防止未授权触发），提交 UserOp 到 Bundler。

**安全模型 — 授权签名协议**：
```
signingPayload = keccak256(abi.encode(
  uint256 chainId, address entryPoint,
  bytes32 userOpHash, bytes32 triggerNonce
))
```

三种授权模式：
- `self_only`：只接受自己的 UserOp（默认，最保守）
- `whitelist`：接受白名单 sender 的 UserOp
- `open`：接受任意（仅测试用）

`triggerNonce` 使用后消耗，防止 Nostr 事件重放。

---

## 7. RelayPool 升级（去重 + 故障转移）

**去重策略**：LRU 缓存（默认 10,000 条 event ID），窗口期内（默认 5 秒）同一 ID 只触发一次 handler。

**故障转移状态机**：
```
connecting → connected → degraded → reconnecting → connected|failed

退避公式：delay = min(初始延迟 × 倍数^次数 + 随机抖动, 最大延迟)
默认：1s → 2s → 4s → 8s → ... → 30s
```

**发布容错**：0 个 relay 在线时消息入队（最多 100 条），relay 恢复后自动排空。

---

## 8. SporeAgent M2 扩展接口

```typescript
// 桥接注册
agent.registerBridge(bridge: SporeEventBridge<K>): this

// 便捷工厂方法
agent.enableX402(x402Client, options?)       // 注册 X402Bridge + 订阅 kind:23402
agent.enableChannel(channels, options?)      // 注册 ChannelBridge + 订阅 kind:23403
agent.enableUserOp(bundlerClient, options?)  // 注册 UserOpBridge + 订阅 kind:23404

// 错误监控
agent.on('bridge:error', (kind, event, error) => { ... })
```

**路由规则**：kind:23402/23403/23404/23405 事件先路由到注册的 bridge；无 bridge 时 emit 通用 `'payment'` 事件供应用手动处理。

**初始化示例**：
```typescript
const agent = await SporeAgent.createFromEnv();

agent
  .on('text', async (ctx) => { await ctx.conversation.sendText(await llm.think(ctx.message.content)); })
  .enableX402(x402Client, { maxAmountPerRequest: 10_000_000n })
  .enableChannel(channelMap, { lazySettleThreshold: 5_000_000n })
  .enableUserOp(bundlerClient, { authMode: 'self_only' });

await agent.start();
```

---

## 9. 实施时间线

| 周次 | 工作 |
|------|------|
| Week 5 | `SporeEventTypes.ts` 全类型定义 + RelayPool 去重/退避升级 |
| Week 6 | `X402Bridge` + `ChannelBridge` 集成测试 |
| Week 7 | `UserOpBridge` + SporeAgent M2 扩展 |
| Week 8 | 端到端测试：kind:23404 Nostr 消息触发链上 gasless 操作 |

---

## 10. 关键设计决策

1. **Tags 存放授权数据，content 存放敏感数据**：Relay 需要索引 `#p`，bridge 需要读取 nonce/sig — 放在 tags（公开）。memo/refId 放在加密 content。
2. **桥接作为可选 peer deps**：`@aastar/messaging` 零区块链依赖，payment bridges 按需引入。
3. **回复复用相同 kind**：请求和响应均为 kind:23402，通过 `["e", requestId]` 区分，遵循 NIP-10 线程语义。
4. **懒结算减少 gas**：Channel 微支付积累到阈值才上链，生产环境 voucher 需持久化。
