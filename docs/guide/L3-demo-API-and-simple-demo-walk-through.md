# AAstar SDK: L3 Demo API 审查与 Simple Demo 对比指南

## 第一部分：L3 Complete Demo - SDK API 使用审查报告

### 审查目标
确认 `examples/l3-complete-demo.ts` 中所有基础流程都依赖 SDK API，而不是直接使用 `writeContract`。

### 审查结果：✅ 通过
所有关键操作均已使用 SDK 提供的高层 API，无直接底层合约调用。

### API 使用明细

#### 1. ⛏️ Token Minting（资金准备）
**操作**: 为 Alice 铸造 GToken 和 aPNTs
**SDK API 使用**:
```typescript
// GToken Minting
const gToken = gTokenActions()(supplierClient);
await gToken.mint({
    token: config.contracts.gToken,
    to: aliceAcc.address,
    amount: parseEther('100'),
    account: supplierAcc
});

// aPNTs Minting
const aPNTsToken = tokenActions()(supplierClient);
await aPNTsToken.mint({
    token: config.contracts.aPNTs,
    to: aliceAcc.address,
    amount: parseEther('4000'),
    account: supplierAcc
});
```
- **位置**: 第 120-139 行
- **状态**: ✅ 使用 SDK API

#### 2. 🏛️ Community Creation（社区创建）
**操作**: Alice 创建并启动社区
**SDK API 使用**:
```typescript
const aliceCommunity = new CommunityClient({ ... });
const res = await aliceCommunity.setupCommunity({
    name: communityName,
    tokenName: `${communityName} Token`,
    tokenSymbol: "ALICE",
    description: "Demo Community",
    stakeAmount: parseEther('30')
});
```
- **位置**: 第 160-192 行
- **状态**: ✅ 使用 SDK API (`CommunityClient.setupCommunity`)

#### 3. 🔗 Link Token to SuperPaymaster（Token 关联）
**操作**: 将 xPNTs Token 链接到 SuperPaymaster
**SDK API 使用** (🆕 本次修复):
```typescript
const xPNTsToken = tokenActions()(aliceClient);
const hLink = await xPNTsToken.setSuperPaymasterAddress({
    token: tokenAddress,
    spAddress: config.contracts.superPaymaster,
    account: aliceAcc
});
```
- **位置**: 第 203-209 行
- **修复前**: ❌ 使用 `aliceClient.writeContract(...)`
- **修复后**: ✅ 使用 SDK API (`tokenActions().setSuperPaymasterAddress`)

#### 4. ⚙️ Operator Node Setup（Operator 节点设置）
**操作**: Alice 设置 SuperPaymaster Operator 节点
**SDK API 使用**:
```typescript
const aliceL3 = new OperatorLifecycle({ ... });
const hSetup = await aliceL3.setupNode({
    type: 'SUPER',
    stakeAmount: parseEther('50'),
    depositAmount: 0n
});
```
- **位置**: 第 142-223 行
- **状态**: ✅ 使用 SDK API (`OperatorLifecycle.setupNode`)

#### 5. 💰 Deposit Collateral（抵押品存款）
**操作**: Alice 存入 aPNTs 作为抵押
**SDK API 使用**:
```typescript
const hDeposit = await aliceL3.depositCollateral(parseEther('4000'));
```
- **位置**: 第 241-243 行
- **状态**: ✅ 使用 SDK API (`OperatorLifecycle.depositCollateral`)

#### 6. 🔧 Configure Operator（配置 Operator）
**操作**: 配置 Operator 参数（xPNTs Token, Treasury, ExchangeRate）
**SDK API 使用**:
```typescript
const hConfig = await aliceL3.configureOperator(
    tokenAddress,
    aliceAcc.address,
    parseEther('1')
);
```
- **位置**: 第 246-252 行
- **状态**: ✅ 使用 SDK API (`OperatorLifecycle.configureOperator`)

