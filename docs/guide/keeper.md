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

`KEEPER_PRIVATE_KEY`, `PRIVATE_KEY_SUPPLIER` and `PRIVATE_KEY` in `.env.<network>` are not read and are not a signing path. `run-keeper.sh` does not export them.

## Migrating off KEEPER_PRIVATE_KEY

Stop the old keeper before the first start of this process. Make sure nothing is pending for the signer: no unmined transaction from the old process, from another host, or from a manual `cast`. This keeper's journal starts from the chain nonce. A pending transaction leaves latest and pending nonces different, and sends stay refused until that nonce is included. `--resync-journal` is only for the case where latest equals pending and the journal has no in-flight entry.

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

The nonce journal defaults to `~/.aastar-keeper/<network>.journal.json`. Its directory is created at mode `0700` before the process binds a loopback socket keyed by chain id and signer. The kernel drops that socket when the process dies, including after `SIGKILL`. A second live process with the same chain and signer is refused, even if it uses another journal path. There is no lock file and no stale-lock replacement. A corrupt journal, or one written for another chain or signer, refuses every send until an operator intervenes. If the chain nonce moves ahead of the journal, the key was used outside this process: every send is refused and an alert names the expected nonce and the nonce the chain reported. Normal runs never rewrite the journal to match that nonce. `--resync-journal` is the one-shot recovery: it runs only when the chain's latest nonce equals its pending nonce and every journal entry is included, then it sets the base nonce to that value, drops the entries, prints what changed, alerts, and exits. A chain nonce behind the journal is refused as `sender: nonce behind journal` and is not sticky. If the last journal entry is included but none of its hashes still have a receipt, that entry is put back to `sent` and its original bytes are rebroadcast.

At startup the signer must not be the deployer `0xb5600060e6de5E11D3636731964218E53caadf0E`, the SuperPaymaster owner, or the Registry owner. On SuperPaymaster 5.4.2 that refuse-start set is exactly those three (DSR on #446). The check reads `owner()` at one block hash. A failed read refuses to start. The same check runs again every hour, and on every tick while sends are closed.

The identity gate has two branches:

1. The signer is confirmed privileged (deployer, SuperPaymaster owner, or Registry owner). All sends close. The alert says price updates have also stopped.
2. An identity read failed. Price updates continue for at most 6 hours after the last successful check, then all sends close. The alert during that window says `pause only; price updates continue`. When the 6 hours end, the alert says price updates have also stopped. Recovery says `signer identity recovered; price and pause resumed`.

A recovery alerts once when sends open again, not on every check. A network with no registry address refuses to start until `--registry <address>` is passed. Passing `--signer` on a dry-run runs the same check and does not sign.

`--pause-config`, `--pause-interval-sec`, `--pause-offset-sec` and `--role-sync-budget-sec` are not accepted. This keeper exits 1 if one of them is present.

## Alerts

Telegram is optional (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`). The keeper adds the `[keeper]` prefix when it sends the Telegram message.

- `low signer balance` when the signer balance is below `--low-balance-wei` (default 0.02 ETH on Sepolia, 0.005 ETH otherwise). The balance is read at most once an hour, and the alert is repeated at most once per 6 hours. There is no funding cap.
- `balance read failed`, on the same hourly read and the same 6 hour limit
- signer-identity refusal, saying that price updates have stopped, or that price updates continue after a failed read, plus a recovery line when sends open again
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
- `--registry <address>` (required for signer identity when the network has no registry)
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
- `--once` (one tick, then exit)
- `--logo` / `--no-logo`
