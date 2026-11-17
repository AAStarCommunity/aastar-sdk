# Daybreak rerun: keeper fix round 6c240b42..c7a88443 (raw report)

- Diff reviewed: `6c240b42653af2405dd60531f7686a029e69e683..c7a88443768935d4fbd35aa4ac5917ff06cd1d1b` (fix/keeper-daybreak-r1), read-only sandbox, static only.
- Command: `codex exec -C <worktree> -s read-only -m gpt-daybreak-blue-latest --cyber-access-program daybreak_blue "<prompt>" </dev/null` (codex-cli 0.166.0, 2026-11-18). Tokens used: 235,757. No quota / rate-limit error. Prompt: daybreak-keeper-r1-c7a88443.prompt.txt.
- The text below is the model's final answer verbatim, nothing removed. Dispositions: daybreak-keeper-6c240b42.dispositions.md.

---

Static review of `6c240b42..c7a88443` found five High, eleven Medium, and five Low findings. The exact private-key Sepolia deployment still starts, but its send path remains uncapped unless an additional hard-fee flag is supplied.

No tests or network/RPC operations were run.

## Findings

### KDR-001 — High

- **File:** `scripts/keeper/paymasterResolver.ts:39,62,70,84,226-234`; `scripts/keeper.ts:490-504,790-796`
- **What is wrong:** Paymaster-resolution errors bypass `scrub()`. Initial errors are printed through `paymasterInit`; later errors go directly to logs and Telegram. This contradicts the disposition that every diagnostic is scrubbed.
- **Scenario:** The exact deployment probes explicit `--paymaster` with `eth_getCode`. An RPC error such as `invalid API key <RPC credential>` is stored verbatim, printed, and eventually sent to Telegram.
- **Suggested fix:** Store structured resolver errors rather than provider text. Scrub resolver logs, initial status, and outgoing Telegram messages centrally. Add an E2E where `eth_getCode` echoes the RPC credential.
- **Relation:** Residual KPR-018 / Codex R4.

### KDR-002 — High

- **File:** `scripts/keeper.ts:36-42,643-680`
- **What is wrong:** `EPIPE` calls `process.exit(0)` immediately, bypassing the entire shutdown protocol.
- **Scenario:** A log collector closes stdout while `cast send` is active. The keeper exits successfully without setting `stopping`, terminating/awaiting cast, reporting the ambiguous send, or deleting the password directory. Cast can outlive it and broadcast.
- **Suggested fix:** Route broken-pipe handling through a write-safe central shutdown path; mark any active send unknown, terminate the child/process group, clean up, and exit nonzero.
- **Relation:** Residual KPR-008 / Codex R1. No test covers a broken pipe.

### KDR-003 — High

- **File:** `scripts/keeper/keeperKey.ts:13-14,47-78`; `scripts/keeper.ts:375-383`
- **What is wrong:** Explicit privileged signers remain accepted without identity checks.
- **Scenario:** `KEEPER_PRIVATE_KEY` is the deployer key, or `--cast-account optimism-deployer` is supplied. The keeper signs normally with that privileged identity.
- **Suggested fix:** Implement FU-111: derive forbidden addresses from loaded privileged keys, support `KEEPER_FORBIDDEN_SIGNERS`, resolve cast keystore identity locally before RPC, and recheck it at send time.
- **Relation:** Residual KPR-001 / open FU-111.

### KDR-004 — High

- **File:** `scripts/keeper.ts:361-378`; `scripts/keeper/keeperGuards.ts:48-62`
- **What is wrong:** Conflict detection compares env files only. Dotenv preserves a pre-existing process variable, so ambient `KEEPER_PRIVATE_KEY` or `RPC_URL` silently overrides every file without being compared.
- **Scenario:** A supervisor still exports an old deployer key while `.env.sepolia` contains the rotated keeper key. Startup reports no conflict and signs with the ambient deployer key.
- **Suggested fix:** Parse sources independently and refuse security-sensitive ambient-versus-file disagreement. Log source provenance without values.
- **Relation:** Residual KPR-003; the “fixed” disposition closes only file-versus-file precedence. The tests intentionally rely on ambient values winning.

