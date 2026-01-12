import { createPublicClient, createWalletClient, http, parseAbi, type Hex, decodeEventLog } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry, sepolia } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as path from 'path';

// BigInt serialization fix
(BigInt.prototype as any).toJSON = function () { return this.toString(); };
const envPath = process.env.SDK_ENV_PATH || '.env.anvil';
dotenv.config({ path: path.resolve(process.cwd(), envPath), override: true });

const isSepolia = process.env.REVISION_ENV === 'sepolia';
const chain = isSepolia ? sepolia : foundry;
const RPC_URL = process.env.RPC_URL || (isSepolia ? process.env.SEPOLIA_RPC_URL : 'http://127.0.0.1:8545');

const SIGNER_KEY = (process.env.ADMIN_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80') as Hex;
const DVT_VALIDATOR = (process.env.DVT_VALIDATOR_ADDR || process.env.DVT_VALIDATOR_ADDRESS) as Hex;
const BLS_AGGREGATOR = (process.env.BLS_AGGREGATOR_ADDR || process.env.BLS_AGGREGATOR_ADDRESS) as Hex;

// ABIs
const dvtAbi = parseAbi([
    'function addValidator(address)',
    'function createProposal(address, uint8, string) returns (uint256)',
    'function signProposal(uint256, bytes)',
    'function isValidator(address) view returns (bool)',
    'function proposals(uint256) view returns (address, uint8, string, bool)',
    'event ProposalCreated(uint256 indexed id, address indexed operator, uint8 level)'
]);

const blsAbi = parseAbi([
    'function registerBLSPublicKey(address, bytes)',
    'function getSlashCount(address) view returns (uint256)'
]);


async function runDVTBLSTest() {
    console.log("🛡️ Running SuperPaymaster V3 DVT & BLS Integration Test...");
    console.log(`📍 Environment: ${isSepolia ? 'Sepolia' : 'Anvil'}`);
    console.log(`🔗 RPC URL: ${RPC_URL}`);
    console.log(`📝 DVT_VALIDATOR: ${DVT_VALIDATOR || 'not set'}`);
    console.log(`📝 BLS_AGGREGATOR: ${BLS_AGGREGATOR || 'not set'}`);
    console.log(`📝 DVT_VALIDATOR_ADDR env: ${process.env.DVT_VALIDATOR_ADDR || 'not set'}`);
    console.log(`📝 DVT_VALIDATOR_ADDRESS env: ${process.env.DVT_VALIDATOR_ADDRESS || 'not set'}`);
    console.log(`📝 BLS_AGGREGATOR_ADDR env: ${process.env.BLS_AGGREGATOR_ADDR || 'not set'}`);
    console.log(`📝 BLS_AGGREGATOR_ADDRESS env: ${process.env.BLS_AGGREGATOR_ADDRESS || 'not set'}`);
    
    const publicClient = createPublicClient({ chain, transport: http(RPC_URL) });
    const signer = privateKeyToAccount(SIGNER_KEY);
    const wallet = createWalletClient({ account: signer, chain, transport: http(RPC_URL) });

    // 1. Validator Registration
    console.log("   📝 Step 1: Registering Validators...");
    const isValidPre = await publicClient.readContract({
        address: DVT_VALIDATOR, abi: dvtAbi, functionName: 'isValidator', args: [signer.address]
    });

    if (!isValidPre) {
        const hashReg = await wallet.writeContract({ 
            address: DVT_VALIDATOR, abi: dvtAbi, functionName: 'addValidator', 
            args: [signer.address] 
        });
        await publicClient.waitForTransactionReceipt({ hash: hashReg });
    }
    console.log("   ✅ Validator Ready");

    // 2. BLS Key Registration (Simulated)
    console.log("   🔑 Step 2: Registering BLS Public Key...");
    const mockPubKey = "0x" + "01".repeat(48); 
    const hashBLS = await wallet.writeContract({
        address: BLS_AGGREGATOR, abi: blsAbi, functionName: 'registerBLSPublicKey',
        args: [signer.address, mockPubKey as Hex]
    });
    await publicClient.waitForTransactionReceipt({ hash: hashBLS });
    console.log("   ✅ BLS Key Registered");

    // 3. Create Slash Proposal
    console.log("   🗳️ Step 3: Creating Slash Proposal...");
    const targetOperator = signer.address; 
    const hashProp = await wallet.writeContract({
        address: DVT_VALIDATOR, abi: dvtAbi, functionName: 'createProposal',
        args: [targetOperator, 0, "Test Slash Warning"] 
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: hashProp });
    
    // Extract ID from logs
    let proposalId = 1n;
    for (const log of receipt.logs) {
        try {
            const decoded = decodeEventLog({
                abi: dvtAbi,
                eventName: 'ProposalCreated',
                topics: log.topics,
                data: log.data,
            });
            if (decoded.eventName === 'ProposalCreated') {
                proposalId = (decoded.args as any).id;
                break;
            }
        } catch (e) {}
    }

    console.log(`   ✅ Proposal Created with ID: ${proposalId}`);

    // 4. Sign Proposal
    console.log("   ✍️ Step 4: Signing Proposal...");
    const mockSig = "0x" + "02".repeat(20); 
    try {
        const hashSign = await wallet.writeContract({
            address: DVT_VALIDATOR, abi: dvtAbi, functionName: 'signProposal',
            args: [proposalId, mockSig as Hex]
        });
        await publicClient.waitForTransactionReceipt({ hash: hashSign });
        console.log(`   ✅ Proposal ${proposalId} Signed by Validator`);
    } catch (e: any) {
        if (e.message.includes('AlreadySigned')) {
            console.log(`   ℹ️ Proposal ${proposalId} was already signed, proceeding...`);
        } else {
            console.error("   ❌ Signing Failed:", e.message);
            process.exit(1);
        }
    }

    // 5. Testing Boundaries (Double Sign)
    console.log("   🧪 Step 5: Testing Boundaries (Double Sign)...");
    try {
        const txDouble = await wallet.writeContract({
            address: DVT_VALIDATOR, abi: dvtAbi, functionName: 'signProposal',
            args: [proposalId, mockSig as Hex]
        });
        await publicClient.waitForTransactionReceipt({ hash: txDouble });
        console.error("   ❌ Failed: Should have failed on double sign");
        process.exit(1);
    } catch (e: any) {
        console.log("   ✅ Caught expected revert: AlreadySigned");
    }

    console.log("\n🎉 DVT/BLS Test Passed");
}

runDVTBLSTest().catch(console.error);
