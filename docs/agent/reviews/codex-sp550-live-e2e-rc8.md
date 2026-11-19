# Codex Tier-1 review: SP 5.5.0 live E2E for the paper cells (supersedes #434)

`codex exec`, read-only sandbox, static, three rounds before the PR was opened, each over the whole diff. After round 2 DSR fixed the threat model (2026-11-19, in the script header): defended = honest misconfiguration, chain state changing between the read-back gate and a signature, SDK retry / estimate drift, assertions that must fail; not defended = an adversary controlling this process, a local RPC proxy or the local bundler; the last-check-to-inclusion upgrade race is a run precondition (48 h timelock), every live row records its check and inclusion blocks. Round 3's in-model High findings are fixed; its out-of-model findings are FU-125 / FU-126 with the reason they are outside the model. Round 3's fixes were not re-reviewed by Codex.

| Round | Critical | High | Medium | Low |
|---|---|---|---|---|
| 1 | 0 | 4 | 9 | 1 |
| 2 | 0 | 3 | 9 | 2 |
| 3 | 0 | 3 (2 in model, fixed; 1 out → FU-125) | 11 (10 in model, fixed; 1 out → FU-126) | 0 |

## Round 1

I would block live use on the High findings below. This was a static review of `origin/main...HEAD` and supporting code inside this worktree only. I did not execute tests or send transactions.

1. **High — Fork mode can send real transactions without `--live-go`.**  
   **Location:** `scripts/sp550-live-e2e.ts:113`, `:170`  
   Loopback is treated as proof of isolation. A localhost reverse proxy to Sepolia/mainnet, paired with a local bundler configured for that real network, passes these checks. The script then signs with the public mnemonic without requesting live authorization. Even the DeployLive path skips the Anvil check for loopback RPCs. The tests reject remote URLs but never exercise this case.  
   **Fix:** Require positive fork identification for every RPC regardless of hostname, verify fork metadata, and establish that the bundler uses that same fork. For strong isolation, use a distinct fork chain ID so its signed operations cannot be replayed on the source chain. A client-version string alone is not a security boundary.

2. **High — `executeGasless` silently signs with local constants and reports them as estimates.**  
   **Location:** `packages/sdk/src/clients/endUser.ts:295`  
   `PaymasterClient.estimateUserOperationGas()` returns `LOCAL_DEFAULT_LIMITS` when the endpoint returns `-32601` or a “Method not found” message (`packages/paymaster/src/V4/PaymasterClient.ts:599`). The new caller discards that provenance, scales the constants, labels them `estimate`, and proceeds to signing. This directly breaks invariant 5. The new tests cover a successful estimate and an absent URL, but not an endpoint that cannot estimate.  
   **Fix:** Expose and consume the detailed estimator result; reject fallback values for every field not explicitly supplied. Add a method-not-found test asserting zero signer calls and zero sends.

3. **High — Passing a historical read-back gate does not gate the implementation actually used for signing.**  
   **Location:** `scripts/sp550-live-e2e.ts:185`, `:210`  
   Live configuration accepts an arbitrary historical `gate.block`; even the default finalized snapshot trails current state. After passing it, the script reads current SP wiring and accepts any nonzero EntryPoint/Registry it returns without comparing those current values and implementation slots against the pins. An upgrade after the selected block—or during the password prompt and inter-cell waits—can therefore redirect execution after a successful gate.  
   **Fix:** Reject stale historical snapshots for live authorization, compare current implementation/code hashes and wiring with the gated values immediately before each signature, and abort on changes. Explicitly address the remaining inclusion-time upgrade race through contract-level constraints or an operational upgrade freeze; off-chain checks cannot eliminate it.

4. **High — The public-key exclusion is bypassed by mnemonic index 50.**  
   **Location:** `scripts/sp550-live-signer.ts:147`  
   Fork mode accepts arbitrary `anvilIndex`, while live mode rejects only indices 0–49 of one mnemonic. Encrypting index 50 in a valid keystore passes the live check even though its private key is public. Other published development keys, including the keystore fixture in this diff, also pass. Tests exercise only indices 0 and 1.  
   **Fix:** Bind live execution to a separately trusted author-signer address and explicitly exclude supported development fixtures. Do not claim an address blacklist proves that a key is private: arbitrary public keys cannot be exhaustively detected from their addresses.

