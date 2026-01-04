/**
 * 预测试同步脚本
 * 
 * 在回归测试开始前自动同步 SuperPaymaster 合约地址
 * 只更新合约地址，不覆盖其他环境变量（如私钥、RPC_URL 等）
 */

import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

const SUPERPAYMASTER_ROOT = path.resolve(process.cwd(), '../SuperPaymaster');
const deploymentsPath = path.join(SUPERPAYMASTER_ROOT, 'deployments/sepolia.json');

console.log('\n🔄 预测试同步检查\n');

// 检查 SuperPaymaster deployments 是否存在
if (fs.existsSync(deploymentsPath)) {
    console.log('📋 发现 SuperPaymaster deployments，同步合约地址...\n');
    
    try {
        // 运行同步脚本
        execSync('pnpm tsx scripts/sync_contract_addresses.ts', {
            stdio: 'inherit',
            cwd: process.cwd()
        });
        
        console.log('\n✅ 合约地址同步完成\n');
    } catch (error) {
        console.error('\n❌ 同步失败，使用当前 .env.sepolia 配置继续\n');
    }
} else {
    console.log('⚠️  SuperPaymaster deployments 不存在，使用当前 .env.sepolia 配置\n');
}
