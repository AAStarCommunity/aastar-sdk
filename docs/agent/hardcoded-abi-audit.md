# FU-76 裁决 —— 手写 ABI 里那 6 个「本仓任何 ABI 都没有」的函数名

> 起因：#381 修 `packages/dapp` 一处虚构 ABI 时，顺手把全仓未加理由的手写 ABI 全提取了。
> 那次只记事实、不下判断（FU-76）。**本文件是判断，每条都带链上判据。**
>
> 测量环境：Sepolia，block `11639724`。判据一律是「selector 在不在部署字节码里」，
> 且**每组都带正对照** —— 同一份字节码上另找一个真 selector，证明探针本身在工作。

---

## ⚠️ 先说我在这次测量里犯的错，因为它决定了怎么读下面的表

第一次探 PaymasterV4 时，我用的是 **canonical 里那个地址**，得到七个函数**全部 ❌**。

那个地址是一个 **45 字节的 EIP-1167 最小代理** —— 它的字节码里一个 selector 都没有，
连真实存在的函数也查不到。

> **一个「全 ❌」的读数，看起来和一次发现完全一样。**

改成先解代理（`0x363d3d37…73` 后 20 字节 = 实现地址
`0xc0f968625e3ac0a2ad7f107cd5857425f672d268`，10493 字节）再探，正对照才亮起来。
**下表所有 paymaster 行都是对实现地址测的。**

---

## 裁决表

| # | 函数 | 合约 | 判据 | 裁决 |
|---|---|---|---|---|
| 1 | `totalLifetimeBurned()` | GToken `0x4c09aE57…`（6113B，非代理） | selector `0x5c5de6a9` ❌；正对照 `totalSupply()` `0x18160ddd` ✅ | **不存在，但无害** —— 见下 |
| 2 | `stake(uint256)` | GTokenStaking `0x472297B5…`（9061B，非代理） | selector `0xa694fc3a` ❌ | **不存在** → 改为抛错 |
| 3 | `addGasToken(address)` | PaymasterV4 impl（10493B） | ❌；正对照 `setServiceFeeRate` ✅ | **不存在** → 抛错垫片 |
| 4 | `removeGasToken(address)` | 同上 | ❌；真实是 `removeToken(address)` ✅ | **名字错** → 补 `removeToken` |
| 5 | `withdrawPNT(address,address,uint256)` | 同上 | ❌；真实是 `withdrawTo(address,uint256)` ✅ | **名字和参数都错** → 补 `withdrawTo` |
| 6 | `submitProof(string,bytes32)` | reputation | 52 份 ABI 里 0 次命中；**代码自陈是占位符** | **自认的桩** → 改为抛错 |

**另有一条不在此表：** #381 初版说 dapp 的 `createProposal(address,uint8,string)` 也是假的。
**那条是我错了**：`DVTValidator` 声明了**两个重载**，三参那条真实存在（`0x8e24bc9a`）。
我的审计脚本每个名字只留一条签名，**把重载压平了** —— 而重载正是「同名不同 selector」
的所在，也正是 #362 追了一整天的那个危险。已在 #381 更正。

---

## 逐条

### 1. `totalLifetimeBurned` —— 不存在，而 catch 里那条才是唯一走过的路

初读我以为它「失败后静默回落到 0」。**不是。** catch 里是

```ts
totalLifetimeBurned = cap - totalSupply - remainingMintable;
```

一个**派生值**，而且是对的：烧掉的就是 cap 里既不存在、也不再可铸的那部分。

所以真正的问题不是数字错，是**代码在说一件不真的事**：它读起来像
「优先用链上计数器，拿不到才推导」，而链上计数器**从来就不存在**，
推导是它唯一走过的路。

**未改行为**（形状留着，将来 GToken 真加了计数器就能自动切过去），但补了实测与一条提醒：
**两个分支不可互换** —— 链上计数器量的是「烧了多少」，推导量的是
「cap 减去还在的和还能铸的」。今天两者一致，只是因为没有别的东西消费这个 cap。

### 2. `stake(uint256)` —— 改为抛错，不再发一笔注定 revert 的交易

真实 ABI 是 `lockStakeWithTicket` / `topUpStake` / `getStakeInfo`，**没有裸的 `stake`**。

不自动转发，因为**那两个不是同一个操作**，这层包装没有资格替调用方选。

### 3–5. paymaster 三条 —— 还有一层：ABI 格式本身就是坏的

这五个方法把**裸的人类可读字符串数组**当 `abi:` 传（`['function addGasToken(...)']`）。
viem 直接拒绝：

```
Cannot use 'in' operator to search for 'name' in function addGasToken(address token)
```

**它们在本地就抛了，从没到过节点。**

而 `prepareGaslessEnvironment` 里那次 `addGasToken` 包在 `try { } catch (e) {}` 里：

> **一个必然抛异常的调用放在空 catch 里，和一个成功但没产出的调用无法区分。**

而真正管用的 `setTokenPrice` **就在下一行**，它是对的、也确实跑了。
所以那个坏方法不是在补空缺，是同一能力的第二个虚构拼法。

### 6. `submitProof` —— 一个会发交易的桩

原注释：「Using a generic 'submitProof' signature for now / In reality this would target the
ReputationOracle or similar」。

**一个抛错的桩和一个广播的桩是两回事。** 现在它抛错 —— 这本来就是它自己的注释暗示的行为。

---

## 为什么这些能活这么久：四层掩护

1. **仓库自己的 `parseAbi` 禁令从没跑过** —— `.eslintrc.js` 明令禁止，
   但**没有任何一个包定义 `lint` 脚本**，`pnpm -r lint` 全仓空转。
2. **空 catch** —— 见上。
3. **mock-only 测试** —— `PaymasterOperator.test.ts` 断言的是
   「SDK 对着 mock 说了 `'addGasToken'` 这个字符串」，而 mock 会把听到的名字原样记下来，
   **从不经过 viem 的编码**。20/20 全绿。
4. **压根没有测试** —— `submitProof` / `stakeGToken` / `totalLifetimeBurned` /
   `getSupplyMetrics` 在全仓测试文件里各出现 **0 次**（实测）。
   把它们改成抛错**一条测试都没红**，而这件事本身就是读数。

第 3 层已补上能抓住它的断言：`expectEveryWriteCarriesARealAbi` —— 交给 viem 的 `abi`
必须是**解析过的对象数组，且真的声明了正在调用的那个函数**。
**断言函数名对 mock 是免费的；这一条不是。**

---

## 遗留

- **第 1 条未改行为**，只补了说明。若将来 GToken 加上计数器，
  上面那条「两个分支不可互换」的提醒是决定要不要切的依据。
- **`getSupportedTokens()` 存在**（已在实现字节码里验到），
  但 SDK 没有包它 —— 那是缺能力，不是错误，未在本轮处理。
