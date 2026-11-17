# Daybreak review: price keeper @ 6c240b42 (raw report)

- Commit reviewed: `6c240b42653af2405dd60531f7686a029e69e683` (main), fresh detached worktree, read-only sandbox, static only.
- Command: `codex exec -C <worktree> -s read-only -m gpt-daybreak-blue-latest --cyber-access-program daybreak_blue "<prompt>" </dev/null` (codex-cli 0.166.0, 2026-11-17). Tokens used: 112,021. No quota / rate-limit error.
- The text below is the model's final answer verbatim (including its addendum), with nothing removed. Links point into the temporary review worktree. Dispositions are in the verification table, not here.

---

Reviewed commit `6c240b42653af2405dd60531f7686a029e69e683` statically. I found no Critical issue, but nine High-severity issues. Both independent adversarial reviewers agreed on the main signer, chain, child-environment, fee, and concurrency findings.

No tests or network/RPC operations were run, per scope.

## Findings

### KPR-001 — High — Explicit privileged signers are still accepted

- **Location:** [keeperKey.ts:12](</private/tmp/claude-502/-Users-jason-Dev-aastar-aastar-sdk/890368e6-2f76-4b7e-9240-ed3913b76be1/scratchpad/daybreak-keeper/scripts/keeper/keeperKey.ts:12>), [keeperKey.ts:49](</private/tmp/claude-502/-Users-jason-Dev-aastar-aastar-sdk/890368e6-2f76-4b7e-9240-ed3913b76be1/scratchpad/daybreak-keeper/scripts/keeper/keeperKey.ts:49>)
- **What is wrong:** The resolved private key or cast account is not checked against deployer/owner/admin identities. The code explicitly acknowledges this.
- **Scenario:** `KEEPER_PRIVATE_KEY` contains the deployer key, or `--cast-account optimism-deployer` is supplied. The keeper accepts it and signs every update with the privileged account.
- **Fix:** Implement the FU-111 signer guard, including forbidden addresses derived locally from all loaded privileged-key variables. For cast, resolve the keystore address before any RPC and compare it. Recheck identity at send time to prevent keystore-file replacement.
- **Relation:** Directly FU-111; still open.

### KPR-002 — High — Mode-incompatible signer arguments can select a different signer than the operator named

- **Location:** [keeper.ts:264](</private/tmp/claude-502/-Users-jason-Dev-aastar-aastar-sdk/890368e6-2f76-4b7e-9240-ed3913b76be1/scratchpad/daybreak-keeper/scripts/keeper.ts:264>), [keeperKey.ts:49](</private/tmp/claude-502/-Users-jason-Dev-aastar-aastar-sdk/890368e6-2f76-4b7e-9240-ed3913b76be1/scratchpad/daybreak-keeper/scripts/keeper/keeperKey.ts:49>), [keeperKey.ts:145](</private/tmp/claude-502/-Users-jason-Dev-aastar-aastar-sdk/890368e6-2f76-4b7e-9240-ed3913b76be1/scratchpad/daybreak-keeper/scripts/keeper/keeperKey.ts:145>)
- **What is wrong:** Only `--keystore` implies cast mode. `--cast-account` alone does not. Private-key mode silently ignores both cast signer arguments. Cast mode also accepts both cast signer sources and silently makes `--keystore` win.
- **Scenario:** An operator runs `--cast-account keeper` without `--mode cast` while an ambient `KEEPER_PRIVATE_KEY` exists. The named cast account is ignored and the environment key signs. Likewise, `--mode privateKey --keystore keeper.json` ignores the explicit keystore.
- **Fix:** Enforce a signer-selection matrix:

  - infer cast from either cast signer argument, or require an explicit mode;
  - reject cast-only arguments in private-key mode;
  - reject `KEEPER_PRIVATE_KEY` as a cast signer source;
  - reject simultaneous `--keystore` and `--cast-account`.

