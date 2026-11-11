#!/usr/bin/env bash
# SP 5.5.0 rc.4 on a LOCAL anvil fork of Sepolia — setup for the SDK fork E2E (DSR item 2).
#
# LOCAL FORK ONLY. Every write goes to http://127.0.0.1:$PORT. The public node is used only as
# anvil's --fork-url. No real key is used: anvil --auto-impersonate signs for any sender.
# Fork-only shortcuts (labelled in the output): impersonating the SP owner / operators / the
# APNTsCapped minter, and overwriting the Chainlink aggregator's latest-round timestamp after the
# time warp (same technique as SuperPaymaster script/evidence/a2-full-rehearsal.sh refresh_oracle).
#
# Usage: setup-fork.sh <sp checkout at fbd74fb1> <out dir> [fork block]
set -euo pipefail
SPW="$1"; OUT="$2"; FORK_BLOCK="${3:-12090052}"
export PATH="$HOME/.foundry/bin:$PATH"
PORT=28546; RPC="http://127.0.0.1:$PORT"
# Fork source. The public node prunes old state and anvil reads untouched slots lazily, so a long
# run can fail mid-op with "pruned history unavailable"; point SP550_FORK_URL at an archive node.
# Never logged: it usually embeds a provider key.
FORK_URL="${SP550_FORK_URL:-https://ethereum-sepolia-rpc.publicnode.com}"
mkdir -p "$OUT" "$SPW/cache/sdk-fork"; OUT="$(cd "$OUT" && pwd)"; rm -f "$SPW/cache/sdk-fork/config.sepolia-fork.json"
LOG="$OUT/setup.log"; : > "$LOG"
log() { echo "$*" | tee -a "$LOG"; }
check() { if [ "$2" = "$3" ]; then log "CHECK ok   $1 = $2"; else log "CHECK FAIL $1: got '$2' want '$3'"; exit 1; fi; }

SP=0x09DF0d2e3722EC0e401fE3819E64278a42ae4DE9
OWNER=0xb5600060e6de5E11D3636731964218E53caadf0E   # SP owner = AAStar community + operator
ANNI=0xEcAACb915f7D92e9916f449F7ad42BD0408733c9    # Mycelium operator
NEW_APNTS=0x9Eb17FAc022557F64924aA2F9E018dB3A330e1E7  # APNTsCapped-1.0.0 (pendingAPNTsToken, queued by S7)
MINTER=0x16dF788ed4ed1Fc384e52dC832A6a6C3A23bdEBf    # APNTsCapped.minter()
PRICE_FEED=0x694AA1769357215DE4FAC081bf1f309aDC325306

anvil --fork-url "$FORK_URL" --fork-block-number "$FORK_BLOCK" --port "$PORT" --auto-impersonate --silent > "$OUT/anvil.log" 2>&1 &
echo $! > "$OUT/anvil.pid"
for _ in $(seq 1 60); do cast block-number --rpc-url "$RPC" >/dev/null 2>&1 && break; sleep 1; done
log "anvil pid $(cat "$OUT/anvil.pid") fork block $FORK_BLOCK chain $(cast chain-id --rpc-url "$RPC")"
check "pre SP.version()" "$(cast call $SP 'version()(string)' --rpc-url $RPC)" '"SuperPaymaster-5.4.2"'
check "pre SP.pendingAPNTsToken()" "$(cast call $SP 'pendingAPNTsToken()(address)' --rpc-url $RPC)" "$NEW_APNTS"

for a in $OWNER $ANNI $MINTER; do cast rpc anvil_setBalance $a 0x56BC75E2D63100000 --rpc-url $RPC >/dev/null; done
log "fork-only: 100 ETH to OWNER / ANNI / MINTER (gas for impersonated senders)"

# --- warp past the APNTs timelock ETA, then refresh the oracle timestamp (fork-only) ---
ETA=$(cast call $SP 'pendingAPNTsTokenEta()(uint256)' --rpc-url $RPC | awk '{print $1}')
NOW=$(cast block latest --field timestamp --rpc-url $RPC)
DELTA=$(( ETA - NOW + 120 )); [ $DELTA -gt 0 ] || DELTA=1
cast rpc evm_increaseTime $DELTA --rpc-url $RPC >/dev/null; cast rpc evm_mine --rpc-url $RPC >/dev/null
log "warp +$DELTA s past pendingAPNTsTokenEta $ETA"

