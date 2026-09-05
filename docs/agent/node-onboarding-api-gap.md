# T1.2.1 — 节点 onboarding：脚本 → SDK API 的缺口清单

> 状态：盘点与设计，**不含实现**。产出供 T1.2.2 展开。
> 前置：T1.1.1（先有一条跑通的真实路径再抽象）。
> 背景：社区 KMS+DVT 节点接入的真正交付物是 **API + web portal**，CLI/mjs 脚本是过渡形态。
> 本清单回答的问题只有一个：**把这些脚本换成 API，还差哪些 SDK 能力。**

## 盘点了哪三个脚本

`register-node.mjs` 在两个仓库里各有一份，**内容不同**，所以「盘点 register-node.mjs」是有歧义的；
三份全盘了：

| 脚本 | 行数 | 角色 |
|---|---|---|
| `YetAnotherAA-Validator/scripts/register-node.mjs` | 285 | DVT 侧原始实现。ethers + 自写 EIP-2537 编码 + 自写 PoP，**不依赖 SDK**。覆盖面最宽（bootstrap 与 staked 两条注册路径都有）。 |
| `AirAccount/kms/node-setup/register-node.mjs` | 107 | 社区节点 setup 向导（`setup-server.py` step4）调用。**已经在用 `@aastar/operator` 的 `onboardDvtNode`**，是三者里最接近目标形态的一份。 |
| `aastar-sdk/tests/regression/onchain-evidence/dvt3-register.ts` | 161 | 本仓库的一次性上链证据脚本（dvt3 / board B / EIP-2335 keystore）。也走 `onboardDvtNode`，但前面压了一段脚本独有的 keystore 处理。 |

对照的 SDK 侧现有面：`@aastar/operator` 的 `onboardDvtNode` / `resolveEoaAccount` / `kmsPopSigner`，
`@aastar/core` 的 `dvtOperatorActions` / `buildDvtPop` / `verifyDvtPop` / `encodeG1Point` / `dvtNodeId` /
`getMountedDvtValidator` / `eip2335PasswordCandidates`。

## 清单

判定只有两种：**已有 API**（SDK 已导出可直接调用，脚本没用是脚本的事）、**需新增**（SDK 里没有，
API 化时必须补）。CLI 专属的管道（dotenv、`--flag` 解析、`console.log` 排版）不进表——见文末。