5. **Medium — Frozen-gas runs necessarily fail after spending on S1.**  
   **Location:** `scripts/sp550-live-e2e.ts:420`; `scripts/sp550-e2e-checks.ts:85`  
   `submitGaslessUserOperation` deliberately skips estimation when `frozenGas` is supplied, but `opSigningProblems` unconditionally requires an estimation request. A correctly executed frozen S1 is included and charged, then the script exits before the remaining cells.  
   **Fix:** Make the assertion aware of the selected gas policy: require placeholder estimation only when estimation is expected, and verify all frozen fields against the transmitted operation. Add an orchestration test for a complete frozen-gas run.

6. **Medium — C12 changes explicit gas limits, violating frozen-gas semantics.**  
   **Location:** `packages/sdk/src/clients/endUser.ts:302`; `scripts/sp550-live-e2e.ts:502`  
   C12 passes `frozenGas` as ordinary `gas`. `executeGasless` silently raises an explicit post-op limit to the current contract floor. If that floor increases after earlier cells, C12 signs with a value the caller did not supply; unlike `op()`, C12 never checks frozen equality. The unit tests actually require this alteration of explicit limits.  
   **Fix:** Distinguish frozen limits from adjustable overrides. Refuse a frozen value below the current floor before signing, and compare all five actual C12 limits with the frozen input.

7. **Medium — C12 estimates one operation but signs another.**  
   **Location:** `packages/sdk/src/clients/endUser.ts:295`, `:304`, `:313`  
   The estimator receives neither the previously chosen nonce nor the caller’s fee overrides. It independently obtains fees/nonce and can automatically set `SP_RENEW`; the final operation always builds paymaster data without that renewal flag. With exhausted allowance, estimation can succeed using renewal while the signed operation fails outer estimation without renewal. Explicitly higher fees can also change required sponsorship after estimation.  
   **Fix:** Resolve nonce, fees, sponsorship and renewal policy once, pass them into estimation, and build the signed operation from the same decision. Test allowance exhaustion and explicit fee overrides, checking the estimate payload against the signed payload.

8. **Medium — S1r does not reliably exercise the promised one-send rejection.**  
   **Location:** `scripts/sp550-live-e2e.ts:458`  
   S1r runs ordinary estimation first. A bundler that reports `-32503` during estimation causes zero signatures and zero sends, so the test fails despite correct not-yet-valid rejection. Conversely, S1 receipt polling and subsequent reads can consume the interval; a delayed run sends a valid second operation and only then fails. `expectMinTxInterval: "0"` is also accepted.  
   **Fix:** Require a positive interval and verify the chain-time rejection window before attempting this cell. To specifically test send-stage rejection, reuse validated explicit limits and avoid a preliminary estimate that can reject first. If the window has elapsed, abort before signing. Test both estimation-stage rejection and slow receipt delivery.

9. **Medium — S1r drops the required per-row gas decision.**  
   **Location:** `scripts/sp550-live-e2e.ts:458`  
   Its callback is `submitOpts(() => {})`; the result contains only elapsed time, sends and signature count. A successful S1r therefore has no recorded limits, sources or fees, unlike the stated per-row invariant.  
   **Fix:** Capture and print its decision even on rejection, require one when a signed operation was sent, and validate frozen values against the captured request.

10. **Medium — The E2E assertions do not authenticate enough of the actual operation.**  
    **Location:** `scripts/sp550-live-e2e.ts:398`, `:415`, `:507`  
    S1/S3b trust the bundler’s `success` and receipt logs, while the RPC cross-check examines only a transaction’s sender/nonce match, flags and post-op limit. It never checks the transaction destination against `ep` or compares all actual gas fields with the decision. C12 decodes matching event topics from any emitting address and does not bind the event to the expected nonce/hash/paymaster. A faulty decision callback can report frozen limits while different limits are transmitted and still pass these checks.  
    **Fix:** Fetch receipts independently from `pub`; require the expected EntryPoint destination and log emitter; bind events to the submitted operation hash, sender and nonce; decode and compare all limits, fees, target and paymaster. Add deliberate mismatches to the tests rather than checking only callback values.

