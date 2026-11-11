#!/usr/bin/env bash
# SP 5.5.0 rc.8 A7: the SDK end-to-end run on a LOCAL anvil fork of Sepolia, as one command.
# Runbook: docs/sp550-cutover/A7-runbook.md.
#
# LOCAL FORK ONLY. Every write goes to http://127.0.0.1:28546; the fork source is only anvil's
# --fork-url. No real key: anvil --auto-impersonate signs, the user is anvil's public mnemonic
# index 3 (scripts/sp550-live-e2e.ts refuses anything else in mode fork).
#
# Usage:
#   run-a7.sh --load-state <dump> --expect-sha256 <hex> --readback <a7-readback.json> --anvil <binary> \
#             <sp checkout> <manifest pins.json> <operator> <fork block> <out dir>      (A7: SP's state)
#   run-a7.sh <sp checkout> <manifest pins.json> <operator> <fork block> <out dir>      (deploy here)
# The A7 run uses --load-state: SP runs the A7 execution once and exports it (anvil --dump-state);
# SDK and DVT load that same dump, so all three rehearse one deployment (DSR). The dump is refused
# before anvil starts unless its sha256 is --expect-sha256, and the anvil binary (--anvil; installed
# into its own FOUNDRY_DIR, never the shared ~/.foundry) must be the commit SP's A7 ran on
# (A7_ANVIL_COMMIT): stable 1.7.1 has no Amsterdam, 1.8.6 prices Amsterdam CREATE wrongly.
# Env:
#   SP550_FORK_URL       archive Sepolia RPC for anvil's --fork-url (publicnode prunes old state).
#                        Never logged: it usually embeds a provider key.
#   ULTRARELAY_DIR       UltraRelay-AAStar / Alto checkout for the local bundler.
#   SP550_A7_HARDFORK    --load-state only; default amsterdam (SP's A7 anvil).
#   SP550_A7_DEPLOY_CMD  deploy mode only: a command run inside the SP checkout with RPC_URL /
#                        ETH_RPC_URL set to the fork (a rehearsal of this script, not the A7 run).
#
# Stages, each failing the run before the next (logs under <out>/):
#   1 anvil: --load-state <dump> (sha256 checked first; test keys funded with anvil_setBalance,
#     the dump has none), or a plain fork + SP550_A7_DEPLOY_CMD          anvil.log, deploy.log
#   2 read-back, immediately after loading:
#     a. scripts/sp550-pin-fill.ts (preview): the gate on the manifest pins with the cutover book
#        switch — version(), every codehash, EXTENSION and ERC-1967 slots, SP wiring, aliases;  gate.log
#     b. --load-state: scripts/sp550-readback-compare.ts, SP's read-back file validated against the
#        frozen schema, then field by field against the pins and the SDK's own reads; header against the
#        dump / fork block / hardfork / anvil commit / SP commit; Amsterdam from the upstream; then the
#        amsterdamProbe (simulateV1 / eth_call on the upstream, receipt gasUsed on the fork);  readback.log
#   3 oracle timestamp refresh + bundler with the fork's clock          oracle.log, ultrarelay.log
#   4 SDK E2E (scripts/sp550-live-e2e.ts --fork-setup): the gate again, then account / ENDUSER /
#     xPNTs / renewalMode SP_K by impersonation, S1, then S3b until the SDK selects SP_RENEW;
#     every op held to C-30i / C-30j; the account must be brand-new and S1 (its first sponsored op,
#     the Amsterdam first-write state-gas case) must succeed                 e2e.log
# The last line of run.log is "A7 PASS" or "A7 FAIL at stage <n>".
set -euo pipefail
export PATH="$HOME/.foundry/bin:$PATH"
# The anvil build SP's A7 ran on (DSR, 2026-11-11): 1.8.7-nightly.
A7_ANVIL_COMMIT=4e8874b2bdc840929585ca73e170993c50a4a531
DUMP=""; EXPECT=""; READBACK=""; ANVIL=anvil
while [ $# -gt 0 ]; do case "$1" in
  --load-state) DUMP="${2:?--load-state <dump>}"; shift 2;;
  --expect-sha256) EXPECT="${2:?--expect-sha256 <hex>}"; shift 2;;
  --readback) READBACK="${2:?--readback <a7-readback.json>}"; shift 2;;
  --anvil) ANVIL="${2:?--anvil <binary>}"; shift 2;;
  --*) echo "unknown option $1" >&2; exit 2;;
  *) break;;
