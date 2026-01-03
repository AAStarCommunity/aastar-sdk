import { createPublicClient, createWalletClient, http, parseEther, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { loadNetworkConfig } from '../tests/regression/config.js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.sepolia' });

async function fundJack() {
    const config = loadNetworkConfig('sepolia');
    const publicClient = createPublicClient({
        chain: config.chain,
        transport: http(config.rpcUrl)
    });

    const supplierKey = process.env.PRIVATE_KEY_SUPPLIER as Hex;
    const supplier = privateKeyToAccount(supplierKey);
    const clientSupplier = createWalletClient({
        chain: config.chain,
        transport: http(config.rpcUrl),
        account: supplier
    });

    const jackAddress = '0x084b5F85A5149b03aDf9396C7C94D8B8F328FB36';
    
    console.log('💸 Sending 0.05 ETH to Jack...');
    const hash = await clientSupplier.sendTransaction({
        to: jackAddress,
        value: parseEther('0.05')
    });
    
    console.log(`Transaction: ${hash}`);
    await publicClient.waitForTransactionReceipt({ hash });
    
    const balance = await publicClient.getBalance({ address: jackAddress });
    console.log(`✅ Jack's new balance: ${balance / BigInt(1e18)} ETH`);
}

fundJack().catch(console.error);
