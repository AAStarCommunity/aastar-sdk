# Spore Protocol M4 — TODO & Roadmap

> 日期: 2026-03-27
> 前置: M1-M3 完成 (feat/xmtp-agent-messaging)
> 来源: Code Review + Security Review + XMTP 功能对比

---

## Review 结论 (M1-M3)

| 层 | 状态 | 风险 |
|----|------|------|
| M1 消息传输 (NIP-44 + NIP-17) | ✅ READY | 低 — nostr-tools 真实加密，集成测试通过 |
| M2 链上桥接 | ⚠ PARTIAL | 高 — nonce 存储仅内存，authorizationSig 未验证 |
| M3 Relay 节点 | ⚠ PARTIAL | 高 — EIP-3009 域分隔符占位符，settlement 未实现 |

---

## CRITICAL / HIGH 安全问题 (M4 第一阶段必须修复)

### C1 — PaymentValidator EIP-3009 验证绕过 ⛔
- **文件**: `packages/message-relay/src/middleware/PaymentValidator.ts`
- **问题**: USDC domain separator 全为 `'0x'` 占位符，导致签名验证永远 skip → 任何人可伪造支付承诺
- **修复**: 填充真实 domain separator（Optimism / Base / OP-Sepolia USDC 链上地址 + ABI 读取）

### C2 — UserOpBridge 未验证 authorizationSig ⛔
- **文件**: `packages/messaging/src/payment/UserOpBridge.ts`
- **问题**: `authorizationSig` 被解析后丢弃，未做 `ecrecover(keccak256(chainId, ep, userOpHash, triggerNonce))` 验证
- **影响**: 任何人可构造 Nostr 事件，触发 Agent 提交任意 UserOp，危及账户安全
- **修复**: 完整实现 authorizationSig 验证协议

### H1 — AirAccountIdentity keccak256 fallback XOR hack 🔴
- **文件**: `packages/messaging/src/identity/AirAccountIdentity.ts:68-72`
- **问题**: `@noble/hashes/sha3` 加载失败时用 XOR 折叠替代 keccak256，派生出错误以太坊地址
- **修复**: 将 `@noble/hashes` 加入直接依赖，删除 fallback

### H2 — Nonce / TriggerNonce 仅内存去重，重启后失效 🔴
- **文件**: `X402Bridge.ts`, `UserOpBridge.ts`
- **影响**: 进程重启后历史 nonce 记录丢失，可被重放攻击
- **修复**: 持久化到 SQLite（使用已有 SqliteEventStore 模式）

### H3 — ChannelBridge voucher 状态仅内存，重启丢失 🔴
- **文件**: `packages/messaging/src/payment/ChannelBridge.ts`
- **影响**: 重启后 pending vouchers 丢失，资金卡在 channel 无法结算
- **修复**: 持久化 + 启动恢复 + 优雅退出调用 forceSettleAll()

### H4 — SporeRelayOperator.settleNow() 仅打印日志 🔴
- **文件**: `packages/message-relay/src/SporeRelayOperator.ts:56`
- **问题**: 清空 pending 列表但从不调用链上结算，资金永不到账
- **修复**: 接入 ChannelClient 实现真实 batchSettle

---

## MEDIUM 问题 (M4 第二阶段)

### M1 — NostrTransport 用 Math.random() 生成时间戳
- **文件**: `packages/messaging/src/transport/NostrTransport.ts`
- **修复**: 改用 `crypto.getRandomValues()`

### M2 — UserOpBridge 合约目标提取错误
- **文件**: `packages/messaging/src/payment/UserOpBridge.ts:140`
- **问题**: 用 `userOp.sender` 而非 callData 前 4 字节后的 20 字节 target 做合约白名单检查
- **修复**: 从 callData 解析真实 target 地址

### M3 — RelayPool 未强制 wss:// (生产环境)
- **文件**: `packages/messaging/src/relay/RelayPool.ts`
- **修复**: production 模式拒绝 ws:// 明文连接

### M4 — RelayPool seenIds Set 无界增长 (内存泄漏)
- **文件**: `packages/messaging/src/relay/RelayPool.ts:52`
- **修复**: 改为 LRU-Set (max 10k 条)

### M5 — MessageContext.getSenderAddress() 返回 Nostr pubkey 而非 ETH 地址
- **文件**: `packages/messaging/src/MessageContext.ts:38`
- **修复**: AirAccount registry 查询 or 直接从 identity 计算

---

## M4 新功能 TODO (与 XMTP 对齐)

### 功能层

| # | 功能 | 优先级 | 说明 |
|---|------|--------|------|
| F1 | **Consent / 垃圾邮件防护** | P0 | XMTP 核心体验：allowEntry / denyEntry，DM 前需 payer 在白名单 |
| F2 | **消息历史同步 API** | P0 | `agent.listMessages(conversationId, limit)` — 从 relay 拉取历史 |
| F3 | **Rich Content Types** | P1 | Attachment、Reaction、Reply 引用 — 参考 XMTP ContentTypes codec |
| F4 | **多钱包同一 Inbox** | P1 | 一个 Agent 绑定多个 EOA 签名，同一 Nostr pubkey 收全部消息 |
| F5 | **RelayRegistry.sol 部署** | P0 | 部署到 OP-Sepolia，SDK 内置地址，`RelayRegistryClient` 真实可用 |
| F6 | **KMS/TEE 私钥管理** | P2 | 接入 AirAccount KmsManager，私钥永不暴露内存 |
| F7 | **ERC-8004 身份绑定** | P2 | Nostr pubkey ↔ on-chain agentId，kind:23405 扩展字段 |

### 基础设施层

| # | 项目 | 优先级 | 说明 |
|---|------|--------|------|
| I1 | **Relay 限流 / DoS 防护** | P0 | maxEventsPerSecond per client，WebSocket 连接数限制 |
| I2 | **Relay 指标 / Prometheus** | P1 | events_stored_total, settlement_amount_total, ws_connections |
| I3 | **优雅退出 (SIGTERM)** | P0 | relay 停止前 drain pending vouchers，agent 停止前关闭订阅 |
| I4 | **Cluster-safe nonce 存储** | P1 | 多进程/多机部署时用 Redis 替代 SQLite 做 nonce 去重 |
| I5 | **SporeRelayOperator 真实结算** | P0 | 接入 ChannelClient，批量 submit vouchers |

---

## M4 实施顺序 (推荐)

```
阶段 1 — 安全修复 (本周)
  fix: C1 PaymentValidator 真实 EIP-3009 验证
  fix: C2 UserOpBridge authorizationSig 验证
  fix: H1 keccak256 直接依赖
  fix: H2 nonce 持久化
  fix: H3 voucher 持久化 + 优雅退出
  fix: H4 SporeRelayOperator 真实结算

阶段 2 — 新功能 (下周)
  feat: F1 Consent 垃圾邮件防护
  feat: F5 RelayRegistry.sol 部署 + SDK 集成
  feat: F2 消息历史同步 API
  infra: I1 Relay 限流
  infra: I3 优雅退出

阶段 3 — 完善 (两周后)
  feat: F3 Rich Content Types
  feat: F4 多钱包 Inbox
  feat: F6 KMS/TEE 集成
  feat: F7 ERC-8004 身份绑定
  infra: I2 Prometheus 指标
  infra: I4 Cluster-safe Redis nonce
```
