# aoa-a7-readback/1

SP 读回文件的 JSON Schema（Draft 2020-12）和示例，**按原样**取自 SuperPaymaster 的
commit `61d30b82ed824bd8eecc9e4e7e5ff32579fdae99` 中 `docs/release/a7/` 下（经 GitHub API 按该 SHA 拉取）。

| 文件 | sha256 |
|---|---|
| `aoa-a7-readback-1.schema.json` | `584fd69707e3bd4df4a68e946a50691c029462ecdc66fee400ab6020e05c42a5` |
| `aoa-a7-readback-1.example.json`（fork） | `319e767788ab7efd2e64183ad52612a3585fd67f6ae3d133e588e7f21e8b06b0` |
| `aoa-a7-readback-1.live.example.json` | `d44a9e220231d986e6d641e78ef55b1f30b86f845efbe33b59d102bc215adfbb` |

schema 的 sha256 写死在 `scripts/sp550-readback-compare-core.ts` 里：schema 文件的哈希一旦对不上，比对工具就拒绝运行。示例里的值都是占位符，只用来测试 schema 校验本身。要改 schema，必须让 SP 先提交新版本，再同步更新这三处：这里的文件、本表中的哈希、代码里的常量。

上一版 schema（685ff69d，sha256 `d893b790…`）里，`header.anvilVersion` 的两个 `oneOf` 分支都能匹配 `"n/a:live"`，所以任何 live 读回文件都通不过校验。SDK 发现后经 DSR 转给 SP，SP 在 61d30b82 修正，并逐个复核了所有 `oneOf` 节点，没有发现其他重叠。
