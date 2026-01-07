
import * as fs from 'fs';
import * as path from 'path';
import { createPublicClient, createWalletClient, http, type Hex, parseEther, formatEther, type Address, encodeAbiParameters, parseAbiParameters, getContractAddress, encodeFunctionData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { loadNetworkConfig } from '../tests/regression/config';
import { 
    tokenActions, 
    registryActions, 
    xPNTsFactoryActions,
    paymasterFactoryActions,
    accountFactoryActions,
    paymasterV4Actions,
    superPaymasterActions,
    entryPointActions,
    EntryPointVersion,
    RegistryABI
} from '../packages/core/dist/index.js';
import { CommunityClient, UserClient } from '../packages/enduser/dist/index.js';
import { PaymasterOperatorClient } from '../packages/operator/dist/PaymasterOperatorClient.js';
import {
    UserOperationBuilder,
    UserOpScenarioBuilder,
    UserOpScenarioType
} from '../packages/sdk/dist/index.js';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';
import { loadContract } from './00_utils.js'; 

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATE_FILE = path.resolve(__dirname, 'l4-state.json');

// --- Helper: Console Table ---
function printTable(title: string, data: any[]) {
    console.log(`\n📋 ${title}`);
    console.table(data);
}

// Pimlico v0.7 Factory Address
const FACTORY_ADDRESS = '0x91E60e0613810449d098b0b5Ec8b51A0FE8c8985'; 

async function main() {
    // Helper to check and fund ETH
    const checkAndFund = async (target: Address, minEth: string) => {
        const bal = await publicClient.getBalance({ address: target });
        if (bal < parseEther(minEth)) {
            console.log(`   ⛽ Funding ${target} with ${minEth} ETH...`);
            const hash = await supplierClient.sendTransaction({
                to: target,
                value: parseEther(minEth),
                account: supplier
            });
            await publicClient.waitForTransactionReceipt({ hash });
        }
    };
    
    // 1. Load Config & ENV
    const networkArg = process.argv.find(arg => arg.startsWith('--network='))?.split('=')[1];
    if (!networkArg) {
        console.error("❌ Please provide --network argument (e.g., --network=sepolia)");
        process.exit(1);
    }
    
    const config = loadNetworkConfig(networkArg);
    console.log(`\n🚀 Starting L4 Assessment & Setup on ${config.name}...`);
    
    // Load .env
    const envPath = path.resolve(__dirname, `../.env.${networkArg}`);
    console.log(`  📂 Loading ENV from: ${envPath}`);
    dotenv.config({ path: envPath, override: true });

    const publicClient = createPublicClient({
        chain: config.chain,
        transport: http(config.rpcUrl)
    });

    if (!config.supplierAccount) throw new Error('PRIVATE_KEY_SUPPLIER required');
    const supplier = privateKeyToAccount(config.supplierAccount.privateKey);
    const supplierClient = createWalletClient({ account: supplier, chain: config.chain, transport: http(config.rpcUrl) });
    
    // 2. Output Core Addresses & EOA Status
    printTable("Core Contracts", Object.entries(config.contracts).map(([k, v]) => ({ Contract: k, Address: v })));
    
    const operators = [
        { name: 'Jason (AAStar)', key: process.env.PRIVATE_KEY_JASON as Hex, role: 'Operator', symbol: 'aPNTs', pmType: 'V4' },
        { name: 'Bob (Bread)', key: process.env.PRIVATE_KEY_BOB as Hex, role: 'Operator', symbol: 'bPNTs', pmType: 'V4' },
        { name: 'Anni (Demo)', key: process.env.PRIVATE_KEY_ANNI as Hex, role: 'Operator', symbol: 'cPNTs', pmType: 'Super' },
        { name: 'Charlie (Test)', key: process.env.PRIVATE_KEY_CHARLIE as Hex, role: 'Operator', symbol: 'dPNTs', pmType: 'V4' },
    ];

    const registry = registryActions(config.contracts.registry);
    const gToken = tokenActions();
    const xpntsFactory = xPNTsFactoryActions(config.contracts.xPNTsFactory);
    const pmFactory = paymasterFactoryActions(config.contracts.paymasterFactory);

    console.log(`\n🔍 Checking & Repairing Operators...`);
    const operatorStatus: any[] = [];
    const communityMap: Record<string, { token: Address, pmV4?: Address }> = {};

    for (const op of operators) {
        const acc = privateKeyToAccount(op.key);
        const opClient = createWalletClient({ account: acc, chain: config.chain, transport: http(config.rpcUrl) });
        
        // 2a. Ensure Funds - 按文档要求: ≥0.1 ETH
        let ethBal = await publicClient.getBalance({ address: acc.address });
        if(ethBal < parseEther('0.1')) {
            console.log(`   ⛽ Funding ETH to ${op.name}...`);
            const h = await supplierClient.sendTransaction({ to: acc.address, value: parseEther('0.2') });
            await publicClient.waitForTransactionReceipt({hash:h});
            ethBal = await publicClient.getBalance({ address: acc.address });
        }
        
        // 2b. GToken - 按文档要求: Jason/Bob 100,000, Anni 200,000
        const requiredGToken = op.name.includes('Anni') ? parseEther('200000') : parseEther('100000');
        let gTokenBal = await gToken(publicClient).balanceOf({ token: config.contracts.gToken, account: acc.address });
        if(gTokenBal < requiredGToken) {
             console.log(`   🪙 Minting ${op.name.includes('Anni') ? '200,000' : '100,000'} GToken to ${op.name}...`);
             const mintAmount = requiredGToken - gTokenBal + parseEther('1000'); // 补足+额外buffer
             const h = await gToken(supplierClient).mint({ token: config.contracts.gToken, to: acc.address, amount: mintAmount, account: supplier });
             await publicClient.waitForTransactionReceipt({hash:h});
             gTokenBal = await gToken(publicClient).balanceOf({ token: config.contracts.gToken, account: acc.address });
        }

        // 2b. Check/Register Community
        let community = "None";
        const isComm = await registry(publicClient).hasRole({ user: acc.address, roleId: await registry(publicClient).ROLE_COMMUNITY() });
        if (isComm) {
            community = "Registered";
        } else {
             console.log(`   📝 Registering Community for ${op.name}...`);
             const commClient = new CommunityClient({
                 client: opClient, publicClient, 
                 registryAddress: config.contracts.registry,
                 gTokenAddress: config.contracts.gToken,
                 gTokenStakingAddress: config.contracts.gTokenStaking
             });
             try {
                 const h = await commClient.registerAsCommunity({ name: op.name.split(' ')[0] });
                 await publicClient.waitForTransactionReceipt({hash:h});
                 community = "Registered (New)";
             } catch(e:any) { community = `Error: ${e.message.split('\n')[0]}`; }
        }

        // 2c. Check/Deploy Token
        // Jason(AAStar)使用已部署的config.contracts.aPNTs,不需要通过xPNTsFactory部署新代币
        let token: string = "None";
        let tAddr: Address | null = null;
        
        if (op.name.includes('Jason')) {
            // Jason's aPNTs is the global aPNTs already deployed and configured in SuperPaymaster
            tAddr = config.contracts.aPNTs;
            token = tAddr;
            console.log(`   ✓ ${op.name} using pre-deployed aPNTs: ${tAddr}`);
        } else {
            // Bob and Anni deploy their own community tokens via xPNTsFactory
            tAddr = await xpntsFactory(publicClient).getTokenAddress({ community: acc.address });
            if (!tAddr || tAddr === '0x0000000000000000000000000000000000000000') {
                 console.log(`   🏭 Deploying ${op.symbol} for ${op.name}...`);
                 try {
                     const h = await xpntsFactory(opClient).createToken({
                        name: `${op.symbol} Token`, symbol: op.symbol, community: acc.address, account: acc
                     });
                     await publicClient.waitForTransactionReceipt({hash:h});
                     tAddr = await xpntsFactory(publicClient).getTokenAddress({ community: acc.address });
                     token = tAddr ?? 'Error';
                 } catch(e:any) { token = `Error`; }
            } else {
                token = tAddr;
            }
        }
        if(tAddr && token !== 'Error' && token !== 'None') communityMap[op.name] = { token: tAddr };

        // 2d. Check/Deploy Paymaster V4
        let pmV4 = "None";
        const operatorSdk = new PaymasterOperatorClient({
            client: opClient, publicClient,
            superPaymasterAddress: config.contracts.superPaymaster,
            tokenAddress: token as Address,
            xpntsFactoryAddress: config.contracts.xPNTsFactory,
            registryAddress: config.contracts.registry,
            entryPointAddress: config.contracts.entryPoint,
            gTokenAddress: config.contracts.gToken,
            gTokenStakingAddress: config.contracts.gTokenStaking,
            paymasterFactoryAddress: config.contracts.paymasterFactory
        });

        if (op.pmType === 'V4') {
            let pAddr = await pmFactory(publicClient).getPaymaster({ owner: acc.address });
            if (!pAddr || pAddr === '0x0000000000000000000000000000000000000000') {
                 console.log(`   ⛽ Deploying Paymaster V4 for ${op.name}...`);
                 try {
                     const res = await operatorSdk.deployAndRegisterPaymasterV4({ 
                         stakeAmount: parseEther('30') 
                     });
                     pAddr = res.paymasterAddress;
                     pmV4 = pAddr;
                 } catch(e:any) { 
                     console.log(`      ⚠️ PM Deploy Failed: ${e.message}`);
                 }
            } else {
                pmV4 = pAddr;
                // 即使已部署，也检查是否在Registry注册过角色
                try {
                    const ROLE_AOA = await registry(publicClient).ROLE_PAYMASTER_AOA();
                    const hasRole = await registry(publicClient).hasRole({ user: acc.address, roleId: ROLE_AOA });
                    if (!hasRole) {
                        console.log(`   📝 Registering Paymaster V4 Role for ${op.name}...`);
                        await operatorSdk.deployAndRegisterPaymasterV4({
                            stakeAmount: parseEther('30')
                        });
                    }
                } catch(e:any) { console.log(`      ⚠️ PM Role Check/Reg Failed: ${e.message}`); }
            }
            
            // ✅ Verify Paymaster Owner
            if(pmV4 && pmV4 !== 'None' && pmV4 !== 'N/A (Super)') {
                try {
                    const pmOwner = await publicClient.readContract({
                        address: pmV4 as Address,
                        abi: [{ name: 'owner', type: 'function', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' }],
                        functionName: 'owner'
                    }) as Address;
                    
                    if (pmOwner === acc.address) {
                        console.log(`   ✅ Paymaster Owner Verified: ${pmOwner}`);
                    } else if (pmOwner === '0x0000000000000000000000000000000000000000') {
                        console.log(`   ❌ Paymaster Owner is ZERO! Needs manual initialization.`);
                    } else {
                        console.log(`   ⚠️  Paymaster Owner Mismatch! Expected: ${acc.address}, Got: ${pmOwner}`);
                    }
                } catch(e:any) { 
                    console.log(`      ⚠️ Owner Check Failed: ${e.message}`); 
                }
            }
            
            if(pmV4 && pmV4 !== 'None' && communityMap[op.name]) communityMap[op.name].pmV4 = pmV4 as Address;
        } else {
            pmV4 = "N/A (Super)";
            try {
                const ROLE_SUPER = await registry(publicClient).ROLE_PAYMASTER_SUPER();
                const registered = await registry(publicClient).hasRole({ user: acc.address, roleId: ROLE_SUPER });
                if(!registered) {
                    console.log(`   📝 Registering SuperPM Role for Anni...`);
                    await operatorSdk.registerAsSuperPaymasterOperator({
                        stakeAmount: parseEther('50'),
                        depositAmount: parseEther('50000')
                    });
                }
            } catch(e:any) { console.log(`      ⚠️ SuperPM Role Check/Reg Failed: ${e.message}`); }
        }

        operatorStatus.push({
            Name: op.name,
            Address: acc.address,
            ETH: parseFloat(formatEther(ethBal)).toFixed(4),
            GToken: parseFloat(formatEther(gTokenBal)).toFixed(2),
            Community: community,
            Token: token,
            PM_V4: pmV4
        });
    }
    printTable("Operator Status", operatorStatus);

    // 2e. Jason mint aPNTs给Anni (用于SuperPaymaster存款) - 按文档要求: 100,000 aPNTs
    console.log(`\n🔄 Checking aPNTs for Anni's SuperPaymaster deposit...`);
    const jasonOp = operators.find(o => o.name.includes('Jason'));
    const anniOpData = operators.find(o => o.name.includes('Anni'));
    if (jasonOp && anniOpData && communityMap[jasonOp.name]?.token) {
        const jasonAcc = privateKeyToAccount(jasonOp.key);
        const anniAddr = privateKeyToAccount(anniOpData.key).address;
        const aPNTsToken = communityMap[jasonOp.name].token; // Jason's aPNTs
        
        const anniAPNTsBal = await gToken(publicClient).balanceOf({ token: aPNTsToken, account: anniAddr });
        const requiredAPNTs = parseEther('100000');
        
        if (anniAPNTsBal < requiredAPNTs) {
            console.log(`   💸 Jason minting 100,000 aPNTs to Anni...`);
            const jasonClient = createWalletClient({ account: jasonAcc, chain: config.chain, transport: http(config.rpcUrl) });
            const mintAmount = requiredAPNTs - anniAPNTsBal;
            const h = await tokenActions()(jasonClient).mint({
                token: aPNTsToken, to: anniAddr, amount: mintAmount, account: jasonAcc
            });
            await publicClient.waitForTransactionReceipt({ hash: h });
            console.log(`   ✅ Anni now has 100,000 aPNTs for SuperPaymaster deposit`);
        } else {
            console.log(`   ✓ Anni already has ${formatEther(anniAPNTsBal)} aPNTs`);
        }
    }

    // 3. AA Setup (6 Accounts)
    console.log(`\n🏭 3. Checking & Deploying 6 Test AA Accounts (Pimlico v0.7)...`);
    const testAccounts: any[] = [];
    const accountFactory = accountFactoryActions(FACTORY_ADDRESS);
    const ROLE_ENDUSER_ID = await registry(publicClient).ROLE_ENDUSER();

    // Salts
    for (const op of operators) {
        const owner = privateKeyToAccount(op.key);
        for (let i = 0; i < 2; i++) {
            const salt = BigInt(i);
            const label = `${op.name}_AA${i+1}`;
            const aaAddr = await accountFactory(publicClient).getAddress({ owner: owner.address, salt });
            const code = await publicClient.getBytecode({ address: aaAddr });
            const isDeployed = code && code.length > 2;

            testAccounts.push({
                label, owner, salt, address: aaAddr, isDeployed,
                opName: op.name 
            });
            
            if (!isDeployed) {
                console.log(`   Deploying ${label} (${aaAddr})...`);
                const client = createWalletClient({ account: owner, chain: config.chain, transport: http(config.rpcUrl) });
                try {
                    const hash = await accountFactory(client).createAccount({ owner: owner.address, salt, account: owner });
                    await publicClient.waitForTransactionReceipt({ hash });
                } catch(e:any) { console.error(`   ❌ Failed to deploy ${label}: ${e.message}`); }
            }
        }
    }

    // 3b. Fund AA Accounts
    console.log(`\n💰 Checking AA Resources...`);
    const aaStatus: any[] = [];
    const allTokens = Object.values(communityMap).map(c => c.token);

    for (const aa of testAccounts) {
        // ETH
        let ethBal = await publicClient.getBalance({ address: aa.address });
        if (ethBal < parseEther('0.01')) {
            console.log(`   ⛽ Funding ETH to ${aa.label}...`);
            const hash = await supplierClient.sendTransaction({ to: aa.address, value: parseEther('0.02') });
            await publicClient.waitForTransactionReceipt({ hash });
            ethBal = await publicClient.getBalance({ address: aa.address });
        }

        // GToken
        let gtBal = await gToken(publicClient).balanceOf({ token: config.contracts.gToken, account: aa.address });
        if (gtBal < parseEther('100')) {
             console.log(`   🪙 Funding GToken to ${aa.label}...`);
             const hash = await gToken(supplierClient).mint({ token: config.contracts.gToken, to: aa.address, amount: parseEther('1000'), account: supplier });
             await publicClient.waitForTransactionReceipt({ hash });
             gtBal = await gToken(publicClient).balanceOf({ token: config.contracts.gToken, account: aa.address });
        }

        // xPNTs Tokens - 按文档要求: 各10,000 a/b/cPNTs
        for (const tAddr of allTokens) {
            const issuerName = Object.keys(communityMap).find(k => communityMap[k].token === tAddr);
            if (!issuerName) continue;
            const issuerOp = operators.find(o => o.name === issuerName);
            if (!issuerOp) continue;
            const issuerClient = createWalletClient({ account: privateKeyToAccount(issuerOp.key), chain: config.chain, transport: http(config.rpcUrl) });
            
            const xpBal = await gToken(publicClient).balanceOf({ token: tAddr, account: aa.address });
            if (xpBal < parseEther('10000')) {  // 按文档要求: 10,000
                console.log(`   🎫 Funding ${issuerName} Token (10,000) to ${aa.label}...`);
                try {
                    const mintAmount = parseEther('10000') - xpBal;
                    const h = await tokenActions()(issuerClient).mint({
                        token: tAddr, to: aa.address, amount: mintAmount, account: privateKeyToAccount(issuerOp.key)
                    });
                    
                    await publicClient.waitForTransactionReceipt({ hash:h });
                } catch(e:any) { console.log(`      ⚠️ Mint Failed: ${e.message}`); }
            }
        }
        
        aaStatus.push({ 
            Label: aa.label, 
            Addr: aa.address, 
            ETH: parseFloat(formatEther(ethBal)).toFixed(4), 
            GToken: parseFloat(formatEther(gtBal)).toFixed(2),
            Explorer: `https://sepolia.etherscan.io/address/${aa.address}`
        });
    }
    printTable("AA Accounts Ready", aaStatus);


    // 4. Register Multi - Cross Join (Idempotent)
    console.log(`\n🤝 4. Registering AAs into Communities...`);
    
    for (const aa of testAccounts) {
        const client = createWalletClient({ account: aa.owner, chain: config.chain, transport: http(config.rpcUrl) });
        
        const userClient = new UserClient({
            client, 
            publicClient,
            accountAddress: aa.address,
            registryAddress: config.contracts.registry,
            gTokenStakingAddress: config.contracts.gTokenStaking,
            gTokenAddress: config.contracts.gToken,
            sbtAddress: config.contracts.sbt,
            entryPointAddress: config.contracts.entryPoint
        });

        // Check if AA is already a community member (ENDUSER)
        // Note: UserClient doesn't expose hasRole directly, using Registry Action
        const isMember = await registry(publicClient).hasRole({ 
            user: aa.address,
            roleId: ROLE_ENDUSER_ID
        });
        
        if (!isMember) {
            console.log(`   📝 ${aa.label} joining as ENDUSER...`);
            
            // Find operator to join
            const op = operators.find(o => o.name === aa.opName);
            if (!op) {
                console.log(`      ⚠️ Operator not found for ${aa.label}`);
                continue;
            }
            const opAddress = privateKeyToAccount(op.key).address;

            try {
                // Use SDK API: Handles Approve + Register
                const hash = await userClient.registerAsEndUser(opAddress, parseEther('0.4'), { account: aa.owner });
                await publicClient.waitForTransactionReceipt({ hash });
                console.log(`      ✅ Registered via SDK!`);
            } catch(e:any) { 
                console.log(`      ❌ Register Failed: ${e.message}`);
                continue;
            }

            // Verify again
            const isMemberNow = await registry(publicClient).hasRole({ user: aa.address, roleId: ROLE_ENDUSER_ID });
            if (isMemberNow) {
                 console.log(`      ✅ Verification Passed: ${aa.label} is ENDUSER`);
            } else {
                 console.log(`      ❌ Verification Failed: Role not granted`);
            }
        } else {
        }
    }


    // 5. Paymaster & Chainlink Setup
    console.log(`\n💳 5. Checking Paymaster Configuration...`);
    const pmStatus: any[] = [];
    const pmV4s = Object.values(communityMap).map(c => c.pmV4).filter(Boolean) as Address[];
    const superPM = config.contracts.superPaymaster;
    const epAddr = config.contracts.entryPoint;
    const regAddr = config.contracts.registry;

    // Ensure Anni has ETH (SuperPaymaster owner)
    const anniOp = operators.find(o => o.name.includes('Anni'));
    if (anniOp) {
        const balance = await publicClient.getBalance({ address: privateKeyToAccount(anniOp.key).address });
        if (balance < parseEther('0.5')) {
             console.log(`   ⛽ Funding ETH to Anni (SuperPM)...`);
             await checkAndFund(privateKeyToAccount(anniOp.key).address, '0.5');
        }
    }
    
    // Default to v0.7
    const ep = entryPointActions(epAddr, EntryPointVersion.V07);

    // Get Role IDs
    const ROLE_PAYMASTER_AOA = await registry(publicClient).ROLE_PAYMASTER_AOA();
    const ROLE_PAYMASTER_SUPER = await registry(publicClient).ROLE_PAYMASTER_SUPER();

    // Map PMs to their owners for stake check
    const pmToOwner = new Map<Address, { addr: Address, name: string }>();
    for (const op of operators) {
        const addr = privateKeyToAccount(op.key).address;
        if (communityMap[op.name]?.pmV4) {
            pmToOwner.set(communityMap[op.name].pmV4 as Address, { addr, name: op.name.split(' ')[0] });
        }
    }

    // All Paymasters to check in EntryPoint
    const allPMs = [
        ...pmV4s.map(addr => ({ addr, owner: pmToOwner.get(addr)?.addr, operatorName: pmToOwner.get(addr)?.name, type: 'V4', role: ROLE_PAYMASTER_AOA })),
        { addr: superPM, owner: privateKeyToAccount(operators.find(o => o.name.includes('Anni'))?.key!).address, operatorName: 'Anni', type: 'SuperPM', role: ROLE_PAYMASTER_SUPER }
    ];

    for (const pmInfo of allPMs) {
        const pm = pmInfo.addr;
        
        // 5a. EntryPoint Deposit Check - Use SDK Action
        const epBal = await ep(publicClient).balanceOf({ account: pm });
        
        const MIN_EP_DEPOSIT = parseEther('0.1');
        const REFILL_EP_AMOUNT = parseEther('0.2');

        if (epBal < MIN_EP_DEPOSIT) {
             console.log(`   💵 Refilling EntryPoint Deposit for ${pmInfo.type} at ${pm}...`);
             const hash = await ep(supplierClient).depositTo({ 
                 account: pm, 
                 amount: REFILL_EP_AMOUNT, 
                 txAccount: supplier 
             });
             await publicClient.waitForTransactionReceipt({ hash });
             console.log(`      ✅ Refilled to ${formatEther(REFILL_EP_AMOUNT)} ETH`);
        }

        // 5b. Stake Info from Registry (Query Operator's stake) - Use SDK Action
        let stakeVal = '0.00';
        if (pmInfo.owner) {
            try {
                const stake = await registry(publicClient).roleStakes({ 
                    roleId: pmInfo.role, 
                    user: pmInfo.owner 
                });
                stakeVal = parseFloat(formatEther(stake)).toFixed(2);
                
                // 5b-2. Paymaster EntryPoint Stake Check (Critical for Storage Access)
                // Use SDK getDepositInfo
                const depositInfo = await ep(publicClient).getDepositInfo({ account: pm });
                console.log(`      💰 Deposit: ${formatEther(depositInfo.deposit)} ETH | 🧱 Stake: ${formatEther(depositInfo.stake)} ETH (Staked: ${depositInfo.staked})`);

                if (depositInfo.stake < parseEther('0.1')) {
                    console.log(`   🧱 Staking 0.2 ETH for Paymaster ${pmInfo.operatorName} to allow storage access...`);
                    // Call addStake(uint32 unstakeDelaySec) payable
                    const ownerAcc = privateKeyToAccount(operators.find(o => o.name.includes(pmInfo.operatorName!))?.key!);
                    const ownerClient = createWalletClient({ account: ownerAcc, chain: config.chain, transport: http(config.rpcUrl) });
                    
                    try {
                        const h = await ownerClient.writeContract({
                            address: pm,
                            abi: [{name: 'addStake', type: 'function', inputs: [{type:'uint32'}], outputs: [], stateMutability: 'payable'}],
                            functionName: 'addStake',
                            args: [86400], // 1 day
                            value: parseEther('0.2')
                        });
                        console.log(`      ⏳ Stake Tx Sent: ${h}`);
                        await publicClient.waitForTransactionReceipt({hash:h});
                        console.log(`      ✅ Staked.`);
                    } catch(e:any) { console.log(`      ❌ Stake Failed: ${e.message}`); }
                }
            } catch(e) { }
        }

        // Special handling for SuperPM status display (we update it later with Internal Credit)
        if (pmInfo.type === 'V4') {
            pmStatus.push({
                Type: 'V4',
                Address: pm,
                EP_Deposit: parseFloat(formatEther(epBal < MIN_EP_DEPOSIT ? REFILL_EP_AMOUNT : epBal)).toFixed(4),
                Stake: stakeVal,
                Operator: pmInfo.operatorName
            });
        } else {
            // SuperPM basic info (will add Internal_Credit later)
            (pmInfo as any).epDeposit = parseFloat(formatEther(epBal < MIN_EP_DEPOSIT ? REFILL_EP_AMOUNT : epBal)).toFixed(4);
            (pmInfo as any).stake = stakeVal;
        }
    }

    // 5c. SuperPM Internal Credit (Anni's stake in SuperPM)
    const anniOpForCredit = operators.find(o => o.name.includes('Anni'));
    if (anniOpForCredit) {
        const anniAddr = privateKeyToAccount(anniOpForCredit.key).address;
        let internalBal = await superPaymasterActions(superPM)(publicClient).balanceOfOperator({ operator: anniAddr });
        
        if (internalBal < parseEther('50000')) {
            console.log(`   🔄 Refilling SuperPaymaster Credit for Anni...`);
            const globalAPNTs = config.contracts.aPNTs;
            const anniAcc = privateKeyToAccount(anniOpForCredit.key);
            const anniClient = createWalletClient({ account: anniAcc, chain: config.chain, transport: http(config.rpcUrl) });
            
            try {
                const anniApntsBal = await tokenActions()(publicClient).balanceOf({ token: globalAPNTs, account: anniAddr });
                const requiredForDeposit = parseEther('60000');
                if (anniApntsBal < requiredForDeposit) {
                    const mintAmount = requiredForDeposit - anniApntsBal;
                    const mintHash = await tokenActions()(supplierClient).mint({
                        token: globalAPNTs, to: anniAddr, amount: mintAmount, account: supplier
                    });
                    await publicClient.waitForTransactionReceipt({ hash: mintHash });
                }
                
                const currentAllowance = await tokenActions()(publicClient).allowance({ token: globalAPNTs, owner: anniAddr, spender: superPM });
                if (currentAllowance < parseEther('50000')) {
                    const approveHash = await tokenActions()(anniClient).approve({ token: globalAPNTs, spender: superPM, amount: parseEther('100000'), account: anniAcc });
                    await publicClient.waitForTransactionReceipt({ hash: approveHash });
                }
                
                const depositHash = await superPaymasterActions(superPM)(anniClient).depositAPNTs({ amount: parseEther('50000'), account: anniAcc });
                await publicClient.waitForTransactionReceipt({ hash: depositHash });
                
                internalBal = await superPaymasterActions(superPM)(publicClient).balanceOfOperator({ operator: anniAddr });
            } catch(e: any) {
                console.error(`      ❌ SuperPM Refill Failed: ${e.message}`);
            }
        }
        
        const superPMInfo = allPMs.find(p => p.type === 'SuperPM') as any;
        pmStatus.push({
            Type: 'SuperPM',
            Address: superPM,
            EP_Deposit: superPMInfo.epDeposit,
            Stake: superPMInfo.stake,
            Internal_Credit: parseFloat(formatEther(internalBal)).toFixed(2),
            Operator: 'Anni'
        });
    }

    printTable("Paymaster Status", pmStatus);

    // 6. UserOperation Generation Demo (5 Scenarios)
    console.log(`\n📦 6. Constructing 5 Different UserOperation Scenarios (v0.7)...`);
    
    const targetAA = testAccounts[0]; // Jason (AAStar)_AA1
    const jasonAcc = privateKeyToAccount(operators[0].key);
    
    // Scenarios setup
    const bobOp = operators.find(o => o.name.includes('Bob'));
    const bobEOA = bobOp ? privateKeyToAccount(bobOp.key).address : null;
    const bPNTsToken = communityMap['Bob (Bread)']?.token;
    const cPNTsToken = communityMap['Jason (AAStar)']?.token; // Assumption: using native community token as cPNTs for demo
    
    if (targetAA && bobEOA && bPNTsToken && cPNTsToken) {
        const scenarios = [
            { type: UserOpScenarioType.NATIVE, label: '1. Standard ERC-4337 (User pays ETH)' },
            { type: UserOpScenarioType.GASLESS_V4, label: '2. Gasless via PaymasterV4 (Jason Community)', paymaster: communityMap['Jason (AAStar)']?.pmV4 },
            { type: UserOpScenarioType.GASLESS_V4, label: '3. Gasless via PaymasterV4 (Bob Community)', paymaster: communityMap['Bob (Bread)']?.pmV4 },
            { type: UserOpScenarioType.SUPER_BPNT, label: '4. SuperPaymaster via bPNT (Internal Settlement)', paymaster: superPM, operator: jasonAcc.address, token: bPNTsToken },
            { type: UserOpScenarioType.SUPER_CPNT, label: '5. SuperPaymaster via cPNT (Internal Settlement)', paymaster: superPM, operator: jasonAcc.address, token: cPNTsToken }
        ];

        for (const scene of scenarios) {
            console.log(`\n--- ${scene.label} ---`);
            const { userOp, opHash } = await UserOpScenarioBuilder.buildTransferScenario(scene.type, {
                sender: targetAA.address,
                ownerAccount: jasonAcc,
                recipient: bobEOA,
                tokenAddress: bPNTsToken, // Transfer bPNTs in all cases
                amount: parseEther('2'),
                entryPoint: epAddr,
                chainId: config.chain.id,
                publicClient,
                paymaster: scene.paymaster,
                operator: scene.operator
            });
            
            console.log(`   UserOp Hash: ${opHash}`);
            console.log(`   Internal Payer Token: ${scene.token || 'N/A'}`);
            console.log(`   Paymaster: ${scene.paymaster || 'None'}`);
            console.log(`   Signature (First 32 bytes): ${userOp.signature.slice(0, 66)}...`);
        }

        console.log(`\n================================================================`);
        console.log(`📖 SDK UserOperation Construction Guide`);
        console.log(`================================================================`);
        console.log(`API: UserOpScenarioBuilder.buildTransferScenario(type, params)`);
        console.log(`Context: Transferring 2 bPNTs from Jason (AA1) to Bob (EOA)`);
        console.log(`\nAvailable Scenarios:`);
        console.log(`1. NATIVE       : Standard 4337, AA pays gas in ETH`);
        console.log(`2. GASLESS_V4   : Gasless via PaymasterV4 (Community sponsored)`);
        console.log(`3. SUPER_BPNT   : SuperPaymaster (Internal bPNT settlement)`);
        console.log(`4. SUPER_CPNT   : SuperPaymaster (Internal cPNT settlement)`);
        console.log(`5. SUPER_CUSTOM : SuperPaymaster (Custom operator/token)`);
        console.log(`\nUsage Example:`);
        console.log(`const { userOp } = await UserOpScenarioBuilder.buildTransferScenario(`);
        console.log(`    UserOpScenarioType.SUPER_BPNT, { ...params }`);
        console.log(`);`);
        console.log(`// userOp is now ready for eth_sendUserOperation (Hex-compliant)`);
        console.log(`================================================================`);
    }

    // 7. Save State
    console.log(`\n💾 Saving State to ${STATE_FILE}...`);
    const stateToSave = {
        network: config.name,
        timestamp: new Date().toISOString(),
        operators: {
            jason: {
                address: privateKeyToAccount(operators[0].key).address,
                tokenAddress: communityMap['Jason (AAStar)']?.token,
                paymasterV4: communityMap['Jason (AAStar)']?.pmV4
            },
            bob: {
                address: privateKeyToAccount(operators[1].key).address,
                tokenAddress: communityMap['Bob (Bread)']?.token,
                paymasterV4: communityMap['Bob (Bread)']?.pmV4
            },
            anni: {
                address: privateKeyToAccount(operators[2].key).address,
                tokenAddress: communityMap['Anni (Demo)']?.token,
                superPaymaster: superPM
            }
        },
        aaAccounts: testAccounts.map(aa => ({
            label: aa.label,
            address: aa.address,
            owner: aa.owner.address,
            salt: aa.salt.toString(), // Convert BigInt to string
            opName: aa.opName
        }))
    };
    // 6. Verify Paymaster Token Support & Funding
    console.log(`\n🪙 6. Verifying Paymaster Token Support & AA Funding...`);
    const pmAbi = parseAbi([
        'function getSupportedGasTokens() external view returns (address[])',
        'function priceStalenessThreshold() external view returns (uint256)'
    ]);
    const erc20MintAbi = parseAbi([
        'function mint(address to, uint256 amount) external',
        'function balanceOf(address) external view returns (uint256)',
        'function transfer(address to, uint256 amount) external returns (bool)'
    ]);

    for (const [name, data] of Object.entries(communityMap)) {
        if (!data.pmV4 || !data.aaAddr) continue;
        
        const pmContract = getContract({
            address: data.pmV4,
            abi: pmAbi,
            client: publicClient
        });
        
        try {
            const tokens = await pmContract.read.getSupportedGasTokens() as Address[];
            const staleness = await pmContract.read.priceStalenessThreshold().catch(() => 900n) as bigint;
            console.log(`   🏦 ${name} Paymaster (${trimAddress(data.pmV4)})`);
            console.log(`      - Staleness Threshold: ${staleness}s`);
            console.log(`      - Supported Tokens: ${tokens.map(t => trimAddress(t)).join(', ')}`);
            
            if (tokens.length > 0) {
                const token = tokens[0];
                const tokenContract = getContract({ address: token, abi: erc20MintAbi, client: publicClient });
                const balance = await tokenContract.read.balanceOf([data.aaAddr]) as bigint;
                
                console.log(`      👤 AA ${name} (${trimAddress(data.aaAddr)}) Balance: ${formatEther(balance)}`);
                
                if (balance < parseEther('10')) {
                    console.log(`      ⚠️ Low Balance! Funding...`);
                    // Try Mint first (if GToken or Test Token)
                    try {
                        const { request } = await publicClient.simulateContract({
                            account: walletClient.account,
                            address: token,
                            abi: erc20MintAbi,
                            functionName: 'mint',
                            args: [data.aaAddr, parseEther('100')]
                        });
                        const mintHash = await walletClient.writeContract(request);
                        await publicClient.waitForTransactionReceipt({ hash: mintHash });
                        console.log(`      ✅ Minted 100 Tokens to AA`);
                    } catch (e) {
                         // Fallback to Transfer
                         console.log(`      trying transfer...`);
                         try {
                             const { request } = await publicClient.simulateContract({
                                 account: walletClient.account,
                                 address: token,
                                 abi: erc20MintAbi,
                                 functionName: 'transfer',
                                 args: [data.aaAddr, parseEther('10')]
                             });
                             const txHash = await walletClient.writeContract(request);
                             await publicClient.waitForTransactionReceipt({ hash: txHash });
                             console.log(`      ✅ Transferred 10 Tokens to AA`);
                         } catch (err: any) {
                             console.log(`      ❌ Funding Failed: ${err.message}`);
                         }
                    }
                }
            }
        } catch (e: any) {
            console.log(`   ❌ Failed to verify PM ${name}: ${e.message}`);
        }
    }

    console.log(`   ✅ State Saved!`);
    fs.writeFileSync(STATE_FILE, JSON.stringify(stateToSave, null, 2));
    console.log(`\n✅ L4 Setup Verified Complete.\n`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});

