# AAStar SDK Developer Integration Guide (Bilingual)
# AAStar SDK 开发者集成指南 (中英双语)

This guide provides a comprehensive "How-To" map for developers building on the AAStar ecosystem. We break down complex business scenes into intuitive SDK integration patterns.

本指南为基于 AAStar 生态构建的开发者提供了全面的“如何做”地图。我们将复杂的业务场景拆解为直观的 SDK 集成模式。

---

## 🏛 Scene A: Registry & Identity 管家：身份与统一注册
*The orchestrator for all roles and permissions.*
*所有角色和权限的编排核心。*

### 1. How to register a new Community? / 如何注册一个新社区？
> **Story**: As a developer, I want to onboard a new DAO or project into the ecosystem.
> **诉求**: 作为一个开发者，我希望将一个新的 DAO 或项目引入生态系统。

```typescript
import { RegistryClient } from '@aastar/registry';

// One-stop registration: Handles role binding and profile metadata
// 一站式注册：处理角色绑定和个人资料元数据
const tx = await RegistryClient.registerCommunity(walletClient, REGISTRY_ADDR, {
    name: "My Awesome DAO",
    ensName: "awesome.eth",
    website: "https://awesome.dao",
    description: "A community for builders",
    logoURI: "ipfs://...",
    stakeAmount: parseEther("100") // Required GToken stake
});
```

### 2. How to register an EndUser? / 如何注册终端用户？
> **Story**: I want to link a user to a specific community and mint their identity SBT.
> **诉求**: 我希望将用户链接到特定社区并铸造其身份 SBT。

```typescript
const tx = await RegistryClient.registerEndUser(walletClient, REGISTRY_ADDR, {
    account: userAddress,
    community: communityAddress,
    avatarURI: "ipfs://...",
    ensName: "user.awesome.eth",
    stakeAmount: 0n // Basic users might not need stake
});
```

---

## ⚡ Scene B: SuperPaymaster & Sponsorship 中间件：免 Gas 赞助
*The gasless experience for Smart Accounts.*
*智能账户的免 Gas 体验。*

### 1. How to register a Paymaster Operator? / 如何注册 Paymaster 运营商？
> **Story**: I want to start a service that sponsors gas for users in exchange for fees.
> **诉求**: 我希望建立一个服务，通过收取费用来为用户赞助 Gas。

```typescript
import { RegistryClient, ROLES } from '@aastar/registry';
import { SuperPaymasterClient } from '@aastar/superpaymaster';

// 1. Bind Role in Registry / 在注册表中绑定角色
await RegistryClient.registerRole(walletClient, REGISTRY_ADDR, ROLES.PAYMASTER_SUPER, operatorAddr, "0x");

// 2. Configure Operator Settings / 配置运营商设置
await SuperPaymasterClient.configureOperator(walletClient, SUPER_PM_ADDR, 
    tokenAddr,      // Allowed payment token (e.g., USDT)
    treasuryAddr,   // Where fees are sent
    1000000n        // Exchange rate (Token/ETH)
);
```

### 2. How to sponsor a UserOperation in a DApp? / 如何在 DApp 中赞助 UserOp？
> **Story**: In my frontend, I want to generate the `paymasterAndData` for a gasless transaction.
> **诉求**: 在我的前端，我希望为免 Gas 交易生成 `paymasterAndData`。

```typescript
import { getPaymasterMiddleware } from '@aastar/superpaymaster';

const middleware = getPaymasterMiddleware({
    paymasterAddress: SUPER_PM_ADDR,
    operator: operatorAddress
});

const { paymasterAndData } = await middleware.sponsorUserOperation({ userOperation });
// Now inject this into your UserOp before signing
```

---

## 🎫 Scene C: Tokens & Community Assets 资产：SBT 与代币
*Managing identity and incentivization.*
*管理身份与激励。*

### 1. How to airdrop SBTs to eligible users? / 如何给合规用户空投 SBT？
> **Story**: I want to reward active contributors with a non-transferable badge.
> **诉求**: 我希望奖励活跃贡献者一个不可转让的勋章。

```typescript
import { TokensClient } from '@aastar/tokens';

// High-level: Check eligibility logic then mint
// 高级层面：检查合规逻辑后铸造
if (isEligible) {
    await TokensClient.mintSBT(walletClient, MY_SBT_ADDR, userAddress, {
        role: ROLES.ENDUSER,
        metadataURI: "ipfs://badge-data"
    });
}
```

### 2. How to provide self-service SBT minting? / 如何提供自助式 SBT 领取？
> **Story**: Users pay GTokens -> get xPNTs -> mint SBT automatically.
> **诉求**: 用户支付 GToken -> 获取 xPNT -> 自动铸造 SBT。

```typescript
// Sequence / 流程:
// 1. Approve GToken / 授权 GToken
await ERC20Client.approve(walletClient, GTOKEN_ADDR, CONVERTER_ADDR, amount);

// 2. Wrap GToken to xPNTs / 将 GToken 包装为 xPNT
await FinanceClient.wrapGTokenToXPNTs(walletClient, CONVERTER_ADDR, GTOKEN_ADDR, amount);

// 3. Register Role (This triggers SBT minting in V3) / 注册角色（V3中会触发 SBT 铸造）
await RegistryClient.registerEndUser(...);
```

---

## 💰 Scene D: Finance & Staking 经济：质押与流转
*Security through economic alignment.*
*通过经济一致性保障安全。*

### 1. How to provide collateral for a Community? / 如何为社区缴纳质押金？
> **Story**: A community owner needs to deposit GTokens to unlock high-tier features.
> **诉求**: 社区所有者需要存入 GToken 以解锁高级功能。

```typescript
import { FinanceClient } from '@aastar/finance';

// Using the 1363 "TransferAndCall" pattern for zero-approval UX
// 使用 1363 "TransferAndCall" 模式实现零授权交互
await FinanceClient.depositViaTransferAndCall(walletClient, GTOKEN_ADDR, REGISTRY_ADDR, amount);
```

---

## 📊 Summary of 72 Scenarios / 72 个场景总结
While AAStar supports 72 discrete business scenarios (e.g., "KMS Migration", "Anode Penalties"), they all use the **Building Blocks** above.
AAStar 支持 72 个离散业务场景（如“KMS 迁移”、“Anode 惩罚”），但它们都使用了上述**构建块**。

| Scene Category | Core SDK Module | Primary Client Action |
| :--- | :--- | :--- |
| **Governance** | `@aastar/registry` | `registerRole`, `createNewRole` |
| **Monetization** | `@aastar/superpaymaster` | `configureOperator`, `deposit` |
| **Loyalty** | `@aastar/tokens` | `mintXPNTs`, `isSBTActive` |
| **Collateral** | `@aastar/finance` | `stakeGToken`, `depositToEP` |

---
*助力 Stage 2 结算与 Phase 1-3 顺利推进。*
