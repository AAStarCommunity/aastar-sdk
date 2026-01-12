#!/usr/bin/env node
/**
 * Quick configuration setup for experiment
 * Uses test accounts from SuperPaymaster and calculates SimpleAccount addresses
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { createPublicClient, http, getContractAddress, encodeDeployData, keccak256, encodePacked } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ENV_FILE = path.resolve(__dirname, '../.env.anvil');

// From SuperPaymaster .env.anvil.bak
const SEPOLIA_RPC = "https://eth-sepolia.g.alchemy.com/v2/Bx4QRW1-vnwJUePSAAD7N";
const DEPLOYER_KEY = "0x2717524c39f8b8ab74c902dc712e590fee36993774119c1e06d31daa4b0fbc81";
const OWNER_KEY = "0x7c28d50030917fb555bb19ac888f973b28eff37a7853cdb2da46d23fb46e4724";
const OWNER2_KEY = "0xc801db57d05466a8f16d645c39f59aeb0c1aee15b3a07b4f5680d3349f094009";

// SimpleAccount Factory from config.json
const SIMPLE_ACCOUNT_FACTORY = "0xc6e7DF5E7b4f2A278906862b61205850344D4e7d";

// Calculate SimpleAccount address for an owner
async function getSimpleAccountAddress(owner: string, salt: bigint = 0n): Promise<string> {
    // SimpleAccount address = CREATE2(factory, salt, initCodeHash(owner))
    // For SimpleAccountFactory, the address is deterministic based on owner and salt
    
    // Simplified: Use the factory's getAddress function pattern
    // Address = keccak256(0xff + factory + salt + keccak256(initCode))[12:]
    
    // For now, use a deterministic pattern (this would normally call factory.getAddress)
    // Since we're on local Anvil, we can use pre-calculated addresses or deploy dynamically
    
    // Return placeholder - will be filled after first deployment/run
    return "0x0000000000000000000000000000000000000000";
}

async function main() {
    console.log('⚡ Quick Environment Setup\n');
    
    const deployerAccount = privateKeyToAccount(DEPLOYER_KEY as `0x${string}`);
    console.log(`Deployer: ${deployerAccount.address}`);
    
    const ownerAccount = privateKeyToAccount(OWNER_KEY as `0x${string}`);
    console.log(`Account A/B Owner: ${ownerAccount.address}`);
    
    const owner2Account = privateKeyToAccount(OWNER2_KEY as `0x${string}`);
    console.log(`Account C Owner: ${owner2Account.address}`);
    
    // For local Anvil testing, we can use the EOA addresses directly for initial setup
    // Or pre-calculate SimpleAccount addresses
    
    // Since this is Anvil (local), SimpleAccounts need to be deployed first
    // Let's use placeholder addresses and note they need deployment
    
    console.log('\n📝 Writing configuration...');
    
    const envContent = `# Auto-configured for Experiment Runner
# Generated: ${new Date().toISOString()}

# Network RPCs
SEPOLIA_RPC_URL=${SEPOLIA_RPC}
OPTIMISM_RPC_URL=https://mainnet.optimism.io
ALCHEMY_BUNDLER_RPC_URL=${SEPOLIA_RPC}

# Pimlico
PIMLICO_API_KEY=pim_98Pb9bdb42J4KoD24UZt8v

# Private Keys
PRIVATE_KEY_JASON=${DEPLOYER_KEY}
OWNER_PRIVATE_KEY=${OWNER_KEY}
OWNER2_PRIVATE_KEY=${OWNER2_KEY}

# ETH Price
ETH_USD_PRICE=3500

# Contract Addresses (from SuperPaymaster deployment)
SUPER_PAYMASTER_ADDRESS=0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e
PAYMASTER_V4_ADDRESS=0x524F04724632eED237cbA3c37272e018b3A7967e
MYSBT_ADDRESS=0x5FC8d32690cc91D4c39d9d3abcBD16989F875707
APNTS_ADDRESS=0x8A791620dd6260079BF849Dc5567aDC3F2FdC318
BPNTS_ADDRESS=0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
GTOKEN_ADDRESS=0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
GTOKEN_STAKING_ADDRESS=0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9
REGISTRY_ADDRESS=0x0165878A594ca255338adfa4d48449f69242Eb8F
REPUTATION_SYSTEM_ADDRESS=0x59b670e9fA9D0A427751Af201D676719a970857b
OPERATOR_ADDRESS=${deployerAccount.address}

# EntryPoint
ENTRYPOINT_ADDRESS=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512

# Test Accounts - NEED TO BE DEPLOYED
# Run: cd ../SuperPaymaster && forge script script/DeployTestAccounts.s.sol
TEST_SIMPLE_ACCOUNT_A=0x0000000000000000000000000000000000000001
TEST_SIMPLE_ACCOUNT_B=0x0000000000000000000000000000000000000002
TEST_SIMPLE_ACCOUNT_C=0x0000000000000000000000000000000000000003

# SimpleAccount Factory
SIMPLE_ACCOUNT_FACTORY=0xc6e7DF5E7b4f2A278906862b61205850344D4e7d

# Experiment Settings
EXPERIMENT_RUNS=5
EXPERIMENT_NETWORK=local
`;
    
    fs.writeFileSync(ENV_FILE, envContent);
    console.log(`✅ Wrote: ${ENV_FILE}`);
    
    console.log('\n⚠️  IMPORTANT:');
    console.log('   TEST_SIMPLE_ACCOUNT addresses are placeholders');
    console.log('   These need to be deployed SimpleAccount contracts');
    console.log('\n💡 Next steps:');
    console.log('   1. Deploy SimpleAccounts on Anvil (if not already done)');
    console.log('   2. Update TEST_SIMPLE_ACCOUNT_A/B/C with real addresses');
    console.log('   3. Run validation: npx ts-node scripts/validate_environment.ts');
    console.log('   4. Run experiment: ./scripts/run_automated_experiment.sh local');
}

main().catch(console.error);
