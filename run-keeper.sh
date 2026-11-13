#!/usr/bin/env bash
#
# Price keeper — keeps the SuperPaymaster + PaymasterV4 price caches fresh so
# sponsored UserOps never fail with STALE_PRICE.
#
#   ./run-keeper.sh              # = sepolia (default), runs forever
#   ./run-keeper.sh sepolia      # explicit network
#   ./run-keeper.sh op-mainnet   # mainnet
#   ./run-keeper.sh sepolia --once          # one tick then exit
#   ./run-keeper.sh sepolia --once --dry-run  # show what it would do, send nothing
#
# Everything is auto-wired except the signer:
#   - live runs need --keystore, --password-file and --signer (the key never enters this process)
#   - --dry-run signs nothing and needs no keystore
#   - the SuperPaymaster + PaymasterV4 addresses are baked in per network below
#     (update the CONFIG block when a deployment changes)
#
set -euo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

NETWORK="${1:-sepolia}"
[ $# -gt 0 ] && shift || true

# True when the caller passed exactly this flag. Whole-argument match, like keeper.ts's own
# parser: a substring grep took --paymaster-missing-alert for --paymaster and silently dropped
# the baked V4 below (PR #425 review).
has_arg() {
  local want="$1" a; shift
  for a in "$@"; do [ "$a" = "$want" ] && return 0; done
  return 1
}

# ── Per-network CONFIG ────────────────────────────────────────────────────────
# SuperPaymaster proxy + the PaymasterV4 actually used on that network.
# SuperPaymaster is NOT baked for Sepolia: it resolves from CANONICAL_ADDRESSES (the proxy
# 0x09DF…4DE9, unchanged by in-place upgrades such as 5.4.2 -> 5.5.0). The value baked here
# before was the SuperPaymaster-5.3.3 contract 0xFb09…266a, a different, retired deployment.
# Sepolia PaymasterV4 = the deployer-operator's V4 (the one the on-chain E2E uses,
# resolved via PaymasterFactory.paymasterByOperator(deployer)). NOT the canonical
# (community) V4 — they differ.
case "$NETWORK" in
  sepolia)
    SUPERPAYMASTER=""   # resolve from CANONICAL_ADDRESSES (see above)
    PAYMASTER_V4="0x2118e9a404C15F70B1D4f53b400c8a566A5ea4B6"     # PMV4-Deposit-4.5.0 (deployer)
    ;;
  op-mainnet|optimism)
    SUPERPAYMASTER=""   # fill in when deployed; empty => resolve from CANONICAL_ADDRESSES
    PAYMASTER_V4=""
    ;;
  *)
    SUPERPAYMASTER=""   # other networks: resolve from CANONICAL_ADDRESSES
    PAYMASTER_V4=""
    ;;
esac

# Signing: an encrypted keystore. This script does not source .env files and does not pass inherited secrets.
# --resync-journal only needs --signer. Live runs still need the keystore.
if has_arg --resync-journal "$@"; then
  if ! has_arg --signer "$@"; then
    echo "error: --resync-journal requires --signer" >&2
    exit 1
  fi
elif ! has_arg --dry-run "$@"; then
  if ! has_arg --keystore "$@" || ! has_arg --password-file "$@" || ! has_arg --signer "$@"; then
    echo "error: live runs require --keystore, --password-file and --signer (or pass --dry-run)" >&2
    exit 1
  fi
fi

CAST_ARGS=()
if [ -n "${KEEPER_CAST_BIN:-}" ] && ! has_arg --cast-bin "$@"; then
  CAST_ARGS+=(--cast-bin "$KEEPER_CAST_BIN")
fi

# ── Build args (baked addresses unless the caller overrides) ──────────────────
ADDR_ARGS=()
# Explicit ifs: an empty baked value must append nothing (and must not read as a failure).
if [ -n "$SUPERPAYMASTER" ] && ! has_arg --superpaymaster "$@"; then
  ADDR_ARGS+=(--superpaymaster "$SUPERPAYMASTER")
fi
if [ -n "$PAYMASTER_V4" ] && ! has_arg --paymaster "$@"; then
  ADDR_ARGS+=(--paymaster "$PAYMASTER_V4")
fi

EXT_URL="${KEEPER_ETHUSD_URL:-https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT}"

# ${ADDR_ARGS[@]+...}: macOS bash 3.2 treats an empty array as unbound under `set -u`.
# env -i drops inherited secrets. Only PATH, HOME, and the keeper allowlist are forwarded.
echo "keeper: network=$NETWORK baked-args=${ADDR_ARGS[*]:-<none: canonical / caller>}"
launch_env=( "PATH=${PATH:-/usr/bin:/bin}" "HOME=${HOME:-}" )
pass_if_set() {
  local k="$1" v
  eval "v=\${$k-}"
  if [ -n "$v" ]; then
    launch_env+=( "${k}=${v}" )
  fi
}
for k in \
  RPC_URL BUNDLER_URL TELEGRAM_BOT_TOKEN TELEGRAM_CHAT_ID OFFICIAL_OPERATOR EXTERNAL_ETHUSD_URL \
  KEEPER_HEALTH_INTERVAL_SEC KEEPER_VOLATILITY_THRESHOLD_BPS KEEPER_VOLATILITY_COOLDOWN_SEC \
  KEEPER_CHAINLINK_STALE_SEC KEEPER_PAYMASTER_MISSING_ALERT_SEC KEEPER_POLL_INTERVAL \
  KEEPER_SAFETY_MARGIN KEEPER_HEALTH_INTERVAL KEEPER_VOL_BPS KEEPER_VOL_COOLDOWN \
  KEEPER_ETHUSD_URL KEEPER_CAST_BIN
do
  pass_if_set "$k"
done
exec env -i "${launch_env[@]}" pnpm exec tsx scripts/keeper.ts \
  --network "$NETWORK" \
  ${ADDR_ARGS[@]+"${ADDR_ARGS[@]}"} \
  --external-ethusd-url "$EXT_URL" \
  --poll-interval "${KEEPER_POLL_INTERVAL:-180}" \
  --safety-margin "${KEEPER_SAFETY_MARGIN:-600}" \
  --health-interval "${KEEPER_HEALTH_INTERVAL:-1800}" \
  --volatility-threshold-bps "${KEEPER_VOL_BPS:-150}" \
  --volatility-cooldown "${KEEPER_VOL_COOLDOWN:-600}" \
  ${CAST_ARGS[@]+"${CAST_ARGS[@]}"} \
  "$@"
