# Codex Tier-1 review: sepolia-rc8 coexisting SP rc.8 stack (#434 A1)

`codex exec`, read-only sandbox, static, six rounds before the PR was opened, each over the whole diff. The budget is five rounds; rounds 5 and 6 still had High findings because each round widened what the cutover gate must prove. DSR (2026-11-19): fix round 6, open the PR, no round 7; scope stops here. **Round 6's fixes were not re-reviewed by Codex.** The remaining gap (FU-124: every address getter gets an expected value, from SP's readback.json and the pins) is bound to the post-tag PR and must be merged before any `--write`.

| Round | Critical | High | Medium | Low |
|---|---|---|---|---|
| 1 | 0 | 3 | 3 | 2 |
| 2 | 0 | 1 | 3 | 1 |
| 3 | 0 | 2 | 2 | 0 |
| 4 | 0 | 2 | 2 | 0 |
| 5 | 0 | 3 | 1 | 0 |
| 6 | 0 | 3 | 2 | 0 |

## Round 1

Found **8 issues**. The first two can mix the rc.8 stack with Sepolia’s existing stack in normal SDK usage. No Critical finding.

1. **High — The returned address set omits aliases required by SDK clients.**  
   **Location:** `packages/core/src/sp550Deployments.ts:178`; `packages/sdk/src/clients/admin.ts:53`; `packages/core/src/addresses.ts:367`.

   `sp550AddressSet` returns `staking` and `sbt`, but clients use `gTokenStaking` and `mySBT`. Passing its addresses to a client leaves those aliases inherited from `getCanonicalAddresses(11155111)`. The resulting client uses the new Registry/token alongside the **old staking and SBT contracts**. Community registration can even approve the new token to the old staking address.

   **Reproduced:** merging the returned set exactly as clients do retained the shipped `gTokenStaking` and `mySBT`, despite different pinned `staking` and `sbt`.

   **Fix:** normalize aliases from the selected stack after address resolution. Add client-level tests asserting actual read/write targets; the new helper-only test never exercises these aliases.

2. **High — Declared-absent contracts silently return through client defaults.**  
   **Location:** `packages/core/src/sp550Deployments.ts:160`; `packages/sdk/src/clients/endUser.ts:112`; `packages/sdk/src/clients/community.ts:88`.

   The overlay represents absence by deleting keys. Client constructors subsequently merge `{ ...chainDefaults, ...addresses }`, so omission cannot override the old stack. A valid coexist set declaring `paymasterV4` absent still produces a client with Sepolia’s old live `paymasterV4`. The same happens to `xPNTsFactory` and other omitted entries.

   **Reproduced:** the fixture’s returned set omitted both contracts, while the client merge restored their shipped addresses.

   **Fix:** introduce an explicit complete-address-set mode that disables SP-owned fallback, or preserve explicit absence markers and reject unavailable actions. Test the constructed client, not merely `set.addresses[k] === undefined`.

3. **High — The gate passes a book whose xPNTs factory differs from SP’s factory.**  
   **Location:** `packages/core/src/sp550CutoverGate.ts:250`; `packages/core/src/sp550Deployments.ts:199`.

   Fresh validation permits `addresses.xPNTsFactory` to be absent or to name a different contract from `pins.xPNTsFactoryV2`. The gate checks SP against the top-level pin, but never requires the SDK book factory to match it. The coexist overlay makes the book-versus-addresses comparison self-consistent even when that address is wrong.

   **Reproduced:** both an absent factory and a different factory with its own matching codehash returned **gate exit 0**, with no failed checks.

   **Fix:** require the book factory to equal `xPNTsFactoryV2` whenever that top-level deployment is required; reject contradictory absence. Add both negative cases. This is an inherited fresh-deploy validation hole exposed by the new network; the new success fixture actually declares the factory absent.