esac; done
abspath() { echo "$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"; }
SP_DIR="$(cd "${1:?sp checkout}" && pwd)"; PINS="$(abspath "${2:?manifest pins.json}")"
OPERATOR="${3:?operator address}"; FORK_BLOCK="${4:?fork block}"; OUT="${5:?out dir}"
: "${ULTRARELAY_DIR:?set ULTRARELAY_DIR to an UltraRelay-AAStar / Alto checkout}"
HARDFORK="${SP550_A7_HARDFORK:-amsterdam}"
# Caller-relative, like the pins: stage 2 runs from the SDK checkout.
[ -z "$DUMP" ] || DUMP="$(abspath "$DUMP")"; [ -z "$READBACK" ] || READBACK="$(abspath "$READBACK")"
if [ -n "$DUMP" ]; then
  [ -n "$EXPECT" ] || { echo "--load-state needs --expect-sha256 <hex>" >&2; exit 2; }
  [ -n "$READBACK" ] || { echo "--load-state needs --readback <a7-readback.json> (SP's read-back of the same state)" >&2; exit 2; }
  [ "$ANVIL" != anvil ] || { echo "--load-state needs --anvil <binary> (anvil $A7_ANVIL_COMMIT in its own FOUNDRY_DIR)" >&2; exit 2; }
  "$ANVIL" --version 2>/dev/null | grep -q "Commit SHA: $A7_ANVIL_COMMIT" \
    || { echo "refusing anvil $("$ANVIL" --version 2>&1 | tr '\n' ' '): the A7 state needs commit $A7_ANVIL_COMMIT" >&2; exit 2; }
  GOT=$(shasum -a 256 "$DUMP" | cut -c1-64)
  [ "$GOT" = "$(echo "${EXPECT#0x}" | tr 'A-F' 'a-f')" ] || { echo "refusing the dump: sha256 $GOT != --expect-sha256 $EXPECT" >&2; exit 2; }
else
  [ -z "$EXPECT$READBACK" ] || { echo "--expect-sha256 / --readback go with --load-state" >&2; exit 2; }
  : "${SP550_A7_DEPLOY_CMD:?deploy mode: set SP550_A7_DEPLOY_CMD (or use --load-state for the A7 run)}"
fi
FORK_URL="${SP550_FORK_URL:-https://ethereum-sepolia-rpc.publicnode.com}"
SDK="$(cd "$(dirname "$0")/../.." && pwd)"; RPC=http://127.0.0.1:28546; BUNDLER=http://127.0.0.1:3046
# Usage errors exit 2 before <out>/run.log is touched, so a refused start never wipes a previous run's log.
[[ "$OPERATOR" =~ ^0x[0-9a-fA-F]{40}$ ]] || { echo "operator must be an address" >&2; exit 2; }
[[ "$FORK_BLOCK" =~ ^[0-9]+$ ]] || { echo "fork block must be a number" >&2; exit 2; }
for port in 28546 3046; do ! lsof -iTCP:$port -sTCP:LISTEN >/dev/null 2>&1 || { echo "port $port is in use; stop the previous fork first" >&2; exit 2; }; done
mkdir -p "$OUT"; OUT="$(cd "$OUT" && pwd)"; LOG="$OUT/run.log"; : > "$LOG"
log() { echo "$*" | tee -a "$LOG"; }
STAGE=0
FAILED=0
fail() { FAILED=1; log "A7 FAIL at stage $STAGE: $*"; exit 1; }
# pid files left in a reused <out> name processes this run did not start (possibly reused pids):
# drop them before the trap, so cleanup only ever kills what this invocation wrote.
rm -f "$OUT/anvil.pid" "$OUT/ultrarelay.pid"
# Any exit under set -e (not only fail) still ends run.log with the stage it stopped at.
cleanup() {
  local rc=$?
  [ "$rc" = 0 ] || [ "$FAILED" = 1 ] || log "A7 FAIL at stage $STAGE: exited $rc (see the stage log)"
  for p in ultrarelay anvil; do [ -f "$OUT/$p.pid" ] && kill "$(cat "$OUT/$p.pid")" 2>/dev/null || true; done
}
trap cleanup EXIT
SP_COMMIT=$(git -C "$SP_DIR" rev-parse HEAD)
log "A7 run ($([ -n "$DUMP" ] && echo "load-state, dump sha256 $GOT" || echo deploy)): SP $(git -C "$SP_DIR" describe --tags --always 2>/dev/null) @ $SP_COMMIT · SDK $(git -C "$SDK" rev-parse HEAD) · fork block $FORK_BLOCK · pins sha256 $(shasum -a 256 "$PINS" | cut -c1-64)"
log "anvil: $("$ANVIL" --version | tr '\n' ' ')"
log "bundler: UltraRelay @ $(git -C "$ULTRARELAY_DIR" rev-parse HEAD 2>/dev/null || echo '(not a git checkout)') · package $(node -p "require('$ULTRARELAY_DIR/package.json').version" 2>/dev/null || echo '?')"

STAGE=1
if [ -n "$DUMP" ]; then
  "$ANVIL" --fork-url "$FORK_URL" --fork-block-number "$FORK_BLOCK" --chain-id 11155111 --hardfork "$HARDFORK" --load-state "$DUMP" \
        --port 28546 --auto-impersonate --silent > "$OUT/anvil.log" 2>&1 &
else
  # Deploy mode (a rehearsal of this script): the default anvil keeps its own hardfork; a pinned
  # --anvil runs the chain's real tier, so the bundler is exercised on Amsterdam blocks too.
  HF_ARG=(); [ "$ANVIL" = anvil ] || HF_ARG=(--hardfork "$HARDFORK")
  "$ANVIL" --fork-url "$FORK_URL" --fork-block-number "$FORK_BLOCK" --port 28546 --auto-impersonate --silent ${HF_ARG[@]+"${HF_ARG[@]}"} > "$OUT/anvil.log" 2>&1 &  # bash 3.2: empty array under set -u
fi
echo $! > "$OUT/anvil.pid"
for _ in $(seq 1 60); do cast block-number --rpc-url $RPC >/dev/null 2>&1 && break; sleep 1; done
[ "$(cast chain-id --rpc-url $RPC 2>/dev/null)" = 11155111 ] || fail "the fork is not Sepolia (chainId $(cast chain-id --rpc-url $RPC 2>&1))"
if [ -n "$DUMP" ]; then
  # The dump carries no funded accounts (SP's anvil runs --accounts 0): fund the bundler executors
  # and the user (mnemonic indexes 0-3, see ultrarelay.fork.json and userKey.anvilIndex).
  for i in 0 1 2 3; do
    cast rpc anvil_setBalance "$(cast wallet address --mnemonic "test test test test test test test test test test test junk" --mnemonic-index $i)" 0x56BC75E2D63100000 --rpc-url $RPC >/dev/null
  done
  log "stage 1 ok: loaded the dump on a fork of 11155111 at $FORK_BLOCK (hardfork $HARDFORK), head $(cast block-number --rpc-url $RPC); 100 ETH to test keys 0-3"
else
  (cd "$SP_DIR" && RPC_URL=$RPC ETH_RPC_URL=$RPC bash -c "$SP550_A7_DEPLOY_CMD") > "$OUT/deploy.log" 2>&1 || fail "deploy command exited $? (deploy.log)"
  log "stage 1 ok: fork of 11155111 at $FORK_BLOCK, deploy command done (deploy.log)"
fi

STAGE=2
(cd "$SDK" && pnpm exec tsx scripts/sp550-pin-fill.ts --network sepolia --manifest "$PINS" --rpc $RPC --block latest --allow-rc) > "$OUT/gate.log" 2>&1 \
  || fail "read-back gate on the manifest pins: $(grep -E '^❌' "$OUT/gate.log" | head -3 | tr '\n' ' ') (gate.log)"
log "stage 2a ok: $(grep -c '^✅' "$OUT/gate.log") gate checks on the manifest pins (gate.log)"
if [ -n "$DUMP" ]; then
  # SP550_FORK_URL (exported) is the upstream for the Amsterdam checks and the probe's live side; never logged.
  (cd "$SDK" && SP550_FORK_URL="$FORK_URL" pnpm exec tsx scripts/sp550-readback-compare.ts --network sepolia --readback "$READBACK" --pins "$PINS" --rpc $RPC --allow-rc \
      --fork-block "$FORK_BLOCK" --dump-sha256 "$GOT" --anvil-commit "$A7_ANVIL_COMMIT" --hardfork "$HARDFORK" --sp-commit "$SP_COMMIT" --probe) > "$OUT/readback.log" 2>&1 \
    || fail "SP's read-back does not match: $(grep -E '^❌' "$OUT/readback.log" | head -3 | tr '\n' ' ') (readback.log)"
  log "stage 2b ok: SP's read-back $(shasum -a 256 "$READBACK" | cut -c1-64) matches the pins and the SDK's reads (readback.log)"
fi

STAGE=3
"$SDK/scripts/sp550-fork/refresh-oracle.sh" > "$OUT/oracle.log" 2>&1 || fail "oracle refresh (oracle.log)"
cp "$SDK/docs/sp550-cutover/fork-rehearsal/ultrarelay.fork.json" "$OUT/ultrarelay.fork.json"
SP550_FORK_OUT="$OUT" "$SDK/scripts/sp550-fork/restart-bundler.sh" >> "$LOG" 2>&1 || fail "bundler (ultrarelay.log)"
log "stage 3 ok: oracle refreshed, bundler up"

STAGE=4
OWNER3=$(cast wallet address --mnemonic "test test test test test test test test test test test junk" --mnemonic-index 3)
FACTORY=$(cd "$SDK" && pnpm exec tsx -e "import { CANONICAL_ADDRESSES } from './packages/core/src/addresses.ts'; console.log(CANONICAL_ADDRESSES[11155111].simpleAccountFactory)")
ACCOUNT=$(cast call "$FACTORY" 'getAddress(address,uint256)(address)' "$OWNER3" 0 --rpc-url $RPC)
# The release tuple's postOp floor (rc.8: 500,000, DSR); deploy-mode rehearsals of older rcs set it to theirs.
MIN_POST_OP_GAS="${SP550_A7_MIN_POST_OP_GAS:-500000}"
jq -n --arg mpg "$MIN_POST_OP_GAS" --arg rpc $RPC --arg bundler $BUNDLER --arg pins "$PINS" --arg op "$OPERATOR" --arg acc "$ACCOUNT" --arg fac "$FACTORY" \
      --arg apnts "$(jq -r .aPNTsCapped "$PINS")" --arg xf "$(jq -r .xPNTsFactoryV2 "$PINS")" '{
    network: "sepolia", mode: "fork", rpcUrls: [$rpc], bundlerUrl: $bundler,
    gate: { pinsFile: $pins, block: "latest", allowRc: true, bookOverrides: { aPNTs: $apnts, xPNTsFactory: $xf } },
    operator: $op, account: $acc, userKey: { anvilIndex: 3 }, maxOps: 8,
    forkSetup: { simpleAccountFactory: $fac, salt: 0 }, requireFreshAccount: true, expectMinPostOpGas: $mpg }' > "$OUT/e2e.json"
set +e
(cd "$SDK" && pnpm exec tsx scripts/sp550-live-e2e.ts --config "$OUT/e2e.json" --fork-setup) 2>&1 | tee "$OUT/e2e.log"
rc=${PIPESTATUS[0]}
set -e
[ "$rc" = 0 ] || fail "E2E exited $rc (e2e.log)"
grep -q '^PASS' "$OUT/e2e.log" || fail "E2E exited 0 without a PASS line (e2e.log)"
log "stage 4 ok: $(grep -c '^RESULT' "$OUT/e2e.log") RESULT lines (e2e.log)"
log "A7 PASS"
