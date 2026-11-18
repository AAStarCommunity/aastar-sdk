# Codex Tier-1 review: ETH/USD feed and account factory (no cross-chain defaults)

`codex exec`, read-only sandbox, static, five rounds, all before the PR was opened. Round 1 reviewed a0df50e9 (whole change); rounds 2–5 the response diffs. The two round-5 findings (Medium, Low) were fixed after round 5 and not re-reviewed (round budget). The JSON-RPC signer handling follows DSR's ruling of 2026-11-18.

## Round 1

**The invariant does not hold.** The changed paths improve default selection, but unchecked deployment paths remain, and validation is not bound to the chain used for signing.

Critical: none found. High: 3 findings. Medium: 5 findings. Low: 1 finding.

1. **High — Validation can occur on a different chain from deployment.**  
   Locations: `packages/operator/src/PaymasterOperatorClient.ts:194,218`; `packages/enduser/src/UserClient.ts:69–84`; `packages/sdk/src/clients/endUser.ts:116`.

   The operator and static account helper resolve and verify through the public client, then send through an independently supplied wallet. Neither compares their RPC chain IDs. A Sepolia reader with an OP wallet can approve Sepolia’s feed and then send it in an OP deployment. A wallet’s own chain assertion does not establish agreement with the reader. The SDK helper instead uses configured `chain.id`, without checking the live RPC chain.

   **Fix:** require agreement between live read-RPC chain ID, wallet chain ID, and configured chain; resolve using that verified ID and explicitly bind the transaction to it. Recheck after wallet interaction where necessary. Add mismatched-reader/writer and configured/live-chain tests that assert zero sends.

2. **High — Another public Paymaster deployment API bypasses feed validation entirely.**  
   Locations: `packages/sdk/src/clients/operator.ts:115–127`; `packages/core/src/actions/factory.ts:418,436`.

   `createOperatorClient().deployPaymasterV4()` forwards arbitrary `initData` without decoding or checking its feed. Both ordinary and deterministic core factory actions also bypass validation. A caller can still encode the Sepolia feed into an OP initializer and broadcast it. The subsequent deployment check verifies deployment identity, not feed suitability.

   **Fix:** make supported V4 deployment APIs accept structured initializer inputs and run the common validation before sending. For raw initializer APIs, decode and validate supported versions or explicitly expose them as unsafe primitives outside the stated guarantee. Route production callers through the checked API.

3. **High — Factory verification has explicit bypasses and uncovered creation paths.**  
   Locations: `packages/enduser/src/UserClient.ts:76`; `packages/enduser/src/testAccountManager.ts:74,103`; `packages/account/src/accounts/simple.ts:32`; `packages/core/src/actions/account.ts:158`.

   Passing `customAbi: SimpleAccountFactoryABI` skips verification completely, including the code check. The old v0.6 factory can therefore still create an incompatible account through the modified API.

   Separately, `TestAccountManager` uses the global factory directly and subsequently funds the predicted account. `toSimpleSmartAccount` constructs deployable initCode without checking the factory. The old address remains in `examples/for-iri/ts/src/4-gasless-tx.ts:48`, whose creation call is at line 134, and `scripts/test-faucet-and-gasless.ts:65`.

   **Fix:** do not use the presence of an ABI as permission to skip verification. Require an account-type-specific verifier for custom factories. Migrate the account helpers, examples, and deployment scripts to checked creation; retain unchecked primitives only under an explicit, narrower guarantee.

4. **Medium — The SDK still supplies a cross-chain factory default as though it were explicit configuration.**  
   Location: `packages/sdk/src/clients/endUser.ts:110–117`.

   `usedAddresses` includes `TEST_ACCOUNT_ADDRESSES` before resolution. On an unsupported chain, supplying an unrelated address override allows construction, and the global factory becomes the resolver’s “explicit” argument. Thus the intended “unsupported chain requires a factory” failure is bypassed. A deployment at that address which passes the interface checks is accepted despite neither caller nor chain address book selecting it.

   **Fix:** resolve from `addresses?.simpleAccountFactory` and the verified live chain’s address book. Do not pass merged global defaults as explicit inputs. Test an unsupported chain with unrelated overrides and no factory.

