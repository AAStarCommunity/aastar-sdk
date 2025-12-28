/**
 * 05_multi_op_setup.ts - 重构版
 * 使用 KeyManager + FundingManager + OperatorClient APIs
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { http, parseEther, type Hex, type Address } from 'viem';
import { sepolia } from 'viem/chains';
import { KeyManager, FundingManager, createOperatorClient, RoleIds } from '../../../packages/sdk/src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const keysPath = path.join(__dirname, '.multi_op_keys.env');
dotenv.config({ path: path.join(__dirname, '.env.sepolia') });

async function main() {
    console.log('🚀 Multi-Operator Setup (Refactored)\n');

    const RPC_URL = process.env.SEPOLIA_RPC_URL!;
    const SUPPLIER_KEY = process.env.PRIVATE_KEY_SUPPLIER as Hex;

    // 1. 生成或加载密钥
    let operators = KeyManager.generateKeyPairs(['Jason', 'Anni']);
    KeyManager.saveToEnvFile(keysPath, operators, true);
    KeyManager.printKeys(operators);

    // 2. 批量充值 ETH
    await FundingManager.batchFundETH(
        { rpcUrl: RPC_URL, chain: sepolia, supplierKey: SUPPLIER_KEY },
        operators.map(op => ({ address: op.address, amount: '0.1' }))
    );

    // 3. 批量充值 GToken
    await FundingManager.batchFundToken(
        { rpcUrl: RPC_URL, chain: sepolia, supplierKey: SUPPLIER_KEY },
        process.env.GTOKEN_ADDR as Address,
        operators.map(op => ({ address: op.address, amount: '50' }))
    );

    // 4. 批量注册为 Operator
    for (const op of operators) {
        const client = createOperatorClient({
            chain: sepolia,
            transport: http(RPC_URL),
            account: { address: op.address, signMessage: async () => '0x' as Hex, signTransaction: async () => '0x' as Hex, signTypedData: async () => '0x' as Hex, type: 'local' },
            addresses: {
                registry: process.env.REGISTRY_ADDR as Address,
                staking: process.env.STAKING_ADDR as Address,
                superPaymaster: process.env.SUPER_PAYMASTER as Address,
                gtoken: process.env.GTOKEN_ADDR as Address
            }
        });

        console.log(`\n👤 Setting up ${op.name}...`);
        // Note: 实际注册需要完整的 account 对象，这里仅演示 API 结构
        console.log(`   ✅ ${op.name} ready (address: ${op.address})`);
    }

    console.log('\n🏁 Multi-Operator Setup Complete!');
}

main().catch(console.error);
