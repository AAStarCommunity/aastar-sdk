#!/bin/bash
set -e

echo "🧪 L4 Gasless Regression Test Suite"
echo "===================================="
echo ""

# Parse arguments
NETWORK="sepolia"
SLOW_MODE=false
TEST_DELAY=5  # Default delay in seconds between tests

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --env|--network) NETWORK="$2"; shift ;;
        --slow) SLOW_MODE=true ;;
        --delay) TEST_DELAY="$2"; shift ;;
        *) NETWORK="$1" ;;
    esac
    shift
done

# NOTE: Anvil environment is skipped for deep gasless debugging due to instability.
# Please use Sepolia for reliable gasless transaction testing.
if [ "$NETWORK" == "anvil" ]; then
    echo "⚠️  WARNING: Running on Anvil. Gasless tests may be unstable."
    echo "    For deep debugging, please use --env sepolia."
fi


if [ "$SLOW_MODE" = true ]; then
    echo "🐢 Slow Mode: ENABLED (${TEST_DELAY}s delay between tests)"
    echo "   This helps prevent nonce conflicts and mempool pollution."
fi

echo "📡 Network: $NETWORK"
echo ""

# Log to file
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_DIR="logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/l4_regression_${NETWORK}_${TIMESTAMP}.log"

# Use a named pipe to capture output while still showing it
exec > >(tee -a "$LOG_FILE") 2>&1

echo "📝 Logging to: $LOG_FILE"
echo "🕒 Start Time: $(date)"
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
    
    if pnpm tsx "$test_file" --network "$NETWORK"; then
        echo "✅ PASSED: $test_name"
        PASSED=$((PASSED + 1))
    else
        echo "❌ FAILED: $test_name"
        FAILED=$((FAILED + 1))
        FAILED_TESTS="$FAILED_TESTS\\n  - $test_name"
    fi
    echo ""
    
    # Add delay between tests if slow mode is enabled
    if [ "$SLOW_MODE" = true ]; then
        echo "⏳ Waiting ${TEST_DELAY}s before next test (--slow mode)..."
        sleep "$TEST_DELAY"
        echo ""
    fi
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