5. **Medium — The accepted feed age exceeds the deployed paymaster’s staleness threshold.**  
   Locations: `packages/core/src/utils/deploymentInputs.ts:39,77`; `packages/operator/src/PaymasterOperatorClient.ts:214`.

   A feed last updated 5,400 seconds ago passes the 7,200-second preflight, but the initializer configures a 3,600-second threshold. The SDK therefore approves a deployment using a feed already stale under its own configured policy.

   **Fix:** derive both checks from one threshold and pass it explicitly to `verifyEthUsdFeed`. Allow a transaction-inclusion margin. Test ages around 3,600 seconds and between 3,600 and 7,200 seconds.

6. **Medium — Block-relative freshness accepts stalled-chain data and ignores L2 sequencer health.**  
   Location: `packages/core/src/utils/deploymentInputs.ts:74–78`.

   If an RPC serves a head that is hours old, a feed updated shortly before that head still passes. On an L2, a recent price alone also does not establish that the sequencer is healthy or that its recovery grace period has elapsed.

   **Fix:** for live deployments, separately check head freshness against a bounded wall-clock policy and apply chain-specific sequencer uptime/recovery checks. Keep historical fork validation an explicit mode. Add stale-head, sequencer-down, and recovery-window tests.

7. **Medium — Interface responses establish compatibility, not trusted identity or deployment-time behavior.**  
   Locations: `packages/core/src/utils/deploymentInputs.ts:64–78,99–105`.

   An arbitrary contract can return `8`, `"ETH / USD"`, a positive fabricated price, and the current timestamp. Likewise, a factory can return a legitimate implementation from `accountImplementation()` while `createAccount()` deploys something else. These pass every implemented check.

   Reads also use separate latest-state calls. An upgradeable factory or feed can change between those calls, between verification and signing, or before a returned initCode is eventually used.

   **Fix:** define the trust boundary explicitly. Authenticate default deployments through a trusted per-chain registry/code policy; treat arbitrary overrides as caller-trusted inputs. Pin preflight reads to one block. Where execution-time guarantees are required, enforce them on-chain and verify resulting account properties before funding. Additional JavaScript reads alone cannot eliminate this race.

8. **Medium — The tests would miss a regression in the actual feed sent.**  
   Locations: `packages/operator/__tests__/PaymasterOperatorClient.test.ts:42–51`; `packages/sdk/__tests__/endUser.accountFactory.test.ts:30`.

   The operator tests mock both resolution/verification and `encodeFunctionData`, which always returns `0xInitData`. Changing only the initializer’s feed argument back to the Sepolia constant would leave the new resolver/verifier assertions satisfied. The SDK tests cover prediction but never exercise `deploySmartAccount`’s write and funding behavior.

   **Fix:** retain real ABI encoding, capture the deployment arguments, decode `initData`, and assert the checked feed is the one transmitted. Exercise actual public deployment methods using an offline transport, including rejection-before-send, chain mismatch, custom-ABI bypass, unsupported-chain defaults, and freshness boundaries.

9. **Low — The evidence script can mislabel chain evidence and persist unsanitized error content.**  
   Locations: `tests/regression/onchain-evidence/deploy-inputs-op-fork.ts:34–37,61–66,80–86`.

   Public endpoints are labeled from configuration without checking `eth_chainId`. The fork is forced to chain ID 10, so its local chain-ID check does not prove the upstream was OP Mainnet.

   Error sanitation removes HTTP URLs only. A provider error such as `invalid API key: <credential>` can survive and be written to the Markdown report. This does not establish that the committed report contains a secret; it means the script does not guarantee secret-free output.

   **Fix:** verify upstream and public endpoint identities before collecting evidence. Persist controlled error categories rather than arbitrary provider messages.

The public behavior changes also need migration guidance: `ethUsdPriceFeed` becomes optional, custom chains need additional configuration, and changing the factory changes counterfactual account addresses for the same owner/salt. Existing integrations should retain explicit account/factory identity rather than silently deriving a replacement address.

The evidence script itself contains no signing client or transaction submission call; I found no real-chain transaction-send path in it. Its PASS result covers helper reads, not deployment integration.

This was a static review. I did not run tests or the evidence script, access the network/RPCs, or read `.env` files, keystores, or files outside this worktree.

