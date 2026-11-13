# Price Keeper (SuperPaymaster + Paymaster)

This keeper is a long-running offchain agent that keeps `cachedPrice` fresh by calling `updatePrice()` only when needed. It signs with one keystore and one sender. It does not pause operators.

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

On the current Sepolia deployment this process talks to SuperPaymaster 5.4.2. Identity reads use `owner()` on that ABI and on Registry.

## How To Run

From the monorepo root:

```bash
./run-keeper.sh sepolia --dry-run --once --env-file ~/.aastar-keeper/keeper.env
./run-keeper.sh op-mainnet \
  --env-file ~/.aastar-keeper/keeper.env \
  --keystore ~/.aastar-keeper/keys/keeper \
  --password-file ~/.aastar-keeper/keys/password \
  --signer 0xYourSigner \
  --max-fee-gwei 50
```

`--dry-run` signs nothing and does not need a keystore. A live run refuses to start without `--keystore`, `--password-file`, `--signer` and `--max-fee-gwei`.

`run-keeper.sh` does not source `.env.<network>`. It `exec`s Node directly (`env -i PATH HOME`, pinned `tsx` loader, no `pnpm` or `tsx` launcher in between), so the supervisor's PID is the keeper. `RPC_URL`, `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` must not be set in the caller: the wrapper refuses and tells you to put them in `--env-file`. The wrapper places `--` before your flags so Node does not treat `--env-file` as its own dotenv option (that open blocks on a fifo). The keeper opens the file itself, non-blocking, and keeps only the allowlisted keys. `KEEPER_ETHUSD_URL` and `EXTERNAL_ETHUSD_URL` are read there too; the wrapper does not copy them onto argv. A secret-named variable already in the environment refuses startup, including `ETH_PASSWORD`, `CAST_PASSWORD`, and any name containing `PASSWORD` or `PASSPHRASE`.

## Migrating off KEEPER_PRIVATE_KEY

Stop the old keeper before the first start of this process. The journal stores only the single in-flight transaction. There is no history and no `--resync-journal`. If the signer nonce moves because something else used the key, the keeper sends one alert, `signer nonce moved outside this keeper`, and keeps sending. An in-flight nonce that the chain has consumed is cleared. If one of our hashes has a receipt, that status is reported. Otherwise the log says `nonce consumed (not by a tx we can see)`.

## Signer

Price updates share one process, one sender and one nonce journal. Two sends never run at the same time.

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

The key signs only three intents, and only while the gate is open: `updatePrice()` to the configured SuperPaymaster, `updatePrice()` to the resolved PaymasterV4, and a cancel (self-transfer, empty calldata, 21000 gas). Value is zero, the transaction is type 2, the access list is empty, and the chain id is the configured one. Price gas is at most `--max-gas` (default 500000). Fees are at most `--max-fee-gwei`. An unresolved target signs nothing. The exact request is checked before `cast`, the gate is checked again after `cast` returns and before the raw is journaled, and the same check runs again before every rebroadcast. Replacing a cancel keeps the cancel shape.

`updatePrice()` is permissionless and safe to repeat: a second call with a fresher or equal observation does not grant a new privilege. The keeper does not pin an oracle round. At one nonce only one signed alternative can execute, unless that chain history is reorged. Repeating the call still spends gas.

The nonce journal defaults to `~/.aastar-keeper/<network>.journal.json`. It stores one in-flight transaction or nothing, plus the rolling-hour send timestamps, whether the send ceiling is closed, and the last observed mined nonce. The file must be a regular file, mode `0600`, owned by this uid. Symlinks and FIFOs are refused on every read. Its directory is created at mode `0700`, and each new directory is fsynced into its parent, before the process binds two loopback sockets: one keyed by chain id and signer, and one keyed by the journal's real path. The first version of the file is written to a temporary name, fsynced, and published with a link that does not overwrite an existing file. A failed directory fsync after that publish refuses replay until a later barrier succeeds. Accepted connections on those sockets are closed immediately. The kernel drops both when the process dies, including after `SIGKILL`. Shutdown on SIGINT/SIGTERM stops new sends, waits for the in-flight sign and journal write (at most 120 seconds), kills cast, then exits. It does not unlock early. A second live process on the same host with the same chain and signer, or the same journal path, is refused. The lock is per host: two hosts or containers that share the key are an operator error. The keeper can only alert. There is no lock file and no stale-lock replacement. A corrupt journal, an unsafe file, or one written for another chain or signer, refuses every send until an operator intervenes. The latest raw's fees must match the journal entry, and must be within the current `--max-fee-gwei`, before it is broadcast.

