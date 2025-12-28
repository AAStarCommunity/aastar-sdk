/**
 * 00_token_distribution.ts - 重构版
 * 使用 FundingManager API
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { sepolia } from 'viem/chains';
import { FundingManager } from '../../../packages/sdk/src/index.js';
import type { Hex, Address } from 'viem';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env.sepolia') });

async function main() {
    console.log('💸 Token Distribution (Refactored)\n');

    const RPC_URL = process.env.SEPOLIA_RPC_URL!;
    const SUPPLIER_KEY = process.env.PRIVATE_KEY_SUPPLIER as Hex;
    const GTOKEN_ADDR = process.env.GTOKEN_ADDR as Address;

    // 定义目标账户
    const targets = [
        { address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC' as Address, name: 'Admin A' },
        { address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as Address, name: 'User EOA' },
        { address: '0x710a314F85b12A4Cbd0f141F576a40279Fe3a552' as Address, name: 'User AA' }
    ];

    // 批量充值 ETH
    await FundingManager.batchFundETH(
        { rpcUrl: RPC_URL, chain: sepolia, supplierKey: SUPPLIER_KEY },
        targets.map(t => ({ address: t.address, amount: '0.1' }))
    );

    // 批量充值 GToken
    await FundingManager.batchFundToken(
        { rpcUrl: RPC_URL, chain: sepolia, supplierKey: SUPPLIER_KEY },
        GTOKEN_ADDR,
        targets.map(t => ({ address: t.address, amount: '100' }))
    );

    console.log('\n✅ Distribution Complete!');
}

main().catch(console.error);
