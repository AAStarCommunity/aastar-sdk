import { createPublicClient, createWalletClient, http, parseEther, formatEther, type Hex, toHex, encodeFunctionData, parseAbi, concat, type Address, keccak256 } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { ERC20Client } from '../packages/tokens/src/index.ts';
import { FinanceClient } from '../packages/finance/src/index.ts';
import { SuperPaymasterClient } from '../packages/superpaymaster/src/index.ts';
import { UserOpClient, packUserOpLimits, getUserOpHash } from '../packages/aa/src/index.ts';

(BigInt.prototype as any).toJSON = function () { return this.toString(); };
dotenv.config({ path: path.resolve(__dirname, '../../env/.env.v3') });

const RPC_URL = process.env.SEPOLIA_RPC_URL;
const BUNDLER_RPC = process.env.ALCHEMY_BUNDLER_RPC_URL;
const ENTRY_POINT = "0x0000000071727DE22E5E9d8BAf0edAc6f37da032";

const ACCOUNT_C = process.env.TEST_SIMPLE_ACCOUNT_C as Hex; 
const SIGNER_KEY = process.env.PRIVATE_KEY_JASON as Hex; 
const BPNTS = process.env.BPNTS_ADDRESS as Hex;
const APNTS = process.env.APNTS_ADDRESS as Hex;
const SUPER_PAYMASTER = process.env.SUPER_PAYMASTER_ADDRESS as Hex;
const ANNI_KEY = process.env.PRIVATE_KEY_ANNI as Hex; 
const RECEIVER = "0x93E67dbB7B2431dE61a9F6c7E488e7F0E2eD2B3e";

if (!BUNDLER_RPC || !BPNTS || !SUPER_PAYMASTER) throw new Error("Missing Config for Group C");

export async function runSuperPaymasterTest() {
    console.log("🚀 Starting Group C: SuperPaymaster (Refactored)...");
    const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC_URL) });
    const bundlerClient = createPublicClient({ chain: sepolia, transport: http(BUNDLER_RPC) });
    const signer = privateKeyToAccount(SIGNER_KEY);
    const anniWallet = createWalletClient({ account: privateKeyToAccount(ANNI_KEY), chain: sepolia, transport: http(RPC_URL) });

    // 1. Check SuperPaymaster Deposit 
    const pmDeposit = await FinanceClient.getEntryPointBalance(publicClient, ENTRY_POINT, SUPER_PAYMASTER);
    console.log(`   🏦 PM Deposit: ${formatEther(pmDeposit)} ETH`);
    if (pmDeposit < parseEther("0.05")) {
        console.log("   ⚠️  Low Deposit. Converting Anni ETH -> EntryPoint Deposit...");
        await FinanceClient.depositToEntryPoint(anniWallet, ENTRY_POINT, SUPER_PAYMASTER, parseEther("0.05"));
        console.log("   ✅ Deposited.");
    }

    // 2. Check Allowance
    const allow = await ERC20Client.allowance(publicClient, BPNTS, ACCOUNT_C, SUPER_PAYMASTER);
    console.log(`   🔓 bPNTs Allowance: ${formatEther(allow)}`);

    if (allow < parseEther("100")) {
        console.log("   ⚠️  Allowance low. Sending Approve Ops...");
        await sendUserOp(
            publicClient, bundlerClient, signer, ACCOUNT_C,
            BPNTS, 0n, 
            encodeFunctionData({ abi: parseAbi(['function approve(address, uint256) returns (bool)']), functionName: 'approve', args: [SUPER_PAYMASTER, parseEther("1000000")] })
        );
        console.log("   ✅ Approved.");
    }

    // 3. Setup Operator 
    await setupOperator(publicClient, signer, SUPER_PAYMASTER, APNTS, signer.address);

    // 4. Prepare Transfer UserOp (aPNTs Transfer, bPNTs Gas)
    console.log("   🔄 Sending Test Transfer...");
    const transferData = encodeFunctionData({ abi: parseAbi(['function transfer(address, uint256) returns (bool)']), functionName: 'transfer', args: [RECEIVER, parseEther("1")] });
    
    const pmStruct = {
        paymaster: SUPER_PAYMASTER,
        paymasterVerificationGasLimit: 300000n,
        paymasterPostOpGasLimit: 10000n,
        paymasterData: signer.address 
    };

    const metrics = await sendUserOp(
        publicClient, bundlerClient, signer, ACCOUNT_C,
        APNTS, 0n, transferData, 
        pmStruct
    );
    console.log("   ✅ Group C Test Passed!");
    
    return {
        group: 'SuperPaymaster',
        ...metrics
    };
}

