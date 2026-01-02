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

KEYS = {
    'ADMIN_KEY': '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    'OPERATOR_KEY': '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
    'COMMUNITY_OWNER_KEY': '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
    'USER_KEY': '0x7c8521197cd533c301a916120409a63c809181144001a1c93a0280eb46c6495d'
}

def process_file(file_path):
    if not os.path.exists(file_path):
        return
    with open(file_path, 'r') as f:
        content = f.read()
    
    # 1. Ensure BigInt fix is present (at the top)
    if "BigInt.prototype as any).toJSON" not in content:
        lines = content.split('\n')
        last_import = 0
        for i, line in enumerate(lines):
            if line.strip().startswith('import '):
                last_import = i
        content = "\n".join(lines[:last_import+1]) + '\n\nif (!(BigInt.prototype as any).toJSON) {\n    (BigInt.prototype as any).toJSON = function () { return this.toString(); };\n}\n' + "\n".join(lines[last_import+1:])

    # 2. Replace hardcoded keys with environment variables and fallbacks
    for key_name, anvil_val in KEYS.items():
        # Pattern to find hardcoded key assignments
        # e.g. const ADMIN_KEY = '0x...' as Hex;
        # e.g. const ADMIN_KEY = "0x..." as Hex;
        pattern = rf'(const\s+{key_name}\s*=\s*)([\x27"]{anvil_val}[\x27"])(\s+as\s+\w+)?'
        replacement = rf'\1(process.env.{key_name} || \2)\3'
        content = re.sub(pattern, replacement, content)
        
        # Also handle simpler cases
        pattern_simple = rf'(const\s+{key_name}\s*=\s*)([\x27"]{anvil_val}[\x27"])'
        replacement_simple = rf'\1(process.env.{key_name} || \2)'
        # Avoid double replacing
        if f'process.env.{key_name}' not in content:
             content = re.sub(pattern_simple, replacement_simple, content)

    # 3. Handle SIGNER_KEY if it exists and mapped to ADMIN_KEY
        content = content.replace("process.env.ADMIN_KEY as Hex", "(process.env.ADMIN_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80') as Hex")

    with open(file_path, 'w') as f:
        f.write(content)
    print(f"✅ Surgically Processed {file_path}")

for script in SCRIPTS:
    process_file(script)
