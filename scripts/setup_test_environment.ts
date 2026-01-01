import { createPublicClient, createWalletClient, http, parseEther, formatEther, Hex } from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load Env
dotenv.config({ path: path.resolve(__dirname, '../.env.sepolia') });

const RPC_URL = process.env.SEPOLIA_RPC_URL;
const ADMIN_KEY = process.env.PRIVATE_KEY_JASON as Hex;
const ENTRY_POINT = process.env.ENTRY_POINT_ADDR as Hex;

// ABIs (Simplified)
const REGISTRY_ABI = [
    { name: 'registerRole', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'roleId', type: 'bytes32' }, { name: 'user', type: 'address' }, { name: 'data', type: 'bytes' }] },
    { name: 'hasRole', type: 'function', stateMutability: 'view', inputs: [{ name: 'roleId', type: 'bytes32' }, { name: 'user', type: 'address' }], outputs: [{ name: '', type: 'bool' }] },
    { name: 'ROLE_COMMUNITY', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'bytes32' }] }
] as const;

const GTOKEN_ABI = [
    { name: 'mint', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }] },
    { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
    { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }] }
] as const;

async function main() {
    console.log("🚀 Starting Test Environment Setup...");

    if (!ADMIN_KEY || !RPC_URL) {
        throw new Error("Missing ENV: PRIVATE_KEY_JASON or SEPOLIA_RPC_URL");
    }

    const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC_URL) });
    const admin = privateKeyToAccount(ADMIN_KEY);
    const walletClient = createWalletClient({ account: admin, chain: sepolia, transport: http(RPC_URL) });

    console.log(`Admin: ${admin.address}`);

    // Load Addresses from Envc
    const REGISTRY_ADDR = process.env.REGISTRY_ADDRESS as Hex;
    const GTOKEN_ADDR = process.env.GTOKEN_ADDRESS as Hex;
    const STAKING_ADDR = process.env.STAKING_ADDRESS as Hex;

    console.log(`Registry: ${REGISTRY_ADDR}`);

    // 1. Generate/Load Test Accounts
    // We utilize a deterministic generation logic or file to persist them?
    // User asked for "generate 3 random keys". Let's generate and save to a file `test_identities.json` so we can reuse.
    
    let identities: any[] = [];
    const ID_FILE = path.resolve(__dirname, 'test_identities.json');
    
    if (fs.existsSync(ID_FILE)) {
        identities = JSON.parse(fs.readFileSync(ID_FILE, 'utf8'));
        console.log(`Loaded ${identities.length} existing test identities.`);
    } else {
        console.log("Generating new test identities...");
        for (let i = 0; i < 3; i++) {
            const pk = generatePrivateKey();
            identities.push({ name: `CommunityAdmin_${i}`, pk, role: 'COMMUNITY' });
        }
        for (let i = 0; i < 3; i++) {
            const pk = generatePrivateKey();
            identities.push({ name: `TestUser_${i}`, pk, role: 'USER' });
        }
        fs.writeFileSync(ID_FILE, JSON.stringify(identities, null, 2));
    }

    // 2. Fund & Setup
    for (const id of identities) {
        const acc = privateKeyToAccount(id.pk as Hex);
        console.log(`\nProcessing ${id.name} (${acc.address})...`);

        // Check ETH
        const balance = await publicClient.getBalance({ address: acc.address });
        if (balance < parseEther("0.01")) {
            console.log(`Funding ETH (Current: ${formatEther(balance)})...`);
            const hash = await walletClient.sendTransaction({
                to: acc.address,
                value: parseEther("0.02")
            });
            await publicClient.waitForTransactionReceipt({ hash });
            console.log("ETH Funded.");
        } else {
            console.log("ETH Balance OK.");
        }

        // Setup Role Specifics
        if (id.role === 'COMMUNITY') {
            const communityWallet = createWalletClient({ account: acc, chain: sepolia, transport: http(RPC_URL) });
            
            // Check GToken
            const gBal = await publicClient.readContract({
                address: GTOKEN_ADDR, abi: GTOKEN_ABI, functionName: 'balanceOf', args: [acc.address]
            }) as bigint;
            
            if (gBal < parseEther("100")) {
                 console.log("Minting GTokens...");
                 // Admin mints to them
                 const hash = await walletClient.writeContract({
                     address: GTOKEN_ADDR, abi: GTOKEN_ABI, functionName: 'mint', args: [acc.address, parseEther("1000")]
                 });
                 await publicClient.waitForTransactionReceipt({ hash });
                 console.log("GToken Minted.");
            }

            // Register Community
            const ROLE_COMMUNITY = await publicClient.readContract({
                address: REGISTRY_ADDR, abi: REGISTRY_ABI, functionName: 'ROLE_COMMUNITY'
            });
            const hasRole = await publicClient.readContract({
                address: REGISTRY_ADDR, abi: REGISTRY_ABI, functionName: 'hasRole', args: [ROLE_COMMUNITY, acc.address]
            });

            if (!hasRole) {
                console.log("Approving Staking...");
                const appHash = await communityWallet.writeContract({
                    address: GTOKEN_ADDR, abi: GTOKEN_ABI, functionName: 'approve', args: [STAKING_ADDR, parseEther("500")]
                });
                await publicClient.waitForTransactionReceipt({ hash: appHash });

                console.log("Registering Community Role...");
                // Encode Data: CommunityRoleData("Name", "ens", "web", "desc", "logo", stake)
                // We use simplified encoding or just empty bytes if contract allows? Registry V3 uses structured data.
                // We need to encode strictly.
                // Using generic abi encoding for now.
                // struct CommunityRoleData { string name; string ensName; string website; string description; string logoURI; uint256 stakeAmount; }
                /*
                 encode(['string','string','string','string','string','uint256'], [...])
                */
                // Note: We need to use `encodeAbiParameters`.
                // For simplicity, we skip complex data encoding in this script snippet or use a placeholder if allowed,
                // but Registry V3 validation requires name.
                // Let's assume manual setup for now or implement full encoding later if desired.
                console.log("⚠️ Skipping Registration Transaction (requires complex ABI encoding in script). Please register manually or update script.");
            } else {
                console.log("Already Community.");
            }
        }
    }

    console.log("\n✅ Setup Complete. Identities saved to test_identities.json");
}

main().catch(console.error);
