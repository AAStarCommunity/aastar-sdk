# On-chain Evidence

Real, Etherscan-verifiable transactions proving SDK flows work against the **deployed**
Sepolia contracts — not just in unit tests. Each entry lists the account, every step's
tx hash + Etherscan link, and the on-chain read results.

Regenerate any section with its script (each run uses a unique salt, so it is re-runnable
and produces a fresh account + fresh tx hashes).

---

## Beta1 — SuperPaymaster-sponsored gasless

**Claim proven:** a PaymasterV4 sponsors the gas of an ERC-4337 v0.7 UserOperation while the smart
account holds **0 ETH** and pays nothing; the paymaster debits the account's **gas-token deposit** in
`postOp`. This is the sponsored (paymaster-paid) counterpart to the self-funded `executeUserOp` flow.

- **Script:** `tests/regression/onchain-evidence/beta1-sponsored-gasless.ts` (re-runnable, unique salt per run)
- **Run:** `pnpm tsx tests/regression/onchain-evidence/beta1-sponsored-gasless.ts`

### Actors & contracts

| Role | Address |
|------|---------|
| Smart account (sender, **0 ETH throughout**) | `0xF61d6AfAeBcd01D63C730b31b0d97Bb0A5038264` |
| PaymasterV4 (gas sponsor) | `0xD0c82dc12B7d65b03dF7972f67d13F1D33469a98` |
| Gas token (ERC-20, debited in postOp) | `0xDf669834F04988BcEE0E3B6013B6b867Bd38778d` |
| Owner / operator (JASON) | `0xb5600060e6de5E11D3636731964218E53caadf0E` |
| beta.4 factory | `0x3a9127a5f0b4ca734d54629d0c3ad9f52739c071` |

### Transactions (all `status=0x1`)