11. **Medium — DeployLive’s checked account factory is discarded.**  
    **Location:** `scripts/sp550-live-e2e.ts:331`, `:496`  
    `forkAddressSetFromDeployLive` accepts and validates `simpleAccountFactory`, but both EndUser clients receive only SP and EntryPoint. They consequently use the canonical factory for the chain. A valid DeployLive account from its own factory fails C12 preconditions; supplying a canonical account instead means the run uses a different factory from the one it checked. `forkSetup.simpleAccountFactory` is likewise independent of the validated set.  
    **Fix:** Resolve the factory once from the accepted address source and pass it consistently to setup, account prediction and C12. Reject conflicting overrides before setup writes.

12. **Medium — `--preflight --fork-setup` sends community transactions before reporting “no op sent.”**  
    **Location:** `scripts/sp550-live-e2e.ts:293`, `:336`  
    Fork setup runs before the preflight return. With missing prerequisites, this combination deploys the account, approves staking, mints the role/token and changes renewal mode. That contradicts the documented read-only preflight and the unqualified precondition invariant. Live mode correctly rejects `--fork-setup`, but fork preflight remains mutating.  
    **Fix:** Reject this flag combination or make preflight report missing setup without performing it. Keep explicit fork setup as a separate mutating phase and test that preflight makes no write or impersonation calls.

13. **Medium — The new A7 runner cannot reach the E2E cells.**  
    **Location:** `scripts/sp550-fork/run-a7.sh:160`  
    The generated config omits `expectMinTxInterval`, which `sp550-live-e2e.ts:227` requires. After starting the fork, deploying/loading, gating and refreshing the oracle, the runner deterministically refuses at stage 4.  
    **Fix:** Include the intended interval and ensure the fork’s operator setup provides it. Validate the generated config against the script’s schema before starting expensive or mutating stages.

14. **Low — Failed fork setup leaves privileged accounts impersonated.**  
    **Location:** `scripts/sp550-e2e-fork-setup.ts:44`, `:81`  
    Cleanup occurs only at normal completion. A failed write, reverted receipt or later read leaves the community/account unlocked on the Anvil instance, including the supported shared remote acceptance fork. Existing tests avoid the write paths entirely.  
    **Fix:** Track impersonated accounts and stop impersonation in `finally`, including failures after funding or broadcasting. Add a simulated write-failure cleanup test.

The tests currently establish several useful early refusals, but they do not establish the live orchestration invariants: no test drives the complete four-cell flow with adversarial RPC/bundler responses and observes every signature and send.

## Round 2

**Request changes.** The live-signing boundary and several paper-cell assertions still have gaps. Findings below are from static review; I did not run tests, start services, or send transactions.

1. **High — Fork mode can submit publicly signed operations to a real chain.**  
   `scripts/sp550-live-e2e.ts:171–181, 443`  
   Only `rpcUrls` prove they serve Anvil. A loopback bundler can be configured against real Sepolia while the read client uses a Sepolia fork. Because both use the same chain ID, EntryPoint, account and potentially nonce, the public-key signature can be valid on real Sepolia. The later receipt lookup failing on the fork does not undo submission. The code explicitly acknowledges this residual risk, but it contradicts the intended boundary.  
   **Fix:** Bind the bundler to the verified fork through controlled startup/configuration and verify that binding before releasing signatures. For a stronger boundary, use a distinct fork chain ID so signatures cannot replay on the real network. Add a test with an Anvil read endpoint and a live-backed bundler.

2. **High — The public-key denylist misses keys published by this PR itself.**  
   `scripts/sp550-live-signer.ts:153–160`  
   `REPO_FIXTURE_ADDRESSES` contains only the Cast fixture. It omits both the published PBKDF2 vector address at `sp550-live-signer.test.ts:22` and the deterministic `KEY` at line 24. Encrypting either key and setting `expectSigner` to its address passes the live checks. Anvil index 50 and above also pass despite being derived from the same public mnemonic. Matching an address supplied in the same configuration does not establish that the key is private.  
   **Fix:** Reject every known repository fixture and supported development derivation, test them explicitly, and obtain the approved author address from a separately trusted source. Document that a finite denylist cannot establish the absolute “never a public key” guarantee.

