#!/bin/bash

SCRIPTS=(
    "scripts/v2_regression/00_validate_env.ts"
    "scripts/v2_regression/01_setup_and_fund.ts"
    "scripts/v2_regression/02_operator_onboarding.ts"
    "scripts/v2_regression/03_community_registry.ts"
    "scripts/v2_regression/04_enduser_flow.ts"
    "scripts/v2_regression/05_admin_audit.ts"
    "scripts/06_local_test_v3_admin.ts"
    "scripts/06_local_test_v3_funding.ts"
    "scripts/06_local_test_v3_reputation.ts"
    "scripts/06_local_test_v3_execution.ts"
    "scripts/08_local_test_registry_lifecycle.ts"
    "scripts/09_local_test_community_lifecycle.ts"
    "scripts/10_test_protocol_admin_full.ts"
    "scripts/11_test_core_flows_full.ts"
    "scripts/12_test_staking_slash.ts"
    "scripts/12_test_slash_mechanism.ts"
    "scripts/12_test_staking_exit.ts"
    "scripts/13_test_sbt_burn_linkage.ts"
    "scripts/14_test_credit_redesign.ts"
    "scripts/15_test_bls_full.ts"
    "scripts/15_test_dvt_bls_full.ts"
    "scripts/18_test_lifecycle_completion.ts"
    "scripts/98_edge_reentrancy.ts"
    "scripts/99_bug_hunting_fast.ts"
)

HEADER=$(cat << 'HEREDOC'
import { createPublicClient, createWalletClient, http, formatEther, parseAbi, keccak256, toHex, type Hex, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { createRequire } from 'module';
import { foundry, sepolia } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as path from 'path';

if (!(BigInt.prototype as any).toJSON) {
    (BigInt.prototype as any).toJSON = function () { return this.toString(); };
}

const envPath = process.env.SDK_ENV_PATH || '.env.anvil';
dotenv.config({ path: path.resolve(process.cwd(), envPath), override: true });

const isSepolia = process.env.REVISION_ENV === 'sepolia';
const chain = isSepolia ? sepolia : foundry;
const RPC_URL = process.env.RPC_URL || (isSepolia ? process.env.SEPOLIA_RPC_URL : 'http://127.0.0.1:8545');

const ADMIN_KEY = (process.env.ADMIN_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80') as `0x${string}`;
const OPERATOR_KEY = (process.env.OPERATOR_KEY || '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d') as `0x${string}`;
const COMMUNITY_OWNER_KEY = (process.env.COMMUNITY_OWNER_KEY || '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a') as `0x${string}`;
const require = createRequire(import.meta.url);
HEREDOC
)

for SCRIPT in "${SCRIPTS[@]}"; do
    if [ ! -f "$SCRIPT" ]; then continue; fi
    
    # Remove all leading lines that look like our header or stray junk
    # We basically want to find the first line that is "business as usual"
    # Actually, a safer way is to just grep for the first function or main call or address definition
    
    # Strip existing headers (roughly)
    sed -i '' '/import {/d' "$SCRIPT" || true
    sed -i '' '/import \* as/d' "$SCRIPT" || true
    sed -i '' '/import dotenv/d' "$SCRIPT" || true
    sed -i '' '/import path/d' "$SCRIPT" || true
    sed -i '' '/import { createRequire }/d' "$SCRIPT" || true
    sed -i '' '/const envPath =/d' "$SCRIPT" || true
    sed -i '' '/dotenv.config(/d' "$SCRIPT" || true
    sed -i '' '/const isSepolia =/d' "$SCRIPT" || true
    sed -i '' '/const chain =/d' "$SCRIPT" || true
    sed -i '' '/const RPC_URL =/d' "$SCRIPT" || true
    sed -i '' '/const ADMIN_KEY =/d' "$SCRIPT" || true
    sed -i '' '/const OPERATOR_KEY =/d' "$SCRIPT" || true
    sed -i '' '/const COMMUNITY_OWNER_KEY =/d' "$SCRIPT" || true
    sed -i '' '/const require =/d' "$SCRIPT" || true
    sed -i '' '/BigInt.prototype as any).toJSON/d' "$SCRIPT" || true
    sed -i '' '/type Hex =/d' "$SCRIPT" || true
    
    # Prepend the header
    TEMP_FILE=$(mktemp)
    echo "$HEADER" > "$TEMP_FILE"
    cat "$SCRIPT" >> "$TEMP_FILE"
    mv "$TEMP_FILE" "$SCRIPT"
    echo "✅ Standardized $SCRIPT"
done
