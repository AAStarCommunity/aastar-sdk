# Follow-ups ledger（append-only · 永不删行 · 提交进仓库）

> pilot 的 review triage 把「真问题但不阻塞（B）」和延后项记在这里。
> 主线 task 全部完成后，由 `pilot run` 批量合成一个 cleanup PR 做掉，逐条标 [x] done=PR#n。
> `- [ ]`=OPEN，`- [x]`=DONE。GitHub PR comment 是永久兜底。

- [ ] FU-1 · B · src=dvt3-register.ts:65 · 2026-08-01 · Sepolia canonical.gToken (0x8d6Fe002…) 与 live validator registry 实际质押的 GToken (0x4c09aE57…) 不一致，dvt3-register.ts 里硬 pin 绕过；需查清哪个才是权威并收敛（涉及 CANONICAL_ADDRESSES / config.sepolia.json）
- [ ] FU-2 · B · src=PR#15 · 2026-08-01 · PR #15 已 APPROVE 但标题仍是 [WIP] feat(m14)，且 checks=none：确认它是要拆分合并、改标题后合并、还是关掉
- [ ] FU-3 · B · src=pilot status 2026-08-01 · 2026-08-01 · core.hooksPath 指向另一个 clone 的空 hooks 目录 (/Users/jason/Dev/mycelium/my-exploration/projects/aastar-sdk/.git/hooks) → 本工作副本的 pre-commit security-scan 实际未生效；应改回 .githooks
- [ ] FU-4 · B · src=security-scan.ts · 2026-08-01 · security-scan.ts 有 4 处历史误报（docs/onchain-evidence*.md 里的 P-256 公钥/tx hash、tests/.p256-*.last.md），全仓扫描恒红 → 启用 pre-commit 前需先降噪（收窄正则或加白名单），否则钩子一开就永远 BLOCKED
- [ ] FU-5 · B · src=PR#316 review (Codex PK) · 2026-08-02 · dvt3-register.ts 的 decryptEip2335 只做 NFKD normalize，没按 EIP-2335 全谱剥离 C0/C1/Delete 控制字符 → 密码含控制字符的合规 keystore 会 checksum mismatch。失败是 fail-closed（报错拒绝，不会用错密钥注册），故不阻塞；补一个 stripped 候选即可
- [ ] FU-6 · B · src=T3.1.1 · 2026-08-02 · 若要让三道 ABI 门禁真正进 CI：runner 需 checkout SuperPaymaster/airaccount-contract/mycelium-launch 并 forge build 出 out/，再置 REQUIRE_UPSTREAM=1。成本与私有仓访问权待评估，属独立 task 不属 T3.1.1
- [ ] FU-7 · B · src=CC-103 sync · 2026-08-18 · abi-sync 的 KNOWN_DRIFT 白名单（AAStarAirAccountV7 intentional-merge）掩盖了真实的上游新函数：enrollInCommitteeValidator/proposeGuardianAddition 缺失而门禁全绿。需要让 KNOWN_DRIFT 只跳过 SDK-extra 条目、仍报 upstream-only 缺失（与 #301/#302 name-collision 同类盲点）
- [ ] FU-8 · B · src=CC-103 · 2026-08-18 · airaccount-contract 只发布了 v0.31.0 的 4 个地址；canonical Sepolia AirAccount 栈有 11 个。要到齐全栈地址（extension/sessionKeyValidator/agentRegistry/forceExit/delegate/calldataParserRegistry…）才能把 canonical 整体升到 v0.31.0，届时删掉 COMMITTEE_STACK_ADDRESSES 这个过渡组
- [ ] FU-9 · B · src=CC-103 · 2026-08-18 · fetchCommitteeSigners 用 validator.getMerkleProof（证明的是 CURRENT root）。合约 NatSpec 明确要求生产环境对 FROZEN setRoot[e-1] 重建证明（从 SlotAssigned/SlotCleared 事件）。当前用 lastSetMutationBlock 做安全带；正式 aggregator 需实现冻结树重建
- [x] FU-10 · B · src=RELEASE §4 regression 2026-08-18 · 2026-08-18 · 既有失败（main 对照复现，与 CC-103 无关）：beta1-sponsored-gasless（paymaster 不接受赞助 UserOp，gas estimation failed）+ x402-direct-settle-e2e（settleX402PaymentDirect revert）。需各自定位是 env/deposit 还是真 bug · done=PR#319
- [x] FU-11 · A · src=RELEASE §4 regression 2026-08-18 · 2026-08-18 · tier3-composite-e2e 是 RELEASE-CHECKLIST 点名的强制 re-green runner（本次改了 T2/T3 编码器），因 dvt1/2/3 HTTP 530 无法执行。节点恢复后必须补跑并把结果记进 docs/onchain-evidence，才算发版门禁齐全 · done=PR#319
- [ ] FU-12 · B · src=CC-103 e2e · 2026-08-18 · core 有两份 DVT 节点清单：dvt.ts 的 DVT_CONFIG（AASTAR_DVT_ENV 可切）和 crypto/dvtNodes.ts 的 DEFAULT_DVT_NODES（不可切，getDefaultDvtNodes 恒返回公网隧道）。重复真相源，应收敛成一份
- [ ] FU-13 · B · src=CC-103 e2e · 2026-08-18 · dvt-realnode-e2e.ts 硬 pin EXPECTED_VERIFIER=0xAF525A16…（v0.20.0），而 canonical 自 v0.27.0 DVT-unification 起是 0x539B → 该 drift guard 恒抛。是有意的护栏，需人决定这个验收测试是跟随 canonical 重定向还是废弃，不该静默改
- [ ] FU-14 · B · src=CC-103 e2e · 2026-08-18 · v0.23.0-row10-handleops.ts 对本地节点仍 403 owner authorization required（ownerAuth 编码已修正）→ 该脚本用的账户与 tier3 不同，疑为账户侧 isValidOwnerAuth 缺失/owner 不匹配，待单独定位
