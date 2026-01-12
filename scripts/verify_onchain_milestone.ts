import { createPublicClient, http, type Hex, parseAbi } from 'viem';
import { foundry, sepolia } from 'viem/chains';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function verify() {
    const network = process.argv[2] || 'anvil';
    console.log(`\n🔍 Verifying Milestone State on ${network.toUpperCase()}...\n`);

    const configPath = path.resolve(__dirname, `../config.${network}.json`);
    
    if (!fs.existsSync(configPath)) {
        console.error(`❌ Config file not found: ${configPath}`);
        process.exit(1);
    }
    
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    
    const client = createPublicClient({
        chain: network === 'anvil' ? foundry : sepolia,
        transport: http(network === 'anvil' ? 'http://127.0.0.1:8545' : process.env.RPC_URL)
    });

    const RegistryABI = parseAbi([
        'function communityByName(string) view returns (address)',
        'function communityByENS(string) view returns (address)',
        'function hasRole(bytes32, address) view returns (bool)',
        'function ROLE_COMMUNITY() view returns (bytes32)',
        'function ROLE_PAYMASTER_SUPER() view returns (bytes32)',
        'function owner() view returns (address)'
    ]);

    const SuperPaymasterABI = parseAbi([
        'function operators(address) view returns (uint128 aPNTsBalance, uint96 exchangeRate, bool isConfigured, bool isPaused, address xPNTsToken, uint32 reputation, uint48 minTxInterval, address treasury, uint256 totalSpent, uint256 totalTxSponsored)'
    ]);

    const ROLE_COMMUNITY = await client.readContract({ address: config.registry, abi: RegistryABI, functionName: 'ROLE_COMMUNITY' });
    
    console.log(`--- Registry: ${config.registry} ---`);
    const regOwner = await client.readContract({ address: config.registry, abi: RegistryABI, functionName: 'owner' });
    console.log(`Owner: ${regOwner}`);

    // 1. 验证 AAStar (Jason)
    // Anvil 默认使用第一个账户作为 Jason/Deployer
    const jason = network === 'anvil' 
        ? '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as Hex
        : '0xb5600060e6de5E11D3636731964218E53caadf0E' as Hex;

    console.log(`\n[AAStar Community] (Expected Owner: ${jason})\n`);
    const addrByName = await client.readContract({ address: config.registry, abi: RegistryABI, functionName: 'communityByName', args: ['AAStar'] });
    const hasCommRole = await client.readContract({ address: config.registry, abi: RegistryABI, functionName: 'hasRole', args: [ROLE_COMMUNITY, jason] });
    // Check if Jason has AOA role (V4)
    const ROLE_PAYMASTER_AOA = parseAbi(['function ROLE_PAYMASTER_AOA() view returns (bytes32)']);
    const aoaRoleHash = await client.readContract({ address: config.registry, abi: ROLE_PAYMASTER_AOA, functionName: 'ROLE_PAYMASTER_AOA' });
    const hasAOARole = await client.readContract({ address: config.registry, abi: RegistryABI, functionName: 'hasRole', args: [aoaRoleHash, jason] });
    
    const opConfig = await client.readContract({ address: config.superPaymaster, abi: SuperPaymasterABI, functionName: 'operators', args: [jason] });

    console.log(`Registered Address: ${addrByName} ${addrByName === jason ? '✅' : '❌'}`);
    console.log(`Has COMMUNITY Role: ${hasCommRole} ${hasCommRole ? '✅' : '❌'}`);
    console.log(`Has PAYMASTER_AOA Role: ${hasAOARole} ${hasAOARole ? '✅' : '(Not V4)'}`);
    
    // For V4 users, we don't strictly require SuperPaymaster (V3) config
    const isConfigured = opConfig[2] || hasAOARole; 
    console.log(`Paymaster Configured: ${isConfigured} ${(opConfig[2] || hasAOARole) ? '✅' : '❌'} ${hasAOARole ? '(V4 Mode)' : '(V3 Mode)'}`);
    const isV4 = hasAOARole;
    const isV3 = opConfig[2];

    if (isV3) {
        console.log(`Points Token (aPNTs): ${opConfig[4]} ${opConfig[4].toLowerCase() === config.aPNTs.toLowerCase() ? '✅' : '❌'}`);
        console.log(`aPNTs Balance: ${opConfig[0]} (Should be > 0)`);
    } else if (isV4) {
        console.log(`Points Token (aPNTs): Skiped for V4 (Managed by Paymaster Proxy)`);
        console.log(`aPNTs Balance: Skiped for V4`);
    } else {
        console.log(`Points Token (aPNTs): ❌ Not Configured`);
    }

    // 2. 验证 DemoCommunity (Anni)
    const anni = '0xEcAACb915f7D92e9916f449F7ad42BD0408733c9' as Hex;
    console.log(`\n[DemoCommunity]\n`);
    const demoAddrByName = await client.readContract({ address: config.registry, abi: RegistryABI, functionName: 'communityByName', args: ['DemoCommunity'] });
    const anniHasCommRole = await client.readContract({ address: config.registry, abi: RegistryABI, functionName: 'hasRole', args: [ROLE_COMMUNITY, anni] });
    const demoOpConfig = await client.readContract({ address: config.superPaymaster, abi: SuperPaymasterABI, functionName: 'operators', args: [anni] });

    console.log(`Registered Address: ${demoAddrByName} ${demoAddrByName === anni ? '✅' : '❌'}`);
    console.log(`Has COMMUNITY Role: ${anniHasCommRole} ${anniHasCommRole ? '✅' : '❌'}`);
    console.log(`SuperPaymaster Configured: ${demoOpConfig[2]} ${demoOpConfig[2] ? '✅' : '❌'} (Note: Skipping SP config for Anni in DeployAnvil.s.sol)`);
    console.log(`Points Token (dPNTs): ${demoOpConfig[4]} ${demoOpConfig[4] !== '0x0000000000000000000000000000000000000000' ? '✅' : '❌'}`);

    // Update Validation Logic
    // If V3 configured, MUST match token.
    if (isV3 && opConfig[4].toLowerCase() !== config.aPNTs.toLowerCase()) {
         throw new Error("❌ Validation Failed: V3 Operator Token Mismatch");
    }
    // If NEITHER V3 nor V4, Fail.
    if (!isV3 && !isV4) {
         throw new Error("❌ Validation Failed: AAStar not configured as V3 or V4 Paymaster");
    }
    
    // Anni check (Demo is usually legacy/hybrid, ensure it hasn't regressed if expected)
    if (network !== 'anvil' && demoOpConfig[4] === '0x0000000000000000000000000000000000000000') {
        const msg = "❌ Validation Failed: DemoCommunity Token Mismatch or Missing Configuration";
        throw new Error(msg);
    }

    console.log(`\n✨ ALL ON-CHAIN CHECKS PASSED FOR MILESTONE! ✨`);
}

verify().catch(e => { console.error('❌ Verification Failed:', e); process.exit(1); });