- **Relation:** Makes FU-111’s “explicit signer” premise worse. The dual-cast-source case is related to FU-112(⑤e), but remains possible through direct invocation.

### KPR-003 — High — Legacy OP env file silently overrides the documented env file

- **Location:** [keeper.ts:287](</private/tmp/claude-502/-Users-jason-Dev-aastar-aastar-sdk/890368e6-2f76-4b7e-9240-ed3913b76be1/scratchpad/daybreak-keeper/scripts/keeper.ts:287>), [keeper.md:77](</private/tmp/claude-502/-Users-jason-Dev-aastar-aastar-sdk/890368e6-2f76-4b7e-9240-ed3913b76be1/scratchpad/daybreak-keeper/docs/guide/keeper.md:77>)
- **What is wrong:** OP mainnet loads `.env.optimism` before `.env.op-mainnet`. Dotenv does not override an already populated variable by default, so the legacy file wins, contrary to the documentation’s `.env.<network>` contract.
- **Scenario:** `.env.optimism` contains an old deployer `KEEPER_PRIVATE_KEY`, while `.env.op-mainnet` contains the intended dedicated keeper key. The old deployer key silently wins. The same applies to RPC URL, cast password and Telegram credentials.
- **Fix:** Load one canonical file, or parse files independently and refuse conflicting security-sensitive values. If compatibility is required, make precedence explicit and log only the source filename, never values.
- **Relation:** FU-111-related and worse than the stated “explicitly supplied signer” premise.

### KPR-004 — High — Every loaded secret is inherited by `cast`

- **Location:** [keeper.ts:224](</private/tmp/claude-502/-Users-jason-Dev-aastar-aastar-sdk/890368e6-2f76-4b7e-9240-ed3913b76be1/scratchpad/daybreak-keeper/scripts/keeper.ts:224>)
- **What is wrong:** `spawn('cast', …)` does not supply an `env`, so the child inherits the complete environment after dotenv loading.
- **Scenario:** A cast-mode keeper has `KEEPER_PRIVATE_KEY`, deployer keys, `TEST_PRIVATE_KEY`, `CAST_KEYSTORE_PASSWORD`, and the Telegram token in its environment. Every `cast send` receives all of them, even though only the password file and selected account are needed. A compromised or PATH-shadowed `cast` can read them directly.
- **Fix:** Use an absolute, trusted cast executable and an allowlisted child environment containing only required non-secret variables. Remove key/password/Telegram variables. Prefer a protected FD or stdin mechanism for secrets.
- **Relation:** New; adjacent to FU-112’s missing send-boundary tests.

### KPR-005 — High — Cast transactions are not bound to the configured chain

- **Location:** [keeper.ts:340](</private/tmp/claude-502/-Users-jason-Dev-aastar-aastar-sdk/890368e6-2f76-4b7e-9240-ed3913b76be1/scratchpad/daybreak-keeper/scripts/keeper.ts:340>), [keeper.ts:209](</private/tmp/claude-502/-Users-jason-Dev-aastar-aastar-sdk/890368e6-2f76-4b7e-9240-ed3913b76be1/scratchpad/daybreak-keeper/scripts/keeper.ts:209>)
- **What is wrong:** No code compares the RPC’s `eth_chainId` with `config.chain.id`. The cast command receives only `--rpc-url`; no expected chain is enforced.
- **Scenario:** `run-keeper-main.sh` says OP mainnet, but `RPC_URL` points to another chain where matching addresses expose compatible read methods. The reads succeed, and cast signs and broadcasts `updatePrice()` on that other chain.
- **Fix:** After local signer validation and before password prompting or other RPC reads, fetch chain ID and require exact equality. Repeat immediately before cast sending, and pass the expected chain to cast if supported.
- **Relation:** New.

### KPR-006 — High — `--max-base-fee-gwei` is not a transaction fee or spend cap

