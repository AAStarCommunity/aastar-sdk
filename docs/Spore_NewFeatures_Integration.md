# Spore Protocol — 三仓库新特性集成分析

> 日期: 2026-03-27
> 调研仓库: AAStarCommunity/SuperPaymaster, AAStarCommunity/airaccount-contract, AAStarCommunity/AirAccount

---

## 一、分支情况（已纠正）

> 注：早期并行命令输出交叉，已重新逐一验证。

| 仓库 | 分支 |
|------|------|
| **SuperPaymaster** | `main`, `feature/micropayment`, `fix/audit-remediation` |
| **AirAccount（SDK）** | `main`, `KMS` |
| **airaccount-contract** | `main`（仅此一个） |

---

## 二、SuperPaymaster 新特性

### main 分支已实现

| 特性 | 说明 | Spore 相关性 |
|------|------|------------|
| **MicroPaymentChannel** | 单向流式支付通道，EIP-712 voucher 验证，EIP-1153 瞬时存储优化 | ✅ M2 ChannelBridge 直接对接 |
| **x402 Facilitator Node** | Hono HTTP 服务器，完整 Coinbase x402 协议实现，运营商可独立部署 | ✅ M2 X402Bridge 可调用其 settle 端点 |
| **ERC-8004 Agent Identity** | Agent 身份注册链上合约（Sepolia: `0x8004A818...`），声誉驱动赞助资格 | ✅ Spore Agent 身份锚定 |
| **SKILL.md + .well-known** | Agent 能力声明文件（类 robots.txt），`/.well-known/ai-plugin.json` 发现端点 | ✅ Spore Agent 可在 .well-known 中声明 Nostr pubkey |
| **双结算路径** | EIP-3009（USDC 原生）+ Permit2 + Direct transfer | ✅ M2 X402Bridge 支持多结算模式 |
| **ROLE_KMS 节点类型** | Registry 中新角色，100 GT 质押要求，分布式签名 DVT 节点 | 🟡 长期：Spore Agent 密钥可托管给 KMS 节点 |
| **声誉分层赞助** | ERC-8004 声誉分 → 差异化 gas 补贴率（最高 50% BPS） | ✅ M3：高声誉 Relay 运营商获更高激励 |
| **Transient Storage** | EIP-1153 批量计费优化，降低 gas | ✅ M3 批量结算受益 |

### feature/micropayment 分支（新增合约）
具体内容需进一步读取，预期包含：流式计费合约原型、结算证明机制。M3 激励设计应参考此分支。

### fix/audit-remediation 分支
审计修复内容，合并到 main 前需确认所有 HIGH/MEDIUM 漏洞已修复。

---

## 三、airaccount-contract 新特性（M7，全在 main）

### 签名算法（7种）

| algId | 算法 | 适用场景 |
|-------|------|---------|
| 0x01 | ECDSA (secp256k1) | 标准 EOA |
| 0x02 | Ledger WebHID | 硬件钱包 |
| 0x03 | YubiKey WebAuthn P256 | FIDO2 |
| 0x04 | BLS12-381 | DVT 聚合 |
| 0x05 | Weighted Multi-sig | 多 Guardian |
| 0x06 | Cumulative T2/T3 | 分层阈值 |
| 0x07 | Session Key M6/M7 | Agent 会话 |

**Spore 集成**：Nostr 消息签名可直接使用 algId=0x01（EOA），硬件安全场景用 0x02/0x03。

### ERC-7579 模块系统

| 模块 | 类型 | Spore 相关性 |
|------|------|------------|
| **AgentSessionKeyValidator** | Validator | ✅ 核心：Agent 会话密钥，velocity limit + spend cap + 调用白名单 |
| **CompositeValidator** | Validator | ✅ 多算法聚合，支持 Nostr 签名的账户操作 |
| **TierGuardHook** | Hook | ✅ 按消费层级限流，防止 Agent 超额支付 |
| **ForceExitModule** | Executor | 🟡 L2→L1 紧急退出，2-of-3 Guardian 保护 |
| **RailgunParser** | Parser | 🔵 隐私池集成（Railgun），可用于私密支付 |

### Agent Economy 特性（M7.14-M7.18）

| 特性 | 状态 | Spore 集成点 |
|------|------|------------|
| **AgentSessionKeyValidator** | ✅ 已实现 | kind:23404 UserOpBridge 的 session key 范围限制 |
| **Hierarchical Sub-delegation** | ✅ 已实现 | Agent A 通过 Nostr 委托 Agent B，链上权限可递归验证 |
| **Prompt Injection Defense** | ✅ 已实现 | UserOpBridge 执行前对 callData selector 的链上白名单校验 |
| **x402 HTTP 402 集成** | 🔄 设计中 | 与 M2 X402Bridge 直接对应 |
| **ERC-8004 Agent Identity 绑定** | 🔄 设计中 | Nostr pubkey ↔ on-chain agentId 的身份证明 |
| **Multi-Agent 编排** | 🔄 设计中 | kind:23404 的多 Agent 调用链 |

