# DVT combined-signature wire format (aastar-sdk #63)

> ⚠️ **SUPERSEDED for the account/verifier wire (Phase A, #63 / airaccount-contract #110).**
> The DEPLOYED `AAStarBLSAlgorithm` beta.2 (`0xA9EE4f8A…`, Sepolia) verifier uses an **explicit
> `nodeIds` list**, NOT the `signerMask` bitmask described in §2–§3 below. The LIVE-verified,
> byte-for-byte authoritative wire is implemented in `packages/core/src/crypto/dvtWire.ts`
> (`encodeDVTAccountSignature` / `encodeDVTVerifierProof` / `encodeG2Point`) and asserted against
> live Sepolia txs in `packages/core/__tests__/crypto/dvtWire.test.ts`:
>
> ```
> T2 (0x04): [0x04][P256 r(32)][P256 s(32)][nodeIdsLength(32)][nodeId_1(32)…nodeId_N(32)][blsSig(256)]
> T3 (0x05): [0x05][P256(64)][nodeIdsLength(32)][nodeIds(N×32)][blsSig(256)][guardianECDSA(65)]
> verifier:  validate(userOpHash, [nodeIds(N×32)][blsSig(256)])   // account strips tier+P256+nodeIdsLength
> ```
>
> `blsSig` = 256-byte EIP-2537 G2 (`x.c0@16 / x.c1@80 / y.c0@144 / y.c1@208`). `nodeIds` order MUST
> match the nodes' signing/aggregation order. `messagePoint` is NOT attached (#45). The `signerMask`
> helpers (`BLSHelpers.encodeDVTProof` / `slotsToSignerMask`) are retained `@deprecated` for the
> legacy aggregator path only. The §1 message-binding (decision B / `(u0,u1)` golden surface) is
> unchanged and still authoritative.

> Status: aligned to the **frozen** DVT program spec (hub `AAStarCommunity/YetAnotherAA-Validator#42`).
> Normative signature sources: SP `BLSGoldenVectors.t.sol` (golden vectors) + airaccount-contract #110 (account-side decode).
> This doc specifies what **aastar-sdk** produces as the runtime aggregator.

## 1. Message binding (decision B, C1)

The DVT nodes sign over the **EntryPoint UserOp hash**, nothing re-wrapped:

```
msg          = userOpHash = EntryPoint.getUserOpHash(userOp)   // already binds account, nonce, chainId, EntryPoint
msgG2        = hashToG2(bytes(userOpHash), DST)                 // recomputed ON-CHAIN by the verifier; NOT sent
DST (frozen) = "BLS_SIG_BLS12381G2_XMD:SHA-256_SSWU_RO_POP_"
```

- **No extra `abi.encode(domainSeparator, account, chainId, nonce)`** — that is redundant double-binding (`userOpHash` already commits to all of them).
- **C1 calling convention:** the DVT co-sign entry point MUST pass `expectedMessageHash = userOpHash` (NOT a slash/reputation proposal hash). The on-chain verifier is message-agnostic; the binding is the caller's responsibility.

### Cross-repo golden surface — `(u0, u1)`
Full `hashToG2` needs EIP-2537 precompiles (absent on cancun), so the byte-for-byte cross-repo contract is the `hash_to_field` intermediate:

```
hash_to_field(userOpHash, DST, count=2) -> (u0, u1)   // two Fp2 elements
```

Each `Fp` is serialized EIP-2537-style (64 bytes = 16 zero bytes ++ 48-byte big-endian) and split into two `bytes32`: `a` = high 32 bytes, `b` = low 32 bytes. The SDK computes this via `@aastar/core` `hashToFieldU0U1(userOpHash)` and asserts it equals SP's 5 golden vectors byte-for-byte (`packages/core/__tests__/crypto/hashToField.test.ts`).

> ⚠️ `@noble/curves` defaults the BLS12-381 G2 DST to the **`_NUL_`** scheme. The frozen DVT DST is **`_POP_`** — the SDK overrides it (`BLS_POP_DST`). Using the default silently diverges from node + contract.

## 2. Proof wire format

```
proof = abi.encode(uint256 signerMask, bytes sigG2)        // BLSHelpers.encodeDVTProof(signerMask, sigG2)
```

- **`pkG1` and `msgG2` are NOT included.** The verifier rebuilds the aggregate public key from `signerMask` → on-chain registered keys, and recomputes `msgG2` itself. (This is intentionally narrower than the v3 `encodeBLSProof` `(pkG1, sigG2, msgG2, signerMask)` still used by the slash/reputation path.)
- **`sigG2`** = BLS12-381 aggregate of the contributing nodes' partial signatures (`BLSSigner.aggregateSignatures`).
- **`signerMask`** — bit `i` (LSB = 0) ↔ registration **slot** `i+1` (1-indexed) ↔ `BLSAggregator.validatorAtSlot(i+1)`. A validator at slot `s` sets bit `s-1`. Built from the on-chain slots via `aggregatorActions(...).buildSignerMask({ signers })` (reads each signer's slot, rejects inactive / slot-0 / duplicate). **Never use a 0-indexed array position** — the contract rebuilds the wrong `pkAgg` and verification fails.

## 3. On-chain verification

```solidity
BLSAggregator.verify(
    bytes32 expectedMessageHash,  // = userOpHash
    uint256 signerMask,
    uint256 requiredThreshold,    // from defaultThreshold() / minThreshold() or the account policy
    bytes   sigBytes              // = sigG2
) view returns (bool)
```

The SDK exposes this read via `aggregatorActions(...).verify(...)` for an optional pre-submit local check. The account's `validate` path (airaccount-contract #110) decodes the `(signerMask, sigG2)` proof from the UserOp signature and calls the same verifier with `expectedMessageHash = userOpHash`.

## 4. Policy trigger (when DVT is required)

Whether a UserOp needs DVT co-sign is decided by the on-chain **PolicyRegistry** (SP v5.4, per-sender / per-asset / per-contract; governance-gated, CA-uneditable; asymmetric timelock via an external `TimelockController`). The SDK reads it via `policyRegistryActions(...)` (`checkPolicy` / `getAssetPolicy` / `getContractScope`) and treats its own pre-check as a best-effort mirror — the on-chain validation-time check is authoritative, postOp debit is final.

## 5. SDK building blocks (shipped)

| Step | SDK API |
|---|---|
| message → `(u0,u1)` golden surface | `hashToFieldU0U1(userOpHash)` (`@aastar/core`) |
| partial sigs → aggregate `sigG2` | `BLSSigner.aggregateSignatures(parts)` |
| signers → `signerMask` (by on-chain slot) | `aggregatorActions(addr)(client).buildSignerMask({ signers })` |
| `(signerMask, sigG2)` → proof bytes | `BLSHelpers.encodeDVTProof(signerMask, sigG2)` |
| optional pre-submit verify | `aggregatorActions(addr)(client).verify({ expectedMessageHash, signerMask, requiredThreshold, sigBytes })` |
| policy: is DVT required? | `policyRegistryActions(addr)(client).checkPolicy(...)` |

**Pending (gated):** the client-direct partial-sig collection (D2, independent channel not via CA) waits on the #42 node-protocol channel definition; the owner-facing loosen flow goes through the `TimelockController` (no registry-level pending getter exists).
