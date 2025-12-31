# GToken DAO 治理挖矿分配机制

## 概述

基于动态 CAP 管理的 GToken 挖矿分配系统,通过 DAO 委员会治理,实现对基础设施节点贡献的公平奖励。

---

## 一、核心机制

### 1.1 动态供应管理

```solidity
// GToken.sol 已实现
uint256 public constant MAX_SUPPLY = 21_000_000 ether;

function remainingMintableSupply() external view returns (uint256) {
    return cap() - totalSupply();
}
```

**关键特性**:
- ✅ 硬顶 2100万 GToken
- ✅ burn() 自动创造铸造空间
- ✅ 无需额外存储变量
- ✅ totalSupply() 是唯一真理源

### 1.2 授权铸造逻辑

```solidity
// 只要 remainingMintableSupply > 0, 即可 mint
function mint(address to, uint256 amount) external onlyOwner {
    _mint(to, amount);  // ERC20Capped 自动检查 cap
}
```

**无需新增接口**:
- ERC20Capped 已内置 cap 检查
- 只需查询 `remainingMintableSupply()`

---

## 二、基础设施节点贡献分类

### 2.1 计算类别

| 类别 | 描述 | 权重基数 | 示例 |
|------|------|----------|------|
| **Validator** | 出块验证节点 | 10 | 验证交易、生成区块 |
| **Indexer** | 数据索引节点 | 7 | 提供 GraphQL API、历史数据查询 |
| **RPC Provider** | RPC 服务节点 | 8 | eth_call, eth_sendTransaction |
| **Bundler** | UserOp 打包节点 | 9 | AA 交易打包、Gas 优化 |
| **Paymaster** | Gas 赞助节点 | 6 | SuperPaymaster Operator |
| **Storage** | 存储节点 | 5 | IPFS, Arweave 网关 |
| **Relay** | 中继节点 | 4 | MEV 保护、隐私交易 |

### 2.2 贡献量化指标

#### Validator 节点
```
贡献分 = 出块数量 × 10 
       + 验证成功率 × 5
       + 在线时长(小时) × 0.01
```

#### RPC Provider 节点
```
贡献分 = 请求响应数量 / 1000 × 8
       + 平均响应时间(ms) × (-0.01)  // 越快分数越高
       + 正常运行时间(%) × 2
```

#### Bundler 节点
```
贡献分 = UserOp 打包数量 / 100 × 9
       + Gas 节省率(%) × 5
       + 提交成功率 × 3
```

#### Paymaster 节点
```
贡献分 = 赞助交易数量 / 50 × 6
       + 赞助金额(ETH) × 10
       + xPNTs 销毁量 × 0.5
```

### 2.3 贡献数据采集

**链上数据**:
- 区块链事件日志(Block Produced, UserOp Executed)
- 合约调用记录(Paymaster Deposits, Slash Events)

**链下数据**(经 Oracle 验证):
- RPC 请求日志 → Chainlink Oracle
- 节点在线时长 → 多签验证者签名
- 响应时间统计 → TEE 可信计算

---

## 三、DAO 委员会份额分配策略

### 3.1 分配周期

**建议**: 每季度(Epoch)进行一次分配

```solidity
uint256 public constant EPOCH_DURATION = 90 days;
uint256 public lastMintEpoch;

modifier onlyNewEpoch() {
    require(block.timestamp >= lastMintEpoch + EPOCH_DURATION, "Epoch not ready");
    _;
}
```

### 3.2 份额分配比例

**DAO 委员会投票决定**: 当前 Epoch 使用 `remainingMintableSupply` 的百分比

```solidity
struct EpochAllocation {
    uint256 epochId;
    uint256 totalAvailable;      // remainingMintableSupply 快照
    uint256 allocationPercent;   // DAO 投票决定 (basis points, 2000 = 20%)
    uint256 actualMinted;
    mapping(address => uint256) nodeRewards;
}
```

**示例场景**:
- Epoch 1: `remainingMintableSupply` = 5,000,000
- DAO 投票: 使用 20% (1,000,000 GToken)
- 剩余: 4,000,000 继续留存

### 3.3 委员会决策流程

```
1. Oracle 提交链下数据 → Merkle Root
2. DAO 委员会审核 → 投票
3. 投票通过 → 执行链上分配
4. 节点领取 → Merkle Proof 验证
```

---

## 四、智能合约架构

### 4.1 核心合约: MiningDistributor

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "./GToken.sol";

/**
 * @title MiningDistributor
 * @notice DAO-governed mining reward distribution for infrastructure nodes
 * @dev Uses Merkle Tree for efficient reward claiming
 */
