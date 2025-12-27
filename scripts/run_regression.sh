#!/bin/bash
# V2 Regression Test Suite Runner
# Automatically validates environment and runs all regression tests

set -e  # Exit on error

echo "🚀 AAStar SDK V2 Regression Test Suite"
echo "========================================"
echo ""

# Step 0: Environment Validation
echo "📋 Step 00: Environment Validation"
npx tsx scripts/v2_regression/00_validate_env.ts
echo ""

# Step 1: Setup and Fund
echo "📋 Step 01: Setup and Fund Accounts"
npx tsx scripts/v2_regression/01_setup_and_fund.ts
echo ""

# Step 2: Operator Onboarding
echo "📋 Step 02: Operator Onboarding"
npx tsx scripts/v2_regression/02_operator_onboarding.ts
echo ""

# Step 3: Community Registry
echo "📋 Step 03: Community Registry"
npx tsx scripts/v2_regression/03_community_registry.ts
echo ""

# Step 4: End User Flow
echo "📋 Step 04: End User Flow"
npx tsx scripts/v2_regression/04_enduser_flow.ts
echo ""

# Step 5: Admin Audit
echo "📋 Step 05: Admin Audit"
npx tsx scripts/v2_regression/05_admin_audit.ts
echo ""

echo "========================================"
echo "✅ All regression tests passed!"
echo ""
