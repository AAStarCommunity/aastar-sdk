# Spore Protocol M3 — Pay-per-Store Incentive Relay Engineering Spec

> 日期: 2026-03-27
> 前置条件: M2 完成（X402Bridge、ChannelBridge、UserOpBridge）

---

## 1. 概述

M3 引入经济激励层，让任何人都可以部署 Spore Relay 节点并获得收益。核心机制称为 **Pay-per-Store**：

- **消息发送方**随每条消息附带一个 EIP-3009 USDC 授权承诺（kind:23405）
- **Relay 运营商**的 strfry 插件同步验证该承诺（链下，<5ms，无 RPC 调用）
- 若验证通过，Relay 存储该消息并把承诺打包入 MicroPaymentChannel 凭证
- **RelayRegistry.sol** 完全无许可注册，任何地址可加入 Relay 网络

这与 M2 的 X402/Channel 桥形成闭环：**Relay 存储消息** = **Relay 提供服务** = **Relay 可结算收益**。

---

## 2. 系统组件

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Spore M3 Architecture                           │
├────────────────────────────┬────────────────────────────────────────────┤
│   Client Side              │   Relay Side                               │
│                            │                                            │
│  SporeAgent.start()        │  strfry relay                              │
│       │                    │       │                                    │
│       │  kind:23405        │       ├── write-plugin (Node.js/Rust)      │
│       │  + EIP-3009 sig    │       │     ├── validate EIP-3009 sig      │
│       ▼                    │       │     ├── check amount ≥ minFee      │
│  RelayPool.publish()  ─────┼──────►│     └── accept/reject              │
│                            │       │                                    │
│                            │       ├── SporeRelayOperator               │
│                            │       │     ├── aggregate vouchers         │
│                            │       │     ├── lazy settle to Channel     │
│                            │       │     └── batch claim via X402       │
│                            │       │                                    │
│                            │       └── RelayRegistry.sol (on-chain)     │
│                            │             └── permissionless register    │
└────────────────────────────┴────────────────────────────────────────────┘
```

---

## 3. kind:23405 — 存储支付承诺 Event

```typescript
// Tags（公开，Relay write plugin 可直接读取）
[
  ["payment", amount, "USDC", tokenAddress, chainId],
  ["ttl", "3600"],                    // 承诺有效期（秒）
  ["nonce", hexNonce],                // EIP-3009 nonce（防重放）
  ["valid_before", unixTimestamp],    // EIP-3009 过期时间
  ["from", payerAddress],             // EIP-3009 from
  ["to", relayOperatorAddress],       // EIP-3009 to（Relay 收款地址）
  ["sig", eip3009Signature],          // EIP-3009 签名（65字节hex）
]

// Content（NIP-44 加密，可选：附加备注）
{ memo?: string }
```

---

## 4. strfry Write Plugin

strfry 支持通过 stdin/stdout JSON 接口注入外部验证逻辑。M3 插件用 Node.js 实现（后续提供 Rust 版本性能优化）：

```typescript
// scripts/strfry-plugin.ts
import { createReadStream } from 'node:stream';
import { createInterface } from 'node:readline';
import { secp256k1 } from '@noble/curves/secp256k1';
import { keccak256 } from 'viem';

const MIN_FEE_USDC = 1_000n; // 0.001 USDC（6位精度）

// EIP-3009 domain separator（USDC on Optimism）
const DOMAIN_SEPARATOR = '0x...'; // 预计算，避免每次 RPC 调用

interface StrfryEvent {
  type: 'new' | 'lookupID';
  event: {
    id: string;
    kind: number;
    tags: string[][];
    content: string;
    pubkey: string;
    sig: string;
    created_at: number;
  };
  receivedAt: number;
  sourceType: string;
  sourceInfo: string;
}

interface StrfryResult {
  id: string;
  action: 'accept' | 'reject' | 'shadowReject';
  msg?: string;
}

const rl = createInterface({ input: process.stdin });

rl.on('line', (line) => {
  const req: StrfryEvent = JSON.parse(line);
  const result = processEvent(req);
  process.stdout.write(JSON.stringify(result) + '\n');
});