### KDR-005 — High

- **File:** `scripts/keeper.ts:278-318,472-473`; `scripts/keeper/keeperGuards.ts:64-90`; `scripts/keeper/keeper.send.e2e.test.ts:200-218,389-415`
- **What is wrong:** Cast is still resolved from inherited `PATH`. It receives credential-bearing `ETH_RPC_URL`, `HOME`, and the password-file path. The prompted password is not registered in `knownSecrets`.
- **Scenario:** A shadow/wrapper `cast` earlier on `PATH` reads the RPC credential and password file, prints the password to stderr, and exits nonzero. The keeper incorporates that output into logs/Telegram, and cannot redact the password. The fake-cast test proves arbitrary PATH substitution.
- **Suggested fix:** Resolve and verify an absolute trusted executable; avoid putting RPC credentials in child environment; use a protected FD/stdin or an in-process sender; never forward raw child output, and register the password for redaction until cleanup.
- **Relation:** Residual KPR-004/KPR-018, Codex R4/R5, and FU-113①.

### KDR-006 — Medium

- **File:** `scripts/keeper.ts:379-380,924-931,964-971,1096-1103`; `scripts/keeper/keeper.send.e2e.test.ts:364-385`
- **What is wrong:** A hard fee ceiling is required only on mainnet names. The stated live Sepolia invocation has neither `maxFeePerGas`, a gas limit, nor a total-cost ceiling.
- **Scenario:** An erroneous or hostile RPC supplies an excessive fee estimate. The exact production form signs it. Its regression test keeps both caches fresh, so it never exercises a send and cannot detect this.
- **Suggested fix:** Require an explicit hard ceiling for every live run, plus gas and total-cost bounds, or require an explicit unsafe opt-out. Test the exact production invocation with an empty cache and decode its transaction.
- **Relation:** Residual KPR-006 / Codex R13 / FU-114.

### KDR-007 — Medium

- **File:** `scripts/keeper.ts:988-1014,1120-1146`; `docs/guide/keeper.md:28-29`
- **What is wrong:** The daily counter increments immediately after broadcast, before receipt status. Reverted and pending sends therefore count as updates despite the guide and disposition saying only successful receipts count.
- **Scenario:** Twenty-four transient reverts consume the daily budget. After the underlying issue clears, the keeper refuses all valid refreshes until its in-memory day rolls over.
- **Suggested fix:** Model attempts, broadcasts, mined successes, reverts, and pending transactions separately. Increment the documented update counter only after successful receipt/state confirmation, or rename and document it as an attempt budget.
- **Relation:** Residual KPR-020. The reverted-receipt test does not inspect accounting.

### KDR-008 — Medium

- **File:** `scripts/keeper.ts:315-319,991-1017,1123-1149`
- **What is wrong:** Cast exit zero with no parseable hash resolves to `''`, consumes the counter, and logs `updated`. A transaction still pending after the confirmation windows is also logged `updated`.
- **Scenario:** A cast output-format change or wrapper exits zero without sending. The operator is told the contract was updated with no hash or state evidence. Concurrent state advancement may also be attributed to this transaction.
- **Suggested fix:** Treat a missing hash as an ambiguous failure requiring reconciliation. Use `broadcast`, `pending`, and `confirmed` terminology; never print `updated` without verified state.
- **Relation:** Residual/partial closure of KPR-020.

### KDR-009 — Medium

- **File:** `scripts/keeper.ts:573-574,781-784,974-989,1106-1121`
- **What is wrong:** The send budget remains volatile and per process, with no singleton lock or durable reservation.
- **Scenario:** A broadcast response is lost while the cache remains stale. Every tick can send again without incrementing the counter. Restarting or running two keepers resets/duplicates the budget and can cause nonce conflicts or redundant transactions.
- **Suggested fix:** Add a chain-and-signer singleton lock and durable journal that reserves nonce/attempt before broadcast and reconciles pending transactions before retrying.
- **Relation:** Open FU-114 / KPR-007.

### KDR-010 — Medium

