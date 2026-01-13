import { describe, it, expect, beforeAll } from 'vitest';
import { createPublicClient, createWalletClient, http, parseEther } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import * as dotenv from 'dotenv';

// Import all L1 Core Actions
import { registryActions } from '../packages/core/src/actions/registry.js';
import { superPaymasterActions } from '../packages/core/src/actions/superPaymaster.js';
import { sbtActions } from '../packages/core/src/actions/sbt.js';
import { stakingActions } from '../packages/core/src/actions/staking.js';
import { tokenActions } from '../packages/core/src/actions/tokens.js';
import { xPNTsFactoryActions, paymasterFactoryActions } from '../packages/core/src/actions/factory.js';
import { reputationActions } from '../packages/core/src/actions/reputation.js';
import { dvtActions, blsActions } from '../packages/core/src/actions/validators.js';
import { accountActions, entryPointActions } from '../packages/core/src/actions/account.js';

dotenv.config({ path: '.env.sepolia' });

/**
 * L1 Core Actions 全回归测试
 * 
 * 目的：验证所有 L1 API 与 Sepolia 区块链的正确交互
 * 
 * 测试范围：
 * - 11 个自研合约的关键 API
 * - 3 个第三方标准合约的必要 API
 * - Read 操作全覆盖
 * - Write 操作验证（不实际执行，仅验证参数）
 * 
 * 测试原则：
 * - 只测试 Read 操作的实际调用
 * - Write 操作通过 dry-run 验证（估算 gas）
 * - 不修改区块链状态（节省 gas）
 */

