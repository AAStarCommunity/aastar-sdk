import { createPublicClient, createWalletClient, http, parseEther } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import * as dotenv from 'dotenv';

// Import L1 Core Actions through SDK if possible, or Core directly
import { 
    registryActions, 
    superPaymasterActions, 
    sbtActions, 
    tokenActions 
} from '@aastar/core'; 
// Note: imports changed from relative path to package request
// This assumes 'pnpm link' or workspace resolution works

import RegistryABI from '@aastar/core/dist/abis/Registry.json' with { type: 'json' };
import GTokenABI from '@aastar/core/dist/abis/GToken.json' with { type: 'json' };

dotenv.config({ path: '.env.sepolia' });

async function main() {
  console.log('\n🚀 L1 Core Actions Demo - 真实区块链交互\n');
  console.log('='.repeat(60));

  // Setup clients
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(process.env.SEPOLIA_RPC_URL),
  });

  // Use ADMIN_KEY as existing key in .env.sepolia
  const privateKey = process.env.ADMIN_KEY as `0x${string}`;
  if (!privateKey) throw new Error('ADMIN_KEY not found in .env.sepolia');

  const account = privateKeyToAccount(privateKey);
  
  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(process.env.SEPOLIA_RPC_URL),
  });

  console.log(`\n📍 测试账户: ${account.address}`);
  console.log(`🌐 网络: Sepolia Testnet\n`);

  // 合约地址
  const REGISTRY_ADDRESS = (process.env.REGISTRY_ADDRESS || process.env.REGISTRY) as `0x${string}`;
  const SUPER_PAYMASTER_ADDRESS = (process.env.SUPER_PAYMASTER || process.env.PAYMASTER_SUPER) as `0x${string}`;
  const MYSBT_ADDRESS = process.env.MYSBT_ADDRESS as `0x${string}`;
  const GTOKEN_ADDRESS = process.env.GTOKEN_ADDRESS as `0x${string}`;

  if (!REGISTRY_ADDRESS || !SUPER_PAYMASTER_ADDRESS || !MYSBT_ADDRESS || !GTOKEN_ADDRESS) {
    console.error('Missing contract addresses:', {
      REGISTRY: REGISTRY_ADDRESS,
      SUPER_PAYMASTER: SUPER_PAYMASTER_ADDRESS,
      MYSBT: MYSBT_ADDRESS,
      GTOKEN: GTOKEN_ADDRESS
    });
    console.warn('⚠️ Warning: Some checks might fail due to missing addresses.');
  }

  // ========================================
  // 📖 PART 1: 读操作演示
  // ========================================
  console.log('='.repeat(60));
  console.log('📖 PART 1: L1 读操作 - 查询合约状态');
  console.log('='.repeat(60) + '\n');

  if (REGISTRY_ADDRESS) {
      // 1.1 Registry 读操作
      console.log('1️⃣ Registry 合约读取:\n');
      const registry = registryActions(REGISTRY_ADDRESS);
      
      const [owner, version] = await Promise.all([
        registry(publicClient).owner(),
        registry(publicClient).version(),
      ]);
      
      console.log(`  ✓ Owner: ${owner}`);
      console.log(`  ✓ Version: ${version}`);

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
  }

  // 1.2 SuperPaymaster 读操作
  if (SUPER_PAYMASTER_ADDRESS) {
      console.log('2️⃣ SuperPaymaster 合约读取:\n');
      const spActions = superPaymasterActions(SUPER_PAYMASTER_ADDRESS);
      
      const [pmOwner, pmVersion] = await Promise.all([
        spActions(publicClient).owner(),
        spActions(publicClient).version(),
      ]);
      
      console.log(`  ✓ Owner: ${pmOwner}`);
      console.log(`  ✓ Version: ${pmVersion}\n`);
  }

  // 1.3 MySBT 读操作
  if (MYSBT_ADDRESS) {
      console.log('3️⃣ MySBT 合约读取:\n');
      const sbt = sbtActions(MYSBT_ADDRESS);
      
      const [sbtName, sbtSymbol] = await Promise.all([
        sbt(publicClient).name(),
        sbt(publicClient).symbol(),
      ]);
      
      console.log(`  ✓ Name: ${sbtName}`);
      console.log(`  ✓ Symbol: ${sbtSymbol}\n`);
  }

  // 1.4 GToken 读操作
  if (GTOKEN_ADDRESS) {
      console.log('4️⃣ GToken 合约读取:\n');
      const tokens = tokenActions()(publicClient); 
      
      const [gtokenName, gtokenSymbol] = await Promise.all([
        tokens.name({ token: GTOKEN_ADDRESS }),
        tokens.symbol({ token: GTOKEN_ADDRESS }),
      ]);
      
      console.log(`  ✓ Name: ${gtokenName}`);
      console.log(`  ✓ Symbol: ${gtokenSymbol}\n`);
  }

  // ========================================
  // ✍️ PART 2: 写操作演示 (Gas Estimate Only)
  // ========================================
  console.log('='.repeat(60));
  console.log('✍️ PART 2: L1 写操作 - Gas 估算');
  console.log('='.repeat(60) + '\n');

  if (GTOKEN_ADDRESS) {
      // 2.2 GToken - 转账示例（估算 gas）
      console.log('1️⃣ GToken 转账操作示例:\n');
      
      const tokens = tokenActions()(publicClient); 
      const balance = await tokens.balanceOf({ token: GTOKEN_ADDRESS, account: account.address });
      console.log(`  ℹ️  当前 GToken 余额: ${balance.toString()}\n`);
      
      if (balance > 0n) {
        try {
          // 估算转账 gas
          const transferAmount = parseEther('0.1'); // 0.1 GToken
          const recipient = '0x0000000000000000000000000000000000000001'; 
          
          console.log('  📊 估算 transfer gas...');
          const gasEstimate = await publicClient.estimateContractGas({
            address: GTOKEN_ADDRESS,
            abi: GTokenABI.abi,
            functionName: 'transfer',
            args: [recipient, transferAmount],
            account: account.address,
          });
          
          console.log(`  ✓ 预估 Gas: ${gasEstimate.toString()}`);
        } catch (error: any) {
          console.log(`  ⚠️  Gas 估算失败 (可能余额不足或 ABI 问题): ${error.message.split('\n')[0]}\n`);
        }
      }
  }

  console.log('\n🎉 L1 Demo Execution Finished!');
}

main().catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
});