## Round 2

**I would not approve this revision yet.** H1, H3 and L9 remain open. The new snapshot logic also has two gaps.

Critical: none found. High: 2 unresolved findings. Medium: 2 findings in the revised implementation. Low: 1 unresolved finding.

**Round-1 dispositions**

| Finding | Disposition | Assessment |
|---|---|---|
| H1 — Reader/writer chain mismatch | **Still open** | The SDK clients now compare the live RPC with their configured chain. However, `assertSameChain` only compares two observations; it neither requires a configured signing chain nor binds subsequent sends to the returned ID. The operator’s existing-paymaster branch skips it altogether. |
| H2 — Unchecked paymaster APIs | **Acceptably deferred/disclosed** | `createOperatorClient().deployPaymasterV4` decodes the initializer, verifies its feed against its encoded threshold, and sends that same `initData`. The raw factory actions are explicitly documented as unchecked. This closes the supported-wrapper gap, not an SDK-wide guarantee. |
| H3 — Factory-check bypasses | **Still open** | `customAbi` alone no longer bypasses verification, but arbitrary `accountType` strings now do—even when the code still uses `SimpleAccountFactoryABI`. The separately listed helpers/examples are disclosed deferrals; that does not justify this replacement bypass. |
| M4 — Global factory masquerading as explicit configuration | **Resolved** | Resolution now uses the caller’s factory override or the live chain’s address book. The unsupported-chain test covers unrelated overrides. A separate mutable-configuration regression is described below. |
| M5 — 7200/3600 threshold mismatch | **Resolved for preflight** | The operator uses the same constant for validation and encoding; the SDK wrapper reads the initializer’s threshold. This establishes freshness at the checked block, not transaction inclusion. The test deliberately accepts age exactly 3600 seconds, leaving no inclusion margin. |
| M6 — Stalled head / sequencer health | **Acceptably deferred/disclosed** | Heads lagging the clock by more than 600 seconds are rejected. Sequencer checks remain absent but are explicitly excluded in the changelog and FU-120. This is not evidence of L2 oracle safety during downtime or recovery. |
| M7 — Identity and inconsistent reads | **Still open in part** | Caller-trusted overrides and execution-time races are reasonably disclosed. However, pinning by block **number** does not establish the claimed single-state snapshot during a reorg; see below. |
| M8 — Mocked encoding hides wrong transmitted feed | **Resolved for the principal regression** | The new test uses real encoding and decodes the actual deployment argument. The SDK test also exercises the deployment write. Funding behavior remains untested, so the tests should not be described as complete deployment/funding integration coverage. |
| L9 — Mislabelled evidence / unsafe error persistence | **Still open** | Endpoint IDs are now checked. Error sanitation still trusts SDK error messages that embed arbitrary provider text. |

**High — H1: chain agreement is not bound to the transaction**

Locations: `packages/core/src/utils/deploymentInputs.ts:29`, `packages/operator/src/PaymasterOperatorClient.ts:199`, `packages/enduser/src/UserClient.ts:75`.

Concrete scenario: a caller supplies a wallet client without a configured `chain`. Reader and wallet initially report Sepolia, so validation succeeds. During the subsequent reads, the wallet switches to OP. The factory actions pass `chain: client.chain`, which is undefined, rather than the validated chain. The deployment can therefore use the newly selected chain with inputs checked on Sepolia. `UserClient`’s fallback `sendTransaction` likewise receives no explicit validated chain.

There is another uncovered branch at `PaymasterOperatorClient.ts:190`: when the reader finds an existing paymaster, the chain check is skipped, but execution can continue to token approval and role registration through the writer.

**Fix:** establish the expected chain before branching; require or construct an explicit signing-chain configuration matching the verified ID, and carry it through every write, including fallback sends and reuse-path approval/registration. Add tests for an unconfigured wallet that changes chains after preflight and for mismatched chains on reuse. Comparing IDs once does not support the comment’s “can never” guarantee.

**High — H3: the ABI bypass has been replaced with an unchecked string bypass**

Location: `packages/enduser/src/UserClient.ts:77`.

Concrete scenario:

```ts
UserClient.deployAccount(wallet, {
  owner,
  factoryAddress: V06_FACTORY,
  accountType: 'kernel',
});
```