3. **High — The current-state check does not preserve what the read-back gate certified.**  
   `scripts/sp550-live-e2e.ts:234–254`  
   The finalized gate checks Registry implementation, SP extension and other wiring, but `recheck()` checks only SP implementation/hash, EntryPoint address, Registry address and operator token address. A Registry upgrade after the finalized snapshot leaves all five unchanged and passes every recheck. Moreover, current EntryPoint/Registry values become the baseline rather than being compared directly with their gated expectations.  
   There is also a concrete initialization race: `token` is captured at line 228, then `gated.token` is read separately. Unlike EntryPoint/Registry, those values are never compared. A token change between those reads leaves preconditions and S3b calls targeting the old token while SDK sponsorship uses the new one.  
   **Fix:** Build one block-consistent snapshot, compare all safety-relevant implementation/wiring values directly with the certified pins, and derive encoded addresses from that same snapshot. Test Registry upgrades and token changes between reads.

4. **Medium — “Before signing” checks occur before potentially lengthy SDK work, not at the signing boundary.**  
   `scripts/sp550-live-e2e.ts:325, 439–443, 529–536`  
   After `recheck()`, the SDK performs reads and estimation before calling the signer. A slow estimate can exhaust S1r’s five-second margin, allowing the supposedly refused operation to be signed and accepted. SDK fee/PVG retries can also produce additional signatures and sends before the harness eventually fails its count assertion. The signer wrapper merely increments a counter.  
   **Fix:** Enforce the signature budget and fresh preconditions inside the signer wrapper; check S1r’s chain-time deadline there. Add a send-boundary guard and disable retries for these cells. Explicitly separate the remaining inclusion-time race from races the script can prevent.

5. **Medium — S1r can pass without exercising the required send/signature behavior, and for the wrong rejection reason.**  
   `scripts/sp550-live-e2e.ts:540–545`  
   An estimation rejection with zero sends and zero signatures passes because the checks require only `sends <= 1` and `signs === sends`. This contradicts the requested one-send/one-signature cell. Also, the SDK treats `-32503` as “not valid yet / expires shortly”; accepting any such error, or matching the code in arbitrary message text, does not prove operator rate limiting.  
   **Fix:** Require exactly one send and one signature for the specified cell, or report estimation rejection as a distinct cell that cannot satisfy it. Validate structured validity information showing a future `validAfter` attributable to the interval. Add tests for zero-send rejection, expiry rejection and misleading error text.

6. **Medium — C12 never checks its gas report against the actual transaction.**  
   `scripts/sp550-live-e2e.ts:602–610`  
   C12 compares `frozenGas` only against `onGasDecided().limits`. If the SDK reports the requested values but encodes different limits, the cell still passes when execution succeeds and xPNTs decrease. It also does not compare the actual outer transaction gas/fees or encoded paymaster with the report. The bundled-operation helper already performs much of this verification for the other cells.  
   **Fix:** Decode C12’s mined `handleOps`, identify the exact operation, and compare all five limits, fees, paymaster and outer transaction gas against the recorded decision and frozen input. Add a deliberately dishonest-callback regression test.

7. **Medium — `executeGasless` silently increases an explicitly supplied gas limit.**  
   `packages/sdk/src/clients/endUser.ts:304–305`  
   With all five limits supplied and no estimation endpoint, an explicit postOp limit below `minPostOpGas` is replaced by the floor and signed. That signed limit came from neither the caller nor an estimate, contradicting invariant 5. Existing tests explicitly expect this behavior.  
   For the live harness, a floor increase between its C12 check at line 582 and the SDK sponsorship read creates the same problem: frozen gas is changed, the transaction is sent, and only then does the assertion fail.  
   **Fix:** Reject explicit limits below the current floor before signing. Apply floors to estimated fields only, unless the caller separately authorizes adjustment. Update the tests to enforce that distinction.

8. **Medium — Partial explicit gas cannot fill gaps in a partial estimate.**  
   `packages/sdk/src/clients/endUser.ts:293–302`  
   The API advertises `Partial<limits>` with the remainder estimated, but it calls `estimateUserOperationGas`, which requires every estimate field to be usable before returning. If the caller supplies postOp gas and the endpoint returns valid estimates for the remaining four fields but omits postOp, the call rejects despite having a source for every required limit. The “explicit fields win” test supplies all five fields and never exercises merging.  
   **Fix:** Retrieve partial estimate results, merge explicit fields first, then validate the resulting five limits. Add mixed explicit/estimated cases with omitted and sentinel fields.