4. **Medium — Valid rc.8 pins cannot be consumed by `sp550AddressSet`.**  
   **Location:** `packages/core/src/sp550Deployments.ts:176`.

   The writer and gate accept `v5.5.0-rc.8` with `--allow-rc`, but the helper calls `requireSp550FreshDeployPins` without that option and offers no way to supply it. Thus a successfully filled rc.8 deployment remains unusable through its intended selector.

   **Reproduced:** an otherwise valid set throws `tag: "v5.5.0-rc.8" is not v5.5.0`.

   **Fix:** define an explicit release-tag policy for this network and apply it consistently to writing, gating, and consumption. The coexist tests use `v5.5.0`, hiding this failure.

5. **Medium — The public helper accepts contradictory aPNTs pins.**  
   **Location:** `packages/core/src/sp550Deployments.ts:176`, `packages/core/src/sp550Deployments.ts:208`.

   Structural fresh validation checks equality for `superPaymaster`, but not for `addresses.aPNTs` versus `aPNTsCapped`. Alias validation only checks contracts that already share an address; it does not require these aliases to agree.

   **Reproduced:** changing only `aPNTsCapped` to a distinct address produced zero validation problems, and `sp550AddressSet` returned the inconsistent set. The gate rejects this mismatch, but the public helper’s explicit pins parameter bypasses that gate.

   **Fix:** put required alias equalities in the shared validator used by both consumers and the gate. Add malformed-pin tests against `sp550AddressSet`; its current tests cover valid and empty sets only.

6. **Medium — A trailing `--deploylive-archive` bypasses the placeholder refusal.**  
   **Location:** `scripts/sp550-pin-fill.ts:60`.

   The guard checks the flag’s *value*, not its presence. With the flag last, `arg()` returns `undefined`, and execution proceeds to read the manifest. With valid inputs, it can continue into RPC checks and the ordinary write workflow.

   **Reproduced:**
   ```text
   --network sepolia-rc8 --manifest ./nonexistent-review-manifest.json --deploylive-archive
   ```
   attempted to open the manifest and reported `ENOENT`, instead of the placeholder refusal.

   **Fix:** reject `args.includes('--deploylive-archive')` before processing inputs; also explicitly reject unsupported `--deploylive-archive=…` syntax. Test a trailing flag with otherwise valid arguments. The existing test supplies a value and misses this case.

7. **Low — The address-set return type promises addresses that may be absent.**  
   **Location:** `packages/core/src/sp550Deployments.ts:173`.

   `Record<string, Address>` tells callers that arbitrary keys contain addresses, although the implementation deliberately deletes optional entries. For example, `set.addresses.paymasterV4` is statically an `Address` but can be `undefined`, allowing unchecked calls or runtime crashes.

   **Fix:** return a typed address set with required keys and explicitly optional keys, including normalized client aliases. Add compile-time tests for unavailable entries.

8. **Low — Network resolution loses the discrimination needed by the coexist API.**  
   **Location:** `packages/core/src/sp550Deployments.ts:42`.

   `resolveSp550Network` returns independent `network`, `mode`, and `coexist` fields rather than a discriminated union. Consequently:
   ```ts
   const net = resolveSp550Network(name);
   if (net.coexist) sp550AddressSet(net.network);
   ```
   fails type checking because `net.network` remains every network name. Callers must cast despite having performed the intended runtime check.

   **Fix:** derive a discriminated union from `SP550_NETWORKS`, preserving each network’s literal fields. `Sp550CoexistNetwork` itself correctly selects only `sepolia-rc8`.

I found **no demonstrated canonical-write or chain-table collision in the current writer**: coexist writes exclude `addresses.ts`, select the name-keyed table, and retain the write guards and post-write checks. External pin overrides—including legacy timelock entries—fail ownership validation. Chain-keyed release holds currently block both same-chain selections together; there is no demonstrated hold bypass, though they cannot express independent stack holds.

Validation used focused, in-memory probes against local source and the existing mocked-RPC fixture. No files were changed, no network requests were made, and the full test suite was not run.

## Round 2

Found five issues. This was a static review of the full diff and relevant callers within this worktree; I did not run tests.

