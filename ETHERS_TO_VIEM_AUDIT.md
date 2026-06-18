# ethers → viem 迁移审计报告（Batch 2）

> 目标：从 `aastar-sdk` 彻底移除 `ethers`，全栈只依赖 `viem`。
> 范围：`packages/airaccount`（唯一使用 ethers 的包）。
> 状态：**审计 / 尚未动代码**。本报告将先交 Codex 挑战，再交付用户决策。

---

## 1. 现状与规模

| 指标 | 数值 |
|---|---|
| 使用 ethers 的包 | **仅 `packages/airaccount`** |
| 含 ethers import 的源文件 | **25**（外加 1 个 example） |
| ethers import 站点 | **41**，全部为命名空间式 `import { ethers } from 'ethers'` |
| 受影响文件总 LOC | **~8,842** |
| airaccount 当前 viem 使用 | **0**（纯 ethers，无混用） |
| `ethers` 声明位置 | `packages/airaccount/package.json` + `packages/sdk/package.json`（后者仅因 bundle airaccount 而声明，tsup 已 external） |

**结论**：移除 ethers = 把 airaccount 的 server/core 层整体从 ethers 改写为 viem。不是薄封装替换，是一次有架构面的迁移。

---

## 2. ethers API 面 → viem 映射（实测全量）

### 2a. 纯机械 1:1（低风险）

| ethers | 次数 | viem 等价 | 备注 |
|---|---|---|---|
| `ethers.ZeroAddress` | 22 | `zeroAddress` | 常量 |
| `ethers.ZeroHash` | 1 | `zeroHash` | 常量 |
| `ethers.keccak256` | 12 | `keccak256` | 入参须 `0x` hex 或 bytes |
| `ethers.parseUnits` | 11 | `parseUnits(value, decimals)` | viem decimals 为 `number` |
| `ethers.parseEther` | 8 | `parseEther` | |
| `ethers.formatUnits` / `formatEther` | 2 | `formatUnits` / `formatEther` | |
| `ethers.toBeHex` | 12 | `numberToHex` / `toHex` | 注意 size 参数语义 |
| `ethers.zeroPadValue` | 10 | `pad(hex, { size, dir: 'left' })` | |
| `ethers.getBytes` | 16 | `hexToBytes` / `toBytes` | |
| `ethers.concat` | 13 | `concat` / `concatHex` | viem `concat` 支持 hex 与 bytes |
| `ethers.toUtf8Bytes` | 1 | `stringToBytes` / `toBytes` | |
| `ethers.encodeRlp` | 1 | `toRlp` | |
| `ethers.hashMessage` | 3 | `hashMessage` | |
| `ethers.recoverAddress` | 1 | `recoverAddress` | |
| `ethers.verifyMessage` | 1 | `verifyMessage`（async）/ `recoverMessageAddress` | viem 是异步 |

### 2b. 需要改写调用形态（中风险）

| ethers | 次数 | viem 等价 | 改写要点 |
|---|---|---|---|
| `ethers.AbiCoder.defaultAbiCoder` (encode/decode) | 17 | `encodeAbiParameters` / `decodeAbiParameters` | 参数类型需显式声明为 viem `AbiParameter[]` |
| `ethers.solidityPacked` | 13 | `encodePacked` | 类型数组 + 值数组拆分传参 |
| `ethers.Interface` | 39 | `encodeFunctionData` / `decodeFunctionResult` / `decodeEventLog` / `Abi` | ethers `Interface` 是有状态对象；viem 是无状态函数，需按用途拆 |
| `ethers.id(str)` | 12 | `keccak256(toBytes(str))` | **语义陷阱**：`ethers.id` = keccak256(UTF-8 bytes)，常用于事件 topic / selector。必须用 bytes 版，不能 `keccak256('0x'+str)` |
| `ethers.Result` | 4 | `decodeFunctionResult` 返回值 | ethers Result 既可索引又可具名；viem 返回结构化值，destructuring 写法需改 |
| `ethers.Signature.from` | 3 | `parseSignature` / `serializeSignature` | r/s/v/yParity 字段映射 |
| `ethers.TypedDataEncoder.hash` | 1 | `hashTypedData` | EIP-712 |
| `ethers.Transaction.from` | 1 | `parseTransaction` | |
| `ethers.toBeHex`(带 size) | — | `numberToHex(v, { size })` | |

