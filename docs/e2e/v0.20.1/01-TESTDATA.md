# 01 · TESTDATA — SDK E2E Acceptance (v0.20.1)

> Source of truth for the on-chain acceptance run. Borrows the SuperPaymaster /
> airaccount-contract acceptance system (TESTDATA → PLAN → RESULTS → CAPABILITY-MAP →
> CODEX-CHALLENGE). **Every scenario is driven through the SDK's wrapped scenario-level
> API — never hand-written/copied upstream ABIs.** See [02-PLAN](./02-PLAN.md).

## Network

| Item | Value |
|---|---|
| Network | Ethereum Sepolia |
| Chain ID | `11155111` |
| EntryPoint (ERC-4337 v0.7) | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` |

## Upstream pins under test

| Upstream | Pinned version | Verify | `pnpm run upstream:versions` |
|---|---|---|---|
| AirAccount contracts | `v0.19.0-beta.2` (full Sepolia redeploy 2026-06-16) | `pnpm run upstream:check` | ✅ |
| SuperPaymaster | `v5.4.0-beta.1-redeploy` | | ✅ |
| KMS | `openapi 0.23.0` (`kms.aastar.io`) | | ✅ |
| DVT (YetAnotherAA-Validator) | `v1.3.0` | | ✅ |

## Deployed contracts hit by the acceptance run

| Contract | Address | Used by |
|---|---|---|
| AirAccount Factory (v0.19) | `0x52c5190E7308Ea9B149157FF016cC99B6C6bf984` | agent |
| AgentRegistry (v0.19) | `0x3895b3E6fEf4e121E6289dC7881A0eEd5283C652` | agent |
| AAStarBLSAlgorithm (DVT verifier, v0.19) | `0x68c381Ad3A2e3380F22840008027E9Ec2783F43A` | dvt |
| beta.4 AirAccount Factory | `0x3a9127a5f0b4ca734d54629d0c3ad9f52739c071` | gasless / session / recovery / weighted |
| SessionKeyValidator | `0x655ca2e9a2d1178f7fbcea1856560d1e0c657ebf` | session |
| PaymasterV4 | `0xD0c82dc12B7d65b03dF7972f67d13F1D33469a98` | gasless |
| Gas token (xPNTs) | `0xDf669834F04988BcEE0E3B6013B6b867Bd38778d` | gasless |
| KMS TEE | `https://kms.aastar.io` | kms |

> AirAccount **v0.19.0-beta.2 was a full redeploy** (the `ACCOUNT_VERSION` bump changed
> bytecode → all 11 addresses moved). The agent + DVT scenarios re-verify the SDK against the
> NEW addresses; the radar (`pnpm run upstream:check`) confirms the SDK is pinned to them.

## Actors

| Actor | EOA | Role |
|---|---|---|
| JASON | `0xb5600060e6de5E11D3636731964218E53caadf0E` | owner / operator (agent, gasless, recovery, dvt) |
| ANNI | `0xEcAACb915f7D92e9916f449F7ad42BD0408733c9` | guardian2 (agent), owner (session) |
| BOB | `0xF7Bf79AcB7F3702b9DbD397d8140ac9DE6Ce642C` | owner (weighted) |
| guardians g1/g2 | fresh per run | recovery / weighted 2-of-3 |
| software passkey | fresh P256 per run (`P256PasskeySigner`) | kms |

Keys are read from `.env.sepolia` (`PRIVATE_KEY_JASON` / `PRIVATE_KEY_ANNI` / `PRIVATE_KEY_BOB`).
**Funding gate:** JASON ~6.5 ETH (covers agent + recovery + guardian funding); BOB funded for weighted.

## SDK packages exercised (the scenario-level API under test)

| Scenario | SDK wrapper |
|---|---|
| agent lifecycle | `@aastar/core` `airAccountFactoryActions` + `@aastar/airaccount` `AgentRegistryService` |
| gasless | `@aastar/sdk` `UserOperationBuilder` + `@aastar/paymaster` `PaymasterClient`/`PaymasterOperator` |
| dvt | `@aastar/core` `dvtWire` + `BLSSigner` |
| session | `@aastar/airaccount` `SessionKeyService` |
| recovery | `@aastar/airaccount` `RecoveryService` |
| weighted | `@aastar/airaccount` `WeightedSignatureService` |
| kms | `@aastar/airaccount` `KmsManager` + `P256PasskeySigner` |

## Pre-run checklist

- [ ] `pnpm -r build`
- [ ] `pnpm run upstream:check` → exit 0, all 4 in-sync
- [ ] `pnpm run check:addresses` → all 4 configs OK
- [ ] `.env.sepolia` present with funded JASON/ANNI/BOB
- [ ] DVT nodes reachable (`localhost:3001/2/3`) for the dvt scenario
- [ ] `KMS_E2E=1` set for the kms scenario (creates a real TEE key)
- [ ] Resilient RPC: `SEPOLIA_RPC_URL` / `SEPOLIA_RPC_URL2` / `SEPOLIA_RPC_URL3`
