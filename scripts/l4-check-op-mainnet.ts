/**
 * l4-check-op-mainnet.ts
 * OP Mainnet Readiness Check & Price Refresh
 * 
 * Run this BEFORE l4-gasless-op-mainnet.ts
 * Usage: pnpm tsx scripts/l4-check-op-mainnet.ts --network op-mainnet
 */
import {
    type Address,
    parseEther, formatEther, decodeAbiParameters,
    createPublicClient,
    http, parseAbi, zeroAddress, keccak256, stringToBytes
} from 'viem';

import { loadNetworkConfig, type NetworkConfig } from '../tests/regression/config.js';
import {
    SuperPaymasterABI,
    RegistryABI,
    EntryPointABI,
    paymasterActions,
    superPaymasterActions
} from '../packages/core/src/index.js';


function ok(msg: string) { console.log(`   ✅ ${msg}`); }
function warn(msg: string) { console.log(`   ⚠️  ${msg}`); }
function fail(msg: string) { console.log(`   ❌ ${msg}`); }
function info(msg: string) { console.log(`   ℹ️  ${msg}`); }

// ── Roles ────────────────────────────────────────────────
const ROLE_COMMUNITY       = keccak256(stringToBytes("COMMUNITY"));
const ROLE_ENDUSER         = keccak256(stringToBytes("ENDUSER"));
const ROLE_PAYMASTER_SUPER = keccak256(stringToBytes("PAYMASTER_SUPER"));

