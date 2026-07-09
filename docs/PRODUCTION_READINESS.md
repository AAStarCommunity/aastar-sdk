# @aastar/sdk — Production-Readiness 评估

> 单一真相源（SDK 侧）。对应协同任务 **CC-30**（发布 YAAA/Cos72 正式版·6 仓盘点）。
> 版本：**@aastar/sdk 0.39.4**（npm latest / tag v0.39.4）。评估日期：2026-07-09。
> "production ready" 定义（jason）：SDK 必须在 **三环境全兼容** —— 本地(anvil) / 测试网 / 主网(生产)；用户基于测试网开发后，切主网只改配置即可正常跑；SDK 负责保证并向各上游仓库 push 需定稿的 ABI/地址/版本一致性。

---

## 0. 环境矩阵（三环境）

| 环境 | chainId | config 文件 | 权威合约版本 | DVT 节点 | 状态 |
|---|---|---|---|---|---|
| **本地 anvil** | 31337 | `config.anvil.json` | 部署脚本本地部署 | 虚拟本地 `dvt1/2/3.aw.l`（2/3 或全签） | 🟡 DVT 节点未在 SDK canonical 接线 |
| **测试网 Sepolia** | 11155111 | `config.sepolia.json` | **SP 5.4.2 / Registry 5.4.2**（链上已验） | 实时在线 `dvt1/2/3.aastar.io` | ✅ 可发 |
| **测试网 OP-Sepolia** | 11155420 | `config.op-sepolia.json` | canonical 已接 | （复用 live DVT） | ✅ 可发 |
| **主网 OP** | 10 | `config.op-mainnet.json`（唯一权威，G10 已删冗余 `config.optimism.json`） | **SP 3.2.2 / Registry 3.0.2**（链上已验，**旧 V3 栈**） | 无 mainnet 节点配置 | 🔴 未就绪 |
| Ethereum L1 主网 | 1 | 无 | 无部署 | 无 | ⛔ 本期不做 |

> 标注：**[测]** 测试网就能发 · **[主]** 主网前必须补 · **[配]** 两网只差配置

---

## 1. 门禁现状（本地实跑，2026-07-09）

| 门禁 | 结果 | 说明 |
|---|---|---|
| `pnpm run check:addresses` | ✅ PASS | 4 config（chain 10 / 11155111 / 11155420）73 地址键与 CANONICAL_ADDRESSES 一致。**注意：只验 config↔canonical 一致性，不验链上是否部署 / 版本是否匹配。** |
| `pnpm run check:stubs` | ✅ PASS | shipped 源码无 silent-stub 标记 |
| `pnpm -r build` | ✅ PASS | 全包编译通过 |
| `pnpm run check:abi` | ✅ **PASS**（已修，见 §2 G2） | 曾缺 `LivenessRegistry`(SP CC-29)/`AAStarBLSKeyRegistry`(airaccount CC-27)；已 vendor LivenessRegistry + 把 AAStarBLSKeyRegistry 加入 ignore（SDK track YAAA 版） |
| `pnpm run check:abi-drift` | ✅ **PASS**（已修，见 §2 G3/G4） | 曾漂移 `Paymaster`/`Registry`/`xPNTsFactory`/`xPNTsToken`(CC-28)；已 re-vendor 上游 out/ ABI |

---

## 2. Gap 表（production-ready 阻塞项）

### 🔴 阻塞主网 / 门禁 RED

| # | Gap | 证据 | 标注 | 依赖 |
|---|---|---|---|---|
| G1 | **主网版本不匹配** —— OP-Mainnet(10) 是 **SuperPaymaster-3.2.2 / Registry-3.0.2 旧 V3 栈**，SDK ABI 是 V5.4.2。用户在测试网(V5)开发后切主网(V3)会 **ABI/行为不兼容**。canonical 主网地址指向旧 V3 部署。 | 链上 `version()`：mainnet SP=`SuperPaymaster-3.2.2`；sepolia SP=`SuperPaymaster-5.4.2` | [主] | `@repo:sp` `@repo:airaccount-contract` `@repo:dvt` 需把 **V5.4.2 全栈部署到 OP 主网** |
| ~~G2~~ ✅ **DONE** | **check:abi RED 已清** —— vendor 了 `LivenessRegistry`(SP CC-29，expose-only ABI + `LivenessRegistryABI` export)；`AAStarBLSKeyRegistry`(airaccount CC-27) 加入 abi-sync + check-abi 的 AirAccount ignore（SDK track YAAA 版，不消费 airaccount 的 Safe key registry）。 | `check:abi` ✅ PASS | [测] | — |
| ~~G3~~ ✅ **DONE** | **check:abi-drift RED 已清 · xPNTs 滥发防护(CC-28)** —— re-vendor `xPNTsFactory`/`xPNTsToken`（新增 capRatioBps/industryScaleUSD/issuanceCap/backingValueUSD/isOverIssued/effectiveCapUSD… 全是 read getter + admin setter + event/error → expose-only，无需 wrapper）。**注意：这是 ABI 面 ready；主网真正生效仍需 @repo:sp 把带滥发防护的 xPNTs 部署到主网。** | `check:abi-drift` ✅ PASS | [测]ABI / [主]部署 | `@repo:sp` 主网部署 |
| ~~G4~~ ✅ **DONE** | **check:abi-drift · Paymaster/Registry 已清** —— re-vendor（`Paymaster__GasCostExceedsCap()` error、`Registry.SBTStatusSyncFailed` event）。 | `check:abi-drift` ✅ PASS | [测] | — |