function processEvent(req: StrfryEvent): StrfryResult {
  const { event } = req;

  // 只对 kind:23405 验证支付承诺
  if (event.kind !== 23405) {
    return { id: event.id, action: 'accept' };
  }

  try {
    const tags = new Map(event.tags.map(([k, ...v]) => [k, v]));

    const amount = BigInt(tags.get('payment')?.[0] ?? '0');
    const nonce = tags.get('nonce')?.[0];
    const validBefore = Number(tags.get('valid_before')?.[0] ?? '0');
    const from = tags.get('from')?.[0];
    const to = tags.get('to')?.[0];
    const sig = tags.get('sig')?.[0];

    // 检查金额是否满足最低费用
    if (amount < MIN_FEE_USDC) {
      return { id: event.id, action: 'reject', msg: 'fee_too_low' };
    }

    // 检查时间有效性（不调用 RPC，纯本地验证）
    if (validBefore < Math.floor(Date.now() / 1000)) {
      return { id: event.id, action: 'reject', msg: 'expired' };
    }

    // 验证 EIP-3009 签名（@noble/curves，无 RPC）
    if (!verifyEip3009Sig({ amount, nonce: nonce!, validBefore, from: from!, to: to!, sig: sig! })) {
      return { id: event.id, action: 'reject', msg: 'invalid_sig' };
    }

    return { id: event.id, action: 'accept' };
  } catch {
    return { id: event.id, action: 'reject', msg: 'parse_error' };
  }
}

function verifyEip3009Sig(params: {
  amount: bigint;
  nonce: string;
  validBefore: number;
  from: string;
  to: string;
  sig: string;
}): boolean {
  // EIP-712 structured hash for TransferWithAuthorization
  // 完整实现见 packages/messaging/src/relay/Eip3009Verifier.ts
  const hash = computeEip3009Hash(params);
  const { r, s, v } = parseSig(params.sig);
  const recovered = ecrecover(hash, v, r, s);
  return recovered.toLowerCase() === params.from.toLowerCase();
}
```

---

## 5. RelayRegistry.sol（完全无许可）

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title SporeRelayRegistry
 * @notice Permissionless relay registry — anyone can register, no admin key.
 *
 * Relays self-report their:
 * - WebSocket URL
 * - Supported Spore event kinds
 * - Minimum fee (in USDC atomic units)
 * - Operator address (for payment receipt)
 *
 * No staking required in M3. Reputation is tracked off-chain via event history.
 * M4 may add optional staking for boosted reputation.
 */
contract SporeRelayRegistry {
    struct RelayInfo {
        string  wsUrl;
        address operator;
        uint96  minFeeUsdc;    // 6-decimal USDC units
        uint32  supportedKinds; // bitmask: bit0=DM, bit1=group, bit2=payment
        uint64  registeredAt;
        bool    active;
    }

    /// relayId => RelayInfo
    mapping(bytes32 => RelayInfo) public relays;

    /// operator => relayIds[]
    mapping(address => bytes32[]) public operatorRelays;

    bytes32[] public allRelayIds;

    event RelayRegistered(bytes32 indexed relayId, address indexed operator, string wsUrl);
    event RelayUpdated(bytes32 indexed relayId, address indexed operator);
    event RelayDeactivated(bytes32 indexed relayId);

    /// @notice Register a new relay. No permission required.
    function registerRelay(
        string calldata wsUrl,
        uint96 minFeeUsdc,
        uint32 supportedKinds
    ) external returns (bytes32 relayId) {
        relayId = keccak256(abi.encodePacked(msg.sender, wsUrl));
        require(!relays[relayId].active, "already registered");

        relays[relayId] = RelayInfo({
            wsUrl: wsUrl,
            operator: msg.sender,
            minFeeUsdc: minFeeUsdc,
            supportedKinds: supportedKinds,
            registeredAt: uint64(block.timestamp),
            active: true
        });

        operatorRelays[msg.sender].push(relayId);
        allRelayIds.push(relayId);

        emit RelayRegistered(relayId, msg.sender, wsUrl);
    }

    /// @notice Update relay parameters (operator only).
    function updateRelay(
        bytes32 relayId,
        uint96 minFeeUsdc,
        uint32 supportedKinds
    ) external {
        require(relays[relayId].operator == msg.sender, "not operator");
        relays[relayId].minFeeUsdc = minFeeUsdc;
        relays[relayId].supportedKinds = supportedKinds;
        emit RelayUpdated(relayId, msg.sender);
    }

    /// @notice Deactivate a relay (operator only).
    function deactivateRelay(bytes32 relayId) external {
        require(relays[relayId].operator == msg.sender, "not operator");
        relays[relayId].active = false;
        emit RelayDeactivated(relayId);
    }

    /// @notice Get all active relays (paginated).
    function getActiveRelays(uint256 offset, uint256 limit)
        external view returns (RelayInfo[] memory result, bytes32[] memory ids)
    {
        uint256 count = 0;
        for (uint256 i = offset; i < allRelayIds.length && count < limit; i++) {
            if (relays[allRelayIds[i]].active) count++;
        }
        result = new RelayInfo[](count);
        ids = new bytes32[](count);
        uint256 j = 0;
        for (uint256 i = offset; i < allRelayIds.length && j < count; i++) {
            if (relays[allRelayIds[i]].active) {
                result[j] = relays[allRelayIds[i]];
                ids[j] = allRelayIds[i];
                j++;
            }
        }
    }
}
```