contract MiningDistributor is AccessControl {
    
    bytes32 public constant DAO_ROLE = keccak256("DAO_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    
    GToken public immutable gToken;
    
    uint256 public currentEpoch;
    uint256 public constant EPOCH_DURATION = 90 days;
    uint256 public epochStartTime;
    
    struct Epoch {
        bytes32 merkleRoot;           // 节点奖励 Merkle 树根
        uint256 totalAllocated;       // 本 Epoch 总分配量
        uint256 allocationPercent;    // 使用百分比 (basis points)
        uint256 mintedAmount;         // 已铸造总量
        mapping(address => bool) claimed;  // 领取记录
    }
    
    mapping(uint256 => Epoch) public epochs;
    
    event EpochProposed(uint256 indexed epochId, bytes32 merkleRoot, uint256 allocation);
    event EpochApproved(uint256 indexed epochId, uint256 totalMinted);
    event RewardClaimed(uint256 indexed epochId, address indexed node, uint256 amount);
    
    constructor(address _gToken, address _daoAdmin) {
        gToken = GToken(_gToken);
        _grantRole(DEFAULT_ADMIN_ROLE, _daoAdmin);
        _grantRole(DAO_ROLE, _daoAdmin);
        epochStartTime = block.timestamp;
    }
    
    /**
     * @notice DAO 提案新 Epoch 的分配方案
     * @param merkleRoot 节点奖励 Merkle 树根
     * @param allocationPercent 使用 remainingMintableSupply 的百分比 (basis points)
     */
    function proposeEpoch(
        bytes32 merkleRoot,
        uint256 allocationPercent
    ) external onlyRole(DAO_ROLE) {
        require(block.timestamp >= epochStartTime + EPOCH_DURATION, "Epoch not ready");
        require(allocationPercent <= 5000, "Max 50% per epoch");  // 安全上限
        
        uint256 newEpochId = currentEpoch + 1;
        uint256 available = gToken.remainingMintableSupply();
        uint256 allocation = available * allocationPercent / 10000;
        
        epochs[newEpochId].merkleRoot = merkleRoot;
        epochs[newEpochId].allocationPercent = allocationPercent;
        epochs[newEpochId].totalAllocated = allocation;
        
        emit EpochProposed(newEpochId, merkleRoot, allocation);
    }
    
    /**
     * @notice DAO 批准并执行分配(进入新 Epoch)
     */
    function approveEpoch() external onlyRole(DAO_ROLE) {
        uint256 newEpochId = currentEpoch + 1;
        require(epochs[newEpochId].merkleRoot != bytes32(0), "No proposal");
        
        currentEpoch = newEpochId;
        epochStartTime = block.timestamp;
        
        emit EpochApproved(newEpochId, epochs[newEpochId].totalAllocated);
    }
    
    /**
     * @notice 节点领取奖励
     * @param epochId Epoch ID
     * @param amount 奖励数量
     * @param proof Merkle 证明
     */
    function claimReward(
        uint256 epochId,
        uint256 amount,
        bytes32[] calldata proof
    ) external {
        require(epochId <= currentEpoch, "Future epoch");
        require(!epochs[epochId].claimed[msg.sender], "Already claimed");
        
        // 验证 Merkle Proof
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, amount));
        require(
            MerkleProof.verify(proof, epochs[epochId].merkleRoot, leaf),
            "Invalid proof"
        );
        
        epochs[epochId].claimed[msg.sender] = true;
        epochs[epochId].mintedAmount += amount;
        
        // 铸造奖励(GToken owner 需授权此合约)
        gToken.mint(msg.sender, amount);
        
        emit RewardClaimed(epochId, msg.sender, amount);
    }
    
    /**
     * @notice 查询节点在指定 Epoch 的奖励领取状态
     */
    function hasClaimed(uint256 epochId, address node) external view returns (bool) {
        return epochs[epochId].claimed[node];
    }
    
    /**
     * @notice 获取当前可分配总量
     */
    function getAvailableForMinting() external view returns (uint256) {
        return gToken.remainingMintableSupply();
    }
}
```

---

## 五、DAO 治理流程

### 5.1 提案阶段

**输入**:
1. Oracle 提交链下数据汇总(Merkle Root)
2. 包含所有符合条件节点的贡献分及奖励金额

**DAO 审核**:
- 验证 Oracle 数据真实性
- 检查分配比例合理性
- 投票决定 `allocationPercent`

### 5.2 投票标准

```solidity
// 简单多签 DAO (可升级为 Governor)
contract SimpleDAO {
    uint256 public constant QUORUM = 3;  // 最少投票数
    uint256 public constant THRESHOLD = 2; // 通过阈值
    
    mapping(bytes32 => uint256) public proposalVotes;
    mapping(bytes32 => mapping(address => bool)) public hasVoted;
    
    function vote(bytes32 proposalId) external onlyMember {
        require(!hasVoted[proposalId][msg.sender], "Already voted");
        hasVoted[proposalId][msg.sender] = true;
        proposalVotes[proposalId]++;
        
        if (proposalVotes[proposalId] >= THRESHOLD) {
            // 执行提案
            distributor.approveEpoch();
        }
    }
}
```

### 5.3 执行与领取

1. **批准执行**: DAO 调用 `approveEpoch()`
2. **节点领取**: 节点自行调用 `claimReward()` + Merkle Proof
3. **Gas 优化**: 只需链上存储 Merkle Root,节点数据存储在 IPFS

---

## 六、Merkle Tree 生成(链下)

### 6.1 数据结构

```typescript
interface NodeReward {
    address: string;
    contributionScore: number;
    rewardAmount: bigint;
    category: string;
}