- **Location:** [keeper.ts:647](</private/tmp/claude-502/-Users-jason-Dev-aastar-aastar-sdk/890368e6-2f76-4b7e-9240-ed3913b76be1/scratchpad/daybreak-keeper/scripts/keeper.ts:647>), [keeper.ts:782](</private/tmp/claude-502/-Users-jason-Dev-aastar-aastar-sdk/890368e6-2f76-4b7e-9240-ed3913b76be1/scratchpad/daybreak-keeper/scripts/keeper.ts:782>), [keeper.ts:799](</private/tmp/claude-502/-Users-jason-Dev-aastar-aastar-sdk/890368e6-2f76-4b7e-9240-ed3913b76be1/scratchpad/daybreak-keeper/scripts/keeper.ts:799>), [keeper.ts:753](</private/tmp/claude-502/-Users-jason-Dev-aastar-aastar-sdk/890368e6-2f76-4b7e-9240-ed3913b76be1/scratchpad/daybreak-keeper/scripts/keeper.ts:753>)
- **What is wrong:** The value checks only the latest block’s base fee. It is deliberately bypassed within 180 seconds of expiry. Cast then uses uncapped `eth_gasPrice`; the private-key path supplies no fee, gas-unit, or total-cost bound.
- **Scenario:** Base fee exceeds the configured value near expiry, so the bypass signs anyway. Alternatively, base fee passes the check but the selected priority/gas price or estimated gas is excessive. The supposed cap does not limit signer expenditure.
- **Fix:** Enforce hard `maxFeePerGas`, priority-fee, gas-limit, and total-cost ceilings in both send modes. Any expiry override should be separate, explicit, and still subject to an absolute ceiling.
- **Relation:** New.

### KPR-007 — High — Daily spend control is volatile, per-process, and bypassable after ambiguous broadcasts

- **Location:** [keeper.ts:472](</private/tmp/claude-502/-Users-jason-Dev-aastar-aastar-sdk/890368e6-2f76-4b7e-9240-ed3913b76be1/scratchpad/daybreak-keeper/scripts/keeper.ts:472>), [keeper.ts:223](</private/tmp/claude-502/-Users-jason-Dev-aastar-aastar-sdk/890368e6-2f76-4b7e-9240-ed3913b76be1/scratchpad/daybreak-keeper/scripts/keeper.ts:223>), [keeper.ts:801](</private/tmp/claude-502/-Users-jason-Dev-aastar-aastar-sdk/890368e6-2f76-4b7e-9240-ed3913b76be1/scratchpad/daybreak-keeper/scripts/keeper.ts:801>), [keeper.ts:983](</private/tmp/claude-502/-Users-jason-Dev-aastar-aastar-sdk/890368e6-2f76-4b7e-9240-ed3913b76be1/scratchpad/daybreak-keeper/scripts/keeper.ts:983>)
- **What is wrong:** The update count exists only in memory, resets on restart, and is independent in every process. It increments only after the send call returns a hash.
- **Scenario:** The node accepts a transaction but the response is lost, or cast is killed after broadcasting. The counter is not incremented; the next tick retries. Restarting—or running both launchers—resets/duplicates the budget and can create nonce conflicts or redundant updates.
- **Fix:** Add a singleton lock keyed by chain and signer; durably reserve attempts before broadcast; persist sender, nonce and hash; reconcile pending transactions/state before retrying; define an explicit replacement policy and a shared daily budget.
- **Relation:** New.

### KPR-008 — High — Shutdown can report “stopped” while a cast child continues broadcasting

