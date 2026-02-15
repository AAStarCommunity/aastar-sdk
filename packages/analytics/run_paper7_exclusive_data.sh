#!/usr/bin/env bash
set -euo pipefail

AASTAR_SDK_DIR_DEFAULT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
AASTAR_SDK_DIR="${AASTAR_SDK_DIR:-$AASTAR_SDK_DIR_DEFAULT}"
NETWORK="${NETWORK:-anvil}"

OUT_DIR_DEFAULT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/data/paper7_exclusive/$(date -u +%Y%m%dT%H%M%SZ)"
OUT_DIR="${OUT_DIR:-$OUT_DIR_DEFAULT}"

RUN_CREDIT=1
RUN_REPUTATION=1
RUN_SIM=1
DEPLOY_IF_MISSING=0
DRY_RUN=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --out-dir) OUT_DIR="$2"; shift 2 ;;
    --sdk-dir) AASTAR_SDK_DIR="$2"; shift 2 ;;
    --network) NETWORK="$2"; shift 2 ;;
    --skip-credit) RUN_CREDIT=0; shift ;;
    --skip-reputation) RUN_REPUTATION=0; shift ;;
    --skip-sim) RUN_SIM=0; shift ;;
    --deploy-if-missing) DEPLOY_IF_MISSING=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

if [[ ! -d "$AASTAR_SDK_DIR" ]]; then
  echo "AASTAR_SDK_DIR not found: $AASTAR_SDK_DIR" >&2
  echo "Set AASTAR_SDK_DIR=/absolute/path/to/aastar-sdk or pass --sdk-dir" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"

ensure_deps() {
  if [[ ! -d "$AASTAR_SDK_DIR/node_modules" ]]; then
    echo "Missing node_modules in $AASTAR_SDK_DIR" >&2
    echo "Run: (cd \"$AASTAR_SDK_DIR\" && pnpm install)" >&2
    exit 1
  fi
}

ensure_anvil() {
  if [[ "$NETWORK" != "anvil" ]]; then
    return 0
  fi

  if curl -s -X POST -H "Content-Type: application/json" \
    --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
    http://127.0.0.1:8545 > /dev/null 2>&1; then
    return 0
  fi

  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "[dry-run] anvil not running; would start it on :8545"
    return 0
  fi

  if ! command -v anvil >/dev/null 2>&1; then
    echo "anvil not found in PATH. Install foundry and ensure anvil is available." >&2
    exit 1
  fi

  pkill anvil >/dev/null 2>&1 || true
  sleep 1
  anvil --port 8545 --chain-id 31337 > "$OUT_DIR/anvil.log" 2>&1 &
  ANVIL_PID=$!
  echo "$ANVIL_PID" > "$OUT_DIR/anvil.pid"
  sleep 3
}

export_env_from_sdk() {
  local env_file="$AASTAR_SDK_DIR/.env.$NETWORK"
  if [[ -f "$env_file" ]]; then
    set -a
    source "$env_file"
    set +a
  fi

  if [[ -z "${ADMIN_KEY:-}" && -n "${TEST_PRIVATE_KEY:-}" ]]; then
    export ADMIN_KEY="$TEST_PRIVATE_KEY"
  fi

  local cfg_file="$AASTAR_SDK_DIR/config.$NETWORK.json"
  local state_file="$AASTAR_SDK_DIR/scripts/l4-state.$NETWORK.json"

  if [[ ! -f "$cfg_file" ]]; then
    echo "Missing config file: $cfg_file" >&2
    exit 1
  fi
  if [[ ! -f "$state_file" ]]; then
    if [[ "$DRY_RUN" -eq 1 ]]; then
      echo "[dry-run] missing $state_file; would run l4-setup to generate it"
    else
      (cd "$AASTAR_SDK_DIR" && pnpm exec tsx scripts/l4-setup.ts --network "$NETWORK" | tee "$OUT_DIR/l4-setup.$NETWORK.log")
    fi
  fi

  eval "$(
    node --input-type=module - <<'NODE'
      import fs from "node:fs";
      const network = process.env.NETWORK || "anvil";
      const sdkDir = process.env.AASTAR_SDK_DIR;
      const cfg = JSON.parse(fs.readFileSync(`${sdkDir}/config.${network}.json`, "utf8"));
      const statePath = `${sdkDir}/scripts/l4-state.${network}.json`;
      const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, "utf8")) : null;
      const xpnts = state?.operators?.anni?.tokenAddress || state?.operators?.jason?.tokenAddress || "";
      const aliceAA = state?.aaAccounts?.[0]?.address || "";
      const lines = [];
      const set = (k, v) => { if (v) lines.push(`export ${k}=${JSON.stringify(v)}`); };
      set("REGISTRY_ADDR", cfg.registry);
      set("SUPER_PAYMASTER", cfg.superPaymaster);
      set("SUPER_PAYMASTER_ADDRESS", cfg.superPaymaster);
      set("REPUTATION_SYSTEM_ADDR", cfg.reputationSystem);
      set("GTOKEN_ADDR", cfg.gToken);
      set("STAKING_ADDR", cfg.staking);
      set("XPNTS_ADDR", xpnts);
      set("ALICE_AA_ACCOUNT", aliceAA);
      process.stdout.write(lines.join("\n"));