const nodeRewards: NodeReward[] = [
    {
        address: "0xValidator1...",
        contributionScore: 1250,
        rewardAmount: parseEther("50000"),
        category: "Validator"
    },
    {
        address: "0xRPC_Provider...",
        contributionScore: 890,
        rewardAmount: parseEther("35000"),
        category: "RPC Provider"
    },
    // ...
];
```

### 6.2 Merkle Tree 构建

```typescript
import { MerkleTree } from 'merkletreejs';
import { keccak256, solidityPacked } from 'ethers';

function generateMerkleTree(rewards: NodeReward[]): { root: string, tree: MerkleTree } {
    const leaves = rewards.map(r => 
        keccak256(solidityPacked(['address', 'uint256'], [r.address, r.rewardAmount]))
    );
    
    const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
    const root = tree.getHexRoot();
    
    return { root, tree };
}

function getProof(tree: MerkleTree, address: string, amount: bigint): string[] {
    const leaf = keccak256(solidityPacked(['address', 'uint256'], [address, amount]));
    return tree.getHexProof(leaf);
}
```

### 6.3 IPFS 发布

```typescript
// 将完整奖励数据发布到 IPFS
const ipfsHash = await ipfs.add(JSON.stringify({
    epochId: 5,
    merkleRoot: root,
    totalAllocated: parseEther("1000000"),
    rewards: nodeRewards,
    timestamp: Date.now()
}));

// DAO 链上只需存储
distributor.proposeEpoch(root, 2000); // 使用20%
```

---

## 七、实施路线图

### Phase 1: 合约部署 (Week 1-2)

- [x] GToken v2.1.0 (已完成)
- [x] GTokenStaking v3.1.0 (已完成)
- [ ] MiningDistributor v1.0.0
- [ ] SimpleDAO / Governor

### Phase 2: Oracle 集成 (Week 3-4)

- [ ] Chainlink Oracle 适配器
- [ ] 链下数据聚合脚本
- [ ] Merkle Tree 生成工具

### Phase 3: DAO 治理测试 (Week 5-6)

- [ ] Testnet 部署
- [ ] 首个 Epoch 模拟投票
- [ ] 节点领取流程验证

### Phase 4: 主网上线 (Week 7-8)

- [ ] 安全审计
- [ ] 主网部署
- [ ] 社区公告与教育

---

## 八、安全考量

### 8.1 防止滥用

**单 Epoch 上限**:
```solidity
require(allocationPercent <= 5000, "Max 50% per epoch");
```

**时间锁**:
```solidity
uint256 public constant PROPOSAL_DELAY = 3 days;
```

**紧急暂停**:
```solidity
bool public paused;

modifier whenNotPaused() {
    require(!paused, "Paused");
    _;
}
```

### 8.2 Oracle 安全

**多 Oracle 验证**:
```solidity
mapping(bytes32 => uint256) public oracleConfirmations;
uint256 public constant REQUIRED_CONFIRMATIONS = 3;
```

**数据时效性**:
```solidity
require(block.timestamp - dataTimestamp < 1 days, "Stale data");
```

---

## 九、常见问题

### Q1: remainingMintableSupply 如何实时追踪?

**A**: 无需追踪!`totalSupply()` 已实时更新:

```solidity
// 每次 burn 调用时
function _burn(address account, uint256 amount) internal virtual {
    _totalSupply -= amount;  // 自动减少
    // ...
}

// 查询时
function remainingMintableSupply() external view returns (uint256) {
    return cap() - totalSupply();  // 实时计算
}
```

### Q2: DAO 可以无限 mint 吗?

**A**: 不可以! `ERC20Capped._mint()` 强制检查:

```solidity
function _mint(address account, uint256 amount) internal virtual {
    require(totalSupply() + amount <= cap(), "ERC20Capped: cap exceeded");
    super._mint(account, amount);
}
```

### Q3: 如何激励节点长期运行?

**A**: 引入"质押乘数":

```solidity
贡献分 = 基础分 × (1 + stakingDuration / 365 days × 0.5)
```

运行满1年的节点,贡献分增加50%。

---

## 十、总结

✅ **已实现**:
- GToken v2.1.0: Burnable + remainingMintableSupply
- GTokenStaking v3.1.0: True Burn

🔄 **待实施**:
- MiningDistributor 合约
- DAO 治理合约
- Oracle 数据聚合

📊 **核心优势**:
- 透明: totalSupply = 唯一真理
- 灵活: DAO 动态调整分配比例
- 高效: Merkle Tree 节省 Gas
- 公平: 基于量化贡献的分配

> [!NOTE]
> 这是一个完全链上治理的分配系统,无需信任中心化实体,所有分配决策由 DAO 投票决定。
