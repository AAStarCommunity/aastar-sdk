#!/usr/bin/env bash
# Flag checks live in run-keeper.sh. Pass --env-file for RPC_URL and Telegram. Do not export those names.
set -euo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec ./run-keeper.sh op-mainnet \
  --external-ethusd-url "https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT" \
  --poll-interval 180 \
  --safety-margin 600 \
  --health-interval 1800 \
  --volatility-threshold-bps 150 \
  --volatility-cooldown 600 \
  "$@"