9. **Medium — C12 estimates a different nonce/fee configuration from the operation it signs.**  
   `packages/sdk/src/clients/endUser.ts:295–307`  
   The SDK already fetched the EntryPoint nonce, but does not pass it through the estimator’s supported `nonce` option. The estimator independently calls the account’s `getNonce()` and silently falls back to zero. An account without that getter therefore estimates nonce zero even when the signed operation uses nonce seven. Explicit fees are also omitted from the estimation options and resolved separately afterwards. This can cause false rejection or estimate sponsorship against a different prefund requirement.  
   **Fix:** Resolve the nonce and fees once and pass those exact values to estimation and encoding. Assert the estimator request’s nonce and fees in the SDK tests; the current mock returns an estimate regardless of those fields.

10. **Medium — Rejected rows do not reliably record the gas decision.**  
    `scripts/sp550-live-e2e.ts:438–447, 535–542`  
    The harness expects `onGasDecided` to populate the rejection report, but `PaymasterClient` invokes that callback after acceptance. A send-time rejection can therefore produce `gas=(no decision reported)` even though a fully specified, signed operation left the process. S1r’s expected rejection has the same problem. `tapBundler` records signature/flags but discards the gas and fee fields needed to recover the evidence.  
    **Fix:** Capture the complete outgoing operation before every send, or expose a separate pre-send decision callback. Report rejection gas from those exact bytes and test a send-time rejection.

11. **Medium — The receipt polling loop has no effective overall timeout.**  
    `scripts/sp550-live-e2e.ts:385–392`  
    Although the loop has 120 iterations, each `fetch()` and body read can hang indefinitely. HTTP errors and JSON-RPC errors are also ignored as though the receipt were merely pending. After a real operation has been submitted, an unresponsive or unauthorized bundler can leave the script stuck without a bounded failure or useful recovery evidence.  
    **Fix:** Apply request and overall deadlines, validate HTTP/JSON-RPC responses, and include the submitted operation hash in timeout/error reports. Test a hung response and an explicit RPC error.

12. **Low — Preflight can report success for a task plan that execution refuses.**  
    `scripts/sp550-live-e2e.ts:376–379, 504–507`  
    `--preflight` returns before checking `taskPlan.shared.SP` and byte equality of `taskCallData`. A correctly hashed plan for another SP on the same chain can pass preflight, then be refused during the actual run.  
    **Fix:** Construct and validate the task call before the preflight return, and test a wrong-SP plan and mismatched calldata.

13. **Low — The new live runbook’s configuration is rejected by the script.**  
    `docs/sp550-cutover/A7-runbook.md:136–146`  
    The example omits both required `expectSigner` and `expectMinTxInterval`. Following it verbatim fails before reaching the documented preflight.  
    **Fix:** Add both fields and explain their expected sources; keep a validated example configuration alongside the usage tests.

The current tests mainly cover helper behavior and early usage refusals. They do not exercise the decisive boundaries above: bundler/fork identity, state changes between reads and signing, S1r’s full verdict, or C12’s report-versus-transaction consistency.

## Round 3

I would not approve this for live use yet. The remaining problems include paths that can send a real transaction before the harness reports failure.

This was a static review of the diff and relevant code inside this worktree. I did not execute transaction scripts or tests.

1. **High — Bundler failure can trigger an unintended EOA transaction.**  
   **Location:** `scripts/sp550-live-e2e.ts:532`, `:617`; `packages/paymaster/src/V4/PaymasterClient.ts:1135`.  
   The script passes a fully capable wallet to `submitGaslessUserOperation`. If `eth_sendUserOperation` returns method-not-found, the SDK falls back to `wallet.writeContract(handleOps)`. The wrapper at `sp550-live-e2e.ts:387` guards only `signMessage`; it does not prevent transaction signing. Consequently, S1, S3b, or the supposedly rejected S1r can spend the author’s ETH through a direct transaction. The harness subsequently treats the returned transaction hash as a UserOp hash and fails while looking for its bundler receipt—after spending.  
   **Fix:** Disable direct-send fallback for these cells, and supply a wallet whose transaction-signing/sending methods refuse outside C12. Test a successful estimate followed by `eth_sendUserOperation: -32601`, asserting zero transaction signatures and broadcasts.

