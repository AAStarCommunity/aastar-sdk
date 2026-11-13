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

`run-keeper.sh` does not source `.env.<network>`. It `exec`s Node directly (`env -i PATH HOME`, pinned `tsx` loader, no `pnpm` or `tsx` launcher in between), so the supervisor's PID is the keeper. `RPC_URL`, `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` must not be set in the caller: the wrapper refuses and tells you to put them in `--env-file`. The same refusal applies to any exported name that matches the keeper's secret-name policy (`PRIVATE_KEY`, `MNEMONIC`, `KEYSTORE_PASSWORD`, `SEED`, `PASSPHRASE`, `PASSWORD`), including `ETH_PASSWORD`, `CAST_PASSWORD`, and `KEEPER_PRIVATE_KEY`. The wrapper names the variable and does not print the value. The wrapper places `--` before your flags so Node does not treat `--env-file` as its own dotenv option (that open blocks on a fifo). The keeper opens the file itself, non-blocking, and keeps only the allowlisted keys. `KEEPER_ETHUSD_URL` and `EXTERNAL_ETHUSD_URL` are read there too; the wrapper does not copy them onto argv.

## Migrating off KEEPER_PRIVATE_KEY

Stop the old keeper before the first start of this process. The journal stores only the single in-flight transaction. There is no history and no `--resync-journal`. If the signer nonce moves because something else used the key, the keeper sends one alert, `signer nonce moved outside this keeper`, and keeps sending. An in-flight nonce that the chain has consumed is cleared. If one of our hashes has a receipt, that status is reported. Otherwise the log says `nonce consumed (not by a tx we can see)`.

## Signer

Price updates share one process, one sender and one nonce journal. Two sends never run at the same time.

The key stays in an encrypted keystore. This process never sees it. `cast mktx` builds and signs a raw transaction and does not broadcast; the keeper broadcasts that raw transaction with `eth_sendRawTransaction`. The default name `cast`, a `KEEPER_CAST_BIN` value, and `--cast-bin` are resolved once at startup to an absolute real path. That path is what every later spawn runs. `PATH` is not searched again. The file and every ancestor directory up to `/` must be a non-sticky directory or regular file owned by root or the keeper uid, and not group- or world-writable. `/tmp` fails that check. The keeper re-checks the pinned file before each spawn and refuses to sign if it changed. The keeper's uid is inside the trust boundary because it can read the keystore and the password file anyway. Anything able to run as that uid can sign. The checks exist to stop other users from substituting the signer. No `ETH_KEYSTORE`, `ETH_PASSWORD` or `ETH_RPC_URL` is forwarded to `cast`.

Password file rules, checked before the first signature:

- the password file is a regular file, not a symlink, mode `0600`, owned by the uid running the keeper
- its parent directory is a real directory, not a symlink, mode `0700`, owned by that same uid
- the keystore is a regular file and is not group- or world-writable

```bash
mkdir -m 0700 -p ~/.aastar-keeper/keys
# write the password into the 0600 file yourself; do not pass it on the command line
chmod 0600 ~/.aastar-keeper/keys/password
```

The key signs only two intents, and only while the gate is open: `updatePrice()` to the configured SuperPaymaster, and `updatePrice()` to the resolved PaymasterV4. There is no fee replacement and no cancel. Value is zero, the transaction is type 2, the access list is empty, and the chain id is the configured one. Price gas is at most `--max-gas` (default 500000) for a new signature. A lowered `--max-gas` does not block rebroadcast of an already-signed raw. Fees at signing are `tip = min(quoted tip, --max-tip-gwei)` (default 2) and `maxFee = min(--max-fee-gwei, 3 * baseFee + tip)`. k = 3 is fixed. If `3 * baseFee + tip` is above `--max-fee-gwei`, the keeper signs at that ceiling. An unresolved target signs nothing. The exact request is checked before `cast`, the gate and chain id are checked again after `cast` returns and before the raw is journaled, and the same checks run again before every rebroadcast. Rebroadcast uses the configured addresses, including when that update is disabled with `--no-paymaster` or `--no-superpaymaster`: the raw was authorized when it was signed. A raw whose fee is above the current `--max-fee-gwei` is not rebroadcast. One nonce is in flight. The same raw is rebroadcast; it is not replaced.

`updatePrice()` re-reads Chainlink; repeating it only spends gas. The keeper does not pin an oracle round. At one nonce only one signed transaction can execute, unless that chain history is reorged.

