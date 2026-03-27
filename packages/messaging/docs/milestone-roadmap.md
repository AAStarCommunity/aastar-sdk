# Spore Protocol — Milestone Roadmap

> `@aastar/messaging` 里程碑全景：M1–M13 已完成，M14+ 规划

---

## 已完成里程碑（M1–M13）

### M1 — NIP-17 Nostr Agent SDK（核心 DM）
**Branch commit**: `3c4cf2f`

| Feature | 描述 |
|---------|------|
| `SporeAgent` | 核心 Agent 类，基于 Nostr secp256k1 身份 |
| NIP-17 Gift-Wrap DM | NIP-44 ChaCha20-Poly1305 端到端加密私信 |
| `SporeAgent.create()` | 从私钥或环境变量创建 Agent |
| `agent.on('text', ctx)` | 事件驱动消息处理器 |
| `ctx.sendText()` / `ctx.reply()` | 回复发送者 |
| `agent.sendDm()` | 主动发起 DM |
| Nostr relay 连接管理 | 自动重连、多 relay fan-out |
| 测试 | `SporeAgent.test.ts` — 单元 + 集成双 Agent 通信 |

---

### M2 — Payment Bridge（X402 / Channel / UserOp）
**Branch commit**: `f78d362`

| Feature | 描述 |
|---------|------|
| `X402Bridge` | HTTP 402 支付请求流程，per-message 收费 |
| `ChannelBridge` | 状态通道微支付流（签名 + 链下结算） |
| `UserOpBridge` | ERC-4337 UserOperation gasless 支付桥 |
| `PaymentBridgeRegistry` | 统一注册/查找多种 Bridge 类型 |
| 支付事件 Nostr 格式 | kind:23402(X402), kind:23403(Channel), kind:23404(UserOp) |
| 测试 | `bridges.test.ts` |

---

### M3 — `@aastar/message-relay`（Nostr Relay 节点）
**Branch commit**: `2b19f40`

| Feature | 描述 |
|---------|------|
| 独立 Relay 包 | `packages/message-relay/` — 可独立部署的 Nostr 中继 |
| EIP-712 签名验证 | 防 DoS：发布前验签 |
| 每发送者 Rate Limiting | 可配置 RPS + burst |
| X402 relay fee 收取 | kind:23402 fee-per-publish |
| Nonce Store | 文件/Redis/内存三种后端 |
| 上游 relay fan-out | 转发到公共 Nostr 网络 |

---

### M4 — 结算注入 + Consent API + Rate Limiting
**Branch commit**: `8a7ed65`

| Feature | 描述 |
|---------|------|
| Injectable settlement | Bridge 结算逻辑可替换（测试/生产环境隔离） |
| Per-client rate limiting | 基于 sender pubkey 独立限速 |
| `agent.setConsent()` | 白/黑名单 Consent 管理 |
| `agent.getConsent()` | 查询当前 Consent 状态 |

---

### M5 — Conversations API
**Branch commit**: `334f649`

| Feature | 描述 |
|---------|------|
| `agent.listConversations()` | 返回所有活跃会话列表 |
| `agent.getMessages(convId)` | 获取历史消息（支持 limit/offset） |
| `agent.streamAllMessages()` | SSE 风格流式订阅所有会话 |
| `SporeConversation` 类型 | `id`, `peerPubkey`, `createdAt`, `lastMessage` |

---

### M6 — Group Management（NIP-29）
**Branch commit**: `2e43f82`

| Feature | 描述 |
|---------|------|
| `agent.createGroup()` | 创建群组，返回 `groupId` |
| `agent.addGroupMember()` | 添加成员（管理员权限校验） |
| `agent.removeGroupMember()` | 移除成员 |
| `agent.getGroupInfo()` | 获取群组元数据 |
| `agent.sendGroupMessage()` | 向群组发送消息 |
| NIP-29 事件格式 | kind:9, kind:11, kind:12 群组事件 |
| 测试 | `GroupManagement.test.ts` |

---

### M7 — Content Type Codecs
**Branch commit**: `7433067`

