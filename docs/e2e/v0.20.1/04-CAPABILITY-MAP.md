# 04 · CAPABILITY MAP — what each tx proves (scoped) (v0.20.1)

> Adversarial scoping rule: claim ONLY what the tx mutates on-chain / what the SDK wrapper
> actually drove. Reads are `(read-only)`. Anything unit-tested-only or not-live-exercised is
> listed under **Scope-downs** — no overstatement.

| # | Capability | Evidence | What it proves (scoped) | User value |
|---|---|---|---|---|
| 1 | Agent account creation | A1 create `0x52b39e21…` | SDK `createAgentAccount` deploys a CREATE2 agent account on the v0.19 factory; predicted addr has bytecode; owner==JASON | a human can mint an agent-controlled smart account |
| 2 | Agent register/revoke via SDK | A1 register `0xeed08f22…` / revoke `0xcc46a79d…` | SDK `AgentRegistryService.encode{Register,Revoke}AgentViaAccount` produces the account-routed calldata; both txs succeeded and each emitted its AgentRegistry event on-chain. The intermediate `isRegisteredAgent`==true is **runner-asserted** during the live run (final on-chain state is revoked) | agent lifecycle managed entirely through the SDK |
| 3 | Gasless sponsorship | A2 bundle `0x0ba2f6db…` | A 0-ETH account's UserOp mined; gas paid from the PaymasterV4 escrow, account's in-paymaster token deposit debited 38.735 by `postOp` | zero-ETH users transact, paying gas in community token |
| 4 | DVT combined-sig acceptance | A3 `validate=0` on `0x68c381Ad…` | SDK `dvtWire`-assembled proof from 2 live node co-signs is ACCEPTED by the live v0.19 verifier; tampered proof REJECTED | DVT-gated account ops verify on-chain via the SDK |
| 5 | KMS create-account + signing | A4 KeyId `e3d3e7be…` → addr `0xD7820A31…` recover ✅ | SDK `KmsManager` mints a TEE secp256k1 wallet bound to a passkey, and a WebAuthn-ceremony-gated TEE signature recovers to that wallet | passwordless TEE-custodied account + signing via the SDK |
| 6 | Session keys (secp256k1 + P256) | B1 grant/revoke `0xe5f16c4f…`/`0xaa2885a6…` | SDK `SessionKeyService` grants then revokes both a secp256k1 and a P256 session; all 4 txs succeeded and each emitted its SessionKeyValidator event on-chain. The intermediate `isSessionActive`/`isP256SessionActive`==true is **runner-asserted** during the live run | delegated, scoped, revocable session keys via the SDK |
| 7 | Social recovery 2-of-3 | B2 propose/approve + `0x3` bitmap | SDK `RecoveryService` drives addGuardian/propose/approve to a 2-of-3 quorum; the 2-day timelock gate is enforced (executeRecovery ⛔) | guardian-based account recovery via the SDK |
| 8 | Weighted-signature governance 2-of-3 | B3 set/propose/approve + `0x3` bitmap | SDK `WeightedSignatureService` sets a weight config + drives a 2-of-3 weight-change proposal; the 2-day timelock gate is enforced (executeWeightChange ⛔) | tiered multi-factor signing policy via the SDK |

## Scope-downs (NOT claimed)

- **Recovery / weighted EXECUTE not completed.** Both prove the flow up to the 2-day timelock
  **gate** (the revert is the asserted ⛔). The final `executeRecovery`/`executeWeightChange` after
  `executeAfter` is not run in a single session (would require a 2-day wait).
- **KMS `deleteKey` cleanup returns 400** even WebAuthn-gated — flagged for the KMS side
  (likely a delete-specific challenge purpose). Test keys are harmless but linger; the create→sign
  capability is unaffected.
- **DVT `validate()` is an `eth_call`**, not a state-changing tx — it proves verifier acceptance,
  not a settled UserOp through the DVT path end-to-end.
- **Full DVT client-side confirm() flow** (`pending_confirmation` → `POST /signature/confirm`) is
  detection-only in this release (`DvtPendingConfirmationError` + `isPendingConfirmation`); the full
  confirm driver is tracked in #82.
- **Gasless uses the standalone PaymasterV4** (`0xD0c82dc1…`), not the v5.4 SuperPaymaster proxy
  redeploy — it proves the SDK gasless path, not the v5.4 proxy gasless path.
- **KMS positive signing uses a SOFTWARE passkey** (`P256PasskeySigner`). Hardware-authenticator
  signing remains owned by the KMS repo's hardware E2E.