### 🟡 主网前补 / 功能完整性

| # | Gap | 标注 | 依赖 |
|---|---|---|---|
| G5 | **DVT 节点三环境未接线** —— `DEFAULT_DVT_NODES` 只有 chainId **11155111**（dvt1/2/3.aastar.io）；**无 mainnet(10) 节点、无本地 anvil `dvt*.aw.l` 节点**。本地/主网做 Tier-2/3 BLS 联签取不到节点。 | [主]+[配] | `@repo:dvt` 提供主网 validator 地址 + live 节点 nodeId；本地 anvil 节点端点约定 |
| G6 | **CC-13 批B slash 治理 Timelock 编排** —— 读 getter(批A)已就位；写侧 `setSlashPolicyAdmin`/`setSlashThreshold` 的 Timelock 编排 wrapper 待开发（需 OZ TimelockController ABI 进 core）。 | [主] | `@repo:sp`（slashPolicyAdmin 交多签/timelock，CC-28） |
| G7 | **#256 GuardChecker WebAuthn algId 预检** 疑阻断 Tier-3 转账（`algIdForTier` 无 WA 分支）。主网前必复核。 | [主] | SDK 自查 |
| G8 | **#163 buyGasless BuyIntent 签名 + relayer stuck pending** —— 影响买币路径。 | [主] | `@repo:kms` / relayer |
| G9 | **#176 Tier2/3 额外签名收集 + tier判定/限额查询 API 缺失**（ETH+ERC20 统一）。 | [测→主] | SDK 自查 |

### 🟢 Housekeeping / 配置

| # | Gap | 标注 |
|---|---|---|
| ~~G10~~ ✅ **DONE** | **主网 config 去冗余** —— `config.optimism.json` 是 stale legacy（缺 paymasterV4、带 dead srcHash/updateTime、无 NetworkName 映射、无代码按名加载）→ 已删；`config.op-mainnet.json` 为 chain-10 唯一权威。同步移除 check-address 里的 dead `optimism` alias。 | [配] |
| G11 | 主网 `aPNTs` / `paymasterV4` 是 EIP-1167 45B minimal-proxy（paymasterV4→paymasterV4Impl `0xc4dd…` 一致 ✅；aPNTs→`0xa191…`）。主网重部署 V5 后一并核对。 | [主] |
| G12 | DVT 系列 issue #285/#279/#274/#270 对应改动已在 0.37–0.39 交付上链，issue 仅待关闭。 | [测] |
| G13 | #220 upstream drift 告警 open —— 跑 `pnpm run upstream:check` 核对是否又有上游新 release。 | [测] |

---

## 3. SDK 对外 push（各上游仓库需定稿项）

SDK 作为消费端，主网前需推动并核验以下上游"定稿"：

- `@repo:sp` — **把 SuperPaymaster/Registry/xPNTs/Staking V5.4.2 全栈部署到 OP 主网**（当前 3.2.2）；定稿 `LivenessRegistry` + CC-28 xPNTs 滥发防护 ABI；slashPolicyAdmin 交多签/timelock。
- `@repo:airaccount-contract` — CC-27 `AAStarBLSKeyRegistry` 改名随下个版本 bump + **主网账户工厂/validator 部署**；确认两网 factory/validator 地址 + ABI。
- `@repo:dvt` — **主网 DVT validator 部署 + live 节点两网上线**（提供 mainnet nodeId）；本地 anvil `dvt*.aw.l` 节点端点约定。
- `@repo:kms` — 两网密钥 + rpId/Origin + imx93 板子高可用（YAAA 登录/签名前置）。

SDK 侧接线：上游主网地址确认 → 接入 `CANONICAL_ADDRESSES[10]`（覆盖旧 V3 占位）→ `check:addresses` + **链上 `version()` == 5.4.2 自验** → 发主网 patch。照 **CC-18 两阶段**（ABI 先行、地址 apply 后切）。

---

## 4. 结论

- **测试网（Sepolia / OP-Sepolia）：SDK 可发** —— 核心 API + canonical 地址 + live DVT 全就绪；**2 个 RED 门禁(G2/G3/G4)已清，全部 6 门禁绿**（check:abi ✅ / check:abi-drift ✅ / check:addresses ✅ / check:stubs ✅ / build ✅ / 单测 core 471+paymaster 20+tokens 20 ✅）。剩余为功能完整性项(G7/G9)，非发布阻塞。
- **主网（OP chain 10）：未就绪** —— 阻塞在 G1（主网还是旧 V3 栈，需 V5 全栈重部署）+ G5（DVT 主网节点）+ G3 主网部署侧（xPNTs 滥发防护需 @repo:sp 部署到主网）。
- **门禁必须全绿** 才算 SDK production-ready：check:abi ✅ / check:abi-drift ✅ / check:addresses ✅（+链上版本自验）/ check:stubs ✅ / build ✅ / 全量回归 ✅。

**当前 SDK production-ready 判定：测试网 🟢（门禁全绿，可发）/ 主网 🔴（等上游 V5 主网部署）。**
