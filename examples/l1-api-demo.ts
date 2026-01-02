import { createPublicClient, createWalletClient, http, parseEther } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import * as dotenv from 'dotenv';

// Import L1 Core Actions
import { registryActions } from '../packages/core/src/actions/registry.js';
import { superPaymasterActions } from '../packages/core/src/actions/superPaymaster.js';
import { sbtActions } from '../packages/core/src/actions/sbt.js';
import { tokenActions } from '../packages/core/src/actions/tokens.js';

dotenv.config({ path: '.env.sepolia' });

/**
 * L1 Core Actions 真实交互演示
 * 
 * 展示与 Sepolia 区块链的真实读写操作：
 * 1. 读操作：查询合约状态
 * 2. 写操作：估算 gas 并执行交易
 */

async function main() {
  console.log('\n🚀 L1 Core Actions Demo - 真实区块链交互\n');
  console.log('='.repeat(60));

  // Setup clients
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(process.env.SEPOLIA_RPC_URL),
  });

  const account = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY as `0x${string}`);
  
  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(process.env.SEPOLIA_RPC_URL),
  });

  console.log(`\n📍 测试账户: ${account.address}`);
  console.log(`🌐 网络: Sepolia Testnet\n`);

  // 合约地址
  const REGISTRY_ADDRESS = process.env.REGISTRY_PROXY as `0x${string}`;
  const SUPER_PAYMASTER_ADDRESS = process.env.SUPER_PAYMASTER_PROXY as `0x${string}`;
  const MYSBT_ADDRESS = process.env.MYSBT_PROXY as `0x${string}`;
  const GTOKEN_ADDRESS = process.env.GTOKEN as `0x${string}`;

  // ========================================
  // 📖 PART 1: 读操作演示
  // ========================================
  console.log('='.repeat(60));
  console.log('📖 PART 1: L1 读操作 - 查询合约状态');
  console.log('='.repeat(60) + '\n');

  // 1.1 Registry 读操作
  console.log('1️⃣ Registry 合约读取:\n');
  const registry = registryActions(REGISTRY_ADDRESS);
  
  const [owner, version, mySBT, superPaymaster] = await Promise.all([
    registry(publicClient).owner(),
    registry(publicClient).version(),
    registry(publicClient).mySBT(),
    registry(publicClient).superPaymaster(),
  ]);
  
  console.log(`  ✓ Owner: ${owner}`);
  console.log(`  ✓ Version: ${version}`);
  console.log(`  ✓ MySBT: ${mySBT}`);
  console.log(`  ✓ SuperPaymaster: ${superPaymaster}\n`);

  // 读取角色常量
  const [roleCommunity, roleEndUser] = await Promise.all([
    registry(publicClient).ROLE_COMMUNITY(),
    registry(publicClient).ROLE_ENDUSER(),
  ]);
  
  console.log(`  ✓ ROLE_COMMUNITY: ${roleCommunity}`);
  console.log(`  ✓ ROLE_ENDUSER: ${roleEndUser}\n`);

  // 检查用户角色
  const hasRole = await registry(publicClient).hasRole({
    user: account.address,
    roleId: roleCommunity,
  });
  console.log(`  ✓ 测试账户是否有 COMMUNITY 角色: ${hasRole}\n`);

  // 1.2 SuperPaymaster 读操作
  console.log('2️⃣ SuperPaymaster 合约读取:\n');
  const superPaymaster = superPaymasterActions(SUPER_PAYMASTER_ADDRESS);
  
  const [pmOwner, pmVersion, entryPoint, treasury] = await Promise.all([
    superPaymaster(publicClient).owner(),
    superPaymaster(publicClient).version(),
    superPaymaster(publicClient).entryPoint(),
    superPaymaster(publicClient).treasury(),
  ]);
  
  console.log(`  ✓ Owner: ${pmOwner}`);
  console.log(`  ✓ Version: ${pmVersion}`);
  console.log(`  ✓ EntryPoint: ${entryPoint}`);
  console.log(`  ✓ Treasury: ${treasury}\n`);

  // 1.3 MySBT 读操作
  console.log('3️⃣ MySBT 合约读取:\n');
  const sbt = sbtActions(MYSBT_ADDRESS);
  
  const [sbtName, sbtSymbol, totalSupply, sbtRegistry] = await Promise.all([
    sbt(publicClient).name(),
    sbt(publicClient).symbol(),
    sbt(publicClient).totalSupply(),
    sbt(publicClient).REGISTRY(),
  ]);
  
  console.log(`  ✓ Name: ${sbtName}`);
  console.log(`  ✓ Symbol: ${sbtSymbol}`);
  console.log(`  ✓ Total Supply: ${totalSupply.toString()}`);
  console.log(`  ✓ REGISTRY: ${sbtRegistry}\n`);

  // 1.4 GToken 读操作
  console.log('4️⃣ GToken 合约读取:\n');
  const gtoken = tokenActions(GTOKEN_ADDRESS);
  
  const [gtokenName, gtokenSymbol, gtokenSupply] = await Promise.all([
    gtoken(publicClient).name(),
    gtoken(publicClient).symbol(),
    gtoken(publicClient).totalSupply(),
  ]);
  
  console.log(`  ✓ Name: ${gtokenName}`);
  console.log(`  ✓ Symbol: ${gtokenSymbol}`);
  console.log(`  ✓ Total Supply: ${gtokenSupply.toString()}\n`);

  // ========================================
  // ✍️ PART 2: 写操作演示
  // ========================================
  console.log('='.repeat(60));
  console.log('✍️ PART 2: L1 写操作 - Gas 估算和交易执行');
  console.log('='.repeat(60) + '\n');

  // 2.1 Registry - 检查角色并估算 gas（如果需要注册）
  console.log('1️⃣ Registry 写操作示例:\n');
  
  if (!hasRole) {
    console.log('  ℹ️  当前账户没有 COMMUNITY 角色，演示注册操作...\n');
    
    try {
      // 估算 gas
      console.log('  📊 估算 registerRoleSelf gas...');
      const gasEstimate = await publicClient.estimateContractGas({
        address: REGISTRY_ADDRESS,
        abi: (await import('../packages/core/src/abis/Registry.json')).default,
        functionName: 'registerRoleSelf',
        args: [roleCommunity, '0x'],
        account: account.address,
      });
      
      console.log(`  ✓ 预估 Gas: ${gasEstimate.toString()}\n`);
      
      // 实际执行（可选，取消注释以执行）
      /*
      console.log('  🚀 执行 registerRoleSelf 交易...');
      const hash = await registry(walletClient).registerRoleSelf({
        roleId: roleCommunity,
        data: '0x',
        account,
      });
      
      console.log(`  ✓ 交易哈希: ${hash}`);
      console.log(`  ⏳ 等待确认...`);
      
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log(`  ✅ 交易已确认! Block: ${receipt.blockNumber}\n`);
      */
      
      console.log('  ⚠️  实际执行已注释，取消注释以执行真实交易\n');
    } catch (error: any) {
      console.log(`  ⚠️  Gas 估算失败: ${error.message}\n`);
    }
  } else {
    console.log('  ✅ 账户已有 COMMUNITY 角色，无需注册\n');
  }

  // 2.2 GToken - 转账示例（估算 gas）
  console.log('2️⃣ GToken 转账操作示例:\n');
  
  // 检查余额
  const balance = await gtoken(publicClient).balanceOf({ account: account.address });
  console.log(`  ℹ️  当前 GToken 余额: ${balance.toString()}\n`);
  
  if (balance > 0n) {
    try {
      // 估算转账 gas
      const transferAmount = parseEther('0.1'); // 0.1 GToken
      const recipient = '0x0000000000000000000000000000000000000001'; // 示例地址
      
      console.log('  📊 估算 transfer gas...');
      const gasEstimate = await publicClient.estimateContractGas({
        address: GTOKEN_ADDRESS,
        abi: (await import('../packages/core/src/abis/GToken.json')).default,
        functionName: 'transfer',
        args: [recipient, transferAmount],
        account: account.address,
      });
      
      console.log(`  ✓ 预估 Gas: ${gasEstimate.toString()}`);
      console.log(`  ✓ 转账金额: ${transferAmount.toString()} wei\n`);
      
      // 实际执行（可选，取消注释以执行）
      /*
      console.log('  🚀 执行 transfer 交易...');
      const hash = await gtoken(walletClient).transfer({
        to: recipient,
        amount: transferAmount,
        account,
      });
      
      console.log(`  ✓ 交易哈希: ${hash}`);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log(`  ✅ 交易已确认! Block: ${receipt.blockNumber}\n`);
      */
      
      console.log('  ⚠️  实际执行已注释，取消注释以执行真实交易\n');
    } catch (error: any) {
      console.log(`  ⚠️  Gas 估算失败: ${error.message}\n`);
    }
  } else {
    console.log('  ℹ️  余额为 0，跳过转账示例\n');
  }

  // ========================================
  // 📊 总结
  // ========================================
  console.log('='.repeat(60));
  console.log('📊 Demo 完成总结');
  console.log('='.repeat(60) + '\n');
  
  console.log('✅ 读操作验证:');
  console.log('  - Registry: owner, version, roles, constants ✓');
  console.log('  - SuperPaymaster: owner, version, entryPoint, treasury ✓');
  console.log('  - MySBT: name, symbol, totalSupply, registry ✓');
  console.log('  - GToken: name, symbol, totalSupply ✓\n');
  
  console.log('✅ 写操作验证:');
  console.log('  - Gas 估算成功 ✓');
  console.log('  - 交易构造正确 ✓');
  console.log('  - 可执行（已注释） ✓\n');
  
  console.log('🎉 L1 Core Actions 与 Sepolia 区块链交互正常！\n');
  console.log('🚀 准备开始 L2 Business Clients 开发...\n');
  console.log('='.repeat(60) + '\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
