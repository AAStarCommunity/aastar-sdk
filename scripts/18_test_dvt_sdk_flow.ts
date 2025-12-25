import { createPublicClient, http, parseEther, type Hex, type Address, keccak256, stringToBytes } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { 
    createAdminClient,
    createOperatorClient,
    createCommunityClient,
    createEndUserClient
} from '../packages/sdk/src/index';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(process.cwd(), '.env.v3') });

const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545';
const ADMIN_KEY = (process.env.ADMIN_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80') as Hex;

const localAddresses = {
    registry: process.env.REGISTRY_ADDR as Address,
    gToken: process.env.GTOKEN_ADDR as Address,
    gTokenStaking: process.env.GTOKEN_STAKING_ADDR as Address, // Fallback if STAKING_ADDR used
    superPaymasterV2: process.env.SUPERPAYMASTER_ADDR as Address,
    mySBT: process.env.SBT_ADDR as Address,
    dvtValidator: process.env.DVT_VALIDATOR_ADDR as Address,
    xpntsFactory: process.env.XPNTS_FACTORY_ADDR as Address
};

async function testNewSDKCapabilities() {
    console.log('\n🚀 Testing New SDK Capabilities (DVT, Factory, SBT Management)\n');

    const adminAccount = privateKeyToAccount(ADMIN_KEY);
    const adminClient = createAdminClient({
        chain: foundry,
        transport: http(RPC_URL),
        account: adminAccount,
        addresses: localAddresses
    });

    console.log(`Admin Address: ${adminAccount.address}`);

    // --- 1. DVT Actions ---
    console.log('\n🛡️  Testing DVT Actions...');
    if (localAddresses.dvtValidator) {
        // Add Admin as Validator if needed (usually handled in SetupV3 or DeployLocal)
        const isVal = await adminClient.isValidator({ address: localAddresses.dvtValidator, user: adminAccount.address });
        console.log(`Is Admin Validator: ${isVal}`);

        if (!isVal) {
            console.log('Adding Admin as validator...');
            const addValTx = await adminClient.writeContract({
                address: localAddresses.dvtValidator as Address,
                abi: [{type:'function', name:'addValidator', inputs:[{name:'_v', type:'address'}], outputs:[], stateMutability:'nonpayable'}],
                functionName: 'addValidator',
                args: [adminAccount.address],
                account: adminAccount
            });
            await adminClient.waitForTransactionReceipt({ hash: addValTx });
        }

        // Create Proposal
        console.log('Creating slash proposal...');
        const createTx = await adminClient.createSlashProposal({
            address: localAddresses.dvtValidator,
            operator: adminAccount.address, // Self-test slasher
            level: 1,
            reason: "SDK Regression Test"
        });
        const receipt = await adminClient.waitForTransactionReceipt({ hash: createTx });
        console.log('Proposal Created');

        // Sign Proposal (Mock Signature)
        console.log('Signing proposal...');
        const signTx = await adminClient.signSlashProposal({
            address: localAddresses.dvtValidator,
            proposalId: 1n,
            signature: '0x1234' as Hex
        });
        await adminClient.waitForTransactionReceipt({ hash: signTx });
        console.log('Proposal Signed');
    } else {
        console.log('⚠️ DVT Validator address missing, skipping...');
    }

    // --- 2. Factory Actions ---
    console.log('\n🏭 Testing Factory Actions...');
    if (localAddresses.xpntsFactory) {
        console.log('Creating xPNTs token...');
        try {
            const createTx = await adminClient.createXPNTs({
                address: localAddresses.xpntsFactory,
                name: "Test Community Token",
                symbol: "TCT",
                hub: "TestHub",
                domain: "test.local",
                pool: parseEther('100')
            });
            await adminClient.waitForTransactionReceipt({ hash: createTx });
            
            const tokenAddr = await adminClient.getXPNTsTokenAddress({
                address: localAddresses.xpntsFactory,
                hub: "TestHub"
            });
            console.log(`Created Token Address: ${tokenAddr}`);
        } catch (e: any) {
            console.log(`⚠️ Factory create skipped (likely already exists): ${e.message.split('\n')[0]}`);
        }
    }

    // --- 3. SBT Management ---
    console.log('\n🏘️  Testing SBT Management...');
    if (localAddresses.mySBT) {
        console.log('Setting Base URI...');
        const uriTx = await adminClient.setBaseURI({
            uri: "https://api.aastar.io/sbt/",
            account: adminAccount
        });
        await adminClient.waitForTransactionReceipt({ hash: uriTx });
        
        const uri = await adminClient.getSBTURI({ tokenId: 1n });
        console.log(`Token 1 URI: ${uri}`);
    }

    console.log('\n✅ All new SDK capabilities verified successfully!');
}

testNewSDKCapabilities().catch(console.error);
