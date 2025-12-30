import { createPublicClient, http, parseAbi, formatEther, getContract, Address, zeroAddress } from 'viem';
import { foundry } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.v3 explicitly
dotenv.config({ path: path.resolve(__dirname, '../../env/.env.v3') });

const rpcUrl = process.env.SEPOLIA_RPC_URL;
if (!rpcUrl) throw new Error("SEPOLIA_RPC_URL missing");

const client = createPublicClient({
  chain: foundry,
  transport: http(rpcUrl),
});

// Addresses from Env
const ADDR = {
    REGISTRY: process.env.REGISTRY_ADDRESS as Address,
    GTOKEN: process.env.GTOKEN_ADDRESS as Address,
    STAKING: process.env.GTOKEN_STAKING_ADDRESS as Address,
    MYSBT: process.env.MYSBT_ADDRESS as Address,
    SUPER_PAYMASTER: process.env.SUPER_PAYMASTER_ADDRESS as Address,
    PAYMASTER_FACTORY: process.env.PAYMASTER_FACTORY_ADDRESS as Address,
    PAYMASTER_V4: process.env.PAYMASTER_V4_ADDRESS as Address,
    APNTS: process.env.APNTS_ADDRESS as Address,
    BPNTS: process.env.BPNTS_ADDRESS as Address,
    JASON: "0xb5600060e6de5E11D3636731964218E53caadf0E" as Address,
    ANNI: "0xEcAACb915f7D92e9916f449F7ad42BD0408733c9" as Address,
};

// Simplified ABIs
const ABI = {
    REGISTRY: parseAbi([
        'function hasRole(bytes32 role, address account) view returns (bool)',
        'function getRoleMemberCount(bytes32 role) view returns (uint256)',
    ]),
    STAKING: parseAbi([
        'function getLockedStake(address account, bytes32 roleId) view returns (uint256)',
        'function BURN_ADDRESS() view returns (address)',
    ]),
    TOKEN: parseAbi([
        'function balanceOf(address) view returns (uint256)',
        'function symbol() view returns (string)',
    ]),
    SBT: parseAbi([
        'function balanceOf(address) view returns (uint256)',
        'function REGISTRY() view returns (address)',
    ]),
    SUPER_PAYMASTER: parseAbi([
        'function operators(address) view returns (address token, address treasury, uint256 exchangeRate)',
    ]),
    PAYMASTER_V4: parseAbi([
        'function owner() view returns (address)',
        'function version() view returns (string)',
    ]),
};

const ROLE_COMMUNITY = '0x1041415374617220436f6d6d756e697479000000000000000000000000000000'; // keccak256("COMMUNITY")? Wait, checking script...
// Wait, the role in script was: keccak256("COMMUNITY")
// Let's re-calculate it to be sure.
import { keccak256, toBytes } from 'viem';
const ROLE_COMMUNITY_HASH = keccak256(toBytes('COMMUNITY'));

async function main() {
    console.log("🔍 Verifying SuperPaymaster Phase 1 Deployment...\n");

    const report: string[] = [];
    report.push("| Contract / Actor | Address | Config / Value | Status |");
    report.push("|---|---|---|---|");

    // 1. Verify Registry & Roles
    try {
        const registry = getContract({ address: ADDR.REGISTRY, abi: ABI.REGISTRY, client });
        const hasRoleAnni = await registry.read.hasRole([ROLE_COMMUNITY_HASH, ADDR.ANNI]);
        report.push(`| **Registry V3** | \`${ADDR.REGISTRY}\` | Anni is Community | ${hasRoleAnni ? '✅' : '❌'} |`);
    } catch (e) { report.push(`| **Registry V3** | \`${ADDR.REGISTRY}\` | Error | ❌ ${e} |`); }

    // 2. Verify Staking & Burn
    try {
        const staking = getContract({ address: ADDR.STAKING, abi: ABI.STAKING, client });
        const locked = await staking.read.getLockedStake([ADDR.ANNI, ROLE_COMMUNITY_HASH]);
        const gToken = getContract({ address: ADDR.GTOKEN, abi: ABI.TOKEN, client });
        const burnBal = await gToken.read.balanceOf(['0x000000000000000000000000000000000000dEaD']);
        report.push(`| **GTokenStaking** | \`${ADDR.STAKING}\` | Anni Locked: ${formatEther(locked)} GT | ${locked > 0n ? '✅' : '❌'} |`);
        report.push(`| **Burn Address** | \`...dEaD\` | Burned Total: ${formatEther(burnBal)} GT | ${burnBal > 0n ? '✅' : '⚠️'} |`);
    } catch (e) { report.push(`| **Staking** | \`${ADDR.STAKING}\` | Error | ❌ |`); }

    // 3. Verify SuperPaymaster & Operator
    try {
        const sp = getContract({ address: ADDR.SUPER_PAYMASTER, abi: ABI.SUPER_PAYMASTER, client });
        const [token, treasury] = await sp.read.operators([ADDR.ANNI]);
        // Note: Anni (BreadCommunity) configured herself as operator in 11.1
        const isConfigured = token === ADDR.BPNTS;
        report.push(`| **SuperPaymaster** | \`${ADDR.SUPER_PAYMASTER}\` | Op(Anni) -> Token: \`${token.slice(0,6)}...\` | ${isConfigured ? '✅' : '❌'} |`);
    } catch (e) { report.push(`| **SuperPaymaster** | \`${ADDR.SUPER_PAYMASTER}\` | Error | ❌ |`); }

    // 4. Verify Identity (SBT)
    try {
        const sbt = getContract({ address: ADDR.MYSBT, abi: ABI.SBT, client });
        const regPtr = await sbt.read.REGISTRY();
        const isLinked = regPtr.toLowerCase() === ADDR.REGISTRY.toLowerCase();
        report.push(`| **MySBT** | \`${ADDR.MYSBT}\` | Linked to Registry | ${isLinked ? '✅' : '❌'} |`);
    } catch (e) { report.push(`| **MySBT** | \`${ADDR.MYSBT}\` | Error | ❌ |`); }

    // 5. Verify Paymaster V4
    try {
        const v4 = getContract({ address: ADDR.PAYMASTER_V4, abi: ABI.PAYMASTER_V4, client });
        const owner = await v4.read.owner();
        const ver = await v4.read.version();
        const isAnni = owner.toLowerCase() === ADDR.ANNI.toLowerCase();
        report.push(`| **Paymaster V4** | \`${ADDR.PAYMASTER_V4}\` | Owner: Anni, Ver: ${ver} | ${isAnni ? '✅' : '❌'} |`);
    } catch (e) { report.push(`| **Paymaster V4** | \`${ADDR.PAYMASTER_V4}\` | Error | ❌ |`); }

    // 6. Token Supplies
    try {
        const apnts = getContract({ address: ADDR.APNTS, abi: ABI.TOKEN, client });
        const bpnts = getContract({ address: ADDR.BPNTS, abi: ABI.TOKEN, client });
        const balA = await apnts.read.balanceOf([ADDR.JASON]);
        const balB = await bpnts.read.balanceOf([ADDR.ANNI]); // Assuming Anni minted some? Or Factory?
        // Wait, Deploy06_1 only deployed, did it mint?
        // V4 factory usually doesn't mint. Let's check.
        // If 0, it's fine, just reporting.
        report.push(`| **bPNTs (Anni)** | \`${ADDR.BPNTS}\` | Anni Bal: ${formatEther(balB)} | ℹ️ |`);
    } catch (e) { report.push(`| **Tokens** | Error | ❌ |`); }

    console.log(report.join("\n"));
}

main().catch(console.error);