No custom ABI is supplied, so line 61 still selects `SimpleAccountFactoryABI`. Nevertheless, `'kernel'` disables verification entirely. An arbitrary string or typo has the same effect. The method can deploy the same incompatible SimpleAccount rejected by the default path.

The changelog discloses a non-simple-account exception, but the implementation does not establish that a non-simple account is actually being used.

**Fix:** reject unsupported account types before sending. Implement supported types with their own ABI and verifier. If an unchecked custom-factory escape hatch is required, expose it explicitly as such rather than treating any non-`simple` string as verification.

**Medium — revised snapshot logic can combine different blocks at the same height**

Locations: `packages/core/src/utils/deploymentInputs.ts:84`, `packages/core/src/utils/deploymentInputs.ts:121`.

Concrete scenario: `getBlock()` returns block A at height N. A reorg replaces A with B before the contract reads. Calls pinned to `blockNumber: N` now read B, while freshness uses A’s timestamp. A reorg between calls can also mix code, implementation, EntryPoint and feed responses from different states. This requires neither a malicious override nor a dishonest RPC.

The documented race *after verification* does not cover inconsistent state *inside verification*.

**Fix:** pin reads to the block hash using EIP-1898, preferably with `requireCanonical`, and retry or refuse when the snapshot is orphaned. If the transport cannot support that, explicitly handle canonical-hash changes rather than claiming a single-block snapshot. Test replacement of a block at the same height.

**Medium — new factory resolution reads mutable caller configuration twice**

Locations: `packages/sdk/src/clients/endUser.ts:120`, `packages/sdk/src/clients/endUser.ts:414`, `packages/sdk/src/clients/endUser.ts:423`.

Previously, `usedAddresses` captured configuration by spreading it. The revised resolver reads the original caller-owned `addresses` object on every invocation.

Concrete scenario: `deploySmartAccount` predicts address A using factory F1. While awaiting RPC responses, application configuration changes `addresses.simpleAccountFactory` to F2. The second `checkedAccountFactory()` accepts F2 and deployment creates address B. The method still returns A and, when `fundWithETH` is set, sends ETH to A. Both factories can legitimately pass the EntryPoint check.

**Fix:** capture the explicit override when constructing the client and carry one resolved factory through prediction and deployment. Do not independently reselect the deployment factory after predicting the account. Add a test that mutates the supplied configuration during an awaited read and verifies deployment, return value and funding remain consistent.

**Low — L9: SDK error wrapping defeats the new sanitizer**

Locations: `tests/regression/onchain-evidence/deploy-inputs-op-fork.ts:38`, `packages/core/src/utils/deploymentInputs.ts:94`, `packages/core/src/utils/deploymentInputs.ts:128`.

Concrete scenario: a contract read throws `invalid API key: SECRET`. The verifier interpolates that message into an `AAStarError` with an `Edddd` code. `clean()` accepts that code and persists the entire first line, including `SECRET`. Checking `instanceof AAStarError` alone would not fix this: the SDK itself has incorporated the untrusted text.

**Fix:** serialize controlled reason identifiers and allowlisted structured fields, not `error.message`. Keep provider details in the error cause, excluded from reports. Add a test where a provider error containing a sentinel credential passes through the real verifier and report formatter; assert the sentinel is absent.

This was a static review of the response diff, full branch diff and relevant worktree files. I did not run tests or access the network, RPCs, `.env` files, keystores, or files outside this worktree.

## Round 3

**I would not approve yet.** H1 remains open: the installed viem version does not provide the claimed chain binding for JSON-RPC wallets.

Critical: none found. High: 1. Medium: 1. Low: 1.

