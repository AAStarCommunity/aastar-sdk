import { getTestSetup } from './setup.js';
import { CORE_ADDRESSES, TEST_ACCOUNT_ADDRESSES } from '@aastar/core';
import { createEndUserClient } from '../../src/clients/endUser.js';

async function main() {
    await getTestSetup();
    console.log("ENV SIMPLE_ACCOUNT_FACTORY:", process.env.SIMPLE_ACCOUNT_FACTORY);
    console.log("CORE_ADDRESSES.simpleAccountFactory:", (CORE_ADDRESSES as any).simpleAccountFactory);
    console.log("TEST_ACCOUNT_ADDRESSES.simpleAccountFactory:", TEST_ACCOUNT_ADDRESSES.simpleAccountFactory);
    
    const client = createEndUserClient({
        chain: {} as any,
        transport: {} as any
    });
    
    // Check internal usedAddresses if possible (it's protected usually, but we can log in client)
    console.log("Checking client prediction...");
    try {
        const { accountAddress } = await client.createSmartAccount({ owner: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' });
        console.log("Predicted Account:", accountAddress);
    } catch (e) {
        console.log("Prediction failed as expected (no provider), but check logs above.");
    }
}

main();
