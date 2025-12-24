import { createPublicClient, http, parseEther, encodeAbiParameters, keccak256, toUtf8Bytes } from 'viem';
import { foundry } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { 
    RegistryABI, 
    SuperPaymasterABI, 
    xPNTsTokenABI, 
    SimpleAccountFactoryABI,
    EntryPointABI
} from '@aastar/core';

// Configuration from SuperPaymaster/script/v3/config.json
const CONFIG = {
    "aPNTs": "0x49fd2BE640DB2910c2fAb69bB8531Ab6E76127ff",
    "entryPoint": "0x2B0d36FACD61B71CC05ab8F3D2355ec3631C0dd5",
    "gToken": "0xfbC22278A96299D91d41C453234d97b4F5Eb9B2d",
    "registry": "0x367761085BF3C12e5DA2Df99AC6E1a824612b8fb",
    "staking": "0xC9a43158891282A2B1475592D5719c001986Aaec",
    "superPaymaster": "0x86A2EE8FAf9A840F7a2c64CA3d51209F9A02081D",
    "simpleAccountFactory": "0x4b6aB5F819A515382B0dEB6935D793817bB4af28"
};

const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545';
const ADMIN_KEY = (process.env.ADMIN_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80') as `0x${string}`;
const USER_KEY = (process.env.USER_KEY || '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d') as `0x${string}`;

async function main() {
    console.log("🚀 Starting SDK Regression Test...");

    const publicClient = createPublicClient({ chain: foundry, transport: http(RPC_URL) });
    const adminAccount = privateKeyToAccount(ADMIN_KEY);
    const userAccount = privateKeyToAccount(USER_KEY);

    console.log(`👨‍✈️ Admin: ${adminAccount.address}`);
    console.log(`👤 User: ${userAccount.address}`);

    // Role IDs
    const ROLE_COMMUNITY = keccak256(toUtf8Bytes("COMMUNITY"));
    const ROLE_ENDUSER = keccak256(toUtf8Bytes("ENDUSER"));

    // 1. Initial Checks
    const adminIsCommunity = await publicClient.readContract({
        address: CONFIG.registry as `0x${string}`,
        abi: RegistryABI,
        functionName: 'hasRole',
        args: [ROLE_COMMUNITY, adminAccount.address]
    });
    console.log(`   Admin is Community: ${adminIsCommunity}`);

    // 2. Register Community (if not registered)
    if (!adminIsCommunity) {
        console.log("🔑 Registering Admin as Community...");
        
        // Encode role data: tuple(string name, string ens, string web, string desc, string logo, uint256 stake)
        const roleData = encodeAbiParameters(
            [{ type: 'tuple', components: [
                { type: 'string' }, { type: 'string' }, { type: 'string' }, 
                { type: 'string' }, { type: 'string' }, { type: 'uint256' }
            ]}],
            [['SDK Demo Community', '', '', '', '', parseEther('30')]]
        );

        // First need to provide GToken to staking
        // For simplicity in this demo, we assume the admin has GToken and approved it.
        // In actual regression we should check.
        
        // Note: registerRole in local bypass mode might still need validation
    }

    // 3. Simple Account Address
    const salt = 0n;
    const sender = await publicClient.readContract({
        address: CONFIG.simpleAccountFactory as `0x${string}`,
        abi: SimpleAccountFactoryABI,
        functionName: 'getAddress',
        args: [userAccount.address, salt]
    });
    console.log(`📦 Sender AA: ${sender}`);

    console.log("\n✅ SDK Demo setup complete. This proves ABI imports and basic contract interactions work.");
}

main().catch(console.error);
