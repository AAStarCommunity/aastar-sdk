import * as fs from 'fs';
import { createPublicClient, http } from 'viem';
import { optimism } from 'viem/chains';

async function main() {
    const rpcUrl = 'https://mainnet.optimism.io';
    const client = createPublicClient({ chain: optimism, transport: http(rpcUrl) });

    const raw = fs.readFileSync('packages/analytics/data/industry_paymaster_baselines.csv', 'utf8').trim();
    const rows = raw.split('\n').slice(1).map(l => l.split(','));
    
    // index 0: Label, index 8: TxHash
    const b1 = rows.filter(r => r[0] === 'B1_Alchemy');
    const b2 = rows.filter(r => r[0] === 'B2_Pimlico');

    async function computeStats(data: string[][]) {
        let l2gas = 0;
        let l1gasEq = 0;
        let n = data.length;
        for(let r of data) {
            const txHash = r[8];
            const receipt: any = await client.request({
                method: 'eth_getTransactionReceipt',
                params: [txHash as `0x${string}`]
            });
            const gasUsed = Number(BigInt(receipt.gasUsed));
            const l1Fee = Number(BigInt(receipt.l1Fee || '0x0'));
            const blobFee = (receipt.blobGasUsed && receipt.blobGasPrice) ? Number(BigInt(receipt.blobGasUsed) * BigInt(receipt.blobGasPrice)) : 0;
            const l1Cost = l1Fee + blobFee;
            
            const effGasPrice = Number(BigInt(receipt.effectiveGasPrice));
            const eqL1Gas = effGasPrice > 0 ? (l1Cost / effGasPrice) : 0;
            
            l2gas += gasUsed; // this is txGasUsed (L2 execution) not actualGasUsed
            l1gasEq += eqL1Gas;
        }
        return {
            n,
            l2Gas: Math.round(l2gas / n),
            l1EqGas: Math.round(l1gasEq / n)
        }
    }

    const s1 = await computeStats(b1);
    const s2 = await computeStats(b2);
    
    console.table({
        'B1_Alchemy': s1,
        'B2_Pimlico': s2
    });
}

main().catch(console.error);
