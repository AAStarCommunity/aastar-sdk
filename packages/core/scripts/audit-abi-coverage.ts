import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CORE_ROOT = path.resolve(__dirname, '..');
const ABIS_DIR = path.join(CORE_ROOT, 'src/abis');
const ACTIONS_DIR = path.join(CORE_ROOT, 'src/actions');
const HASH_CACHE_FILE = path.join(ABIS_DIR, '.abi-hashes.json');

interface AbiItem {
    type: string;
    name?: string;
    inputs?: any[];
}

interface HashCache {
    [filename: string]: string;
}

function calculateHash(content: string): string {
    return crypto.createHash('md5').update(content).digest('hex');
}

function getAbiFunctions(abiJsonPath: string): string[] {
    try {
        const content = fs.readFileSync(abiJsonPath, 'utf8');
        const json = JSON.parse(content);
        const abi: AbiItem[] = json.abi || [];
        return abi
            .filter(item => item.type === 'function' && item.name)
            .map(item => item.name!);
    } catch (e) {
        console.error(`Error reading ABI ${abiJsonPath}:`, e);
        return [];
    }
}

function getImplementedActions(actionPath: string): string[] {
    try {
        const content = fs.readFileSync(actionPath, 'utf8');
        const methods: string[] = [];
        
        // Regex to find:
        // 1. async methodName(
        // 2. methodName: (
        // 3. methodName(
        // 4. const methodName = 
        // 5. function methodName(
        const regex = /(?:async\s+|function\s+|const\s+)?([a-zA-Z0-9_]+)\s*[:=(]/g;
        
        let match;
        while ((match = regex.exec(content)) !== null) {
            const name = match[1];
            if (!['if', 'for', 'while', 'switch', 'catch', 'return', 'async', 'export', 'const', 'let', 'type', 'interface', 'function', 'await'].includes(name)) {
                methods.push(name);
            }
        }
        
        return [...new Set(methods)];
    } catch (e) {
        console.error(`Error reading Action ${actionPath}:`, e);
        return [];
    }
}

async function run() {
    console.log('--- ABI Coverage Audit ---');
    
    const abiFiles = fs.readdirSync(ABIS_DIR).filter(f => f.endsWith('.json') && !f.startsWith('.'));
    const prevHashes: HashCache = fs.existsSync(HASH_CACHE_FILE) 
        ? JSON.parse(fs.readFileSync(HASH_CACHE_FILE, 'utf8')) 
        : {};
    const currentHashes: HashCache = {};
    
    // Map of ABI filenames to Action filenames and prefixes
    const ABI_ACTION_MAP: { [key: string]: { file: string, prefix?: string } } = {
        'GToken.json': { file: 'tokens.ts', prefix: 'token' },
        'xPNTsToken.json': { file: 'tokens.ts', prefix: 'token' },
        'xPNTsFactory.json': { file: 'factory.ts' },
        'PaymasterFactory.json': { file: 'factory.ts' },
        'SimpleAccountFactory.json': { file: 'account.ts' },
        'SimpleAccount.json': { file: 'account.ts' },
        'BLSAggregator.json': { file: 'validators.ts' },
        'DVTValidator.json': { file: 'validators.ts' },
        'GTokenStaking.json': { file: 'staking.ts' },
        'MySBT.json': { file: 'sbt.ts', prefix: 'sbt' },
        'Paymaster.json': { file: 'paymasterV4.ts', prefix: 'paymasterV4' },
        'ReputationSystem.json': { file: 'reputation.ts' }, 
        'EntryPoint.json': { file: 'entryPoint.ts' },
        'Registry.json': { file: 'registry.ts', prefix: 'registry' },
        'SuperPaymaster.json': { file: 'superPaymaster.ts', prefix: 'superPaymaster' }
    };
    
    let totalAbiFuncs = 0;
    let totalCovered = 0;
    const reports: string[] = [];

    for (const abiFile of abiFiles) {
        const abiPath = path.join(ABIS_DIR, abiFile);
        const content = fs.readFileSync(abiPath, 'utf8');
        const hash = calculateHash(content);
        currentHashes[abiFile] = hash;

        // Determine matching action file
        let config = ABI_ACTION_MAP[abiFile];
        let actionFileName = config?.file;
        let prefix = config?.prefix || '';
        
        if (!actionFileName) {
            // Fallback to simple name matching
            let actionBase = abiFile.replace('.json', '');
            actionBase = actionBase.charAt(0).toLowerCase() + actionBase.slice(1);
            actionFileName = `${actionBase}.ts`;
        }

        const actionPath = path.join(ACTIONS_DIR, actionFileName);

        if (!fs.existsSync(actionPath)) {
            continue;
        }

        const isChanged = prevHashes[abiFile] !== hash;
        const abiFuncs = getAbiFunctions(abiPath);
        const implementedActions = getImplementedActions(actionPath);

        const missing = abiFuncs.filter(f => {
            const abiNameLower = f.toLowerCase();
            const prefixedNameLower = (prefix + f).toLowerCase();
            
            return !implementedActions.some(a => {
                const actionNameLower = a.toLowerCase();
                return actionNameLower === abiNameLower || actionNameLower === prefixedNameLower;
            });
        });
        
        totalAbiFuncs += abiFuncs.length;
        totalCovered += (abiFuncs.length - missing.length);

        const coverage = abiFuncs.length === 0 ? 100 : Math.round(((abiFuncs.length - missing.length) / abiFuncs.length) * 100);
        
        reports.push(`\n[${abiFile}] -> [${actionFileName}] ${isChanged ? '⚡ CHANGED' : '✅ UNCHANGED'}`);
        reports.push(`  Coverage: ${coverage}% (${abiFuncs.length - missing.length}/${abiFuncs.length})`);
        
        if (missing.length > 0) {
            reports.push(`  Missing Functions (${missing.length}):`);
            missing.forEach(m => reports.push(`    - ${m}`));
        }
    }

    console.log(reports.join('\n'));
    console.log('\n--- Summary ---');
    console.log(`Total ABI Functions: ${totalAbiFuncs}`);
    console.log(`Total Covered: ${totalCovered}`);
    console.log(`Global ABI Alignment: ${Math.round((totalCovered / totalAbiFuncs) * 100)}%`);

    // Save current hashes
    fs.writeFileSync(HASH_CACHE_FILE, JSON.stringify(currentHashes, null, 2));
    console.log(`\nHashes updated in ${HASH_CACHE_FILE}`);
}

run().catch(console.error);
