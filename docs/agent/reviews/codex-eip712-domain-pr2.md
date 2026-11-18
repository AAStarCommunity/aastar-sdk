# Codex Tier-1 review: MicroPaymentChannel / X402Facilitator domains and KMS payment pre-checks

`codex exec`, read-only sandbox, static, three rounds, all before the PR was opened. Round 1 reviewed a737128c (whole change); rounds 2–3 the response diffs. The round-3 Medium (M4 continuation) was fixed afterwards and not re-reviewed.

## Round 1

The invariant does **not** hold on every changed signing path. I found **2 High, 3 Medium, and 1 Low** issues. **Critical: none.**

1. **High — Hash presence does not establish the facilitator’s signing domain or type.**  
   `packages/core/src/utils/eip712Pinned.ts:153`

   A contract can contain every searched hash in unreachable code or unrelated functions while its verifier uses version `"2"`, a different struct, or a different domain construction. With no `DOMAIN_SEPARATOR()`, this check passes and `X402Client` signs an authorization the verifier rejects. The helper’s caveat acknowledges this, but the client treats its result as verified.

   **Fix:** Check an audited runtime-code identity, handling immutables and proxies explicitly, or use a trustworthy verifier/digest getter. Otherwise expose this as an explicitly unchecked, source-pinned assumption. Add an adversarial fixture containing all expected constants whose actual verifier uses a different domain; the current synthetic “code contains constants” test validates the faulty premise.

2. **High — GToken pre-check accepts a salted domain that the KMS does not sign.**  
   `packages/airaccount/src/server/services/kms-payment-signer.ts:124`

   A token reports EIP-5267 fields `0x1f`, with `GToken/1`, the expected chain/address, and a salt. `resolveEip712Domain` correctly validates its salted separator, but this condition compares only four fields. The ceremony proceeds and KMS signs the unsalted domain. Even an all-zero salt changes the domain type and separator.

   **Fix:** Compare the resolved separator with `domainSeparator()` of the **exact KMS domain**, rather than selected properties. Test both zero and nonzero salt and assert that neither the ceremony nor either signing endpoint is called.

3. **Medium — GToken’s available authorization type hash is never checked.**  
   `packages/airaccount/src/server/services/kms-payment-signer.ts:123`

   A token deployment or upgrade can preserve `GToken/1` while changing `TransferWithAuthorization`’s field order or types. The pre-check passes and the KMS produces an unusable signature. This mismatch is determinable: the vendored GToken ABI exposes `TRANSFER_WITH_AUTHORIZATION_TYPEHASH`.

   **Fix:** Read that getter and compare it with the hash of the KMS’s exact type string before the ceremony and signing request. Include a matching-domain/different-type test.

4. **Medium — Optional-separator detection fails open on error text and arbitrary reverts.**  
   `packages/core/src/utils/eip712Pinned.ts:65`

   Any error containing `revert` is accepted as evidence that the getter does not exist. A transport/provider error containing that word therefore suppresses verification. Separately, an existing getter that reverts because of contract state is also treated as absent.

   **Fix:** Classify structured execution errors separately from transport failures; never infer execution status from arbitrary message substrings. Restrict absent-getter fallback to known supported implementations or an explicit capability policy. Test wrapped transport errors containing “revert” and an existing getter that reverts.

5. **Medium — Channel domain and voucher type are checked at different blocks.**  
   `packages/channel/src/ChannelClient.ts:47`

   Domain reads are pinned internally, but `VOUCHER_TYPEHASH` is fetched at latest. Suppose an upgrade changes `(domain A, unsupported type)` to `(domain B, supported type)` between those reads. Both checks pass independently, producing a signature with domain A and the supported type—a combination neither implementation accepts.

   **Fix:** Return or share the block pin and read `VOUCHER_TYPEHASH` at that same block hash. Add a test that changes the latest state between reads and rejects any unpinned type-hash request.

6. **Low — Evidence attributes independent latest-state reads to one block.**  
   `tests/regression/onchain-evidence/eip712-domains-sepolia.ts:33`

   The recorded block number does not control subsequent reads. Each pinned resolver selects its own latest block, while the type hash and GToken reads are unpinned. The report can therefore claim a single-block PASS assembled from different states.

   **Fix:** Pin all evidence reads to one block hash, or record each observation’s actual block and avoid claiming a common snapshot.

The basic KMS ordering is correct: pre-checks precede the internal ceremony and signing request; voucher and PaymentPayload paths currently refuse. However, there are no GToken ceremony-path tests covering the failures above.

EIP-5267 bitmap/salt construction and rejection of extensions or unknown bits look sound in the new resolver. Omitting absent fields is appropriate; its documentation should clarify that chain/address equality is enforced **when those fields are present**.

The offline-signing and KMS-client requirements are documented behavioral breaks. The exported low-level signing helpers still permit unchecked domains, explicitly documented; they remain outside any blanket verified-signing guarantee.

