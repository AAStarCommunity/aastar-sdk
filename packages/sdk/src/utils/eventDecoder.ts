import { decodeEventLog, type Hex, type Abi } from 'viem';
import { RegistryABI, SuperPaymasterABI, GTokenStakingABI, MySBTABI, xPNTsTokenABI, PaymasterFactoryABI } from '../index.js';

const ABIS_TO_TRY = [
    { name: 'Registry', abi: RegistryABI },
    { name: 'SuperPaymaster', abi: SuperPaymasterABI },
    { name: 'GTokenStaking', abi: GTokenStakingABI },
    { name: 'MySBT', abi: MySBTABI },
    { name: 'xPNTsToken', abi: xPNTsTokenABI },
    { name: 'PaymasterFactory', abi: PaymasterFactoryABI }
];

export interface DecodedEvent {
    contractName: string;
    eventName: string;
    args: any;
}

export function decodeContractEvents(logs: any[]): DecodedEvent[] {
    const decodedEvents: DecodedEvent[] = [];

    for (const log of logs) {
        if (typeof log.data !== 'string' || !log.data.startsWith('0x')) {
            console.warn('   ⚠️ Skipping log with invalid data:', log);
            continue; 
        }

        for (const { name, abi } of ABIS_TO_TRY) {
            try {
                const decoded = decodeEventLog({
                    abi: abi as Abi,
                    data: log.data as Hex,
                    topics: log.topics
                });

                if (decoded && decoded.eventName) {
                    decodedEvents.push({
                        contractName: name,
                        eventName: decoded.eventName,
                        args: decoded.args
                    });
                    break; // Found the right ABI for this log
                }
            } catch (e) {
                // Mismatch, continue
            }
        }
    }

    return decodedEvents;
}

export function logDecodedEvents(events: DecodedEvent[]) {
    for (const event of events) {
        console.log(`📡 [${event.contractName}] Event: ${event.eventName}`);
        if (event.args) {
            Object.entries(event.args).forEach(([key, value]) => {
                const displayValue = typeof value === 'bigint' ? value.toString() : value;
                console.log(`   └─ ${key}: ${displayValue}`);
            });
        }
    }
}
