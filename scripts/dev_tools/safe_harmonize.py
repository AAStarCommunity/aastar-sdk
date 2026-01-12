import os
import re

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

BIGINT_FIX = """
if (!(BigInt.prototype as any).toJSON) {
    (BigInt.prototype as any).toJSON = function () { return this.toString(); };
}
"""

ENV_LOGIC = """
const envPath = process.env.SDK_ENV_PATH || '.env.anvil';
dotenv.config({ path: path.resolve(process.cwd(), envPath), override: true });

const isSepolia = process.env.REVISION_ENV === 'sepolia';
const chain = isSepolia ? sepolia : foundry;
const RPC_URL = process.env.RPC_URL || (isSepolia ? process.env.SEPOLIA_RPC_URL : 'http://127.0.0.1:8545');

const ADMIN_KEY = (process.env.ADMIN_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80') as `0x${string}`;
const OPERATOR_KEY = (process.env.OPERATOR_KEY || '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d') as `0x${string}`;
const COMMUNITY_OWNER_KEY = (process.env.COMMUNITY_OWNER_KEY || '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a') as `0x${string}`;
"""

def process_file(file_path):
    if not os.path.exists(file_path):
        return
    with open(file_path, 'r') as f:
        content = f.read()
    
    # 1. Ensure BigInt fix is present (at the top)
    if "BigInt.prototype as any).toJSON" not in content:
        # Find the last import line
        lines = content.split('\n')
        last_import = 0
        for i, line in enumerate(lines):
            if line.strip().startswith('import '):
                last_import = i
        content = "\n".join(lines[:last_import+1]) + BIGINT_FIX + "\n".join(lines[last_import+1:])

    # 2. Replace hardcoded .env loading
    content = re.sub(r'dotenv\.config\(\{.*?\}\);?', ENV_LOGIC, content, flags=re.DOTALL)
    content = re.sub(r'dotenv\.config\(\);?', ENV_LOGIC, content, flags=re.DOTALL)
    
    # 3. Handle cases where chain/RPC_URL were defined manually
    content = re.sub(r'const chain = process\.env\.REVISION_ENV === \'sepolia\' \? sepolia : foundry;?', '', content)
    content = re.sub(r'const RPC_URL = process\.env\.RPC_URL;?', '', content)
    content = re.sub(r'const chain = foundry;?', '', content)
    
    # 4. Standardize Keys
    # Replace hardcoded Anvil keys with variables if they exist
    anvil_admin = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
    anvil_op = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'
    anvil_comm = '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a'
    
    content = content.replace(f"'{anvil_admin}'", 'ADMIN_KEY')
    content = content.replace(f'"{anvil_admin}"', 'ADMIN_KEY')
    content = content.replace(f"'{anvil_op}'", 'OPERATOR_KEY')
    content = content.replace(f'"{anvil_op}"', 'OPERATOR_KEY')
    content = content.replace(f"'{anvil_comm}'", 'COMMUNITY_OWNER_KEY')
    content = content.replace(f'"{anvil_comm}"', 'COMMUNITY_OWNER_KEY')
    
    # Also handle the USER_KEY if common
    anvil_user = '0x7c8521197cd533c301a916120409a63c809181144001a1c93a0280eb46c6495d'
    if anvil_user in content:
        if 'USER_KEY' not in content:
            content = content.replace(ENV_LOGIC, ENV_LOGIC + '\nconst USER_KEY = (process.env.USER_KEY || "0x7c8521197cd533c301a916120409a63c809181144001a1c93a0280eb46c6495d") as `0x${string}`;')
        content = content.replace(f"'{anvil_user}'", 'USER_KEY')
        content = content.replace(f'"{anvil_user}"', 'USER_KEY')

    # Remove redundant const declarations if any were left by the logic above
    content = re.sub(r'const envPath = process\.env\.SDK_ENV_PATH \|\| \'\.env\.v3\';?', '', content)
    
    # Finally, ensure any duplicate definitions of RPC_URL or chain are cleaned up
    # (The regex above is a bit loose, so we do one final clean)
    
    with open(file_path, 'w') as f:
        f.write(content)
    print(f"✅ Safely Harmonized {file_path}")

for script in SCRIPTS:
    process_file(script)
