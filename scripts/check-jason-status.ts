
import { createPublicClient, createWalletClient, http, parseAbi, keccak256, formatEther, parseEther, toBytes } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load env
dotenv.config({ path: '.env.sepolia' });

const CONFIG_PATH = path.resolve(process.cwd(), 'config.sepolia.json');
const STATE_PATH = path.resolve(process.cwd(), 'scripts/l4-state.json');

// ABIs
const REGISTRY_ABI = parseAbi([
    'function hasRole(bytes32 roleId, address user) view returns (bool)',
    'function roleMetadata(bytes32 roleId, address user) view returns (bytes)',
    'function registerRole(bytes32 roleId, address user, bytes roleData)',
    'function registerRoleSelf(bytes32 roleId, bytes roleData)'
]);

const FACTORY_ABI = parseAbi([
    'function getTokenAddress(address community) view returns (address)',
    'function deployxPNTsToken(string name, string symbol, string communityName, string communityENS, uint256 exchangeRate, address paymasterAOA) returns (address)'
]);

const TOKEN_ABI = parseAbi([
    'function name() view returns (string)',
    'function symbol() view returns (string)'
]);

const ROLE_COMMUNITY = keccak256(toBytes('COMMUNITY'));

async function main() {
    console.log('🔍 Checking Jason Account Status...');

    // 1. Load Config & State
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    const state = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));

    // Jason's Address
    const jasonAddress = state.operators.jason.address;
    const jasonKey = process.env.PRIVATE_KEY_JASON;
    
    if (!jasonAddress || !jasonKey) {
        throw new Error('Jason address or private key not found');
    }

    console.log(`👤 Jason Address: ${jasonAddress}`);

    // Clients
    const client = createPublicClient({ chain: sepolia, transport: http(process.env.RPC_URL) });
    const wallet = createWalletClient({ 
        account: privateKeyToAccount(jasonKey as `0x${string}`), 
        chain: sepolia, 
        transport: http(process.env.RPC_URL) 
    });

    const registryAddr = config.registry;
    const factoryAddr = config.xPNTsFactory;

    // 2. Check Registry Role
    console.log('\n🏛️  Checking Registry Status...');
    const hasRole = await client.readContract({
        address: registryAddr,
        abi: REGISTRY_ABI,
        functionName: 'hasRole',
        args: [ROLE_COMMUNITY, jasonAddress]
    });

    if (hasRole) {
        console.log('✅ Jason IS registered as COMMUNITY.');
        // Try to decode metadata (simple string decode for name if possible, complex decode is hard without full ABI)
        // We'll skip metadata decoding for now unless critical
    } else {
        console.log('❌ Jason is NOT registered as COMMUNITY.');
        console.log('🛠️  Attempting to register Jason as Community...');
        
        try {
             // Encode RoleData: (name, ens, website, desc, logo, stake)
             // string, string, string, string, string, uint256
             // We use 'viem' encodeAbiParameters
             const { encodeAbiParameters, parseAbiParameters } = await import('viem');
             
             const roleData = encodeAbiParameters(
                parseAbiParameters('string, string, string, string, string, uint256'),
                ['Jason Community', '', 'https://jason.com', 'Jason Tech Community', '', 30000000000000000000n] // 30 GTokens
             );

             // Note: This requires Jason to have GTokens and Approve Staking!
             // Assuming Jason has enough GTokens (he usually does in tests)
             // We need to approve Staking first
             const STAKING = config.gTokenStaking;
             const GTOKEN = config.gToken;

             console.log('   Approving Staking...');
             const approveHash = await wallet.writeContract({
                 address: GTOKEN,
                 abi: parseAbi(['function approve(address,uint256) returns (bool)']),
                 functionName: 'approve',
                 args: [STAKING, parseEther('1000')] // Plenty
             });
             await client.waitForTransactionReceipt({ hash: approveHash });
             console.log('   ✅ Approved.');

             console.log('   Registering Community...');
             const txHash = await wallet.writeContract({
                 address: registryAddr,
                 abi: REGISTRY_ABI,
                 functionName: 'registerRoleSelf',
                 args: [ROLE_COMMUNITY, roleData]
             });
             await client.waitForTransactionReceipt({ hash: txHash });
             console.log(`   ✅ Community Registered! Tx: ${txHash}`);
        } catch (e: any) {
            console.error(`   ❌ Registration Failed: ${e.message}`);
            return;
        }
    }

    // 3. Check xPNTs Token
    console.log('\n🪙  Checking xPNTs Token Status...');
    const tokenAddr = await client.readContract({
        address: factoryAddr,
        abi: FACTORY_ABI,
        functionName: 'getTokenAddress',
        args: [jasonAddress]
    });

    if (tokenAddr && tokenAddr !== '0x0000000000000000000000000000000000000000') {
        const [name, symbol] = await Promise.all([
            client.readContract({ address: tokenAddr, abi: TOKEN_ABI, functionName: 'name' }),
            client.readContract({ address: tokenAddr, abi: TOKEN_ABI, functionName: 'symbol' })
        ]);
        console.log(`✅ Jason has Token: ${tokenAddr}`);
        console.log(`   Name: ${name}`);
        console.log(`   Symbol: ${symbol}`);
        
        if (symbol === 'dPNTs' || symbol.includes('cPNTs')) {
            console.log(`   ℹ️  Note: "dPNTs (cPNTs)" confusion likely due to symbol naming.`);
        }
    } else {
        console.log('❌ Jason has NO Token deployed.');
        console.log('🛠️  Deploying Token for Jason...');

        try {
            // function deployxPNTsToken(string name, string symbol, string communityName, string communityENS, uint256 exchangeRate, address paymasterAOA)
            const txHash = await wallet.writeContract({
                address: factoryAddr,
                abi: FACTORY_ABI,
                functionName: 'deployxPNTsToken',
                args: [
                    'Jason Community Token',
                    'cPNTs', // Let's use cPNTs to curb confusion
                    'Jason Community',
                    '',
                    parseEther('1'), // 1:1 Exchange Rate
                    state.operators.jason.paymasterV4 // Link to his AOA Paymaster
                ]
            });
            console.log(`   🚀 Use deploy tx: ${txHash}`);
            const receipt = await client.waitForTransactionReceipt({ hash: txHash });
            console.log(`   ✅ Token Deployed!`);

            // Read the new token address? 
            // We can just rely on user re-running check, or fetch it again.
            // Let's fetch it for verification.
            const newToken = await client.readContract({
                address: factoryAddr,
                abi: FACTORY_ABI,
                functionName: 'getTokenAddress',
                args: [jasonAddress]
            });
            console.log(`   📍 New Token Address: ${newToken}`);
        } catch (e: any) {
            console.error(`   ❌ Deployment Failed: ${e.message}`);
        }
    }

    console.log('\n🏁 Done.');
}

main().catch(console.error);
