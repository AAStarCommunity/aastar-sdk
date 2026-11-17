# Daybreak keeper @ 6c240b42: dispositions, round 1

Raw report: [daybreak-keeper-6c240b42.md](daybreak-keeper-6c240b42.md). Every finding was checked against the code
at 6c240b42 before it was classified. Classes (DSR framework, 2026-11-17):
(i) real, with a small and certain fix, fixed in this round; (ii) a disclosed trade-off already ruled on;
(iii) does not hold. Severity is re-rated by consequence. Anything that signs or sends without the operator
knowing keeps its original level.

| ID | Reported | Re-rated | Class | Verified at 6c240b42 | Disposition |
|---|---|---|---|---|---|
| KPR-001 | High | High | (ii) | `keeperKey.ts` 12-13 says so itself | FU-111, to #447 |
| KPR-002 | High | High | (i) | `keeper.ts` 262: only `--keystore` implied cast; `--cast-account X` alone signed with `KEEPER_PRIVATE_KEY` | Either cast argument selects cast mode; privateKey mode with a cast argument refuses; `--keystore` with `--cast-account` refuses (DSR overrides FU-112 ⑤e) |
| KPR-003 | High | High | (i) | `keeper.ts` 287: `.env.optimism` loaded first; dotenv keeps the first value | Conflicting variables across the two files refuse, by name only |
| KPR-004 | High | Medium | (i) | `keeper.ts` 224: `spawn` without `env`. The signer arguments are explicit, so the environment cannot change the signer | Allowlisted child env; RPC URL via `ETH_RPC_URL` |
| KPR-005 | High | High | (i) | Cast path never compares `eth_chainId` (the viem path does, in `writeContract`) | `eth_chainId` checked at startup and before each cast send; `--chain <id>` passed to cast |
| KPR-006 | High | Medium | (i) after DSR ruling | Base-fee gate only, bypassed near expiry, no ceiling | `--hard-max-fee-gwei`: always applies, sent as max fee per gas on both paths, alert on skip, required live on mainnet networks |
| KPR-007 | High | Medium | (ii) by DSR ruling | Counter in memory, incremented after send returns | FU-114 (with the 11-14 pause of #446/#447); documented under Known Limitations |
| KPR-008 | High | Medium | (i) | `onExit` exits without the cast child; `run-keeper-main.sh` lacked `exec` | Shutdown terminates and awaits the in-flight cast first; `exec` in the launcher |
| KPR-009 | High | Medium | (i) | `paymasterResolver.ts` 70 puts the raw `--paymaster` value into an error that reaches logs and Telegram | Address options and env addresses validated locally, refusal without the value |
| KPR-010 | Medium | Medium | (ii) | | FU-112 ① |
| KPR-011 | Medium | Medium | (i) | Tick error is caught, then `break`, exit 0 | `--once` exits 1 after a failed tick |
| KPR-012 | Medium | Medium | (i) | `Number('abc')` is NaN, and `updatesToday >= NaN` is false: the daily cap disappears | Every number validated locally (closes the number part of FU-113 ①) |
| KPR-013 | Medium | Medium | (ii) | | FU-113 ② |
| KPR-014 | Medium | Medium | (ii) | | FU-112 ② |
| KPR-015 | Medium | Medium | split | `CAST_KEYSTORE_PASSWORD` read at `keeper.ts` 455 (author's rule: never in env); temp file survives SIGKILL | Env password removed in this round (the Mini runs privateKey mode, DSR checked); cast mode without a terminal refuses. Temp file: FU-114 |
| KPR-016 | Medium | Medium | (i) | `refreshSuper` throwing skipped `refreshPaymaster` | SuperPaymaster reads and each refresh isolated; failures reported together |
| KPR-017 | Medium | Low | not fixed (DSR) | Bootstrap sends without a freshness check; the contract reads the feed itself | Documented; the contract's behaviour has not been verified in this repository |
| KPR-018 | Medium | Medium | (i) | RPC URL logged in full and on cast's argv; raw cast output to Telegram | URL logged as scheme + host; via env to cast; child output scrubbed of URLs and truncated |
| KPR-019 | Low | Low | (i) | Guide marked `TEST_PRIVATE_KEY` required; the loader treats it as optional | Removed from the guide |
| KPR-020 | Medium | Medium | (i) | Receipt discarded; a reverted tx was logged as confirmed | Only `status: success` counts; reverted is logged, alerted and fails the tick |

Not counted as a finding, also changed: an invalid `TELEGRAM_CHAT_ID` is no longer echoed in its refusal.
