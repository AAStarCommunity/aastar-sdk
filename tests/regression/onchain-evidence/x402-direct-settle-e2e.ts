/**
 * x402 direct-settle ON-CHAIN E2E (Sepolia) — proves X402Facilitator.settleX402PaymentDirect
 * end-to-end against the live v5.4.1 facilitator, with real on-chain provisioning.
 *
 * Roles (all .env.sepolia EOAs):
 *   - payer    = Anni (holds pnts; signs the EIP-712 X402PaymentAuthorization)
 *   - facilitator/caller = Jason (already holds ROLE_PAYMASTER_SUPER; submits the settle)
 *   - recipient = Bob
 *   - pnts.communityOwner = Anni → Anni approves Jason as a facilitator (separation-of-duties: facilitator != owner)
 *
 * Run: pnpm exec tsx tests/regression/onchain-evidence/x402-direct-settle-e2e.ts
 */
import {
  createPublicClient, createWalletClient, http, parseAbi, parseUnits, formatUnits,
  keccak256, toHex, type Address, type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.sepolia" });
const RPC = process.env.SEPOLIA_RPC_URL || "https://eth-sepolia.g.alchemy.com/v2/9bwo2HaiHpUXnDS-rohIK";
const n = (k?: string) => (k!.startsWith("0x") ? k! : `0x${k}`) as Hex;

const FACILITATOR = "0xfe1DB01e1d6622e722B92ed5993af61325DB92aF" as Address; // X402Facilitator v5.4.1
const PNTS = "0xE6579A90dc498a710008de12119812D0FB7aA224" as Address;        // Mycelium pnts (xPNTs)
const CHAIN_ID = 11155111;

const ERC20 = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function approvedFacilitators(address) view returns (bool)",
  "function addApprovedFacilitator(address facilitator) external",
]);
const FAC_ABI = parseAbi([
  "function settleX402PaymentDirect(address from, address to, address asset, uint256 amount, uint256 maxFee, uint256 validBefore, bytes32 nonce, bytes signature) returns (bytes32)",
  "function facilitatorFeeBPS() view returns (uint256)",
]);

async function main() {
  const anni = privateKeyToAccount(n(process.env.PRIVATE_KEY_ANNI));   // payer + pnts communityOwner
  const jason = privateKeyToAccount(n(process.env.PRIVATE_KEY_JASON)); // facilitator (ROLE_PAYMASTER_SUPER)
  const bob = privateKeyToAccount(n(process.env.PRIVATE_KEY_BOB)).address; // recipient

  const pub = createPublicClient({ chain: sepolia, transport: http(RPC) });
  const anniW = createWalletClient({ account: anni, chain: sepolia, transport: http(RPC) });
  const jasonW = createWalletClient({ account: jason, chain: sepolia, transport: http(RPC) });
  const ev: Record<string, string> = {};

  const amount = parseUnits("10", 18);
  const maxFee = parseUnits("1", 18);
  const validBefore = 4102444800n; // year 2100, well in the future (no Date.now needed for correctness)
  const nonce = keccak256(toHex(`x402-e2e-${validBefore}-${anni.address}-${bob}`));

  console.log(`\n💸 x402 direct-settle E2E (Sepolia)`);
  console.log(`   payer(Anni)=${anni.address} facilitator(Jason)=${jason.address} to(Bob)=${bob}`);
  const feeBPS = await pub.readContract({ address: FACILITATOR, abi: FAC_ABI, functionName: "facilitatorFeeBPS" });
  console.log(`   facilitatorFeeBPS=${feeBPS}`);

  // ── 1. Anni (communityOwner) approves Jason as a facilitator (if not already) ──
  const already = await pub.readContract({ address: PNTS, abi: ERC20, functionName: "approvedFacilitators", args: [jason.address] });
  if (!already) {
    const tx = await anniW.writeContract({ address: PNTS, abi: ERC20, functionName: "addApprovedFacilitator", args: [jason.address] });
    await pub.waitForTransactionReceipt({ hash: tx });
    ev.approve = tx;
    console.log(`[1] addApprovedFacilitator(Jason) tx ${tx}`);
  } else {
    console.log(`[1] Jason already approved facilitator`);
  }

  // ── 2. Anni (payer) signs the EIP-712 X402PaymentAuthorization ──
  const signature = await anni.signTypedData({
    domain: { name: "X402Facilitator", version: "1", chainId: CHAIN_ID, verifyingContract: FACILITATOR },
    types: {
      X402PaymentAuthorization: [
        { name: "from", type: "address" }, { name: "to", type: "address" }, { name: "asset", type: "address" },
        { name: "amount", type: "uint256" }, { name: "maxFee", type: "uint256" },
        { name: "validBefore", type: "uint256" }, { name: "nonce", type: "bytes32" },
      ],
    },
    primaryType: "X402PaymentAuthorization",
    message: { from: anni.address, to: bob, asset: PNTS, amount, maxFee, validBefore, nonce },
  });
  console.log(`[2] Anni signed X402 auth (EIP-712)`);

  const payerBefore = await pub.readContract({ address: PNTS, abi: ERC20, functionName: "balanceOf", args: [anni.address] });
  const recipBefore = await pub.readContract({ address: PNTS, abi: ERC20, functionName: "balanceOf", args: [bob] });

  // ── 3. Jason (facilitator) submits settleX402PaymentDirect ──
  const tx = await jasonW.writeContract({
    address: FACILITATOR, abi: FAC_ABI, functionName: "settleX402PaymentDirect",
    args: [anni.address, bob, PNTS, amount, maxFee, validBefore, nonce, signature],
  });
  const r = await pub.waitForTransactionReceipt({ hash: tx });
  ev.settle = tx;
  if (r.status !== "success") throw new Error(`settle reverted: ${tx}`);

  const payerAfter = await pub.readContract({ address: PNTS, abi: ERC20, functionName: "balanceOf", args: [anni.address] });
  const recipAfter = await pub.readContract({ address: PNTS, abi: ERC20, functionName: "balanceOf", args: [bob] });
  const paid = payerBefore - payerAfter;
  const received = recipAfter - recipBefore;
  console.log(`[3] settleX402PaymentDirect tx ${tx} status=${r.status}`);
  console.log(`    payer Δ -${formatUnits(paid, 18)} pnts · recipient Δ +${formatUnits(received, 18)} pnts`);
  if (received !== amount) throw new Error(`recipient delta ${received} != amount ${amount} (feeBPS=${feeBPS})`);

  console.log(`\n🎉 x402 direct-settle PROVEN on Sepolia`);
  console.log(`   ${ev.approve ? `approve:  https://sepolia.etherscan.io/tx/${ev.approve}\n   ` : ""}settle:   https://sepolia.etherscan.io/tx/${ev.settle}`);
}

main().catch((e) => { console.error("❌ x402 E2E FAILED:", e); process.exit(1); });
