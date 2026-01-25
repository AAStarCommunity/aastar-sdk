
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { type Hex, type Chain } from 'viem';
import { sepolia, optimismSepolia, optimism } from 'viem/chains';

interface TxHistoryItem {
    blockNumber: string;
    timeStamp: string;
    hash: string;
    nonce: string;
    blockHash: string;
    transactionIndex: string;
    from: string;
    to: string;
    value: string;
    gas: string;
    gasPrice: string;
    isError: string;
    txreceipt_status: string;
    input: string;
    contractAddress: string;
    cumulativeGasUsed: string;
    gasUsed: string;
    confirmations: string;
    methodId: string;
    functionName: string;
}

export class HistoricalFetcher {
    private apiKey: string;
    private baseUrl: string;
    private chainId: number;

    constructor(network: string) {
        this.apiKey = this.getApiKey(network);
        this.baseUrl = this.getBaseUrl(network);
        this.chainId = this.getChainId(network);
    }

    private getApiKey(network: string): string {
        if (network.includes('optimism') || network.includes('op-')) {
            return process.env.OPTIMISM_ETHERSCAN_API_KEY || '';
        }
        return process.env.ETHERSCAN_API_KEY || '';
    }

    private getBaseUrl(network: string): string {
        // Unified V2 Endpoint for Etherscan-supported chains
        return 'https://api.etherscan.io/v2/api';
    }

    private getChainId(network: string): number {
        switch (network) {
            case 'sepolia': return 11155111;
            case 'op-sepolia': return 11155420;
            case 'optimism': return 10;
            case 'op-mainnet': return 10;
            default: return 0;
        }
    }

    /**
     * Get the last fetched block number from existing JSON file
     */
    getLastFetchedBlock(address: string): number {
        const dir = path.resolve(process.cwd(), 'packages/analytics/data/historical');
        const labels = fs.readdirSync(dir).filter(f => f.includes(address.substring(0, 8)) && f.includes(this.chainId.toString()));
        
        if (labels.length === 0) return 0;
        
        try {
            const filepath = path.join(dir, labels[0]);
            const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
            if (data.transactions && data.transactions.length > 0) {
                // Return max block number + 1
                const maxBlock = Math.max(...data.transactions.map((t: TxHistoryItem) => parseInt(t.blockNumber)));
                console.log(`   🔄 Resuming from block ${maxBlock + 1}`);
                return maxBlock + 1;
            }
        } catch (e) {
            console.warn(`   ⚠️  Failed to read existing history, starting fresh.`);
        }
        return 0;
    }

    /**
     * Fetch normal transactions for an address (Incremental)
     */
    async fetchTransactions(address: string): Promise<TxHistoryItem[]> {
        const startBlock = this.getLastFetchedBlock(address);
        console.log(`📡 Fetching history for ${address} on chain ${this.chainId} (V2 API) starting at ${startBlock}...`);
        
        try {
            const url = `${this.baseUrl}?chainid=${this.chainId}&module=account&action=txlist&address=${address}&startblock=${startBlock}&endblock=99999999&sort=asc&apikey=${this.apiKey}`;
            const response = await axios.get(url);
            
            if (response.data.status === '1' && Array.isArray(response.data.result)) {
                const txs = response.data.result as TxHistoryItem[];
                console.log(`   ✅ Found ${txs.length} new transactions`);
                return txs;
            } else if (response.data.message === 'No transactions found') {
                console.log(`   ℹ️  No new transactions found`);
                return [];
            } else {
                console.warn(`   ⚠️  API Error: ${response.data.message}`);
                return [];
            }
        } catch (error: any) {
            console.error(`   ❌ Fetch failed: ${error.message}`);
            return [];
        }
    }

    /**
     * Save transactions to clean JSON format in data/historical (Merge with existing)
     */
    async saveHistory(address: string, newTxs: TxHistoryItem[], label: string = 'unknown') {
        const dir = path.resolve(process.cwd(), 'packages/analytics/data/historical');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        const filename = `${label}_${address.substring(0, 8)}_${this.chainId}.json`;
        const filepath = path.join(dir, filename);

        let existingTxs: TxHistoryItem[] = [];
        if (fs.existsSync(filepath)) {
            try {
                const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
                existingTxs = data.transactions || [];
            } catch (e) { /* ignore */ }
        }

        // Merge: Filter out duplicates just in case
        const existingHashes = new Set(existingTxs.map(t => t.hash));
        const uniqueNewTxs = newTxs.filter(t => !existingHashes.has(t.hash));
        
        if (uniqueNewTxs.length === 0 && existingTxs.length > 0) {
            console.log(`   ✨ No new unique transactions to save.`);
            return;
        }

        const finalTxs = [...existingTxs, ...uniqueNewTxs].sort((a, b) => parseInt(b.timeStamp) - parseInt(a.timeStamp));

        const data = {
            network: this.chainId,
            address,
            label,
            timestamp: new Date().toISOString(),
            count: finalTxs.length,
            transactions: finalTxs
        };

        fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
        console.log(`   💾 Updated ${filename} (Total: ${finalTxs.length}, New: ${uniqueNewTxs.length})`);
    }
}
