import * as fs from 'fs';
import * as path from 'path';

const SCRIPTS = [
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
];

const UNIFIED_HEADER = `
import { foundry, sepolia } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as path from 'path';

// BigInt serialization fix
if (!(BigInt.prototype as any).toJSON) {
    (BigInt.prototype as any).toJSON = function () { return this.toString(); };
}

// Dynamic environment configuration
const envPath = process.env.SDK_ENV_PATH || '.env.anvil';
dotenv.config({ path: path.resolve(process.cwd(), envPath), override: true });

const isSepolia = process.env.REVISION_ENV === 'sepolia';
const chain = isSepolia ? sepolia : foundry;
const RPC_URL = process.env.RPC_URL || (isSepolia ? process.env.SEPOLIA_RPC_URL : 'http://127.0.0.1:8545');

const ADMIN_KEY = (process.env.ADMIN_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80') as \`0x\${string}\`;
const OPERATOR_KEY = (process.env.OPERATOR_KEY || '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d') as \`0x\${string}\`;
const COMMUNITY_OWNER_KEY = (process.env.COMMUNITY_OWNER_KEY || '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a') as \`0x\${string}\`;
`;

SCRIPTS.forEach(scriptPath => {
    if (!fs.existsSync(scriptPath)) return;
    let content = fs.readFileSync(scriptPath, 'utf8');

    // 1. Remove standard imports that we are replacing
    content = content.replace(/import \{.*(foundry|sepolia|anvil).*\} from 'viem\/chains';/g, "");
    content = content.replace(/import \* as dotenv from 'dotenv';/g, "");
    content = content.replace(/import dotenv from 'dotenv';/g, "");
    content = content.replace(/import \* as path from 'path';/g, "");
    content = content.replace(/import path from 'path';/g, "");

    // 2. Remove any line that declares our standard variables
    const lines = content.split('\n');
    const filteredLines = lines.filter(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith('const envPath =')) return false;
        if (trimmed.startsWith('dotenv.config(')) return false;
        if (trimmed.startsWith('const isSepolia =')) return false;
        if (trimmed.startsWith('const chain =')) return false;
        if (trimmed.startsWith('const RPC_URL =')) return false;
        if (trimmed.startsWith('const ADMIN_KEY =')) return false;
        if (trimmed.startsWith('const OPERATOR_KEY =')) return false;
        if (trimmed.startsWith('const COMMUNITY_OWNER_KEY =')) return false;
        if (trimmed.startsWith('const ANVIL_RPC =')) return false;
        if (trimmed.includes('BigInt.prototype as any).toJSON')) return false;
        return true;
    });

    // 3. Re-insert the UNIFIED_HEADER after remaining imports
    let lastImportIndex = -1;
    for (let i = 0; i < filteredLines.length; i++) {
        if (filteredLines[i].trim().startsWith('import ')) {
            lastImportIndex = i;
        }
    }
    
    filteredLines.splice(lastImportIndex + 1, 0, UNIFIED_HEADER);
    content = filteredLines.join('\n');

    // Final cleanup of extra empty lines
    content = content.replace(/\n\n\n+/g, "\n\n");

    fs.writeFileSync(scriptPath, content);
    console.log(`✅ Cleaned and Standardized ${scriptPath}`);
});
