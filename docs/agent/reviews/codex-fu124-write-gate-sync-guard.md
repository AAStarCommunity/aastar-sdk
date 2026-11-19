# Codex Tier-1 review: FU-124 write gate + zero-destination guard (Sync / signing / build actions)

`codex exec`, read-only sandbox, static plus in-memory probes, three rounds before the PR was opened, each over the whole diff. Threat model (DSR 2026-11-19), stated in round 3's prompt and in the module header: the guard protects an honest caller whose address set has a zero entry; it does not defend against an adversary controlling the request object, the chain configuration or the process. Round 3 found no Critical/High/Medium; its four Low items are recorded below and in FU-123 / FU-124.

| Round | Critical | High | Medium | Low |
|---|---|---|---|---|
| 1 | 0 | 2 | 3 | 2 |
| 2 | 0 | 1 | 4 | 2 |
| 3 | 0 | 0 | 0 | 4 |

## Round 1

**The invariants are not fully enforced.** I found two reproducible paths that send to address zero, plus readiness, argument-parsing, build-action, and test gaps.

I inspected only this worktree and its installed viem **2.43.3**. Reproductions used the actual guard source, viem’s extension chain, and a recording transport; no live transactions were sent.

1. **High — `writeContract` and `writeContractSync` validate a different destination from the one sent.**  
   **Location:** `packages/core/src/zeroDestinationGuard.ts:29–30,38–39`

   This passes the guard:
   ```ts
   const request = {
     address: nonzeroAddress,
     to: zeroAddress,
     abi: payableAbi,
     functionName: 'f',
     value: 1n,
   };
   await client.writeContract(request);
   ```
   Viem’s `writeContract.ts:235–239` constructs `{ to: address, ...request }`, so the extra `to` overrides the checked address. The guard passes its captured, **pre-extension client** to viem; internal `getAction(..., 'sendTransaction')` therefore selects the original unguarded action.

   **Observed:** both variants issued `eth_sendTransaction` with `to: zeroAddress`. The Sync variant subsequently threw while fetching the receipt—after sending.

   TypeScript is insufficient protection: the guard accepts `any`, JavaScript callers are supported, and extra properties can survive structural assignment through variables.

   **Fix:** reject conflicting/zero `to` fields, normalize contract requests so `address` determines the final destination, and ensure internal dispatch uses guarded actions. Test both variants with conflicting fields and assert zero signer/transport calls.

2. **High — `deployContract` forwards an extra zero destination through an unguarded send.**  
   **Location:** `packages/core/src/zeroDestinationGuard.ts:37–45`

   ```ts
   const request = {
     abi: [],
     bytecode: '0x00',
     to: zeroAddress,
     value: 1n,
   };
   await client.deployContract(request);
   ```
   The extension leaves `deployContract` untouched. Viem’s `deployContract.ts:80–87` spreads extra request fields into a direct call to `sendTransaction`, bypassing the overridden client method.

   **Observed:** `eth_sendTransaction` carried `to: zeroAddress`, data `0x00`, and value `0x1`. This becomes a value-bearing transaction to zero rather than contract creation. An intermediate object can carry `to` despite its omission from viem’s declared deployment parameters.

   **Fix:** wrap deployment actions and reject supplied destinations, or explicitly normalize them to genuine contract creation. Merely fixing `getAction` dispatch will not fix viem’s direct function call here.

3. **Medium — Any top-level property unlocks writing; readiness does not establish a real allow-list.**  
   **Location:** `packages/core/src/sp550CutoverGate.ts:105–108`

   `{ placeholder: {} }` satisfies the declared type and makes `sp550WiringAllowListReady()` return true. A single incomplete contract entry does too. `Readonly` also provides no runtime immutability.

   More fundamentally, `SP550_WIRING_EXPECTED` is never consumed by the getter scan at lines 334–384. Filling this table alone unlocks writes while the scan still only checks readability and, for coexistence, the old-stack blacklist. A getter pointing at an unrelated address can remain accepted.

   This is a **latent fail-open condition**, not an argv-only bypass of today’s literal `{}`.

   **Fix:** keep writing disabled until the gate actually enforces expectations. Validate complete ABI-derived coverage and expectation kinds, reject missing entries, compare actual getter results, and freeze the table if runtime mutation is outside the intended API.