### 2c. 架构面（高风险，迁移的真正成本）

| ethers | 次数 | 说明 |
|---|---|---|
| `ethers.Contract` / `BaseContract` | 68 | **最高频**。ethers 模式：`new Contract(addr, abi, providerOrSigner)` 后 `c.read()` / `c.connect(signer).write()`。viem 需拆成 `publicClient.readContract` / `walletClient.writeContract`（或 `getContract({client})`）。写路径形态完全不同，涉及大量 service 调用点。 |
| `ethers.Provider` / `JsonRpcProvider` / `getDefaultProvider` | 51 | ethers Provider → viem `PublicClient`（`createPublicClient({ transport: http() })`）。`getDefaultProvider` 无直接对应，须显式给 RPC。 |
| `ethers.Signer` / `AbstractSigner` / `Wallet` | 39 | **架构核心**：`ISignerAdapter` 接口（`server/interfaces/signer-adapter.ts`）整个建立在 `ethers.Signer` 之上（`getSigner(): Promise<ethers.Signer>`），并贯穿 KMS signer / wallet-manager / 各 service。viem 把"签名"(Account/LocalAccount) 与"发交易"(WalletClient) 分离，需重新设计 adapter 契约（建议返回 viem `LocalAccount` 或经 `toAccount()` 包装的自定义签名器），这是牵一发动全身的部分。 |
| `ethers.TransactionResponse` / `TransactionRequest` (types) | 9 | 类型替换为 viem `Hash` + `waitForTransactionReceipt` / `TransactionReceipt`。 |

### 2d. BLS 字节级哈希（**最高隐性 bug 风险**）

`core/bls/bls.manager.ts` 与各 BLS service 用 `solidityPacked` + `keccak256` + `concat` + `getBytes` + `zeroPadValue` + `toBeHex` 构造哈希/签名输入。这些必须**逐字节对齐**，任何 padding 方向、大小端、UTF-8 vs hex 的差异都会导致链上验签静默失败。**此区域必须有 KMS live E2E（`KMS_E2E=1`）+ 与 ethers 旧实现的逐字节对拍测试兜底**，不能只靠类型通过。

---

## 3. 文件分层（按迁移难度）

- **Tier A — 机械替换（低风险）**：`core/crypto/*`、`utils/oapd.ts`、token/价格相关 service 中只用 parse/format/常量的部分。
- **Tier B — 改写调用形态（中风险）**：所有用 `Contract` 读/写 + `Interface` 编解码的 service（account/module/transfer/paymaster/token/recovery/session-key/agent-registry/erc8004/eip7702/force-exit/guard-* 等十余个）。
- **Tier C — 架构改造（高风险）**：`server/interfaces/signer-adapter.ts`、`server/services/kms-signer.ts`、`server/services/wallet-manager.ts`、`server/adapters/local-wallet-signer.ts`、`core/erc4337/userop.builder.ts`、`server/utils/execute-user-op.ts`。
- **Tier D — 字节级敏感（最高风险）**：`core/bls/bls.manager.ts`、`server/services/bls-signature-service.ts`、`server/services/weighted-signature-service.ts`。

---

## 4. 建议迁移策略（已按 Codex 挑战修正）

