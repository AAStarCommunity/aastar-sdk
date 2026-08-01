# Follow-ups ledger（append-only · 永不删行 · 提交进仓库）

> pilot 的 review triage 把「真问题但不阻塞（B）」和延后项记在这里。
> 主线 task 全部完成后，由 `pilot run` 批量合成一个 cleanup PR 做掉，逐条标 [x] done=PR#n。
> `- [ ]`=OPEN，`- [x]`=DONE。GitHub PR comment 是永久兜底。

- [ ] FU-1 · B · src=dvt3-register.ts:65 · 2026-08-01 · Sepolia canonical.gToken (0x8d6Fe002…) 与 live validator registry 实际质押的 GToken (0x4c09aE57…) 不一致，dvt3-register.ts 里硬 pin 绕过；需查清哪个才是权威并收敛（涉及 CANONICAL_ADDRESSES / config.sepolia.json）
- [ ] FU-2 · B · src=PR#15 · 2026-08-01 · PR #15 已 APPROVE 但标题仍是 [WIP] feat(m14)，且 checks=none：确认它是要拆分合并、改标题后合并、还是关掉
- [ ] FU-3 · B · src=pilot status 2026-08-01 · 2026-08-01 · core.hooksPath 指向另一个 clone 的空 hooks 目录 (/Users/jason/Dev/mycelium/my-exploration/projects/aastar-sdk/.git/hooks) → 本工作副本的 pre-commit security-scan 实际未生效；应改回 .githooks
- [ ] FU-4 · B · src=security-scan.ts · 2026-08-01 · security-scan.ts 有 4 处历史误报（docs/onchain-evidence*.md 里的 P-256 公钥/tx hash、tests/.p256-*.last.md），全仓扫描恒红 → 启用 pre-commit 前需先降噪（收窄正则或加白名单），否则钩子一开就永远 BLOCKED
- [ ] FU-5 · B · src=PR#316 review (Codex PK) · 2026-08-02 · dvt3-register.ts 的 decryptEip2335 只做 NFKD normalize，没按 EIP-2335 全谱剥离 C0/C1/Delete 控制字符 → 密码含控制字符的合规 keystore 会 checksum mismatch。失败是 fail-closed（报错拒绝，不会用错密钥注册），故不阻塞；补一个 stripped 候选即可
