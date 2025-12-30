#!/bin/bash

# Configuration
FILES=$(find scripts -name "*.ts")

for f in $FILES; do
    # 1. Ensure dotenv is configured at the top (if not already properly done)
    # Most should have it by now, but we can standardize.
    
    # 2. Replace hardcoded keys
    sed -i '' "s/['\"]0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80['\"]/process.env.ADMIN_KEY/g" "$f"
    sed -i '' "s/['\"]0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d['\"]/process.env.OPERATOR_KEY/g" "$f"
    sed -i '' "s/['\"]0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a['\"]/process.env.COMMUNITY_OWNER_KEY/g" "$f"
    
    # 3. Replace ANVIL_RPC or similar
    sed -i '' "s|'http://127.0.0.1:8545'|RPC_URL|g" "$f"
    sed -i '' 's/ANVIL_RPC/RPC_URL/g' "$f"
    
    # 4. Replace chain imports and usage
    # Ensure foundry/sepolia are imported and chain is defined
    # Actually, most of my scripts already have the dynamic header if I ran the previous fix.
    # But some might have missed it or have conflicting definitions.
done

echo "✅ Batch replacement of keys and RPCs completed."
