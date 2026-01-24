#!/bin/bash
# Auto-extract documentation from SDK repo to docs repo

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}📚 Extracting documentation from SDK repo...${NC}"

# Paths
SDK_REPO="/Users/jason/Dev/mycelium/my-exploration/projects/aastar-sdk"
DOCS_REPO="/Users/jason/Dev/mycelium/my-exploration/projects/aastar-docs"

# Ensure directories exist in docs repo
mkdir -p "$DOCS_REPO/api"
mkdir -p "$DOCS_REPO/guide"
mkdir -p "$DOCS_REPO/examples"

# 1. Sync Guide folder (Maintain same structure)
echo -e "${YELLOW}📋 Syncing Guide folder and plans...${NC}"
# Sync EN Guide (Root)
if [ -d "$SDK_REPO/docs/guide" ]; then
    cp -r "$SDK_REPO/docs/guide/"* "$DOCS_REPO/guide/" 2>/dev/null || true
fi
# Sync root markdown files in docs/ to guide/docs/ for external access
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

# 3. Sync Examples folder (Maintain same structure)
echo -e "${YELLOW}💡 Syncing Examples folder...${NC}"
# Sync EN Examples
if [ -d "$SDK_REPO/docs/examples" ]; then
    cp -r "$SDK_REPO/docs/examples/"* "$DOCS_REPO/examples/" 2>/dev/null || true
fi
# Sync ZH Examples
if [ -d "$SDK_REPO/docs/zh/examples" ]; then
    mkdir -p "$DOCS_REPO/zh/examples"
    cp -r "$SDK_REPO/docs/zh/examples/"* "$DOCS_REPO/zh/examples/" 2>/dev/null || true
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
# Standardize package entry points to avoid 404s
# We provide BOTH @aastar/pkg.md and @aastar/pkg/index.md to satisfy different link styles
for pkg in core account paymaster tokens identity dapp sdk; do
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

echo -e "${GREEN}✅ Documentation sync complete!${NC}"
echo ""
echo "Synced to: $DOCS_REPO"
echo ""
echo "Next steps:"
echo "  cd $DOCS_REPO"
echo "  pnpm run docs:dev"
