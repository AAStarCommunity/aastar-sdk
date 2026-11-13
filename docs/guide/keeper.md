# Price Keeper (SuperPaymaster + Paymaster)

This keeper is a long-running offchain agent that keeps `cachedPrice` fresh by calling `updatePrice()` only when needed. It signs with one keystore and one sender. Operator pauses run in the same process when a v5.5.0-rc.8 pause config is set.

## What It Does

- Reads `cachedPrice.updatedAt` and `priceStalenessThreshold()` from SuperPaymaster and the official Paymaster
- Reads `updatedAt` from the Chainlink ETH/USD feed
- Sends `updatePrice()` when the cached price is close to expiring and Chainlink has fresher data (handled independently per contract)
- Sends Telegram alerts on errors and an hourly heartbeat (optional)
- Alerts when the signer balance is low

## Update Policy (Gas-Saving)

The keeper submits `updatePrice()` only when all of the following are true:

- `cachedPrice.updatedAt == 0` (bootstrap case), or
- Current time is within `safetyMarginSec` before `cachedPrice.updatedAt + priceStalenessThreshold`
- Chainlink has newer data than the cached price
- Chainlink data is not older than `priceStalenessThreshold`

Additionally:

- Enforces `maxUpdatesPerDay` to avoid abuse
- Optionally skips updates when base fee is above `maxBaseFeeGwei` (unless very close to expiry)

## Addresses Source (No ENV Needed)

By default, contract addresses are loaded from `@aastar/core` canonical constants (per chainId).

Paymaster selection:

- If the canonical constants include an official Paymaster instance address, the keeper uses it
- Otherwise it derives the official Paymaster address from `PaymasterFactory.paymasterByOperator(OFFICIAL_OPERATOR)`
- You can override with `--paymaster <address>`

On the current Sepolia deployment this process talks to SuperPaymaster 5.4.2. Identity reads use `owner()` on that ABI and on Registry. The pause duty does not run against that deployment.

## How To Run

From the monorepo root:

```bash
./run-keeper.sh sepolia --dry-run --once
./run-keeper.sh op-mainnet \
  --keystore ~/.aastar-keeper/keys/keeper \
  --password-file ~/.aastar-keeper/keys/password \
  --signer 0xYourSigner
```

`--dry-run` signs nothing and does not need a keystore. A live run refuses to start without `--keystore`, `--password-file` and `--signer`.

`KEEPER_PRIVATE_KEY`, `PRIVATE_KEY_SUPPLIER` and `PRIVATE_KEY` in `.env.<network>` are not read and are not a signing path. `run-keeper.sh` does not export them.

## Migrating off KEEPER_PRIVATE_KEY

Stop the old keeper before the first start of this process. Make sure nothing is pending for the signer: no unmined transaction from the old process, from another host, or from a manual `cast`. This keeper's journal starts from the chain nonce. A pending transaction leaves latest and pending nonces different, and sends stay refused until that nonce is included. `--resync-journal` is only for the case where latest equals pending and the journal has no in-flight entry.

## Signer

Price updates and operator pauses share one process, one sender and one nonce journal. Two sends never run at the same time.

The key stays in an encrypted keystore. This process never sees it. `cast mktx` builds and signs a raw transaction and does not broadcast; the keeper broadcasts that raw transaction with `eth_sendRawTransaction`. Pass the binary with `--cast-bin` when `cast` is not on `PATH` (on this workstation that is `~/.foundry/bin/cast`). No `ETH_KEYSTORE`, `ETH_PASSWORD` or `ETH_RPC_URL` is forwarded to `cast`.

Password file rules, checked before the first signature:

- the password file is a regular file, not a symlink, mode `0600`, owned by the uid running the keeper
- its parent directory is a real directory, not a symlink, mode `0700`, owned by that same uid
- the keystore is a regular file and is not group- or world-writable