| Feature | 描述 |
|---------|------|
| `SporeCodec` 接口 | 通用 codec 抽象：`contentTypeId`, `encode`, `decode` |
| `TextCodec` | `xmtp.org/text:1.0` — 纯文本（默认） |
| `ReactionCodec` | `xmtp.org/reaction:1.0` — 表情反应 |
| `ReplyCodec` | `xmtp.org/reply:1.0` — 引用回复 |
| `RemoteAttachmentCodec` | `xmtp.org/remote-attachment:1.0` — 附件（URL + 加密密钥） |
| `CodecRegistry` | 运行时注册/查找 Codec |
| XMTP 命名空间兼容 | Content type ID 与 XMTP 生态一致 |
| 测试 | `ContentTypeCodecs.test.ts` |

---

### M8 — Identity Registry + Multi-Device Key Linking
**Branch commit**: `19c7d8c`

| Feature | 描述 |
|---------|------|
| `IdentityRegistry` | AirAccount EOA ↔ Nostr pubkey 绑定注册 |
| `agent.linkDevice()` | 添加新设备 pubkey（kind:10001 设备列表） |
| `agent.unlinkDevice()` | 移除设备 |
| `agent.listDevices()` | 查询当前账户所有设备 |
| `agent.publishProfile()` | 发布 NIP-01 agent profile（name/about/picture/nip05） |
| EIP-712 身份证明 | ETH 签名证明 EOA 与 Nostr 密钥归同一用户 |
| 测试 | `IdentityRegistry.test.ts` |

---

### M9 — NIP-104 MLS Key Agreement（端到端群组加密）
**Branch commit**: `22f6d94`

| Feature | 描述 |
|---------|------|
| `SporeKeyAgreement` | MLS-like 密钥协商层（NIP-104 草案） |
| `createKeyPackage()` | 发布本设备的 MLS KeyPackage |
| `initiateGroupSession()` | 发起 MLS group session |
| `addMemberToSession()` | Welcome message 发给新成员 |
| `encryptGroupMessage()` | 使用协商 key 加密群消息 |
| `decryptGroupMessage()` | 解密群消息 |
| 前向保密 + 后向安全 | 消息密钥 ratchet（简化 MLS） |
| 测试 | `KeyAgreement.test.ts` |

---

### M10 — SporeHttpGateway（HTTP/SSE REST 网关）
**Branch commit**: `bf5c94d`

| Feature | 描述 |
|---------|------|
| `SporeHttpGateway` 类 | Fastify-based HTTP/SSE 服务器包装 SporeAgent |
| `POST /api/v1/messages/send` | 发送 DM |
| `GET /api/v1/conversations` | 列举会话 |
| `GET /api/v1/messages/:convId` | 获取历史消息 |
| `GET /api/v1/stream` | SSE 流式推送新消息 |
| Bearer Token 认证 | `Authorization: Bearer <token>` |
| 非 JS 客户端支持 | Python / Rust / 移动端 / React 均可接入 |
| 测试 | `SporeHttpGateway.test.ts` |

---

### M11 — Mainnet Hardening（生产就绪）
**Branch commit**: `4af2af9`

| Feature | 描述 |
|---------|------|
| `RateLimiter` | 令牌桶算法，per-pubkey 限速（可注入测试） |
| `runMainnetChecklist()` | 一键验证生产环境配置 |
| 私钥格式校验 | 拒绝弱密钥/全零密钥 |
| Relay 连接健康检查 | 验证 relay URL 可达 + NIP-11 支持 |
| 环境变量验证 | 缺失必填变量时明确报错 |
| 测试 | `Hardening.test.ts` |

---

### M12 — WakuTransport（Waku v2 / libp2p 传输适配器）
**Branch commit**: `6dcaa87` + security fixes `e20099f`

| Feature | 描述 |
|---------|------|
| `WakuTransport` | 实现 `SporeTransport` 接口，基于 Waku v2 |
| `WakuNodeLike` 接口 | 解耦 `@waku/sdk` 依赖，可注入 mock |
| DM content topic | `/spore/1/dm-{pubkeyHex}/proto` |
| Group content topic | `/spore/1/group-{groupId}/proto` |
| `WakuEnvelope` | JSON wire format `{ v:1, from, ciphertext, ts, [groupId], [contentTypeId] }` |
| `isValidEnvelope()` | 运行时类型守卫，防止畸形载荷崩溃 |
| `clampTs()` | 时间戳夹限 `[now-24h, now+5min]`，防时间戳投毒 |
| NIP-44 加密保留 | Waku 消息体使用 NIP-44 加密 |
| AbortSignal 支持 | `subscribeToDms/subscribeToGroups` 支持取消订阅 |
| 自定义 topic 前缀 | `config.topicPrefix` 可配置，支持测试环境隔离 |
| 测试 | `WakuTransport.test.ts` — 26 个用例 |

