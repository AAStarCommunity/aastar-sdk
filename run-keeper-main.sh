#!/usr/bin/env bash
# Flag checks live in run-keeper.sh. Pass --env-file for RPC_URL and Telegram. Do not export those names.
# exec replaces this process with run-keeper.sh, which execs node. The supervisor's PID is the keeper.
# The public ETH/USD URL is the keeper default. Put KEEPER_ETHUSD_URL in --env-file to override it.
set -euo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec ./run-keeper.sh op-mainnet \
  --poll-interval 180 \
  --safety-margin 600 \
  --health-interval 1800 \
  --volatility-threshold-bps 150 \
  --volatility-cooldown 600 \
  "$@"
