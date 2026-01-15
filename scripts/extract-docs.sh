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

# 1. Sync Guide folder (Clean first, then copy)
echo -e "${YELLOW}📋 Syncing Guide folder...${NC}"
# Clean and sync EN Guide (Root)
if [ -d "$SDK_REPO/docs/guide" ]; then
    rm -rf "$DOCS_REPO/guide"/*
    cp -r "$SDK_REPO/docs/guide/"* "$DOCS_REPO/guide/" 2>/dev/null || true
fi
# Clean and sync ZH Guide
if [ -d "$SDK_REPO/docs/zh/guide" ]; then
    mkdir -p "$DOCS_REPO/zh/guide"
    rm -rf "$DOCS_REPO/zh/guide"/*
    cp -r "$SDK_REPO/docs/zh/guide/"* "$DOCS_REPO/zh/guide/" 2>/dev/null || true
fi

# 2. Sync API folder (Clean first, then copy)
echo -e "${YELLOW}📖 Syncing API folder...${NC}"
# Backup hand-written index.md if it exists
INDEX_BACKUP=""
if [ -f "$DOCS_REPO/api/index.md" ]; then
    echo "Backing up hand-written api/index.md..."
    INDEX_BACKUP=$(cat "$DOCS_REPO/api/index.md")
fi

if [ -d "$SDK_REPO/docs/api" ]; then
    rm -rf "$DOCS_REPO/api"/*
    cp -r "$SDK_REPO/docs/api/"* "$DOCS_REPO/api/" 2>/dev/null || true
    
    # Restore hand-written index.md if it existed
    if [ -n "$INDEX_BACKUP" ]; then
        echo "Restoring hand-written api/index.md..."
        echo "$INDEX_BACKUP" > "$DOCS_REPO/api/index.md"
    elif [ -f "$DOCS_REPO/api/README.md" ]; then
        # VitePress needs index.md, not README.md (Fallback)
        cp "$DOCS_REPO/api/README.md" "$DOCS_REPO/api/index.md"
    fi

    # Create index.md for each package
    for pkg in "$DOCS_REPO/api/@aastar"/*; do
        if [ -d "$pkg" ] && [ -f "$pkg/README.md" ]; then
            cp "$pkg/README.md" "$pkg/index.md"
        fi
    done
fi

# 3. Sync Examples folder (Clean first, then copy)
echo -e "${YELLOW}💡 Syncing Examples folder...${NC}"
# Clean and sync EN Examples
if [ -d "$SDK_REPO/docs/examples" ]; then
    rm -rf "$DOCS_REPO/examples"/*
    cp -r "$SDK_REPO/docs/examples/"* "$DOCS_REPO/examples/" 2>/dev/null || true
    # VitePress needs index.md, not README.md
    if [ -f "$DOCS_REPO/examples/README.md" ]; then
        cp "$DOCS_REPO/examples/README.md" "$DOCS_REPO/examples/index.md"
    fi
fi
# Clean and sync ZH Examples
if [ -d "$SDK_REPO/docs/zh/examples" ]; then
    mkdir -p "$DOCS_REPO/zh/examples"
    rm -rf "$DOCS_REPO/zh/examples"/*
    cp -r "$SDK_REPO/docs/zh/examples/"* "$DOCS_REPO/zh/examples/" 2>/dev/null || true
    if [ -f "$DOCS_REPO/zh/examples/README.md" ]; then
        cp "$DOCS_REPO/zh/examples/README.md" "$DOCS_REPO/zh/examples/index.md"
    fi
fi

# 4. Sync main README to guide/index.md for easy entry
if [ -f "$SDK_REPO/README.md" ]; then
    echo -e "${YELLOW}📝 Syncing README to getting-started.md and fixing links...${NC}"
    cp "$SDK_REPO/README.md" "$DOCS_REPO/guide/getting-started.md"
    # Fix links from ./docs/api/ to ../api/ because getting-started is now in guide/
    sed -i '' 's|(\./docs/api/|(../api/|g' "$DOCS_REPO/guide/getting-started.md"
fi

# 5. Extract package READMEs to api/modules/
echo -e "${YELLOW}📦 Extracting package documentation...${NC}"
mkdir -p "$DOCS_REPO/api/modules"
for pkg in core account paymaster tokens analytics dapp identity sdk; do
    if [ -f "$SDK_REPO/packages/$pkg/README.md" ]; then
        cp "$SDK_REPO/packages/$pkg/README.md" "$DOCS_REPO/api/modules/$pkg.md" 2>/dev/null || true
    fi
done

# 6. Sync Changelog
if [ -f "$SDK_REPO/docs/changelog.md" ]; then
    echo -e "${YELLOW}📜 Syncing Changelog...${NC}"
    cp "$SDK_REPO/docs/changelog.md" "$DOCS_REPO/changelog.md"
fi

# 7. Post-process API directories to ensure index.md exists for VitePress
echo -e "${YELLOW}🔍 Generating index.md for deep API directories...${NC}"
find "$DOCS_REPO/api" -type d | while read -r dir; do
    # Skip if index.md or README.md already exists
    if [ ! -f "$dir/index.md" ] && [ ! -f "$dir/README.md" ]; then
        echo "Creating index for $dir"
        echo "# $(basename "$dir")" > "$dir/index.md"
        echo "" >> "$dir/index.md"
        ls -p "$dir" | grep -v "/" | grep ".md" | grep -v "index.md" | sed 's/\.md//' | while read -r file; do
            echo "- [$file](./$file.md)" >> "$dir/index.md"
        done
    fi
    # Ensure index.md exists if README.md exists
    if [ -f "$dir/README.md" ] && [ ! -f "$dir/index.md" ]; then
        cp "$dir/README.md" "$dir/index.md"
    fi
done

# 8. Post-process to remove bloated type definitions (viem client)
echo -e "${YELLOW}🧹 Cleaning up bloated type definitions...${NC}"
# Use a more robust pattern to match the start of the client table row and the end of the next row (or similar structure)
# This is a bit tricky with sed, but since we know the specific output format of TypeDoc's Table format:
find "$DOCS_REPO/api" -name "*.md" -type f | xargs -I {} sed -i '' '/| `client` | \\| { `account`: `undefined`;/,/| `account`: `Account` | `undefined`;.* |/d' {}
find "$DOCS_REPO/api" -name "*.md" -type f | xargs -I {} sed -i '' 's/| `client` | \\| { `account`: `undefined`;.*/| `client` | `PublicClient \| WalletClient` |/' {}

echo -e "${GREEN}✅ Documentation sync complete!${NC}"
echo ""
echo "Synced to: $DOCS_REPO"
echo ""
echo "Next steps:"
echo "  cd $DOCS_REPO"
echo "  pnpm run docs:dev"