NODE
  )"
}

check_deployments() {
  local registry_addr="${REGISTRY_ADDR:-}"
  if [[ -z "$registry_addr" ]]; then
    echo "REGISTRY_ADDR not set; cannot check deployments" >&2
    exit 1
  fi

  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "[dry-run] would check eth_getCode for registry: $registry_addr"
    if [[ "$DEPLOY_IF_MISSING" -eq 1 ]]; then
      echo "[dry-run] if missing code, would deploy via: (cd \"$AASTAR_SDK_DIR\" && bash ./run_sdk_regression.sh --env $NETWORK --keep-anvil)"
    fi
    return 0
  fi

  local code
  code="$(
    curl -s -X POST -H "Content-Type: application/json" \
      --data "{\"jsonrpc\":\"2.0\",\"method\":\"eth_getCode\",\"params\":[\"$registry_addr\",\"latest\"],\"id\":1}" \
      "${RPC_URL:-http://127.0.0.1:8545}" | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{try{console.log(JSON.parse(d).result||"");}catch{process.exit(1);}})'
  )"
  if [[ "$code" == "0x" || -z "$code" ]]; then
    if [[ "$DEPLOY_IF_MISSING" -eq 1 ]]; then
      if [[ "$DRY_RUN" -eq 1 ]]; then
        echo "[dry-run] registry has no code; would run aastar-sdk/run_sdk_regression.sh --env anvil"
        return 0
      fi
      (cd "$AASTAR_SDK_DIR" && bash ./run_sdk_regression.sh --env anvil --keep-anvil | tee "$OUT_DIR/deploy.anvil.log")
    else
      echo "Registry contract not deployed at $registry_addr (eth_getCode=0x)" >&2
      echo "Run with --deploy-if-missing or deploy manually:" >&2
      echo "  (cd \"$AASTAR_SDK_DIR\" && bash ./run_sdk_regression.sh --env anvil --keep-anvil)" >&2
      exit 1
    fi
  fi
}

run_credit_loop() {
  if [[ "$RUN_CREDIT" -eq 0 ]]; then
    return 0
  fi
  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "[dry-run] would run credit loop: pnpm -C \"$AASTAR_SDK_DIR\" run test:credit"
    return 0
  fi
  (cd "$AASTAR_SDK_DIR" && pnpm run test:credit | tee "$OUT_DIR/credit_loop.log")
}

run_reputation_credit_link() {
  if [[ "$RUN_REPUTATION" -eq 0 ]]; then
    return 0
  fi
  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "[dry-run] would run reputation->credit: pnpm -C \"$AASTAR_SDK_DIR\" exec tsx scripts/06_local_test_v3_reputation.ts"
    return 0
  fi
  (cd "$AASTAR_SDK_DIR" && pnpm exec tsx scripts/06_local_test_v3_reputation.ts | tee "$OUT_DIR/reputation_credit_link.log")
}

run_liquidity_velocity_sim() {
  if [[ "$RUN_SIM" -eq 0 ]]; then
    return 0
  fi
  local out_csv="$OUT_DIR/liquidity_velocity_simulation.csv"
  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "[dry-run] would generate liquidity velocity csv: $out_csv"
    return 0
  fi

  python3 - <<'PY' > "$out_csv"
import csv

T = 60
steps = list(range(T + 1))

def simulate(mode):
    points = 100.0
    series = []
    for t in steps:
        activity = 1.0 + 0.015 * t
        minted = 4.0 * activity
        decay = 0.035 * points
        redeem = (0.11 if mode == "gas_redeemable" else 0.04) * points
        points = max(0.0, points + minted - decay - redeem)
        series.append(points)
    return series

with_gas = simulate("gas_redeemable")
baseline = simulate("baseline")

writer = csv.writer(open(0, "w", newline=""))
writer.writerow(["day", "points_gas_redeemable", "points_baseline"])
for t, a, b in zip(steps, with_gas, baseline):
    writer.writerow([t, f"{a:.6f}", f"{b:.6f}"])
PY
}

main() {
  ensure_deps
  export NETWORK
  export AASTAR_SDK_DIR
  ensure_anvil
  export_env_from_sdk
  check_deployments
  run_credit_loop
  run_reputation_credit_link
  run_liquidity_velocity_sim
  echo "OK: outputs in $OUT_DIR"
}

main
