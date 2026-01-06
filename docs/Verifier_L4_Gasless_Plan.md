# L4 无 Gas 交易验证测试计划 (L4 Gasless Transaction Verification Plan)

本文档详细描述了在 Sepolia和其他网络参数的验证无 Gas 交易（Gasless Transactions）的详细步骤和要求。
一些信息和要求：
1. L4是run_sdk_regression.sh 整体回归脚本的一部分，完成gasless的账户数据check和准备和交易测试。
2. 所有私钥、RPC等私密信息，来自于根目录的.env.sepolia（或者对应的网络,例如.env.op-sepolia, .env.mainnet, .env.anvil）
3. 使用SDK 提供的合约ABI（来源是根目录的abis）
4. 所有合约地址来自于根目录的config.sepolia.json（或者对应的config.network.json)，包括唯一hash。
5. 所有L4的数据准备、检查、初始化和交易测试，要求是幂等的，即可以重复执行，不会对系统和要进行的测试计划造成影响。
6. L4 测试的目标，是使用L1,L2,L3积累和验证过的API（就是根目录的 run_sdk_regression.sh），来完成可重复的gasless交易全过程。
7. 兼容不同网络参数：sepolia, mainnet, op-sepolia, anvil等等，但是对于anvil，L4模拟entrypoint和useroperation有一定限制，我建议L4跳过anvil的测试，你来评估是否合理。
8. 检查、生成和初始化，然后记录log或者config并输出测试准备结果
9. 如果API没有需要的能力，则添加API,全部使用API能力完成数据准备校验初始化和gasless交易全过程。
10. 如果API报错，则修复，全部使用API能力
11. 可以参考SDK的ABI和合约代码来调试
12. 语义化函数名，避免类似getBalance, deposit, withdraw, mint, burn等太通用的函数名，使用反映业务场景的名字，例depositAPNTsToSuperPaymaster，当然不一定这个名字，但要语义化，场景匹配。
## 1. 测试账户准备 (Test Accounts)

需要在 `.env.sepolia` 中配置以下账户私钥：

1.  **供应商账户 (Supplier)**
    *   **Env Var**: `PRIVATE_KEY_SUPPLIER`
    *   **用途**: 提供测试 ETH (ETH Supplier)，同时也是 GToken 合约的所有者 (Owner)。

2.  **社区运营者 (Operators - EOAs)**
    *   需在 `.env.sepolia` 中添加以下私钥 (如果不存在则生成):
    *   `PRIVATE_KEY_JASON` (Admin for AAStar Community) -> 负责部署 aPNTs
    *   `PRIVATE_KEY_BOB` (Admin for Bread Community) -> 负责部署 bPNTs
    *   `PRIVATE_KEY_ANNI` (Admin for Demo Community) -> 负责部署 cPNTs & SuperPaymaster 操作

3.  **测试 AA 账户 (AA Users)**
    *   **生成方式**: 使用 Jason, Bob, Anni 的私钥作为 Signer 生成 EntryPoint v0.7 兼容的 Smart Accounts。
    *   **数量**: 6 个 (每个 Operator 对应 2 个，或者混合使用)。

## 2. 环境初始化要求 (Initialization Requirements)

这些步骤作为“一次性准备工作”运行（One-time Setup），将通过 `scripts/l4-setup.ts` 完成。

### 2.1 资金分发 (Funding)
1.  **GToken 分发**: 使用 Supplier Key (Owner) 铸造 (Mint) GToken:
    *   给 **Jason**: 100,000 GToken (Stake for PaymasterV4)
    *   给 **Bob**: 100,000 GToken (Stake for PaymasterV4)
    *   给 **Anni**: **200,000 GToken** (100k for Community Stake + Extra for SuperPaymaster Stake/Deposit)
2.  **ETH 分发**: 使用 Supplier Key 发送测试 ETH 给 3 个 Operator (确保足够 Gas 用于部署合约)。

### 2.2 社区与代币启动 (Community & Token Launch)
1.  **AAStar Community (Jason)**
    *   注册社区。
    *   部署社区代币 **aPNTs**。
    *   部署 **PaymasterV4** (常规 Paymaster)。
    *   **Action**: Mint 100,000 aPNTs 给 Anni (用于 Anni 的 SuperPaymaster 存款)。