1. **第 0 步：先定签名抽象（所有后续的前提）**。`ISignerAdapter` 不能简单返回 `LocalAccount`——`KmsSigner` 是完整的 `ethers.AbstractSigner`（含 `connect`/`populateTransaction`/`signTransaction`），且多处直接发交易（如 `force-exit-service.ts`）。新契约应返回 **`{ account, walletClient }` 对**：`account` 负责签名，`walletClient.writeContract` 负责发交易。同时解决 WebAuthn per-request 上下文注入（见 §7 H2）。
2. **第 0.5 步：先写 golden-fixture 对拍测试**（在改写任何 Tier C/D 前）。对 BLS（§7 H3 列出的全部函数）、UserOp hash、force-exit proposal id、65 字节 `r||s||v` 三条路径，先固定「输入 → 期望 hex」向量，改写后必须逐字节全绿。
3. **垫片可选**：集中 `solidityPacked→encodePacked`、`id→toFunctionSelector`/`keccak256(toBytes)`、`AbiCoder→encodeAbiParameters` 等惯用写法，便于复用与测试。
4. **顺序修正**：原 "A→B→C→D" 有矛盾——transfer / BLS（Tier B/D）已依赖签名抽象（Tier C）。正确顺序是 **签名抽象(0) → 对拍测试(0.5) → 字节敏感的 BLS/UserOp(原D) → 合约读写 service(原B) → 纯机械(原A)**，最后清理。
5. **全程 `KMS_E2E=1` live E2E 兜底**，最后跑完整 regression。
6. **清理范围（勿漏）**：两个 `package.json`（airaccount + sdk）的 `ethers` 声明、tsup `external` 中的 `ethers`、`examples/server-usage.ts`、README、以及所有 mock 了 `ethers.Contract`/`Interface` 的测试。完成后加 ESLint 规则禁止再次引入 ethers（见 [[feedback_viem_only]]）。

---

## 5. 工程量与风险（已按 Codex 挑战修正）

- **工程量**：~8,842 LOC 受影响，68 处 Contract + 51 处 Provider + 39 处 Signer 改写。
  - ⚠️ **修正**：原估 2–4 天**只够「编译通过」的浅层迁移**。含 parity fixtures + 可信回归覆盖的**完整迁移更接近 1 周**。
- **主要风险**：
  - BLS 字节级不一致导致链上验签失败（**最高**，靠 §7 H3 的 golden fixtures 控制）。
  - 签名器抽象重构 + WebAuthn 上下文注入波及面广（**高**，靠 §7 H1/H2 的 `{account, walletClient}` + `toAccount()` 方案控制）。
  - 65 字节 `r||s||v` 跨 KMS/UserOp/EIP-7702 三路径归一化（**高**，§7 H4）。
  - `ethers.Result` 具名访问丢失、`toBeHex`/`zeroPadValue` 的 size 语义、`ethers.id` 语义（中）。
- **回归门槛**：单测 + parity fixtures + `KMS_E2E=1` live E2E 全绿，方可提 PR。

---

## 6. 待 Codex 挑战的点（已解答，结论见 §7）

- 签名抽象迁移方案 → **不是 `LocalAccount`，而是 `{account, walletClient}` 对 + `toAccount()` 注入 ctx**（H1/H2）。
- 适配垫片 vs 逐文件 → 垫片可选，集中风险点。
- BLS 对拍边界 → **`packSignature` / `packCumulativeT2Signature` / `packCumulativeT3Signature` / `generateMessagePoint` / `encodeG2Point` / `hashToCurve` 全部**（H3）。
- 被低估的差异 → `Result` 具名访问、`Interface` 解码、签名字段映射、测试 mock（M1/L1/L2）。

---

## 7. Codex 对抗性挑战结论与修正（v2）

> 来源：Codex 对照 `packages/airaccount/src` 实际代码逐条复核。方向整体正确，但**签名抽象**与 **BLS 字节兼容**两处原审计过于乐观。