- **Location:** [keeper.ts:223](</private/tmp/claude-502/-Users-jason-Dev-aastar-aastar-sdk/890368e6-2f76-4b7e-9240-ed3913b76be1/scratchpad/daybreak-keeper/scripts/keeper.ts:223>), [keeper.ts:538](</private/tmp/claude-502/-Users-jason-Dev-aastar-aastar-sdk/890368e6-2f76-4b7e-9240-ed3913b76be1/scratchpad/daybreak-keeper/scripts/keeper.ts:538>), [run-keeper-main.sh:26](</private/tmp/claude-502/-Users-jason-Dev-aastar-aastar-sdk/890368e6-2f76-4b7e-9240-ed3913b76be1/scratchpad/daybreak-keeper/run-keeper-main.sh:26>)
- **What is wrong:** The active cast child is not retained by the outer keeper. SIGINT/SIGTERM cleanup calls `process.exit()` without terminating or awaiting it. The mainnet launcher also lacks `exec`, unlike `run-keeper.sh`.
- **Scenario:** SIGTERM arrives during `cast send`. The keeper sends a stopped notice, removes the password file, and exits, while cast survives long enough to broadcast. A supervisor restart can then launch another keeper.
- **Fix:** Track the active child, stop accepting work, terminate its process group, await exit, then clean up. Use `exec pnpm …` in `run-keeper-main.sh`, plus the keeper-level singleton lock.
- **Relation:** New.

### KPR-009 — High — Strict argv parsing does not prevent downstream private-key disclosure

- **Location:** [paymasterResolver.ts:70](</private/tmp/claude-502/-Users-jason-Dev-aastar-aastar-sdk/890368e6-2f76-4b7e-9240-ed3913b76be1/scratchpad/daybreak-keeper/scripts/keeper/paymasterResolver.ts:70>), [keeper.ts:391](</private/tmp/claude-502/-Users-jason-Dev-aastar-aastar-sdk/890368e6-2f76-4b7e-9240-ed3913b76be1/scratchpad/daybreak-keeper/scripts/keeper.ts:391>), [paymasterResolver.ts:232](</private/tmp/claude-502/-Users-jason-Dev-aastar-aastar-sdk/890368e6-2f76-4b7e-9240-ed3913b76be1/scratchpad/daybreak-keeper/scripts/keeper/paymasterResolver.ts:232>), [keeper.ts:301](</private/tmp/claude-502/-Users-jason-Dev-aastar-aastar-sdk/890368e6-2f76-4b7e-9240-ed3913b76be1/scratchpad/daybreak-keeper/scripts/keeper.ts:301>)
- **What is wrong:** Values are accepted without type validation and later embedded in logs/errors. In particular, the resolver always includes the raw candidate in `getBytecode(${address})`. Keystore/account values are also logged.
- **Scenario:** A private key is accidentally pasted after `--paymaster`. It reaches `getBytecode`, is embedded verbatim in the transient error, printed during initialization and every tick, and may later be included in the unresolved-paymaster Telegram alert as `candidate=…`. Similar surfaces exist for network, numeric, keystore, super-paymaster, operator, and invalid chat-ID values.
- **Fix:** Validate and canonicalize every value locally before use: network enum, address length/checksum, bounded integers, safe URL, safe account name. Use fixed non-echoing errors and structured redacted logging. Never put the raw configured candidate into alerts.
- **Relation:** Extends FU-113 substantially; that follow-up omits address arguments and their Telegram path.

### KPR-010 — Medium — Startup refusal boundary is still crossed before fee and cast-password validation

- **Location:** [keeper.ts:384](</private/tmp/claude-502/-Users-jason-Dev-aastar-aastar-sdk/890368e6-2f76-4b7e-9240-ed3913b76be1/scratchpad/daybreak-keeper/scripts/keeper.ts:384>), [keeper.ts:389](</private/tmp/claude-502/-Users-jason-Dev-aastar-aastar-sdk/890368e6-2f76-4b7e-9240-ed3913b76be1/scratchpad/daybreak-keeper/scripts/keeper.ts:389>), [keeper.ts:452](</private/tmp/claude-502/-Users-jason-Dev-aastar-aastar-sdk/890368e6-2f76-4b7e-9240-ed3913b76be1/scratchpad/daybreak-keeper/scripts/keeper.ts:452>), [keeper.ts:651](</private/tmp/claude-502/-Users-jason-Dev-aastar-aastar-sdk/890368e6-2f76-4b7e-9240-ed3913b76be1/scratchpad/daybreak-keeper/scripts/keeper.ts:651>)
- **What is wrong:** `startupPhase` is cleared before initial RPC reads and before cast password initialization. The fee value is converted only inside the first tick.
- **Scenario:** Invalid fee input or a noninteractive cast password failure occurs only after RPC activity and is treated as a runtime/fatal error eligible for Telegram. A no-stdin cast invocation still has no explicit TTY/EOF refusal.
- **Fix:** Parse all numeric values, validate stdin/password availability, create required local resources, and only then clear `startupPhase` and perform the chain-ID request.
- **Relation:** Directly FU-112(①, ⑤d).

