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
./run-keeper.sh sepolia --dry-run --once
./run-keeper.sh op-mainnet \
  --keystore ~/.aastar-keeper/keys/keeper \
  --password-file ~/.aastar-keeper/keys/password \
  --signer 0xYourSigner
```

`--dry-run` signs nothing and does not need a keystore. A live run refuses to start without `--keystore`, `--password-file` and `--signer`.

`run-keeper.sh` does not source `.env.<network>`. It launches Node with `exec env -i PATH HOME`, so the only arguments are the program and its flags. `RPC_URL`, `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` must not be set in the caller: the wrapper refuses and tells you to put them in `--env-file`. The wrapper places `--` before your flags so Node does not treat `--env-file` as its own dotenv option (that open blocks on a fifo). The keeper opens the file itself, non-blocking, and keeps only the allowlisted keys. A secret-named variable already in the environment refuses startup.

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

The key signs only three intents, and only while the gate is open: `updatePrice()` to the configured SuperPaymaster, `updatePrice()` to the resolved PaymasterV4, and a cancel (self-transfer, empty calldata, 21000 gas). Value is zero, the transaction is type 2, the access list is empty, and the chain id is the configured one. Price gas is at most `--max-gas` (default 500000). An unresolved target signs nothing. Anything else is refused before `cast`, on the raw `cast` returns, and again before every rebroadcast.

The nonce journal defaults to `~/.aastar-keeper/<network>.journal.json`. It stores one in-flight transaction or nothing. The file must be a regular file, mode `0600`, owned by this uid. Symlinks and FIFOs are refused on every read. Its directory is created at mode `0700`, and each new directory is fsynced into its parent, before the process binds two loopback sockets: one keyed by chain id and signer, and one keyed by the journal's real path. Accepted connections on those sockets are closed immediately. The kernel drops both when the process dies, including after `SIGKILL`. Shutdown on SIGINT/SIGTERM stops new sends, waits for the in-flight sign and journal write (at most 120 seconds), kills cast, then exits. It does not unlock early. A second live process with the same chain and signer, or the same journal path, is refused. There is no lock file and no stale-lock replacement. A corrupt journal, an unsafe file, or one written for another chain or signer, refuses every send until an operator intervenes. The latest raw's fees must match the journal entry before it is broadcast.

A live run requires `--max-fee-gwei` (1 to 10000). Replacements raise max fee and tip by at least 25 percent and 1 wei, and at least `2 * baseFee + tip`, and they stop at that ceiling. At the ceiling the keeper alerts once, `in-flight at fee ceiling`, and does not bump further. A cancel may still be signed at the ceiling. There is no hash-count cap that stops maintenance. Maintenance (receipt, rebroadcast, bump, cancel of a disabled kind) runs every tick, including ticks that do not send a new update.

Signed broadcasts of new nonces and replacements are capped per rolling hour by `--max-sends-per-hour`. The default is `min(2 * ceil(3600 / pollInterval), 30) + 6`: two price targets per poll, capped at 30, plus six replacement slots. Crossing the cap alerts `send ceiling exceeded — all sends closed` and closes every send until the process is restarted. The next hour does not reopen it.

At startup the signer must not be the deployer `0xb5600060e6de5E11D3636731964218E53caadf0E`, the SuperPaymaster owner, or the Registry owner. On SuperPaymaster 5.4.2 that refuse-start set is exactly those three (DSR on #446). The check reads `owner()` at one block hash. A failed read refuses to start. The same check runs again every hour, and on every tick while sends are closed.

The identity gate has two branches:

1. The signer is confirmed privileged (deployer, SuperPaymaster owner, or Registry owner). All sends close, and the previous six-hour grace is cleared. The alert says price updates have also stopped. Price reopens only after a later successful non-privileged check.
2. An identity read failed. Price updates continue for at most 6 hours after the last successful non-privileged check, then all sends close. The deadline is taken when that decision is made, after the ownership reads return. The alert during that window says `pause only; price updates continue`. When the 6 hours end, the alert says price updates have also stopped. Recovery says `signer identity recovered; price and pause resumed`.

A recovery alerts once when sends open again, not on every check. A network with no registry address refuses to start until `--registry <address>` is passed. Passing `--signer` on a dry-run runs the same check and does not sign.

`--pause-config`, `--pause-interval-sec`, `--pause-offset-sec` and `--role-sync-budget-sec` are not accepted. This keeper exits 1 if one of them is present.

## Alerts

Telegram is optional (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`). The keeper adds the `[keeper]` prefix when it sends the Telegram message.

- `low signer balance` when the signer balance is below `--low-balance-wei` (default 0.02 ETH on Sepolia, 0.005 ETH otherwise). The balance is read at most once an hour, and the alert is repeated at most once per 6 hours. There is no funding cap.
- `balance read failed`, on the same hourly read and the same 6 hour limit
- signer-identity refusal, saying that price updates have stopped, or that price updates continue after a failed read, plus a recovery line when sends open again
- `signer nonce moved outside this keeper` when the nonce moves in a way this process did not sign. Sends continue
- `send ceiling exceeded — all sends closed` when the hourly send cap is crossed. Sends stay closed until restart
- `in-flight at fee ceiling` when a replacement would pass `--max-fee-gwei`

Dry-run prints the balance texts on stdout and does not send them.

## Required ENV

The keeper does not load `.env.<network>`. Put `RPC_URL` in `--env-file`. The wrapper refuses to start if `RPC_URL` or `TELEGRAM_BOT_TOKEN` or `TELEGRAM_CHAT_ID` is already exported. Any other key in the env file refuses startup and the error names the key.

On anvil, and on any network whose canonical book lacks an address, the keeper reads `superPaymaster`, `paymasterV4`, `priceFeed`, `registry` and `paymasterFactory` from `config.<network>.json` in the repo. Only those address fields are used. `--price-feed` overrides the feed. `.env.<network>` is not read.

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
- `--env-file <path>` (optional; allowlisted keys only; pass it after `--` if you invoke node yourself, so Node does not open the file)
- `--registry <address>` (required for signer identity when neither the canonical book nor `config.<network>.json` has a registry)
- `--low-balance-wei <n>`
- `--superpaymaster <address>` (override)
- `--paymaster <address>` (override)
- `--price-feed <address>` (override)
- `--max-fee-gwei <n>` (required for a live run)
- `--max-gas <n>` (default 500000)
- `--max-sends-per-hour <n>` (default `min(2 * ceil(3600 / pollInterval), 30) + 6`; exceeding it closes sends until restart)
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
