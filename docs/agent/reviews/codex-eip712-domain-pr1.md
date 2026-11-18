# Codex Tier-1 review: EIP-712 domains from the chain (USDC, BuyHelper)

`codex exec`, read-only sandbox, static. Round 1 reviewed e45330ba (whole change); round 2 the diff e45330ba..795a7174. The round-2 findings (evidence script only) were fixed afterwards and not re-reviewed by Codex.

## Round 1

**The stated invariant is not satisfied.** I would request changes. No Critical findings; High, Medium, and Low findings follow.

1. **High — Direct settlement verifies the wrong contract’s domain.**  
   [X402Client.ts:97](/Users/jason/Dev/aastar/aastar-sdk/.claude/worktrees/eip712/packages/x402/src/X402Client.ts:97), [x402auth.ts:67](/Users/jason/Dev/aastar/aastar-sdk/.claude/worktrees/eip712/packages/x402/src/x402auth.ts:67)

   `createPayment({ settlement: 'direct' })` checks the **asset**, then signs `{ name: 'X402Facilitator', version: '1', ... }` without reading or checking the facilitator. A replacement facilitator with a different domain—or an address with no contract—still causes signing.

   **Fix:** Resolve and verify the actual signing contract’s domain for each settlement mode. If the facilitator exposes no suitable reads, reject before signing under the stated invariant. FU-117 documents the omission but does not make this path compliant.

2. **High — One client can populate the cache used by another client without any contract verification on the second.**  
   [eip712Domain.ts:55](/Users/jason/Dev/aastar/aastar-sdk/.claude/worktrees/eip712/packages/core/src/utils/eip712Domain.ts:55), [eip712Domain.ts:69](/Users/jason/Dev/aastar/aastar-sdk/.claude/worktrees/eip712/packages/core/src/utils/eip712Domain.ts:69)

   The module-global key contains only chain ID, address, and getter mode. Resolve an address on an OP fork reporting chain ID 10, then resolve it through the production client: the latter calls only `getChainId()`. Its contract may report a different domain, revert, or not exist; the cached fork result still authorizes signing. A mock or untrusted client can likewise seed a self-consistent domain/separator pair.

   **Fix:** Isolate caches by client/trust context and validate the separator through the current client before returning a cached domain. Client identity alone does not handle a transport whose endpoint changes.

3. **Medium — Cached domains remain usable after upgrades or read failures; clearing the cache races with outstanding resolutions.**  
   [eip712Domain.ts:58](/Users/jason/Dev/aastar/aastar-sdk/.claude/worktrees/eip712/packages/core/src/utils/eip712Domain.ts:58), [eip712Domain.ts:77](/Users/jason/Dev/aastar/aastar-sdk/.claude/worktrees/eip712/packages/core/src/utils/eip712Domain.ts:77), [eip712Domain.ts:128](/Users/jason/Dev/aastar/aastar-sdk/.claude/worktrees/eip712/packages/core/src/utils/eip712Domain.ts:128)

   After a proxy changes its domain, a long-running relayer continues signing with the old domain indefinitely. It also signs if `DOMAIN_SEPARATOR()` has become unreadable. Documentation requiring a restart does not enforce failure before signing.

   Additionally, an old resolution can finish after `clearEip712DomainCache()` and repopulate the cleared cache. Concurrent resolutions can overwrite a newer result with an older response.

   **Fix:** Revalidate the separator on use, refresh metadata when it changes, and reject unreadable values. Use coherent block-pinned reads and an invalidation generation so pre-clear operations cannot repopulate the cache. A TTL only bounds the stale-signing window.

4. **Medium — Direct payments now require EIP-712 support from tokens that do not verify the signature.**  
   [X402Client.ts:97](/Users/jason/Dev/aastar/aastar-sdk/.claude/worktrees/eip712/packages/x402/src/X402Client.ts:97)

   The new unconditional resolver rejects a plain ERC-20 without `version()` or `DOMAIN_SEPARATOR()`, even when direct settlement can transfer that pre-approved token and only the facilitator verifies the authorization. This is an additional compatibility break beyond changing `tokenName`/`tokenVersion` into expectations.

   **Fix:** Choose the settlement path before resolving domains. Verify the facilitator for direct payments; obtain asset metadata separately without requiring an unrelated token separator.

5. **Medium — Public signing helpers still bypass verification entirely.**  
   [eip3009.ts:66](/Users/jason/Dev/aastar/aastar-sdk/.claude/worktrees/eip712/packages/x402/src/eip3009.ts:66), [eip3009.ts:173](/Users/jason/Dev/aastar/aastar-sdk/.claude/worktrees/eip712/packages/x402/src/eip3009.ts:173), [eip3009.ts:212](/Users/jason/Dev/aastar/aastar-sdk/.claude/worktrees/eip712/packages/x402/src/eip3009.ts:212)

   The exported transfer, receive, and cancellation helpers still accept arbitrary domain strings and sign without reads. `signGTokenTransferWithAuthorization` delegates to the unchecked transfer helper. A caller passing `"USDC"` for OP Mainnet reproduces the original failure.

   These are **pre-existing invariant gaps**, not newly introduced signing bugs. Deprecating `GTOKEN_EIP712_DOMAIN` does not close them. The channel voucher and KMS domains documented in FU-117 are further exceptions.

   **Fix:** Route exported signing operations through verification, or explicitly narrow the promised invariant and identify unchecked APIs. Under the requested SDK-wide invariant, these paths must verify or refuse.

