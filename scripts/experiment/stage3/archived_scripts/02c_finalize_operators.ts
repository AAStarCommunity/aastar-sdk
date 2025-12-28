
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { createPublicClient, createWalletClient, http, type Hex, parseAbi, type Address, parseEther, keccak256, stringToBytes } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env.sepolia') });

async function main() {
    console.log('🚀 Finalizing Operators for Stage 3');
    
    const RPC_URL = process.env.SEPOLIA_RPC_URL;
    const ADMIN_A_KEY = '0x0c52a28d94e411a01580d995eb0b0a90256e7eef32f7eaddfc9f0c889afd67ce' as Hex;
    const ADMIN_B_KEY = '0xa0fecea9e4754594e6c5a563fe1bd79a9192b7212d7425c2ab2158c1807d32a1' as Hex;
    
    if (!RPC_URL) throw new Error('Missing RPC_URL');

    const client = createPublicClient({ chain: sepolia, transport: http(RPC_URL) });
    const SP = '0xd6EACcC89522f1d507d226495adD33C5A74b6A45' as Address;
    const REGISTRY = '0xf265d21c2cE6B2fA5d6eD1A2d7b032F03516BE19' as Address;
    const GTOKEN = '0xfc5671D606e8dd65EA39FB3f519443B7DAB40570' as Address;
    const STAKING = '0xB8C4Ed4906baF13Cb5fE49B1A985B76BAccEEC06' as Address;
    const XPNTS_FACTORY = '0xbECF67cdf55b04E8090C0170AA2936D07e2b3708' as Address;

    const ROLE_PAYMASTER = keccak256(stringToBytes('PAYMASTER_SUPER'));

    const regAbi = parseAbi([
        'function registerRoleSelf(bytes32, bytes) external',
        'function hasRole(bytes32, address) view returns (bool)',
        'function roleConfigs(bytes32) view returns (uint256, uint256, uint256, uint256, uint256, uint256, uint256, uint256, bool, string)'
    ]);
    const spAbi = parseAbi([
        'function configureOperator(address, address, uint256) external',
        'function APNTS_TOKEN() view returns (address)'
    ]);
    const tokenAbi = parseAbi(['function approve(address, uint256) external', 'function balanceOf(address) view returns (uint256)']);
    const factoryAbi = parseAbi(['function communityToToken(address) view returns (address)']);

    const admins = [
        { name: 'Admin A', key: ADMIN_A_KEY },
        { name: 'Admin B', key: ADMIN_B_KEY }
    ];

    for (const admin of admins) {
        console.log(`\n--- Processing ${admin.name} ---`);
        const account = privateKeyToAccount(admin.key);
        const wallet = createWalletClient({ account, chain: sepolia, transport: http(RPC_URL) });

        // 1. Role Check/Register
        const isOp = await client.readContract({ address: REGISTRY, abi: regAbi, functionName: 'hasRole', args: [ROLE_PAYMASTER, account.address] });
        if (!isOp) {
            console.log("   Registering PAYMASTER_SUPER role...");
            const config = await client.readContract({ address: REGISTRY, abi: regAbi, functionName: 'roleConfigs', args: [ROLE_PAYMASTER] });
            const needed = config[0] + config[1];
            
            console.log(`   Staking ${needed} GTokens...`);
            const txApp = await wallet.writeContract({ address: GTOKEN, abi: tokenAbi, functionName: 'approve', args: [STAKING, needed] });
            await client.waitForTransactionReceipt({ hash: txApp });
            
            const txReg = await wallet.writeContract({ address: REGISTRY, abi: regAbi, functionName: 'registerRoleSelf', args: [ROLE_PAYMASTER, '0x'] });
            await client.waitForTransactionReceipt({ hash: txReg });
            console.log("   ✅ Role registered.");
        } else {
            console.log("   ✅ Already has PAYMASTER_SUPER role.");
        }

        // 2. Configure SP
        const token = await client.readContract({ address: XPNTS_FACTORY, abi: factoryAbi, functionName: 'communityToToken', args: [account.address] });
        console.log(`   Operator Token: ${token}`);
        
        console.log("   Configuring in SuperPaymaster...");
        const txConf = await wallet.writeContract({
            address: SP, abi: spAbi, functionName: 'configureOperator', args: [token, account.address, parseEther('1')]
        });
        await client.waitForTransactionReceipt({ hash: txConf });
        console.log("   ✅ Configured.");
    }

    console.log('\n🏁 Finalization Complete.');
}

main().catch(console.error);
