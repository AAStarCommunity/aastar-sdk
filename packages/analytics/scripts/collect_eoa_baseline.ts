import { createPublicClient, http } from 'viem';
import { optimism } from 'viem/chains';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Script to collect 50 pure EOA USDC transfers directly from OP Mainnet.
 * Used as the 0-PVG baseline (A_EOA) in the SuperPaymaster evaluation.
 */
async function main() {
    const rpcUrl = process.env.VITE_OP_MAINNET_RPC_URL || 'https://mainnet.optimism.io';
    const client = createPublicClient({ chain: optimism, transport: http(rpcUrl) });
    
    // OP Mainnet Native USDC
    const USDC = '0x0b2c639c533813f4aa9d7837caf62653d097ff85';
    // ERC20 Transfer event signature
    const transferEvent = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
    
    // Start from a recent block
    let latest = await client.getBlockNumber();
    
    let validGasUsed: number[] = [];
    let hashes = new Set<string>();
    
    console.log(`Starting EOA USDC transfer collection from block ${latest}...`);
    
    while(validGasUsed.length < 50) {
        // Fetch in small chunks to avoid RPC limits
        let from = latest - 20n;
        const logs = await client.getLogs({ 
            address: USDC as `0x${string}`, 
            topics: [transferEvent], 
            fromBlock: from, 
            toBlock: latest 
        });
        
        for(const log of logs.reverse()) {
            if (validGasUsed.length >= 50) break;
            if (hashes.has(log.transactionHash)) continue;
            hashes.add(log.transactionHash);
            
            try {
                // Ensure the transaction is a direct transfer to the USDC contract (EOA call)
                const tx = await client.getTransaction({ hash: log.transactionHash });
                if (tx && tx.to && tx.to.toLowerCase() === USDC) {
                    const receipt: any = await client.request({ 
                        method: 'eth_getTransactionReceipt', 
                        params: [log.transactionHash]
                    });
                    const gasUsed = Number(BigInt(receipt.gasUsed));
                    
                    // Exclude anomalous gas spikes/drops (e.g. out of gas or complex proxy setups)
                    // Normal ERC20 transfer gas on OP is ~40k - 60k
                    if (gasUsed > 35000 && gasUsed < 80000) {
                        validGasUsed.push(gasUsed);
                        process.stdout.write(`\rCollected: ${validGasUsed.length}/50`);
                    }
                }
            } catch(e) {
                // Ignore RPC transient errors for individual txs
            }
        }
        latest = from - 1n;
    }
    
    console.log('\n\n--- Collection Complete ---');
    
    const mean = Math.round(validGasUsed.reduce((a,b)=>a+b, 0) / validGasUsed.length);
    const std = Math.sqrt(validGasUsed.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / (validGasUsed.length - 1)) || 0;
    const ci = Math.round(1.96 * (std / Math.sqrt(validGasUsed.length)));
    
    console.log(`n=${validGasUsed.length}`);
    console.log(`Mean gasUsed: ${mean}`);
    console.log(`95% CI: ±${ci}`);
    
    // Save to CSV
    const csvHeader = 'Operation,Label,TxIndex,GasUsed(L2)\n';
    const csvContent = validGasUsed.map((gas, i) => `EOA ERC20 Transfer,A_EOA,${i+1},${gas}`).join('\n');
    
    const outPath = path.join(__dirname, '../data/eoa_erc20_baseline.csv');
    fs.writeFileSync(outPath, csvHeader + csvContent);
    console.log(`\nData saved to ${outPath}`);
}

main().catch(console.error);
