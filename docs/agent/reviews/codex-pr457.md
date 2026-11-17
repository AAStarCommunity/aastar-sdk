# Codex Tier-1 review of PR #457 (codex exec, read-only sandbox, static)

Final review text of each round, verbatim. Round 1 reviewed 625d3bd3 (whole PR); round 2 the diff 625d3bd3..e08a9c6a; round 3 the diff e08a9c6a..7f092e3f.

## Round 1

**Request changes.** The helper improves deployment verification, but the stated invariant does not hold across the funding workflow. **No Critical findings.** I found two High, two Medium, and one Low finding.

1. **High — The verified address is discarded; funding still targets a separately configured address.**  
   [`packages/sdk/src/clients/operator.ts:126`](/Users/jason/Dev/aastar/aastar-sdk/.claude/worktrees/pm-owner/packages/sdk/src/clients/operator.ts:126), also lines 94–99.

   `deployPaymasterV4()` verifies clone **P**, then returns only the transaction hash. The client’s `addDeposit`, `addStake`, and `depositFor` methods remain bound to `usedAddresses.paymasterV4`, which can be **Q**.

   **Failure scenario:** An operator successfully deploys and verifies P, then calls `client.addDeposit({ value })`. ETH goes to configured Q without any verification of Q. A stale predicted address occupied by an attacker remains a dangerous funding target despite the successful check.

   `PaymasterOperatorClient.setupPaymasterDeposit()` similarly accepts an arbitrary paymaster and sends without verification at `packages/operator/src/PaymasterOperatorClient.ts:435`.

   **Fix:** Bind operator funding methods to the verified factory/operator/paymaster identity, and validate the actual transaction target before sending. Return the verified address or a bound client from deployment. If generic deposit APIs intentionally support third-party paymasters, explicitly separate that behavior and narrow the claimed invariant.

2. **High — Verification is neither a coherent chain snapshot nor a guarantee at transaction execution.**  
   [`packages/core/src/actions/factory.ts:749`](/Users/jason/Dev/aastar/aastar-sdk/.claude/worktrees/pm-owner/packages/core/src/actions/factory.ts:749), lines 767–770; `packages/operator/src/PaymasterOperatorClient.ts:217`.

   Receipt waiting specifies no confirmation/finality policy. The three reads independently use the latest state, without a common block identifier. The operator then performs additional reads and potentially waits for an approval transaction before registration.

   **Failure scenario:** On an older factory, a deterministic deployment is verified on a subsequently orphaned branch. On the replacement branch, an attacker takes the same salt/address. A later permissionless deposit to the previously verified address can still execute for the attacker’s clone. A factory without Registry gating cannot be assumed to exclude the attacker.

   Ordinary ownership changes between checking and sending also invalidate the check. Parallel latest-state reads can span different heads; they do not prove all conditions held simultaneously.

   **Fix:** Pin verification reads to one canonical block, apply a chain-appropriate finality policy, and revalidate immediately before subsequent writes. For the strict invariant **at execution**, enforce identity checks atomically with the protected operation on-chain. Repeated client-side reads only reduce the race; they cannot eliminate it. Do not describe this helper as making older factories unconditionally safe.

3. **Medium — The advertised deployment-then-registration workflow conflicts with factories requiring AOA registration first.**  
   [`packages/operator/src/PaymasterOperatorClient.ts:209`](/Users/jason/Dev/aastar/aastar-sdk/.claude/worktrees/pm-owner/packages/operator/src/PaymasterOperatorClient.ts:209), registration at line 258.

   The workflow checks only COMMUNITY before deployment and registers AOA afterward. The vendored ABI explicitly exposes `NotRegisteredPaymasterAOA`, `registry`, and `setRegistry`.

   **Failure scenario:** With a Registry-configured factory enforcing that prerequisite, a fresh COMMUNITY operator without AOA reverts during deployment and never reaches verification or registration. The success test explicitly models “COMMUNITY present, AOA absent” while making deployment succeed unconditionally.

   **Evidence qualification:** ABI declarations alone cannot establish which deployed versions enforce this prerequisite or its exact conditional behavior. Consequently, the PR has not established the advertised compatibility. This ordering predates the patch, but the new documentation recommends it as the replacement workflow.

   **Fix:** Preflight the factory’s actual Registry configuration and supported behavior. Require existing AOA membership where necessary and explain the prerequisite. If “no registration before verified deployment” is mandatory, a contract-level workflow change is needed for factories with this ordering requirement.

