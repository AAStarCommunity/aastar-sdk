#!/usr/bin/env bash
# Paper3 v7.9 — Alchemy Gas Manager Controlled Baseline Orchestrator
#
# Runs the full 3-step pipeline:
#   1) Send n=22 gasless USDC transfers via Alchemy Gas Manager (active submission)
#   2) Reverse-extract actualGasUsed from on-chain UserOperationEvent (match paper metric)
#   3) Append to gasless_data_collection.csv for stat_analysis.ts
#
# Assumes cast wallet is configured; DEPLOYER_ACCOUNT is 'optimism-deployer' by default.
#
# Usage:
#   bash scripts/run_alchemy_controlled.sh
#   bash scripts/run_alchemy_controlled.sh --dry-run           # check config only
#   bash scripts/run_alchemy_controlled.sh --n 10              # smaller sample
#   bash scripts/run_alchemy_controlled.sh --skip-send         # already sent; just reverse-extract
#   bash scripts/run_alchemy_controlled.sh --skip-extract      # send only; extract later

set -e

# ----------- Defaults -----------
N=22
OUT_DATE=$(date +%Y-%m-%d)
OUT_DIR="packages/analytics/data/paper_gas_op_mainnet/${OUT_DATE}"
OUT_CSV="${OUT_DIR}/alchemy_controlled_simple_erc20.csv"
OUT_CSV_ACTUALGAS="${OUT_DIR}/alchemy_controlled_actualgas.csv"

DRY_RUN=false
SKIP_SEND=false
SKIP_EXTRACT=false
IGNORE_GAS_PRICE=false
N_FLAG=""

# ----------- Arg parsing -----------
while [[ $# -gt 0 ]]; do
    case "$1" in
        --dry-run) DRY_RUN=true; shift ;;
        --n) N="$2"; N_FLAG="--n $2"; shift 2 ;;
        --skip-send) SKIP_SEND=true; shift ;;
        --skip-extract) SKIP_EXTRACT=true; shift ;;
        --ignore-gas-price) IGNORE_GAS_PRICE=true; shift ;;
        --out-csv) OUT_CSV="$2"; shift 2 ;;
        -h|--help)
            echo "Usage: bash scripts/run_alchemy_controlled.sh [options]"
            echo "  --dry-run             Validate Alchemy API connectivity; no on-chain submit"
            echo "  --n N                 Number of runs (default: 22)"
            echo "  --skip-send           Skip send step (go straight to extract)"
            echo "  --skip-extract        Skip reverse-extraction step"
            echo "  --ignore-gas-price    Bypass OP Mainnet gas-price guard"
            echo "  --out-csv PATH        Custom output CSV path"
            exit 0 ;;
        *) echo "Unknown arg: $1"; exit 1 ;;
    esac
done

N_FLAG="${N_FLAG:---n ${N}}"
EXTRA_FLAGS=""
$DRY_RUN && EXTRA_FLAGS="$EXTRA_FLAGS --dry-run true"
$IGNORE_GAS_PRICE && EXTRA_FLAGS="$EXTRA_FLAGS --ignore-gas-price true"

# ----------- Env check -----------
if [ ! -f .env.op-mainnet.controlled ] && [ ! -f .env.op-mainnet ]; then
    echo "🔴 No .env.op-mainnet.controlled or .env.op-mainnet found."
    echo "   Copy env.op-mainnet.controlled.example to .env.op-mainnet.controlled and fill in:"
    echo "     - ALCHEMY_RPC_URL_OP"
    echo "     - ALCHEMY_PAYMASTER_POLICY_ID"
    echo "     - JASON_AA"
    exit 1
fi

mkdir -p "$OUT_DIR"

echo "======================================================================"
echo "  Paper3 v7.9 — Alchemy Controlled Baseline Pipeline"
echo "======================================================================"
echo "  Sample size:  ${N}"
echo "  Output dir:   ${OUT_DIR}"
echo "  CSV (sent):   ${OUT_CSV}"
echo "  CSV (extract):${OUT_CSV_ACTUALGAS}"
echo "  Dry run:      ${DRY_RUN}"
echo "  Skip send:    ${SKIP_SEND}"
echo "  Skip extract: ${SKIP_EXTRACT}"
echo "======================================================================"

