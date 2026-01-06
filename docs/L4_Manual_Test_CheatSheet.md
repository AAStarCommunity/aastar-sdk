# L4 Gasless 调试备忘录 (Sepolia Edition)

这份文档旨在协助进行 L4 Gasless 场景的人工调试和验证 (Sepolia Testnet)。

> **注意**: 部分地址 (Token, Paymaster) 是在运行 `l4-setup.ts` 脚本时动态生成的，请参照 `scripts/l4-state.json` 文件获取最新值。

## 1. 核心账户配置 (Keys & Accounts)

请确保你的 `.env.sepolia` 文件中包含以下私钥配置。测试同事应拥有这些账户的控制权。

| 角色 (Role) | 变量名 (ENV Variable) | 说明 (Description) |
| :--- | :--- | :--- |
| **资金提供方** | `PRIVATE_KEY_SUPPLIER` | 用于 Mint GToken, 初始 ETH 分发。 |
| **Operator A** | `PRIVATE_KEY_JASON` | Jason (AAStar Operator)。负责 Paymaster V4 + aPNTs。 |
| **Operator B** | `PRIVATE_KEY_BOB` | Bob (Bread Operator)。负责 Paymaster V4 + bPNTs。 |
| **Operator C** | `PRIVATE_KEY_ANNI` | Anni (Demo Operator)。负责 SuperPaymaster + cPNTs (Credit)。 |

## 2. 全局合约地址 (Global Contracts - Sepolia)

这些是部署在 Sepolia 的核心系统合约 (来自 `config.sepolia.json`)。

| 合约名称 (Contract) | 地址 (Address) | 说明 |
| :--- | :--- | :--- |
| **Registry** | `0x5938d6C887EF7b4e7733c5e7ea0595AAEf508e74` | 核心注册表，管理权限与角色 |
| **EntryPoint** | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` | ERC-4337 官方入口点 (v0.7) |
| **GToken** | `0xf6d7fa6819791FE595b12c6C34A8e0a8982F375D` | 系统 Gas Token (ERC-20) |
| **GTokenStaking** | `0xfE7513281D4e9ad922C89125C5B509Fda2426f20` | Paymaster 质押合约 (Locking) |
| **SBT** | `0x255b0fFBcAFE8FdBC4eD8119E59897DcaF61eF12` | 灵魂绑定代币合约 (Identity) |
| **ReputationSystem**| `0x98C2aA5D87f7F2511813a07df2369C36E8522F1F` | 信誉系统合约 |
| **PaymasterFactory**| `0x4b05538995a159754923867bDA5cb20c16410a8d` | 部署 Paymaster V4 的工厂 |
| **PaymasterV4Impl** | `0xe57c0fDBB96e228b01fF5DFCA83482b40C7a9A53` | V4 实现合约地址 |
| **SuperPaymaster** | `0x64C95279bA723394aaA01fE47ECA1Bfc4A234508` | 超级 Paymaster (代理合约) |

## 3. 动态环境配置 (Dynamic Setup)

运行 `pnpm tsx scripts/l4-setup.ts --network=sepolia` 后，以下信息会更新到 `scripts/l4-state.json`。

| 社区名称 | Operator | Token Symbol | Paymaster 类型 | 获取地址方式 |
| :--- | :--- | :--- | :--- | :--- |
| **AAStar** | Jason | **aPNTs** | **V4** | 查看 `l4-state.json` -> `jason.tokenAddress` / `jason.paymasterAddress` |
| **Bread** | Bob | **bPNTs** | **V4** | 查看 `l4-state.json` -> `bob.tokenAddress` / `bob.paymasterAddress` |
| **Demo** | Anni | **cPNTs** | **Super** | 查看 `l4-state.json` -> `anni.tokenAddress` / `anni.superPaymasterAddress` |

## 4. 初始化状态检查清单 (Setup Checklist)

人工测试前，请确认脚本已自动完成以下步骤：

- [ ] **Community Registered**: 三个 Operator 地址都拥有 `ROLE_COMMUNITY`。
- [ ] **Token Issued**: aPNTs, bPNTs, cPNTs 已部署。
- [ ] **Paymaster Setup**:
    - Jason & Bob 的 Paymaster V4 已部署，且 Stake > 0 (在 GTokenStaking)。
    - Anni 的 SuperPaymaster 额度已配置。
    - Paymaster V4 在 EntryPoint 的 ETH 存款 (Deposit) 足够 (建议 > 0.05 ETH)。
- [ ] **User Funding**:
    - 测试用户 (NewUser) 拥有足够的 **aPNTs** (支付 Gas 用)。
    - 测试用户拥有 **GToken** (如果测试 Staking 场景)。

## 5. 常用调试命令

```bash
# 1. 运行环境配置 (幂等，可重复运行修复状态)
pnpm tsx scripts/l4-setup.ts --network=sepolia

# 2. 运行 Gasless 回归测试
pnpm tsx tests/regression/l4-gasless.ts --network=sepolia

# 3. 查看状态文件
cat scripts/l4-state.json
```
