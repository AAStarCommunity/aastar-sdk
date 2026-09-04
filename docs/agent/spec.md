# spec — M5 的精确坐标

> 依据 [`architecture.md`](architecture.md)。本文件是**执行时唯一的权威值来源**。
> **纪律**：下面每个地址/哈希/版本串都是 2026-09-04 对 Sepolia 直读或对上游 git 对象直算得到的。
> **禁止**由截断地址（`0xABCD…1234` 这种）补全 —— 我在 B4 里这么干过一次，猜出的地址链上 `code = 0x`。
> 取值来源写在每张表里；执行时如与链上不符，**停下标 BLOCKED**，不要改这张表去迁就代码。

链：Sepolia，`chainId = 11155111`。读数区块见 `docs/onchain-evidence.md`。

---

## 1. SP 栈（F5.1）

### 1.1 目标地址

| 项 | 值 | 来源 |
|---|---|---|
| `blsAggregator`（**要切成这个**） | `0xEaeC2F512eA50708211fa95533e4dBb60e3d2E5D` | 三腿链上一致 |
| version | `BLSAggregator-4.11.0` | `version()` |
| extcodehash | `0xa47bcf01babb782960fab93f8b5d5a9ca6e27c1aa96c0aa8648386b4a75bde4c` | `keccak(code)` |
| domainSeparator | `0x79613488655ebee89c98f43ad96de45806de7cdcb182783efc2219f006e1ee2b` | `domainSeparator()`，且 SDK 本地可由 (name, chainId, aggregator, registry) 重算得到 |
| fraudProofVerifier | `0xa1346F1668cBf8D031Cc5D72eDA45F5788CA1cd3` | `fraudProofVerifier()`；`pendingFraudProofVerifier() == 0` |
| defaultThreshold / minThreshold | `2` / `2` | 注意：4.1.0/4.3.0 时代是 7/3 |
| slashThresholds | `[0]=2 [1]=3 [2]=3` | index 3、4 都是 0，不可区分，**不 pin** |
| GUARDIAN_SLASH_CASE_WINDOW | `345600`（4 天） | |

### 1.2 三腿（必须彼此相等）

```
Registry(0xf5Bf37ca83AfdAab73691bA7eCcDfA69b8708E71).blsAggregator()
SuperPaymaster(0x09DF0d2e3722EC0e401fE3819E64278a42ae4DE9).BLS_AGGREGATOR()
DVTValidator(0x568b1486BFE036e603eA11f0D03Dc47fa62c9E0e).BLS_AGGREGATOR()
```

> 历史：2026-08-26 → 09-01 期间 Registry 曾**单独**被重指，另两腿留在 4.3.0，且 `pendingBLSAgg == 0`（落定状态，非时间锁窗口）。单字段 manifest 表达不了这个状态——这就是三腿要分别断言的原因。

### 1.3 要被拒绝的前任

| 地址 | version | 为什么必须拒 |
|---|---|---|
| `0x174b60bB462b00550F0EC7Bc35Fe39dDB6310158` | 4.3.0 | CC-89 生产前任，slasher 授权已撤 |
| `0xF51c029879685Ced8fbCfa4b647c2eAe50Cd8B13` | 4.1.0 | **canonical 当前值**，无 `fraudProofVerifier()` |

### 1.4 ABI 产物

| 项 | 值 |
|---|---|
| 来源 | `SuperPaymaster@d651646aee98e8b22c8abe5af079bd4bb0a35728:abis/BLSAggregator-4.11.0.deployed.json` |
| sha256 | `df667b4d7e59b78afda728c03259c35074ef634a7c257e7f40fa3247e81106ce` |
| 形状 | 72 函数 / 160 条目 |
| 4.11.0 **源码** revision | `7cba99a911ba3898869f3a241fa0756f09d54d7d`（= `02066f9a^`；`02066f9a` = #400，把 src 抬到 4.12.0） |
| 读法 | `git show <rev>:<path>` —— **不读工作区** |

### 1.5 selector

| 用途 | selector | 签名 |
|---|---|---|
| fraud-proof verifier 入口 | `0x61077735` | `verify(bytes32,uint256,address[],bytes)` —— 属**verifier**，不属聚合器 |
| 必须缺席的旧式 | `0x05579e4d` | `verify(uint256,address[],bytes)` |
| 形状门禁 | `0xee02231c` | `guardianSlashCases(uint256)`；链上 224 字节 = **7 字** |

> 聚合器自己的 `verify` 是 `verify(bytes32,uint256,uint256,bytes)`，与上面第一行**不是**一回事。

---