---

### M13 — MultiTransport（多传输层 fan-out）
**Branch commit**: `45b09a4`

| Feature | 描述 |
|---------|------|
| `MultiTransport` | 组合 N 个 `SporeTransport`，同时向所有传输层发/收 |
| `fanOutSend` | 并行发所有传输层，返回首个成功 hash |
| `fanOutSubscribe` | 所有传输层同时订阅（去重后回调） |
| `SeenSet` | `Map<id, expiresAt>` O(1) TTL 去重，防重复回调 |
| `queryMessages` 合并 | 多 transport 结果合并，按 `sentAt` 排序，去重，支持 limit |
| 冗余传输保障 | Nostr + Waku 同时 fan-out，任一 relay 宕机不影响送达 |
| 测试 | `MultiTransport.test.ts` — 21 个用例 |

---

## 总测试覆盖

| 测试文件 | 用例数 |
|---------|--------|
| SporeAgent.test.ts | ~40 |
| bridges.test.ts | ~20 |
| GroupManagement.test.ts | ~15 |
| ContentTypeCodecs.test.ts | ~20 |
| ConversationsApi.test.ts | ~15 |
| IdentityRegistry.test.ts | ~20 |
| KeyAgreement.test.ts | ~20 |
| SporeHttpGateway.test.ts | ~20 |
| NostrTransport.test.ts | ~25 |
| Hardening.test.ts | ~15 |
| WakuTransport.test.ts | 26 |
| MultiTransport.test.ts | 21 |
| **合计** | **~305** |

---

## 文档体系（M1–M13 已配套）

| 文档 | 路径 | 覆盖内容 |
|------|------|---------|
| Usage Guide | `docs/usage-guide.md` | 4 角色使用指南，M1-M13 代码示例 |
| Deployment Guide | `docs/deployment-guide.md` | 本地→测试网→生产升级路径 |
| Ecosystem Overview | `docs/ecosystem-overview.md` | 5 种角色、代币经济、HyperCapital 声誉 |
| Node Operations | `docs/node-operations-guide.md` | Relay/Waku/Paymaster 运营手册 |
| Community Governance | `docs/community-governance.md` | MushroomDAO 治理、提案流程 |
| XMTP Migration | `docs/xmtp-migration-guide.md` | 零代码迁移指南 |
| 小黑书产品设计 | `docs/xiaohei-product-design.md` | 去中心化小红书产品设计 |

---

## 未完成规划（M14+）

### M14 — 小黑书基础原型 + React Hooks 包

> **目标**：基于 M1–M13 + AT Protocol，实现去中心化小红书（小黑书）的 Web 端 MVP，同时发布 `@aastar/react` React Hooks 包

#### M14-A：`@aastar/react` — React Hooks 包

| Feature | 描述 | 依赖 |
|---------|------|------|
| `useSporeAgent()` | 初始化 SporeAgent，管理连接状态 | M1 |
| `useDm(pubkey)` | 订阅 + 发送 DM，返回 `{ messages, sendText, loading }` | M1/M5 |
| `useConversations()` | 会话列表，返回 `{ conversations, loading }` | M5 |
| `useGroup(groupId)` | 群组消息 + 成员管理 | M6 |
| `usePayment()` | X402/Channel 支付 hook，返回 `{ pay, status }` | M2 |
| `useIdentity()` | AirAccount 身份 + 设备管理 | M8 |
| `useGatewayStream()` | 通过 HTTP 网关 SSE 订阅（非 Node.js 环境） | M10 |
| Provider 模式 | `<SporeProvider privateKeyHex="...">` 全局 context | — |
| TypeScript 泛型 | 完整类型导出 | — |

**交付**：`packages/react/` 独立包，`@aastar/react`，SSR 友好（Next.js 兼容）

---

#### M14-B：小黑书 Web 原型（`@aastar/xiaoheishu`）

