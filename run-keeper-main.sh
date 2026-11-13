#!/bin/bash
# Flag checks live in run-keeper.sh. This wrapper is dry-run only and refuses credential flags.
# A live run starts from the launchd plist. Do not export secret names.
set -euo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
has_arg() {
  local want="$1" a; shift
  for a in "$@"; do [ "$a" = "$want" ] && return 0; done
  return 1
}
if ! has_arg --dry-run "$@"; then
  echo "live runs must start from the plist with absolute ProgramArguments; see docs/guide/keeper.md" >&2
  exit 1
fi
EXTRA=()
has_arg --poll-interval "$@" || EXTRA+=(--poll-interval 180)
has_arg --safety-margin "$@" || EXTRA+=(--safety-margin 600)
has_arg --health-interval "$@" || EXTRA+=(--health-interval 1800)
has_arg --volatility-threshold-bps "$@" || EXTRA+=(--volatility-threshold-bps 150)
has_arg --volatility-cooldown "$@" || EXTRA+=(--volatility-cooldown 600)
exec /bin/bash ./run-keeper.sh op-mainnet "${EXTRA[@]}" "$@"
