# Codex Tier-1 review: ROLE_ENDUSER role data (two fields) and registerRole

`codex exec`, read-only sandbox, static, five rounds, all before the PR was opened. Round 1 reviewed the whole change; rounds 2–5 the whole diff again after each response. No Critical or High finding in any round. Round 5: no finding at any severity; its one wording note (the evidence script's header called Part 2 read-only) was fixed afterwards.

| Round | Critical | High | Medium | Low | Handled |
|---|---|---|---|---|---|
| 1 | 0 | 0 | 4 | 1 | all fixed (operator throw after approval; legacy decode; stake-blind evidence; zero-stake approval + receipts; optional community type) |
| 2 | 0 | 0 | 2 | 2 | all fixed (unsafe Part 2 cleanup → snapshot/revert + read-back; `roleConfigs` not in ABI; minStake-0 approval; vacuous control at minStake 1) |
| 3 | 0 | 0 | 2 | 1 | all fixed (operator approval vs encoded stake; operator receipts; code-3-only revert classifier) |
| 4 | 0 | 0 | 2 | 1 | all fixed (hex-case role ids; credit read for the registered account; missing operator tests) |
| 5 | 0 | 0 | 0 | 0 | — |

## Round 1

**Critical: none found. High: none established.** I found four Medium issues and one Low issue. Two Medium issues are existing integration gaps exposed by the repaired registration path.

**Medium — The new exception breaks an existing operator flow after spending gas.**  
`packages/sdk/src/utils/roleData.ts:80`; `packages/sdk/src/clients/operator.ts:171–205`

`_onboardOperator` calls `RoleDataFactory.endUser()` before checking whether the account already holds ENDUSER. Previously, an existing role holder could skip registration and continue; now this path always throws. It also throws **after** sending and confirming the approval transaction, contradicting the changelog’s “fail early” description.

Concrete scenario: an existing ENDUSER invokes operator onboarding with ENDUSER and no explicit roleData. Approval succeeds, then onboarding aborts before the existing-role check or deposit.

Fix: check existing membership first, and validate/build any required registration data before sending transactions. Add a community parameter or require explicit roleData when registration is necessary. Test both existing and new role holders.

**Medium — The replacement decoder silently misinterprets legacy payloads.**  
`packages/sdk/src/utils/roleData.ts:117`; `packages/core/src/roleData.ts:31`

The public `decodeEndUser` now interprets the first two words as the new layout without checking payload length or distinguishing formats. A previously generated dynamic five-field tuple begins with offset `0x20`, followed by the account address. The new decoder therefore returns community `0x0000000000000000000000000000000000000020` and the account interpreted as a stake amount.

Concrete scenario: an application upgrades and decodes stored payloads produced by the previous factory. It receives plausible typed values containing incorrect data instead of a migration error. Consumers accessing `.account`, `.avatarURI`, or `.ensName` also lose those fields.

Fix: make the new decoder reject noncanonical payload lengths, provide an explicitly named legacy decoder if compatibility is required, and document this as a breaking API migration. Add a legacy-payload rejection test. I found no production in-repository consumer of the old decoder result, so external-consumer impact remains unmeasured.

**Medium — The evidence script can PASS without verifying the stake semantics claimed by its rows.**  
`tests/regression/onchain-evidence/enduser-roledata-sepolia.ts:49`, `:63–67`, `:73`

Classification discards custom-error arguments and compares only error names. Both zero/default stake and explicit `0.3 GT` expect `ERC20InsufficientAllowance`.

Concrete counterexample: change the factory to ignore `stakeAmount` and always encode zero. The explicit-`0.3 GT` evidence row can still PASS whenever the default stake requires allowance. A Registry that ignores the second word could likewise produce the expected outcomes. An allowance failure also does not establish that later registration/SBT operations would succeed.

Fix: retain and verify allowance-error arguments, query the relevant role configuration, and choose explicit stakes distinguishable from the default. Add invalid-community and mismatched-sender controls. Describe the result narrowly as reaching an allowance failure; establish the exact struct and validation order using a pinned contract source or independently verified fixture.

The vendored ABI confirms `registerRole(bytes32,address,bytes)` and lacks `registerRoleSelf`; it **does not expose the internal struct or sender check**. Existing repository documentation is inconsistent: `docs/aoa/cc128/five_scenarios.md:110` still describes five fields. The new tests prove the chosen encoding, not independently that deployed Registry versions use it.

**Medium — Zero/default stake still bypasses required approval in `UserClient`. Existing gap.**  
`packages/enduser/src/UserClient.ts:400`, `:411`, `:430`

Under the new documented semantics, zero means the Registry minimum. Approval still compares allowance against the literal input.

Concrete scenario: a funded AA with zero allowance calls `registerAsEndUser(community, 0n)`. `0n < 0n` is false, so approval is skipped, while registration requires a positive minimum stake and reverts. If submission returns a mined reverted receipt, this method ignores its status and returns the hash.

Fix: resolve the effective required amount before the allowance check and reject unsuccessful receipts. Add a zero-stake/zero-allowance test; the current tests use positive stakes and cannot expose this case.

**Low — Required community remains optional in the public TypeScript signature.**  
`packages/sdk/src/utils/roleData.ts:73–80`

`RoleDataFactory.endUser()` and `{ stakeAmount: 1n }` still compile despite now being guaranteed failures. This is why the unchanged operator caller survives type checking.

Fix: require both `params` and `community` in the signature, then migrate callers.

Additional conclusions:

- `UserClient` correctly supplies the AA address because registration executes through that AA. `joinAndActivate` correctly supplies the signing EOA/JSON-RPC account for a direct transaction; an absent account already throws.
- `joinAndActivate` still registers the EOA while its credit lookup can use `aaAddress` (`endUser.ts:190`). It therefore does **not** establish AA activation. This is an existing identity mismatch; AA onboarding needs execution through the AA, not merely substituting its address in `user`.
- Remaining library `registerRoleSelf` calls use the compatibility wrapper at `packages/core/src/actions/registry.ts:368`, which already sends `registerRole`. I found no remaining five-field ENDUSER encoder in production package code.
- The receipt status check matches viem’s standard receipt contract. I found no supported caller requiring numeric or absent status; arbitrary monkey-patched clients are not evidence of a regression.
- The tests would detect the original selector and encoding mistakes, but do not cover the integration failures above. No new browser-only or ESM import defect was apparent.
- The evidence script performs no chain writes or signing, but does write its Markdown report locally.

Review was static and confined to this worktree. I did not run tests, builds, network calls, or RPC.

## Round 2

Critical: none found. High: none found. **Two Medium and two Low findings remain.**

Reviewed the current diff and untracked files without network/RPC access. I did not run builds or tests.

**Round‑1 findings**

| Finding | Round‑2 assessment |
|---|---|
| M1: operator approval sent before missing-community error | **Fixed for that failure.** Missing ENDUSER data now fails before transactions. Existing roles skip the GToken approval; deposits still run when requested. COMMUNITY/PAYMASTER encoding choices are unchanged. However, the new successful-onboarding test hides an ABI failure described below. |
| M2: decoder silently misreads legacy data | **Fixed.** Exact 64-byte length rejects both old encodings; checking the leading 12 bytes rejects noncanonical address words. |
| M3: evidence does not establish stake semantics | **Partially fixed.** Part 2 checks a fresh registration’s recorded stake and exact below-minimum error arguments. That meaningfully tests the local deployment, not Sepolia’s implementation. Cleanup remains unsafe. |
| M4: zero-stake approval and reverted receipts | **Fixed for the reported cases.** `getRoleConfig` returns the named tuple used here; zero stake includes minimum plus ticket, positive subminimum stake fails before sending, and reverted receipts throw. Zero-minimum behavior remains inconsistent with Part 2’s stated contract semantics. |
| L1: community optional in type | **Fixed.** Both the factory parameter and its `community` field are required. |

**Medium — Part 2 can leave configuration changed and still report successful restoration**

`tests/regression/onchain-evidence/enduser-roledata-sepolia.ts:128` and `:162`

The initial configuration transaction and receipt wait occur **outside** `try/finally`. If it mines but the receipt request times out, restoration never runs. Moreover, `wait` does not inspect receipt status: a reverted restoration transaction can resolve normally, allowing the script to report PASS and “restored afterwards” while the raised minimum remains active.

Concrete scenario: registration checks succeed, but restoration is mined reverted. `finally` finishes normally and the report asserts restoration.

**Fix:** Enter the cleanup scope before submitting the mutation, check every relevant receipt, and read back the restored configuration before reporting success. Prefer a disposable Anvil instance or snapshot/revert with verified cleanup.

**Medium — Operator’s successful-path test accepts a function absent from the vendored ABI**

`packages/sdk/src/clients/operator.ts:190`  
`packages/sdk/__tests__/operator-onboard.test.ts:17`

The operator still calls `roleConfigs`, but `Registry.json` exposes `getRoleConfig` and contains no `roleConfigs` function. The test supplies an invented `[0n, ticket]` response, bypassing ABI encoding entirely.

Concrete scenario: a fresh PAYMASTER_SUPER registration passes the reordered `hasRole` check, then viem fails to encode `roleConfigs`; approval and registration never happen. This defect predates the reorder, but the newly added test incorrectly claims this path works.

**Fix:** Call `getRoleConfig` and access its named fields. Make the mock reject functions absent from `RegistryABI`, or test through a mocked transport so viem performs real ABI encoding.

**Low — Approval calculation disagrees with the zero-minimum semantics asserted by the evidence script**

`packages/enduser/src/UserClient.ts:400`

Part 2 explicitly states that Registry ignores the supplied stake when `minStake === 0n`. This calculation nevertheless includes a positive supplied stake.

Concrete scenario: minimum zero, ticket 0.3 GT, existing allowance 0.3 GT, requested stake 100 GT. Registration supposedly needs only the ticket, but the client sends an unnecessary approval for 100.3 GT and leaves excess allowance.

**Fix:** Confirm the contract rule and calculate the effective stake consistently, including the zero-minimum branch. Add that case to the allowance tests.

**Low — The negative stake control fails for a valid minimum of one wei**

`tests/regression/onchain-evidence/enduser-roledata-sepolia.ts:141`

For `minStake === 1n`, `below` becomes zero, which means “use the minimum,” not “insufficient stake.” A correct contract therefore fails the expected `InsufficientStake(0, 1)` check.

**Fix:** Configure a test minimum greater than one whenever needed, restoring it afterward, or explicitly skip this negative control when no positive subminimum value exists.

Other review conclusions:

- The vendored ABI confirms `registerRole(bytes32,address,bytes)` and the absence of `registerRoleSelf`; **it cannot establish the internal layout of opaque `bytes`**. No Solidity implementation was found in this worktree. The two-field premise therefore relies on the supplied evidence report and external-source assertions, not independently inspectable contract source.
- `UserClient` correctly names its AA address because it calls through that account’s `execute`. `joinAndActivate` correctly names its bound transaction account for EOA/JSON-RPC use. It rejects an absent account. Setting `aaAddress` does **not** make registration target that AA; it only changes the credit query. This limitation predates the change.
- Remaining library `registerRoleSelf` calls use the compatibility wrapper that sends `registerRole`. I found no remaining five-field ENDUSER encoder in library source or production consumer of the old decoder result.
- The receipt check matches normal viem receipts. Custom replacements returning undefined or raw RPC status values will now fail; they do not satisfy the declared viem receipt contract.
- Factory construction and decoding have intentional public API breaks. They need migration/release treatment; no additional browser or ESM regression was apparent from static inspection.

## Round 3

**No Critical or High findings remain.** The four round-2 findings are fixed, but operator onboarding still has two Medium issues.

Static review only: I read within this worktree and used no network/RPC. I did not execute tests or the evidence script.

**Round-2 disposition**

| Finding | Status | Assessment |
|---|---|---|
| Ma — unsafe evidence cleanup | Fixed | All mutations are inside `try/finally`; transaction receipts are checked; `evm_revert` must return true; successful runs verify restored configuration and role absence. On exceptional paths, restoration read-back is skipped, but the run fails rather than reporting PASS. |
| Mb — nonexistent `roleConfigs` getter | Fixed | `getRoleConfig` exists in the vendored ABI and returns a named tuple containing `ticketPrice`. The mock now rejects nonexistent Registry functions. |
| La — approval when `minStake = 0` | Fixed | `UserClient` now calculates zero effective stake in this case and approves only the ticket. |
| Lb — vacuous control at `minStake = 1` | Fixed | Raising every minimum below 2 makes `minStake - 1` positive. The script checks both `InsufficientStake` arguments. |

**Medium — Operator approval still does not match the encoded stake.**  
`packages/sdk/src/clients/operator.ts:193–203`

Approval uses the separate `stakeAmount` argument, ignoring both `roleConfig.minStake` and the stake inside supplied `roleData`.

Concrete failure: call `onboardOperator` for ENDUSER with `stakeAmount: 0n` and `RoleDataFactory.endUser({ community })` while the role has a positive minimum. The encoder correctly requests the minimum, but onboarding approves only the ticket. Registration fails when Registry pulls the stake. A supplied payload containing a stake larger than the separate argument causes the same failure.

Suggested fix: derive approval from the effective stake Registry will consume, and reject inconsistent arguments before sending anything. Add a test with a positive minimum and encoded stake zero, plus a conflicting explicit stake. The getter fix is correct; this is a remaining defect in the now-reachable flow.

**Medium — Operator onboarding treats reverted transactions as successful steps.**  
`packages/sdk/src/clients/operator.ts:207–217`

Both receipt results are discarded. The same occurs for the subsequent deposit.

Concrete failure: registration is submitted, then reverts because configuration changes before inclusion. `waitForTransactionReceipt` returns a receipt with `status: 'reverted'`; onboarding proceeds to deposit or returns the transaction array successfully. A reverted approval can similarly lead to an unnecessary registration attempt.

Suggested fix: require successful receipts before advancing, as the two end-user paths now do. Test reverted approval and registration receipts, asserting that subsequent writes never occur. This behavior predates the patch but remains in the onboarding code being repaired.

**Low — Evidence can classify a non-execution error as the expected empty revert.**  
`tests/regression/onchain-evidence/enduser-roledata-sepolia.ts:53–57`

The classifier accepts any caught error containing a string `data` field. In particular, `data: '0x'` becomes “revert without data” without checking that execution actually reverted.

Concrete failure: an RPC gateway rejects the old-selector request with a non-execution error carrying `data: '0x'`. That row matches its expected result, allowing overall PASS if the other rows match, even though the selector was not executed.

Suggested fix: establish that the error represents an EVM execution revert before interpreting its data. Treat transport/provider failures as inconclusive or fatal. Add classifier tests for a provider error with empty data and a genuine empty execution revert.

The remaining premises and compatibility checks look as follows:

- **Struct evidence:** the ABI exposes `roleData` as opaque `bytes`; it cannot establish the internal struct or sender restriction. No Solidity source was found in the worktree. Existing documentation supports the sender restriction, and the supplied report supports two-field behavior, but those deployment claims were not independently verified here. The encoder tests assume the struct they test.
- **Self selection:** `joinAndActivate` targets its bound account, correctly matching direct EOA/JSON-RPC sends. Missing accounts fail before sending. It does not execute through a smart account. `UserClient` does execute through its configured AA, making that AA the correct `user`.
- **`aaAddress`:** the existing credit lookup can query a different address from the registered account. Setting it does not redirect registration to the AA; callers must not interpret this method as AA onboarding.
- **Remaining library callers:** `registerRoleSelf` usages in packages go through the compatibility wrapper, which calls `registerRole`. I found no remaining five-field ENDUSER library encoder or production consumer of the old decode result.
- **Public API:** requiring `community` and changing the decoder shape are real, documented breaking changes. Existing in-repo factory callers supply a community.
- **Receipts and packaging:** the new end-user receipt checks match viem’s receipt contract. Custom replacements returning another shape are incompatible, but no such production caller was found. The new core module introduces no Node-only dependency or apparent ESM/browser export problem.

## Round 4

**Critical: none. High: none.** I found one remaining edge case in the round-3 stake fix, one pre-existing account inconsistency, and a test coverage gap.

Round-3 findings:

- **Approval amount: fixed for canonical ENDUSER role IDs, but incomplete for differently cased hex IDs**—see M1.
- **Reverted receipts: fixed.** Approval, registration, and deposit now require `status === 'success'`.
- **Evidence classification: fixed.** Arbitrary errors containing `data` no longer qualify; the classifier requires code `3` and valid hex revert data. Unsupported provider error formats fail inconclusively rather than passing.

**Medium**

1. **ENDUSER stake validation depends on hex letter casing.**  
   `packages/sdk/src/clients/operator.ts:198`

   `roleId === keccak256(...)` compares strings, while ABI encoding treats differently cased hex strings as identical bytes32 values.

   **Failure scenario:** Pass an uppercase-body ENDUSER ID, `stakeAmount: 0n`, and role data encoding a positive stake. The ENDUSER branch is skipped, so approval covers only the ticket. Registry still recognizes ENDUSER and attempts to collect the encoded stake; registration fails after the approval transaction. The consistency and below-minimum checks are also bypassed.

   **Fix:** Normalize the role ID before every role-specific comparison, or compare decoded bytes. Add a mixed-case ENDUSER test asserting the effective approval amount and mismatch rejection.

2. **Registration and credit reporting can refer to different users — pre-existing, not introduced here.**  
   `packages/sdk/src/clients/endUser.ts:166`, `:175`, `:190`

   Registration and SBT lookup use `accountToUse.address`, but credit lookup prefers the untyped `client.aaAddress`.

   **Failure scenario:** A client bound to EOA A has `aaAddress = B`. `joinAndActivate` registers A and returns A’s SBT alongside B’s credit, while B remains unregistered. Separately, `executeGasless` derives an AA at line 215; successful EOA registration does not establish that AA’s eligibility.

   **Fix:** Define this method explicitly as signer registration and query that same signer’s credit. For AA onboarding, provide a separate path through the AA’s `execute`, as `UserClient.registerAsEndUser` does. Merely substituting B into `registerRole` would violate the sender requirement.

**Low**

1. **The operator tests do not protect all newly fixed branches.**  
   `packages/sdk/__tests__/operator-onboard.test.ts:42`, `:55`

   They cover an encoded zero stake, inconsistent/below-minimum stakes, and reverted approval/registration. They do not cover a reverted deposit, a successful nonzero encoded stake, or ENDUSER with `minStake === 0`.

   **Failure scenario:** Removing the deposit receipt check, or incorrectly applying a nonzero encoded stake when the minimum is zero, would leave these tests passing.

   **Fix:** Add focused cases for those three behaviors, including deposit failure when the role is already held.

Other review conclusions:

- The vendored ABI confirms `registerRole(bytes32,address,bytes)`, absence of `registerRoleSelf`, and named `getRoleConfig` fields. **It cannot prove the internal ENDUSER struct or `_enforceMinStake` semantics.** No Registry Solidity source was found in scope. The checked-in evidence supports the claimed behavior, but I did not independently reproduce it.
- The two-field static encoding is correct **given the claimed struct**.
- The new `self` arguments match their actual call paths: bound local/JSON-RPC signer for `joinAndActivate`; AA address for `UserClient.execute`. Missing accounts are rejected.
- Remaining library `registerRoleSelf` calls use the existing wrapper that sends `registerRole`. I found no remaining five-field ENDUSER encoder in library code or production consumer of the old decoder shape.
- Standard viem receipts support the new status check. Custom replacements returning void or raw numeric status would fail; those do not satisfy the declared receipt contract.
- The evidence script’s Sepolia portion is read-only. Its optional Anvil portion **sends transactions**, then restores a snapshot.
- No new browser/ESM issue was apparent. The factory argument and decoder changes are public API breaks, documented in the changelog.

Review was static and confined to this worktree. No network, RPC, builds, or tests were run. `git diff origin/main --check` passed.

## Round 5

**No Critical or High findings remain. I found no new actionable Medium or Low defect in the current diff.** All three round-4 findings are fixed by static inspection.

| Round-4 finding | Status | Evidence |
|---|---|---|
| Medium: case-sensitive operator role IDs | Fixed | `packages/sdk/src/clients/operator.ts:173` normalizes the role ID before both default-data selection and ENDUSER stake validation. The uppercase regression tests exercise both branches. |
| Medium: credit queried for `aaAddress` instead of the registered signer | Fixed | `packages/sdk/src/clients/endUser.ts:190` queries the same account passed to `registerRole`. The test sets a different `aaAddress` and asserts the credit-query argument. |
| Low: missing operator edge-case tests | Fixed | `packages/sdk/__tests__/operator-onboard.test.ts` now covers reverted deposits, nonzero encoded stake, and `minStake === 0`. These assertions would detect removal of the relevant checks/calculation. |

Severity results:

- **Critical:** None found.
- **High:** None found.
- **Medium:** None newly identified.
- **Low:** None newly identified.

The main premises and boundaries checked:

- **Registry ABI:** `Registry.json:665` confirms `registerRole(bytes32,address,bytes)`; `getRoleConfig` returns a named tuple containing `minStake` and `ticketPrice`. There is no `registerRoleSelf` ABI entry. However, opaque `bytes` does **not** establish the ENDUSER struct or sender restriction. Those claims rely on the repository’s documented contract observations and saved evidence; I could not independently authenticate the external Solidity revision under this review’s scope.
- **Identity:** `joinAndActivate` explicitly sends from—and registers—the configured account. This is consistent for local EOAs and JSON-RPC accounts; without an account it throws before sending. It does not execute through a separately configured smart account. `UserClient.registerAsEndUser` does execute through `accountAddress`, making that AA the appropriate Registry `user`.
- **Remaining callers:** Remaining library `registerRoleSelf` calls use the compatibility wrapper in `packages/core/src/actions/registry.ts:368`, which sends `registerRole`. I found no remaining five-field ENDUSER encoder in library code, no production consumer of the old decode properties, and no remaining production call to `RoleDataFactory.endUser()` without arguments. Script debt remains explicitly recorded.
- **Receipts:** The success check matches viem’s receipt contract. A custom replacement returning `undefined` or numeric status would fail, but I found no supported in-repository caller requiring that behavior.
- **Evidence:** Transport failures cannot satisfy the expected revert rows: classification requires execution-error code `3` and hex revert data. The Sepolia rows establish only progress to the allowance failure, not successful registration or stake handling; the report explicitly distinguishes that limitation. **The whole script is not read-only:** optional Part 2 sends local transactions and restores a snapshot. The default Sepolia branch uses reads/`eth_call`.
- **Compatibility:** Requiring `community` and changing the decoder’s return shape are intentional public API breaks documented in the changelog. The new core module adds no Node-only dependency and uses the existing ESM export convention.

I inspected the full tracked diff and all listed untracked additions. `git diff --check origin/main` passed. Tests/builds and evidence scripts were **not executed**; no network, RPC, environment files, or files outside this worktree were accessed.

