/**
 * 同步合约地址和 ABI：从 SuperPaymaster 更新到 SDK
 * 
 * 同步内容：
 * 1. deployments/sepolia.json -> SDK .env.sepolia (合约地址)  
 * 2. abis/*.json -> SDK packages/core/src/abis/*.json (核心合约 ABI - 13个)
 * 3. out/*.sol/*.json -> SDK packages/core/src/abis/*.json (AA 标准 ABI - 3个)
 * 
 * 命名策略：
 * - 文件名：使用 SuperPaymaster 原始名称（带版本号，如 BLSAggregatorV3.json）
 * - 导出别名：在 index.ts 中提供无版本号别名（向后兼容）
 */

import * as fs from 'fs';
import * as path from 'path';

const SUPERPAYMASTER_ROOT = path.resolve(process.cwd(), '../SuperPaymaster');
const SDK_ROOT = process.cwd();

async function main() {
    console.log('\n🔄 同步 SuperPaymaster 配置到 SDK\n');

    // ========== 1. 同步 deployments/sepolia.json 合约地址 ==========
    console.log('📋 步骤 1: 同步合约地址 (deployments/sepolia.json)\n');
    
    const deploymentsPath = path.join(SUPERPAYMASTER_ROOT, 'deployments/sepolia.json');
    if (!fs.existsSync(deploymentsPath)) {
        console.error(`❌ Deployments file not found: ${deploymentsPath}`);
        process.exit(1);
    }
    
    const deployments = JSON.parse(fs.readFileSync(deploymentsPath, 'utf8'));
    console.log('✅ SuperPaymaster 合约地址:');
    console.log(JSON.stringify(deployments, null, 2));

    // 读取当前 SDK .env.sepolia
    const sdkEnvPath = path.join(SDK_ROOT, '.env.sepolia');
    let envContent = fs.readFileSync(sdkEnvPath, 'utf8');

    // 更新合约地址
    const addressUpdates: Record<string, string> = {
        'REGISTRY_ADDRESS': deployments.registry,
        'GTOKEN_ADDRESS': deployments.gToken,
        'GTOKEN_STAKING_ADDRESS': deployments.staking,
        'SBT_ADDRESS': deployments.sbt,
        'REPUTATION_ADDRESS': deployments.reputationSystem,
        'SUPER_PAYMASTER_ADDRESS': deployments.superPaymaster,
        'XPNTS_FACTORY_ADDRESS': deployments.xPNTsFactory,
        'PAYMASTER_FACTORY_ADDRESS': deployments.paymasterFactory,
        'BLS_AGGREGATOR_ADDRESS': deployments.blsAggregator,
        'BLS_VALIDATOR_ADDRESS': deployments.blsValidator,
        'DVT_VALIDATOR_ADDRESS': deployments.dvtValidator,
        'ENTRY_POINT_ADDRESS': deployments.entryPoint,
        'APNTS_ADDRESS': deployments.aPNTs,
    };

    console.log('\n✏️  更新 SDK .env.sepolia 合约地址:');
    for (const [key, value] of Object.entries(addressUpdates)) {
        const regex = new RegExp(`${key}=.*`, 'g');
        if (envContent.match(regex)) {
            envContent = envContent.replace(regex, `${key}=${value}`);
            console.log(`  ✅ ${key}=${value}`);
        } else {
            const insertPoint = envContent.indexOf('# Contract Addresses');
            if (insertPoint !== -1) {
                const endOfSection = envContent.indexOf('\n\n', insertPoint);
                envContent = envContent.slice(0, endOfSection) + `\n${key}=${value}` + envContent.slice(endOfSection);
                console.log(`  ➕ ${key}=${value}`);
            }
        }
    }

    fs.writeFileSync(sdkEnvPath, envContent, 'utf8');
    console.log(`\n✅ 合约地址已更新: ${sdkEnvPath}`);

    // ========== 2. 同步 ABI 文件 ==========
    console.log('\n📋 步骤 2: 同步 ABI 文件\n');
    
    const sdkAbisDir = path.join(SDK_ROOT, 'packages/core/src/abis');
    
    // 2.1 同步核心合约 ABI (13个) - 从 abis/
    console.log('  2.1 核心合约 ABI (13个) - 从 SuperPaymaster/abis/\n');
    
    const superpaymasterAbisDir = path.join(SUPERPAYMASTER_ROOT, 'abis');
    if (!fs.existsSync(superpaymasterAbisDir)) {
        console.warn(`⚠️  SuperPaymaster abis directory not found`);
    } else {
        const coreAbiFiles = fs.readdirSync(superpaymasterAbisDir).filter(f => f.endsWith('.json'));
        let coreCount = 0;
        
        for (const file of coreAbiFiles) {
            const sourcePath = path.join(superpaymasterAbisDir, file);
            const targetPath = path.join(sdkAbisDir, file);
            
            try {
                fs.copyFileSync(sourcePath, targetPath);
                console.log(`    ✅ ${file}`);
                coreCount++;
            } catch (error: any) {
                console.error(`    ❌ ${file}: ${error.message}`);
            }
        }
        
        console.log(`\n  ✅ 核心 ABI: ${coreCount}/${coreAbiFiles.length} 个文件\n`);
    }

    // 2.2 提取 AA 标准 ABI (3个) - 从 out/
    console.log('  2.2 AA 标准 ABI (3个) - 从 SuperPaymaster/out/\n');
    
    const outDir = path.join(SUPERPAYMASTER_ROOT, 'out');
    const aaAbis = [
        { contract: 'EntryPoint', solFile: 'EntryPoint.sol', abiFile: 'EntryPoint.json' },
        { contract: 'SimpleAccount', solFile: 'SimpleAccount.sol', abiFile: 'SimpleAccount.json' },
        { contract: 'SimpleAccountFactory', solFile: 'SimpleAccountFactory.sol', abiFile: 'SimpleAccountFactory.json' }
    ];
    
    let aaCount = 0;
    for (const { contract, solFile, abiFile } of aaAbis) {
        const sourcePath = path.join(outDir, solFile, abiFile);
        const targetPath = path.join(sdkAbisDir, abiFile);
        
        try {
            if (fs.existsSync(sourcePath)) {
                // 读取 Foundry 完整输出，提取 ABI 字段
                const foundryOutput = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
                const abi = foundryOutput.abi;
                
                if (abi && Array.isArray(abi)) {
                    // 写入纯 ABI 数组
                    fs.writeFileSync(targetPath, JSON.stringify(abi, null, 2));
                    console.log(`    ✅ ${abiFile} (从 ${solFile} 提取)`);
                    aaCount++;
                } else {
                    console.error(`    ❌ ${abiFile}: ABI 字段无效`);
                }
            } else {
                console.warn(`    ⚠️  ${abiFile}: 源文件不存在`);
            }
        } catch (error: any) {
            console.error(`    ❌ ${abiFile}: ${error.message}`);
        }
    }
    
    console.log(`\n  ✅ AA 标准 ABI: ${aaCount}/3 个文件\n`);
    
    console.log(`✅ ABI 同步完成`);
    console.log(`   目标目录: ${sdkAbisDir}`);

    // ========== 3. .env.sepolia 完整同步（可选）==========
    console.log('\n📋 步骤 3: 完整环境配置同步 (.env.sepolia)\n');
    
    const superpaymasterEnvPath = path.join(SUPERPAYMASTER_ROOT, '.env.sepolia');
    
    if (!fs.existsSync(superpaymasterEnvPath)) {
        console.warn(`⚠️  SuperPaymaster .env.sepolia not found`);
        console.warn(`   跳过环境配置同步（仅合约地址已更新）`);
    } else {
        console.log(`📄 发现 SuperPaymaster .env.sepolia`);
        console.log(`   提示: 如需完整同步环境配置（包括 RPC_URL 等），可手动复制：`);
        console.log(`   cp ${superpaymasterEnvPath} ${sdkEnvPath}`);
        console.log(`   注意: 这会覆盖 SDK 的私钥配置，谨慎操作！`);
    }

    console.log('\n✅ 同步完成！\n');
    console.log('📋 重要提示：');
    console.log('   - 核心合约使用带版本号的文件名（如 BLSAggregatorV3.json）');
    console.log('   - 在 packages/core/src/abis/index.ts 中提供无版本号别名');
    console.log('   - 避免重复文件，保持命名统一\n');
    console.log('📋 下一步：运行 pnpm tsx scripts/phase1_verify_contracts.ts 验证\n');
}

main().catch(console.error);
