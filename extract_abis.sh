#!/bin/bash
# extract_abis.sh
# Extract ABIs for main contracts from selected SuperPaymaster source directories into ./abis

set -euo pipefail

# Paths
SP_ROOT="../SuperPaymaster"
FOUNDRY_DIR="$SP_ROOT"
OUT_DIR="$FOUNDRY_DIR/out"
CACHE_DIR="$FOUNDRY_DIR/cache"
DEST_DIR="./packages/core/src/abis"

# Ensure destination exists
mkdir -p "$DEST_DIR"

echo "📂 Extracting ABIs from $OUT_DIR to $DEST_DIR..."

# Clean only JSON ABIs to ensure consistency while keeping index.ts and index.js
rm -rf "$DEST_DIR"/*.json

# Optimization: Forge build can be slow, but we need the latest artifacts.
# We explicitly list the core directories to build to speed up, 
# while skipping tests/scripts/legacy paymasters.
build_paths=(
  "contracts/src/core"
  "contracts/src/modules"
  "contracts/src/tokens"
  "contracts/src/paymasters/superpaymaster/v3"
  "contracts/src/paymasters/v4"
  "contracts/src/accounts"
  "contracts/src/accounts/v08"
  "lib/account-abstraction/contracts/accounts"
  "lib/account-abstraction/contracts/core"
)

echo "🧱 Building selected contracts in SuperPaymaster..."
(cd "$FOUNDRY_DIR" && forge build --force --skip test --skip script --skip paymasters/v2 --skip paymasters/v3 --skip PNTs.sol "${build_paths[@]}")
echo "✅ Build completed."

# Allowed prefixes for filtering final artifacts
allowed_sources_prefixes=(
  "contracts/src/core/"
  "contracts/src/modules/"
  "contracts/src/tokens/"
  "contracts/src/paymasters/superpaymaster/v3/"
  "contracts/src/paymasters/v4/"
  "contracts/src/accounts/"
  "contracts/src/accounts/v08/"
  "lib/account-abstraction/contracts/accounts/"
  "lib/account-abstraction/contracts/core/"
)

extracted=0
skipped=0

# Use find to locate all contract artifacts
while IFS= read -r json_file; do
  # Extract source info using jq
  # Note: jq might fail on empty files, so we use 2>/dev/null
  source_name="$(jq -r '.rawMetadata | fromjson | .settings.compilationTarget | keys[0] // empty' "$json_file" 2>/dev/null || true)"
  contract_name="$(jq -r '.rawMetadata | fromjson | .settings.compilationTarget | .[keys[0]] // empty' "$json_file" 2>/dev/null || true)"
  bytecode="$(jq -r '.bytecode.object // empty' "$json_file" 2>/dev/null || true)"

  # Skip if no compilation target or contract name
  if [ -z "$source_name" ] || [ -z "$contract_name" ]; then
    skipped=$((skipped + 1))
    continue
  fi

  # Skip tests and scripts
  if [[ "$source_name" == *".t.sol" ]] || [[ "$source_name" == *".s.sol" ]]; then
    skipped=$((skipped + 1))
    continue
  fi

  # Skip explicit exclusions (like legacy files)
  if [ "$source_name" = "contracts/src/tokens/PNTs.sol" ]; then
    skipped=$((skipped + 1))
    continue
  fi

  # Check if the source is in one of our allowed directories
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

  # Skip abstract contracts / interfaces (no bytecode)
  if [ -z "$bytecode" ] || [ "$bytecode" = "0x" ]; then
    skipped=$((skipped + 1))
    continue
  fi

  # Extract and save ABI
  # Normalize contract name: remove V3, V4, etc. suffixes for cleaner SDK imports
  file_name="$contract_name"
  file_name="${file_name%V3}"
  file_name="${file_name%V4}"
  file_name="${file_name%V4_1}"
  file_name="${file_name%V4_1i}"
  
  dest_file="$DEST_DIR/$file_name.json"
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

# Final Cleanup & Report
echo "🎉 Extraction complete!"
echo "   Extracted: $extracted, skipped: $skipped"
ls -lh "$DEST_DIR" | sed 's/^/   /'
