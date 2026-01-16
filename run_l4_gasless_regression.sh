#!/bin/bash
set -e

echo "🧪 L4 Gasless Regression Test Suite"
echo "===================================="
echo ""

# Parse arguments
NETWORK="sepolia"

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --env|--network) NETWORK="$2"; shift ;;
        *) NETWORK="$1" ;;
    esac
    shift
done

echo "📡 Network: $NETWORK"
echo ""

# Ensure setup is run first
echo "🔧 Step 0: Running l4-setup to ensure environment is ready..."
pnpm tsx scripts/l4-setup.ts --network=$NETWORK

echo ""
echo "✅ Setup complete. Starting test execution..."
echo ""

# Track results
PASSED=0
FAILED=0
FAILED_TESTS=""

# Helper function to run test
run_test() {
    local test_name="$1"
    local test_file="$2"
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📋 Test: $test_name"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    if pnpm tsx "$test_file"; then
        echo "✅ PASSED: $test_name"
        PASSED=$((PASSED + 1))
    else
        echo "❌ FAILED: $test_name"
        FAILED=$((FAILED + 1))
        FAILED_TESTS="$FAILED_TESTS\\n  - $test_name"
    fi
    echo ""
}

# Run tests
run_test "Jason AA1 Gasless" "tests/l4-test-jason1-gasless.ts"
run_test "Jason AA2 Gasless" "tests/l4-test-jason2-gasless.ts"
run_test "Anni Gasless" "tests/l4-test-anni-gasless.ts"
run_test "Reputation Tiers" "tests/regression/l4-reputation-tiers.ts"
run_test "Comprehensive Gasless" "tests/regression/l4-comprehensive-gasless.ts"
run_test "Simple Gasless Demo" "examples/simple-gasless-demo.ts"

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Test Results Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Passed: $PASSED"
echo "❌ Failed: $FAILED"

if [ $FAILED -gt 0 ]; then
    echo ""
    echo "Failed Tests:$FAILED_TESTS"
    echo ""
    exit 1
else
    echo ""
    echo "🎉 All tests passed!"
    echo ""
    exit 0
fi