2.  **Bread Community (Bob)**
    *   注册社区。
    *   部署社区代币 **bPNTs**。
    *   部署 **PaymasterV4** (常规 Paymaster，接受 bPNTs)。
3.  **Demo Community (Anni)**
    *   注册社区。
    *   部署社区代币 **cPNTs**。

### 2.3 Paymaster 启动
1.  **Launch PaymasterV4s**: 确保 Jason 和 Bob 的 PaymasterV4 已部署并存入 ETH (Gas) 和 GToken (Stake)。
2.  **Launch SuperPaymasterV3**: 确保系统中有两个 SuperPaymasterV3 实例（只需在 Registry 注册）。
3.  **Anni's SuperPaymaster Setup**:
    *   Anni 使用额外 GToken 和 ETH 注册/启动一个 SuperPaymaster。
    *   Anni 将 **aPNTs** (来自 Jason) 存入 SuperPaymaster 作为 Credit (Deposit)。这是 SuperPaymaster 在全局账本中的抵押品。

## 3. L4 无 Gas 交易测试场景 (Test Scenarios)

### 3.1 预备步骤 (Preparation for AA)
1.  **GToken Mint**: 给所有 测试 AA 账户 Mint 1,000 GToken (Source: Supplier)。
2.  **xPNTs Mint**: 使用对应的 Operator 给相关 AA 账户 Mint 10,000 个 aPNTs, bPNTs, cPNTs。
3.  **SBT & Deposit**:
    *   确保所有 AA 账户拥有 MySBT (通过注册任意社区获取)。
    *   确保所有 AA 账户已存入 10,000 xPNTs 到对应的代币合约/社区 (Deposit)。

### 3.2 社区注册测试 (Community Registration via AA)
使用生成的 AA 账户测试注册流程：
1.  **Case 1 (With ETH)**: 账户有测试 ETH -> 注册成功。
2.  **Case 2 (Gasless)**: 账户无测试 ETH -> 注册成功 (使用 Paymaster)。
3.  **Case 3 (First Time)**: 首次注册。
4.  **Case 4 (Re-register)**: 二次注册 (Re-register)。
5.  **Case 5 (Idempotency)**: 三次注册 (检查幂等性)。

### 3.3 PaymasterV4 交易 (常规代币 Gas)
1.  **AAStar Paymaster (aPNTs)**:
    *   AA 账户 (Signer: Jason/Anni) 使用 **aPNTs** 支付 Gas。
    *   通过 AAStar 的 PaymasterV4 发起交易。
    *   验证：成功，扣除 AA 的 aPNTs。
2.  **Bread Paymaster (bPNTs)**:
    *   AA 账户使用 **bPNTs** 支付 Gas。
    *   通过 Bread Community 的 PaymasterV4 发起交易。
    *   验证：成功，扣除 AA 的 bPNTs。

### 3.4 SuperPaymasterV3 交易 (Demo Community - Credit System)
目标：测试信用 (Credit)、债务 (Debt) 和 偿还 (Repayment) 逻辑。
配置：Demo Community Operator (Anni) 部署的 SuperPaymaster。

1.  **Tx 1: cPNTs Payment (Normal)**:
    *   AA 账户使用 **cPNTs** 支付。
    *   发起 Gasless 交易。
    *   验证：
        *   AA 的 cPNTs 余额减少。
        *   SuperPaymaster 内 Demo Community 的 **aPNTs** 余额减少 (底层支付)。

2.  **Tx 2: Insufficient cPNTs (Credit & Debt Test)**:
    *   **场景**: AA 账户没有足够的 cPNTs。
    *   **前提**: 账户拥有足够的 Reputation。
    *   **执行**: 连续发起 3 次交易。
    *   **预期**:
        *   系统给予 3 次免费交易额度 (Credit)。
        *   交易全部成功。
        *   **关键验证**: 每次交易都在 cPNTs 合约中记录了 AA 的 **债务 (Debt)**，因为使用了 Credit。

