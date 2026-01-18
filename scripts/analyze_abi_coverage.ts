#!/usr/bin/env tsx
/**
 * SDK ABI Coverage Analysis Script
 * 
 * 分析所有合约 ABI 并生成 SDK 覆盖率报告
 */

import * as fs from 'fs';
import * as path from 'path';

const ABIS_DIR = path.join(process.cwd(), 'packages/core/src/abis');
const ACTIONS_DIR = path.join(process.cwd(), 'packages/core/src/actions');

interface ContractAnalysis {
    contract: string;
    functions: string[];
    totalFunctions: number;
    sdkAction?: string;
    coveredFunctions?: string[];
    coverage?: number;
}

// 获取所有合约 ABI
function getAllContracts(): ContractAnalysis[] {
    const files = fs.readdirSync(ABIS_DIR).filter(f => f.endsWith('.json') && f !== 'index.ts');
    
    return files.map(file => {
        const rawContent = JSON.parse(fs.readFileSync(path.join(ABIS_DIR, file), 'utf8'));
        const content = Array.isArray(rawContent) ? rawContent : (rawContent.abi || []);
        const functions = content
            .filter((item: any) => item.type === 'function')
            .map((item: any) => item.name)
            .filter((name: string, index: number, self: string[]) => self.indexOf(name) === index)
            .sort();
        
        return {
            contract: file.replace('.json', ''),
            functions,
            totalFunctions: functions.length
        };
    });
}

// 分析 SDK Actions 覆盖率
function analyzeActionsCoverage(contracts: ContractAnalysis[]): ContractAnalysis[] {
    const actionFiles = fs.readdirSync(ACTIONS_DIR).filter(f => f.endsWith('.ts') && f !== 'index.ts');
    
    // 合约到 Action 的映射
    const mapping: Record<string, string> = {
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
        'StateValidator': 'StateValidator.ts'
    };
    
    return contracts.map(contract => {
        const actionFile = mapping[contract.contract];
        if (!actionFile) {
            return { ...contract, sdkAction: 'N/A (Internal/Legacy)', coverage: 0 };
        }
        
        const actionPath = path.join(ACTIONS_DIR, actionFile);
        if (!fs.existsSync(actionPath)) {
            return { ...contract, sdkAction: actionFile + ' (Missing)', coverage: 0 };
        }
        
        const actionContent = fs.readFileSync(actionPath, 'utf8');
        const coveredFunctions = contract.functions.filter(fn => 
            actionContent.includes(`functionName: '${fn}'`) || 
            actionContent.includes(`functionName: "${fn}"`)
        );
        
        return {
            ...contract,
            sdkAction: actionFile,
            coveredFunctions,
            coverage: Math.round((coveredFunctions.length / contract.totalFunctions) * 100)
        };
    });
}

// 生成报告
function generateReport(contracts: ContractAnalysis[]) {
    console.log('\n📊 SDK ABI Coverage Analysis\n');
    console.log('='.repeat(80));
    
    // 按优先级分组
    const coreContracts = contracts.filter(c => 
        ['Registry', 'GTokenStaking', 'SuperPaymaster', 'MySBT', 'ReputationSystem', 'GToken'].includes(c.contract)
    );
    const tokenContracts = contracts.filter(c => 
        ['aPNTs', 'xPNTs', 'xPNTsToken', 'xPNTsFactory'].includes(c.contract)
    );
    const paymasterContracts = contracts.filter(c => 
        ['Paymaster', 'PaymasterFactory'].includes(c.contract)
    );
    const aaContracts = contracts.filter(c => 
        c.contract.includes('Account') || c.contract.includes('EntryPoint')
    );
    const validatorContracts = contracts.filter(c => 
        ['DVTValidator', 'BLSValidator', 'BLSAggregator'].includes(c.contract)
    );
    const otherContracts = contracts.filter(c => 
        !coreContracts.includes(c) && !tokenContracts.includes(c) && 
        !paymasterContracts.includes(c) && !aaContracts.includes(c) && 
        !validatorContracts.includes(c)
    );
    
    function printGroup(title: string, group: ContractAnalysis[]) {
        if (group.length === 0) return;
        
        console.log(`\n## ${title}\n`);
        group.forEach(c => {
            const icon = (c.coverage || 0) >= 80 ? '✅' : (c.coverage || 0) >= 50 ? '⚠️' : '❌';
            console.log(`${icon} **${c.contract}** (${c.totalFunctions} functions, ${c.coverage || 0}% covered)`);
            console.log(`   SDK Action: ${c.sdkAction || 'N/A'}`);
            if (c.coveredFunctions && c.coveredFunctions.length > 0) {
                console.log(`   Covered: ${c.coveredFunctions.slice(0, 5).join(', ')}${c.coveredFunctions.length > 5 ? '...' : ''}`);
            }
            console.log('');
        });
    }
    
    printGroup('核心合约', coreContracts);
    printGroup('代币系统', tokenContracts);
    printGroup('Paymaster', paymasterContracts);
    printGroup('AA 账户', aaContracts);
    printGroup('验证器', validatorContracts);
    printGroup('其他', otherContracts);
    
    // 总体统计
    console.log('\n' + '='.repeat(80));
    console.log('\n📈 Overall Statistics\n');
    
    const totalFunctions = contracts.reduce((sum, c) => sum + c.totalFunctions, 0);
    const totalCovered = contracts.reduce((sum, c) => sum + (c.coveredFunctions?.length || 0), 0);
    const avgCoverage = Math.round((totalCovered / totalFunctions) * 100);
    
    console.log(`Total Contracts: ${contracts.length}`);
    console.log(`Total Functions: ${totalFunctions}`);
    console.log(`Covered Functions: ${totalCovered}`);
    console.log(`Average Coverage: ${avgCoverage}%\n`);
    
    // 核心业务覆盖率
    const coreFunctions = [...coreContracts, ...tokenContracts, ...paymasterContracts]
        .reduce((sum, c) => sum + c.totalFunctions, 0);
    const coreCovered = [...coreContracts, ...tokenContracts, ...paymasterContracts]
        .reduce((sum, c) => sum + (c.coveredFunctions?.length || 0), 0);
    const coreCoverage = Math.round((coreCovered / coreFunctions) * 100);
    
    console.log(`Core Business Coverage: ${coreCoverage}% ✅\n`);
}

// Main
const contracts = getAllContracts();
const analyzedContracts = analyzeActionsCoverage(contracts);
generateReport(analyzedContracts);