### High
- **H1 — 签名抽象有根本性 fit 问题**（`server/services/kms-signer.ts:771`）：`KmsSigner` 是完整 `AbstractSigner`（`connect`/`populateTransaction`/`signTransaction`）；viem account 只签名不发交易。**修正**：抽象层用 `{ account, walletClient }`，写交易改 `walletClient.writeContract`，否则 `force-exit-service.ts:155` 等直接发交易路径全断。
- **H2 — WebAuthn 断言上下文无法自然挂到 viem account**（`server/interfaces/signer-adapter.ts:8`，`transfer-manager.ts:187`，`bls-signature-service.ts:189`）：`PasskeyAssertionContext` 经 `getSigner(userId, ctx)` 注入。**修正**：每次操作用 `toAccount()` 工厂注入 ctx，或接口改 `signMessage(userId, bytes, ctx)`。
- **H3 — BLS 对拍范围远超原列**（`core/bls/bls.manager.ts:67/89/102/136`）：必须逐字节测试 `packSignature` / `packCumulativeT2Signature` / `packCumulativeT3Signature` / `generateMessagePoint` / `encodeG2Point`（含 EIP-2537 G2 的 16-byte offset、96-char Fp limb）/ `hashToCurve`。**修正**：为以上全部生成 golden fixtures。
- **H4 — 65 字节 `r||s||v` 迁移缺策略**（`kms-signer.ts:132/810`，`eip7702-delegate-service.ts:146`）：当前依赖 `ethers.Signature.from(...).serialized`；viem 暴露 `r/s/yParity` 变体易误用 compact 或改变 `v` 语义。**修正**：在 KMS 边界归一化签名，断言长度/末字节，三路径加测试证明输出不变。

### Medium
- **M1**（`weighted-signature-service.ts:98`，`session-key-service.ts:115`）：`ethers.Result` 命名 + 位置混用；viem 是否保命名取决于 ABI `components[].name`。**修正**：确保 ABI 带 name，加 `weightConfig`/`pendingWeightChange`/`getSession`/`agentSessions` 解码测试。
- **M2**（`paymaster-manager.ts:175`，`transfer-manager.ts:208`）：paymaster 字段需 16/32 字节左填充、算法 ID 精确 1 字节。**修正**：`numberToHex(v,{size})` / `pad(hex,{size,dir:'left'})` 逐调用点核对。
- **M3**（`userop.builder.ts:53`，`force-exit-service.ts:117`）：`AbiCoder.encode` → `encodeAbiParameters(parseAbiParameters('...'), values)`；加 UserOp hash / proposal id golden fixtures。
- **M4**（`execute-user-op.ts:12`，`account-manager.ts:172`）：选择器用 `toFunctionSelector(sig)`，字符串 keccak 用 `keccak256(toBytes(str))`，packed 用 `encodePacked`。
- **M5**（`kms-signer.ts:786`，`kms-signer.test.ts:298`）：现有 `signMessage` 字符串走 UTF-8、`Uint8Array` 走 EIP-191、32 字节 hash。**修正**：用 `toAccount()` 自定义 `signMessage` 以 `{ raw: bytes }` 保持行为，两种输入分开测。

### Low
- **L1**（`local-wallet-signer.test.ts:37`）：测试里 `ethers.verifyMessage` 同步 → viem 异步，需改 await。
- **L2**（`token-service-onchain.test.ts:1/17`）：测试显式 mock 了 `ethers.Contract`/`Interface`，移除 ethers 后全断 → 改 mock viem `publicClient.readContract`/`getContract`。
- **L3**（`examples/server-usage.ts:145/187`，`package.json:87`，`packages/sdk/package.json:99`）：示例仍把 `KmsSigner` 当 ethers signer 宣传；两包仍声明 ethers → 随代码同步清理，确认 bundle 无 ethers 残留后再删声明。

### 总体裁定（Codex）
方向正确、基础映射无硬错；但签名抽象与 BLS 字节兼容过于乐观，阶段排序自相矛盾（已在 §4 修正）。**完整迁移（含 parity 测试 + 可信回归）≈ 1 周，而非 2–4 天。**
