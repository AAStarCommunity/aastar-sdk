import { createPublicClient, http, type Address, type Hex } from 'viem';
import { getNetworkConfig } from './00_utils.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function checkSBT() {
    const network = 'sepolia';
    const config = getNetworkConfig(network);
    const state = JSON.parse(fs.readFileSync(path.resolve(__dirname, `l4-state.${network}.json`), 'utf8'));
    const spAddr = state.operators.anni.superPaymaster as Address;
    const aaAddr = state.aaAccounts.find((a: any) => a.label.includes('Anni'))?.address as Address;

    const client = createPublicClient({ chain: config.chain, transport: http(config.rpc) });
    
    const isSBT = await client.readContract({
        address: spAddr,
        abi: [{ name: 'sbtHolders', type: 'function', inputs: [{ name: '', type: 'address' }], outputs: [{ name: '', type: 'bool' }] }],
        functionName: 'sbtHolders',
        args: [aaAddr]
    });

    const opAddr = state.operators.anni.address as Address;
    const opConfig = await client.readContract({
        address: spAddr,
        abi: [{ 
            name: 'operators', 
            type: 'function', 
            inputs: [{ name: '', type: 'address' }], 
            outputs: [
                { name: 'aPNTsBalance', type: 'uint128' },
                { name: 'exchangeRate', type: 'uint96' },
                { name: 'isConfigured', type: 'bool' },
                { name: 'isPaused', type: 'bool' },
                { name: 'xPNTsToken', type: 'address' },
                { name: 'reputation', type: 'uint32' },
                { name: 'minTxInterval', type: 'uint48' },
                { name: 'treasury', type: 'address' },
                { name: 'totalSpent', type: 'uint256' },
                { name: 'totalTxSponsored', type: 'uint256' }
            ]
        }],
        functionName: 'operators',
        args: [opAddr]
    }) as any[];

    console.log(`Account: ${aaAddr}`);
    console.log(`SuperPaymaster: ${spAddr}`);
    console.log(`Is SBT Holder in SP: ${isSBT}`);
    console.log(`Operator: ${opAddr}`);
    console.log(`Operator Config:`, {
        isConfigured: opConfig[2],
        isPaused: opConfig[3],
        aPNTsBalance: opConfig[0],
        xPNTsToken: opConfig[4]
    });
}

checkSBT().catch(console.error);
