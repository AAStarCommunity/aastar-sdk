#!/bin/bash
# Auto-extract documentation from SDK repo to docs repo

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}📚 Extracting documentation from SDK repo...${NC}"

# Paths — resolved relative to this script so the sync works regardless of
# where the repos are checked out. Both can be overridden via env vars:
#   SDK_REPO=... DOCS_REPO=... bash scripts/extract-docs.sh
# By default SDK_REPO is this repo's root and DOCS_REPO is a sibling
# "aastar-docs" directory next to it.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SDK_REPO="${SDK_REPO:-$(cd "$SCRIPT_DIR/.." && pwd)}"
DOCS_REPO="${DOCS_REPO:-$(cd "$SDK_REPO/.." && pwd)/aastar-docs}"

if [ ! -d "$DOCS_REPO" ]; then
    echo "❌ DOCS_REPO not found: $DOCS_REPO"
    echo "   Set DOCS_REPO=/path/to/aastar-docs and re-run."
    exit 1
fi

# Ensure directories exist in docs repo
mkdir -p "$DOCS_REPO/api"
mkdir -p "$DOCS_REPO/guide"
mkdir -p "$DOCS_REPO/examples"

# 1. Sync Guide folder (Maintain same structure)
#
# NOTE: guide/ in the docs repo is a MIX of SDK-synced pages (the flat *.md
# from SDK docs/guide) and docs-repo-owned subtrees that this script must
# NEVER delete: guide/concepts/, guide/use-cases/, guide/deployments/.
# Because of that mix we do not blanket --delete guide/; we only hard-reset
# the subtrees that are 100% SDK-generated (guide/docs/ below).
echo -e "${YELLOW}📋 Syncing Guide folder and plans...${NC}"
# Sync EN Guide (Root) — overwrite SDK-sourced flat pages in place.
if [ -d "$SDK_REPO/docs/guide" ]; then
    cp -r "$SDK_REPO/docs/guide/"* "$DOCS_REPO/guide/" 2>/dev/null || true
fi
# Sync root markdown files in docs/ to guide/docs/ for external access.
# guide/docs/ is 100% SDK-generated, so clear it first to drop files removed
# upstream (prevents stale pages accumulating across versions).
rm -rf "$DOCS_REPO/guide/docs"
mkdir -p "$DOCS_REPO/guide/docs"
find "$SDK_REPO/docs/" -maxdepth 1 -name "*.md" -exec cp {} "$DOCS_REPO/guide/docs/" \;

# Sync Package READMEs (Specifically Analytics for the link in main README)
mkdir -p "$DOCS_REPO/guide/packages/analytics"
if [ -f "$SDK_REPO/packages/analytics/README.md" ]; then
    cp "$SDK_REPO/packages/analytics/README.md" "$DOCS_REPO/guide/packages/analytics/index.md"
fi
# Sync ZH Guide
if [ -d "$SDK_REPO/docs/zh/guide" ]; then
    mkdir -p "$DOCS_REPO/zh/guide"
    cp -r "$SDK_REPO/docs/zh/guide/"* "$DOCS_REPO/zh/guide/" 2>/dev/null || true
fi

# 2. Sync API folder (Maintain same structure)
echo -e "${YELLOW}📖 Syncing API folder...${NC}"
if [ -d "$SDK_REPO/docs/api" ]; then
    # Clear existing API folder in docs repo to avoid stale files
    rm -rf "$DOCS_REPO/api/@aastar"
    cp -r "$SDK_REPO/docs/api/"* "$DOCS_REPO/api/" 2>/dev/null || true
    
    # SYSTEMATIC RENAMING: Ensure all directories have index.md instead of README.md for VitePress routing
    # This specifically fixes /api/ and package-level 404s
    find "$DOCS_REPO/api" -name "README.md" | while read -r file; do
        mv "$file" "$(dirname "$file")/index.md" 2>/dev/null || true
    done
    
    # UPDATE LINKS: Global replacement in the copied files to ensure navigation works
    # Using a more robust pattern to avoid partial matches
    if [[ "$OSTYPE" == "darwin"* ]]; then
        find "$DOCS_REPO/api" -name "*.md" -exec sed -i '' 's/README.md/index.md/g' {} +
    else
        find "$DOCS_REPO/api" -name "*.md" -exec sed -i 's/README.md/index.md/g' {} +
    fi
fi

