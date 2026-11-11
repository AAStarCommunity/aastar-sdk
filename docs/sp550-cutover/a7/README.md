# aoa-a7-readback/1

SP 读回文件的 JSON Schema（Draft 2020-12）和示例，**按原样**取自 SuperPaymaster 的
commit `be4912018365c73091108541ffb54dd7364e8481`（第 3 版）（已冻结：再改须经 DSR 验收并给出新哈希） 中 `docs/release/a7/` 下（经 GitHub API 按该 SHA 拉取）。

| 文件 | sha256 |
|---|---|
| `aoa-a7-readback-1.schema.json` | `c1a8dbd321fed1e85ebcf3f6b1ea46719aeb32e981ab1fc6577148f35fb98952` |
| `aoa-a7-readback-1.example.json`（fork） | `148224aa64140cdf287a60ee16fe8d0be7f8512657e6c4677bd55e339b455206` |
| `aoa-a7-readback-1.live.example.json` | `49c6492b73078d82aee0b5b454e65b82259107e7e568888a668731a93c602432` |

schema 的 sha256 写死在 `scripts/sp550-readback-compare-core.ts` 里：schema 文件的哈希一旦对不上，比对工具就拒绝运行。示例里的值都是占位符，只用来测试 schema 校验本身。要改 schema，必须让 SP 先提交新版本，再同步更新这三处：这里的文件、本表中的哈希、代码里的常量。

上一版 schema（685ff69d，sha256 `d893b790…`）里，`header.anvilVersion` 的两个 `oneOf` 分支都能匹配 `"n/a:live"`，所以任何 live 读回文件都通不过校验。SDK 发现后经 DSR 转给 SP，SP 在 61d30b82 修正，并逐个复核了所有 `oneOf` 节点，没有发现其他重叠。
2228c0b6 版又把 version 规则写进了 schema：spAdminExtension 和 xPNTsTokenV2Ext 的 version 必须是 null，其余合约不允许写 null。
第 3 版（be491201）改了两处：
- **probe 的判定规则**：改为 `estimateSimulate`（`eth_simulateV1`）的 gasUsed、fork 上 receipt 的 gasUsed、`expected.gasUsed` 三者相等，并且 `callAtGasUsed` 全部为 true。各家 estimate 只记录、不判定，因为 reth 的 estimate 会多留余量。
- **新增 `x-readMethods`**：逐字段写明读取方法。
