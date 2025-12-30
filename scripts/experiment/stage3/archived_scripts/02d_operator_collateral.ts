
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { createPublicClient, createWalletClient, http, type Hex, parseAbi, type Address, parseEther, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env.sepolia') });

async function main() {
    console.log('🚀 Setting up Operator Collateral (using depositFor)');
    
    const RPC_URL = process.env.SEPOLIA_RPC_URL;
    const JASON_KEY = process.env.ADMIN_PRIVATE_KEY as Hex; // Deployer / Minter
    const ADMIN_A_KEY = '0x0c52a28d94e411a01580d995eb0b0a90256e7eef32f7eaddfc9f0c889afd67ce' as Hex;
    const ADMIN_B_KEY = '0xa0fecea9e4754594e6c5a563fe1bd79a9192b7212d7425c2ab2158c1807d32a1' as Hex;
    
    if (!RPC_URL || !JASON_KEY) throw new Error('Missing Config');

    const client = createPublicClient({ chain: foundry, transport: http(RPC_URL) });
    const SP = '0xd6EACcC89522f1d507d226495adD33C5A74b6A45' as Address;
    const APNTS = '0xD348d910f93b60083bF137803FAe5AF25E14B69d' as Address;

    const spAbi = parseAbi(['function depositFor(address, uint256) external', 'function operators(address) view returns (uint128, uint96, bool, bool, address, uint32, address, uint256, uint256)']);
    const tokenAbi = parseAbi(['function mint(address, uint256) external', 'function approve(address, uint256) external', 'function balanceOf(address) view returns (uint256)']);

    const jasonAccount = privateKeyToAccount(JASON_KEY);
    const jasonWallet = createWalletClient({ account: jasonAccount, chain: foundry, transport: http(RPC_URL) });

    const COLLATERAL_AMT = parseEther('100');

    const admins = [
        { name: 'Admin A', key: ADMIN_A_KEY },
        { name: 'Admin B', key: ADMIN_B_KEY }
    ];

    const GAS_CONFIG = {
        maxFeePerGas: parseEther('0.00000005'), // 50 gwei
        maxPriorityFeePerGas: parseEther('0.000000002') // 2 gwei
    };

    for (const admin of admins) {
        console.log(`\n--- Collateral for ${admin.name} ---`);
        const account = privateKeyToAccount(admin.key);
        const wallet = createWalletClient({ account, chain: foundry, transport: http(RPC_URL) });

        // 0. Check Balance
        const bal = await client.readContract({ address: APNTS, abi: tokenAbi, functionName: 'balanceOf', args: [account.address] });
        console.log(`   Initial aPNTs Balance: ${formatEther(bal)}`);

        // 1. Mint if needed
        if (bal < COLLATERAL_AMT) {
            console.log(`   Minting ${COLLATERAL_AMT} aPNTs...`);
            try {
                const txMint = await jasonWallet.writeContract({ 
                    address: APNTS, abi: tokenAbi, functionName: 'mint', args: [account.address, COLLATERAL_AMT],
                    ...GAS_CONFIG
                });
                await client.waitForTransactionReceipt({ hash: txMint });
            } catch (e) { console.log("   ⚠️ Mint failed:", e); }
        }

        // 2. Approve SP
        console.log("   Approving SuperPaymaster...");
        const txApp = await wallet.writeContract({ 
            address: APNTS, abi: tokenAbi, functionName: 'approve', args: [SP, COLLATERAL_AMT],
            ...GAS_CONFIG
        });
        await client.waitForTransactionReceipt({ hash: txApp });

        // 3. DepositFor
        console.log("   Calling depositFor...");
        const txDep = await wallet.writeContract({ 
            address: SP, abi: spAbi, functionName: 'depositFor', args: [account.address, COLLATERAL_AMT],
            ...GAS_CONFIG
        });
        await client.waitForTransactionReceipt({ hash: txDep });
        
        const op = await client.readContract({ address: SP, abi: spAbi, functionName: 'operators', args: [account.address] });
        console.log(`   ✅ Success. New SP Balance: ${formatEther(op[0])}`);
    }

    console.log('\n🏁 Collateral Setup Complete.');
}

main().catch(console.error);
