import { createPublicClient, http, Hex, parseAbi, formatEther } from 'viem';
import { sepolia } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../env/.env.v3') });

async function main() {
    const rpc = process.env.SEPOLIA_RPC_URL;
    const superPaymaster = process.env.SUPER_PAYMASTER_ADDRESS as Hex;
    // const operator = process.env.PRIVATE_KEY_JASON ... address
    // Hardcoded Operator from previous context
    const operator = "0x411BD567E46C0781248dbB6a9211891C032885e5"; 

    console.log(`🔎 Checking Operator Status`);
    console.log(`   Paymaster: ${superPaymaster}`);
    console.log(`   Operator: ${operator}`);
    
    const client = createPublicClient({ chain: sepolia, transport: http(rpc) });

    const abi = parseAbi([
        'struct OperatorConfig { address xPNTsToken; address treasury; bool isConfigured; uint256 exchangeRate; uint256 aPNTsBalance; uint256 totalSpent; uint256 totalTxSponsored; }',
        'function operators(address) view returns (address xPNTsToken, address treasury, bool isConfigured, uint256 exchangeRate, uint256 aPNTsBalance, uint256 totalSpent, uint256 totalTxSponsored)'
    ]);

    try {
        const [token, treasury, isConfig, rate, balance, spent, count] = await client.readContract({ 
            address: superPaymaster, 
            abi, 
            functionName: 'operators', 
            args: [operator] 
        });

        console.log(`\n📊 Operator Config:`);
        console.log(`   Is Configured: ${isConfig} ${isConfig ? '✅' : '❌'}`);
        console.log(`   Token: ${token}`);
        console.log(`   Treasury: ${treasury}`);
        console.log(`   Exchange Rate: ${rate}`);
        console.log(`   aPNTs Balance: ${formatEther(balance)} (${balance})`);
        console.log(`   Total Spent: ${formatEther(spent)}`);
        console.log(`   Total Tx: ${count}`);

        if (!isConfig) console.error("   ❌ Operator NOT Configured!");
        if (balance < 1000000000000000000n) console.warn("   ⚠️  Low Balance! (< 1.0)");

    } catch (e) {
        console.error("❌ Could not read operators():", e);
    }
}

main().catch(console.error);