- **File:** `scripts/keeper.ts:474-485,487-570,683-684`
- **What is wrong:** Interactive password validation and temp-file initialization still occur after `eth_chainId`, Paymaster resolution, and threshold reads. Signal handlers are installed only after the password file exists.
- **Scenario:** EOF, Ctrl-C, or an empty password refuses only after several network requests. A signal during password-file creation uses default termination and can strand plaintext.
- **Suggested fix:** Prompt and create the protected resource before any request; install cleanup/signal handling before creating it. Prefer eliminating the password file.
- **Relation:** Residual KPR-010/FU-112① and KPR-015/FU-114. Current tests assert no cast invocation, not zero RPC requests.

### KDR-011 — Medium

- **File:** `tests/regression/config.ts:95-107,145-168`; `scripts/keeper.ts:391-437`
- **What is wrong:** The imported regression config loader logs raw address environment fallbacks before `knownSecrets` is initialized and returns them without keeper-local address validation.
- **Scenario:** A private key is accidentally assigned to `PRICE_FEED_ADDRESS` or another address variable. The loader prints it verbatim before the keeper can refuse or scrub it.
- **Suggested fix:** Use a keeper-specific configuration loader. Validate every address without echoing it and never log raw environment values.
- **Relation:** Residual KPR-009 / FU-113①; the disposition’s claim that env addresses are locally validated is false.

### KDR-012 — Medium

- **File:** `run-keeper.sh:22-23,75,87-90`
- **What is wrong:** The first positional network argument is logged before keeper-side validation.
- **Scenario:** An operator omits `sepolia` and accidentally passes a private key first. The script prints `keeper: network=<private key>` before `keeper.ts` can issue its non-echoing refusal.
- **Suggested fix:** Validate the shell network against a fixed allowlist before logging or forwarding it; never echo an invalid value.
- **Relation:** Residual KPR-009 / FU-113①.

### KDR-013 — Medium

- **File:** `scripts/keeper.ts:656-680`
- **What is wrong:** Explicit “send in an unknown state” shutdowns still unconditionally exit zero.
- **Scenario:** A supervisor sees successful termination after an interrupted/ambiguous broadcast and immediately restarts the keeper, potentially duplicating a pending transaction.
- **Suggested fix:** Use a distinct nonzero exit code for ambiguous send state. Reserve zero for a clean stop or a fully reported completed send.
- **Relation:** Residual KPR-008 / FU-114. Shutdown tests assert text but not exit status.

### KDR-014 — Medium

- **File:** `run-keeper-main.sh:27`; `run-keeper.sh:87`; `scripts/keeper/run-keeper.test.ts:145-157`
- **What is wrong:** `exec pnpm exec tsx` only replaces Bash with pnpm. It does not prove that a PID-targeted supervisor signal reaches the actual Node keeper.
- **Scenario:** A supervisor signals the recorded pnpm PID; pnpm exits without forwarding the signal to its child. Keeper and cast continue without setting `stopping`. The test replaces pnpm with a single-process shell program, so it cannot detect this.
- **Suggested fix:** Execute built JavaScript or Node with the pinned tsx loader directly, or implement/test explicit process-group signal forwarding using the real launcher chain.
- **Relation:** Residual KPR-008.

### KDR-015 — Medium

- **File:** `scripts/keeper/keeper.e2e.test.ts:100-152`; `scripts/keeper.ts:980-983,1112-1115`
- **What is wrong:** Dry-run’s no-send boundary remains untested. The test SIGKILLs as soon as the pre-send action log appears and never checks RPC methods for `eth_sendRawTransaction`.
- **Scenario:** Delete either dry-run return. The success predicate fires on the action log and kills the process in a race; the test can stay green despite a real send.
- **Suggested fix:** Run a complete `--once --dry-run` with both targets stale, await normal exit, and assert no raw-send RPC and no cast invocation.
- **Relation:** Residual KPR-013 / FU-113②.

### KDR-016 — Medium

- **File:** `scripts/keeper.ts:595-640,775-800,942-1121`; `docs/guide/keeper.md:141`
- **What is wrong:** PaymasterV4’s decision uses the tick-start time and block fee after SuperPaymaster confirmation can delay it by roughly twenty minutes.
- **Scenario:** SuperPaymaster remains pending through both waits. PaymasterV4 can expire meanwhile, while its decision and soft-fee gate still use stale time/base fee; an outdated low fee observation can authorize a later uncapped Sepolia send.
- **Suggested fix:** Refresh time and block/fee immediately before each target’s decision, or schedule target refreshes independently.
- **Relation:** Residual Codex R8, explicitly deferred.

