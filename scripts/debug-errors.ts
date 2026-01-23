
import { keccak256, toBytes, toHex } from 'viem';
import * as fs from 'fs';
import * as path from 'path';

const contractsDir = '/Users/jason/Dev/mycelium/my-exploration/projects/SuperPaymaster/contracts/src';

function walk(dir: string, callback: (file: string) => void) {
    fs.readdirSync(dir).forEach(f => {
        const dirPath = path.join(dir, f);
        const isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walk(dirPath, callback) : callback(dirPath);
    });
}

const errors: Map<string, string> = new Map();

walk(contractsDir, (file) => {
    if (!file.endsWith('.sol')) return;
    const content = fs.readFileSync(file, 'utf8');
    const matches = content.matchAll(/error\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)/g);
    for (const match of matches) {
        const name = match[1];
        const params = match[2].split(',').map(p => p.trim().split(' ')[0]).filter(p => p !== '');
        const signature = `${name}(${params.join(',')})`;
        const hash = keccak256(toBytes(signature)).slice(0, 10);
        errors.set(hash, signature);
    }
});

console.log('Error Selector Map:');
for (const [hash, sig] of errors.entries()) {
    console.log(`${hash} => ${sig}`);
}

const target = '0xec442f05';
if (errors.has(target)) {
    console.log(`\n🎯 TARGET FOUND: ${target} => ${errors.get(target)}`);
} else {
    console.log(`\n❌ Target ${target} not found.`);
}
