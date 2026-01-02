import os

SCRIPTS = [
    "scripts/v2_regression/00_validate_env.ts",
    "scripts/v2_regression/01_setup_and_fund.ts",
    "scripts/v2_regression/02_operator_onboarding.ts",
    "scripts/v2_regression/03_community_registry.ts",
    "scripts/v2_regression/04_enduser_flow.ts",
    "scripts/v2_regression/05_admin_audit.ts",
    "scripts/06_local_test_v3_admin.ts",
    "scripts/06_local_test_v3_funding.ts",
    "scripts/06_local_test_v3_reputation.ts",
    "scripts/06_local_test_v3_execution.ts",
    "scripts/08_local_test_registry_lifecycle.ts",
    "scripts/09_local_test_community_lifecycle.ts",
    "scripts/10_test_protocol_admin_full.ts",
    "scripts/11_test_core_flows_full.ts",
    "scripts/12_test_staking_slash.ts",
    "scripts/12_test_slash_mechanism.ts",
    "scripts/12_test_staking_exit.ts",
    "scripts/13_test_sbt_burn_linkage.ts",
    "scripts/14_test_credit_redesign.ts",
    "scripts/15_test_bls_full.ts",
    "scripts/15_test_dvt_bls_full.ts",
    "scripts/18_test_lifecycle_completion.ts",
    "scripts/98_edge_reentrancy.ts",
    "scripts/99_bug_hunting_fast.ts"
]

HEADER = """import { createPublicClient, createWalletClient, http, formatEther, parseEther, parseAbi, keccak256, toHex, type Hex, parseUnits, erc20Abi, type Address } from 'viem';
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
"""

def process_file(file_path):
    if not os.path.exists(file_path):
        return
    with open(file_path, 'r') as f:
        lines = f.readlines()
    
    # Skip everything until we find a line that is NOT an import or a boilerplate variable
    start_idx = 0
    for i, line in enumerate(lines):
        trimmed = line.strip()
        if not trimmed: continue
        if trimmed.startswith('import ') or trimmed.startswith('//') or trimmed.startswith('import{'):
            continue
        if any(trimmed.startswith(x) for x in [
            'const envPath =', 'dotenv.config(', 'const isSepolia =', 'const chain =', 
            'const RPC_URL =', 'const ADMIN_KEY =', 'const OPERATOR_KEY =', 
            'const COMMUNITY_OWNER_KEY =', 'const require =', 'type Hex =', 
            'BigInt.prototype', 'if (!(BigInt.prototype'
        ]):
            continue
        start_idx = i
        break
    
    new_content = HEADER + "\n" + "".join(lines[start_idx:])
    with open(file_path, 'w') as f:
        f.write(new_content)
    print(f"✅ Surgically Harmonized {file_path}")

for script in SCRIPTS:
    process_file(script)