### KPR-011 — Medium — `--once` exits successfully after a failed tick

- **Location:** [keeper.ts:983](</private/tmp/claude-502/-Users-jason-Dev-aastar-aastar-sdk/890368e6-2f76-4b7e-9240-ed3913b76be1/scratchpad/daybreak-keeper/scripts/keeper.ts:983>)
- **What is wrong:** Tick exceptions are swallowed; `--once` then breaks and returns exit status zero.
- **Scenario:** RPC or transaction submission fails. A scheduler sees successful completion even though neither target was refreshed.
- **Fix:** In once mode, propagate the tick failure or set a nonzero exit status after bounded notification/cleanup.
- **Relation:** New.

### KPR-012 — Medium — Numeric domains permit cap bypasses and tight loops

- **Location:** [keeper.ts:265](</private/tmp/claude-502/-Users-jason-Dev-aastar-aastar-sdk/890368e6-2f76-4b7e-9240-ed3913b76be1/scratchpad/daybreak-keeper/scripts/keeper.ts:265>), [keeper.ts:267](</private/tmp/claude-502/-Users-jason-Dev-aastar-aastar-sdk/890368e6-2f76-4b7e-9240-ed3913b76be1/scratchpad/daybreak-keeper/scripts/keeper.ts:267>), [keeper.ts:787](</private/tmp/claude-502/-Users-jason-Dev-aastar-aastar-sdk/890368e6-2f76-4b7e-9240-ed3913b76be1/scratchpad/daybreak-keeper/scripts/keeper.ts:787>), [keeper.ts:997](</private/tmp/claude-502/-Users-jason-Dev-aastar-aastar-sdk/890368e6-2f76-4b7e-9240-ed3913b76be1/scratchpad/daybreak-keeper/scripts/keeper.ts:997>)
- **What is wrong:** `maxUpdatesPerDay` uses unrestricted `Number()`. `NaN` and `Infinity` make the limit ineffective; fractional values have surprising semantics. Zero poll/cooldown/health intervals can cause tight loops or alert storms.
- **Scenario:** `--max-updates-per-day Infinity --poll-interval 0` is accepted. The daily comparison never blocks, and the loop runs continuously.
- **Fix:** Require finite nonnegative integers with sensible upper/lower bounds, using option-specific non-echoing errors.
- **Relation:** FU-112/FU-113-related.

### KPR-013 — Medium — Dry-run/send-boundary testing remains ineffective, although FU-113’s wording is stale

- **Location:** [keeper.e2e.test.ts:140](</private/tmp/claude-502/-Users-jason-Dev-aastar-aastar-sdk/890368e6-2f76-4b7e-9240-ed3913b76be1/scratchpad/daybreak-keeper/scripts/keeper/keeper.e2e.test.ts:140>), [keeper.e2e.test.ts:122](</private/tmp/claude-502/-Users-jason-Dev-aastar-aastar-sdk/890368e6-2f76-4b7e-9240-ed3913b76be1/scratchpad/daybreak-keeper/scripts/keeper/keeper.e2e.test.ts:122>)
- **What is wrong:** The current E2E now reaches a Paymaster update decision, so FU-113’s claim that no test reaches a decision is no longer literally true. However, it kills the process as soon as the pre-send action log appears and never asserts absence of `eth_sendRawTransaction` or cast invocation. It does not trigger the SuperPaymaster update path.
- **Scenario:** Delete the dry-run return immediately after the action log. The test can still observe its success predicate and kill the child before detecting or asserting the send.
- **Fix:** Complete a full `--once --dry-run`, make both targets require updates, record every RPC method and subprocess call, and assert no send/cast occurred. Add live controlled private-key sender recovery and fake-cast argument capture.
- **Relation:** FU-112(③)/FU-113(②) remain open; only FU-113’s exact rationale is stale.