| Round-2 finding | Disposition | Reason |
|---|---|---|
| H1 — Reader/writer chain mismatch | **Still open** | Requiring a configured chain and checking before reuse fixes two gaps. However, viem’s JSON-RPC chain check is still separate from the transaction request, whose default formatting drops `chainId`. |
| H2 — Unchecked paymaster APIs | **Acceptably disclosed** | Supported wrappers validate the encoded feed; raw factory actions remain explicitly unchecked. |
| H3 — Factory-check bypasses | **Acceptably disclosed** | A non-simple type alone now fails. Supplying both a non-simple type and custom ABI explicitly enters the documented unchecked path. This does not establish compatibility, but closes the accidental string-only bypass. |
| M4 — Global factory treated as explicit configuration | **Resolved** | Resolution uses the captured caller override or the live chain’s address book. |
| M5 — Freshness-threshold mismatch | **Resolved for preflight** | Validation and initializer use the same threshold. Inclusion-time freshness remains outside this guarantee. |
| M6 — Stalled head / sequencer health | **Acceptably disclosed** | Head-lag checking remains; sequencer health remains expressly excluded. |
| M7 — Identity / inconsistent reads | **Still open in part** | Identity limitations are disclosed. Endpoint hash equality does not establish consistency of intervening reads. |
| M8 — Mock encoding concealed transmitted feed | **Resolved for the reported regression** | Tests retain real encoding and inspect deployment arguments. They do not establish complete funding integration coverage. |
| Round-2 reorg medium | **Still open** | The new comparison detects a persistent replacement, but misses mixed-backend and A→B→A observations. Details below. |
| Round-2 mutable-config medium | **Resolved** | The override is captured at construction; deployment takes the factory from the predicted `initCode`. |
| L9 — Evidence labeling / unsafe persistence | **Still open in part** | Endpoint labeling and unrestricted SDK-message persistence are fixed. Error names remain untrusted, and message matching can manufacture evidence. |

**High — H1: the send-time check is not an atomic chain binding**

Location: `packages/core/src/utils/deploymentInputs.ts:27–37`; affected writes include `packages/enduser/src/UserClient.ts:100` and `packages/operator/src/PaymasterOperatorClient.ts:226`.

I inspected **viem 2.43.3** inside this worktree:

- `actions/wallet/sendTransaction.ts:209–216` checks `eth_chainId` for JSON-RPC accounts.
- It passes that ID to the formatter at line 230.
- `utils/formatters/transactionRequest.ts:36–78` **does not serialize `chainId`**.
- The subsequent `eth_sendTransaction` therefore carries no expected chain.

I reproduced this using the actual installed viem and an entirely in-memory transport:

```text
eth_chainId → Sepolia; mock switches selected chain to OP
eth_sendTransaction → { from, to, value }, selected chain = OP
sendTransaction resolves successfully
```

A wallet switch between the last chain-ID response and request dispatch can therefore submit deployment or approval on the wrong chain. The fix catches switches before that last observation, not all switches after preflight.

Local accounts differ: `prepareTransactionRequest.ts:297–300` uses the configured chain ID, and local signing binds it into the transaction. They do not rely on the asserted live-chain recheck.

**Fix:** require a signing/submission path that binds the expected chain—local signing, or a wallet protocol/provider that atomically enforces it. Refuse unsupported paths if the guarantee is mandatory. Merely repeating `getChainId` cannot eliminate this race. Add a regression using real viem with a mocked switching transport.

**Medium — the hash recheck still permits inconsistent reads within verification**

Locations: `packages/core/src/utils/deploymentInputs.ts:91–95` and `:147–148`.

Concrete scenario: a load-balanced RPC has two honest backends temporarily disagreeing after a reorg. The initial and final block lookups hit backend A, while contract reads hit backend B. Both endpoint hashes equal A, so verification accepts B’s answers using A’s timestamp. Alternatively, A→B→A observations pass the same comparison.

The author is correct that this is not a canonical-snapshot guarantee. But it is also not general detection of reorgs *during* the check. The source still says the comparison prevents mixing states, and the public documentation still claims one-block reads.

**Fix:** use raw EIP-1898 requests with the captured block hash and `requireCanonical`, decoding results with the ABIs. `readContract` lacking this option does not prevent using `client.request`. Otherwise explicitly disclose mixed-state acceptance and narrow the source/documentation claims. Add a test where endpoint hashes match while intervening reads come from another block.

**Low — L9: the evidence sanitizer still trusts provider-controlled fields**

Locations: `tests/regression/onchain-evidence/deploy-inputs-op-fork.ts:50–54`.

Two concrete failures remain:

- An uncaught read error with `name = 'ProviderError: SECRET'` is persisted verbatim through `unexpected-${e.name}`.
- A contract-read error containing `builds accounts for EntryPoint 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789, but` is wrapped by the verifier as an SDK error. The sanitizer matches that embedded text before classifying the read failure, producing the exact expected mismatch result. The evidence check can report **yes** despite never successfully reading the implementation’s EntryPoint.

The extracted address is therefore not necessarily “the reported on-chain EntryPoint.”

**Fix:** attach controlled reason codes and validated structured fields at the actual failure sites. Serialize those fields only; use a constant for unexpected errors. Test both credential-bearing names and forged mismatch text passing through the real verifier.

I found no additional independent defects in the round-3 diff beyond these incomplete fixes. Review used worktree files and one offline viem reproduction; no network, RPCs, `.env` files, keystores, or project test suites were accessed or run.

## Round 4

**I would not approve yet.** Round 4 leaves one High, one Medium, and one Low finding. Critical: none found.

| Round-3 finding | Disposition | Reason |
|---|---|---|
| H1 — Reader/writer chain mismatch | **Still open in part** | Local-account defaults and explicit JSON-RPC opt-in implement the coordinator’s ruling. The deferred send-binding window is acceptably disclosed, but the promised post-send detection can falsely pass. |
| H2 — Unchecked paymaster primitives | **Acceptably disclosed** | Their unchecked status remains explicit. |
| H3 — Factory-check bypasses | **Acceptably disclosed** | A non-simple account type still requires a custom ABI to enter the documented unchecked path. |
| M4 — Global factory treated as explicit configuration | **Resolved** | Resolution retains the caller override or uses the live chain’s address book. |
| M5 — Freshness-threshold mismatch | **Resolved for preflight** | Verification and initialization use the same threshold. |
| M6 — Stalled head / sequencer health | **Acceptably disclosed** | Head-lag checking remains; sequencer health is explicitly excluded. |
| M7 — Identity / inconsistent reads | **Resolved for read consistency; identity acceptably disclosed** | Verifier reads now use the captured block hash with `requireCanonical: true`. |
| M8 — Mock encoding concealed transmitted feed | **Resolved for the reported regression** | Real initializer encoding remains covered. |
| Round-2 reorg medium | **Resolved** | Hash-pinned reads replace the inadequate endpoint hash comparison. Unsupported or unavailable state fails closed. |
| Round-2 mutable-config medium | **Resolved** | Factory override capture and deployment from the predicted `initCode` remain intact. |
| L9 — Evidence sanitization | **Still open in part** | Message/name parsing is removed, but provider-controlled `data` can still masquerade as an SDK refusal. |

**High — `confirmSentOnChain` can accept a transaction mined on another chain.**

Location: [packages/core/src/utils/deploymentInputs.ts:209](/Users/jason/Dev/aastar/aastar-sdk/.claude/worktrees/feed/packages/core/src/utils/deploymentInputs.ts:209), through line 219.

The receipt and canonical-block lookup are not bound to either chain-ID observation. A mutable wallet transport can produce:

```text
getChainId                  → A
waitForTransactionReceipt   → successful receipt from B
getBlock(receipt height)    → matching canonical block from B
getChainId                  → A
Result                     → accepted
```

I reproduced this using the actual helper and installed viem with an entirely in-memory transport. No fabricated block-hash collision is necessary: both middle reads legitimately concern B.

This matters because `createEndUserClient` uses one transport for reads and writes, and `UserClient.deployAccount` permits the wallet client as its reader. A wallet switching away and back during confirmation can therefore return success for a deployment on B. Subsequent workflow steps are not reliably stopped. The documented guarantee that the wrong-chain transaction is detected exceeds what this implementation establishes.

**Fix:** perform confirmation through a reader whose requests remain bound to the expected chain, independently of wallet selection. Refuse that guarantee when only a mutable wallet transport is available. Also validate the returned transaction’s identity and signed chain ID where available. More surrounding `getChainId` calls do not close this race. Add the A→B→A regression.

**Medium — a successful cancellation is accepted as confirmation of the original send.**

Location: [packages/core/src/utils/deploymentInputs.ts:212](/Users/jason/Dev/aastar/aastar-sdk/.claude/worktrees/feed/packages/core/src/utils/deploymentInputs.ts:212), through line 220.