4. **Medium — Reverted registration is still reported as successful completion.**  
   [`packages/operator/src/PaymasterOperatorClient.ts:264`](/Users/jason/Dev/aastar/aastar-sdk/.claude/worktrees/pm-owner/packages/operator/src/PaymasterOperatorClient.ts:264), also approval receipt at line 246.

   These receipt waits ignore `status`, unlike the new deployment check.

   **Failure scenario:** Deployment verification passes, but registration reverts because the operator lacks sufficient stake or prerequisites change. The method nevertheless returns `registerHash` as a completed result. Callers may proceed to funding assuming onboarding succeeded. A reverted approval likewise does not stop the sequence immediately.

   **Fix:** Require successful receipts for every dependent transaction and report partial completion, including the deployed address and failed transaction hash. Add reverted-approval and reverted-registration tests. This is an existing defect left in the newly advertised safe workflow.

5. **Low — The preparation docs still claim deleted automation exists.**  
   [`docs/guide/task_breakdown.md:20`](/Users/jason/Dev/aastar/aastar-sdk/.claude/worktrees/pm-owner/docs/guide/task_breakdown.md:20), and the corresponding Chinese document.

   The updated paragraph announces deletion, but the following checked items still claim a unified script performs account computation, ETH funding, identity checks, and asset transfers. `PaymasterOperatorClient` does not replace those operations.

   **Failure scenario:** Someone following the experiment preparation checklist assumes those prerequisites are automated and complete.

   **Fix:** Mark the automation retired or incomplete and identify actual replacements. Narrow “before funding” language to the operations that are truly guarded.

The tests provide useful coverage of receipt failure, wrong emitter/operator, duplicate matching events, mapping mismatches, and incorrect ownership. They **do not establish the end-to-end invariant**:

- SDK tests stop after deployment and never inspect a subsequent funding target.
- Operator tests replace the verifier with a mock and do not model factory prerequisites.
- Core mapping mocks ignore the queried factory address and arguments; querying the wrong factory/operator could escape detection.
- No cases cover reorgs, changing ownership, mixed-block responses, malformed logs, RPC failures, or mixed-case addresses.
- Encoding events with the same ABI used to decode them tests internal consistency, not independent compatibility with deployed contracts.

The implementation’s `isAddressEqual` comparisons are appropriate. Filtering by factory emitter and rejecting missing or duplicate matching events are also sound. It counts events **for the caller**, rather than requiring exactly one deployment event in the entire receipt; clarify that wording if global uniqueness was intended.

**The two script deletions are justified.** The diff shows unsafe predicted-address funding in `01_prepare_all.ts`, and obsolete calls/imports in `deploy_paymaster_v4.ts`. The problem is the replacement’s overstated guarantees, not removal of those scripts. The unrelated FU-115 documentation addition is scope noise.

This was a static review of worktree files only. I did not run tests, contact any network/RPC, or read `.env` files or keystores.

## Round 2

**Request changes.** Round 2 improves the implementation, but H2 is only partially addressed. **No Critical findings. No new High findings.** I found three Medium issues and two Low test gaps.

Round-1 disposition:

| Finding | Disposition | Reason |
|---|---|---|
| **H1 — Funding targets not bound to verification** | **Acceptably deferred/disclosed** | `CHANGELOG.md:19` explicitly excludes generic funding methods, and `docs/agent/followups.md:114` tracks the implementation and API change in FU-116. The underlying risk remains; this PR no longer claims to fix it. |
| **H2 — Snapshot consistency and transaction-time safety** | **Still open, partially addressed** | Block-number pinning improves consistency, and the transaction-time limitation is appropriately disclosed. However, block identity is not verified, and the deployment wrappers cannot request more confirmations. See below. |
| **M3 — Deployment before required AOA registration** | **Acceptably deferred/disclosed** | FU-116 explicitly records the existing ordering failure and required follow-up. This is a deferral, not established compatibility with Registry-gated factories. A warning alongside the recommended workflow would make the limitation easier to find. |
| **M4 — Reverted approval/registration reported as success** | **Resolved** | `PaymasterOperatorClient.ts:246–269` checks both receipts and throws with the failed hash and deployed address. The new tests exercise both reverted outcomes. |
| **L5 — Deleted preparation automation still marked complete** | **Resolved** | Both preparation guides mark automation retired and identify the checks requiring manual work. |