**技术栈**：Next.js 14 + `@aastar/react` + AT Protocol SDK + IPFS

| 功能模块 | 技术方案 | 依赖 |
|---------|---------|------|
| **AirAccount 登录** | M8 `IdentityRegistry` + 邮件 → EOA 抽象 | M8 |
| **发布图文笔记** | AT Protocol PDS + IPFS 图片存储 | AT Protocol |
| **关注 Feed** | AT Protocol PDS Firehose | AT Protocol |
| **探索/话题 Feed** | AT Protocol AppView + Feed Generator | AT Protocol |
| **点赞 / 收藏** | AT Protocol like/repost lexicon | AT Protocol |
| **E2E 加密私信** | NIP-17 DM via `@aastar/react` `useDm()` | M1 |
| **USDC 打赏** | X402Bridge `usePayment()` | M2 |
| **付费私圈** | NIP-29 Group + Channel Bridge | M2/M6 |
| **图片多后端存储** | IPFS Pinata + Cloudflare 网关 CDN | — |
| **钱包 / 余额** | `useIdentity()` + viem | M8 |

**内容 Schema（AT Protocol Lexicon）**：
```
app.xiaohei.note     — 图文笔记（title/body/images/tags/location/price）
app.xiaohei.tip      — 打赏记录（noteId/amount/token/txHash）
app.xiaohei.curate   — 策展人 Feed Generator 事件
```

**冷启动策略**：垂直社区（咖啡/穿搭/露营）+ 种子创作者 50 人内测

---

### M15 — OpenPNTs 积分 + SBT 声誉铸造

| Feature | 描述 |
|---------|------|
| OpenPNTs 代币集成 | 消息活动触发 aPNTs 铸造（on-chain） |
| SBT 声誉铸造 | AirAccount 铸造 SBT，tier: Seed/Sprout/Mycelium/Spore |
| 活动权重计算 | HyperCapital 公式 on-chain 版 |
| 小黑书积分奖励 | 发帖/获赞/被收藏 → aPNTs |

---

### M16 — xPNTs 质押 + Relay 费率折扣

| Feature | 描述 |
|---------|------|
| xPNTs 质押合约集成 | SDK 封装质押/解质押操作 |
| 费率折扣计算 | SBT tier → relay fee discount (5%/15%/30%) |
| 质押 APY 查询 | `getStakingApy()` 链上数据 |
| 小黑书创作者质押 | Feed Generator 节点质押 xPNTs |

---

### M17 — MushroomDAO On-chain Governance

| Feature | 描述 |
|---------|------|
| Snapshot → On-chain 迁移 | xPNTs holder 全链上投票 |
| Council 选举合约 | Spore-tier operator 选举 |
| 提案生命周期 SDK | `createProposal()`, `castVote()`, `executeProposal()` |
| 小黑书内容标准 | DAO 治理 Labeler 策略 |

---

### M18 — SuperPaymaster V4 Relay 费结算

| Feature | 描述 |
|---------|------|
| V4 relay fee 结算 | SuperPaymaster 直接结算 relay operator 收益 |
| 批量结算优化 | 多笔 relay fee 打包一次上链 |
| 小黑书 gasless | 用户发帖/打赏完全 gasless |

---

## 优先级排序

```
M14（小黑书 MVP + React Hooks）  ← 当前目标，商业价值最高
    │
    ├── M14-A: @aastar/react hooks 包（2-3 周）
    └── M14-B: 小黑书 Next.js 原型（4-6 周）

M15（积分/声誉）← M14 完成后，激励体系
M16（质押/折扣）← M15 基础上，经济飞轮
M17（DAO 治理）← M16 完成后，去中心化完整性
M18（V4 结算）← 并行进行，基础设施
```

---

## 技术债 / 待处理

| 项目 | 优先级 | 说明 |
|------|--------|------|
| XMTP → Spore 会话桥 | 低 | 迁移工具，非核心 |
| 推送通知（Push） | 中 | M14 移动端需要 |
| Waku Store 费用 | 低 | 等 Waku 官方协议稳定 |
| 跨链消息桥 | 低 | Optimism ↔ Ethereum ↔ Base |
| React Native 封装 | 中 | M14-B Phase 2 |
