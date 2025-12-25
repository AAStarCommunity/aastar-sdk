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
echo -e "${YELLOW}📋 Syncing Guide folder...${NC}"
if [ -d "$SDK_REPO/docs/guide" ]; then
    cp -r "$SDK_REPO/docs/guide/"* "$DOCS_REPO/guide/" 2>/dev/null || true
else
    # Fallback: Copy all .md files from root of docs/ (except specific ones) to guide/
    find "$SDK_REPO/docs" -maxdepth 1 -name "*.md" -type f | while read file; do
        filename=$(basename "$file")
        if [[ "$filename" != "API_REFERENCE.md" && "$filename" != "DOCUMENTATION_PLAN.md" && "$filename" != "API_REFERENCE.md" ]]; then
            cp "$file" "$DOCS_REPO/guide/" 2>/dev/null || true
        fi
    done
fi

# 2. Sync API folder (Maintain same structure)
echo -e "${YELLOW}📖 Syncing API folder...${NC}"
if [ -d "$SDK_REPO/docs/api" ]; then
    cp -r "$SDK_REPO/docs/api/"* "$DOCS_REPO/api/" 2>/dev/null || true
else
    # Fallback to single file API reference if folder doesn't exist
    if [ -f "$SDK_REPO/docs/API_REFERENCE.md" ]; then
        cp "$SDK_REPO/docs/API_REFERENCE.md" "$DOCS_REPO/api/index.md"
    fi
fi

# 3. Sync Examples folder (Maintain same structure)
echo -e "${YELLOW}💡 Syncing Examples folder...${NC}"
if [ -d "$SDK_REPO/docs/examples" ]; then
    cp -r "$SDK_REPO/docs/examples/"* "$DOCS_REPO/examples/" 2>/dev/null || true
elif [ -d "$SDK_REPO/examples" ]; then
    cp -r "$SDK_REPO/examples/"* "$DOCS_REPO/examples/" 2>/dev/null || true
fi

# 4. Sync main README to guide/index.md for easy entry
if [ -f "$SDK_REPO/README.md" ]; then
    cp "$SDK_REPO/README.md" "$DOCS_REPO/guide/getting-started.md"
fi

# 5. Extract package READMEs to api/modules/ (Standard fallback)
echo -e "${YELLOW}📦 Extracting package documentation...${NC}"
mkdir -p "$DOCS_REPO/api/modules"
for pkg in core account paymaster tokens identity dapp; do
    if [ -f "$SDK_REPO/packages/$pkg/README.md" ]; then
        cp "$SDK_REPO/packages/$pkg/README.md" "$DOCS_REPO/api/modules/$pkg.md"
    fi
done

echo -e "${GREEN}✅ Documentation sync complete!${NC}"
echo ""
echo "Synced to: $DOCS_REPO"
echo ""
echo "Next steps:"
echo "  cd $DOCS_REPO"
echo "  pnpm run docs:dev"
