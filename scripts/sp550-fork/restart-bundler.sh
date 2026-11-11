#!/usr/bin/env bash
# FORK-ONLY: restart the local bundler with its clock shifted to the fork's chain time.
set -euo pipefail
export PATH="$HOME/.foundry/bin:$PATH"; S="$(cd "$(dirname "$0")" && pwd)"; OUT="${SP550_FORK_OUT:?set SP550_FORK_OUT to the setup out dir}"; R=http://127.0.0.1:28546
kill "$(cat "$OUT/ultrarelay.pid" 2>/dev/null)" 2>/dev/null || true; sleep 2
cast rpc evm_mine --rpc-url $R >/dev/null
SHIFT=$(( ($(cast block latest --field timestamp --rpc-url $R) - $(date +%s)) * 1000 ))
cd "${ULTRARELAY_DIR:?set ULTRARELAY_DIR to an UltraRelay-AAStar / Alto checkout}"
TIME_SHIFT_MS=$SHIFT nohup node -r "$S/time-shift.cjs" src/esm/cli/alto.js run --config "$OUT/ultrarelay.fork.json" >> "$OUT/ultrarelay.log" 2>&1 &
echo $! > "$OUT/ultrarelay.pid"
for _ in $(seq 1 30); do curl -sf -X POST localhost:3046 -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' >/dev/null && break; sleep 1; done
echo "fork-only: bundler restarted, clock shift ${SHIFT}ms"
