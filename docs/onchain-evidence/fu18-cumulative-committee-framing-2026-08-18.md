# FU-18 — cumulative Tier-3 composite ACCEPTED under COMMITTEE framing (Sepolia)

**Date:** 2026-08-18
**Runner:** `tests/regression/onchain-evidence/tier3-composite-e2e.ts`
**Command:** `AASTAR_DVT_ENV=testnet-local pnpm exec tsx tests/regression/onchain-evidence/tier3-composite-e2e.ts`
**Commit:** `c6925456` (branch `feat/cc48-canonical-v0.31.0`, PR #326)

This is the RELEASE-CHECKLIST §4 mandatory gate for the cumulative signature family, re-run after
FU-18 taught `packCumulativeT2/T3Signature` the CC-98/CC-103 committee framing. It is the cumulative
counterpart to `cc103-committee-positive-e2e.ts` (which proved the same for the `ALG_BLS` 0x01 triple).

## Result

```
[6] validateUserOp(0x05 composite)                   = 0  ✅ ACCEPTED
[7] validateUserOp(OLD messagePoint format, +321B)   = 1  ✅ rejected
[8] validateUserOp(LEGACY framing under committee)   = 1  ✅ rejected
```

| field | value |
|---|---|
| account | `0x0533A3505d26aD19Cfd77Cb57ED835F7a88068A5` |
| owner | `0xb5600060e6de5E11D3636731964218E53caadf0E` |
| guardian | `0xC9247f921340A2816113dfceE7E6881dd8e2bAB3` |
| userOpHash | `0x91c492871dd382764af5d66954f6b5da6437c52eb416b6996bebb3277662c31c` |
| p256 passkey x | `0x16eedaf32b2ca26df0edafd04938678cda80035338808fb6b2796f5339f7fdc9` |
| framing | **COMMITTEE**, 3 signers, `TREE_DEPTH=14`, `requiredQuorum=2` |
| signature | **1954 bytes** = `1 + 64 + [32 + 3×512 + 256] + 65` |
| algId | `0x05` (cumulative Tier-3: P256 + DVT BLS + guardian ECDSA) |

Contributing nodeIds (all `isRegistered` on the committee validator, verified before aggregating):

```
0x1f5e41c69465733eeb19341d95853ee6d9295a9e6698f5398d70e509be8f326d
0xe3a4a3af3973b65bc95dd962e767e17592dfb331f3544209676271b188fd9f80
0x96d64ba8240694153c757707732a11ff175380065ddacb6406094c9d5fa5cfce
```

## Why all three assertions are needed

The positive alone would not prove the framing is load-bearing:

- **[6] positive** — the SDK-packed committee-framed 0x05 composite is accepted.
- **[7] old-format negative** — the pre-#234 layout (real `messagePoint` + a real owner ECDSA over
  `keccak256(messagePoint)`, +321B) is rejected. Every component is individually VALID, so the
  rejection isolates the length/format drift rather than bad inputs. Spliced from the accepted
  composite, so it exercises whichever framing [5] chose.
- **[8] legacy-under-committee negative** — the SAME signers, SAME aggregate, packed with LEGACY
  framing, are rejected. This is the one that makes the design provable: it shows the account really
  discriminates on `committeeActive()` and does not simply accept committee bytes as an oversized
  legacy blob. Without it, [6] passing would be consistent with the account ignoring framing entirely.

## Framing selection

The runner does not hardcode a framing. It reads `committeeActive()` from the validator mounted for
the account, enrolls via `enrollInCommitteeValidator()` when needed, fetches per-signer `slot` +
Merkle proof with `fetchCommitteeSigners`, and only then packs. Under `committeeActive() == false`
it emits byte-identical legacy output (pinned by the pre-existing golden parity vectors).

## REAL on-chain execution — `EntryPoint.handleOps`

The eth_call above proves the account ACCEPTS the signature; it does not prove the op EXECUTES.
`tests/regression/onchain-evidence/tier3-committee-handleops.ts` closes that gap on the SAME account
(same factory/salt/config, so it is not a lookalike):

```
handleOps tx  0xca6c0b69f80e3622009038a7d586a3cf5c00a316257ca03cc314cbd6a9fa5b75
receipt       status=success  block=11515238  gasUsed=739947
UserOpEvent   success=true  actualGasUsed=877846  actualGasCost=0.002672405766704878 ETH
userOpHash    0xe9b393cc9a4df6169396b167c9af3a4bf6c5243a138f5e1fc22b5ee14cfba79b
framing       COMMITTEE, 3 signers, TREE_DEPTH=14, quorum=2, 1954 bytes (algId 0x05)
callData      execute(owner, 0, 0x)  — benign 0-ETH self-call; the payload is not the point
deposit       depositTo tx 0x7e7af6bd548b45bffc9368eed4b6b69974e83ab91f3c13af19c69e54833281da
explorer      https://sepolia.etherscan.io/tx/0xca6c0b69f80e3622009038a7d586a3cf5c00a316257ca03cc314cbd6a9fa5b75
```

`UserOperationEvent.success == true` is the assertion that matters — a mined transaction alone would
only prove the bundle was included, not that validation passed and the call ran. The runner also
re-checks `validateUserOp == 0` by eth_call BEFORE submitting, so a doomed op never costs gas.

Gas note: `verificationGasLimit` is 900k because committee framing verifies k Merkle proofs on top of
the BLS pairing, and `preVerificationGas` is 200k because a 1954-byte signature is expensive calldata.
Legacy framing needs materially less on both counts.

## Environment

Three local DVT nodes (`AASTAR_DVT_ENV=testnet-local` → `127.0.0.1:3001/3002/3003`) re-registered on
the committee validator `0x1A8Db639b5d8Bd5742edB083656EDD56f416cd64`, reusing their already-registered
BLS keys. Node identities are pinned against `DVT_CONFIG` and de-duplicated by signature bytes before
aggregation, so k partials from fewer than k distinct signers cannot report a quorum that does not exist.
