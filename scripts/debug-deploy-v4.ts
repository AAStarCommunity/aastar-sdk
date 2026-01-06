
import { createPublicClient, createWalletClient, http, type Hex } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { loadNetworkConfig } from '../tests/regression/config';
import { 
    tokenActions, 
    paymasterFactoryActions,
} from '../packages/core/src/index.js';
import { PaymasterOperatorClient } from '../packages/operator/src/PaymasterOperatorClient.js';
import * as dotenv from 'dotenv';
import * as path from 'path';

import { fileURLToPath } from 'url';

async function main() {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    const networkArg = process.argv.find(arg => arg.startsWith('--network='))?.split('=')[1] || 'anvil';
    const config = loadNetworkConfig(networkArg);
    dotenv.config({ path: path.resolve(__dirname, `../.env.${networkArg}`), override: true });

    console.log(`🧪 Debugging PaymasterV4 Deployment on ${networkArg}`);

    const publicClient = createPublicClient({ chain: config.chain, transport: http(config.rpcUrl) });
    
    // 1. Generate Random Account
    const randomKey = generatePrivateKey();
    const account = privateKeyToAccount(randomKey);
    console.log(`👤 generated account: ${account.address}`);

    // 2. Fund it
    const supplierKey = process.env.PRIVATE_KEY_SUPPLIER as Hex || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    const supplier = privateKeyToAccount(supplierKey);
    const supplierClient = createWalletClient({ account: supplier, chain: config.chain, transport: http(config.rpcUrl) });

    const hash = await supplierClient.sendTransaction({
        to: account.address,
        value: 100000000000000000n // 0.1 ETH
    });
    await publicClient.waitForTransactionReceipt({ hash });
    console.log(`💰 Funded 0.1 ETH`);

    // 3. Setup Client
    const client = createWalletClient({ account, chain: config.chain, transport: http(config.rpcUrl) });
    const opClient = new PaymasterOperatorClient({
        client,
        publicClient,
        superPaymasterAddress: config.contracts.superPaymaster,
        xpntsFactoryAddress: config.contracts.xPNTsFactory,
        registryAddress: config.contracts.registry,
        entryPointAddress: config.contracts.entryPoint
    });

    // 4. Register Community (Prerequisite)
    // We assume we can quickly register without stake? No, need GToken.
    // Let's just grant role via Admin to speed up if possible, or use Client which handles stake.
    // To use Client, we need GToken.
    const gToken = tokenActions();
    const mintHash = await gToken(supplierClient).mint({
        token: config.contracts.gToken,
        to: account.address,
        amount: 100000000000000000000n, // 100 GToken
        account: supplier
    });
    await publicClient.waitForTransactionReceipt({ hash: mintHash });
    
    // Register Community
    const { CommunityClient } = await import('../packages/enduser/dist/CommunityClient.js');
    const commClient = new CommunityClient({
        client,
        publicClient,
        registryAddress: config.contracts.registry,
        gTokenAddress: config.contracts.gToken,
        gTokenStakingAddress: config.contracts.gTokenStaking
    });
    // Fix:
    const regHash = await commClient.registerAsCommunity({ name: 'DebugComm' });
    await publicClient.waitForTransactionReceipt({ hash: regHash });
    console.log(`✅ Registered Community`);

    // 5. Deploy Paymaster V4
    console.log(`🚀 Deploying PaymasterV4...`);
    const result = await opClient.deployAndRegisterPaymasterV4({
        version: 'v4.2',
        stakeAmount: 10000000000000000000n // 10 GToken
    });
    
    console.log(`✅ Paymaster Deployed: ${result.paymasterAddress}`);

    // Verification: Check Owner
    const pmFactory = paymasterFactoryActions(config.contracts.paymasterFactory)(publicClient);
    const deployedAddr = await pmFactory.getPaymaster({ owner: account.address });
    
    if (deployedAddr !== result.paymasterAddress) throw new Error('Address Mismatch');

    // Check implementation? 
    // We can't check 'initialized' easily from outside without calling getter.
    // Try calling `owner()` on the Paymaster
    const owner = await publicClient.readContract({
        address: result.paymasterAddress,
        abi: [{ name: 'owner', type: 'function', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' }],
        functionName: 'owner'
    });
    console.log(`🔍 Paymaster Owner: ${owner}`);
    
    if (owner === account.address) {
        console.log(`🎉 SUCCESS: Paymaster Initialized Correctly`);
        process.exit(0);
    } else {
        console.error(`❌ FAILURE: Owner mismatch (expected ${account.address}, got ${owner})`);
        process.exit(1);
    }
}

main().catch(console.error);
