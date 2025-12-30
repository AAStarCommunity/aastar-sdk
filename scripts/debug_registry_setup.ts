
import { createPublicClient, http, parseEther, formatEther, type Hex, type Address, createClient, erc20Abi, keccak256, stringToBytes } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import dotenv from 'dotenv';
import path from 'path';

// Load Env
dotenv.config({ path: path.resolve(process.cwd(), '.env.anvil') });

const localAddresses = {
    registry: process.env.REGISTRY_ADDRESS as Address,
    gTokenStaking: process.env.GTOKENSTAKING_ADDRESS as Address,
    mySBT: process.env.MYSBT_ADDRESS as Address,
    gToken: process.env.GTOKEN_ADDRESS as Address
};

const adminAccount = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');

const client = createPublicClient({
    chain: foundry,
    transport: http('http://127.0.0.1:8545')
});

async function main() {
    console.log('🔍 Debugging Registry Setup...');
    console.log('Local Addresses:', localAddresses);

    if (!localAddresses.registry || !localAddresses.gTokenStaking || !localAddresses.mySBT) {
        console.error('❌ Missing addresses in .env.anvil');
        return;
    }

    // 0. Check Bytecode and Registry Links
    console.log('\n--- Checking Contract Existence & Links ---');
    const codeRegistry = await client.getBytecode({ address: localAddresses.registry });
    console.log(`Registry Code exists: ${!!codeRegistry && codeRegistry.length > 2}`);
    
    // Read linked addresses from Registry
    let stakingFromReg: Address;
    try {
        stakingFromReg = await client.readContract({
            address: localAddresses.registry,
            abi: [{name:'GTOKEN_STAKING', type:'function', inputs:[], outputs:[{type:'address'}]}],
            functionName: 'GTOKEN_STAKING'
        });
        console.log(`Registry.GTOKEN_STAKING: ${stakingFromReg}`);
        console.log(`Matches .env? ${stakingFromReg === localAddresses.gTokenStaking}`);
    } catch (e) { console.error("Failed to read GTOKEN_STAKING from Registry", e); stakingFromReg = "0x"; }

    let mysbtFromReg: Address;
    try {
        mysbtFromReg = await client.readContract({
            address: localAddresses.registry,
            abi: [{name:'MYSBT', type:'function', inputs:[], outputs:[{type:'address'}]}],
            functionName: 'MYSBT'
        });
        console.log(`Registry.MYSBT: ${mysbtFromReg}`);
        console.log(`Matches .env? ${mysbtFromReg === localAddresses.mySBT}`);
    } catch (e) { console.error("Failed to read MYSBT from Registry"); mysbtFromReg="0x"; }

    // Check Code at Staking
    if (stakingFromReg && stakingFromReg !== '0x') {
        const codeStaking = await client.getBytecode({ address: stakingFromReg });
        console.log(`Staking (${stakingFromReg}) Code exists: ${!!codeStaking && codeStaking.length > 2}`);
    }

    // Check Code at MySBT
    if (mysbtFromReg && mysbtFromReg !== '0x') {
        const codeMySBT = await client.getBytecode({ address: mysbtFromReg });
        console.log(`MySBT (${mysbtFromReg}) Code exists: ${!!codeMySBT && codeMySBT.length > 2}`);
    }

    // 1. Check Staking Registry (Try lowercase)
    console.log('\n--- Checking GTokenStaking.registry() ---');
    try {
        const targetStaking = (stakingFromReg && stakingFromReg !== '0x') ? stakingFromReg : localAddresses.gTokenStaking;
        
        let regOnStaking;
        try {
            regOnStaking = await client.readContract({
                address: targetStaking,
                abi: [{type: 'function', name: 'registry', inputs: [], outputs: [{type: 'address'}], stateMutability: 'view'}],
                functionName: 'registry'
            });
        } catch (e) {
            console.log('registry() failed, trying REGISTRY()...');
            regOnStaking = await client.readContract({
                address: targetStaking,
                abi: [{type: 'function', name: 'REGISTRY', inputs: [], outputs: [{type: 'address'}], stateMutability: 'view'}],
                functionName: 'REGISTRY'
            });
        }
        
        console.log(`GTokenStaking.registry(): ${regOnStaking}`);
        if (regOnStaking === localAddresses.registry) {
            console.log('✅ Staking points to correct Registry');
        } else {
            console.error(`❌ Staking points to WRONG Registry: ${regOnStaking} (Expected ${localAddresses.registry})`);
        }
    } catch (e) {
        console.error('Failed to read REGISTRY from Staking:', e);
    }

    // 2. Check MySBT MINTER_ROLE (Use address from Reg)
    console.log('\n--- Checking MySBT MINTER_ROLE ---');
    try {
        const targetMySBT = (mysbtFromReg && mysbtFromReg !== '0x') ? mysbtFromReg : localAddresses.mySBT;
        const MINTER_ROLE = keccak256(stringToBytes('MINTER_ROLE'));
        console.log(`MINTER_ROLE Hash: ${MINTER_ROLE}`);
        
        const hasRole = await client.readContract({
            address: targetMySBT,
            abi: [{type: 'function', name: 'hasRole', inputs: [{type:'bytes32'}, {type:'address'}], outputs: [{type: 'bool'}], stateMutability: 'view'}],
            functionName: 'hasRole',
            args: [MINTER_ROLE, localAddresses.registry]
        });
        console.log(`Registry has MINTER_ROLE: ${hasRole}`);
        if (hasRole) {
            console.log('✅ Registry has MINTER_ROLE');
        } else {
            console.error('❌ Registry DOES NOT have MINTER_ROLE');
        }
    } catch (e) {
        console.error('Failed to check MySBT role:', e);
    }
}

main().catch(console.error);
