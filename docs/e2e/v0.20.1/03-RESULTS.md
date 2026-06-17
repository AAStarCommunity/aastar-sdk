# 03 · RESULTS — Real on-chain evidence (v0.20.1)

> All txs on Ethereum Sepolia, every state-changing tx asserted `status=0x1` before reporting.
> Each scenario op was issued through the SDK wrapper named in [02-PLAN](./02-PLAN.md).
> Run: `pnpm exec tsx tests/regression/onchain-evidence/<file>.ts` (kms needs `KMS_E2E=1`).

## A1 · Agent lifecycle — `beta4-agent-lifecycle-e2e.ts` ✅

Factory `0x52c5190E…` (v0.19) · AgentRegistry `0x3895b3E6…` (v0.19) · owner JASON.

| Step | SDK call | Tx | Gas |
|---|---|---|---|
| createAgentAccount | `airAccountFactoryActions().createAgentAccount` | [`0x52b39e21…017530`](https://sepolia.etherscan.io/tx/0x52b39e21cc1346ddd79f7d7a341e57cd9fdfbfd3de962f7a3720ded8d8017530) | 1,196,045 |
| registerAgent | `AgentRegistryService.encodeRegisterAgentViaAccount` | [`0xeed08f22…d709ee`](https://sepolia.etherscan.io/tx/0xeed08f224961186406dacd6aa1511b295a465fea3c860459e7a3c39f60d709ee) | 153,578 |
| revokeAgent | `AgentRegistryService.encodeRevokeAgentViaAccount` | [`0xcc46a79d…a7895e`](https://sepolia.etherscan.io/tx/0xcc46a79d3f18bd35bdbc9f5f6dc9830082817229fba1f6fdce68a5c8ffa7895e) | 59,652 |

**L2 (on-chain, receipt-confirmed):** register & revoke each emitted their AgentRegistry event (`receipts.agent[].logs == 1`). **L3 (runner-asserted during the live run):** `isRegisteredAgent` true→false · `getHumanOwner`==account · `getAgentCount`==1 — these intermediate reads are asserted by the runner at run time, not re-read post-hoc (the account is now revoked).

## A2 · Gasless sponsorship — `beta1-sponsored-gasless.ts` ✅

account `0x5d310ba2…` (0 ETH) · PaymasterV4 `0xD0c82dc1…` · gas token `0xDf669834…`.

| Step | Tx |
|---|---|
| depositFor (PaymasterOperator) | [`0xc3082233…f576ca`](https://sepolia.etherscan.io/tx/0xc30822336b7252abec851a6438ccd0a3781688ad787b554deafaf70d03f576ca) |
| updatePrice (oracle refresh) | [`0x93a70bfa…b2b4c05`](https://sepolia.etherscan.io/tx/0x93a70bfab93cf15f9febc972aeb1f0f536d56bd7d638ec52099ecae6d02b4c05) |
| sponsored UserOp (bundle) | [`0x0ba2f6db…e9c9b20`](https://sepolia.etherscan.io/tx/0x0ba2f6dbfdb5bdf9a790d4400ed6afb26d2d46aae6b1217cbb14424c6e9c9b20) (userOpHash `0x237828d6…`) |

**L2 (the proof):** account ETH `before=0 after=0` · in-paymaster token deposit `200 → 161.26485` (Δ 38.735 debited by `postOp`). Gas paid in xPNTs, account never held ETH.

## A3 · DVT combined signature — `dvt-realnode-e2e.ts` ✅

AA account `0x45Dfe3D5…` · verifier `AAStarBLSAlgorithm 0x68c381Ad…` (v0.19) · userOpHash `0x6c3f7e18…`.
2 live nodes co-signed (`0xb548c8e2…`, `0x7f7e6290…`); SDK `dvtWire.encodeDVTVerifierProof` → 320-byte proof.

- `validate(userOpHash, proof)` = **0** ✅ ACCEPTED
- negative control (both nodeIds, one node's sig) = **1** ✅ rejected ⛔

## A4 · KMS create-account → sign — `kms-account-e2e.ts` ✅ (`KMS_E2E=1`)

| Step | Result |
|---|---|
| `KmsManager.createKey(passkeyPubKey)` | KeyId `e3d3e7be-b7df-44a4-a1a8-40dfb229f2e1` (secp256k1, passkey-bound) |
| `KmsManager.getPublicKey` → derive | address `0xD7820A319f1C1772eB2def53D0889ef0195504B2` |
| `KmsManager.signHashWithCeremony` (software passkey) | 65-byte signature |
| `recoverAddress(hash, sig)` | `0xD7820A31…` == TEE address ✅ (see `logs/kms-run.txt`) |

## B1 · Session keys — `beta2-session.ts` ✅

account `0xcc5e669d…`-deployed · validator `0x655ca2e9…` · all via `SessionKeyService`.

| Step | Tx |
|---|---|
| grantSessionDirect | [`0xe5f16c4f…7aac6cb`](https://sepolia.etherscan.io/tx/0xe5f16c4ff1294bd41ebac02dbddd48c96ed03249b7074e075bae5f97a7aac6cb) |
| revokeSession | [`0xfeb7bfa5…e613d9`](https://sepolia.etherscan.io/tx/0xfeb7bfa583de5c9bdfb865d96c89b7c982afeccf24f25a5c367dc3ae91e613d9) |
| grantP256SessionDirect | [`0xa7a62f74…e1c04cd`](https://sepolia.etherscan.io/tx/0xa7a62f746f60fa10b1634c1f6d4c8493279b7b030cdc3254dcf071046e1c04cd) |
| revokeP256Session | [`0xaa2885a6…6f386a`](https://sepolia.etherscan.io/tx/0xaa2885a64e64c888e0fe213306936dcc2ddd3ed6ea8127278202bf6b796f386a) |

**L2 (on-chain, receipt-confirmed):** each grant/revoke emitted its SessionKeyValidator event (`receipts.session[].logs == 1`). **L3 (runner-asserted during the live run):** `isSessionActive` / `isP256SessionActive` true after grant, false after revoke — intermediate reads asserted at run time, not re-read post-hoc.

## B2 · Social recovery — `beta2-recovery.ts` ✅ (full table: `.beta2-recovery.last.md`)

account `0x9144BCaf…` · owner JASON · all ops via `RecoveryService`.

| Step | Tx |
|---|---|
| fund g1 / g2 | `0x98a35098…` / `0x1d4428b1…` |
| deploy account | `0x2f95e3f1…` |
| addGuardian g1 / g2 | `0xf3e971ba…` / `0x09eafc38…` |
| proposeRecovery / approveRecovery (2-of-3) | see `.beta2-recovery.last.md` |
| executeRecovery (immediate) | ⛔ `RecoveryTimelockNotExpired` — 2-day gate enforced |

**L2:** `activeRecovery.approvalBitmap` = `0x3` (2 approvals) · newOwner `0x9cA88416…` · executeAfter `1781838612`.

## B3 · Weighted signatures — `beta3-weighted-sig.ts` ✅ (full table: `.beta3-weighted-sig.last.md`)

account `0x69F57c9A…` · owner BOB · all ops via `WeightedSignatureService`.

| Step | Tx |
|---|---|
| fund g1 / g2 | `0xc0cbc605…` / `0xff2e97f2…` |
| deploy account | `0xe575aa95…` |
| setWeightConfig (cfg1) | `0xca75c466…` |
| proposeWeightChange / approveWeightChange ×2 (2-of-3) | see `.beta3-weighted-sig.last.md` |
| executeWeightChange (immediate) | ⛔ `WeightChangeTimelockNotExpired` — 2-day gate enforced |

**L2:** `weightConfig`==cfg1 · `pendingWeightChange.approvalBitmap` = `0x3`.

---

**Tally:** 7 scenarios, all green (2 carry first-class ⛔ negative-revert assertions). Every scenario op routed through the SDK wrapper. Independent adversarial verdict in [05-CODEX-CHALLENGE](./05-CODEX-CHALLENGE.md).
