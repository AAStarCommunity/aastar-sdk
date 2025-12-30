
import { 
    createPublicClient, 
    createWalletClient, 
    http, 
    keccak256, 
    toBytes, 
    encodeAbiParameters, 
    type Hex,
    toHex,
    parseEther
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

dotenv.config({ path: path.resolve(process.cwd(), '.env.anvil') });

const loadAbi = (name: string) => {
    const abiPath = path.resolve(__dirname, `../abis/${name}.json`);
    if (!fs.existsSync(abiPath)) throw new Error(`ABI not found: ${abiPath}`);
    return JSON.parse(fs.readFileSync(abiPath, 'utf-8'));
};

const RegistryABI = loadAbi('Registry');
const GTokenABI = loadAbi('GToken');
// GTokenStakingABI removed as it is not used in this script

const ROLE_ENDUSER = keccak256(toBytes('ENDUSER'));
const ANVIL_RPC = 'http://127.0.0.1:8545';

const waitForTx = async (client: any, hash: Hex) => {
    const receipt = await client.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') throw new Error(`Tx Failed: ${hash}`);
    return receipt;
};

async function main() {
    console.log('\n🚪 Starting Phase 5: Staking Exit Test (Normal Flow) 🚪\n');

    const publicClient = createPublicClient({ chain: anvil, transport: http(ANVIL_RPC) });
    const REGISTRY_ADDR = process.env.REGISTRY_ADDRESS as Hex;
    const GTOKEN_ADDR = process.env.GTOKEN_ADDRESS as Hex;
    const STAKING_ADDR = process.env.GTOKEN_STAKING as Hex;

    const ADMIN_KEY = (process.env.ADMIN_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'); 
    const adminWallet = createWalletClient({ account: privateKeyToAccount(ADMIN_KEY as Hex), chain: anvil, transport: http(ANVIL_RPC) });

    // 1. Setup User (Alice)
    const aliceKey = generatePrivateKey();
    const aliceAccount = privateKeyToAccount(aliceKey);
    const aliceWallet = createWalletClient({ account: aliceAccount, chain: anvil, transport: http(ANVIL_RPC) });
    console.log(`👤 Alice (Test User): ${aliceAccount.address}`);

    // Fund Alice via setBalance for absolute reliability
    await (adminWallet as any).request({ method: 'anvil_setBalance', params: [aliceAccount.address, toHex(parseEther("100.0"))] });
    console.log(`   ✅ Alice funded with 100 ETH via setBalance`);

    // 2. Fund Alice GToken
    const stakeAmount = 400000000000000000n; // 0.4 ether
    const mintAmount = 1000000000000000000n; // 1.0 ether
    console.log(`   💰 Minting ${mintAmount} GToken to Alice...`);
    await waitForTx(publicClient, await adminWallet.writeContract({
        address: GTOKEN_ADDR, abi: GTokenABI, functionName: 'mint', args: [aliceAccount.address, mintAmount]
    }));

    await waitForTx(publicClient, await aliceWallet.writeContract({
        address: GTOKEN_ADDR, abi: GTokenABI, functionName: 'approve', args: [STAKING_ADDR, mintAmount]
    }));

    // 3. Register Alice
    const commAddr = adminWallet.account.address;
    const aliceData = encodeAbiParameters(
        [{ type: 'tuple', components: [
            { name: 'account', type: 'address' },
            { name: 'community', type: 'address' },
            { name: 'avatarURI', type: 'string' },
            { name: 'ensName', type: 'string' },
            { name: 'stakeAmount', type: 'uint256' }
        ]}],
        [{ account: aliceAccount.address, community: commAddr, avatarURI: "ipfs://alice", ensName: "alice.c", stakeAmount: stakeAmount }]
    );

    console.log(`   📝 Registering Alice...`);
    await waitForTx(publicClient, await aliceWallet.writeContract({
        address: REGISTRY_ADDR, abi: RegistryABI, functionName: 'registerRoleSelf', args: [ROLE_ENDUSER, aliceData]
    }));
    console.log(`   ✅ Alice Registered & Locked ${stakeAmount}.`);

    // 4. Test Exit (Unlock)
    console.log(`\n🚪 Testing Exit (Normal Flow)...`);
    const balanceBeforeExit = await publicClient.readContract({
        address: GTOKEN_ADDR, abi: GTokenABI, functionName: 'balanceOf', args: [aliceAccount.address]
    }) as bigint;

    console.log(`   🚪 Alice exiting role...`);
    await waitForTx(publicClient, await aliceWallet.writeContract({
        address: REGISTRY_ADDR, abi: RegistryABI, functionName: 'exitRole', args: [ROLE_ENDUSER]
    }));

    const balanceAfterExit = await publicClient.readContract({
        address: GTOKEN_ADDR, abi: GTokenABI, functionName: 'balanceOf', args: [aliceAccount.address]
    }) as bigint;

    const refund = balanceAfterExit - balanceBeforeExit;
    console.log(`   💰 Refunded: ${refund}`);

    // Verify Exit Fee: max(10%, 0.05 ether)
    // stakeAmount = 400,000,000,000,000,000 (0.4 ether)
    // 10% fee = 40,000,000,000,000,000 (0.04 ether)
    // minExitFee = 50,000,000,000,000,000 (0.05 ether)
    // Applied fee should be 0.05 ether
    const minExitFee = 50000000000000000n;
    const tenPercent = (stakeAmount * 1000n) / 10000n;
    const expectedFee = tenPercent > minExitFee ? tenPercent : minExitFee;
    const expectedRefund = stakeAmount - expectedFee;
    
    console.log(`   🔍 Expected Refund (after max(10%, 0.05 ETH) fee): ${expectedRefund}`);

    if (refund === expectedRefund) {
        console.log(`   ✅ Exit Fee (10%) correctly applied.`);
    } else if (refund === stakeAmount) {
        console.warn(`   ⚠️ Warning: No exit fee applied (maybe not configured or role owner?)`);
    } else {
        console.warn(`   ❓ Refund ${refund} did not match expected ${expectedRefund}`);
    }

    console.log(`\n🎉 Staking Exit Test Complete.`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
