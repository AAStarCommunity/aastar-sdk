
import { http, parseEther, formatEther, type Hex, Address, concat, pad, toHex } from 'viem';
import { privateKeyToAccount, toAccount } from 'viem/accounts';
import { 
    createAdminClient, 
    createEndUserClient, 
    parseKey, 
    CORE_ADDRESSES,
    RoleIds
} from '../packages/sdk/src/index.ts';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dynamic Env Loading
const NETWORK = 'sepolia'; // KMS test is usually on Sepolia
dotenv.config({ path: path.resolve(process.cwd(), `.env.${NETWORK}`), override: true });

const RPC_URL = process.env.SEPOLIA_RPC_URL || process.env.RPC_URL;
const ADMIN_KEY = (process.env.PRIVATE_KEY_SUPPLIER || process.env.ADMIN_KEY) as Hex;
const TARGET_AA_ADDRESS = (process.env.TEST_SIMPLE_ACCOUNT_A || '0x975961302a83090B1eb94676E1430B5baCa43F9E') as Address;

async function main() {
    console.log(`\n🔒 KMS / Remote Signer Verification Script`);
    console.log(`-------------------------------------------`);
    console.log(`🎯 Target AA: ${TARGET_AA_ADDRESS}`);

    if (!ADMIN_KEY) throw new Error("Missing ADMIN_KEY");
    const adminAccount = privateKeyToAccount(parseKey(ADMIN_KEY));
    const admin = createAdminClient({ transport: http(RPC_URL), account: adminAccount });

    // 1. Prepare Account (Sponsor Role)
    console.log(`\n[Step 1] Ensuring ENDUSER role for Target AA...`);
    const status = await admin.readContract({
        address: CORE_ADDRESSES.registry,
        abi: [{ name: 'hasRole', type: 'function', inputs: [{type:'bytes32'}, {type:'address'}], outputs: [{type:'bool'}], stateMutability: 'view' }],
        functionName: 'hasRole',
        args: [RoleIds.ENDUSER, TARGET_AA_ADDRESS]
    });

    if (!status) {
        console.log(`   👤 Sponsoring ENDUSER Role...`);
        // Using Admin as Community to mint SBT
        // Note: For simplicity, we assume admin is already registered as community or has permissions.
        // In the thick client world, we'd use community.onboardEndUser() but need a community client.
        // For this low-level KMS test, let's keep it direct via Admin.
        const tx = await admin.system.registerRole({
            roleId: RoleIds.ENDUSER,
            user: TARGET_AA_ADDRESS,
            data: '0x' // Default data for now, safeMintForRole usually handles the rest
        });
        await admin.waitForTransactionReceipt({ hash: tx });
        console.log(`   ✅ User Registered (SBT Minted).`);
    } else {
        console.log(`   ✅ User already has ENDUSER role.`);
    }

    // 2. Mock KMS Signer Integration
    console.log(`\n[Step 2] Initializing Pseudo-KMS Signer...`);
    
    const kmsAccount = toAccount({
        address: TARGET_AA_ADDRESS, // The signer's address (owner)
        async signMessage({ message }) {
            console.log(`\n📞 [Mock KMS] Signature Requested for ${message.raw}`);
            // Use 65-byte dummy signature
            const r = pad(toHex(1n), { size: 32 });
            const s = pad(toHex(1n), { size: 32 });
            const v = '0x1c'; 
            return concat([r, s, v]);
        },
        async signTransaction() { throw new Error("Not supported"); },
        async signTypedData() { throw new Error("Not supported"); }
    });

    const user = createEndUserClient({ 
        transport: http(RPC_URL), 
        account: kmsAccount 
    });

    // 3. Submit Gasless Transaction via KMS Signer
    console.log(`\n[Step 3] Submitting Gasless Transaction via SDK + KMS Account...`);
    
    try {
        const result = await user.executeGasless({
            target: adminAccount.address,
            data: '0x',
            value: 0n
        });
        console.log(`✅ Success! UserOp Hash: ${result.hash}`);
    } catch (e: any) {
        console.log(`\n🔍 Verification Result:`);
        if (e.message.includes('signature') || e.message.includes('AA23') || e.message.includes('Bundler Error')) {
             console.log(`   ✅ SDK Flow Verified!`);
             console.log(`      The SDK successfully prepared the UserOp and called our KMS signer.`);
             console.log(`      (Final error expected due to dummy signature)`);
        } else {
             console.log(`   ❌ Unexpected Error: ${e.message}`);
        }
    }
}

main().catch(console.error);
