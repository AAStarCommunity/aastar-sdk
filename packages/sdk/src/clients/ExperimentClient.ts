import { Hash, formatEther } from 'viem';

export interface ExperimentRecord {
    id: string;
    scenario: string;
    group: 'EOA' | 'AA' | 'SuperPaymaster';
    txHash: string;
    gasUsed: bigint;
    gasPrice: bigint;
    costETH: string;
    status: 'Success' | 'Failed';
    timestamp: number;
    meta?: any;
}

/**
 * ExperimentClient: Business-layer tool for measuring and recording execution metrics
 */
export class ExperimentClient {
    private records: ExperimentRecord[] = [];
    private scenarioId: string;
    private group: 'EOA' | 'AA' | 'SuperPaymaster';

    constructor(scenarioId: string, group: 'EOA' | 'AA' | 'SuperPaymaster') {
        this.scenarioId = scenarioId;
        this.group = group;
    }

    /**
     * Record a transaction result
     */
    public recordTx(txHash: Hash, receipt: { gasUsed: any, effectiveGasPrice: any }, status: 'Success' | 'Failed', meta?: any) {
        const gasUsed = BigInt(receipt.gasUsed || 0);
        const gasPrice = BigInt(receipt.effectiveGasPrice || 0);
        const costBN = gasUsed * gasPrice;
        
        const record: ExperimentRecord = {
            id: `${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            scenario: this.scenarioId,
            group: this.group,
            txHash: txHash,
            gasUsed: gasUsed,
            gasPrice: gasPrice,
            costETH: formatEther(costBN),
            status: status,
            timestamp: Date.now(),
            meta
        };
        
        this.records.push(record);
        return record;
    }

    /**
     * Measure an async task (transaction) automatically
     */
    public async measureTx(taskName: string, txPromise: Promise<Hash>, publicClient: any): Promise<Hash> {
        console.log(`[Experiment: ${this.group}] Executing: ${taskName}...`);
        const start = Date.now();
        try {
            const hash = await txPromise;
            const receipt = await publicClient.waitForTransactionReceipt({ hash });
            
            this.recordTx(hash, receipt, 'Success', { latency: Date.now() - start });
            
            const gasUsed = BigInt(receipt.gasUsed || 0);
            const gasPrice = BigInt(receipt.effectiveGasPrice || 0);
            
            console.log(`   ✅ Success! Gas: ${gasUsed} | Cost: ${formatEther(gasUsed * gasPrice)} ETH`);
            return hash;
        } catch (e: any) {
            console.error(`   ❌ Failed: ${taskName}`, e);
            throw e;
        }
    }

    public getRecords() {
        return this.records;
    }
}
