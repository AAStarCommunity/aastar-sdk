# L3 Lifecycle API Developer Guide

本文档旨在帮助开发者理解和使用 `@aastar/sdk` 提供的 L3 Lifecycle API。这些 API 封装了 L1/L2 的底层交互，提供了面向角色的全生命周期管理能力。

## 1. 核心类概览

| 角色 (Role) | 对应类 (Class) | 包 (Package) | 职责描述 |
| :--- | :--- | :--- | :--- |
| **Operator** | `OperatorLifecycle` | `@aastar/operator` | 管理 SuperPaymaster 节点运营者，包括质押、入驻、配置、资金管理和退出。 |
| **End User** | `UserLifecycle` | `@aastar/enduser` | 管理终端用户，包括加入社区 (Onboard)、发送 Gasless 交易、以及退出社区。 |
| **Admin** | `ProtocolGovernance` | `@aastar/admin` | (DAO/Admin) 管理协议全局参数、拥有权转移等治理操作。 |

---

## 2. Operator Lifecycle (运营者)

**类名**: `OperatorLifecycle`
**前提**: 账户需持有足够的 GToken，并已被授权基础社区身份 (`ROLE_COMMUNITY`, 通常由 DAO 投票决定)。

| 阶段 (Phase) | 动作 (Action API) |主要参数 | 进入前状态 (Pre-State) | 行动后状态 (Post-State) | 备注 (Notes) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Setup** | `setupNode()` | `type: 'SUPER'`<br>`stakeAmount`<br>`depositAmount` | - 持有 GToken<br>- 有 `ROLE_COMMUNITY` | - 获得 `ROLE_PAYMASTER_SUPER`<br>- Registry: GToken 被质押<br>- Paymaster: 存入初始 Collateral | 一键完成 `Approve` + `RegisterRole` + `Deposit`。 |
| **Operate** | `depositCollateral()` | `amount` | - 节点运行中<br>- Collateral 余额不足 | - Paymaster: Collateral 增加 | 用于补充 Gas 代付备用金。 |
| **Operate** | `withdrawCollateral()` | `amount` | - Paymaster 有余额 | - Paymaster: Collateral 减少<br>- 钱包收到退回的 GToken | 随时可提，无锁定期 (除非涉及 ETH Stake)。 |
| **Query** | `checkReadiness()` | - | - | 返回 `{ isConfigured, isActive, balance }` | 检查节点是否配置完成及当前余额。 |
| **Exit** | `withdrawAllFunds()` | `to` (可选) | - 节点运行中<br>- 有质押和存款 | - Paymaster: Collateral 清零<br>- Registry: **触发退出锁定期** (如30天) | **注意**: 如果 Role 有锁定期 (如30天)，此调用会触发 `exitRole` 并**Revert** (或进入冷却期)，资金需等待期满后方可完全提取。 |

### 开发者示例
```typescript
import { OperatorLifecycle } from '@aastar/sdk';

// 初始化
const operator = new OperatorLifecycle({ 
    client: walletClient, 
    ...contracts 
});

// 1. 入驻 (需先获得 ROLE_COMMUNITY)
await operator.setupNode({
    type: 'SUPER',
    stakeAmount: parseEther('50'),   // 质押 50 GT 到 Registry
    depositAmount: parseEther('10')  // 存入 10 GT 到 Paymaster 用于付 Gas
});

// 2. 退出
// 注意：如果 Registry 设置了 roleLockDuration，这步在锁定期内会失败
try {
    await operator.withdrawAllFunds(); 
} catch(e) {
    console.log("Exit initiated or locked:", e.message);
}
```

---

## 3. User Lifecycle (终端用户)

**类名**: `UserLifecycle`
**前提**: 这是一个抽象层，既支持 EOA 也支持 AA 账户。

| 阶段 (Phase) | 动作 (Action API) | 主要参数 | 进入前状态 (Pre-State) | 行动后状态 (Post-State) | 备注 (Notes) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Onboard** | `onboard()` | `community` (Address)<br>`stakeAmount` | - 持有 GToken (用于质押)<br>- **未**加入该社区 | - 获得 `ROLE_ENDUSER`<br>- Mint 该社区的 SBT<br>- Registry: GToken 被质押 | 类似于 "注册/会员" 流程。 |
| **Verify** | `checkEligibility()` | `community` | - | 返回 `boolean` | 检查是否满足加入条件 (如黑名单检查)。 |
| **Operate** | `enableGasless()` | `config: { policy }` | - | - 本地配置已更新 | 开启 Gasless 模式开关。 |
| **Operate** | `executeGaslessTx()` | `target`<br>`data`<br>`value` | - 已 Onboard<br>- 有足够 Reputation/Credit | - 交易成功上链<br>- 消耗 Credit 而非 ETH | 会自动路由到对应的 Paymaster (V4 或 Super)。 |
| **Query** | `getMyReputation()` | - | - | 返回 `{ score, creditLimit }` | 查询当前信誉分和可用额度。 |
| **Exit** | `leaveCommunity()` | `community` | - 已加入社区<br>- 持有 SBT | - SBT 被销毁<br>- 角色移除 | 退出社区，不再享受该社区的权益/Sponsorship。 |

### 开发者示例
```typescript
import { UserLifecycle } from '@aastar/sdk';

// 1. 加入社区
const user = new UserLifecycle({ ... });
const canJoin = await user.checkEligibility(communityAddr);
if (canJoin) {
    await user.onboard(communityAddr, parseEther('0.4')); // 质押 0.4 GT
}

// 2. 发送 Gasless 交易
await user.enableGasless({ policy: 'CREDIT' });
const txHash = await user.executeGaslessTx({
    target: targetContract,
    data: encodeFunctionData(...)
});
```

---

## 4. Admin (Protocol Governance)

**类名**: `ProtocolGovernance`
**前提**: 调用者需是 Registry 或各个核心合约的 Owner。

| 动作 (Action API) | 描述 | 涉及合约 |
| :--- | :--- | :--- |
| `transferDAO(newDAO)` | 将所有核心合约的 Owner 权限转移给新的 DAO 地址。 | Registry, SuperPaymaster, etc. |
| `updateGlobalParams()` | 更新全局参数 (如 ProtocolFee, Treasury)。 | Registry |
| `upgradeContracts()` | 升级核心合约实现 (TBD)。 | Factory, Registry |

---

## 5. 常见问题 (FAQ)

### Q: 为什么 `withdrawAllFunds` 会失败?
**A**: 在 Aastar 协议设计中，为了防止恶意节点作恶后立即跑路，核心角色 (如 `ROLE_PAYMASTER_SUPER`) 通常设有 **退出锁定期 (Role Lock Duration)**，例如 30 天。
在此期间，如果您尝试调用 `exitRole` (包含在 `withdrawAllFunds` 中)，Registry 合约会拒绝该操作。您必须保持节点在线直到服务期满，或等待锁定期结束。

### Q: `UserLifecycle` 支持 AA 吗?
**A**: 是的。初始化 `UserLifecycle` 时传入 `accountAddress` (AA 地址) 和 `client` (具备签名能力的 Client)。如果是 Gasless 交易，SDK 会自动构建 UserOperation 并发送给 Bundler；如果是普通交易，则直接通过 Client 发送。
