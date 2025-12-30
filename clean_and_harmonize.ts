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

    // 1. Remove ALL occurrences of env-related variables and logic
    const patternsToRemove = [
        /import \{.*foundry.*\} from 'viem\/chains';/g,
        /import \{.*sepolia.*\} from 'viem\/chains';/g,
        /import \{.*anvil.*\} from 'viem\/chains';/g,
        /import \* as dotenv from 'dotenv';/g,
        /import dotenv from 'dotenv';/g,
        /import \* as path from 'path';/g,
        /import path from 'path';/g,
        /\/\/ Dynamic environment configuration[\s\S]*?http:\/\/127\.0\.0\.1:8545'\);/g,
        /const envPath = process\.env\.SDK_ENV_PATH[\s\S]*?override: true \}\);/g,
        /const isSepolia = process\.env\.REVISION_ENV === 'sepolia';/g,
        /const chain = isSepolia \? sepolia : (foundry|anvil);/g,
        /const RPC_URL = process\.env\.RPC_URL \|\| \(isSepolia \? process\.env\.SEPOLIA_RPC_URL : 'http:\/\/127\.0\.0\.1:8545'\);/g,
        /const ADMIN_KEY = \(process\.env\.ADMIN_KEY \|\| '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'\) as `0x\${string}`;/g,
        /const ADMIN_KEY = (process\.env\.ADMIN_KEY|'0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');/g,
        /const OPERATOR_KEY = \(process\.env\.OPERATOR_KEY \|\| '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'\) as `0x\${string}`;/g,
        /const COMMUNITY_OWNER_KEY = \(process\.env\.COMMUNITY_OWNER_KEY \|\| '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a'\) as `0x\${string}`;/g,
        /\/\/ BigInt serialization fix[\s\S]*?toJSON = function \(\) \{ return this\.toString\(\); \};/g,
        /\/\/ BigInt serialization fix[\s\S]*?toJSON = function \(\) \{[\s\S]*?return this\.toString\(\);[\s\S]*?\};/g,
        /const RPC_URL = process\.env\.RPC_URL \|\| \(isSepolia \? process\.env\.SEPOLIA_RPC_URL : RPC_URL\);/g,
        /const RPC_URL = RPC_URL;/g,
        /const ANVIL_RPC = 'http:\/\/127\.0\.0\.1:8545';/g
    ];

    patternsToRemove.forEach(p => {
        content = content.replace(p, "");
    });

    // 2. Clear multiple newlines
    content = content.replace(/\n\n\n+/g, "\n\n");

    // 3. Insert UNIFIED_HEADER after last remaining import or at top
    const lines = content.split('\n');
    let lastImportIndex = -1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().startsWith('import ')) {
            lastImportIndex = i;
        }
    }
    
    if (lastImportIndex !== -1) {
        lines.splice(lastImportIndex + 1, 0, UNIFIED_HEADER);
    } else {
        lines.unshift(UNIFIED_HEADER);
    }
    
    content = lines.join('\n');

    // 4. Global replacements for usages (already mostly done but safe to repeat)
    content = content.replace(/chain: anvil/g, "chain: chain");
    content = content.replace(/chain: foundry/g, "chain: chain");
    
    fs.writeFileSync(scriptPath, content);
    console.log(`✅ Cleaned and Harmonized ${scriptPath}`);
});
