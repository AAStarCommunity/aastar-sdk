# aoa-a7-readback/1

SP 读回文件的 JSON Schema（Draft 2020-12）和示例，**按原样**取自 SuperPaymaster 的
commit `769e17d2edbe86cdeeec44e06b5116e11a9050d5`（重新冻结）（已冻结：再改须经 DSR 验收并给出新哈希） 中 `docs/release/a7/` 下（经 GitHub API 按该 SHA 拉取）。

| 文件 | sha256 |
|---|---|
| `aoa-a7-readback-1.schema.json` | `b58405f1d0a70375f9bd67bd5a26d92d64f6434aa4fbafd81d529fa917b93e6e` |
| `aoa-a7-readback-1.example.json`（fork） | `62099b25d49165825199fff6f4def15c86d9b2de4661024687192a5fe60ec8ca` |
| `aoa-a7-readback-1.live.example.json` | `3498c29bec7f665e8e0f7a9f7858cf988384de1c68f6577f450b73c0ce6b9507` |

schema 的 sha256 写死在 `scripts/sp550-readback-compare-core.ts` 里：schema 文件的哈希一旦对不上，比对工具就拒绝运行。示例里的值都是占位符，只用来测试 schema 校验本身。要改 schema，必须让 SP 先提交新版本，再同步更新这三处：这里的文件、本表中的哈希、代码里的常量。

上一版 schema（685ff69d，sha256 `d893b790…`）里，`header.anvilVersion` 的两个 `oneOf` 分支都能匹配 `"n/a:live"`，所以任何 live 读回文件都通不过校验。SDK 发现后经 DSR 转给 SP，SP 在 61d30b82 修正，并逐个复核了所有 `oneOf` 节点，没有发现其他重叠。
2228c0b6 版又把 version 规则写进了 schema：spAdminExtension 和 xPNTsTokenV2Ext 的 version 必须是 null，其余合约不允许写 null。
第 3 版（be491201）改了两处：
- **probe 的判定规则**：改为 `estimateSimulate`（`eth_simulateV1`）的 gasUsed、fork 上 receipt 的 gasUsed、`expected.gasUsed` 三者相等，并且 `callAtGasUsed` 全部为 true。各家 estimate 只记录、不判定，因为 reth 的 estimate 会多留余量。
- **新增 `x-readMethods`**：逐字段写明读取方法。
248ef831 版只改了 owner/pendingOwner 的说明：Registry 的 pendingOwner 读两次，一次通过 `pendingOwner()` getter（Ownable2StepNamespaced.sol:57），一次直接读 ERC-7201 槽 `0xdb5a3168…742a00`，两个结果都必须等于文件里的值。
3bf4bba2 版：`contracts.required` 列出 20 个键。SDK 只比对 pins 里的那些合约；`gTokenStaking`、`entryPoint`、`ownerSafe`、`multiSendCallOnly`、`evaluationCommunityToken` 只经过 schema 校验，内容交给 DVT 和 DSR 比对。
543f3498 版的变化：
- `roles` 只有 registry 和 timelockController 可以是对象，其余合约一律写 `n/a:…`；
- BLS、entryPoint、evaluationCommunityToken 新增了必填字段；
- timelockController 改为可选。

pins 文件里 timelock 的写法：顶层 `timelockController` 的值是地址时，转成 `addresses.timelockController` 纳入认证，于是它的 codehash 必须给出，读回里也必须有 `contracts.timelockController`；值是 `"n/a:none"` 时表示没有部署。
769e17d2 版只改了 x-readMethods 和示例：BLS 的 N 定义为 validatorAtSlot 里非零项的个数；thresholds 必须正好是 {WARNING, MINOR, MAJOR}，示例里分别是 2/3/3；SP 的校验器会拒绝任何形似 URL 的字符串。