Viem’s `waitForTransactionReceipt` enables replacement detection by default. It can resolve with a replacement transaction’s receipt, including a cancellation. The helper checks status and block hash but never checks `receipt.transactionHash` or replacement semantics.

I reproduced this with the installed viem replacement-detection implementation: it reported `reason: "cancelled"`, and `confirmSentOnChain` nevertheless resolved successfully.

Concrete failures:

- Cancel `UserClient.deployAccount`’s pending `createAccount` transaction with a successful self-transfer. The method returns the predicted account and original hash as though deployment succeeded.
- Cancel the funding transaction in `deploySmartAccount`. The method returns successfully although the requested ETH transfer never happened.
- Cancel an approval; the workflow can advance to registration without that approval executing.

**Fix:** disable replacement detection and require the exact submitted hash, or explicitly handle replacements. Accept only a verified equivalent repricing, reject cancellation or changed transaction contents, and return the actual confirmed hash. Add cancellation tests for creation and funding.

**Low — provider error data can still forge or contaminate evidence.**

Location: [tests/regression/onchain-evidence/deploy-inputs-op-fork.ts:37](/Users/jason/Dev/aastar/aastar-sdk/.claude/worktrees/feed/tests/regression/onchain-evidence/deploy-inputs-op-fork.ts:37), through line 44; exposed by the unwrapped `getBlock` at [deploymentInputs.ts:154](/Users/jason/Dev/aastar/aastar-sdk/.claude/worktrees/feed/packages/core/src/utils/deploymentInputs.ts:154).

`clean` trusts any error’s `data.reason`; it neither authenticates an SDK error nor restricts reasons to the defined enumeration.

An RPC failure during the initial `getBlock` escapes the verifier unchanged. With an unrecognized RPC error code, viem preserves the `RpcRequestError`, including provider-supplied `data`. I reproduced both outputs through the real verifier and sanitizer:

```text
entrypoint-mismatch (factory reports 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789)
secret-provider-token
```

The first satisfies the expected mismatch evidence without reading the implementation’s EntryPoint. The second shows that lowercase, hyphenated provider text still gets persisted.

**Fix:** accept only genuine `AAStarError` instances with the expected SDK code and an explicit reason allowlist; validate reason-specific fields. Wrap initial block-read failures in a controlled refusal. Serialize all other errors as `unexpected-error`.

I found **no missing confirmation call** after a successfully returned send in the changed deployment, approval, registration, account-creation—including fallback—and funding paths. The problems are in what confirmation accepts.

Account-type detection matches viem’s `type === "local"` signing branch; bare addresses and JSON-RPC accounts are refused by default. I found no separate detection defect. The EIP-1898 parameter placement and ABI encoding/decoding are correct for these no-argument getters; an offline round trip using the repository’s factory/account ABIs passed.

Review and reproductions used only worktree files and in-memory mocks. No network, live RPC, `.env`, keystore, or project integration suite was accessed.

## Round 5

The three round-4 defects are resolved, but round 5 introduces one Medium compatibility problem and one Low error-handling problem.

| Round-4 finding | Disposition | Why |
|---|---|---|
| **High — wrong-chain confirmation can pass** | **Resolved** | For honest RPC responses and distinct chain IDs, the author’s argument holds: switching transports cannot change a transaction’s signed chain ID. A B transaction queried by its hash either returns B’s chain ID or is unavailable on A; both stop confirmation. This does not authenticate a dishonest RPC or distinguish networks sharing a chain ID, but neither is the original wallet-switch scenario. |
| **Medium — cancellation accepted as success** | **Resolved** | The receipt must now identify the exact submitted hash. Viem returning a cancellation or replacement receipt therefore stops the flow. Rejecting equivalent repricings is conservative and explicitly disclosed. |
| **Low — provider data can forge evidence** | **Resolved** | Provider-controlled `data` alone cannot satisfy the `AAStarError` instance check. Reasons are allowlisted, and the evidence serializer validates the reported address. `instanceof` does not prove module provenance against arbitrary local code, but it closes the reported provider-data attack. The wrapper has a separate robustness issue below. |

The inherited resolved and acceptably disclosed findings listed in round 4 retain those dispositions; this diff does not reopen them.

**Critical: none found. High: none found.**

**Medium — protected legacy transactions can be rejected after successful execution.**

