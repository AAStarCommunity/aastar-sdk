
import { keccak256, toBytes } from 'viem';
import fs from 'fs';
import path from 'path';

const baseDir = '/Users/jason/Dev/mycelium/my-exploration/projects/SuperPaymaster/contracts/src';

function findErrors(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
            results = results.concat(findErrors(filePath));
        } else if (file.endsWith('.sol')) {
            const content = fs.readFileSync(filePath, 'utf8');
            const matches = content.matchAll(/error\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)/g);
            for (const match of matches) {
                const name = match[1];
                const rawParams = match[2].split(',').map(p => p.trim());
                
                // Helper to normalize types (e.g. uint -> uint256)
                const normalizeType = (t) => {
                    t = t.split(' ')[0]; // Take only the type part
                    if (t === 'uint') return 'uint256';
                    if (t === 'int') return 'int256';
                    return t;
                };

                const params = rawParams.map(normalizeType).filter(p => p !== '');
                const sig = `${name}(${params.join(',')})`;
                const selector = keccak256(toBytes(sig)).slice(0, 10);
                results.push({ selector, sig, file: path.basename(file) });
            }
        }
    });
    return results;
}

const allErrors = findErrors(baseDir);
console.log('--- Selector Report ---');
allErrors.forEach(e => {
    console.log(`${e.selector} => ${e.sig} (${e.file})`);
});

const target = '0xec442f05';
const found = allErrors.find(e => e.selector === target);
if (found) {
    console.log(`\n🎯 FOUND: ${found.selector} => ${found.sig} in ${found.file}`);
} else {
    console.log(`\n❌ Not found in ${baseDir}`);
}
