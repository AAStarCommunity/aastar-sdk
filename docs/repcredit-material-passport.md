# RepCredit material passport — field list and redaction boundary

*CC-115 B4b. Implementation: `scripts/repcredit/material-passport.ts`, exercised by
`scripts/repcredit/material-passport.test.ts`.*

The **material passport** is the part of `manifest.json` that says *which files are the evidence* and
*what each one hashed to*. A reader who has the bundle and this document should be able to decide, by
themselves, whether the bundle they hold is the bundle that was produced.

---

## 1. Passport entry — the three fields, and why only three

Each entry of `manifest.json → materialPassport`:

| field | type | why it is there |
|---|---|---|
| `path` | string | **relative to the bundle root**, forward slashes. Relative so a passport survives the bundle being moved or archived; an absolute path would also publish the producing machine's directory layout. |
| `bytes` | number | a cheap tripwire a reader can check **without** hashing — a size change is visible in a plain directory listing. |
| `sha256` | string | the attestation itself. |

Nothing else. In particular there is **no timestamp and no "verified" flag**: a timestamp would make
two byte-identical bundles compare unequal, and a self-asserted "verified" flag is the kind of field
that keeps reading `true` long after it stopped being earned.

## 2. Which files are listed

Fixed list, assembled in `scripts/repcredit-e2e.ts`:

```
raw/superpaymaster-deployment.json
raw/superpaymaster-broadcast.json        (Sepolia only)
raw/airaccount-deployment.json
raw/network-preflight.json
raw/validator-setup.json
raw/e2e.json
raw/overissue-verifier-broadcast.json
raw/security-controls.json
raw/validator-refunds.json               (Sepolia only)
raw/measurements.jsonl                   (unless --skip-measurements)
derived/measurement-summary.json         (unless --skip-measurements)
```

`manifest.json` itself is **not** in its own passport — it cannot be, since it contains the hashes.

## 3. The ordering property: redact, *then* hash

`redactEvidence()` runs **before** the passport is built. This is not a preference:

> If the order flips, every hash describes bytes that no longer exist on disk. A verifier re-hashing
> the shipped bundle then sees **every** entry mismatch — and the natural reading of "all hashes are
> wrong" is *tampered with*, not *hashed the wrong version*. **A tamper alarm that fires on every
> honest run trains the reader to ignore it.**

`buildMaterialPassport` enforces the structural half: it **refuses any file whose bytes live outside
the bundle root**. Redaction only walks that root, so such an entry would be attested without ever
having been redacted — and would look exactly like every other entry.

The containment test is on the **resolved real path**, not on how the path is spelled. #369 review
found why that distinction is the whole point: a *symlink inside the root* pointing at a file outside
it passed a literal `resolve`+`relative` check and got hashed, while `redactSecrets` skipped it — a
symlink's `Dirent` reports `isFile() === false`, so the directory walk never opens it. Same end state
("attested, never redacted") reached by *path inside, content outside* rather than by *path outside*.

With `realpathSync` on both sides, "was this redacted?" is answerable from the passport alone. Without
it, the passport answered a question about the path while the reader believed it answered one about
the bytes.

## 4. What redaction covers — and what it does NOT

`redactSecrets` performs **exact substring replacement** of the secrets it is handed, then re-reads
each file and throws if any secret survived. That verify pass is the point: a redactor that silently
fails is indistinguishable from one that had nothing to do.

It does **not**, and each of these is deliberate rather than an oversight:

| not covered | why not fixed here |
|---|---|
| different **case** | matching case-insensitively would also match unrelated text |
| a missing **`0x`** prefix | a bare-hex match would hit ordinary hex — of which evidence is mostly made |
| **encoded** forms (URL-, JSON-escaped) | decoding to search means guessing an encoding |
| secrets it was **not told about** | it is a redactor, not a scanner |

Every one of those widenings turns redaction into guessing, and **a redactor that guesses will
eventually mangle evidence**. The narrow contract is honest and testable.

The breadth is supposed to come from somewhere else — from not putting secrets into the evidence in
the first place:

- `manifest.safety.secretsWritten: false` is the claim;
- `manifest.parameters.rpcUrl` is written as the literal `"[REDACTED]"` **at construction** on
  Sepolia, rather than relying on this pass to find it later.

Redaction is the second line, not the first. Treating it as the first is how a secret ends up in a
file whose exact byte form nobody predicted.

## 5. How this is checked

`scripts/repcredit/material-passport.test.ts` — 8 cases, each mutation-verified:

| guard | mutation that reds it |
|---|---|
| refuses a file outside the root | disable the containment `if` |
| empty secrets must not match everywhere | drop the `length > 0` filter |
| path is relative, not absolute | emit the absolute path |
| verify pass catches a survivor | disable the post-write check |

Two further mutations were tried first and produced **no** red — both turned out to be *equivalent
mutations* (disabling one clause of a three-clause condition that another clause already covered, and
removing an early return that only short-circuits an already-empty loop). Recorded because "no test
went red" has three causes and only reading the code separates them: the test is blind, the change made
no difference, or the environment cannot produce the difference (see `docs/agent/verification.md` §1).
