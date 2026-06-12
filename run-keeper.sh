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
#   - the signing key is read from ./.env.<network>'s PRIVATE_KEY (no manual export)
#   - the SuperPaymaster + PaymasterV4 addresses are baked in per network below
#     (update the CONFIG block when a deployment changes)
#
set -euo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

NETWORK="${1:-sepolia}"
[ $# -gt 0 ] && shift || true

# ── Per-network CONFIG (v5.3.3) ───────────────────────────────────────────────
# SuperPaymaster proxy + the PaymasterV4 actually used on that network.
# Sepolia PaymasterV4 = the deployer-operator's V4 (the one the on-chain E2E uses,
# resolved via PaymasterFactory.paymasterByOperator(deployer)). NOT the canonical
# (community) V4 — they differ.
case "$NETWORK" in
  sepolia)
    SUPERPAYMASTER="0xFb090E82bD041C6e9787eDEbE1D3BE55b3c7266a"   # SuperPaymaster-5.3.3
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

# ── Auto-load the signing key from .env.<network> ─────────────────────────────
ENV_FILE=".env.${NETWORK}"
if [ -z "${KEEPER_PRIVATE_KEY:-}" ]; then
  if [ -f "$ENV_FILE" ]; then
    PK="$(grep -m1 '^PRIVATE_KEY=' "$ENV_FILE" | cut -d= -f2- | tr -d '"'"'"' \r' || true)"
    [ -n "$PK" ] && export KEEPER_PRIVATE_KEY="$PK"
  fi
fi
if [ -z "${KEEPER_PRIVATE_KEY:-}" ] && ! printf '%s ' "$@" | grep -q -- '--dry-run'; then
  echo "error: no signing key — set PRIVATE_KEY in $ENV_FILE (or export KEEPER_PRIVATE_KEY)" >&2
  exit 1
fi

# ── Build args (baked addresses unless the caller overrides) ──────────────────
ADDR_ARGS=()
printf '%s ' "$@" | grep -q -- '--superpaymaster' || { [ -n "$SUPERPAYMASTER" ] && ADDR_ARGS+=(--superpaymaster "$SUPERPAYMASTER"); }
printf '%s ' "$@" | grep -q -- '--paymaster'      || { [ -n "$PAYMASTER_V4" ]  && ADDR_ARGS+=(--paymaster "$PAYMASTER_V4"); }

EXT_URL="${KEEPER_ETHUSD_URL:-https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT}"

echo "keeper: network=$NETWORK sp=${SUPERPAYMASTER:-<canonical>} v4=${PAYMASTER_V4:-<canonical>}"
exec pnpm exec tsx scripts/keeper.ts \
  --network "$NETWORK" \
  "${ADDR_ARGS[@]}" \
  --external-ethusd-url "$EXT_URL" \
  --poll-interval "${KEEPER_POLL_INTERVAL:-180}" \
  --safety-margin "${KEEPER_SAFETY_MARGIN:-600}" \
  --health-interval "${KEEPER_HEALTH_INTERVAL:-1800}" \
  --volatility-threshold-bps "${KEEPER_VOL_BPS:-150}" \
  --volatility-cooldown "${KEEPER_VOL_COOLDOWN:-600}" \
  "$@"
