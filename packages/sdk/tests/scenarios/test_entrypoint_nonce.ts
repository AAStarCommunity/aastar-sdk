import './setup.js';
import { createPublicClient, http } from 'viem';
import { anvil } from 'viem/chains';

const ALICE_AA = '0xcF6248D8bafF2Ff6e9290442B6a53a710C9842aC';
const ENTRY_POINT = process.env.ENTRY_POINT_ADDR as `0x${string}`;

// EntryPoint v0.7 ABI for getNonce
const ENTRY_POINT_ABI = [
    {
        type: 'function',
        name: 'getNonce',
        inputs: [
            { name: 'sender', type: 'address' },
            { name: 'key', type: 'uint192' }
        ],
        outputs: [{ name: 'nonce', type: 'uint256' }],
        stateMutability: 'view'
    }
] as const;

async function main() {
    console.log('\n=== EntryPoint getNonce Test ===');
    
    const client = createPublicClient({
        chain: anvil,
        transport: http()
    });

    // In v0.7, getNonce requires sender address and a key (usually 0 for default)
    try {
        const nonce = await client.readContract({
            address: ENTRY_POINT,
            abi: ENTRY_POINT_ABI,
            functionName: 'getNonce',
            args: [ALICE_AA, 0n]
        });
        
        console.log('✅ Nonce from EntryPoint:', nonce);
        console.log('This is the correct way to get nonce in ERC-4337 v0.7!');
    } catch (e: any) {
        console.log('❌ Failed:', e.message);
    }
}

main().catch(console.error);
