#!/usr/bin/env bash
#
# Price keeper wrapper — keeps SuperPaymaster + PaymasterV4 price caches fresh
# so sponsored UserOps never fail with STALE_PRICE.
#
# Usage:
#   ./run-keeper.sh <network> [extra keeper args...]
#
#   network: sepolia | op-sepolia | op-mainnet | mainnet | anvil
#
# Auth (pick one):
#   - privateKey mode (default): export KEEPER_PRIVATE_KEY=0x...
#                                (or PRIVATE_KEY_SUPPLIER=0x...)
#   - cast mode (Foundry keystore): pass  --mode cast --cast-account <name>
#
# Contract addresses are resolved from the SDK's CANONICAL_ADDRESSES for the
# given network. Until the v5.3.3 address sync (PR #33) is merged + published,
# override the Sepolia SuperPaymaster explicitly, e.g.:
#   ./run-keeper.sh sepolia --superpaymaster 0xFb090E82bD041C6e9787eDEbE1D3BE55b3c7266a
#
# RPC_URL is read from .env.<network> (must exist with RPC_URL=...).
#
# Tunables via env (all optional, sane defaults below):
#   KEEPER_ETHUSD_URL     external ETH/USD reference for volatility-aware updates
#   KEEPER_POLL_INTERVAL  seconds between checks            (default 180)
#   KEEPER_SAFETY_MARGIN  refresh this long before expiry   (default 600)
#   KEEPER_HEALTH_INTERVAL periodic health ping interval    (default 1800)
#   KEEPER_VOL_BPS        volatility threshold in bps        (default 150)
#   KEEPER_VOL_COOLDOWN   volatility re-trigger cooldown sec (default 600)
#
# NOTE: the keeper refreshes BOTH the SuperPaymaster cache AND a PaymasterV4
# cache each tick. The PaymasterV4 it targets defaults to CANONICAL_ADDRESSES
# (Anni's community proxy). The Sepolia E2E suite uses the DEPLOYER's V4, which
# is a different instance — so for keeping the E2E green you MUST point --paymaster
# at the deployer's V4 (resolve via PaymasterFactory.paymasterByOperator(deployer)).
#
# Examples:
#   # Sepolia — keep BOTH the SuperPaymaster and the E2E (deployer) PaymasterV4 fresh.
#   # Uses PRIVATE_KEY from .env.sepolia (mapped to KEEPER_PRIVATE_KEY):
#   export KEEPER_PRIVATE_KEY="$(grep -m1 '^PRIVATE_KEY=' .env.sepolia | cut -d= -f2-)"
#   ./run-keeper.sh sepolia \
#       --superpaymaster 0xFb090E82bD041C6e9787eDEbE1D3BE55b3c7266a \
#       --paymaster      0x2118e9a404C15F70B1D4f53b400c8a566A5ea4B6
#
#   ./run-keeper.sh op-mainnet --mode cast --cast-account optimism-deployer
#   ./run-keeper.sh sepolia --once --dry-run        # validate without sending a tx
#
set -euo pipefail

NETWORK="${1:-}"
if [ -z "$NETWORK" ]; then
  echo "usage: $0 <sepolia|op-sepolia|op-mainnet|mainnet|anvil> [extra keeper args...]" >&2
  exit 1
fi
shift || true

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

EXT_URL="${KEEPER_ETHUSD_URL:-https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT}"

exec pnpm exec tsx scripts/keeper.ts \
  --network "$NETWORK" \
  --external-ethusd-url "$EXT_URL" \
  --poll-interval "${KEEPER_POLL_INTERVAL:-180}" \
  --safety-margin "${KEEPER_SAFETY_MARGIN:-600}" \
  --health-interval "${KEEPER_HEALTH_INTERVAL:-1800}" \
  --volatility-threshold-bps "${KEEPER_VOL_BPS:-150}" \
  --volatility-cooldown "${KEEPER_VOL_COOLDOWN:-600}" \
  "$@"