1. **High — Coexist validation does not enforce separation from the existing stack.**  
   **Location:** `packages/core/src/sp550Deployments.ts:193`, `packages/core/src/sp550CutoverGate.ts:162`  
   A fresh manifest can reuse the shipped Sepolia `gToken`, `staking`, or `sbt` addresses, with their correct runtime hashes. Validation checks aliases *within* the new pins, but never checks overlap with the old stack. The overlay then makes the book comparison pass by construction. These contracts’ association with the new stack is not checked by the gate, so two honest RPCs can certify a hybrid deployment.  
   **Fix:** Add coexist-specific validation rejecting overlap between SP-owned pins and the existing stack’s SP-owned addresses, with explicit exceptions if sharing is authorized. Apply it to both the gate and `sp550AddressSet`. Test a reused old staking/token address with an otherwise valid hash.

2. **Medium — The read-back comparator ignores the new network’s RC policy.**  
   **Location:** `scripts/sp550-readback-compare.ts:128`  
   The comparator passes only `args.includes('--allow-rc')` to `readbackProblems`. Consequently, valid `sepolia-rc8` pins tagged `v5.5.0-rc.8` pass the writer, gate, and consumer but fail the comparator unless the operator supplies an additional flag. The shared resolver accepts the network, but its new policy is lost here.  
   **Fix:** Pass `args.includes('--allow-rc') || net.allowRc`. Add a comparator test covering `sepolia-rc8` without the flag and another network with the same tag.

3. **Medium — Release holds cannot distinguish the two Sepolia deployments.**  
   **Location:** `packages/core/src/sp550Deployments.ts:193`, `packages/core/src/sp550CutoverGate.ts:136`  
   Both paths still consult `SP550_RELEASE_HOLDS[11155111]`. A hold on the in-place Sepolia upgrade therefore also blocks the independent rc.8 deployment. Removing that hold to release rc.8 simultaneously removes protection from the upgrade. No configuration can express “hold `sepolia`, permit `sepolia-rc8`.”  
   **Fix:** Support network-scoped holds, optionally alongside explicitly chain-wide holds, and resolve both through one helper. Test holding and releasing each Sepolia network independently.

4. **Low — `Sp550AddressSet` promises a history key that is deliberately omitted.**  
   **Location:** `packages/core/src/sp550Deployments.ts:182`, `packages/core/src/sp550Deployments.ts:195`  
   `AddressBookKey` includes `timelockControllerLegacy`, so the exported `Record` promises an `Address` for it. Construction filters that key out and casts the result back to the complete type. Thus `set.addresses.timelockControllerLegacy.toLowerCase()` type-checks but throws. Merging the set into defaults also retains the old history value, despite the “every book key” contract.  
   **Fix:** Define the type using `Exclude<AddressBookKey, Sp550HistoryKey>` and document history inheritance, or return an explicit zero history entry if complete override semantics are required.

5. **Medium — The write-isolation test does not exercise write isolation.**  
   **Location:** `scripts/sp550-pin-fill-core.test.ts:106`  
   The test supplies the correct table and network key directly to `fillPinsTable`. It never exercises the CLI’s table selection, `switchBook` decision, write list, or rollback. It would remain green if the CLI began writing `addresses.ts` for coexist. Likewise, the canonical-preservation assertion at `packages/core/src/sp550CutoverGate.test.ts:642` compares against an alias of the same mutable object, so an in-place mutation can evade it.  
   **Fix:** Test the CLI orchestration with injected RPC/process/filesystem dependencies. Assert that only the coexist entry changes, both chain-keyed tables and `addresses.ts` remain byte-identical, and failed post-write verification restores the original contents. Capture canonical values by value before invoking the consumer.

## Round 3

Found **four issues**. The second is an inherited gate gap that remains relevant to the new coexist guarantees. Review was static; I did not run tests or read files outside this worktree.

1. **High — The new zero-address accessor does not protect actual client writes.**  
   **Locations:** [sp550Deployments.ts:221](packages/core/src/sp550Deployments.ts:221), [operator.ts:100](packages/sdk/src/clients/operator.ts:100), [paymaster.ts:217](packages/core/src/actions/paymaster.ts:217).

   `requireDeployedAddress` has no production call sites in this worktree. A valid coexist set declaring `paymasterV4` absent returns that address as zero. Passing the set to `createOperatorClient`, as documented, installs `paymasterActions(zeroAddress)`. Calling `addDeposit({ value: ... })` forwards a value-bearing `writeContract` to zero without checking the destination; it can burn ETH instead of refusing before signing.

   **Fix:** Enforce the accessor lazily at each action’s write boundary, including value-bearing calls. Merely exporting it does not enforce the invariant. FU-123 acknowledges this gap but does not close it.

   **Test gap:** The new test calls the accessor directly. It still passes while every real client ignores it. Exercise an actual client action with an absent address and assert that neither signing nor sending occurs.