# ----------- Step 1: Active submission -----------
if ! $SKIP_SEND; then
    echo ""
    echo "▶ Step 1/3: Send ${N} UserOps via Alchemy Gas Manager..."
    echo "  (You will be prompted once for cast wallet password)"
    pnpm tsx scripts/l4-alchemy-controlled-op-mainnet.ts \
        ${N_FLAG} \
        --out "${OUT_CSV}" \
        ${EXTRA_FLAGS}
    echo ""
    echo "  ✓ Step 1 complete. CSV saved to: ${OUT_CSV}"
fi

if $DRY_RUN; then
    echo ""
    echo "🔬 Dry run complete. Exiting before reverse-extract."
    exit 0
fi

# ----------- Step 2: Reverse-extract actualGasUsed -----------
if ! $SKIP_EXTRACT; then
    if [ ! -f "${OUT_CSV}" ]; then
        echo "🔴 Cannot reverse-extract: ${OUT_CSV} not found."
        echo "   Run send step first or use --skip-extract."
        exit 1
    fi

    # Load env for RPC URL
    set -a
    [ -f .env.op-mainnet.controlled ] && source .env.op-mainnet.controlled
    [ -f .env.op-mainnet ] && source .env.op-mainnet
    set +a

    RPC="${OPT_MAINNET_RPC:-${ALCHEMY_RPC_URL_OP:-https://mainnet.optimism.io}}"

    # Detect paymaster address from the log file (last "paymaster=" line)
    LOG="${OUT_CSV%.csv}.log"
    PM_FROM_LOG=""
    if [ -f "$LOG" ]; then
        PM_FROM_LOG=$(grep -oE 'paymaster=0x[a-fA-F0-9]{40}' "$LOG" | tail -1 | cut -d= -f2)
    fi
    PM="${ALCHEMY_PAYMASTER_ADDR:-${PM_FROM_LOG:-0x2cc0c7981D846b9F2a16276556f6e8cb52BfB633}}"

    echo ""
    echo "▶ Step 2/3: Reverse-extract actualGasUsed from UserOperationEvent..."
    echo "  RPC:       ${RPC}"
    echo "  Paymaster: ${PM} (from log / env / default)"
    pnpm tsx packages/analytics/scripts/collect_paymaster_baselines.ts \
        --network op-mainnet \
        --rpc-url "${RPC}" \
        --entrypoint 0x0000000071727De22E5E9d8BAf0edAc6f37da032 \
        --paymaster "${PM}" \
        --paymaster-name AlchemyGasManagerV07 \
        --label B1_ALCHEMY_CONTROLLED \
        --chain optimism \
        --tx-hashes-csv "${OUT_CSV}" \
        --strict-transfer true \
        --single-userop true \
        --out "${OUT_CSV_ACTUALGAS}"

    echo ""
    echo "  ✓ Step 2 complete. actualGasUsed CSV: ${OUT_CSV_ACTUALGAS}"
fi

# ----------- Step 3: Summary -----------
echo ""
echo "======================================================================"
echo "  Pipeline complete."
echo "======================================================================"
if [ -f "${OUT_CSV}" ]; then
    N_SUBMITTED=$(($(wc -l < "${OUT_CSV}") - 1))
    echo "  Submitted runs (from receipts): ${N_SUBMITTED}"
fi
if [ -f "${OUT_CSV_ACTUALGAS}" ]; then
    N_EXTRACTED=$(($(wc -l < "${OUT_CSV_ACTUALGAS}") - 1))
    echo "  Reverse-extracted runs:         ${N_EXTRACTED}"
fi

echo ""
echo "  Next: merge into gasless_data_collection.csv and run stat_analysis.ts"
echo "    cat ${OUT_CSV_ACTUALGAS} | tail -n +2 >> packages/analytics/data/gasless_data_collection.csv"
echo "    pnpm tsx packages/analytics/scripts/stat_analysis.ts"
echo ""