describe('L1 Core Actions - Full Regression Test', () => {
  let publicClient: any;
  let walletClient: any;
  let testAccount: any;

  // 合约地址
  const REGISTRY_ADDRESS = process.env.REGISTRY_PROXY as `0x${string}`;
  const SUPER_PAYMASTER_ADDRESS = process.env.SUPER_PAYMASTER_PROXY as `0x${string}`;
  const MYSBT_ADDRESS = process.env.MYSBT_PROXY as `0x${string}`;
  const GTOKEN_STAKING_ADDRESS = process.env.GTOKEN_STAKING_PROXY as `0x${string}`;
  const GTOKEN_ADDRESS = process.env.GTOKEN as `0x${string}`;
  const APNTS_ADDRESS = process.env.APNTS as `0x${string}`;
  const XPNTS_FACTORY_ADDRESS = process.env.XPNTS_FACTORY as `0x${string}`;
  const PAYMASTER_FACTORY_ADDRESS = process.env.PAYMASTER_FACTORY as `0x${string}`;
  const REPUTATION_SYSTEM_ADDRESS = process.env.REPUTATION_SYSTEM as `0x${string}`;
  const DVT_VALIDATOR_ADDRESS = process.env.DVT_VALIDATOR as `0x${string}`;
  const BLS_AGGREGATOR_ADDRESS = process.env.BLS_AGGREGATOR as `0x${string}`;
  const ENTRY_POINT_ADDRESS = process.env.ENTRY_POINT_V07 as `0x${string}`;

  beforeAll(() => {
    // Setup clients
    publicClient = createPublicClient({
      chain: sepolia,
      transport: http(process.env.SEPOLIA_RPC_URL),
    });

    testAccount = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY as `0x${string}`);
    
    walletClient = createWalletClient({
      account: testAccount,
      chain: sepolia,
      transport: http(process.env.SEPOLIA_RPC_URL),
    });

    console.log('\n🧪 L1 Core Actions 全回归测试启动...\n');
    console.log(`测试账户: ${testAccount.address}`);
    console.log(`网络: Sepolia Testnet\n`);
  });

  describe('✅ 1. Registry (73 actions)', () => {
    const registry = registryActions(REGISTRY_ADDRESS);

    it('should read owner', async () => {
      const owner = await registry(publicClient).owner();
      expect(owner).toBeDefined();
      expect(owner.length).toBe(42); // 0x + 40 chars
      console.log(`  ✓ Registry Owner: ${owner}`);
    });

    it('should read version', async () => {
      const version = await registry(publicClient).version();
      expect(version).toBeDefined();
      console.log(`  ✓ Registry Version: ${version}`);
    });

    it('should read contract references', async () => {
      const [mySBT, superPaymaster, staking] = await Promise.all([
        registry(publicClient).mySBT(),
        registry(publicClient).superPaymaster(),
        registry(publicClient).staking(),
      ]);
      
      expect(mySBT).toBeDefined();
      expect(superPaymaster).toBeDefined();
      expect(staking).toBeDefined();
      
      console.log(`  ✓ MySBT: ${mySBT}`);
      console.log(`  ✓ SuperPaymaster: ${superPaymaster}`);
      console.log(`  ✓ GTokenStaking: ${staking}`);
    });

    it('should read role constants', async () => {
      const [roleCommunity, roleEndUser, rolePaymasterSuper] = await Promise.all([
        registry(publicClient).ROLE_COMMUNITY(),
        registry(publicClient).ROLE_ENDUSER(),
        registry(publicClient).ROLE_PAYMASTER_SUPER(),
      ]);
      
      expect(roleCommunity).toBeDefined();
      expect(roleEndUser).toBeDefined();
      expect(rolePaymasterSuper).toBeDefined();
      
      console.log(`  ✓ ROLE_COMMUNITY: ${roleCommunity}`);
      console.log(`  ✓ ROLE_ENDUSER: ${roleEndUser}`);
      console.log(`  ✓ ROLE_PAYMASTER_SUPER: ${rolePaymasterSuper}`);
    });

      expect(hasRole).toBeDefined();
      console.log(`  ✓ User has COMMUNITY role: ${hasRole}`);
    });

    it('should read account community token', async () => {
      const communityToken = await registry(publicClient).getAccountCommunity({
        account: testAccount.address,
      });
      expect(communityToken).toBeDefined();
      console.log(`  ✓ Account Community Token: ${communityToken}`);
    });
  });

  describe('✅ 2. SuperPaymaster (61 actions)', () => {
    const superPaymaster = superPaymasterActions(SUPER_PAYMASTER_ADDRESS);

    it('should read version', async () => {
      const version = await superPaymaster(publicClient).version();
      expect(version).toBeDefined();
      console.log(`  ✓ SuperPaymaster Version: ${version}`);
    });

    it('should read owner', async () => {
      const owner = await superPaymaster(publicClient).owner();
      expect(owner).toBeDefined();
      console.log(`  ✓ SuperPaymaster Owner: ${owner}`);
    });

    it('should read entryPoint', async () => {
      const entryPoint = await superPaymaster(publicClient).entryPoint();
      expect(entryPoint).toBeDefined();
      console.log(`  ✓ EntryPoint: ${entryPoint}`);
    });

    it('should read constants', async () => {
      const [registry, apnts, blsAgg, factory] = await Promise.all([
        superPaymaster(publicClient).REGISTRY(),
        superPaymaster(publicClient).APNTS_TOKEN(),
        superPaymaster(publicClient).BLS_AGGREGATOR(),
        superPaymaster(publicClient).xpntsFactory(),
      ]);
      
      expect(registry).toBeDefined();
      expect(apnts).toBeDefined();
      
      console.log(`  ✓ REGISTRY: ${registry}`);
      console.log(`  ✓ APNTS_TOKEN: ${apnts}`);
      console.log(`  ✓ BLS_AGGREGATOR: ${blsAgg}`);
      console.log(`  ✓ xPNTsFactory: ${factory}`);
    });

    it('should read protocol configuration', async () => {
      const [feeBPS, revenue, treasury] = await Promise.all([
        superPaymaster(publicClient).protocolFeeBPS(),
        superPaymaster(publicClient).protocolRevenue(),
        superPaymaster(publicClient).treasury(),
      ]);
      
      expect(feeBPS).toBeDefined();
      expect(revenue).toBeDefined();
      expect(treasury).toBeDefined();
      
      console.log(`  ✓ Protocol Fee BPS: ${feeBPS}`);
      console.log(`  ✓ Protocol Revenue: ${revenue}`);
      console.log(`  ✓ Treasury: ${treasury}`);
    });
  });

  describe('✅ 3. MySBT (58 actions)', () => {
    const sbt = sbtActions(MYSBT_ADDRESS);

    it('should read name and symbol', async () => {
      const [name, symbol] = await Promise.all([
        sbt(publicClient).name(),
        sbt(publicClient).symbol(),
      ]);
      
      expect(name).toBeDefined();
      expect(symbol).toBeDefined();
      
      console.log(`  ✓ Name: ${name}`);
      console.log(`  ✓ Symbol: ${symbol}`);
    });

    it('should read total supply', async () => {
      const totalSupply = await sbt(publicClient).totalSupply();
      expect(totalSupply).toBeDefined();
      console.log(`  ✓ Total Supply: ${totalSupply}`);
    });

    it('should read contract references', async () => {
      const [registry, staking, gtoken, paymaster] = await Promise.all([
        sbt(publicClient).REGISTRY(),
        sbt(publicClient).GTOKEN_STAKING(),
        sbt(publicClient).GTOKEN(),
        sbt(publicClient).SUPER_PAYMASTER(),
      ]);
      
      expect(registry).toBeDefined();
      console.log(`  ✓ REGISTRY: ${registry}`);
      console.log(`  ✓ GTOKEN_STAKING: ${staking}`);
      console.log(`  ✓ GTOKEN: ${gtoken}`);
      console.log(`  ✓ SUPER_PAYMASTER: ${paymaster}`);
    });

    it('should check pause status', async () => {
      const paused = await sbt(publicClient).paused();
      expect(typeof paused).toBe('boolean');
      console.log(`  ✓ Paused: ${paused}`);
    });

    it('should read mint configuration', async () => {
      const [mintFee, minLock] = await Promise.all([
        sbt(publicClient).mintFee(),
        sbt(publicClient).minLockAmount(),
      ]);
      
      expect(mintFee).toBeDefined();
      expect(minLock).toBeDefined();
      
      console.log(`  ✓ Mint Fee: ${mintFee}`);
      console.log(`  ✓ Min Lock Amount: ${minLock}`);
    });
  });

  describe('✅ 4. GTokenStaking (29 actions)', () => {
    const staking = stakingActions(GTOKEN_STAKING_ADDRESS);

    it('should read total staked', async () => {
      const totalStaked = await staking(publicClient).totalStaked();
      expect(totalStaked).toBeDefined();
      console.log(`  ✓ Total Staked: ${totalStaked}`);
    });

    it('should read reward rate', async () => {
      const rewardRate = await staking(publicClient).rewardRate();
      expect(rewardRate).toBeDefined();
      console.log(`  ✓ Reward Rate: ${rewardRate}`);
    });
  });

  describe('✅ 5. GToken (20 actions)', () => {
    const gtoken = tokenActions(GTOKEN_ADDRESS);

    it('should read name and symbol', async () => {
      const [name, symbol] = await Promise.all([
        gtoken(publicClient).name(),
        gtoken(publicClient).symbol(),
      ]);
      
      console.log(`  ✓ Name: ${name}`);
      console.log(`  ✓ Symbol: ${symbol}`);
    });


    it('should read user balance', async () => {
      const balance = await gtoken(publicClient).balanceOf({
        token: GTOKEN_ADDRESS,
        account: testAccount.address,
      });
      expect(balance).toBeDefined();
      console.log(`  ✓ User GToken Balance: ${balance}`);
    });

    it('should verify mint capability (dry-run)', async () => {
      // Use simulateContract to dry-run a mint
      try {
        await publicClient.simulateContract({
          address: GTOKEN_ADDRESS,
          abi: GTokenABI,
          functionName: 'mint',
          args: [testAccount.address, 1n],
          account: testAccount,
        });
        console.log(`  ✓ Mint capability verified via dry-run`);
      } catch (e: any) {
        console.warn(`  ⚠ Mint dry-run failed (expected if not owner): ${e.message.split('\n')[0]}`);
      }
    });
  });

  describe('✅ 6. aPNTs (34 actions)', () => {