refresh_oracle() {
  local agg roundid answer started updated answered_in nowts expect slot val found=""
  agg=$(cast call $PRICE_FEED 'aggregator()(address)' --rpc-url $RPC)
  read -r roundid answer started updated answered_in <<< "$(cast call "$agg" 'latestRoundData()(uint80,int256,uint256,uint256,uint80)' --rpc-url $RPC | sed 's/\[[^]]*\]//g' | tr '\n' ' ')"
  nowts=$(cast block latest --field timestamp --rpc-url $RPC)
  expect=$(python3 -c "print(int('$answer') + (int('$updated') << 192))")
  for base in $(seq 0 80); do
    slot=$(cast keccak "0x$(printf '%064x' "$roundid")$(printf '%064x' "$base")")
    val=$(cast storage "$agg" "$slot" --rpc-url $RPC 2>/dev/null)
    [ "$(python3 -c "print(int('$val',16))" 2>/dev/null)" = "$expect" ] && { found=$slot; break; }
  done
  [ -n "$found" ] || { log "refresh_oracle: latest round slot not found"; exit 1; }
  cast rpc anvil_setStorageAt "$agg" "$found" "0x$(python3 -c "print(format(int('$answer') + ($nowts << 192), '064x'))")" --rpc-url $RPC >/dev/null
  cast rpc evm_mine --rpc-url $RPC >/dev/null
  log "fork-only refresh_oracle: aggregator $agg round $roundid updatedAt $updated -> $nowts (answer unchanged $answer)"
}
refresh_oracle

# --- fund the NEW aPNTs (fork-only: impersonated minter) so step 1(4)/(6) can run ---
op_bal() { cast call $SP 'operators(address)(uint128,bool,bool,address,uint32,uint48,address,uint256,uint256)' $1 --rpc-url $RPC | head -1 | awk '{print $1}'; }
B_OWNER=$(op_bal $OWNER); B_ANNI=$(op_bal $ANNI)
REV=$(cast call $SP 'protocolRevenue()(uint256)' --rpc-url $RPC | awk '{print $1}')
log "snapshot aPNTsBalance OWNER=$B_OWNER ANNI=$B_ANNI protocolRevenue=$REV totalTracked=$(cast call $SP 'totalTrackedBalance()(uint256)' --rpc-url $RPC | awk '{print $1}')"
for pair in "$OWNER:$B_OWNER" "$ANNI:$B_ANNI" "$SP:$REV"; do
  to=${pair%%:*}; amt=${pair##*:}; [ "$amt" = "0" ] && continue
  cast send $NEW_APNTS 'mint(address,uint256)' $to $amt --from $MINTER --unlocked --rpc-url $RPC >/dev/null
done
log "fork-only: minted new aPNTs to OWNER/ANNI (= snapshot) and SP (= protocolRevenue) from the impersonated minter"

run_step() { # <label> <sig> [args...] — forge script as OWNER unless SENDER is set
  local label="$1" sig="$2"; shift 2
  log "== forge $label"
  (cd "$SPW" && ENV=sepolia V55_OUT_CONFIG="cache/sdk-fork/config.sepolia-fork.json" forge script contracts/script/v3/UpgradeToV5_5_0.s.sol:UpgradeToV5_5_0 \
     --sig "$sig" "$@" --rpc-url $RPC --unlocked --sender "${SENDER:-$OWNER}" --broadcast --slow) >> "$OUT/forge-$label.log" 2>&1 \
     || { log "forge $label FAILED (see forge-$label.log)"; tail -30 "$OUT/forge-$label.log"; exit 1; }
  grep -E "step|CHECK|read-back|V55" "$OUT/forge-$label.log" | grep -v "^ *$" | tail -12 >> "$LOG" || true
}

V55_APNTS_DECISION=execute run_step step1-execute 'executePendingAPNTs(address[])' "[$OWNER,$ANNI]"
check "SP.APNTS_TOKEN() after step 1" "$(cast call $SP 'APNTS_TOKEN()(address)' --rpc-url $RPC)" "$NEW_APNTS"
run_step step3-pause 'pauseOperators(address[])' "[$OWNER,$ANNI]"
V55_OPERATORS="$OWNER,$ANNI" run_step step4-6-run 'run()'
check "SP.version() after run()" "$(cast call $SP 'version()(string)' --rpc-url $RPC)" '"SuperPaymaster-5.5.0"'
run_step step5b-stake 'ensureStake()'
refresh_oracle
run_step step7a-issue 'issueCommunityToken(string,string,string,string,uint256)' "AAStar PNTs v2" "aPNTsV2" "AAStar" "aastar.eth" 1000000000000000000
V2=$(python3 -c "import json;print(json.load(open('$SPW/cache/sdk-fork/config.sepolia-fork.json'))['xPNTsV2Tokens']['$OWNER'])")
log "AAStar v2 token $V2"
run_step step7c1-configure 'configureOperatorV2(address,address)' $V2 $OWNER
run_step step7c2-unpause 'unpauseOperator(address)' $OWNER
check "AAStar operator paused after 7c" "$(cast call $SP 'operators(address)(uint128,bool,bool,address,uint32,uint48,address,uint256,uint256)' $OWNER --rpc-url $RPC | sed -n 3p)" "false"
cp "$SPW/cache/sdk-fork/config.sepolia-fork.json" "$OUT/config.sepolia-fork.json"
log "SETUP OK — fork block $FORK_BLOCK, head $(cast block-number --rpc-url $RPC); config -> $OUT/config.sepolia-fork.json"
