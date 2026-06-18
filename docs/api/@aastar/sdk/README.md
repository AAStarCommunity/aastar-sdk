# AAstar SDK

The ultimate TypeScript SDK for the AAstar Protocol - a decentralized, community-driven Account Abstraction ecosystem.  
AAstar 协议的终极 TypeScript SDK —— 构建去中心化、社区驱动的账户抽象生态系统。

[![npm version](https://img.shields.io/npm/v/@aastar/sdk.svg)](https://www.npmjs.com/package/@aastar/sdk)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

---

## 🌟 Introduction | 简介

AAstar SDK provides a complete suite of tools to interact with the AAstar Protocol. It is designed with a **"Pre-check first, Action second"** philosophy, helping developers build robust dApps with minimal errors.

AAstar SDK 提供了一套完整的工具集用于交互 AAstar 协议。它采用了 **"先检查，后执行"** 的设计理念，帮助开发者构建低错误率、健壮的去中心化应用。

> **📦 Single-package since v0.20.x | 自 v0.20.x 起单包发布**
> Everything ships in ONE package — `@aastar/sdk` — with **subpath exports** that preserve the
> original module structure. The legacy split packages (`@aastar/core`, `@aastar/account`,
> `@aastar/paymaster`, `@aastar/identity`, `@aastar/tokens`, `@aastar/dapp`, `@aastar/x402`,
> `@aastar/channel`, `@aastar/enduser`, `@aastar/operator`, `@aastar/admin`, `@aastar/airaccount`)
> are **deprecated on npm** and now live as subpaths of `@aastar/sdk`.
> 所有能力合并到 **一个包** `@aastar/sdk`，通过 **子路径导出** 保留原有模块结构；上述老的分包已在 npm 上标记弃用。

### Modules (now subpaths) | 模块（现为子路径）

| Import | Functionality (功能) |
|---|---|
| `@aastar/sdk` | Umbrella: re-exports everything + role-based client factories (总入口 + 角色客户端) |
| `@aastar/sdk/core` | Shared logic, Roles, ABIs, **per-chain addresses** (共享逻辑、角色、ABI、多链地址) |
| `@aastar/sdk/account` | Smart Account (ERC-4337) utilities (智能账户工具) |
| `@aastar/sdk/paymaster` | SuperPaymaster middleware, gas sponsorship (代付中间件) |
| `@aastar/sdk/identity` | Reputation, SBT, credit limits (声誉、SBT、信用额度) |
| `@aastar/sdk/tokens` | GToken & xPNTs finance tools (代币金融工具) |
| `@aastar/sdk/dapp` | React components & hooks — **requires `react` peer dep** (React 组件与 hooks) |
| `@aastar/sdk/x402` | x402 settlement (x402 结算) |
| `@aastar/sdk/channel` | Micro-payment channels (微支付通道) |
| `@aastar/sdk/enduser` · `/operator` · `/admin` | Role lifecycle workflows (角色生命周期) |
| `@aastar/sdk/kms` | KMS WebAuthn passkeys, BLS aggregate signatures, tiered ERC-4337 accounts (Passkey + BLS + 分层签名) |

> 🔄 The `@aastar/sdk/airaccount` subpath is **deprecated** — it still works as an alias of `@aastar/sdk/kms` for one release. Please migrate to `@aastar/sdk/kms`.
> `@aastar/sdk/airaccount` 子路径已**废弃**，作为 `@aastar/sdk/kms` 的别名再保留一个版本，请尽快迁移到 `@aastar/sdk/kms`。

> ⚠️ **`react` / `react-dom` are optional peer deps.** They're only needed for the `@aastar/sdk/dapp`
> subpath. The root `import '@aastar/sdk'` and all non-UI subpaths work in Node/server with no React.
> React 是可选 peer 依赖，仅 `@aastar/sdk/dapp` 需要；root 及其它子路径在 Node/服务端无需 React。

---

## 📦 Installation | 安装

```bash
pnpm add @aastar/sdk viem
# or
npm install @aastar/sdk viem

# Only if you use the React UI subpath (@aastar/sdk/dapp):
pnpm add react react-dom
```

> You only need `@aastar/sdk` + `viem` — all transitive deps install automatically. KMS / WebAuthn / BLS features are bundled in — no separate install. Import them from `@aastar/sdk/kms`.
> 只需安装 `@aastar/sdk` + `viem`，其余依赖自动带入。KMS / WebAuthn / BLS 能力已内置，无需单独安装，从 `@aastar/sdk/kms` 导入即可。

### Importing | 导入方式

```typescript
// Everything from the root barrel (no React pulled in):
import { createEndUserClient, createOperatorClient, CANONICAL_ADDRESSES } from '@aastar/sdk';

// …or cherry-pick from a subpath to keep bundles lean:
import { registryActions } from '@aastar/sdk/core';
import { KmsManager, P256PasskeySigner } from '@aastar/sdk/kms';
import { useGasless } from '@aastar/sdk/dapp'; // requires react
```

---

## 🌐 Multi-chain | 多链配置

**Switching chains is seamless — just pass a viem `chain`.** Contract addresses are auto-resolved
from `chain.id`, so you never hardcode addresses or memorize chainIds. Use the exact chain objects
from `viem/chains`.
切链是无感的——**只需传入一个 viem `chain`**，合约地址会根据 `chain.id` 自动解析，无需手写地址、无需记 chainId。直接用 `viem/chains` 里的链对象即可。

| Network | viem chain | chainId | Status |
|---|---|---|---|
| Optimism (mainnet) | `optimism` | `10` | ✅ deployed |
| Sepolia (testnet) | `sepolia` | `11155111` | ✅ deployed (primary test target) |
| OP Sepolia (testnet) | `optimismSepolia` | `11155420` | ✅ deployed |
| Ethereum mainnet | `mainnet` | `1` | ⏳ not yet deployed |

```typescript
import { createEndUserClient } from '@aastar/sdk';
import { sepolia, optimism } from 'viem/chains';
import { http } from 'viem';

// Sepolia testnet — addresses auto-resolved from sepolia.id
const test = createEndUserClient({
  chain: sepolia,
  transport: http(process.env.SEPOLIA_RPC_URL),
});

// Optimism mainnet — same code, just swap chain + transport
const prod = createEndUserClient({
  chain: optimism,
  transport: http('https://mainnet.optimism.io'),
});
```

- **Unsupported chain?** If you pass a chain that has no deployment yet (e.g. `mainnet`) and no
  explicit `addresses`, the factory throws a clear error naming the supported chains — no silent
  misconfiguration.
- **Custom / private deployment?** Override per-call with `addresses: { ... }` (or `CANONICAL_ADDRESSES[chainId]`
  to start from a known set); the explicit value always wins over auto-resolution.
- 未部署的链（如 `mainnet`）且未显式传 `addresses` 时，工厂会抛出列明受支持链的清晰报错；自定义部署可通过 `addresses` 覆盖，显式值优先。

Helpers for RPC URLs and explorer links live in `@aastar/sdk` too:
`getNetwork(name)`, `getRpcUrl(name)`, `getChainId(name)`, `getTxUrl(name, hash)`, `getAddressUrl(name, addr)`.

---

## 📚 Documentation | 文档导航

- **Docs Home**: https://docs.aastar.io/
- **API Reference**: https://docs.aastar.io/api/
- **Examples**: https://docs.aastar.io/examples/
- **Deployments**: https://docs.aastar.io/guide/deployments/verify.sepolia.contracts
- **Configuration Sync**: https://docs.aastar.io/guide/docs/Configuration_Sync
- **Regression Testing**: https://docs.aastar.io/guide/docs/Regression_Testing_Guide
- **Gasless Tester Guide**: https://docs.aastar.io/guide/docs/TESTER_GUIDE_GASLESS
- **Price Keeper Guide**: [docs/guide/keeper.md](../../_media/keeper.md)

---

## 🚀 Usage | 使用指南

### 1. Initialize Client | 初始化客户端

```typescript
import { http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { createEndUserClient, createOperatorClient } from '@aastar/sdk';

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);

// Role-based clients compose viem action factories under the hood.
// Addresses auto-resolve from chain.id — no `addresses` needed for supported chains.
const enduser = createEndUserClient({
  chain: sepolia,
  transport: http(process.env.SEPOLIA_RPC_URL),
  account,
});

const operator = createOperatorClient({
  chain: sepolia,
  transport: http(process.env.SEPOLIA_RPC_URL),
  account,
});
```

### 2. "Pre-check" Pattern | "预检查" 模式

Avoid reverts and save gas by checking requirements off-chain first.  
通过链下预检查避免交易回滚并节省 Gas。

```typescript
// ❌ Old Way (Prone to errors)
// await communityClient.launchCommunity(...); 

// ✅ New AAstar Way
const check = await communityClient.checkLaunchRequirements(myAddress, parseEther("33"));

if (!check.hasEnoughGToken) {
    console.error(`Missing Requirements: ${check.missingRequirements.join(', ')}`);
    // Output: "Need 33 GT, have 10 GT"
} else {
    // Safe to execute
    await communityClient.launchCommunity({
        name: "My DAO",
        tokenSymbol: "MDAO"
    });
}
```

### 3. Key Scenarios | 核心场景

#### 🏛️ For Community Owners (社区创建者)

```typescript
// Configure SBT rules for your community
await communityClient.configureSBTRules({
    communityId: myCommunityId,
    rule: {
        minScore: 100,
        requiredTags: ["OG"]
    }
});
```

#### ⚙️ For Operators (运营商)

```typescript
// Check if you are ready to be a Super Paymaster
const status = await operatorClient.checkResources(myAddress);

if (status.hasRole) {
    await operatorClient.withdrawCollateral(parseEther("50"));
} else {
    console.log(status.recommendations); 
    // "Fund aPNTs for collateral", "Stake GToken"
}
```

#### 📊 For Analysts (分析师)

```typescript
import { AnalyticsClient } from '@aastar/sdk';

const analytics = new AnalyticsClient(publicClient);

// Get real-time GToken metrics
const metrics = await analytics.getSupplyMetrics();
console.log(`Deflation Rate: ${metrics.deflationRate}%`);
```

---

## 🔧 Architecture | 架构

AAstar SDK is built on top of **viem**, ensuring lightweight and type-safe interactions. It abstracts complex contract logic into intuitive business primitives.

AAstar SDK 基于 **viem** 构建，确保轻量级和类型安全的交互。它将复杂的合约逻辑抽象为直观的业务原语。

All capabilities are bundled into `@aastar/sdk`; the table below maps each former package to its subpath.
所有能力已打包进 `@aastar/sdk`，下表对应每个旧分包现在的子路径。

| Subpath | Functionality (功能) |
|---------|---------------------|
| `@aastar/sdk/core` | Shared logic, Roles, RequirementChecker, per-chain addresses |
| `@aastar/sdk/account` | Smart Account (ERC-4337) utilities |
| `@aastar/sdk/operator` | Paymaster ops, Staking management |
| `@aastar/sdk/enduser` | User onboarding, SBT minting |
| `@aastar/sdk/tokens` | Finance, Tokenomics, Approval flows |
| `@aastar/sdk/identity` | Reputation, Credit limits, ZK Proofs |
| `@aastar/sdk/paymaster` | EntryPoint & Paymaster low-level API |
| `@aastar/sdk/dapp` | React Components & Integration Hooks (needs `react`) |
| `@aastar/sdk/kms` | KMS WebAuthn, BLS Signatures, ERC-4337 Tiered Accounts (`/airaccount` = deprecated alias) |

---

## 📊 Gas Analytics & Reporting | Gas 分析与报表
The SDK includes a powerful **Gas Analytics Module** for analyzing Paymaster efficiency, tracking costs, and generating industry comparison reports.
SDK 包含一个强大的 **Gas 分析模块**，用于分析 Paymaster 效率、追踪成本并生成行业对比报告。

### Quick Start | 快速开始
Generate a real-time analysis of recent Sepolia transactions:
生成最近 Sepolia 交易的实时分析：
```bash
npx tsx packages/analytics/src/gas-analyzer-v4.ts
```

### Key Features | 核心功能
- **Double-Layer Analysis (双层分析)**: Intrinsic EVM Efficiency vs. Economic USD Costs
- **Industry Benchmarking (行业对标)**: Compare AAStar vs. Optimism, Alchemy, Pimlico
- **Profit Tracking (利润追踪)**: Transparent breakdown of Protocol Revenue & Profit
- **L2 Simulation (L2 模拟)**: Estimate savings for migrating UserOps to Optimism

👉 **[View Full Analytics Documentation | 查看完整分析文档](https://docs.aastar.io/guide/packages/analytics/)**

---

## 🤝 Contributing | 贡献

We welcome contributions! Please see our Contributing Guide for details.  
欢迎贡献！更多详情请参考贡献指南。

---

<p align="center">
  Built with ❤️ by the AAstar Community
</p>

## Namespaces

- [KMS](namespaces/KMS/README.md)

## Enumerations

- [AuthorizationState](enumerations/AuthorizationState.md)
- [EntryPointVersion](enumerations/EntryPointVersion.md)
- [NodeType](enumerations/NodeType.md)
- [PolicyDecision](enumerations/PolicyDecision.md)
- [ProposalState](enumerations/ProposalState.md)
- [RolePermissionLevel](enumerations/RolePermissionLevel.md)
- [UserOpScenarioType](enumerations/UserOpScenarioType.md)

## Classes

- [BaseClient](classes/BaseClient.md)
- [BLSSigner](classes/BLSSigner.md)
- [BundlerClient](classes/BundlerClient.md)
- [ChannelClient](classes/ChannelClient.md)
- [CommunityClient](classes/CommunityClient.md)
- [ContractConfigManager](classes/ContractConfigManager.md)
- [ExperimentClient](classes/ExperimentClient.md)
- [FacilitatorClient](classes/FacilitatorClient.md)
- [FinanceClient](classes/FinanceClient.md)
- [FundingManager](classes/FundingManager.md)
- [KeyManager](classes/KeyManager.md)
- [OperatorLifecycle](classes/OperatorLifecycle.md)
- [PaymasterClient](classes/PaymasterClient.md)
- [PaymasterManager](classes/PaymasterManager.md)
- [PaymasterOperator](classes/PaymasterOperator.md)
- [PaymasterOperatorClient](classes/PaymasterOperatorClient.md)
- [ProtocolClient](classes/ProtocolClient.md)
- [ProtocolGovernance](classes/ProtocolGovernance.md)
- [ReputationClient](classes/ReputationClient.md)
- [RequirementChecker](classes/RequirementChecker.md)
- [SepoliaFaucetAPI](classes/SepoliaFaucetAPI.md)
- [StateValidator](classes/StateValidator.md)
- [SuperPaymasterAdminClient](classes/SuperPaymasterAdminClient.md)
- [SuperPaymasterClient](classes/SuperPaymasterClient.md)
- [UserClient](classes/UserClient.md)
- [UserLifecycle](classes/UserLifecycle.md)
- [UserOpClient](classes/UserOpClient.md)
- [UserOperationBuilder](classes/UserOperationBuilder.md)
- [UserOpScenarioBuilder](classes/UserOpScenarioBuilder.md)
- [X402Client](classes/X402Client.md)

## Interfaces

- [AccountBalance](interfaces/AccountBalance.md)
- [BalanceValidationParams](interfaces/BalanceValidationParams.md)
- [BuildPaymasterDataParams](interfaces/BuildPaymasterDataParams.md)
- [BundlerResponse](interfaces/BundlerResponse.md)
- [CheckResourcesOptions](interfaces/CheckResourcesOptions.md)
- [ClientConfig](interfaces/ClientConfig.md)
- [CommunityClientConfig](interfaces/CommunityClientConfig.md)
- [CommunityConfig](interfaces/CommunityConfig.md)
- [CommunityInfo](interfaces/CommunityInfo.md)
- [ContractVersion](interfaces/ContractVersion.md)
- [CreateCommunityParams](interfaces/CreateCommunityParams.md)
- [DeploymentValidationParams](interfaces/DeploymentValidationParams.md)
- [DVTAccountSignatureParams](interfaces/DVTAccountSignatureParams.md)
- [EnsOptions](interfaces/EnsOptions.md)
- [EnsureFundingParams](interfaces/EnsureFundingParams.md)
- [ExperimentRecord](interfaces/ExperimentRecord.md)
- [FundETHParams](interfaces/FundETHParams.md)
- [FundingParams](interfaces/FundingParams.md)
- [FundingResult](interfaces/FundingResult.md)
- [FundTokenParams](interfaces/FundTokenParams.md)
- [GaslessConfig](interfaces/GaslessConfig.md)
- [HashToFieldU0U1](interfaces/HashToFieldU0U1.md)
- [HeliosTransportConfig](interfaces/HeliosTransportConfig.md)
- [KeyPair](interfaces/KeyPair.md)
- [OnboardResult](interfaces/OnboardResult.md)
- [OperatorClientConfig](interfaces/OperatorClientConfig.md)
- [OperatorStatus](interfaces/OperatorStatus.md)
- [PackedUserOperation](interfaces/PackedUserOperation.md)
- [PaymasterGasParams](interfaces/PaymasterGasParams.md)
- [ProtocolClientConfig](interfaces/ProtocolClientConfig.md)
- [ProtocolParams](interfaces/ProtocolParams.md)
- [PublicClient](interfaces/PublicClient.md)
- [ReputationData](interfaces/ReputationData.md)
- [ResourceBoolCheck](interfaces/ResourceBoolCheck.md)
- [ResourceReport](interfaces/ResourceReport.md)
- [ResourceStakeCheck](interfaces/ResourceStakeCheck.md)
- [RoleConfig](interfaces/RoleConfig.md)
- [RoleRequirement](interfaces/RoleRequirement.md)
- [RoleValidationParams](interfaces/RoleValidationParams.md)
- [ScenarioParams](interfaces/ScenarioParams.md)
- [SponsorshipPolicy](interfaces/SponsorshipPolicy.md)
- [SuperPaymasterConfig](interfaces/SuperPaymasterConfig.md)
- [TokenBalanceValidationParams](interfaces/TokenBalanceValidationParams.md)
- [TransactionOptions](interfaces/TransactionOptions.md)
- [UserClientConfig](interfaces/UserClientConfig.md)
- [UserLifecycleConfig](interfaces/UserLifecycleConfig.md)
- [UserOperationV07](interfaces/UserOperationV07.md)
- [UserOpGasParams](interfaces/UserOpGasParams.md)
- [ValidationParams](interfaces/ValidationParams.md)
- [ValidationResult](interfaces/ValidationResult.md)
- [WalletClient](interfaces/WalletClient.md)

## Type Aliases

- [AccountActions](type-aliases/AccountActions.md)
- [AccountFactoryActions](type-aliases/AccountFactoryActions.md)
- [AdminClient](type-aliases/AdminClient.md)
- [AgentActions](type-aliases/AgentActions.md)
- [AgentRegistryActions](type-aliases/AgentRegistryActions.md)
- [AgentSponsorshipPolicy](type-aliases/AgentSponsorshipPolicy.md)
- [AggregatorActions](type-aliases/AggregatorActions.md)
- [AirAccountActions](type-aliases/AirAccountActions.md)
- [AirAccountFactoryActions](type-aliases/AirAccountFactoryActions.md)
- [AssetPolicy](type-aliases/AssetPolicy.md)
- [AssetPolicyInput](type-aliases/AssetPolicyInput.md)
- [BatchMintResult](type-aliases/BatchMintResult.md)
- [BLSAlgorithmActions](type-aliases/BLSAlgorithmActions.md)
- [BLSG1Point](type-aliases/BLSG1Point.md)
- [BusinessResult](type-aliases/BusinessResult.md)
- [CanonicalAddresses](type-aliases/CanonicalAddresses.md)
- [ChannelActions](type-aliases/ChannelActions.md)
- [ChannelClientConfig](type-aliases/ChannelClientConfig.md)
- [ChannelConfig](type-aliases/ChannelConfig.md)
- [ChannelState](type-aliases/ChannelState.md)
- [CommunityProfile](type-aliases/CommunityProfile.md)
- [ContractCategory](type-aliases/ContractCategory.md)
- [ContractNetwork](type-aliases/ContractNetwork.md)
- [ContractScope](type-aliases/ContractScope.md)
- [ContractScopeInput](type-aliases/ContractScopeInput.md)
- [DirectPaymentPayload](type-aliases/DirectPaymentPayload.md)
- [DryRunValidationResult](type-aliases/DryRunValidationResult.md)
- [DVTActions](type-aliases/DVTActions.md)
- [DVTTier](type-aliases/DVTTier.md)
- [EIP3009Authorization](type-aliases/EIP3009Authorization.md)
- [EndUserClient](type-aliases/EndUserClient.md)
- [EntryPointActions](type-aliases/EntryPointActions.md)
- [EOAWalletClient](type-aliases/EOAWalletClient.md)
- [ERC20Actions](type-aliases/ERC20Actions.md)
- [FacilitatorConfig](type-aliases/FacilitatorConfig.md)
- [FacilitatorSupported](type-aliases/FacilitatorSupported.md)
- [FaucetConfig](type-aliases/FaucetConfig.md)
- [FaucetPreparationResult](type-aliases/FaucetPreparationResult.md)
- [ForceExitActions](type-aliases/ForceExitActions.md)
- [GaslessReadinessReport](type-aliases/GaslessReadinessReport.md)
- [GaslessTransactionConfig](type-aliases/GaslessTransactionConfig.md)
- [GTokenActions](type-aliases/GTokenActions.md)
- [GTokenAuthorizationActions](type-aliases/GTokenAuthorizationActions.md)
- [InitConfig](type-aliases/InitConfig.md)
- [LegacyCommunityClient](type-aliases/LegacyCommunityClient.md)
- [NetworkContracts](type-aliases/NetworkContracts.md)
- [NetworkId](type-aliases/NetworkId.md)
- [OperatorClient](type-aliases/OperatorClient.md)
- [OperatorConfig](type-aliases/OperatorConfig.md)
- [OperatorMode](type-aliases/OperatorMode.md)
- [P256SessionState](type-aliases/P256SessionState.md)
- [PaymasterActions](type-aliases/PaymasterActions.md)
- [PaymasterConfig](type-aliases/PaymasterConfig.md)
- [PaymasterFactoryActions](type-aliases/PaymasterFactoryActions.md)
- [PaymasterType](type-aliases/PaymasterType.md)
- [PaymasterV4MiddlewareConfig](type-aliases/PaymasterV4MiddlewareConfig.md)
- [PaymentPayload](type-aliases/PaymentPayload.md)
- [PaymentRequired](type-aliases/PaymentRequired.md)
- [PaymentRequirements](type-aliases/PaymentRequirements.md)
- [PendingExit](type-aliases/PendingExit.md)
- [PendingModuleInstall](type-aliases/PendingModuleInstall.md)
- [PolicyRegistryActions](type-aliases/PolicyRegistryActions.md)
- [RegistryActions](type-aliases/RegistryActions.md)
- [ReputationActions](type-aliases/ReputationActions.md)
- [ReputationBreakdown](type-aliases/ReputationBreakdown.md)
- [ReputationRule](type-aliases/ReputationRule.md)
- [ResolvedAPNTsToken](type-aliases/ResolvedAPNTsToken.md)
- [ResourceInfo](type-aliases/ResourceInfo.md)
- [RoleConfigDetailed](type-aliases/RoleConfigDetailed.md)
- [RoleId](type-aliases/RoleId.md)
- [SBTActions](type-aliases/SBTActions.md)
- [SBTData](type-aliases/SBTData.md)
- [SBTMembership](type-aliases/SBTMembership.md)
- [SessionKeyValidatorActions](type-aliases/SessionKeyValidatorActions.md)
- [SettleResponse](type-aliases/SettleResponse.md)
- [SignedVoucher](type-aliases/SignedVoucher.md)
- [SimpleSmartAccount](type-aliases/SimpleSmartAccount.md)
- [SlashRecord](type-aliases/SlashRecord.md)
- [SpendCounter](type-aliases/SpendCounter.md)
- [StakingActions](type-aliases/StakingActions.md)
- [SuperPaymasterActions](type-aliases/SuperPaymasterActions.md)
- [SupportedChainId](type-aliases/SupportedChainId.md)
- [SupportedNetwork](type-aliases/SupportedNetwork.md)
- [TokenActions](type-aliases/TokenActions.md)
- [TokenConfig](type-aliases/TokenConfig.md)
- [VerifyResponse](type-aliases/VerifyResponse.md)
- [VoucherParams](type-aliases/VoucherParams.md)
- [X402Actions](type-aliases/X402Actions.md)
- [X402ClientConfig](type-aliases/X402ClientConfig.md)
- [X402PaymentParams](type-aliases/X402PaymentParams.md)
- [XPNTsFactoryActions](type-aliases/XPNTsFactoryActions.md)
- [XPNTsTokenActions](type-aliases/XPNTsTokenActions.md)

## Variables

- [AASTAR\_COMMUNITY](variables/AASTAR_COMMUNITY.md)
- [AAStarAirAccountFactoryV7ABI](variables/AAStarAirAccountFactoryV7ABI.md)
- [AAStarAirAccountFactoryV7Artifact](variables/AAStarAirAccountFactoryV7Artifact.md)
- [AAStarAirAccountV7ABI](variables/AAStarAirAccountV7ABI.md)
- [AAStarAirAccountV7Artifact](variables/AAStarAirAccountV7Artifact.md)
- [AAStarBLSAggregatorABI](variables/AAStarBLSAggregatorABI.md)
- [AAStarBLSAggregatorArtifact](variables/AAStarBLSAggregatorArtifact.md)
- [AAStarBLSAlgorithmABI](variables/AAStarBLSAlgorithmABI.md)
- [AAStarBLSAlgorithmArtifact](variables/AAStarBLSAlgorithmArtifact.md)
- [AAStarValidatorABI](variables/AAStarValidatorABI.md)
- [AAStarValidatorArtifact](variables/AAStarValidatorArtifact.md)
- [AGENT\_IDENTITY\_REGISTRY\_ADDRESS](variables/AGENT_IDENTITY_REGISTRY_ADDRESS.md)
- [AGENT\_REPUTATION\_REGISTRY\_ADDRESS](variables/AGENT_REPUTATION_REGISTRY_ADDRESS.md)
- [AgentRegistryABI](variables/AgentRegistryABI.md)
- [AgentRegistryArtifact](variables/AgentRegistryArtifact.md)
- [AirAccountDelegateABI](variables/AirAccountDelegateABI.md)
- [AirAccountDelegateArtifact](variables/AirAccountDelegateArtifact.md)
- [AirAccountExtensionABI](variables/AirAccountExtensionABI.md)
- [AirAccountExtensionArtifact](variables/AirAccountExtensionArtifact.md)
- [ALL\_ADDRESSES](variables/ALL_ADDRESSES.md)
- [ALL\_ROLES](variables/ALL_ROLES.md)
- [APNTS\_ADDRESS](variables/APNTS_ADDRESS.md)
- [BLS\_AGGREGATOR\_ADDRESS](variables/BLS_AGGREGATOR_ADDRESS.md)
- [BLS\_POP\_DST](variables/BLS_POP_DST.md)
- [BLS\_VALIDATOR\_ADDRESS](variables/BLS_VALIDATOR_ADDRESS.md)
- [BLSAggregatorABI](variables/BLSAggregatorABI.md)
- [BLSAggregatorArtifact](variables/BLSAggregatorArtifact.md)
- [BLSHelpers](variables/BLSHelpers.md)
- [BLSValidatorABI](variables/BLSValidatorABI.md)
- [BLSValidatorArtifact](variables/BLSValidatorArtifact.md)
- [BPS\_DENOMINATOR](variables/BPS_DENOMINATOR.md)
- [BRANDING](variables/BRANDING.md)
- [BREAD\_COMMUNITY](variables/BREAD_COMMUNITY.md)
- [CalldataParserRegistryABI](variables/CalldataParserRegistryABI.md)
- [CalldataParserRegistryArtifact](variables/CalldataParserRegistryArtifact.md)
- [CANONICAL\_ADDRESSES](variables/CANONICAL_ADDRESSES.md)
- [CHAIN\_MAINNET](variables/CHAIN_MAINNET.md)
- [CHAIN\_SEPOLIA](variables/CHAIN_SEPOLIA.md)
- [COMMUNITIES](variables/COMMUNITIES.md)
- [COMMUNITY\_OWNERS](variables/COMMUNITY_OWNERS.md)
- [CONTRACT\_METADATA](variables/CONTRACT_METADATA.md)
- [CONTRACT\_SRC\_HASH](variables/CONTRACT_SRC_HASH.md)
- [CONTRACTS](variables/CONTRACTS.md)
- [CORE\_ADDRESSES](variables/CORE_ADDRESSES.md)
- [CustomErrors](variables/CustomErrors.md)
- [DEFAULT\_ADMIN\_ROLE](variables/DEFAULT_ADMIN_ROLE.md)
- [DEFAULT\_APNTS\_PRICE\_USD](variables/DEFAULT_APNTS_PRICE_USD.md)
- [DEFAULT\_CALL\_GAS\_LIMIT](variables/DEFAULT_CALL_GAS_LIMIT.md)
- [DEFAULT\_GAS\_TOKEN\_MINT\_AMOUNT](variables/DEFAULT_GAS_TOKEN_MINT_AMOUNT.md)
- [DEFAULT\_PRE\_VERIFICATION\_GAS](variables/DEFAULT_PRE_VERIFICATION_GAS.md)
- [DEFAULT\_TIMEOUT\_MS](variables/DEFAULT_TIMEOUT_MS.md)
- [DEFAULT\_TOKEN\_NAME](variables/DEFAULT_TOKEN_NAME.md)
- [DEFAULT\_TOKEN\_SYMBOL](variables/DEFAULT_TOKEN_SYMBOL.md)
- [DEFAULT\_USDT\_MINT\_AMOUNT](variables/DEFAULT_USDT_MINT_AMOUNT.md)
- [DEFAULT\_VERIFICATION\_GAS\_LIMIT](variables/DEFAULT_VERIFICATION_GAS_LIMIT.md)
- [DVT\_TIER\_T2](variables/DVT_TIER_T2.md)
- [DVT\_TIER\_T3](variables/DVT_TIER_T3.md)
- [DVT\_VALIDATOR\_ADDRESS](variables/DVT_VALIDATOR_ADDRESS.md)
- [DVTValidatorABI](variables/DVTValidatorABI.md)
- [DVTValidatorArtifact](variables/DVTValidatorArtifact.md)
- [EIP3009\_TYPES](variables/EIP3009_TYPES.md)
- [ENTRY\_POINT\_ADDRESS](variables/ENTRY_POINT_ADDRESS.md)
- [EntryPointABI](variables/EntryPointABI.md)
- [EntryPointArtifact](variables/EntryPointArtifact.md)
- [FAUCET\_API\_URL](variables/FAUCET_API_URL.md)
- [ForceExitModuleABI](variables/ForceExitModuleABI.md)
- [ForceExitModuleArtifact](variables/ForceExitModuleArtifact.md)
- [GTOKEN\_ADDRESS](variables/GTOKEN_ADDRESS.md)
- [GTOKEN\_EIP712\_DOMAIN](variables/GTOKEN_EIP712_DOMAIN.md)
- [GTOKEN\_STAKING\_ADDRESS](variables/GTOKEN_STAKING_ADDRESS.md)
- [GTokenABI](variables/GTokenABI.md)
- [GTokenArtifact](variables/GTokenArtifact.md)
- [GTokenAuthorizationABI](variables/GTokenAuthorizationABI.md)
- [GTokenAuthorizationArtifact](variables/GTokenAuthorizationArtifact.md)
- [GTokenStakingABI](variables/GTokenStakingABI.md)
- [GTokenStakingArtifact](variables/GTokenStakingArtifact.md)
- [HEADER\_PAYMENT\_REQUIRED](variables/HEADER_PAYMENT_REQUIRED.md)
- [HEADER\_PAYMENT\_RESPONSE](variables/HEADER_PAYMENT_RESPONSE.md)
- [HEADER\_PAYMENT\_SIGNATURE](variables/HEADER_PAYMENT_SIGNATURE.md)
- [HEADER\_V1\_PAYMENT](variables/HEADER_V1_PAYMENT.md)
- [HEADER\_V1\_PAYMENT\_RESPONSE](variables/HEADER_V1_PAYMENT_RESPONSE.md)
- [INITIAL\_ROLE\_STAKES](variables/INITIAL_ROLE_STAKES.md)
- [LINKS](variables/LINKS.md)
- [MAX\_SERVICE\_FEE](variables/MAX_SERVICE_FEE.md)
- [MICRO\_PAYMENT\_CHANNEL\_ADDRESS](variables/MICRO_PAYMENT_CHANNEL_ADDRESS.md)
- [MicroPaymentChannelABI](variables/MicroPaymentChannelABI.md)
- [MicroPaymentChannelArtifact](variables/MicroPaymentChannelArtifact.md)
- [MONITORING\_ADDRESSES](variables/MONITORING_ADDRESSES.md)
- [MySBTABI](variables/MySBTABI.md)
- [MySBTArtifact](variables/MySBTArtifact.md)
- [NETWORKS](variables/NETWORKS.md)
- [NODE\_STAKE\_AMOUNTS](variables/NODE_STAKE_AMOUNTS.md)
- [OFFICIAL\_ADDRESSES](variables/OFFICIAL_ADDRESSES.md)
- [PAYMASTER\_ADDRESSES](variables/PAYMASTER_ADDRESSES.md)
- [PAYMASTER\_FACTORY\_ADDRESS](variables/PAYMASTER_FACTORY_ADDRESS.md)
- [PAYMASTER\_V4\_ADDRESS](variables/PAYMASTER_V4_ADDRESS.md)
- [PAYMASTER\_V4\_IMPL\_ADDRESS](variables/PAYMASTER_V4_IMPL_ADDRESS.md)
- [PaymasterABI](variables/PaymasterABI.md)
- [PaymasterArtifact](variables/PaymasterArtifact.md)
- [PaymasterFactoryABI](variables/PaymasterFactoryABI.md)
- [PaymasterFactoryArtifact](variables/PaymasterFactoryArtifact.md)
- [PolicyRegistryABI](variables/PolicyRegistryABI.md)
- [PolicyRegistryArtifact](variables/PolicyRegistryArtifact.md)
- [REGISTRY\_ADDRESS](variables/REGISTRY_ADDRESS.md)
- [RegistryABI](variables/RegistryABI.md)
- [RegistryArtifact](variables/RegistryArtifact.md)
- [REPUTATION\_SYSTEM\_ADDRESS](variables/REPUTATION_SYSTEM_ADDRESS.md)
- [ReputationSystemABI](variables/ReputationSystemABI.md)
- [ReputationSystemArtifact](variables/ReputationSystemArtifact.md)
- [ROLE\_ANODE](variables/ROLE_ANODE.md)
- [ROLE\_COMMUNITY](variables/ROLE_COMMUNITY.md)
- [ROLE\_DVT](variables/ROLE_DVT.md)
- [ROLE\_ENDUSER](variables/ROLE_ENDUSER.md)
- [ROLE\_KMS](variables/ROLE_KMS.md)
- [ROLE\_NAMES](variables/ROLE_NAMES.md)
- [ROLE\_PAYMASTER\_AOA](variables/ROLE_PAYMASTER_AOA.md)
- [ROLE\_PAYMASTER\_SUPER](variables/ROLE_PAYMASTER_SUPER.md)
- [ROLE\_PERMISSION\_LEVELS](variables/ROLE_PERMISSION_LEVELS.md)
- [RoleDataFactory](variables/RoleDataFactory.md)
- [RoleIds](variables/RoleIds.md)
- [SBT\_ADDRESS](variables/SBT_ADDRESS.md)
- [SEPOLIA\_CONTRACTS](variables/SEPOLIA_CONTRACTS.md)
- [SEPOLIA\_V2\_VERSIONS](variables/SEPOLIA_V2_VERSIONS.md)
- [SERVICE\_FEE\_RATE](variables/SERVICE_FEE_RATE.md)
- [SessionKeyValidatorABI](variables/SessionKeyValidatorABI.md)
- [SessionKeyValidatorArtifact](variables/SessionKeyValidatorArtifact.md)
- [SimpleAccountABI](variables/SimpleAccountABI.md)
- [SimpleAccountArtifact](variables/SimpleAccountArtifact.md)
- [SimpleAccountFactoryABI](variables/SimpleAccountFactoryABI.md)
- [SimpleAccountFactoryArtifact](variables/SimpleAccountFactoryArtifact.md)
- [SUPER\_PAYMASTER\_ADDRESS](variables/SUPER_PAYMASTER_ADDRESS.md)
- [SuperPaymasterABI](variables/SuperPaymasterABI.md)
- [SuperPaymasterArtifact](variables/SuperPaymasterArtifact.md)
- [TEST\_ACCOUNT\_ADDRESSES](variables/TEST_ACCOUNT_ADDRESSES.md)
- [TEST\_ACCOUNT\_POOL\_SIZE](variables/TEST_ACCOUNT_POOL_SIZE.md)
- [TEST\_COMMUNITIES](variables/TEST_COMMUNITIES.md)
- [TEST\_TOKEN\_ADDRESSES](variables/TEST_TOKEN_ADDRESSES.md)
- [TOKEN\_ADDRESSES](variables/TOKEN_ADDRESSES.md)
- [V2\_SUMMARY](variables/V2_SUMMARY.md)
- [VOUCHER\_TYPES](variables/VOUCHER_TYPES.md)
- [X402FacilitatorABI](variables/X402FacilitatorABI.md)
- [X402FacilitatorArtifact](variables/X402FacilitatorArtifact.md)
- [XPNTS\_FACTORY\_ADDRESS](variables/XPNTS_FACTORY_ADDRESS.md)
- [xPNTsFactoryABI](variables/xPNTsFactoryABI.md)
- [xPNTsFactoryArtifact](variables/xPNTsFactoryArtifact.md)
- [xPNTsTokenABI](variables/xPNTsTokenABI.md)
- [xPNTsTokenArtifact](variables/xPNTsTokenArtifact.md)

## Functions

- [accountActions](functions/accountActions.md)
- [accountFactoryActions](functions/accountFactoryActions.md)
- [agentActions](functions/agentActions.md)
- [agentRegistryActions](functions/agentRegistryActions.md)
- [aggregatorActions](functions/aggregatorActions.md)
- [airAccountActions](functions/airAccountActions.md)
- [airAccountFactoryActions](functions/airAccountFactoryActions.md)
- [applyConfig](functions/applyConfig.md)
- [blsAlgorithmActions](functions/blsAlgorithmActions.md)
- [buildPaymasterData](functions/buildPaymasterData.md)
- [buildSuperPaymasterData](functions/buildSuperPaymasterData.md)
- [channelActions](functions/channelActions.md)
- [checkEligibility](functions/checkEligibility.md)
- [checkMySBT](functions/checkMySBT.md)
- [createAAStarPublicClient](functions/createAAStarPublicClient.md)
- [createAdminClient](functions/createAdminClient.md)
- [createCommunityClient](functions/createCommunityClient.md)
- [createEndUserClient](functions/createEndUserClient.md)
- [createEOAWalletClient](functions/createEOAWalletClient.md)
- [createHeliosTransport](functions/createHeliosTransport.md)
- [createOperatorClient](functions/createOperatorClient.md)
- [decodeContractError](functions/decodeContractError.md)
- [decodePaymentPayload](functions/decodePaymentPayload.md)
- [decodePaymentRequired](functions/decodePaymentRequired.md)
- [decodeSettleResponse](functions/decodeSettleResponse.md)
- [describeSupportedChains](functions/describeSupportedChains.md)
- [dvtActions](functions/dvtActions.md)
- [encodeDVTAccountSignature](functions/encodeDVTAccountSignature.md)
- [encodeDVTVerifierProof](functions/encodeDVTVerifierProof.md)
- [encodeG2Point](functions/encodeG2Point.md)
- [encodePaymentPayload](functions/encodePaymentPayload.md)
- [encodePaymentRequired](functions/encodePaymentRequired.md)
- [encodeSettleResponse](functions/encodeSettleResponse.md)
- [entryPointActions](functions/entryPointActions.md)
- [extractPaymentRequired](functions/extractPaymentRequired.md)
- [extractSettleResponse](functions/extractSettleResponse.md)
- [forceExitActions](functions/forceExitActions.md)
- [formatUserOpV07](functions/formatUserOpV07.md)
- [generateNonce](functions/generateNonce.md)
- [getAddressUrl](functions/getAddressUrl.md)
- [getAllCommunityConfigs](functions/getAllCommunityConfigs.md)
- [getAllV2Contracts](functions/getAllV2Contracts.md)
- [getBlockExplorer](functions/getBlockExplorer.md)
- [getCanonicalAddresses](functions/getCanonicalAddresses.md)
- [getChainId](functions/getChainId.md)
- [getCommunities](functions/getCommunities.md)
- [getCommunity](functions/getCommunity.md)
- [getCommunityConfig](functions/getCommunityConfig.md)
- [getContract](functions/getContract.md)
- [getContractNetworks](functions/getContractNetworks.md)
- [getContracts](functions/getContracts.md)
- [getCoreContracts](functions/getCoreContracts.md)
- [getDeploymentDate](functions/getDeploymentDate.md)
- [getEIP3009Domain](functions/getEIP3009Domain.md)
- [getEntryPoint](functions/getEntryPoint.md)
- [getMySBTId](functions/getMySBTId.md)
- [getNetwork](functions/getNetwork.md)
- [getPaymasterV4\_1](functions/getPaymasterV4_1.md)
- [getPaymasterV4Middleware](functions/getPaymasterV4Middleware.md)
- [getRoleName](functions/getRoleName.md)
- [getRpcUrl](functions/getRpcUrl.md)
- [getSimpleAccountFactory](functions/getSimpleAccountFactory.md)
- [getSuperPaymasterMiddleware](functions/getSuperPaymasterMiddleware.md)
- [getSuperPaymasterV2](functions/getSuperPaymasterV2.md)
- [getTestAccounts](functions/getTestAccounts.md)
- [getTestTokenContracts](functions/getTestTokenContracts.md)
- [getTokenContracts](functions/getTokenContracts.md)
- [getTxUrl](functions/getTxUrl.md)
- [getUserOpHash](functions/getUserOpHash.md)
- [getUserOpHashV07](functions/getUserOpHashV07.md)
- [getV2ContractByAddress](functions/getV2ContractByAddress.md)
- [getV2ContractByName](functions/getV2ContractByName.md)
- [getV2ContractsByDate](functions/getV2ContractsByDate.md)
- [getVoucherDomain](functions/getVoucherDomain.md)
- [gTokenActions](functions/gTokenActions.md)
- [gTokenAuthorizationActions](functions/gTokenAuthorizationActions.md)
- [hashToFieldU0U1](functions/hashToFieldU0U1.md)
- [isContractNetworkSupported](functions/isContractNetworkSupported.md)
- [isRegisteredCommunity](functions/isRegisteredCommunity.md)
- [isSupportedChainId](functions/isSupportedChainId.md)
- [isV2Contract](functions/isV2Contract.md)
- [listSupportedChainIds](functions/listSupportedChainIds.md)
- [lookupAddress](functions/lookupAddress.md)
- [packUserOpLimits](functions/packUserOpLimits.md)
- [paymasterActions](functions/paymasterActions.md)
- [paymasterFactoryActions](functions/paymasterFactoryActions.md)
- [policyRegistryActions](functions/policyRegistryActions.md)
- [registryActions](functions/registryActions.md)
- [reputationActions](functions/reputationActions.md)
- [resolveEns](functions/resolveEns.md)
- [resolveEnsVerified](functions/resolveEnsVerified.md)
- [sbtActions](functions/sbtActions.md)
- [sessionKeyValidatorActions](functions/sessionKeyValidatorActions.md)
- [signCancelAuthorization](functions/signCancelAuthorization.md)
- [signGTokenTransferWithAuthorization](functions/signGTokenTransferWithAuthorization.md)
- [signReceiveWithAuthorization](functions/signReceiveWithAuthorization.md)
- [signTransferWithAuthorization](functions/signTransferWithAuthorization.md)
- [signVoucher](functions/signVoucher.md)
- [stakingActions](functions/stakingActions.md)
- [superPaymasterActions](functions/superPaymasterActions.md)
- [tokenActions](functions/tokenActions.md)
- [toSimpleSmartAccount](functions/toSimpleSmartAccount.md)
- [tuneGasLimit](functions/tuneGasLimit.md)
- [x402Actions](functions/x402Actions.md)
- [x402IsNonceUsed](functions/x402IsNonceUsed.md)
- [x402NonceKey](functions/x402NonceKey.md)
- [xPNTsFactoryActions](functions/xPNTsFactoryActions.md)
- [xPNTsTokenActions](functions/xPNTsTokenActions.md)

## References

### AirAccount

Renames and re-exports [KMS](namespaces/KMS/README.md)
