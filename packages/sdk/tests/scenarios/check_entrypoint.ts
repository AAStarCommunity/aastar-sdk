import './setup.js';
import { createPublicClient, http } from 'viem';
import { anvil } from 'viem/chains';

const ENTRY_POINT = process.env.ENTRY_POINT_ADDR as `0x${string}`;

async function main() {
    const client = createPublicClient({
        chain: anvil,
        transport: http()
    });

    const code = await client.getBytecode({ address: ENTRY_POINT });
    console.log('EntryPoint Address:', ENTRY_POINT);
    console.log('EntryPoint Code Length:', code?.length || 0);
    console.log('Is Deployed:', code && code.length > 2);
}

main().catch(console.error);
