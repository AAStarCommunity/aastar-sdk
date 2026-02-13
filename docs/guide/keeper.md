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

- Enforces `maxUpdatesPerDay` to avoid abuse
- Optionally skips updates when base fee is above `maxBaseFeeGwei` (unless very close to expiry)

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
pnpm keeper:op-mainnet
```

One-shot mode:

```bash
pnpm keeper:op-mainnet -- --once
```

Cast (keystore) mode:

```bash
pnpm keeper:op-mainnet -- --mode cast --keystore /path/to/keystore.json
```

Cast (named account) mode:

```bash
pnpm keeper:op-mainnet -- --mode cast --cast-account optimism-deployer
```

If `--cast-account` is omitted, the keeper uses `DEPLOYER_ACCOUNT` from `.env.<network>` by default.

In cast mode (non-dry-run), the keeper will prompt once for the keystore password at startup and reuse it for subsequent updates. For unattended runs, set `CAST_KEYSTORE_PASSWORD` in `.env.<network>` so no interactive prompt is needed.

Private-key mode:

```bash
pnpm keeper:op-mainnet -- --mode privateKey
```

## Required ENV

The keeper loads `.env.<network>` from the current working directory.

- `RPC_URL`
- `TEST_PRIVATE_KEY` (required by shared network loader)

Optional:

- `KEEPER_PRIVATE_KEY` (privateKey mode)
- `PRIVATE_KEY_SUPPLIER` (fallback for privateKey mode)
- `CAST_KEYSTORE_PASSWORD` (cast mode; otherwise it prompts)
- `DEPLOYER_ACCOUNT` (cast mode default account name for `--cast-account`)
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
- `--max-base-fee-gwei <gwei>` (optional)
- `--dry-run`
- `--once`
- `--logo` / `--no-logo`
