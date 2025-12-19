#!/bin/bash
# extract_abis.sh
# Extract ABIs for main contracts from selected SuperPaymaster source directories into ./abis

set -euo pipefail

# Paths
SP_ROOT="../SuperPaymaster"
FOUNDRY_DIR="$SP_ROOT"
OUT_DIR="$FOUNDRY_DIR/out"
CACHE_DIR="$FOUNDRY_DIR/cache"
DEST_DIR="./abis"

# Ensure destination exists
mkdir -p "$DEST_DIR"

echo "📂 Extracting ABIs from $OUT_DIR to $DEST_DIR..."

rm -rf "$DEST_DIR"
mkdir -p "$DEST_DIR"

rm -rf "$OUT_DIR" "$CACHE_DIR"

build_paths=(
  "contracts/src/core"
  "contracts/src/modules"
  "contracts/src/tokens"
  "contracts/src/paymasters/superpaymaster/v3"
  "contracts/src/paymasters/v4"
)

echo "🧱 Building selected contracts..."
(cd "$FOUNDRY_DIR" && forge build --force --skip test --skip script --skip paymasters/v2 --skip paymasters/v3 --skip PNTs.sol "${build_paths[@]}" >/dev/null)
echo "✅ Build completed."

allowed_sources_prefixes=(
  "contracts/src/core/"
  "contracts/src/modules/"
  "contracts/src/tokens/"
  "contracts/src/paymasters/superpaymaster/v3/"
  "contracts/src/paymasters/v4/"
)

extracted=0
skipped=0

while IFS= read -r json_file; do
  source_name="$(jq -r '.rawMetadata | fromjson | .settings.compilationTarget | keys[0] // empty' "$json_file" 2>/dev/null || true)"
  contract_name="$(jq -r '.rawMetadata | fromjson | .settings.compilationTarget | .[keys[0]] // empty' "$json_file" 2>/dev/null || true)"
  bytecode="$(jq -r '.bytecode.object // empty' "$json_file" 2>/dev/null || true)"

  if [ -z "$source_name" ] || [ -z "$contract_name" ]; then
    skipped=$((skipped + 1))
    continue
  fi

  if [[ "$source_name" == *".t.sol" ]] || [[ "$source_name" == *".s.sol" ]]; then
    skipped=$((skipped + 1))
    continue
  fi

  if [ "$source_name" = "contracts/src/tokens/PNTs.sol" ]; then
    skipped=$((skipped + 1))
    continue
  fi

  allowed=false
  for prefix in "${allowed_sources_prefixes[@]}"; do
    if [[ "$source_name" == "$prefix"* ]]; then
      allowed=true
      break
    fi
  done
  if ! $allowed; then
    skipped=$((skipped + 1))
    continue
  fi

  if [ -z "$bytecode" ] || [ "$bytecode" = "0x" ]; then
    skipped=$((skipped + 1))
    continue
  fi

  dest_file="$DEST_DIR/$contract_name.abi.json"
  if jq -e '.abi' "$json_file" >/dev/null 2>&1; then
    jq '.abi' "$json_file" > "$dest_file"
    if [ -s "$dest_file" ] && jq -e 'type=="array"' "$dest_file" >/dev/null 2>&1; then
      extracted=$((extracted + 1))
    else
      rm -f "$dest_file"
      skipped=$((skipped + 1))
    fi
  else
    skipped=$((skipped + 1))
  fi
done < <(find "$OUT_DIR" -type f -name "*.json" -not -name "*.dbg.json" -not -path "*/build-info/*" | sort)

# Cleanup zero-byte files
find "$DEST_DIR" -type f -size 0 -print -delete | sed 's/^/🧹 Removed empty: /' || true

echo "🎉 Extraction complete!"
echo "   Extracted: $extracted, skipped: $skipped"
ls -lh "$DEST_DIR" | sed 's/^/   /'