// ── Main ─────────────────────────────────────────────────
async function runCheck(config: NetworkConfig) {
    const pub = createPublicClient({ chain: config.chain, transport: http(config.rpcUrl) });

    // Load EOA addresses from ENV (NO private keys needed for read-only checks!)
    const JASON_EOA = (process.env.JASON_EOA || '0x51Ac694981b6CEa06aA6c51751C227aac5F6b8A3') as Address;
    const ANNI_EOA  = (process.env.ANNI_EOA  || '0x08822612177e93a5B8dA59b45171638eb53D495a') as Address;

    const SP  = config.contracts.superPaymaster as Address;
    const REG = config.contracts.registry as Address;
    const GTOKEN = config.contracts.gToken as Address;
    const APNTS  = config.contracts.aPNTs as Address;
    const PM_FACTORY = config.contracts.paymasterFactory as Address;
    const EP = config.contracts.entryPoint as Address;
    const SIMPLE_FACTORY = config.contracts.simpleAccountFactory as Address;

    console.log('\n╔═══════════════════════════════════════════════════════╗');
    console.log('║  L4 OP Mainnet Readiness Check                       ║');
    console.log('╚═══════════════════════════════════════════════════════╝');

    // ── 1. EOA Addresses ─────────────────────────────────
    console.log('\n📋 1. EOA Addresses');
    ok(`Jason EOA: ${JASON_EOA}`);
    ok(`Anni  EOA: ${ANNI_EOA}`);

    const jasonETH = await pub.getBalance({ address: JASON_EOA });
    const anniETH  = await pub.getBalance({ address: ANNI_EOA });
    info(`Jason ETH: ${formatEther(jasonETH)}`);
    info(`Anni  ETH: ${formatEther(anniETH)}`);

    // ── 2. AA Addresses (derived from SimpleAccountFactory, no keys needed) ─
    console.log('\n📋 2. Smart Accounts (AA)');
    const saFactoryAbi = parseAbi(['function getAddress(address,uint256) view returns (address)']);
    const jasonAA = await pub.readContract({
        address: SIMPLE_FACTORY, abi: saFactoryAbi, functionName: 'getAddress', args: [JASON_EOA, 0n]
    }) as Address;
    const anniAA = await pub.readContract({
        address: SIMPLE_FACTORY, abi: saFactoryAbi, functionName: 'getAddress', args: [ANNI_EOA, 0n]
    }) as Address;

    const jasonAACode = await pub.getCode({ address: jasonAA });
    const anniAACode  = await pub.getCode({ address: anniAA });

    if (jasonAACode && jasonAACode.length > 2) ok(`Jason AA: ${jasonAA} (Deployed ✓)`);
    else fail(`Jason AA: ${jasonAA} (NOT deployed)`);
    if (anniAACode && anniAACode.length > 2) ok(`Anni  AA: ${anniAA} (Deployed ✓)`);
    else fail(`Anni  AA: ${anniAA} (NOT deployed)`);

    // ── 3. Core Contract Addresses ───────────────────────
    console.log('\n📋 3. Core Contracts (from SDK config)');
    ok(`SuperPaymaster:    ${SP}`);
    ok(`Registry:          ${REG}`);
    ok(`EntryPoint:        ${EP}`);
    ok(`PaymasterFactory:  ${PM_FACTORY}`);
    ok(`GToken:            ${GTOKEN}`);
    ok(`aPNTs:             ${APNTS}`);
    ok(`xPNTsFactory:      ${config.contracts.xPNTsFactory || 'N/A'}`);
    // Default PaymasterV4 = AAStar Community PM (Jason)
    const defaultPMV4 = (config.contracts as any).paymasterV4 as Address | undefined;
    if (defaultPMV4) {
        ok(`PaymasterV4 (AAStar Default): ${defaultPMV4}`);
    } else {
        warn('PaymasterV4 not set in SDK config — will discover from PaymasterFactory');
    }

    // ── 4. Jason's Paymaster V4 Proxy ────────────────────
    console.log('\n📋 4. Jason Paymaster V4 Proxy');
    let jasonPM = zeroAddress as Address;
    try {
        jasonPM = await pub.readContract({
            address: PM_FACTORY,
            abi: parseAbi(['function getPaymasterByOperator(address) view returns (address)']),
            functionName: 'getPaymasterByOperator',
            args: [JASON_EOA]
        }) as Address;
    } catch {}
    if (jasonPM !== zeroAddress) {
        ok(`Jason PM Proxy: ${jasonPM}`);
        // Check owner
        try {
            const owner = await pub.readContract({ address: jasonPM, abi: parseAbi(['function owner() view returns (address)']), functionName: 'owner' });
            info(`Owner: ${owner}`);
        } catch {}
        // Token price for aPNTs
        try {
            const price = await pub.readContract({ address: jasonPM, abi: parseAbi(['function tokenPrices(address) view returns (uint256)']), functionName: 'tokenPrices', args: [APNTS] }) as bigint;
            if (price > 0n) ok(`aPNTs price: ${price}`);
            else warn(`aPNTs NOT activated (price=0)`);
        } catch {}
        // EntryPoint deposit
        try {
            const dep = await pub.readContract({ address: EP, abi: parseAbi(['function balanceOf(address) view returns (uint256)']), functionName: 'balanceOf', args: [jasonPM] }) as bigint;
            info(`EP Deposit: ${formatEther(dep)} ETH`);
            if (dep < parseEther('0.01')) warn('EP deposit low!');
        } catch {}
    } else {
        fail('Jason has NO deployed PaymasterV4 Proxy');
    }

    // ── 5. SuperPaymaster Operator (Anni) ───────────────
    console.log('\n📋 5. SuperPaymaster Operator');
    try {
        const opData = await pub.readContract({ address: SP, abi: SuperPaymasterABI, functionName: 'operators', args: [ANNI_EOA] }) as any;
        const aPNTsBal    = BigInt(opData[0] || 0);
        const exchangeRate = BigInt(opData[1] || 0);
        const isConfigured = Boolean(opData[2]);
        const isPaused     = Boolean(opData[3]);
        const xPNTsToken   = (opData[4] || zeroAddress) as Address;

        if (isConfigured) {
            ok(`Anni EOA is CONFIGURED as Operator`);
            info(`aPNTs Balance:  ${formatEther(aPNTsBal)}`);
            info(`Exchange Rate:  ${exchangeRate}`);
            info(`xPNTs Token:    ${xPNTsToken}`);
            info(`Paused:         ${isPaused}`);
            // Check xPNTs token name
            if (xPNTsToken !== zeroAddress) {
                try {
                    const name = await pub.readContract({ address: xPNTsToken, abi: parseAbi(['function name() view returns (string)']), functionName: 'name' });
                    info(`Token Name:     ${name}`);
                } catch {}
                // Check token price in Jason PM
                if (jasonPM !== zeroAddress) {
                    const price = await pub.readContract({ address: jasonPM, abi: parseAbi(['function tokenPrices(address) view returns (uint256)']), functionName: 'tokenPrices', args: [xPNTsToken] }) as bigint;
                    if (price > 0n) ok(`xPNTs activated in Jason PM (price=${price})`);
                    else warn(`xPNTs NOT activated in Jason PM`);
                }
            }
        } else {
            fail(`Anni EOA is NOT configured as Operator`);
        }
    } catch (e: any) {
        fail(`Cannot read operator: ${e.message}`);
    }

    // SP EntryPoint deposit
    try {
        const spDep = await pub.readContract({ address: EP, abi: parseAbi(['function balanceOf(address) view returns (uint256)']), functionName: 'balanceOf', args: [SP] }) as bigint;
        info(`SP EP Deposit: ${formatEther(spDep)} ETH`);
        if (spDep < parseEther('0.01')) warn('SP EP deposit low!');
    } catch {}

    // ── 6. Community List from Registry ─────────────────
    console.log('\n📋 6. Registered Communities');
    try {
        const communityMembers = await pub.readContract({
            address: REG,
            abi: parseAbi(['function getRoleMembers(bytes32) view returns (address[])']),
            functionName: 'getRoleMembers',
            args: [ROLE_COMMUNITY]
        }) as Address[];
        info(`Total communities: ${communityMembers.length}`);

        for (const member of communityMembers) {
            try {
                const metadata = await pub.readContract({
                    address: REG,
                    abi: parseAbi(['function roleMetadata(bytes32, address) view returns (bytes)']),
                    functionName: 'roleMetadata',
                    args: [ROLE_COMMUNITY, member]
                }) as `0x${string}`;

                if (metadata && metadata.length > 2) {
                    const decoded = decodeAbiParameters(
                        [{ name: 'data', type: 'tuple', components: [
                            { name: 'name', type: 'string' },
                            { name: 'ensName', type: 'string' },
                            { name: 'website', type: 'string' },
                            { name: 'description', type: 'string' },
                            { name: 'logoURI', type: 'string' },
                            { name: 'stakeAmount', type: 'uint256' }
                        ]}],
                        metadata
                    );
                    const d = decoded[0] as any;
                    console.log(`   ┌─ Community: ${d.name}`);
                    console.log(`   │  Operator:  ${member}`);
                    console.log(`   │  ENS:       ${d.ensName || '(none)'}`);
                    console.log(`   │  Website:   ${d.website || '(none)'}`);
                    console.log(`   │  Desc:      ${d.description || '(none)'}`);
                    console.log(`   │  Logo:      ${d.logoURI || '(none)'}`);
                    console.log(`   │  Stake:     ${formatEther(d.stakeAmount)} GToken`);

                    // Check xPNTs token via factory
                    try {
                        const tok = await pub.readContract({
                            address: config.contracts.xPNTsFactory as Address,
                            abi: parseAbi(['function getTokenAddress(address) view returns (address)']),
                            functionName: 'getTokenAddress',
                            args: [member]
                        }) as Address;
                        if (tok !== zeroAddress) {
                            const tokName = await pub.readContract({ address: tok, abi: parseAbi(['function name() view returns (string)']), functionName: 'name' }).catch(() => '?');
                            const tokSupply = await pub.readContract({ address: tok, abi: parseAbi(['function totalSupply() view returns (uint256)']), functionName: 'totalSupply' }).catch(() => 0n) as bigint;
                            console.log(`   │  Token:     ${tokName} (${tok})`);
                            console.log(`   └  Supply:    ${formatEther(tokSupply)}`);
                        } else {
                            console.log(`   └  Token:     (none)`);
                        }
                    } catch {
                        console.log(`   └  Token:     (lookup failed)`);
                    }
                } else {
                    console.log(`   ┌─ Community: ${member}`);
                    console.log(`   └  (no metadata)`);
                }
            } catch (e: any) {
                console.log(`   ─ ${member}: metadata decode failed`);
            }
        }
    } catch (e: any) {
        warn(`Cannot read community list: ${e.message}`);
    }

    // ── 7. Role Assignments ─────────────────────────────
    console.log('\n📋 7. Role Assignments');
    const roleChecks = [
        { label: 'Jason EOA → COMMUNITY',        addr: JASON_EOA,  role: ROLE_COMMUNITY },
        { label: 'Anni EOA  → COMMUNITY',        addr: ANNI_EOA,   role: ROLE_COMMUNITY },
        { label: 'Jason AA  → ENDUSER',           addr: jasonAA,    role: ROLE_ENDUSER },
        { label: 'Anni AA   → ENDUSER',           addr: anniAA,     role: ROLE_ENDUSER },

        { label: 'Anni EOA  → PAYMASTER_SUPER',  addr: ANNI_EOA,   role: ROLE_PAYMASTER_SUPER },
        { label: 'Jason EOA → PAYMASTER_SUPER',  addr: JASON_EOA,  role: ROLE_PAYMASTER_SUPER },
    ];
    for (const c of roleChecks) {
        try {
            const has = await pub.readContract({ address: REG, abi: RegistryABI, functionName: 'hasRole', args: [c.role, c.addr] });
            if (has) ok(c.label);
            else fail(c.label);
        } catch { fail(`${c.label} (call failed)`); }
    }

    // ── 8. SBT status in SuperPaymaster ─────────────────
    console.log('\n📋 8. SBT Holder Status in SuperPaymaster');
    for (const [label, addr] of [['Jason AA', jasonAA], ['Anni AA', anniAA], ['Jason EOA', JASON_EOA], ['Anni EOA', ANNI_EOA]]) {
        try {
            const has = await pub.readContract({ address: SP, abi: SuperPaymasterABI, functionName: 'sbtHolders', args: [addr as Address] });
            if (has) ok(`${label}: SBT ✓`);
            else fail(`${label}: NO SBT`);
        } catch { info(`${label}: sbtHolders call failed`); }
    }

    // ── 9. Token Balances ───────────────────────────────
    console.log('\n📋 9. Token Balances');
    const tokenAbi = parseAbi(['function balanceOf(address) view returns (uint256)', 'function name() view returns (string)']);
    const tokens = [
        { label: 'aPNTs', addr: APNTS },
        { label: 'GToken', addr: GTOKEN },
    ];
    const wallets = [
        { label: 'Jason EOA', addr: JASON_EOA },
        { label: 'Anni EOA',  addr: ANNI_EOA },
        { label: 'Jason AA',  addr: jasonAA },
        { label: 'Anni AA',   addr: anniAA },
    ];
    for (const t of tokens) {
        console.log(`   --- ${t.label} (${t.addr}) ---`);
        for (const w of wallets) {
            try {
                const bal = await pub.readContract({ address: t.addr, abi: tokenAbi, functionName: 'balanceOf', args: [w.addr] }) as bigint;
                info(`${w.label}: ${formatEther(bal)}`);
            } catch {}
        }
    }

    // ── 10. Cached Price (ETH/USD) ────────────────────────
    console.log('\n📋 10. Cached Price (ETH/USD)');
    const now = BigInt(Math.floor(Date.now() / 1000));

    // Read SP priceStalenessThreshold
    let spThreshold = 3600n;
    try {
        spThreshold = await pub.readContract({ address: SP, abi: parseAbi(['function priceStalenessThreshold() view returns (uint256)']), functionName: 'priceStalenessThreshold' }) as bigint;
        info(`SP staleness threshold: ${spThreshold}s`);
    } catch {}

    // SuperPaymaster cachedPrice
    let spNeedRefresh = false;
    try {
        const spCache = await pub.readContract({ address: SP, abi: SuperPaymasterABI, functionName: 'cachedPrice' }) as any;
        const price = BigInt(spCache[0] || spCache.price || 0);
        const ts    = BigInt(spCache[1] || spCache.updatedAt || 0);
        const age   = ts > 0n ? now - ts : 0n;
        info(`SP cachedPrice: ${price}  ts: ${ts}  age: ${age}s`);
        if (ts === 0n || age > spThreshold) {
            warn(`SP price STALE (${age}s > threshold ${spThreshold}s)`);
            spNeedRefresh = true;
        } else {
            ok(`SP price FRESH (${age}s < ${spThreshold}s)`);
        }
    } catch (e: any) {
        warn(`SP cachedPrice read failed: ${e.message}`);
    }

    // Jason PM cachedPrice  
    let pmThreshold = 86400n;
    let pmNeedRefresh = false;
    if (jasonPM !== zeroAddress) {
        try {
            pmThreshold = await pub.readContract({ address: jasonPM, abi: parseAbi(['function priceStalenessThreshold() view returns (uint256)']), functionName: 'priceStalenessThreshold' }) as bigint;
            info(`PM staleness threshold: ${pmThreshold}s`);
        } catch {}
        try {
            const pmCache = await pub.readContract({ address: jasonPM, abi: parseAbi(['function cachedPrice() view returns (uint208, uint48)']), functionName: 'cachedPrice' }) as any;
            const price = BigInt(pmCache[0] || 0);
            const ts    = BigInt(pmCache[1] || 0);
            const age   = ts > 0n ? now - ts : 0n;
            info(`PM cachedPrice: ${price}  ts: ${ts}  age: ${age}s`);
            if (ts === 0n || age > pmThreshold) {
                warn(`PM price STALE (${age}s > threshold ${pmThreshold}s)`);
                pmNeedRefresh = true;
            } else {
                ok(`PM price FRESH (${age}s < ${pmThreshold}s)`);
            }
        } catch (e: any) {
            warn(`PM cachedPrice read failed: ${e.message}`);
        }
    }

    // Price refresh guidance (read-only check — no wallet needed)
    if (spNeedRefresh || pmNeedRefresh) {
        console.log('\n🔄 Stale prices detected. To refresh, run:');
        console.log('   forge script contracts/script/v3/L4SetupOpMainnet.s.sol --rpc-url $RPC_URL --account optimism-deployer --broadcast');
    } else {
        ok('All prices are fresh, no update needed.');
    }

    // ── 11. Chainlink Price Feed ─────────────────────────
    console.log('\n📋 11. Chainlink ETH/USD Feed');
    try {
        const feed = config.contracts.priceFeed as Address;
        const data = await pub.readContract({
            address: feed,
            abi: parseAbi(['function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)']),
            functionName: 'latestRoundData'
        }) as any;
        const ethPrice = Number(data[1]) / 1e8;
        const updatedAt = Number(data[3]);
        const feedAge = Math.floor(Date.now() / 1000) - updatedAt;
        ok(`ETH/USD: $${ethPrice.toFixed(2)}  (${feedAge}s ago)`);
    } catch (e: any) {
        warn(`Chainlink read failed: ${e.message}`);
    }

    console.log('\n╔═══════════════════════════════════════════════════════╗');
    console.log('║  Check Complete                                       ║');
    console.log('╚═══════════════════════════════════════════════════════╝\n');
}

// ── Entry ────────────────────────────────────────────────
const args = process.argv.slice(2);
let network = 'op-mainnet';
const networkArg = args.find(a => a.startsWith('--network'));
if (networkArg) network = networkArg.includes('=') ? networkArg.split('=')[1] : args[args.indexOf('--network') + 1];

const config = loadNetworkConfig(network);
runCheck(config).catch(console.error);