3.  **Tx 3: Run out of Credit (Blacklist/Limit)**:
    *   **场景**: 用完 3 次免费额度，继续尝试第 4 次交易。
    *   **预期**: 交易失败 (run out of credit)，或者被列入黑名单。

4.  **Tx 4: Repayment**:
    *   **场景**: AA 账户充值 cPNTs。
    *   **预期**: 系统自动优先偿还债务 (Pay Debt First)。检查余额是否正确反映了 (充值金额 - 债务)。

## 4. 后续步骤
*   编写 `scripts/l4-setup.ts` 自动化上述初始化。
*   编写 `tests/regression/l4-gasless.ts` 执行上述测试用例。
*   

补充：
xPNTsFactory合约初始化会设置SuperPaymaster内置为超级账户，可以直接从任意xPNTsFactory部署的xPNTs合约转账gas需要的xPNTs到自己的账户，不用approve。不过也提供了安全校验，只能用来转gas费用。


## 规则补充
以下规则在aastar-sdk 项目生效
第一，禁止创建便利性的脚本或者临时性的脚本用来什么检查余额、部署token、资助账户，这些都禁止，如果需要便利性脚本，参考第二条
第二，所有过程必须使用使用我们的API，我们API有L1L2L3级别的API，都封装了基础能力，你为什么不用API，需要便利性脚本了，在test，utils模块下新增工具api，转化为可重复使用的api，为全回归测试做准备
。第三个，禁止产生任何编译的过程文件，产生后马上清理这些过程文件，你如果需要运行ts，使用npx tsx来运行，禁止编译。
第四，所有的环境变量配置，在根目录的.env.sepolia（不同网络，不同配置名称，例如.env.anvil, .env.op-sepolia, .env.mainnet，目前我们重点是在sepolia跑通全回归测试）。
第五，全回归测试必须包含三个阶段，必须一步步完成，禁止未完成第一阶段，进入第二阶段，以此类推。
其中，第一阶段，定义为合约环境检查，第二阶段，定义为初始化账户（EOA和AA）、社区、token、paymaster和superpaymaster，第三阶段，准备forge script dry run测试useroperation是否合格，然后测试和fix，完成gasless测试。
以上所有阶段的实现，都在L4 test脚本实现，通过组织和调用L1,L2,L3的sdk api，实现关键动作，禁止借助外部临时api完成，任何步骤没有api实现了，check后可以新增api，原则参考第二条规则， 最后无法完成的，抛出报错。
------
以上规则的详细版本，在docs/Verifier_L4_Gasless_Plan.md,此规则为实现gasless回归测试为目标。


## 合约验证
**目标**
验证所有合约地址是否是最新版本，合约名称，版本号，部署日期，合约地址，都要输出和明确展示，验证是否完成了相互之间的依赖初始化。
以上需要统计合约数量（指的是由本项目开发的合约和依赖合约），目前有如下合约：
 1. Registry                       60 functions，全局注册表合约
 2. SuperPaymaster                 58 functions，唯一实例的多租户Paymaster，由AAStar社区维护
 3. MySBT                          49 functions，全局唯一SBT合约，白板MySBT协议，只有你可以自由涂抹
 4. PaymasterV4_2                  48 functions ，模板合约，reg在PaymasterFactory合约一个具体实现
 5. xPNTsToken                     37 functions 模板合约,immutable方式固化在了xPNTsFactory合约
 6. GToken                         18 functions，基础GToken合约，未来要改进为销售合约
 7. GTokenStaking                  28 functions，GToken的质押管理合约
 8. xPNTsFactory                   28 functions xPNTs合约注册到工厂，然后通过工厂部署具体实现proxy
 9. PaymasterFactory               24 functions paymaster某版本实现reg到工厂，use工厂部署实现proxy
 10. ReputationSystem               20 functions，信用系统
 11. BLSAggregator                  18 functions，BLS聚合器
 12. DVTValidator                   15 functions，DVT验证器
 13. BLSValidator                   2 functions，BLS验证器合约
