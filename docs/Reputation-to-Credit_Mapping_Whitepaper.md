# Reputation-to-Credit 技术映射白皮书

## 1. 设计初衷与哲学 (Design Philosophy)

AAStar 协议的核心愿景是构建一个“赋能社区、简化开发”的账户抽象基础设施。在这个体系中，**Reputation (声誉)** 和 **Credit (信用/授信)** 是连接链上资产与社交共识的桥梁。

### 核心理念：
- **Reputation 是主观度量**：它代表了社区成员之间的共识。声誉不是单纯的数字，而是基于用户活动（Entropic Factor）和社交关系（Social Graph）的综合评分。
- **Credit 是经济表现**：信用是将主观声誉转化为客观支付能力的机制。通过信用系统，用户可以“预支”Gas 费用，实现真正的无感交互。
- **去中心化的安全底线**：通过 DVT (Distributed Validator Technology) 和 BLS 聚合签名，确保声誉的更新不依赖于任何单一中心化实体。

---

## 2. 技术架构与映射逻辑

### 2.1 声誉增长路径 (The Three Tiers)

系统设计了三种平行的声誉更新路径，以适应不同的信任级别：

| 级别 | 名称 | 触发逻辑 | 验证机制 | 适用场景 |
| :--- | :--- | :--- | :--- | :--- |
| **Tier 1** | **Manual Inject** | 管理员手动设定 | 合约 Owner 权限 | 测试、紧急干预、初始数据导入 |
| **Tier 2** | **Rule-based Sync** | 链上规则自动累加 | 预定义智能合约算法 | 质押奖励、固定活动积分 |
| **Tier 3** | **DVT Batch Sync** | 离线计算批量同步 | **BLS256 聚合签名证明** | 生产环境、综合行为建模、跨链声誉 |

### 2.2 映射模型：从分数到额度

声誉分数的转换遵循以下三级映射：

1.  **Reputation Score (25分)**: 用户在特定社区或全局的活动积分。
2.  **Credit Level (Level 2)**: 在 `Registry` 中注册的等级阈值。
    - *配置示例*：Level 1 (>10分), Level 2 (>20分), Level 3 (>50分)。
3.  **Credit Limit (100 aPNTs)**: 每个等级对应一个全局的基础信用额度。
4.  **Community Limits (xPNTs)**: 各社区可基于全局额度进行微调或设置黑名单。

---

## 3. 用户场景与活动路径

### 场景 A：终端用户 Gasless 体验 (End-user Flow)
1.  **活动产生**：用户在 App 内完成每日签到。
2.  **声誉增长**：`ReputationSystem` 根据 Tier 2 规则自动计算分数增长。
3.  **信用变现**：用户发起交易，`SuperPaymaster` 发现该用户 `Credit Level` 已达标。
4.  **代付执行**：`SuperPaymaster` 为用户垫付 Gas，并在 `xPNTsToken` 中记录债务（Debt）。
5.  **自动偿还**：当用户获得新的社区激励（Mint）时，债务先于余额自动扣除。

### 场景 B：社区管理员配置 (Admin Flow)
1.  **启动社区**：通过 `createCommunityClient` 启动并部署社区专属 `xPNTsToken`。
2.  **定义规则**：调用 `ReputationSystem.setRule` 设置“质押 100 GT 每日增 1 分”的规则。
3.  **设置阈值**：在 `Registry` 中定义不同信用等级对应的 Airdrop 权限。

### 场景 C：生产级去中心化同步 (DVT Consensus Flow)
1.  **离线分析**：DVT 节点群分析用户的跨链及链上行为。
2.  **共识签名**：多个 DVT 节点对更新后的声誉列表进行 BLS 签名。
3.  **批量注入**：调用 `Registry.batchUpdateGlobalReputation`。合约在毫秒内验证 BLS 证明。
4.  **权限锁死**：Owner 权限收缩，确保非 DVT 签名的声誉更新会被拒绝。

---

## 4. 关键初始化配置 (Default Setup)

为了确保系统的“开箱即用”且安全，我们预设了以下基准配置：

- **基础信用阈值 (Level Thresholds)**:
  - Level 1: 13 points (入门级，支持基础转账代付)。
  - Level 2: 50 points (高级用户，支持复杂合约交互)。
- **信用额度配额 (Credit Tiers)**:
  - Level 1 Limit: 等值 $10 USD 的 aPNTs。
  - Level 2 Limit: 等值 $50 USD 的 aPNTs。
- **安全拦截器 (Safety Interceptor)**:
  - `SuperPaymaster` 采用**被动黑名单机制**。即使额度足够，若 DVT 标记 `isBlocked=true`，交易仍会被拒绝。

---

## 5. 结论

Reputation-to-Credit 映射不仅是一套算法，它是 AAStar 网络治理的核心。它通过将“社交声誉”转化为“链上信用”，解决了 Web3 用户进入门槛高的痛点，同时利用 DVT 技术确保了这套信用体系的公正与去中心化。
