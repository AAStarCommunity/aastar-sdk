import './setup.js';
import { createPublicClient, http, getContract } from 'viem';
import { anvil } from 'viem/chains';
import { SimpleAccountABI } from '@aastar/core';

const ALICE_AA = '0xcF6248D8bafF2Ff6e9290442B6a53a710C9842aC';
const ENTRY_POINT = process.env.ENTRY_POINT_ADDR as `0x${string}`;

async function main() {
    console.log('\n=== Scenario 4 Diagnostic ===');
    console.log('Alice AA Address:', ALICE_AA);
    console.log('EntryPoint from ENV:', ENTRY_POINT);

    const client = createPublicClient({
        chain: anvil,
        transport: http()
    });

    // 1. Check if contract exists
    const code = await client.getBytecode({ address: ALICE_AA });
    console.log('\nContract Bytecode Length:', code?.length || 0);
    console.log('Is Deployed:', code && code.length > 2);

    if (!code || code.length <= 2) {
        console.log('❌ Contract NOT deployed!');
        return;
    }

    // 2. Try to read entryPoint from the contract
    try {
        const account = getContract({
            address: ALICE_AA,
            abi: SimpleAccountABI,
            client
        });

        const entryPoint = await account.read.entryPoint();
        console.log('\nEntryPoint from Contract:', entryPoint);
        console.log('EntryPoint Match:', entryPoint.toLowerCase() === ENTRY_POINT.toLowerCase());

        // 3. Try to call getNonce
        try {
            const nonce = await account.read.getNonce();
            console.log('Current Nonce:', nonce);
            console.log('✅ getNonce works!');
        } catch (e: any) {
            console.log('❌ getNonce failed:', e.message);
            console.log('\nFull Error:', e);
        }
    } catch (e: any) {
        console.log('❌ Failed to read contract:', e.message);
    }
}

main().catch(console.error);