---

## 6. SporeRelayOperator（SDK 侧运营商工具类）

```typescript
// packages/messaging/src/relay/SporeRelayOperator.ts

import type { ChannelClient } from '@aastar/channel';
import type { X402Client } from '@aastar/x402';

export interface PendingVoucher {
  nonce: `0x${string}`;
  amount: bigint;
  from: `0x${string}`;
  validBefore: number;
  sig: `0x${string}`;
  receivedAt: number;
  eventId: string;
}

export interface RelayOperatorConfig {
  /** Minimum USDC amount per message (6-decimal, e.g. 1000n = 0.001 USDC) */
  minFeeUsdc?: bigint;
  /** Batch settle when pending amount exceeds this threshold */
  lazySettleThreshold?: bigint;
  /** Channel for micro-payment settlement */
  channelClient?: ChannelClient;
  /** X402 for large-payment settlement */
  x402Client?: X402Client;
  /** Persistence adapter (default: in-memory) */
  store?: VoucherStore;
}

export interface VoucherStore {
  save(voucher: PendingVoucher): Promise<void>;
  getAll(): Promise<PendingVoucher[]>;
  delete(nonce: string): Promise<void>;
}

export class SporeRelayOperator {
  private pending: PendingVoucher[] = [];
  private totalPending = 0n;
  private readonly config: RelayOperatorConfig;

  constructor(config: RelayOperatorConfig = {}) {
    this.config = {
      minFeeUsdc: 1_000n,          // 0.001 USDC default
      lazySettleThreshold: 1_000_000n, // 1 USDC settle threshold
      ...config,
    };
  }

  /**
   * Called by strfry plugin (via IPC or by the operator service) when a
   * kind:23405 commitment is accepted.
   */
  async onCommitmentAccepted(voucher: PendingVoucher): Promise<void> {
    this.pending.push(voucher);
    this.totalPending += voucher.amount;

    if (this.config.store) {
      await this.config.store.save(voucher);
    }

    if (this.totalPending >= (this.config.lazySettleThreshold ?? 1_000_000n)) {
      await this.settleNow();
    }
  }

  /**
   * Force-settle all pending vouchers now.
   * Called periodically or on-demand.
   */
  async settleNow(): Promise<{ settled: number; amount: bigint }> {
    if (this.pending.length === 0) return { settled: 0, amount: 0n };

    const toSettle = [...this.pending];
    this.pending = [];
    this.totalPending = 0n;

    let settled = 0;
    let totalAmount = 0n;

    for (const voucher of toSettle) {
      try {
        if (this.config.channelClient) {
          // Use MicroPaymentChannel for small recurring payments
          await this.config.channelClient.submitVoucher({
            channelId: `${voucher.from}-relay`,
            cumulativeAmount: voucher.amount,
            voucherSig: voucher.sig,
          });
        } else if (this.config.x402Client) {
          // Fall back to x402 direct settlement
          await this.config.x402Client.settlePayment({
            from: voucher.from,
            amount: voucher.amount,
            nonce: voucher.nonce,
            validBefore: BigInt(voucher.validBefore),
            sig: voucher.sig,
          });
        }

        if (this.config.store) {
          await this.config.store.delete(voucher.nonce);
        }

        settled++;
        totalAmount += voucher.amount;
      } catch (err) {
        // Put back on failure — will retry next settlement window
        this.pending.push(voucher);
        this.totalPending += voucher.amount;
      }
    }

    return { settled, amount: totalAmount };
  }

  get pendingCount(): number { return this.pending.length; }
  get pendingAmount(): bigint { return this.totalPending; }
}
```

---

## 7. Client 侧：自动附加支付承诺

`RelayPool` M3 升级：发布消息时自动附加 kind:23405 承诺。

