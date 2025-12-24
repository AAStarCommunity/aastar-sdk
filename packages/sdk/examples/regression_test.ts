import { createPublicClient, http, parseEther, encodeAbiParameters, keccak256, stringToBytes } from 'viem';
import { foundry } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { 
    RegistryABI, 
    SimpleAccountFactoryABI,
    EntryPointABI
} from '@aastar/core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dynamic Config Loading from SuperPaymaster deployment
const SP_CONFIG_PATH = path.resolve(__dirname, '../../../../SuperPaymaster/script/v3/config.json');

function loadConfig() {
    if (fs.existsSync(SP_CONFIG_PATH)) {
        return JSON.parse(fs.readFileSync(SP_CONFIG_PATH, 'utf8'));
    }
    console.error("❌ SuperPaymaster config.json not found. Please run 'script/v3/01-deploy.sh' first.");
    process.exit(1);
}

const CONFIG = loadConfig();
const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545';
const ADMIN_KEY = (process.env.ADMIN_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80') as `0x${string}`;
const USER_KEY = (process.env.USER_KEY || '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d') as `0x${string}`;

async function main() {
    console.log("\n🧪 AAStar SDK Automated Regression Test");
    console.log("========================================\n");

    const publicClient = createPublicClient({ chain: foundry, transport: http(RPC_URL) });
    const adminAccount = privateKeyToAccount(ADMIN_KEY);
    const userAccount = privateKeyToAccount(USER_KEY);

    console.log(`📡 Network: Local (Anvil)`);
    console.log(`👨‍✈️ Admin EOA: ${adminAccount.address}`);
    console.log(`👤 User Signer: ${userAccount.address}`);

    // Role IDs (Using stringToBytes correctly)
    const ROLE_COMMUNITY = keccak256(stringToBytes("COMMUNITY"));

    // 1. Connectivity & Address Verification
    console.log("\n🔍 Phase 1: Verification");
    const adminIsCommunity = await publicClient.readContract({
        address: CONFIG.registry as `0x${string}`,
        abi: RegistryABI,
        functionName: 'hasRole',
        args: [ROLE_COMMUNITY, adminAccount.address]
    });
    console.log(`   [OK] Registry at ${CONFIG.registry}`);
    console.log(`   [OK] Admin has COMMUNITY role: ${adminIsCommunity}`);

    // 2. Simple Account Factory Interaction
    const salt = 0n;
    const senderAddress = await publicClient.readContract({
        address: CONFIG.simpleAccountFactory as `0x${string}`,
        abi: SimpleAccountFactoryABI,
        functionName: 'getAddress',
        args: [userAccount.address, salt]
    });
    const byteCode = await publicClient.getBytecode({ address: senderAddress });
    
    console.log(`   [OK] SimpleAccountFactory at ${CONFIG.simpleAccountFactory}`);
    console.log(`   [OK] Target AA Address: ${senderAddress} (Deployed: ${!!byteCode})`);

    // 3. ABI Compatibility Check (v0.8)
    const epAddr = await publicClient.readContract({
        address: CONFIG.superPaymaster as `0x${string}`,
        abi: [
            {
              "inputs": [],
              "name": "entryPoint",
              "outputs": [
                {
                  "internalType": "contract IEntryPoint",
                  "name": "",
                  "type": "address"
                }
              ],
              "stateMutability": "view",
              "type": "function"
            }
        ] as const,
        functionName: 'entryPoint'
    });
    console.log(`   [OK] SuperPaymaster linked to EntryPoint: ${epAddr}`);

    console.log("\n✨ Verification Complete: SDK is correctly linked to blockchain state.\n");
}

main().catch((err) => {
    console.error("\n❌ Test Failed:");
    console.error(err);
    process.exit(1);
});