A live run requires `--max-fee-gwei` (1 to 10000). Replacements compute the outgoing tip first, then a max-fee floor of `2 * baseFee + tip`, then stop at that ceiling. At the ceiling the keeper alerts once, `in-flight at fee ceiling`, and does not bump further. If the in-flight raw is already at the ceiling, a cancel that cannot outbid it is not journaled; the alert is `in-flight at fee ceiling; cannot replace or cancel` and the original raws stay. If a restarted process has a lower ceiling than the signed raw, the raw is not rebroadcast. The alert is `in-flight above current fee ceiling — cancel required`, and a cancel is signed only when it fits under the new ceiling and outbids the raw. There is no hash-count cap that stops maintenance. Each tick services the current in-flight transaction first. A receipt for an already-consumed nonce is reported afterwards and does not block the next nonce. After 10 failed receipt reads that report is dropped.

If the mined nonce is still below the in-flight nonce and the mempool has nothing in between (`pending <= latest`) for the replacement interval (default 3 keeper ticks), the keeper drops that in-flight entry, alerts `nonce gap below in-flight N; re-signing at latest`, and the next send uses the pending nonce. The orphaned raw may still land later. That is one extra intent.

Signed broadcasts of new nonces and replacements are capped per rolling hour by `--max-sends-per-hour`. A raw is charged on its first broadcast, including a maintenance rebroadcast of a raw that has never been sent. Rebroadcasting a raw that was already charged is free. The default is `min(2 * ceil(3600 / pollInterval), 30) + 6`: two price targets per poll, capped at 30, plus six replacement slots. Crossing the cap alerts `send ceiling exceeded — all sends closed`. The timestamps and the closed bit are in the journal, so a restart or a `--once` loop does not get a fresh budget. The ceiling stays closed until the rolling hour has room again and the operator passes `--reset-send-ceiling`.

At startup the signer must not be the deployer `0xb5600060e6de5E11D3636731964218E53caadf0E`, the SuperPaymaster owner, the Registry owner, or the resolved PaymasterV4 owner. The check reads `owner()` at one block hash. A failed read refuses to start. The same check runs again every hour, and on every tick while sends are closed. The registry address is the flag, else the canonical book, else `config.<network>.json`.

The identity gate has two branches:

1. The signer is confirmed privileged (deployer, SuperPaymaster owner, Registry owner, or PaymasterV4 owner). All sends close, and the previous six-hour grace is cleared. The alert says price updates have also stopped. Price reopens only after a later successful non-privileged check.
2. An identity read failed. Price updates continue for at most 6 hours after the last successful non-privileged check, then all sends close. The deadline is taken when that decision is made, after the ownership reads return. The alert during that window says `pause only; price updates continue`. When the 6 hours end, the alert says price updates have also stopped. Recovery says `signer identity recovered; price and pause resumed`.

A recovery alerts once when sends open again, not on every check. A network with no registry address refuses to start until `--registry <address>` is passed. Passing `--signer` on a dry-run runs the same check and does not sign.

`--pause-config`, `--pause-interval-sec`, `--pause-offset-sec` and `--role-sync-budget-sec` are not accepted. This keeper exits 1 if one of them is present.

## Alerts