4. **Medium — `--write=<value>` bypasses early refusal and proceeds as preview.**  
   **Location:** `scripts/sp550-pin-fill.ts:64,67,101`

   Both checks recognize only the exact token `--write`. For example:
   ```sh
   ... --network sepolia --manifest pins.json --write=true
   ```
   skips the readiness refusal, reads the manifest, and can perform RPC reads. The same applies to `--write=1` or `--write=`.

   **This does not enable actual writes:** line 101 also treats these spellings as preview. It nevertheless violates the requested early-refusal behavior and silently misinterprets write intent. Exact `--write` cannot bypass the gate through argument reordering because both checks scan the whole argument array.

   **Fix:** parse arguments once and reject unsupported boolean-value spellings before I/O, or recognize them consistently as write intent. Add spelling/order cases and `op-mainnet` to the test matrix.

5. **Medium — Transaction-building wallet actions remain unguarded.**  
   **Location:** `packages/core/src/zeroDestinationGuard.ts:37–45`

   ```ts
   await client.prepareTransactionRequest({
     to: zeroAddress,
     value: 1n,
     parameters: [],
   });
   ```
   **Observed:** this returns a transaction request targeting zero. `fillTransaction`, also exposed by `walletActions`, likewise lacks a guard.

   These actions do not themselves sign or broadcast, so this is not an independent send bypass. They do violate the stated **“builds, signs or sends”** invariant. Passing the result to the guarded `client.signTransaction` would still reject it.

   **Fix:** guard both preparation/filling actions if building zero-destination requests is forbidden, including validation of their returned destination where transformations are supported.

6. **Low — New Sync/signing tests permit a blanket-refusal implementation.**  
   **Location:** `packages/sdk/__tests__/zeroDestinationGuard.test.ts:127–137`

   Replacing all four newly covered methods with unconditional `ZeroAddressDestinationError` rejections would leave these tests green. The existing positive control exercises `addDeposit` through ordinary `writeContract`, not these four methods.

   Thus the suite cannot establish that valid destinations still work. It also misses the conflicting-field and deployment bypasses above.

   **Fix:** add nonzero positive controls for each new action, with appropriate return values, plus local-account and JSON-RPC-account cases. Assert signer and transport activity explicitly.

7. **Low — The CLI test does not prove “before any file read or RPC.”**  
   **Location:** `scripts/sp550-pin-fill-core.test.ts:599–609`

   The test proves that one nonexistent manifest does not produce an exposed `ENOENT` before the expected refusal. An implementation that reads another existing file—or catches a manifest-read error—before refusing would still pass. No RPC or filesystem activity is observed, and `op-mainnet` is omitted despite “every network.”

   **Fix:** make application I/O injectable and assert that no filesystem or RPC operation occurs before refusal. Retain the subprocess test for exit status and diagnostics, and enumerate all supported networks.

Two examined paths **do not justify additional findings**:

- Ordinary `sendCalls`/`sendCallsSync` batches with explicit zero `to` are rejected before viem’s fallback. The fallback directly calls `sendTransaction`, but the initial batch check covers those unchanged destinations.
- A data-only `writeContract({ to, data })` without an ABI fails during encoding before sending. Also, `signAuthorization({ address: zeroAddress })` signs an EIP-7702 authorization, not a transaction calling zero; zero is meaningful for revoking delegation. Treating that as a forbidden call would conflate different operations.

I did not run the full suite; the send/build findings above were verified with focused, in-memory reproductions.

## Round 2

The current `--write` gate is closed, but the wallet invariant has reproducible bypasses. I found these issues:

1. **High — Checked arguments are reread before use.**  
   `packages/core/src/zeroDestinationGuard.ts:33–44`

   The wrappers inspect the caller’s object, then pass that same object to viem. Accessors can return different destinations:

   ```ts
   let reads = 0;
   await client.sendTransaction({
     chain: null,
     get to() {
       return ++reads === 1 ? NONZERO : zeroAddress;
     },
     value: 1n,
   });
   ```

   **Reproduced:** the guarded client issued `eth_sendTransaction` with `to: zeroAddress`. The same check/use discrepancy exists for `address`, deployment `to`, and batch calls. TypeScript permits getters; fixing `any` alone would not close it.

   **Fix:** materialize a plain request snapshot—including each batch call—then validate and pass that exact snapshot. Add changing-accessor regression tests that assert neither signing nor sending occurs.