The evidence script performs chain reads only, writes its report locally, and does not intentionally record RPC URLs, credentials, or raw error messages. I did not execute it or run tests. Review used worktree files only, with no network/RPC access or secret-file reads.

## Round 2

**Three round-1 findings are resolved; three remain partially open. The new diff adds one Medium issue. Critical: none.**

1. **H1 — Still open, High.**  
   `packages/x402/src/facilitatorDomain.ts:33`, `:58–66`

   The probe improves on searching bytecode constants, but it does not establish that real payments use the checked verifier/domain.

   A concrete false positive: an implementation retains the expected type hash but mistakenly encodes `to, from, asset` instead of `from, to, asset`. Because the probe sets **all three addresses equal**, its correct-domain signature passes and its wrong-domain signature fails. Real payments with distinct addresses fail signature verification.

   More generally, an implementation or proxy can select verification logic by caller, asset, or payer type. The probe exercises a fresh EOA calling for itself with an EOA as the asset; real settlement exercises different inputs and typically a facilitator operator. Both simulations sharing a block prevents an upgrade **between those simulations**, but does not prove they exercise the real payment’s branch.

   **Fix:** Use distinct probe values to catch encoding mistakes, and constrain the verification claim to an audited implementation and supported proxy routing, established at the pinned block. Otherwise describe and expose this as a source-pinned assumption with a behavioral compatibility check, not verified domain discovery. Add swapped-address and conditional-verifier fixtures.

   The other requested premise checks:

   - **False negatives:** Moving role or asset validation before signature validation makes both probes fail early, even when real authorized payments have valid signatures. This is fail-closed compatibility rejection; the existing role-first test explicitly demonstrates it.
   - **Different revert decoding as `InvalidX402Signature`:** Decoding establishes matching bytes, not their origin or meaning. A proxy or nested call can bubble the same selector; another error can collide with it. The negative control therefore does not independently prove entry into the intended signature check. Conversely, a correct signature followed by a downstream error with that selector is rejected.
   - **Known SP implementation:** Under the asserted uniform digest construction, check ordering, and unambiguous errors, the differential probe is useful. The worktree implementation does not establish those assumptions for the configured address.

2. **H2 — Resolved.**  
   `packages/airaccount/src/server/services/kms-payment-signer.ts:142`

   The comparison now uses the separator of the **exact unsalted KMS domain**. Zero and nonzero salts produce different separators and are rejected. Tests cover both ordinary and ceremony entry points.

3. **M3 — Resolved.**  
   `packages/airaccount/src/server/services/kms-payment-signer.ts:136`, `:145`

   The authorization type hash is compared with the KMS type, and both getters use the same block hash. A mismatching-type test was added.

4. **M4 — Still open, Medium; transport-text portion resolved.**  
   `packages/core/src/utils/eip712Pinned.ts:60`, `:74`

   Removing message matching fixes the reported transport-text bypass. However, JSON-RPC code `3` establishes execution reverted, **not getter absence**.

   **Failure scenario:** A proxy exposes `eip712Domain()` but its existing `DOMAIN_SEPARATOR()` reverts because of initialization, access control, or upgrade state. The resolver silently treats it as absent, and the channel continues signing from the report without the required comparison.

   **Fix:** Permit missing-getter fallback only through an explicit supported-implementation/capability policy. Otherwise reject the revert. Add a fixture with an existing getter that reverts. Current documentation still equates a structured revert with absence, so this is not acceptably disclosed.

5. **M5 — Resolved.**  
   `packages/channel/src/ChannelClient.ts:46`

   `VOUCHER_TYPEHASH` now uses the resolver’s block hash with `requireCanonical: true`. The updated test rejects unpinned reads.

6. **L6 — Still open, Low; snapshot attribution corrected.**  
   `tests/regression/onchain-evidence/eip712-domains-sepolia.ts:51–52`

   The report now correctly disclaims a common snapshot, and channel/GToken observations identify their blocks. The facilitator observation still records **no block**: `verifyFacilitatorDomain` returns only the domain.

   **Failure scenario:** Following a facilitator upgrade, the recorded PASS cannot be associated with the implementation state that produced it.

   **Fix:** Return the probe’s block hash/number and include it in the evidence row, preferably recording hashes for all observations.

**New problems introduced by round 2**

- **Medium — Non-execution errors with hex data count as successful positive probes.**  
  `packages/x402/src/facilitatorDomain.ts:48–53`, `:63`, `:70–73`

  `revertDataOf` accepts any sufficiently long hex `data` in an error chain without establishing an execution revert. Unknown data becomes `unknown-error-*`, which the positive probe accepts.

  **Concrete failure scenario:** A version-2 facilitator rejects the wrong-domain probe with `InvalidX402Signature`. The SDK-domain probe then encounters a provider/internal failure carrying hex diagnostic data. Instead of refusing because verification was unavailable, the helper returns the SDK’s version-1 domain and the client signs an invalid payment.

  **Fix:** Classify structured execution errors before extracting revert data; reject transport/internal errors regardless of their data. For the positive probe, accept only outcomes whose post-signature position is established for the supported implementation. Test a successful negative control followed by a non-execution error containing hex data.