| # | 步骤 | 出处 | SDK 现状（已核实） | 判定 |
| --- | --- | --- | --- | --- |
| G1 | 载入 `node_state.json` 并校验它有可解析的 `publicKey` | DVT `loadNode()`；dvt3 `fs.readFileSync` | 全仓无任何 node_state 载入器（`loadNodeState` / `nodeState` 在 `packages/*/src` 非测试代码里 0 命中） | 需新增 |
| G2 | 压缩 48B G1 公钥 → EIP-2537 128B 线格式 | 三份脚本各自内联 `eip2537G1` | `encodeG1Point`（`core/crypto/dvtPop.ts:64`，经 `crypto/index.js` 导出） | 已有 API |
| G3 | `nodeId = keccak256(128B pubkey)` | 同上，各自内联 | `dvtNodeId`（`dvtPop.ts:167`，已导出） | 已有 API |
| G4 | 交叉核对：派生值 vs `node_state` 里记的 `nodeId`/`publicKey` 必须一致 | DVT `loadNode` die-on-mismatch；dvt3:109 与 :130 两处断言 | 无 API。三份脚本各写一遍，**断言强度还不一样**（dvt3 额外拿 `onboardDvtNode` 的 dryRun nodeId 再对一次，DVT 版没有） | 需新增 |
| G5 | EIP-2335 keystore 解密出 BLS scalar | dvt3 `decryptEip2335()`（61 行，pbkdf2/scrypt + aes-128-ctr + checksum） | 只有密码规范化那一半：`eip2335PasswordCandidates`。解密本身全仓 0 命中（`packages/airaccount/src/core/crypto/crypto.util.ts` 有 scrypt/`createDecipheriv`，但那是 salt 写死 `"salt"` 的通用 aes-256 工具，**不是 EIP-2335**，别拿它当已有实现） | 需新增 |
| G6 | raw scalar → `mod r` 归一 | dvt3:102 `BigInt(raw) % bls.params.r` | `buildDvtPop` 对 `sk >= r` **直接抛**（`dvtPop.ts:125`），不归一 | 需新增 |
| G7 | 本地 BLS 私钥构造 PoP（popPoint/popSig） | DVT `buildPoP()` 本地分支；dvt3 经 `onboardDvtNode` | `buildDvtPop` | 已有 API |
| G8 | key-less TEE 节点经 KMS `/pop` 取 PoP | DVT `buildPoP()` keyless 分支；AirAccount 版内联 fetch | `kmsPopSigner`（`operator/src/dvt/kmsPopSigner.ts`） | 已有 API |
| G9 | PoP 自校验（在曲线上 / 非无穷远 / `popSig=sk·popPoint` / 公钥 pin） | **三份脚本都没有**（AirAccount 版只查字段非空） | `verifyDvtPop`；`kmsPopSigner` 内部强制执行并 pin 公钥 | 已有 API |
| G10 | operator 私钥来源：raw hex / env 变量 / `cast wallet` | DVT `--cast` + `CAST_WALLET_ARGS`；`onboard_dvt_node.ts` `eoaSource()` | `EoaKeySource` = `privateKey \| env \| cast`，`resolveEoaAccount` | 已有 API |
| G11 | operator 私钥来源：加密 keystore JSON + 口令 | DVT `--keystore` + `OPERATOR_KEYSTORE_PASSWORD`（走 `ethers.Wallet.fromEncryptedJson`） | `EoaKeySource` 三个变体里**没有** keystore。且 SDK 是 viem-only，不能照抄 ethers 那条实现 | 需新增 |
| G12 | 决定「该对哪个 validator 注册」 | DVT/AirAccount 两版都靠 env 手工 pin `VALIDATOR_CONTRACT_ADDRESS` | `getMountedDvtValidator(publicClient, router)` 已导出（`actions/committee.ts:45`），但 `onboardDvtNode` 只接 `validator?: Address`、否则回落 canonical——**没有 router 解析这条入口** | 需新增 |
| G13 | 读 `requireStake()` / `minStake()` | DVT 主流程；`onboardDvtNode` 步骤 2 | `dvtOperatorActions().requireStake/minStake` | 已有 API |
| G14 | 读 validator 的 `owner()` / `registry()` / `ROLE_DVT()` | DVT `VALIDATOR_ABI` 五连读；dvt3:91 自带内联 ABI 读 `registry()` | **这三个 ABI 里都在**（`AAStarBLSAlgorithm.json` 共 29 个 function），但 `dvtOperatorActions` 这三个一个都没包 | 需新增 |
| G15 | 幂等短路 + 「一 operator 一 node」冲突检查 | DVT `isRegistered` 早退 + `operatorNode != 0` die | `onboardDvtNode` 步骤 1（还多一层「nodeId 已属他人」的检查） | 已有 API |
| G16 | 质押就绪度体检（`hasRole` / `getEffectiveStake >= minStake` / 出资缺口） | DVT 只诊断然后 die（它没权限修） | `onboardDvtNode` 的 `dryRun` → `plan`（`requireStake`/`needGToken`/`wouldFundEth`/`wouldFundGToken`/`wouldApprove`/`wouldRegisterRole`/`registerSimulated`） | 已有 API |
| G17 | owner 代付：给 operator 补 ETH + GToken | **DVT 版做不到**（无此权限，只能 die 让人去质押） | `onboardDvtNode` 的 `funderWallet` | 已有 API |
| G18 | `approve` → `registerRole(ROLE_DVT)` 锁仓 | 同上，DVT 版做不到 | `onboardDvtNode` 步骤 5 | 已有 API |
| G19 | 广播前 `simulate` 预检 | DVT `staticCall`（两条路径都做） | `onboardDvtNode` 步骤 6 | 已有 API |
| G20 | `registerWithProof` + 事后**独立回读**断言 | DVT 只回读 `isRegistered`；dvt3 额外回读 `nodeOperator` | `onboardDvtNode` 步骤 7 两个都断言 | 已有 API |
| G21 | bootstrap 路径：`requireStake==false` 时 owner 调 `registerPublicKey(nodeId, pubkey)` | DVT 版**有**这条分支（含 owner 身份校验） | ABI 有 `registerPublicKey`，`dvtOperatorActions` 未包；`onboardDvtNode` 无论 `requireStake` 真假都走 `registerWithProof`（第 373–386 行无条件） | 需新增 |