The nonce journal defaults to `~/.aastar-keeper/<network>.journal.json`. It stores one in-flight transaction or nothing, plus the rolling-hour send timestamps, whether the send ceiling is closed, and the last observed mined nonce. The file must be a regular file, mode `0600`, owned by this uid. Symlinks and FIFOs are refused on every read. Its directory is created at mode `0700`, and each new directory is fsynced into its parent, before the process binds two loopback sockets: one keyed by chain id and signer, and one keyed by the journal's real path. The first version of the file is written to a temporary name, fsynced, and published with a link that does not overwrite an existing file. A failed directory fsync after that publish refuses replay until a later barrier succeeds. Accepted connections on those sockets are closed immediately. The kernel drops both when the process dies, including after `SIGKILL`. Shutdown on SIGINT/SIGTERM stops new sends, waits for the in-flight sign and journal write (at most 120 seconds), kills cast, then exits. It does not unlock early. A second live process on the same host with the same chain and signer, or the same journal path, is refused. The lock is per host: two hosts or containers that share the key are an operator error. The keeper can only alert. There is no lock file and no stale-lock replacement. A corrupt journal, an unsafe file, or one written for another chain or signer, refuses every send until an operator intervenes. The latest raw's fees must match the journal entry, and must be within the current `--max-fee-gwei`, before it is broadcast.

A live run requires `--max-fee-gwei` (1 to 10000). There is one in-flight transaction. Each tick, if the chain's latest nonce is already above that nonce, the keeper clears the journal entry first. Receipt lookups are a queue of consumed nonces, off the signing queue: one lookup per nonce per tick, at most three tries, at most eight queued. Each consumed nonce then settles as `confirmed=receipt`, `confirmed=reverted`, or `nonce consumed, receipt unavailable`. A lookup that has not finished does not delay the next send. Before a new flight is signed, an exhausted hourly budget is written as closed and the signature is refused. Rebroadcasts of a raw that was already charged stay free. After `cast` returns, the keeper reads the chain id again and re-checks the send gate before it journals the raw.

If the nonce is still in flight, the same raw is rebroadcast after the signer, chain id, nonce, intent, and fee checks. The rebroadcast is free against the hourly ceiling. A raw above the current `--max-fee-gwei` is not rebroadcast and still counts toward the stall.

`--stall-sec` defaults to 600 on every chain. That is about 50 blocks on Sepolia (12s) and about 300 blocks on OP (2s). The stall is the time since that in-flight transaction's `firstSentAt`. It does not wait for a nonce read or a journal write. When the window has elapsed, sends close immediately and the keeper alerts `in-flight nonce N not included after <window>; ALL sends closed until a human acts; SuperPaymaster price goes stale at <ISO time> (in <minutes> min)`. The deadline is the cached `updatedAt` plus the on-chain `priceStalenessThreshold`, read at that moment. A 600s stall is not the price-staleness window (often 4200s): the stall closes sends early so a human can act before the cached price goes stale. If that read fails, the alert says `SuperPaymaster price staleness unreadable`. `stalled: true` and `stalledNonce` are stored in the journal and retried until that write succeeds. A restart stays stalled and refuses every send. The in-flight entry is cleared when the nonce is mined. The stall latch is not. Only `--clear-stall` clears it, and only after a fresh chain-id read matches this journal and the latest nonce is already above `stalledNonce`. A mismatch or an unreadable chain id leaves the journal as it is.

Clear it only after the nonce is gone. Read `RPC_URL` from the same env file you pass as `--env-file` (the keeper does not print that value). From the keystore, replace the stuck nonce at a fee at least 125% of the stuck transaction, on that chain, then run one shot:

```bash
# Read RPC_URL from the keeper env file (the value is not printed).
cast send --chain <chainId> --rpc-url "$RPC_URL" --nonce N --gas-price <ceil of 125% of the stuck max fee> --priority-gas-price <ceil of 125% of the stuck tip> --keystore ~/.aastar-keeper/keys/keeper --password-file ~/.aastar-keeper/keys/password <signer> --value 0
./run-keeper.sh sepolia --clear-stall --keystore ... --password-file ... --signer ... --max-fee-gwei 50
```

`--clear-stall` does not sign a replacement.

Signed broadcasts are capped per rolling hour by `--max-sends-per-hour`. A raw is charged on its first broadcast, including a maintenance rebroadcast of a raw that has never been sent. Rebroadcasting a raw that was already charged is free. Before a new flight is signed, a full budget is persisted as closed and the signature is refused, so an unpublished raw is not left behind. The default is `min(2 * ceil(3600 / pollInterval), 30)`: two price targets per poll, capped at 30. Crossing the cap alerts `send ceiling exceeded — all sends closed`. The timestamps and the closed bit are in the journal, so a restart or a `--once` loop does not get a fresh budget. The ceiling stays closed until the rolling hour has room again and the operator passes `--reset-send-ceiling`.

At startup the signer must not be the deployer `0xb5600060e6de5E11D3636731964218E53caadf0E`, the SuperPaymaster owner, the Registry owner, or the owner of the configured or resolved PaymasterV4. That Paymaster check runs even when `--no-paymaster` disables updates. The check reads `owner()` at one block hash. A failed read refuses to start. The same check runs again every hour, and on every tick while sends are closed. Identity is bound to the target set {SuperPaymaster, PaymasterV4, Registry}. PaymasterV4 comes only from `--paymaster`, the canonical book, or `config.<network>.json`, or it is resolved once from the factory at startup. That identity and owner guard must pass before the first tick. If PaymasterV4 cannot be resolved at startup, V4 price updates stay disabled until the process restarts, and the keeper alerts once: `PaymasterV4 unresolved at startup; V4 price updates disabled until restart`. No target is added or changed mid-run. If the set ever differs from the startup set, the whole price gate closes and stays closed. A grace period from the previous set does not reopen it. The registry address is the flag, else the canonical book, else `config.<network>.json`.

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
- `sender: above fee ceiling` when an in-flight raw is above the current `--max-fee-gwei` and is not rebroadcast
- `in-flight nonce N not included after <window>; ALL sends closed until a human acts` when the stall window ends
- `sender: broadcast failed` and `sender: sign failed` when a send or rebroadcast fails. The journal is kept
- `nonce consumed, receipt unavailable` when a consumed nonce has no receipt after three lookups

