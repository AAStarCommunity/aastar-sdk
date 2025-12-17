import { createPublicClient, createWalletClient, http, parseAbi, parseEther, formatEther, getContract, Hex, Address, encodeAbiParameters, keccak256, toBytes } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../env/.env.v3') });
const RPC_URL = process.env.SEPOLIA_RPC_URL;
if (!RPC_URL) throw new Error("Missing SEPOLIA_RPC_URL");

const CHAIN = sepolia;
const SUPPLIER_KEY = process.env.PRIVATE_KEY_SUPPLIER as Hex;
const ANNI_KEY = process.env.PRIVATE_KEY_ANNI as Hex;

const ADDR = {
    REGISTRY: process.env.REGISTRY_ADDRESS as Address,
    ANNI: "0xEcAACb915f7D92e9916f449F7ad42BD0408733c9" as Address,
};

const ROLE_ENDUSER = keccak256(toBytes("ENDUSER"));

const ABI = {
    REGISTRY: parseAbi([
        'function safeMintForRole(bytes32 roleId, address user, bytes calldata data) external returns (uint256)',
        'function hasRole(bytes32 roleId, address user) view returns (bool)',
    ]),
};

const publicClient = createPublicClient({ chain: CHAIN, transport: http(RPC_URL) });
const supplier = createWalletClient({ account: privateKeyToAccount(SUPPLIER_KEY), chain: CHAIN, transport: http(RPC_URL) }); // Only for ETH funding
const anni = createWalletClient({ account: privateKeyToAccount(ANNI_KEY), chain: CHAIN, transport: http(RPC_URL) });

const targets = [
    { name: "Baseline (A)", addr: process.env.TEST_SIMPLE_ACCOUNT_A as Address },
    { name: "Standard (B)", addr: process.env.TEST_SIMPLE_ACCOUNT_B as Address },
    { name: "SuperPaymaster (C)", addr: process.env.TEST_SIMPLE_ACCOUNT_C as Address },
];

async function main() {
    console.log("🚀 [01.2] Registering Roles (Minting SBT)...\n");

    const registry = getContract({ address: ADDR.REGISTRY, abi: ABI.REGISTRY, client: publicClient });

    for (const t of targets) {
        if (!t.addr) continue;
        console.log(`👤 Checking ${t.name}: ${t.addr}`);

        // 1. Fund ETH first (needed for future txs, though Anni pays for Mint)
        const ethBal = await publicClient.getBalance({ address: t.addr });
        if (ethBal < parseEther("0.02")) {
            console.log(`   Funding ETH...`);
            const hash = await supplier.sendTransaction({ to: t.addr, value: parseEther("0.05") });
            await publicClient.waitForTransactionReceipt({ hash });
            console.log("   ✅ ETH Funded");
        }

        // 2. Check Role
        const hasRole = await registry.read.hasRole([ROLE_ENDUSER, t.addr]);
        if (hasRole) {
            console.log("   ✅ Already Registered (SBT owned)");
            continue;
        }

        console.log("   📝 Registering Role...");
        try {
             // Struct: { account, community, avatar, ens, stake }
             // Note: Stake is minimal required (e.g. 0.3 ether in GToken units)
             const roleData = encodeAbiParameters(
                [{ type: 'tuple', components: [
                    { type: 'address' }, { type: 'address' }, { type: 'string' }, { type: 'string' }, { type: 'uint256' }
                ]}],
                [[ t.addr, ADDR.ANNI, "", "", parseEther("0.3") ]]
            );

            const hash = await anni.writeContract({
                address: ADDR.REGISTRY, abi: ABI.REGISTRY, functionName: 'safeMintForRole',
                args: [ROLE_ENDUSER, t.addr, roleData]
            });
            console.log(`   ⏳ Sent: ${hash}`);
            await publicClient.waitForTransactionReceipt({ hash });
            console.log("   ✅ Registered!");
        } catch (e) {
            console.log(`   ❌ Error: ${e}`);
        }
    }
}

main().catch(console.error);