### 审计情况
- 5 次内部审计，最新版本 v4（2026-03-22）
- 622 单元测试全通过，11/11 E2E 测试通过
- 零已知严重漏洞

---

## 四、AirAccount SDK（KMS 分支）新特性

### KMS 分支核心
AirAccount standalone 是一个 **KMS 服务器**，基于 STM32 硬件安全模块 + OP-TEE 可信执行环境，实现 AWS KMS TrentService API 兼容接口：

| 端点 | 功能 |
|------|------|
| `CreateKey` | 在 TEE 内生成密钥，私钥永不离开硬件 |
| `Sign` | 硬件签名（secp256k1 / P256） |
| `GetPublicKey` | 导出公钥 |
| `DescribeKey` | 密钥元数据 |

aastar-sdk 中的 `KmsManager` 是这个 KMS 服务器的客户端包装。

**Spore 集成价值**：Agent 的 Nostr 私钥（= EOA 私钥）可托管在 KMS/TEE 中，签名由硬件完成，私钥永不暴露在内存。这解决了"Agent 服务器上私钥如何安全存储"的根本问题。

### SDK vs 独立仓库差距

| 能力 | 独立 AirAccount | aastar-sdk |
|------|----------------|-----------|
| KMS/TEE | ✅ 核心实现 | ✅ 客户端包装 (KmsManager) |
| Session Keys M7 | ❌ | ✅ AgentSessionKeyValidator |
| ERC-7579 Modules | ❌ | ✅ ModuleManager |
| BLS 聚合 | ❌ | ✅ BLSManager |
| 硬件钱包 | ❌ | ✅ Ledger/YubiKey |
| 层级路由 | ❌ | ✅ 3-tier 算法选择 |

---

## 五、集成到 Spore Protocol 的优先级

### 🔴 P0 — M1/M2 直接可用（无需等待）

1. **AgentSessionKeyValidator** → kind:23404 UserOpBridge 的权限范围：Agent 只能触发被授权的 selector + 受 spend cap 限制的金额
2. **x402 Facilitator Node** → M2 X402Bridge 可复用其 settle 逻辑，甚至直接调用运营商的 Facilitator HTTP 端点
3. **MicroPaymentChannel** → M2 ChannelBridge 直接对接
4. **双结算路径（EIP-3009 + Permit2）** → X402Bridge 支持两种授权模式

### 🟡 P1 — M2/M3 需要集成

5. **ERC-8004 Agent Identity** → Nostr pubkey ↔ on-chain agentId 绑定（kind:23405 扩展字段）
6. **SKILL.md + .well-known** → Spore Agent 在 `.well-known/spore-agent.json` 声明其 Nostr pubkey 和支持的 kind 列表
7. **声誉分层赞助** → M3 Pay-per-Store：高声誉 Relay 运营商（ERC-8004 声誉高）获更高结算比例
8. **Prompt Injection Defense** → UserOpBridge 在提交 UserOp 前，对 callData 做 selector 白名单校验

### 🟢 P2 — M3/M4 长期集成

9. **KMS/TEE 密钥管理** → Agent Nostr 私钥托管在 TEE，签名硬件化
10. **Hierarchical Sub-delegation** → 多 Agent 协作链（Agent A 委托 B 委托 C 的 Nostr kind:23404 链）
11. **BLS 聚合** → 多 Agent 联合签名确认（群组操作）
12. **feature/micropayment 分支合约** → M3 激励 Relay 的存储证明机制

---

## 六、对 Spore M1 设计的具体修正

基于上述调研，M1 初始设计有以下调整：

### 调整 1：AirAccountIdentity 增加 ERC-8004 绑定
```typescript
// M1 设计（原）
class AirAccountIdentity {
  eoaToNostrPubkey(privateKey: Hex): NostrPubkey
}

// M1 修订（新增）
class AirAccountIdentity {
  eoaToNostrPubkey(privateKey: Hex): NostrPubkey
  async bindToERC8004(agentId: bigint, proof: Hex): Promise<void>  // P1
  async verifyERC8004Binding(pubkey: NostrPubkey): Promise<bigint | null>  // P1
}
```

### 调整 2：SporeAgent 增加 .well-known 声明辅助
```typescript
// 新增 helper，让 Agent 暴露 .well-known 端点
agent.toWellKnownJson(): {
  nostr_pubkey: string,
  eth_address: string,
  supported_kinds: number[],
  relays: string[],
  erc8004_agent_id?: string
}
```

### 调整 3：UserOpBridge 集成 Prompt Injection Defense
```typescript
type UserOpBridgeConfig = {
  // ...已有字段...
  // 新增：调用前校验 selector 白名单
  allowedSelectors?: Map<Address, Hex[]>  // contract → allowed function selectors
  allowedContracts?: Set<Address>         // 整个合约白名单
}
```
