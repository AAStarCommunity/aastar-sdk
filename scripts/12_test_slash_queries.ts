
import { 
    createPublicClient, 
    http, 
    keccak256, 
    toBytes, 
    type Hex
} from 'viem';
import { anvil } from 'viem/chains';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

(BigInt.prototype as any).toJSON = function () { return this.toString(); };

dotenv.config({ path: path.resolve(__dirname, '../.env.v3') });

const loadAbi = (name: string) => {
    const abiPath = path.resolve(__dirname, `../abis/${name}.abi.json`);
    if (!fs.existsSync(abiPath)) throw new Error(`ABI not found: ${abiPath}`);
    return JSON.parse(fs.readFileSync(abiPath, 'utf-8'));
};

const GTokenStakingABI = loadAbi('GTokenStaking');
const SuperPaymasterABI = loadAbi('SuperPaymasterV3');

const ROLE_ENDUSER = keccak256(toBytes('ENDUSER'));
const ANVIL_RPC = 'http://127.0.0.1:8545';

async function main() {
    console.log('\n🔍 Starting Phase 5: Slash & Stake Queries Test 🔍\n');

    const publicClient = createPublicClient({ chain: anvil, transport: http(ANVIL_RPC) });
    const STAKING_ADDR = process.env.GTOKEN_STAKING as Hex || '0xe044814c9eD1e6442Af956a817c161192cBaE98F';
    const PAYMASTER_ADDR = process.env.PAYMASTER_ADDRESS as Hex || '0x9C85258d9A00C01d00ded98065ea3840dF06f09c';

    // Test Operator/Wallet (Using Admin addr from deployment)
    const operator = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as Hex;

    console.log(`📊 Testing SuperPaymaster Slash Queries for ${operator}...`);
    
    try {
        const count = await publicClient.readContract({
            address: PAYMASTER_ADDR, abi: SuperPaymasterABI, functionName: 'getSlashCount', args: [operator]
        }) as bigint;
        console.log(`   ✅ getSlashCount: ${count}`);

        const history = await publicClient.readContract({
            address: PAYMASTER_ADDR, abi: SuperPaymasterABI, functionName: 'getSlashHistory', args: [operator]
        }) as any[];
        console.log(`   ✅ getSlashHistory (Count): ${history.length}`);

        if (history.length > 0) {
            const latest = await publicClient.readContract({
                address: PAYMASTER_ADDR, abi: SuperPaymasterABI, functionName: 'getLatestSlash', args: [operator]
            }) as any;
            console.log(`   ✅ getLatestSlash: Level=${latest.level}, Reason=${latest.reason}`);
        }
    } catch (e: any) {
        console.warn(`   ⚠️ SuperPaymaster queries failed: ${e.message.split('\n')[0]}`);
    }

    console.log(`\n📊 Testing GTokenStaking Stake Queries for ${operator}...`);
    try {
        const info = await publicClient.readContract({
            address: STAKING_ADDR, abi: GTokenStakingABI, functionName: 'getStakeInfo', args: [operator, ROLE_ENDUSER]
        }) as any;
        console.log(`   ✅ getStakeInfo: Amount=${info.amount}, Slashed=${info.slashedAmount}`);
    } catch (e: any) {
        console.warn(`   ⚠️ GTokenStaking queries failed: ${e.message.split('\n')[0]}`);
    }

    console.log(`\n🎉 Slash Queries Test Complete.`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
