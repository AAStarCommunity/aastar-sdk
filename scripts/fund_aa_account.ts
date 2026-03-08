/**
 * fund_aa_account.ts — Fund a target AA account on Optimism Mainnet
 *
 * Sends to a specified address:
 *   1. GToken  (governance token)
 *   2. SBT     (via Registry.safeMintForRole, skipped if already held)
 *   3. aPNTs   (test apoints)
 *
 * Uses cast wallet for signing — private key NEVER enters Node.js.
 * Pattern mirrors keeper.ts: password → tmpfile → cast send --account --password-file.
 *
 * Usage:
 *   pnpm tsx scripts/fund_aa_account.ts
 *   pnpm tsx scripts/fund_aa_account.ts --target=0xABCD...
 *   pnpm tsx scripts/fund_aa_account.ts --target=0xABCD... --gtoken=500 --apnts=200
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import {
    createPublicClient,
    http,
    parseEther,
    formatEther,
    parseAbi,
    encodeFunctionData,
    encodeAbiParameters,
    keccak256,
    toBytes,
    type Address,
    type Hex,
} from 'viem';
import { optimism } from 'viem/chains';
import * as dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env.op-mainnet') });

// ─────────────────────────────────────────────────────────────────────────────
// CLI args
// ─────────────────────────────────────────────────────────────────────────────
function arg(name: string): string | undefined {
    return process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1];
}

const TARGET_ADDRESS = (arg('target') || '0x177b619aDCC550C00fFCd721C08e632db2EaC3d3') as Address;
const GTOKEN_AMOUNT  = parseEther(arg('gtoken') || '100');
const APNTS_AMOUNT   = parseEther(arg('apnts')  || '100');

// ─────────────────────────────────────────────────────────────────────────────
// Contract addresses (from config.op-mainnet.json)
// ─────────────────────────────────────────────────────────────────────────────
const CONTRACTS = {
    GTOKEN:   '0x8d6Fe002dDacCcFBD377F684EC1825f2E1ab7ef6' as Address,
    APNTS:    '0x0B41C78081B5A141eb4C3C7E7FD8E58A7Bde553B' as Address,
    SBT:      '0x28eBFc5fc03B1d7648254AbF1C7B39DbFdef1a94' as Address,
    REGISTRY: '0x997686219F31405503D32728B1f094F115EF24e7' as Address,
};

// ─────────────────────────────────────────────────────────────────────────────
// ABIs (read-only + calldata encoding only — no signing in viem)
// ─────────────────────────────────────────────────────────────────────────────
const ERC20_ABI = parseAbi([
    'function balanceOf(address) view returns (uint256)',
    'function mint(address to, uint256 amount)',
    'function transfer(address to, uint256 amount) returns (bool)',
]);

const SBT_ABI = parseAbi([
    'function balanceOf(address owner) view returns (uint256)',
    'function mint(address to)',
]);

const REGISTRY_ABI = parseAbi([
    'function ROLE_ENDUSER() view returns (bytes32)',
    'function hasRole(bytes32 roleId, address user) view returns (bool)',
    'function safeMintForRole(bytes32 roleId, address user, bytes calldata data) external returns (uint256)',
]);

// ─────────────────────────────────────────────────────────────────────────────
// Password prompt (hidden input, mirrors keeper.ts promptHidden)
// ─────────────────────────────────────────────────────────────────────────────
async function promptHidden(prompt: string): Promise<string> {
    process.stdout.write(prompt);
    return new Promise((resolve) => {
        let input = '';
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.setEncoding('utf8');
        const handler = (key: string) => {
            if (key === '\r' || key === '\n' || key === '\u0004') {
                process.stdin.removeListener('data', handler);
                process.stdin.setRawMode(false);
                process.stdin.pause();
                process.stdout.write('\n');
                resolve(input);
            } else if (key === '\u0003') {  // Ctrl-C
                process.stdout.write('\n');
                process.exit(1);
            } else if (key === '\u007f') {  // Backspace
                input = input.slice(0, -1);
            } else {
                input += key;
            }
        };
        process.stdin.on('data', handler);
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// cast send — private key stays inside cast, never in Node.js
// ─────────────────────────────────────────────────────────────────────────────
function castSend(params: {
    rpcUrl: string;
    accountName: string;
    passwordFile: string;
    target: Address;
    calldata: Hex;
}): Hex {
    const result = spawnSync('cast', [
        'send',
        '--rpc-url', params.rpcUrl,
        '--account', params.accountName,
        '--password-file', params.passwordFile,
        params.target,
        params.calldata,
    ], { encoding: 'utf8' });

    if (result.error) throw new Error(`cast spawn error: ${result.error.message}`);
    if (result.status !== 0) throw new Error(`cast send failed:\n${result.stderr}`);

    // cast send output contains the tx hash on a line starting with "transactionHash"
    const match = result.stdout.match(/transactionHash\s+(0x[0-9a-fA-F]{64})/);
    if (!match) throw new Error(`Could not parse tx hash from cast output:\n${result.stdout}`);
    return match[1] as Hex;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
    console.log(`\n🚀 AAStar AA Account Funder`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📍 Target:  ${TARGET_ADDRESS}`);
    console.log(`📡 Network: Optimism Mainnet`);
    console.log(`   GToken:  ${formatEther(GTOKEN_AMOUNT)}`);
    console.log(`   aPNTs:   ${formatEther(APNTS_AMOUNT)}`);

    const rpcUrl        = process.env.RPC_URL || process.env.OPTIMISM_RPC_URL!;
    const accountName   = process.env.DEPLOYER_ACCOUNT || 'optimism-deployer';
    const publicClient  = createPublicClient({ chain: optimism, transport: http(rpcUrl) });

    // ── Step 0: password → tmpfile (mirrors keeper.ts) ───────────────────────
    const password = process.env.CAST_KEYSTORE_PASSWORD || await promptHidden(`\n🔑 Keystore password for [${accountName}]: `);
    const tmpDir   = fs.mkdtempSync(path.join(os.tmpdir(), 'aastar-fund-'));
    const pwFile   = path.join(tmpDir, 'pw');
    fs.writeFileSync(pwFile, password, { mode: 0o600 });

    const cleanup = () => { try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {} };
    process.on('exit', cleanup);
    process.on('SIGINT', () => { cleanup(); process.exit(1); });

    const send = (target: Address, calldata: Hex): Hex =>
        castSend({ rpcUrl, accountName, passwordFile: pwFile, target, calldata });

    try {
        // ── Step 1: GToken ──────────────────────────────────────────────────
        console.log(`\n📋 Step 1: GToken (governance token)`);
        const gBefore = await publicClient.readContract({ address: CONTRACTS.GTOKEN, abi: ERC20_ABI, functionName: 'balanceOf', args: [TARGET_ADDRESS] });
        console.log(`   Current balance: ${formatEther(gBefore)} GToken`);

        if (gBefore >= parseEther('150')) {
            console.log(`   ✅ Balance ≥ 150, skipping.`);
        } else {
            let gHash: Hex;
            try {
                gHash = send(CONTRACTS.GTOKEN, encodeFunctionData({ abi: ERC20_ABI, functionName: 'mint', args: [TARGET_ADDRESS, GTOKEN_AMOUNT] }));
            } catch {
                console.log(`   ℹ️  mint() unavailable, trying transfer()`);
                gHash = send(CONTRACTS.GTOKEN, encodeFunctionData({ abi: ERC20_ABI, functionName: 'transfer', args: [TARGET_ADDRESS, GTOKEN_AMOUNT] }));
            }
            await publicClient.waitForTransactionReceipt({ hash: gHash });
            const gAfter = await publicClient.readContract({ address: CONTRACTS.GTOKEN, abi: ERC20_ABI, functionName: 'balanceOf', args: [TARGET_ADDRESS] });
            console.log(`   ✅ tx: ${gHash}  new balance: ${formatEther(gAfter)} GToken`);
        }

        // ── Step 2: SBT ──────────────────────────────────────────────────────
        console.log(`\n📋 Step 2: SBT (role registration)`);
        const sbtBal = await publicClient.readContract({ address: CONTRACTS.SBT, abi: SBT_ABI, functionName: 'balanceOf', args: [TARGET_ADDRESS] });

        if (sbtBal > 0n) {
            console.log(`   ✅ Already holds SBT. Skipping.`);
        } else {
            let alreadyRegistered = false;
            try {
                const roleId = await publicClient.readContract({ address: CONTRACTS.REGISTRY, abi: REGISTRY_ABI, functionName: 'ROLE_ENDUSER' });
                alreadyRegistered = await publicClient.readContract({ address: CONTRACTS.REGISTRY, abi: REGISTRY_ABI, functionName: 'hasRole', args: [roleId, TARGET_ADDRESS] });
            } catch { /* ignore */ }

            if (alreadyRegistered) {
                console.log(`   ✅ Already registered in Registry. Skipping.`);
            } else {
                let regOk = false;
                try {
                    const deployerAddress = (process.env.DEPLOYER_ADDRESS || '0x51Ac694981b6CEa06aA6c51751C227aac5F6b8A3') as Address;
                    const roleId  = keccak256(toBytes('ENDUSER'));
                    const roleData = encodeAbiParameters(
                        [{ type: 'tuple', components: [
                            { type: 'address', name: 'account' },
                            { type: 'address', name: 'community' },
                            { type: 'string',  name: 'avatar' },
                            { type: 'string',  name: 'ens' },
                            { type: 'uint256', name: 'stake' },
                        ]}],
                        [[ TARGET_ADDRESS, deployerAddress, '', '', parseEther('0.3') ]],
                    );
                    const calldata = encodeFunctionData({ abi: REGISTRY_ABI, functionName: 'safeMintForRole', args: [roleId, TARGET_ADDRESS, roleData] });
                    const hash = send(CONTRACTS.REGISTRY, calldata);
                    await publicClient.waitForTransactionReceipt({ hash });
                    console.log(`   ✅ Role registered  tx: ${hash}`);
                    regOk = true;
                } catch (e: any) {
                    console.log(`   ⚠️  safeMintForRole() failed: ${e.message?.split('\n')[0]}`);
                }

                if (!regOk) {
                    console.log(`   ↩️  Trying MySBT.mint()...`);
                    try {
                        const hash = send(CONTRACTS.SBT, encodeFunctionData({ abi: SBT_ABI, functionName: 'mint', args: [TARGET_ADDRESS] }));
                        await publicClient.waitForTransactionReceipt({ hash });
                        console.log(`   ✅ SBT minted  tx: ${hash}`);
                    } catch (e: any) {
                        console.log(`   ❌ MySBT.mint() failed: ${e.message?.split('\n')[0]}`);
                    }
                }
            }
        }

        // ── Step 3: aPNTs ────────────────────────────────────────────────────
        console.log(`\n📋 Step 3: aPNTs (apoints)`);
        const aBefore = await publicClient.readContract({ address: CONTRACTS.APNTS, abi: ERC20_ABI, functionName: 'balanceOf', args: [TARGET_ADDRESS] });
        console.log(`   Current balance: ${formatEther(aBefore)} aPNTs`);

        if (aBefore >= parseEther('10000')) {
            console.log(`   ✅ Balance ≥ 10000, skipping.`);
        } else {
            let aHash: Hex;
            try {
                aHash = send(CONTRACTS.APNTS, encodeFunctionData({ abi: ERC20_ABI, functionName: 'mint', args: [TARGET_ADDRESS, APNTS_AMOUNT] }));
            } catch {
                console.log(`   ℹ️  mint() unavailable, trying transfer()`);
                aHash = send(CONTRACTS.APNTS, encodeFunctionData({ abi: ERC20_ABI, functionName: 'transfer', args: [TARGET_ADDRESS, APNTS_AMOUNT] }));
            }
            await publicClient.waitForTransactionReceipt({ hash: aHash });
            const aAfter = await publicClient.readContract({ address: CONTRACTS.APNTS, abi: ERC20_ABI, functionName: 'balanceOf', args: [TARGET_ADDRESS] });
            console.log(`   ✅ tx: ${aHash}  new balance: ${formatEther(aAfter)} aPNTs`);
        }

        // ── Final summary ─────────────────────────────────────────────────────
        console.log(`\n✅ Complete. Final balances for ${TARGET_ADDRESS}:`);
        const [gF, aF, sF] = await Promise.all([
            publicClient.readContract({ address: CONTRACTS.GTOKEN, abi: ERC20_ABI, functionName: 'balanceOf', args: [TARGET_ADDRESS] }),
            publicClient.readContract({ address: CONTRACTS.APNTS,  abi: ERC20_ABI, functionName: 'balanceOf', args: [TARGET_ADDRESS] }),
            publicClient.readContract({ address: CONTRACTS.SBT,    abi: SBT_ABI,   functionName: 'balanceOf', args: [TARGET_ADDRESS] }),
        ]);
        console.log(`   GToken: ${formatEther(gF)}`);
        console.log(`   aPNTs:  ${formatEther(aF)}`);
        console.log(`   SBT:    ${sF > 0n ? `✅ held` : '❌ none'}`);

    } finally {
        cleanup();
    }
}

main().catch(err => {
    console.error('\n❌ Fatal error:', err.message || err);
    process.exit(1);
});