-----------------------------------------------------------------   
14. SimpleAccount                  17 functions，默认0.7版，外部依赖，符合entrypoint 0.7的合约账户
15. SimpleAccountV08               17 functions，外部依赖，符合entrypoint 0.8的合约账户
16. EntryPoint                     22 functions，外部依赖，官方entrypoint
17. Simple7702Account              10 functions，外部依赖，符合entrypoint 0.7的合约账户
18. SimpleAccountFactory           4 functions，外部依赖，符合entrypoint 0.7的合约账户工厂
19. SimpleAccountFactoryV08        4 functions，外部依赖，符合entrypoint 0.8的合约账户工厂
20. SenderCreator                  3 functions，外部依赖，部署AA账户的工具合约
21. UserOperationLib               3 functions，外部依赖，用户操作的工具合约
 
   

基于工厂部署的实例：
 1. aPNTs，基于xpntsFactory部署的标准实现，提供xpnts接口的具体实例，归属于AAStar社区
 2. bPNTs，基于xpntsFactory部署的标准实现，提供xpnts接口的具体实例，归属于Bread社区，以此类推
 3. PaymasterV4_2-Bread，归属于Bread社区，基于paymasterFactory部署的标准实现，提供paymaster接口的具体实例，以此类推
 4. SuperPaymaster，归属于AAStar社区，全局唯一实例，提供superpaymaster服务的多租户合约（这个是特殊实例，只有一个）

### 角色和信用等级
 预置角色配置表 (Registry v3.1.1)
以下是合约构造函数中初始化的核心参数（金额单位均为 GToken/ETH 对应的 18 位小数）：

角色 (Role ID)	最小质押 (minStake)	进入销毁 (entryBurn)	退出费率 (exitFeeBP)	最小退出费	说明
ROLE_COMMUNITY	30 ETH	3 ETH	500 (5%)	1 ETH	社区运营者基础角色
ROLE_ENDUSER	0.3 ETH	0.05 ETH	1000 (10%)	0.05 ETH	终端用户角色
ROLE_PAYMASTER_SUPER	50 ETH	5 ETH	1000 (10%)	2 ETH	超级支付主角色
ROLE_PAYMASTER_AOA	30 ETH	3 ETH	1000 (10%)	1 ETH	常规 AOA 支付主
ROLE_DVT / ROLE_KMS	30~100 ETH	3~10 ETH	1000 (10%)	1~5 ETH	基础设施节点角色
[!NOTE] bra fee (entryBurn): 注册时立即扣除并销毁的部分。 stakeExit fee (exitFeeBP): 退出角色时从质押余额中扣除的比例（BP 为万分之一）。

C. 信用分等级与额度 (Credit Tiers)
系统根据 Reputation 分数自动划分等级，对应不同的 SuperPaymaster 信用额度：

等级 (Level)	信誉分阈值 (Reputation)	信用额度 (Credit Limit)
Level 1	< 13	0
Level 2	13 - 33	100 aPNTs
Level 3	34 - 88	300 aPNTs
Level 4	89 - 232	600 aPNTs
Level 5	233 - 609	1000 aPNTs
Level 6	610+	2000 aPNTs
这就解释了为什么在 L4 测试中，我们需要先提升 AA 账户的 Reputation，才能触发 SuperPaymaster 的信用支付逻辑。

### 验证
相互之间的依赖是否初始化完成，包括：
1. GToken是否是immutable变量在GTokenStaking合约中
(Wiring Matrix)
* 		MySBT -> Registry
* 		 GTokenStaking -> Registry
* 		 xPNTsFactory -> SuperPaymaster
* 		Registry -> ReputationSystem (as Source)
* 		Registry -> BLSAggregator
* 		Registry -> BLSValidator
* 		SuperPaymaster -> xPNTsFactory
* 		SuperPaymaster -> BLSAggregator
* 依赖的设置分为immutable变量设置和依赖合约地址设置，immutable变量设置在合约初始化时设置，依赖合约地址设置在合约初始化时设置（部署者/管理员调用setter函数）

两个方式完成合约验证：到superpaymaster项目目录，运行 forge script scripts/VerifyV3_1_1.s.sol 来验证
或者到aastar-sdk项目目录，添加checkContract函数（借鉴VerifyV3_1_1.s.sol逻辑，我们重新编写，这个还没做，需要新增checkContract函数），来验证
-------
TX requirements 

