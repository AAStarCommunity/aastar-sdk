#!/usr/bin/env bash
# Flag checks live in run-keeper.sh. Pass --env-file for RPC_URL and Telegram. Do not export those names.
# exec replaces this process with run-keeper.sh, which execs node. The supervisor's PID is the keeper.
# The public ETH/USD URL is the keeper default. Put KEEPER_ETHUSD_URL in --env-file to override it.
set -euo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
has_arg() {
  local want="$1" a; shift
  for a in "$@"; do [ "$a" = "$want" ] && return 0; done
  return 1
}
EXTRA=()
has_arg --poll-interval "$@" || EXTRA+=(--poll-interval 180)
has_arg --safety-margin "$@" || EXTRA+=(--safety-margin 600)
has_arg --health-interval "$@" || EXTRA+=(--health-interval 1800)
has_arg --volatility-threshold-bps "$@" || EXTRA+=(--volatility-threshold-bps 150)
has_arg --volatility-cooldown "$@" || EXTRA+=(--volatility-cooldown 600)
exec ./run-keeper.sh op-mainnet "${EXTRA[@]}" "$@"
