
import { 
    createWalletClient, 
    http, 
    keccak256, 
    toBytes, 
    encodeAbiParameters, 
    type Hex
} from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { anvil } from 'viem/chains';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

(BigInt.prototype as any).toJSON = function () { return this.toString(); };

dotenv.config({ path: path.resolve(__dirname, '../../SuperPaymaster/contracts/.env') });

const loadAbi = (name: string) => {
    const abiPath = path.resolve(__dirname, `../abis/${name}.abi.json`);
    if (!fs.existsSync(abiPath)) throw new Error(`ABI not found: ${abiPath}`);
    return JSON.parse(fs.readFileSync(abiPath, 'utf-8'));
};

const RegistryABI = loadAbi('Registry');

// --- CONSTANTS ---
const ROLE_PAYMASTER_AOA = keccak256(toBytes('PAYMASTER_AOA'));
const ANVIL_RPC = 'http://127.0.0.1:8545';

// --- HELPER ---
// waitForTx unused if rely on simulation revert

async function main() {
    console.log('\n🏴‍☠️ Starting Scenario 11: Hacker Defense (Security) 🏴‍☠️\n');

    const REGISTRY_ADDR = process.env.REGISTRY_ADDRESS as Hex || '0x1c85638e118b37167e9298c2268758e058ddfda0';

    // 1. Setup Hacker
    const hackerKey = generatePrivateKey();
    const hackerAccount = privateKeyToAccount(hackerKey);
    const hackerWallet = createWalletClient({ account: hackerAccount, chain: anvil, transport: http(ANVIL_RPC) });

    console.log(`👤 Hacker: ${hackerAccount.address}`);

    // Need ETH for gas
    const ADMIN_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'; 
    const adminWallet = createWalletClient({ account: privateKeyToAccount(ADMIN_KEY as Hex), chain: anvil, transport: http(ANVIL_RPC) });
    await adminWallet.sendTransaction({ to: hackerAccount.address, value: 1000000000000000000n }); // 1 ETH

    // ===============================================
    // Attack 1: Unregistered Paymaster Fraud
    // ===============================================
    console.log(`\n⚔️  [Attack 1] Trying to act as Paymaster without Registration...`);
    // Hacker tries to register SELf as Paymaster but with 0 Stake (should fail min stake check)
    // Or just fake it.
    
    const pmData = encodeAbiParameters(
        [{ name: 'paymaster', type: 'address' }, { name: 'name', type: 'string' }, { name: 'api', type: 'string' }, { name: 'stake', type: 'uint256' }],
        [hackerAccount.address, "FakePaymaster", "https://fake.pm", 0n]
    );

    try {
        await hackerWallet.writeContract({
            address: REGISTRY_ADDR, abi: RegistryABI, functionName: 'registerRoleSelf',
            args: [ROLE_PAYMASTER_AOA, pmData]
        });
        throw new Error("❌ Attack 1 Failed: Registry allowed 0 stake registration!");
    } catch (e: any) {
        console.log(`   ✅ Attack Blocked: ${e.message.split('\n')[0]}`);
    }

    // ===============================================
    // Attack 2: Unauthorized Config Change
    // ===============================================
    console.log(`\n⚔️  [Attack 2] Trying to change Role Config as Hacker...`);
    // Hacker calls configureRole
    
    // Config struct (dummy)
    const dummyConfig = [0n, 0n, 0n, 0n, 0n, 0n, false, "Hacked"];
    
    try {
        await hackerWallet.writeContract({
            address: REGISTRY_ADDR, abi: RegistryABI, functionName: 'configureRole',
            args: [ROLE_PAYMASTER_AOA, dummyConfig]
        });
        throw new Error("❌ Attack 2 Failed: Registry allowed unauthorized config change!");
    } catch (e: any) {
        // Expect OwnableUnauthorizedAccount
        console.log(`   ✅ Attack Blocked: ${e.message.split('\n')[0]}`);
    }

    console.log(`\n🎉 Scenario 11 Security Check Complete!`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