2. **High — Fresh pins can conceal wiring back into the old stack.**  
   **Locations:** [sp550CutoverGate.ts:234](packages/core/src/sp550CutoverGate.ts:234), [sp550Deployments.ts:234](packages/core/src/sp550Deployments.ts:234).

   The overlap check examines **pinned addresses**, not the addresses the contracts actually use. Consider fresh, distinct Registry, staking, token and SBT pins with correct runtime hashes, but a fresh Registry whose `GTOKEN_STAKING()` or `MYSBT()` still points to the old Sepolia stack. None of those getters is read by the gate. The overlay makes book-versus-pin checks agree automatically, and the overlap check sees only the fresh pins. The gate can pass despite a hybrid deployment.

   This gap already exists for other fresh networks; adding the overlap check does not establish the stronger coexist guarantee.

   **Fix:** Check Registry → staking/SBT, staking → Registry/token, and SBT → Registry/staking/token against the selected pins on both RPCs. The corresponding getters are present in the shipped ABIs.

   **Test gap:** The fixture does not model these wiring reads. Add cases where all pinned addresses and hashes remain valid while a getter returns an old-stack address.

3. **Medium — The exported chain-based validator bypasses coexist holds and overlap validation.**  
   **Location:** [sp550Deployments.ts:367](packages/core/src/sp550Deployments.ts:367).

   A consumer can take `sp550PinsFor('sepolia-rc8').pins` and call:
   ```ts
   requireSp550FreshDeployPins(11155111, pins, { allowRc: true })
   ```
   That returns `Sp550ValidatedPins` while checking only `SP550_RELEASE_HOLDS[11155111]` and passing an empty extra-problems list. A populated `SP550_COEXIST_HOLDS['sepolia-rc8']`, or reuse of the shipped staking address, is ignored. Thus the public “validated” result has weaker guarantees than `sp550AddressSet`.

   **Fix:** Provide one network-aware validation entry point that applies tag policy, holds and overlap checks. Reject coexist use through the chain-only API, or restrict that API to registered non-coexist fresh networks.

   **Test gap:** The updated all-networks test uses this exact chain-based path with empty pins. Missing fields make it throw and mask the bypass. Test complete coexist pins with a hold and with an overlap.

4. **Medium — Readback comparison discards coexist identity and can report PASS for rejected pins.**  
   **Locations:** [sp550-readback-compare.ts:126](scripts/sp550-readback-compare.ts:126), [sp550-readback-compare-core.ts:160](scripts/sp550-readback-compare-core.ts:160).

   The CLI passes only `chainId`, `mode` and release-tag policy into the comparator. It loses `network`/`coexist`, and the comparator performs only generic fresh-pin validation. A `sepolia-rc8` pin set reusing the shipped staking contract can therefore compare successfully against a matching readback and chain state, although the cutover gate and address-set consumer reject it. Coexist release holds are likewise invisible.

   **Fix:** Carry the network identity into `ReadbackContext` and apply the shared network-aware validation before comparing evidence. The writer’s separate gate currently prevents this comparator gap from directly authorizing its write.

   **Test gap:** Add comparator cases using complete coexist pins with an old-stack address and with a network-specific hold; both must fail despite otherwise matching evidence.

I found no direct canonical-table write path in the extracted `pinFillWritePlan`. The writer retains its two-host, finalized-block, live-readback, loopback/anvil, lock/journal, post-write gate and type-check guards. The archive flag refuses before manifest reads, and the new network types preserve discriminated narrowing.

## Round 4

Found **4 issues: 2 High, 2 Medium**. No Critical finding.