2. **High — Fork detection does not establish that transaction submission reaches a fork.**  
   **Location:** `scripts/sp550-live-e2e.ts:203–212`, `:116`.  
   The check accepts an Anvil version string and any `anvil_nodeInfo` result other than `undefined`, including `null`. A proxy can route those methods and balance-setting to Anvil while routing ordinary Ethereum calls and raw transactions to Sepolia. Starting a local bundler does not close this: it uses that same RPC URL. Fork signatures retain the real chain ID, so matching accounts/nonces can produce executable real-chain transactions without `--live-go`.  
   **Fix:** Establish an owned, isolated Anvil endpoint rather than treating RPC metadata as proof. Prefer a distinct signing chain ID where feasible. If remote forks remain supported, explicitly make their routing a trusted prerequisite and test split-routing responses; metadata checks alone cannot deliver the stated guarantee.

3. **High — Matching two supplied addresses does not prove the signer is private or belongs to the author.**  
   **Location:** `scripts/sp550-live-signer.ts:147–169`; `scripts/sp550-live-e2e.ts:378–380`.  
   An encrypted keystore for public mnemonic account index **200** passes the blacklist. Setting both `expectSigner` and `--live-signer` to that address passes the other checks. Other published development keys also pass. The code comments acknowledge the finite blacklist but incorrectly describe matching configurable addresses as the guarantee.  
   **Fix:** Bind live signing to an independently provisioned author identity/key policy. Keep the blacklist as defense in depth, but do not claim that address equality establishes key secrecy. Add the index-200 counterexample to the policy tests.

4. **Medium — The signing recheck omits mutable preconditions that determine whether sending is safe.**  
   **Location:** `scripts/sp550-live-e2e.ts:282–308`, `:430–444`.  
   `recheck()` compares implementation/wiring and token identity, but not `minTxInterval`, operator configuration/pause state, gas parameters, account ownership, renewal mode, or outstanding locks. For example, the operator can reduce `minTxInterval` after its initial read. All signing rechecks pass, and S1r becomes a valid operation that can execute before its rejection assertion fails. This change can occur **before** the final signing check, not merely during the unavoidable inclusion race.  
   **Fix:** Revalidate the relevant mutable preconditions at a coherent current snapshot before each signature and transaction broadcast. Refuse changed cell parameters. State the remaining inclusion-time race separately.

5. **Medium — S1r’s deadline cannot prevent execution after the refusal window.**  
   **Location:** `scripts/sp550-live-e2e.ts:390–395`, `:616–629`.  
   The deadline is checked before signing. A delayed request, bundler queue, or process suspension can deliver the signed operation after `minTxInterval` expires. It is then executable; reporting `ACCEPTED` and exiting does not undo it. The five-second margin is not a bound on submission latency.  
   **Fix:** Use a protocol-enforced signed expiry that makes execution outside the test window impossible, if supported. Otherwise, live S1r must explicitly allow the possibility of execution and reconcile the submitted operation on failure; deterministic rejection-only testing belongs on a controlled fork.

6. **Medium — S1r can pass without proving its frozen-gas or interval claims.**  
   **Location:** `scripts/sp550-live-e2e.ts:623–629`.  
   The assertions check only error type, `validAfter > now`, send count, and signature count. They never compare the sent limits with S1’s limits, reject estimation calls, or relate `validAfter` to S1’s block timestamp plus the configured interval. An SDK regression that changes a frozen limit still passes. A rejection caused by another validity window can also be credited to operator throttling.  
   **Fix:** Assert all five captured limits verbatim, zero estimates, the expected signature shape, and timing consistent with the actual operator interval. Record the complete gas/fee decision for this rejected row.

7. **Medium — S1/S3b can sign using fallback constants despite an unusable estimation endpoint.**  
   **Location:** `scripts/sp550-live-e2e.ts:519–532`, `:580`; `packages/paymaster/src/V4/PaymasterClient.ts:757–787`.  
   A bundler can return `-32601` for estimation while supporting submission. `submitGaslessUserOperation` then uses local defaults. The harness sees an estimation *request* carrying a dummy signature, so its estimation assertion passes; it does not reject `default` or `computed` gas sources. C12 may eventually refuse the same endpoint, but earlier real operations have already been sent.  
   **Fix:** Add strict estimation enforcement to the submission path and enable it here. Validate the gas provenance before signing; the new strict helper used by `executeGasless` does not protect these cells.

