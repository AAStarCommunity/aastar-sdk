# L4 Gasless 调试备忘录 (L4 Debug Cheat Sheet)

这份文档旨在协助进行 L4 Gasless 场景的人工调试和验证。适用于 Sepolia, Anvil 或其他 EVM 网络。

> **注意**: 部分地址 (Token, Paymaster) 是在运行 `l4-setup.ts` 脚本时动态生成的，请参照 `scripts/l4-state.json` 文件获取最新值。

## 1. 核心账户配置 (Keys & Accounts)

请确保你的 ENV 文件 (`.env.sepolia` 或 `.env.anvil`) 中包含以下私钥配置。

| 角色 (Role) | 变量名 (ENV Variable) | 说明 (Description) |
| :--- | :--- | :--- |
| **资金提供方** | `PRIVATE_KEY_SUPPLIER` | Used for Minting GToken, Initial ETH funding. |
| **Operator A** | `PRIVATE_KEY_JASON` | Jason (AAStar Operator). Paymaster V4 + aPNTs. |
| **Operator B** | `PRIVATE_KEY_BOB` | Bob (Bread Operator). Paymaster V4 + bPNTs. |
| **Operator C** | `PRIVATE_KEY_ANNI` | Anni (Demo Operator). SuperPaymaster + cPNTs. |

## 2. 全局合约 (Global Contracts)

### 2.1 说明 (Concepts)

PaymasterFactory是有注册实例（PaymasterV4Impl）的工厂合约，任何社区可以无许可的发行自己的Gas Token，然后从工厂clone 实例proxy来完成低gas部署和绑定自己的Gas Token（例如bPNTs，cPNTs），从而为自己的社区提供Gasless服务（需要自行充值到EntryPoint和维护运营）。

而SuperPaymaster是多租户的公共基础设施，它是一个全局唯一Paymaster，同时也是一个多租户的合约，社区在注册和发行自己的gas token后，需要购买此合约的唯一服务方AAStar社区发行的aPNTs并deposite到SuperPaymaster，然后自己的社区成员可以获得该社区的bPNTs，cPNTs等，作为gas token无感支付（AAStar社区会维护运营）。

无论是Paymaster V4还是SuperPaymaster，都是标准的ERC4337 Paymaster，本测试会为几个测试账户分别部署两个不同的Paymaster V4，注册一个SuperPaymaster（全局唯一，无需部署，注册即可）。

GToken是Mycelium的治理代币，2100万硬顶，除了社区投票和治理外，核心作用是公共物品花园的门票。所有协议的参与者（例如节点运营商、Paymaster服务商和SuperPaymaster注册服务商等）和使用者（普通的用户等），都需要stake & locky一定数量的GToken来获得入场资格，永久一次性门票，可退票。Mycelium协议致力于维护和提供一套不断产生数字公共物品的流程和基建，包括Infrastucture, Protocol, DApp三个层级的协作和支持。GTokenStaking是对应的管理合约，在注册和质押GToken时使用，需要一次性approve一定的额度范围（例如普通用户大约需要0.45,注册社区需要33, 启动Paymaster大约需要33, 注册启动SuperPaymaster大约需要55等等，此配置可由协议治理多签进行调整）。

MySBT是Mycelium的灵魂绑定的一个数字白板，归属于第一次mint的用户，当你注册为Mycelium协议成员或者任意协议社区时自动mint。白板秉持隐私保护策略，owner全权控制显示哪些信息，自动绑定了Gasless加油卡，接受所有协议内的社区自己发行的Gas Token，自动绑定了数字公共物品花园的门票，同时被动接受社区自定义的reputation规则的更新和全局reputation的更新。Reputation越高，获得Mycelium内部DApp启动的早期邀请和airdrop的概率越大。同时也是一个可以设置头像的NFT，可配置profile等。

xPNTsFactory和xPNTs，是工厂合约和泛指任意社区发行的ERC20Gas Token，只要拥有加油卡（MySBT+充值xPNTs）即可无感支付Gas，自由交易。

### 2.2 合约地址 (Addresses)

这些是部署在网络上的核心系统合约 (请检查 `config.<network>.json`)。

| 合约名称 (Contract) | 说明 |
| :--- | :--- |
| **Registry** | 核心注册表，管理权限与角色 |
| **EntryPoint** | ERC-4337 官方入口点 (v0.7) |
| **GToken** | 系统 Gas Token (ERC-20) |
| **GTokenStaking** | Paymaster 质押合约 (Locking) |
| **SBT** | 灵魂绑定代币合约 (Identity) |
| **ReputationSystem**| 信誉系统合约 |
| **PaymasterFactory**| 部署 Paymaster V4 的工厂 |
| **SuperPaymaster** | 超级 Paymaster (代理合约) |

## 3. 动态环境配置 (Dynamic Setup)

运行 `pnpm tsx scripts/l4-setup.ts --network=<name>` 后，以下信息会更新到 `scripts/l4-state.json`。