1. **High — The gate still certifies a hybrid stack with factories wired to the old Registry.**  
   Location: [sp550CutoverGate.ts:196](packages/core/src/sp550CutoverGate.ts:196), [sp550CutoverGate.ts:259](packages/core/src/sp550CutoverGate.ts:259).

   The additional staking/SBT checks leave `xPNTsFactoryV2.REGISTRY()`, `PaymasterFactory.registry()`, and `X402Facilitator.REGISTRY()` unchecked. All three getters exist in the shipped ABIs. Newly deployed contracts can have distinct addresses and matching runtime-codehash pins while still referencing the 5.4.2 Registry. Address-overlap validation cannot detect that wiring.

   **Reproduced:** using the existing fresh-deployment fixture, setting all three references to the shipped Sepolia Registry still produced `exitCode: 0`, with no failed checks. Registry-dependent operations can therefore use the old stack despite explicit rc8 selection.

   **Fix:** compare these references against `pins.addresses.registry` on both RPCs at the snapshot. Add independent wrong-wiring tests for each getter. The current passing fixture omits these getters entirely, so existing tests cannot detect their absence. This is an existing gate weakness exposed by the coexist deployment.

2. **High — `executeGasless` bypasses the new zero-destination protection.**  
   Location: [zeroDestinationGuard.ts:26](packages/core/src/zeroDestinationGuard.ts:26), [endUser.ts:243](packages/sdk/src/clients/endUser.ts:243).

   `executeGasless({ target: addresses.paymasterV4, value, ... })` accepts the zero address returned for an absent contract. It encodes that address inside `execute(target,value,data)`, signs the UserOperation, and submits `handleOps` to the nonzero EntryPoint. The guard checks only the outer destination, so it permits submission; successful account execution can transfer ETH to zero.

   **Reproduced:** a mocked end-user flow with `target: zeroAddress` and positive value called `signMessage` and proceeded to transaction submission. No zero-destination error occurred.

   **Fix:** call `requireDeployedAddress` on the inner target before account creation, encoding, or signing. Test this through the actual `executeGasless` method, asserting that neither signing nor submission occurs. Current tests cover direct writes/sends and `addDeposit`, not this path.

3. **Medium — Omitting the comparator’s optional network skips coexist holds and overlap validation.**  
   Location: [sp550-readback-compare-core.ts:114](scripts/sp550-readback-compare-core.ts:114), [sp550-readback-compare-core.ts:162](scripts/sp550-readback-compare-core.ts:162).

   An existing caller using `{ chainId: 11155111, mode: 'fresh', ... }` without `network` takes the old validation branch. Complete rc8 pins can therefore pass comparison despite `SP550_COEXIST_HOLDS['sepolia-rc8']`, or reuse an old-stack address if the readback agrees. The CLI supplies `network`, but the exported comparator still permits this bypass.

   **Fix:** require network identity and derive chain/mode from it, or reject ambiguous contexts without it. Validate consistency when callers supply both. Add a complete, otherwise-passing fresh fixture under a coexist hold; the added test uses incomplete upgrade pins and verifies diagnostic strings rather than demonstrating fail-closed behavior for valid fresh pins.

4. **Medium — Explicit rc8 selection does not reach the admin client’s DVT/BLS actions.**  
   Location: [admin.ts:64](packages/sdk/src/clients/admin.ts:64).

   `dvtActions` and `aggregatorActions` remain bound to `ADDRESS_PLACEHOLDER`, ignoring `usedAddresses.dvtValidator` and `usedAddresses.blsAggregator`. Passing a validated rc8 address set therefore leaves these operations unusable. The new guard reports that the deployment lacks contracts which its validated pins actually require.

   **Reproduced:** `addValidator` with nonzero DVT/BLS overrides failed with `ZeroAddressDestinationError`.

   **Fix:** bind both factories to their resolved addresses. Add positive role-action tests asserting the destination equals the selected pin. The placeholder binding predates this diff, but remains an integration defect in the newly advertised explicit-selection path.

The normal rc8 write plan excludes `addresses.ts`; I found no direct canonical-table write or chain-key collision in that path. Archive refusal, independent hold selection, and the discriminated network type appear intact.