**小计：已有 API 13 条 / 需新增 8 条。**

## 需新增的 8 条，各自的设计约束

按「能不能直接抄脚本」分成三类。

### 一、纯搬运，脚本里已有可用实现（G1 / G4）

`loadDvtNodeState(json) → { nodeId, publicKey(128B), keyless, privateKey? }`，内部用 G2/G3 的既有构件，
并把 G4 的交叉核对做成**不可跳过**的一步。

设计要点：三份脚本的核对强度不一致，API 化时取最严的那份（dvt3 的两段：派生值 vs state，以及
dryRun 得到的 nodeId vs state）。理由写在 dvt3:130 的 abort 信息里——注册一个「运行中节点并不服务
的 nodeId」，链上会成功、节点会静默失联，没有任何一侧会报错。

### 二、有实现但**放不进现在的位置**（G5 / G6 / G11）

- **G5（keystore 解密）**：`core/src/index.ts:11` 明写 `eip2335-password` 是「pure; no node:crypto」——
  密码规范化留在 core、解密没进来，**是刻意的**：core 要过 `check:browser`，而解密要 `node:crypto`。
  所以 G5 不能补进 `@aastar/core`，得落在 node-only 的位置（`@aastar/operator` 的 node 子路径，或新的
  `@aastar/node-setup`）。这条决定 T1.2.2 的包边界，**不是实现细节**。
- **G6（mod r 归一）**：**不要**在 `buildDvtPop` 里静默 reduce。`sk >= r` 既可能是「keystore 存的是未约化
  的 raw scalar」（合法，dvt3 的情况），也可能是「传错了字节」（致命）。静默 reduce 会把后者变成一个
  能注册成功、但公钥对不上运行中节点的 PoP。应当独立成 `normalizeBlsScalar(raw)`，由调用方显式选择。
- **G11（keystore JSON 私钥源）**：SDK 是 **viem-only**（ethers 正在被完全移除），不能照抄
  `ethers.Wallet.fromEncryptedJson`。要么用 viem 的 keystore 能力实现一个 `{ type: 'keystore' }` 变体，
  要么明确判定「portal 不支持上传 keystore，只支持 cast/env」——**这是产品决策，不是我能拍的**。

### 三、要新读/新写链上（G12 / G14 / G21）

- **G12（validator 从 router 解析）**：给 `onboardDvtNode` 加 `router?: Address`，走
  `getMountedDvtValidator` 解析，与 `validator` 互斥。构件已经有了，缺的只是这条组合入口。
  它为什么值得做，见下面「跨仓观察」。
- **G14（三个 getter 包成 action）**：机械活。ABI 已全覆盖，只是 `dvtOperatorActions` 没包。
- **G21（bootstrap 注册路径）**：需要判断**要不要做**。现役 Sepolia validator `requireStake()==true`，
  这条路径打不开（FU-34 已实测：128 字节公钥走 `registerPublicKey` 直接 revert `Staking on`）。
  但 `onboardDvtNode` 在 `requireStake==false` 时仍无条件走 `registerWithProof`，
  **而「requireStake 关掉时 registerWithProof 还能不能过」本清单未验证**——没有一条现存测试覆盖它。
  两个选项：(a) 补 bootstrap 分支对齐 DVT 版；(b) 明确声明 SDK 只支持 staked 模式并在
  `requireStake==false` 时早失败。（b）更诚实，但要先确认没有部署依赖 bootstrap 模式。

## 跨仓观察（不在本 task 修，仅记录）

> 读的是 `AirAccount` @ `4de82e4`（2026-08-18）。评审独立读的是同一 revision。

`AirAccount/kms/node-setup/` 这两个文件**做的事不同，别混为一谈**（初稿把它们并成「都硬 pin」，
是错的；下面是逐文件核实后的版本）：

### `setup-server.py:155-157` —— 真正的硬 pin，三条里错一条

| 键 | 它 pin 的值 | 对本仓 canonical（chain 11155111） |
|---|---|---|
| `validator` | `0x539B9681aFd5BFbCaa655Fe4c6BdcFe1fa7864bC` | ❌ **已被取代**；canonical 是 `0x7ac7E9d471742FA4397Beef0B5b11fbD22D196a9` |
| `gToken` | `0x4c09aE57503Aa1E2A43b05621A38DbdD43b0Aa08` | ✅ 逐字等于 canonical |
| `staking` | `0x472297B557c1d0F030f281a5Bb8A535f6c5AB65e` | ✅ 逐字等于 canonical |

