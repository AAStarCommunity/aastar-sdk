
import { createWalletClient, createPublicClient, http, parseEther, encodeFunctionData, parseAbi, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { loadNetworkConfig } from '../tests/regression/config.js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.sepolia') });

async function main() {
    console.log("🚀 Manual Deploy: Jason Paymaster V4");
    
    // Config
    const config = await loadNetworkConfig('sepolia');
    const factoryAddr = config.contracts.paymasterFactory;
    const entryPoint = config.contracts.entryPoint;
    const priceFeed = process.env.priceFeed || config.contracts.priceFeed; // Fallback
    
    if (!priceFeed) throw new Error("PriceFeed not found");

    const rpcUrl = process.env.RPC_URL;
    const client = createPublicClient({ chain: config.chain, transport: http(rpcUrl) });
    
    // Jason Account
    const jasonKey = process.env.PRIVATE_KEY_JASON as `0x${string}`;
    const jasonAccount = privateKeyToAccount(jasonKey);
    const wallet = createWalletClient({ account: jasonAccount, chain: config.chain, transport: http(rpcUrl) });
    
    console.log(`👤 Jason: ${jasonAccount.address}`);
    console.log(`🏭 Factory: ${factoryAddr}`);

    // 1. Deploy
    // initialize(address _entryPoint, address _owner, address _treasury, address _ethUsdPriceFeed, uint256 _serviceFeeRate, uint256 _maxGasCostCap, uint256 _priceStalenessThreshold)
    const initData = encodeFunctionData({
        abi: parseAbi(['function initialize(address,address,address,address,uint256,uint256,uint256)']),
        functionName: 'initialize',
        args: [
            entryPoint,
            jasonAccount.address, // Owner
            jasonAccount.address, // Treasury
            priceFeed as Address,
            100n, // 1% fee
            parseEther('1'), // 1 ETH Cap
            3600n // 1h staleness
        ]
    });

    console.log("📝 Deploying...");
    const hash = await wallet.writeContract({
        address: factoryAddr,
        abi: parseAbi(['function deployPaymaster(string version, bytes data) returns (address)']),
        functionName: 'deployPaymaster',
        args: ['v4.2.repair', initData],
        chain: config.chain,
        account: jasonAccount
    });
    console.log(`   Tx: ${hash}`);
    await client.waitForTransactionReceipt({ hash });
    
    // Get Address
    const pmAddr = await client.readContract({
        address: factoryAddr,
        abi: parseAbi(['function getPaymasterByOperator(address) view returns (address)']),
        functionName: 'getPaymasterByOperator',
        args: [jasonAccount.address]
    });
    console.log(`✅ Paymaster Deployed: ${pmAddr}`);
    
    // 2. Stake & Init Price
    console.log("💰 Staking 0.1 ETH...");
    const stakeH = await wallet.writeContract({
        address: pmAddr,
        abi: parseAbi(['function addStake(uint32) external payable']),
        functionName: 'addStake',
        args: [86400],
        value: parseEther('0.1')
    });
    await client.waitForTransactionReceipt({ hash: stakeH });
    
    console.log("💹 Init Price in PM...");
    try {
        const upH = await wallet.writeContract({
            address: pmAddr,
            abi: parseAbi(['function updatePrice() external']),
            functionName: 'updatePrice',
            args: []
        });
        await client.waitForTransactionReceipt({ hash: upH });
    } catch(e) { console.log("   Warning: updatePrice failed (maybe paused?)", e); }

    // 3. Deposit to EntryPoint
    console.log("🏦 Deposit 0.1 ETH to EntryPoint...");
    const depH = await wallet.writeContract({
        address: entryPoint,
        abi: parseAbi(['function depositTo(address) external payable']),
        functionName: 'depositTo',
        args: [pmAddr],
        value: parseEther('0.1')
    });
    await client.waitForTransactionReceipt({ hash: depH });
    
    // 4. Update State File
    const statePath = path.resolve(__dirname, 'l4-state.json');
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    state.operators.jason.paymasterV4 = pmAddr;
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
    console.log("💾 State Updated");
}

main();
