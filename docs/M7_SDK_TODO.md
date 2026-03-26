# AirAccount M7 → aastar-sdk 待办清单

**创建时间**: 2026-03-26
**背景**: airaccount-contract PR #8（M7 Complete，r5）已 review 通过，准备 merge。
**目标**: 将 `packages/airaccount/` 从 YAAA 旧合约升级到 M7，实现 F1-F7 SDK 功能。

---

## 一、本地已完成但未推送（最高优先级：先 commit 到 main）

以下文件已在本地工作目录完成，**从未 push 到远端 main**，需要先提交：

| 文件 | 内容 |
|------|------|
| `packages/airaccount/src/server/constants/entrypoint.ts` | M7 r4 Sepolia 地址、7 个新 ABI、MODULE_TYPE/ALG_ID 常量 |
| `packages/airaccount/src/server/config.ts` | AirAccountVersion 类型、sepoliaV07Config("M5"\|"M7") |
| `packages/airaccount/src/server/providers/ethereum-provider.ts` | getAccountContract 升级 + 4 个模块合约 getter |
| `packages/airaccount/src/server/services/module-manager.ts` | ERC-7579 installModule/uninstallModule 辅助类（新文件） |
| `packages/airaccount/src/server/services/session-key-service.ts` | M6+M7 session key 管理（新文件） |
| `packages/airaccount/src/server/services/guard-state-reader.ts` | F6: 读 guard 状态/tier/限额（新文件） |
| `packages/airaccount/src/server/utils/oapd.ts` | F7: OAPD 地址派生（新文件） |
| `packages/airaccount/src/server/index.ts` | 上述所有新模块的导出 |
| `packages/core/src/addresses.ts` | Sepolia 新增 microPaymentChannel/agentIdentityRegistry 等 |
| `packages/core/src/abis/SuperPaymaster.json` | 追加 16 个 SP V5.3 函数/事件 |
| `packages/core/src/abis/MicroPaymentChannel.json` | 新文件：MicroPaymentChannel ABI |
| `packages/core/src/abis/index.ts` | 导出 MicroPaymentChannelABI |
| `config.sepolia.json` | SP V5.3 地址同步 |

---

## 二、紧急修复（Breaking Change — r5 合约已变更）

### BUG: `ModuleManager.buildInstallModuleHash()` sig 格式已过期

`installModule` 的 guardian 签名哈希格式在 r5 中变更：

```typescript
// 旧格式（当前本地代码）
keccak256(encodePacked(
  "INSTALL_MODULE", chainId, account, moduleTypeId, module
))

// 新格式（r5 合约要求）
keccak256(encodePacked(
  "INSTALL_MODULE", chainId, account, moduleTypeId, module,
  keccak256(moduleInitData)   // ← 必须加上这一项
))
```

**修改位置**: `packages/airaccount/src/server/services/module-manager.ts`
- `buildInstallModuleHash()` 函数加 `moduleInitData?: Hex` 参数
- `ModuleManager.encodeInstall()` 调用时传入 `moduleInitData`

---

## 三、地址更新（r5 已重新部署）

r5 在 Sepolia 部署了新合约，需更新 `AIRACCOUNT_ADDRESSES.sepolia`：

| 合约 | r5 地址 |
|------|---------|
| factory (r5) | `0xa0007c5db27548d8c1582773856db1d123107383` |
| accountImpl (r5) | `0xf58900fE20C9d8C4d86259D383b9d810CFd138DB` |
| compositeValidator | `0x4135c539fec5e200fe9762b721f6829b2315cbe1` |
| tierGuardHook | `0x73572e9e6138fd53465ee243e2fb4842cf86a787` |
| agentSessionKeyValidator | `0xa3e52db4b6e0a9d7cd5dd1414a90eedcf950e029` |

**修改位置**: `packages/airaccount/src/server/constants/entrypoint.ts`

---

## 四、F1-F7 实施（按优先级）

### F6 + F7（已完成，见第一节，push 即可）

### F4：EIP-1193 + EIP-6963（高优先级）
```
packages/dapp/src/
    eip1193.ts   # eth_sendTransaction → M7 UserOp 转换
    eip6963.ts   # @mipd/store 广播，DApp 自动发现 AirAccount
```

### F1：硬件钱包签名器（高优先级）
```
packages/airaccount/src/auth/hardware/
    ledger.ts    # @ledgerhq/hw-app-eth → algId=0x02/0x03
    yubikey.ts   # navigator.credentials.get() → P256 (algId=0x03)
    index.ts
```
复用 `packages/airaccount/src/auth/passkey/` 的 WebAuthn 逻辑。

### F2：Helios 轻客户端（中优先级）
```
packages/core/src/transports/helios.ts  # @a16z/helios → viem custom transport
```

### F3：ENS 解析（中优先级）
```
packages/core/src/utils/ens.ts  # viem/ens 正反向解析封装
```

### F5：x402 + M7 Session Key（用户决定暂不做）
扩展 `packages/x402/` 的 `X402ClientConfig.signer` 接受 `SessionKeyAccount`。

---

## 五、ABI 同步脚本

需要新建 `scripts/sync-abis.ts`，从合约仓库 `out/` 目录自动拉取 ABI 覆盖到 `packages/core/src/abis/`。

合约仓库路径约定：`../airaccount-contract/out/`

---

## 六、推荐执行顺序

```
1. push 本地已完成内容（第一节）
2. 更新 r5 地址（第三节）
3. 修复 buildInstallModuleHash sig 格式（第二节）
4. pnpm -r build 验证编译
5. 实现 F4（EIP-1193/6963）
6. 实现 F1（硬件钱包）
7. 实现 F2/F3（Helios/ENS）
```

---

## 参考

- 合约 PR: https://github.com/AAStarCommunity/airaccount-contract/pull/8
- r5 commit: `70b469521229219d5a1f3d4b93f7c67ba8c3c99d`
- r5 E2E 脚本（sig 格式参考）: `airaccount-contract/scripts/test-m7-e2e.ts` 中 `buildGuardianInstallInitData()`
