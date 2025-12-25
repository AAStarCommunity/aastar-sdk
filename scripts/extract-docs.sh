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

# 1. Extract API Reference
echo -e "${YELLOW}📖 Copying API Reference...${NC}"
mkdir -p "$DOCS_REPO/api"
cp "$SDK_REPO/docs/API_REFERENCE.md" "$DOCS_REPO/api/index.md"

# 2. Extract existing docs
echo -e "${YELLOW}📋 Copying existing documentation...${NC}"
if [ -d "$SDK_REPO/docs" ]; then
    # Copy all markdown files from SDK docs
    find "$SDK_REPO/docs" -name "*.md" -type f | while read file; do
        filename=$(basename "$file")
        if [ "$filename" != "API_REFERENCE.md" ] && [ "$filename" != "DOCUMENTATION_PLAN.md" ]; then
            cp "$file" "$DOCS_REPO/guide/" 2>/dev/null || true
        fi
    done
fi

# 3. Extract README
echo -e "${YELLOW}📄 Copying README...${NC}"
if [ -f "$SDK_REPO/README.md" ]; then
    cp "$SDK_REPO/README.md" "$DOCS_REPO/guide/sdk-readme.md"
fi

# 4. Extract package READMEs
echo -e "${YELLOW}📦 Extracting package documentation...${NC}"
mkdir -p "$DOCS_REPO/api/modules"

for pkg in core account paymaster tokens identity dapp; do
    if [ -f "$SDK_REPO/packages/$pkg/README.md" ]; then
        cp "$SDK_REPO/packages/$pkg/README.md" "$DOCS_REPO/api/modules/$pkg.md"
    else
        echo "# @aastar/$pkg" > "$DOCS_REPO/api/modules/$pkg.md"
        echo "" >> "$DOCS_REPO/api/modules/$pkg.md"
        echo "Documentation coming soon..." >> "$DOCS_REPO/api/modules/$pkg.md"
    fi
done

# 5. Extract examples
echo -e "${YELLOW}💡 Copying examples...${NC}"
mkdir -p "$DOCS_REPO/examples"
if [ -d "$SDK_REPO/examples" ]; then
    cp -r "$SDK_REPO/examples/"*.md "$DOCS_REPO/examples/" 2>/dev/null || true
fi

# 6. Extract test scenarios as examples
echo -e "${YELLOW}🧪 Extracting test scenarios...${NC}"
if [ -f "$SDK_REPO/scripts/99_final_v2_regression.ts" ]; then
    # Create example from regression test
    cat > "$DOCS_REPO/examples/complete-workflow.md" << 'EOF'
# Complete Workflow Example

This example demonstrates a complete workflow using all SDK features.

Based on the regression test suite.

\`\`\`typescript
// See SDK repo: scripts/99_final_v2_regression.ts
// for the complete implementation
\`\`\`
EOF
fi

echo -e "${GREEN}✅ Documentation extraction complete!${NC}"
echo ""
echo "Extracted to: $DOCS_REPO"
echo ""
echo "Next steps:"
echo "  cd $DOCS_REPO"
echo "  pnpm run docs:dev"