8. **Medium — Fork preflight writes state and can fail to terminate.**  
   **Location:** `scripts/sp550-live-e2e.ts:114–118`, `:357`, `:461–464`.  
   `--preflight` starts Alto and overwrites balances for public accounts 2 and 3 before reaching its return. This contradicts the read-only promise and can destroy existing shared-fork balance state. The return also bypasses the later cleanup `finally`; the spawned child can keep the parent alive, so the `exit` cleanup hook is insufficient.  
   **Fix:** Do not fund or start a bundler during read-only preflight. Put resource cleanup around the entire lifetime of any spawned process.

9. **Medium — The A7 command always generates a configuration the E2E rejects.**  
   **Location:** `scripts/sp550-fork/run-a7.sh:160–166`; `scripts/sp550-live-e2e.ts:143`.  
   The runner writes `bundlerUrl: "http://127.0.0.1:3046"`. Fork mode now requires exactly `"self"`. A7 therefore completes its preceding deployment/readback work and unconditionally fails at stage 4. The recorded rc.4 PASS predates this interface and cannot validate it.  
   **Fix:** Update the runner and bundler lifecycle together. Add a test that feeds the generated configuration into the current usage validator.

10. **Medium — Ambiguous submission failures are falsely reported as definitive rejection.**  
    **Location:** `scripts/sp550-live-e2e.ts:533–538`.  
    If a bundler accepts an operation but its response is lost or malformed, the catch prints `REJECTED before inclusion`. The operation may already be pending or mined. The same label can follow an error after the SDK’s direct-send fallback. This is dangerous recovery guidance for an operator deciding whether to rerun.  
    **Fix:** Distinguish “nothing submitted,” definitive RPC rejection, and unknown submission outcome. Compute and retain the operation hash before sending, report it on ambiguity, and reconcile receipt/nonce before recommending another run.

11. **Medium — The gas observer can change transaction fees after the UserOp was signed.**  
    **Location:** `packages/sdk/src/clients/endUser.ts:411–415`.  
    `onGasDecided` receives the live mutable `fees` and `limits` objects. The outer transaction then reads `fees` again. A callback that modifies `d.fees.maxFeePerGas` changes the actual transaction price after the UserOp’s fees were encoded and signed. Mutating `d.limits` makes the retained decision disagree with the encoded operation. A callback can mutate and throw, and execution still continues.  
    **Fix:** Pass detached immutable snapshots to observers. Capture the transaction’s final fields independently before invoking callbacks, and test mutation-plus-throw behavior.

12. **Medium — “Refused before signing” tests do not observe signing.**  
    **Location:** `packages/sdk/__tests__/endUser.executeGasless.test.ts:104–114`, and the missing-estimate/below-floor tests.  
    These tests check an exception and sometimes absence of `eth_sendRawTransaction`. They do not spy on `signMessage` or `signTransaction`. Moving the rejection after signing would leave them green, directly breaking invariant 5. The script tests likewise stop predominantly at usage checks rather than exercising the guarded send paths.  
    **Fix:** Instrument both signing methods and all broadcast methods. Assert zero calls on refusal paths, and exercise fallback, changed-precondition, delayed-S1r, and malformed-estimate cases through the actual orchestration.

13. **Medium — A renewal during S3b setup is discarded, causing unnecessary further spending.**  
    **Location:** `scripts/sp550-live-e2e.ts:637–646`.  
    The sponsored `setAutoAllowance` operation can itself require and successfully perform `SP_RENEW`. `op()` verifies that renewal, but its return value is discarded. The loop then keeps spending to obtain another renewal; it can consume the last available renewal during setup and subsequently fail despite already observing the behavior under test.  
    **Fix:** Inspect the setup result. Either accept that verified renewal where the cell definition permits it, or establish before sending that setup cannot consume the renewal reserved for the measured task.

14. **Medium — `maxOps` is not a validated spending bound.**  
    **Location:** `scripts/sp550-live-e2e.ts:171`, `:643`.  
    `Number(cfg.maxOps)` accepts `"Infinity"` and excessively large values. An unreachable renewal condition can therefore keep submitting paid operations until another resource runs out. Conversely, malformed values become `NaN`, allowing earlier cells/setup to spend before the loop silently skips and fails.  
    **Fix:** Validate a finite positive safe integer with an explicit upper bound during usage validation, before any setup or signing. Clarify whether the budget includes setup and the other cells.

