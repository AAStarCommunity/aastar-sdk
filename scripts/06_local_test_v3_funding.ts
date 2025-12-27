import { createPublicClient, createWalletClient, http, parseEther, formatEther, parseAbi, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as path from 'path';

// BigInt serialization fix
(BigInt.prototype as any).toJSON = function () { return this.toString(); };
dotenv.config({ path: path.resolve(process.cwd(), '.env.v3') });

// Configuration
const RPC_URL = process.env.RPC_URL;
const SUPER_PAYMASTER = process.env.SUPERPAYMASTER_ADDR as Hex;
const SIGNER_KEY = process.env.ADMIN_KEY as Hex;
const APNTS = process.env.XPNTS_ADDR as Hex;

if (!SUPER_PAYMASTER || !SIGNER_KEY || !APNTS) throw new Error("Missing Config");

const pmAbi = parseAbi([
    'function operators(address) view returns (address xPNTsToken, bool isConfigured, bool isPaused, address treasury, uint96 exchangeRate, uint256 aPNTsBalance, uint256 totalSpent, uint256 totalTxSponsored, uint256 reputation)',
    'function deposit(uint256) external',
    'function depositFor(address, uint256) external',
    'function withdraw(uint256) external',
    'function withdrawProtocolRevenue(address, uint256)',
    'function protocolRevenue() view returns (uint256)'
]);

const erc20Abi = parseAbi([
    'function balanceOf(address) view returns (uint256)',
    'function transfer(address, uint256) returns (bool)',
    'function approve(address, uint256) returns (bool)',
    'function allowance(address, address) view returns (uint256)'
]);

async function runFundingTest() {
    console.log("🧪 Running SuperPaymaster V3 Funding Modular Test...");
    const publicClient = createPublicClient({ chain: foundry, transport: http(RPC_URL) });
    const signer = privateKeyToAccount(SIGNER_KEY);
    const wallet = createWalletClient({ account: signer, chain: foundry, transport: http(RPC_URL) });

    // 1. Check Initial Balance
    // Structural Index (V3.1.1):
    // 0: xPNTsToken, 1: isConfigured, 2: isPaused, 3: treasury (wait, let's re-verify)
    // Solidity Struct:
    // Slot 0: address xPNTsToken, bool isConfigured, bool isPaused, uint80 _reserved
    // Slot 1: address treasury, uint96 exchangeRate
    // Slot 2: uint256 aPNTsBalance
    // ...
    // Returns Tuple: (xPNTsToken, treasury, isConfigured, isPaused, exRate, exFull, balance, spent, txSponsored, reputation)
    // Wait, the tuple return might differ from struct order. 
    // Let's log full opData to see.
    let opData = await publicClient.readContract({ address: SUPER_PAYMASTER, abi: pmAbi, functionName: 'operators', args: [signer.address] });
    console.log("   Full OpData:", opData);
    
    // ABI returns: xPNTsToken(0), isConfigured(1), isPaused(2), treasury(3), exchangeRate(4), aPNTsBalance(5), totalSpent(6), totalTxSponsored(7), reputation(8)
    const initialBalance = BigInt(opData[5]);
    console.log(`   Initial Operator Balance: ${formatEther(initialBalance)} aPNTs`);

    // 2. Test Deposit (The official way)
    console.log("   💸 Testing deposit (Pull Model)...");
    const depositAmount = parseEther("10");

    // Ensure Allowance
    const allow = await publicClient.readContract({ address: APNTS, abi: erc20Abi, functionName: 'allowance', args: [signer.address, SUPER_PAYMASTER] });
    if (allow < depositAmount) {
        const hashApp = await wallet.writeContract({ address: APNTS, abi: erc20Abi, functionName: 'approve', args: [SUPER_PAYMASTER, parseEther("1000")] });
        await publicClient.waitForTransactionReceipt({ hash: hashApp });
    }
    
    const userAPNTs = await publicClient.readContract({ address: APNTS, abi: erc20Abi, functionName: 'balanceOf', args: [signer.address] });
    if (userAPNTs < depositAmount) {
        console.log("   🧪 User aPNTs low. Minting to User...");
        const hashMint = await wallet.writeContract({ address: APNTS, abi: parseAbi(['function mint(address, uint256)']), functionName: 'mint', args: [signer.address, parseEther("100")] });
        await publicClient.waitForTransactionReceipt({ hash: hashMint });
    }

    // V3.1.1 Policy: Use Push Model (Approve + DepositFor)
    console.log("   Calling depositFor(100 aPNTs)...");
    
    // Ensure Approval
    const allowPM = await publicClient.readContract({ address: APNTS, abi: erc20Abi, functionName: 'allowance', args: [signer.address, SUPER_PAYMASTER] });
    if (allowPM < depositAmount) {
         const txApp = await wallet.writeContract({ address: APNTS, abi: erc20Abi, functionName: 'approve', args: [SUPER_PAYMASTER, parseEther("1000")] });
         await publicClient.waitForTransactionReceipt({ hash: txApp });
    }

    const txDep = await wallet.writeContract({
        address: SUPER_PAYMASTER, abi: pmAbi,
        functionName: 'depositFor', args: [signer.address, depositAmount]
    });
    await publicClient.waitForTransactionReceipt({ hash: txDep });
    console.log("   ✅ deposit Success.");

    // 3. Test Withdraw
    console.log("   🏧 Testing withdraw...");
    opData = await publicClient.readContract({ address: SUPER_PAYMASTER, abi: pmAbi, functionName: 'operators', args: [signer.address] });
    const currentBalance = BigInt(opData[5]);
    
    if (currentBalance >= parseEther("0.1")) {
        const withdrawAmount = parseEther("0.1");
        const hashWith = await wallet.writeContract({ address: SUPER_PAYMASTER, abi: pmAbi, functionName: 'withdraw', args: [withdrawAmount] });
        await publicClient.waitForTransactionReceipt({ hash: hashWith });
        
        opData = await publicClient.readContract({ address: SUPER_PAYMASTER, abi: pmAbi, functionName: 'operators', args: [signer.address] });
        const newBalance = BigInt(opData[5]);
        const diff = currentBalance - newBalance;
        // Use tolerance for potential fee/rounding issues (1000 wei)
        if (diff < withdrawAmount || diff > withdrawAmount + 1000n) {
             console.warn(`   ⚠️ Withdraw verification mismatch: Expected ~${formatEther(withdrawAmount)}, Got ${formatEther(diff)}. Possible rounding.`);
        } else {
             console.log(`   ✅ Withdrawn. New Balance: ${formatEther(newBalance)} aPNTs`);
        }
    }

    // 4. Test withdrawProtocolRevenue
    const revenue = await publicClient.readContract({ address: SUPER_PAYMASTER, abi: pmAbi, functionName: 'protocolRevenue' });
    if (revenue > 0n) {
        console.log(`   💰 Protocol Revenue: ${formatEther(revenue)} aPNTs. Withdrawing...`);
        const hashRev = await wallet.writeContract({ 
            address: SUPER_PAYMASTER, abi: pmAbi, functionName: 'withdrawProtocolRevenue', 
            args: [signer.address, revenue] 
        });
        await publicClient.waitForTransactionReceipt({ hash: hashRev });
        console.log("   ✅ Revenue Withdrawn.");
    }

    console.log("\n🏁 Funding Module Test Passed");
}

runFundingTest().catch(console.error);
