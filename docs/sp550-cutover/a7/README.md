# aoa-a7-readback/1

SP 读回文件的 JSON Schema（Draft 2020-12）和示例，**按原样**取自 SuperPaymaster 的
commit `685ff69dde6e5d2434a74c55f48a72f5a8b66115` 中 `docs/release/a7/` 下（经 GitHub API 按该 SHA 拉取）。

| 文件 | sha256 |
|---|---|
| `aoa-a7-readback-1.schema.json` | `d893b790e6f4ba217c7d07966d2bbba30624410adcf19fe74f7c62ab3fdc8e32` |
| `aoa-a7-readback-1.example.json` | `319e767788ab7efd2e64183ad52612a3585fd67f6ae3d133e588e7f21e8b06b0` |

两者的 sha256 都写死在 `scripts/sp550-readback-compare-core.ts` 里：schema 文件的哈希一旦对不上，比对工具就拒绝运行。示例里的值都是占位符，只用来测试 schema 校验本身。要改 schema，必须让 SP 先提交新版本，再同步更新这三处：这里的文件、本表中的哈希、代码里的常量。