6. **Medium — The evidence script can report PASS for unrelated failures.**  
   [usdc-domain-op-fork.ts:81](/Users/jason/Dev/aastar/aastar-sdk/.claude/worktrees/eip712/tests/regression/onchain-evidence/usdc-domain-op-fork.ts:81), [usdc-domain-op-fork.ts:114](/Users/jason/Dev/aastar/aastar-sdk/.claude/worktrees/eip712/tests/regression/onchain-evidence/usdc-domain-op-fork.ts:114)

   Every failed `eth_call` counts as rejection of the old signature, and every exception resolving USDC.e counts as the intended refusal. If the SDK transaction succeeds and upstream reads subsequently fail, the script can still print PASS without proving either negative case.

   **Fix:** Require the expected invalid-signature revert and the expected unsupported-domain failure. Treat transport errors, timeouts, and unexpected reverts as failed evidence. Compare old/new signatures using the same unused authorization in simulations to isolate the domain difference.

7. **Low — Fork readiness does not establish ownership of the endpoint.**  
   [usdc-domain-op-fork.ts:44](/Users/jason/Dev/aastar/aastar-sdk/.claude/worktrees/eip712/tests/regression/onchain-evidence/usdc-domain-op-fork.ts:44), [usdc-domain-op-fork.ts:53](/Users/jason/Dev/aastar/aastar-sdk/.claude/worktrees/eip712/tests/regression/onchain-evidence/usdc-domain-op-fork.ts:53)

   If the randomly selected port already hosts another Anvil, the spawned process can fail while `waitForRpc()` succeeds against that unrelated instance. The script then changes its balances, impersonates accounts, and sends transactions there.

   **Fix:** Monitor child startup/error/exit, establish ownership of the listening endpoint, and verify Anvil identity and fork metadata before mutations. Specify loopback binding explicitly.

**Other review results**

- EIP-5267 bitmap handling appears correct on inspection: absent fields are omitted, salt is included when present, extensions/unknown bits reject, and reported chain/address mismatches reject. However, the “honours the fields bitmap” test only exercises `0x0f`; it would not detect regressions involving omitted fields or salt.
- Both changed callers reject domains without `chainId`. That is conservative but excludes otherwise valid EIP-5267 domains. RPC/config comparisons otherwise look correct for ordinary supported chain IDs. Wallet chain configuration is not checked; the tests deliberately sign OP domains with a Sepolia-configured local wallet.
- `tokenName`/`tokenVersion` becoming expectations is documented and intentional. Explicit empty strings now behave differently from the old `||` defaults.
- Cold-cache separator failures correctly prevent both TokenSale signatures. Returned copies prevent caller mutation of cached values. However, the cache test explicitly requires **zero subsequent reads**, cementing finding 3. Add warm-cache failure, cross-client, upgrade, concurrent-clear, and direct-facilitator mismatch tests.
- The evidence script routes transactions to loopback, generates ephemeral keys, and does not explicitly write private keys or the upstream URL. I found no normal path broadcasting to the upstream real chain. Raw exception text should nevertheless be sanitized before inclusion in the report.

This was a static review confined to this worktree. I did not run tests or the fork script, access the network/RPC, or read environment files or keystores.

## Round 2

**Request changes for the evidence script.** H2, M3 and M4 are resolved; H1 and M5 are acceptably disclosed deferrals under the narrowed scope. M6 and L7 remain open. I found no independent new production-code defect in the round-2 diff.

