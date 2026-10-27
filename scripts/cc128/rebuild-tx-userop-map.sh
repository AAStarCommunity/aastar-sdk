#!/usr/bin/env bash
# CC-128 / AOA M3.6 — rebuild the tx -> UserOperation map for the two historical analytics CSVs.
#
# Read-only: only eth_getTransactionReceipt / eth_getTransactionByHash / eth_call against Sepolia.
# Never signs or broadcasts anything. The input CSVs are not modified.
#
# Usage:  SEPOLIA_RPC=<archive-capable Sepolia RPC> scripts/cc128/rebuild-tx-userop-map.sh [out_dir]
# Output: out_dir/{tx_userop_map.csv, tx_submitter.csv, pm_version_at_block.csv}
#         (default out_dir = docs/aoa/cc128)
set -euo pipefail

: "${SEPOLIA_RPC:?set SEPOLIA_RPC to a Sepolia JSON-RPC endpoint (archive access needed for eth_call at old blocks)}"
OUT="${1:-docs/aoa/cc128}"
DATA="packages/analytics/data"
UOE_TOPIC="0x49628fd1471006c1482da88028e9ce4dbb080b815c9b0344d39e5a8e6ec1419f" # UserOperationEvent (EntryPoint v0.7)
VERSION_SELECTOR="0x54fd4d50"                                                  # version()
mkdir -p "$OUT"

rpc() { # method, params-json
  curl -sS --fail -X POST -H 'content-type: application/json' \
    --data "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"$1\",\"params\":$2}" "$SEPOLIA_RPC"
}

chain_id=$(rpc eth_chainId '[]' | jq -r .result)
[ "$chain_id" = "0xaa36a7" ] || { echo "expected Sepolia (0xaa36a7), RPC reports $chain_id" >&2; exit 1; }

# Both CSVs must name the same tx set; otherwise the map would silently describe only one of them.
txs=$(mktemp)
tail -n +2 "$DATA/complete_dataset.csv" | cut -d, -f1 | sort -u > "$txs"
if ! diff -q "$txs" <(tail -n +2 "$DATA/attribution_dataset.csv" | cut -d, -f1 | sort -u) > /dev/null; then
  echo "complete_dataset and attribution_dataset name different tx sets" >&2; exit 1
fi
[ -s "$txs" ] || { echo "zero tx hashes read — refusing to emit an empty map" >&2; exit 1; }

map="$OUT/tx_userop_map.csv"
echo "txHash,chainId,blockNumber,txStatus,entryPoint,txGasUsed,nUOE,userOpHash,sender,paymaster,uoNonce,uoSuccess,actualGasCost,actualGasUsed" > "$map"
sub="$OUT/tx_submitter.csv"
echo "txHash,from,txGasLimit,selector" > "$sub"
while read -r tx; do
  rpc eth_getTransactionReceipt "[\"$tx\"]" | jq -r --arg uoe "$UOE_TOPIC" '
    .result as $x | ($x.logs | map(select(.topics[0] == $uoe))) as $u
    | if ($u | length) == 0 then error("no UserOperationEvent in " + $x.transactionHash) else . end
    | $u[] | [$x.transactionHash, "11155111", $x.blockNumber, $x.status, $x.to, $x.gasUsed, ($u | length | tostring),
              .topics[1], ("0x" + .topics[2][26:]), ("0x" + .topics[3][26:]),
              ("0x" + .data[2:66]), ("0x" + .data[66:130]), ("0x" + .data[130:194]), ("0x" + .data[194:258])] | join(",")'
  rpc eth_getTransactionByHash "[\"$tx\"]" | jq -r '[.result.hash, .result.from, .result.gas, .result.input[0:10]] | join(",")' >> "$sub.tmp"
done < "$txs" | python3 -I -c '
import sys
for line in sys.stdin:
    r = line.strip().split(",")
    for i in (2, 5, 10, 11, 12, 13):  # hex quantities -> decimal
        r[i] = str(int(r[i], 16))
    print(",".join(r))
' >> "$map"
python3 -I -c '
import sys
for line in open(sys.argv[1]):
    r = line.strip().split(",")
    r[2] = str(int(r[2], 16))
    print(",".join(r))
' "$sub.tmp" >> "$sub"
rm -f "$sub.tmp" "$txs"

# Paymaster self-reported version AT THE BLOCK of each op (proxies can change implementation later).
ver="$OUT/pm_version_at_block.csv"
echo "txHash,blockNumber,paymaster,versionAtBlock" > "$ver"
tail -n +2 "$map" | while IFS=, read -r tx _ block _ _ _ _ _ _ pm _; do
  hex=$(rpc eth_call "[{\"to\":\"$pm\",\"data\":\"$VERSION_SELECTOR\"},\"$(printf '0x%x' "$block")\"]" | jq -r '.result')
  v=$(python3 -I -c 'import sys; h=sys.argv[1][2:]; print(bytes.fromhex(h[128:128+2*int(h[64:128],16)]).decode())' "$hex")
  echo "$tx,$block,$pm,$v"
done >> "$ver"

shasum -a 256 "$DATA/complete_dataset.csv" "$DATA/attribution_dataset.csv" "$map" "$sub" "$ver"