| 社区名称 | Operator | Token Symbol | Paymaster 类型 | 获取地址方式 (l4-state.json) |
| :--- | :--- | :--- | :--- | :--- |
| **AAStar** | Jason | **aPNTs** | **V4** | `jason.tokenAddress` / `jason.paymasterAddress` |
| **Bread** | Bob | **bPNTs** | **V4** | `bob.tokenAddress` / `bob.paymasterAddress` |
| **Demo** | Anni | **cPNTs** | **Super** | `anni.tokenAddress` / `anni.superPaymasterAddress` |

## 4. 自动化初始化检查清单 (Setup Checklist)

`scripts/l4-setup.ts` 会自动执行以下检查与修复动作 (Idempotent)。此脚本适配不同网络，基于 `config.<network>.json` 加载配置。

| # | 检查项 (Item) | 逻辑 (Logic) | 预期 (Expectation) |
| :--- | :--- | :--- | :--- |
| **1** | **Check/Deploy AA** | 使用 0.7 Factory 计算并部署 AA 账户 | Jason, Bob, Anni 的 AA 账户已部署 |
| **2** | **Operator Funding** | 检查 AA & EOA 的 ETH/GToken 余额 | ETH > 0.05, GToken > 1000 |
| **3** | **Community Role** | `registry.hasRole(COMMUNITY)` | Operator 均注册为 Community |
| **4** | **Token Deployment** | `factory.getTokenAddress(owner)` | aPNTs, bPNTs, cPNTs 已部署 |
| **5** | **Paymaster V4** | `pmFactory.getPaymaster(owner)` | Jason & Bob 拥有 Paymaster V4 实例 |
| **6** | **SuperPaymaster**| Operator Client Registration | Anni 注册为 SuperPaymaster Operator |
| **7** | **Deposits** | `entryPoint.balanceOf(pm)` | Paymaster 在 EntryPoint 存款 > 0.1 ETH |

## 5. 常用调试命令

```bash
# 1. 运行环境配置 (幂等，推荐每次测试前运行)
pnpm tsx scripts/l4-setup.ts --network=sepolia

# 2. 运行 Gasless 回归测试
pnpm tsx tests/regression/l4-gasless.ts --network=sepolia

# 3. 查看状态文件
cat scripts/l4-state.json
```

## 6. 新建 AA 账户 & Gasless 开发指南 (Developer Workflow)

如果你需要测试一个新的 AA 账户 (SimpleAccount)，请遵循以下标准流程：

### Step 1: 账户生成与初始化 (Client SDK)

无需手动部署 Factory，使用 `UserClient` 即可。

```typescript
import { UserClient } from '@aastar/enduser';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';

// 1. 本地生成/读取私钥
const pKey = generatePrivateKey(); 
const account = privateKeyToAccount(pKey);

// 2. 初始化 Client (自动关联 EntryPoint v0.7)
// 注意：configs 应从 network config 加载，不应 hardcode
const client = new UserClient({
    client: createWalletClient({ 
        account, 
        chain: chainConfig, 
        transport: http(rpcUrl) 
    }),
    entryPointAddress: CONFIG.entryPoint,
    registryAddress: CONFIG.registry
    // ... 其他地址
});
console.log(`New AA Address: ${client.accountAddress}`);
```

### Step 2: 资金准备 (Admin Actions)

新账户需要 Gas Token 来通过 Paymaster 验证。

*   **Operator (Admin)** 调用 SDK 发放代币：
    ```typescript
    await tokenActions(operatorClient).mint({
        token: aPNTsAddress,
        to: client.accountAddress, // AA 地址
        amount: parseEther('100')
    });
    ```
*   **Supplier** 发放少量 ETH (可选，如果 Token 不支持 Permit 或是首次 Approve 需要)：
    ```typescript
    await supplier.sendTransaction({ to: client.accountAddress, value: parseEther('0.05') });
    ```

### Step 3: Approve Paymaster (User Actions)

在发起 Gasless 交易前，必须授权 Paymaster 扣款。

```typescript
// 普通 ERC20 Approve
const tx = await tokenActions(client.client).approve({
    token: aPNTsAddress,
    spender: paymasterAddress,
    amount: parseEther('1000')
});
// 等待 Approve 上链 (Approve 本身需要 ETH Gas)
```

### Step 4: 发送 Gasless 交易 (User Actions)

使用 `executeGasless` 自动构建 UserOp。

```typescript
import { encodeFunctionData } from 'viem';

// 1. 业务逻辑 (如: 注册自己)
const callData = encodeFunctionData({
    abi: RegistryABI,
    functionName: 'registerRoleSelf',
    args: [ROLE_COMMUNITY, '0x']
});

// 2. 提交
const hash = await client.executeGasless({
    target: registryAddress,
    value: 0n,
    data: callData,
    paymaster: paymasterAddress,
    paymasterType: 'V4' // 或 'Super'
});
console.log(`UserOp Hash: ${hash}`);
```