1. **Medium — A common block number does not establish a common block identity.**  
   **Location:** `packages/core/src/actions/factory.ts:767–777`; corresponding claim at `CHANGELOG.md:12–14`.

   **Failure scenario:** The receipt comes from block hash A at height N. A reorg occurs during verification, or a load-balanced endpoint serves backends on different branches. Calls using `blockNumber: N` can read different hashes at that height. The function never compares them with `receipt.blockHash`; consequently, success does not establish the claimed single snapshot. This is separate from the acknowledged possibility of ownership changing *after* verification.

   **Fix:** Pin calls to a block hash with canonicality enforcement where supported. Otherwise, detect changed block identity and reject/retry the entire verification, while documenting the weaker guarantee. Add a test where height stays constant but the hash changes; checking only `call.blockNumber` cannot catch this.

2. **Medium — Confirmation policy stops at the helper and cannot protect the automatic workflow.**  
   **Location:** `packages/operator/src/PaymasterOperatorClient.ts:217`; `packages/sdk/src/clients/operator.ts:126`.

   **Failure scenario:** An operator needs several confirmations before staking. Neither wrapper exposes or forwards `confirmations`; the automatic deployment-and-registration method proceeds using the receipt wait’s default. Calling the verifier separately afterward is too late to delay registration.

   **Fix:** Expose and forward a confirmation option through both public deployment APIs. Document the default and the no-hash branch’s policy. Test propagation through the wrappers, not just direct invocation of the core helper. The author’s “passing confirmations through” description currently applies only inside the helper.

3. **Medium — Receipt-block reads introduce an undocumented historical-state requirement.**  
   **Location:** `packages/core/src/actions/factory.ts:767–777`.

   **Failure scenario:** A caller verifies an older deployment hash against a node that retains receipts but has pruned that block’s execution state. Receipt lookup succeeds, but the pinned contract calls fail. A sufficiently long confirmation wait can encounter the same limitation on a provider with restricted state history. The helper surfaces the raw read failure without explaining that verification was unavailable despite a successful deployment.

   **Fix:** Explicitly document the historical-state requirement and wrap failures with deployment hash, block and verification-stage context. Alternatively, offer an explicit recent-snapshot verification mode with accurately stated semantics. Do not silently fall back to independent latest reads. Add a pruned-state rejection test and verify that dependent writes remain blocked.

4. **Low — The case-insensitivity test never changes address casing.**  
   **Location:** `packages/core/__tests__/actions/verifyPaymasterDeployment.test.ts:57–59`.

   **Failure scenario:** `OPERATOR` contains only `2` digits. Uppercasing and lowercasing produce identical addresses, so replacing `isAddressEqual` with strict string equality would still pass this test.

   **Fix:** Use an address containing hexadecimal letters, provide genuinely different casing across event/mapping/owner values, and assert that the fixture strings differ.

5. **Low — The strengthened fake still accepts the wrong paymaster target.**  
   **Location:** `packages/core/__tests__/actions/verifyPaymasterDeployment.test.ts:37–38`.

   **Failure scenario:** The receipt identifies PM, but a regression queries PM2 for `owner()` or the reverse mapping. The fake accepts either address and returns the same valid identity. The happy-path owner assertion catches an incorrect owner target there, but no equivalent assertion requires the reverse lookup to use the receipt-derived PM.

   **Fix:** Make the fake accept exactly the paymaster selected for that scenario, and assert exact reverse-mapping arguments. Add a successful PM2 deployment case so hardcoding PM also fails.

RPC read exceptions currently propagate and stop dependent writes; I found no new catch-and-continue bypass. The remaining error-handling issue is diagnostic context, not false success.

This was a static review only. I did not run tests, access the network/RPC, or read environment files, keystores, or files outside this worktree.

## Round 3

**Request changes.** The main unresolved issue is M1: the final hash check does not establish that the contract reads used that block’s state.