#### 7. 🔄 Update Oracle Price（价格更新）
**操作**: 通过 DVT 签名更新 ETH/USD 价格
**SDK API 使用**:
```typescript
const hPrice = await superPaymasterActions(superPM)(supplierClient).updatePriceDVT({
    price: newPrice,
    updatedAt: timestamp,
    proof: signature,
    chainlinkRecovered: 0, // 1 = Chainlink has recovered: also exits the emergency price mode
    account: supplierAcc
});
```
- **位置**: 第 276-283 行
- **状态**: ✅ 使用 SDK API (`superPaymasterActions().updatePriceDVT`)

#### 8. 🚀 Deploy AA Account（部署 AA 账户）
**操作**: 为 Bob 部署 SimpleAccount（AA）
**SDK API 使用**:
```typescript
const { accountFactoryActions } = await import('@aastar/core');
const factoryActions = accountFactoryActions(config.contracts.simpleAccountFactory);

// Get predicted address
const bobAA = await factoryActions(publicClient).getAddress({ 
    owner: bobAcc.address, 
    salt 
});

// Deploy
const hDeploy = await factoryActions(bobClient).createAccount({
    owner: bobAcc.address, 
    salt, 
    account: bobAcc
});
```
- **位置**: 第 301-327 行
- **状态**: ✅ 使用 SDK API (`accountFactoryActions().getAddress` + `createAccount`)

#### 9. 📝 User Onboarding（用户注册）
**操作**: Bob 注册加入 Alice 的社区
**SDK API 使用**:
```typescript
const bobL3 = new UserLifecycle({ ... });
// Check eligibility
const canJoin = await bobL3.checkEligibility(aliceAcc.address);
// Onboard
const res = await bobL3.onboard(aliceAcc.address, parseEther('0.4'));
```
- **位置**: 第 337-377 行
- **状态**: ✅ 使用 SDK API (`UserLifecycle.checkEligibility` + `onboard`)

#### 10. ⚡ Gasless Transaction（Gasless 交易）
**操作**: Bob 执行 Gasless 的 GToken 转账（由 Alice 的 Operator 赞助）
**SDK API 使用**:
```typescript
const { SuperPaymasterClient } = await import('../packages/paymaster/src/V4/SuperPaymasterClient.js');
const userOpHash = await SuperPaymasterClient.submitGaslessTransaction(
    publicClient,
    bobClient,
    bobAA,
    config.contracts.entryPoint,
    config.bundlerUrl!,
    {
        token: config.contracts.gToken,
        recipient: aliceAcc.address,
        amount: parseEther('1'),
        operator: aliceAcc.address,
        paymasterAddress: config.contracts.superPaymaster
    }
);
```
- **位置**: 第 383-401 行
- **状态**: ✅ 使用 SDK API (`SuperPaymasterClient.submitGaslessTransaction`)

#### 11. 🚪 User Exit（用户退出）
**操作**: Bob 退出社区
**SDK API 使用**:
```typescript
const hLeave = await bobL3.leaveCommunity(aliceAcc.address);
```
- **位置**: 第 421 行
- **状态**: ✅ 使用 SDK API (`UserLifecycle.leaveCommunity`)

#### 12. 🏁 Operator Exit（Operator 退出）
**操作**: Alice 退出 Operator 角色
**SDK API 使用**:
```typescript
const hExit = await aliceL3.exit();
```
- **位置**: 第 428 行
- **状态**: ✅ 使用 SDK API (`OperatorLifecycle.exit`)

### 辅助操作（读取）
以下操作为只读查询，使用 SDK 提供的 Actions 进行标准化访问：

| 操作 | SDK API | 位置 |
| :--- | :--- | :--- |
| 检查 Operator 就绪状态 | `OperatorLifecycle.checkReadiness()` | 156, 290 |
| 查询 Registry Role | `registryActions().hasRole()` | 232, 361 |
| 查询 GToken 余额 | `gTokenActions().balanceOf()` | 365 |
| 获取 AA 地址 | `accountFactoryActions().getAddress()` | 307 |
| 获取 AA 代码 | `publicClient.getBytecode()` | 320 |

### 🎯 总结
- ✅ **所有 12 个核心业务流程** 均使用 SDK 高层 API 实现
- ✅ **0 个直接 `writeContract` 调用**（已全部替换为 SDK API）
- ✅ **完全符合 SDK 使用最佳实践**

