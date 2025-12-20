import { createPublicClient, createWalletClient, http, parseAbi, parseEther, formatEther, type Hex, encodeAbiParameters, keccak256, toBytes, zeroAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { readFileSync } from 'fs';

// Helper for BigInt serialization
(BigInt.prototype as any).toJSON = function () { return this.toString(); };
dotenv.config({ path: path.resolve(process.cwd(), '.env.v3') });

// Configuration
const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545';
const SUPERPAYMASTER_ADDR = process.env.SUPERPAYMASTER_ADDR as Hex;
const REGISTRY_ADDR = process.env.REGISTRY_ADDR as Hex;
const ADMIN_KEY = process.env.ADMIN_KEY as Hex;
const XPNTS_ADDR = process.env.XPNTS_ADDR as Hex;

if (!SUPERPAYMASTER_ADDR || !REGISTRY_ADDR || !ADMIN_KEY || !XPNTS_ADDR) {
    throw new Error("Missing Env Config");
}

// Load ABIs
// We can use parseAbi for simple interfaces, or load JSON for full contracts. Use JSON for accuracy.
const REGISTRY_ABI = JSON.parse(readFileSync("../../SuperPaymaster/contracts/out/Registry.sol/Registry.json", "utf-8")).abi;
const XPNTS_ABI = JSON.parse(readFileSync("../../SuperPaymaster/contracts/out/xPNTsToken.sol/xPNTsToken.json", "utf-8")).abi;

async function runCreditTest() {
    console.log("🧪 Running Credit System Redesign Verification (Viem)...");
    
    // Clients
    const publicClient = createPublicClient({ chain: foundry, transport: http(RPC_URL) });
    const adminAccount = privateKeyToAccount(ADMIN_KEY);
    const adminWallet = createWalletClient({ account: adminAccount, chain: foundry, transport: http(RPC_URL) });
    
    // Generate Random User
    const userAccount = privateKeyToAccount(keccak256(toBytes(Date.now()))); // Simple random via time
    const userAddr = userAccount.address;
    
    console.log(`   User: ${userAddr}`);
    console.log(`   Admin: ${adminAccount.address}`);

    // 1. Register User in Registry (ENDUSER role)
    console.log(`\n1️⃣ Registering User for Credit...`);
    const ENDUSER_ROLE = keccak256(toBytes("ENDUSER"));
    
    // Encode Role Data: (address, address, string, string, uint256)
    const roleData = encodeAbiParameters(
        [
            { name: 'account', type: 'address' },
            { name: 'community', type: 'address' },
            { name: 'avatar', type: 'string' },
            { name: 'ens', type: 'string' },
            { name: 'stake', type: 'uint256' }
        ],
        [userAddr, zeroAddress, "ipfs://avatar", "user.eth", 0n]
    );

    try {
        const hash = await adminWallet.writeContract({
            address: REGISTRY_ADDR,
            abi: REGISTRY_ABI,
            functionName: 'registerRole',
            args: [ENDUSER_ROLE, userAddr, roleData]
        });
        await publicClient.waitForTransactionReceipt({ hash });
        console.log("   ✅ User Registered");
    } catch (e: any) {
        console.log("   ⚠️ Registration warning:", e.message?.split('\n')[0]);
    }

    // Check Credit Limit
    const creditLimit = await publicClient.readContract({
        address: REGISTRY_ADDR,
        abi: REGISTRY_ABI,
        functionName: 'getCreditLimit',
        args: [userAddr]
    }) as bigint;
    console.log(`   Credit Limit: ${formatEther(creditLimit)} aPNTs`);


    // 2. Simulate Debt Recording
    console.log(`\n2️⃣ Simulating Debt Recording (Impersonating Paymaster)...`);
    
    // Impersonate SuperPaymaster
    await (adminWallet as any).request({ method: 'anvil_impersonateAccount', params: [SUPERPAYMASTER_ADDR] });
    
    // Fund SP for gas
    await adminWallet.sendTransaction({ to: SUPERPAYMASTER_ADDR, value: parseEther("1.0") });

    const DEBT_AMOUNT = parseEther("10"); // 10 xPNTs

    // Call recordDebt as SuperPaymaster
    // We need a wallet client for SP
    const spWallet = createWalletClient({
        account: SUPERPAYMASTER_ADDR,
        chain: foundry,
        transport: http(RPC_URL)
    });

    const hashDebt = await spWallet.writeContract({
        address: XPNTS_ADDR,
        abi: XPNTS_ABI,
        functionName: 'recordDebt',
        args: [userAddr, DEBT_AMOUNT]
    });
    await publicClient.waitForTransactionReceipt({ hash: hashDebt });
    
    await (adminWallet as any).request({ method: 'anvil_stopImpersonatingAccount', params: [SUPERPAYMASTER_ADDR] });

    // Verify Debt
    const debt = await publicClient.readContract({
        address: XPNTS_ADDR,
        abi: XPNTS_ABI,
        functionName: 'getDebt',
        args: [userAddr]
    }) as bigint;
    
    console.log(`   User Debt: ${formatEther(debt)} xPNTs`);
    if (debt !== DEBT_AMOUNT) throw new Error("Debt recording failed");
    console.log("   ✅ Debt Recorded Correctly");


    // 3. Auto-Repayment Verification
    console.log(`\n3️⃣ Verifying Auto-Repayment (Minting xPNTs to User)...`);
    
    // Get Token Owner
    const tokenOwner = await publicClient.readContract({
        address: XPNTS_ADDR,
        abi: XPNTS_ABI,
        functionName: 'communityOwner',
    }) as Hex;
    console.log(`   Token Owner: ${tokenOwner}`);
    
    // Impersonate Owner
    await (adminWallet as any).request({ method: 'anvil_impersonateAccount', params: [tokenOwner] });
    await adminWallet.sendTransaction({ to: tokenOwner, value: parseEther("1.0") }); // Gas

    const ownerWallet = createWalletClient({
        account: tokenOwner,
        chain: foundry,
        transport: http(RPC_URL)
    });

    const MINT_AMOUNT = parseEther("15"); // Mint 15
    console.log(`   Minting ${formatEther(MINT_AMOUNT)} xPNTs...`);

    const hashMint = await ownerWallet.writeContract({
        address: XPNTS_ADDR,
        abi: XPNTS_ABI,
        functionName: 'mint',
        args: [userAddr, MINT_AMOUNT]
    });
    await publicClient.waitForTransactionReceipt({ hash: hashMint });
    
    await (adminWallet as any).request({ method: 'anvil_stopImpersonatingAccount', params: [tokenOwner] });

    // Check Balance and Debt
    const debtAfter = await publicClient.readContract({
        address: XPNTS_ADDR,
        abi: XPNTS_ABI,
        functionName: 'getDebt',
        args: [userAddr]
    }) as bigint;

    const balanceAfter = await publicClient.readContract({
        address: XPNTS_ADDR,
        abi: XPNTS_ABI,
        functionName: 'balanceOf',
        args: [userAddr]
    }) as bigint;

    console.log(`   Debt After: ${formatEther(debtAfter)} xPNTs (Expected: 0.0)`);
    console.log(`   Balance After: ${formatEther(balanceAfter)} xPNTs (Expected: 5.0)`);

    if (debtAfter > 0n) throw new Error("Debt was not fully repaid!");
    if (balanceAfter !== parseEther("5")) throw new Error(`Balance mismatch! Got ${formatEther(balanceAfter)}, expected 5.0`);

    console.log(`\n✅🎉 Credit System Redesign Verification PASSED!`);
}

runCreditTest().catch((e) => {
    console.error(e);
    process.exit(1);
});
