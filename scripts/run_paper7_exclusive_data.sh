#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

NETWORK="anvil"
CYCLES="1"
OUT_DIR=""
KEEP_ANVIL="false"
SKIP_SIM="false"
SKIP_CREDIT="false"
SKIP_REPUTATION="false"
DEPLOY_IF_MISSING="true"

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --network) NETWORK="$2"; shift ;;
    --cycles) CYCLES="$2"; shift ;;
    --out-dir) OUT_DIR="$2"; shift ;;
    --keep-anvil) KEEP_ANVIL="true" ;;
    --skip-sim) SKIP_SIM="true" ;;
    --skip-credit) SKIP_CREDIT="true" ;;
    --skip-reputation) SKIP_REPUTATION="true" ;;
    --deploy-if-missing) DEPLOY_IF_MISSING="true" ;;
    --skip-deploy) DEPLOY_IF_MISSING="false" ;;
    *) echo "Unknown parameter: $1" >&2; exit 1 ;;
  esac
  shift
done

CMD=(pnpm exec tsx scripts/paper7-exclusive-data.ts --network "$NETWORK" --cycles "$CYCLES")
if [[ -n "$OUT_DIR" ]]; then CMD+=(--out-dir "$OUT_DIR"); fi
if [[ "$KEEP_ANVIL" == "true" ]]; then CMD+=(--keep-anvil); fi
if [[ "$SKIP_SIM" == "true" ]]; then CMD+=(--skip-sim); fi
if [[ "$SKIP_CREDIT" == "true" ]]; then CMD+=(--skip-credit); fi
if [[ "$SKIP_REPUTATION" == "true" ]]; then CMD+=(--skip-reputation); fi
if [[ "$DEPLOY_IF_MISSING" == "true" ]]; then CMD+=(--deploy-if-missing); else CMD+=(--skip-deploy); fi

"${CMD[@]}"