### KPR-014 — Medium — The no-egress guard retains all documented bypasses and does not protect the full E2E

- **Location:** [no-egress.preload.mjs:20](</private/tmp/claude-502/-Users-jason-Dev-aastar-aastar-sdk/890368e6-2f76-4b7e-9240-ed3913b76be1/scratchpad/daybreak-keeper/scripts/keeper/no-egress.preload.mjs:20>), [no-egress.preload.mjs:66](</private/tmp/claude-502/-Users-jason-Dev-aastar-aastar-sdk/890368e6-2f76-4b7e-9240-ed3913b76be1/scratchpad/daybreak-keeper/scripts/keeper/no-egress.preload.mjs:66>), [no-egress.preload.mjs:68](</private/tmp/claude-502/-Users-jason-Dev-aastar-aastar-sdk/890368e6-2f76-4b7e-9240-ed3913b76be1/scratchpad/daybreak-keeper/scripts/keeper/no-egress.preload.mjs:68>), [keeper.e2e.test.ts:107](</private/tmp/claude-502/-Users-jason-Dev-aastar-aastar-sdk/890368e6-2f76-4b7e-9240-ed3913b76be1/scratchpad/daybreak-keeper/scripts/keeper/keeper.e2e.test.ts:107>)
- **What is wrong:** It still permits localhost DNS, does not replace the UDP constructor, allows arbitrary Node/fork children without forcing preload inheritance, does not guard workers, allows `::1`, and accepts any Unix path matching the broad tsx regex. The full decision E2E does not install the preload at all.
- **Scenario:** Code under test starts a Node child with an empty environment, a worker with `execArgv: []`, or a UDP socket via the constructor. The test can egress while the guard self-test remains green.
- **Fix:** Use OS-level network isolation. If retaining the preload, block all DNS, UDP constructors, workers and unguarded children, and allow only the exact test server address and exact tsx IPC path.
- **Relation:** Directly FU-112(②).

### KPR-015 — Medium — Plaintext cast password survives hard crashes

- **Location:** [keeper.ts:465](</private/tmp/claude-502/-Users-jason-Dev-aastar-aastar-sdk/890368e6-2f76-4b7e-9240-ed3913b76be1/scratchpad/daybreak-keeper/scripts/keeper.ts:465>), [keeper.ts:483](</private/tmp/claude-502/-Users-jason-Dev-aastar-aastar-sdk/890368e6-2f76-4b7e-9240-ed3913b76be1/scratchpad/daybreak-keeper/scripts/keeper.ts:483>)
- **What is wrong:** The password is written to a reusable temporary file. Mode `0600` is appropriate, but cleanup exists only for cooperative normal/signal paths.
- **Scenario:** SIGKILL, power loss or runtime crash leaves `/tmp/aastar-keeper-*/pw` indefinitely.
- **Fix:** Prefer an inherited FD/pipe or OS keystore integration. Otherwise remove stale keeper directories safely at startup and minimize the file lifetime.
- **Relation:** New.

### KPR-016 — Medium — One target’s failure can indefinitely starve the other

