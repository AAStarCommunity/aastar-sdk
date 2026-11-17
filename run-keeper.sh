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
# Everything is auto-wired:
#   - the signing key is NOT auto-loaded: export KEEPER_PRIVATE_KEY (or pass --mode cast --cast-account <name>).
#     There is no fallback: PRIVATE_KEY / PRIVATE_KEY_SUPPLIER in .env.<network> are the deployer EOA on Sepolia,
#     and a keeper that silently signs with the deployer moves its nonce (deploy-day rule). --dry-run needs no key.
#   - the SuperPaymaster + PaymasterV4 addresses are baked in per network below
#     (update the CONFIG block when a deployment changes)
#
set -euo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

NETWORK="${1:-sepolia}"
[ $# -gt 0 ] && shift || true
# Checked before it is logged or used: a key pasted as the first argument must not be printed (KDR-012).
case "$NETWORK" in
  anvil|sepolia|op-sepolia|op-mainnet|mainnet) ;;
  *) echo "error: unknown network (expected anvil, sepolia, op-sepolia, op-mainnet or mainnet; the value is not shown)" >&2; exit 1 ;;
esac

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

# ── Signing key ───────────────────────────────────────────────────────────────
# Not handled here. keeper.ts decides, mode-aware and after it loads .env.<network>, with no fallback:
# privateKey mode needs KEEPER_PRIVATE_KEY, cast mode needs --keystore / --cast-account. This script never reads
# PRIVATE_KEY from .env.<network> (on Sepolia that is the deployer EOA) and never exports a key.

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
echo "keeper: network=$NETWORK baked-args=${ADDR_ARGS[*]:-<none: canonical / caller>}"
# Defaults are appended only when the caller did not pass the flag: keeper.ts refuses a repeated flag
# (no "first one wins"), so a caller's --poll-interval replaces the default instead of colliding with it.
DEFAULT_ARGS=()
add_default() { has_arg "$1" "${@:3}" || DEFAULT_ARGS+=("$1" "$2"); }
add_default --external-ethusd-url "$EXT_URL" "$@"
add_default --poll-interval "${KEEPER_POLL_INTERVAL:-180}" "$@"
add_default --safety-margin "${KEEPER_SAFETY_MARGIN:-600}" "$@"
add_default --health-interval "${KEEPER_HEALTH_INTERVAL:-1800}" "$@"
add_default --volatility-threshold-bps "${KEEPER_VOL_BPS:-150}" "$@"
add_default --volatility-cooldown "${KEEPER_VOL_COOLDOWN:-600}" "$@"

exec pnpm exec tsx scripts/keeper.ts \
  --network "$NETWORK" \
  ${ADDR_ARGS[@]+"${ADDR_ARGS[@]}"} \
  ${DEFAULT_ARGS[@]+"${DEFAULT_ARGS[@]}"} \
  "$@"
