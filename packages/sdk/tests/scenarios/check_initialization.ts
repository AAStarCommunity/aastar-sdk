import './setup.js';
import { createPublicClient, http, getContract } from 'viem';
import { anvil } from 'viem/chains';
import { SimpleAccountABI } from '@aastar/core';

const ALICE_AA = '0xcF6248D8bafF2Ff6e9290442B6a53a710C9842aC';
const ALICE_EOA = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const ENTRY_POINT = process.env.ENTRY_POINT_ADDR as `0x${string}`;

async function main() {
    console.log('\n=== SimpleAccount Initialization Check ===');
    
    const client = createPublicClient({
        chain: anvil,
        transport: http()
    });

    const account = getContract({
        address: ALICE_AA,
        abi: SimpleAccountABI,
        client
    });

    // 1. Check owner
    try {
        const owner = await account.read.owner();
        console.log('Owner:', owner);
        console.log('Expected Owner (Alice EOA):', ALICE_EOA);
        console.log('Owner Match:', owner.toLowerCase() === ALICE_EOA.toLowerCase());
    } catch (e: any) {
        console.log('❌ Failed to read owner:', e.message);
    }

    // 2. Check entryPoint
    try {
        const entryPoint = await account.read.entryPoint();
        console.log('\nEntryPoint:', entryPoint);
        console.log('Expected EntryPoint:', ENTRY_POINT);
        console.log('EntryPoint Match:', entryPoint.toLowerCase() === ENTRY_POINT.toLowerCase());
    } catch (e: any) {
        console.log('❌ Failed to read entryPoint:', e.message);
    }

    // 3. Try to get deposit
    try {
        const deposit = await account.read.getDeposit();
        console.log('\nDeposit:', deposit);
    } catch (e: any) {
        console.log('❌ Failed to read deposit:', e.message);
    }

    // 4. Check account balance
    const balance = await client.getBalance({ address: ALICE_AA });
    console.log('\nAA Account Balance:', balance, '(', Number(balance) / 1e18, 'ETH )');

    // 5. Check storage slots
    console.log('\n=== Storage Analysis ===');
    for (let i = 0; i < 5; i++) {
        const slot = `0x${i.toString(16).padStart(64, '0')}` as `0x${string}`;
        const value = await client.getStorageAt({ address: ALICE_AA, slot });
        console.log(`Slot ${i}:`, value);
    }
}

main().catch(console.error);
