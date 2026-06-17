# 02 · PLAN — Scenario ↔ SDK API mapping + 3-layer verification (v0.20.1)

> **Validity rule (non-negotiable):** every scenario operation is invoked through the SDK's
> *wrapped scenario-level API*, NOT a hand-written/copied upstream ABI. An E2E that calls the
> contract via an inline ABI proves only the contract works — not the SDK wrapper. The runner
> files live in `tests/regression/onchain-evidence/`.
>
> **3-layer verification per scenario:**
> - **L1 Receipt** — tx mined, `status` matches the expected type (`0x1` for ✅, revert for ⛔), correct `to`.
> - **L2 State** — the load-bearing on-chain state delta happened (balance/flag/bitmap/registration).
> - **L3 Feature** — the business outcome the scenario claims (read back through the SDK).

## Tier A — headline scenarios

| ID | Scenario | SDK API (the wrapper under test) | Actor | L1 / L2 / L3 | Type |
|---|---|---|---|---|---|
| A1 | **Agent lifecycle** (create → register → revoke) | `airAccountFactoryActions().createAgentAccount` ; `AgentRegistryService.encodeRegisterAgentViaAccount` / `encodeRevokeAgentViaAccount` | JASON (owner), ANNI (guardian2) | **L1** 3 txs status=0x1 · **L2** bytecode at predicted addr, AgentRegistry binding set then cleared · **L3** `isRegisteredAgent` true→false, `getHumanOwner`==account, `getAgentCount`==1 | ✅ |
| A2 | **Gasless sponsorship** (acct 0 ETH) | `UserOperationBuilder` + `PaymasterClient`/`PaymasterOperator` (`depositFor`, `checkGaslessReadiness`, `updatePrice`) | JASON (operator) | **L1** bundle tx status=success · **L2** acct ETH 0→0, in-paymaster token deposit debited by `postOp` · **L3** UserOp settled, gas paid in xPNTs not ETH | ✅ |
| A3 | **DVT combined signature** | `dvtWire.encodeDVTVerifierProof` + `BLSSigner` (aggregates 2 live node co-signs) | JASON (AA owner) | **L1** `validate()` eth_call · **L2** verifier returns `0` (ACCEPTED) · **L3** SDK-assembled proof accepted by the live on-chain verifier | ✅ |
| A3⛔ | DVT negative control | same | — | **L1** `validate(tampered)` · **L2** returns non-zero · **L3** a proof with one node's sig but both nodeIds is REJECTED | ⛔ |
| A4 | **KMS create-account → sign** | `KmsManager.createKey` / `getPublicKey` / `signHashWithCeremony` + `P256PasskeySigner` (software passkey) | software passkey | **L1** TEE createKey ok · **L2** TEE-derived secp256k1 address · **L3** `recoverAddress(hash, sig)` == TEE address (WebAuthn-gated TEE signature) | ✅ |

## Tier B — supporting scenarios

| ID | Scenario | SDK API | Actor | L1 / L2 / L3 | Type |
|---|---|---|---|---|---|
| B1 | **Session keys** (grant/revoke secp256k1 + P256) | `SessionKeyService.encodeGrantSession` / `encodeRevokeSession` / `encodeGrantP256Session` / `encodeRevokeP256Session` + `isSessionActive` / `isP256SessionActive` | ANNI (owner) | **L1** 5 txs status=0x1 · **L2** Session 8-field tuple stored · **L3** `isSessionActive` true after grant, false after revoke (both secp256k1 + P256) | ✅ |
| B2 | **Social recovery** (2-of-3 + timelock gate) | `RecoveryService.encodeAddGuardian` / `encodeProposeRecovery` / `encodeApproveRecovery` / `encodeExecuteRecovery` + `getActiveRecovery` / `getGuardianCount` | JASON + g1/g2 | **L1** fund/deploy/addGuardian×2/propose/approve status=0x1 · **L2** `activeRecovery.approvalBitmap`==0x3 (2 approvals) · **L3** executeRecovery reverts `RecoveryTimelockNotExpired` (2-day gate) | ✅ + ⛔ |
| B3 | **Weighted signatures** (2-of-3 + timelock gate) | `WeightedSignatureService.encodeSetWeightConfig` / `encodeProposeWeightChange` / `encodeApproveWeightChange` / `encodeExecuteWeightChange` + `getWeightConfig` / `getPendingWeightChange` | BOB + g1/g2 | **L1** set/propose/approve×2 status=0x1 · **L2** `weightConfig`==cfg1, `pendingWeightChange.approvalBitmap`==0x3 · **L3** executeWeightChange reverts `WeightChangeTimelockNotExpired` (2-day gate) | ✅ + ⛔ |

## Setup operations (NOT scenario ops — fair carve-outs)

These use inline/minimal ABIs and are explicitly *not* the operation under test:
- beta.4 `factory.createAccount` / `getAddress` (account provisioning).
- `owner()` / `guardianCount()` / `guardians(i)` preflight reads (`AA_SETUP_ABI` = minimal `parseAbi`).
- Expected-revert decoders (`RecoveryTimelockNotExpired` / `WeightChangeTimelockNotExpired` via minimal `parseAbi`).
- DVT verifier `validate()` read (uses the `@aastar/core`-exported ABI).

> Audited by Codex (adversarial) — see [05-CODEX-CHALLENGE](./05-CODEX-CHALLENGE.md): **no scenario op bypasses the SDK.**