2. **Medium — Viem can change the destination after validation.**  
   `packages/core/src/zeroDestinationGuard.ts:40–54`

   A supported `chain.prepareTransactionRequest` hook can replace a checked nonzero destination with zero. The wrappers capture the client **before** this extension, so viem’s internal preparation uses the earlier, unguarded action. Even an input-only preparation guard would not validate the hook’s output.

   **Reproduced:** using a chain preparation hook returning `{ ...request, to: zeroAddress }`, guarded `sendTransaction({ to: NONZERO, ... })` signed and submitted a transaction whose decoded destination was zero.

   This requires a custom chain hook; it is not a bypass demonstrated with stock Sepolia configuration.

   **Fix:** validate the final prepared transaction immediately before signing and the final formatted transaction before JSON-RPC submission. Ensure internal action resolution reaches those checks. Add hook/formatter tests.

3. **Medium — Raw wallet sends remain an explicit escape from the broader sending guarantee.**  
   `packages/core/src/zeroDestinationGuard.ts:27–28,46–56`

   Both `sendRawTransaction` and `sendRawTransactionSync` remain exposed by the factories. A previously signed zero-destination transaction goes directly to the transport. Signing elsewhere does not make its submission cease to be a call to zero.

   This does **not** bypass the seven named entry points, but it contradicts the broader premise that these clients refuse every wallet action that sends to zero.

   **Fix:** decode and reject zero-destination raw transactions before submission, including Sync; alternatively explicitly narrow the promised invariant to exclude these actions.

4. **Medium — Static imports precede the “before any file” gate.**  
   `scripts/sp550-pin-fill.ts:40–45`

   Importing `sp550CutoverGate` eagerly imports `abis/index.ts`, which imports numerous ABI JSON files. Those data files are loaded before `main()` checks `--write`. A missing or malformed ABI can therefore terminate module loading instead of producing the promised exit 2—even while the allow-list remains empty.

   **Fix:** place readiness constants/checking in a dependency-light module, perform write-intent refusal first, and dynamically import the ABI-dependent implementation afterward. Ordinary executable/module loading necessarily needs an explicit exception to a literal “any file” promise.

5. **Low — Readiness does not prove a real, enforced allow-list.**  
   `packages/core/src/sp550CutoverGate.ts:111–114`

   Today, immutable `false` prevents unlocking: **I found no current runtime bypass**. However, once that flag is changed, `Object.freeze({ placeholder: {} })` satisfies the remaining predicate without specifying a single getter. The function checks neither completeness nor enforcement nor freezing. The enforcement flag is a declaration, not evidence that comparisons happen.

   The test at `scripts/sp550-pin-fill-core.test.ts:621` only exercises the current false/empty state; it never tests its advertised “filled table alone” condition.

   **Fix:** validate coverage and rule structure against the scanned getter set, reject missing entries during actual comparisons, and test malformed/partial tables independently of the flag.

6. **Medium — Guard tests can exercise stale compiled code instead of the reviewed source.**  
   `packages/sdk/__tests__/zeroDestinationGuard.test.ts:5–6`

   The factories import `@aastar/core`, whose package exports resolve to `dist/index.node.js`. The root Vitest configuration has no source alias. Changing or breaking `src/zeroDestinationGuard.ts` without rebuilding core can leave these tests passing against an older build.

   The existing compiled guard currently matches the reviewed implementation; the issue is regression detection.

   **Fix:** resolve workspace packages to source in these tests, or enforce a fresh core build as a prerequisite to this specific test command.

7. **Low — The CLI test does not establish absence of I/O.**  
   `scripts/sp550-pin-fill-core.test.ts:605–609`

   Exit 2, an expected message, and absence of `ENOENT` do not prove nothing was read or requested. An earlier successful file read—or a caught read/RPC failure—would leave every assertion passing.

   **Fix:** instrument application file reads and network operations and assert zero calls before refusal. Include argument permutations and duplicate flags.

I found no write-enabled spelling/order bypass: both the early gate and eventual write boundary use `args.includes('--write')`; `--write=…` is explicitly refused, and other spellings do not enable writing. Zero-address `signAuthorization` represents delegation revocation, so it is not itself a zero-destination call. Viem 2.43.3’s `writeContract` still requires ABI encoding; I found no separate data-only shortcut.

Validation used worktree-local source and installed viem, plus in-memory transport reproductions. No real transactions were submitted, files changed, or full test suite run.

## Round 3