## 2. AirAccount v0.33.0（F5.2）

**权威来源**：`~/Dev/aastar/airaccount-contract` 的 `.env.sepolia` `V0330` 块（tag `v0.33.0` = `0ac628ecb46acbbeadc7b7b66a7b4adf026f87f2`）。已链上验活：`FACTORY_VERSION()` / `ACCOUNT_VERSION()` 均返回 `"0.33.0"`。

| 组件 | v0.33.0 地址 | 相对 v0.31.0 |
|---|---|---|
| WebAuthnLib | `0xdDb6e10B39Ffb2e16b63993796226e19de257A31` | 变 |
| CommitteeBLSLib | `0x6B546711E3e4A1dd10B585EA1fc7509f2cA1621e` | 变 |
| Impl | `0x63a6D78A7B7e443D4d15EDCf950aE567e0F80a3b` | 变 |
| Extension | `0x4ad5C1EFa95deaadEF3d3Ab02CB96504DEa0fCC2` | 变 |
| Factory | `0x2A5cf40c24B8D27B8A039DE2b628fb4C9C66dAb9` | 变 |
| AgentRegistry | `0x734625F68aA9f9dD7DBA2e1f8DE883FD12801Be9` | 变 |
| **ValidatorRouter** | `0xA97A752779ebfDA58612F6727Ec7C8366c39f897` | 变 |
| **Committee validator (algId 0x01)** | `0x7ac7E9d471742FA4397Beef0B5b11fbD22D196a9` | 变（v0.31.0 是 `0x1A8Db639…`） |
| SessionKeyValidator (0x08) | `0x6b044fB27B4763Fd30D02e41EDF2c62af4Aa946f` | 复用 |
| ForceExitModule | `0x3fDe77868b74a7979A40a2293a1CD265fbe66EEc` | 复用 |
| Delegate | `0xd2735E54C5f5f2BF523b8a9ddd0E183624c3f2c0` | 复用 |
| CalldataParserRegistry | `0x7dEea4544446826601014bD94d0F6432A67496F5` | 复用 |

**新 committee validator 实测**：`committeeActive=true` · `requireStake=true` · `minCommittee=3` · `TREE_DEPTH=14` · `requiredQuorum=2` · `activeCount=3` · `configVersion=5`。
per-signer wire 结构 **未变**：`[nodeId(32) | slot(32) | proof(14×32)]` = 512 字节。

> ⚠️ 三个 operator 的 ROLE_DVT `effectiveStake` 恰好 `30e18` == `minStake`，`activeCount` 恰好 == `minCommittee`。**两个轴都零余量**。属他仓风险，SDK 只读。

## 3. DVT（F5.3）

| 项 | canonical | 链上 | 状态 |
|---|---|---|---|
| `dvtValidator` | `0x568b1486BFE036e603eA11f0D03Dc47fa62c9E0e` | 同 | 疑似未变，**待出证据** |

DVT nodeId（三个，`keccak256` 的是**整个 128 字节 EIP-2537 G1 blob**，剥填充按 96B 算会对不上）：

```
0x1f5e41c69465733eeb19341d95853ee6d9295a9e6698f5398d70e509be8f326d
0xe3a4a3af3973b65bc95dd962e767e17592dfb331f3544209676271b188fd9f80
0x96d64ba8240694153c757707732a11ff175380065ddacb6406094c9d5fa5cfce
```

> `registerPublicKey(bytes32 nodeId, bytes publicKey)` 的 nodeId 是**调用方任选**，非协议派生；`registerWithProof` 才派生。所以「bootstrap id 等于 keccak」是当年注册者的选择，不是协议保证——硬编码 pin 在结构上就不该存在（FU-17 待改写）。

## 4. KMS（F5.4）

**待探测**，本文件暂无权威值。执行 T5.4.1 第一步是确定 KMS 仓库位置与权威版本，然后回填本节。
相关变更通知：CC-2（v0.26.1）· CC-19（v0.26.1→v0.27.4 安全加固）· CC-25（airaccount-node v0.28.0）。

---

## 5. 常用读取命令

```bash
set -a; source ~/Dev/.env; set +a          # SEPOLIA_RPC_URL
RPC="$SEPOLIA_RPC_URL"
cast call <addr> 'version()(string)'            --rpc-url $RPC
cast call <addr> 'getAlgorithm(uint8)(address)' 1 --rpc-url $RPC
git -C <upstream> show <rev>:<path> | shasum -a 256
```

> `.env.sepolia` 里的 Alchemy key 已失效（403），必须用 `~/Dev/.env` 的 `SEPOLIA_RPC_URL` 覆盖。