// Ensure Signer is a valid Operator
async function setupOperator(publicClient: any, signerAccount: any, pm: Hex, token: Hex, treasury: Hex) {
    console.log("   🛠️  Setting up Operator...");
    const wallet = createWalletClient({ account: signerAccount, chain: sepolia, transport: http(RPC_URL) });
    const pmClient = new SuperPaymasterClient(publicClient, pm);

    // 1. Check Config
    const opData = (await pmClient.getOperator(signerAccount.address)) as any;
    const isConfigured = opData[1];
    const balance = opData[5]; // Index 5 in the 9-field struct is aPNTsBalance

    if (!isConfigured) {
        console.log("   ⚙️  Configuring Operator...");
        const hash = await SuperPaymasterClient.configureOperator(wallet, pm, token, treasury, 1000000000000000000n);
        await publicClient.waitForTransactionReceipt({ hash });
        console.log("   ✅ Configured.");
    }

    // 2. Check Balance & Deposit
    if (balance < parseEther("75")) {
        console.log(`   💰 Operator Balance Low (${formatEther(balance)}). Depositing...`);
        const allow = await ERC20Client.allowance(publicClient, token, signerAccount.address, pm);
        if (allow < parseEther("100")) {
            const tx = await ERC20Client.approve(wallet, token, pm, parseEther("1000"));
            await publicClient.waitForTransactionReceipt({ hash: tx });
            console.log("   🔓 Approved.");
        }
        
        try {
            const hash = await FinanceClient.operatorDeposit(wallet, pm, parseEther("100"));
            await publicClient.waitForTransactionReceipt({ hash });
            console.log("   ✅ Deposited (Legacy): 100 aPNTs");
        } catch (e: any) {
            console.warn(`   ⚠️ Legacy Deposit failed. Switching to Push Mode...`);
            await ERC20Client.transfer(wallet, token, pm, parseEther("100"));
            const txNotify = await FinanceClient.operatorNotifyDeposit(wallet, pm, parseEther("100"));
            await publicClient.waitForTransactionReceipt({ hash: txNotify });
            console.log("   ✅ Deposited (Push + Notify): 100 aPNTs");
        }
    }
}

