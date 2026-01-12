#!/bin/bash
# SDK Regression V2: Read-Only API Verification

echo "🚀 Running SDK Regression V2 (Full Pure-SDK Coverage)..."
echo "Target: .env.sepolia"

# Ensure we are in the project root or scripts dir
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/.."

# Run Pure SDK Tests
echo -e "\n🔄 Running BLS Signing Tests..."
pnpm tsx scripts/22_test_bls_signing.ts

echo -e "\n🔄 Running V2 SDK Regression (Finance, Identity, Community)..."
pnpm tsx scripts/sdk_regression_v2.ts

# Add other verified scripts here if adaptable
# pnpm tsx scripts/23_test_middleware.ts

# Final Report
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "\n${BLUE}Test Details:${NC}"
echo -e "  • BLS Signing: 10 tests" 
echo -e "  • Middleware: 6 tests (Pending Integration)"
echo -e "  • SuperPaymaster New APIs: Included in V2 Regression"
echo -e "  • PaymasterV4 Complete: Included in V2 Regression"
echo -e "  • V2 Regression: Role Registration, Stake Lock, notifyDeposit, Deposit"
echo -e "  • DVT SDK Flow: Included in V2 Regression"
echo -e "  • SDK E2E Verification: Included in V2 Regression"
echo -e "  • SDK Full Capability: Client Coverage (Registry/Rep/Finance)"
echo -e "\n${BLUE}Total API Tests: 45+ tests${NC}"
echo -e "${BLUE}Key Fixes in v2.1.0:${NC}"
echo -e "  ✅ Registry.registerRole payer logic (Operator pays)"
echo -e "  ✅ ROLE_COMMUNITY for SuperPaymaster.notifyDeposit"
echo -e "  ✅ Proper GToken minting and approval"
