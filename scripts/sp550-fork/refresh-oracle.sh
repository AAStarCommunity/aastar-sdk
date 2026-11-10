#!/usr/bin/env bash
# FORK-ONLY: overwrite the forked Chainlink aggregator's latest-round timestamp with "now" (answer
# untouched), as SuperPaymaster's a2-full-rehearsal.sh refresh_oracle does.
set -euo pipefail
export PATH="$HOME/.foundry/bin:$PATH"; RPC=http://127.0.0.1:28546; PRICE_FEED=0x694AA1769357215DE4FAC081bf1f309aDC325306
agg=$(cast call $PRICE_FEED 'aggregator()(address)' --rpc-url $RPC)
read -r roundid answer started updated answered_in <<< "$(cast call "$agg" 'latestRoundData()(uint80,int256,uint256,uint256,uint80)' --rpc-url $RPC | sed 's/\[[^]]*\]//g' | tr '\n' ' ')"
nowts=$(cast block latest --field timestamp --rpc-url $RPC)
expect=$(python3 -c "print(int('$answer') + (int('$updated') << 192))")
for base in $(seq 0 80); do
  slot=$(cast keccak "0x$(printf '%064x' "$roundid")$(printf '%064x' "$base")")
  [ "$(python3 -c "print(int('$(cast storage "$agg" "$slot" --rpc-url $RPC)',16))")" = "$expect" ] && { found=$slot; break; }
done
cast rpc anvil_setStorageAt "$agg" "$found" "0x$(python3 -c "print(format(int('$answer') + ($nowts << 192), '064x'))")" --rpc-url $RPC >/dev/null
cast rpc evm_mine --rpc-url $RPC >/dev/null
echo "fork-only refresh_oracle: round $roundid updatedAt $updated -> $nowts"