- **Location:** [keeper.ts:660](</private/tmp/claude-502/-Users-jason-Dev-aastar-aastar-sdk/890368e6-2f76-4b7e-9240-ed3913b76be1/scratchpad/daybreak-keeper/scripts/keeper.ts:660>), [keeper.ts:491](</private/tmp/claude-502/-Users-jason-Dev-aastar-aastar-sdk/890368e6-2f76-4b7e-9240-ed3913b76be1/scratchpad/daybreak-keeper/scripts/keeper.ts:491>), [keeper.ts:950](</private/tmp/claude-502/-Users-jason-Dev-aastar-aastar-sdk/890368e6-2f76-4b7e-9240-ed3913b76be1/scratchpad/daybreak-keeper/scripts/keeper.ts:950>), [keeper.md:9](</private/tmp/claude-502/-Users-jason-Dev-aastar-aastar-sdk/890368e6-2f76-4b7e-9240-ed3913b76be1/scratchpad/daybreak-keeper/docs/guide/keeper.md:9>)
- **What is wrong:** Shared SuperPaymaster reads happen before either refresh, and `refreshSuper()` runs before `refreshPaymaster()`. A Super failure aborts the tick. A broadcast may also wait up to roughly twenty minutes before Paymaster processing.
- **Scenario:** SuperPaymaster consistently reverts its cache read or receipt polling stalls. Paymaster resolution still occurs, but its price update never executes and it eventually becomes stale, contrary to the documented independent handling.
- **Fix:** Isolate per-target errors and confirmation state. Process both decisions every tick; serialize only the actual nonce-sensitive submissions.
- **Relation:** New.

### KPR-017 — Medium — Bootstrap updates ignore Chainlink validity/freshness

- **Location:** [keeper.ts:761](</private/tmp/claude-502/-Users-jason-Dev-aastar-aastar-sdk/890368e6-2f76-4b7e-9240-ed3913b76be1/scratchpad/daybreak-keeper/scripts/keeper.ts:761>), [keeper.ts:884](</private/tmp/claude-502/-Users-jason-Dev-aastar-aastar-sdk/890368e6-2f76-4b7e-9240-ed3913b76be1/scratchpad/daybreak-keeper/scripts/keeper.ts:884>), [keeper.md:14](</private/tmp/claude-502/-Users-jason-Dev-aastar-aastar-sdk/890368e6-2f76-4b7e-9240-ed3913b76be1/scratchpad/daybreak-keeper/docs/guide/keeper.md:14>)
- **What is wrong:** `cachedUpdatedAt === 0` makes `shouldUpdate` true without requiring a nonzero, fresh Chainlink round.
- **Scenario:** The cache is empty while the feed returns a zero or stale timestamp. The keeper still spends gas calling `updatePrice`; depending on the contract, it either reverts repeatedly or records stale data.
- **Fix:** Apply feed validity, freshness, positive-answer, and round-consistency checks to bootstrap updates too.
- **Relation:** New.

### KPR-018 — Medium — RPC credentials and raw cast errors can reach logs and Telegram

- **Location:** [keeper.ts:210](</private/tmp/claude-502/-Users-jason-Dev-aastar-aastar-sdk/890368e6-2f76-4b7e-9240-ed3913b76be1/scratchpad/daybreak-keeper/scripts/keeper.ts:210>), [keeper.ts:249](</private/tmp/claude-502/-Users-jason-Dev-aastar-aastar-sdk/890368e6-2f76-4b7e-9240-ed3913b76be1/scratchpad/daybreak-keeper/scripts/keeper.ts:249>), [keeper.ts:400](</private/tmp/claude-502/-Users-jason-Dev-aastar-aastar-sdk/890368e6-2f76-4b7e-9240-ed3913b76be1/scratchpad/daybreak-keeper/scripts/keeper.ts:400>), [keeper.ts:987](</private/tmp/claude-502/-Users-jason-Dev-aastar-aastar-sdk/890368e6-2f76-4b7e-9240-ed3913b76be1/scratchpad/daybreak-keeper/scripts/keeper.ts:987>)
- **What is wrong:** The full RPC URL is logged and placed in cast’s argv. Cast stdout/stderr is converted into an error that is later printed and sent to Telegram.
- **Scenario:** An RPC URL embeds an API key or basic-auth credentials. It becomes visible in logs and the OS process list; cast-produced error text can be forwarded externally.
- **Fix:** Redact URL credentials/query tokens, avoid placing credential-bearing URLs in argv, and map child failures to fixed safe error codes before logging or notifying.
- **Relation:** Broader form of FU-113.