async function sendUserOp(
    client: any, bundler: any, signer: any, sender: Address, target: Address, value: bigint, innerData: Hex, 
    paymasterStruct?: { paymaster: Address, paymasterVerificationGasLimit: bigint, paymasterPostOpGasLimit: bigint, paymasterData: Hex }
) {
    const callData = encodeFunctionData({ 
        abi: parseAbi(['function execute(address, uint256, bytes)']), 
        functionName: 'execute', 
        args: [target, value, innerData] 
    });
    
    const nonce = await client.readContract({
        address: ENTRY_POINT, 
        abi: [{ inputs: [{ name: "sender", type: "address" }, { name: "key", type: "uint192" }], name: "getNonce", outputs: [{ name: "nonce", type: "uint256" }], stateMutability: "view", type: "function" }],
        functionName: 'getNonce', args: [sender, 0n]
    });

    let estOp: any = {
        sender, nonce: toHex(nonce), initCode: "0x", callData,
        signature: "0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c" as Hex
    };

    if (paymasterStruct) {
        estOp.paymaster = paymasterStruct.paymaster;
        estOp.paymasterVerificationGasLimit = toHex(paymasterStruct.paymasterVerificationGasLimit);
        estOp.paymasterPostOpGasLimit = toHex(paymasterStruct.paymasterPostOpGasLimit);
        estOp.paymasterData = paymasterStruct.paymasterData;
    }

    console.log("   ☁️  Estimating...");
    const estRes: any = await UserOpClient.estimateGas(bundler, estOp, ENTRY_POINT);

    const vGas = BigInt(estRes.verificationGasLimit ?? 500000n);
    const cGas = BigInt(estRes.callGasLimit ?? 100000n);
    const pvGas = BigInt(estRes.preVerificationGas ?? 50000n);
    const pmVerif = BigInt(estRes.paymasterVerificationGasLimit ?? (paymasterStruct?.paymasterVerificationGasLimit ?? 0n));
    const pmPost = BigInt(estRes.paymasterPostOpGasLimit ?? (paymasterStruct?.paymasterPostOpGasLimit ?? 0n));

    const block = await client.getBlock();
    const priority = parseEther("5", "gwei");
    const maxFee = block.baseFeePerGas! * 2n + priority;

    const accountGasLimits = packUserOpLimits(vGas + 50000n, cGas + 20000n);
    const gasFees = packUserOpLimits(priority, maxFee);
    
    let paymasterAndData = "0x" as Hex;
    if (paymasterStruct) {
        paymasterAndData = concat([paymasterStruct.paymaster, packUserOpLimits(pmVerif + 50000n, pmPost + 10000n), paymasterStruct.paymasterData]);
    }

    const packedUserOp = {
        sender, nonce, initCode: "0x" as Hex, callData, accountGasLimits, preVerificationGas: pvGas, gasFees, paymasterAndData, signature: "0x" as Hex
    };

    const hash = getUserOpHash(packedUserOp, ENTRY_POINT, sepolia.id);
    const sig = await signer.signMessage({ message: { raw: hash } });

    const unpackedUserOp: any = {
        sender, nonce: toHex(nonce), initCode: "0x", callData,
        callGasLimit: toHex(cGas + 20000n), verificationGasLimit: toHex(vGas + 50000n), preVerificationGas: toHex(pvGas),
        maxFeePerGas: toHex(maxFee), maxPriorityFeePerGas: toHex(priority), signature: sig
    };

    if (paymasterStruct) {
        unpackedUserOp.paymaster = paymasterStruct.paymaster;
        unpackedUserOp.paymasterVerificationGasLimit = toHex(pmVerif + 50000n);
        unpackedUserOp.paymasterPostOpGasLimit = toHex(pmPost + 10000n);
        unpackedUserOp.paymasterData = paymasterStruct.paymasterData;
    }

    console.log("   🚀 Sending Unpacked...");
    const userOpHashRes = await UserOpClient.sendUserOp(bundler, unpackedUserOp, ENTRY_POINT);
    console.log(`   ✅ Sent: ${userOpHashRes}`);
    
    // Receipt polling
    let receipt: any = null;
    for(let i=0; i<60; i++) {
        const r = await UserOpClient.getReceipt(bundler, userOpHashRes);
        if(r) {
            receipt = (r as any).receipt;
            console.log(`   ✅ Mined: ${receipt.transactionHash}`);
            break;
        }
        await new Promise(res => setTimeout(res, 2000));
    }

    if (!receipt) throw new Error("Timeout waiting for receipt");

    return {
        gasUsed: BigInt(receipt.gasUsed),
        totalCost: BigInt(receipt.gasUsed) * BigInt(receipt.effectiveGasPrice),
        status: receipt.status === '0x1' ? 'Success' : 'Failed',
        txHash: receipt.transactionHash
    };
}

if (require.main === module) {
    runSuperPaymasterTest().catch(console.error);
}
