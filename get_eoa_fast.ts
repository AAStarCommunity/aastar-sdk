import { createPublicClient, http } from 'viem';
import { optimism } from 'viem/chains';

async function main() {
    const client = createPublicClient({ chain: optimism, transport: http('https://mainnet.optimism.io') });
    const USDC = '0x0b2c639c533813f4aa9d7837caf62653d097ff85';
    let latest = await client.getBlockNumber();
    const transferEvent = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
    
    let validGasUsed = [];
    let hashes = new Set();
    
    while(validGasUsed.length < 50) {
        let from = latest - 20n;
        const logs = await client.getLogs({ address: USDC as any, topics: [transferEvent], fromBlock: from, toBlock: latest });
        
        for(const log of logs.reverse()) {
            if (validGasUsed.length >= 50) break;
            if (hashes.has(log.transactionHash)) continue;
            hashes.add(log.transactionHash);
            
            try {
                const tx = await client.getTransaction({ hash: log.transactionHash });
                if (tx && tx.to && tx.to.toLowerCase() === USDC) {
                    const receipt: any = await client.request({ method: 'eth_getTransactionReceipt', params: [log.transactionHash]});
                    const gasUsed = Number(BigInt(receipt.gasUsed));
                    validGasUsed.push(gasUsed);
                    console.log(`Found EOA transfer: ${gasUsed} gas`);
                }
            } catch(e) {}
        }
        latest = from - 1n;
    }
    
    const mean = Math.round(validGasUsed.reduce((a,b)=>a+b, 0) / validGasUsed.length);
    const std = Math.sqrt(validGasUsed.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / (validGasUsed.length - 1)) || 0;
    const ci = Math.round(1.96 * (std / Math.sqrt(validGasUsed.length)));
    console.log(`\nFINAL_RESULT: n=${validGasUsed.length}, Mean gasUsed: ${mean}, CI: ±${ci}`);
}

main().catch(console.error);
