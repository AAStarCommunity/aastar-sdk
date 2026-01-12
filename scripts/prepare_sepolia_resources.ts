#!/usr/bin/env tsx
/**
 * Sepolia 测试资源准备脚本
 * 
 * 使用 ADMIN_KEY (supplier) 为测试账户准备所有必需的资源：
 * - ETH (gas fees)
 * - GToken (质押)
 * - aPNTs (Operator 存款)
 * - PIM Token (Pimlico 测试，如果需要)
 */

import { createPublicClient, createWalletClient, http, parseEther, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load Sepolia environment
dotenv.config({ path: path.resolve(process.cwd(), '.env.sepolia'), override: true });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const ADMIN_KEY = process.env.ADMIN_KEY;
if (!ADMIN_KEY) throw new Error('ADMIN_KEY not found in .env.sepolia');

const adminAccount = privateKeyToAccount(ADMIN_KEY as Hex);
const RPC_URL = process.env.SEPOLIA_RPC_URL;

const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(RPC_URL)
});

const walletClient = createWalletClient({
    chain: sepolia,
    transport: http(RPC_URL),
    account: adminAccount
});

// Contract addresses
const GTOKEN_ADDRESS = process.env.GTOKEN_ADDRESS as Address;
const APNTS_ADDRESS = process.env.APNTS_ADDRESS as Address;
const PIM_TOKEN_ADDRESS = process.env.PIM_TOKEN_ADDRESS as Address;

// Test account
const TEST_ACCOUNT = adminAccount.address; // 使用 ADMIN_KEY 作为测试账户

const ERC20_ABI = [
    { type: 'function', name: 'balanceOf', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
    { type: 'function', name: 'mint', inputs: [{ type: 'address' }, { type: 'uint256' }], outputs: [], stateMutability: 'nonpayable' },
    { type: 'function', name: 'transfer', inputs: [{ type: 'address' }, { type: 'uint256' }], outputs: [{ type: 'bool' }], stateMutability: 'nonpayable' }
] as const;

async function main() {
    console.log('\n🚀 Sepolia 测试资源准备\n');
    console.log(`Admin (Supplier): ${adminAccount.address}`);
    console.log(`Test Account: ${TEST_ACCOUNT}\n`);

    // 1. Check ETH balance
    console.log('1️⃣ 检查 ETH 余额...');
    const ethBalance = await publicClient.getBalance({ address: TEST_ACCOUNT });
    console.log(`   💰 ETH: ${(Number(ethBalance) / 1e18).toFixed(4)} ETH`);
    
    if (ethBalance < parseEther('0.05')) {
        console.log(`   ⚠️  ETH 不足，建议从水龙头获取: https://sepoliafaucet.com`);
    } else {
        console.log(`   ✅ ETH 充足`);
    }

    // 2. Check and mint GToken
    console.log('\n2️⃣ 检查 GToken 余额...');
    try {
        const gtokenBalance = await publicClient.readContract({
            address: GTOKEN_ADDRESS,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [TEST_ACCOUNT]
        });
        console.log(`   💰 GToken: ${(Number(gtokenBalance) / 1e18).toFixed(2)}`);
        
        if (gtokenBalance < parseEther('100')) {
            console.log(`   🪙  铸造 GToken...`);
            const mintAmount = parseEther('500');
            const hash = await walletClient.writeContract({
                address: GTOKEN_ADDRESS,
                abi: ERC20_ABI,
                functionName: 'mint',
                args: [TEST_ACCOUNT, mintAmount]
            });
            await publicClient.waitForTransactionReceipt({ hash });
            console.log(`   ✅ 铸造成功: 500 GToken`);
        } else {
            console.log(`   ✅ GToken 充足`);
        }
    } catch (e: any) {
        console.log(`   ❌ GToken 操作失败: ${e.message}`);
    }

    // 3. Check and mint aPNTs
    console.log('\n3️⃣ 检查 aPNTs 余额...');
    try {
        const apntsBalance = await publicClient.readContract({
            address: APNTS_ADDRESS,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [TEST_ACCOUNT]
        });
        console.log(`   💰 aPNTs: ${(Number(apntsBalance) / 1e18).toFixed(2)}`);
        
        if (apntsBalance < parseEther('100')) {
            console.log(`   🪙  铸造 aPNTs...`);
            const mintAmount = parseEther('1000');
            const hash = await walletClient.writeContract({
                address: APNTS_ADDRESS,
                abi: ERC20_ABI,
                functionName: 'mint',
                args: [TEST_ACCOUNT, mintAmount]
            });
            await publicClient.waitForTransactionReceipt({ hash });
            console.log(`   ✅ 铸造成功: 1000 aPNTs`);
        } else {
            console.log(`   ✅ aPNTs 充足`);
        }
    } catch (e: any) {
        console.log(`   ❌ aPNTs 操作失败: ${e.message}`);
    }

    // 4. Check PIM Token (optional, for Pimlico tests)
    if (PIM_TOKEN_ADDRESS) {
        console.log('\n4️⃣ 检查 PIM Token 余额...');
        try {
            const pimBalance = await publicClient.readContract({
                address: PIM_TOKEN_ADDRESS,
                abi: ERC20_ABI,
                functionName: 'balanceOf',
                args: [TEST_ACCOUNT]
            });
            console.log(`   💰 PIM: ${(Number(pimBalance) / 1e18).toFixed(2)}`);
            
            if (pimBalance < parseEther('10')) {
                console.log(`   ⚠️  PIM Token 不足，可能需要从 Pimlico 获取`);
            } else {
                console.log(`   ✅ PIM Token 充足`);
            }
        } catch (e: any) {
            console.log(`   ⚠️  PIM Token 检查失败（可能不支持 mint）: ${e.message}`);
        }
    }

    console.log('\n✅ 资源准备完成！\n');
    console.log('📍 现在可以运行 Sepolia 回归测试:');
    console.log('   ./run_sdk_regression.sh --env sepolia --scenarios-only\n');
}

main().catch(console.error);