| Round-2 finding | Disposition | Reason |
|---|---|---|
| **M1 — Block identity** | **Still open** | Detects a different final hash, but permits reads from another branch when the final block lookup returns the original hash. The documentation overstates the guarantee. |
| **M2 — Confirmation forwarding** | **Resolved functionally; documentation still open (Low)** | Both new-deployment wrappers expose and forward `confirmations`, with propagation tests. The default and no-hash/reuse policy remain undocumented explicitly. |
| **M3 — Historical-state requirement** | **Resolved** | Documentation states the requirement. Ordinary read failures now include the block, deployment hash and underlying error message. The pruned-state test exercises this; propagation still blocks dependent writes. |
| **L4 — Ineffective casing test** | **Resolved** | Fixtures contain hexadecimal letters and exercise lowercase and checksummed callers against differently cased results. |
| **L5 — Fake accepts wrong paymaster** | **Resolved** | The fake accepts only the scenario’s paymaster, reverse-mapping arguments are asserted, and a successful PM2 case catches hardcoding PM. |

**Critical: none. High: none.**

**Medium — M1 remains: matching endpoint hashes do not bind intervening reads to that hash.**  
Location: `packages/core/src/actions/factory.ts:786–792`; overstated guarantee at `packages/core/src/actions/factory.ts:735–737` and `CHANGELOG.md:14`.

Concrete scenario: a load-balanced endpoint returns the receipt from branch A at height N. The mapping reads use A, but `owner()` uses branch B, where the operator owns the same address; on A, ownership has already been transferred within that block. The final `getBlock(N)` uses A again. Every comparison passes, although `owner()` on the receipt’s branch would fail. An A→B→A transition can similarly escape the endpoint comparison.

The new test covers only a different **final** hash, so it cannot demonstrate protection against this scenario.

Fix: bind execution reads to the expected block hash using a supported lower-level RPC path with canonicality enforcement, failing closed when unavailable. If retaining number-based reads, explicitly describe this as best-effort detection that assumes consistent RPC state, disclose mixed-backend/transient-branch limitations, and remove the unconditional “a reorg … throws” claim. Add a scenario where intermediate reads use another branch while the final hash matches.

**Low — Confirmation defaults and reuse semantics remain implicit.**  
Location: `packages/operator/src/PaymasterOperatorClient.ts:149,188`; `packages/core/src/actions/factory.ts:746–774`.

Concrete scenario: an initial deployment becomes visible in the mapping before its requested confirmation wait completes. A retry with `{ confirmations: 12 }` takes the reuse branch and can register immediately: that branch checks latest state without waiting for confirmations. This behavior is compatible with a deploy-receipt-only option, but the public documentation does not explicitly explain the distinction or the omitted-value default.

Fix: document the receipt-wait default and explicitly state that no-hash verification and reused deployments do not apply `confirmations`. Add a reuse-path test documenting that policy.

I found no additional independent defects in the round-3 diff. This was a static review; I did not execute tests, access network/RPC services, or read `.env` files, keystores, or files outside this worktree.

## Dispositions

| Round | Finding | Class | What was done |
|---|---|---|---|
| 1 | H1 funding methods not bound to the verified paymaster | deferred | FU-116 ①; CHANGELOG names the unchecked deposit methods |
| 1 | H2 no single snapshot / no finality | fixed in part, disclosed | one block for all reads, `confirmations`; client-side check documented as holding at that block only |
| 1 | M3 deploy before ROLE_PAYMASTER_AOA | deferred (pre-existing) | FU-116 ②; stated in the JSDoc and CHANGELOG |
| 1 | M4 reverted approve / register returned as success | fixed | both receipts checked; tests |
| 1 | L5 retired automation still marked done | fixed | task_breakdown 1.1 marked retired (en, zh) |
| 2 | M1 same height ≠ same block | fixed | block hash read back after the reads |
| 2 | M2 wrappers do not forward `confirmations` | fixed | both wrappers; propagation tests |
| 2 | M3 historical-state requirement | fixed | documented; read failure wrapped with block and deploy hash |
| 2 | L4 case test did not change case | fixed | addresses with hex letters, both directions |
| 2 | L5 fake accepted the wrong paymaster | fixed | fake answers only the scenario's paymaster; PM2 case |
| 3 | M1 end-point hash check does not bind the reads | fixed | every read is an EIP-1898 `eth_call` on `{ blockHash, requireCanonical: true }`; hash re-read kept |
| 3 | L confirmations default and reuse semantics implicit | fixed | documented in the JSDoc, the option comment and CHANGELOG |