**New Critical, High, and Low findings: none.** The remaining High and Low issues above are continuations of round-1 findings.

This was static review of worktree files only. I did not run tests, contact networks/RPCs, or read `.env` files, keystores, or other worktrees.

## Round 3

**M4 remains partially open (Medium). H1 is acceptably disclosed; the other round-2 findings are resolved. No independent new findings in round 3.**

| Round-2 finding | Status | Reason |
|---|---|---|
| **H1 — Facilitator probe** | **Acceptably disclosed** | `packages/x402/src/facilitatorDomain.ts:14–25,41,66–75` now uses distinct addresses and requires `InvalidX402Signature` for the wrong domain and `Unauthorized` for the SDK domain. The swapped-address defect is fixed. Uniform verification, check ordering, and error provenance remain assumptions, explicitly scoped to SP’s implementation. This is acceptable as the documented behavioral check, not independent implementation verification. |
| **H2 — Exact KMS domain** | **Resolved** | `packages/airaccount/src/server/services/kms-payment-signer.ts:139–142` still compares against the exact unsalted KMS domain separator. |
| **M3 — KMS type and snapshot** | **Resolved** | `packages/airaccount/src/server/services/kms-payment-signer.ts:127–144` retains the type-hash comparison and pins both getters to one block hash. |
| **M4 — Missing separator classification** | **Still open, Medium** | Explicit opt-in fixes the capability-policy omission, but the empty-revert classifier also accepts missing or unrecognized data. See below. |
| **M5 — Channel type-hash snapshot** | **Resolved** | `packages/channel/src/ChannelClient.ts:46–51` continues reading `VOUCHER_TYPEHASH` at the resolver’s canonical block hash. |
| **L6 — Facilitator evidence block** | **Resolved** | `packages/x402/src/facilitatorDomain.ts:77` returns the block hash and number; `tests/regression/onchain-evidence/eip712-domains-sepolia.ts:51–53` records both. |
| **Round-2 new Medium — Non-execution errors accepted** | **Resolved** | `packages/x402/src/facilitatorDomain.ts:84–88` extracts data only from a code-3 node, and the positive probe requires `Unauthorized`. Other errors cannot produce a passing result. |

**Remaining Medium — Unknown revert data is treated as empty.**  
`packages/core/src/utils/eip712Pinned.ts:62–63`

`d === undefined` covers both omitted data and data in an unsupported shape; neither establishes that the execution returned zero bytes.

**Concrete failure scenario:** An existing channel separator getter reverts with an initialization error, but the provider omits its revert bytes or returns them as `{ originalError: { data: '0x…' } }`. With `mayLackSeparator: true`, the helper treats this as getter absence and continues signing from `eip712Domain()` without comparing the separator. The new test’s “missing getter” fixture itself omits `data`, so it preserves this ambiguity.

**Fix:** Require explicitly decoded empty bytes (`'0x'`) for the fallback. Reject omitted or unsupported data shapes; add regression cases for both. An actual empty revert still cannot prove selector absence—that remaining ambiguity belongs to the caller’s declared capability assumption.

This is a continuation of M4, not a separate new finding.

**New-diff findings by severity:** Critical: none. High: none. Medium: none beyond the M4 continuation. Low: none.

Static review only. I did not run tests, access networks/RPCs, or read `.env` files, keystores, or files outside this worktree.

## Dispositions (final)

| Finding | Class | Where it ended |
|---|---|---|
| H1 code constants do not establish the facilitator's domain (r1), probe scope (r2) | fixed / disclosed | verifyFacilitatorDomain: two simulated settles at one block hash, distinct from/to/asset, wrong-domain probe → exactly InvalidX402Signature, SDK-domain probe → exactly Unauthorized (SP's post-signature role check); scope documented as a behavioural check of SP's X402Facilitator. Code-constant check removed |
| H2 salted GToken domain accepted (r1) | fixed | DOMAIN_SEPARATOR() vs the exact KMS domain's separator |
| M3 GToken type not checked (r1) | fixed | TRANSFER_WITH_AUTHORIZATION_TYPEHASH vs the KMS type, same block hash |
| M4 "absent DOMAIN_SEPARATOR()" too loose (r1, r2, r3) | fixed (r3 part not re-reviewed) | only with the caller's mayLackSeparator and an execution revert whose data is exactly '0x'; message text, missing or odd-shaped data, and reverting getters refuse |
| M5 channel typehash at another block (r1) | fixed | VOUCHER_TYPEHASH read at the domain's block hash |
| new M non-execution errors counted as probe results (r2) | fixed | revert data only from code-3 nodes |
| L6 evidence snapshot claim / missing facilitator block (r1, r2) | fixed | each row records its own block; the probe returns its block |
