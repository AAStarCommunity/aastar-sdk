/**
 * l4-setup-op-mainnet.ts — Simplified L4 Setup for Optimism Mainnet
 * 
 * Purpose: Initialize minimal environment on OP Mainnet for Paper7 evaluation data collection.
 * Compared to l4-setup.ts (~80 tx worst case), this targets ~20-30 tx.
 * 
 * Key differences from l4-setup.ts:
 * - Uses `cast wallet decrypt-keystore` for key resolution (no raw keys in .env)
 * - Only 2 operators (Jason=Deployer V4 + Anni SuperPM) — no Bob
 * - Only 1 AA per operator (2 total, not 4)
 * - Minimal token amounts (save gas)
 * - Skip redundant re-registrations and SBT syncs
 * - Every tx is tracked with gas data for Paper7 evaluation
 * 
 * Usage: pnpm tsx scripts/l4-setup-op-mainnet.ts --network=op-mainnet
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { 
    createPublicClient, 
    createWalletClient, 
    http, 
    parseEther, 
    formatEther, 
    type Address, 
    type Hex,
    parseAbi,
    encodeFunctionData,
    encodeAbiParameters,
    type TransactionReceipt
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { loadNetworkConfig } from '../tests/regression/config';
import { 
    tokenActions, 
    gTokenActions,
    registryActions, 
    xPNTsFactoryActions,
    paymasterFactoryActions,
    accountFactoryActions,
    paymasterActions,
    superPaymasterActions,
    entryPointActions,
    accountActions,
    EntryPointVersion,
} from '../packages/core/src/index.js';
import { CommunityClient, UserClient } from '../packages/enduser/src/index.js';
import { PaymasterOperatorClient } from '../packages/operator/src/PaymasterOperatorClient.js';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const networkArg = process.argv.find(arg => arg.startsWith('--network='))?.split('=')[1] || 'op-mainnet';

// Enforce mainnet-only
if (networkArg !== 'op-mainnet') {
    console.error('❌ This script is designed for --network=op-mainnet only.');
    console.error('   For testnet, use: pnpm tsx scripts/l4-setup.ts --network=sepolia');
    process.exit(1);
}

const STATE_FILE = path.resolve(__dirname, `l4-state.${networkArg}.json`);
const GAS_LOG_FILE = path.resolve(__dirname, `../data/op-mainnet-setup-gas-log.json`);

// ==================== GAS DATA COLLECTION ====================
interface GasEntry {
    step: string;
    txHash: string;
    gasUsed: string;
    effectiveGasPrice: string;
    l1Fee?: string;
    l1GasUsed?: string;
    totalCostWei: string;
    totalCostETH: string;
    timestamp: string;
}

const gasLog: GasEntry[] = [];

async function trackGas(
    publicClient: any, 
    hash: Hex, 
    stepName: string
): Promise<TransactionReceipt> {
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    const gasUsed = receipt.gasUsed;
    const effectiveGasPrice = receipt.effectiveGasPrice || 0n;
    const l1Fee = (receipt as any).l1Fee || 0n;
    const l1GasUsed = (receipt as any).l1GasUsed || 0n;
    const totalCost = gasUsed * effectiveGasPrice + l1Fee;

    const entry: GasEntry = {
        step: stepName,
        txHash: hash,
        gasUsed: gasUsed.toString(),
        effectiveGasPrice: effectiveGasPrice.toString(),
        l1Fee: l1Fee.toString(),
        l1GasUsed: l1GasUsed.toString(),
        totalCostWei: totalCost.toString(),
        totalCostETH: formatEther(totalCost),
        timestamp: new Date().toISOString()
    };
    gasLog.push(entry);
    console.log(`      ⛽ Gas: ${gasUsed.toString()} | L2Price: ${effectiveGasPrice.toString()} wei | L1Fee: ${formatEther(l1Fee)} ETH | Total: ${formatEther(totalCost)} ETH`);
    return receipt;
}

function saveGasLog() {
    fs.mkdirSync(path.dirname(GAS_LOG_FILE), { recursive: true });
    fs.writeFileSync(GAS_LOG_FILE, JSON.stringify(gasLog, null, 2));
    console.log(`\n📊 Gas log saved: ${GAS_LOG_FILE} (${gasLog.length} entries)`);
}

// ==================== KEY RESOLUTION ====================
    // We expect keys to be injected via environment variables (e.g. from .env or shell command)
    // This avoids unsafe handling of keys within the script logic.

async function main() {
    console.log(`\n🔑 Step 0: Resolving Env Keys`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    // Load .env.op-mainnet first to get account names
    const envPath = path.resolve(process.cwd(), `.env.${networkArg}`);
    dotenv.config({ path: envPath, override: true });

    const deployerAccountName = process.env.DEPLOYER_ACCOUNT;
    const anniAccountName = process.env.ANNI_ACCOUNT;

    // Load keys from process.env (populated by user shell or .env)
    let deployerKey = (process.env.PRIVATE_KEY_JASON || '').trim();
    let anniKey = (process.env.PRIVATE_KEY_ANNI || '').trim();

    // Sanitize: Add expected '0x' if missing (cast output might be raw hex)
    if (deployerKey && !deployerKey.startsWith('0x')) {
        deployerKey = `0x${deployerKey}`;
    }
    if (anniKey && !anniKey.startsWith('0x')) {
        anniKey = `0x${anniKey}`;
    }

    if (!deployerKey || !/^0x[0-9a-fA-F]{64}$/.test(deployerKey)) {
        console.error(`❌ PRIVATE_KEY_JASON not set or invalid! Got: "${deployerKey ? deployerKey.slice(0,6) + '...' : 'empty'}"`);
        console.error(`   Please export it before running.`);
        console.error(`   Example: export PRIVATE_KEY_JASON=$(cast wallet decrypt-keystore ${deployerAccountName})`);
        process.exit(1);
    }
    if (!anniKey || !/^0x[0-9a-fA-F]{64}$/.test(anniKey)) {
        console.error(`❌ PRIVATE_KEY_ANNI not set or invalid! Got: "${anniKey ? anniKey.slice(0,6) + '...' : 'empty'}"`);
        console.error(`   Please export it before running.`);
        console.error(`   Example: export PRIVATE_KEY_ANNI=$(cast wallet decrypt-keystore ${anniAccountName})`);
        process.exit(1);
    }

    // Inject keys into process.env so loadNetworkConfig can find them
    process.env.TEST_PRIVATE_KEY = deployerKey;
    process.env.PRIVATE_KEY_SUPPLIER = deployerKey;
    process.env.PRIVATE_KEY = deployerKey;
    process.env.PRIVATE_KEY_JASON = deployerKey;
    process.env.PRIVATE_KEY_ANNI = anniKey;

    // Verify addresses match
    const deployerAcc = privateKeyToAccount(deployerKey as Hex);
    const anniAcc = privateKeyToAccount(anniKey as Hex);
    const expectedDeployer = process.env.DEPLOYER_ADDRESS as Address;
    const expectedAnni = process.env.ANNI_ADDRESS as Address;

    if (expectedDeployer && deployerAcc.address.toLowerCase() !== expectedDeployer.toLowerCase()) {
        console.error(`❌ Deployer address mismatch!`);
        console.error(`   Expected: ${expectedDeployer}`);
        console.error(`   Got:      ${deployerAcc.address}`);
        process.exit(1);
    }
    if (expectedAnni && anniAcc.address.toLowerCase() !== expectedAnni.toLowerCase()) {
        console.error(`❌ Anni address mismatch!`);
        console.error(`   Expected: ${expectedAnni}`);
        console.error(`   Got:      ${anniAcc.address}`);
        process.exit(1);
    }

    console.log(`   ✅ Deployer (=Supplier=Jason): ${deployerAcc.address}`);
    console.log(`   ✅ Anni:                        ${anniAcc.address}`);

    // 1. Load Config (now that keys are in process.env)
    const config = loadNetworkConfig(networkArg as any);
    
    console.log(`\n🚀 OP Mainnet L4 Setup (Simplified for Paper7)`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📡 Network: ${config.name} (Chain ${config.chain.id})`);
    console.log(`📡 RPC: ${config.rpcUrl}`);
    console.log(`📡 Bundler: ${config.bundlerUrl}`);

    const publicClient = createPublicClient({ chain: config.chain, transport: http(config.rpcUrl) });
    const supplier = deployerAcc; // deployer = supplier = jason
    const jasonAcc = deployerAcc;
    const supplierClient = createWalletClient({ account: supplier, chain: config.chain, transport: http(config.rpcUrl) });
    const jasonClient = supplierClient; // same key
    const anniClient = createWalletClient({ account: anniAcc, chain: config.chain, transport: http(config.rpcUrl) });

    // SDK Actions
    const registry = registryActions(config.contracts.registry);
    const gToken = gTokenActions();
    const tokenMethods = tokenActions();
    const xpntsFactory = xPNTsFactoryActions(config.contracts.xPNTsFactory);
    const pmFactory = paymasterFactoryActions(config.contracts.paymasterFactory);
    const ep = entryPointActions(config.contracts.entryPoint, EntryPointVersion.V07);

    // ==================== STEP 1: Check Balances (Read-Only) ====================
    console.log(`\n📋 Step 1: Balance Check (Read-Only)`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    const balances = [];
    for (const [name, addr] of [['Deployer/Jason', deployerAcc.address], ['Anni', anniAcc.address]] as const) {
        const ethBal = await publicClient.getBalance({ address: addr });
        let gTokenBal = 0n;
        try {
            gTokenBal = await gToken(publicClient).balanceOf({ token: config.contracts.gToken, account: addr });
        } catch { /* GToken may not exist yet */ }
        balances.push({ Name: name, Address: addr, ETH: formatEther(ethBal), GToken: formatEther(gTokenBal) });
    }
    console.table(balances);

    // Safety: Check deployer has enough ETH
    const supplierBal = await publicClient.getBalance({ address: supplier.address });
    if (supplierBal < parseEther('0.005')) {
        console.error(`\n❌ CRITICAL: Deployer has < 0.005 ETH on OP Mainnet! Cannot proceed.`);
        console.error(`   Address: ${supplier.address}`);
        console.error(`   Balance: ${formatEther(supplierBal)} ETH`);
        process.exit(1);
    }

    // ==================== STEP 2: Operator Setup ====================
    console.log(`\n📋 Step 2: Operator Setup (Jason V4 + Anni SuperPM)`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    const ROLE_COMMUNITY_ID = await registry(publicClient).ROLE_COMMUNITY();
    const ROLE_ENDUSER_ID = await registry(publicClient).ROLE_ENDUSER();
    const ROLE_PAYMASTER_AOA = await registry(publicClient).ROLE_PAYMASTER_AOA();
    const ROLE_PAYMASTER_SUPER = await registry(publicClient).ROLE_PAYMASTER_SUPER();

    const communityMap: Record<string, { token: Address, pmV4?: Address }> = {};

    // --- 2a. Jason (=Deployer): GToken + Community + aPNTs + PaymasterV4 ---
    console.log(`\n👤 Jason/Deployer (AAStar Community, V4 Paymaster):`);
    
    // GToken
    let jasonGToken = await gToken(publicClient).balanceOf({ token: config.contracts.gToken, account: jasonAcc.address });
    if (jasonGToken < parseEther('100')) {
        console.log(`   🪙 Minting 500 GToken to Jason (minimal)...`);
        const h = await gToken(supplierClient).mint({ token: config.contracts.gToken, to: jasonAcc.address, amount: parseEther('500'), account: supplier });
        await trackGas(publicClient, h, '2a.Jason.MintGToken');
    } else {
        console.log(`   ✅ Jason GToken: ${formatEther(jasonGToken)}`);
    }

    // Community
    const jasonIsComm = await registry(publicClient).hasRole({ user: jasonAcc.address, roleId: ROLE_COMMUNITY_ID });
    if (!jasonIsComm) {
        console.log(`   📝 Registering Jason as AAStar Community...`);
        const commClient = new CommunityClient({
            client: jasonClient, publicClient,
            registryAddress: config.contracts.registry,
            gTokenAddress: config.contracts.gToken,
            gTokenStakingAddress: config.contracts.gTokenStaking
        });
        // Since Jason = Deployer, AAStar should already be registered in DeployLive.s.sol
        console.log(`   ℹ️  AAStar Community should be pre-registered by DeployLive.s.sol`);
        if (!jasonIsComm) {
            console.warn(`   ⚠️  Jason NOT registered? Attempting recovery registration...`);
             const h = await commClient.registerAsCommunity({ 
                name: 'AAStar',
                logoURI: 'ipfs://bafkreihqmsnyn4s5rt6nnyrxbwaufzmrsr2xfbj4yeqgi6qdr35umzxiay',
                description: 'AAStar - Empower Community!',
                website: 'https://aastar.io'
            });
            await trackGas(publicClient, h, '2a.Jason.RegisterCommunity');
        }
    } else {
        console.log(`   ✅ Jason already registered as Community`);
    }

    // Jason uses pre-deployed aPNTs
    communityMap['Jason'] = { token: config.contracts.aPNTs };
    console.log(`   ✅ Jason token: ${config.contracts.aPNTs} (aPNTs, pre-deployed)`);

    // PaymasterV4
    let jasonPM: Address | undefined;
    try {
        jasonPM = await pmFactory(publicClient).getPaymaster({ owner: jasonAcc.address });
    } catch { jasonPM = undefined; }

    if (!jasonPM || jasonPM === '0x0000000000000000000000000000000000000000') {
        console.log(`   ⛽ Deploying PaymasterV4 for Jason...`);
        const operatorSdk = new PaymasterOperatorClient({
            client: jasonClient, publicClient,
            superPaymasterAddress: config.contracts.superPaymaster,
            tokenAddress: config.contracts.aPNTs,
            xpntsFactoryAddress: config.contracts.xPNTsFactory,
            registryAddress: config.contracts.registry,
            entryPointAddress: config.contracts.entryPoint,
            gTokenAddress: config.contracts.gToken,
            gTokenStakingAddress: config.contracts.gTokenStaking,
            paymasterFactoryAddress: config.contracts.paymasterFactory,
            ethUsdPriceFeedAddress: config.contracts.priceFeed
        });
        const res = await operatorSdk.deployAndRegisterPaymasterV4({ stakeAmount: parseEther('30'), version: 'v4.2' });
        jasonPM = res.paymasterAddress;
        console.log(`   ✅ PaymasterV4 deployed: ${jasonPM}`);
    } else {
        console.log(`   ✅ Jason PaymasterV4: ${jasonPM}`);
    }
    communityMap['Jason'].pmV4 = jasonPM;

    // PM V4: Set token price + update ETH price
    if (jasonPM) {
        const pmData = paymasterActions(jasonPM);
        const aPNTsPrice = await pmData(publicClient).tokenPrices({ token: config.contracts.aPNTs });
        if (aPNTsPrice === 0n) {
            console.log(`   🔧 Setting aPNTs price ($1) in Jason's PM...`);
            const h = await pmData(jasonClient).setTokenPrice({ token: config.contracts.aPNTs, price: 100000000n, account: jasonAcc });
            await trackGas(publicClient, h, '2a.Jason.SetTokenPrice');
        }
        console.log(`   🕒 Updating ETH price via Chainlink...`);
        try {
            const h = await pmData(jasonClient).updatePrice({ account: jasonAcc });
            await trackGas(publicClient, h, '2a.Jason.UpdatePrice');
        } catch (e: any) {
            console.log(`   ⚠️ Price update skipped: ${e.message?.split('\n')[0]}`);
        }
    }

    // --- 2b. Anni: GToken + Community + xPNTs Token + SuperPM ---
    console.log(`\n👤 Anni (Mycelium Community, SuperPaymaster):`);
    
    // Fund Anni ETH if needed (from deployer)
    const anniEthBal = await publicClient.getBalance({ address: anniAcc.address });
    if (anniEthBal < parseEther('0.005')) {
        console.log(`   ⛽ Funding 0.01 ETH to Anni...`);
        const h = await supplierClient.sendTransaction({ to: anniAcc.address, value: parseEther('0.01') });
        await trackGas(publicClient, h, '2b.Anni.FundETH');
    }

    // GToken
    let anniGToken = await gToken(publicClient).balanceOf({ token: config.contracts.gToken, account: anniAcc.address });
    if (anniGToken < parseEther('100')) {
        console.log(`   🪙 Minting 500 GToken to Anni...`);
        const h = await gToken(supplierClient).mint({ token: config.contracts.gToken, to: anniAcc.address, amount: parseEther('500'), account: supplier });
        await trackGas(publicClient, h, '2b.Anni.MintGToken');
    } else {
        console.log(`   ✅ Anni GToken: ${formatEther(anniGToken)}`);
    }

    // Community
    const anniIsComm = await registry(publicClient).hasRole({ user: anniAcc.address, roleId: ROLE_COMMUNITY_ID });
    if (!anniIsComm) {
        console.log(`   📝 Registering Anni as Mycelium Community...`);
        const commClient = new CommunityClient({
            client: anniClient, publicClient,
            registryAddress: config.contracts.registry,
            gTokenAddress: config.contracts.gToken,
            gTokenStakingAddress: config.contracts.gTokenStaking
        });
        const h = await commClient.registerAsCommunity({ 
            name: 'Mycelium',
            logoURI: 'ipfs://bafkreid43524vl2mpf5435y55425252', // Placeholder
            description: 'Connect to the Mycelium Network',
            website: 'https://mushroom.box'
        });
        await trackGas(publicClient, h, '2b.Anni.RegisterCommunity');
    } else {
        console.log(`   ✅ Anni already registered as Community`);
    }

    // xPNTs Token (Anni deploys PNTs via factory)
    let anniToken: Address | null = null;
    anniToken = await xpntsFactory(publicClient).getTokenAddress({ community: anniAcc.address });
    if (!anniToken || anniToken === '0x0000000000000000000000000000000000000000') {
        console.log(`   🏭 Deploying PNTs token for Anni...`);
        const h = await xpntsFactory(anniClient).createToken({
            name: 'PNTs Token', symbol: 'PNTs', community: anniAcc.address, account: anniAcc
        });
        await trackGas(publicClient, h, '2b.Anni.DeployToken');
        anniToken = await xpntsFactory(publicClient).getTokenAddress({ community: anniAcc.address });
        console.log(`   ✅ PNTs deployed: ${anniToken}`);
    } else {
        console.log(`   ✅ Anni token: ${anniToken}`);
    }
    communityMap['Anni'] = { token: anniToken! };

    // Mint PNTs to Anni (minimal: 10,000)
    if (anniToken) {
        const bal = await publicClient.readContract({
            address: anniToken,
            abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
            functionName: 'balanceOf',
            args: [anniAcc.address]
        }) as bigint;
        if (bal < parseEther('1000')) {
            console.log(`   🪙 Minting 10,000 PNTs to Anni...`);
            const h = await anniClient.writeContract({
                address: anniToken,
                abi: parseAbi(['function mint(address to, uint256 amount) external']),
                functionName: 'mint',
                args: [anniAcc.address, parseEther('10000')],
                account: anniAcc
            });
            await trackGas(publicClient, h, '2b.Anni.MintPNTs');
        }
    }

    // SuperPM Operator Registration
    const anniIsSuperOp = await registry(publicClient).hasRole({ user: anniAcc.address, roleId: ROLE_PAYMASTER_SUPER });
    if (!anniIsSuperOp) {
        console.log(`   📝 Registering Anni as SuperPaymaster Operator...`);
        const operatorSdk = new PaymasterOperatorClient({
            client: anniClient, publicClient,
            superPaymasterAddress: config.contracts.superPaymaster,
            tokenAddress: anniToken!,
            xpntsFactoryAddress: config.contracts.xPNTsFactory,
            registryAddress: config.contracts.registry,
            entryPointAddress: config.contracts.entryPoint,
            gTokenAddress: config.contracts.gToken,
            gTokenStakingAddress: config.contracts.gTokenStaking,
            paymasterFactoryAddress: config.contracts.paymasterFactory,
            ethUsdPriceFeedAddress: config.contracts.priceFeed
        });
        await operatorSdk.registerAsSuperPaymasterOperator({
            stakeAmount: parseEther('50'),
            depositAmount: 0n
        });
        console.log(`   ✅ Anni registered as SuperPM Operator`);
    } else {
        console.log(`   ✅ Anni already registered as SuperPM Operator`);
    }

    // Configure Operator in SuperPM (if not configured)
    const spActions = superPaymasterActions(config.contracts.superPaymaster);
    const opConfig = await spActions(publicClient).operators({ operator: anniAcc.address });
    if (!opConfig.isConfigured && anniToken) {
        console.log(`   🔧 Configuring Anni in SuperPaymaster...`);
        const operatorSdk = new PaymasterOperatorClient({
            client: anniClient, publicClient,
            superPaymasterAddress: config.contracts.superPaymaster,
            tokenAddress: anniToken,
            xpntsFactoryAddress: config.contracts.xPNTsFactory,
            registryAddress: config.contracts.registry,
            entryPointAddress: config.contracts.entryPoint,
            gTokenAddress: config.contracts.gToken,
            gTokenStakingAddress: config.contracts.gTokenStaking,
            paymasterFactoryAddress: config.contracts.paymasterFactory,
            ethUsdPriceFeedAddress: config.contracts.priceFeed
        });
        const h = await operatorSdk.configureOperator(anniToken, anniAcc.address, parseEther('1'));
        await trackGas(publicClient, h, '2b.Anni.ConfigureOperator');
    }

    // Link xPNTsToken to SuperPM
    if (anniToken) {
        try {
            const spAddr = await publicClient.readContract({
                address: anniToken,
                abi: parseAbi(['function SUPERPAYMASTER_ADDRESS() view returns (address)']),
                functionName: 'SUPERPAYMASTER_ADDRESS'
            }) as Address;
            if (spAddr.toLowerCase() !== config.contracts.superPaymaster.toLowerCase()) {
                console.log(`   🔗 Linking PNTs to SuperPaymaster...`);
                const h = await anniClient.writeContract({
                    address: anniToken,
                    abi: parseAbi(['function setSuperPaymasterAddress(address)']),
                    functionName: 'setSuperPaymasterAddress',
                    args: [config.contracts.superPaymaster],
                    account: anniAcc
                });
                await trackGas(publicClient, h, '2b.Anni.LinkToSuperPM');
            } else {
                console.log(`   ✅ PNTs already linked to SuperPaymaster`);
            }
        } catch (e: any) {
            console.log(`   ⚠️ Link check: ${e.message?.split('\n')[0]}`);
        }
    }

    // Jason mints aPNTs to Anni (for SuperPM deposit)
    const anniAPNTsBal = await gToken(publicClient).balanceOf({ token: config.contracts.aPNTs, account: anniAcc.address });
    if (anniAPNTsBal < parseEther('1000')) {
        console.log(`   💸 Jason minting 5,000 aPNTs to Anni (for SuperPM deposit)...`);
        const h = await tokenMethods(jasonClient).mint({
            token: config.contracts.aPNTs, to: anniAcc.address, amount: parseEther('5000'), account: jasonAcc
        });
        await trackGas(publicClient, h, '2b.Jason.MintAPNTsToAnni');
    }

    // ==================== STEP 3: AA Accounts (1 per operator = 2 total) ====================
    console.log(`\n📋 Step 3: AA Accounts (2 total: Jason_AA1 + Anni_AA1)`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    const accountFactory = accountFactoryActions(config.contracts.simpleAccountFactory);
    const testAccounts: { label: string; owner: any; salt: bigint; address: Address; opName: string }[] = [];

    for (const [name, owner] of [['Jason', jasonAcc], ['Anni', anniAcc]] as const) {
        const salt = 0n;
        const aaAddr = await accountFactory(publicClient).getAddress({ owner: owner.address, salt });
        const code = await publicClient.getBytecode({ address: aaAddr });
        const isDeployed = code && code.length > 2;

        testAccounts.push({ label: `${name}_AA1`, owner, salt, address: aaAddr, opName: name });

        if (!isDeployed) {
            console.log(`   🏭 Deploying ${name}_AA1 (${aaAddr})...`);
            const client = createWalletClient({ account: owner, chain: config.chain, transport: http(config.rpcUrl) });
            const h = await accountFactory(client).createAccount({ owner: owner.address, salt, account: owner });
            await trackGas(publicClient, h, `3.${name}_AA1.Deploy`);
        } else {
            console.log(`   ✅ ${name}_AA1: ${aaAddr} (deployed)`);
        }
    }

    // Fund AAs minimally
    for (const aa of testAccounts) {
        const ethBal = await publicClient.getBalance({ address: aa.address });
        if (ethBal < parseEther('0.001')) {
            console.log(`   ⛽ Funding ${aa.label} with 0.005 ETH...`);
            const h = await supplierClient.sendTransaction({ to: aa.address, value: parseEther('0.005') });
            await trackGas(publicClient, h, `3.${aa.label}.FundETH`);
        }

        // GToken (minimal for role staking)
        const gtBal = await gToken(publicClient).balanceOf({ token: config.contracts.gToken, account: aa.address });
        if (gtBal < parseEther('1')) {
            console.log(`   🪙 Minting 10 GToken to ${aa.label}...`);
            const h = await gToken(supplierClient).mint({ token: config.contracts.gToken, to: aa.address, amount: parseEther('10'), account: supplier });
            await trackGas(publicClient, h, `3.${aa.label}.MintGToken`);
        }

        // aPNTs (for V4 gasless deposit)
        const aPNTsBal = await tokenMethods(publicClient).balanceOf({ token: config.contracts.aPNTs, account: aa.address });
        if (aPNTsBal < parseEther('100')) {
            console.log(`   🎫 Minting 500 aPNTs to ${aa.label}...`);
            const h = await tokenMethods(jasonClient).mint({
                token: config.contracts.aPNTs, to: aa.address, amount: parseEther('500'), account: jasonAcc
            });
            await trackGas(publicClient, h, `3.${aa.label}.MintAPNTs`);
        }
    }

    // ==================== STEP 4: Register AAs as ENDUSER ====================
    console.log(`\n📋 Step 4: Register AAs into Communities`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    for (const aa of testAccounts) {
        const isMember = await registry(publicClient).hasRole({ user: aa.address, roleId: ROLE_ENDUSER_ID });
        if (isMember) {
            console.log(`   ✅ ${aa.label} already ENDUSER`);
            continue;
        }

        const communityOwner = aa.opName === 'Jason' ? jasonAcc : anniAcc;
        const ownerClient = createWalletClient({ account: aa.owner, chain: config.chain, transport: http(config.rpcUrl) });

        // Approve GToken from AA
        const accountClient = accountActions(aa.address);
        const approveData = encodeFunctionData({
            abi: parseAbi(['function approve(address spender, uint256 amount) returns (bool)']),
            functionName: 'approve',
            args: [config.contracts.gTokenStaking, parseEther('10')]
        });
        console.log(`   📝 ${aa.label}: Approving GToken...`);
        const approveHash = await accountClient(ownerClient).execute({
            dest: config.contracts.gToken, value: 0n, func: approveData, account: aa.owner
        });
        await trackGas(publicClient, approveHash, `4.${aa.label}.ApproveGToken`);

        // Register
        const roleData = encodeAbiParameters(
            [
                { type: 'address', name: 'account' },
                { type: 'address', name: 'community' },
                { type: 'string', name: 'avatarURI' },
                { type: 'string', name: 'ensName' },
                { type: 'uint256', name: 'stakeAmount' }
            ],
            [aa.address, communityOwner.address, '', '', parseEther('0.3')]
        );
        console.log(`   📝 ${aa.label}: Registering as ENDUSER...`);
        const regHash = await registry(ownerClient).registerRole({
            roleId: ROLE_ENDUSER_ID, user: aa.address, data: roleData, account: aa.owner
        });
        await trackGas(publicClient, regHash, `4.${aa.label}.RegisterEndUser`);
    }

    // ==================== STEP 5: Deposit to Paymasters ====================
    console.log(`\n📋 Step 5: Paymaster Deposits & Config`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    // 5a. Jason's PM V4: Deposit aPNTs for AA
    if (jasonPM) {
        const pm = paymasterActions(jasonPM);
        for (const aa of testAccounts) {
            const deposit = await pm(publicClient).balances({ user: aa.address, token: config.contracts.aPNTs });
            if (deposit < parseEther('100')) {
                console.log(`   💰 Depositing 200 aPNTs for ${aa.label} in Jason's PM...`);
                const h1 = await tokenMethods(jasonClient).approve({
                    token: config.contracts.aPNTs, spender: jasonPM, amount: parseEther('200'), account: jasonAcc
                });
                await trackGas(publicClient, h1, `5a.${aa.label}.ApproveForPM`);
                const h2 = await pm(jasonClient).depositFor({
                    user: aa.address, token: config.contracts.aPNTs, amount: parseEther('200'), account: jasonAcc
                });
                await trackGas(publicClient, h2, `5a.${aa.label}.DepositToPM`);
            }
        }
    }

    // 5b. SuperPM: Cache price
    console.log(`\n   🔍 SuperPaymaster Cache Price...`);
    try {
        const cacheData = await spActions(publicClient).cachedPrice() as any;
        const price = cacheData.price || cacheData[0];
        const updatedAt = cacheData.updatedAt || cacheData[1];
        const ageSeconds = Date.now() / 1000 - Number(updatedAt);
        
        if (ageSeconds > 3600 || Number(price) === 0) {
            console.log(`   ⚠️ Cache stale (${Math.floor(ageSeconds/60)}min). Updating via Chainlink...`);
            // Deployer is SuperPM owner (deployed it)
            const h = await spActions(supplierClient).updatePrice({ account: supplier });
            await trackGas(publicClient, h, '5b.SuperPM.UpdatePrice');
        } else {
            console.log(`   ✅ Cache fresh (${Math.floor(ageSeconds/60)}min, $${Number(price) / 1e8})`);
        }
    } catch (e: any) {
        console.log(`   ⚠️ Cache check failed: ${e.message?.split('\n')[0]}`);
    }

    // 5c. SuperPM: Anni deposit aPNTs (minimal: 5,000)
    const anniOpConfig = await spActions(publicClient).operators({ operator: anniAcc.address });
    if (anniOpConfig.aPNTsBalance < parseEther('1000')) {
        console.log(`   🔄 Depositing 5,000 aPNTs to SuperPM for Anni...`);
        const h = await spActions(anniClient).deposit({ amount: parseEther('5000'), account: anniAcc });
        await trackGas(publicClient, h, '5c.Anni.DepositToSuperPM');
    } else {
        console.log(`   ✅ Anni SuperPM balance: ${formatEther(anniOpConfig.aPNTsBalance)} aPNTs`);
    }

    // 5d. EntryPoint deposits
    const allPMs = [jasonPM, config.contracts.superPaymaster].filter(Boolean) as Address[];
    for (const pm of allPMs) {
        const epBal = await ep(publicClient).balanceOf({ account: pm });
        if (epBal < parseEther('0.05')) {
            const label = pm === config.contracts.superPaymaster ? 'SuperPM' : 'JasonPM';
            console.log(`   💵 EntryPoint deposit 0.1 ETH for ${label}...`);
            const h = await ep(supplierClient).depositTo({ account: pm, amount: parseEther('0.1'), txAccount: supplier });
            await trackGas(publicClient, h, `5d.${label}.EPDeposit`);
        }
    }

    // 5e. SuperPM EntryPoint Stake
    const spDepositInfo = await ep(publicClient).getDepositInfo({ account: config.contracts.superPaymaster });
    if (!spDepositInfo.staked || (spDepositInfo.stake || 0n) < parseEther('0.1')) {
        console.log(`   🔐 Adding EntryPoint stake for SuperPM (0.1 ETH, 86400s)...`);
        // Deployer is SuperPM owner
        const h = await spActions(supplierClient).addStake({ unstakeDelaySec: 86400, value: parseEther('0.1'), account: supplier });
        await trackGas(publicClient, h, '5e.SuperPM.AddStake');
    } else {
        console.log(`   ✅ SuperPM staked: ${formatEther(spDepositInfo.stake || 0n)} ETH`);
    }

    // ==================== STEP 6: Read Chainlink ETH/USD ====================
    console.log(`\n📋 Step 6: Chainlink ETH/USD Price (for Paper7)`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    try {
        const roundData = await publicClient.readContract({
            address: config.contracts.priceFeed,
            abi: parseAbi(['function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)']),
            functionName: 'latestRoundData'
        }) as [bigint, bigint, bigint, bigint, bigint];
        const ethPrice = Number(roundData[1]) / 1e8;
        const updatedAt = new Date(Number(roundData[3]) * 1000).toISOString();
        console.log(`   💲 ETH/USD: $${ethPrice.toFixed(2)} (updated: ${updatedAt})`);
        
        // Save to gas log metadata
        (gasLog as any).ethPrice = ethPrice;
        (gasLog as any).ethPriceUpdatedAt = updatedAt;
    } catch (e: any) {
        console.log(`   ⚠️ Chainlink read failed: ${e.message?.split('\n')[0]}`);
    }

    // ==================== STEP 7: Save State ====================
    console.log(`\n💾 Saving State...`);
    const stateToSave = {
        network: config.name,
        timestamp: new Date().toISOString(),
        operators: {
            jason: {
                address: jasonAcc.address,
                tokenAddress: config.contracts.aPNTs,
                symbol: 'aPNTs',
                paymasterV4: jasonPM
            },
            anni: {
                address: anniAcc.address,
                tokenAddress: anniToken,
                symbol: 'PNTs',
                superPaymaster: config.contracts.superPaymaster
            }
        },
        aaAccounts: testAccounts.map(aa => ({
            label: aa.label,
            address: aa.address,
            owner: aa.owner.address,
            salt: aa.salt.toString(),
            opName: aa.opName
        }))
    };
    fs.writeFileSync(STATE_FILE, JSON.stringify(stateToSave, null, 2));
    console.log(`   ✅ State: ${STATE_FILE}`);

    // Save gas log
    saveGasLog();

    // ==================== SUMMARY ====================
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`✅ OP Mainnet L4 Setup Complete`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`   📊 Total on-chain tx: ${gasLog.length}`);
    const totalGasUsed = gasLog.reduce((sum, e) => sum + BigInt(e.gasUsed), 0n);
    const totalCostETH = gasLog.reduce((sum, e) => sum + BigInt(e.totalCostWei), 0n);
    console.log(`   ⛽ Total gas used: ${totalGasUsed.toString()}`);
    console.log(`   💰 Total cost: ${formatEther(totalCostETH)} ETH`);
    console.log(`\n   Next: pnpm tsx tests/l4-test-jason1-gasless.ts --network op-mainnet`);
}

main().catch(err => {
    // Save partial gas log even on error
    saveGasLog();
    console.error(err);
    process.exit(1);
});