| Round-1 finding | Disposition | Assessment |
|---|---|---|
| **H1 — unchecked facilitator domain** | **Acceptably deferred/disclosed** | [X402Client.ts:110](packages/x402/src/X402Client.ts#L110) still signs under the hard-coded facilitator domain. CHANGELOG now explicitly excludes this path, and FU-117 tracks it. Missing on-chain getters explains the dependency; it does **not** make the domain verified. The proposed future fallback to pinned values would likewise remain an exception. |
| **H2 — cross-client cache poisoning** | **Resolved** | [eip712Domain.ts:80](packages/core/src/utils/eip712Domain.ts#L80) isolates entries by client, and every hit reads the separator through that client. The author's equal-separator argument is sufficient for the signing digest, assuming collision resistance and a truthful RPC response; it does not establish endpoint identity or freshness. The implementation no longer depends on sharing across clients anyway. |
| **M3 — stale cache / clear races** | **Resolved for the reported cache defects** | [eip712Domain.ts:84](packages/core/src/utils/eip712Domain.ts#L84) rejects unreadable separators and refreshes changed ones. Capturing the WeakMap before any await prevents pre-clear operations from repopulating the replacement cache. Concurrent resolutions can still overwrite newer entries, but subsequent uses revalidate them. Reads remain unpinned: this is point-in-time verification, not a guarantee against upgrades between checking and signing. |
| **M4 — direct path requires token domain support** | **Resolved** | [X402Client.ts:110](packages/x402/src/X402Client.ts#L110) branches before asset resolution. Plain ERC-20 direct payments no longer require unrelated token getters. |
| **M5 — unchecked exported signing helpers** | **Acceptably deferred/disclosed** | The helpers remain unchecked, but [CHANGELOG.md:27](CHANGELOG.md#L27) explicitly excludes them and FU-117 item ⑤ tracks them. This satisfies round 1's alternative of narrowing the promise; it does not fix those APIs. |
| **M6 — false-positive evidence** | **Still open, partially improved** | Comparing the same unused authorization improves the signature experiment. However, the USDC.e condition still accepts transport failures, as detailed below. |
| **L7 — endpoint ownership** | **Still open, mitigated** | Loopback binding and child error/exit monitoring help. Releasing an ephemeral port and checking generic fork metadata still does not establish ownership. |

**Outstanding findings in the revised diff**

**Medium — M6: transport failures still satisfy the USDC.e evidence condition.**  
Location: [usdc-domain-op-fork.ts:134](tests/regression/onchain-evidence/usdc-domain-op-fork.ts#L134), supported by [eip712Domain.ts:129](packages/core/src/utils/eip712Domain.ts#L129).

The resolver emits `neither eip712Domain() nor name()/version() could be read` for **every** fallback getter exception, including timeouts and upstream errors. Matching that wrapper text does not distinguish absent getters from unavailable infrastructure.

Concrete scenario: the native-USDC signature comparison and transaction succeed; subsequent upstream state reads for USDC.e fail temporarily. The resolver wraps the failure with the expected phrase, `usdcERefusedForGetters` becomes true, and the script reports **PASS** without establishing the claimed unsupported-domain behavior. A later successful chain-ID request does not disprove an earlier transient failure.

**Fix:** Preserve structured error causes and distinguish transport failures from contract-level failures. Require successful control reads plus the expected contract-level failure for the unsupported getters. Decode the old-signature revert structurally as well, rather than accepting any error text containing `invalid signature`. Add injected-timeout and unexpected-revert cases that must fail evidence.

**Low — L7: port selection still has an ownership race.**  
Location: [usdc-domain-op-fork.ts:48](tests/regression/onchain-evidence/usdc-domain-op-fork.ts#L48) and [usdc-domain-op-fork.ts:77](tests/regression/onchain-evidence/usdc-domain-op-fork.ts#L77).

`freePort()` closes its listener before Anvil binds. Another process can acquire that port. `anvil_nodeInfo` only proves that the responder reports a fork; the child being alive does not prove it owns the listener.

Concrete scenario: another fork binds the released port while the spawned Anvil is still initializing. The unrelated fork answers both readiness requests before the child reports its bind failure. The script then calls `anvil_setBalance` and impersonates an account on that unrelated fork.

**Fix:** Establish successful binding by the spawned process before mutations—for example, use a supported OS-assigned port reported by Anvil, or verify listener ownership against the child PID. Validate the expected fork identity separately. Merely checking `exited` again leaves the ownership gap.

**Critical:** None.  
**High:** No remaining in-scope findings; H1 is explicitly deferred.  
**Medium:** M6 above.  
**Low:** L7 above.  
**Additional newly introduced findings:** None identified.

Static review only. I read files inside this worktree, made no edits, and accessed no network, RPC, `.env` files or keystores. I did not run tests or the evidence script.

## Dispositions

| Round | Finding | Class | What was done |
|---|---|---|---|
| 1 | H1 direct path signs under an unchecked X402Facilitator domain | deferred | FU-117 ② ④; the facilitator exposes no domain reads (SP plans to add them); CHANGELOG excludes the direct path |
| 1 | H2 one client's cache used by another | fixed | cache keyed per client; every hit re-reads DOMAIN_SEPARATOR() through the caller's client |
| 1 | M3 stale cache after upgrade / unreadable separator / clear race | fixed | re-check on every use (changed → re-resolve, unreadable → throw); cache generation taken before the first await |
| 1 | M4 direct path required the asset's EIP-712 support | fixed | only the eip-3009 path reads the asset domain; test with a plain ERC-20 |
| 1 | M5 exported sign*Authorization helpers unchecked | deferred (pre-existing) | FU-117 ⑤; CHANGELOG names them |
| 1 | M6 evidence could PASS on unrelated failures | fixed in round 2 response, then again | same authorization under both domains; old rejection must decode to `FiatTokenV2: invalid signature`; USDC.e needs a working control read plus contract-level reverts of version() and DOMAIN_SEPARATOR() |
| 1 | L7 fork endpoint ownership | fixed | anvil binds port 0 itself and the script uses the port the child reports; fork identity (anvil_nodeInfo forkConfig, chainId 10) checked before any state change |
| 1 | test gaps (bitmap, warm-cache failure, cross-client, upgrade, clear race) | fixed | tests added |
| 2 | M6 transport failure could satisfy the USDC.e condition | fixed | see above |
| 2 | L7 freePort race | fixed | see above |
