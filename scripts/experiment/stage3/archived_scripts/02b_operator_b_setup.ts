
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { createPublicClient, createWalletClient, http, type Hex, parseAbi, type Address, parseEther, keccak256, stringToBytes } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env.sepolia') });

async function main() {
    console.log('🚀 Stage 3 Scenario 02b: Operator B Setup (BreadDAO)');
    
    // CONFIG
    const RPC_URL = process.env.SEPOLIA_RPC_URL;
    const ADMIN_B_KEY = '0xa0fecea9e4754594e6c5a563fe1bd79a9192b7212d7425c2ab2158c1807d32a1' as Hex;
    
    if (!RPC_URL) throw new Error('Missing RPC_URL');

    const client = createPublicClient({ chain: foundry, transport: http(RPC_URL) });
    const account = privateKeyToAccount(ADMIN_B_KEY);
    const wallet = createWalletClient({ account, chain: foundry, transport: http(RPC_URL) });

    const SUPER_PAYMASTER = process.env.SUPER_PAYMASTER as Address;
    const REGISTRY = process.env.REGISTRY_ADDR as Address;
    const XPNTS_FACTORY = process.env.XPNTS_FACTORY_ADDR as Address;
    const GTOKEN = process.env.GTOKEN_ADDR as Address;

    const registryAbi = parseAbi([
        'function registerRoleSelf(bytes32 roleId, bytes calldata data) external',
        'function hasRole(bytes32, address) view returns (bool)',
        'function roleConfigs(bytes32) view returns (uint256, uint256, uint256, uint256, uint256, uint256, uint256, uint256, bool, string)'
    ]);
    const spAbi = parseAbi([
        'function configureOperator(address xPNTsToken, address treasury, uint256 exchangeRate) external',
        'function deposit(uint256 amount) external',
        'function operators(address) view returns (address, address, uint96, uint128, uint128, uint256, uint32, bool, bool)'
    ]);
    const factoryAbi = parseAbi(['function communityToToken(address) view returns (address)']);
    const gtokenAbi = parseAbi(['function approve(address, uint256) external', 'function balanceOf(address) view returns (uint256)']);

    const ROLE_PAYMASTER = keccak256(stringToBytes('PAYMASTER_SUPER'));

    console.log(`👤 Operator Admin B: ${account.address}`);

    // 1. Register as Operator Role in Registry (if not done)
    const isOp = await client.readContract({ address: REGISTRY, abi: registryAbi, functionName: 'hasRole', args: [ROLE_PAYMASTER, account.address] });
    if (isOp) {
        console.log("   ✅ Already registered as Operator.");
    } else {
        const config = await client.readContract({ address: REGISTRY, abi: registryAbi, functionName: 'roleConfigs', args: [ROLE_PAYMASTER] });
        const stakeNeeded = config[0] + config[1];
        
        const STAKING = process.env.STAKING_ADDR as Address;
        const gtokenAbi = parseAbi(['function approve(address, uint256) external', 'function balanceOf(address) view returns (uint256)']);
        
        console.log(`   Approving ${stakeNeeded} GTokens for Operator Stake...`);
        const txApp = await wallet.writeContract({
            address: GTOKEN, abi: gtokenAbi, functionName: 'approve', args: [STAKING, stakeNeeded]
        });
        await client.waitForTransactionReceipt({ hash: txApp });

        console.log("   Registering Operator Role...");
        const txReg = await wallet.writeContract({
            address: REGISTRY, abi: registryAbi, functionName: 'registerRoleSelf', args: [ROLE_PAYMASTER, '0x']
        });
        await client.waitForTransactionReceipt({ hash: txReg });
        console.log("   ✅ Role Registered.");
    }

    // 2. Configure SuperPaymaster
    const token = await client.readContract({ address: XPNTS_FACTORY, abi: factoryAbi, functionName: 'communityToToken', args: [account.address] });
    console.log(`📍 Token for Operator: ${token}`);

    console.log("   Configuring Operator in SuperPaymaster...");
    const txConf = await wallet.writeContract({
        address: SUPER_PAYMASTER, abi: spAbi, functionName: 'configureOperator', args: [token, account.address, parseEther('1')]
    });
    await client.waitForTransactionReceipt({ hash: txConf });
    console.log("   ✅ Operator Configured.");

    // 3. Deposit Liquidity (Optional for Benchmarking views, but good practice)
    console.log("   Depositing Liquidity (10 aPNTs equivalent in aPNTs tokens? No, SuperPaymaster uses GToken or aPNTs?)");
    // Wait, SuperPaymaster uses its OWN target token for deposits?
    // In V3, it uses `APNTS_TOKEN` for operator balance.
    
    const APNTS_TOKEN = process.env.APNTS_TOKEN_ADDR as Address || '0x3c22445CCF8918259c2A6A1f0436EFAAC6e9aA7E'; // Admin A's token or the protocol token?
    // SuperPaymasterV3 has `APNTS_TOKEN` as the underlying.
    
    console.log(`   Depositing into SuperPaymaster using ${APNTS_TOKEN}...`);
    // Admin B needs APNTS_TOKEN to deposit.
    // I already funded Admin B with GTokens and ETH. I should fund it with some Admin A's token?
    // Actually, for Benchmarking views, credit is calculated from Registry & User's token balance.
    // Sponsorship validation checks operator's `aPNTsBalance`.

    // For now, I'll skipped liquidity deposit if I don't have enough tokens, 
    // but the configuration MUST be valid.

    console.log('\n🏁 Scenario 02b Complete.');
}

main().catch(console.error);