### KPR-019 — Low — Documentation unnecessarily requests `TEST_PRIVATE_KEY`

- **Location:** [keeper.md:79](</private/tmp/claude-502/-Users-jason-Dev-aastar-aastar-sdk/890368e6-2f76-4b7e-9240-ed3913b76be1/scratchpad/daybreak-keeper/docs/guide/keeper.md:79>), [config.ts:120](</private/tmp/claude-502/-Users-jason-Dev-aastar-aastar-sdk/890368e6-2f76-4b7e-9240-ed3913b76be1/scratchpad/daybreak-keeper/tests/regression/config.ts:120>)
- **What is wrong:** The guide calls `TEST_PRIVATE_KEY` required, while the imported loader explicitly treats it as optional and defaults it.
- **Scenario:** An operator unnecessarily places another private key in the long-running keeper environment; cast then inherits it because of KPR-004.
- **Fix:** Remove the requirement and stop importing a regression-test configuration loader into production keeper code.
- **Relation:** Adjacent to FU-112/FU-113 secret-minimization concerns.

## Checked and found sound

- Unknown options, lookalikes, duplicates, positional arguments, missing values and `--flag=value` are rejected; `--dry-run=true` no longer becomes a live run.
- Private-key mode does not fall back to `PRIVATE_KEY` or `PRIVATE_KEY_SUPPLIER`; cast mode does not fall back to `DEPLOYER_ACCOUNT`.
- Both current update sites contain explicit dry-run returns.
- The sent function selector is fixed to `updatePrice()`; no arbitrary function/calldata input exists.
- `run-keeper-main.sh` has no default deployer account and rejects caller overrides of its fixed network/mode/signer flags.
- Paymaster transient resolution failures are retried and distinguished from confirmed absence.
- The password itself is not placed in cast argv, and its temporary file is created with mode `0600`.
- The no-egress preload accurately labels itself as a test-process guard rather than OS-level isolation, even though its residual bypasses remain material.
codex
Addendum to the review:

### KPR-020 — Medium — Reverted transactions are reported as confirmed updates

- **Location:** [keeper.ts:498](</private/tmp/claude-502/-Users-jason-Dev-aastar-aastar-sdk/890368e6-2f76-4b7e-9240-ed3913b76be1/scratchpad/daybreak-keeper/scripts/keeper.ts:498>), [keeper.ts:812](</private/tmp/claude-502/-Users-jason-Dev-aastar-aastar-sdk/890368e6-2f76-4b7e-9240-ed3913b76be1/scratchpad/daybreak-keeper/scripts/keeper.ts:812>), [keeper.ts:934](</private/tmp/claude-502/-Users-jason-Dev-aastar-aastar-sdk/890368e6-2f76-4b7e-9240-ed3913b76be1/scratchpad/daybreak-keeper/scripts/keeper.ts:934>)
- **What is wrong:** `waitForTransactionReceipt()`’s returned receipt is discarded. Any mined receipt—including `status: reverted`—returns `'receipt'`, after which the keeper logs `confirmed`, logs `updated`, and sends a successful broadcast notification.
- **Scenario:** `updatePrice()` reverts. Gas is spent, the cache remains stale, but monitoring reports confirmation. Subsequent ticks retry until the volatile update budget is exhausted.
- **Fix:** Require `receipt.status === 'success'`, then verify the cache advanced as expected. Treat a reverted receipt as a distinct failure and include it in retry/spend accounting.
- **Relation:** New; it compounds KPR-006/KPR-007’s spend and retry problems.

This raises the complete total to **20 findings: 0 Critical, 9 High, 10 Medium, and 1 Low**.