Validation used worktree-local source inspection and in-memory mocked probes. No files were changed; no live RPC or full-suite run was performed.

## Round 5

Found **4 issues: 3 High, 1 Medium**. These block approval.

1. **High — The wiring scan accepts RPC disagreement and failed reads.**  
   [sp550CutoverGate.ts:304](packages/core/src/sp550CutoverGate.ts:304)

   `read()` returns a `Diverge` object when providers disagree and error strings when calls fail. The scan treats both as merely `unread`; its success condition is only `hits.length === 0`.

   **Failure scenario:** one RPC reports `GTokenStaking.treasury()` as the shipped SuperPaymaster, while the other reports another address—or times out. The prohibited address is discarded inside `Diverge`, and this row passes. Even every scan-only getter failing can produce a passing scan.

   **Fix:** fail on disagreement, transport errors, malformed responses, and unexpected reverts. Handle genuinely unsupported selectors through an explicit, release-specific exception list rather than accepting every unread result.

   **Test gap:** the existing treasury test makes both RPCs agree on the prohibited address. Add disagreement, one-provider failure, and both-provider failure cases.

2. **High — Successful canonical cutover makes other fresh networks fail their post-write gate.**  
   [sp550CutoverGate.ts:295](packages/core/src/sp550CutoverGate.ts:295)

   The shipped-stack exclusion runs for **all fresh networks**, and builds its forbidden-address set from the current `CANONICAL_ADDRESSES`.

   **Failure scenario:** `sp550-pin-fill --network op-sepolia --write` passes its preview and switches the canonical book. The required subprocess then imports that updated book. `SP.REGISTRY()`, `SP.APNTS_TOKEN()`, and other correctly wired getters now name addresses in the forbidden set. The post-write gate fails and restores the files. An already shipped fresh deployment likewise cannot pass subsequent checks.

   **Fix:** restrict this coexistence exclusion to `net.coexist`, or compare against an explicitly preserved previous-deployment snapshot. Keep positive wiring checks active for every fresh network.

   **Test gap:** fresh-network fixtures inject the desired book through `input.book` while leaving imported `CANONICAL_ADDRESSES` unchanged. Test the actual post-switch state and require the gate to pass.

3. **High — The “exhaustive” scan silently omits the required Paymaster implementation.**  
   [sp550CutoverGate.ts:75](packages/core/src/sp550CutoverGate.ts:75)

   `WIRING_SCAN_ABI` includes optional Paymaster instances but omits `addresses.paymasterV4Impl`, despite that being a required fresh-stack pin with a vendored `PaymasterABI`. Missing mappings are silently skipped at line 298.

   **Failure scenario:** deploy a new Paymaster implementation with its constructor `_registry` pointing to the shipped Sepolia Registry. Pin its new address and actual runtime hash. Address-overlap validation passes because the implementation address is new; codehash checks pass; `PaymasterFactory.registry()` can correctly name the new Registry. The implementation’s own `registry()` is never checked, allowing the old-stack dependency through.

   **Fix:** map `addresses.paymasterV4Impl` to `PaymasterABI` and explicitly compare its `registry()` with `pins.addresses.registry`. Require every pinned contract to have a scan mapping or a documented exemption.

   **Test gap:** add a fresh implementation whose address and hash are valid but whose Registry is the shipped one.

4. **Medium — Excluding shipped addresses does not establish correct wiring to the selected stack.**  
   [sp550CutoverGate.ts:291](packages/core/src/sp550CutoverGate.ts:291)

   The facilitator’s `REGISTRY()` gets a positive equality check, but its vendored `XPNTS_FACTORY()` getter only receives the blacklist scan.

   **Failure scenario:** both RPCs agree that the fresh facilitator references another newly deployed factory, different from `pins.xPNTsFactoryV2` and absent from the shipped book. All pinned addresses and hashes can be correct, yet the gate passes a facilitator connected to the wrong token-factory domain.

   **Fix:** explicitly compare `X402Facilitator.XPNTS_FACTORY()` with `pins.xPNTsFactoryV2`. Model known wiring relationships as expected pin-to-getter comparisons; retain the shipped-address scan as an additional check.

   **Test gap:** test an unrelated non-shipped factory address, not only addresses belonging to the old stack.

