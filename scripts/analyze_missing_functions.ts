#!/usr/bin/env tsx
/**
 * Missing Functions Analysis Script - для достижения 95% покрытия
 */

import * as fs from 'fs';
import * as path from 'path';

const ABIS_DIR = path.join(process.cwd(), 'packages/core/src/abis');
const ACTIONS_DIR = path.join(process.cwd(), 'packages/core/src/actions');

// Mapping contracts to action files
const MAPPING: Record<string, string> = {
    'Registry': 'registry.ts',
    'GTokenStaking': 'staking.ts',
    'GToken': 'tokens.ts',
    'aPNTs': 'tokens.ts',
    'xPNTs': 'tokens.ts',
    'xPNTsToken': 'tokens.ts',
    'SuperPaymaster': 'superPaymaster.ts',
    'Paymaster': 'paymaster.ts',
    'MySBT': 'sbt.ts',
    'ReputationSystem': 'reputation.ts',
    'PaymasterFactory': 'factory.ts',
    'xPNTsFactory': 'factory.ts',
    'DVTValidator': 'dvt.ts',
    'BLSValidator': 'aggregator.ts',
    'BLSAggregator': 'aggregator.ts',
};

interface FunctionInfo {
    name: string;
    inputs: any[];
    outputs: any[];
    stateMutability: string;
}

function loadABI(contractName: string): FunctionInfo[] {
    const abiPath = path.join(ABIS_DIR, `${contractName}.json`);
    if (!fs.existsSync(abiPath)) return [];
    
    const rawContent = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
    const abi = Array.isArray(rawContent) ? rawContent : (rawContent.abi || []);
    
    return abi
        .filter((item: any) => item.type === 'function')
        .map((item: any) => ({
            name: item.name,
            inputs: item.inputs || [],
            outputs: item.outputs || [],
            stateMutability: item.stateMutability || 'nonpayable'
        }));
}

function getCoveredFunctions(contractName: string): Set<string> {
    const actionFile = MAPPING[contractName];
    if (!actionFile) return new Set();
    
    const actionPath = path.join(ACTIONS_DIR, actionFile);
    if (!fs.existsSync(actionPath)) return new Set();
    
    const content = fs.readFileSync(actionPath, 'utf8');
    const covered = new Set<string>();
    
    // Match functionName: 'xxx' or functionName: "xxx"
    const matches = content.matchAll(/functionName:\s*['"]([^'"]+)['"]/g);
    for (const match of matches) {
        covered.add(match[1]);
    }
    
    return covered;
}

function analyzeMissingFunctions(contractName: string) {
    const allFunctions = loadABI(contractName);
    const covered = getCoveredFunctions(contractName);
    
    const missing = allFunctions.filter(f => !covered.has(f.name));
    const coveragePercent = allFunctions.length > 0 
        ? Math.round((covered.size / allFunctions.length) * 100)
        : 0;
    
    return {
        contractName,
        actionFile: MAPPING[contractName] || 'N/A',
        total: allFunctions.length,
        covered: covered.size,
        coveragePercent,
        missing,
        needsImprovement: coveragePercent < 95
    };
}

// Analyze all core business contracts (官方SuperPaymaster contracts)
const coreContracts = [
    'ReputationSystem',
    'GToken',
    'SuperPaymaster',
    'GTokenStaking',
    'xPNTsToken',
    'xPNTsFactory',
    'Paymaster',
    'PaymasterFactory',
    'MySBT',
    'Registry',
    // Validators (自研合约)
    'BLSAggregator',
    'DVTValidator',
    'BLSValidator'
];

console.log('\n=== Missing Functions Analysis for 95% Coverage ===\n');

const results = coreContracts.map(analyzeMissingFunctions);

for (const result of results) {
    if (!result.needsImprovement) {
        console.log(`✅ ${result.contractName}: ${result.coveragePercent}% (${result.covered}/${result.total}) - OK`);
        continue;
    }
    
    console.log(`\n🔧 ${result.contractName}: ${result.coveragePercent}% (${result.covered}/${result.total})`);
    console.log(`   Action File: ${result.actionFile}`);
    console.log(`   Missing Functions (${result.missing.length}):`);
    
    for (const fn of result.missing) {
        const params = fn.inputs.map((p: any) => `${p.name}: ${p.type}`).join(', ');
        const returns = fn.outputs.length > 0 
            ? ` → ${fn.outputs.map((o: any) => o.type).join(', ')}` 
            : '';
        const mutability = fn.stateMutability !== 'nonpayable' ? ` [${fn.stateMutability}]` : '';
        console.log(`     - ${fn.name}(${params})${returns}${mutability}`);
    }
}

console.log('\n');
