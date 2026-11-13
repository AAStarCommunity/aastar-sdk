#!/bin/bash
#
# Price keeper — dry-run wrapper only.
# A live run starts from the launchd plist with absolute ProgramArguments.
# See docs/guide/keeper.md. This script signs nothing.
#
#   ./run-keeper.sh sepolia --dry-run --once
# Credential flags are refused. A dry-run that needs RPC starts from the absolute node command.
#
set -euo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# True when the caller passed exactly this flag. Whole-argument match.
has_arg() {
  local want="$1" a; shift
  for a in "$@"; do [ "$a" = "$want" ] && return 0; done
  return 1
}

# Live signing arguments are not accepted here. The plist is the only live entry.
if ! has_arg --dry-run "$@"; then
  echo "live runs must start from the plist with absolute ProgramArguments; see docs/guide/keeper.md" >&2
  exit 1
fi
for a in "$@"; do
  case "$a" in
    --keystore|--password-file|--env-file|--signer|--keystore=*|--password-file=*|--env-file=*|--signer=*)
      echo "error: a dry-run cannot take --keystore, --password-file, --env-file, or --signer" >&2
      exit 1
      ;;
  esac
done

NETWORK="${1:-sepolia}"
[ $# -gt 0 ] && shift || true

# ── Per-network CONFIG ────────────────────────────────────────────────────────
# Addresses are not baked. PaymasterV4 comes from --paymaster or the canonical book
# inside keeper.ts. A non-canonical deployer V4 must not be injected by this wrapper.
case "$NETWORK" in
  sepolia|op-mainnet|optimism|*)
    SUPERPAYMASTER=""
    PAYMASTER_V4=""
    ;;
esac

# Secrets stay in --env-file. They are never placed on argv, including the argv of env.
for secret_name in RPC_URL TELEGRAM_BOT_TOKEN TELEGRAM_CHAT_ID; do
  if [ -n "${!secret_name-}" ]; then
    echo "error: ${secret_name} is set in the environment; put it in --env-file and unset it before launching" >&2
    exit 1
  fi
done
# Same name class as SECRET_NAME in scripts/keeper/secretEnv.ts. Exported names only. The value is not printed.
shopt -s nocasematch
while IFS= read -r secret_name; do
  case "$secret_name" in
    *PRIVATE_KEY*|*MNEMONIC*|*KEYSTORE_PASSWORD*|*SEED*|*PASSPHRASE*|*PASSWORD*)
      echo "error: ${secret_name} is set in the environment; put it in --env-file and unset it before launching" >&2
      exit 1
      ;;
  esac
done < <(compgen -e || true)
shopt -u nocasematch

# ── Build args (baked addresses unless the caller overrides) ──────────────────
ADDR_ARGS=()
# Explicit ifs: an empty baked value must append nothing (and must not read as a failure).
if [ -n "$SUPERPAYMASTER" ] && ! has_arg --superpaymaster "$@"; then
  ADDR_ARGS+=(--superpaymaster "$SUPERPAYMASTER")
fi
if [ -n "$PAYMASTER_V4" ] && ! has_arg --paymaster "$@"; then
  ADDR_ARGS+=(--paymaster "$PAYMASTER_V4")
fi

# ${ADDR_ARGS[@]+...}: macOS bash 3.2 treats an empty array as unbound under `set -u`.
# /usr/bin/env is absolute. A dry-run may still find node via PATH. It signs nothing.
# KEEPER_ETHUSD_URL and KEEPER_CAST_BIN stay in --env-file; they are not copied onto argv.
NODE="$(command -v node || true)"
if [ -z "$NODE" ]; then
  echo "error: node is not on PATH" >&2
  exit 1
fi
LOADER="${PWD}/node_modules/tsx/dist/loader.mjs"
if [ ! -f "$LOADER" ]; then
  echo "error: pinned tsx loader missing" >&2
  exit 1
fi
# Defaults only when the caller did not pass the flag. The parser keeps the first occurrence.
DEFAULT_ARGS=()
has_arg --poll-interval "$@" || DEFAULT_ARGS+=(--poll-interval "${KEEPER_POLL_INTERVAL:-180}")
has_arg --safety-margin "$@" || DEFAULT_ARGS+=(--safety-margin "${KEEPER_SAFETY_MARGIN:-600}")
has_arg --health-interval "$@" || DEFAULT_ARGS+=(--health-interval "${KEEPER_HEALTH_INTERVAL:-1800}")
has_arg --volatility-threshold-bps "$@" || DEFAULT_ARGS+=(--volatility-threshold-bps "${KEEPER_VOL_BPS:-150}")
has_arg --volatility-cooldown "$@" || DEFAULT_ARGS+=(--volatility-cooldown "${KEEPER_VOL_COOLDOWN:-600}")
echo "keeper: network=$NETWORK baked-args=${ADDR_ARGS[*]:-<none: canonical / caller>}"
exec /usr/bin/env -i PATH="${PATH:-/usr/bin:/bin}" HOME="${HOME:-}" "$NODE" --import "$LOADER" scripts/keeper.ts \
  --network "$NETWORK" \
  ${ADDR_ARGS[@]+"${ADDR_ARGS[@]}"} \
  ${DEFAULT_ARGS[@]+"${DEFAULT_ARGS[@]}"} \
  -- \
  "$@"
