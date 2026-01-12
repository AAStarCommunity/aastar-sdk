import { createPublicClient, http } from 'viem';
import { loadNetworkConfig } from '../tests/regression/config.js';
import { xPNTsFactoryActions } from '../packages/core/dist/index.js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.sepolia' });

async function queryJackToken() {
    const config = loadNetworkConfig('sepolia');
    const publicClient = createPublicClient({ 
        chain: config.chain, 
        transport: http(config.rpcUrl) 
    });
    
    const factory = xPNTsFactoryActions(config.contracts.xPNTsFactory);
    const jackAddr = '0x084b5F85A5149b03aDf9396C7C94D8B8F328FB36';
    
    const tokenAddr = await factory(publicClient).getTokenAddress({ community: jackAddr });
    console.log('dPNTs Token:', tokenAddr);
}

queryJackToken().catch(console.error);
