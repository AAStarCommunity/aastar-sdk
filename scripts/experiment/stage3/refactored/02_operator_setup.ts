/**
 * 02_operator_setup.ts - 重构版
 * 使用 OperatorClient.setup() API (简化版 - 手动实现)
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { http, parseEther, type Hex, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { createOperatorClient, FundingManager, RoleIds } from '../../../packages/sdk/src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env.sepolia') });

async function main() {
    console.log('🚀 Operator Setup (Refactored)\n');

    const RPC_URL = process.env.SEPOLIA_RPC_URL!;
    const OPERATOR_KEY = process.env.ADMIN_PRIVATE_KEY as Hex;
    const SUPPLIER_KEY = process.env.PRIVATE_KEY_SUPPLIER as Hex;

    const account = privateKeyToAccount(OPERATOR_KEY);

    // 1. 自动充值
    await FundingManager.ensureFunding({
        rpcUrl: RPC_URL,
        chain: sepolia,
        supplierKey: SUPPLIER_KEY,
        targetAddress: account.address,
        minETH: '0.01',
        targetETH: '0.05',
        token: {
            address: process.env.GTOKEN_ADDR as Address,
            minBalance: '50',
            targetAmount: '60'
        }
    });

    // 2. 创建 Operator Client 并设置
    const client = createOperatorClient({
        chain: sepolia,
        transport: http(RPC_URL),
        account,
        addresses: {
            registry: process.env.REGISTRY_ADDR as Address,
            staking: process.env.STAKING_ADDR as Address,
            superPaymaster: process.env.SUPER_PAYMASTER as Address,
            gtoken: process.env.GTOKEN_ADDR as Address
        }
    });

    // 3. 使用 onboardOperator (setup 的底层实现)
    await client.onboardOperator({
        stakeAmount: parseEther('50'),
        depositAmount: parseEther('0'),
        roleId: RoleIds.PAYMASTER_SUPER,
        roleData: '0x' as Hex
    });

    console.log('\n✅ Operator Setup Complete!');
}

main().catch(console.error);