三条里只有 validator 那条错——**而它恰恰是最难看出错了的那条**。两个 gToken/staking 若 pin 错，
交易当场 revert；validator pin 错则一路成功。

### `register-node.mjs` —— 不 pin，是 fail-closed；错的是它给的**理由**

全文**完整地址命中 0 个**（`grep -coE '0x[0-9a-fA-F]{40}'` = 0）。它做的是：Sepolia 上缺
`VALIDATOR_ADDRESS` 就直接 die（95–97 行）。第 20 行的 `0x539B96…` 是 usage 注释里的**截断建议**。

问题不在 pin，在它写下的三句判断——按本仓 `packages/core/src/addresses.ts` 逐条核实全部不成立：

| 它说的（注释 20-22 行 + 96 行 die 信息） | 实际 |
|---|---|
| canonical `aaStarBLSAlgorithm = 0x0`，漂移 | `0x7ac7E9d4…`（v0.33.0 COMMITTEE validator），非 0 |
| canonical `gToken = 0x8d6Fe002`，别用 | canonical 是 `0x4c09aE57…`，**正是它让你手填的那个**。`0x8d6Fe002dDacCcFBD377F684EC1825f2E1ab7ef6` 是 **op-mainnet(10)** 的 gToken（本次直接在 `addresses.ts` 的 chain 10 段核实，非仅引用 FU-1） |
| canonical `staking` 不可用 | canonical 是 `0x472297B5…`，同样正是它让你手填的那个 |

第 96 行那句 die 信息本身就是一条**假事实**（「SDK canonical aaStarBLSAlgorithm=0x0 会失配」）——
它把一个正确的地址簿描述成坏的，然后要求人手填一个错的。

**所以两者修法不同**：`setup-server.py` 要改的是常量；`register-node.mjs` 要改的是注释建议 +
那条 die 信息的措辞（以及要不要保留 fail-closed 本身）。

### 为什么这条属于 G12

`0x539B9681…` 是**已被取代的** validator。本仓 `packages/core/src/dvt.onchain.test.ts` 的实测记录：
`router.getAlgorithm(0x01) = 0x7ac7E9d4…`，而 `0x539B9681…` 仍有 13610 字节代码、
`isRegistered(node 1-3)` 同样返回 `true × 3`。**两个都答，且答得一样**——
「有代码」和「认得我们的节点」都区分不出哪个是活的。

这正是 G12 的价值：不是「多一个可选参数」，而是**唯一能自证的答案来源**。下游手填/手 pin，
是因为 SDK 没给它一条从 router 解析的入口；填错了，而错法在链上看不出来。

> 归属：AirAccount 仓库的两个文件 + 本仓库缺的 G12 入口。前者不是 SDK 的交付物，此处只记录不追。

## 不进 API 的部分（说明为什么）

| 脚本里的东西 | 为什么不进 API |
|---|---|
| `dotenv` / `--env-file` 加载 | 配置注入是宿主的事。portal 从表单/DB 拿参数，API 只收显式入参。 |
| `--flag` 解析、`console.log` 排版、emoji 前缀 | 表现层。API 返回结构化结果（`onboardDvtNode` 已经是这个形状）。 |
| `process.exit(0/1)` + stdout JSON 契约 | 进程契约。API 抛异常 / 返回对象。 |
| `execFileSync('cast', …)` 广播 | `resolveEoaAccount` 已把 cast 收敛成「取私钥」这一步，广播统一走 viem。保留 cast **签名**（ledger/keystore 场景）是有价值的，但广播不必外包给子进程。 |

## 交付判定

本文件即 T1.2.1 的交付物。验收（可机器判定）：

```bash
awk '/^\| G[0-9]+ \|/{n++; if (/\| (已有 API|需新增) \|$/) ok++} \
     END{printf "rows=%d labelled=%d\n",n,ok; exit (n>0 && n==ok)?0:1}' \
  docs/agent/node-onboarding-api-gap.md
```

T1.2.2 的验收标准由本清单定义：**8 条「需新增」逐条有对应实现或有记录在案的「决定不做」**，
其中 G5 / G11 / G21 三条含产品决策，需 jason 拍板后才能进入实现。