### KDR-017 — Low

- **File:** `scripts/keeper/keeperGuards.ts:113-133`
- **What is wrong:** RPC path/query values shorter than eight characters are not registered as secrets; query handling records only decoded values, not raw encoded values.
- **Scenario:** `?apikey=abc123` or `?apikey=abc%40defgh` is echoed by the provider as a standalone value. `scrub()` leaves it in logs/Telegram.
- **Suggested fix:** Register both encoded and decoded credential components regardless of length, or replace provider diagnostics with fixed structured messages.
- **Relation:** Residual Codex R4/F4 / KPR-018.

### KDR-018 — Low

- **File:** `docs/api/_media/keeper.md:60,82-85`
- **What is wrong:** The generated operator-facing guide still instructs `--cast-account optimism-deployer`, documents a `PRIVATE_KEY_SUPPLIER` fallback, and describes environment password/default-account behavior that no longer exists.
- **Scenario:** An operator follows this copy instead of `docs/guide/keeper.md` and deliberately starts the keeper with the deployer signer.
- **Suggested fix:** Regenerate and review the published documentation before this fix ships.
- **Relation:** Open FU-112④.

### KDR-019 — Low

- **File:** `scripts/keeper/no-egress.preload.mjs:20-21,45-73`; `scripts/keeper/keeper.send.e2e.test.ts:388-518`
- **What is wrong:** The no-egress preload retains documented bypasses, and cast-mode E2Es do not install it.
- **Scenario:** A worker, child with a cleared environment, direct `dgram.Socket`, localhost DNS, or permitted-looking Unix socket can escape the test guard while tests remain green.
- **Suggested fix:** Use OS-level network isolation. Otherwise close the listed constructor/worker/subprocess/DNS/socket bypasses and apply the guard to every E2E.
- **Relation:** Residual KPR-014 / FU-112②.

### KDR-020 — Low

- **File:** `scripts/keeper.ts:339-347`
- **What is wrong:** Monitoring env fallbacks are parsed before `.env.<network>` is loaded, so file values for health, volatility, Chainlink staleness, and external price URL are silently ignored.
- **Scenario:** The operator configures alerting exclusively in `.env.sepolia`; the keeper uses defaults and may not perform the intended monitoring.
- **Suggested fix:** Load dotenv before parsing any env-backed option and add a source-precedence test.
- **Relation:** New premise gap; the exact production invocation is unaffected because it supplies these values on the CLI.

### KDR-021 — Low

- **File:** `scripts/keeper.ts:946-947,1076-1078`
- **What is wrong:** An empty cache still triggers a signed update without requiring a fresh, positive, internally consistent Chainlink round.
- **Scenario:** On bootstrap with a stale or malformed feed, the keeper signs `updatePrice()` solely because `cachedUpdatedAt === 0`.
- **Suggested fix:** Apply explicit feed validity/freshness checks to bootstrap, or verify and encode the contract’s exact acceptance guarantees.
- **Relation:** Residual KPR-017, explicitly deferred.

## Checked and found sound

- Strict argv parsing closes unknown/lookalike/repeated/`--flag=value` ambiguity.
- Cast/private-key mode selection now rejects ignored or dual signer sources.
- No fallback to `PRIVATE_KEY`, `PRIVATE_KEY_SUPPLIER`, or `DEPLOYER_ACCOUNT` remains.
- CLI network, numeric, gwei, and address validation is local and non-echoing.
- The private-key send test recovers the actual signer and verifies chain, target, selector, and hard max fee.
- Startup and pre-cast chain checks are meaningful.
- The delayed-estimate SIGTERM test demonstrates no private-key signature after shutdown begins.
- Reverted receipts fail `--once`, and one target’s failure no longer prevents attempting the other.
- Password input is no longer echoed byte-by-byte or when pasted.
- No arbitrary calldata/function selection path was found.