**No Critical, High or Medium finding confirmed.** I found no current bypass of either invariant under the stated threat model. Four Low findings remain.

1. **Low — The extension erases viem’s action types.**  
   **Location:** `packages/core/src/zeroDestinationGuard.ts:55`, `:72`  
   **Classification:** Inside the honest-caller model; type-safety issue, not a demonstrated zero-address bypass.

   The wrappers expose `(raw: any) => Promise<any>`, replacing parameter validation and return inference for the newly wrapped actions. An in-memory TypeScript probe rejected `plain.signTransaction({ to: 123 })` but accepted the same call after `.extend(zeroDestinationGuard)`, along with accessing a nonexistent method on its result.

   The four factories’ explicit return types preserve their public wallet-action signatures, so this primarily affects direct consumers of the exported extension and inferred internal clients.

   **Fix:** Preserve the corresponding generic viem action signatures on the extension. Add compile-time checks for invalid parameters and inferred return types.

2. **Low — Local SDK tests can validate stale compiled guard code.**  
   **Location:** `packages/sdk/__tests__/zeroDestinationGuard.test.ts:133`  
   **Classification:** Inside the model; regression-test coverage gap.

   The tests and factories import `@aastar/core`, whose package exports resolve to `packages/core/dist`. The Vitest configuration has no source alias, and the test commands do not rebuild first. After a passing build, removing a guard from `src/zeroDestinationGuard.ts` and rerunning the SDK tests can still exercise the previous compiled implementation and pass.

   CI builds before testing, which mitigates this there.

   **Fix:** Alias the package to source for these tests, or make the focused test command explicitly rebuild its dependency.

3. **Low — The CLI tests do not prove the claimed readiness conditions or absence of pre-refusal I/O.**  
   **Location:** `scripts/sp550-pin-fill-core.test.ts:599`, `:621`  
   **Classification:** Invariant 1 assurance issue; not an invariant-2 attack.

   The readiness test only exercises the current `false` flag and empty table. Replacing the predicate with `() => SP550_WIRING_ALLOWLIST_ENFORCED` would still pass, despite removing the empty-table protection.

   The CLI tests check exit status and stderr using a nonexistent manifest and no RPC URLs. An added, successfully completed file read—or conditional RPC access when an URL is supplied—before the refusal could leave these tests passing.

   **Fix:** Test readiness combinations explicitly, including `true + empty`, and instrument application filesystem/network operations to assert zero calls before refusal. Supply RPC arguments in the refusal cases.

4. **Low — The snapshot guarantee is overstated, and its batch test does not check the transmitted destination.**  
   **Location:** `packages/core/src/zeroDestinationGuard.ts:41`; `packages/sdk/__tests__/zeroDestinationGuard.test.ts:207`  
   **Classification:** Outside the stated model for adversarial accessors; test and documentation correctness issue.

   `snap` reads `args.calls` during spreading, during `Array.isArray`, and again for `.map`. A runtime probe confirmed **three getter invocations**, contradicting “getters are read exactly once.” A getter that rejects repeated evaluation can therefore throw synchronously.

   This is **not a confirmed destination bypass**: the resulting copied calls are checked and forwarded together. However, the batch test discards errors, records only RPC method names, and never checks the `wallet_sendCalls` payload. Sending an incorrect destination would not necessarily fail its assertions.

   **Fix:** Copy the request first, then inspect and copy `snapshot.calls`. Record RPC parameters and assert the exact forwarded destinations; require a successful positive control.

The remaining premises checked out for the installed viem **2.43.3**:

- The early gate and eventual write branch use the same `args.includes('--write')` predicate; argument ordering cannot separate them. `--write=…` is rejected.
- The frozen empty table and constant `false` enforcement flag cannot currently satisfy readiness. The predicate is nevertheless a release switch, not semantic proof of a complete allow-list; FU-124 must implement that validation.
- Contract-write dispatch, batch fallback and Sync paths preserve the checked destinations for ordinary requests. Data-only contract writes provide no alternate unchecked destination.
- Ordinary deployment has no destination. `signAuthorization` signs delegation/revocation, not a call to the delegation address. Malicious chain rewriting remains outside the agreed model.

Validation used worktree-local source inspection, in-memory runtime probes and a TypeScript probe. All seven required actions and five additional guarded entry points rejected zero destinations with **zero signer calls and zero transport requests**. I did not run the full Vitest suites or modify files.