L4 test for gasless tx, but you must check the test accounts (EOA account as operators to launch new community and deploy community xPNTs like aPNTs and bPNTs; and as a test receiver, and test AA account with entrpoint 0.7 adaptable) and and requirements(MySBT, bPNTs) and community registered() and

Test Accounts:

1. PRIVATE_KEY_SUPPLIER in .env.sepolia as a Test ETH supplier
2. 3 EOA as community launcher(operator) : Jason, Bob, Anni, private key in .env.sepolia
3. 6 AA(entrypoint 0.7) accounts for gasless test, produced by API

Requirements
1. Mint GToken(100000, using supplier key, it is also the GToken contract owner) to 3 EOA accounts 
2. Transfer test ETH(using supplier key) to 3 EOA accounts for deployment.
3.  launch three communities  and token for test
    1.  AAStar Community and aPNTs (Jason)
    2.  breadCommunity with bPNTs (Bob)
    3. DemoCommunity with cPNTs (Anni)
4. Launch two PaymasterV4, new deployment with GToken and test ETH in EOA
5. Launch two SuperPaymasterV3, just register in registry with with GToken and test ETH 
6. Use Anni to register (launch) a SuperPaymaster with extra GToken and test ETH and 100000 aPNTs in EOA
    1. deposit aPNTs to Super
7. All above is one time job for our later test, we can make a individual test shell to prepare.
8. if done this, record all data, contracts, community data, accounts for next step.

Test 4 kinds of gasless tx:

1. Mint GToken to all test AA accounts(1000 is enough) ,use supplier key
2. Mint a,b,cPNTs to all test AA account(10000 is enough), use the community operator key(Jason, Bob, Anni)
3. use AA accounts to register different community(above all ) 
    1. with test ETH
    2. without test ETH
    3. first time register a community
    4. second time
    5. third time
4. All test AA accounts get MySBT (registered in any community) and deposited xPNTs(a,b, cPNTs) 10000.  
5. Launch a tx in a PaymasterV4 by breadCommunity(they accept bPNTs as gas token).
    1. AA account with apnts, launch gasless tx with aastar’s paymaster V4(deployed by aastar operator)
    2. AA account with bpnts , launch gasless tx with breadCommunity paymaster V4(deployed by breadCommunity operator)
6. Launch a tx in a SuperPaymasterV3
    1. AA account with cpnts , launch gasless tx with DemoCommunity SuperPaymaster V3(deployed by DemoCommunity operator Anni)
    2. it should deduced aPNTs from DemoCommunity balance in SuperPaymaster
    3. it should
        1. deduce cPNTs from test AA account
        2. if AA account has no cPNTs balance
        3. improve the reputation of test account enough to get credit for 3 free tx
            1. try more tx, it should be put into blacklist (we put it manually for now) and can’t get gasless free tx anymore, it run out the credit.
        5. try again, should record a debt in cPNTs contract
        6. deposit cPNTs to test AA, it should pay debt first, then deposite


---

## 5. L4 实现计划 (Implementation Plan)

### 5.1 脚本结构

```bash
# 1. 环境准备(幂等)
pnpm tsx scripts/l4-setup.ts --network=sepolia

# 2. Gasless测试
pnpm tsx tests/regression/l4-gasless.ts --network=sepolia

# 3. 查看状态
cat scripts/l4-state.json
```

### 5.2 l4-setup.ts 数据准备目标

| 阶段 | 对象 | 目标值 | 说明 |
|------|------|--------|------|
| **Funding** | Jason ETH | ≥0.1 ETH | 部署合约Gas |
| | Bob ETH | ≥0.1 ETH | 部署合约Gas |
| | Anni ETH | ≥0.1 ETH | 部署合约Gas |
| | Jason GToken | 100,000 | PaymasterV4 Stake |
| | Bob GToken | 100,000 | PaymasterV4 Stake |
| | Anni GToken | **200,000** | 100k社区质押+100k SuperPM质押 |
| **社区** | Jason | AAStar社区+aPNTs+PaymasterV4 | |
| | Bob | Bread社区+bPNTs+PaymasterV4 | |
| | Anni | Demo社区+cPNTs+SuperPM Operator | |
| **SuperPM** | Anni aPNTs余额 | **100,000** | Jason mint aPNTs给Anni |
| | Anni SuperPM内余额 | ≥50,000 aPNTs | Anni存入SuperPM的credit |
| **AA账户** | 6个AA | 每个≥0.02 ETH, 1000 GToken | |
| | AA xPNTs | 各10,000 a/b/cPNTs | 用于Gasless测试 |

