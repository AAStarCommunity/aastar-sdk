import * as fs from 'fs';
import * as path from 'path';

const SCRIPTS = [
    "scripts/06_local_test_v3_reputation.ts",
    "scripts/08_local_test_registry_lifecycle.ts",
    "scripts/10_test_protocol_admin_full.ts",
    "scripts/11_test_core_flows_full.ts",
    "scripts/12_test_staking_slash.ts",
    "scripts/12_test_slash_mechanism.ts",
    "scripts/12_test_staking_exit.ts",
    "scripts/13_test_sbt_burn_linkage.ts",
    "scripts/14_test_credit_redesign.ts",
    "scripts/15_test_bls_full.ts",
    "scripts/15_test_dvt_bls_full.ts",
    "scripts/18_test_lifecycle_completion.ts"
];

const STANDARD_HEADER = `
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

    // 1. Remove old env logic and imports of anvil/foundry
    content = content.replace(/import \{.*anvil.*\} from 'viem\/chains';/g, "");
    content = content.replace(/import \{.*foundry.*\} from 'viem\/chains';/g, "");
    content = content.replace(/import \* as dotenv from 'dotenv';/g, "");
    content = content.replace(/import dotenv from 'dotenv';/g, "");
    content = content.replace(/import \* as path from 'path';/g, "");
    content = content.replace(/import path from 'path';/g, "");
    
    // 2. Remove common env blocks
    content = content.replace(/\/\/ Dynamic environment configuration[\s\S]*?http:\/\/127\.0\.0\.1:8545'\);/g, "");
    content = content.replace(/const envPath = process\.env\.SDK_ENV_PATH[\s\S]*?override: true \}\);/g, "");
    
    // 3. Insert standard header after other imports
    const lines = content.split('\n');
    let lastImportIndex = 0;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().startsWith('import ')) {
            lastImportIndex = i;
        }
    }
    lines.splice(lastImportIndex + 1, 0, STANDARD_HEADER);
    content = lines.join('\n');

    // 4. Global replacements for usages
    content = content.replace(/chain: anvil/g, "chain: chain");
    content = content.replace(/chain: foundry/g, "chain: chain");
    content = content.replace(/transport: http\(ANVIL_RPC\)/g, "transport: http(RPC_URL)");
    content = content.replace(/transport: http\('http:\/\/127\.0\.0\.1:8545'\)/g, "transport: http(RPC_URL)");
    
    // 5. Clean up redundant declarations
    content = content.replace(/const ADMIN_KEY = process\.env\.ADMIN_KEY;/g, "");
    content = content.replace(/const RPC_URL = RPC_URL;/g, "");
    content = content.replace(/const ANVIL_RPC = .*/g, "");

    fs.writeFileSync(scriptPath, content);
    console.log(`✅ Refactored ${scriptPath}`);
});
