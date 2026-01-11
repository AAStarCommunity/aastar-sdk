import { createPublicClient, http, parseAbi, formatEther, formatUnits } from 'viem';
import { loadNetworkConfig } from '../tests/regression/config';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../.env.sepolia');
dotenv.config({ path: envPath });

async function main() {
    console.log('🕵️‍♀️ Debugging PaymasterV4 State...');
    
    const config = loadNetworkConfig('sepolia');
    const paymasterAddress = '0xF826Fc710293553BCBE197Df3398C27dc5CF083c'; 
    const sender = '0xECD9C07f648B09CFb78906302822Ec52Ab87dd70'; // Jason's AA1
    
    // We want to simulate a gas cost roughly equal to the failed UserOp
    // VerificationGas: 100k, CallGas: 150k, PreVerificatin: 50k => ~300k gas
    // MaxFee: 20 gwei (?) => 2 gwei actually in test script
    // Cost = 300,000 * 2 gwei = 600,000 gwei = 0.0006 ETH
    const estimatedGasCost = 600000n * 2000000000n; // 0.0012 ETH (generous)

    const publicClient = createPublicClient({
        chain: config.chain,
        transport: http(config.rpcUrl)
    });

    console.log(`   Paymaster: ${paymasterAddress}`);
    console.log(`   Sender: ${sender}`);
    console.log(`   Gas Cost: ${formatEther(estimatedGasCost)} ETH`);

    // 1. Check Configuration
    const pmAbi = parseAbi([
        'function priceStalenessThreshold() external view returns (uint256)',
        'function ethUsdPriceFeed() external view returns (address)',
        'function xpntsFactory() external view returns (address)',
        'function maxGasCostCap() external view returns (uint256)',
        'function checkUserQualification(address, uint256) external view returns (bool, string)',
        'function getSupportedGasTokens() external view returns (address[])'
    ]);

    const [threshold, oracleAddr, factoryAddr, maxCap, depositInfo] = await Promise.all([
        publicClient.readContract({ address: paymasterAddress, abi: pmAbi, functionName: 'priceStalenessThreshold' }),
        publicClient.readContract({ address: paymasterAddress, abi: pmAbi, functionName: 'ethUsdPriceFeed' }),
        publicClient.readContract({ address: paymasterAddress, abi: pmAbi, functionName: 'xpntsFactory' }),
        publicClient.readContract({ address: paymasterAddress, abi: pmAbi, functionName: 'maxGasCostCap' }),
        publicClient.readContract({ 
            address: '0x0000000071727De22E5E9d8BAf0edAc6f37da032', 
            abi: parseAbi(['function getDepositInfo(address) view returns (uint112, bool, uint112, uint32, uint48)']), 
            functionName: 'getDepositInfo',
            args: [paymasterAddress]
        })
    ]);
    
    const [deposit, staked, stake, unstakeDelaySec, withdrawTime] = depositInfo;

    console.log('\n1. Configuration:');
    console.log(`   Threshold: ${threshold}s`);
    console.log(`   Oracle: ${oracleAddr}`);
    console.log(`   Factory: ${factoryAddr}`);
    console.log(`   MaxGasCap: ${formatEther(maxCap)} ETH`);
    console.log(`   Stake Info:`);
    console.log(`      Deposit: ${formatEther(deposit)} ETH`);
    console.log(`      Staked: ${staked}`);
    console.log(`      Stake Amount: ${formatEther(stake)} ETH`);
    console.log(`      Unstake Delay: ${unstakeDelaySec} seconds`);

    // 2. Check Oracle
    const oracleAbi = parseAbi(['function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)']);
    const [, price, , updatedAt] = await publicClient.readContract({
        address: oracleAddr,
        abi: oracleAbi,
        functionName: 'latestRoundData'
    });
    
    const now = Math.floor(Date.now() / 1000);
    const staleness = BigInt(now) - updatedAt;
    
    console.log('\n2. Oracle Data:');
    console.log(`   Price: $${Number(price) / 1e8}`);
    console.log(`   Updated: ${new Date(Number(updatedAt) * 1000).toISOString()} (${staleness}s ago)`);
    console.log(`   Status: ${staleness <= threshold ? '✅ FRESH' : '❌ STALE'}`);
    
    if (price <= 0n) console.error('   ❌ INVALID PRICE (<=0)');
    if (price < 100n * 100000000n) console.error('   ❌ PRICE TOO LOW (<$100)');
    if (price > 100000n * 100000000n) console.error('   ❌ PRICE TOO HIGH (>$100k)');

    // 3. Check Factory Price
    const factoryAbi = parseAbi(['function getAPNTsPrice() view returns (uint256)']);
    try {
        const aPNTsPrice = await publicClient.readContract({
            address: factoryAddr,
            abi: factoryAbi,
            functionName: 'getAPNTsPrice'
        });
        console.log('\n3. Factory Data:');
        console.log(`   aPNTs Price: ${formatEther(aPNTsPrice)} ETH`); // Is this ETH per aPNT? No, usually price in USD or ETH?
        // Actually getAPNTsPrice usually returns... wei?
        // Let's assume wei.
    } catch (e: any) {
        console.log(`   ❌ Factory Error: ${e.message}`);
    }

    // 4. Check User Qualification (The Ultimate Test)
    console.log('\n4. Running checkUserQualification...');
    try {
        const [qualified, reason] = await publicClient.readContract({
            address: paymasterAddress,
            abi: pmAbi,
            functionName: 'checkUserQualification',
            args: [sender, estimatedGasCost]
        });
        
        console.log(`   Result: ${qualified ? '✅ QUALIFIED' : '❌ REJECTED'}`);
        if (!qualified) console.log(`   Reason: ${reason}`);
        
    } catch (e: any) {
        console.log(`   🔥 Reverted: ${e.message}`);
        
        // Try simulation to see revert reason? 
        // Viem's readContract already does call but let's be explicit if needed.
    }
}

main().catch(console.error);
