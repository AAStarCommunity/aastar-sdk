# 账户初始化指南 (Account Initialization Guide)

本文档旨在帮助开发者和集成商理解如何在 AAStar SDK 中以全局一致的方式初始化和管理 ERC-4337 智能账户。

## 1. 核心原则：配置驱动与全局一致性

SDK 旨在提供一套**无感切换**的账户体系。无论你使用的是默认的 `SimpleAccount`，还是 `Kernel` 或 `Safe` 等高级账户体系，你只需要在 SDK 的 `Config` 中指定对应的 `factoryAddress` 以及相应的 `factoryType`（可选），SDK 内部会自动适配部署逻辑。

> [!IMPORTANT]
> **不要手动调用底层合约 API**。请始终使用 `UserClient.deployAccount` 作为统一入口。SDK 确保了不同账户合约之间的 API 一致性。

## 2. 初始化流程

初始化账户通常发生在用户首次通过您的应用进行交互时。流程如下：

1.  **生成/获取 Owner 密钥**: 通常是一个 EOA (MetaMask, Privy, etc.)。
2.  **预测账户地址**: 调用 `UserClient.deployAccount` (或单纯预测 API) 获取预计算地址。
3.  **部署账户 (Deploy)**: 调用 `UserClient.deployAccount` 触发链上部署。
4.  **初始化 Client (Initialize)**: 使用部署好的地址初始化 `UserClient`，开始链上业务逻辑。

> [!TIP]
> **地址预测的稳定性**：只要 `owner` 和 `salt` 不变，无论在哪个链（Anvil, Sepolia, OP），预测出的账户地址都是一致的。这保证了跨链身份的一致性（create2 确定性）。

## 3. 使用 SDK 部署账户

SDK 在 `UserClient` 中提供了静态辅助方法 `deployAccount`，它屏蔽了底层工厂合约的差异。

### 3.1 引入 SDK

```typescript
import { UserClient } from '@aastar/sdk';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

const wallet = createWalletClient({
    account: privateKeyToAccount('YOUR_PRIVATE_KEY'),
    chain: sepolia,
    transport: http()
});
```

### 3.2 预测与部署 (支持不同账户体系)

您可以通过简单的配置切换账户体系。

```typescript
// 1. 默认 SimpleAccount
const result1 = await UserClient.deployAccount(wallet, {
    owner: wallet.account.address,
    salt: 0n
});

// 2. 切换到其他工厂 (例如自定义 Factory 地址)
const result2 = await UserClient.deployAccount(wallet, {
    owner: wallet.account.address,
    salt: 123n,
    factoryAddress: '0xCustomFactoryAddress...', // 只需修改此处地址
    // factoryType: 'kernel' // 如果支持特定类型，可以提供类型以适配非标准接口
});

console.log(`✅ Deployed Address: ${result1.accountAddress}`);
```

## 4. 初始化 UserClient

账户部署后，您可以无缝初始化 `EndUserClient`。由于 SDK 屏蔽了底层实现，后续的 `executeGasless` 等业务逻辑对所有账户体系都是一致的。

```typescript
import { createEndUserClient } from '@aastar/sdk';

const userClient = createEndUserClient({
    accountAddress: result1.accountAddress,
    account: wallet.account,
    chainId: sepolia.id,
    // ...其他配置
});
```

## 5. 常见问题 (FAQ)

**Q: 我需要支持 Safe 或 Kernel，需要改代码吗？**
A: 不需要。只需要在部署时传入对应的 `factoryAddress` 并指定 `accountType`（可选）。SDK 的 `deployAccount` 会尝试调用标准的工厂接口（`createAccount/getAddress`）。如果该工厂是非标准的，可以通过 `customAbi` 进行适配。

**Q: 为什么推荐使用 SDK 统一入口？**
A: 因为 SDK 会自动处理公共客户端（PublicClient）与钱包客户端（WalletClient）的分离，确保地址预测的准确性和交易链上部署的原子性，避免手动拼接 `initCode` 的繁琐。

**Q: 账户未部署前可以接收代币吗？**
A: 可以。由于地址是确定性的，您可以向预测出的地址发送代币。但在账户合约部署前，该账户无法发起任何交易。