```typescript
// packages/messaging/src/relay/RelayPool.ts（M3 新增方法）

export interface PaymentConfig {
  privateKeyHex: PrivateKeyHex;
  usdcAddress: Address;
  chainId: number;
  amountPerMessage: bigint;           // USDC atomic units
  validityWindowSeconds?: number;     // default: 300 (5 min)
}

// RelayPool 新增：
async publishWithPayment(
  event: UnsignedNostrEvent,
  paymentConfig: PaymentConfig,
  relayOperatorAddress: Address
): Promise<string> {
  // 1. 生成 EIP-3009 授权签名
  const nonce = generateNonce();
  const validBefore = Math.floor(Date.now() / 1000) + (paymentConfig.validityWindowSeconds ?? 300);
  const sig = await signEip3009({
    from: deriveAddress(paymentConfig.privateKeyHex),
    to: relayOperatorAddress,
    amount: paymentConfig.amountPerMessage,
    nonce,
    validBefore,
    tokenAddress: paymentConfig.usdcAddress,
    chainId: paymentConfig.chainId,
    privateKey: paymentConfig.privateKeyHex,
  });

  // 2. 构建 kind:23405 承诺事件（附在原消息的 tags 中）
  const commitmentTags: string[][] = [
    ["payment", paymentConfig.amountPerMessage.toString(), "USDC", paymentConfig.usdcAddress, paymentConfig.chainId.toString()],
    ["ttl", (paymentConfig.validityWindowSeconds ?? 300).toString()],
    ["nonce", nonce],
    ["valid_before", validBefore.toString()],
    ["from", deriveAddress(paymentConfig.privateKeyHex)],
    ["to", relayOperatorAddress],
    ["sig", sig],
  ];

  // 3. 将承诺 tags 合并到原事件（或单独发布 kind:23405）
  const enrichedEvent = {
    ...event,
    tags: [...event.tags, ...commitmentTags],
  };

  return this.publish(enrichedEvent);
}
```

---

## 8. 经济模型分析

| 指标 | 假设 | 结果 |
|------|------|------|
| 每条消息费用 | 0.001 USDC | — |
| 每日消息量（活跃 Relay） | 100,000 条 | 100 USDC/天 |
| Relay 运营成本 | 2 vCPU + 4GB RAM VPS | ~$30/月 = $1/天 |
| 毛利率 | (100-1)/100 | **99%** |
| 启动成本（strfry + 域名 + SSL） | 一次性 | ~$20 |
| 盈亏平衡点 | | 约 **1,000 条消息/天** |
| 与存储 Relay（Relay.tools 计划）对比 | | 激励更直接 |

**关键洞察**：即使每条消息只收 0.001 USDC，日均 1 万条消息即可覆盖服务器成本（$0.1/天 vs $1/天），日均 10 万条消息可获得显著收益。这与 M2 的 X402Bridge 和 ChannelBridge 无缝衔接：Relay 就是第一个"服务提供方 Agent"。

---

## 9. 实施时间线

| 周次 | 工作 |
|------|------|
| Week 9 | `RelayRegistry.sol` 部署（Optimism Sepolia）+ `SporeRelayOperator` SDK 类 |
| Week 10 | strfry write plugin（Node.js 版）+ EIP-3009 链下验证器 |
| Week 11 | `RelayPool.publishWithPayment()` + Client 侧支付自动化 |
| Week 12 | 端到端测试：发送 100 条带承诺消息 → Relay 积累 → 批量结算 → 验证链上收款 |

---

## 10. 关键设计决策

1. **插件用 Node.js 不用 Rust（M3）**：strfry write plugin 是 stdin/stdout JSON 进程，Node.js 足够（<5ms），Rust 优化留给 M4 高性能版本。
2. **RelayRegistry 完全无许可**：对比 XMTP NodeRegistry（需申请 XIP-54 审批），SporeRelayRegistry 无 admin，无 staking 要求（M3）。这是核心竞争力。
3. **懒结算 > 即时结算**：每条消息都立即链上结算会产生大量 gas；积累到阈值（默认 1 USDC）后通过 MicroPaymentChannel 批量提交，gas 成本摊薄 1000 倍。
4. **EIP-3009 而非 Permit**：USDC 原生支持 `transferWithAuthorization`（EIP-3009），无需 `approve` → `transferFrom` 两步，且 Relay 侧可完全链下验证签名而无需 RPC 调用。