Dry-run prints the balance texts on stdout and does not send them.

## Required ENV

The keeper does not load `.env.<network>`. Put `RPC_URL` in `--env-file`. The wrapper refuses to start if `RPC_URL` or `TELEGRAM_BOT_TOKEN` or `TELEGRAM_CHAT_ID` is already exported. Any other key in the env file refuses startup and the error names the key, not the value. The process logs `TELEGRAM_CHAT_ID=set` or `not-set` and does not print the id.

`--env-file` is opened with `O_NOFOLLOW|O_NONBLOCK`. It must be a regular file, mode exactly `0600`, owned by the uid running the keeper. Its parent directory must be owned by that uid and must not be group- or world-writable. A symlink, a fifo, a wrong mode, or a foreign owner refuses startup. The error names the check and not the file contents.

`KEEPER_CAST_BIN` and `--cast-bin` must be absolute paths. The default name `cast` is looked up on `PATH` once at startup. In every case the keeper pins the absolute real path. The file and every ancestor up to `/` must be owned by this uid or by root, must not be group- or world-writable, and must not be sticky. A change before a later spawn refuses signing. The keeper's uid is inside the trust boundary because it can read the keystore and the password file anyway. Anything able to run as that uid can sign. The checks exist to stop other users from substituting the signer.

On anvil, and on any network whose canonical book lacks an address, the keeper reads `superPaymaster`, `paymasterV4`, `priceFeed`, `registry` and `paymasterFactory` from `config.<network>.json` in the repo. Only those address fields are used. `--price-feed` overrides the feed. `.env.<network>` is not read.

- `RPC_URL`

Optional:

- `OFFICIAL_OPERATOR` (used to derive the official Paymaster from the factory when no canonical instance exists)
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID` (must be numeric like `123...`/`-100...` or start with `@`)
- `KEEPER_CAST_BIN` (absolute path; pinned with the same trusted-ancestor checks as `--cast-bin`; the flag wins, then this value, then one `PATH` lookup of `cast`)
- `KEEPER_ETHUSD_URL` or `EXTERNAL_ETHUSD_URL` (external price URL; the flag wins, otherwise the Binance ETHUSDT ticker)

## CLI Flags

- `--network op-sepolia|op-mainnet|sepolia|mainnet|anvil`
- `--keystore <path>` (required unless `--dry-run`)
- `--password-file <path>` (required unless `--dry-run`)
- `--signer <address>` (required unless `--dry-run`; the recovered sender must match)
- `--cast-bin <path>` (absolute path, or the default name `cast` looked up once on `PATH`; pinned before the first spawn)
- `--journal <path>` (default `~/.aastar-keeper/<network>.journal.json`)
- `--env-file <path>` (optional; allowlisted keys only; pass it after `--` if you invoke node yourself, so Node does not open the file)
- `--registry <address>` (required for signer identity when neither the canonical book nor `config.<network>.json` has a registry)
- `--low-balance-wei <n>`
- `--superpaymaster <address>` (override)
- `--paymaster <address>` (override)
- `--price-feed <address>` (override)
- `--max-fee-gwei <n>` (required for a live run)
- `--max-tip-gwei <n>` (default 2; 0 is allowed)
- `--stall-sec <n>` (default 600 on every chain)
- `--clear-stall` (one shot; requires a fresh matching chain id and a latest nonce already above the stalled nonce; does not run when the chain id mismatches or cannot be read)
- `--max-gas <n>` (default 500000; applies to a new signature, not to rebroadcast of an already-signed raw)
- `--max-sends-per-hour <n>` (default `min(2 * ceil(3600 / pollInterval), 30)`; exceeding it closes sends until `--reset-send-ceiling` and the hour has room)
- `--reset-send-ceiling` (reopen a persisted ceiling once the rolling hour has room)
- `--paymaster-operator <address>` (override OFFICIAL_OPERATOR)
- `--disable-superpaymaster` / `--no-superpaymaster`
- `--disable-paymaster` / `--no-paymaster`
- `--poll-interval <seconds>` (default: 30)
- `--safety-margin <seconds>` (default: 600)
- `--max-updates-per-day <n>` (default: 24)
- `--max-base-fee-gwei <gwei>` (optional)
- `--dry-run`
- `--once` (one tick, then exit 0; exit 2 when that tick had an operational failure)
- `--logo` / `--no-logo`