Telegram is optional (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`). The keeper adds the `[keeper]` prefix when it sends the Telegram message.

- `low signer balance` when the signer balance is below `--low-balance-wei` (default 0.02 ETH on Sepolia, 0.005 ETH otherwise). The balance is read at most once an hour, and the alert is repeated at most once per 6 hours. There is no funding cap.
- `balance read failed`, on the same hourly read and the same 6 hour limit
- signer-identity refusal, saying that price updates have stopped, or that price updates continue after a failed read, plus a recovery line when sends open again
- `signer nonce moved outside this keeper` when the nonce moves in a way this process did not sign. Sends continue
- `send ceiling exceeded — all sends closed` when the hourly send cap is crossed. Sends stay closed across restarts until `--reset-send-ceiling` and the rolling hour has room
- `in-flight at fee ceiling` when a replacement would pass `--max-fee-gwei`
- `in-flight at fee ceiling; cannot replace or cancel` when the in-flight raw is already at the ceiling
- `in-flight above current fee ceiling — cancel required` when a journaled raw exceeds the current ceiling
- `nonce gap below in-flight N; re-signing at latest` when a lower nonce stays empty for the bump interval

Dry-run prints the balance texts on stdout and does not send them.

## Required ENV

The keeper does not load `.env.<network>`. Put `RPC_URL` in `--env-file`. The wrapper refuses to start if `RPC_URL` or `TELEGRAM_BOT_TOKEN` or `TELEGRAM_CHAT_ID` is already exported. Any other key in the env file refuses startup and the error names the key.

On anvil, and on any network whose canonical book lacks an address, the keeper reads `superPaymaster`, `paymasterV4`, `priceFeed`, `registry` and `paymasterFactory` from `config.<network>.json` in the repo. Only those address fields are used. `--price-feed` overrides the feed. `.env.<network>` is not read.

- `RPC_URL`

Optional:

- `OFFICIAL_OPERATOR` (used to derive the official Paymaster from the factory when no canonical instance exists)
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID` (must be numeric like `123...`/`-100...` or start with `@`)
- `KEEPER_CAST_BIN` (used when `--cast-bin` is absent; the flag wins, then this value, then `cast` on `PATH`)
- `KEEPER_ETHUSD_URL` or `EXTERNAL_ETHUSD_URL` (external price URL; the flag wins, otherwise the Binance ETHUSDT ticker)

## CLI Flags

- `--network op-sepolia|op-mainnet|sepolia|mainnet|anvil`
- `--keystore <path>` (required unless `--dry-run`)
- `--password-file <path>` (required unless `--dry-run`)
- `--signer <address>` (required unless `--dry-run`; the recovered sender must match)
- `--cast-bin <path>` (default `cast`)
- `--journal <path>` (default `~/.aastar-keeper/<network>.journal.json`)
- `--env-file <path>` (optional; allowlisted keys only; pass it after `--` if you invoke node yourself, so Node does not open the file)
- `--registry <address>` (required for signer identity when neither the canonical book nor `config.<network>.json` has a registry)
- `--low-balance-wei <n>`
- `--superpaymaster <address>` (override)
- `--paymaster <address>` (override)
- `--price-feed <address>` (override)
- `--max-fee-gwei <n>` (required for a live run)
- `--max-gas <n>` (default 500000)
- `--max-sends-per-hour <n>` (default `min(2 * ceil(3600 / pollInterval), 30) + 6`; exceeding it closes sends until `--reset-send-ceiling` and the hour has room)
- `--reset-send-ceiling` (reopen a persisted ceiling once the rolling hour has room)
- `--paymaster-operator <address>` (override OFFICIAL_OPERATOR)
- `--disable-superpaymaster` / `--no-superpaymaster`
- `--disable-paymaster` / `--no-paymaster`
- `--poll-interval <seconds>` (default: 30)
- `--safety-margin <seconds>` (default: 600)
- `--max-updates-per-day <n>` (default: 24)
- `--max-base-fee-gwei <gwei>` (optional)
- `--dry-run`
- `--once` (one tick, then exit)
- `--logo` / `--no-logo`