This was a static review of the full diff and relevant worktree sources. I did not run tests or read files outside the worktree.

## Round 6

Found **five issues**. The first four were reproduced with in-memory probes using this worktree’s code and dependencies. No files changed; no live RPCs used.

1. **High — The getter scan accepts incorrect wiring outside the shipped stack.**  
   [sp550CutoverGate.ts:333](packages/core/src/sp550CutoverGate.ts:333)  
   The scan checks address syntax and membership in the old-stack blacklist, rather than the expected destination. I reproduced **exit 0** with `GlobalTierSource.REGISTRY()` pointing to an unrelated address, and separately with a pinned live `paymasterV4.entryPoint()` pointing to an unrelated address. Matching codehashes do not establish correct deployment configuration.  
   **Fix:** Compare wiring getters against their expected pins or shipped external addresses, including `GlobalTierSource.REGISTRY` and deployed Paymasters’ registry, EntryPoint, and price feed. Keep zero allowances explicit for uninitialized implementations. Add negative tests using unrelated addresses—not only old-stack addresses. The fixture’s automatic `NEUTRAL` answers currently conceal these omissions.

2. **High — Address-array getters bypass the “exhaustive” coexist scan.**  
   [sp550CutoverGate.ts:327](packages/core/src/sp550CutoverGate.ts:327)  
   Only functions returning exactly one scalar `address` are scanned. The vendored Paymaster ABI exposes `getSupportedTokens(): address[]` and `getSupportedTokensInfo()` with multiple outputs. A new, pinned Paymaster can therefore support the old stack’s aPNTs while passing the gate. I reproduced **exit 0** and confirmed neither getter was read.  
   **Fix:** Inspect address-bearing arrays and tuples recursively, or explicitly validate these getters. Test a deployed optional Paymaster whose supported-token list contains a shipped-stack token.

3. **Medium — `sendCalls` bypasses the zero-destination guard.**  
   [zeroDestinationGuard.ts:24](packages/core/src/zeroDestinationGuard.ts:24)  
   All four factories expose `walletActions`, including `sendCalls`, but the extension overrides only `writeContract` and `sendTransaction`. Calling `sendCalls({ calls: [{ to: zeroAddress, value: 1n }] })` reached `wallet_sendCalls` in my probe. Viem’s batch fallback also calls its imported transaction action directly. A declared-absent destination can thus reach the wallet for execution.  
   **Fix:** Guard every batch destination before invoking `sendCalls`; cover signing APIs if the guarantee includes preventing signatures. Add batch tests asserting no wallet request or signing occurs.

4. **High — Ordinary AA execution still permits zero inner targets.**  
   [UserClient.ts:481](packages/enduser/src/UserClient.ts:481), [account.ts:25](packages/core/src/actions/account.ts:25)  
   The new check protects `executeGasless`, but `UserClient.execute` and `executeBatch` delegate to account actions that accept zero targets. `validateAddress` checks format only; the outer transaction targets the nonzero smart account, so the extension cannot catch it. Both actions reached `eth_sendTransaction` with calldata forwarding value to zero in my probe.  
   **Fix:** Reject zero inner destinations in shared account execution actions, validating every batch element before signing. Extend tests beyond gasless execution.

5. **Medium — An inherited alias restriction rejects a legitimate fresh address book.**  
   [sp550Deployments.ts:412](packages/core/src/sp550Deployments.ts:412)  
   The existing alias whitelist now enforced by `sp550AddressSet` omits `addresses.paymasterV4 = addresses.aPNTsPaymasterV4`. The shipped address book explicitly uses this relationship. A fresh deployment following that convention, with matching runtime hashes, fails validation because these two entries share an address. This blocks a valid pin fill and consumer selection.  
   **Fix:** Encode this supported alias with equal-codehash enforcement, or derive the generic Paymaster entry from the named instance. Add a complete fresh-pin fixture containing that relationship.

The focused checks above are not a full test-suite run.