### 5.3 关键修复事项

1. **SuperPaymaster.deposit问题**:
   - 合约`deposit(uint256 amount)`使用的是`APNTS_TOKEN`(全局aPNTs=`0xBdF389a6e402AF1C0d4A0A45396303dC0b1Cf8d2`)
   - 不是Jason的社区aPNTs代币
   - SDK需添加`depositAPNTsToSuperPaymaster`语义化函数

2. **Token数量调整**:
   - GToken: Jason/Bob 100,000, Anni 200,000
   - aPNTs from Jason to Anni: 100,000
   - SuperPM存入: 50,000 (保留50,000备用)

3. **Anvil跳过评估**:
   - Anvil本地没有真实Bundler,无法测试完整UserOp流程
   - **建议L4跳过Anvil**,仅在Sepolia/OP-Sepolia执行

### 5.3 构造UserOp
- 交易内容：从 Jason 的第一个 AA 账户 (Jason_AA1) 向 Bob 的 EOA 地址转移 2 个 bPNTs 代币。
- 签名来源：使用 Jason 的私钥（即 AA 的 Owner）对 UserOp Hash 进行了标准的 signMessage 签名。
- Nonce 处理：通过 SDK 实时获取了最新的 Nonce 值 (当前为 1)。
“UserOperation 构造指南”，内容包括：

Context: 明确演示背景为从 Jason (AA1) 向 Bob (EOA) 转移 2 个 bPNTs。
5 种测试场景总结:
NATIVE: 标准 4337，AA 支付 ETH Gas。
GASLESS_V4: PaymasterV4 免 Gas（社区赞助）。
SUPER_BPNT: SuperPaymaster 内部结算 bPNT。
SUPER_CPNT: SuperPaymaster 内部结算 cPNT。
SUPER_CUSTOM: SuperPaymaster 自定义结算。
API 使用范例: 展示了如何通过 UserOpScenarioBuilder 简单调用即可获得符合 Bundler JSON-RPC 规范（Hex 编码）的 UserOp。
2. 验证结果
脚本运行结果显示，所有场景的 UserOp Hash 均已成功计算，且签名已由 Jason 的 Owner 私钥完成。输出的 JSON 格式已完全兼容 Alchemy Bundler 等后端的集成

### 5.4 l4-gasless.ts 测试场景

| # | 场景 | Paymaster | 预期 |
|---|------|-----------|------|
| 1 | AA有ETH,直接交易 | 无 | 成功,扣ETH |
| 2 | AA使用aPNTs | PaymasterV4(AAStar) | 成功,扣aPNTs |
| 3 | AA使用bPNTs | PaymasterV4(Bread) | 成功,扣bPNTs |
| 4 | AA使用cPNTs | SuperPM(Demo) | 成功,扣cPNTs,Anni aPNTs余额减少 |
| 5 | AA无cPNTs有信用 | SuperPM(Demo) | 成功,记录债务 |
| 6 | 信用耗尽 | SuperPM(Demo) | 失败,黑名单 |
| 7 | 充值cPNTs | - | 优先还债 |

### 5.5 状态输出 (l4-state.json)

```json
{
  "network": "sepolia",
  "timestamp": "2026-01-06T20:30:00Z",
  "operators": {
    "jason": { "address": "0x...", "community": true, "token": "0x...", "paymasterV4": "0x..." },
    "bob": { "address": "0x...", "community": true, "token": "0x...", "paymasterV4": "0x..." },
    "anni": { "address": "0x...", "community": true, "token": "0x...", "superPM": { "balance": "50000" } }
  },
  "aaAccounts": [
    { "label": "Jason_AA1", "address": "0x...", "eth": "0.02", "gToken": "1000", "registered": true }
  ],
  "readyForGaslessTest": true
}
```
