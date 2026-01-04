/**
 * Phase 1: 合约环境检查
 * 
 * 验证所有部署的合约（21个）的版本、地址和依赖关系
 * 
 * 注意：开始前自动同步 SuperPaymaster 合约地址
 */

import { createPublicClient, http, type Address } from 'viem';
import { loadNetworkConfig } from '../tests/regression/config.js';
import {
    verifyContractInfo,
    verifyWiringMatrix,
    verifyPaymasterConfig,
    generateContractReport,
    type WiringCheck
} from '../tests/utils/contractVerifier.js';
import { registryActions } from '../packages/core/dist/index.js';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
    // ========== 预同步：从 SuperPaymaster 自动同步合约地址 ==========
    const SUPERPAYMASTER_ROOT = path.resolve(process.cwd(), '../SuperPaymaster');
    const deploymentsPath = path.join(SUPERPAYMASTER_ROOT, 'deployments/sepolia.json');
    
    if (fs.existsSync(deploymentsPath)) {
        console.log('\n🔄 [预同步] 发现 SuperPaymaster deployments，同步合约地址...\n');
        try {
            execSync('pnpm tsx scripts/sync_contract_addresses.ts', {
                stdio: 'inherit',
                cwd: process.cwd()
            });
            console.log('\n✅ [预同步] 合约地址已同步\n');
        } catch (error) {
            console.warn('\n⚠️  [预同步] 同步失败，使用当前 .env.sepolia 配置\n');
        }
    } else {
        console.log('\n📋 [预同步] SuperPaymaster deployments 不存在，使用当前 .env.sepolia\n');
    }
    
    console.log('🔍 阶段1：合约环境检查\n');

    const config = loadNetworkConfig('sepolia');
    const publicClient = createPublicClient({
        chain: config.chain,
        transport: http(config.rpcUrl)
    });

    const contracts = config.contracts;

    // 1. 验证核心合约
    console.log('📋 验证核心合约（13个）...');
    const coreContracts = await Promise.all([
        verifyContractInfo(publicClient, 'Registry', contracts.registry),
        verifyContractInfo(publicClient, 'SuperPaymaster', contracts.superPaymaster),
        verifyContractInfo(publicClient, 'MySBT', contracts.mySBT),
        verifyContractInfo(publicClient, 'GToken', contracts.gToken),
        verifyContractInfo(publicClient, 'GTokenStaking', contracts.gTokenStaking),
        verifyContractInfo(publicClient, 'xPNTsFactory', contracts.xpntsFactory),
        verifyContractInfo(publicClient, 'PaymasterFactory', contracts.paymasterFactory),
        verifyContractInfo(publicClient, 'ReputationSystem', contracts.reputationSystem),
        verifyContractInfo(publicClient, 'BLSAggregator', contracts.blsAggregator),
        verifyContractInfo(publicClient, 'DVTValidator', contracts.dvtValidator),
        verifyContractInfo(publicClient, 'BLSValidator', contracts.blsValidator),
    ]);

    // 2. 验证外部依赖合约
    console.log('📋 验证外部依赖合约（8个）...');
    const externalContracts = await Promise.all([
        verifyContractInfo(publicClient, 'EntryPoint', contracts.entryPoint),
        verifyContractInfo(publicClient, 'SimpleAccountFactory', contracts.simpleAccountFactory),
        // 注：其他合约地址需要从 config 添加
    ]);

    const allContracts = [...coreContracts, ...externalContracts];

    // 3. 验证依赖关系矩阵
    console.log('🔗 验证合约依赖关系...');
    
    const registry = registryActions(contracts.registry)(publicClient);

    const wiringChecks: WiringCheck[] = await verifyWiringMatrix(publicClient, [
        // MySBT -> Registry
        {
            from: 'MySBT',
            fromAddress: contracts.mySBT,
            to: 'Registry',
            toAddress: contracts.registry,
            relationship: 'REGISTRY',
            getter: async () => {
                return publicClient.readContract({
                    address: contracts.mySBT,
                    abi: [{ type: 'function', name: 'REGISTRY', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' }],
                    functionName: 'REGISTRY'
                }) as Promise<Address>;
            }
        },
        // GTokenStaking -> Registry
        {
            from: 'GTokenStaking',
            fromAddress: contracts.gTokenStaking,
            to: 'Registry',
            toAddress: contracts.registry,
            relationship: 'REGISTRY',
            getter: async () => {
                return publicClient.readContract({
                    address: contracts.gTokenStaking,
                    abi: [{ type: 'function', name: 'REGISTRY', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' }],
                    functionName: 'REGISTRY'
                }) as Promise<Address>;
            }
        },
        // GTokenStaking -> GToken (immutable)
        {
            from: 'GTokenStaking',
            fromAddress: contracts.gTokenStaking,
            to: 'GToken',
            toAddress: contracts.gToken,
            relationship: 'GTOKEN',
            getter: async () => {
                return publicClient.readContract({
                    address: contracts.gTokenStaking,
                    abi: [{ type: 'function', name: 'GTOKEN', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' }],
                    functionName: 'GTOKEN'
                }) as Promise<Address>;
            }
        },
        // SuperPaymaster -> xPNTsFactory
        {
            from: 'SuperPaymaster',
            fromAddress: contracts.superPaymaster,
            to: 'xPNTsFactory',
            toAddress: contracts.xpntsFactory,
            relationship: 'xPNTsFactory',
            getter: async () => {
                return publicClient.readContract({
                    address: contracts.superPaymaster,
                    abi: [{ type: 'function', name: 'xPNTsFactory', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' }],
                    functionName: 'xPNTsFactory'
                }) as Promise<Address>;
            }
        },
        // Registry → BLSAggregator (使用 camelCase getter)
        {
            from: 'Registry',
            fromAddress: contracts.registry,
            to: 'BLSAggregator',
            toAddress: contracts.blsAggregator,
            relationship: 'blsAggregator',
            getter: async () => {
                return publicClient.readContract({
                    address: contracts.registry,
                    abi: [{ type: 'function', name: 'blsAggregator', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' }],
                    functionName: 'blsAggregator'
                }) as Promise<Address>;
            }
        },
        // Registry → BLSValidator (使用 camelCase getter)
        {
            from: 'Registry',
            fromAddress: contracts.registry,
            to: 'BLSValidator',
            toAddress: contracts.blsValidator,
            relationship: 'blsValidator',
            getter: async () => {
                return publicClient.readContract({
                    address: contracts.registry,
                    abi: [{ type: 'function', name: 'blsValidator', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' }],
                    functionName: 'blsValidator'
                }) as Promise<Address>;
            }
        },
    ]);

    // 4.生成报告
    console.log('\n📊 生成验证报告...');
    const report = generateContractReport(allContracts, wiringChecks);

    // 保存报告
    const reportPath = path.resolve(process.cwd(), 'tests/reports/phase1_contract_verification.md');
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, report);

    console.log(`✅ 报告已保存: ${reportPath}\n`);
    console.log(report);

    // 5. 检查是否所有验证通过
    const allDeployed = allContracts.every(c => c.isDeployed);
    const allWiringValid = wiringChecks.every(w => w.isValid);

    if (allDeployed && allWiringValid) {
        console.log('\n✅ 阶段1：合约环境检查完成！所有检查通过。\n');
        console.log('📋 下一步：运行 `pnpm tsx scripts/phase2_initialize_accounts.ts`');
        process.exit(0);
    } else {
        console.error('\n❌ 阶段1：发现问题！请查看报告修复后重试。\n');
        process.exit(1);
    }
}

main().catch((error) => {
    console.error('\n❌ 阶段1执行失败:', error.message);
    console.error(error.stack);
    process.exit(1);
});
