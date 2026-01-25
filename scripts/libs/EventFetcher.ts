
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { type Hex, pad, getAddress } from 'viem';
import { sepolia, optimismSepolia, optimism } from 'viem/chains';

interface EventLogItem {
    address: string;
    topics: string[];
    data: string;
    blockNumber: string;
    timeStamp: string;
    gasPrice: string;
    gasUsed: string;
    logIndex: string;
    transactionHash: string;
    transactionIndex: string;
}

// EntryPoint v0.7.0 Address (Standard across most chains)
const ENTRYPOINT_V07 = '0x0000000071727De22E5E9d8BAf0edAc6f37da032';

// UserOperationEvent signature: 
// Event(bytes32 indexed userOpHash, address indexed sender, address indexed paymaster, uint256 nonce, bool success, uint256 actualGasCost, uint256 actualGasUsed)
const USER_OP_EVENT_TOPI0 = '0x49628fd1471006c1482da88028e9ce4dbb080b815c9b0344d39e5a8e6ec1419f';

export class EventFetcher {
    private apiKey: string;
    private baseUrl: string;
    private chainId: number;
    private entryPoint: string;

    constructor(network: string, entryPointAddress: string = ENTRYPOINT_V07) {
        this.apiKey = this.getApiKey(network);
        this.baseUrl = this.getBaseUrl(network);
        this.chainId = this.getChainId(network);
        this.entryPoint = entryPointAddress;
    }

    private getApiKey(network: string): string {
        if (network.includes('optimism') || network.includes('op-')) {
            return process.env.OPTIMISM_ETHERSCAN_API_KEY || process.env.ETHERSCAN_API_KEY || '';
        }
        return process.env.ETHERSCAN_API_KEY || '';
    }

    private getBaseUrl(network: string): string {
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
     * Get the last fetched block number from existing Event JSON file
     */
    getLastFetchedBlock(label: string): number {
        const dir = path.resolve(process.cwd(), 'packages/analytics/data/events');
        
        // Find file matching label
        if (!fs.existsSync(dir)) return 0;
        const files = fs.readdirSync(dir).filter(f => f.startsWith(`${label}_`));
        
        if (files.length === 0) return 0;
        
        try {
            const filepath = path.join(dir, files[0]);
            const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
            if (data.events && data.events.length > 0) {
                // Return max block number + 1
                const maxBlock = Math.max(...data.events.map((t: EventLogItem) => parseInt(t.blockNumber)));
                console.log(`   🔄 Resuming Event Fetch (Label: ${label}) from block ${maxBlock + 1}`);
                return maxBlock + 1;
            }
        } catch (e) { /* ignore */ }
        return 0;
    }

    /**
     * Fetch UserOperationEvents where the given address is either Sender (topic2) or Paymaster (topic3)
     */
    async fetchUserOps(targetAddress: string, type: 'sender' | 'paymaster'): Promise<EventLogItem[]> {
        // Rate limit protection: Sleep 1s before call
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Pad address for topic matching
        const topicAddress = pad(getAddress(targetAddress) as Hex);
        
        // Topic Config
        // topic0: Signature
        // topic1: Any (userOpHash)
        // topic2: Sender
        // topic3: Paymaster
        
        // If searching SENDER: topic0=Sig, topic1=null, topic2=Address
        // If searching PAYMASTER: topic0=Sig, topic1=null, topic2=null, topic3=Address
        
        let topic2 = type === 'sender' ? topicAddress : undefined;
        let topic3 = type === 'paymaster' ? topicAddress : undefined;

        // Since Etherscan API topic logic can be tricky with "AND/OR", we build query specific to type
        // For Sender: topic0=SIG AND topic2=ADDR
        // For Paymaster: topic0=SIG AND topic3=ADDR
        
        const lastBlock = this.getLastFetchedBlock(type + '_' + targetAddress.substring(0,6)); // Heuristic label for resume
        console.log(`📡 Fetching events for ${targetAddress} (${type}) on chain ${this.chainId} from block ${lastBlock}...`);

        try {
            let url = `${this.baseUrl}?chainid=${this.chainId}&module=logs&action=getLogs` +
                      `&fromBlock=${lastBlock}&toBlock=last` +
                      `&address=${this.entryPoint}` +
                      `&topic0=${USER_OP_EVENT_TOPI0}`;

            if (type === 'sender') {
                url += `&topic0_2_opr=and&topic2=${topicAddress}`;
            } else {
                url += `&topic0_3_opr=and&topic3=${topicAddress}`;
            }
            
            url += `&apikey=${this.apiKey}`;

            const response = await axios.get(url);
            
            if (response.data.status === '1' && Array.isArray(response.data.result)) {
                const logs = response.data.result as EventLogItem[];
                console.log(`   ✅ Found ${logs.length} new events`);
                return logs;
            } else if (response.data.message === 'No records found') {
                console.log(`   ℹ️  No new events found`);
                return [];
            } else {
                console.warn(`   ⚠️  API Error: ${response.data.message}`);
                 if (response.data.result) console.warn(`      ${JSON.stringify(response.data.result)}`);
                return [];
            }
        } catch (error: any) {
            console.error(`   ❌ Fetch failed: ${error.message}`);
            return [];
        }
    }

    /**
     * Save events
     */
    async saveEvents(targetAddress: string, newEvents: EventLogItem[], label: string) {
        const dir = path.resolve(process.cwd(), 'packages/analytics/data/events');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        const filename = `${label}_${targetAddress.substring(0, 8)}_${this.chainId}.json`;
        const filepath = path.join(dir, filename);

        let existingEvents: EventLogItem[] = [];
        if (fs.existsSync(filepath)) {
            try {
                const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
                existingEvents = data.events || [];
            } catch (e) { /* ignore */ }
        }

        // Merge based on transactionHash AND logIndex to avoid dups
        const existingKeys = new Set(existingEvents.map(e => `${e.transactionHash}_${e.logIndex}`));
        const uniqueNew = newEvents.filter(e => !existingKeys.has(`${e.transactionHash}_${e.logIndex}`));

        if (uniqueNew.length === 0 && existingEvents.length > 0) {
            console.log(`   ✨ No new unique events to save.`);
            return;
        }

        const finalEvents = [...existingEvents, ...uniqueNew].sort((a, b) => parseInt(b.blockNumber) - parseInt(a.blockNumber));

        const data = {
            network: this.chainId,
            targetAddress,
            label,
            type: label.includes('Paymaster') ? 'paymaster' : 'sender',
            timestamp: new Date().toISOString(),
            count: finalEvents.length,
            events: finalEvents
        };

        fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
        console.log(`   💾 Updated ${filename} (Total: ${finalEvents.length}, New: ${uniqueNew.length})`);
    }
}