# 3. Sync Examples folder.
# examples/ is SDK-owned EXCEPT examples/index.md, which is curated in the docs
# repo (it indexes the standalone aastar-examples repo). rsync --delete drops
# example pages removed upstream without manual cleanup; --exclude=index.md both
# skips copying the SDK's index and protects the curated one from deletion.
echo -e "${YELLOW}💡 Syncing Examples folder...${NC}"
# Sync EN Examples
if [ -d "$SDK_REPO/docs/examples" ]; then
    rsync -a --delete --exclude='index.md' "$SDK_REPO/docs/examples/" "$DOCS_REPO/examples/"
fi
# Sync ZH Examples
if [ -d "$SDK_REPO/docs/zh/examples" ]; then
    mkdir -p "$DOCS_REPO/zh/examples"
    rsync -a --delete --exclude='index.md' "$SDK_REPO/docs/zh/examples/" "$DOCS_REPO/zh/examples/"
fi

# 4. Sync main README to guide/index.md for easy entry
if [ -f "$SDK_REPO/packages/sdk/README.md" ]; then
    # The meta-package README is the best "Getting Started" guide
    cp "$SDK_REPO/packages/sdk/README.md" "$DOCS_REPO/guide/getting-started.md"
    cp "$SDK_REPO/packages/sdk/README.md" "$DOCS_REPO/api/index.md"
fi

# 5. Extract package READMEs to api/modules/
echo -e "${YELLOW}📦 Extracting package documentation...${NC}"
mkdir -p "$DOCS_REPO/api/modules"
# Derive the package list from typedoc.json entryPoints so it tracks the real
# published packages automatically — no hardcoded list to drift. This is what
# stops removed packages (e.g. community/analytics) from being re-created as
# stale thin entries, and makes new ones (x402/channel/admin/airaccount) appear.
PACKAGES=$(node -e "try{const t=require('$SDK_REPO/typedoc.json');console.log((t.entryPoints||[]).map(p=>String(p).split('/').pop()).join(' '))}catch(e){console.log('')}")
[ -z "$PACKAGES" ] && PACKAGES="sdk core account paymaster identity tokens dapp x402 channel enduser operator admin airaccount"
echo "   packages: $PACKAGES"
# Standardize package entry points to avoid 404s
# We provide BOTH @aastar/pkg.md and @aastar/pkg/index.md to satisfy different link styles
for pkg in $PACKAGES; do
    if [ -f "$SDK_REPO/packages/$pkg/README.md" ]; then
        # 1. Provide as a module for the sidebar (/api/@aastar/sdk.html)
        mkdir -p "$DOCS_REPO/api/@aastar"
        cp "$SDK_REPO/packages/$pkg/README.md" "$DOCS_REPO/api/@aastar/$pkg.md"
        
        # 2. Provide as a directory index for folder links (/api/@aastar/sdk/)
        mkdir -p "$DOCS_REPO/api/@aastar/$pkg"
        cp "$SDK_REPO/packages/$pkg/README.md" "$DOCS_REPO/api/@aastar/$pkg/index.md"
        
        # 3. Provide in the modules folder for cross-referencing
        cp "$SDK_REPO/packages/$pkg/README.md" "$DOCS_REPO/api/modules/$pkg.md"
    fi
done

# 6. Sync Changelog
echo -e "${YELLOW}📝 Syncing Changelog...${NC}"
if [ -f "$SDK_REPO/CHANGELOG.md" ]; then
    cp "$SDK_REPO/CHANGELOG.md" "$DOCS_REPO/changelog.md"
fi

# 7. Sanitize markdown for VitePress (escape <jwt>/<void>/<T>… pseudo-tags that
# would otherwise break the Vue template compiler). Without this the build fails
# on TypeDoc prose like "Authorization: Bearer <jwt>".
echo -e "${YELLOW}🧼 Sanitizing markdown for VitePress...${NC}"
node "$SCRIPT_DIR/sanitize-typedoc-md.cjs" \
    "$DOCS_REPO/api" "$DOCS_REPO/guide" "$DOCS_REPO/examples" "$DOCS_REPO/zh"

echo -e "${GREEN}✅ Documentation sync complete!${NC}"
echo ""
echo "Synced to: $DOCS_REPO"
echo ""
echo "Next steps:"
echo "  cd $DOCS_REPO"
echo "  pnpm run docs:dev"
