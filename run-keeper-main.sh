#!/usr/bin/env bash
# OP Mainnet price keeper, cast mode. The signing account is named explicitly: KEEPER_CAST_ACCOUNT=<foundry
# account name>. There is no default; it used to be `optimism-deployer`, i.e. a deployer key by default.
set -euo pipefail
if [ -z "${KEEPER_CAST_ACCOUNT:-}" ]; then
  echo "error: set KEEPER_CAST_ACCOUNT to the keeper's own foundry account (no default; never a deployer)" >&2
  exit 1
fi
# keeper.ts refuses a repeated flag, so a default is added only when the caller did not pass it.
has_arg() { local want="$1" a; shift; for a in "$@"; do [ "$a" = "$want" ] && return 0; done; return 1; }
ARGS=()
add_default() { has_arg "$1" "${@:3}" || ARGS+=("$1" "$2"); }
add_default --external-ethusd-url "https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT" "$@"
add_default --poll-interval 180 "$@"
add_default --safety-margin 600 "$@"
add_default --health-interval 1800 "$@"
add_default --volatility-threshold-bps 150 "$@"
add_default --volatility-cooldown 600 "$@"
pnpm exec tsx scripts/keeper.ts \
  --network op-mainnet \
  --mode cast \
  --cast-account "$KEEPER_CAST_ACCOUNT" \
  ${ARGS[@]+"${ARGS[@]}"} \
  "$@"