Location: [deploymentInputs.ts:250](packages/core/src/utils/deploymentInputs.ts#L250), comparison at line 254.

The implementation equates an absent RPC `chainId` field with an absent signed chain ID. These are different: legacy EIP-155 transactions encode their chain ID in `v`. Installed viem declares legacy `chainId` optional, and its transaction formatter does not derive it from `v`.

Concrete scenario: a wallet submits a protected legacy transaction on chain 10. The RPC returns its successful receipt and transaction with `v = 55`, but omits `chainId`. That signature encodes chain 10, yet the helper throws `tx-wrong-chain` and claims “no EIP-155 chain id.” A successful deployment or funding operation is consequently reported as failed.

I reproduced that refusal using the actual helper and installed viem formatter, entirely in memory.

**Fix:** for legacy transactions, derive the protected chain ID from `v` when necessary, while continuing to reject unprotected signatures (`v = 27/28`). Add coverage for protected legacy responses without the optional field.

**Low — the new block-error wrapper can throw while constructing its refusal.**

Location: [deploymentInputs.ts:62](packages/core/src/utils/deploymentInputs.ts#L62).

`(e as Error)` is only a TypeScript assertion. A custom client rejecting with `null`, a string, or an object without a string `message` causes `.message.split(...)` to throw before `fail()` runs.

Concrete scenario: a client adapter rejects its latest-block request with `{ code: -32000 }`. The verifier emits a `TypeError`, and the evidence script records `unexpected-error` instead of the promised `block-unavailable`. This remains fail-closed and does not restore the evidence-forgery vulnerability.

I reproduced both object and null rejection cases.

**Fix:** use a constant refusal message and retain the cause, or check that `message` is a string before including it.

Validation used worktree-local source and in-memory mocks. No network, live RPC, `.env`, or keystore access; no full integration suite was run.

## Dispositions (final)

| Finding | Class | Where it ended |
|---|---|---|
| Check and send on different chains (r1 H1, r2 H1, r3 H1, r4 H) | fixed / disclosed | assertSameChain (reader = signer = configured chain); local signer by default on the two paymaster deploy paths, `allowJsonRpcAccount` opt-in (DSR ruling); every send confirmed by `confirmSentOnChain` (exact hash, success, canonical block, signed chainId incl. legacy `v`). Remaining: a JSON-RPC send itself is not bound to the chain (viem 2.43.3 sends no chainId) — detected and stopped, not prevented (FU-120 ⑨) |
| deployPaymasterV4 forwarded unchecked initData (r1 H2) | fixed / disclosed | initData decoded as initialize(), feed checked; raw factory actions documented as unchecked primitives (FU-120 ⑥) |
| Factory-check bypasses (r1 H3, r2 H3) | fixed / disclosed | customAbi alone or a bare accountType string no longer skip the check; TestAccountManager, toSimpleSmartAccount, accountFactoryActions, scripts and examples in FU-120 ④⑥ |
| Global factory as "explicit" (r1 M4) | fixed | addresses.simpleAccountFactory (captured at construction) or the book |
| Feed age vs paymaster threshold (r1 M5) | fixed | one 3600 s bound for check and initializer |
| Stalled head / sequencer (r1 M6) | fixed / disclosed | head within 600 s of the wall clock; no sequencer-uptime check (stated in CHANGELOG, FU-120 ⑦) |
| Contract identity / mixed reads (r1 M7, r2 M, r3 M) | fixed / disclosed | every read on EIP-1898 {blockHash, requireCanonical}; identity of caller-supplied addresses is the caller's (FU-120 ⑦) |
| Mocked encoding (r1 M8) | fixed | real-encoding test decodes the initData sent |
| Mutable config (r2 M) | fixed | override captured; deploy uses the predicted initCode's factory |
| Cancellation accepted (r4 M) | fixed | receipt must be for the sent hash |
| Evidence sanitizing (r1 L9, r2 L, r3 L, r4 L) | fixed | only isDeploymentInputRefusal errors, allowlisted reasons |
| Legacy tx without chainId field (r5 M) | fixed, not re-reviewed | chain id from v; v = 27/28 refused |
| Non-Error rejection (r5 L) | fixed, not re-reviewed | firstLine() tolerates any rejection value |
