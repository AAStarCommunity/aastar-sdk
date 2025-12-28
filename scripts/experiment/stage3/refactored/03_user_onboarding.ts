/**
 * 03_user_onboarding.ts - 重构版
 * 使用 EndUserClient.onboard() API (简化版 - 手动实现)
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { http, type Hex, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { createEndUserClient, FundingManager, RoleIds, RoleDataFactory } from '../../../packages/sdk/src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env.sepolia') });

async function main() {
    console.log('🚀 User Onboarding (Refactored)\n');

    const RPC_URL = process.env.SEPOLIA_RPC_URL!;
    const USER_KEY = process.env.AA_OWNER_PRIVATE_KEY as Hex;
    const SUPPLIER_KEY = process.env.PRIVATE_KEY_SUPPLIER as Hex;
    const COMMUNITY = process.env.PRIVATE_KEY_SUPPLIER ? 
        privateKeyToAccount(process.env.PRIVATE_KEY_SUPPLIER as Hex).address : 
        '0xb5600060e6de5E11D3636731964218E53caadf0E' as Address;

    const account = privateKeyToAccount(USER_KEY);

    // 1. 自动充值
    await FundingManager.ensureFunding({
        rpcUrl: RPC_URL,
        chain: sepolia,
        supplierKey: SUPPLIER_KEY,
        targetAddress: account.address,
        minETH: '0.01',
        targetETH: '0.05'
    });

    // 2. 创建 EndUser Client
    const client = createEndUserClient({
        chain: sepolia,
        transport: http(RPC_URL),
        account,
        addresses: {
            registry: process.env.REGISTRY_ADDR as Address,
            superPaymaster: process.env.SUPER_PAYMASTER as Address
        }
    });

    // 3. 生成 roleData 并加入社区
    const roleData = RoleDataFactory.endUser({
        account: account.address,
        community: COMMUNITY,
        avatarURI: '',
        ensName: '',
        stakeAmount: 0n
    });

    const result = await client.joinAndActivate({
        community: COMMUNITY,
        roleId: RoleIds.ENDUSER,
        roleData
    });

    console.log(`\n✅ User Onboarded! SBT ID: ${result.sbtId}`);
}

main().catch(console.error);
