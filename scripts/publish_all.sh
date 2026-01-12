#!/bin/bash

# Bulk Publish Script for AAstar SDK
# Usage: ./scripts/publish_all.sh <otp_code>

OTP=$1

if [ -z "$OTP" ]; then
    echo "❌ Usage: ./scripts/publish_all.sh <otp_code>"
    exit 1
fi

echo "🚀 Starting bulk publish with OTP: $OTP..."

# List of packages to publish
PACKAGES=(
    "packages/core"
    "packages/community"
    "packages/operator"
    "packages/enduser"
    "packages/analytics"
    "packages/tokens"
    "packages/identity"
    "packages/sdk"
)

for pkg in "${PACKAGES[@]}"; do
    echo "📦 Publishing $pkg..."
    cd $pkg
    npm publish --access public --tag beta --otp=$OTP
    if [ $? -ne 0 ]; then
        echo "❌ Failed to publish $pkg"
        exit 1
    fi
    cd - > /dev/null
    echo "✅ $pkg published!"
done

echo "🎉 All packages published successfully!"
