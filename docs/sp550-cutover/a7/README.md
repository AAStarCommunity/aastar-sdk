# aoa-a7-readback/1

SP 读回文件的 JSON Schema（Draft 2020-12）和示例，**按原样**取自 SuperPaymaster 的
commit `2228c0b66aadb497966fea2ef0a83c2f41d8ba39`（已冻结：再改须经 DSR 验收并给出新哈希） 中 `docs/release/a7/` 下（经 GitHub API 按该 SHA 拉取）。

| 文件 | sha256 |
|---|---|
| `aoa-a7-readback-1.schema.json` | `fb25b34e51c90a53b7058f9f9ca225510e7fb75d7d940a4538b7459ddbeefff0` |
| `aoa-a7-readback-1.example.json`（fork） | `c58133b9f8dfe2317af96c6a9a43e7b2521900a69c591843f5c0afb6233b4812` |
| `aoa-a7-readback-1.live.example.json` | `61926c93fee774900765f9e9eca5d2dee44921d6191751929b18932d140e2b85` |

schema 的 sha256 写死在 `scripts/sp550-readback-compare-core.ts` 里：schema 文件的哈希一旦对不上，比对工具就拒绝运行。示例里的值都是占位符，只用来测试 schema 校验本身。要改 schema，必须让 SP 先提交新版本，再同步更新这三处：这里的文件、本表中的哈希、代码里的常量。

上一版 schema（685ff69d，sha256 `d893b790…`）里，`header.anvilVersion` 的两个 `oneOf` 分支都能匹配 `"n/a:live"`，所以任何 live 读回文件都通不过校验。SDK 发现后经 DSR 转给 SP，SP 在 61d30b82 修正，并逐个复核了所有 `oneOf` 节点，没有发现其他重叠。
2228c0b6 版又把 version 规则写进了 schema：spAdminExtension 和 xPNTsTokenV2Ext 的 version 必须是 null，其余合约不允许写 null。