### 修复记录
- **修复项**: Token 链接操作（第 203-209 行）
- **修复前**: 直接使用 `aliceClient.writeContract({ ... })`
- **修复后**: 使用 `tokenActions().setSuperPaymasterAddress({ ... })`

### 建议
`l3-complete-demo.ts` 现在是一个完整的 SDK API 使用示范，可以作为：
1. 📚 **教学材料**：展示如何使用 AAstar SDK 完成全生命周期操作
2. 🧪 **集成测试**：验证 SDK 各模块的正确性和互操作性
3. 📖 **文档示例**：作为官方文档的参考实现

---

## 第二部分：Simple SuperPaymaster Demo 机制分析与对比

本部分将 `l3-complete-demo.ts` 与极简版本的 `simple-superpaymaster-demo.ts` (由 `./simple-test-superpaymaster.sh` 触发) 进行全面对比。

### 1. 运行机制
- **Simple Demo**: 依赖于 `l4-setup` 预先生成的 `scripts/l4-state.${network}.json` 状态文件。它从状态文件中直接读取已存在的 Operator 和 AA 账户地址，忽略了所有 Onboarding 步骤。
- **L3 Demo**: 全生命周期示范，自动生成账户、创建社区并配置节点，是一套完整的自完备流程。

### 2. 核心代码实现对比

#### Simple Demo (极简写法)
```typescript
// 直接调用高层封装的支付客户端
const userOpHash = await SuperPaymasterClient.submitGaslessTransaction(
    client,
    wallet,
    aaAccount,
    entryPoint,
    bundlerUrl,
    {
        token,
        recipient,
        amount: parseEther('1'),
        operator,
        paymasterAddress
    }
);
```

#### L3 Demo (全生命周期写法)
涉及 `CommunityClient`, `OperatorLifecycle`, `UserLifecycle` 等多个类协同工作：
```typescript
// 1. 创建社区
await aliceCommunity.setupCommunity({...});
// 2. 注册节点
await aliceL3.setupNode({...});
// 3. 用户上车
await bobL3.onboard(aliceAddress, stakeAmount);
// 4. 发起 Gasless 交易
await SuperPaymasterClient.submitGaslessTransaction({...});
```

### 3. 全面对比表

| 特性 | L3 Complete Demo (`l3-complete-demo.ts`) | Simple SuperPaymaster Demo (`simple-superpaymaster-demo.ts`) |
| :--- | :--- | :--- |
| **目标定位** | **全生命周期示范**。模拟生态构建全过程。 | **核心能力示范**。展示最纯粹的 Gasless 交易。 |
| **自完备性** | **高**。自动生成环境，无需预设状态。 | **低**。必须配合 `l4-setup` 运行。 |
| **复杂度** | **中高**。涉及 3 个主要的 Lifecycle/Client 类。 | **极低**。仅使用 `SuperPaymasterClient`。 |
| **执行时间** | **长** (~5-8 分钟)。包含 10+ 笔链上确认。 | **短** (~30-60 秒)。仅 1 笔 UserOperation。 |
| **Gas 调优** | 在 `UserClient` 内部通过参数驱动调优。 | 在 `SuperPaymasterClient` 内部自动调优。 |
| **适用场景** | 开发者集成参考、端到端回归测试。 | 快速验证环境联通性。 |

---

## 第三部分：底层机制深度解析

虽然表现形式不同，但两者共享相同的 **SBT 绑定安全模型** 与 **Gas 调优机制 (Efficiency Guard)**。

### 1. 🛡️ 身份验证 (SBT 绑定)
SuperPaymaster 在执行前会通过 `Registry` 检查 `aaAccount` 是否持有对应社区的合约权限。无论通过 `onboard()` 实时绑定还是预先绑定，底层逻辑一致。

### 2. ⛽ Gas 调优 (Efficiency Guard)
这是修复 `SUPER_PAYMASTER` 报错的核心。Bundler 要求 `actual_gas / gas_limit >= 0.4`。两个脚本均通过以下公式强制满足准入条件：
`tuneGasLimit(bundlerEstimate, 60_000n, 0.45)`

---

> [!TIP]
> 建议开发者在调试时先通过 `simple-test-superpaymaster.sh` 确保环境联通，再参考 `l3-complete-demo.ts` 进行完整的业务集成。
