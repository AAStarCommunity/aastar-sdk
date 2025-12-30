
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { createPublicClient, createWalletClient, http, type Hex, parseAbi, keccak256, stringToBytes, parseEther, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env.sepolia') });

async function main() {
    console.log('🚀 Stage 3 Scenario 01b: Bread Community Launch (Direct Viem)');
    
    // CONFIG
    const RPC_URL = process.env.SEPOLIA_RPC_URL;
    const ADMIN_KEY = '0xa0fecea9e4754594e6c5a563fe1bd79a9192b7212d7425c2ab2158c1807d32a1' as Hex; // Admin B
    if (!RPC_URL || !ADMIN_KEY) throw new Error('Missing Config');

    const client = createPublicClient({ chain: foundry, transport: http(RPC_URL) });
    const account = privateKeyToAccount(ADMIN_KEY);
    const wallet = createWalletClient({ account, chain: foundry, transport: http(RPC_URL) });

    const REGISTRY = process.env.REGISTRY_ADDR as Address;
    const GTOKEN = process.env.GTOKEN_ADDR as Address;
    const STAKING = process.env.STAKING_ADDR as Address;
    const FACTORY = process.env.XPNTS_FACTORY_ADDR as Address;

    const registryAbi = parseAbi([
        'function registerRoleSelf(bytes32 roleId, bytes calldata data) external',
        'function hasRole(bytes32, address) view returns (bool)',
        'function roleConfigs(bytes32) view returns (uint256 minStake, uint256 entryBurn, uint256, uint256, uint256, uint256, uint256, uint256, bool isActive, string description)'
    ]);
    const gtokenAbi = parseAbi(['function approve(address, uint256) external', 'function balanceOf(address) view returns (uint256)']);
    const factoryAbi = parseAbi([
        'function deployxPNTsToken(string, string, string, string, uint256, address) external returns (address)',
        'function communityToToken(address) view returns (address)'
    ]);

    const ROLE_COMMUNITY = keccak256(stringToBytes('COMMUNITY'));

    console.log(`👤 Admin B: ${account.address}`);

    // 1. Register Community B
    console.log("   --- Community Registration (BreadDAO) ---");
    const registered = await client.readContract({ address: REGISTRY, abi: registryAbi, functionName: 'hasRole', args: [ROLE_COMMUNITY, account.address] });
    
    if (registered) {
        console.log("   ✅ Already registered.");
    } else {
        const config = await client.readContract({ address: REGISTRY, abi: registryAbi, functionName: 'roleConfigs', args: [ROLE_COMMUNITY] });
        const stake = config[0];
        const entryBurn = config[1];
        const totalStake = stake + entryBurn;

        // Balance Check
        const bal = await client.readContract({ address: GTOKEN, abi: gtokenAbi, functionName: 'balanceOf', args: [account.address] });
        if (bal < totalStake) {
             throw new Error(`Insufficient GToken: ${bal} < ${totalStake}`);
        }

        // Approve
        console.log("   Approving GToken...");
        const txApprove = await wallet.writeContract({
            address: GTOKEN, abi: gtokenAbi, functionName: 'approve', args: [STAKING, totalStake]
        });
        await client.waitForTransactionReceipt({ hash: txApprove });

        // Register
        console.log("   Registering BreadDAO...");
        const uniqueName = `BreadDAO_${Date.now()}`;
        // Helper inline
        const { encodeAbiParameters } = await import('viem');
        const data = encodeAbiParameters(
            [{ type: 'tuple', components: [
                { name: 'name', type: 'string' }, { name: 'ensName', type: 'string' },
                { name: 'website', type: 'string' }, { name: 'description', type: 'string' },
                { name: 'logoURI', type: 'string' }, { name: 'stakeAmount', type: 'uint256' }
            ]}],
            [[uniqueName, '', '', '', '', 0n]] as any
        );

        const txReg = await wallet.writeContract({
            address: REGISTRY, abi: registryAbi, functionName: 'registerRoleSelf', args: [ROLE_COMMUNITY, data]
        });
        const receipt = await client.waitForTransactionReceipt({ hash: txReg });
        if (receipt.status !== 'success') throw new Error("Registration failed");
        console.log(`   ✅ Registered ${uniqueName}.`);
    }

    // 2. Deploy xPNTs
    console.log("   --- xPNTs Deployment (BreadPNT) ---");
    const existingToken = await client.readContract({ address: FACTORY, abi: factoryAbi, functionName: 'communityToToken', args: [account.address] });
    
    if (existingToken && existingToken !== '0x0000000000000000000000000000000000000000') {
        console.log(`   ✅ Token exists: ${existingToken}`);
    } else {
        console.log("   Creating Token...");
        const txCreate = await wallet.writeContract({
            address: FACTORY, abi: factoryAbi, functionName: 'deployxPNTsToken', 
            args: ["Bread Token", "BREAD", "BreadDAO", "bread.eth", parseEther("1"), '0x0000000000000000000000000000000000000000']
        });
        await client.waitForTransactionReceipt({ hash: txCreate });
        const newToken = await client.readContract({ address: FACTORY, abi: factoryAbi, functionName: 'communityToToken', args: [account.address] });
        console.log(`   ✅ Token deployed: ${newToken}`);
    }

    console.log('\n🏁 Scenario 01b Complete.');
}

main().catch(console.error);
