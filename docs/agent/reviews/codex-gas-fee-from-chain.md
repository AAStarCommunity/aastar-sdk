# Codex Tier-1 review: gas limits and fees from the chain (PaymasterClient)

`codex exec`, read-only sandbox, static, three rounds, all before the PR was opened. Each round reviewed the whole diff again. Round 3 found no Critical or High; DSR (2026-11-19) ruled that rounds 4–5 are not needed for Medium findings. **Round 3's five Medium and two Low findings were fixed afterwards and were not re-reviewed by Codex.**

| Round | Critical | High | Medium | Low | Handled |
|---|---|---|---|---|---|
| 1 | 0 | 3 | 6 | 1 | all fixed (observer could release an accepted op's slot; SDK wrappers still compressed estimates; caller fees overwritten in retries; partial fee RPCs; incomplete frozenGas; partial explicit limits skipped estimation; provenance; evidence locality; evidence assertions; ABI names/anonymity) |
| 2 | 0 | 1 | 4 | 1 | all fixed (V4 sentinel postOp; per-field caller fees; omitted estimate fields; fallback provenance; evidence run left the chain changed; even-count median) |
| 3 | 0 | 0 | 5 | 2 | all fixed, not re-reviewed (unusable PVG; replacement per field; tuneEstimate on a partial estimate; deadline skipped cleanup; receipt check trusted the bundler; erased estimator parameter types; stub left open on failure) |

## Round 1

**Critical: none found.**  
**High: 3 findings. Medium: 6 findings. Low: 1 finding.**

Review was static and restricted to this worktree. I used no network or RPC, read no secrets, and did not run the evidence script or tests.

**High**

1. **A reporting callback can release an accepted operation’s in-flight reservation.**  
   `packages/paymaster/src/V4/PaymasterClient.ts:1103`  
   `reportGas()` runs after bundler acceptance and `guard.record()`. If `onGasDecided` throws—for example, a collector calls `JSON.stringify(decision)` without handling bigint—the outer catch sees `guard.inSend === false` and releases the reservation. The caller receives an error instead of the accepted hash and can submit again while the first operation remains pending.  
   **Fix:** isolate observer exceptions from submission outcomes, and make accepted reservations immune to subsequent reporting failures. Test a throwing callback after acceptance.

2. **Existing SDK wrappers still compress estimates, and removing the floor makes their resulting limits lower.**  
   `packages/paymaster/src/V4/PaymasterClient.ts:719`  
   `SuperPaymasterClient.ts:71` and `UserClient.ts:503` still inject `tuneEstimate` callbacks that cap paymaster verification at approximately 133,333 gas. Those values override the new scaled estimate. Previously, the SuperPaymaster floor raised them to 250,000; this change removes that protection. The committed evidence reports verification estimates of 306,863 and 363,992: these wrappers would submit 133,333 for those paths, causing validation failure. Listing their migration in FU-122 does not prevent this regression.  
   **Fix:** migrate these callers in the same change and test submission through both public wrappers.

3. **Explicit caller fees are still overwritten during retries.**  
   `packages/paymaster/src/V4/PaymasterClient.ts:725`, retry mutations at `:930` and `:966`  
   The new “caller values win” guarantee applies only to initial resolution. Replacement and minimum-fee branches overwrite both fields and re-sign without respecting explicit values. A caller setting a maximum spending price can consequently submit above that price, including with `frozenGas`.  
   **Fix:** preserve explicitly supplied fields throughout retries; reject incompatible bundler requirements unless the caller explicitly opts into bounded fee increases.

**Medium**

4. **Partial fee overrides still require RPC data that is unnecessary.**  
   `packages/paymaster/src/V4/gasPolicy.ts:113`  
   When history fails and the caller supplies `maxPriorityFeePerGas`, the resolver still calls `estimateMaxPriorityFeePerGas()`. If that method is unsupported, submission fails despite having the priority and an available block base fee. Conversely, a supplied maximum fee still requires a base fee even when only priority is missing.  
   **Fix:** resolve only missing caller fields and fetch base fee only when calculating maximum fee.

5. **Incomplete `frozenGas` objects silently acquire defaults.**  
   `packages/paymaster/src/V4/PaymasterClient.ts:691`  
   Validation iterates supplied properties rather than the five required fields. A JavaScript caller passing `{}` bypasses estimation and reaches defaults; an object missing `callGasLimit` silently gets 500,000. This violates the defining frozen-data guarantee.  
   **Fix:** validate every required field explicitly before constructing the operation, including representable ranges.

6. **Supplying both account limits skips estimation for missing paymaster limits.**  
   `packages/paymaster/src/V4/PaymasterClient.ts:695`  
   With explicit `verificationGasLimit` and `callGasLimit`, missing paymaster limits never reach the estimator. They receive defaults instead. For V4, removing the initial 200,000 postOp default now makes this path use 100,000 at line 769. A V4 postOp needing 150,000 therefore regresses from sufficient gas to insufficient gas.  
   **Fix:** estimate whenever any required limit is absent unless estimation is explicitly disabled; document and preserve intentional manual-mode defaults.

7. **Gas-source reporting mislabels overrides and defaults as estimates.**  
   `packages/paymaster/src/V4/PaymasterClient.ts:870`  
   Every non-frozen operation reports `limitsSource: 'estimate'` and a coefficient, even when estimation was disabled, skipped, or overridden through `tuneEstimate` and explicit limits. A collector can record “estimate ×1.5” for limits that were never estimated or scaled.  
   **Fix:** report provenance per field, including explicit, tuned, default, estimated, floor-adjusted, and retry-adjusted values.

8. **The evidence script neither enforces local endpoints nor restores the entire run.**  
   `tests/regression/onchain-evidence/gas-policy-local.ts:37`, `:90`, `:123`  
   Chain ID 31337 does not establish that an endpoint is local; `BUNDLER_URL` is unrestricted and unverified. Before any snapshot, the script updates price, drains balances, mints tokens, consumes nonces, and creates debt. Only the later variants are reverted. Running against a shared development chain leaves those changes behind, including on failure.  
   **Fix:** require loopback endpoints and matching bundler chain identity; use a dedicated disposable chain, or snapshot before the first mutation and restore in an outer `finally`.

9. **Evidence can pass without proving caller fees were preserved.**  
   `tests/regression/onchain-evidence/gas-policy-local.ts:93`  
   The caller-fee assertion checks only `fees.source === 'caller'`. Retry mutations retain that source, so an operation submitted at higher fees still passes. Similarly, row C checks frozen limits but never asserts the identical `actualGasUsed` claimed in the changelog.  
   **Fix:** assert final fee values and `feesRaisedByBundler`; return receipt measurements and explicitly compare the claimed gas equality.

**Low**

10. **ABI equality misses changes that affect decoding.**  
    `packages/core/src/abis/paperPathAbi.ts:32`, `:47`  
    Tuple types and event indexing are compared, and overloads correctly fail comparison. However, `anonymous` and parameter/component names are omitted. Toggling event anonymity still passes despite changing topic layout; renaming an event argument still passes while breaking consumers using named `args` properties.  
    **Fix:** include event anonymity and SDK-relevant names in the pinned representation, or narrow the claim to type-signature equality.

The local measurements do **not** establish Alchemy/Pimlico/Candide compatibility or OP fee correctness. In particular, multiplying a bundler estimate by 1.5 does not itself prove compliance with an efficiency ceiling, and the direct-`handleOps` variants bypass bundler admission entirely. Those remain unverified risks, rather than demonstrated provider failures. The reporting offsets match both current paymaster layouts; I found no limit mutation in the inspected SP_RENEW re-encoding path.

## Round 2

**High issues remain; no Critical issue found.** The round-1 fixes improve the submission path, but do not close every finding.

This was a static review of the full diff and relevant worktree code. I used no network/RPC, read no secrets or other worktrees, and did not execute tests or the evidence script. Provider-specific compatibility therefore remains unverified.

Round-1 disposition:

| Finding | Status | Re-review result |
|---|---|---|
| H1: callback releases accepted operation’s slot | Fixed for synchronous callback throws | Both bundler acceptance and direct `handleOps` call the same protected callback. |
| H2: higher-level clients still compress estimates | Fixed | Both internal `tuneEstimate` implementations were removed. |
| H3: caller fees overwritten on retries | Fixed, with a regression | Explicit values are preserved, but providing either fee disables retries for both fields. |
| M4: unnecessary RPCs for partial fees | Fixed | Fallback requests only missing priority/base data. |
| M5: incomplete `frozenGas` gets defaults | Fixed | All five positive bigint limits are required before submission. |
| M6: explicit account limits skip paymaster estimation | Partially fixed | Missing limits trigger estimation, but explicit overrides cannot rescue omitted estimate fields. |
| M7: incorrect gas provenance | Partially fixed | Overrides, floor raises and PVG retries are tracked; synthetic fallback estimates remain mislabelled. |
| M8: evidence endpoint restriction/restoration | Partially fixed | Exact hostname matching handles `[::1]` and rejects look-alike suffixes. Part 1 remains unrestored. |
| M9: evidence lacks caller-fee/B–C assertions | Fixed | Both assertions now affect PASS/FAIL. |
| L10: ABI names/anonymity ignored | Fixed | Recursive names and event anonymity participate in equality; overloads fail closed. |

Remaining/new findings, ordered by severity:

1. **High — V4 accepts a tiny postOp estimate as executable gas.**  
   `packages/paymaster/src/V4/PaymasterClient.ts:771`; `packages/paymaster/src/V4/gasPolicy.ts:82`.

   A returned `paymasterPostOpGasLimit: '0x1'` becomes **2 gas**. The V4 fallback applies only to `undefined`; unlike SuperPaymaster, this path has no subsequent contract-floor raise. Previously, submission added 100k and enforced a 200k minimum.

   **Failure scenario:** an estimator returns `0x1` without meaningfully estimating V4’s postOp. The SDK signs an operation whose postOp cannot execute, causing rejection or failed execution/accounting. The new tiny-estimate test covers only SuperPaymaster, where its floor hides this case.

   **Fix:** distinguish unsupported/sentinel estimates from usable estimates for each supported bundler/paymaster combination. Require an explicit postOp limit or obtain a valid estimate when unsupported; add a V4 regression case. Multiplying a sentinel is not a safety margin.

2. **Medium — A partial caller fee disables valid retries of the other fee.**  
   `packages/paymaster/src/V4/PaymasterClient.ts:864`, `:982`.

   `callerFees` combines both overrides with `||`, then blocks every fee adjustment.

   **Failure scenario:** the caller sets `maxFeePerGas = 100`, the node supplies priority `1`, and the bundler requires priority `2`. Raising priority to `2` would preserve the caller’s cap, but submission throws. The symmetric case occurs when only priority is explicit and the generated max fee needs increasing.

   **Fix:** track explicitness per fee. Adjust only generated fields, preserving explicit values and enforcing `maxFee >= priority`. Replacement requirements that necessarily change an explicit field should still fail.

3. **Medium — Explicit paymaster limits cannot compensate for omitted estimator fields.**  
   `packages/paymaster/src/V4/PaymasterClient.ts:576`, `:701`.

   Estimation requires all five returned fields before submission merges explicit overrides.

   **Failure scenario:** a caller provides both paymaster limits and wants the account limits estimated. A bundler returns account limits but omits paymaster limits. `need()` throws even though the caller already supplied everything missing. `tuneEstimate` cannot repair this either because it runs later.

   **Fix:** represent incomplete estimates internally and require only fields still needed after overrides. Keep any strict public estimator contract separate. Add an omitted-paymaster-fields test with explicit overrides.

4. **Medium — The Anvil fallback still fabricates “bundler estimate” provenance.**  
   `packages/paymaster/src/V4/PaymasterClient.ts:553`, `:719`.

   A method-not-found response returns hardcoded limits as a normal `GasEstimate`. Submission scales them and reports `estimate`, `coefficientBps`, and `rawEstimate` as though the bundler supplied them.

   **Failure scenario:** submission against an ordinary local node falls back to direct `handleOps`; the collector records “bundler estimate × 1.5” despite no estimate having occurred. This directly undermines the evidence API’s purpose.

   **Fix:** carry explicit estimation provenance, report these limits as defaults, and leave the bundler-estimate field absent. Test the callback on this fallback path.

5. **Medium — The evidence run still changes a shared local chain permanently.**  
   `tests/regression/onchain-evidence/gas-policy-local.ts:67`, `:106`, `:150`.

   Only Part 2 has snapshots. Price refreshes, balance transfers, minting, debt changes and nonce consumption from Part 1 survive both successful and failed runs. Loopback plus chain ID 31337 does not establish exclusive ownership or disposability.

   **Failure scenario:** running against an existing development Anvil changes another test’s balances, debt and nonces. Calling it “disposable” in a comment does not enforce that assumption.

   **Fix:** provision and own an isolated Anvil/bundler pair for the run, or use whole-run restoration with exclusive ownership and bundler-state cleanup. Do not revert a shared chain while other clients are active.

6. **Low — The default ten-block calculation uses the lower middle reward, not the usual median.**  
   `packages/paymaster/src/V4/gasPolicy.ts:88`.

   For rewards `[1, 1, 1, 1, 1, 9, 9, 9, 9, 9]`, the function returns `1`; the middle-pair median is `5`. This affects the default even-sized history window, while the median test uses three rewards.

   **Failure scenario:** fees systematically understate the documented statistic when recent rewards split between two levels.

   **Fix:** average the two middle values with documented integer rounding, or explicitly document and name the lower-median policy.

Additional review conclusions:

- Frozen limits remain unchanged through SP_RENEW re-encoding and fee retries; matching PVG errors refuse an increase. Both paymaster layouts use the reported offsets correctly.
- The estimate object’s field shape remains unchanged, but its numerical semantics and missing-field behavior change. Existing `tuneEstimate` callbacks now receive raw estimates; the changelog should explicitly identify that migration.
- The local evidence does **not** establish Alchemy/Pimlico/Candide acceptance on OP or Sepolia. Multiplying an already conservative estimate can worsen verification efficiency, and scaling PVG increases chargeable gas. Neither provider efficiency limits nor L2 fee behavior is demonstrated here.
- No new browser/ESM defect was identified. Node filesystem imports are confined to the ABI test and scripts.
- The ABI comparison catches the requested structural differences, but this review cannot independently authenticate the upstream commit/blob provenance without accessing the excluded repository.

## Round 3

**Critical: none found. High: none confirmed remaining.** I found **five Medium and two Low findings**.

Reviewed the full diff without network/RPC access or reading outside this worktree. Validation was static inspection plus an in-memory TypeScript reproduction; I did not run the integration tests.

| Round-2 finding | Round-3 verdict |
|---|---|
| V4 postOp `0x1` became 2 gas | **Fixed for postOp.** Refused unless explicitly supplied; SuperPaymaster uses its floor. PVG still bypasses refusal—M1. |
| One explicit fee disabled retries of the other | **Partially fixed.** Normal fee-error branches work per field; replacement handling remains overbroad—M2. |
| Explicit limits could not cover omitted estimates | **Fixed for explicit fields.** However, a partial estimate silently disables `tuneEstimate`—M3. |
| Anvil defaults reported as estimates | **Fixed.** Defaults remain unscaled and are labelled appropriately. |
| Evidence left shared chain changed | **Partially fixed.** Ordinary thrown errors reach the outer revert; the deadline bypasses it—M4. |
| Even-count median used lower middle | **Fixed.** Computes the two-middle mean, rounded down. |

**Medium findings**

1. **Unusable preVerificationGas still becomes a locally invented limit.**  
   [PaymasterClient.ts:748](packages/paymaster/src/V4/PaymasterClient.ts:748) explicitly exempts PVG from refusal. Missing, zero or `0x1` PVG therefore reaches the local calculation at line 821, despite the changelog promising explicit coverage or refusal.

   **Failure scenario:** an L2 bundler supplies usable execution limits but unusable PVG. The SDK signs and sends a calldata-only approximation that omits the chain-specific L1 fee component. Recovery depends on the rejection matching a narrow regex; otherwise submission fails.

   **Fix:** require explicit PVG when the estimation response lacks usable PVG. Keep local computation confined to the deliberately supported no-estimation fallback.

2. **Replacement handling still blocks valid per-field fee recovery.**  
   [PaymasterClient.ts:966](packages/paymaster/src/V4/PaymasterClient.ts:966) treats every `-32602` as replacement-underpriced and immediately refuses when either fee is explicit.

   **Failure scenario:** a `-32602` priority requirement arrives while only maxFee is explicit and comfortably covers it. The corrected per-field branch is never reached. Even for an actual replacement, an explicit priority may already exceed the required replacement threshold while only the generated maxFee needs raising.

   **Fix:** identify replacement errors by message/structured replacement data, calculate each required fee independently, and refuse only when an explicit field actually needs changing.

3. **Partial estimates silently disable the caller’s tuning callback.**  
   [PaymasterClient.ts:734](packages/paymaster/src/V4/PaymasterClient.ts:734) invokes `tuneEstimate` only when all five estimator fields are usable—even when explicit options or the SuperPaymaster floor cover every omission.

   **Failure scenario:** postOp is `0x1`, the chain floor covers it, and the caller’s callback supplies a necessary verification buffer. Submission proceeds, but the callback never runs and its buffer disappears.

   **Fix:** define and implement callback behavior for partial estimates. Either expose a partial-estimate contract with explicit provenance or reject this combination clearly; do not silently ignore an existing option.

4. **The evidence deadline skips snapshot cleanup entirely.**  
   [gas-policy-local.ts:230](tests/regression/onchain-evidence/gas-policy-local.ts:230) calls `process.exit(1)`, which does not execute the asynchronous outer `finally`.

   **Failure scenario:** minting/transfers complete, then receipt polling or an RPC stalls until the deadline. The process exits with chain mutations preserved and without clearing bundler state.

   **Fix:** use cancellation and bounded RPC requests so timeout flows through awaited cleanup. Prefer an isolated disposable Anvil/bundler pair: snapshot rollback also cannot safely preserve unrelated transactions submitted concurrently to a shared chain, and `clearState` discards unrelated pending operations.

5. **Receipt validation proves transaction existence, not execution of the requested UserOperation.**  
   [gas-policy-local.ts:66](tests/regression/onchain-evidence/gas-policy-local.ts:66) accepts any bundler receipt whose transaction/block hashes exist locally, then trusts the bundler’s `success` and `actualGasUsed`.

   **Failure scenario:** a cached/misassociated response returns B’s successful receipt for C. The transaction exists, debt remains unchanged, and B/C gas equality passes even if C has not executed.

   **Fix:** decode the authoritative on-chain receipt’s EntryPoint `UserOperationEvent`, require the requested `userOpHash` and expected sender, and derive success/gas measurements from that event.

**Low findings**

1. **The published estimator declaration loses its parameter types.**  
   [PaymasterClient.ts:350](packages/paymaster/src/V4/PaymasterClient.ts:350) derives public arguments from a private method. Declaration emission strips that method’s signature to `private static estimateUserOperationGasDetailed;`, leaving `Parameters<…>` without the intended tuple.

   **Failure scenario:** consumers lose required-argument checks, option validation and editor assistance; malformed calls compile and fail at runtime. The existing emitted declaration and an isolated compiler reproduction confirm the type erasure.

   **Fix:** declare a shared named argument tuple/options type and use it directly in both methods.

2. **An evidence failure after opening the stub leaves the process alive indefinitely.**  
   [gas-policy-local.ts:158](tests/regression/onchain-evidence/gas-policy-local.ts:158) opens a server, but closes it only on successful completion at line 178.

   **Failure scenario:** a variant throws. Snapshot cleanup runs, the top-level handler clears the deadline, but the listening server keeps Node alive forever.

   **Fix:** close and await the server in a `finally` covering all variants.

The ABI comparator handles overload ambiguity, recursive tuple shapes/names, event indexing and anonymity correctly for the selected entries. Frozen limits also remain intact through the inspected retries and SP_RENEW re-encoding; both paymaster layouts share the offsets used by `onGasDecided`.

The local evidence does **not** establish Alchemy/Pimlico/Candide acceptance or OP fee sufficiency. I found no basis within this offline review to claim those compatibility risks are resolved.

