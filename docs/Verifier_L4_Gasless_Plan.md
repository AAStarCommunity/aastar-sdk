# L4 无 Gas 交易验证测试计划 (L4 Gasless Transaction Verification Plan)

本文档详细描述了在 Sepolia 网络上验证无 Gas 交易（Gasless Transactions）的详细步骤和要求。

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

验证相互之间的依赖是否初始化完成，包括：
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
        4. try again, should record a debt in cPNTs contract
        5. deposit cPNTs to test AA, it should pay debt first, then deposite