```bash
mkdir -m 0700 -p ~/.aastar-keeper/keys
# write the password into the 0600 file yourself; do not pass it on the command line
chmod 0600 ~/.aastar-keeper/keys/password
```

The nonce journal defaults to `~/.aastar-keeper/<network>.journal.json`. Its directory is created at mode `0700` before the process binds a loopback socket keyed by chain id and signer. The kernel drops that socket when the process dies, including after `SIGKILL`. A second live process with the same chain and signer is refused, even if it uses another journal path. There is no lock file and no stale-lock replacement. A corrupt journal, or one written for another chain or signer, refuses every send until an operator intervenes. If the chain nonce moves ahead of the journal, the key was used outside this process: every send is refused and an alert names the expected nonce and the nonce the chain reported. Normal runs never rewrite the journal to match that nonce. `--resync-journal` is the one-shot recovery: it runs only when the chain's latest nonce equals its pending nonce and every journal entry is included, then it sets the base nonce to that value, drops the entries, prints what changed, alerts, and exits. A chain nonce behind the journal is refused as `sender: nonce behind journal` and is not sticky. If the last journal entry is included but none of its hashes still have a receipt, that entry is put back to `sent` and its original bytes are rebroadcast.

At startup the signer must not be the deployer `0xb5600060e6de5E11D3636731964218E53caadf0E`, the SuperPaymaster owner, or the Registry owner. Without a 5.5.0 SuperPaymaster configured, that refuse-start set is exactly those three (DSR on #446). The check reads `owner()` at one block hash. When the pause duty is enabled, the same pinned block is also read for the SuperPaymaster guardian, both pending owners, both BLS aggregator addresses, `isReputationSource(signer)`, `hasRole` for every pinned role, and `getRoleConfig(role).owner` for every pinned role. Those reads are direct. They do not wait for `RoleConfigured` logs. The SuperPaymaster code hash, implementation slot, implementation code hash, and `REGISTRY()` are checked before those role reads are trusted. Any failed read, or any read that shows privilege, refuses to start (exit 1). A SuperPaymaster identity mismatch also refuses to start. The hourly re-check repeats the same direct reads. Passing `--signer` on a dry-run runs the same check and does not sign.

The identity gate has three branches:

1. The signer is confirmed privileged (deployer, SuperPaymaster owner, Registry owner, or, when the pause duty is enabled, a pending owner, guardian, BLS aggregator, role holder, role-config owner, or reputation source). All sends close. The alert says price updates have also stopped.
2. An identity read failed. Price updates continue for at most 6 hours after the last successful check, then all sends close. The alert during that window says `pause only; price updates continue`. When the 6 hours end, the alert says price updates have also stopped.
3. A SuperPaymaster rc.8 identity mismatch (code hash, implementation slot, implementation code hash, or `REGISTRY()`) stops the pause duty only. Price updates continue, with no 6 hour grace. The alert says `pause only; price updates continue`.

Recovery says `signer identity recovered; price and pause resumed`. A recovery alerts once when sends open again, not on every check. A network with no registry address refuses to start until `--registry <address>` is passed.

If a pause transaction is still in flight when that pause gate closes and a price send is still allowed, the keeper cancels that nonce instead of blocking the price behind it. The cancel is a replacement on the same nonce: `to` is the signer, value is 0, data is `0x`, gas limit is 21000, and both fees are at least 1.25× the in-flight fees and at least the current `2 * baseFee + tip` floor. The cancel raw is appended to the same journal entry (`kind` `cancel`, `cancelled: true`; older journals without that field still load) and only then broadcast. The pause raws are not broadcast again. Whichever signed hash is included settles the nonce. If the old pause is the one that lands, it is accepted and the alert is `pause landed before cancel nonce N`. The price send then uses the next nonce in the same call. If the price gate is also closed, or the fee read or the signer fails, the cancel is refused and nothing is broadcast. A send whose own gate is closed stays blocked and broadcasts nothing. When the pause gate opens again, the pause round decides from chain state and does not resend the cancelled pause.

## Pause duty

The hourly pause round runs in the same loop as the price ticks, offset by `--pause-offset-sec` (default 1800, minimum 0) and then every `--pause-interval-sec` (default 3600, minimum 600). `--once` runs that round immediately and ignores the offset. It is enabled only by a `--pause-config` file whose `spRelease` is exactly `v5.5.0-rc.8`. Omitting the flag logs `pauseDuty=disabled` once and does nothing. An explicit file that is partial, invalid, or any other release refuses to start (exit 1). It does not run against the live 5.4.2 deployment. `registryStartBlock` may be earlier than `startBlock`; it must still be at or before the head.

```json
{
  "superPaymaster": "0x…",
  "registry": "0x…",
  "startBlock": 0,
  "registryStartBlock": 0,
  "implementation": "0x…",
  "implementationCodeHash": "0x…",
  "proxyCodeHash": "0x…",
  "spRelease": "v5.5.0-rc.8"
}
```

Addresses are 20-byte hex (checksummed or lowercase). Code hashes are 32 bytes. Blocks are non-negative integers and `startBlock` must not be after the head. Unknown keys are rejected. The pause state file is bound to the chain id, the SuperPaymaster, and `startBlock`. Changing the deployment requires a new state path. A file from another deployment fails the round and is not rewritten; the error names the field that differs and the file path to move aside.

Before any pause, the round takes the finalized block and pins it by hash (`requireCanonical`). The proxy code hash, the EIP-1967 implementation slot, the implementation code hash, and `REGISTRY()` are read at that hash. `OperatorConfigured` logs are scanned up to that same finalized block in chunks, not up to latest. The forward cursor continues from where it stopped. A separate full-rescan cursor walks the whole range from `startBlock` in the background, a bounded number of chunks per round, and `lastFullRescanMs` advances only when that cursor reaches the finalized block. A round whose forward inventory is complete still decides pauses while the full rescan is unfinished; the note is `full rescan incomplete`. `operators()`, `hasRole`, `getRoleConfig`, and `getEffectiveStake` use that finalized hash. The `pauseUnderstakedOperator` simulation stays an `eth_call` at latest. Immediately before each pause send, the deployment is checked again at latest. A mismatch sends nothing and closes the pause gate; price updates continue. The cursor advances only after a chunk validates. A failed read, a failed chunk, or an unfinished forward scan fails the round: nothing is sent, and the log line is `pause-round=FAILED`. An empty inventory is `pause-round=ok` only after the forward scan has caught up. A chunk the node rejects for size is halved down to one block.

`RoleConfigured` logs are scanned only to find roles outside the pinned set, and the holders and owners of those roles. That scan does not run before the price loop and it does not exit the process. Each tick reads at most `--role-sync-slice-calls` `eth_getLogs` calls (default 8, minimum 1). While the inventory is behind, the pause gate stays closed with reason `role inventory catching up` and price updates keep running. That state is not a failed identity read, so the 6 hour grace does not apply to it. The keeper alerts once when catch-up starts and once when it finishes. If catch-up is still unfinished 24 hours after it started, it alerts once more and price updates still run. A slice whose read fails is retried on the next tick. Repeated failures alert once, until a slice succeeds. When the scan completes, a configured role outside the pinned set, or the signer holding or owning such a role, closes price and pause and alerts (branch 1). Otherwise the pause gate opens.

An operator that is configured and not paused is understaked when it lacks `ROLE_PAYMASTER_SUPER` or its effective stake is strictly below that role's `minStake` (equal stake is not understaked). The keeper simulates `pauseUnderstakedOperator` from the signer at latest. Success is broadcast through the shared sender. The receipt must succeed and `operators(op).isPaused` must be true at the receipt block hash. `OperatorMeetsMinimumStake` is logged as stake recovered and is not sent. Any other revert fails the round.

The ABI and the role ids are vendored under `scripts/keeper/sp-pause-pin/` from SuperPaymaster commit `dac5f378f52dca4daacdb3121f995eb22c5ce255`. Re-pin that directory to the `v5.5.0-rc.8` tag before deploy (DSR B3, re-pin blocker M6). `scripts/keeper/check-sp-pause-pin.ts` compares the vendored blobs to GitHub and prints `CHECKED n`. It prints `SKIP` only when `gh` is missing or not authenticated before the first check. A later `gh` failure exits 1.

Signer balance is not read in the pause round. A low balance is alerted from the price loop only.

## Alerts

Telegram is optional (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`). The keeper adds the `[keeper]` prefix when it sends the Telegram message.

- `low signer balance` when the signer balance is below `--low-balance-wei` (default 0.02 ETH on Sepolia, 0.005 ETH otherwise). The balance is read at most once an hour, and the alert is repeated at most once per 6 hours. There is no funding cap. This read is the price loop, not the pause round.
- `balance read failed`, on the same hourly read and the same 6 hour limit
- `pause-round=FAILED` once per distinct reason set, and one `pause round recovered` when the next round is ok
- `paused understaked operator …` with the transaction hash
- `pause timeout` when an operator is still understaked and unpaused on two consecutive rounds
- `configured log but not configured` when a configuration log does not match `operators(op)`, once per operator
- signer-identity refusal, saying that price updates have stopped, that price updates continue after a failed read, or that an rc.8 mismatch stopped the pause duty only, plus a recovery line when sends open again
- `role inventory catching up` once when the role-log catch-up starts, `role inventory caught up` once when it finishes, and `role inventory catch-up still incomplete after 24h` once if it is still unfinished 24 hours later. Price updates continue in all three. A failed slice alerts `role log slice failed` once per run of failures.
- journal / foreign-nonce refusal

Dry-run prints the balance texts on stdout and does not send them.

## Required ENV

The keeper loads `.env.<network>` from the current working directory for RPC and Telegram only.

- `RPC_URL`

Optional:

- `OFFICIAL_OPERATOR` (used to derive the official Paymaster from the factory when no canonical instance exists)
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID` (must be numeric like `123...`/`-100...` or start with `@`)
- `KEEPER_CAST_BIN` (passed through by `run-keeper.sh` as `--cast-bin` when the flag is absent)

## CLI Flags

- `--network op-sepolia|op-mainnet|sepolia|mainnet|anvil`
- `--keystore <path>` (required unless `--dry-run`)
- `--password-file <path>` (required unless `--dry-run`)
- `--signer <address>` (required unless `--dry-run`; the recovered sender must match)
- `--cast-bin <path>` (default `cast`)
- `--journal <path>` (default `~/.aastar-keeper/<network>.journal.json`)
- `--resync-journal` (one-shot; requires `--signer`; exits after the realign)
- `--role-sync-slice-calls <n>` (RoleConfigured getLogs calls per tick, default 8, minimum 1, maximum 100)
- `--registry <address>` (required for signer identity when the network has no registry)
- `--pause-config <path>` (omit to disable; a partial or non-rc.8 file exits 1)
- `--pause-interval-sec <n>` (default 3600, minimum 600; the flag requires a value)
- `--pause-offset-sec <n>` (default 1800, minimum 0; ignored by `--once`; the flag requires a value)
- `--low-balance-wei <n>`
- `--superpaymaster <address>` (override)
- `--paymaster <address>` (override)
- `--paymaster-operator <address>` (override OFFICIAL_OPERATOR)
- `--disable-superpaymaster` / `--no-superpaymaster`
- `--disable-paymaster` / `--no-paymaster`
- `--poll-interval <seconds>` (default: 30)
- `--safety-margin <seconds>` (default: 600)
- `--max-updates-per-day <n>` (default: 24)
- `--max-base-fee-gwei <gwei>` (optional)
- `--dry-run`
- `--once` (one tick, and the pause round immediately when a pause config is set)
- `--logo` / `--no-logo`