| Step | Tx hash | Etherscan |
|------|---------|-----------|
| Account deploy (no ETH funding) | `0x6078e580adc782985fb336d8f5fb8477e338bda952cb793cd99294f4435b5333` | [link](https://sepolia.etherscan.io/tx/0x6078e580adc782985fb336d8f5fb8477e338bda952cb793cd99294f4435b5333) |
| `depositFor` (credit account's token deposit in paymaster) | `0xba8a89a55eee9e393ed076fd721b99e219a9700e41d93475c948aeb9fda51a09` | [link](https://sepolia.etherscan.io/tx/0xba8a89a55eee9e393ed076fd721b99e219a9700e41d93475c948aeb9fda51a09) |
| `updatePrice` (refresh stale ETH/USD oracle cache) | `0xb22a472bd0cb8d6bdd787236d8a6788db7748e58546305a39e4c29e4afada04d` | [link](https://sepolia.etherscan.io/tx/0xb22a472bd0cb8d6bdd787236d8a6788db7748e58546305a39e4c29e4afada04d) |
| **Sponsored UserOp bundle tx** | `0xed4e5c17a1d922aa4d6b04a9cbdba36f7f9034bcf9aced0de4dfc36dfd1fa28d` | [link](https://sepolia.etherscan.io/tx/0xed4e5c17a1d922aa4d6b04a9cbdba36f7f9034bcf9aced0de4dfc36dfd1fa28d) |

UserOp hash: `0x853fd144d7f0eee48feae4f86a280765abaa0be1fd4ffbfc67b29388a4e03b61` · bundler: Pimlico · receipt `success=true`.

### Proof of gaslessness

- **`checkGaslessReadiness` → `isReady=true`** (paymaster stake 0.05 ETH, EntryPoint deposit ~0.237 ETH, token price set, account deposit 200).
- **Account ETH balance: `0` before AND `0` after** the UserOp — the account paid no gas; the paymaster did.
- **Account token deposit inside paymaster: `200` → `165.111607…`** (Δ `34.888…` debited by `postOp`) — the paymaster recouped the sponsored gas in the gas token.

### Notes / gotchas discovered

- PaymasterV4 (`contracts/src/paymasters/v4/PaymasterBase.sol`) returns `validUntil = cachedPrice.updatedAt + priceStalenessThreshold`; it does **not** read `validUntil` from `paymasterData`. A stale price cache therefore yields a `validUntil` in the past and the bundler rejects with `UserOperation expires too soon`. `checkGaslessReadiness` only checks `price != 0`, not freshness — so the script adds a step `[3b]` that calls the permissionless `updatePrice()` to re-pull Chainlink before submitting.
- `paymasterData` layout consumed by the contract is `[token(20)][validUntil(6)][validAfter(6)]` at paymasterData offset (after the 52-byte v0.7 header); `UserOperationBuilder.packPaymasterV4DepositData` matches this.

## Beta2 — Session keys (secp256k1 + P256)

**What it proves:** the `SessionKeyValidator` **Session-tuple** ABI fix works on the live
contract. The 8-field `Session` struct
`(uint48 expiry, address contractScope, bytes4 selectorScope, bool revoked, uint16 velocityLimit, uint32 velocityWindow, address[] callTargets, bytes4[] selectorAllowlist)`
is passed as a single tuple arg to `grantSessionDirect` / `grantP256SessionDirect`. A
flat-params encoding would revert at the ABI decode; a successful grant plus
`isSessionActive == true` is the proof the tuple encoding is correct.

- **Script:** `tests/regression/onchain-evidence/beta2-session.ts` (re-runnable, unique salt)
- **Run:** `pnpm tsx tests/regression/onchain-evidence/beta2-session.ts`
- **Network:** Sepolia
- **Owner EOA (ANNI):** `0xEcAACb915f7D92e9916f449F7ad42BD0408733c9`
- **SessionKeyValidator (beta.3, reused by beta.4):** `0x655ca2e9a2d1178f7fbcea1856560d1e0c657ebf`
- **Factory (beta.4):** `0x3a9127a5f0b4ca734d54629d0c3ad9f52739c071`

### Run 2026-06-14

- **Account (deployed beta.4, owner = ANNI, dailyLimit = 1 ETH, approvedAlgIds = [2]):**
  `0xdafC0b5c9Eb7c6dD2fff160731a9401A7BDB822D`
  ([Etherscan](https://sepolia.etherscan.io/address/0xdafC0b5c9Eb7c6dD2fff160731a9401A7BDB822D))

| Step | Action | Tx hash | Status | Etherscan |
|------|--------|---------|--------|-----------|
| 0 | `createAccount` (deploy account) | `0x7f5bcd0da235269e2fb0298c30cce0a9998e4cc31b6a7c08249b5333e1a39861` | 0x1 | [tx](https://sepolia.etherscan.io/tx/0x7f5bcd0da235269e2fb0298c30cce0a9998e4cc31b6a7c08249b5333e1a39861) |
| A.1 | `grantSessionDirect` (secp256k1, Session tuple) | `0x0d9c705ca3e9110f9ff253316d9da631a1f7e6343eab27783406e97765bd460e` | 0x1 | [tx](https://sepolia.etherscan.io/tx/0x0d9c705ca3e9110f9ff253316d9da631a1f7e6343eab27783406e97765bd460e) |
| A.3 | `revokeSession` (secp256k1) | `0x143e3e8c70c0d46bab33538e8d23ce1f6de4aa03d4a9e72c159c82380c3031c4` | 0x1 | [tx](https://sepolia.etherscan.io/tx/0x143e3e8c70c0d46bab33538e8d23ce1f6de4aa03d4a9e72c159c82380c3031c4) |
| B.1 | `grantP256SessionDirect` (P256, Session tuple) | `0x6fdab06e687d6c297602c8176b8100b15a04a34658ba58b57b0625b7d7e306f0` | 0x1 | [tx](https://sepolia.etherscan.io/tx/0x6fdab06e687d6c297602c8176b8100b15a04a34658ba58b57b0625b7d7e306f0) |
| B.3 | `revokeP256Session` (P256) | `0xae17ebf6eb91882271593d035929bad5f055c6924c26cc452d5cdccc903ca472` | 0x1 | [tx](https://sepolia.etherscan.io/tx/0xae17ebf6eb91882271593d035929bad5f055c6924c26cc452d5cdccc903ca472) |

**secp256k1 session key:** `0x525a0a646615Bd2388AdD86Dc8084A588cE374Cf`

**P256 public key:**
- `keyX` = `0x515e84a2c450767df1455ba5f2b5e4f602d56a5b37f7900e80e42616fa5a2b05`
- `keyY` = `0xa2d3977fcf1013bde433e539468fa86088731437e1ee72fbd40a7c426b7a8ea7`

### On-chain read results (the proof)

| Read | After grant | After revoke |
|------|-------------|--------------|
| `isSessionActive(account, sessionKey)` (secp256k1) | **true** | **false** |
| `isP256SessionActive(account, keyX, keyY)` (P256) | **true** | **false** |

`isActive == true` immediately after each grant confirms the on-chain `Session` storage was
populated, i.e. the Session-tuple calldata decoded correctly on the deployed contract.
`isActive == false` after each revoke confirms the revoke path.

> Note on the run: the final `revokeP256Session` broadcast hit a transient Alchemy RPC
> response timeout, but the raw transaction still propagated and mined
> (`0xae17ebf6...` status `0x1`, `isP256SessionActive` reads `false`, ANNI nonce has no
> gap). The script has since been hardened to sign locally + poll for the receipt so a
> timed-out broadcast response no longer aborts the run.

---

## Beta2 — Social recovery

**What it proves:** the AirAccount on-chain social-recovery flow (capability F28) works
end-to-end on the live beta.4 contract — a 2-of-3 guardian scheme with a 2-day timelock.
Recovery functions live **directly on the account** (they are direct calls, NOT UserOps):
`addGuardian` is `onlyOwner`; `proposeRecovery(newOwner)` is called by a guardian (starts the
timelock + counts as the 1st approval); `approveRecovery()` is called by a second guardian
(reaching the 2-of-3 threshold). `executeRecovery()` is callable by anyone but only after the
2-day timelock elapses — attempting it immediately reverts with the custom error
`RecoveryTimelockNotExpired`, which is the proof the timelock gate is enforced on-chain.

- **Script:** `tests/regression/onchain-evidence/beta2-recovery.ts` (re-runnable, unique salt)
- **Run:** `pnpm tsx tests/regression/onchain-evidence/beta2-recovery.ts`
- **Network:** Sepolia (chainId 11155111)
- **Owner EOA (JASON):** `0xb5600060e6de5E11D3636731964218E53caadf0E`
- **Factory (beta.4):** `0x3a9127a5f0b4ca734d54629d0c3ad9f52739c071`
- **Contract source:** `../airaccount-contract/src/core/AAStarAirAccountBase.sol`
  (`addGuardian` L1352, `proposeRecovery` L1411, `approveRecovery` L1432, `executeRecovery` L1446;
  `RECOVERY_THRESHOLD = 2`, `RECOVERY_TIMELOCK = 2 days`)

### Run 2026-06-14

- **Account (deployed beta.4, owner = JASON, dailyLimit = 1 ETH, approvedAlgIds = [2], salt `1781411595`):**
  `0x68666a5f1B89593191E436a5C22A5968D5a0cFbB`
  ([Etherscan](https://sepolia.etherscan.io/address/0x68666a5f1B89593191E436a5C22A5968D5a0cFbB))
- **Guardian g1 (fresh):** `0x05dD11D0502d4f824d2f4c0c210aF46E8af84A54`
- **Guardian g2 (fresh):** `0x158D2bf868F1832d2b24A76a6e47fe33f4bCb70e`
- **Proposed newOwner (fresh):** `0x207FE2234e07dEFD9676B3003e383e3db001C936`

| Step | Action | Actor | Tx hash | Status | Etherscan |
|------|--------|-------|---------|--------|-----------|
| 0a | Fund guardian g1 (0.01 ETH) | JASON | `0xf059adca1f5cbb4320360083fb33f6ac9f3581ba83abc0ac38e74b484e1aba1b` | 0x1 | [tx](https://sepolia.etherscan.io/tx/0xf059adca1f5cbb4320360083fb33f6ac9f3581ba83abc0ac38e74b484e1aba1b) |
| 0b | Fund guardian g2 (0.01 ETH) | JASON | `0xf37363dafb7046551ed4fcfe90d73a84c451dd0d48491047ebeb82d596e125f2` | 0x1 | [tx](https://sepolia.etherscan.io/tx/0xf37363dafb7046551ed4fcfe90d73a84c451dd0d48491047ebeb82d596e125f2) |
| 1 | `createAccount` (deploy beta.4 account) | JASON | `0x9103bc86db1923478ca36cd25dd76f2ac8fa25a92c08663512d26546dda0e8d1` | 0x1 | [tx](https://sepolia.etherscan.io/tx/0x9103bc86db1923478ca36cd25dd76f2ac8fa25a92c08663512d26546dda0e8d1) |
| 2 | `addGuardian(g1)` (onlyOwner) | JASON | `0x5954de835287f45ff1c2f8ae70ae5ee335cedc275318c56e336a9ed4e5d9bca6` | 0x1 | [tx](https://sepolia.etherscan.io/tx/0x5954de835287f45ff1c2f8ae70ae5ee335cedc275318c56e336a9ed4e5d9bca6) |
| 3 | `addGuardian(g2)` (onlyOwner) | JASON | `0xb8e265fea080d7ba3ed3908ee09fdf3e972d7406b3a997259d634c2ecd9eaa3e` | 0x1 | [tx](https://sepolia.etherscan.io/tx/0xb8e265fea080d7ba3ed3908ee09fdf3e972d7406b3a997259d634c2ecd9eaa3e) |
| 4 | `proposeRecovery(newOwner)` (guardian g1 → timelock starts + 1st approval) | g1 | `0x01251082375820eaca05ab7d69dbb49eae250099afdb52c4e91a8d6317c52155` | 0x1 | [tx](https://sepolia.etherscan.io/tx/0x01251082375820eaca05ab7d69dbb49eae250099afdb52c4e91a8d6317c52155) |
| 5 | `approveRecovery()` (guardian g2 → reaches 2-of-3) | g2 | `0xd15f1185e40d3b29d581732c87022567a355bc2eb4b5dd6ca82107892dba3c6c` | 0x1 | [tx](https://sepolia.etherscan.io/tx/0xd15f1185e40d3b29d581732c87022567a355bc2eb4b5dd6ca82107892dba3c6c) |

### On-chain read: `activeRecovery()` after step 5 (the proof of 2-of-3)

```
newOwner           = 0x207FE2234e07dEFD9676B3003e383e3db001C936
proposedAt         = 1781411700
approvalBitmap     = 0x3   (binary 11 → guardian[0] + guardian[1], 2 approvals)
cancellationBitmap = 0x0
executeAfter       = 1781584500   (proposedAt + 2 days / 172800s)
```

`newOwner` matches the proposed address and `approvalBitmap = 0x3` (popcount 2) confirms the
proposal is recorded with both guardian approvals — i.e. the 2-of-3 threshold is met.

### `executeRecovery()` timelock gate (step 6)

Attempting `executeRecovery()` immediately (before the 2-day timelock elapses) reverts with the
custom error **`RecoveryTimelockNotExpired`** (verified by `eth_call`/simulate against the live
account; the error selector decodes to that name via the account ABI). This proves the timelock
gate is enforced on-chain.

> `executeRecovery()` is intentionally **not** completed in this run: it requires waiting until
> `executeAfter = 1781584500` (proposedAt + 2 days). To finish the recovery, re-call
> `executeRecovery()` on `0x68666a5f1B89593191E436a5C22A5968D5a0cFbB` after that timestamp — it
> will then rotate `owner` to `0x207FE2234e07dEFD9676B3003e383e3db001C936`. The threshold and
> proposal are already satisfied on-chain (see the `activeRecovery()` read above); only the
> timelock remains.


---

## Beta3 — Weighted-signature governance

### Run 2026-06-14T04:47:41.596Z

- **Network:** Ethereum Sepolia (chainId 11155111)
- **Factory (beta.4):** `0x3a9127a5f0b4ca734d54629d0c3ad9f52739c071`
- **Account owner (BOB):** `0xF7Bf79AcB7F3702b9DbD397d8140ac9DE6Ce642C`
- **Deployed account:** `0x54fdc3a3472F828f89E9493cfd9C99452D34271F` (salt `1781412339`)
- **Guardian g1 (slot 0):** `0xFbC3F620823E9e8169cDd756f1a883B4C2AFd3E9`
- **Guardian g2 (slot 1):** `0x8AB05544a050016d0C2A3f26f7894F11fDF40df7`
- **cfg1 (first `setWeightConfig`):** `passkey=3 ecdsa=2 bls=2 g0=1 g1=1 g2=1 _pad=0 tier1=4 tier2=5 tier3=6`
- **cfg2 (`proposeWeightChange`, weakens tier3 6→5):** `passkey=3 ecdsa=2 bls=2 g0=1 g1=1 g2=1 _pad=0 tier1=4 tier2=5 tier3=5`

| Step | Action | Actor | Tx hash / result |
|------|--------|-------|------------------|
| 1 | Fund guardian g1 with 0.01 ETH | BOB 0xF7Bf79AcB7F3702b9DbD397d8140ac9DE6Ce642C | [`0x0c6f4706a11194a7ee2ccdb962f6960d5e950e04f841abc60daedb4a07d9b7fc`](https://sepolia.etherscan.io/tx/0x0c6f4706a11194a7ee2ccdb962f6960d5e950e04f841abc60daedb4a07d9b7fc) |
| 2 | Fund guardian g2 with 0.01 ETH | BOB 0xF7Bf79AcB7F3702b9DbD397d8140ac9DE6Ce642C | [`0xe4f74aa344ae9b11978b46e1de6ca24b96ba15d5237e7de1c1344879049eee5e`](https://sepolia.etherscan.io/tx/0xe4f74aa344ae9b11978b46e1de6ca24b96ba15d5237e7de1c1344879049eee5e) |
| 3 | Deploy beta.4 account (salt=1781412339, guardians g1,g2) | BOB 0xF7Bf79AcB7F3702b9DbD397d8140ac9DE6Ce642C | [`0xf3019e158817163692d3cbfd49796f2ca4d68c4fa88f4e131a843fe7cf225578`](https://sepolia.etherscan.io/tx/0xf3019e158817163692d3cbfd49796f2ca4d68c4fa88f4e131a843fe7cf225578) |
| 4 | OWNER setWeightConfig(cfg1) — first config | BOB 0xF7Bf79AcB7F3702b9DbD397d8140ac9DE6Ce642C | [`0x92280abff754bb6ea0446f0c4a35e736e02feb7bd7cad09b0bb57d5a4f2fb6a1`](https://sepolia.etherscan.io/tx/0x92280abff754bb6ea0446f0c4a35e736e02feb7bd7cad09b0bb57d5a4f2fb6a1) |
| 5 | OWNER proposeWeightChange(cfg2) — weakening (tier3 6→5) | BOB 0xF7Bf79AcB7F3702b9DbD397d8140ac9DE6Ce642C | [`0xd47f40fc8321bf0c2afd8cab5ad46322bc276e3f34367f5850c1d116d315be13`](https://sepolia.etherscan.io/tx/0xd47f40fc8321bf0c2afd8cab5ad46322bc276e3f34367f5850c1d116d315be13) |
| 6 | Guardian g1 approveWeightChange() (1st approval) | g1 0xFbC3F620823E9e8169cDd756f1a883B4C2AFd3E9 | [`0xd07b6fcb096c0ea907229a796aa27a70c791c914569a8f352bcbe373c22e252a`](https://sepolia.etherscan.io/tx/0xd07b6fcb096c0ea907229a796aa27a70c791c914569a8f352bcbe373c22e252a) |
| 7 | Guardian g2 approveWeightChange() (reaches 2-of-3) | g2 0x8AB05544a050016d0C2A3f26f7894F11fDF40df7 | [`0x7de71ec0f5270bee68bab5544c99571c1da5b93cea525dbe8cace912f6d29f6c`](https://sepolia.etherscan.io/tx/0x7de71ec0f5270bee68bab5544c99571c1da5b93cea525dbe8cace912f6d29f6c) |
| 8 | executeWeightChange() attempted immediately | anyone (simulated from BOB) | WeightChangeTimelockNotExpired (revert) — the 2-day timelock gate is enforced. executeWeightChange requires waiting until executeAfter=1781585184 (proposedAt + 172800s). The 2-of-3 approval threshold is already met. |

**`weightConfig()` read after step 3 (cfg1 applied):**

```
passkey=3 ecdsa=2 bls=2 g0=1 g1=1 g2=1 _pad=0 tier1=4 tier2=5 tier3=6
```

**`pendingWeightChange()` read after the 2 approvals (the proof of 2-of-3):**

```
proposed       = passkey=3 ecdsa=2 bls=2 g0=1 g1=1 g2=1 _pad=0 tier1=4 tier2=5 tier3=5
proposedAt     = 1781412384
approvalBitmap = 0x3 (binary 11, 2 approvals)
executeAfter   = 1781585184  (proposedAt + 2 days / 172800s)
```

**`executeWeightChange()` timelock gate:** WeightChangeTimelockNotExpired (revert) — the 2-day timelock gate is enforced. executeWeightChange requires waiting until executeAfter=1781585184 (proposedAt + 172800s). The 2-of-3 approval threshold is already met.

> `executeWeightChange()` is intentionally **not** completed in this run: it requires
> waiting until `executeAfter = 1781585184` (proposedAt + 2 days). To finish,
> re-call `executeWeightChange()` on `0x54fdc3a3472F828f89E9493cfd9C99452D34271F` after that timestamp — it will then
> apply cfg2 as the active `weightConfig`. The 2-of-3 approval threshold is already met
> on-chain (see the `pendingWeightChange()` read above); only the timelock remains.

## Beta3 — SuperPaymaster governance (read methods, live contract)

Read wrappers hit the live SuperPaymaster proxy `0xFb090E82bD041C6e9787eDEbE1D3BE55b3c7266a` (Sepolia) and return real on-chain state (proves the governance read methods are wired to the deployed contract; write methods are protocol-owner-gated and are exercised via the timelock state machine in the weighted-sig flow above):

| Method | On-chain value |
|---|---|
| `EMERGENCY_TIMELOCK()` | `3600` (1 hour) |
| `emergencyPendingPrice()` | `0` (no emergency price queued) |
| `emergencyActivatedAt()` | `0` |
| `pendingAPNTsToken()` | `0xc53a8c96581d8b7acedf16995323d7b3888abce8` (a migration IS queued) |
| `pendingAPNTsTokenEta()` | `1781409784` |

Verified 2026-06-14 via `eth_call` against the live contract.
