import { createPublicClient, http, type Address, parseAbi } from 'viem';
import { loadNetworkConfig } from '../tests/regression/config';
import * as dotenv from 'dotenv';

async function main() {
    dotenv.config({ path: '.env.sepolia' });
    const network = 'sepolia';
    const config = await loadNetworkConfig(network);
    
    // Bob's AA account from previous logs
    const bobAA = '0x021C8cA0a2825F69fE79177a7e19Fb0bB171D1E2' as Address;
    const bPNT = '0xC3b67Cea25f3683caE71e401856cA7409778A558' as Address;
    const paymasterV4 = '0x0D0585EAD84628fd1419D05433FbE98D3b7C05Fc' as Address;

    const publicClient = createPublicClient({
        chain: { id: 11155111, name: 'sepolia', nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [process.env.SEPOLIA_RPC_URL!] } } } as any,
        transport: http(process.env.SEPOLIA_RPC_URL)
    });

    console.log(`\n🔍 Checking status for Bob: ${bobAA}`);
    
    // 1. Check ERC20 Balance
    const balance = await publicClient.readContract({
        address: bPNT,
        abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
        functionName: 'balanceOf',
        args: [bobAA]
    });
    console.log(`💰 bPNT Balance: ${balance.toString()}`);

    // 2. Check Paymaster Deposit
    const deposit = await publicClient.readContract({
        address: paymasterV4,
        abi: parseAbi(['function balances(address user, address token) view returns (uint256)']),
        functionName: 'balances',
        args: [bobAA, bPNT]
    });
    console.log(`🏦 Paymaster Deposit: ${deposit.toString()}`);

    // 3. Check Paymaster Cap
    const cap = await publicClient.readContract({
        address: paymasterV4,
        abi: parseAbi(['function maxGasCostCap() view returns (uint256)']),
        functionName: 'maxGasCostCap',
        args: []
    });
    console.log(`🛡️ Paymaster MaxGasCostCap: ${cap.toString()}`);

    // Estimate cost (assuming 1.5 Gwei and 400k total gas)
    const totalGas = 400000n;
    const gasPrice = 2000000000n; // 2 Gwei
    const gasCost = totalGas * gasPrice;
    console.log(`📉 Estimated Gas Cost (2 Gwei, 400k gas): ${gasCost.toString()} Wei`);
    
    if (gasCost > cap) {
        console.warn(`⚠️ ALERT: Estimated cost (${gasCost}) exceeds paymaster cap (${cap})!`);
    } else {
        console.log(`✅ Cost within cap.`);
    }
}

main().catch(console.error);
