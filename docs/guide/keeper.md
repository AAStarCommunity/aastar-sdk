# Price Keeper (SuperPaymaster + Paymaster)

This keeper is a long-running offchain agent that keeps `cachedPrice` fresh by calling `updatePrice()` only when needed.

## What It Does

- Reads `cachedPrice.updatedAt` and `priceStalenessThreshold()` from SuperPaymaster and the official Paymaster
- Reads `updatedAt` from the Chainlink ETH/USD feed
- Sends `updatePrice()` when the cached price is close to expiring and Chainlink has fresher data (handled independently per contract)
- Sends Telegram alerts on errors and an hourly heartbeat (optional)

## Update Policy (Gas-Saving)

The keeper submits `updatePrice()` only when all of the following are true:

- `cachedPrice.updatedAt == 0` (bootstrap case), or
- Current time is within `safetyMarginSec` before `cachedPrice.updatedAt + priceStalenessThreshold`
- Chainlink has newer data than the cached price
- Chainlink data is not older than `priceStalenessThreshold`

Additionally:

- Enforces `maxUpdatesPerDay` to avoid abuse. It counts transactions sent, including ones that later revert or stay pending, not confirmed updates (counted in memory per process; see Known Limitations)
- Optionally skips updates when base fee is above `maxBaseFeeGwei` (unless very close to expiry)
- With `--hard-max-fee-gwei`, never sends while the base fee is above it, not even close to expiry, and signs every
  update with that value as its max fee per gas, so the chain cannot charge more. It alerts when it skips for this
  reason. A live run on `op-mainnet` or `mainnet` refuses to start without it.
- A mined update counts only if its receipt succeeded. A reverted `updatePrice()` is reported as reverted (log and
  Telegram), not as an update.
- SuperPaymaster and the Paymaster are refreshed independently in each tick: one failing does not stop the other.
  The failures of a tick are reported together, and `--once` exits 1 when its tick failed.

The bootstrap case (`updatedAt == 0`) sends without checking Chainlink's freshness first. `updatePrice()` reads the feed
itself; what the contract does with an empty or stale round has not been verified in this repository.

## Addresses Source (No ENV Needed)

By default, contract addresses are loaded from `@aastar/core` canonical constants (per chainId).

Paymaster selection:

- If the canonical constants include an official Paymaster instance address, the keeper uses it
- Otherwise it derives the official Paymaster address from `PaymasterFactory.paymasterByOperator(OFFICIAL_OPERATOR)`
- You can override with `--paymaster <address>`

## How To Run

From the monorepo root:

```bash
pnpm keeper:op-sepolia
pnpm keeper:op-mainnet -- --hard-max-fee-gwei <gwei>
```

`<gwei>` is the fee ceiling you choose for OP Mainnet (see `--hard-max-fee-gwei` below); a live mainnet run refuses without it.

One-shot mode:

```bash
pnpm keeper:op-mainnet -- --once --hard-max-fee-gwei <gwei>
```

Cast (keystore) mode:

```bash
pnpm keeper:op-mainnet -- --mode cast --keystore /path/to/keystore.json --hard-max-fee-gwei <gwei>
```

Cast (named account) mode:

```bash
pnpm keeper:op-mainnet -- --mode cast --cast-account keeper --hard-max-fee-gwei <gwei>
```

Replace `keeper` with the name of the keeper's own Foundry account. Do not use the deployer's account or any account that holds a protocol privilege (owner, admin, guardian, timelock role): the keeper signs every price update with it.

`--cast-account` (or `--keystore`) is required in cast mode. Arguments are parsed strictly: an unknown option, an `--option=value` form, a repeated option or a value that starts with `-` refuses to start (so `--dry-run=true` is refused, not run live). A keystore file whose name starts with `-` is passed as `./-name.json`. `DEPLOYER_ACCOUNT` is not read: it names the deployer, and the keeper has no fallback signer of any kind. `run-keeper-main.sh` takes the account from `KEEPER_CAST_ACCOUNT` and has no default.

Who signs is never guessed. `--keystore` or `--cast-account` alone selects cast mode. `--mode privateKey` together with either of them refuses, and so do `--keystore` and `--cast-account` together.

In cast mode (non-dry-run), the keeper asks once for the keystore password, on a hidden prompt at startup, and reuses it for later updates. It never reads the password from the environment, an argument or a file you provide. Without a terminal there is nobody to answer the prompt, so a live cast-mode run without a terminal refuses to start. **Unattended cast mode is not supported** until the keystore sender of #446/#447 (FU-114). Unattended runs use privateKey mode with the keeper's own key.

`cast` runs with a minimal environment (`PATH`, `HOME`, `TMPDIR`, `LANG`, `LC_ALL`, `USER`, `FOUNDRY_DIR`), and the RPC URL is passed to it as `ETH_RPC_URL`, not on its command line. No key, password or Telegram variable reaches it. It is given `--chain <id>`, so it signs for the configured chain only.

Private-key mode:

```bash
pnpm keeper:op-mainnet -- --mode privateKey --hard-max-fee-gwei <gwei>
```

## Required ENV

The keeper loads `.env.<network>` from the current working directory.

- `RPC_URL`

The RPC must serve the network's chain: the keeper reads `eth_chainId` before anything else, and again right before each cast send, and refuses on a mismatch. The RPC URL is logged as scheme and host only.

For `op-mainnet` the keeper reads `.env.optimism` and `.env.op-mainnet`. If both set the same variable to different values, it refuses to start and names the variables (never their values): keep one value. A variable already set in the process environment wins over the files. If `KEEPER_PRIVATE_KEY` or `RPC_URL` is set in both with different values, the keeper refuses to start (it would otherwise be guessing the signer or the chain); for any other variable it says, by name, that the file's value is ignored. Env-backed options (`KEEPER_HEALTH_INTERVAL_SEC`, `EXTERNAL_ETHUSD_URL`, ...) are read after the files are loaded, so the files can set them; a CLI flag still wins.

Signer (exactly one, no fallback):

- privateKey mode (default): `KEEPER_PRIVATE_KEY`, **required** for any run that sends (only `--dry-run` runs without it).
  `PRIVATE_KEY_SUPPLIER` and `PRIVATE_KEY` in `.env.<network>` are not read, because on Sepolia they are the deployer EOA.
- cast mode: `--keystore <path>` or `--cast-account <name>`, **required**. `DEPLOYER_ACCOUNT` is not read.

Use the keeper's own dedicated signer, never the deployer or any account with a protocol privilege.

Optional:

- `OFFICIAL_OPERATOR` (used to derive official Paymaster from the factory when no canonical instance exists)
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID` (must be numeric like `123...`/`-100...` or start with `@`)

## CLI Flags

- `--network op-sepolia|op-mainnet|sepolia|mainnet|anvil`
- `--mode cast|privateKey`
- `--keystore <path>` (cast mode)
- `--cast-account <name>` (cast mode, uses Foundry keystore account name)
- `--superpaymaster <address>` (override)
- `--paymaster <address>` (override)
- `--paymaster-operator <address>` (override OFFICIAL_OPERATOR)
- `--disable-superpaymaster` / `--no-superpaymaster`
- `--disable-paymaster` / `--no-paymaster`
- `--poll-interval <seconds>` (default: 30)
- `--safety-margin <seconds>` (default: 600)
- `--max-updates-per-day <n>` (default: 24)
- `--max-base-fee-gwei <gwei>` (optional; a soft gate, overridden in the last 180 s before expiry)
- `--hard-max-fee-gwei <gwei>` (absolute ceiling and the max fee per gas of every update; required for a live run on `op-mainnet` / `mainnet`)
- `--dry-run`
- `--once`
- `--logo` / `--no-logo`

Every value is checked locally before the first request: numbers must be whole numbers (seconds, counts), gwei amounts positive with at most 9 decimals, addresses valid (mixed case must be a valid checksum), and `--network` one of the names above. A refusal names the option, never the value.

## Known Limitations

- `maxUpdatesPerDay` is counted in memory: it restarts at 0 when the keeper restarts, and two keeper processes on the same signer each have their own count. A send that fails after the transaction was broadcast is not counted. This can repeat on every tick for as long as broadcasts succeed but their responses are lost and the cached price stays stale, so the number of uncounted transactions is not bounded by the keeper. The signer does not change, and once a price update lands on chain the keeper stops sending. A persisted journal and a single-instance lock are part of the #446/#447 sender (FU-114).
- `--hard-max-fee-gwei` bounds the fee per gas, not the gas used: there is no gas-limit or per-transaction cost ceiling, so it is not a total-spend limit.
- Each target's confirmation is awaited in the tick (up to about 10 minutes for a receipt and 10 more for the state), so a slow SuperPaymaster confirmation delays the PaymasterV4 decision by as much, and that decision uses the time read at the start of the tick.
- After SIGINT / SIGTERM no new signature is started. A transaction already signed when the signal arrives is waited for and reported: "stopped" names it if it was broadcast. A cast send in flight is terminated, and the running tick gets up to 15 s to finish. If the tick does not finish, or a send was cut off (a terminated cast or a timed-out RPC request may or may not have reached the network), the keeper exits with code 2, saying a send is in an unknown state: check the signer's nonce before restarting. A clean stop exits 0. A broken stdout/stderr pipe goes through the same path and never exits 0. A cast send that exits 0 without printing a transaction hash is treated as an unknown send state, not as an update.
- In cast mode the password is written to a `0600` file in a fresh temporary directory, removed on a normal exit or SIGINT / SIGTERM. After SIGKILL or a crash the file stays, and a signal that arrives while the file is being written, before the shutdown handlers are installed, can leave it too (FU-114).
- The password prompt does not echo what is typed or pasted. End of input, Ctrl-C or an empty answer refuses to start.
- The test guard `scripts/keeper/no-egress.preload.mjs` is a guard on the test process tree, not OS-level isolation (FU-112 ②).
