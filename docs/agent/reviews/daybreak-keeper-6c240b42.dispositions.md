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

## Codex gate on the round-1 fix (99766d3e), and its dispositions

Codex CLI (Tier 1, not the author of the change), read-only, diff 6c240b42..99766d3e. 95,521 tokens. Raw output kept
locally. Each finding checked against the code; same classes as above. DSR 2026-11-17: the two new Highs are fixed in
this round; one more Codex pass on this fix's diff only; Medium and below are written down rather than reopening a round.

| ID | Codex | Class | Disposition |
|---|---|---|---|
| R1 | High | (i) | Real: shutdown killed the cast in flight but the tick went on and could sign the other target. Now a stop flag is set synchronously, checked right before every cast spawn and viem `writeContract`; shutdown waits up to 15 s for the tick, and says "unknown state" instead of "stopped" if it does not finish or if a send was cut off (a terminated cast, a timed-out request). Tests on both paths |
| R2 | High | (i) | Real, older than this change, made mandatory by it: the readline prompt wrote the typed password before masking it. Now the readline output is muted while typing; EOF, Ctrl-C and an empty answer refuse. pty tests for pasted and byte-by-byte input |
| R3 | High | (ii) | FU-111 / KPR-001, to #447 |
| R4 | Medium | (i) | The fatal path printed the raw error object. Now every diagnostic goes through `scrub`: configured secrets (keeper key, Telegram token, RPC URL and its credential-like parts) redacted, URLs reduced, length bounded |
| R5 | Medium | (i) | A key-shaped value (64 hex, with or without 0x) in `--keystore` / `--cast-account` refuses, unechoed. Logging other signer argument values is FU-113 ① |
| R6 | Medium | (i) | The external price fetch deadline now covers the body; the body is capped at 64 KiB |
| R7 | Medium | (i) | Market monitoring failures are logged and no longer stop the refreshes |
| R8 | Medium | not fixed | A long SuperPaymaster confirmation delays the V4 decision; documented under Known Limitations (rescheduling confirmations is not a small change) |
| R9 | Medium | (i) | `--poll-interval` at most 86400 (a larger delay overflows Node's timer) |
| R10 | Medium | (i) | The send tests recover the signer from the broadcast bytes, with decoy deployer keys in the env |
| R11 | Medium | (ii) | KPR-013 / FU-113 ② (dry-run full-scenario test), not in this round |
| R12 | Medium | (ii) | FU-114. The guide no longer says "one more": the uncounted sends are not bounded by the keeper |
| R13 | Medium | not fixed | Per-gas ceiling only, no gas-limit or total-cost ceiling; documented. A spend ceiling belongs with FU-114 |
| R14 | Medium | split | Prompt EOF / Ctrl-C now refuse (with R2). The temp-file window before the handlers are installed: FU-114, documented |
| R15 | Medium | (ii) | FU-112 ② |
| R16 | Low | (i) | A disabled SuperPaymaster is not read |
| R17 | Low | (ii) | KPR-017, documented |
| R18 | Low | (i) | Every mainnet example and the built-in usage text now pass `--hard-max-fee-gwei` |

## Codex pass 2, on the fix diff only (99766d3e..41f124fa)

88,478 tokens; R2 judged closed. DSR 2026-11-18: F1 fixed this round; Medium and below written down (the small and
certain ones fixed); then Daybreak on the whole round's diff, then the PR, with no further local review round.

| ID | Codex | Class | Disposition |
|---|---|---|---|
| F1 | High | (i) | The stop check ran before viem's awaited preparation (gas estimate), so a signal during it could still be followed by a signature. The check now runs inside the local account's `signTransaction` (relies on viem 2.43.3's local-account path; re-check on upgrade). A send already signed when the signal arrives is treated as in flight: awaited, and named in the exit message if it was broadcast. Only a send refused by the check is known not sent. Test holds `eth_estimateGas`, signals, releases: no raw transaction |
| F2 | Medium | (i) | External price body read incrementally, cancelled past 64 KiB of bytes; test with a 70 KB body |
| F3 | Medium | (i) | Key-shaped signer arguments matched case-insensitively (`0X…`), the `0x` address check too |
| F4 | Medium | (i) | RPC user info registered encoded and decoded; password at any length, user name from 4 characters; components decoded independently |
| F5 | Medium | (i), untested | Telegram failure diagnostics go through `scrub`. Not covered by a test: exercising it would need a reachable Telegram endpoint |
| F6 | Low | (i) | The fake RPC echoes the key outside URL syntax, so the end-to-end test needs `scrub`, not just URL reduction |
