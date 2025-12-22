import { createPublicClient, createWalletClient, http, parseEther, formatEther, type Hex, encodeAbiParameters, keccak256, toBytes, type Address, toHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper for BigInt serialization
(BigInt.prototype as any).toJSON = function () { return this.toString(); };
dotenv.config({ path: path.resolve(process.cwd(), '.env.v3') });

// Configuration
const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545';
const SUPER_PAYMASTER = process.env.SUPER_PAYMASTER as Hex;
const REGISTRY_ADDR = process.env.REGISTRY_ADDR as Hex;
const ADMIN_KEY = process.env.ADMIN_KEY as Hex;
const XPNTS_ADDR = process.env.XPNTS_ADDR as Hex;
const GTOKEN_ADDR = process.env.GTOKEN_ADDR as Hex;
const STAKING_ADDR = process.env.STAKING_ADDR as Hex;

if (!SUPER_PAYMASTER || !REGISTRY_ADDR || !ADMIN_KEY || !XPNTS_ADDR) {
    throw new Error(`Missing Env Config. SUPER_PAYMASTER: ${SUPER_PAYMASTER}, REGISTRY_ADDR: ${REGISTRY_ADDR}, ADMIN_KEY: ${ADMIN_KEY ? 'exists' : 'null'}, XPNTS_ADDR: ${XPNTS_ADDR}`);
}

// Load ABIs
const loadAbi = (name: string) => {
    const p = path.resolve(__dirname, `../abis/${name}.abi.json`);
    if (!existsSync(p)) throw new Error(`ABI not found: ${p}`);
    return JSON.parse(readFileSync(p, "utf-8"));
};

const REGISTRY_ABI = loadAbi('Registry');
const XPNTS_ABI = loadAbi('xPNTsToken');
const GTOKEN_ABI = loadAbi('GToken');

async function runCreditTest() {
    console.log("🧪 Running Credit System Redesign Verification (Viem)...");
    
    // Clients
    const publicClient = createPublicClient({ chain: foundry, transport: http(RPC_URL) });
    const adminAccount = privateKeyToAccount(ADMIN_KEY);
    const adminWallet = createWalletClient({ account: adminAccount, chain: foundry, transport: http(RPC_URL) });
    
    // Generate Random User
    const userAccount = privateKeyToAccount(keccak256(toBytes(`user_${Date.now()}`)));
    const userAddr = userAccount.address;
    
    console.log(`   User: ${userAddr}`);
    console.log(`   Admin: ${adminAccount.address}`);

    // 1. Register User in Registry (ENDUSER role)
    console.log(`\n1️⃣ Registering User for Credit...`);
    const ENDUSER_ROLE = keccak256(toBytes("ENDUSER"));
    
    const userWallet = createWalletClient({ account: userAccount, chain: foundry, transport: http(RPC_URL) });
    
    // Fund User FIRST
    console.log(`   Funding User with 5 ETH...`);
    const hashFund = await adminWallet.sendTransaction({ to: userAddr, value: parseEther("5.0") });
    await publicClient.waitForTransactionReceipt({ hash: hashFund });

    // Mint GTokens for registration
    console.log(`   Minting GTokens...`);
    await adminWallet.writeContract({
        address: GTOKEN_ADDR,
        abi: GTOKEN_ABI,
        functionName: 'mint',
        args: [userAddr, parseEther("100")]
    });
    const hashApprove = await userWallet.writeContract({
        address: GTOKEN_ADDR,
        abi: GTOKEN_ABI,
        functionName: 'approve',
        args: [STAKING_ADDR, parseEther("100")]
    });
    await publicClient.waitForTransactionReceipt({ hash: hashApprove });

    // Encode Role Data
    const roleData = encodeAbiParameters(
        [
            {
                type: 'tuple',
                components: [
                    { name: 'account', type: 'address' },
                    { name: 'community', type: 'address' },
                    { name: 'avatarURI', type: 'string' },
                    { name: 'ensName', type: 'string' },
                    { name: 'stakeAmount', type: 'uint256' }
                ]
            }
        ],
        [
            {
                account: userAddr,
                community: adminAccount.address,
                avatarURI: "ipfs://avatar",
                ensName: "user.eth",
                stakeAmount: 0n
            }
        ]
    );

    try {
        const hash = await userWallet.writeContract({
            address: REGISTRY_ADDR,
            abi: REGISTRY_ABI,
            functionName: 'registerRoleSelf',
            args: [ENDUSER_ROLE, roleData]
        });
        await publicClient.waitForTransactionReceipt({ hash });
        console.log("   ✅ User Registered");
    } catch (e: any) {
        console.log("   ⚠️ Registration error:", e.message?.split('\n')[0]);
    }

    // 1.1 Set Credit Tier 1 Limit (Default level for 0 reputation)
    console.log(`   Admin setting Tier 1 limit to 100 aPNTs...`);
    const tierTx = await adminWallet.writeContract({
        address: REGISTRY_ADDR,
        abi: REGISTRY_ABI,
        functionName: 'setCreditTier',
        args: [1n, parseEther("100")],
        account: adminAccount
    });
    await publicClient.waitForTransactionReceipt({ hash: tierTx });

    // Check Credit Limit
    const creditLimit = await publicClient.readContract({
        address: REGISTRY_ADDR,
        abi: REGISTRY_ABI,
        functionName: 'getCreditLimit',
        args: [userAddr]
    }) as bigint;
    console.log(`   Credit Limit: ${formatEther(creditLimit)} aPNTs`);


    // 1.2 Wire SuperPaymaster in xPNTsToken (if not wired by setup)
    console.log(`   Wiring SuperPaymaster in xPNTsToken...`);
    let tokenOwner = await publicClient.readContract({
        address: XPNTS_ADDR,
        abi: XPNTS_ABI,
        functionName: 'communityOwner',
        args: []
    }) as Address;

    await (adminWallet as any).request({ method: 'anvil_impersonateAccount', params: [tokenOwner] });
    await (adminWallet as any).request({ method: 'anvil_setBalance', params: [tokenOwner, toHex(parseEther("1.0"))] });
    
    let ownerWallet = createWalletClient({ account: tokenOwner, chain: foundry, transport: http(RPC_URL) });
    await ownerWallet.writeContract({
        address: XPNTS_ADDR,
        abi: XPNTS_ABI,
        functionName: 'setSuperPaymasterAddress',
        args: [SUPER_PAYMASTER]
    });
    await (adminWallet as any).request({ method: 'anvil_stopImpersonatingAccount', params: [tokenOwner] });

    // 2. Simulate Debt Recording
    console.log(`\n2️⃣ Simulating Debt Recording (Impersonating SuperPaymaster)...`);
    
    await (adminWallet as any).request({ method: 'anvil_impersonateAccount', params: [SUPER_PAYMASTER] });
    // Fund SP for gas via setBalance (since it may not have receive())
    await (adminWallet as any).request({ 
        method: 'anvil_setBalance', 
        params: [SUPER_PAYMASTER, toHex(parseEther("10.0"))] 
    });

    const spWallet = createWalletClient({
        account: SUPER_PAYMASTER as Address,
        chain: foundry,
        transport: http(RPC_URL)
    });

    const DEBT_AMOUNT = parseEther("10"); 

    const hashDebt = await spWallet.writeContract({
        address: XPNTS_ADDR,
        abi: XPNTS_ABI,
        functionName: 'recordDebt',
        args: [userAddr, DEBT_AMOUNT]
    });
    await publicClient.waitForTransactionReceipt({ hash: hashDebt });
    
    await (adminWallet as any).request({ method: 'anvil_stopImpersonatingAccount', params: [SUPER_PAYMASTER] });

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
    
    tokenOwner = await publicClient.readContract({
        address: XPNTS_ADDR,
        abi: XPNTS_ABI,
        functionName: 'communityOwner',
        args: []
    }) as Address;
    
    await (adminWallet as any).request({ method: 'anvil_impersonateAccount', params: [tokenOwner] });
    await (adminWallet as any).request({ 
        method: 'anvil_setBalance', 
        params: [tokenOwner, toHex(parseEther("10.0"))] 
    });

    ownerWallet = createWalletClient({
        account: tokenOwner,
        chain: foundry,
        transport: http(RPC_URL)
    });

    const MINT_AMOUNT = parseEther("15"); 
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
