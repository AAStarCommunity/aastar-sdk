import { createPublicClient, http } from 'viem';
import { loadNetworkConfig } from '../tests/regression/config.js';
import { registryActions } from '../packages/core/dist/index.js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.sepolia' });

async function checkRoles() {
    const config = loadNetworkConfig('sepolia');
    const client = createPublicClient({
        chain: config.chain,
        transport: http(config.rpcUrl)
    });

    const registry = registryActions(config.contracts.registry);
    const ROLE_COMMUNITY = await registry(client).ROLE_COMMUNITY();
    const ROLE_PAYMASTER_SUPER = await registry(client).ROLE_PAYMASTER_SUPER();

    const jason = '0xb5600060e6de5E11D3636731964218E53caadf0E';
    const bob = '0xF7Bf79AcB7F3702b9DbD397d8140ac9DE6Ce642C';
    const anni = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';

    console.log('\n📋 Role Status Check\n');
    console.log('Jason:');
    console.log(`  ROLE_COMMUNITY: ${await registry(client).hasRole({ user: jason, roleId: ROLE_COMMUNITY })}`);
    console.log(`  ROLE_PAYMASTER_SUPER: ${await registry(client).hasRole({ user: jason, roleId: ROLE_PAYMASTER_SUPER })}`);
    
    console.log('\nBob:');
    console.log(`  ROLE_COMMUNITY: ${await registry(client).hasRole({ user: bob, roleId: ROLE_COMMUNITY })}`);
    
    console.log('\nAnni:');
    console.log(`  ROLE_COMMUNITY: ${await registry(client).hasRole({ user: anni, roleId: ROLE_COMMUNITY })}`);
    console.log(`  ROLE_PAYMASTER_SUPER: ${await registry(client).hasRole({ user: anni, roleId: ROLE_PAYMASTER_SUPER })}`);
}

checkRoles().catch(console.error);
