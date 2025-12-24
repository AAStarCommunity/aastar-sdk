import { createPublicClient, http, type Address, keccak256, stringToBytes } from 'viem';
import { foundry } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Load Environment
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.v3'), override: true });

const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545';
const LOCAL_ADDRESSES = {
    superPaymasterV2: process.env.SUPER_PAYMASTER_V2 as Address,
    mySBT: process.env.MYSBT_ADDRESS as Address,
    registry: process.env.REGISTRY_ADDRESS as Address
};

const adminAccount = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'; // Anvil #0

async function debugEnv() {
    console.log('🔍 Debugging Environment...');
    console.log('RPC:', RPC_URL);
    console.log('Contracts:', LOCAL_ADDRESSES);

    const client = createPublicClient({
        chain: foundry,
        transport: http(RPC_URL)
    });

    const ownableAbi = [{type:'function', name:'owner', inputs:[], outputs:[{name:'', type:'address'}], stateMutability:'view'}];
    const pausedAbi = [{type:'function', name:'paused', inputs:[], outputs:[{name:'', type:'bool'}], stateMutability:'view'}];
    const accessControlAbi = [{type:'function', name:'hasRole', inputs:[{name:'role', type:'bytes32'}, {name:'account', type:'address'}], outputs:[{name:'', type:'bool'}], stateMutability:'view'}];
    const minterRole = keccak256(stringToBytes("MINTER_ROLE"));

    // Check SuperPaymaster
    try {
        const pmOwner = await client.readContract({ address: LOCAL_ADDRESSES.superPaymasterV2, abi: ownableAbi, functionName: 'owner' });
        console.log(`\n🏦 SuperPaymaster (${LOCAL_ADDRESSES.superPaymasterV2})`);
        console.log(`   Owner: ${pmOwner}`);
        console.log(`   Is Admin Owner? ${pmOwner === adminAccount}`);

        const isPaused = await client.readContract({ address: LOCAL_ADDRESSES.superPaymasterV2, abi: pausedAbi, functionName: 'paused' });
        console.log(`   Paused: ${isPaused}`);
    } catch (e) { console.error('Error reading SuperPaymaster:', e); }

    // Check MySBT
    try {
        // MySBT might use AccessControl w/ DEFAULT_ADMIN_ROLE or Ownable
        console.log(`\n🎫 MySBT (${LOCAL_ADDRESSES.mySBT})`);
        // Check Owner if Ownable
        try {
            const sbtOwner = await client.readContract({ address: LOCAL_ADDRESSES.mySBT, abi: ownableAbi, functionName: 'owner' });
            console.log(`   Owner: ${sbtOwner}`);
            console.log(`   Is Admin Owner? ${sbtOwner === adminAccount}`);
        } catch {}

        // Check Admin Role
        const DEFAULT_ADMIN_ROLE = '0x0000000000000000000000000000000000000000000000000000000000000000';
        const hasAdmin = await client.readContract({ address: LOCAL_ADDRESSES.mySBT, abi: accessControlAbi, functionName: 'hasRole', args: [DEFAULT_ADMIN_ROLE, adminAccount] });
        console.log(`   Admin has DEFAULT_ADMIN_ROLE? ${hasAdmin}`);

        // Check Minter Role
        const hasMinter = await client.readContract({ address: LOCAL_ADDRESSES.mySBT, abi: accessControlAbi, functionName: 'hasRole', args: [minterRole, adminAccount] });
        console.log(`   Admin has MINTER_ROLE? ${hasMinter}`);
    } catch (e) { console.error('Error reading MySBT:', e); }
}

debugEnv().catch(console.error);
