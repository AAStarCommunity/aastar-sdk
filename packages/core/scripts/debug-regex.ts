import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CORE_ROOT = path.resolve(__dirname, '..');
const ACTIONS_DIR = path.join(CORE_ROOT, 'src/actions');

function getImplementedActionsDebug(actionPath: string): string[] {
    console.log(`Reading: ${actionPath}`);
    try {
        const content = fs.readFileSync(actionPath, 'utf8');
        const methods: string[] = [];
        const lines = content.split('\n');
        
        for (const line of lines) {
            // Original Regex
            const match = line.match(/^\s*(?:async\s+)?([a-zA-Z0-9_]+)\s*[:(]/);
            if (match && !['if', 'for', 'while', 'switch', 'catch', 'return', 'async', 'export', 'const', 'let', 'type', 'interface'].includes(match[1])) {
                console.log(`  MATCH: ${match[1]} (Line: ${line.trim().substring(0, 40)}...)`);
                methods.push(match[1]);
            } else if (line.includes('depositFor')) {
                 console.log(`  MISS : ${line.trim().substring(0, 40)}... (Regex failed)`);
            }
        }
        return [...new Set(methods)];
    } catch (e) {
        console.error(`Error reading Action ${actionPath}:`, e);
        return [];
    }
}

const target = path.join(ACTIONS_DIR, 'paymasterV4.ts');
const actions = getImplementedActionsDebug(target);
console.log('Found Actions:', actions);
